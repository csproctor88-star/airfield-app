-- 2026062400_flip_change_events.sql
-- Append-only coordination history for FLIP changes: one row per lifecycle
-- action (coordinated / afm_approved / processed / published / rejected),
-- capturing the actor, timestamp, and optional remarks. Drives the
-- "Coordination History" timeline on each change card.

CREATE TABLE flip_change_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id     UUID NOT NULL REFERENCES flip_changes(id) ON DELETE CASCADE,
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN
                  ('coordinated','afm_approved','processed','published','rejected')),
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name    TEXT,              -- display name snapshot (rank + name) for history
  remarks       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_change_events_change ON flip_change_events(change_id, created_at);

ALTER TABLE flip_change_events ENABLE ROW LEVEL SECURITY;

-- Read for flip:view; append for flip:write. No update/delete — audit trail.
CREATE POLICY "flip_change_events_select" ON flip_change_events FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:view'));
CREATE POLICY "flip_change_events_insert" ON flip_change_events FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
