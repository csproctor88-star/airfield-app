-- ============================================================
-- FAA civilian lighting outage engine — Part 1: outage_rule_templates.
--
-- The Visual NAVAID outage engine reads per-component thresholds from
-- lighting_system_components, which are cloned from outage_rule_templates
-- at setup (lib/supabase/lighting-systems.ts cloneComponentsFromTemplates).
-- Until now every template encoded the USAF DAFMAN 13-204v2 Table A3.1
-- standard. This adds a `standard` discriminator and a parallel set of
-- FAA Part 139 templates so civilian (faa_part139) bases clone FAA rules.
--
-- FAA values are transcribed from AC 150/5340-26C Appendix A (Table A-8/
-- A-7/A-6/A-5/A-2..A-4 "Operating" tolerances) and the NOTAM keywords from
-- FAA Order JO 7930.2U 5-2-1. Mandate: 14 CFR 139.311. Source-of-record:
-- docs/references/faa-lighting-outage-verified.md. No fabricated values.
--
-- FAA differs from DAFMAN: NOTAM keyword instead of ICAO Q-code (q_code
-- NULL); no CE/TERPS notification or system-shutoff (military ops); no
-- barrette/consecutive/adjacent constructs (dropped to NULL/false); a few
-- thresholds differ (centerline 5% vs 10%).
--
-- Verify after apply:
--   SELECT standard, COUNT(*) FROM outage_rule_templates GROUP BY standard;
--   -- expect: dafman = 63 (pre-existing), faa = 21
-- ============================================================

ALTER TABLE outage_rule_templates
  ADD COLUMN IF NOT EXISTS standard TEXT NOT NULL DEFAULT 'dafman'
  CHECK (standard IN ('dafman', 'faa'));

-- Existing rows are the DAFMAN set (default already applies; explicit for clarity).
UPDATE outage_rule_templates SET standard = 'dafman' WHERE standard IS NULL;

-- Idempotent: clear any prior FAA rows so re-running this file is safe.
DELETE FROM outage_rule_templates WHERE standard = 'faa';

INSERT INTO outage_rule_templates
  (system_type, component_type, label, allowable_outage_pct, allowable_outage_count,
   allowable_outage_consecutive, allowable_no_adjacent, allowable_outage_text,
   is_zero_tolerance, dafman_notes, requires_notam, requires_ce_notification,
   requires_system_shutoff, requires_terps_notification, requires_obstruction_notam_attrs,
   q_code, notam_text_template, sort_order, standard)
VALUES
  -- Runway lighting (AC 150/5340-26C Table A-8) ------------------------------
  ('runway_edge', 'overall', 'Runway Edge Lights', 15, NULL, NULL, false,
   '15% out (85% must be on; CAT II/III runways require 95% serviceable)',
   false, NULL, true, false, false, false, false,
   NULL, 'Runway Edge Lights (REDL) — specify runway — U/S', 0, 'faa'),

  ('runway_centerline', 'overall', 'Runway Centerline Lights', 5, NULL, NULL, false,
   '5% out (95% serviceable)',
   false, NULL, true, false, false, false, false,
   NULL, 'Runway Centerline Lights (RCLL) — specify runway — U/S', 0, 'faa'),

  ('threshold', 'overall_vfr', 'Threshold Lights', 25, NULL, NULL, false,
   '25% out (75% on; VFR & non-precision IFR runways)',
   false, NULL, true, false, false, false, false,
   NULL, 'Runway Threshold Lights (RTHL) — specify runway — U/S', 0, 'faa'),

  ('end_lights', 'overall', 'Runway End Lights', 25, NULL, NULL, false,
   '25% out (75% on)',
   false, NULL, true, false, false, false, false,
   NULL, 'Runway End Lights (RENL) — specify runway — U/S', 0, 'faa'),

  ('tdz', 'overall', 'Touchdown Zone Lights', 10, NULL, NULL, false,
   '10% out (90% serviceable)',
   false, NULL, true, false, false, false, false,
   NULL, 'Touchdown Zone Lights (RTZL) — specify runway — U/S', 0, 'faa'),

  -- Taxiway lighting (Table A-8) --------------------------------------------
  ('taxiway_edge', 'overall', 'Taxiway Edge Lights', 15, NULL, NULL, false,
   '15% out (85% on; CAT III taxi routes stricter)',
   false, NULL, true, false, false, false, false,
   NULL, 'Taxiway Edge Lights — specify taxiway — U/S (NOTAM keyword TWY)', 0, 'faa'),

  ('taxiway_centerline', 'overall', 'Taxiway Centerline Lights', 10, NULL, NULL, false,
   '10% out (90% on; CAT III taxi routes stricter)',
   false, NULL, true, false, false, false, false,
   NULL, 'Taxiway Centerline Lights — specify taxiway — U/S (NOTAM keyword TWY)', 0, 'faa'),

  ('elevated_guard', 'overall', 'Elevated Runway Guard Lights', NULL, 1, NULL, false,
   'More than one light out in a fixture',
   false, NULL, true, false, false, false, false,
   NULL, 'Runway Guard Lights — specify location — U/S (NOTAM keyword TWY)', 0, 'faa'),

  ('stop_bar', 'overall', 'Stop Bar Lights', NULL, 1, NULL, false,
   'More than one light out',
   false, NULL, true, false, false, false, false,
   NULL, 'Stop Bar Lights — specify location — U/S (NOTAM keyword TWY)', 0, 'faa'),

  -- Visual approach slope (Table A-7 / A-6) ---------------------------------
  ('papi', 'overall', 'PAPI', NULL, 1, NULL, false,
   'More than one lamp out per box',
   false, NULL, true, false, false, false, false,
   NULL, 'PAPI — specify runway — U/S', 0, 'faa'),

  ('vasi', 'overall', 'VASI', NULL, 1, NULL, false,
   'More than one lamp out per box',
   false, NULL, true, false, false, false, false,
   NULL, 'VASI — specify runway — U/S', 0, 'faa'),

  -- Runway end identifier (Table A-5: all units must operate) ---------------
  ('reil', 'overall', 'REIL', NULL, NULL, NULL, false,
   'Any unit out (all must operate)',
   true, NULL, true, false, false, false, false,
   NULL, 'Runway End Identifier Lights (RWY END ID LGT / REIL) — specify runway — U/S', 0, 'faa'),

  -- Approach lighting systems (Table A-2: 15% lamps out) --------------------
  -- FAA treats an ALS as a single serviceability figure (no barrette split).
  ('malsr', 'overall', 'Approach Lighting System (MALSR)', 15, NULL, NULL, false,
   '15% lamps out', false, NULL, true, false, false, false, false,
   NULL, 'Approach Lighting System (ALS) — specify runway — U/S', 0, 'faa'),
  ('sals', 'overall', 'Approach Lighting System (SALS)', 15, NULL, NULL, false,
   '15% lamps out', false, NULL, true, false, false, false, false,
   NULL, 'Approach Lighting System (ALS) — specify runway — U/S', 0, 'faa'),
  ('ssalr', 'overall', 'Approach Lighting System (SSALR)', 15, NULL, NULL, false,
   '15% lamps out', false, NULL, true, false, false, false, false,
   NULL, 'Approach Lighting System (ALS) — specify runway — U/S', 0, 'faa'),
  ('alsf1', 'overall', 'Approach Lighting System (ALSF-1)', 15, NULL, NULL, false,
   '15% lamps out', false, NULL, true, false, false, false, false,
   NULL, 'Approach Lighting System (ALS) — specify runway — U/S', 0, 'faa'),
  ('alsf2', 'overall', 'Approach Lighting System (ALSF-2)', 15, NULL, NULL, false,
   '15% lamps out', false, NULL, true, false, false, false, false,
   NULL, 'Approach Lighting System (ALS) — specify runway — U/S', 0, 'faa'),

  -- Beacon (Table A-1: operational or U/S) ----------------------------------
  ('beacon', 'overall', 'Airport Rotating Beacon', NULL, NULL, NULL, false,
   'Beacon inoperative',
   true, NULL, true, false, false, false, false,
   NULL, 'Aerodrome Beacon U/S', 0, 'faa'),

  -- Obstruction lighting (14 CFR 139.311(c)(5); 7930.2U 5-2-1 obstacle) -----
  ('obstruction_fixed', 'overall', 'Obstruction Lighting', NULL, NULL, NULL, false,
   'Any required obstruction light out',
   true, NULL, true, false, false, false, false,
   NULL, 'OBST LGT — specify obstacle — U/S', 0, 'faa'),

  -- Wind cone (lighted for night use per AC 150/5345-27) --------------------
  ('windcone', 'overall', 'Lighted Wind Cone', NULL, NULL, NULL, false,
   'Must be illuminated for night use and rotate freely',
   true, NULL, true, false, false, false, false,
   NULL, 'Wind Direction Indicator — specify location — U/S', 0, 'faa');
