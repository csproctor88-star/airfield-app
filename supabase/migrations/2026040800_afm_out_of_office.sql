-- AFM Out of Office overlay — persisted on airfield_status for realtime push
ALTER TABLE airfield_status
  ADD COLUMN IF NOT EXISTS afm_out_of_office BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS afm_ooo_message TEXT;
