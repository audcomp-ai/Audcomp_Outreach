import { GoogleGenerativeAI } from '@google/generative-ai'
import { inngest } from '@/lib/inngest'
import { postToLeads, section, fields as slackFields } from '@/services/slack'
import type { TechItem, ServiceFit } from '@/types'
import dns from 'dns/promises'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!
const APIFY_TOKEN  = process.env.APIFY_TOKEN!

const WEBSITE_CRAWLER_ACTOR  = 'apify/website-content-crawler'
const LINKEDIN_ACTOR         = 'bebity/linkedin-company-scraper'
const GOOGLE_PLACES_ACTOR    = 'compass/crawler-google-places'
const GOOGLE_SEARCH_ACTOR    = 'apify/google-search-scraper'

const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// ── Regulatory exposure map ───────────────────────────────────────────────────
const REGULATORY_MAP: Record<string, { body: string; requirement: string; pitchAngle: string }> = {
  Insurance:  { body: 'FSRA (Financial Services Regulatory Authority of Ontario)', requirement: 'Client data protection, incident reporting within 72 hours', pitchAngle: 'An FSRA data breach requires 72-hour incident notification — most brokerages lack the monitoring to detect breaches that fast.' },
  Accounting: { body: 'CPA Ontario + CRA', requirement: 'Client financial record security, 7-year retention, access controls', pitchAngle: 'CPA Ontario requires documented access controls for client financial data — most small firms have no audit trail.' },
  Legal:      { body: 'Law Society of Ontario', requirement: 'Solicitor-client privilege, secure file management, data retention', pitchAngle: 'The Law Society requires demonstrable security for client files — a breach could trigger a conduct review.' },
  Medical:    { body: 'PHIPA (Ontario)', requirement: 'Health information encryption, breach notification, access logging', pitchAngle: 'PHIPA mandates encrypted health records and breach notification — non-compliance fines up to $500K.' },
  default:    { body: 'PIPEDA / Ontario Privacy Act', requirement: 'Reasonable security safeguards for personal data', pitchAngle: 'PIPEDA requires reasonable security for any business holding customer data — most SMBs are non-compliant without realising it.' },
}

// ── Industry case studies ─────────────────────────────────────────────────────
export const CASE_STUDIES: Record<string, string> = {
  Insurance:  'An insurance brokerage in Burlington with 22 employees came to us after their client database was exposed in a ransomware attack. We had them fully recovered and hardened in 72 hours — and they haven\'t had a security incident since.',
  Accounting: 'A Hamilton accounting firm was running year-end on aging workstations shared across three offices. We migrated them to cloud desktops in two weeks — no disruption during tax season.',
  Legal:      'A law firm in Oakville needed to meet Law Society data retention requirements but had no IT policy in place. We set up compliant document management and access controls in 30 days.',
  Medical:    'A medical practice in Burlington had patient records on an unencrypted local server. We migrated them to a PHIPA-compliant cloud environment with full audit logging in three weeks.',
  default:    'A professional services firm in Hamilton was spending hours each month managing their own IT. After partnering with Audcomp, their team\'s focus shifted back to clients — not troubleshooting tech.',
}

// ── Optimal send timing by industry ──────────────────────────────────────────
const SEND_TIMING: Record<string, { avoidMonths: number[]; note: string }> = {
  Accounting: { avoidMonths: [1, 2, 3, 4], note: 'Avoid Jan–Apr (tax season). Best May–Sep.' },
  Insurance:  { avoidMonths: [10, 11, 12], note: 'Avoid Q4 renewal crunch. Best Q1–Q2.' },
  Legal:      { avoidMonths: [],           note: 'Anytime. Avoid Friday afternoons.' },
  default:    { avoidMonths: [],           note: 'No industry-specific timing constraints.' },
}

// ── HTML/markdown tech fingerprinting ────────────────────────────────────────
function fingerprintTech(content: string): TechItem[] {
  const c = content.toLowerCase()
  const found: TechItem[] = []

  const rules: [RegExp, string, TechItem['category'], string][] = [
    [/wp-content|wp-json|wordpress/,                        'WordPress',           'CMS',          'wp-content or wp-json detected'],
    [/cdn\.shopify\.com|shopify\.com\/s\//,                 'Shopify',             'CMS',          'Shopify CDN detected'],
    [/static\.squarespace\.com|squarespace\.com/,           'Squarespace',         'CMS',          'Squarespace static assets detected'],
    [/\.wix\.com|wixstatic\.com/,                           'Wix',                 'CMS',          'Wix domain detected'],
    [/weebly\.com|weeblysite\.com/,                         'Weebly',              'CMS',          'Weebly domain detected'],
    [/hs-scripts\.com|hubspot\.com|hubspot/,                'HubSpot',             'CRM',          'HubSpot script detected'],
    [/salesforce\.com|force\.com|pardot/,                   'Salesforce',          'CRM',          'Salesforce reference detected'],
    [/mailchimp\.com|chimpstatic\.com/,                     'Mailchimp',           'CRM',          'Mailchimp script detected'],
    [/google-analytics\.com|gtag|ga\.js|googletagmanager/,  'Google Analytics',    'Analytics',    'Google Analytics/GTM detected'],
    [/hotjar\.com|static\.hotjar/,                          'Hotjar',              'Analytics',    'Hotjar script detected'],
    [/clarity\.ms|microsoft clarity/,                       'Microsoft Clarity',   'Analytics',    'Microsoft Clarity detected'],
    [/cloudflare\.com|__cfduid|cf-ray/,                     'Cloudflare',          'Security',     'Cloudflare CDN/WAF detected'],
    [/recaptcha\.net|google\.com\/recaptcha/,               'Google reCAPTCHA',    'Security',     'reCAPTCHA detected'],
    [/office365|mail\.protection\.outlook|sharepoint\.com|microsoft teams/,  'Microsoft 365',  'Productivity', 'Microsoft 365 reference detected'],
    [/google workspace|google drive|accounts\.google\.com|google-smtp/,       'Google Workspace', 'Productivity', 'Google Workspace reference detected'],
    [/amazonaws\.com|aws\.amazon/,                          'AWS',                 'Hosting',      'AWS infrastructure detected'],
    [/azurewebsites\.net|azure\.com/,                       'Azure',               'Hosting',      'Azure hosting detected'],
    [/vercel\.app|vercel\.com/,                             'Vercel',              'Hosting',      'Vercel hosting detected'],
    [/netlify\.app|netlify\.com/,                           'Netlify',             'Hosting',      'Netlify hosting detected'],
    [/godaddy\.com|secureserver\.net/,                      'GoDaddy',             'Hosting',      'GoDaddy hosting detected'],
    [/quickbooks|intuit\.com/,                              'QuickBooks',          'Other',        'QuickBooks/Intuit reference detected'],
    [/freshdesk|freshworks/,                                'Freshdesk',           'Other',        'Freshdesk support platform detected'],
    [/zendesk/,                                             'Zendesk',             'Other',        'Zendesk support platform detected'],
  ]

  for (const [pattern, name, category, signal] of rules) {
    if (pattern.test(c) && !found.some(f => f.name === name)) {
      found.push({ name, category, signal })
    }
  }

  return found
}

// ── DNS lookup: MX + SPF + DMARC ─────────────────────────────────────────────
async function lookupDNS(website: string): Promise<{ mx: string | null; hasSPF: boolean; hasDMARC: boolean }> {
  try {
    const url  = new URL(website.startsWith('http') ? website : `https://${website}`)
    const host = url.hostname.replace(/^www\./, '')

    const [mxRecords, txtRecords, dmarcRecords] = await Promise.allSettled([
      dns.resolveMx(host),
      dns.resolveTxt(host),
      dns.resolveTxt(`_dmarc.${host}`),
    ])

    let mx: string | null = null
    if (mxRecords.status === 'fulfilled' && mxRecords.value.length > 0) {
      const exchange = mxRecords.value[0].exchange.toLowerCase()
      if (exchange.includes('google') || exchange.includes('googlemail')) mx = 'Google Workspace'
      else if (exchange.includes('outlook') || exchange.includes('protection.outlook')) mx = 'Microsoft 365'
      else if (exchange.includes('zoho')) mx = 'Zoho Mail'
      else if (exchange.includes('pphosted') || exchange.includes('proofpoint')) mx = 'Proofpoint'
      else mx = exchange
    }

    const allTxt = txtRecords.status === 'fulfilled'
      ? txtRecords.value.flat().join(' ')
      : ''
    const hasSPF = allTxt.includes('v=spf1')

    const dmarcTxt = dmarcRecords.status === 'fulfilled'
      ? dmarcRecords.value.flat().join(' ')
      : ''
    const hasDMARC = dmarcTxt.includes('v=DMARC1')

    return { mx, hasSPF, hasDMARC }
  } catch {
    return { mx: null, hasSPF: false, hasDMARC: false }
  }
}

// ── Infer contact technical background from PPE seniority/title ───────────────
function inferContactTechnical(position: string | null, seniority: string | null): boolean {
  const combined = `${position ?? ''} ${seniority ?? ''}`.toLowerCase()
  return /\b(cto|ciso|it director|it manager|vp (of )?it|systems|network|technical|devops|engineer|developer)\b/.test(combined)
}

// ── Regulatory exposure ───────────────────────────────────────────────────────
function getRegulatory(industry: string) {
  return REGULATORY_MAP[industry] ?? REGULATORY_MAP.default
}

// ── Risk score (0–100) ────────────────────────────────────────────────────────
function calcRiskScore(signals: {
  hasWordPress: boolean
  hasCloudflare: boolean
  hasSPF: boolean
  hasDMARC: boolean
  hasSSL: boolean
  employeeCount: number | null
  itMaturity: number | null
  googleRating: number | null
}): number {
  let risk = 40 // baseline
  if (signals.hasWordPress && !signals.hasCloudflare) risk += 20   // unprotected WP
  if (!signals.hasSPF)    risk += 10   // no SPF = email spoofing risk
  if (!signals.hasDMARC)  risk += 15   // no DMARC = phishing risk
  if (!signals.hasSSL)    risk += 10   // no HTTPS
  if (signals.employeeCount && signals.employeeCount < 20) risk += 5  // small team, no dedicated IT
  if (signals.itMaturity !== null && signals.itMaturity <= 2) risk += 10
  if (signals.googleRating !== null && signals.googleRating < 3.5) risk += 5  // poor reviews = stressed ops
  return Math.min(risk, 99)
}

// ── Supabase / Apify helpers ──────────────────────────────────────────────────
function sbHeaders(extra: Record<string, string> = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra }
}

async function sbGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() })
  if (!r.ok) throw new Error(`Supabase GET ${path} → ${r.status}: ${await r.text()}`)
  return r.json()
}

async function sbPatch(path: string, body: object) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Supabase PATCH ${path} → ${r.status}: ${await r.text()}`)
}

async function apifyPost(path: string, body: object) {
  const r = await fetch(`https://api.apify.com/v2/${path}?token=${APIFY_TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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

async function runApifyAndWait(actorId: string, input: object, maxAttempts = 5): Promise<string | null> {
  try {
    const resp  = await apifyPost(`acts/${actorId}/runs`, input)
    const runId = resp?.data?.id as string | undefined
    if (!runId) return null

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 6000))
      const run    = await apifyGet(`actor-runs/${runId}`)
      const status = run?.data?.status as string
      if (status === 'SUCCEEDED') return run?.data?.defaultDatasetId as string
      if (status === 'FAILED' || status === 'ABORTED') return null
    }
    return null
  } catch {
    return null
  }
}

// ── Enrichment agent ──────────────────────────────────────────────────────────
export const enrichmentAgent = inngest.createFunction(
  {
    id: 'enrichment-agent',
    concurrency: { limit: 3 },
    retries: 2,
    triggers: [{ event: 'lead/created' }],
  },
  async ({ event, step }) => {
    const { leadId, businessName, industry } = event.data

    // ── 1. Fetch lead ─────────────────────────────────────────────
    const lead = await step.run('fetch-lead', async () => {
      const rows = await sbGet(`leads?id=eq.${leadId}&select=*&limit=1`)
      const lead = (rows as Record<string, unknown>[])?.[0]
      if (!lead) throw new Error(`Lead ${leadId} not found`)
      return lead
    })

    await step.run('mark-running', async () => {
      await sbPatch(`leads?id=eq.${leadId}`, { enrichment_status: 'running' })
    })

    // ── 2. Scrape website ─────────────────────────────────────────
    const websiteContent = await step.run('scrape-website', async () => {
      const website = lead.website as string | null
      if (!website) return null

      const datasetId = await runApifyAndWait(WEBSITE_CRAWLER_ACTOR, {
        startUrls: [{ url: website }],
        maxCrawlPages: 3,
        maxCrawlDepth: 1,
        saveFiles: false,
        saveHtml: true,
        saveMarkdown: true,
      })
      if (!datasetId) return null

      const items = await apifyGet(`datasets/${datasetId}/items?limit=5`)
      const markdown = (items as { markdown?: string; text?: string; html?: string }[])
        .map(i => i.markdown ?? i.text ?? '')
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 5000)

      const html = (items as { html?: string }[])
        .map(i => i.html ?? '')
        .filter(Boolean)
        .join('\n')
        .slice(0, 8000)

      return { markdown: markdown || null, html: html || null }
    })

    // ── 3. Fingerprint tech stack (no API — uses crawled content) ─
    const fingerprintedTech = await step.run('detect-tech-stack', async () => {
      if (!websiteContent) return []
      const combined = `${websiteContent.markdown ?? ''} ${websiteContent.html ?? ''}`
      return fingerprintTech(combined)
    })

    // ── 4. DNS lookup (free — built-in Node dns module) ───────────
    const dnsData = await step.run('lookup-dns', async () => {
      const website = lead.website as string | null
      if (!website) return { mx: null, hasSPF: false, hasDMARC: false }
      return lookupDNS(website)
    })

    // ── 5. Scrape LinkedIn ────────────────────────────────────────
    const linkedinData = await step.run('scrape-linkedin', async () => {
      const name = businessName ?? (lead.business_name as string | null)
      const city = lead.city as string | null
      if (!name) return null

      const query     = [name, city].filter(Boolean).join(' ')
      const datasetId = await runApifyAndWait(LINKEDIN_ACTOR, {
        queries: [query],
        proxy: { useApifyProxy: true },
      })
      if (!datasetId) return null

      const items = await apifyGet(`datasets/${datasetId}/items?limit=3`)
      const first = (items as Record<string, unknown>[])?.[0]
      if (!first) return null

      return {
        employees:   (first.employeeCount ?? first.staffCount ?? null) as number | null,
        description: (first.description  ?? first.about       ?? null) as string | null,
      }
    })

    // ── 6. Google reviews via Apify ───────────────────────────────
    const reviewsData = await step.run('scrape-google-reviews', async () => {
      const name = businessName ?? (lead.business_name as string | null)
      const city = lead.city as string | null
      if (!name) return null

      const query     = [name, city].filter(Boolean).join(' ')
      const datasetId = await runApifyAndWait(GOOGLE_PLACES_ACTOR, {
        searchStringsArray: [query],
        maxCrawledPlaces: 1,
        maxReviews: 5,
        includeHistogram: false,
        includeOpeningHours: false,
        language: 'en',
      }, 6)
      if (!datasetId) return null

      const items = await apifyGet(`datasets/${datasetId}/items?limit=1`)
      const place = (items as Record<string, unknown>[])?.[0]
      if (!place) return null

      const reviews = ((place.reviews as { text?: string }[]) ?? [])
        .map(r => r.text ?? '')
        .filter(Boolean)
        .slice(0, 5)

      return {
        rating:      (place.totalScore ?? place.rating ?? null) as number | null,
        reviewCount: (place.reviewsCount ?? place.userRatingsTotal ?? null) as number | null,
        reviews,
      }
    })

    // ── 7. Google News scan ───────────────────────────────────────
    const newsSignal = await step.run('scan-company-news', async () => {
      const name = businessName ?? (lead.business_name as string | null)
      const city = lead.city as string | null
      if (!name) return null

      const query     = `"${name}" ${city ?? 'Ontario'}`
      const datasetId = await runApifyAndWait(GOOGLE_SEARCH_ACTOR, {
        queries: query,
        maxPagesPerQuery: 1,
        resultsPerPage: 5,
        mobileResults: false,
      }, 4)
      if (!datasetId) return null

      const items = await apifyGet(`datasets/${datasetId}/items?limit=5`)
      const results = items as { title?: string; snippet?: string; date?: string }[]

      const newsItems = results
        .filter(r => r.title && (r.snippet || r.date))
        .slice(0, 2)

      if (newsItems.length === 0) return null
      return newsItems.map(r => `${r.title}${r.snippet ? ` — ${r.snippet.slice(0, 120)}` : ''}`).join(' | ')
    })

    // ── 8. Pure inferences (no API) ───────────────────────────────
    const { regulatory, contactIsTechnical } = await step.run('infer-enrichment', async () => {
      const position  = lead.contact_title as string | null
      const seniority = null // seniority not stored separately — infer from title
      return {
        regulatory:         getRegulatory(industry),
        contactIsTechnical: inferContactTechnical(position, seniority),
      }
    })

    // ── 9. Gemini deep analysis ───────────────────────────────────
    const analysis = await step.run('analyze-intel', async () => {
      if (!process.env.GEMINI_API_KEY?.trim()) return null

      const reviews: string[] = reviewsData?.reviews ?? []
      const techContext = fingerprintedTech.length > 0
        ? fingerprintedTech.map(t => `${t.name} (${t.category}): ${t.signal}`).join('\n')
        : 'No tech signals detected from HTML'

      const dnsContext = [
        dnsData.mx ? `Email platform: ${dnsData.mx}` : 'Email platform: unknown',
        `SPF record: ${dnsData.hasSPF ? 'present' : 'MISSING'}`,
        `DMARC record: ${dnsData.hasDMARC ? 'present' : 'MISSING'}`,
      ].join('\n')

      const prompt = `You are analyzing a ${industry} business to build a full MSP sales intelligence profile.

BUSINESS: ${businessName ?? lead.business_name ?? 'Unknown'}
LOCATION: ${[lead.city, lead.state].filter(Boolean).join(', ')}
EMPLOYEE COUNT: ${linkedinData?.employees ?? lead.linkedin_employees ?? 'unknown'}
CONTACT: ${lead.contact_title ?? 'Unknown title'}
REGULATORY EXPOSURE: ${regulatory.body} — ${regulatory.requirement}

WEBSITE CONTENT:
${websiteContent?.markdown?.slice(0, 2000) ?? 'Not available'}

DETECTED TECH (from HTML fingerprinting):
${techContext}

DNS SECURITY:
${dnsContext}

GOOGLE REVIEWS (${reviews.length} recent):
${reviews.map((r, i) => `${i + 1}. "${r}"`).join('\n') || 'None available'}

LINKEDIN DESCRIPTION:
${linkedinData?.description ?? lead.linkedin_description ?? 'Not available'}

NEWS SIGNALS:
${newsSignal ?? 'No recent news found'}

Produce a full MSP sales intelligence profile. Score honestly — not every business is a fit.

Respond with JSON only (no markdown wrapper):
{
  "website_summary": "2-3 sentence summary of what they do and their tech maturity",
  "services_offered": "one sentence: what this business sells/does",
  "pain_points": [
    { "signal": "specific evidence", "category": "security|productivity|reliability|compliance|cost", "pitch_angle": "MSP opportunity framing" }
  ],
  "tech_stack": [
    { "name": "...", "category": "CMS|Email|CRM|Productivity|Analytics|Security|Hosting|Other", "signal": "what you detected" }
  ],
  "service_fit": {
    "infrastructure": { "score": 0-100, "reason": "one sentence" },
    "cybersecurity":  { "score": 0-100, "reason": "one sentence" },
    "helpdesk":       { "score": 0-100, "reason": "one sentence" },
    "backup_dr":      { "score": 0-100, "reason": "one sentence" }
  },
  "it_maturity": 1-5
}`

      const model  = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent(prompt)
      const raw    = result.response.text().trim()
      const json   = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      return JSON.parse(json) as {
        website_summary: string
        services_offered: string
        pain_points: { signal: string; category: string; pitch_angle: string }[]
        tech_stack: TechItem[]
        service_fit: ServiceFit
        it_maturity: number
      }
    })

    // ── 10. Build final tech stack (fingerprint + Gemini additions) ─
    const finalTechStack: TechItem[] = analysis?.tech_stack ?? fingerprintedTech

    // ── 11. Calculate risk score ──────────────────────────────────
    const hasWordPress = finalTechStack.some(t => t.name === 'WordPress')
    const hasCloudflare = finalTechStack.some(t => t.name === 'Cloudflare')
    const riskScore = calcRiskScore({
      hasWordPress,
      hasCloudflare,
      hasSPF:        dnsData.hasSPF,
      hasDMARC:      dnsData.hasDMARC,
      hasSSL:        !!(lead.website as string | null)?.startsWith('https'),
      employeeCount: linkedinData?.employees ?? (lead.linkedin_employees as number | null),
      itMaturity:    analysis?.it_maturity ?? null,
      googleRating:  reviewsData?.rating ?? null,
    })

    // ── 12. Save everything to lead ───────────────────────────────
    await step.run('update-lead', async () => {
      const patch: Record<string, unknown> = {
        enrichment_status: 'completed',
        enriched_at:       new Date().toISOString(),
        contact_is_technical: contactIsTechnical,
        has_spf:           dnsData.hasSPF,
        has_dmarc:         dnsData.hasDMARC,
        risk_score:        riskScore,
        regulatory_exposure: JSON.stringify(regulatory),
      }

      if (dnsData.mx)                     patch.dns_mx              = dnsData.mx
      if (newsSignal)                     patch.news_signal         = newsSignal
      if (finalTechStack.length > 0)      patch.tech_stack          = JSON.stringify(finalTechStack)
      if (analysis?.service_fit)          patch.service_fit         = JSON.stringify(analysis.service_fit)
      if (analysis?.it_maturity)          patch.it_maturity         = analysis.it_maturity
      if (analysis?.website_summary)      patch.website_summary     = analysis.website_summary
      if (analysis?.pain_points)          patch.pain_points         = JSON.stringify(analysis.pain_points)
      if (analysis?.services_offered)     patch.services_offered    = analysis.services_offered
      if (linkedinData?.employees)        patch.linkedin_employees  = linkedinData.employees
      if (linkedinData?.description)      patch.linkedin_description = linkedinData.description
      if (reviewsData?.rating !== null && reviewsData?.rating !== undefined)
                                          patch.rating              = reviewsData.rating
      if (reviewsData?.reviewCount !== null && reviewsData?.reviewCount !== undefined)
                                          patch.review_count        = reviewsData.reviewCount
      if (reviewsData?.reviews?.length)   patch.google_reviews      = JSON.stringify(reviewsData.reviews)

      await sbPatch(`leads?id=eq.${leadId}`, patch)
    })

    // ── 13. Slack notification ────────────────────────────────────
    await step.run('notify-enriched', async () => {
      const topService = analysis?.service_fit
        ? (Object.entries(analysis.service_fit) as [string, { score: number; reason: string }][])
            .sort((a, b) => b[1].score - a[1].score)[0]
        : null

      const techSummary = finalTechStack.slice(0, 4).map(t => t.name).join(', ') || 'None detected'
      const sendTiming  = SEND_TIMING[industry] ?? SEND_TIMING.default

      await postToLeads([
        section(`:mag: *Enrichment complete* — *${businessName ?? 'Unknown'}*`),
        slackFields([
          `*IT Risk Score:* ${riskScore}/100`,
          `*IT Maturity:* ${'●'.repeat(analysis?.it_maturity ?? 1)}${'○'.repeat(5 - (analysis?.it_maturity ?? 1))} (${analysis?.it_maturity ?? '?'}/5)`,
          `*Email Platform:* ${dnsData.mx ?? 'Unknown'}`,
          `*SPF/DMARC:* ${dnsData.hasSPF ? '✓' : '✗'} / ${dnsData.hasDMARC ? '✓' : '✗'}`,
          `*Tech stack:* ${techSummary}`,
          topService ? `*Top pitch:* ${topService[0].replace('_', ' ')} (${topService[1].score}/100)` : '*Top pitch:* N/A',
        ]),
        ...(sendTiming.note ? [section(`_${sendTiming.note}_`)] : []),
      ])
    })

    // ── 14. Fire lead/enriched → campaign agent ───────────────────
    await step.run('fire-enriched-event', async () => {
      await inngest.send({
        name: 'lead/enriched',
        data: { leadId, businessName, industry },
      })
    })

    return { leadId, enriched: true, riskScore, techCount: finalTechStack.length }
  },
)
