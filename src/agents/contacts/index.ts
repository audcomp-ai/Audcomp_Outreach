import { GoogleGenerativeAI } from '@google/generative-ai'
import { inngest } from '@/lib/inngest'
import { postToCampaigns, section, fields as slackFields, divider, actions as slackActions } from '@/services/slack'
import { CASE_STUDIES } from '@/agents/enrichment'
import type { ServiceFit } from '@/types'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// ── Service labels for email copy ─────────────────────────────────────────────
const SERVICE_LABELS: Record<string, { name: string; cta: string; hook: string }> = {
  cybersecurity:  {
    name: 'cybersecurity',
    cta:  '15-min security walkthrough',
    hook: 'security gap we see in {industry} firms like {business}',
  },
  helpdesk:       {
    name: 'managed IT support',
    cta:  '15-min call about reducing IT burden on your team',
    hook: 'how {business}\'s team handles IT issues today',
  },
  infrastructure: {
    name: 'infrastructure & cloud',
    cta:  '15-min infrastructure assessment',
    hook: 'whether {business}\'s IT infrastructure is ready for what\'s next',
  },
  backup_dr:      {
    name: 'backup & disaster recovery',
    cta:  '15-min business continuity review',
    hook: 'one ransomware attack — is {business} ready to recover?',
  },
}

// ── Pick the primary service to lead with ─────────────────────────────────────
function pickPrimaryService(serviceFit: ServiceFit): keyof ServiceFit {
  return (Object.entries(serviceFit) as [keyof ServiceFit, { score: number }][])
    .sort((a, b) => b[1].score - a[1].score)[0][0]
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
function sbHeaders(extra: Record<string, string> = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra }
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

// ── Campaign agent ────────────────────────────────────────────────────────────
export const campaignAgent = inngest.createFunction(
  {
    id: 'campaign-agent',
    concurrency: { limit: 5 },
    retries: 3,
    triggers: [{ event: 'lead/enriched' }],
  },
  async ({ event, step }) => {
    const { leadId, businessName, industry } = event.data

    // ── 1. Fetch enriched lead ────────────────────────────────────
    const lead = await step.run('fetch-lead', async () => {
      const rows = await sbGet(`leads?id=eq.${leadId}&select=*&limit=1`)
      const lead = (rows as Record<string, unknown>[])?.[0]
      if (!lead) throw new Error(`Lead ${leadId} not found`)
      return lead
    })

    // ── 2. Parse enriched intel ───────────────────────────────────
    const { primaryService, serviceFit, techStack, painPoints, regulatory } = await step.run('parse-intel', async () => {
      const serviceFit: ServiceFit | null = lead.service_fit
        ? JSON.parse(lead.service_fit as string)
        : null

      const techStack = lead.tech_stack
        ? JSON.parse(lead.tech_stack as string) as { name: string; category: string }[]
        : []

      const painPoints = lead.pain_points
        ? JSON.parse(lead.pain_points as string) as { signal: string; category: string; pitch_angle: string }[]
        : []

      const regulatory = lead.regulatory_exposure
        ? JSON.parse(lead.regulatory_exposure as string) as { body: string; requirement: string; pitchAngle: string }
        : null

      const primaryService = serviceFit ? pickPrimaryService(serviceFit) : 'helpdesk'

      return { primaryService, serviceFit, techStack, painPoints, regulatory }
    })

    // ── 3. Draft 3-email sequence with Gemini ─────────────────────
    const emailSequence = await step.run('draft-email-sequence', async () => {
      const svc        = SERVICE_LABELS[primaryService] ?? SERVICE_LABELS.helpdesk
      const caseStudy  = CASE_STUDIES[industry] ?? CASE_STUDIES.default
      const bizName    = businessName ?? (lead.business_name as string) ?? 'your business'
      const city       = lead.city as string | null ?? 'Ontario'
      const itMaturity = lead.it_maturity as number | null ?? 2
      const riskScore  = lead.risk_score as number | null ?? 50
      const isTechnical = lead.contact_is_technical as boolean | null ?? false

      const techSummary = techStack.slice(0, 5).map((t: { name: string; category: string }) => `${t.name} (${t.category})`).join(', ') || 'standard business tools'
      const topPainPoint = painPoints[0] ?? null
      const emailPlatform = lead.dns_mx as string | null ?? null
      const hasSPF   = lead.has_spf as boolean | null
      const hasDMARC = lead.has_dmarc as boolean | null
      const googleRating = lead.rating as number | null
      const reviewSnippets = lead.google_reviews
        ? (JSON.parse(lead.google_reviews as string) as string[]).slice(0, 2)
        : []

      const toneGuide = itMaturity <= 2
        ? 'Non-technical decision maker. Use plain language. No jargon. Focus on business outcomes, time saved, peace of mind.'
        : itMaturity >= 4
        ? 'Technical audience. Use specific tech terminology. Reference their detected stack. Peer-to-peer tone.'
        : 'Mixed audience. Balance clarity with credibility. Explain what you do without being condescending.'

      // Fallback sequence if Gemini key missing
      if (!process.env.GEMINI_API_KEY?.trim()) {
        const subject1 = `IT support for ${bizName} — a ${industry.toLowerCase()} firm in ${city}`
        const body1 = `Hi,\n\nWe work with ${industry.toLowerCase()} firms across the Hamilton area and noticed ${bizName} could benefit from managed IT support.\n\nAudcomp handles everything from cybersecurity to helpdesk — so your team can focus on clients, not computers.\n\nWorth a quick 15-min call?\n\nThe Audcomp Team`
        const subject2 = `Following up — IT managed services for ${bizName}`
        const body2 = `Hi,\n\nJust following up on my last note. We specialize in IT support for ${industry.toLowerCase()} firms in ${city} — compliance, security, and reliability.\n\nHappy to answer any questions.\n\nThe Audcomp Team`
        const subject3 = `Last note — how we helped a ${industry.toLowerCase()} firm like ${bizName}`
        const body3 = `Hi,\n\n${caseStudy}\n\nIf you're open to a quick conversation, I'd love to share how we could do the same for ${bizName}.\n\nThe Audcomp Team`
        return [
          { subject: subject1, body: body1 },
          { subject: subject2, body: body2 },
          { subject: subject3, body: body3 },
        ]
      }

      const prompt = `You are an outreach specialist for Audcomp, a Managed Service Provider (MSP) serving SMBs in Hamilton, Burlington, and Oakville, Ontario.

Draft a 3-email cold outreach sequence for this lead. Each email builds on the previous one.

═══ LEAD INTELLIGENCE ═══
Business: ${bizName}
Industry: ${industry}
Location: ${city}, Ontario
IT Risk Score: ${riskScore}/100
IT Maturity: ${itMaturity}/5

DETECTED TECHNOLOGY STACK:
${techSummary}

EMAIL PLATFORM: ${emailPlatform ?? 'Unknown'}
SPF Record: ${hasSPF ? 'Present' : 'MISSING — phishing risk'}
DMARC Record: ${hasDMARC ? 'Present' : 'MISSING — spoofing risk'}

${topPainPoint ? `TOP PAIN POINT:\nSignal: "${topPainPoint.signal}"\nCategory: ${topPainPoint.category}\nOpportunity: ${topPainPoint.pitch_angle}` : ''}

${reviewSnippets.length > 0 ? `GOOGLE REVIEWS:\n${reviewSnippets.map((r, i) => `${i + 1}. "${r}"`).join('\n')}` : ''}

WEBSITE SUMMARY: ${lead.website_summary ?? 'Not available'}
WHAT THEY DO: ${lead.services_offered ?? `${industry} professional services`}
LINKEDIN: ${lead.linkedin_description ?? 'Not available'}

═══ AUDCOMP SERVICES ═══
Primary pitch: ${svc.name.toUpperCase()} (highest fit score: ${serviceFit?.[primaryService]?.score ?? 'N/A'}/100)
Reason: ${serviceFit?.[primaryService]?.reason ?? 'Good fit based on profile'}

Other services available: IT support, cybersecurity, cloud management, network monitoring, 24/7 helpdesk, business continuity, PIPEDA/PHIPA compliance.

INDUSTRY CASE STUDY TO USE IN EMAIL 3:
"${caseStudy}"

═══ TONE GUIDANCE ═══
${toneGuide}
Contact is ${isTechnical ? 'TECHNICAL (CTO/IT Manager type)' : 'NON-TECHNICAL (CEO/Owner/Partner type)'}.

═══ REQUIREMENTS FOR ALL 3 EMAILS ═══
- Personalize to THIS specific business — no generic "we offer IT services"
- Reference at least one specific detected signal (tech, review, DNS gap, or pain point)
- Sign off as "The Audcomp Team"
- No placeholders like [Your Name] or [Company]
- Max 3 short paragraphs per email
- Confident, peer-to-peer tone — not salesy

EMAIL 1 (Day 0 — cold open):
- Hook: reference their specific tech signal or the pain point
- Body: one specific problem we solve for ${industry} firms, tied to their signals
- CTA: "${svc.cta}"

EMAIL 2 (Day 7 — follow-up):
- Acknowledge they may have missed the first email (brief, not apologetic)
- New angle: reference their regulatory exposure (${regulatory?.body ?? 'PIPEDA'}) or a different detected signal
- CTA: offer to send a 1-page checklist or answer one specific question — lower commitment

EMAIL 3 (Day 14 — social proof close):
- Lead with the case study
- Connect it to their situation specifically
- Final CTA: "Last time I'll reach out — happy to connect if the timing is ever right"

Respond with JSON only (no markdown, no wrapper):
{
  "emails": [
    { "subject": "...", "body": "..." },
    { "subject": "...", "body": "..." },
    { "subject": "...", "body": "..." }
  ]
}`

      try {
        const model  = getGenAI().getGenerativeModel({ model: 'gemini-1.5-flash-8b' })
        const result = await model.generateContent(prompt)
        const raw    = result.response.text().trim()
        const json   = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
        const parsed = JSON.parse(json) as { emails: { subject: string; body: string }[] }
        return parsed.emails.slice(0, 3)
      } catch (err) {
        console.error('Gemini draft-email-sequence failed, using fallback:', err)
        const subject1 = `IT support for ${bizName} — a ${industry.toLowerCase()} firm in ${city}`
        const body1 = `Hi,\n\nWe work with ${industry.toLowerCase()} firms across the Hamilton area and noticed ${bizName} could benefit from managed IT support.\n\nAudcomp handles everything from cybersecurity to helpdesk — so your team can focus on clients, not computers.\n\nWorth a quick 15-min call?\n\nThe Audcomp Team`
        const subject2 = `Following up — IT managed services for ${bizName}`
        const body2 = `Hi,\n\nJust following up on my last note. We specialize in IT support for ${industry.toLowerCase()} firms in ${city} — compliance, security, and reliability.\n\nHappy to answer any questions.\n\nThe Audcomp Team`
        const subject3 = `Last note — how we helped a ${industry.toLowerCase()} firm like ${bizName}`
        const body3 = `Hi,\n\n${caseStudy}\n\nIf you're open to a quick conversation, I'd love to share how we could do the same for ${bizName}.\n\nThe Audcomp Team`
        return [
          { subject: subject1, body: body1 },
          { subject: subject2, body: body2 },
          { subject: subject3, body: body3 },
        ]
      }
    })

    // ── 4. Save 3-email sequence to campaigns table ───────────────
    const campaignIds = await step.run('save-campaigns', async () => {
      const now    = new Date()
      const delays = [0, 7, 14] // days
      const ids: string[] = []

      for (let i = 0; i < emailSequence.length; i++) {
        const sendAfter = new Date(now)
        sendAfter.setDate(sendAfter.getDate() + delays[i])

        const rows = await sbPost('campaigns', {
          lead_id:      leadId,
          subject:      emailSequence[i].subject,
          email_body:   emailSequence[i].body,
          image_url:    null,
          status:       'pending',
          sequence_num: i + 1,
          send_after:   sendAfter.toISOString(),
        }, true)

        const id = (rows as { id: string }[])?.[0]?.id
        if (id) ids.push(id)
      }

      return ids
    })

    // ── 5. Post to #campaigns Slack ───────────────────────────────
    await step.run('notify-slack', async () => {
      const bizLabel   = businessName ?? 'Unknown business'
      const primary    = SERVICE_LABELS[primaryService] ?? SERVICE_LABELS.helpdesk
      const preview    = emailSequence[0].body.slice(0, 180).replace(/\n/g, ' ').trim()
      const portalUrl  = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://audcomp-outreach.vercel.app'}/campaigns`
      const riskScore  = lead.risk_score as number | null ?? 0
      const itMaturity = lead.it_maturity as number | null ?? 1

      const topPainPoints = JSON.parse((lead.pain_points as string | null) ?? '[]') as { signal: string; category: string }[]
      const painSummary   = topPainPoints.slice(0, 2).map(p => `• ${p.category}: ${p.signal}`).join('\n')

      await postToCampaigns([
        section(`:pencil: *3-email sequence drafted* — *${bizLabel}*`),
        slackFields([
          `*Industry:* ${industry}`,
          `*Primary pitch:* ${primary.name}`,
          `*IT Risk:* ${riskScore}/100`,
          `*IT Maturity:* ${itMaturity}/5`,
        ]),
        ...(painSummary ? [section(`*Key signals:*\n${painSummary}`)] : []),
        divider(),
        section(`*Email 1 subject:* ${emailSequence[0].subject}`),
        section(`_${preview}${emailSequence[0].body.length > 180 ? '…' : ''}_`),
        divider(),
        slackActions([
          { text: '✅ Approve All', action_id: `approve_campaign:${campaignIds[0]}`, style: 'primary' },
          { text: '❌ Reject',      action_id: `reject_campaign:${campaignIds[0]}`,  style: 'danger' },
          { text: '🔗 View Portal', action_id: `view_campaign:${campaignIds[0]}`,   url: portalUrl },
        ]),
      ])
    })

    return { campaignIds, leadId, primaryService, emailCount: emailSequence.length }
  },
)
