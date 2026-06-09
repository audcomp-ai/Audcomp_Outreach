'use client'

import { useEffect } from 'react'
import type { Lead, TechItem, ServiceFit } from '@/types'
import { STATUS_META } from '@/types'

interface Props {
  lead: Lead | null
  onClose: () => void
}

// ── Category colours for tech stack pills ─────────────────────────────────────
const TECH_CATEGORY_STYLE: Record<string, string> = {
  CMS:          'bg-purple-50 text-purple-700 border-purple-200',
  Email:        'bg-blue-50 text-blue-700 border-blue-200',
  CRM:          'bg-orange-50 text-orange-700 border-orange-200',
  Productivity: 'bg-green-50 text-green-700 border-green-200',
  Analytics:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  Security:     'bg-red-50 text-red-700 border-red-200',
  Hosting:      'bg-slate-50 text-slate-700 border-slate-200',
  Other:        'bg-gray-50 text-gray-600 border-gray-200',
}

// ── Service fit score colours ─────────────────────────────────────────────────
function fitColor(score: number) {
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' }
  if (score >= 40) return { bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' }
  return             { bar: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50 border-red-200' }
}

// ── IT maturity label ─────────────────────────────────────────────────────────
const MATURITY_LABELS: Record<number, string> = {
  1: 'Basic',
  2: 'Developing',
  3: 'Proficient',
  4: 'Advanced',
  5: 'Enterprise',
}

// ── Star rating display ───────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} viewBox="0 0 20 20" fill="currentColor"
             className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-amber-400' : 'text-slate-200'}`}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </span>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: 'var(--text-muted)' }}>
      {label}
    </h3>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
function DrawerDivider() {
  return <div className="my-5 border-t" style={{ borderColor: 'var(--border)' }} />
}

export default function LeadDrawer({ lead, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (lead) document.body.style.overflow = 'hidden'
    else       document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [lead])

  if (!lead) return null

  // ── Parse JSON fields ──────────────────────────────────────────
  const techStack: TechItem[] = lead.tech_stack ? JSON.parse(lead.tech_stack) : []
  const serviceFit: ServiceFit | null = lead.service_fit ? JSON.parse(lead.service_fit) : null
  const painPoints: { signal: string; category: string; pitch_angle: string }[] =
    lead.pain_points ? JSON.parse(lead.pain_points) : []
  const reviews: string[] = lead.google_reviews ? JSON.parse(lead.google_reviews) : []
  const regulatory: { body: string; requirement: string; pitchAngle: string } | null =
    lead.regulatory_exposure ? JSON.parse(lead.regulatory_exposure) : null

  const statusMeta = STATUS_META[lead.status]
  const itMaturity = lead.it_maturity ?? null
  const riskScore  = lead.risk_score ?? null

  // Group tech by category
  const techByCategory = techStack.reduce<Record<string, TechItem[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  const SERVICE_NAMES: Record<keyof ServiceFit, string> = {
    infrastructure: 'Infrastructure',
    cybersecurity:  'Cybersecurity',
    helpdesk:       'Helpdesk',
    backup_dr:      'Backup & DR',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl"
        style={{
          width: 'min(480px, 100vw)',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
        }}
      >
        {/* ── Header ── */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3"
             style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate" style={{ color: 'var(--text-primary)' }}>
              {lead.business_name ?? 'Unknown Business'}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {lead.lead_score !== null && (
                <span className={`font-mono text-sm font-bold ${
                  lead.lead_score >= 75 ? 'text-emerald-600' :
                  lead.lead_score >= 50 ? 'text-amber-600' : 'text-red-500'
                }`}>
                  Score {lead.lead_score}
                </span>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusMeta.text} ${statusMeta.bg} ${statusMeta.border}`}>
                {statusMeta.label}
              </span>
              {riskScore !== null && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  riskScore >= 70 ? 'text-red-700 bg-red-50 border-red-200' :
                  riskScore >= 45 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                  'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}>
                  Risk {riskScore}/100
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg border transition-colors
                       text-slate-400 hover:text-slate-600 hover:bg-white flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* Contact */}
          <SectionHead label="Contact" />
          <div className="grid grid-cols-2 gap-2 mb-1">
            {lead.email && (
              <a href={`mailto:${lead.email}`}
                 className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors truncate">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 flex-shrink-0">
                  <path d="M2 4h12v9H2z"/><path d="m2 4 6 5 6-5"/>
                </svg>
                <span className="truncate text-xs">{lead.email}</span>
              </a>
            )}
            {lead.phone && (
              <a href={`tel:${lead.phone}`}
                 className="flex items-center gap-1.5 text-xs transition-colors"
                 style={{ color: 'var(--text-secondary)' }}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 flex-shrink-0">
                  <path d="M2 2h4l1.5 3.5-2 2a10 10 0 004 4l2-2L15 11v4a1 1 0 01-1 1C5.372 16 0 10.628 0 3a1 1 0 011-1h1z"/>
                </svg>
                {lead.phone}
              </a>
            )}
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener"
                 className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 transition-colors truncate col-span-2">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 flex-shrink-0">
                  <circle cx="8" cy="8" r="7"/><path d="M1 8h14M8 1a11 11 0 010 14M8 1a11 11 0 000 14"/>
                </svg>
                <span className="truncate">{lead.website}</span>
              </a>
            )}
            {lead.linkedin_url && (
              <a href={lead.linkedin_url} target="_blank" rel="noopener"
                 className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>
                </svg>
                LinkedIn
              </a>
            )}
            {lead.contact_name && (
              <div className="col-span-2 mt-1">
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Contact: {lead.contact_name}
                  {lead.contact_title && <span className="font-normal"> — {lead.contact_title}</span>}
                </span>
                {lead.contact_is_technical === false && (
                  <span className="ml-2 text-xs text-amber-600">(non-technical)</span>
                )}
                {lead.contact_is_technical === true && (
                  <span className="ml-2 text-xs text-blue-600">(technical)</span>
                )}
              </div>
            )}
          </div>

          {/* DNS intel */}
          {(lead.dns_mx || lead.has_spf !== null) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {lead.dns_mx && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                  {lead.dns_mx}
                </span>
              )}
              {lead.has_spf !== null && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${lead.has_spf ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  SPF {lead.has_spf ? '✓' : '✗ missing'}
                </span>
              )}
              {lead.has_dmarc !== null && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${lead.has_dmarc ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  DMARC {lead.has_dmarc ? '✓' : '✗ missing'}
                </span>
              )}
            </div>
          )}

          <DrawerDivider />

          {/* Tech Stack */}
          {techStack.length > 0 && (
            <>
              <SectionHead label="Tech Stack" />
              <div className="space-y-2">
                {Object.entries(techByCategory).map(([cat, items]) => (
                  <div key={cat} className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium w-20 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {cat}
                    </span>
                    {items.map(t => (
                      <span key={t.name}
                            title={t.signal}
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TECH_CATEGORY_STYLE[cat] ?? TECH_CATEGORY_STYLE.Other}`}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <DrawerDivider />
            </>
          )}

          {/* Service Fit */}
          {serviceFit && (
            <>
              <SectionHead label="Service Fit" />
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(serviceFit) as [keyof ServiceFit, { score: number; reason: string }][]).map(([key, val]) => {
                  const colors = fitColor(val.score)
                  return (
                    <div key={key} className={`rounded-lg border p-3 ${colors.bg}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {SERVICE_NAMES[key]}
                        </span>
                        <span className={`text-sm font-bold tabular-nums ${colors.text}`}>
                          {val.score}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${colors.bar}`}
                             style={{ width: `${val.score}%` }} />
                      </div>
                      <p className="text-xs mt-1.5 leading-tight" style={{ color: 'var(--text-secondary)' }}>
                        {val.reason}
                      </p>
                    </div>
                  )
                })}
              </div>
              <DrawerDivider />
            </>
          )}

          {/* IT Maturity */}
          {itMaturity !== null && (
            <>
              <SectionHead label="IT Maturity" />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i}
                         className={`w-5 h-5 rounded-full border-2 transition-all ${
                           i <= itMaturity
                             ? 'border-blue-600 bg-blue-600'
                             : 'border-slate-200 bg-white'
                         }`} />
                  ))}
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {MATURITY_LABELS[itMaturity] ?? `Level ${itMaturity}`}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {itMaturity}/5
                </span>
              </div>
              <DrawerDivider />
            </>
          )}

          {/* Pain Points */}
          {painPoints.length > 0 && (
            <>
              <SectionHead label="Pain Points" />
              <div className="space-y-2">
                {painPoints.map((p, i) => (
                  <div key={i} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                        p.category === 'security'     ? 'bg-red-100 text-red-700' :
                        p.category === 'compliance'   ? 'bg-purple-100 text-purple-700' :
                        p.category === 'reliability'  ? 'bg-amber-100 text-amber-700' :
                        p.category === 'productivity' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {p.category}
                      </span>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {p.signal}
                      </p>
                    </div>
                    {p.pitch_angle && (
                      <p className="text-xs mt-1.5 pl-1 italic" style={{ color: 'var(--text-muted)' }}>
                        → {p.pitch_angle}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <DrawerDivider />
            </>
          )}

          {/* Google Reviews */}
          {(lead.rating !== null || reviews.length > 0) && (
            <>
              <SectionHead label="Google Reviews" />
              {lead.rating !== null && (
                <div className="flex items-center gap-2 mb-3">
                  <Stars rating={lead.rating} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {lead.rating.toFixed(1)}
                  </span>
                  {lead.review_count !== null && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      ({lead.review_count} reviews)
                    </span>
                  )}
                </div>
              )}
              {reviews.slice(0, 3).map((r, i) => (
                <blockquote key={i}
                            className="text-xs italic border-l-2 pl-3 py-0.5 mb-2 leading-relaxed"
                            style={{ borderColor: 'var(--brand)', color: 'var(--text-secondary)' }}>
                  "{r.slice(0, 200)}{r.length > 200 ? '…' : ''}"
                </blockquote>
              ))}
              <DrawerDivider />
            </>
          )}

          {/* Regulatory Exposure */}
          {regulatory && (
            <>
              <SectionHead label="Regulatory Exposure" />
              <div className="rounded-lg border p-3 bg-purple-50 border-purple-200">
                <p className="text-xs font-semibold text-purple-800 mb-1">{regulatory.body}</p>
                <p className="text-xs text-purple-700 mb-2">{regulatory.requirement}</p>
                <p className="text-xs italic text-purple-600">→ {regulatory.pitchAngle}</p>
              </div>
              <DrawerDivider />
            </>
          )}

          {/* Business Intelligence */}
          {(lead.website_summary || lead.linkedin_description || lead.services_offered || lead.news_signal) && (
            <>
              <SectionHead label="Business Intelligence" />
              {lead.services_offered && (
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {lead.services_offered}
                </p>
              )}
              {lead.website_summary && (
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {lead.website_summary}
                </p>
              )}
              {lead.linkedin_description && (
                <div className="flex items-start gap-2 mb-2">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-600">
                    <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>
                  </svg>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {lead.linkedin_description.slice(0, 300)}{lead.linkedin_description.length > 300 ? '…' : ''}
                  </p>
                </div>
              )}
              {lead.news_signal && (
                <div className="mt-2 rounded-lg border p-2.5 bg-yellow-50 border-yellow-200">
                  <p className="text-xs font-semibold text-yellow-800 mb-1">Recent news</p>
                  <p className="text-xs text-yellow-700">{lead.news_signal}</p>
                </div>
              )}
              {lead.linkedin_employees !== null && (
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  ~{lead.linkedin_employees} employees on LinkedIn
                </p>
              )}
              <DrawerDivider />
            </>
          )}

          {/* Actions */}
          <SectionHead label="Actions" />
          <div className="flex gap-2 pb-2">
            <a
              href="/campaigns"
              className="flex-1 text-center text-sm font-semibold py-2.5 px-4 rounded-lg border text-white transition-all hover:opacity-90"
              style={{ background: 'var(--brand)', borderColor: 'var(--brand)' }}
            >
              View Campaigns
            </a>
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="flex-1 text-center text-sm font-semibold py-2.5 px-4 rounded-lg border transition-all hover:bg-slate-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                Email Lead
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
