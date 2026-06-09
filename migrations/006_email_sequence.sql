-- Support 3-email sequences per lead: sequence_num (1/2/3), send_after timestamp
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS sequence_num integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS send_after   timestamptz;

CREATE INDEX IF NOT EXISTS campaigns_lead_sequence_idx
  ON public.campaigns (lead_id, sequence_num);
