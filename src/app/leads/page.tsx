import { fetchLeads } from '@/services/supabase'
import { supabase } from '@/services/supabase'
import type { Lead, ScraperRun } from '@/types'
import StatsBar from '@/components/StatsBar'
import LeadsTable from '@/components/LeadsTable'
import ScraperRunsBar from '@/components/ScraperRunsBar'
import AutoRefresh from '@/components/AutoRefresh'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  let leads: Lead[] = []
  let scraperRuns: ScraperRun[] = []
  let error: string | null = null

  try {
    leads = await fetchLeads()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load leads'
  }

  try {
    const { data } = await supabase
      .from('scraper_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5)
    scraperRuns = (data ?? []) as ScraperRun[]
  } catch {
    // scraper_runs table may not exist yet — non-fatal
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AutoRefresh intervalMs={30000} />

      {/* Top nav — Audcomp brand bar */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="Audcomp" className="h-10 w-auto object-contain" />
            {/* Nav divider */}
            <div className="hidden md:flex items-center gap-1 ml-4 pl-4 border-l border-[var(--border)]">
              <a href="/leads"
                 className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                 style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                Leads
              </a>
              <a href="/campaigns"
                 className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:bg-slate-50"
                 style={{ color: 'var(--text-secondary)' }}>
                Campaigns
              </a>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono hidden md:inline px-2 py-1 rounded-md"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {leads.length} leads · {scraperRuns.filter(r => r.status === 'completed').length} runs
            </span>
            <a
              href="https://console.apify.com/actors"
              target="_blank"
              rel="noopener"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 hover:opacity-90"
              style={{ background: 'var(--brand)', color: '#fff' }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                <path d="M8 2L2 14h12L8 2z"/>
              </svg>
              Apify
            </a>
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="brand-header">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-poppins)' }}>
            Lead Pipeline
          </h1>
          <p className="text-sm mt-1 text-blue-200">
            Smarter outreach. Faster growth. Powered by AI.
          </p>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto px-6 py-8">

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
            <strong>DB Error:</strong> {error}
            <p className="text-xs mt-1 text-red-500">Run schema.sql in your Supabase SQL editor first.</p>
          </div>
        )}

        <StatsBar leads={leads} />
        <ScraperRunsBar runs={scraperRuns} maxRuns={3} />
        <LeadsTable leads={leads} />
      </main>
    </div>
  )
}
