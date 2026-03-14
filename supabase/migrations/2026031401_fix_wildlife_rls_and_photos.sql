-- Fix wildlife module: role-aware RLS policies + photo FK columns
-- Replaces wide-open USING(true) policies with base-access-aware policies

-- ── Drop existing wide-open policies ──
DROP POLICY IF EXISTS "wildlife_sightings_select" ON wildlife_sightings;
DROP POLICY IF EXISTS "wildlife_sightings_insert" ON wildlife_sightings;
DROP POLICY IF EXISTS "wildlife_sightings_update" ON wildlife_sightings;
DROP POLICY IF EXISTS "wildlife_sightings_delete" ON wildlife_sightings;

DROP POLICY IF EXISTS "wildlife_strikes_select" ON wildlife_strikes;
DROP POLICY IF EXISTS "wildlife_strikes_insert" ON wildlife_strikes;
DROP POLICY IF EXISTS "wildlife_strikes_update" ON wildlife_strikes;
DROP POLICY IF EXISTS "wildlife_strikes_delete" ON wildlife_strikes;

DROP POLICY IF EXISTS "bwc_history_select" ON bwc_history;
DROP POLICY IF EXISTS "bwc_history_insert" ON bwc_history;
DROP POLICY IF EXISTS "bwc_history_update" ON bwc_history;
DROP POLICY IF EXISTS "bwc_history_delete" ON bwc_history;

-- ── wildlife_sightings — role-aware policies ──
CREATE POLICY "wildlife_sightings_select" ON wildlife_sightings
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "wildlife_sightings_insert" ON wildlife_sightings
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "wildlife_sightings_update" ON wildlife_sightings
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "wildlife_sightings_delete" ON wildlife_sightings
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- ── wildlife_strikes — role-aware policies ──
CREATE POLICY "wildlife_strikes_select" ON wildlife_strikes
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "wildlife_strikes_insert" ON wildlife_strikes
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "wildlife_strikes_update" ON wildlife_strikes
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "wildlife_strikes_delete" ON wildlife_strikes
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- ── bwc_history — role-aware policies ──
CREATE POLICY "bwc_history_select" ON bwc_history
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "bwc_history_insert" ON bwc_history
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "bwc_history_update" ON bwc_history
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "bwc_history_delete" ON bwc_history
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- ── Add wildlife photo FK columns to photos table ──
ALTER TABLE photos ADD COLUMN IF NOT EXISTS wildlife_sighting_id UUID REFERENCES wildlife_sightings(id) ON DELETE CASCADE;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS wildlife_strike_id UUID REFERENCES wildlife_strikes(id) ON DELETE CASCADE;
