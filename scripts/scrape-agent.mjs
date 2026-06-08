#!/usr/bin/env node
/**
 * scrape-agent.mjs
 * Rotating B2B lead scraper — Accounting → Insurance → Law firms
 * Location: Hamilton, Burlington, Oakville, Ontario, Canada
 * Runs 3 times (one per industry), then stops.
 */

const SUPABASE_URL    = process.env.SUPABASE_URL
const SUPABASE_KEY    = process.env.SUPABASE_KEY
const APIFY_TOKEN     = process.env.APIFY_TOKEN
const ACTOR_ID        = 'khadinakbar~universal-lead-finder'
const SLACK_WEBHOOK   = process.env.SLACK_WEBHOOK

const INDUSTRIES   = ['Accounting firms', 'Insurance firms', 'Law firms']
const LOCATION     = 'Hamilton, Burlington, Oakville, Ontario, Canada'
const MAX_RUNS     = 3   // set to Infinity to run forever
const LEADS_PER_RUN = 3
const POLL_INTERVAL = 5000  // ms
const MAX_POLLS     = 36    // 36 × 5s = 3 min max wait

// ── Supabase helpers ──────────────────────────────────────────
function sbHeaders(extra = {}) {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() })
  if (!r.ok) throw new Error(`Supabase GET ${path} → ${r.status}: ${await r.text()}`)
  return r.json()
}

async function sbPost(path, body, preferReturn = false) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: sbHeaders(preferReturn ? { 'Prefer': 'return=representation' } : {}),
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Supabase POST ${path} → ${r.status}: ${await r.text()}`)
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

async function sbPatch(path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Supabase PATCH ${path} → ${r.status}: ${await r.text()}`)
}

// ── Apify helpers ─────────────────────────────────────────────
async function apifyPost(path, body) {
  const url = `https://api.apify.com/v2/${path}?token=${APIFY_TOKEN}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(`Apify POST ${path} → ${r.status}: ${JSON.stringify(data)}`)
  return data
}

async function apifyGet(path) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://api.apify.com/v2/${path}${sep}token=${APIFY_TOKEN}`
  const r = await fetch(url)
  const data = await r.json()
  if (!r.ok) throw new Error(`Apify GET ${path} → ${r.status}: ${JSON.stringify(data)}`)
  return data
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}]`, ...args)
}

async function notifySlack(text, fields = []) {
  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text } },
  ]
  if (fields.length) {
    blocks.push({
      type: 'section',
      fields: fields.map(f => ({ type: 'mrkdwn', text: f })),
    })
  }
  try {
    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
  } catch (err) {
    log(`Slack notify failed (non-fatal): ${err.message}`)
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  log('=== Scrape Agent Starting ===')

  // 1. Determine next industry from COMPLETED runs only (failed runs are retried)
  const allRuns       = await sbGet('scraper_runs?select=id,status&order=started_at.asc')
  const completedRuns = allRuns.filter(r => r.status === 'completed')
  const totalRuns     = allRuns.length

  if (completedRuns.length >= MAX_RUNS) {
    log(`Max runs (${MAX_RUNS}) reached. All 3 industries scraped. Stopping.`)
    process.exit(0)
  }

  const industryIndex = completedRuns.length % INDUSTRIES.length
  const industry = INDUSTRIES[industryIndex]
  const query = `${industry} in ${LOCATION}`

  log(`Run ${totalRuns + 1} (completed: ${completedRuns.length}/${MAX_RUNS}): "${industry}"`)
  log(`Query: "${query}"`)

  await notifySlack(
    `:rocket: *Scrape run #${totalRuns + 1} started*`,
    [
      `*Industry:* ${industry}`,
      `*Location:* ${LOCATION}`,
      `*Progress:* ${completedRuns.length}/${MAX_RUNS} runs completed`,
    ]
  )

  // 2. Record run start in Supabase
  const runRow = await sbPost('scraper_runs', {
    run_number: totalRuns + 1,
    industry,
    location: LOCATION,
    status: 'running',
  }, true)
  const runId = runRow?.[0]?.id
  log(`Scraper run recorded: ${runId}`)

  let succeeded = false
  try {
    // 3. Start Apify actor
    log('Starting Apify actor...')
    const actorResp = await apifyPost(`acts/${ACTOR_ID}/runs`, {
      query,
      maxResults: LEADS_PER_RUN,
      country: 'CA',
    })
    const apifyRunId = actorResp?.data?.id
    if (!apifyRunId) throw new Error('No run ID from Apify: ' + JSON.stringify(actorResp))
    log(`Apify run started: ${apifyRunId}`)

    // Save apify run ID
    await sbPatch(`scraper_runs?id=eq.${runId}`, { apify_run_id: apifyRunId })

    // 4. Poll until complete
    log('Polling for completion...')
    let status = 'RUNNING'
    let datasetId = null

    for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
      await sleep(POLL_INTERVAL)
      const runData = await apifyGet(`actor-runs/${apifyRunId}`)
      status = runData?.data?.status
      datasetId = runData?.data?.defaultDatasetId
      log(`  [${attempt}/${MAX_POLLS}] Status: ${status}`)
      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') break
    }

    if (status !== 'SUCCEEDED') throw new Error(`Actor finished with status: ${status}`)
    log(`Actor succeeded. Dataset: ${datasetId}`)

    // 5. Fetch results
    const items = await apifyGet(`datasets/${datasetId}/items?limit=${LEADS_PER_RUN}`)
    log(`Fetched ${items.length} items from dataset`)

    // 6. Insert leads (skip duplicates)
    let inserted = 0
    let skipped  = 0

    for (const item of items) {
      if (!item.business_name && !item.email && !item.phone) {
        skipped++; continue
      }

      // Deduplicate by email
      if (item.email) {
        const exists = await sbGet(
          `leads?email=eq.${encodeURIComponent(item.email)}&select=id&limit=1`
        )
        if (exists.length > 0) {
          log(`  Skipping duplicate email: ${item.email}`)
          skipped++; continue
        }
      }

      await sbPost('leads', {
        business_name: item.business_name ?? null,
        phone:         item.phone ?? null,
        email:         item.email ?? null,
        all_emails:    item.all_emails?.length ? item.all_emails : (item.email ? [item.email] : []),
        website:       item.website ?? null,
        linkedin_url:  item.linkedin_url ?? null,
        facebook_url:  item.facebook_url ?? null,
        twitter_url:   item.twitter_url ?? null,
        instagram_url: item.instagram_url ?? null,
        youtube_url:   item.youtube_url ?? null,
        lead_score:    item.lead_score ?? 0,
        category:      industry,
        address:       item.address ?? null,
        city:          item.city ?? null,
        state:         item.state ?? null,
        zip:           item.zip ?? null,
        rating:        item.rating ?? null,
        review_count:  item.review_count ?? null,
        source_url:    item.source_url ?? null,
        scraped_at:    item.scraped_at ?? new Date().toISOString(),
        status:        'new',
      })
      log(`  ✓ Inserted: ${item.business_name ?? item.email}`)
      inserted++
    }

    // 7. Mark run complete
    await sbPatch(`scraper_runs?id=eq.${runId}`, {
      status:       'completed',
      leads_found:  inserted,
      completed_at: new Date().toISOString(),
    })

    log(`=== Done. Inserted: ${inserted}, Skipped: ${skipped} ===`)

    const newCompleted = completedRuns.length + 1
    const remaining = MAX_RUNS - newCompleted
    const nextMsg = remaining > 0
      ? `*Next:* ${INDUSTRIES[(industryIndex + 1) % INDUSTRIES.length]} in ~5 min`
      : `*Status:* All ${MAX_RUNS} runs complete`

    if (remaining > 0) {
      log(`Next run in ~5 min → ${INDUSTRIES[(industryIndex + 1) % INDUSTRIES.length]}`)
    } else {
      log('All 3 test runs complete.')
    }

    await notifySlack(
      `:white_check_mark: *Scrape run #${totalRuns + 1} complete* — ${industry}`,
      [
        `*Inserted:* ${inserted} leads`,
        `*Skipped:* ${skipped} duplicates`,
        nextMsg,
      ]
    )

    succeeded = true

  } catch (err) {
    log(`ERROR: ${err.message}`)
    await notifySlack(
      `:x: *Scrape run #${totalRuns + 1} failed* — ${industry}`,
      [`*Error:* ${err.message}`]
    )
    // Only mark failed if we haven't already marked completed
    if (runId && !succeeded) {
      await sbPatch(`scraper_runs?id=eq.${runId}`, {
        status:       'failed',
        completed_at: new Date().toISOString(),
      }).catch(() => {})
    }
    process.exit(1)
  }
}

main()
