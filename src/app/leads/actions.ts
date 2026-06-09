'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { LeadStatus } from '@/types'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  const { error } = await getClient()
    .from('leads')
    .update({ status })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/leads')
}

export async function updateLeadNotes(id: string, notes: string) {
  const { error } = await getClient()
    .from('leads')
    .update({ notes })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/leads')
}
