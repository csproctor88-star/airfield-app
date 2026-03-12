-- ═══════════════════════════════════════════════════════════════
-- Add sign sub-type component templates for airfield signage
-- Mandatory, Location, Directional, Informational each have
-- different outage reporting requirements per DAFMAN 13-204v2
-- ═══════════════════════════════════════════════════════════════

-- Replace the single "overall" signage template with sub-types
DELETE FROM outage_rule_templates WHERE system_type = 'signage';

INSERT INTO outage_rule_templates (
  system_type, component_type, label,
  is_zero_tolerance, allowable_outage_text,
  dafman_notes, requires_notam, requires_ce_notification,
  requires_system_shutoff, q_code, notam_text_template, sort_order
) VALUES
-- Overall system threshold
('signage', 'overall', 'Overall System',
  false, 'Must be legible; illuminated for night use',
  '1,2', true, true, false, NULL, NULL, 0),

-- Mandatory signs (red background, white text) — zero tolerance
-- Mandatory instruction signs must be operational at all times
('signage', 'mandatory', 'Mandatory Signs',
  true, 'None — zero tolerance',
  '1,2', true, true, false, 'QIDAS', 'Mandatory Sign (Specify Location) Unserviceable', 1),

-- Location signs (yellow on black, no arrows) — report when inoperative
('signage', 'location', 'Location Signs',
  false, 'Report when inoperative',
  '1,2', true, true, false, NULL, NULL, 2),

-- Directional signs (black on yellow with arrows) — report when inoperative
('signage', 'directional', 'Directional Signs',
  false, 'Report when inoperative',
  '1,2', true, true, false, NULL, NULL, 3),

-- Informational signs — report when inoperative
('signage', 'informational', 'Informational Signs',
  false, 'Report when inoperative',
  '1', true, false, false, NULL, NULL, 4);
