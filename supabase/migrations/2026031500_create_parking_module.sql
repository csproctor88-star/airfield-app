-- Aircraft Parking & Clearance Planning Module
-- Tables: parking_plans, parking_spots, parking_obstacles

-- ── Parking Plans ──
CREATE TABLE IF NOT EXISTS parking_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  plan_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parking_plans_base ON parking_plans(base_id);
CREATE INDEX idx_parking_plans_active ON parking_plans(base_id, is_active);

-- ── Parking Spots ──
CREATE TABLE IF NOT EXISTS parking_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES parking_plans(id) ON DELETE CASCADE,
  base_id UUID REFERENCES bases(id),
  spot_name TEXT,
  spot_type TEXT CHECK (spot_type IN ('apron', 'ramp', 'transient')),
  aircraft_name TEXT,
  tail_number TEXT,
  unit_callsign TEXT,
  longitude DOUBLE PRECISION NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  heading_deg DOUBLE PRECISION DEFAULT 0,
  clearance_ft DOUBLE PRECISION,
  status TEXT CHECK (status IN ('occupied', 'available', 'reserved')) DEFAULT 'available',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parking_spots_plan ON parking_spots(plan_id);
CREATE INDEX idx_parking_spots_base ON parking_spots(base_id);

-- ── Parking Obstacles ──
CREATE TABLE IF NOT EXISTS parking_obstacles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  obstacle_type TEXT CHECK (obstacle_type IN ('point', 'building', 'line', 'circle')),
  name TEXT,
  longitude DOUBLE PRECISION NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  width_ft DOUBLE PRECISION,
  length_ft DOUBLE PRECISION,
  rotation_deg DOUBLE PRECISION,
  radius_ft DOUBLE PRECISION,
  height_ft DOUBLE PRECISION,
  line_coords JSONB,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parking_obstacles_base ON parking_obstacles(base_id);

-- ── RLS Policies ──
ALTER TABLE parking_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_obstacles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parking_plans_select" ON parking_plans FOR SELECT USING (true);
CREATE POLICY "parking_plans_insert" ON parking_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "parking_plans_update" ON parking_plans FOR UPDATE USING (true);
CREATE POLICY "parking_plans_delete" ON parking_plans FOR DELETE USING (true);

CREATE POLICY "parking_spots_select" ON parking_spots FOR SELECT USING (true);
CREATE POLICY "parking_spots_insert" ON parking_spots FOR INSERT WITH CHECK (true);
CREATE POLICY "parking_spots_update" ON parking_spots FOR UPDATE USING (true);
CREATE POLICY "parking_spots_delete" ON parking_spots FOR DELETE USING (true);

CREATE POLICY "parking_obstacles_select" ON parking_obstacles FOR SELECT USING (true);
CREATE POLICY "parking_obstacles_insert" ON parking_obstacles FOR INSERT WITH CHECK (true);
CREATE POLICY "parking_obstacles_update" ON parking_obstacles FOR UPDATE USING (true);
CREATE POLICY "parking_obstacles_delete" ON parking_obstacles FOR DELETE USING (true);
