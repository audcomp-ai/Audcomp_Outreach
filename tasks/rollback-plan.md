# Rollback Plan — Deep Enrichment Feature Branch

## Branch context

| Item | Value |
|---|---|
| Feature branch | `feat/deep-enrichment-tech-stack` |
| Base commit (pre-feature) | `30e54e63` — "feat: scaffold Audcomp AI dashboard with full outreach pipeline" |
| Production (main) | `30e54e63` — same as base, untouched |
| Created | 2026-06-08 |

## What the feature branch added (4 commits)

| Commit | Change |
|---|---|
| `de413d2f` | Deep enrichment pipeline, tech stack fingerprinting, lead intel drawer, campaign agent rewrite, DB migrations 005 + 006 |
| `229a3143` | Scraper fixes: GTA cities, valid seniority values, companyCity filter, Medical industry |
| `7a99e30a` | Slack parser fix: Medical industry alias, canonical Apollo names |
| `6967955d` | Auto-refresh reduced from 30s to 10s on both pages |

---

## Rollback Scenarios

### Scenario A — Feature not yet merged to main (current state)

`main` is untouched at `30e54e63`. Nothing to do on code or Vercel.

**Just stop using the feature branch and stay on main:**
```bash
git checkout main
```

Production is unaffected. No DB rollback needed unless you already ran migrations 005/006 in Supabase.

---

### Scenario B — Feature merged to main, need to revert

**Step 1 — Revert main to pre-feature commit:**
```bash
git checkout main
git revert de413d2f 229a3143 7a99e30a 6967955d --no-commit
git commit -m "Revert: roll back deep enrichment feature"
git push origin main
```

OR hard reset (destructive — only if no one else has pulled main):
```bash
git checkout main
git reset --hard 30e54e63
git push --force origin main   # confirm with user before doing this
```

**Step 2 — Redeploy on Vercel:**
- Vercel auto-deploys on push to main — the revert commit will trigger a new deploy
- Or manually: Vercel dashboard → leads-dashboard → Deployments → find `30e54e63` deploy → "Redeploy"

**Step 3 — Roll back DB migrations (if 005/006 were applied):**

Run in Supabase SQL editor:
```sql
-- Rollback 006_email_sequence.sql
DROP INDEX IF EXISTS public.campaigns_lead_sequence_idx;
ALTER TABLE public.campaigns
  DROP COLUMN IF EXISTS sequence_num,
  DROP COLUMN IF EXISTS send_after;

-- Rollback 005_deep_enrichment.sql
ALTER TABLE public.leads
  DROP COLUMN IF EXISTS tech_stack,
  DROP COLUMN IF EXISTS service_fit,
  DROP COLUMN IF EXISTS it_maturity,
  DROP COLUMN IF EXISTS risk_score,
  DROP COLUMN IF EXISTS regulatory_exposure,
  DROP COLUMN IF EXISTS news_signal,
  DROP COLUMN IF EXISTS contact_is_technical,
  DROP COLUMN IF EXISTS dns_mx,
  DROP COLUMN IF EXISTS has_spf,
  DROP COLUMN IF EXISTS has_dmarc,
  DROP COLUMN IF EXISTS services_offered;
```

---

## Files changed by the feature branch

### New files
- `src/components/LeadDrawer.tsx`
- `migrations/005_deep_enrichment.sql`
- `migrations/006_email_sequence.sql`
- `tasks/rollback-plan.md` (this file)
- `tasks/error-log.md`

### Modified files
- `src/agents/enrichment/index.ts` — complete rewrite
- `src/agents/contacts/index.ts` — complete rewrite (campaign agent)
- `src/agents/discovery/index.ts` — seniority, GTA cities, companyCity, Medical
- `src/services/slack/parser.ts` — Medical industry, canonical names
- `src/app/api/slack/events/route.ts` — help text update
- `src/components/LeadsTable.tsx` — drawer wired in
- `src/types/index.ts` — new Lead/Campaign fields
- `src/app/leads/page.tsx` — auto-refresh 10s
- `src/app/campaigns/page.tsx` — auto-refresh 10s

---

## Quick reference — what main looks like at `30e54e63`

- Enrichment agent: website crawl + LinkedIn + basic Gemini summary (no tech fingerprinting)
- Campaign agent: single email draft (no 3-email sequence)
- Scraper: Hamilton/Burlington/Oakville only, `Owner`/`Partner` seniority (broken), no `companyCity`
- Slack: no Medical industry support
- Portal: no lead drawer, table row expand only
- Auto-refresh: 30s
