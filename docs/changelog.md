# Changelog

## v0.1.0 — 2026-06-08

### Added
- Full Next.js 14 dashboard scaffolded from working demo (leads-dashboard-seven-chi.vercel.app)
- `/leads` page: StatsBar, ScraperRunsBar, LeadsTable with sort/filter/expand/inline-edit/export
- `/campaigns` page: CampaignsQueue with approve/reject/edit/image-generation
- Inngest agents: `scraper-agent`, `enrichment-agent`, `campaign-agent`
- Apify integrations: PPE scraper, website crawler, LinkedIn scraper
- Gemini 2.0 Flash for pain-point analysis, email drafting, image generation
- Slack Block Kit notifications for scrape runs and campaign review
- Supabase schema: `leads`, `scraper_runs`, `campaigns`, `scraper_config`
- CLAUDE.md with all 10 sections
- Full documentation: project-spec, architecture, technical-decisions, api, project-status
- `.env.example` with all required variables
- Teams integration removed (not required for Phase 1)

### Infrastructure
- TypeScript compiles clean
- `npm run build` passes (requires `.env.local` with Supabase URL for page data collection)
