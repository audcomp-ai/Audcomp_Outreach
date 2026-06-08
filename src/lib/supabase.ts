import { createClient } from '@supabase/supabase-js'
import type { Lead } from './types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

// Server-side client with no-store to bypass Next.js fetch cache
function serverClient() {
  return createClient(url, key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await serverClient()
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Lead[]
}
