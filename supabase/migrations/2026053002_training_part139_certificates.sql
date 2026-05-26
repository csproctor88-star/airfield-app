-- ============================================================
-- Phase 3a step 3 — §139.303 Training: professional certificates
--
-- Tracks the AAAE and ACE professional credentials that civilian
-- airport ops personnel commonly hold. Narrow enum by design — broader
-- credential tracking (CPR, AED, HAZWOPER, security clearance, etc.)
-- can be added later behind a per-base catalog if pilot feedback
-- requests it. Today's target customer (Class III/IV non-hub) tracks
-- these five professional credentials and not much else in this
-- system.
--
-- Credential cycles vary: AAAE-CM is a 3-year cycle, some ACE rows are
-- lifetime — `expires_at` is nullable to represent both. UI renders
-- lifetime certs without a status chip.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'training_credential') THEN
    CREATE TYPE training_credential AS ENUM (
      'AAAE-CM',   -- Certified Member (AAAE)
      'ACE-Ops',   -- Airport Certified Employee – Operations
      'ACE-Comm',  -- Airport Certified Employee – Communications
      'ACE-Sec',   -- Airport Certified Employee – Security
      'ACE-WHC'    -- Airport Certified Employee – Wildlife Hazard Control
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS training_certificates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id          UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credential       training_credential NOT NULL,
  issued_at        DATE NOT NULL,
  expires_at       DATE,                            -- NULL = lifetime credential
  certificate_url  TEXT,                            -- optional: scanned cert PDF / verification URL
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES profiles(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_certificates_base_user ON training_certificates (base_id, user_id);
CREATE INDEX IF NOT EXISTS idx_training_certificates_expires   ON training_certificates (base_id, expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE  training_certificates IS 'AAAE / ACE professional credentials per user. One row per (user, credential, issued_at). Reissuance = new row, no supersession chain (unlike training_records).';
COMMENT ON COLUMN training_certificates.expires_at IS 'NULL means lifetime credential (some ACE legacy certs). UI treats NULL as evergreen.';
