-- ============================================================
-- ICAO Annex 14 Vol I §10.5 lighting-maintenance standard — outage_rule_templates.
--
-- The third lighting standard (after DAFMAN A3.1 and FAA Part 139). Values are
-- transcribed from ICAO Annex 14 Vol I, Chapter 10 (Aerodrome Maintenance),
-- §10.5 "Visual aids" (Ed. 7, amdt 10/11/16). Source-of-record:
-- docs/references/icao-annex14-lighting-verified.md.
--
-- §10.5 defines MAINTENANCE PERFORMANCE OBJECTIVES by runway operating category,
-- not a flat per-light table and not an operational out-of-service definition
-- (§10.5, Note 1). Rows encode the CAT I / general baseline; is_cat_ii_iii
-- tightens runway_edge/threshold (->5%) and loosens end_lights (->25%) at calc
-- time via lib/outage-rules.ts resolveIcaoThreshold (Annex 14 §10.5.7). No ICAO
-- Q-code / CE / TERPS / shutoff. "No two adjacent" (§10.5.7/10.5.10) uses the
-- engine's allowable_no_adjacent; barrettes/crossbars (two-adjacent exemption)
-- ride the existing bar-group analysis.
--
-- Types §10.5 does NOT quantify (REIL, PAPI, VASI, CHAPI, beacon, wind cone,
-- obstruction/hazard, signs, taxiway edge/end, guard/clearance bars, floodlights)
-- are templated qualitatively — zero-tolerance "must be serviceable" for the
-- safety-of-flight aids (from the §10.5.7/§10.5.10 "all lights serviceable"
-- overarching objective + §10.5.2 preventive-maintenance duty), legibility for
-- signs, informational for the rest — NO fabricated percentages.
--
-- First widen the standard CHECK to admit 'icao'. Idempotent: clears any prior
-- ICAO rows so re-running is safe and leaves the dafman/faa rows untouched.
--
-- Verify after apply:
--   SELECT standard, COUNT(*) FROM outage_rule_templates GROUP BY standard;
--   -- expect: dafman = 63, faa = 24, icao = 29
-- ============================================================

ALTER TABLE outage_rule_templates DROP CONSTRAINT IF EXISTS outage_rule_templates_standard_check;
ALTER TABLE outage_rule_templates
  ADD CONSTRAINT outage_rule_templates_standard_check
  CHECK (standard IN ('dafman', 'faa', 'icao'));

DELETE FROM outage_rule_templates WHERE standard = 'icao';

INSERT INTO outage_rule_templates
  (system_type, component_type, label, allowable_outage_pct, allowable_outage_count,
   allowable_outage_consecutive, allowable_no_adjacent, allowable_outage_text,
   is_zero_tolerance, dafman_notes, requires_notam, requires_ce_notification,
   requires_system_shutoff, requires_terps_notification, requires_obstruction_notam_attrs,
   q_code, notam_text_template, sort_order, standard)
VALUES
  -- ── Quantified runway/approach objectives (§10.5.7 / .10 / .11 / .12) ──
  ('runway_edge', 'overall', 'Runway Edge Lights', 15, NULL, NULL, true,
   '15% out (85% serviceable; CAT II/III 95%) — Annex 14 §10.5.10/§10.5.7',
   false, NULL, true, false, false, false, false, NULL,
   'Runway Edge Lights below Annex 14 §10.5 objective — specify runway', 0, 'icao'),

  ('runway_centerline', 'overall', 'Runway Centre Line Lights', 5, NULL, NULL, true,
   '5% out (95% serviceable) — Annex 14 §10.5.7/§10.5.11',
   false, NULL, true, false, false, false, false, NULL,
   'Runway Centre Line Lights below Annex 14 §10.5 objective — specify runway', 0, 'icao'),

  ('threshold', 'overall', 'Runway Threshold Lights', 15, NULL, NULL, true,
   '15% out (85%; CAT II/III 95%) — Annex 14 §10.5.10/§10.5.7',
   false, NULL, true, false, false, false, false, NULL,
   'Runway Threshold Lights below Annex 14 §10.5 objective — specify runway', 0, 'icao'),

  ('end_lights', 'overall', 'Runway End Lights', 15, NULL, NULL, true,
   '15% out (85%; CAT II/III 75%) — Annex 14 §10.5.10/§10.5.7',
   false, NULL, true, false, false, false, false, NULL,
   'Runway End Lights below Annex 14 §10.5 objective — specify runway', 0, 'icao'),

  ('tdz', 'overall', 'Touchdown Zone Lights', 10, NULL, NULL, true,
   '10% out (90% serviceable) — Annex 14 §10.5.7',
   false, NULL, true, false, false, false, false, NULL,
   'Touchdown Zone Lights below Annex 14 §10.5 objective — specify runway', 0, 'icao'),

  -- Approach systems: single 'overall' at the beyond-450 m / CAT I value (85%);
  -- §10.5.7 a1 inner-450 m 95% is a documented v1 caveat (barrettes exempt).
  ('malsr', 'overall', 'Approach Lighting System (MALSR)', 15, NULL, NULL, true,
   '15% out (85%; CAT II/III inner-450 m 95% — see caveat) — §10.5.10/§10.5.7',
   false, NULL, true, false, false, false, false, NULL,
   'Approach Lighting System below Annex 14 §10.5 objective — specify runway', 0, 'icao'),
  ('sals', 'overall', 'Approach Lighting System (SALS)', 15, NULL, NULL, true,
   '15% out (85%; CAT II/III inner-450 m 95% — see caveat) — §10.5.10/§10.5.7',
   false, NULL, true, false, false, false, false, NULL,
   'Approach Lighting System below Annex 14 §10.5 objective — specify runway', 0, 'icao'),
  ('ssalr', 'overall', 'Approach Lighting System (SSALR)', 15, NULL, NULL, true,
   '15% out (85%; CAT II/III inner-450 m 95% — see caveat) — §10.5.10/§10.5.7',
   false, NULL, true, false, false, false, false, NULL,
   'Approach Lighting System below Annex 14 §10.5 objective — specify runway', 0, 'icao'),
  ('alsf1', 'overall', 'Approach Lighting System (ALSF-1)', 15, NULL, NULL, true,
   '15% out (85%; CAT II/III inner-450 m 95% — see caveat) — §10.5.10/§10.5.7',
   false, NULL, true, false, false, false, false, NULL,
   'Approach Lighting System below Annex 14 §10.5 objective — specify runway', 0, 'icao'),
  ('alsf2', 'overall', 'Approach Lighting System (ALSF-2)', 15, NULL, NULL, true,
   '15% out (85%; CAT II/III inner-450 m 95% — see caveat) — §10.5.10/§10.5.7',
   false, NULL, true, false, false, false, false, NULL,
   'Approach Lighting System below Annex 14 §10.5 objective — specify runway', 0, 'icao'),

  ('stop_bar', 'overall', 'Stop Bar Lights', NULL, 2, NULL, true,
   'No more than 2 out; no two adjacent (RVR < 350 m) — Annex 14 §10.5.8',
   false, NULL, true, false, false, false, false, NULL,
   'Stop Bar Lights below Annex 14 §10.5.8 objective — specify location', 0, 'icao'),

  ('taxiway_centerline', 'overall', 'Taxiway Centre Line Lights', NULL, NULL, NULL, true,
   'No two adjacent unserviceable (RVR < 350 m) — Annex 14 §10.5.9',
   false, NULL, true, false, false, false, false, NULL,
   'Taxiway Centre Line Lights below Annex 14 §10.5.9 objective — specify taxiway', 0, 'icao'),

  -- ── Safety-of-flight aids §10.5 does not number → zero-tolerance ──
  -- (from the §10.5.7/§10.5.10 "all approach and runway lights serviceable"
  --  overarching objective + §10.5.2 preventive maintenance).
  ('reil', 'overall', 'Runway End Identifier Lights', NULL, NULL, NULL, false,
   'All units serviceable — Annex 14 §10.5', true, NULL, true, false, false, false, false, NULL,
   'Runway End Identifier Lights unserviceable — specify runway', 0, 'icao'),
  ('papi', 'overall', 'PAPI', NULL, NULL, NULL, false,
   'All units serviceable — Annex 14 §10.5', true, NULL, true, false, false, false, false, NULL,
   'PAPI unserviceable — specify runway', 0, 'icao'),
  ('vasi', 'overall', 'VASI', NULL, NULL, NULL, false,
   'All units serviceable — Annex 14 §10.5', true, NULL, true, false, false, false, false, NULL,
   'VASI unserviceable — specify runway', 0, 'icao'),
  ('chapi', 'overall', 'CHAPI', NULL, NULL, NULL, false,
   'All units serviceable — Annex 14 §10.5', true, NULL, true, false, false, false, false, NULL,
   'CHAPI unserviceable — specify runway', 0, 'icao'),
  ('beacon', 'overall', 'Aerodrome Beacon', NULL, NULL, NULL, false,
   'Serviceable — Annex 14 §10.5.2', true, NULL, true, false, false, false, false, NULL,
   'Aerodrome Beacon unserviceable', 0, 'icao'),
  ('windcone', 'overall', 'Lighted Wind Direction Indicator', NULL, NULL, NULL, false,
   'Illuminated and serviceable — Annex 14 §10.5.2', true, NULL, true, false, false, false, false, NULL,
   'Wind Direction Indicator unserviceable — specify location', 0, 'icao'),
  ('obstruction_fixed', 'overall', 'Obstruction Lighting', NULL, NULL, NULL, false,
   'Required obstruction lights serviceable — Annex 14 §10.5.2', true, NULL, true, false, false, false, false, NULL,
   'Obstruction Light unserviceable — specify obstacle', 0, 'icao'),
  ('hazard_flashing', 'overall', 'Flashing Hazard Beacon', NULL, NULL, NULL, false,
   'Serviceable — Annex 14 §10.5.2', true, NULL, true, false, false, false, false, NULL,
   'Hazard Beacon unserviceable — specify location', 0, 'icao'),
  ('hazard_rotating', 'overall', 'Rotating Hazard Beacon', NULL, NULL, NULL, false,
   'Serviceable — Annex 14 §10.5.2', true, NULL, true, false, false, false, false, NULL,
   'Hazard Beacon unserviceable — specify location', 0, 'icao'),

  -- ── Signs — legibility/illumination, no NOTAM keyword ──
  ('signage', 'overall', 'Airfield Signage', NULL, NULL, NULL, false,
   'Legible and illuminated for night use — Annex 14 §5.4 / §10.5.2',
   true, NULL, false, false, false, false, false, NULL, NULL, 0, 'icao'),
  ('rdr_signs', 'overall', 'Runway Distance Remaining Signs', NULL, NULL, NULL, false,
   'Legible and illuminated for night use — Annex 14 §5.4 / §10.5.2',
   true, NULL, false, false, false, false, false, NULL, NULL, 0, 'icao'),

  -- ── Types §10.5 leaves unquantified → informational (no threshold) ──
  ('taxiway_edge', 'overall', 'Taxiway Edge Lights', NULL, NULL, NULL, false,
   'Maintained serviceable — Annex 14 §10.5.2 (no §10.5 count)',
   false, NULL, false, false, false, false, false, NULL, NULL, 0, 'icao'),
  ('taxiway_end', 'overall', 'Taxiway End Lights', NULL, NULL, NULL, false,
   'Maintained serviceable — Annex 14 §10.5.2', false, NULL, false, false, false, false, false, NULL, NULL, 0, 'icao'),
  ('clearance_bar', 'overall', 'Taxiway Clearance Bar Lights', NULL, NULL, NULL, false,
   'Maintained serviceable — Annex 14 §10.5.2', false, NULL, false, false, false, false, false, NULL, NULL, 0, 'icao'),
  ('elevated_guard', 'overall', 'Runway Guard Lights', NULL, NULL, NULL, false,
   'Maintained serviceable — Annex 14 §10.5.2', false, NULL, false, false, false, false, false, NULL, NULL, 0, 'icao'),
  ('inpavement_guard', 'overall', 'In-Pavement Runway Guard Lights', NULL, NULL, NULL, false,
   'Maintained serviceable — Annex 14 §10.5.2', false, NULL, false, false, false, false, false, NULL, NULL, 0, 'icao'),
  ('stadium_light', 'overall', 'Apron/Stadium Floodlights', NULL, NULL, NULL, false,
   'Operational status tracked; not an Annex 14 required aid',
   false, NULL, false, false, false, false, false, NULL, NULL, 0, 'icao');
