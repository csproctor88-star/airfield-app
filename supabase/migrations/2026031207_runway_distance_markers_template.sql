-- ═══════════════════════════════════════════════════════════════
-- Runway Distance Markers system template
-- Must be legible; illuminated for night use per DAFMAN 13-204v2
-- ═══════════════════════════════════════════════════════════════

INSERT INTO outage_rule_templates (
  system_type, component_type, label,
  allowable_outage_text,
  dafman_notes, requires_notam, requires_ce_notification,
  requires_system_shutoff, q_code, notam_text_template, sort_order
) VALUES
('runway_distance_markers', 'overall', 'Runway Distance Markers',
  'Must be legible; illuminated for night use',
  '1,2', true, true, false, NULL, 'Runway Distance Remaining Markers (Specify Runway) Unserviceable', 0);
