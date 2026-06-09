import { createClient } from '@supabase/supabase-js'
import type { Lead } from '@/types'

// Browser client (anon key) — used for client components only
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(publicUrl, publicKey)

// Server client (service role) — bypasses RLS, never reaches the browser
function serverClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } }
  )
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await serverClient()
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Lead[]
}
