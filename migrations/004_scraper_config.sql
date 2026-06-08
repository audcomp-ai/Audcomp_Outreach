-- Scraper config key-value store (e.g. pause flag)
CREATE TABLE IF NOT EXISTS public.scraper_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public.scraper_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON public.scraper_config FOR ALL USING (true);

GRANT SELECT, INSERT, UPDATE ON public.scraper_config TO anon, authenticated;

INSERT INTO public.scraper_config (key, value)
VALUES ('paused', 'false')
ON CONFLICT DO NOTHING;
