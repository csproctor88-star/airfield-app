-- Multi-Base Support: Create bases and related configuration tables
-- This migration introduces the core tables needed for multi-base operations.

-- ═══════════════════════════════════════════════════════════════
-- 1. bases — One row per airfield installation
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                          -- e.g. "Selfridge Air National Guard Base"
  icao        TEXT NOT NULL UNIQUE,                   -- e.g. "KMTC"
  unit        TEXT,                                   -- e.g. "127th Wing"
  majcom      TEXT,                                   -- e.g. "Michigan Air National Guard"
  location    TEXT,                                   -- e.g. "Harrison Township, Michigan"
  elevation_msl INTEGER,                              -- feet above MSL
  timezone    TEXT NOT NULL DEFAULT 'America/New_York',
  ce_shops    TEXT[] NOT NULL DEFAULT '{}',            -- CE shop names for this base
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. base_runways — Runway configuration per base
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS base_runways (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id         UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  runway_id       TEXT NOT NULL,                      -- e.g. "01/19"
  length_ft       INTEGER NOT NULL,
  width_ft        INTEGER NOT NULL,
  surface         TEXT NOT NULL DEFAULT 'Asphalt',
  true_heading    NUMERIC(5,1),
  end1_designator TEXT NOT NULL,                      -- e.g. "01"
  end1_latitude   DOUBLE PRECISION,
  end1_longitude  DOUBLE PRECISION,
  end1_heading    NUMERIC(5,1),
  end1_approach_lighting TEXT,                        -- e.g. "SALS"
  end2_designator TEXT NOT NULL,                      -- e.g. "19"
  end2_latitude   DOUBLE PRECISION,
  end2_longitude  DOUBLE PRECISION,
  end2_heading    NUMERIC(5,1),
  end2_approach_lighting TEXT,                        -- e.g. "ALSF-1"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_id, runway_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 3. base_navaids — NAVAID definitions per base
--    Replaces the fixed 6-row navaid_statuses seed
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS base_navaids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  navaid_name TEXT NOT NULL,                          -- e.g. "01 Localizer"
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_id, navaid_name)
);

-- ═══════════════════════════════════════════════════════════════
-- 4. base_areas — Airfield areas per base (for checks multi-select)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS base_areas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  area_name   TEXT NOT NULL,                          -- e.g. "RWY 01/19", "TWY A"
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_id, area_name)
);

-- ═══════════════════════════════════════════════════════════════
-- 5. base_members — User-to-base membership with role
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS base_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'observer',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_base_runways_base ON base_runways(base_id);
CREATE INDEX idx_base_navaids_base ON base_navaids(base_id);
CREATE INDEX idx_base_areas_base ON base_areas(base_id);
CREATE INDEX idx_base_members_base ON base_members(base_id);
CREATE INDEX idx_base_members_user ON base_members(user_id);

-- ═══════════════════════════════════════════════════════════════
-- Disable RLS on new tables (matches current convention)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE bases DISABLE ROW LEVEL SECURITY;
ALTER TABLE base_runways DISABLE ROW LEVEL SECURITY;
ALTER TABLE base_navaids DISABLE ROW LEVEL SECURITY;
ALTER TABLE base_areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE base_members DISABLE ROW LEVEL SECURITY;
