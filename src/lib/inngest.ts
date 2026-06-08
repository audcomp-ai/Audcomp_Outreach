import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'audcomp-ai',
  eventKey: process.env.INNGEST_EVENT_KEY,
  // Only use dev mode when explicitly set or in local development
  isDev: process.env.INNGEST_DEV === '1',
})
