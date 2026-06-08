# Technical Decisions (ADRs)

## ADR-001: Apify PPE Actor over Google Maps Scraper

**Decision:** Use `peakydev~leads-scraper-ppe` (Apollo People + Phones + Emails) as the primary scraper instead of Google Maps.

**Reason:** PPE returns contact-level data in one call — decision maker name, title, email, LinkedIn URL, company size, revenue range. Google Maps returns business listings only; finding the right contact person requires a second LinkedIn lookup. PPE collapses two Apify runs into one, halving cost and latency.

**Trade-off:** PPE data is Apollo-sourced (may lag 3–6 months). Google Maps has fresher data for ratings/reviews. Mitigated by enrichment step which scrapes the live website and LinkedIn page.

---

## ADR-002: Gemini 2.0 Flash over Claude for AI Steps

**Decision:** Use Gemini 2.0 Flash (`@google/generative-ai`) for pain-point analysis, email drafting, and image generation.

**Reason:** Gemini 2.0 Flash is faster and cheaper for high-volume structured JSON generation. At 5 leads/day × 2 AI calls = 10 calls/day, cost difference is negligible, but Gemini's free tier covers early development. Gemini Imagen is available for campaign image generation without an additional vendor.

**Trade-off:** Gemini's JSON reliability slightly lower than Claude for complex prompts. Mitigated by defensive parsing in `enrichment.ts` (finds first `{` to last `}`).

---

## ADR-003: Inngest over Vercel Cron + Raw Fetch

**Decision:** Use Inngest for all agent orchestration rather than Vercel cron jobs calling fetch chains directly.

**Reason:** Inngest provides step-level memoization (safe to retry any step without re-running completed steps), built-in retry logic, concurrency limits, real-time debugging UI, and event fan-out. A Vercel cron that calls a long-running scrape would timeout at 60s on hobby tier. Inngest functions run as durable background jobs with no timeout.

**Trade-off:** Inngest adds a third-party dependency and requires a signing key. Mitigated by: Inngest has a generous free tier, the SDK is MIT-licensed, and the core logic is portable to any queue.

---

## ADR-004: Supabase REST API (direct fetch) over Supabase JS Client in Agents

**Decision:** Agent files (`scraper.ts`, `enrichment.ts`, `campaign.ts`) use raw `fetch` against the Supabase REST API rather than `createClient()`.

**Reason:** Inngest functions run in a long-lived Node process with no request context. The Supabase JS client initializes per-request auth state and can hold open connections. Direct fetch calls are stateless, predictable, and easier to debug in Inngest step traces.

**Trade-off:** More verbose (manual `apikey` headers, manual URL building). Dashboard/server components still use `createClient()` where the request lifecycle is well-defined.

---

## ADR-005: Single `leads` Table (no separate `contacts` table)

**Decision:** Store both company and contact-person data in the `leads` table rather than separate `companies` + `contacts` tables.

**Reason:** The PPE actor returns one decision-maker per company per scrape run. There's no multi-contact-per-company use case in Phase 1. A normalized schema adds join complexity for the dashboard without benefit at this scale.

**Trade-off:** If Phase 2 requires multiple contacts per company, a migration to split tables will be needed. Acceptable — Phase 1 is the priority.
