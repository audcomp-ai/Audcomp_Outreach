import { inngest, sendInngestEvent } from '@/lib/inngest'
import { postToLeads, section, fields as slackFields, divider } from '@/services/slack'

const SUPABASE_URL  = process.env.SUPABASE_URL!
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY!
const APIFY_TOKEN   = process.env.APIFY_TOKEN!

// Switched from peakydev~leads-scraper-ppe (Apollo PPE) to khadinakbar~universal-lead-finder
// (DuckDuckGo + website crawl) while PPE plan is being upgraded.
const UNIVERSAL_ACTOR = 'khadinakbar~universal-lead-finder'

const INDUSTRIES = ['Insurance', 'Accounting', 'Legal', 'Medical']

// GTA + Hamilton/Burlington/Oakville — city names as they appear in the actor output
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

// Score based on data completeness from universal-lead-finder output
function computeLeadScore(item: UniversalLeadItem): number {
  let score = 50
  if (item.email)        score += 20
  if (item.phone)        score += 10
  if (item.website)      score += 10
  if (item.linkedin_url) score += 5
  if (item.rating && item.rating >= 4.0) score += 5
  return Math.min(score, 95)
}

interface UniversalLeadItem {
  business_name?: string
  category?:      string | null
  address?:       string | null
  city?:          string | null
  state?:         string | null
  zip?:           string | null
  phone?:         string | null
  website?:       string | null
  email?:         string | null
  all_emails?:    string[]
  linkedin_url?:  string | null
  facebook_url?:  string | null
  twitter_url?:   string | null
  instagram_url?: string | null
  rating?:        number | null
  review_count?:  number | null
  lead_score?:    number | null
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

    // ── Step 2: Record run + start universal lead finder ─────────
    const { runId, apifyRunId } = await step.run('start-apify', async () => {
      await postToLeads([
        section(`:rocket: *Scrape run #${runNumber} started*`),
        slackFields([
          `*Industry:* ${industry}`,
          `*Target:* Hamilton · Burlington · Oakville · Ontario`,
          `*Completed so far:* ${completedCount}`,
        ]),
      ])

      const runRow = await sbPost('scraper_runs', {
        run_number: runNumber,
        industry,
        location,
        status: 'running',
      }, true)
      const runId = runRow?.[0]?.id

      const searchQuery = `${industry} companies in Hamilton Burlington Oakville Ontario Canada`
      const actorResp = await apifyPost(`acts/${UNIVERSAL_ACTOR}/runs`, {
        searchQuery,
        location:   'Hamilton, Ontario, Canada',
        maxResults: 10,
      })
      const apifyRunId = actorResp?.data?.id
      if (!apifyRunId) throw new Error('No run ID from Apify universal-lead-finder')
      await sbPatch(`scraper_runs?id=eq.${runId}`, { apify_run_id: apifyRunId })

      return { runId, apifyRunId }
    })

    // ── Step 3: Poll until done ──────────────────────────────────
    let datasetId: string | null = null
    for (let attempt = 1; attempt <= 20; attempt++) {
      const result = await step.run(`poll-apify-${attempt}`, async () => {
        await new Promise(r => setTimeout(r, 3000))
        const runData = await apifyGet(`actor-runs/${apifyRunId}`)
        return {
          status:    runData?.data?.status as string,
          datasetId: runData?.data?.defaultDatasetId as string,
        }
      })
      if (result.status === 'SUCCEEDED') { datasetId = result.datasetId; break }
      if (result.status === 'FAILED' || result.status === 'ABORTED') {
        throw new Error(`Actor finished with status: ${result.status}`)
      }
    }
    if (!datasetId) throw new Error('Apify run timed out')

    // ── Step 4: Fetch results and insert leads ───────────────────
    const { inserted, skipped, newLeadIds } = await step.run('insert-leads', async () => {
      const items = await apifyGet(`datasets/${datasetId}/items?limit=10`)

      let inserted = 0, skipped = 0
      const newLeadIds: { leadId: string; businessName: string | null }[] = []

      // Filter: must have a name, minimum lead_score >= 30 to skip junk/directory pages
      const leads = (items as UniversalLeadItem[]).filter(
        item => !!item.business_name && (item.lead_score ?? 0) >= 30
      )

      for (const item of leads) {
        const orgName = item.business_name ?? null
        if (!orgName) { skipped++; continue }

        // Actor often returns city: null — default to Hamilton since search is already geo-targeted
        const orgCity = (item.city && TARGET_CITIES.has(item.city.toLowerCase()))
          ? item.city
          : 'Hamilton'

        // Dedup by business_name + city
        const dedup = await sbGet(
          `leads?business_name=eq.${encodeURIComponent(orgName)}&city=eq.${encodeURIComponent(orgCity ?? '')}&select=id&limit=1`
        )
        if ((dedup as unknown[]).length > 0) { skipped++; continue }

        const rows = await sbPost('leads', {
          business_name:     orgName,
          email:             item.email ?? null,
          phone:             item.phone ?? null,
          website:           item.website ?? null,
          linkedin_url:      item.linkedin_url ?? null,
          category:          industry,
          city:              orgCity,
          state:             'Ontario',
          lead_score:        computeLeadScore(item),
          scraped_at:        new Date().toISOString(),
          status:            'new',
          enrichment_status: 'pending',
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
