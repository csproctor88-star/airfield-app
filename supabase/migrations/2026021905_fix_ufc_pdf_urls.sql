-- ═══════════════════════════════════════════════════════════════════
-- Fix 13 UFC URLs: replace WBDG web page links with direct PDF URLs
-- Source: https://www.wbdg.org/FFC/DOD/UFC/
-- ═══════════════════════════════════════════════════════════════════

-- Section IV — UFC 3-260-01 References
UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_1_200_01_2022_c4.pdf'
  WHERE reg_id = 'UFC 1-200-01';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_201_01_2022.pdf'
  WHERE reg_id = 'UFC 3-201-01';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_16_2019.pdf'
  WHERE reg_id = 'UFC 3-260-16';

-- Section V — Additional UFC/FC
UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_17_2018_c1.pdf'
  WHERE reg_id = 'UFC 3-260-17';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_270_01_2018_c1.pdf'
  WHERE reg_id = 'UFC 3-270-01';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_270_08_2024.pdf'
  WHERE reg_id = 'UFC 3-270-08';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_4_211_01_2017_c3.pdf'
  WHERE reg_id = 'UFC 4-211-01';

-- Section VI-C — UFC/DoD Cross-References
UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_02_2001.pdf'
  WHERE reg_id = 'UFC 3-260-02';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_04_2018.pdf'
  WHERE reg_id = 'UFC 3-260-04';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_460_01_2019_c3.pdf'
  WHERE reg_id = 'UFC 3-460-01';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_535_01_2017_c4.pdf'
  WHERE reg_id = 'UFC 3-535-01';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_4_010_01_2018_c3.pdf'
  WHERE reg_id = 'UFC 4-010-01';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_1_200_02_2020_c3.pdf'
  WHERE reg_id = 'UFC 1-200-02';

-- Verify all 13 updated
SELECT reg_id, url FROM regulations WHERE pub_type = 'UFC' ORDER BY reg_id;
