-- ═══════════════════════════════════════════════════════════════
-- Stadium Light system template — tracking only, no DAFMAN limits
-- ═══════════════════════════════════════════════════════════════

INSERT INTO outage_rule_templates (
  system_type, component_type, label,
  allowable_outage_text,
  dafman_notes, requires_notam, requires_ce_notification,
  requires_system_shutoff, sort_order
) VALUES
('stadium_light', 'overall', 'Stadium Lights',
  'No max — tracking only',
  '2', false, true, false, 0);
