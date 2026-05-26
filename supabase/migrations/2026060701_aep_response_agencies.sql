-- ============================================================
-- Phase 3b step 2 — Airport Emergency Plan: response-agency roster
--
-- AC 150/5200-31C App. 1 lists the response agencies the airport
-- coordinates with under the AEP. Roster persists per base; rows
-- are surfaced in the comms-check picker and the drill-participants
-- multi-select. Inactive rows stay in the table so historical comms
-- checks and drills retain a usable name reference even after the
-- agency is removed from the active roster.
--
-- agency_role is CHECK-enforced so the UI can group reliably.
-- ============================================================

CREATE TABLE IF NOT EXISTS aep_response_agencies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id               UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  agency_name           TEXT NOT NULL,
  agency_role           TEXT NOT NULL CHECK (agency_role IN (
                          'arff', 'mutual_aid_fire', 'ems', 'police', 'hospital',
                          'atc', 'faa_ro', 'ntsb', 'fbi', 'public_works', 'utility', 'other'
                        )),
  primary_contact_name  TEXT,
  primary_contact_phone TEXT,
  primary_contact_radio TEXT,                                  -- frequency / channel
  backup_contact_name   TEXT,
  backup_contact_phone  TEXT,
  notes                 TEXT,                                  -- "Activate via 911 dispatch; reference 'Airport ARFF assist'"
  sort_order            INT NOT NULL DEFAULT 100,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aep_agencies_base
  ON aep_response_agencies (base_id);

COMMENT ON TABLE  aep_response_agencies IS 'AEP response-agency roster per AC 150/5200-31C App. 1. Inactive rows preserved for historical comms checks / drills.';
COMMENT ON COLUMN aep_response_agencies.agency_role IS 'CHECK-enforced enum so the UI can group rows reliably.';
