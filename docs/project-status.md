# Project Status — Audcomp AI

_Last updated: 2026-06-08_

---

## Current Milestone: Phase 1 — Outreach Agent

| Task | Status |
|---|---|
| Next.js dashboard scaffold | Done |
| Leads table + enrichment columns | Done (schema.sql + migrations/) |
| Scraper agent (Inngest + Apify PPE) | Done |
| Enrichment agent (website + LinkedIn + Gemini) | Done |
| Campaign agent (Gemini email + Slack review) | Done |
| Supabase setup (create project + run migrations) | **Pending** |
| Vercel deployment | **Pending** |
| Inngest Cloud connection | **Pending** |
| Slack app + channels wired | **Pending** |
| Apify account + PPE actor test | **Pending** |
| First live scrape run | **Pending** |

---

## What's Next (Phase 2)

- In-portal email send (draft, edit, and send directly from `/campaigns` — no Outlook)
- `outreach_status` tracking on leads (draft → sent → opened → replied)
- Per-lead send history visible in expanded table row

---

## Phases Roadmap

| Phase | Description | ETA |
|---|---|---|
| 1 | Outreach Agent | Week 1–3 |
| 2 | Email Sending (in-portal, via SMTP/Resend/SendGrid) | Week 3–4 |
| 3 | Website Builder Agent | Week 1–2 |
| 4 | SEO + Blog Agent | Week 2–3 |
| 5 | AEO Agent (AI search visibility) | Week 2–3 |

---

## Accounts Needed

| Service | Status |
|---|---|
| GitHub (audcomp-ai org) | Exists |
| Supabase project | Pending setup |
| Vercel project | Pending setup |
| Apify account + token | Pending setup |
| Slack app (bot token + channels) | Pending setup |
| Inngest account | Pending setup |
| Google AI Studio (Gemini key) | Pending setup |
