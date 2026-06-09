import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { scraperAgent }    from '@/agents/discovery'
import { enrichmentAgent } from '@/agents/enrichment'
import { campaignAgent }   from '@/agents/contacts'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scraperAgent, enrichmentAgent, campaignAgent],
})
