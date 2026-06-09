/**
 * Inserts a fake lead + fires lead/created → triggers enrichment → campaign chain.
 * Run: npx tsx scripts/test-enrichment.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!
const INNGEST_KEY  = process.env.INNGEST_EVENT_KEY!

async function sb(method: string, path: string, body?: object) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`Supabase ${method} ${path} → ${r.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  // 1. Insert test lead with realistic data
  console.log('Inserting test lead…')
  const rows = await sb('POST', 'leads', {
    business_name:    'Hamilton Family Law',
    phone:            '905-555-0123',
    email:            'info@hamiltonfamilylaw.ca',
    website:          'https://www.hamiltonlawyers.ca',
    category:         'Law firms',
    address:          '100 King St W',
    city:             'Hamilton',
    state:            'Ontario',
    zip:              'L8P 1A2',
    rating:           4.2,
    review_count:     38,
    source_url:       'https://maps.google.com/?cid=12345',
    status:           'new',
    enrichment_status: 'pending',
    scraped_at:       new Date().toISOString(),
    google_reviews: JSON.stringify([
      'Great lawyers but their office systems seem a bit outdated, took a while to get documents',
      'Good service but hard to reach by email, they rely on fax too much',
      'Professional team, wish they had a client portal for document sharing',
    ]),
  })

  const lead = (rows as { id: string; business_name: string }[])[0]
  console.log(`✓ Lead inserted: ${lead.business_name} (${lead.id})`)

  // 2. Fire lead/created event → triggers enrichment agent
  console.log('Firing lead/created event to Inngest…')
  const evtResp = await fetch(`https://inn.gs/e/${INNGEST_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      name: 'lead/created',
      data: {
        leadId:       lead.id,
        businessName: lead.business_name,
        industry:     'Law firms',
      },
    }]),
  })

  if (!evtResp.ok) {
    const err = await evtResp.text()
    throw new Error(`Inngest event failed: ${err}`)
  }

  console.log('✓ Event fired. Watch Inngest dashboard:')
  console.log('  https://app.inngest.com')
  console.log('  enrichment-agent → lead/enriched → campaign-agent')
  console.log()
  console.log('Lead ID:', lead.id)
  console.log('Check campaigns tab in ~2 min:')
  console.log(`  ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://audcomp-outreach.vercel.app'}/campaigns`)
}

main().catch(e => { console.error(e); process.exit(1) })
