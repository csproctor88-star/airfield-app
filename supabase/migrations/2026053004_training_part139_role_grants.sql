-- ============================================================
-- Phase 3a step 5 — §139.303 Training: civilian role grants
--
-- Fills the gaps in the Phase 1 seed (2026052503) for the five civilian
-- roles. Walkthrough rationale per role:
--
--   accountable_executive (had read, export — adds write):
--     At Class III/IV target airports the AE typically wears the
--     training-coordinator hat too. Same lesson Phase 2 surfaced when
--     we had to follow up with sms:write (575cad9) — withholding write
--     creates an operational dead-end the moment the AE is the only
--     ops person on staff. AE keeps its exclusive sign_policy /
--     approve_moc keys to preserve the executive distinction.
--
--   sms_manager (had read — adds write, export):
--     SMS findings frequently produce remedial training assignments;
--     the SMS manager owns the inspector-evidence packet that bundles
--     training currency with hazard mitigations.
--
--   aep_coordinator (had none — adds read, write, export):
--     Owns §139.303(e)(2) movement-area-access training and triennial
--     drill participation records. Needs full surface to manage AEP
--     coord and produce drill rosters.
--
--   arff_chief (had none — adds read, write, export):
--     Owns §139.303(e)(3) ARFF familiarization. Tracks own crew's
--     currency separate from the airport-wide roster.
--
--   ops_supervisor (had read, write — adds export):
--     The day-to-day training admin role; needs export to print
--     transcripts on demand for new hires and inspector visits.
-- ============================================================

INSERT INTO role_permissions (role, permission_key) VALUES
  ('accountable_executive', 'training_part139:write'),
  ('sms_manager',           'training_part139:write'),
  ('sms_manager',           'training_part139:export'),
  ('aep_coordinator',       'training_part139:read'),
  ('aep_coordinator',       'training_part139:write'),
  ('aep_coordinator',       'training_part139:export'),
  ('arff_chief',            'training_part139:read'),
  ('arff_chief',            'training_part139:write'),
  ('arff_chief',            'training_part139:export'),
  ('ops_supervisor',        'training_part139:export')
ON CONFLICT (role, permission_key) DO NOTHING;
