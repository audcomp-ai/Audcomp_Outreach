-- Run this in your Supabase SQL editor AFTER schema.sql
create table public.scraper_runs (
  id           uuid primary key default gen_random_uuid(),
  run_number   integer not null,
  industry     text not null,
  location     text not null,
  apify_run_id text,
  status       text default 'running'
               check (status in ('running','completed','failed')),
  leads_found  integer default 0,
  started_at   timestamptz default now(),
  completed_at timestamptz
);
alter table public.scraper_runs enable row level security;
create policy "anon_all" on public.scraper_runs for all using (true);
grant select, insert, update on public.scraper_runs to anon, authenticated;
