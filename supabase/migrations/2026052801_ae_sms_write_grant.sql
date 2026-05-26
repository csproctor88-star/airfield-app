-- ============================================================
-- Grant sms:write to the Accountable Executive role.
--
-- The Phase 1 seed (2026052503) deliberately withheld sms:write from
-- the AE under the assumption that operational SMS work (creating
-- hazards, mitigations, risk assessments, SPIs) would always go
-- through a dedicated SMS Manager. That assumption holds at hub
-- airports with a separate Safety Office — but Glidepath's actual
-- target market is Class III/IV (~200 small US airports), where the
-- AE is frequently the one-person SMS team and there is no separate
-- SMS Manager.
--
-- Surfaced when an AE-roled user promoted a safety report to a
-- hazard via /sms/reports, was dropped on the new hazard detail, and
-- found the Reassess + Add Mitigation buttons hidden because the
-- UI gates them on sms:write. The promote → assess → mitigate flow
-- is a single operational arc; splitting it across two roles broke
-- the workflow.
--
-- Decision: grant the AE the full operational SMS write surface.
-- Their executive-only powers (sign_policy, approve_moc) remain
-- distinct via the existing keys; this just lets them also do the
-- day-to-day. SMS Manager + AE end up functionally identical inside
-- the SMS module — the role distinction now lives only in how each
-- is labeled and whether they additionally hold the AE-only signing
-- keys.
-- ============================================================

INSERT INTO role_permissions (role, permission_key) VALUES
  ('accountable_executive', 'sms:write')
ON CONFLICT (role, permission_key) DO NOTHING;
