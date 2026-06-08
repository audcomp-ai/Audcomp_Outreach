-- ============================================================
-- Leads table — run this in your Supabase SQL editor
-- ============================================================

create table public.leads (
  id               uuid primary key default gen_random_uuid(),

  -- Scraped fields
  business_name    text,
  phone            text,
  email            text,
  all_emails       text[]    default '{}',
  website          text,
  linkedin_url     text,
  facebook_url     text,
  twitter_url      text,
  instagram_url    text,
  youtube_url      text,
  lead_score       integer   default 0,
  category         text,
  address          text,
  city             text,
  state            text,
  zip              text,
  rating           numeric,
  review_count     integer,
  source_url       text,
  scraped_at       timestamptz,

  -- Enrichment fields (you update these)
  status           text      not null default 'new'
                   check (status in ('new','contacted','qualified','rejected','converted')),
  notes            text,
  campaign_id      uuid,

  -- Timestamps
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-bump updated_at on any update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

-- Useful indexes
create index on public.leads (status);
create index on public.leads (lead_score desc);
create index on public.leads (scraped_at desc);
create index on public.leads (created_at desc);

-- RLS (open for now — tighten when you add auth)
alter table public.leads enable row level security;

create policy "anon_select"  on public.leads for select using (true);
create policy "anon_insert"  on public.leads for insert with check (true);
create policy "anon_update"  on public.leads for update using (true);

-- Expose to REST API
grant select, insert, update on public.leads to anon, authenticated;
