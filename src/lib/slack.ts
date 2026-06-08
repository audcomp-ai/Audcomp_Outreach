import crypto from 'crypto'

const BOT_TOKEN   = () => process.env.SLACK_BOT_TOKEN!
const LEADS_CH    = () => process.env.SLACK_LEADS_CHANNEL_ID!
const CAMPAIGNS_CH = () => process.env.SLACK_CAMPAIGNS_CHANNEL_ID!

// ── Core poster ──────────────────────────────────────────────────────
export async function postMessage(
  channelId: string,
  blocks: object[],
  text = '',
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return // silently skip if not configured

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel: channelId, blocks, text }),
  }).catch(() => {})
}

// ── Channel shorthands ────────────────────────────────────────────────
export async function postToLeads(blocks: object[], text = '') {
  return postMessage(LEADS_CH(), blocks, text)
}

export async function postToCampaigns(blocks: object[], text = '') {
  return postMessage(CAMPAIGNS_CH(), blocks, text)
}

// ── Slack request signature verification ─────────────────────────────
// Slack signs every inbound request with HMAC-SHA256.
// We must verify before acting on any payload.
export async function verifySlackRequest(
  rawBody: string,
  timestamp: string,
  signature: string,
): Promise<boolean> {
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret) return false

  // Reject stale requests (> 5 min old — replay attack protection)
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - parseInt(timestamp, 10)) > 300) return false

  const sigBase = `v0:${timestamp}:${rawBody}`
  const expected = 'v0=' + crypto
    .createHmac('sha256', secret)
    .update(sigBase)
    .digest('hex')

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    )
  } catch {
    return false
  }
}

// ── Block kit helpers ─────────────────────────────────────────────────
export function divider(): object {
  return { type: 'divider' }
}

export function section(text: string): object {
  return { type: 'section', text: { type: 'mrkdwn', text } }
}

export function fields(items: string[]): object {
  return {
    type: 'section',
    fields: items.map(t => ({ type: 'mrkdwn', text: t })),
  }
}

export function actions(
  buttons: { text: string; action_id: string; style?: 'primary' | 'danger'; url?: string }[],
): object {
  return {
    type: 'actions',
    elements: buttons.map(b => ({
      type: 'button',
      text: { type: 'plain_text', text: b.text, emoji: true },
      action_id: b.action_id,
      ...(b.style ? { style: b.style } : {}),
      ...(b.url ? { url: b.url } : {}),
    })),
  }
}
