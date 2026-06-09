import { createClient } from '@supabase/supabase-js'
import { Campaign, CAMPAIGN_STATUS_META } from '@/types'
import CampaignsQueue from '@/components/CampaignsQueue'
import AutoRefresh from '@/components/AutoRefresh'

export const dynamic = 'force-dynamic'

function serverClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } }
  )
}

async function fetchCampaigns(): Promise<Campaign[]> {
  const { data } = await serverClient()
    .from('campaigns')
    .select(`*, lead:leads(business_name, email, category, city, state, website_summary, pain_points, linkedin_employees, linkedin_description, enrichment_status)`)
    .order('created_at', { ascending: false })
    .limit(100)
  return (data ?? []) as Campaign[]
}

export default async function CampaignsPage() {
  const campaigns = await fetchCampaigns()

  const counts = {
    pending:  campaigns.filter(c => c.status === 'pending').length,
    approved: campaigns.filter(c => c.status === 'approved').length,
    rejected: campaigns.filter(c => c.status === 'rejected').length,
    sent:     campaigns.filter(c => c.status === 'sent').length,
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AutoRefresh intervalMs={30000} />

      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="Audcomp" className="h-10 w-auto object-contain" />
            <div className="hidden md:flex items-center gap-1 ml-4 pl-4 border-l" style={{ borderColor: 'var(--border)' }}>
              <a href="/leads"
                 className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:bg-slate-50"
                 style={{ color: 'var(--text-secondary)' }}>
                Leads
              </a>
              <a href="/campaigns"
                 className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                 style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                Campaigns
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="brand-header">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-poppins)' }}>
            Campaign Review Queue
          </h1>
          <p className="text-sm mt-1 text-blue-200">Every touchpoint matters — review before you send.</p>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {(Object.entries(counts) as [keyof typeof counts, number][]).map(([status, count]) => {
            const meta = CAMPAIGN_STATUS_META[status]
            return (
              <div key={status} className="bg-white border rounded-xl p-4 shadow-sm" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {meta.label}
                  </span>
                </div>
                <div className={`text-2xl font-bold ${meta.text}`} style={{ fontFamily: 'var(--font-poppins)' }}>
                  {count}
                </div>
              </div>
            )
          })}
        </div>

        {/* Queue */}
        <CampaignsQueue campaigns={campaigns} />
      </div>
    </div>
  )
}
