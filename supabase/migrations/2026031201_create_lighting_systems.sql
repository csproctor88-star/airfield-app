-- ═══════════════════════════════════════════════════════════════
-- Lighting Systems & Components — DAFMAN 13-204v2 outage tracking
-- Each system instance maps to a real installation (e.g. "ALSF-1 RWY 19")
-- Each component maps to a DAFMAN Table A3.1 row with outage thresholds
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE lighting_systems (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id             UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  system_type         TEXT NOT NULL,
  name                TEXT NOT NULL,
  runway_or_taxiway   TEXT,
  is_precision        BOOLEAN DEFAULT false,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_id, name)
);

CREATE INDEX idx_lighting_systems_base ON lighting_systems(base_id);

CREATE TABLE lighting_system_components (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id                       UUID NOT NULL REFERENCES lighting_systems(id) ON DELETE CASCADE,
  component_type                  TEXT NOT NULL,
  label                           TEXT NOT NULL,
  total_count                     INT NOT NULL DEFAULT 0,

  -- Outage rules from DAFMAN Table A3.1
  allowable_outage_pct            NUMERIC,
  allowable_outage_count          INT,
  allowable_outage_consecutive    INT,
  allowable_no_adjacent           BOOLEAN DEFAULT false,
  allowable_outage_text           TEXT,
  is_zero_tolerance               BOOLEAN DEFAULT false,

  -- Required actions (DAFMAN Notes 1-5)
  requires_notam                  BOOLEAN DEFAULT true,
  requires_ce_notification        BOOLEAN DEFAULT true,
  requires_system_shutoff         BOOLEAN DEFAULT false,
  requires_terps_notification     BOOLEAN DEFAULT false,
  requires_obstruction_notam_attrs BOOLEAN DEFAULT false,

  -- NOTAM template
  q_code                          TEXT,
  notam_text_template             TEXT,

  sort_order                      INT DEFAULT 0,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lighting_system_components_system ON lighting_system_components(system_id);

-- Add FK from infrastructure_features to components (deferred from previous migration)
ALTER TABLE infrastructure_features
  ADD CONSTRAINT fk_infrastructure_features_component
    FOREIGN KEY (system_component_id)
    REFERENCES lighting_system_components(id)
    ON DELETE SET NULL;

-- ── RLS ──
ALTER TABLE lighting_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE lighting_system_components ENABLE ROW LEVEL SECURITY;

-- lighting_systems: read access for base members, write for admins
CREATE POLICY "lighting_systems_select" ON lighting_systems
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "lighting_systems_insert" ON lighting_systems
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "lighting_systems_update" ON lighting_systems
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "lighting_systems_delete" ON lighting_systems
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

-- lighting_system_components: inherit access via parent system
CREATE POLICY "lighting_system_components_select" ON lighting_system_components
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lighting_systems ls
    WHERE ls.id = lighting_system_components.system_id
    AND user_has_base_access(auth.uid(), ls.base_id)
  ));

CREATE POLICY "lighting_system_components_insert" ON lighting_system_components
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM lighting_systems ls
    WHERE ls.id = lighting_system_components.system_id
    AND user_has_base_access(auth.uid(), ls.base_id)
    AND user_is_admin(auth.uid())
  ));

CREATE POLICY "lighting_system_components_update" ON lighting_system_components
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lighting_systems ls
    WHERE ls.id = lighting_system_components.system_id
    AND user_has_base_access(auth.uid(), ls.base_id)
    AND user_is_admin(auth.uid())
  ));

CREATE POLICY "lighting_system_components_delete" ON lighting_system_components
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lighting_systems ls
    WHERE ls.id = lighting_system_components.system_id
    AND user_has_base_access(auth.uid(), ls.base_id)
    AND user_is_admin(auth.uid())
  ));
