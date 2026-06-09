import type { ScraperRun } from '@/types'

const INDUSTRIES = ['Accounting firms', 'Insurance firms', 'Law firms']

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

const STATUS_STYLE = {
  completed: {
    dot:   'bg-emerald-500',
    text:  'text-emerald-700',
    badge: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  running: {
    dot:   'bg-amber-500 animate-pulse',
    text:  'text-amber-700',
    badge: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  failed: {
    dot:   'bg-red-500',
    text:  'text-red-700',
    badge: 'bg-red-50 border-red-200 text-red-700',
  },
}

interface Props { runs: ScraperRun[]; maxRuns?: number }

export default function ScraperRunsBar({ runs, maxRuns = 3 }: Props) {
  const completedCount = runs.filter(r => r.status === 'completed').length
  const nextIndex = runs.length % INDUSTRIES.length
  const nextIndustry = INDUSTRIES[nextIndex]
  const isRunning = runs.some(r => r.status === 'running')
  const allDone = runs.length >= maxRuns && !isRunning

  return (
    <div className="mb-6 rounded-xl border bg-white shadow-sm overflow-hidden"
         style={{ borderColor: 'var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b"
           style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5">
          {/* Status indicator */}
          <span className="relative flex h-2.5 w-2.5">
            {isRunning ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </>
            ) : allDone ? (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-300" />
            )}
          </span>

          {/* Icon + title */}
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" style={{ color: 'var(--brand)' }}>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
            Scraper Agent
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                style={{ background: 'var(--brand-light)', color: 'var(--text-muted)' }}>
            {completedCount} completed
          </span>
        </div>

        {!allDone && runs.length < maxRuns && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Next: <span className="font-semibold" style={{ color: 'var(--accent)' }}>{nextIndustry}</span>
            {runs.length > 0 && ' · ~5 min'}
          </span>
        )}
        {allDone && (
          <span className="text-xs font-semibold text-emerald-600">All test runs complete</span>
        )}
      </div>

      {/* Run rows */}
      {runs.length === 0 ? (
        <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          No runs yet — first run will scrape{' '}
          <span className="font-semibold" style={{ color: 'var(--accent)' }}>{INDUSTRIES[0]}</span>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {runs.map((run) => {
            const s = STATUS_STYLE[run.status] ?? STATUS_STYLE.failed
            return (
              <div key={run.id} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50 transition-colors">
                {/* Run number */}
                <span className="font-mono text-xs w-6 text-right shrink-0" style={{ color: 'var(--text-faint)' }}>
                  #{run.run_number}
                </span>

                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />

                {/* Industry */}
                <span className="font-semibold w-40 shrink-0 truncate" style={{ color: 'var(--text-primary)' }}>
                  {run.industry}
                </span>

                {/* Location */}
                {run.location && (
                  <span className="text-xs hidden md:block truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
                    {run.location}
                  </span>
                )}

                {/* Status badge */}
                <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold uppercase tracking-wide ${s.badge}`}>
                  {run.status}
                </span>

                {/* Leads found */}
                {run.status === 'completed' && (
                  <span className="text-sm font-semibold text-emerald-600">
                    +{run.leads_found} lead{run.leads_found !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Time */}
                <span className="ml-auto text-xs font-mono shrink-0" style={{ color: 'var(--text-faint)' }}>
                  {timeAgo(run.started_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
