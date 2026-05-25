-- ============================================================
-- Phase 1.7 — Per-base daily_review_slots
--
-- Today the daily_reviews shift slots are hardcoded as
-- ('day_amsl','swing_amsl','mid_amsl','namo','afm') in
-- app/(app)/daily-reviews/page.tsx with USAF nomenclature baked
-- into the labels. Civilian Part 139 airports use different shift
-- terms (Day / Evening / Night / Supervisor / Manager) and have
-- different shift counts.
--
-- This migration converts the hardcoded set into a per-base config
-- table. Existing bases get backfilled with their current 5-slot
-- USAF shape so daily-reviews continues to render identically.
-- New civilian bases get a 5-slot civilian shape from the wizard.
--
-- daily_reviews rows continue to key on slot_key (TEXT) — no data
-- migration. The shift_count column on bases (2 or 3) still
-- determines which AMSL slots are required.
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_review_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  slot_key    TEXT NOT NULL,           -- e.g. 'day_amsl', 'supervisor', 'manager'
  label       TEXT NOT NULL,           -- e.g. 'Day AMSL', 'Day Supervisor', 'Operations Manager'
  sort_order  INTEGER NOT NULL,
  required    BOOLEAN NOT NULL DEFAULT true,
  permission_key TEXT,                 -- which permission gates signing this slot (e.g. 'daily_reviews:sign:amsl')
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_daily_review_slots_base ON daily_review_slots(base_id, sort_order);

-- ── RLS: base-scoped read ──────────────────────────────────

ALTER TABLE daily_review_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_review_slots_read ON daily_review_slots;
CREATE POLICY daily_review_slots_read
  ON daily_review_slots
  FOR SELECT
  TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

DROP POLICY IF EXISTS daily_review_slots_write ON daily_review_slots;
CREATE POLICY daily_review_slots_write
  ON daily_review_slots
  FOR ALL
  TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

-- ── Backfill: every existing base gets the USAF 5-slot shape ──

INSERT INTO daily_review_slots (base_id, slot_key, label, sort_order, required, permission_key)
SELECT
  b.id,
  s.slot_key,
  s.label,
  s.sort_order,
  s.required,
  s.permission_key
FROM bases b
CROSS JOIN (VALUES
  ('day_amsl',   'Day AMSL',   1, true, 'daily_reviews:sign:amsl'),
  ('swing_amsl', 'Swing AMSL', 2, true, 'daily_reviews:sign:amsl'),
  ('mid_amsl',   'Mid AMSL',   3, true, 'daily_reviews:sign:amsl'),
  ('namo',       'NAMO',       4, true, 'daily_reviews:sign:namo'),
  ('afm',        'AFM',        5, true, 'daily_reviews:sign:afm')
) AS s(slot_key, label, sort_order, required, permission_key)
WHERE b.airport_type = 'usaf'
ON CONFLICT (base_id, slot_key) DO NOTHING;

COMMENT ON TABLE daily_review_slots IS
  'Per-base daily-review shift slot configuration. Existing USAF bases backfilled with the legacy 5-slot AMSL/NAMO/AFM shape; new civilian bases get a Day/Evening/Night/Supervisor/Manager shape from the base-setup wizard.';
