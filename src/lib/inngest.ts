import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'audcomp-ai',
  eventKey: process.env.INNGEST_EVENT_KEY,
  // Only use dev mode when explicitly set or in local development
  isDev: process.env.INNGEST_DEV === '1',
})

// Direct HTTP sender — bypasses the Inngest SDK which fails in Vercel serverless.
// Use this everywhere instead of inngest.send() for outbound event firing.
export async function sendInngestEvent(name: string, data: Record<string, unknown>) {
  const key = process.env.INNGEST_EVENT_KEY!
  const r = await fetch(`https://inn.gs/e/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  })
  if (!r.ok) throw new Error(`Inngest event send failed: ${r.status} ${await r.text()}`)
}
