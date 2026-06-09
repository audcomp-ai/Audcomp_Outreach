// ── Intent types ──────────────────────────────────────────────────────
export type SlackIntent =
  | { action: 'scrape'; industry?: string; location?: string }
  | { action: 'status' }
  | { action: 'stop' }
  | { action: 'campaigns' }
  | { action: 'unknown' }

// ── Industry aliases → canonical Apollo taxonomy names ───────────────
const INDUSTRY_MAP: Record<string, string> = {
  accounting:  'Accounting',
  accountant:  'Accounting',
  accountants: 'Accounting',
  cpa:         'Accounting',
  insurance:   'Insurance',
  insurer:     'Insurance',
  insurers:    'Insurance',
  law:         'Legal',
  legal:       'Legal',
  lawyer:      'Legal',
  lawyers:     'Legal',
  medical:     'Medical',
  healthcare:  'Medical',
  health:      'Medical',
  clinic:      'Medical',
  clinics:     'Medical',
  doctor:      'Medical',
  doctors:     'Medical',
  dental:      'Medical',
  dentist:     'Medical',
  physician:   'Medical',
}

// ── Location aliases → canonical names ───────────────────────────────
const LOCATION_MAP: Record<string, string> = {
  hamilton:   'Hamilton, Ontario, Canada',
  burlington: 'Burlington, Ontario, Canada',
  oakville:   'Oakville, Ontario, Canada',
}

// ── Parse a Slack message or slash command argument ───────────────────
// Examples:
//   "start"                            → { action: 'scrape' }
//   "scrape law firms in oakville"     → { action: 'scrape', industry: 'Law firms', location: 'Oakville, Ontario, Canada' }
//   "/scrape accounting in Burlington" → { action: 'scrape', industry: 'Accounting firms', location: 'Burlington, Ontario, Canada' }
//   "status"                           → { action: 'status' }
//   "stop"                             → { action: 'stop' }
export function parseIntent(raw: string): SlackIntent {
  const text = raw.trim().toLowerCase().replace(/^\//, '')

  // Status
  if (/^(status|runs?|progress|how many|report)/.test(text)) {
    return { action: 'status' }
  }

  // Stop / pause
  if (/^(stop|pause|halt|cancel|freeze)/.test(text)) {
    return { action: 'stop' }
  }

  // Campaigns
  if (/^(campaigns?|drafts?|pending|review)/.test(text)) {
    return { action: 'campaigns' }
  }

  // Start / scrape
  if (/^(start|run|go|begin|scrape|search|find)/.test(text)) {
    let industry: string | undefined
    let location: string | undefined

    // Try to extract industry from message
    for (const [alias, canonical] of Object.entries(INDUSTRY_MAP)) {
      if (text.includes(alias)) {
        industry = canonical
        break
      }
    }

    // Try to extract location from message
    for (const [alias, canonical] of Object.entries(LOCATION_MAP)) {
      if (text.includes(alias)) {
        location = canonical
        break
      }
    }

    return { action: 'scrape', industry, location }
  }

  return { action: 'unknown' }
}

// ── Parse slash command text argument ────────────────────────────────
// e.g. command="/scrape" text="law firms in oakville"
export function parseSlashCommand(command: string, text: string): SlackIntent {
  const cmd = command.replace('/', '').toLowerCase()

  if (cmd === 'aistatus') return { action: 'status' }
  if (cmd === 'stop')     return { action: 'stop' }
  if (cmd === 'campaigns') return { action: 'campaigns' }

  if (cmd === 'scrape') {
    if (!text.trim()) return { action: 'scrape' }
    return parseIntent('scrape ' + text)
  }

  return { action: 'unknown' }
}
