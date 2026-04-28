-- ─────────────────────────────────────────────────────────────
-- 2026042902 · AMOPS PPR delete + approve
-- ─────────────────────────────────────────────────────────────
-- AMOPS already had ppr:view + ppr:write but lacked ppr:delete and
-- ppr:approve. The "save pending while I coordinate manually" flow
-- introduced in this same release lands the PPR at
-- status='pending_amops_approval'; without ppr:approve the same
-- AMOPS user couldn't come back and finalize their own entry.
-- ppr:delete is a separate explicit ask — AMOPS owns the PPR
-- lifecycle at the base, so they should be able to delete erroneous
-- or rescinded entries without escalating to a base admin.

INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'ppr:delete'),
  ('amops', 'ppr:approve')
ON CONFLICT (role, permission_key) DO NOTHING;
