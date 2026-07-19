-- ============================================================
-- Status board layout — grid upgrade (owner ruling 2026-07-19 #2)
--
-- The reorder-only feature shipped earlier today (2026071901) is upgraded
-- to dashboard-style drag AND resize: sections carry grid rects
-- ({key,x,y,w,h} on a 24-column / 40px-row grid) instead of a bare order.
--
-- layout JSONB — { sections: [{key,x,y,w,h}, ...] }; NULL = base has
--   never customized (page renders the built-in flex band exactly as
--   before, so uncustomized bases are pixel-identical to today).
-- section_order — now nullable; still written (derived from the rects,
--   top-to-bottom / left-to-right) as the phone stacking order and as
--   back-compat for the hours-old rows.
--
-- Editing stays base-admin only (airfield_status:manage_layout,
-- 2026071900) — RLS on this table is unchanged. Edits buffer locally in
-- the page and hit the server ONLY on an explicit Save (owner: no
-- while-you-drag writes — that made the dashboard feel choppy).
--
-- Post-apply verification:
--   SELECT column_name, is_nullable, data_type FROM information_schema.columns
--     WHERE table_name = 'status_board_layouts' ORDER BY ordinal_position;
--   -- expect section_order is_nullable = YES, layout jsonb present
-- ============================================================

ALTER TABLE status_board_layouts
  ALTER COLUMN section_order DROP NOT NULL;

ALTER TABLE status_board_layouts
  ADD COLUMN IF NOT EXISTS layout JSONB;
