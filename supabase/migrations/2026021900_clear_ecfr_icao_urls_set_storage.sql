-- Remove eCFR / ICAO store URLs from CFR and ICAO regulations.
-- These regulations now have PDFs uploaded directly to the regulation-pdfs
-- Supabase Storage bucket using sanitized filenames (no spaces/special chars).

UPDATE regulations
SET url = NULL,
    storage_path = '14_cfr_part_139.pdf'
WHERE reg_id = '14 CFR Part 139';

UPDATE regulations
SET url = NULL,
    storage_path = '14_cfr_part_77.pdf'
WHERE reg_id = '14 CFR Part 77';

UPDATE regulations
SET url = NULL,
    storage_path = '14_cfr_part_121.pdf'
WHERE reg_id = '14 CFR Part 121';

UPDATE regulations
SET url = NULL,
    storage_path = '14_cfr_part_380.pdf'
WHERE reg_id = '14 CFR Part 380';

UPDATE regulations
SET url = NULL,
    storage_path = '14_cfr_part_5.pdf'
WHERE reg_id = '14 CFR Part 5';

UPDATE regulations
SET url = NULL,
    storage_path = '14_cfr_part_11.pdf'
WHERE reg_id = '14 CFR Part 11';

UPDATE regulations
SET url = NULL,
    storage_path = '49_cfr_830.pdf'
WHERE reg_id = '49 CFR 830';

UPDATE regulations
SET url = NULL,
    storage_path = 'icao_annex_14.pdf'
WHERE reg_id = 'ICAO Annex 14';
