-- Remove eCFR / ICAO store URLs from CFR and ICAO regulations.
-- These regulations now have PDFs uploaded directly to the regulation-pdfs
-- Supabase Storage bucket instead.

UPDATE regulations
SET url = NULL,
    storage_path = '14 CFR Part 139 (up to date as of 2-13-2026).pdf'
WHERE reg_id = '14 CFR Part 139';

UPDATE regulations
SET url = NULL,
    storage_path = '14 CFR Part 77 (up to date as of 2-13-2026).pdf'
WHERE reg_id = '14 CFR Part 77';

UPDATE regulations
SET url = NULL,
    storage_path = '14 CFR Part 121 (up to date as of 2-13-2026).pdf'
WHERE reg_id = '14 CFR Part 121';

UPDATE regulations
SET url = NULL,
    storage_path = '14 CFR Part 380 (up to date as of 2-13-2026).pdf'
WHERE reg_id = '14 CFR Part 380';

UPDATE regulations
SET url = NULL,
    storage_path = '14 CFR Part 5 (up to date as of 2-13-2026).pdf'
WHERE reg_id = '14 CFR Part 5';

UPDATE regulations
SET url = NULL,
    storage_path = '14 CFR Part 11 (up to date as of 2-13-2026).pdf'
WHERE reg_id = '14 CFR Part 11';

UPDATE regulations
SET url = NULL,
    storage_path = '49 CFR Part 830 (up to date as of 2-13-2026).pdf'
WHERE reg_id = '49 CFR 830';

UPDATE regulations
SET url = NULL,
    storage_path = 'icao_annex_14.pdf'
WHERE reg_id = 'ICAO Annex 14';
