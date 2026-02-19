-- ═══════════════════════════════════════════════════════════════════
-- 1. Delete 49 CFR 171-180 (incorrect entry)
-- 2. Re-sync all URLs to match the seed SQL (fixes 40 stale URLs)
-- 3. Reset storage_path so the download script re-fetches
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Delete 49 CFR 171-180
DELETE FROM regulations WHERE reg_id = '49 CFR 171-180';

-- ── e-Publishing URL fixes (18) ──────────────────────────────────
UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afman13-204v1/afman13-204v1.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'DAFMAN 13-204, Vol. 1';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/saf_am/publication/dafi90-160/dafi90-160.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'DAFI 90-160';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/saf_am/publication/dafman90-161/dafman90-161.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'DAFMAN 90-161';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/saf_mg/publication/dafi38-402/dafi38-402.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 38-402';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a4/publication/dafi10-2501/dafi10-2501.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 10-2501';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a2_6/publication/dafi17-221/dafi17-221.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 17-221';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafman36-2100/dafman36-2100.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 36-2101';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-2670/dafi36-2670.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 36-2670';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a4/publication/dafi32-1041/dafi32-1041.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 32-1041';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman11-230/dafman11-230.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFMAN 11-230';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafman36-2806/dafman36_2806.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'DAFMAN 36-2806';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_se/publication/dafman91-223/dafman91-223.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFMAN 91-223';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-701/dafi36-701.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 36-701';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-129/dafi36-129.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 36-129';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_ja/publication/dafi51-403/dafi51-403.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 51-403';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafman11-502/dafman11-502.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFMAN 11-502';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-2619/dafi36-2619.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 36-2619';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi36-2110/dafi36-2110.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 36-2110';

-- ── FAA Order + MIL-STD URL fixes (9) ────────────────────────────
UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/7210.3DD_Bsc_w_Chg_1_2_and_3_dtd_9-5-24.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAA Order JO 7210.3';

UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/7110.10EE_Bsc_w_Chg_1_and_2_dtd_1-22-26_Final.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAA Order JO 7110.10';

UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/Final_Order_JO_1900.47G_05_01_23.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAA Order JO 1900.47';

UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC-150-5300-13B-Airport-Design-Chg1-w-errata.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAA AC 150/5300-13';

UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/Order_8260.3G.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAA Order 8260.3';

UPDATE regulations SET
  url = 'https://www.wbdg.org/FFC/FEDMIL/milstd3007g.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'MIL-STD 3007';

UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/7110.65BB_Bsc_w_Chg_1_and_2_dtd_1-22-26_Final.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAA JO 7110.65';

UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/7610.14_NSMIL_Bsc_w_Chg_1_2_and_3_dtd_2-20-25.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAA Order JO 7610.14';

UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/8200.1D_CHG_1_2_(Final).pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAAO 8200.1D';

-- ── UFC URL fixes (13) ───────────────────────────────────────────
UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_1_200_01_2022_c4.pdf'
  WHERE reg_id = 'UFC 1-200-01';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_201_01_2022.pdf'
  WHERE reg_id = 'UFC 3-201-01';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_16_2019.pdf'
  WHERE reg_id = 'UFC 3-260-16';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_260_17_2018_c1.pdf'
  WHERE reg_id = 'UFC 3-260-17';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_270_01_2018_c1.pdf'
  WHERE reg_id = 'UFC 3-270-01';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_3_270_08_2024.pdf'
  WHERE reg_id = 'UFC 3-270-08';

UPDATE regulations SET url = 'https://www.wbdg.org/FFC/DOD/UFC/ufc_4_211_01_2017_c3.pdf'
  WHERE reg_id = 'UFC 4-211-01';

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

-- ── Verify ───────────────────────────────────────────────────────
-- Should show 69 total (70 minus deleted 49 CFR 171-180)
SELECT count(*) AS total_regulations FROM regulations;

-- Should show 8 non-PDF URLs (eCFR + ICAO only)
SELECT reg_id, url FROM regulations
WHERE url NOT LIKE '%.pdf'
ORDER BY reg_id;
