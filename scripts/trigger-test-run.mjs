/**
 * Trigger a manual scraper run via the Inngest Dev Server.
 * Run AFTER both `npm run dev` and `npm run inngest-dev` are started.
 *
 * Usage: node scripts/trigger-test-run.mjs
 */
const INNGEST_DEV_URL = 'http://localhost:8288'

async function trigger() {
  console.log('Sending scraper/manual-trigger to Inngest Dev Server...')
  const resp = await fetch(`${INNGEST_DEV_URL}/e/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'scraper/manual-trigger',
      data: {},
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.error(`Failed: ${resp.status} — ${text}`)
    process.exit(1)
  }

  const json = await resp.json()
  console.log('Event sent:', JSON.stringify(json, null, 2))
  console.log('\nWatch the run at: http://localhost:8288')
}

trigger().catch(console.error)
