-- 2026062900_dashboard_user_defaults.sql
-- Per-user default dashboard board (per base). Replaces the per-board is_default
-- boolean as the source of truth for "my default board", so a user can default to
-- ANY board they can see -- including a shared one. board_id ON DELETE CASCADE
-- clears the default automatically when its board is deleted (so deleting your
-- default board just falls back to auto-resolution on next load). RLS via the
-- matrix helpers; each user manages only their own rows.

CREATE TABLE dashboard_user_defaults (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  board_id   UUID NOT NULL REFERENCES dashboard_boards(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, base_id)
);

CREATE INDEX idx_dashboard_user_defaults_board ON dashboard_user_defaults(board_id);

ALTER TABLE dashboard_user_defaults ENABLE ROW LEVEL SECURITY;

-- Users read/write only their own default rows, at bases they can access.
CREATE POLICY "dashboard_user_defaults_rw" ON dashboard_user_defaults FOR ALL TO authenticated
  USING      (user_id = auth.uid() AND user_has_base_access(auth.uid(), base_id))
  WITH CHECK (user_id = auth.uid() AND user_has_base_access(auth.uid(), base_id));

-- Backfill from the existing per-board is_default flag (personal boards only).
INSERT INTO dashboard_user_defaults (user_id, base_id, board_id)
SELECT owner_id, base_id, id FROM dashboard_boards
WHERE is_default = TRUE AND owner_id IS NOT NULL
ON CONFLICT (user_id, base_id) DO NOTHING;
