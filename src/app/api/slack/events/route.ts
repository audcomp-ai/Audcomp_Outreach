import { NextRequest, NextResponse } from 'next/server'
import { verifySlackRequest, postToLeads, section, fields, divider } from '@/services/slack'
import { parseIntent, parseSlashCommand } from '@/services/slack/parser'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY!

async function sendInngestEvent(name: string, data: Record<string, unknown>) {
  const r = await fetch(`https://inn.gs/e/${INNGEST_EVENT_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  })
  if (!r.ok) throw new Error(`Inngest event failed: ${r.status}`)
}

async function sbGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!r.ok) throw new Error(`Supabase ${r.status}`)
  return r.json()
}

// Slack slash command responses support blocks directly —
// return them here instead of making a separate postToLeads() call.
// This is faster (one fewer HTTP round-trip) and stays well within
// Slack's 3-second response window.
function slackBlocks(blocks: object[], inChannel = true) {
  return {
    response_type: inChannel ? 'in_channel' : 'ephemeral',
    blocks,
  }
}

// ── Handle a parsed intent ────────────────────────────────────────────
async function handleIntent(
  intent: ReturnType<typeof parseIntent>,
): Promise<object> {

  // ── /scrape ───────────────────────────────────────────────────────────
  if (intent.action === 'scrape') {
    // Clear pause flag — non-fatal if Supabase is unreachable
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/scraper_config?key=eq.paused`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'false', updated_at: new Date().toISOString() }),
      })
    } catch (e) {
      console.error('Failed to clear pause flag:', e)
    }

    const desc = intent.industry
      ? `${intent.industry}${intent.location ? ` in ${intent.location.split(',')[0]}` : ''}`
      : 'next industry in rotation'

    await sendInngestEvent('scraper/manual-trigger', {
      ...(intent.industry ? { industry: intent.industry } : {}),
      ...(intent.location ? { location: intent.location } : {}),
    })

    return slackBlocks([
      section(`:rocket: *Scraper starting* — ${desc}`),
      section('_Updates will appear in this channel as the run progresses._'),
    ])
  }

  // ── /status ───────────────────────────────────────────────────────────
  if (intent.action === 'status') {
    try {
      // Use count header instead of fetching all rows — much faster
      const [runs, countResp] = await Promise.all([
        sbGet('scraper_runs?select=run_number,industry,location,status,leads_found&order=started_at.desc&limit=5'),
        fetch(`${SUPABASE_URL}/rest/v1/leads?select=id`, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'count=exact',
            'Range-Unit': 'items',
            Range: '0-0',
          },
        }),
      ])

      // Extract total count from Content-Range header e.g. "0-0/42"
      const contentRange = countResp.headers.get('content-range') ?? ''
      const totalLeads = contentRange.includes('/') ? contentRange.split('/')[1] : '?'

      const lines = (runs as Record<string, unknown>[]).map(r => {
        const icon = r.status === 'completed' ? ':white_check_mark:' :
                     r.status === 'running'   ? ':arrows_counterclockwise:' : ':x:'
        return `${icon} #${r.run_number} — ${r.industry} · ${String(r.location ?? '').split(',')[0]} — *${r.leads_found ?? 0} leads*`
      })

      return slackBlocks([
        section(`:bar_chart: *Scraper Status* — *${totalLeads}* total leads in DB`),
        divider(),
        section(lines.length ? lines.join('\n') : '_No runs yet_'),
      ])
    } catch {
      return slackBlocks([section(':warning: Could not fetch status — Supabase connection issue')])
    }
  }

  // ── /stop ─────────────────────────────────────────────────────────────
  if (intent.action === 'stop') {
    await fetch(`${SUPABASE_URL}/rest/v1/scraper_config?key=eq.paused`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'true', updated_at: new Date().toISOString() }),
    })
    return slackBlocks([
      section(':pause_button: *Scraper paused.* No new runs will start.'),
      section('_Any run currently in progress will finish. Type `/scrape` to resume._'),
    ])
  }

  // ── /campaigns ────────────────────────────────────────────────────────
  if (intent.action === 'campaigns') {
    try {
      const countResp = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?status=eq.pending&select=id`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: 'count=exact',
          'Range-Unit': 'items',
          Range: '0-0',
        },
      })
      const contentRange = countResp.headers.get('content-range') ?? ''
      const pending = contentRange.includes('/') ? contentRange.split('/')[1] : '?'

      return slackBlocks([
        section(`:pencil: *${pending} pending campaign${pending !== '1' ? 's' : ''}* waiting for review.`),
        section('Check *#campaign* channel or open the portal.'),
      ])
    } catch {
      return slackBlocks([section(':warning: Could not fetch campaigns')])
    }
  }

  // ── Unknown — show help ───────────────────────────────────────────────
  return slackBlocks([
    section(':robot_face: *Audcomp AI — available commands:*'),
    section([
      '• `/scrape` — start next scheduled run',
      '• `/scrape medical companies in hamilton` — target specific industry & location',
      '• `/aistatus` — last 5 runs + total lead count',
      '• `/stop` — pause the scraper',
      '• `/campaigns` — count of pending email drafts',
      '',
      '_Industries:_ accounting · insurance · legal · medical',
      '_Locations:_ hamilton · burlington · oakville · toronto · mississauga · brampton · markham',
    ].join('\n')),
  ], false) // ephemeral — only visible to the person who typed it
}

// ── POST handler ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  // If Slack is retrying a previous delivery, acknowledge and stop.
  // Processing retries causes duplicate scrape runs.
  const retryNum = req.headers.get('x-slack-retry-num')
  if (retryNum && parseInt(retryNum) > 0) {
    return NextResponse.json({ ok: true })
  }

  const contentType = req.headers.get('content-type') ?? ''

  // ── 1. JSON — URL verification challenge or event subscription ────────
  if (contentType.includes('application/json')) {
    let body: Record<string, unknown>
    try { body = JSON.parse(rawBody) } catch {
      return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
    }

    // URL verification must respond before signature check — Slack sends
    // this once during setup and expects the challenge echoed immediately.
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge })
    }

    const valid = await verifySlackRequest(rawBody, timestamp, signature)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Natural language messages in #lead-agent
    if (body.type === 'event_callback') {
      const event = body.event as Record<string, unknown>
      if (
        event.type === 'message' &&
        !event.bot_id &&
        !event.subtype &&
        event.channel === process.env.SLACK_LEADS_CHANNEL_ID
      ) {
        const text  = String(event.text ?? '')
        // Slash commands also fire message events — skip them here,
        // they are already handled by the slash command path below.
        if (text.startsWith('/')) return NextResponse.json({ ok: true })
        const intent = parseIntent(text)
        if (intent.action !== 'unknown') {
          // For natural language we post to the channel separately
          // (can't return a slash-command response for event callbacks)
          const result = await handleIntent(intent)
          const blocks = (result as { blocks?: object[] }).blocks ?? []
          if (blocks.length) await postToLeads(blocks)
        }
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  }

  // ── 2. Form-encoded — slash commands ─────────────────────────────────
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const valid = await verifySlackRequest(rawBody, timestamp, signature)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const params  = new URLSearchParams(rawBody)
    const command = params.get('command') ?? ''
    const text    = params.get('text') ?? ''

    const intent   = parseSlashCommand(command, text)
    const response = await handleIntent(intent)

    return NextResponse.json(response)
  }

  return NextResponse.json({ ok: true })
}
