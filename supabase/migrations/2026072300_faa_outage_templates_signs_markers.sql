-- ============================================================
-- FAA civilian lighting outage engine — Part 2: sign / marker /
-- floodlight templates (the "89 orphan features" fix).
--
-- 2026072210 added 20 FAA outage_rule_templates rows covering every
-- lighting system type that AC 150/5340-26C Appendix A gives a numeric
-- serviceability tolerance for. Four feature types cloned onto civilian
-- bases had NO FAA template, so their features never linked to a
-- compliance component (they render on the map but show no panel):
--   signage, rdr_signs, taxiway_end, stadium_light.
--
-- These four are NOT in AC 150/5340-26C Appendix A's "Operating"
-- tolerance table — signs and distance-remaining markers are legibility /
-- illumination items under 14 CFR 139.311 (not lamp-count systems), and
-- apron/stadium floodlighting is not a 139.311-mandated maintenance item
-- at all. Per the no-fabricated-regs rule we do NOT invent a percentage
-- threshold for any of them. Instead:
--   • signage / rdr_signs / taxiway_end — zero-tolerance qualitative
--     "must be legible / illuminated / maintained" items citing
--     14 CFR 139.311. No NOTAM keyword (signs are not individually
--     NOTAM'd; JO 7930.2U 5-2-1 lists no sign/marker keyword), no
--     Q-code, no CE/TERPS/shutoff.
--   • stadium_light — informational status only. Not a 139.311 required
--     item, so NO regulatory cite and NO NOTAM; the engine tracks
--     operational/inoperative counts (degraded at most, never a
--     compliance violation).
--
-- Source-of-record: docs/references/faa-lighting-outage-verified.md.
--
-- Idempotent: clears only these four FAA system types before insert, so
-- re-running this file is safe and does NOT disturb 2026072210's 20 rows.
--
-- Verify after apply:
--   SELECT standard, COUNT(*) FROM outage_rule_templates GROUP BY standard;
--   -- expect: dafman = 63 (pre-existing), faa = 24 (20 + these 4)
--   SELECT system_type, is_zero_tolerance, requires_notam, allowable_outage_text
--     FROM outage_rule_templates
--    WHERE standard = 'faa'
--      AND system_type IN ('signage','rdr_signs','taxiway_end','stadium_light')
--    ORDER BY system_type;
-- ============================================================

DELETE FROM outage_rule_templates
 WHERE standard = 'faa'
   AND system_type IN ('signage', 'rdr_signs', 'taxiway_end', 'stadium_light');

INSERT INTO outage_rule_templates
  (system_type, component_type, label, allowable_outage_pct, allowable_outage_count,
   allowable_outage_consecutive, allowable_no_adjacent, allowable_outage_text,
   is_zero_tolerance, dafman_notes, requires_notam, requires_ce_notification,
   requires_system_shutoff, requires_terps_notification, requires_obstruction_notam_attrs,
   q_code, notam_text_template, sort_order, standard)
VALUES
  -- Airfield signage — legibility/illumination item (14 CFR 139.311), no NOTAM
  ('signage', 'overall', 'Airfield Signage', NULL, NULL, NULL, false,
   'Signs must be legible and illuminated for night use (14 CFR 139.311)',
   true, NULL, false, false, false, false, false,
   NULL, NULL, 0, 'faa'),

  -- Runway distance-remaining signs — legibility/illumination item, no NOTAM
  ('rdr_signs', 'overall', 'Runway Distance Remaining Signs', NULL, NULL, NULL, false,
   'Distance-remaining signs must be legible and illuminated for night use (14 CFR 139.311)',
   true, NULL, false, false, false, false, false,
   NULL, NULL, 0, 'faa'),

  -- Taxiway end lights — maintained item (14 CFR 139.311), no verified NOTAM keyword
  ('taxiway_end', 'overall', 'Taxiway End Lights', NULL, NULL, NULL, false,
   'Taxiway end lights must be maintained in operating condition (14 CFR 139.311)',
   true, NULL, false, false, false, false, false,
   NULL, NULL, 0, 'faa'),

  -- Stadium/apron floodlights — informational only; not a 14 CFR 139.311 item
  ('stadium_light', 'overall', 'Stadium/Apron Floodlights', NULL, NULL, NULL, false,
   'Operational status tracked; not a 14 CFR 139.311 required item — no NOTAM',
   false, NULL, false, false, false, false, false,
   NULL, NULL, 0, 'faa');
