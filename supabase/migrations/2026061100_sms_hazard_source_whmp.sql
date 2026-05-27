-- 2026061100 — Add 'whmp' to sms_hazards.source_type CHECK enum
--
-- The Phase 3e WHMP module's "Promote to SMS Hazard" deep-link encodes
-- `prefill_source: 'whmp'` but the original SMS schema (2026052700)
-- enumerated source_type without WHMP because WHMP didn't exist yet.
-- Operationally a WHMP finding is conceptually distinct from a
-- wildlife_strike (the former is a planning-doc finding, the latter is
-- a logged incident), so add 'whmp' as a first-class source rather
-- than aliasing it to wildlife_strike.

ALTER TABLE sms_hazards
  DROP CONSTRAINT IF EXISTS sms_hazards_source_type_check;

ALTER TABLE sms_hazards
  ADD CONSTRAINT sms_hazards_source_type_check
  CHECK (source_type IN (
    'manual','discrepancy','inspection','wildlife_strike',
    'safety_report','audit','moc','reg_review','whmp','other'
  ));
