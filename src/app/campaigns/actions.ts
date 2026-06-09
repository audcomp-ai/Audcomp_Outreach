'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function updateCampaignStatus(campaignId: string, status: 'approved' | 'rejected') {
  await supabase
    .from('campaigns')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', campaignId)
  revalidatePath('/campaigns')
}

export async function updateSequenceStatus(leadId: string, status: 'approved' | 'rejected') {
  await supabase
    .from('campaigns')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('lead_id', leadId)
  revalidatePath('/campaigns')
}

export async function updateCampaignBody(campaignId: string, subject: string, emailBody: string) {
  await supabase
    .from('campaigns')
    .update({ subject, email_body: emailBody })
    .eq('id', campaignId)
  revalidatePath('/campaigns')
}
