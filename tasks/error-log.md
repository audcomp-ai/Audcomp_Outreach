# Error Log — Audcomp AI Outreach

Each entry: what happened → root cause → how we fixed it → how to prevent it.

---

## Template

```
### [YYYY-MM-DD] — Short title

**Symptom:** What the user/system observed
**Root cause:** Why it actually happened
**Troubleshooting steps:**
1. Step 1
2. Step 2
**Fix:** Exact change made
**Prevention:** Rule or check to stop recurrence
```

---

## Errors

---

### 2026-05-XX — Vercel deploy failed: `supabaseUrl required`

**Symptom:** Production app crashed on load with "supabaseUrl is required".
**Root cause:** `.env.local` is gitignored — env vars never reached Vercel. Only the source code was deployed, not the secrets.
**Troubleshooting steps:**
1. Checked build logs in Vercel dashboard — no env var errors at build time (Next.js defers runtime env reads).
2. Opened the live URL — saw the crash message.
3. Checked `.gitignore` — confirmed `.env.local` was excluded.
**Fix:** Ran `vercel env add` for all 12 env vars manually in the Vercel dashboard.
**Prevention:** After any new env var is added to `.env.local`, immediately add it to Vercel. Keep `.env.example` in sync so nothing is missed.

---

### 2026-05-XX — Inngest sync returning 500

**Symptom:** Clicking "Sync" in Inngest dashboard returned HTTP 500 from `/api/inngest`.
**Root cause:** `INNGEST_SIGNING_KEY` was missing from Vercel env vars — it was skipped during the initial env setup round.
**Troubleshooting steps:**
1. Checked Vercel function logs — saw "signing key undefined".
2. Compared `.env.local` list vs Vercel env vars panel — found the missing key.
**Fix:** Added `INNGEST_SIGNING_KEY` to Vercel, triggered a redeploy, re-synced.
**Prevention:** Use `.env.example` as a checklist when adding env vars to Vercel — tick each one off.

---

### 2026-05-XX — Slack bot not posting (`not_in_channel`)

**Symptom:** Scraper ran and completed, but no Slack message appeared in #leads or #campaigns.
**Root cause:** The Slack bot was added to the workspace but never invited into the specific channels. Bots must be explicitly invited with `/invite @botname`.
**Troubleshooting steps:**
1. Checked Inngest step trace — `notify-slack` step succeeded (Slack API returned 200).
2. Checked Slack API logs — saw `not_in_channel` error code.
3. Tried posting manually via `postToLeads()` debug endpoint — same error.
**Fix:** Typed `/invite @outreachagent` in both #leads and #campaigns.
**Prevention:** After any new Slack bot is created or reinstalled, immediately invite it to all target channels. Include this in the Slack setup checklist.

---

### 2026-05-XX — 0 leads returned from Accounting and Legal scrapes

**Symptom:** PPE actor ran successfully (SUCCEEDED status), but dataset contained 0 items with a `personId`.
**Root cause:** Three compounding filter issues:
1. Wrong industry name: used `"Legal Services"` — Apollo taxonomy uses `"Legal"`.
2. Revenue filter (`$10M–$50M`) eliminated nearly all matches in a small market like Hamilton.
3. Employee size capped at `"11 - 50"` — too narrow for the area.
**Troubleshooting steps:**
1. Checked Apify dataset directly — saw 2 status rows, 0 lead rows.
2. Removed revenue filter and re-ran — still 0.
3. Checked Apollo's industry taxonomy docs — found `"Legal"` not `"Legal Services"`.
4. Broadened employee size to `["11 - 50", "51 - 200"]` and removed revenue filter.
5. Re-ran — returned leads.
**Fix:** Updated `INDUSTRIES`, removed `revenue` param, broadened `EMPLOYEE_SIZE` in `src/agents/discovery/index.ts`.
**Prevention:** Always verify industry strings against Apollo taxonomy before adding. Never stack >2 narrow filters for a small regional market — start broad, tighten after verifying data volume.

---

### 2026-05-XX — Slack `/aistatus` showing stale data from demo project

**Symptom:** `/aistatus` in Slack showed 0 leads and old run data even though Supabase had real rows.
**Root cause:** Slack slash commands still pointed to the old demo URL (`leads-dashboard-seven-chi.vercel.app`) not the live project (`audcomp-outreach.vercel.app`). Only the Interactivity URL had been updated.
**Troubleshooting steps:**
1. Ran `/api/debug` on live URL — returned correct lead count.
2. Checked Slack App config — found slash commands each had their own Request URL field, separate from the Interactivity URL.
3. Updated all slash command URLs to live domain.
4. Reinstalled app to workspace.
**Fix:** Updated every slash command URL in Slack App settings → Slash Commands, then reinstalled.
**Prevention:** After any Slack URL change, update ALL three locations: Event Subscriptions, Interactivity, and each Slash Command individually. Always reinstall after URL changes and verify with a live command response.

---

### 2026-05-XX — Event Subscriptions URL verification failure (`challenge not returned`)

**Symptom:** Slack showed "Your URL didn't respond with the value of the challenge parameter" when saving Event Subscriptions URL.
**Root cause:** The `url_verification` challenge request was reaching the HMAC signature check first. Slack sends this challenge without a valid signature, so it was rejected as 401 before the challenge could be echoed.
**Troubleshooting steps:**
1. Added logging — confirmed request was hitting the route.
2. Saw 401 response in logs.
3. Realized Slack's challenge has no signature (it's a setup handshake, not a real event).
**Fix:** Moved `url_verification` handler before the `verifySlackRequest()` call in `src/app/api/slack/events/route.ts`.
**Prevention:** URL verification must always be handled before signature checks. This is a Slack-specific invariant — document it and never reorganize that handler order.

---

### 2026-05-XX — Build error after folder restructure (`@/lib/types` not found)

**Symptom:** `npm run build` failed with "Cannot find module '@/lib/types'" in `src/components/ExportButton.tsx`.
**Root cause:** File was missed during the bulk import path update — `src/lib/types.ts` was moved to `src/types/index.ts` but `ExportButton.tsx` still referenced the old path.
**Troubleshooting steps:**
1. Build output showed exact file and line.
2. Grepped for `@/lib/types` — found one remaining instance in `ExportButton.tsx`.
**Fix:** Updated import to `@/types`.
**Prevention:** After any file move, run `grep -r "old/path" src/` to confirm zero remaining references before attempting a build.

---

### 2026-05-XX — Build error after folder restructure (`./types` relative import in supabase service)

**Symptom:** `npm run build` failed with "Cannot find module './types'" in `src/services/supabase/index.ts`.
**Root cause:** Internal relative import `./types` was not updated when `types.ts` was moved to `src/types/index.ts`. The relative path pointed to a file that no longer existed.
**Troubleshooting steps:**
1. Build output showed exact file and line.
2. Checked the file — found `import type { Lead } from './types'`.
**Fix:** Changed to `import type { Lead } from '@/types'`.
**Prevention:** Same as above — grep for all import forms (both `@/lib/` and relative `./`) after any restructure.
