import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { scraperAgent }    from '@/inngest/agents/scraper'
import { enrichmentAgent } from '@/inngest/agents/enrichment'
import { campaignAgent }   from '@/inngest/agents/campaign'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scraperAgent, enrichmentAgent, campaignAgent],
})
