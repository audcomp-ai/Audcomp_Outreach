'use client'

import type { Lead } from '@/lib/types'

interface Props { leads: Lead[] }

function flattenLead(l: Lead) {
  return {
    'Business Name':  l.business_name ?? '',
    'Phone':          l.phone ?? '',
    'Email':          l.email ?? '',
    'All Emails':     (l.all_emails ?? []).join(', '),
    'Website':        l.website ?? '',
    'LinkedIn':       l.linkedin_url ?? '',
    'Facebook':       l.facebook_url ?? '',
    'Twitter':        l.twitter_url ?? '',
    'Instagram':      l.instagram_url ?? '',
    'YouTube':        l.youtube_url ?? '',
    'Lead Score':     l.lead_score ?? '',
    'Category':       l.category ?? '',
    'Address':        l.address ?? '',
    'City':           l.city ?? '',
    'State':          l.state ?? '',
    'ZIP':            l.zip ?? '',
    'Rating':         l.rating ?? '',
    'Review Count':   l.review_count ?? '',
    'Status':         l.status,
    'Notes':          l.notes ?? '',
    'Campaign ID':    l.campaign_id ?? '',
    'Source URL':     l.source_url ?? '',
    'Scraped At':     l.scraped_at ?? '',
    'Created At':     l.created_at,
    'Updated At':     l.updated_at,
  }
}

export default function ExportButton({ leads }: Props) {
  async function handleExcel() {
    const XLSX = (await import('xlsx')).default
    const rows = leads.map(flattenLead)
    const ws = XLSX.utils.json_to_sheet(rows)
    // Auto-width
    const cols = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 16) }))
    ws['!cols'] = cols
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function handleCSV() {
    if (!leads.length) return
    const rows = leads.map(flattenLead)
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => JSON.stringify((r as Record<string, unknown>)[h] ?? '')).join(',')),
    ].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleExcel}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                   bg-emerald-400/10 text-emerald-400 border border-emerald-400/20
                   hover:bg-emerald-400/20 transition-all"
        title="Export to Excel"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Excel
      </button>
      <button
        onClick={handleCSV}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                   bg-slate-400/10 text-slate-400 border border-slate-400/20
                   hover:bg-slate-400/20 transition-all"
        title="Export to CSV"
      >
        CSV
      </button>
    </div>
  )
}
