-- Per-base default AFM Out of Office message (used as the prefill when AFM opens the activation dialog)
ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS default_ooo_message TEXT;
