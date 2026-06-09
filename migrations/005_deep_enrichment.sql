-- Deep enrichment columns: tech stack, service fit scoring, IT maturity, risk score,
-- regulatory exposure, company news signal, DNS intel, contact background inference
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS tech_stack           jsonb,
  ADD COLUMN IF NOT EXISTS service_fit          jsonb,
  ADD COLUMN IF NOT EXISTS it_maturity          integer,
  ADD COLUMN IF NOT EXISTS risk_score           integer,
  ADD COLUMN IF NOT EXISTS regulatory_exposure  text,
  ADD COLUMN IF NOT EXISTS news_signal          text,
  ADD COLUMN IF NOT EXISTS contact_is_technical boolean,
  ADD COLUMN IF NOT EXISTS dns_mx               text,
  ADD COLUMN IF NOT EXISTS has_spf              boolean,
  ADD COLUMN IF NOT EXISTS has_dmarc            boolean,
  ADD COLUMN IF NOT EXISTS services_offered     text;
