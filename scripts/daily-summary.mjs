#!/usr/bin/env node
/**
 * daily-summary.mjs
 * Posts a daily leads pipeline digest to Slack.
 * Designed to run once per day via cron (e.g. 9am).
 */

const SUPABASE_URL  = process.env.SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_KEY
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK

const STATUS_EMOJI = {
  new:       ':white_circle:',
  contacted: ':large_blue_circle:',
  qualified: ':large_yellow_circle:',
  converted: ':large_green_circle:',
  rejected:  ':red_circle:',
}

function sbHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() })
  if (!r.ok) throw new Error(`Supabase GET ${path} → ${r.status}: ${await r.text()}`)
  return r.json()
}

async function main() {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // All leads — count by status
  const allLeads = await sbGet('leads?select=status')
  const total = allLeads.length

  const byStatus = {}
  for (const { status } of allLeads) {
    byStatus[status] = (byStatus[status] ?? 0) + 1
  }

  // Leads added today
  const todayLeads = await sbGet(
    `leads?select=id&scraped_at=gte.${todayStr}T00:00:00Z`
  )
  const addedToday = todayLeads.length

  // Runs today
  const todayRuns = await sbGet(
    `scraper_runs?select=status&started_at=gte.${todayStr}T00:00:00Z`
  )
  const runsToday = todayRuns.length
  const failedToday = todayRuns.filter(r => r.status === 'failed').length

  // Build pipeline breakdown fields
  const pipelineFields = Object.entries(STATUS_EMOJI).map(([s, emoji]) =>
    `${emoji} *${s.charAt(0).toUpperCase() + s.slice(1)}:* ${byStatus[s] ?? 0}`
  )

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Daily Leads Summary — ${dateLabel}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `:busts_in_silhouette: *Total leads:* ${total}` },
        { type: 'mrkdwn', text: `:new: *Added today:* ${addedToday}` },
        { type: 'mrkdwn', text: `:robot_face: *Scrape runs today:* ${runsToday}` },
        { type: 'mrkdwn', text: failedToday > 0
          ? `:warning: *Failed runs:* ${failedToday}`
          : `:white_check_mark: *Failed runs:* 0` },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Pipeline breakdown*' },
    },
    {
      type: 'section',
      fields: pipelineFields.map(f => ({ type: 'mrkdwn', text: f })),
    },
  ]

  const r = await fetch(SLACK_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })

  if (!r.ok) {
    console.error(`Slack POST failed: ${r.status}`)
    process.exit(1)
  }

  console.log(`Daily summary posted — ${total} total leads, ${addedToday} added today`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
