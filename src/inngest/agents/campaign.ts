import { GoogleGenerativeAI } from '@google/generative-ai'
import { inngest } from '@/lib/inngest'
import { postToCampaigns, section, fields as slackFields, divider, actions as slackActions } from '@/lib/slack'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

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

export const campaignAgent = inngest.createFunction(
  {
    id: 'campaign-agent',
    concurrency: { limit: 5 },
    retries: 3,
    triggers: [{ event: 'lead/enriched' }],
  },
  async ({ event, step }) => {
    const { leadId, businessName, industry } = event.data

    // ── Step 1: Fetch enriched lead ──────────────────────────────
    const lead = await step.run('fetch-lead', async () => {
      const rows = await sbGet(`leads?id=eq.${leadId}&select=*&limit=1`)
      const lead = (rows as Record<string, unknown>[])?.[0]
      if (!lead) throw new Error(`Lead ${leadId} not found`)
      return lead
    })

    // ── Step 2: Draft personalized email with Claude ─────────────
    const { subject, emailBody } = await step.run('draft-email', async () => {
      if (!process.env.GEMINI_API_KEY?.trim()) {
        return {
          subject: `[DRAFT] IT Managed Services for ${lead.business_name ?? industry}`,
          emailBody: `Hi,\n\nThis is a placeholder email draft. Add your GEMINI_API_KEY to generate personalized emails.\n\nBest regards,\nAudcomp IT Solutions`,
        }
      }

      // Parse enrichment data
      const painPoints = lead.pain_points
        ? (JSON.parse(lead.pain_points as string) as { signal: string; category: string; pitch_angle: string }[])
        : []

      const painPointsText = painPoints.length > 0
        ? painPoints.map(p => `- [${p.category.toUpperCase()}] Signal: "${p.signal}" → Angle: ${p.pitch_angle}`).join('\n')
        : 'No specific pain points identified — use industry-general pain points.'

      const prompt = `You are an outreach specialist for Audcomp, a Toronto-area MSP (Managed Service Provider).
Write a short, highly personalized cold email to pitch IT managed services to this business.

BUSINESS PROFILE:
- Name: ${lead.business_name ?? 'the business'}
- Industry: ${industry}
- Location: ${[lead.city, lead.state].filter(Boolean).join(', ') || 'Ontario, Canada'}
- Website: ${lead.website ?? 'not available'}
- Rating: ${lead.rating ?? 'N/A'} stars (${lead.review_count ?? 0} reviews)
- Team size (LinkedIn): ${lead.linkedin_employees ? `~${lead.linkedin_employees} employees` : 'unknown'}

BUSINESS INTELLIGENCE (from website + reviews + LinkedIn):
${lead.website_summary ? `Website summary: ${lead.website_summary}` : ''}
${lead.linkedin_description ? `LinkedIn: ${lead.linkedin_description}` : ''}

IDENTIFIED PAIN POINTS:
${painPointsText}

OUR SERVICES: IT support, cybersecurity, cloud management, network monitoring, 24/7 helpdesk, business continuity, compliance (SOC2/HIPAA/PIPEDA).

REQUIREMENTS:
- Subject line: specific to their industry and one identified pain point
- Body: 3 short paragraphs max
- Tone: confident, peer-to-peer, not salesy
- Reference at least one specific signal from the pain points above
- Close with a soft CTA: 15-min discovery call
- Do NOT use placeholders like [Your Name]
- Sign off as "The Audcomp Team"

Respond with JSON only:
{
  "subject": "...",
  "body": "..."
}`

      const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent(prompt)
      const raw = result.response.text().trim()
      const json = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      const parsed = JSON.parse(json)
      return { subject: parsed.subject as string, emailBody: parsed.body as string }
    })

    // ── Step 3: Save campaign draft ──────────────────────────────
    const campaignId = await step.run('save-draft', async () => {
      const rows = await sbPost('campaigns', {
        lead_id:    leadId,
        subject,
        email_body: emailBody,
        image_url:  null,    // generated on-demand from campaigns tab
        status:     'pending',
      }, true)
      return (rows as { id: string }[])?.[0]?.id
    })

    // ── Step 4: Post to #campaign Slack ──────────────────────────
    await step.run('notify-slack', async () => {
      const businessLabel = businessName ?? 'Unknown business'
      const bodyPreview   = emailBody.slice(0, 180).replace(/\n/g, ' ').trim()
      const portalUrl     = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://leads-dashboard-rho-eight.vercel.app'}/campaigns`

      const painPoints = lead.pain_points
        ? (JSON.parse(lead.pain_points as string) as { signal: string; category: string }[])
        : []
      const painSummary = painPoints.length > 0
        ? painPoints.slice(0, 2).map(p => `• ${p.category}: ${p.signal}`).join('\n')
        : ''

      await postToCampaigns([
        section(`:pencil: *New campaign draft* — *${businessLabel}*`),
        slackFields([
          `*Industry:* ${industry}`,
          `*Subject:* ${subject}`,
        ]),
        ...(painSummary ? [section(`*Pain points detected:*\n${painSummary}`)] : []),
        divider(),
        section(`_${bodyPreview}${emailBody.length > 180 ? '…' : ''}_`),
        divider(),
        slackActions([
          { text: '✅ Approve',        action_id: `approve_campaign:${campaignId}`, style: 'primary' },
          { text: '❌ Reject',         action_id: `reject_campaign:${campaignId}`,  style: 'danger' },
          { text: '🔗 View in Portal', action_id: `view_campaign:${campaignId}`,   url: portalUrl },
        ]),
      ])
    })

    return { campaignId, leadId, subject }
  }
)
