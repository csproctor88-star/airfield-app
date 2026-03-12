-- ═══════════════════════════════════════════════════════════════
-- Outage Rule Templates — DAFMAN 13-204v2 Table A3.1
-- These are template definitions used when setting up systems.
-- When an admin creates a lighting system, component rules are
-- cloned from these templates with base-specific total_count values.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE outage_rule_templates (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_type                     TEXT NOT NULL,
  component_type                  TEXT NOT NULL,
  label                           TEXT NOT NULL,

  -- DAFMAN outage thresholds
  allowable_outage_pct            NUMERIC,
  allowable_outage_count          INT,
  allowable_outage_consecutive    INT,
  allowable_no_adjacent           BOOLEAN DEFAULT false,
  allowable_outage_text           TEXT,
  is_zero_tolerance               BOOLEAN DEFAULT false,

  -- Required actions (DAFMAN Notes)
  dafman_notes                    TEXT,
  requires_notam                  BOOLEAN DEFAULT true,
  requires_ce_notification        BOOLEAN DEFAULT true,
  requires_system_shutoff         BOOLEAN DEFAULT false,
  requires_terps_notification     BOOLEAN DEFAULT false,
  requires_obstruction_notam_attrs BOOLEAN DEFAULT false,

  -- NOTAM
  q_code                          TEXT,
  notam_text_template             TEXT,

  sort_order                      INT DEFAULT 0
);

-- No RLS needed — these are global reference data, read-only
ALTER TABLE outage_rule_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outage_rule_templates_select" ON outage_rule_templates
  FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA — DAFMAN 13-204v2 Table A3.1
-- ═══════════════════════════════════════════════════════════════

-- ── ALSF-1 ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('alsf1', 'overall', 'Overall System', 15, '15%', '1,2,3,4', true, true, 'QLAAS', 'Approach Lighting System ALSF-1 (Specify Runway) Unserviceable', 0),
('alsf1', 'pre_threshold', 'Pre-Threshold', 20, '20%', '1,2', false, false, NULL, NULL, 1),
('alsf1', 'terminating_bar', 'Terminating Bar', 35, '35%', '1,2', false, false, NULL, NULL, 2),
('alsf1', '1000ft_bar', '1,000 Foot Bar', 35, '35%', '1,2', false, false, NULL, NULL, 3),
('alsf1', 'centerline_bar', 'Centerline Light Bar', 10, '10% or 3 barrettes out (5 lamp bar is considered out when 3+ lamps are out)', '1,2', false, false, NULL, NULL, 4),
('alsf1', 'sfls', 'Sequenced Flashing Lights', 20, '20%', '1,2,4', false, true, NULL, NULL, 5);

UPDATE outage_rule_templates SET allowable_outage_count = 3 WHERE system_type = 'alsf1' AND component_type = 'centerline_bar';

-- ── ALSF-2 ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('alsf2', 'overall', 'Overall System', 15, '15%', '1,2,3,4', true, true, 'QLAAS', 'Approach Lighting System ALSF-2 (Specify Runway) Unserviceable', 0),
('alsf2', '500ft_bar', '500 Foot Bar', 20, '20%', '1,2', false, false, NULL, NULL, 1),
('alsf2', '1000ft_bar', '1,000 Foot Bar', 20, '20%', '1,2', false, false, NULL, NULL, 2),
('alsf2', 'side_row', 'Side Row Lights', 20, '20%', '1,2', false, false, NULL, NULL, 3),
('alsf2', 'centerline_inner', 'Centerline Light Bar Inner 1500ft', 20, '20% or 3 barrettes out', '1,2', false, false, NULL, NULL, 4),
('alsf2', 'centerline_outer', 'Centerline Light Bar Outer 1500ft', 20, '20% or 3 barrettes out', '1,2', false, false, NULL, NULL, 5),
('alsf2', 'sfls', 'Sequenced Flashing Lights', 20, '20%', '1,2,4', false, true, NULL, NULL, 6);

UPDATE outage_rule_templates SET allowable_outage_count = 3 WHERE system_type = 'alsf2' AND component_type IN ('centerline_inner', 'centerline_outer');

-- ── SSALR ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('ssalr', 'overall', 'Overall System', 15, '15%', '1,2,3,4', true, true, 'QLAAS', 'Approach Lighting System SSALR (Specify Runway) Unserviceable', 0),
('ssalr', '1000ft_bar', '1,000 Foot Bar', 30, '30%', '1,2', false, false, NULL, NULL, 1),
('ssalr', 'centerline_bar', 'Centerline Light Bar', 20, '20% or 1 barrette out', '1,2', false, false, NULL, NULL, 2),
('ssalr', 'rails', 'RAILs', 20, '20%', '1,2,4', false, true, NULL, NULL, 3);

UPDATE outage_rule_templates SET allowable_outage_count = 1 WHERE system_type = 'ssalr' AND component_type = 'centerline_bar';

-- ── MALSR ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('malsr', 'overall', 'Overall System', 15, '15%', '1,2,3,4', true, true, 'QLAAS', 'Approach Lighting System MALSR (Specify Runway) Unserviceable', 0),
('malsr', '1000ft_bar', '1,000 Foot Bar', 30, '30%', '1,2', false, false, NULL, NULL, 1),
('malsr', 'centerline_bar', 'Centerline Light Bar', 20, '20% or 1 barrette out', '1,2', false, false, NULL, NULL, 2),
('malsr', 'rails', 'RAILs', 20, '20%', '1,2,4', false, true, NULL, NULL, 3);

UPDATE outage_rule_templates SET allowable_outage_count = 1 WHERE system_type = 'malsr' AND component_type = 'centerline_bar';

-- ── SALS ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, q_code, notam_text_template, sort_order) VALUES
('sals', 'overall', 'Overall System', 15, '15%', '1,2,3', true, 'QLAAS', 'Approach Lighting System SALS (Specify Runway) Unserviceable', 0),
('sals', 'pre_threshold', 'Pre-Threshold', 20, '20%', '1,2', false, NULL, NULL, 1),
('sals', 'terminating_bar', 'Terminating Bar', 35, '35%', '1,2', false, NULL, NULL, 2),
('sals', '1000ft_bar', '1,000 Foot Bar', 30, '30%', '1,2', false, NULL, NULL, 3),
('sals', 'centerline_bar', 'Centerline Light Bar', 20, '20% or 2 barrettes out', '1,2', false, NULL, NULL, 4);

UPDATE outage_rule_templates SET allowable_outage_count = 2 WHERE system_type = 'sals' AND component_type = 'centerline_bar';

-- ── REIL ──
INSERT INTO outage_rule_templates (system_type, component_type, label, is_zero_tolerance, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('reil', 'overall', 'REIL', true, 'None', '1,2,3,4', true, true, 'QLRAS', 'Runway End Identifier Lights (Specify Runway) Unserviceable', 0);

-- ── Threshold Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('threshold', 'overall_vfr', 'Overall (VFR/Non-Precision)', 25, '25%', '1,2,3,4', true, true, 'QLTAS', 'Threshold Lights (Specify Runway) Unserviceable', 0),
('threshold', 'overall_precision', 'Overall (Precision)', 10, '10%', '1,2,3,4', true, true, 'QLTAS', 'Threshold Lights (Specify Runway) Unserviceable', 1);

-- ── End Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, q_code, notam_text_template, sort_order) VALUES
('end_lights', 'overall', 'End Lights', 25, '25%', '1,2,3', true, 'QLEAS', 'Runway End Lights (Specify Runway) Unserviceable', 0);

-- ── Runway Edge Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('runway_edge', 'overall', 'Runway Edge Lights', 15, '15%', '1,2,3,4', true, true, 'QLEAS', 'Runway Edge Lights (Specify Runway) Unserviceable', 0);

-- ── Runway Centerline Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_consecutive, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('runway_centerline', 'overall', 'Runway Centerline Lights', 10, 4, '10% or 4 consecutive', '1,2,3,4', true, true, 'QLCAS', 'Runway Centerline Lights (Specify Runway) Unserviceable', 0);

-- ── Touchdown Zone Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_no_adjacent, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('tdz', 'overall', 'Touchdown Zone Lights', 10, true, '10% on either side or 2 adjacent bars', '1,2,3,4', true, true, 'QLDAS', 'Touchdown Zone Lights (Specify Runway) Unserviceable', 0);

-- ── RDR Signs ──
INSERT INTO outage_rule_templates (system_type, component_type, label, is_zero_tolerance, allowable_outage_text, dafman_notes, q_code, notam_text_template, sort_order) VALUES
('rdr_signs', 'overall', 'RDR Signs (Lighted)', true, 'None', '1,2', NULL, NULL, 0);

-- ── Taxiway Edge Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, q_code, notam_text_template, sort_order) VALUES
('taxiway_edge', 'overall', 'Taxiway Edge Lights', 15, '15%', '1,2,3', true, 'QLTAS', 'Taxiway Edge Lights (Specify Taxiway) Unserviceable', 0);

-- ── Taxiway Centerline Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_text, dafman_notes, requires_system_shutoff, requires_terps_notification, q_code, notam_text_template, sort_order) VALUES
('taxiway_centerline', 'overall', 'Taxiway Centerline Lights', 10, '10% (CAT III: denies ops below RVR 600)', '1,2,3,4', true, true, 'QLTAS', 'Taxiway Centerline Lights (Specify Taxiway) Unserviceable', 0);

-- ── Taxiway End Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, is_zero_tolerance, allowable_outage_text, dafman_notes, q_code, notam_text_template, sort_order) VALUES
('taxiway_end', 'overall', 'Taxiway End Lights', true, 'None', '1,2', NULL, NULL, 0);

-- ── Elevated Runway Guard Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_count, allowable_outage_text, dafman_notes, requires_system_shutoff, q_code, notam_text_template, sort_order) VALUES
('elevated_guard', 'overall', 'Elevated Runway Guard Lights', 1, '1 lamp out', '1,2,3', true, 'QLGAS', 'Runway Guard Lights (Specify Location) Unserviceable', 0);

-- ── In-Pavement Runway Guard Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_count, allowable_outage_text, dafman_notes, requires_system_shutoff, q_code, notam_text_template, sort_order) VALUES
('inpavement_guard', 'overall', 'In-Pavement Runway Guard Lights', 3, '3 lamps out per location', '1,2,3', true, 'QLGAS', 'In-Pavement Runway Guard Lights (Specify Location) Unserviceable', 0);

-- ── Stop Bar Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_count, allowable_outage_text, dafman_notes, requires_system_shutoff, q_code, notam_text_template, sort_order) VALUES
('stop_bar', 'overall', 'Stop Bar Lights', 3, '3 lamps out per location', '1,2,3', true, 'QLGAS', 'Stop Bar Lights (Specify Location) Unserviceable', 0);

-- ── Taxiway Clearance Bar Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_count, allowable_outage_text, dafman_notes, q_code, notam_text_template, sort_order) VALUES
('clearance_bar', 'overall', 'Taxiway Clearance Bar Lights', 1, '1 lamp out', '1,2', NULL, NULL, 0);

-- ── PAPI ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_count, allowable_outage_text, dafman_notes, requires_system_shutoff, q_code, notam_text_template, sort_order) VALUES
('papi', 'overall', 'PAPI', 1, '1 light per box', '1,2,3', true, 'QLPAS', 'PAPI (Specify Runway) Unserviceable', 0);

-- ── CHAPI ──
INSERT INTO outage_rule_templates (system_type, component_type, label, is_zero_tolerance, allowable_outage_text, dafman_notes, requires_system_shutoff, q_code, notam_text_template, sort_order) VALUES
('chapi', 'overall', 'CHAPI', true, 'None', '1,2,3', true, 'QLPAS', 'CHAPI (Specify Runway) Unserviceable', 0);

-- ── Rotating Beacon ──
INSERT INTO outage_rule_templates (system_type, component_type, label, is_zero_tolerance, allowable_outage_text, dafman_notes, q_code, notam_text_template, sort_order) VALUES
('beacon', 'overall', 'Rotating Beacon', true, 'None', '1,2', 'QLBAS', 'Aerodrome Beacon Unserviceable', 0);

-- ── Fixed Obstruction Lights ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_count, allowable_outage_text, dafman_notes, requires_obstruction_notam_attrs, q_code, notam_text_template, sort_order) VALUES
('obstruction_fixed', 'single_globe', 'Fixed Obstruction Light (Single Globe)', 0, 'None (single globe)', '1,2,5', true, 'QLOAS', 'Obstruction Light (Specify Location) Unserviceable', 0),
('obstruction_fixed', 'double_globe', 'Fixed Obstruction Light (Double Globe)', 1, '1 lamp (double globe)', '1,2,5', true, 'QLOAS', 'Obstruction Light (Specify Location) Unserviceable', 1);

UPDATE outage_rule_templates SET is_zero_tolerance = true WHERE system_type = 'obstruction_fixed' AND component_type = 'single_globe';

-- ── Flashing Hazard Beacon ──
INSERT INTO outage_rule_templates (system_type, component_type, label, is_zero_tolerance, allowable_outage_text, dafman_notes, requires_obstruction_notam_attrs, q_code, notam_text_template, sort_order) VALUES
('hazard_flash', 'overall', 'Flashing Hazard Beacon', true, 'None', '1,2,5', true, 'QLOAS', 'Hazard Beacon (Specify Location) Unserviceable', 0);

-- ── Rotating Hazard Beacon ──
INSERT INTO outage_rule_templates (system_type, component_type, label, is_zero_tolerance, allowable_outage_text, dafman_notes, requires_obstruction_notam_attrs, q_code, notam_text_template, sort_order) VALUES
('hazard_rotating', 'overall', 'Rotating Hazard Beacon', true, 'None', '1,2,5', true, 'QLOAS', 'Hazard Beacon (Specify Location) Unserviceable', 0);

-- ── Wind Cone ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_text, dafman_notes, q_code, notam_text_template, sort_order) VALUES
('windcone', 'overall', 'Wind Cone', 'Must be illuminated for night use; must rotate freely', '1,2', 'QLWAS', 'Wind Direction Indicator (Specify Location) Unserviceable', 0);

-- ── Airfield Signage ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_text, dafman_notes, q_code, notam_text_template, sort_order) VALUES
('signage', 'overall', 'Airfield Signage', 'Must be legible; illuminated for night use', '1,2', NULL, NULL, 0);

-- ── EALS (Emergency Airfield Lighting) ──
INSERT INTO outage_rule_templates (system_type, component_type, label, allowable_outage_pct, allowable_outage_count, allowable_no_adjacent, allowable_outage_text, dafman_notes, requires_system_shutoff, q_code, notam_text_template, sort_order) VALUES
('eals', 'approach', 'EALS Approach Lights', 25, NULL, true, '25%; no 2 consecutive in same bar; 1 flasher', '1,2,3', true, 'QLAAS', 'Emergency Airfield Lighting Approach (Specify Runway) Unserviceable', 0),
('eals', 'threshold', 'EALS Threshold', NULL, NULL, false, 'None', '1,2,3', true, NULL, NULL, 1),
('eals', 'end_lights', 'EALS End Lights', NULL, 1, false, '1 lamp', '1,2,3', true, NULL, NULL, 2),
('eals', 'runway_edge', 'EALS Runway Edge Lights', 15, NULL, false, '15%', '1,2,3', true, NULL, NULL, 3),
('eals', 'papi', 'EALS PAPI', NULL, NULL, false, 'None', '1,2,3', true, NULL, NULL, 4),
('eals', 'taxiway_edge', 'EALS Taxiway Edge Lights', 15, NULL, false, '15%', '1,2,3', true, NULL, NULL, 5),
('eals', 'obstruction', 'EALS Obstruction Lights', NULL, NULL, false, 'None', '1,2,5', true, NULL, NULL, 6);

UPDATE outage_rule_templates SET is_zero_tolerance = true WHERE system_type = 'eals' AND component_type IN ('threshold', 'papi', 'obstruction');
