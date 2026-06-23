-- ============================================================
-- PPR Agency External Emails — manually-added recipients
--
-- ppr_agency_members links coordinating agencies to Glidepath users.
-- But some coordinators (a Fire Chief, a tenant-unit POC, a contractor)
-- need PPR coordination / approval / calendar-invite emails without
-- having a Glidepath account. This table holds free-text email
-- addresses per agency; the email send paths union these with the
-- account-based member emails.
--
-- Mirrors ppr_agency_members: base-scoped, admin-managed
-- (base_setup:write), CASCADE on agency/base delete.
-- ============================================================

CREATE TABLE IF NOT EXISTS ppr_agency_emails (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES ppr_agencies(id) ON DELETE CASCADE,
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ppr_agency_emails_agency ON ppr_agency_emails(agency_id);
CREATE INDEX IF NOT EXISTS idx_ppr_agency_emails_base   ON ppr_agency_emails(base_id);

ALTER TABLE ppr_agency_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppr_agency_emails_select" ON ppr_agency_emails;
DROP POLICY IF EXISTS "ppr_agency_emails_insert" ON ppr_agency_emails;
DROP POLICY IF EXISTS "ppr_agency_emails_update" ON ppr_agency_emails;
DROP POLICY IF EXISTS "ppr_agency_emails_delete" ON ppr_agency_emails;

CREATE POLICY "ppr_agency_emails_select" ON ppr_agency_emails
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "ppr_agency_emails_insert" ON ppr_agency_emails
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

CREATE POLICY "ppr_agency_emails_update" ON ppr_agency_emails
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

CREATE POLICY "ppr_agency_emails_delete" ON ppr_agency_emails
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );
