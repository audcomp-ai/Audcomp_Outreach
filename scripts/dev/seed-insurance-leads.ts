/**
 * Seeds 13 Hamilton/Burlington/Oakville/KW insurance brokers as demo leads.
 * Run: npx tsx scripts/seed-insurance-leads.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

const leads = [
  {
    business_name: 'Morison Insurance',
    city: 'Hamilton',
    zip: 'L8N 3N5',
    phone: '905-522-3141',
    email: 'info@morisoninsurance.ca',
    website: 'https://www.morisoninsurance.ca',
    rating: 4.7, review_count: 142,
    notes: 'Multi-office regional brokerage. Ontario Brokerage of the Year award. Strong local reputation. High priority.',
  },
  {
    business_name: 'Merit Insurance Brokers',
    city: 'Waterdown',
    zip: 'L0R 2H0',
    phone: '905-689-8600',
    email: 'info@meritinsurance.ca',
    website: 'https://www.meritinsurance.ca',
    rating: 4.5, review_count: 88,
    notes: 'Independent. Full lines: home, auto, commercial, life. Multi-location Ontario. Good IT spend signal.',
  },
  {
    business_name: 'Lawrie Insurance Group',
    city: 'Hamilton',
    zip: 'L8P 1H1',
    phone: '905-525-4511',
    email: 'info@lawrieinsurance.com',
    website: 'https://www.lawrieinsurance.com',
    rating: 4.3, review_count: 61,
    notes: 'Larger firm. 120+ staff. Approach division heads, not the principal. Employee benefits + commercial lines.',
  },
  {
    business_name: 'CMR Insurance Brokers',
    city: 'Hamilton',
    zip: 'L8N 2B4',
    phone: '905-527-1212',
    email: 'info@cmrinsurance.ca',
    website: 'https://www.cmrinsurance.ca',
    rating: 4.4, review_count: 37,
    notes: 'Privately held. Commercial + personal lines. Strong Hamilton presence. Good size fit.',
  },
  {
    business_name: 'Utter Morris Insurance Brokers',
    city: 'Burlington',
    zip: 'L7R 2N9',
    phone: '905-632-0050',
    email: 'info@uttermorris.com',
    website: 'https://www.uttermorris.com',
    rating: 4.6, review_count: 54,
    notes: 'Est. 1927. Third-generation independent. Personal + commercial + marine + cyber. Prime target.',
  },
  {
    business_name: 'StoneRidge Insurance Brokers',
    city: 'Burlington',
    zip: 'L7L 6A5',
    phone: '905-319-1101',
    email: 'info@stoneridgeinsurance.ca',
    website: 'https://www.stoneridgeinsurance.ca',
    rating: 4.5, review_count: 42,
    notes: 'Est. 1945. "Rock Solid Protection" positioning. Independent. Good compliance profile.',
  },
  {
    business_name: 'Regal Insurance Brokers Burlington',
    city: 'Burlington',
    zip: 'L7R 1E3',
    phone: '905-639-8888',
    email: 'burlington@regalinsurance.ca',
    website: 'https://www.regalinsurance.ca',
    rating: 4.2, review_count: 29,
    notes: 'Regional chain with independent culture. Kitchener-based, multi-location. KW Chamber member.',
  },
  {
    business_name: 'Jones DesLauriers Insurance Oakville',
    city: 'Oakville',
    zip: 'L6J 7W5',
    phone: '905-842-4000',
    email: 'oakville@jdimi.com',
    website: 'https://www.jdimi.com',
    rating: 4.6, review_count: 73,
    notes: '50+ year independent. Commercial + personal + specialty. Boutique-style service. Good size fit.',
  },
  {
    business_name: 'Peterson & Grantham Insurance Brokers',
    city: 'Oakville',
    zip: 'L6H 5R2',
    phone: '905-338-0044',
    email: 'info@pginsurance.ca',
    website: 'https://www.pginsurance.ca',
    rating: 4.3, review_count: 21,
    notes: 'Small independent. Personal + commercial lines. 10+ carriers. May be on lower end of staff range.',
  },
  {
    business_name: 'Canadian Insurance Brokers Inc.',
    city: 'Oakville',
    zip: 'L6K 3X5',
    phone: '905-845-5550',
    email: 'info@canadianinsurancebrokers.ca',
    website: 'https://www.canadianinsurancebrokers.ca',
    rating: 4.4, review_count: 48,
    notes: 'Truly independent. Objective advice positioning. Commercial + personal. Good compliance focus.',
  },
  {
    business_name: 'Staebler Insurance',
    city: 'Kitchener',
    zip: 'N2G 1H5',
    phone: '519-742-6584',
    email: 'info@staebler.com',
    website: 'https://www.staebler.com',
    rating: 4.7, review_count: 196,
    notes: '150+ year regional institution. Slightly above size target but high revenue = justified approach. Approach ops director.',
  },
  {
    business_name: 'Regal Insurance Brokers Kitchener',
    city: 'Kitchener',
    zip: 'N2G 4K4',
    phone: '519-745-4411',
    email: 'kitchener@regalinsurance.ca',
    website: 'https://www.regalinsurance.ca',
    rating: 4.1, review_count: 33,
    notes: 'KW Chamber member. Multi-location independent. Commercial + personal. Good digital pain signals.',
  },
  {
    business_name: 'E. Bollenbach Insurance Brokers',
    city: 'Kitchener',
    zip: 'N2H 2H7',
    phone: '519-745-5520',
    email: 'info@bollenbach.ca',
    website: 'https://www.bollenbach.ca',
    rating: 4.4, review_count: 27,
    notes: 'Community-focused. Auto, home, marine, business. Personal service positioning. Good Offer 1 target.',
  },
]

async function main() {
  let inserted = 0, skipped = 0

  for (const lead of leads) {
    // Check for duplicate
    const checkResp = await fetch(
      encodeURI(`${SUPABASE_URL}/rest/v1/leads?business_name=eq.${lead.business_name}&city=eq.${lead.city}&select=id&limit=1`),
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    const existing = await checkResp.json() as { id: string }[]
    if (existing.length > 0) {
      console.log(`  skip (exists): ${lead.business_name}`)
      skipped++
      continue
    }

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        ...lead,
        state: 'Ontario',
        category: 'Insurance firms',
        status: 'new',
        enrichment_status: 'pending',
        scraped_at: new Date().toISOString(),
        lead_score: Math.floor(Math.random() * 21) + 75,
      }),
    })

    if (!resp.ok) {
      console.error(`  ERROR ${lead.business_name}: ${await resp.text()}`)
    } else {
      console.log(`  ✓ ${lead.business_name} — ${lead.city}`)
      inserted++
    }
  }

  console.log(`\nDone. Inserted: ${inserted}  Skipped: ${skipped}`)
}

main().catch(e => { console.error(e); process.exit(1) })
