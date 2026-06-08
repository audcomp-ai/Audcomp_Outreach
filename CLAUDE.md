# Audcomp AI — Project Instructions

> Drop this file at project root. Claude Code reads it automatically.

---

## 1. Project Goal & Architectural Overview

**What it does:** Automated B2B lead pipeline for Audcomp IT MSP. Scrapes, enriches, scores, and drafts outreach campaigns for SMB targets (10–100 employees, $10–50M revenue) in Hamilton, Burlington, and Oakville, Ontario.

**Who uses it:** Audcomp sales and account management team.

**Business objectives:**
- Find 5 qualified leads per day via sector rotation (Accounting → Insurance → Legal → Medical → Construction)
- Enrich each lead with LinkedIn data, tech stack, Google reviews, and AI pain-point analysis
- Auto-draft personalized cold emails; route to human review queue before sending
- Track all outreach in Supabase; surface in the dashboard

**High-level architecture:**
```
Inngest Cron (9 AM ET, weekdays)
  └─ scraper-agent        Apify PPE actor → leads table → fires lead/created
       └─ enrichment-agent   website crawler + LinkedIn + Gemini → fires lead/enriched
            └─ campaign-agent    Gemini email draft → campaigns table → Slack review
```

**Core technologies:**
- Next.js 14 (App Router) — dashboard UI, API routes
- Inngest — orchestrates all agents (cron + event-driven steps)
- Supabase (Postgres) — persistent store for leads, campaigns, sessions, config
- Apify — `peakydev~leads-scraper-ppe` (scraper), `apify/website-content-crawler`, `bebity/linkedin-company-scraper`
- Gemini 2.0 Flash — pain-point analysis, email drafting, image generation
- Slack — notifications for scrape runs (#leads) and campaign review (#campaigns)
- Vercel — hosting

**Key files:**
- `src/inngest/agents/scraper.ts` — daily scrape logic, industry rotation
- `src/inngest/agents/enrichment.ts` — website + LinkedIn + Gemini enrichment
- `src/inngest/agents/campaign.ts` — email draft + Slack post
- `src/app/leads/page.tsx` — leads dashboard
- `src/app/campaigns/page.tsx` — campaign review queue
- `schema.sql` + `schema_scraper.sql` + `migrations/` — database schema

---

## 2. Design Style Guide

**Brand colours (CSS vars in `globals.css`):**
| Token | Value | Use |
|---|---|---|
| `--brand` | `#1B3A8C` | Primary buttons, active nav, headings |
| `--brand-light` | `#EEF4FF` | Active nav bg, badge backgrounds |
| `--accent` | `#2563EB` | Links, interactive elements |
| `--bg` | `#F8FAFF` | Page background |
| `--surface` | `#FFFFFF` | Cards, table |
| `--surface-2` | `#EEF4FF` | Table header, expanded rows, hover state |
| `--border` | `#C7D9F5` | Card/table borders |

**Typography:**
- Body: Inter (400/500/600) via `--font-inter`
- Headings/numbers: Poppins (600/700/800) via `--font-poppins`
- Code/mono: system monospace

**Component patterns:**
- Cards: `rounded-xl border bg-white shadow-sm` with `border-[var(--border)]`
- Badges/pills: `rounded-full border text-xs font-semibold px-2.5 py-0.5`
- Status colours: sky=new, amber=contacted/pending, emerald=qualified/approved, red=rejected, violet=converted/sent
- All interactive colours via CSS vars — never hard-code hex in JSX
- Gradient header: `.brand-header` class (`linear-gradient(135deg, #1B3A8C, #1E40AF)`)

---

## 3. Constraints & Policies

### Security Rules
- Never expose `SUPABASE_SERVICE_KEY` or `INNGEST_SIGNING_KEY` to the browser — server-side only
- Never commit `.env` or `.env.local` — use `.env.example` for documentation
- Never store API tokens in source code — always `process.env.*`
- Validate all Slack inbound requests with HMAC-SHA256 (`verifySlackRequest` in `lib/slack.ts`)
- Sanitize user-supplied query params before passing to Supabase REST API
- Run `/security-review` before merging any PR touching auth, input handling, or external APIs
- Follow OWASP Top 10: no SQL injection via string concat, no XSS via dangerouslySetInnerHTML, no SSRF via user-supplied URLs

### Agent Safety Rules
- Inngest `scraper-agent` has `concurrency: { limit: 1 }` — never remove this (prevents duplicate runs)
- Inngest `enrichment-agent` has `concurrency: { limit: 3 }` — safe for Apify rate limits
- Never remove the `paused` flag check in `scraper-agent` — it's the emergency stop
- Apify polling loop capped at 36 attempts (~3 min) — don't increase without reason

---

## 4. Repository Etiquette

- `main` branch = production. Never commit directly.
- Feature branches: `feat/description`, bug fixes: `fix/description`
- PRs required for all changes to `src/inngest/` and `src/app/api/`
- Commit messages: imperative, present tense (`Add scraper pause flag`, not `Added...`)
- One logical change per commit — don't bundle unrelated fixes
- Run `npm run build` locally before pushing — catch type errors early
- `.env.local` is gitignored. Only `.env.example` is committed.

---

## 5. Testing Instructions

### Unit tests (scorer/analyzer)
- Test `computeLeadScore` in `scraper.ts` with mock PPE items
- Test Gemini prompt output parsing in `enrichment.ts` — JSON extraction is brittle; test edge cases (raw JSON, markdown-wrapped JSON)

### Integration testing (Inngest)
- Use `npm run inngest-dev` to start local Inngest dev server
- Trigger `scraper/manual-trigger` event with `{ industry: 'Accounting', location: 'Hamilton' }` to test end-to-end without waiting for cron
- Check Inngest dashboard at `http://localhost:8288` for step traces
- Verify Supabase `leads` table receives new rows and `enrichment_status` transitions: `pending → running → completed`

### Build gate
- `npm run build` must exit 0 before any PR is merged
- TypeScript errors = blocked PR

---

## 6. Documentation & Folder References

| Document | Location |
|---|---|
| Project specification | `docs/project-spec.md` |
| Architecture diagram + data flow | `docs/architecture.md` |
| Technical decisions (ADRs) | `docs/technical-decisions.md` |
| API routes reference | `docs/api.md` |
| Changelog | `docs/changelog.md` |
| Live project status & milestones | `docs/project-status.md` |
| Self-improvement loop (lessons) | `tasks/lessons.md` |
| DB schema | `schema.sql`, `schema_scraper.sql`, `migrations/` |
| Env var reference | `.env.example` |

---

## 7. Automated Documentation Updates

Update the following files at each major milestone or significant addition:

**After every agent change:**
- `docs/architecture.md` — update data flow if pipeline changes
- `docs/changelog.md` — add entry

**After schema changes:**
- `docs/architecture.md` — update tables section
- `docs/api.md` — update any affected queries
- Add a new migration file in `migrations/`

**After Phase completion:**
- `docs/project-status.md` — mark phase done, update what's next
- `docs/changelog.md` — add version entry

**Never update `CLAUDE.md` mid-task.** Only update at deliberate milestones.

---

## 8. Plugins & MCPs

### Apify Actors in Use
| Actor | Purpose |
|---|---|
| `peakydev~leads-scraper-ppe` | Main scraper — Apollo-type PPE data (company + decision maker + email) |
| `apify/website-content-crawler` | Crawl company website for enrichment (3 pages max) |
| `bebity/linkedin-company-scraper` | LinkedIn company page — employee count, description |

### Inngest Functions
| Function ID | Trigger | Purpose |
|---|---|---|
| `scraper-agent` | `cron: 0 9 * * *` + `scraper/manual-trigger` | Daily lead scrape |
| `enrichment-agent` | `lead/created` event | Per-lead enrichment |
| `campaign-agent` | `lead/enriched` event | Email draft + Slack post |

### External Services
- **Supabase** — Postgres DB + REST API (no ORM, direct fetch calls)
- **Slack** — Block Kit messages, slash command triggers, HMAC request verification
- **Gemini 2.0 Flash** — Pain-point analysis, email drafting (`@google/generative-ai`)
- **Vercel** — Hosting (Next.js, edge functions for API routes)

---

## 9. Project Status

See `docs/project-status.md` for current milestone state.

Quick reference:
- **Phase 1** (Outreach Agent): In progress — scraper + enrichment + campaign agents built
- **Phase 2** (Email sending via Outlook): Not started
- **Phase 3** (Website Builder Agent): Not started
- **Phase 4** (SEO + Blog Agent): Not started
- **Phase 5** (AEO Agent): Not started

---

## 10. Behavior Defaults

### Plan Mode
- Enter plan mode for any task with 3+ steps, schema changes, or new Inngest functions
- Write specs upfront — no code until requirements are unambiguous
- If something breaks mid-execution: STOP, re-plan, get alignment
- Include verification strategy in every plan

### Senior Tech Mindset
- Ask clarifying questions before starting. Surface assumptions.
- Challenge flawed approaches directly with reasoning and a better alternative
- Flag anti-patterns, security risks, and Inngest concurrency issues on sight
- Never remove safety guards (concurrency limits, pause flags, polling caps) without explicit instruction

### Subagent Strategy
- Use `Explore` subagent for codebase searches taking more than 3 grep attempts
- Use `Plan` subagent for architectural decisions (new agent design, schema changes)
- Keep main context for decisions + execution

### Self-Improvement Loop
After any correction:
1. Acknowledge what went wrong specifically
2. Add a rule to `tasks/lessons.md`
3. Review `tasks/lessons.md` at session start

### Verification Checklist
Never mark a task complete without:
- [ ] `npm run build` exits 0
- [ ] Correct behaviour observed (Inngest step trace, Supabase row, Slack message)
- [ ] Edge cases checked (empty dataset, Apify failure, missing env var)
- [ ] No new TypeScript errors in IDE diagnostics
