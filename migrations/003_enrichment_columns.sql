-- Run in Supabase SQL editor after 002 migration
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS google_reviews      text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS website_summary     text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pain_points         text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin_employees  integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin_description text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enrichment_status   text DEFAULT 'pending';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enriched_at         timestamptz;
