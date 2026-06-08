import type { Lead, LeadStatus } from '@/lib/types'
import { STATUS_META } from '@/lib/types'

interface Props { leads: Lead[] }

export default function StatsBar({ leads }: Props) {
  const total = leads.length
  const avgScore = total
    ? Math.round(leads.reduce((s, l) => s + (l.lead_score ?? 0), 0) / total)
    : 0

  const byStatus = Object.keys(STATUS_META).map((s) => ({
    status: s as LeadStatus,
    count: leads.filter((l) => l.status === s).length,
  }))

  const scoreColor = avgScore >= 75 ? '#059669' : avgScore >= 50 ? '#D97706' : '#DC2626'
  const scoreBg    = avgScore >= 75 ? '#ECFDF5' : avgScore >= 50 ? '#FFFBEB' : '#FEF2F2'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">

      {/* Total */}
      <div className="col-span-1 flex flex-col gap-1 p-4 rounded-xl border bg-white shadow-sm"
           style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Total</span>
        <span className="text-3xl font-bold leading-none" style={{ color: 'var(--brand)', fontFamily: 'var(--font-poppins)' }}>
          {total}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>leads in DB</span>
      </div>

      {/* Avg score */}
      <div className="col-span-1 flex flex-col gap-1 p-4 rounded-xl border bg-white shadow-sm"
           style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Avg Score</span>
        <span className="text-3xl font-bold leading-none" style={{ color: scoreColor, fontFamily: 'var(--font-poppins)' }}>
          {avgScore}
        </span>
        <div className="w-full h-1.5 rounded-full mt-1" style={{ background: '#E2E8F0' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${avgScore}%`, background: scoreColor }} />
        </div>
      </div>

      {/* Per status */}
      {byStatus.map(({ status, count }) => {
        const meta = STATUS_META[status]
        const pct = total ? (count / total) * 100 : 0
        return (
          <div key={status} className="flex flex-col gap-1 p-4 rounded-xl border bg-white shadow-sm"
               style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {meta.label}
            </span>
            <span className={`text-3xl font-bold leading-none ${meta.text}`}
                  style={{ fontFamily: 'var(--font-poppins)' }}>
              {count}
            </span>
            <div className="w-full h-1.5 rounded-full mt-1" style={{ background: '#E2E8F0' }}>
              <div className={`h-1.5 rounded-full ${meta.dot}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
