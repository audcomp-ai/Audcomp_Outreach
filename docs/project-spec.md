# Project Specification — Audcomp AI

## What It Does

Audcomp AI is an automated B2B outreach pipeline for Audcomp, an IT MSP based in the Hamilton/Burlington/Oakville region of Ontario, Canada.

The system runs daily, finds 5 qualified SMB leads in a rotating sector (Accounting, Insurance, Legal, Medical, Construction), enriches each with business intelligence, scores them, drafts a personalized cold email, and routes it to a human review queue before sending.

## Who Uses It

**Primary users:** Audcomp sales team and account managers
**Trigger point:** Dashboard at `/leads` and `/campaigns`; Slack notifications in `#leads` and `#campaigns`
**Technical operators:** Any team member with Inngest dashboard access can trigger manual scrapes or pause the agent

## Target Lead Criteria

| Attribute | Target |
|---|---|
| Geography | Hamilton, Burlington, Oakville (+ nearby: Ancaster, Dundas, Waterdown, Stoney Creek, Grimsby) |
| Revenue | $10M–$50M (Apollo filter: 11M–100M) |
| Employee count | 10–100 (Apollo filter: 11–50) |
| Decision maker seniority | CEO, President, CXO, Director, Founder |
| Sectors (rotating) | Insurance, Accounting, Legal Services, Medical, Construction |

## Business Objectives

1. **Volume:** 5 new qualified leads per weekday = ~100/month
2. **Quality:** Each lead enriched with tech stack, pain points, LinkedIn data before any outreach
3. **Speed:** Lead → enriched → campaign draft in < 15 minutes (automated)
4. **Control:** Human approves/rejects every email before it sends
5. **Memory:** Full history of every scrape session queryable by date ("what did we find on June 10?")

## Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Outreach Agent — scrape, enrich, score, draft | In Progress |
| 2 | Email Campaign Agent — send approved emails via Outlook | Not Started |
| 3 | Website Builder Agent — Firecrawl-based site rebuild | Not Started |
| 4 | SEO + Blog Agent — weekly AI-generated blog posts | Not Started |
| 5 | AEO Agent — AI search visibility optimization | Not Started |

## Success Metrics (Phase 1)

- Daily scrape completes without failure ≥ 5 days/week
- Enrichment completion rate ≥ 80% of scraped leads
- Average lead score ≥ 60
- Campaign draft generated for 100% of enriched leads
