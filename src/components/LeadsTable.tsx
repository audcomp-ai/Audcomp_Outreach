'use client'

import React, { useState, useMemo, useTransition, useCallback } from 'react'
import type { Lead, LeadStatus } from '@/types'
import { STATUS_META } from '@/types'
import { updateLeadStatus, updateLeadNotes } from '@/app/leads/actions'
import ExportButton from './ExportButton'
import LeadDrawer from './LeadDrawer'

/* ── helpers ──────────────────────────────────────────────── */
function domain(url: string | null) {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

function scoreColor(n: number | null) {
  if (n === null) return 'text-slate-400'
  if (n >= 75) return 'text-emerald-600'
  if (n >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

/* ── Social icon SVGs ─────────────────────────────────────── */
const SocialIcon = {
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/>
      <polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
    </svg>
  ),
}

/* ── Status pill + dropdown ───────────────────────────────── */
function StatusCell({ lead, onChange }: { lead: Lead; onChange: (id: string, s: LeadStatus) => void }) {
  const meta = STATUS_META[lead.status]
  return (
    <div className="relative group">
      <select
        value={lead.status}
        onChange={e => onChange(lead.id, e.target.value as LeadStatus)}
        className={`
          status-select text-xs font-semibold px-2.5 py-1 rounded-full border
          ${meta.text} ${meta.bg} ${meta.border}
          focus:outline-none focus:ring-2 focus:ring-blue-200
          transition-all duration-150 pr-6
        `}
        style={{ minWidth: 90 }}
      >
        {Object.entries(STATUS_META).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
      {/* chevron */}
      <svg className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${meta.text} opacity-60`}
           viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 4.5L6 7.5L9 4.5"/>
      </svg>
    </div>
  )
}

/* ── Score badge ──────────────────────────────────────────── */
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-600 font-mono text-xs">—</span>
  return (
    <span className={`font-mono text-sm font-semibold tabular-nums ${scoreColor(score)}`}>
      {score}
    </span>
  )
}

/* ── Inline note cell ────────────────────────────────────── */
function NoteCell({ lead, onSave }: { lead: Lead; onSave: (id: string, note: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(lead.notes ?? '')

  function commit() {
    setEditing(false)
    if (val !== (lead.notes ?? '')) onSave(lead.id, val)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(lead.notes ?? ''); setEditing(false) } }}
          className="border rounded px-2 py-1 text-xs w-40 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          placeholder="Add note…"
        />
      </div>
    )
  }

  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      className="flex items-center gap-1.5 cursor-text group min-w-[100px]"
      title="Click to edit note"
    >
      {val ? (
        <span className="text-xs truncate max-w-[160px] group-hover:text-blue-600 transition-colors"
              style={{ color: 'var(--text-secondary)' }}>
          {val}
        </span>
      ) : (
        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-faint)' }}>
          + add note
        </span>
      )}
    </div>
  )
}

/* ── Expanded row ─────────────────────────────────────────── */
function ExpandedRow({ lead, colSpan, onSaveNote }: { lead: Lead; colSpan: number; onSaveNote: (id: string, note: string) => void }) {
  const [note, setNote] = useState(lead.notes ?? '')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    onSaveNote(lead.id, note)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <tr className="expanded-row">
      <td colSpan={colSpan} style={{ background: 'var(--surface-2)', padding: 0 }}>
        <div className="px-6 py-4 border-t animate-fade-in" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {lead.all_emails && lead.all_emails.length > 1 && (
              <Detail label="All Emails" value={lead.all_emails.join(', ')} />
            )}
            {(lead.city || lead.state) && (
              <Detail label="Location" value={[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ')} />
            )}
            {lead.category && <Detail label="Category" value={lead.category} />}
            {lead.rating && <Detail label="Rating" value={`${lead.rating} ★ (${lead.review_count ?? 0} reviews)`} />}
            {lead.source_url && (
              <Detail label="Source URL">
                <a href={lead.source_url} target="_blank" rel="noopener"
                   className="text-blue-600 hover:text-blue-800 font-mono text-xs truncate block max-w-xs transition-colors">
                  {domain(lead.source_url)}
                </a>
              </Detail>
            )}
            <Detail label="Last Updated" value={fmtDate(lead.updated_at)} />
          </div>

          {/* Notes */}
          <div className="flex items-start gap-3 mt-2">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add notes about this lead…"
              rows={2}
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white
                         placeholder:text-slate-400 focus:outline-none resize-none
                         transition-colors focus:ring-2 focus:ring-blue-200"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleSave}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                saved
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'border text-white'
              }`}
              style={!saved ? { background: 'var(--brand)', borderColor: 'var(--brand)' } : {}}
            >
              {saved ? '✓ Saved' : 'Save note'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function Detail({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children ?? <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{value || '—'}</span>}
    </div>
  )
}

/* ── Sort header ─────────────────────────────────────────── */
type SortDir = 'asc' | 'desc' | null
function Th({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: keyof Lead; current: keyof Lead | null; dir: SortDir; onSort: (k: keyof Lead) => void
}) {
  const active = current === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`
        px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest cursor-pointer select-none
        whitespace-nowrap transition-colors
        ${active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'}
      `}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="opacity-50 text-[10px]">
          {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  )
}

/* ── Main component ──────────────────────────────────────── */
export default function LeadsTable({ leads: initial }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initial)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [sortKey, setSortKey] = useState<keyof Lead | null>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isPending, startTransition] = useTransition()

  /* sort */
  function handleSort(key: keyof Lead) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  /* expand toggle */
  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  /* optimistic status update */
  const handleStatusChange = useCallback((id: string, status: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    startTransition(async () => {
      try { await updateLeadStatus(id, status) }
      catch { setLeads(initial) }
    })
  }, [initial])

  /* notes save */
  const handleSaveNote = useCallback((id: string, notes: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l))
    startTransition(async () => {
      try { await updateLeadNotes(id, notes) }
      catch { setLeads(initial) }
    })
  }, [initial])

  /* filter + sort */
  const filtered = useMemo(() => {
    let r = [...leads]
    const q = search.toLowerCase()
    if (q) r = r.filter(l =>
      [l.business_name, l.email, l.phone, l.website, l.category, l.city]
        .some(v => v?.toLowerCase().includes(q))
    )
    if (statusFilter) r = r.filter(l => l.status === statusFilter)
    if (sortKey) r.sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
      const an = parseFloat(String(av)), bn = parseFloat(String(bv))
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return r
  }, [leads, search, statusFilter, sortKey, sortDir])

  const COL_SPAN = 10

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone, city…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white
                       placeholder:text-slate-400 focus:outline-none
                       focus:ring-2 focus:ring-blue-200 transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as LeadStatus | '')}
            className="status-select text-sm px-3 py-2 pr-7 rounded-lg border bg-white
                       focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-slate-400"
               viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4.5L6 7.5L9 4.5"/>
          </svg>
        </div>

        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} of {leads.length}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {isPending && (
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          )}
          <ExportButton leads={filtered} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border bg-white shadow-sm"
           style={{ borderColor: 'var(--border)' }}>
        <div className="table-scroll">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th className="w-8 px-3 py-3" />
                <Th label="Business"    sortKey="business_name" current={sortKey} dir={sortDir} onSort={handleSort} />
                <Th label="Email"       sortKey="email"         current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">Website</th>
                <Th label="Score"       sortKey="lead_score"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">Social</th>
                <Th label="Status"      sortKey="status"        current={sortKey} dir={sortDir} onSort={handleSort} />
                <Th label="Scraped"     sortKey="scraped_at"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COL_SPAN} className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    {search || statusFilter ? 'No leads match the current filters.' : 'No leads yet — run the Scraper Agent to populate.'}
                  </td>
                </tr>
              ) : (
                filtered.map(lead => (
                  <React.Fragment key={lead.id}>
                    <tr
                      className="border-t transition-colors cursor-pointer"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: expanded.has(lead.id) ? 'var(--surface-2)' : undefined,
                      }}
                      onMouseEnter={e => { if (!expanded.has(lead.id)) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                      onMouseLeave={e => { if (!expanded.has(lead.id)) (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                      {/* Expand toggle */}
                      <td className="px-3 py-3 sticky-col" onClick={() => toggleExpand(lead.id)}>
                        <button className="w-5 h-5 flex items-center justify-center rounded transition-colors"
                                style={{ color: 'var(--text-muted)' }}>
                          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
                               className={`w-3 h-3 transition-transform duration-200 ${expanded.has(lead.id) ? 'rotate-180' : ''}`}>
                            <path d="M2 4L6 8L10 4"/>
                          </svg>
                        </button>
                      </td>

                      {/* Business name — click to open intel drawer */}
                      <td className="px-3 py-3 font-semibold whitespace-nowrap max-w-[180px]"
                          style={{ color: 'var(--text-primary)' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedLead(lead) }}
                          className="truncate block text-left w-full hover:text-blue-600 transition-colors"
                          title="Click to view lead intelligence"
                        >
                          {lead.business_name ?? '—'}
                        </button>
                      </td>

                      {/* Email */}
                      <td className="px-3 py-3 font-mono text-xs">
                        {lead.email ? (
                          <a href={`mailto:${lead.email}`}
                             className="text-blue-600 hover:text-blue-800 transition-colors truncate block max-w-[180px]"
                             onClick={e => e.stopPropagation()}>
                            {lead.email}
                          </a>
                        ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>

                      {/* Phone */}
                      <td className="px-3 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {lead.phone ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>

                      {/* Website */}
                      <td className="px-3 py-3 font-mono text-xs">
                        {lead.website ? (
                          <a href={lead.website} target="_blank" rel="noopener"
                             className="text-blue-500 hover:text-blue-700 transition-colors truncate block max-w-[140px]"
                             onClick={e => e.stopPropagation()}>
                            {domain(lead.website)}
                          </a>
                        ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>

                      {/* Score */}
                      <td className="px-3 py-3 text-center" onClick={() => toggleExpand(lead.id)}>
                        <ScoreBadge score={lead.lead_score} />
                      </td>

                      {/* Social */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {[
                            { url: lead.linkedin_url, icon: SocialIcon.linkedin, label: 'LinkedIn' },
                            { url: lead.facebook_url, icon: SocialIcon.facebook, label: 'Facebook' },
                            { url: lead.twitter_url,  icon: SocialIcon.twitter,  label: 'Twitter'  },
                            { url: lead.instagram_url,icon: SocialIcon.instagram,label: 'Instagram'},
                            { url: lead.youtube_url,  icon: SocialIcon.youtube,  label: 'YouTube'  },
                          ].filter(s => s.url).map(s => (
                            <a key={s.label} href={s.url!} target="_blank" rel="noopener"
                               title={s.label}
                               className="w-6 h-6 flex items-center justify-center rounded border transition-all
                                          text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50"
                               style={{ borderColor: 'var(--border)' }}
                               onClick={e => e.stopPropagation()}>
                              {s.icon}
                            </a>
                          ))}
                          {![lead.linkedin_url, lead.facebook_url, lead.twitter_url, lead.instagram_url, lead.youtube_url].some(Boolean) && (
                            <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>—</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <StatusCell lead={lead} onChange={handleStatusChange} />
                      </td>

                      {/* Scraped at */}
                      <td className="px-3 py-3 font-mono text-xs whitespace-nowrap"
                          style={{ color: 'var(--text-muted)' }}
                          onClick={() => toggleExpand(lead.id)}>
                        {fmtDate(lead.scraped_at)}
                      </td>

                      {/* Notes — inline editable */}
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <NoteCell lead={lead} onSave={handleSaveNote} />
                      </td>
                    </tr>

                    {/* Expanded details */}
                    {expanded.has(lead.id) && (
                      <ExpandedRow
                        key={`${lead.id}-exp`}
                        lead={lead}
                        colSpan={COL_SPAN}
                        onSaveNote={handleSaveNote}
                      />
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between"
             style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Click business name to view intel · Click row to expand notes
          </span>
        </div>
      </div>

      {/* Lead intel drawer */}
      <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  )
}
