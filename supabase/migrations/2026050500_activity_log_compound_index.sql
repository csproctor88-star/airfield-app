-- Compound index for the Events Log page query, which always filters
-- by base_id + a date range and orders by created_at DESC. The existing
-- single-column idx_activity_log_base (from 2026022301) is fine for
-- "all rows for this base" lookups (e.g. realtime channel filters)
-- but forces a sort + range filter on top of the index scan. Once a
-- base accumulates enough rows that becomes visible.
--
-- Both indexes coexist; the planner picks whichever is cheaper per query.
CREATE INDEX IF NOT EXISTS idx_activity_log_base_created
  ON activity_log (base_id, created_at DESC);
