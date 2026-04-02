-- Add AF Form 483, expiration date, and contact phone to contractors
ALTER TABLE airfield_contractors
  ADD COLUMN IF NOT EXISTS af_form_483 TEXT,
  ADD COLUMN IF NOT EXISTS af_form_483_expiration DATE,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add contractor templates JSONB column to bases for shared templates
ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS contractor_templates JSONB DEFAULT '[]'::jsonb;
