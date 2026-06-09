import { NextRequest, NextResponse } from 'next/server'
import { verifySlackRequest, postToCampaigns, section } from '@/services/slack'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

async function sbPatch(path: string, body: object) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Supabase PATCH → ${r.status}: ${await r.text()}`)
}

// ── POST handler ──────────────────────────────────────────────────────
// Slack sends button-click payloads as form-encoded with a `payload` field (JSON string)
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  const valid = await verifySlackRequest(rawBody, timestamp, signature)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const params  = new URLSearchParams(rawBody)
  const payloadStr = params.get('payload')
  if (!payloadStr) return NextResponse.json({ ok: true })

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(payloadStr)
  } catch {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 })
  }

  // Only handle block_actions
  if (payload.type !== 'block_actions') return NextResponse.json({ ok: true })

  const actions = payload.actions as { action_id: string }[]
  const action  = actions?.[0]
  if (!action) return NextResponse.json({ ok: true })

  const { action_id } = action

  // ── approve_campaign:{id} ────────────────────────────────────────────
  if (action_id.startsWith('approve_campaign:')) {
    const campaignId = action_id.split(':')[1]
    try {
      await sbPatch(`campaigns?id=eq.${campaignId}`, {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      await postToCampaigns([
        section(`:white_check_mark: *Campaign approved* — ready to send.\nCampaign ID: \`${campaignId}\``),
      ])
    } catch (e) {
      await postToCampaigns([section(`:warning: Failed to approve campaign: ${String(e)}`)])
    }
    // Slack expects empty 200 to close the loading state on the button
    return new NextResponse('', { status: 200 })
  }

  // ── reject_campaign:{id} ─────────────────────────────────────────────
  if (action_id.startsWith('reject_campaign:')) {
    const campaignId = action_id.split(':')[1]
    try {
      await sbPatch(`campaigns?id=eq.${campaignId}`, {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      await postToCampaigns([
        section(`:x: *Campaign rejected.*\nCampaign ID: \`${campaignId}\``),
      ])
    } catch (e) {
      await postToCampaigns([section(`:warning: Failed to reject campaign: ${String(e)}`)])
    }
    return new NextResponse('', { status: 200 })
  }

  // ── view_campaign:{id} — direct link to portal ───────────────────────
  if (action_id.startsWith('view_campaign:')) {
    // No DB change needed — the button itself opens the portal URL
    return new NextResponse('', { status: 200 })
  }

  return NextResponse.json({ ok: true })
}
