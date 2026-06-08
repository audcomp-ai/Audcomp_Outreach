export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'rejected' | 'converted'

export interface Lead {
  id: string
  business_name: string | null
  phone: string | null
  email: string | null
  all_emails: string[] | null
  website: string | null
  linkedin_url: string | null
  facebook_url: string | null
  twitter_url: string | null
  instagram_url: string | null
  youtube_url: string | null
  lead_score: number | null
  category: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  rating: number | null
  review_count: number | null
  source_url: string | null
  scraped_at: string | null
  status: LeadStatus
  notes: string | null
  campaign_id: string | null
  created_at: string
  updated_at: string
  // enrichment fields
  google_reviews: string | null
  website_summary: string | null
  pain_points: string | null
  linkedin_employees: number | null
  linkedin_description: string | null
  enrichment_status: 'pending' | 'running' | 'completed' | 'failed' | null
  enriched_at: string | null
}

export interface ScraperRun {
  id: string
  run_number: number
  industry: string
  location: string
  apify_run_id: string | null
  status: 'running' | 'completed' | 'failed'
  leads_found: number
  started_at: string
  completed_at: string | null
}

export type CampaignStatus = 'pending' | 'approved' | 'rejected' | 'sent'

export interface Campaign {
  id: string
  lead_id: string
  subject: string
  email_body: string
  image_url: string | null
  status: CampaignStatus
  created_at: string
  reviewed_at: string | null
  sent_at: string | null
  lead?: {
    business_name: string | null
    email: string | null
    category: string | null
    city: string | null
    state: string | null
    website_summary: string | null
    pain_points: string | null
    linkedin_employees: number | null
    linkedin_description: string | null
    enrichment_status: string | null
  }
}

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; text: string; bg: string; dot: string }> = {
  pending:  { label: 'Pending Review', text: 'text-amber-400',   bg: 'bg-amber-400/10',   dot: 'bg-amber-400' },
  approved: { label: 'Approved',       text: 'text-emerald-400', bg: 'bg-emerald-400/10', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected',       text: 'text-red-400',     bg: 'bg-red-400/10',     dot: 'bg-red-400' },
  sent:     { label: 'Sent',           text: 'text-violet-400',  bg: 'bg-violet-400/10',  dot: 'bg-violet-400' },
}

export const STATUS_META: Record<LeadStatus, { label: string; text: string; bg: string; border: string; dot: string }> = {
  new:       { label: 'New',       text: 'text-sky-400',     bg: 'bg-sky-400/10',     border: 'border-sky-400/25',     dot: 'bg-sky-400' },
  contacted: { label: 'Contacted', text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/25',   dot: 'bg-amber-400' },
  qualified: { label: 'Qualified', text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/25', dot: 'bg-emerald-400' },
  rejected:  { label: 'Rejected',  text: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/25',     dot: 'bg-red-400' },
  converted: { label: 'Converted', text: 'text-violet-400',  bg: 'bg-violet-400/10',  border: 'border-violet-400/25',  dot: 'bg-violet-400' },
}
