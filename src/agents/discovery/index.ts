import { inngest, sendInngestEvent } from '@/lib/inngest'
import { postToLeads, section, fields as slackFields, divider } from '@/services/slack'

const SUPABASE_URL  = process.env.SUPABASE_URL!
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY!
const APIFY_TOKEN   = process.env.APIFY_TOKEN!

const PPE_ACTOR = 'peakydev~leads-scraper-ppe'

// PPE industry tags — must match Apollo taxonomy exactly
const INDUSTRIES = ['Insurance', 'Accounting', 'Legal', 'Medical']

// Valid seniority values for peakydev~leads-scraper-ppe actor
// 'Owner' and 'Partner' are NOT valid — actor rejects them silently
const SENIORITY = ['CEO', 'President', 'CXO', 'Director', 'Founder', 'Chairman', 'Executive', 'Head']

// Broader size range: 11–200 employees
const EMPLOYEE_SIZE = ['11 - 50', '51 - 200']

// GTA + Hamilton/Burlington/Oakville — city names as they appear in Apollo data
const TARGET_CITIES = new Set([
  // Hamilton metro
  'hamilton', 'ancaster', 'dundas', 'waterdown', 'stoney creek', 'grimsby',
  // Halton
  'burlington', 'oakville', 'milton', 'halton hills',
  // Toronto
  'toronto', 'north york', 'scarborough', 'etobicoke', 'york',
  // Peel
  'mississauga', 'brampton',
  // York Region
  'vaughan', 'markham', 'richmond hill', 'thornhill', 'newmarket', 'aurora', 'king city',
  // Durham
  'ajax', 'pickering', 'whitby', 'oshawa',
])

// Cities to pass to Apify companyCity filter — narrows results at source
const APIFY_CITIES = [
  'Hamilton', 'Burlington', 'Oakville', 'Milton',
  'Toronto', 'North York', 'Scarborough', 'Etobicoke',
  'Mississauga', 'Brampton',
  'Vaughan', 'Markham', 'Richmond Hill', 'Thornhill', 'Newmarket',
  'Ajax', 'Pickering', 'Whitby', 'Oshawa',
]

function sbHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function sbGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() })
  if (!r.ok) throw new Error(`Supabase GET ${path} → ${r.status}: ${await r.text()}`)
  return r.json()
}

async function sbPost(path: string, body: object, preferReturn = false) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: sbHeaders(preferReturn ? { Prefer: 'return=representation' } : {}),
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Supabase POST ${path} → ${r.status}: ${await r.text()}`)
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

async function sbPatch(path: string, body: object) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Supabase PATCH ${path} → ${r.status}: ${await r.text()}`)
}

async function apifyPost(path: string, body: object) {
  const r = await fetch(`https://api.apify.com/v2/${path}?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(`Apify POST → ${r.status}: ${JSON.stringify(data)}`)
  return data
}

async function apifyGet(path: string) {
  const sep = path.includes('?') ? '&' : '?'
  const r = await fetch(`https://api.apify.com/v2/${path}${sep}token=${APIFY_TOKEN}`)
  const data = await r.json()
  if (!r.ok) throw new Error(`Apify GET → ${r.status}: ${JSON.stringify(data)}`)
  return data
}

// Parse "11 - 50" → 30 (midpoint), null if unparseable
function parseOrgSize(size: string | null | undefined): number | null {
  if (!size) return null
  const range = size.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return Math.round((parseInt(range[1]) + parseInt(range[2])) / 2)
  const single = size.match(/(\d+)\+?/)
  return single ? parseInt(single[1]) : null
}

// Score based on data richness and company profile
function computeLeadScore(item: Record<string, unknown>): number {
  let score = 60
  if (item.email)               score += 15
  if (item.organizationWebsite) score += 5
  const size = item.organizationSize as string | null
  // Sweet spot for MSP: 11-200 employees
  if (size && /^(11|51|101|2 - 10|11 - 50|51 - 200|101 - 500)/.test(size)) score += 10
  const seniority = (item.seniority as string ?? '').toLowerCase()
  if (/ceo|president|founder|cxo/.test(seniority)) score += 10
  return Math.min(score, 95)
}

interface PPEItem {
  personId?: string
  firstName?: string
  lastName?: string
  fullName?: string
  position?: string
  linkedinUrl?: string
  seniority?: string
  email?: string
  organizationName?: string
  organizationWebsite?: string
  organizationLinkedinUrl?: string
  organizationIndustry?: string
  organizationSize?: string
  organizationDescription?: string
  organizationCity?: string
  organizationState?: string
  organizationCountry?: string
}

export const scraperAgent = inngest.createFunction(
  {
    id: 'scraper-agent',
    concurrency: { limit: 1 },
    retries: 2,
    triggers: [{ cron: '0 9 * * *' }, { event: 'scraper/manual-trigger' }],
  },
  async ({ event, step }) => {

    const overrideIndustry = (event.data as { industry?: string } | undefined)?.industry
    const overrideLocation = (event.data as { location?: string } | undefined)?.location

    // ── Step 1: Decide which industry to scrape ──────────────────
    const { industry, location, runNumber, completedCount } = await step.run('pick-industry', async () => {
      const allRuns       = await sbGet('scraper_runs?select=id,status&order=started_at.asc')
      const completedRuns = (allRuns as { status: string }[]).filter(r => r.status === 'completed')
      const industryIndex = completedRuns.length % INDUSTRIES.length
      // parser.ts now emits canonical Apollo taxonomy names directly
      const rawIndustry = overrideIndustry ?? INDUSTRIES[industryIndex]
      // Safety normalization in case old aliases slip through
      const industryNorm = rawIndustry
        .replace(/\s+(firms?|companies|providers?)$/i, '')
        .replace(/^law$/i, 'Legal')
      return {
        industry:       industryNorm,
        location:       overrideLocation ?? 'Ontario, Canada',
        runNumber:      allRuns.length + 1,
        completedCount: completedRuns.length,
      }
    })

    // ── Pause flag ───────────────────────────────────────────────
    const pauseCheck = await step.run('check-pause-flag', async () => {
      const rows = await sbGet('scraper_config?key=eq.paused&select=value&limit=1')
      return (rows as { value: string }[])?.[0]?.value === 'true'
    })
    if (pauseCheck) {
      await postToLeads([section(`:pause_button: *Scraper is paused.* Type \`/scrape\` in Slack to resume.`)])
      return { stopped: true, reason: 'paused via Slack' }
    }

    if (completedCount >= 100) {
      await postToLeads([
        section(`:stop_sign: *Scraper paused — run limit reached*`),
        slackFields([`*Completed runs:* ${completedCount}`, `Re-enable in Inngest dashboard when ready.`]),
      ])
      return { stopped: true, reason: 'run limit reached', completedCount }
    }

    // ── Step 2: Record run + start PPE scrape ────────────────────
    const { runId, ppeRunId } = await step.run('start-apify', async () => {
      await Promise.all([
        postToLeads([
          section(`:rocket: *Scrape run #${runNumber} started*`),
          slackFields([
            `*Industry:* ${industry}`,
            `*Target:* ${SENIORITY.join(', ')} · Ontario`,
            `*Completed so far:* ${completedCount}`,
          ]),
        ]),
      ])

      const runRow = await sbPost('scraper_runs', {
        run_number: runNumber,
        industry,
        location,
        status: 'running',
      }, true)
      const runId = runRow?.[0]?.id

      const actorResp = await apifyPost(`acts/${PPE_ACTOR}/runs`, {
        industry:             [industry],
        companyState:         ['Ontario'],
        companyCountry:       ['Canada'],
        companyCity:          APIFY_CITIES,
        seniority:            SENIORITY,
        companyEmployeeSize:  EMPLOYEE_SIZE,
        includeEmails:        true,
        totalResults:         100,
      })
      const ppeRunId = actorResp?.data?.id
      if (!ppeRunId) throw new Error('No run ID from Apify PPE actor')
      await sbPatch(`scraper_runs?id=eq.${runId}`, { apify_run_id: ppeRunId })

      return { runId, ppeRunId }
    })

    // ── Step 3: Poll PPE until done ──────────────────────────────
    let ppeDatasetId: string | null = null
    for (let attempt = 1; attempt <= 20; attempt++) {
      const result = await step.run(`poll-apify-${attempt}`, async () => {
        await new Promise(r => setTimeout(r, 3000))
        const runData = await apifyGet(`actor-runs/${ppeRunId}`)
        return {
          status:    runData?.data?.status as string,
          datasetId: runData?.data?.defaultDatasetId as string,
        }
      })
      if (result.status === 'SUCCEEDED') { ppeDatasetId = result.datasetId; break }
      if (result.status === 'FAILED' || result.status === 'ABORTED') {
        throw new Error(`PPE actor finished with status: ${result.status}`)
      }
    }
    if (!ppeDatasetId) throw new Error('PPE run timed out')

    // ── Step 4: Fetch results and insert leads ───────────────────
    const { inserted, skipped, newLeadIds } = await step.run('insert-leads', async () => {
      const items = await apifyGet(`datasets/${ppeDatasetId}/items?limit=100`)

      let inserted = 0, skipped = 0
      const newLeadIds: { leadId: string; businessName: string | null }[] = []

      // First 2 dataset rows are status messages (no personId)
      const leads = (items as PPEItem[]).filter(item => !!item.personId)

      for (const item of leads) {
        const orgName = item.organizationName ?? null
        const orgCity = item.organizationCity ?? null

        // Skip items without a company name
        if (!orgName) { skipped++; continue }

        // Skip companies outside the Hamilton / Burlington / Oakville area
        if (!orgCity || !TARGET_CITIES.has(orgCity.toLowerCase())) { skipped++; continue }

        // Dedup by organizationName + city — one lead per company
        const dedup = await sbGet(
          `leads?business_name=eq.${encodeURIComponent(orgName)}&city=eq.${encodeURIComponent(orgCity ?? '')}&select=id&limit=1`
        )
        if ((dedup as unknown[]).length > 0) { skipped++; continue }

        const employees = parseOrgSize(item.organizationSize ?? null)

        const rows = await sbPost('leads', {
          business_name:         orgName,
          email:                 item.email ?? null,
          phone:                 null,
          website:               item.organizationWebsite ?? null,
          linkedin_url:          item.organizationLinkedinUrl ?? null,
          category:              industry,
          city:                  orgCity,
          state:                 'Ontario',
          lead_score:            computeLeadScore(item as Record<string, unknown>),
          scraped_at:            new Date().toISOString(),
          status:                'new',
          enrichment_status:     'pending',
          // Contact person (decision maker)
          contact_name:          item.fullName ?? null,
          contact_title:         item.position ?? null,
          // LinkedIn data available immediately from PPE
          linkedin_employees:    employees,
          linkedin_description:  item.organizationDescription ?? null,
        }, true)

        const leadId = (rows as { id: string }[])?.[0]?.id
        if (leadId) {
          newLeadIds.push({ leadId, businessName: orgName })
          inserted++
        }
      }

      await sbPatch(`scraper_runs?id=eq.${runId}`, {
        status:       'completed',
        leads_found:  inserted,
        completed_at: new Date().toISOString(),
      })

      return { inserted, skipped, newLeadIds }
    })

    // ── Step 5: Fire lead/created events → triggers enrichment agent ──
    await step.run('fire-enrichment-events', async () => {
      for (const { leadId, businessName } of newLeadIds) {
        await sendInngestEvent('lead/created', { leadId, businessName, industry })
      }
    })

    // ── Step 6: Slack completion notice ─────────────────────────
    await step.run('notify-complete', async () => {
      const nextIndustry = INDUSTRIES[(INDUSTRIES.indexOf(industry) + 1) % INDUSTRIES.length]
      await Promise.all([
        postToLeads([
          section(`:white_check_mark: *Scrape run #${runNumber} complete* — ${industry} · Ontario`),
          divider(),
          slackFields([
            `*Inserted:* ${inserted} leads`,
            `*Skipped:* ${skipped} duplicates`,
            `*Next scheduled:* ${nextIndustry} · Ontario`,
          ]),
        ]),
      ])
    })

    return { runNumber, industry, inserted, skipped }
  }
)
