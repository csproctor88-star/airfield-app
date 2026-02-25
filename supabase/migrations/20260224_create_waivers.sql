-- ═══════════════════════════════════════════
-- Waivers Module — Waiver lifecycle tracking
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT UNIQUE NOT NULL,
  base_id UUID REFERENCES bases(id),
  waiver_type TEXT NOT NULL CHECK (waiver_type IN (
    'obstruction','lighting','marking','driving','construction','other'
  )),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','approved','denied','active','expired'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location_text TEXT,
  authority_reference TEXT,
  conditions TEXT,
  requested_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  effective_start TIMESTAMPTZ,
  effective_end TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  denial_reason TEXT,
  linked_discrepancy_id UUID REFERENCES discrepancies(id),
  linked_obstruction_id UUID REFERENCES obstruction_evaluations(id),
  linked_notam_id UUID REFERENCES notams(id),
  photo_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waivers_base_id ON waivers(base_id);
CREATE INDEX idx_waivers_status ON waivers(status);
CREATE INDEX idx_waivers_waiver_type ON waivers(waiver_type);
CREATE INDEX idx_waivers_effective_end ON waivers(effective_end);

ALTER TABLE waivers DISABLE ROW LEVEL SECURITY;
