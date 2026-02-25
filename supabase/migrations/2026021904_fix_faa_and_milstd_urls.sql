-- ═══════════════════════════════════════════════════════════════════
-- Fix 9 FAA Order + MIL-STD URLs to direct PDF downloads
-- Previously these pointed to FAA info pages / WBDG landing pages.
-- The old web-page URLs are preserved in discover-pdf-urls.ts for
-- currency verification (checking if newer editions exist).
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- Section III — FAA Orders
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

-- Section IV — FAA ACs and Orders
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

-- Section VI-B — FAA JO 7110.65
UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/7110.65BB_Bsc_w_Chg_1_and_2_dtd_1-22-26_Final.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAA JO 7110.65';

-- Section VII-B — Scrubbed FAA Orders
UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/7610.14_NSMIL_Bsc_w_Chg_1_2_and_3_dtd_2-20-25.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAA Order JO 7610.14';

UPDATE regulations SET
  url = 'https://www.faa.gov/documentLibrary/media/Order/8200.1D_CHG_1_2_(Final).pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'FAAO 8200.1D';
