import { GoogleGenerativeAI } from '@google/generative-ai'
import { inngest } from '@/lib/inngest'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!
const APIFY_TOKEN  = process.env.APIFY_TOKEN!

const WEBSITE_CRAWLER_ACTOR = 'apify/website-content-crawler'
const LINKEDIN_ACTOR        = 'bebity/linkedin-company-scraper'

const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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

// Run an Apify actor and return its dataset ID. Non-fatal — returns null on any failure.
async function runApifyAndWait(actorId: string, input: object, maxAttempts = 4): Promise<string | null> {
  try {
    const resp = await apifyPost(`acts/${actorId}/runs`, input)
    const runId = resp?.data?.id as string | undefined
    if (!runId) return null

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const run = await apifyGet(`actor-runs/${runId}`)
      const status = run?.data?.status as string
      if (status === 'SUCCEEDED') return run?.data?.defaultDatasetId as string
      if (status === 'FAILED' || status === 'ABORTED') return null
    }
    return null
  } catch {
    return null
  }
}

export const enrichmentAgent = inngest.createFunction(
  {
    id: 'enrichment-agent',
    concurrency: { limit: 3 },
    retries: 2,
    triggers: [{ event: 'lead/created' }],
  },
  async ({ event, step }) => {
    const { leadId, businessName, industry } = event.data

    // ── Step 1: Fetch lead ────────────────────────────────────────
    const lead = await step.run('fetch-lead', async () => {
      const rows = await sbGet(`leads?id=eq.${leadId}&select=*&limit=1`)
      const lead = (rows as Record<string, unknown>[])?.[0]
      if (!lead) throw new Error(`Lead ${leadId} not found`)
      return lead
    })

    // Mark enrichment running
    await step.run('mark-running', async () => {
      await sbPatch(`leads?id=eq.${leadId}`, { enrichment_status: 'running' })
    })

    // ── Step 2: Scrape website ────────────────────────────────────
    const websiteSummary = await step.run('scrape-website', async () => {
      const website = lead.website as string | null
      if (!website) return null

      const datasetId = await runApifyAndWait(WEBSITE_CRAWLER_ACTOR, {
        startUrls: [{ url: website }],
        maxCrawlPages: 3,
        maxCrawlDepth: 1,
        saveFiles: false,
        saveHtml: false,
        saveMarkdown: true,
      })
      if (!datasetId) return null

      const items = await apifyGet(`datasets/${datasetId}/items?limit=5`)
      const texts = (items as { markdown?: string; text?: string }[])
        .map(i => i.markdown ?? i.text ?? '')
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 4000)

      return texts || null
    })

    // ── Step 3: Scrape LinkedIn ───────────────────────────────────
    const linkedinData = await step.run('scrape-linkedin', async () => {
      const name = businessName ?? (lead.business_name as string | null)
      const city = lead.city as string | null
      if (!name) return null

      const query = [name, city].filter(Boolean).join(' ')
      const datasetId = await runApifyAndWait(LINKEDIN_ACTOR, {
        queries: [query],
        proxy: { useApifyProxy: true },
      })
      if (!datasetId) return null

      const items = await apifyGet(`datasets/${datasetId}/items?limit=3`)
      const first = (items as Record<string, unknown>[])?.[0]
      if (!first) return null

      return {
        employees: (first.employeeCount ?? first.staffCount ?? null) as number | null,
        description: (first.description ?? first.about ?? null) as string | null,
      }
    })

    // ── Step 4: Gemini analysis ───────────────────────────────────
    const analysis = await step.run('analyze-intel', async () => {
      if (!process.env.GEMINI_API_KEY?.trim()) return null

      const reviewsRaw = lead.google_reviews as string | null
      const reviews: string[] = reviewsRaw ? JSON.parse(reviewsRaw) : []

      const hasAnyData = websiteSummary || reviews.length > 0 || linkedinData
      if (!hasAnyData) return null

      const prompt = `You are analyzing a ${industry} business to identify IT/tech pain points for an MSP sales email.

Business: ${businessName ?? lead.business_name ?? 'Unknown'}
Location: ${[lead.city, lead.state].filter(Boolean).join(', ')}

${websiteSummary ? `WEBSITE CONTENT:\n${websiteSummary.slice(0, 2000)}\n` : ''}

${reviews.length > 0 ? `GOOGLE REVIEWS (${reviews.length} recent):\n${reviews.map((r, i) => `${i + 1}. "${r}"`).join('\n')}\n` : ''}

${linkedinData ? `LINKEDIN:\nEmployees: ${linkedinData.employees ?? 'unknown'}\n${linkedinData.description ? `About: ${linkedinData.description}` : ''}\n` : ''}

Identify 2-4 specific pain points or opportunities for IT managed services. Focus on signals like: outdated tech, customer complaints about systems/response times, small team size suggesting no IT staff, mentions of software, slow processes, reliability issues.

Respond with JSON only:
{
  "website_summary": "2-3 sentence summary of what they do and their tech maturity",
  "pain_points": [
    { "signal": "specific evidence from the data", "category": "one of: security|productivity|reliability|compliance|cost", "pitch_angle": "how to frame this as an MSP opportunity" }
  ]
}`

      const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent(prompt)
      const raw = result.response.text().trim()
      const json = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      return JSON.parse(json) as { website_summary: string; pain_points: { signal: string; category: string; pitch_angle: string }[] }
    })

    // ── Step 5: Update lead ───────────────────────────────────────
    await step.run('update-lead', async () => {
      const patch: Record<string, unknown> = {
        enrichment_status: 'completed',
        enriched_at: new Date().toISOString(),
      }

      if (analysis?.website_summary) patch.website_summary = analysis.website_summary
      if (analysis?.pain_points)     patch.pain_points     = JSON.stringify(analysis.pain_points)
      if (linkedinData?.employees)   patch.linkedin_employees = linkedinData.employees
      if (linkedinData?.description) patch.linkedin_description = linkedinData.description

      await sbPatch(`leads?id=eq.${leadId}`, patch)
    })

    // ── Step 6: Fire lead/enriched → triggers campaign agent ─────
    await step.run('fire-enriched-event', async () => {
      await inngest.send({
        name: 'lead/enriched',
        data: { leadId, businessName, industry },
      })
    })

    return { leadId, enriched: true }
  }
)
