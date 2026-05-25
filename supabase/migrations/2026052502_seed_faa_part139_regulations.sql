-- ============================================================
-- Phase 1.3 — Seed FAA Part 139 reference regulations
--
-- Adds the 22 FAA documents the Part 139 plan calls for, plus
-- upgrades a handful of existing entries to source='both' where
-- they apply to both USAF and civilian airports.
--
-- Existing rows (e.g. '14 CFR Part 139', 'FAA AC 150/5300-13')
-- are upserted via ON CONFLICT — their `source` is forced to 'faa'
-- (or 'both' where indicated) without disturbing other metadata.
--
-- PDF urls are populated where the FAA documentLibrary path is
-- known/stable. Others are NULL — the user uploads the PDF and
-- updates the row separately (parallel work, not blocking the
-- build).
--
-- Categories map to the existing `category` enum used elsewhere in
-- the table. `source_section` reuses the existing 12-bucket scheme
-- (core / I / II / ... / VII-C). FAA regs cluster under II, IV,
-- VI-A, VI-B, VI-C.
-- ============================================================

INSERT INTO regulations
  (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags, source)
VALUES

-- ── Tier 1: required for Phase 1/2 launch ──────────────────────────

('14 CFR §139.401-415',
 'Part 139 Safety Management Systems (Final Rule)',
 'FAA SMS Final Rule for certificated airports (published 2023). Requires Class I airports to implement an SMS by Dec 2024, Class II/III on phased timeline. Mandates accountable executive, safety risk management process, safety assurance, and safety promotion.',
 'Feb 2023',
 'https://www.federalregister.gov/documents/2023/02/23/2023-03597/airport-safety-management-system',
 'II', NULL, 'safety', 'CFR', false, false, false,
 ARRAY['SMS', 'Part 139 Subpart E', 'final rule', 'accountable executive', 'safety risk management'],
 'faa'),

('FAA AC 150/5200-18C',
 'Airport Safety Self-Inspection',
 'Daily, after-phenomenon, post-incident, and periodic continuous-surveillance self-inspection program required by §139.327. Defines checklist content, recordkeeping format, and required retention period (12 months).',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5200-18C.pdf',
 'II', NULL, 'safety', 'FAA', false, false, false,
 ARRAY['self-inspection', '§139.327', 'daily inspection', 'checklist', 'recordkeeping'],
 'faa'),

('FAA AC 150/5200-37A',
 'Introduction to Safety Management Systems for Airports',
 'Older guidance preceding the §139.401-415 Final Rule. Frames the four SMS pillars (Policy / Risk Management / Assurance / Promotion) and provides example risk matrices, hazard identification methods, and SPI templates.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_150-5200-37A.pdf',
 'II', NULL, 'safety', 'FAA', false, false, false,
 ARRAY['SMS', 'four pillars', 'risk matrix', 'hazard identification', 'SPI'],
 'faa'),

('FAA AC 150/5200-31C',
 'Airport Emergency Plan',
 'Required AEP components under §139.325 (Class I, II, III): command/control, communications, alert/notification, ARFF, mass casualty, hazmat, bomb, hijack, water rescue, severe weather, fuel/crash, power failure, sabotage, disabled aircraft. Triennial full-scale exercise.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5200-31C.pdf',
 'II', NULL, 'emergency', 'FAA', false, false, false,
 ARRAY['AEP', 'emergency plan', '§139.325', 'triennial exercise', 'mass casualty'],
 'faa'),

('FAA AC 150/5200-32B',
 'Reporting Wildlife Aircraft Strikes',
 'Strike-reporting protocol to the FAA Wildlife Strike Database. Recommended for all aircraft strikes; required reporting elements; species identification standards.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5200-32B.pdf',
 'VI-A', NULL, 'bash_wildlife', 'FAA', false, false, false,
 ARRAY['wildlife strikes', 'FAA Wildlife Strike Database', 'species identification', '§139.337'],
 'faa'),

('FAA AC 150/5200-33C',
 'Hazardous Wildlife Attractants On or Near Airports',
 'Land-use separation distances (5,000 ft for piston, 10,000 ft for turbine, 5 sm perimeter) and best practices for managing wildlife attractants. Companion to §139.337 Wildlife Hazard Management.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5200-33C.pdf',
 'VI-A', NULL, 'bash_wildlife', 'FAA', false, false, false,
 ARRAY['wildlife', 'land use', 'attractants', 'separation distances', '§139.337'],
 'faa'),

-- ── Tier 2: required for Phase 3 ──────────────────────────

('FAA AC 150/5200-30D',
 'Airport Field Condition Assessments and Winter Operations Safety',
 'TALPA / FICON runway condition reporting matrix. Translates contaminant type, depth, and coverage into RwyCC values (6 down to 1) for pilot braking-action assessment. Companion to §139.313 Snow & Ice Control.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5200-30D.pdf',
 'II', NULL, 'safety', 'FAA', false, false, false,
 ARRAY['TALPA', 'FICON', 'RwyCC', 'winter ops', 'runway condition', '§139.313'],
 'faa'),

('FAA AC 150/5210-20A',
 'Ground Vehicle Operations to include Driver Training Programs on Airports',
 'Ground vehicle access, escort, and driver-training requirements. Companion to §139.329 Pedestrians and Ground Vehicles.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5210_20A.pdf',
 'II', NULL, 'driving', 'FAA', false, false, false,
 ARRAY['ground vehicles', 'driver training', '§139.329', 'AOA access'],
 'faa'),

('FAA AC 150/5210-19A',
 'Driver''s Enhanced Vision System (DEVS)',
 'Driver enhanced-vision equipment guidance for ground vehicles operating on runways and movement areas in low-visibility conditions.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5210-19A.pdf',
 'II', NULL, 'driving', 'FAA', false, false, false,
 ARRAY['DEVS', 'low visibility', 'driver vision', 'ground vehicles'],
 'faa'),

('FAA AC 150/5210-7D',
 'Aircraft Rescue and Firefighting Communications',
 'ARFF communications requirements: dispatch, response, frequencies, mutual aid coordination.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5210_7D.pdf',
 'II', NULL, 'emergency', 'FAA', false, false, false,
 ARRAY['ARFF', 'communications', 'dispatch', 'mutual aid'],
 'faa'),

('FAA AC 150/5210-13C',
 'Airport Water Rescue Plans and Equipment',
 'Required components of an airport water rescue plan, equipment standards, and personnel training. Triggered for airports adjacent to large bodies of water.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5210_13C.pdf',
 'II', NULL, 'emergency', 'FAA', false, false, false,
 ARRAY['water rescue', 'AEP', 'equipment', 'training'],
 'faa'),

('FAA AC 150/5370-2G',
 'Operational Safety on Airports During Construction',
 'Construction Safety and Phasing Plan (CSPP). Civilian analog of the military Construction Inspection workflow.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5370-2G.pdf',
 'II', NULL, 'construction', 'FAA', false, false, false,
 ARRAY['CSPP', 'construction safety', 'phasing plan', '§139.341'],
 'faa'),

('FAA AC 70/7460-1L',
 'Obstruction Marking and Lighting',
 'Marking and lighting standards for obstacles to navigable airspace.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_70_7460-1L.pdf',
 'IV', NULL, 'lighting', 'FAA', false, false, false,
 ARRAY['obstruction', 'marking', 'lighting', 'Part 77'],
 'faa'),

('FAA AC 70/7460-2L',
 'Proposed Construction or Alteration of Objects that May Affect the Navigable Airspace',
 'FAA Form 7460-1/7460-2 process for filing notice of proposed construction near airports. Triggers airspace evaluation under Part 77.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_70_7460-2L.pdf',
 'IV', NULL, 'construction', 'FAA', false, false, false,
 ARRAY['Form 7460-1', 'construction notice', 'Part 77', 'airspace evaluation'],
 'faa'),

('FAA AC 150/5200-28F',
 'NOTAMs for Airport Operators',
 'NOTAM issuance procedures for airport operators. Companion to JO 7930.2 (NOTAM Order) and §139.339 Public Protection.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5200-28F.pdf',
 'II', NULL, 'notams', 'FAA', false, false, false,
 ARRAY['NOTAM', 'airport operators', 'JO 7930.2'],
 'faa'),

('FAA JO 7930.2',
 'Notices to Air Missions',
 'NOTAM Order defining format, codes, and FNS UMS (Federal NOTAM System / U.S. NOTAM System) usage. Required reading for NOTAM-issuing personnel.',
 'Current Ed.',
 'https://www.faa.gov/documentLibrary/media/Order/JO_7930.2.pdf',
 'II', NULL, 'notams', 'FAA', false, false, false,
 ARRAY['NOTAM Order', 'FNS UMS', 'JO 7930.2', 'NOTAM format'],
 'faa'),

('49 CFR Part 1542',
 'Airport Security',
 'TSA airport security regulations. Companion to §139.303 personnel training (security ID display) and SIDA badging.',
 'Current Ed.',
 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-XII/subchapter-C/part-1542',
 'VI-B', NULL, 'security', 'CFR', false, false, false,
 ARRAY['TSA', 'airport security', 'SIDA', '§139.303'],
 'faa'),

('49 CFR §172',
 'Hazardous Materials Communications, Emergency Response Information, Training Requirements, and Security Plans',
 'DOT hazmat regulations relevant to airport fueling operations and hazmat incidents. Companion to §139.321 Handling of Hazardous Substances.',
 'Current Ed.',
 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-I/subchapter-C/part-172',
 'VI-B', NULL, 'fueling', 'CFR', false, false, false,
 ARRAY['hazmat', '§139.321', 'DOT', 'fueling'],
 'faa')

ON CONFLICT (reg_id) DO UPDATE SET
  source = EXCLUDED.source,
  title = COALESCE(regulations.title, EXCLUDED.title),
  description = COALESCE(NULLIF(regulations.description, ''), EXCLUDED.description),
  url = COALESCE(regulations.url, EXCLUDED.url),
  tags = CASE
    WHEN array_length(regulations.tags, 1) IS NULL THEN EXCLUDED.tags
    ELSE regulations.tags
  END;

-- ── Upgrade existing entries that apply to both authorities ────

UPDATE regulations SET source = 'both' WHERE reg_id IN (
  'FAA AC 150/5300-13',    -- Airport Design (joint-use bases reference both UFC and AC)
  '14 CFR Part 139',       -- referenced by joint civil-military airfields
  '14 CFR Part 77'         -- airspace surfaces apply to both contexts
);
