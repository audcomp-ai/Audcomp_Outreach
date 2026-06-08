-- ============================================================
-- Seed: 3 leads from Apify run bttbmcdyR02BOEysv
-- Run AFTER schema.sql
-- ============================================================

insert into public.leads
  (business_name, phone, email, all_emails, website,
   linkedin_url, facebook_url, twitter_url,
   lead_score, source_url, scraped_at)
values
  (
    'Elby Professional Recruitment',
    '(855) 979-1297',
    'info@elby.ca',
    ARRAY['info@elby.ca'],
    'https://www.elby.ca/',
    'https://www.linkedin.com/company/524431',
    'https://www.facebook.com/Elby-professional-recruitment-129349643854145/',
    'https://twitter.com/elbyrecruitment',
    85,
    'https://html.duckduckgo.com/html/?q=Accounting+firms+Hamilton',
    '2026-06-03T20:28:37.500Z'
  ),
  (
    'Accounting & Tax Services in Hamilton & Burlington',
    '(905) 524-2662',
    'judy@canadianis.com',
    ARRAY['judy@canadianis.com'],
    'https://canadianis.com/',
    null, null, null,
    65,
    'https://html.duckduckgo.com/html/?q=Accounting+firms+Hamilton',
    '2026-06-03T20:28:37.497Z'
  ),
  (
    'Elby Professional Recruitment (Branch)',
    '(289) 291-0880',
    'info@elby.ca',
    ARRAY['info@elby.ca'],
    'https://www.elby.ca/professional-accounting-recruitment-agency/recruiting-hamilton/',
    'https://www.linkedin.com/company/524431',
    'https://www.facebook.com/Elby-professional-recruitment-129349643854145/',
    'https://twitter.com/elbyrecruitment',
    85,
    'https://html.duckduckgo.com/html/?q=Accounting+firms+Hamilton',
    '2026-06-03T20:28:37.504Z'
  );
