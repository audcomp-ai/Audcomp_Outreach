# API Reference — Audcomp AI

All routes live in `src/app/api/`.

---

## POST /api/inngest

Inngest webhook handler. Receives all agent invocations, step retries, and cron triggers from Inngest Cloud.

**Auth:** Inngest signing key (verified by `serve()` middleware automatically)

**Registered functions:**
- `scraper-agent` — triggered by cron `0 9 * * *` and event `scraper/manual-trigger`
- `enrichment-agent` — triggered by event `lead/created`
- `campaign-agent` — triggered by event `lead/enriched`

**Manual trigger (send from Inngest dashboard or SDK):**
```json
{
  "name": "scraper/manual-trigger",
  "data": {
    "industry": "Accounting",
    "location": "Hamilton"
  }
}
```

---

## POST /api/slack/events

Receives Slack event subscriptions and slash command payloads.

**Auth:** HMAC-SHA256 signature verified via `verifySlackRequest()` from `lib/slack.ts`

**Handled commands:**
- `/scrape [industry] [location]` — triggers `scraper/manual-trigger` event; responds immediately with acknowledgment

**Response:** 200 OK within 3 seconds (Slack requirement); async work fired via Inngest

---

## POST /api/slack/actions

Receives Slack interactive component payloads (button clicks).

**Auth:** HMAC-SHA256 signature verified

**Handled actions:**
| `action_id` prefix | Effect |
|---|---|
| `approve_campaign:{id}` | Sets campaign status = 'approved' in Supabase |
| `reject_campaign:{id}` | Sets campaign status = 'rejected' in Supabase |
| `view_campaign:{id}` | URL button — opens `/campaigns` in browser (no server action) |

---

## POST /api/generate-image

On-demand campaign image generation using Gemini Imagen.

**Request body:**
```json
{
  "campaignId": "uuid",
  "businessName": "Smith Accounting",
  "industry": "Accounting",
  "painPoints": [
    { "signal": "...", "category": "security", "pitch_angle": "..." }
  ]
}
```

**Response:**
```json
{ "imageUrl": "https://..." }
```

Saves `image_url` to `campaigns` table on success.

---

## Supabase Tables (REST API via direct fetch in agents)

Base URL: `process.env.SUPABASE_URL/rest/v1/`
Auth headers: `apikey` + `Authorization: Bearer <service_key>`

| Table | Used by |
|---|---|
| `leads` | scraper (insert), enrichment (patch), dashboard (select) |
| `scraper_runs` | scraper (insert/patch), ScraperRunsBar (select) |
| `campaigns` | campaign agent (insert), CampaignsQueue (select/patch) |
| `scraper_config` | scraper (select for pause check) |
