-- Add AF Form 483, expiration date, and contact phone to contractors
ALTER TABLE airfield_contractors
  ADD COLUMN IF NOT EXISTS af_form_483 TEXT,
  ADD COLUMN IF NOT EXISTS af_form_483_expiration DATE,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;
