-- ═══════════════════════════════════════════════════════════════════
-- AOMS Regulation Database — Complete Schema + Seed Data
-- 74 Total Entries: 3 Core + 29 Direct Refs + 27 Cross-Refs + 15 Scrubbed
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. CREATE TABLE
CREATE TABLE regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  publication_date TEXT,
  url TEXT,
  source_section TEXT NOT NULL,
  source_volume TEXT,
  category TEXT NOT NULL,
  pub_type TEXT NOT NULL,
  is_core BOOLEAN NOT NULL DEFAULT false,
  is_cross_ref BOOLEAN NOT NULL DEFAULT false,
  is_scrubbed BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. INDEXES
CREATE INDEX idx_regulations_category ON regulations(category);
CREATE INDEX idx_regulations_pub_type ON regulations(pub_type);
CREATE INDEX idx_regulations_source_section ON regulations(source_section);
CREATE INDEX idx_regulations_reg_id ON regulations(reg_id);
CREATE INDEX idx_regulations_fts ON regulations USING gin(
  to_tsvector('english', coalesce(reg_id, '') || ' ' || coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- 3. SEED DATA — 78 Regulations

-- ── CORE PUBLICATIONS (3) ──────────────────────────────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('DAFMAN 13-204, Vol. 1', 'Management of Airfield Operations', 'The foundational DAF manual for airfield operations management. Defines AOF organization, commander responsibilities, AO Compliance Verification (AO-CV), airfield waiver processes, and MAJCOM oversight. Implements AFPD 13-2.', '22 Jul 2020', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afman13-204v1/afman13-204v1.pdf', 'core', NULL, 'airfield_ops', 'DAF', true, false, false, ARRAY['AOF', 'AO-CV', 'AFPD 13-2', 'airfield operations', 'commander responsibilities', 'waiver']),
('DAFMAN 13-204, Vol. 2', 'Airfield Management', 'The primary manual for airfield management (AM) operations. Covers AM duties and qualifications, airfield inspections, NOTAM procedures, flight plan processing, airfield driving programs, transient aircraft services, and local procedures.', '20 Sep 2024', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman13-204v2/dafman13-204v2.pdf', 'core', NULL, 'airfield_mgmt', 'DAF', true, false, false, ARRAY['AM', 'airfield management', 'NOTAM', 'inspections', 'airfield driving', 'transient aircraft']),
('DAFMAN 13-204, Vol. 3', 'Air Traffic Control', 'The primary manual for DAF air traffic control operations. Covers ATC duties and qualifications, facility ratings, local procedures, ATC training programs, watch supervisor responsibilities, and coordination with FAA JO 7110.65.', '10 Jun 2020', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afman13-204v3/dafman13-204v3.pdf', 'core', NULL, 'atc', 'DAF', true, false, false, ARRAY['ATC', 'air traffic control', 'facility rating', 'watch supervisor', 'JO 7110.65']);

-- ── SECTION I — Vol. 1 References (6) ─────────────────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('DAFI 90-160', 'Publications and Forms Management', 'Procedures for developing and managing DAF publications and forms.', '14 Apr 2022', 'https://static.e-publishing.af.mil/production/1/saf_am/publication/dafi90-160/dafi90-160.pdf', 'I', 'Vol. 1', 'publications', 'DAF', false, false, false, ARRAY['publications', 'forms', 'administrative']),
('DAFI 90-302', 'The Inspection System of the DAF', 'Guidance on AO-CV and general inspection standards.', '15 Mar 2023', 'https://static.e-publishing.af.mil/production/1/saf_ig/publication/dafi90-302/dafi90-302.pdf', 'I', 'Vol. 1', 'airfield_ops', 'DAF', false, false, false, ARRAY['AO-CV', 'inspection', 'compliance verification']),
('DAFMAN 90-161', 'Publishing Processes and Procedures', 'Lifecycle and administrative control of official manuals.', '18 Oct 2023', 'https://static.e-publishing.af.mil/production/1/saf_am/publication/dafman90-161/dafman90-161.pdf', 'I', 'Vol. 1', 'publications', 'DAF', false, false, false, ARRAY['publishing', 'manual lifecycle', 'administrative']),
('AFI 10-1002', 'Joint Use Agreements for Military and Civilian Flying Facilities', 'Coordinating airfield usage between DAF and civilian entities.', '8 Aug 2018', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi10-1002/afi10-1002.pdf', 'I', 'Vol. 1', 'international', 'DAF', false, false, false, ARRAY['joint use', 'civilian', 'agreement', 'shared airfield']),
('AFI 10-1801', 'Foreign Governmental Aircraft Landings at USAF Installations', 'Policy for authorizing foreign military aircraft arrivals.', '25 Sep 2018', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi10-1801/afi10-1801.pdf', 'I', 'Vol. 1', 'international', 'DAF', false, false, false, ARRAY['foreign aircraft', 'landing permits', 'international']),
('AFI 38-402', 'Airmen Powered by Innovation', 'Program for submitting innovative process improvements.', '8 Feb 2018', 'https://static.e-publishing.af.mil/production/1/saf_mg/publication/dafi38-402/dafi38-402.pdf', 'I', 'Vol. 1', 'personnel', 'DAF', false, false, false, ARRAY['innovation', 'process improvement']);

-- ── SECTION II — Vol. 2 References (5) ────────────────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('14 CFR Part 139', 'Certification of Airports', 'FAA standards for airport safety, firefighting, and emergency planning at joint-use airfields.', '12 Feb 2026', 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-139', 'II', 'Vol. 2', 'safety', 'CFR', false, false, false, ARRAY['Part 139', 'airport certification', 'ARFF', 'emergency planning', 'joint-use']),
('AFI 10-1001', 'Civil Aircraft Landing Permits', 'Issuing landing permits and processing civilian aircraft fees.', '23 Aug 2018', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi10-1001/afi10-1001.pdf', 'II', 'Vol. 2', 'international', 'DAF', false, false, false, ARRAY['civil aircraft', 'landing permits', 'fees']),
('AFI 10-2501', 'Air Force Emergency Management Program', 'All-hazards response to airfield mishaps and disasters.', '10 Mar 2020', 'https://static.e-publishing.af.mil/production/1/af_a4/publication/dafi10-2501/dafi10-2501.pdf', 'II', 'Vol. 2', 'emergency', 'DAF', false, false, false, ARRAY['emergency management', 'all-hazards', 'disaster response', 'mishap']),
('AFH 32-7084', 'AICUZ Program Manager''s Guide', 'Air Installations Compatible Use Zones; land use and noise management.', '2 Nov 2017', 'https://static.e-publishing.af.mil/production/1/af_a4/publication/dafh32-7084/dafh32-7084.pdf', 'II', 'Vol. 2', 'airfield_design', 'DAF', false, false, false, ARRAY['AICUZ', 'land use', 'noise', 'compatible use zones']),
('DAFMAN 32-1084', 'Facility Requirements', 'Space allocations for airfield buildings and hangars.', '26 Feb 2016', 'https://static.e-publishing.af.mil/production/1/af_a4/publication/dafman32-1084/dafman32-1084.pdf', 'II', 'Vol. 2', 'construction', 'DAF', false, false, false, ARRAY['facility requirements', 'space allocation', 'hangars', 'buildings']);

-- ── SECTION III — Vol. 3 References (5) ───────────────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('FAA Order JO 7210.3', 'Facility Operation and Administration', 'Administration of air traffic control facilities.', '22 Jan 2026', 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1040564', 'III', 'Vol. 3', 'atc', 'FAA', false, false, false, ARRAY['ATC facility', 'administration', 'JO 7210.3']),
('FAA Order JO 7110.10', 'Flight Services', 'Flight service personnel briefings and radio contact.', '22 Jan 2026', 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1040566', 'III', 'Vol. 3', 'atc', 'FAA', false, false, false, ARRAY['flight services', 'briefings', 'radio contact', 'JO 7110.10']),
('FAA Order JO 1900.47', 'ATC Operational Readiness and Contingency Planning', 'ATC facility management during emergencies or disruptions.', '30 Apr 2024', 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1042413', 'III', 'Vol. 3', 'emergency', 'FAA', false, false, false, ARRAY['ATC contingency', 'operational readiness', 'emergency', 'JO 1900.47']),
('AFI 17-221', 'Spectrum Interference Resolution Program', 'Resolving radio interference affecting ATC communications.', '11 May 2018', 'https://static.e-publishing.af.mil/production/1/af_a2_6/publication/dafi17-221/dafi17-221.pdf', 'III', 'Vol. 3', 'atc', 'DAF', false, false, false, ARRAY['spectrum', 'radio interference', 'communications', 'ATC']),
('AFI 33-322', 'Records Management and Information Governance', 'Official logs, recorded radio data, and historical files.', '6 Mar 2020', 'https://static.e-publishing.af.mil/production/1/saf_cn/publication/afi33-322/afi33-322.pdf', 'III', 'Vol. 3', 'publications', 'DAF', false, false, false, ARRAY['records management', 'radio recordings', 'logs', 'information governance']);

-- ── SECTION IV — UFC 3-260-01 References (9) ─────────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('UFC 1-200-01', 'DoD Building Code', 'Overarching criteria for all DoD facility construction and modernization.', '17 Dec 2024', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_1_200_01_2022_c4.pdf', 'IV', 'UFC 3-260-01', 'construction', 'UFC', false, false, false, ARRAY['building code', 'DoD construction', 'modernization']),
('UFC 3-201-01', 'Civil Engineering', 'Site development, grading, and storm drainage.', '20 Dec 2022', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_201_01_2022.pdf', 'IV', 'UFC 3-260-01', 'construction', 'UFC', false, false, false, ARRAY['civil engineering', 'site development', 'grading', 'drainage']),
('UFC 3-260-16', 'Airfield Pavement Condition Surveys', 'PCI surveys and identifying pavement distress.', '3 Feb 2019', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_16_2019.pdf', 'IV', 'UFC 3-260-01', 'pavement', 'UFC', false, false, false, ARRAY['PCI', 'pavement condition', 'survey', 'distress']),
('FAA AC 150/5300-13', 'Airport Design', 'Primary civilian standard for airfield geometry and runway layout.', 'Current Ed.', 'https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.current/documentNumber/150_5300-13', 'IV', 'UFC 3-260-01', 'airfield_design', 'FAA', false, false, false, ARRAY['airport design', 'runway layout', 'geometry', 'AC 150/5300-13']),
('FAA Order 8260.3', 'US Standard for TERPS', 'Criteria for instrument approach and departure procedures.', 'Current Ed.', 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1029737', 'IV', 'UFC 3-260-01', 'atc', 'FAA', false, false, false, ARRAY['TERPS', 'instrument approach', 'departure procedures', '8260.3']),
('NFPA 780', 'Lightning Protection Systems', 'Protecting airfield facilities and aircraft parking spots.', '2017 Ed.', 'https://www.nfpa.org/codes-and-standards/nfpa-780-standard-for-the-installation-of-lightning-protection-systems', 'IV', 'UFC 3-260-01', 'safety', 'NFPA', false, false, false, ARRAY['lightning protection', 'NFPA', 'aircraft parking']),
('NFPA 415', 'Airport Terminal Buildings', 'Fire protection for fueling ramps and passenger boarding areas.', '2016 Ed.', 'https://www.nfpa.org/codes-and-standards/nfpa-415-standard-on-airport-terminal-buildings-fueling-ramp-drainage-and-loading-walkways', 'IV', 'UFC 3-260-01', 'fueling', 'NFPA', false, false, false, ARRAY['fire protection', 'fueling ramps', 'terminal buildings', 'NFPA']),
('MIL-STD 3007', 'UFC Format and Standard', 'How technical criteria are updated across tri-services.', '13 Dec 2019', 'https://www.wbdg.org/ffc/dod/mil-std/mil_std_3007f', 'IV', 'UFC 3-260-01', 'construction', 'DoD', false, false, false, ARRAY['MIL-STD', 'UFC format', 'tri-service', 'technical criteria']),
('ICAO Annex 14', 'Aerodromes - Vol. I', 'International aerodrome design and operations standards.', 'Jul 2022', 'https://store.icao.int/en/annex-14-aerodromes-volume-i-aerodrome-design-and-operations', 'IV', 'UFC 3-260-01', 'airfield_design', 'ICAO', false, false, false, ARRAY['ICAO', 'aerodrome', 'international standards', 'Annex 14']);

-- ── SECTION V — Additional UFC/FC (5) ─────────────────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('UFC 3-260-17', 'Dust Control for Roads and Airfields', 'Stabilizing unpaved surfaces to prevent FOD and engine damage.', '26 Apr 2023', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_17_2018_c1.pdf', 'V', NULL, 'pavement', 'UFC', false, false, false, ARRAY['dust control', 'FOD prevention', 'unpaved surfaces', 'engine damage']),
('UFC 3-270-01', 'Pavement Maintenance and Repair', 'Asphalt spall repair and joint sealing.', '17 Mar 2022', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_270_01_2018_c1.pdf', 'V', NULL, 'pavement', 'UFC', false, false, false, ARRAY['pavement maintenance', 'spall repair', 'joint sealing', 'asphalt']),
('UFC 3-270-08', 'Pavement Management', 'Long-term airfield pavement lifecycle planning.', '19 Jan 2024', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_270_08_2024.pdf', 'V', NULL, 'pavement', 'UFC', false, false, false, ARRAY['pavement management', 'lifecycle planning', 'long-term']),
('UFC 4-211-01', 'Aircraft Maintenance Hangars', 'Structural and safety requirements for maintenance bays.', '1 Oct 2024', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_4_211_01_2017_c3.pdf', 'V', NULL, 'construction', 'UFC', false, false, false, ARRAY['hangars', 'maintenance bays', 'structural requirements']),
('IEEE 142', 'Grounding of Industrial Power Systems', 'Electrical grounding systems for the flightline.', '2007 Ed.', 'https://standards.ieee.org/ieee/142/4669/', 'V', NULL, 'lighting', 'IEEE', false, false, false, ARRAY['grounding', 'electrical', 'flightline', 'IEEE', 'power systems']);

-- ── SECTION VI-A — DAF Cross-References (13) ─────────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('AFPD 13-2', 'Air Traffic Control, Airfield, Airspace, and Range Management', 'Parent policy directive implemented by DAFMAN 13-204 (all volumes). Establishes DAF policy for ATC and airfield ops.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afpd13-2/afpd13-2.pdf', 'VI-A', NULL, 'airfield_ops', 'DAF', false, true, false, ARRAY['AFPD', 'parent directive', 'ATC policy', 'airfield policy']),
('DAFI 13-213', 'Airfield Driving', 'Procedures for safe vehicle operation on the airfield; licensing, training, and vehicle identification.', '4 Feb 2020', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafi13-213/dafi13-213.pdf', 'VI-A', NULL, 'driving', 'DAF', false, true, false, ARRAY['airfield driving', 'vehicle operations', 'licensing', 'training']),
('DAFMAN 13-217', 'Drop Zone and Landing Zone Operations', 'Standards for establishing, surveying, and managing drop zones and landing zones for tactical airlift.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman13-217/dafman13-217.pdf', 'VI-A', NULL, 'airfield_ops', 'DAF', false, true, false, ARRAY['drop zone', 'landing zone', 'DZ', 'LZ', 'tactical airlift']),
('DAFI 91-212', 'Bird/Wildlife Aircraft Strike Hazard (BASH) Management Program', 'DAF-wide guidance for reducing bird and wildlife strike risks. Coordinates with 14 CFR 139.337.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafi91-212/dafi91-212.pdf', 'VI-A', NULL, 'bash_wildlife', 'DAF', false, true, false, ARRAY['BASH', 'bird strike', 'wildlife', 'hazard management']),
('DAFI 91-202', 'DAF Mishap Prevention Program', 'DAF safety program including airfield mishap reporting, risk management, and safety investigation.', '12 Mar 2020', 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafi91-202/dafi91-202.pdf', 'VI-A', NULL, 'safety', 'DAF', false, true, false, ARRAY['mishap prevention', 'risk management', 'safety investigation']),
('DAFI 91-204', 'Safety Investigations and Reports', 'Investigating and reporting DAF mishaps including airfield and flight-related incidents.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafi91-204/dafi91-204.pdf', 'VI-A', NULL, 'safety', 'DAF', false, true, false, ARRAY['safety investigation', 'mishap reports', 'incident reporting']),
('DAFMAN 91-203', 'Air Force Occupational Safety, Fire, and Health Standards', 'Occupational safety standards for airfield maintenance, ARFF, and flightline operations.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafman91-203/dafman91-203.pdf', 'VI-A', NULL, 'safety', 'DAF', false, true, false, ARRAY['occupational safety', 'fire', 'ARFF', 'flightline', 'health standards']),
('AFI 33-332', 'Air Force Privacy and Civil Liberties Program', 'Privacy Act compliance for ATC recordings, personnel data, and airfield ops records.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/saf_cn/publication/afi33-332/afi33-332.pdf', 'VI-A', NULL, 'publications', 'DAF', false, true, false, ARRAY['privacy', 'civil liberties', 'ATC recordings', 'personnel data']),
('AFI 36-2101', 'Classifying Military Personnel (Officer and Enlisted)', 'AFSC management for 13MX, 1C1X1 (ATC), 1C7X1 (AM), 1C8X3 (RAWS) career fields.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafman36-2100/dafman36-2100.pdf', 'VI-A', NULL, 'personnel', 'DAF', false, true, false, ARRAY['AFSC', 'personnel classification', '1C1X1', '1C7X1', '1C8X3', '13MX']),
('AFI 36-2670', 'Total Force Development', 'Training, education, and professional development for airfield operations career fields.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-2670/dafi36-2670.pdf', 'VI-A', NULL, 'personnel', 'DAF', false, true, false, ARRAY['training', 'education', 'professional development', 'total force']),
('AFI 32-1041', 'Pavement Evaluation Management', 'Evaluating airfield pavement structural capacity; supports weight-bearing decisions.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a4/publication/dafi32-1041/dafi32-1041.pdf', 'VI-A', NULL, 'pavement', 'DAF', false, true, false, ARRAY['pavement evaluation', 'structural capacity', 'weight-bearing']),
('AFMAN 11-230', 'Instrument Procedures', 'Instrument approach/departure procedures managed by TERPS specialists within the AOF.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman11-230/dafman11-230.pdf', 'VI-A', NULL, 'atc', 'DAF', false, true, false, ARRAY['instrument procedures', 'TERPS', 'approach', 'departure']),
('AFMAN 11-202 Vol 3', 'General Flight Rules', 'General USAF flight rules; intersects with ATC procedures in DAFMAN 13-204 Vol 3.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afman11-202v3/afman11-202v3.pdf', 'VI-A', NULL, 'atc', 'DAF', false, true, false, ARRAY['flight rules', 'USAF', 'ATC procedures', 'general flight']);

-- ── SECTION VI-B — FAA/DOT/NTSB Cross-References (8) ─────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('FAA JO 7110.65', 'Air Traffic Control', 'Primary FAA order for ATC procedures, phraseology, and separation standards. Core reference for Vol 3.', 'Current Ed.', 'https://www.faa.gov/air_traffic/publications/atpubs/atc_html/', 'VI-B', NULL, 'atc', 'FAA', false, true, false, ARRAY['ATC', '7110.65', 'phraseology', 'separation standards', 'procedures']),
('14 CFR Part 77', 'Safe, Efficient Use, and Preservation of the Navigable Airspace', 'FAA obstruction evaluation standards; defines imaginary surfaces for airfield planning.', 'Current Ed.', 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-E/part-77', 'VI-B', NULL, 'airfield_design', 'CFR', false, true, false, ARRAY['Part 77', 'obstruction evaluation', 'imaginary surfaces', 'navigable airspace']),
('14 CFR Part 121', 'Operating Requirements: Domestic, Flag, and Supplemental Operations', 'Air carrier operational standards referenced by 14 CFR Part 139 for airport certification.', 'Current Ed.', 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-121', 'VI-B', NULL, 'safety', 'CFR', false, true, false, ARRAY['Part 121', 'air carrier', 'operations', 'certification']),
('14 CFR Part 380', 'Public Charters', 'Public charter operations regulations referenced in 14 CFR Part 139 applicability.', 'Current Ed.', 'https://www.ecfr.gov/current/title-14/chapter-II/subchapter-D/part-380', 'VI-B', NULL, 'international', 'CFR', false, true, false, ARRAY['Part 380', 'public charters', 'charter operations']),
('14 CFR Part 5', 'Safety Management Systems', 'FAA SMS requirements; referenced in 14 CFR 139 Subpart E for airport-tenant SMS data sharing.', 'Current Ed.', 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-A/part-5', 'VI-B', NULL, 'safety', 'CFR', false, true, false, ARRAY['SMS', 'safety management systems', 'Part 5', 'data sharing']),
('14 CFR Part 11', 'General Rulemaking Procedures', 'Procedures for petitioning FAA for exemptions from Part 139 requirements.', 'Current Ed.', 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-B/part-11', 'VI-B', NULL, 'publications', 'CFR', false, true, false, ARRAY['Part 11', 'rulemaking', 'exemptions', 'petitions']),
('49 CFR 171-180', 'Hazardous Materials Regulations', 'DOT hazmat handling/transport; referenced by 14 CFR 139.321 for cargo and fueling safety.', 'Current Ed.', 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-I/subchapter-C', 'VI-B', NULL, 'fueling', 'CFR', false, true, false, ARRAY['hazmat', 'hazardous materials', 'fueling safety', 'cargo', 'DOT']),
('49 CFR 830', 'NTSB Notification and Reporting', 'Defines aircraft accidents/incidents; Part 139 references 830.2 for hazard definitions.', 'Current Ed.', 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-VIII/part-830', 'VI-B', NULL, 'safety', 'CFR', false, true, false, ARRAY['NTSB', 'accident reporting', 'incident notification', 'hazard definitions']);

-- ── SECTION VI-C — UFC/DoD Cross-References (6) ──────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('UFC 3-260-02', 'Pavement Design for Airfields', 'Flexible and rigid airfield pavement design criteria including CBR and layered analysis.', '30 Jun 2001', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_02_2001.pdf', 'VI-C', NULL, 'pavement', 'UFC', false, true, false, ARRAY['pavement design', 'CBR', 'layered analysis', 'flexible', 'rigid']),
('UFC 3-260-04', 'Airfield and Heliport Marking', 'DoD airfield/heliport marking standards; uses FHWA Manual of Uniform Traffic Control Devices.', '2018 Ed.', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_04_2018.pdf', 'VI-C', NULL, 'airfield_design', 'UFC', false, true, false, ARRAY['marking', 'heliport', 'traffic control devices', 'FHWA']),
('UFC 3-460-01', 'Design: Petroleum Fuel Facilities', 'Fuel storage, distribution, and dispensing facility design standards for DoD airfields.', 'Current Ed.', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_460_01_2019_c3.pdf', 'VI-C', NULL, 'fueling', 'UFC', false, true, false, ARRAY['fuel facilities', 'petroleum', 'storage', 'distribution', 'dispensing']),
('UFC 3-535-01', 'Visual Air Navigation Facilities', 'Airfield lighting: approach, runway, taxiway, and obstruction lighting systems.', 'Current Ed.', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_535_01_2017_c4.pdf', 'VI-C', NULL, 'lighting', 'UFC', false, true, false, ARRAY['airfield lighting', 'approach lights', 'runway lights', 'taxiway lights', 'obstruction lights']),
('UFC 4-010-01', 'DoD Minimum Antiterrorism Standards for Buildings', 'Security and force protection standards for airfield facilities and access control points.', 'Current Ed.', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_4_010_01_2018_c3.pdf', 'VI-C', NULL, 'security', 'UFC', false, true, false, ARRAY['antiterrorism', 'force protection', 'security', 'access control']),
('UFC 1-200-02', 'High-Performance and Sustainable Building Requirements', 'Energy and sustainability standards for airfield support facility construction/renovation.', 'Current Ed.', 'https://www.wbdg.org/FFC/DOD/UFC/ufc_1_200_02_2020_c3.pdf', 'VI-C', NULL, 'construction', 'UFC', false, true, false, ARRAY['sustainability', 'energy', 'high-performance', 'green building']);

-- ── SECTION VII-A — Scrubbed from Vols 1-3: DAF (10) ─────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('DAFMAN 13-204, Vol. 4', 'Radar, Airfield and Weather Systems (RAWS)', 'Companion volume governing RAWS personnel duties, qualifications, equipment maintenance, and flight inspection support. Directly referenced throughout Vol 1 Ch 1, 2, 3, and Attachment 7.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman13-204v4/dafman13-204_v4.pdf', 'VII-A', 'Vol. 1', 'airfield_ops', 'DAF', false, false, true, ARRAY['RAWS', 'radar', 'weather systems', 'equipment maintenance', 'flight inspection']),
('DAFMAN 36-2806', 'Military Awards: Criteria and Procedures', 'Governs the Lt Gen Gordon A. Blake Aircraft Save/Assist Award and AF Airfield Operations Annual Awards. Referenced in Vol 1 para 2.1.1.6 and 2.3.2.1.', '27 Oct 2022', 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafman36-2806/dafman36_2806.pdf', 'VII-A', 'Vol. 1', 'personnel', 'DAF', false, false, true, ARRAY['awards', 'Blake Award', 'airfield operations awards', 'recognition']),
('AFMAN 91-223', 'Aviation Safety Investigations and Reports', 'Procedures for investigating and reporting aviation safety events. Referenced in Vol 1 para 2.1.1.15 and 2.1.2.6 for SIB representation.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafman91-223/dafman91-223.pdf', 'VII-A', 'Vol. 1', 'safety', 'DAF', false, false, true, ARRAY['aviation safety', 'SIB', 'safety investigation', 'reporting']),
('AFI 36-701', 'Labor Management Relations', 'AF guidance for managers/supervisors dealing with unionized civilian employees. Referenced in Vol 1 para 2.9 for DoD civilian ATC/AM personnel.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-701/dafi36-701.pdf', 'VII-A', 'Vol. 1', 'personnel', 'DAF', false, false, true, ARRAY['labor relations', 'civilian employees', 'union', 'ATC civilian']),
('AFI 36-129', 'Civilian Personnel Management and Administration', 'Key employee designation for GS-2150/2152/2154 airfield ops civilians at CONUS locations. Referenced in Vol 1 para 2.9.1.5 and 2.9.2.5.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-129/dafi36-129.pdf', 'VII-A', 'Vol. 1', 'personnel', 'DAF', false, false, true, ARRAY['civilian personnel', 'key employee', 'GS-2150', 'CONUS']),
('AFI 51-403', 'International Agreements', 'Coordination requirements for LOPs with host nation agencies. Referenced in Vol 1 para 4.1.1.2.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_ja/publication/dafi51-403/dafi51-403.pdf', 'VII-A', 'Vol. 1', 'international', 'DAF', false, false, true, ARRAY['international agreements', 'LOP', 'host nation', 'coordination']),
('AFI 10-401', 'Air Force Operations Planning and Execution', 'Format and content guidance for OPLANs containing airfield operations tasks. Referenced in Vol 1 para 4.1.2.5.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi10-401/afi10-401.pdf', 'VII-A', 'Vol. 1', 'contingency', 'DAF', false, false, true, ARRAY['OPLAN', 'operations planning', 'execution', 'airfield tasks']),
('AFMAN 11-502', 'Small Unmanned Aircraft Systems', 'Defines DoD UAS categories (Groups 1-5) used for UAS airfield ops procedures. Referenced in Vol 1 para 3.10.2.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman11-502/dafman11-502.pdf', 'VII-A', 'Vol. 1', 'uas', 'DAF', false, false, true, ARRAY['UAS', 'sUAS', 'unmanned', 'drone', 'Groups 1-5']),
('AFI 36-2619', 'Military Personnel Appropriation Manday Program', 'Provides manday resources for critical ATC/AM manning shortfalls. Referenced in Vol 1 para 4.5.7.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-2619/dafi36-2619.pdf', 'VII-A', 'Vol. 1', 'financial', 'DAF', false, false, true, ARRAY['manday', 'manning', 'ATC', 'AM', 'personnel shortfall']),
('DoD 7000.14-R', 'DoD Financial Management Regulation', 'Governs Basic Allowance for Subsistence authorization for rotating-shift airfield ops personnel. Referenced in Vol 1 para 3.2.2.', 'Current Ed.', 'https://comptroller.defense.gov/FMR/', 'VII-A', 'Vol. 1', 'financial', 'DoD', false, false, true, ARRAY['financial management', 'BAS', 'subsistence', 'rotating shift']);

-- ── SECTION VII-B — Scrubbed: FAA Orders (2) ─────────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('FAA Order JO 7610.14', 'Non-Sensitive Procedures for Special Operations', 'Contains the MOA between DOT/FAA and US Army-Navy-Air Force (Appendix 4-2). Governs ATC evaluation authority and AO-CV guiding regulations. Referenced in Vol 1 Att 7 (A7.1.1.1-A7.1.1.2).', 'Current Ed.', 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1040568', 'VII-B', 'Vol. 1', 'atc', 'FAA', false, false, true, ARRAY['special operations', 'MOA', 'ATC evaluation', 'AO-CV', 'JO 7610.14']),
('FAAO 8200.1D', 'United States Flight Inspection Manual', 'Flight inspection procedures for RAWS equipment and NAVAID certification. Referenced in Vol 1 DAFGM Att 1 references and A7.1.1.4.', '6 Nov 2016', 'https://www.faa.gov/regulations_policies/orders_notices/index.cfm/go/document.information/documentID/1029824', 'VII-B', 'Vol. 1', 'lighting', 'FAA', false, false, true, ARRAY['flight inspection', 'RAWS', 'NAVAID certification', '8200.1D']);

-- ── SECTION VII-C — Scrubbed: Vols 2 & 3 (2) ────────────────────

INSERT INTO regulations (reg_id, title, description, publication_date, url, source_section, source_volume, category, pub_type, is_core, is_cross_ref, is_scrubbed, tags) VALUES
('AFI 11-208', 'Department of the Air Force NOTAM System', 'Establishes NOTAM issuance, verification, and dissemination procedures for airfield restrictions and closures. Referenced in Vol 2 for airfield management NOTAM duties.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afi11-208/afi11-208.pdf', 'VII-C', 'Vol. 2', 'notams', 'DAF', false, false, true, ARRAY['NOTAM', 'issuance', 'verification', 'dissemination', 'closures']),
('AFI 36-2110', 'Total Force Assignments', 'Personnel assignment procedures for ATC and AM career fields. Referenced in Vol 3 Attachment 1 references for controller assignment management.', 'Current Ed.', 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-2110/dafi36-2110.pdf', 'VII-C', 'Vol. 3', 'personnel', 'DAF', false, false, true, ARRAY['assignments', 'ATC', 'AM', 'controller assignment', 'total force']);

-- ── VERIFICATION ──────────────────────────────────────────────────
-- Expected: 74 rows (3 + 6 + 5 + 5 + 9 + 5 + 13 + 8 + 6 + 10 + 2 + 2)
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE is_core) AS core,
  count(*) FILTER (WHERE NOT is_core AND NOT is_cross_ref AND NOT is_scrubbed) AS direct,
  count(*) FILTER (WHERE is_cross_ref) AS cross_ref,
  count(*) FILTER (WHERE is_scrubbed) AS scrubbed
FROM regulations;
