# Architecture — Audcomp AI

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────┐
│  Inngest Cron  (9 AM ET, Mon–Fri)                       │
│  OR: Slack /scrape command → POST /api/slack/events     │
└──────────────────────┬──────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  scraper-agent  │  peakydev~leads-scraper-ppe (Apify)
              │                 │  Industry rotation: Insurance → Accounting → Legal
              │                 │  Location: Ontario, Canada
              │                 │  Filters: Hamilton/Burlington/Oakville area
              └────────┬────────┘
                       │ fires lead/created (per new lead)
              ┌────────▼────────┐
              │enrichment-agent │  Parallel steps:
              │  (concurrency 3)│  ├─ apify/website-content-crawler (3 pages)
              │                 │  ├─ bebity/linkedin-company-scraper
              │                 │  └─ Gemini 2.0 Flash (pain-point JSON)
              └────────┬────────┘
                       │ fires lead/enriched
              ┌────────▼────────┐
              │  campaign-agent │  Gemini 2.0 Flash → email subject + body
              │  (concurrency 5)│  Saves to campaigns table
              │                 │  Posts to Slack #campaigns with Approve/Reject buttons
              └─────────────────┘
```

## Database Tables

### `leads`
Core record. One row per company (deduped by business_name + city).
Key columns: `business_name`, `email`, `phone`, `website`, `linkedin_url`, social URLs, `lead_score` (0–95), `category`, `city`, `status` (new/contacted/qualified/rejected/converted), `enrichment_status`, `pain_points` (JSON text), `website_summary`, `linkedin_employees`.

### `scraper_runs`
One row per Inngest cron invocation. Tracks: `industry`, `location`, `status` (running/completed/failed), `leads_found`, `apify_run_id`.

### `campaigns`
One email draft per lead. Columns: `lead_id`, `subject`, `email_body`, `image_url`, `status` (pending/approved/rejected/sent).

### `scraper_config`
Key-value store. Currently: `paused` = `true|false` (emergency stop via Slack).

### Schema files
- `schema.sql` — creates `leads` table
- `schema_scraper.sql` — creates `scraper_runs` table
- `migrations/003_enrichment_columns.sql` — adds enrichment columns to `leads`
- `migrations/campaigns.sql` — creates `campaigns` table
- `migrations/004_scraper_config.sql` — creates `scraper_config` table

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/inngest` | GET/POST/PUT | Inngest webhook — all agent invocations |
| `/api/slack/events` | POST | Slack event subscriptions (slash commands) |
| `/api/slack/actions` | POST | Slack interactive actions (Approve/Reject buttons) |
| `/api/generate-image` | POST | On-demand campaign image generation (Gemini) |

## Data Flow Detail

### Scraper Agent Steps
1. `pick-industry` — query `scraper_runs` to find next industry in rotation
2. `check-pause-flag` — read `scraper_config` where key='paused'; abort if true
3. `start-apify` — insert `scraper_runs` row; launch PPE actor via Apify REST API
4. `poll-apify-N` — poll actor run status every 5s, up to 36 attempts (~3 min)
5. `insert-leads` — fetch dataset items; filter by city; dedup; insert to `leads`; score each
6. `fire-enrichment-events` — send `lead/created` event per new lead
7. `notify-complete` — post Slack Block Kit summary to #leads

### Enrichment Agent Steps
1. `fetch-lead` — get lead record from Supabase
2. `mark-running` — set `enrichment_status = 'running'`
3. `scrape-website` — Apify website crawler → markdown → truncated to 4000 chars
4. `scrape-linkedin` — Apify LinkedIn scraper → employee count + description
5. `analyze-intel` — Gemini prompt with all data → JSON `{ website_summary, pain_points[] }`
6. `update-lead` — write enrichment fields + `enrichment_status = 'completed'`
7. `fire-enriched-event` — send `lead/enriched` event

### Campaign Agent Steps
1. `fetch-lead` — get fully-enriched lead
2. `draft-email` — Gemini prompt with pain points → `{ subject, body }` JSON
3. `save-draft` — insert to `campaigns` table (status = 'pending')
4. `notify-slack` — post to #campaigns with Approve/Reject/View buttons

## Lead Scoring

Base: 60 points. Additions:
- Has email: +15
- Has website: +5
- Sweet-spot employee size (11–200): +10
- C-suite/founder seniority: +10
- Max: 95

## Deployment

- **Vercel** — Next.js app (dashboard + API routes)
- **Inngest Cloud** — agent orchestration (connects to `/api/inngest`)
- **Supabase** — managed Postgres (Hamilton/Toronto region)
- **Apify** — cloud actors, billed per use (~$2/day at 5 leads)
