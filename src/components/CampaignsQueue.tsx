'use client'

import { useState } from 'react'
import { Campaign, CAMPAIGN_STATUS_META } from '@/lib/types'
import { updateCampaignStatus, updateCampaignBody } from '@/app/campaigns/actions'

type PainPoint = { signal: string; category: string; pitch_angle: string }

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  security:    { label: 'Security',    color: 'bg-red-50 text-red-700 border-red-200' },
  productivity:{ label: 'Productivity',color: 'bg-amber-50 text-amber-700 border-amber-200' },
  reliability: { label: 'Reliability', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  compliance:  { label: 'Compliance',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  cost:        { label: 'Cost',        color: 'bg-blue-50 text-blue-700 border-blue-200' },
}

function EnrichmentBadge({ status }: { status: string | null | undefined }) {
  if (!status || status === 'pending') return null
  const meta = {
    running:   { label: 'Enriching…', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
    completed: { label: 'Enriched',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    failed:    { label: 'Enrich failed', cls: 'bg-red-50 text-red-600 border-red-200' },
  }[status] ?? null
  if (!meta) return null
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

export default function CampaignsQueue({ campaigns }: { campaigns: Campaign[] }) {
  const [filter, setFilter]       = useState<string>('pending')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [editing, setEditing]     = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [generatingImage, setGeneratingImage] = useState<Record<string, boolean>>({})
  const [localImageUrls, setLocalImageUrls]   = useState<Record<string, string>>({})

  const filtered = campaigns.filter(c => filter === 'all' || c.status === filter)

  function startEdit(c: Campaign) {
    setEditing(c.id)
    setEditSubject(c.subject)
    setEditBody(c.email_body)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await updateCampaignBody(id, editSubject, editBody)
    setEditing(null)
    setSaving(false)
  }

  async function approve(id: string) { await updateCampaignStatus(id, 'approved') }
  async function reject(id: string)  { await updateCampaignStatus(id, 'rejected') }

  async function generateImage(c: Campaign) {
    setGeneratingImage(prev => ({ ...prev, [c.id]: true }))
    try {
      const painPoints: PainPoint[] = c.lead?.pain_points ? JSON.parse(c.lead.pain_points) : []
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: c.id,
          businessName: c.lead?.business_name,
          industry: c.lead?.category,
          painPoints,
        }),
      })
      const data = await resp.json()
      if (data.imageUrl) {
        setLocalImageUrls(prev => ({ ...prev, [c.id]: data.imageUrl }))
      }
    } finally {
      setGeneratingImage(prev => ({ ...prev, [c.id]: false }))
    }
  }

  const tabs = ['pending', 'approved', 'rejected', 'sent', 'all']

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {tabs.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={filter === f ? { background: 'var(--brand)', color: '#fff' } : { color: 'var(--text-muted)' }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 rounded-xl border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--brand)' }}>
            <path d="M8 12h32M8 24h20M8 36h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No {filter} campaigns yet</p>
          <p className="text-sm mt-1">Campaigns appear after scraper + enrichment runs complete.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(c => {
          const meta         = CAMPAIGN_STATUS_META[c.status]
          const isExpanded   = expanded === c.id
          const isEditing    = editing === c.id
          const painPoints: PainPoint[] = c.lead?.pain_points ? JSON.parse(c.lead.pain_points) : []
          const imageUrl     = localImageUrls[c.id] ?? c.image_url
          const isGenerating = generatingImage[c.id] ?? false

          return (
            <div key={c.id} className="bg-white border rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-md"
                 style={{ borderColor: 'var(--border)' }}>

              {/* Row header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer transition-colors"
                style={{ background: isExpanded ? 'var(--surface-2)' : undefined }}
                onClick={() => setExpanded(isExpanded ? null : c.id)}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {c.lead?.business_name ?? 'Unknown Business'}
                    </span>
                    <EnrichmentBadge status={c.lead?.enrichment_status} />
                  </div>
                  <div className="text-sm truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {c.subject}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs hidden md:inline" style={{ color: 'var(--text-faint)' }}>
                    {c.lead?.category} · {[c.lead?.city, c.lead?.state].filter(Boolean).join(', ')}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${meta.bg} ${meta.text}`}
                        style={{ borderColor: 'currentColor', opacity: 0.8 }}>
                    {meta.label}
                  </span>
                  <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-faint)' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                       style={{ color: 'var(--text-muted)' }}
                       fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* LEFT: Email + Intelligence */}
                    <div className="space-y-4">

                      {/* Intelligence panel */}
                      {(painPoints.length > 0 || c.lead?.website_summary || c.lead?.linkedin_employees) && (
                        <div className="bg-white rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Business Intelligence
                          </div>

                          {/* Website summary */}
                          {c.lead?.website_summary && (
                            <div>
                              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Website</div>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                {c.lead.website_summary}
                              </p>
                            </div>
                          )}

                          {/* LinkedIn */}
                          {(c.lead?.linkedin_employees || c.lead?.linkedin_description) && (
                            <div>
                              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>LinkedIn</div>
                              <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                {c.lead.linkedin_employees && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    {c.lead.linkedin_employees} employees
                                  </span>
                                )}
                                {c.lead.linkedin_description && (
                                  <span className="leading-relaxed">{c.lead.linkedin_description.slice(0, 120)}{c.lead.linkedin_description.length > 120 ? '…' : ''}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Pain points */}
                          {painPoints.length > 0 && (
                            <div>
                              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Detected Pain Points
                              </div>
                              <div className="space-y-2">
                                {painPoints.map((p, i) => {
                                  const cat = CATEGORY_META[p.category] ?? { label: p.category, color: 'bg-gray-50 text-gray-700 border-gray-200' }
                                  return (
                                    <div key={i} className="rounded-lg border p-2.5 text-xs space-y-1" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${cat.color}`}>
                                          {cat.label}
                                        </span>
                                      </div>
                                      <div style={{ color: 'var(--text-secondary)' }}>
                                        <span className="font-medium">Signal:</span> {p.signal}
                                      </div>
                                      <div style={{ color: 'var(--text-muted)' }}>
                                        <span className="font-medium">Pitch:</span> {p.pitch_angle}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Email draft */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Email Draft</h3>
                          {c.status === 'pending' && !isEditing && (
                            <button
                              onClick={() => startEdit(c)}
                              className="text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                              style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-3">
                            <input
                              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                              value={editSubject}
                              onChange={e => setEditSubject(e.target.value)}
                              placeholder="Subject"
                            />
                            <textarea
                              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 h-48 resize-none"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                              value={editBody}
                              onChange={e => setEditBody(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(c.id)}
                                disabled={saving}
                                className="px-4 py-1.5 text-white text-xs rounded-lg transition-colors font-semibold disabled:opacity-50"
                                style={{ background: 'var(--brand)' }}
                              >
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="px-4 py-1.5 text-xs rounded-lg transition-colors font-medium"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl p-4 space-y-3 border" style={{ borderColor: 'var(--border)' }}>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Subject</div>
                              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.subject}</div>
                            </div>
                            <div className="border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Body</div>
                              <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {c.email_body}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: Image + Lead info + Actions */}
                    <div className="space-y-4">

                      {/* Campaign image */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Campaign Image</div>
                          <button
                            onClick={() => generateImage(c)}
                            disabled={isGenerating}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50"
                            style={imageUrl
                              ? { color: 'var(--text-muted)', borderColor: 'var(--border)' }
                              : { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                            }
                          >
                            {isGenerating ? 'Generating…' : imageUrl ? 'Regenerate' : 'Generate Image'}
                          </button>
                        </div>

                        {isGenerating ? (
                          <div className="h-40 rounded-xl border flex items-center justify-center"
                               style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                            <div className="text-center">
                              <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-2"
                                   style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Generating with Nano Banana 2…</p>
                            </div>
                          </div>
                        ) : imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl} alt="Campaign visual" className="w-full rounded-xl border" style={{ borderColor: 'var(--border)' }} />
                        ) : (
                          <div className="h-40 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2"
                               style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 opacity-30" style={{ color: 'var(--brand)' }}>
                              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                              <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Click Generate Image to create a visual</p>
                          </div>
                        )}
                      </div>

                      {/* Lead info */}
                      <div className="bg-white rounded-xl p-4 space-y-1.5 border" style={{ borderColor: 'var(--border)' }}>
                        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Lead</div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.lead?.business_name}</div>
                        {c.lead?.email && <div className="text-sm text-blue-600">{c.lead.email}</div>}
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{[c.lead?.city, c.lead?.state].filter(Boolean).join(', ')}</div>
                      </div>

                      {/* Actions */}
                      {c.status === 'pending' && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => approve(c.id)}
                            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-all
                                       bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => reject(c.id)}
                            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-all
                                       bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {c.status === 'approved' && (
                        <div className="py-2.5 text-center text-sm font-semibold bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                          Approved — ready to send
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
