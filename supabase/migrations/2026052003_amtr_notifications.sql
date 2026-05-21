-- ============================================================
-- AMTR — Migration 4/6: in-app notification center
--
-- Notifications are created at the mutation site (or reconciled on
-- record load for due-date alerts) and surfaced in an in-app list.
-- Each is clickable: target_tab + target_item_id deep-link to the
-- exact form item in the member's record.
--
-- Recipient model: recipient_user_id is the user who should see it.
-- For the 797-trainee-signature case, one row is fanned out per
-- Trainer at the base. A recipient can only read/dismiss their own.
-- ============================================================

CREATE TABLE amtr_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id           UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN
                      ('training_due','signoff','entry_623a','item_797_added','signature_797')),
  body              TEXT NOT NULL,
  target_tab        TEXT,
  target_item_id    TEXT,
  -- dedupe key so reconciled due-date alerts don't pile up duplicates
  dedupe_key        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at      TIMESTAMPTZ,
  UNIQUE (recipient_user_id, dedupe_key)
);
CREATE INDEX idx_amtr_notif_recipient ON amtr_notifications(recipient_user_id, dismissed_at, created_at DESC);

ALTER TABLE amtr_notifications ENABLE ROW LEVEL SECURITY;

-- Read: only your own notifications (and you need module view access).
CREATE POLICY "amtr_notifications_select" ON amtr_notifications FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid() AND user_has_permission(auth.uid(), 'amtr:view'));

-- Insert: anyone with write access at the base can create notifications
-- (they're produced as a side effect of a signature/entry the writer made).
CREATE POLICY "amtr_notifications_insert" ON amtr_notifications FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));

-- Update: only the recipient (to set dismissed_at).
CREATE POLICY "amtr_notifications_update" ON amtr_notifications FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());
