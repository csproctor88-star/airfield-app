-- ============================================================
-- Grant sms:triage_reports to the Accountable Executive role.
--
-- Phase 1 seed (2026052503) gave the AE sign_policy + approve_moc but
-- omitted triage_reports — an oversight. The AE is the safety
-- executive per AC 150/5200-37A §6.2; triaging incoming safety
-- reports is squarely within their authority. SMS Manager already
-- has the key; this just brings the AE to parity for that one action.
--
-- Other AE perms remain unchanged. sms:write is still withheld — the
-- AE signs / approves / triages but operational SMS work (creating
-- hazards / mitigations / SPIs) stays with sms_manager.
-- ============================================================

INSERT INTO role_permissions (role, permission_key) VALUES
  ('accountable_executive', 'sms:triage_reports')
ON CONFLICT (role, permission_key) DO NOTHING;
