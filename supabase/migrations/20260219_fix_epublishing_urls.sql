-- ═══════════════════════════════════════════════════════════════════
-- Fix 21 e-publishing PDF URLs
-- Many AF publications were renamed AFI->DAFI / AFMAN->DAFMAN
-- and the static e-publishing paths changed accordingly.
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- Also clear storage_path so the downloader re-fetches with the new URL
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
  url = 'https://static.e-publishing.af.mil/production/1/saf_ig/publication/dafi90-201/dafi90-201.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 90-201';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a4/publication/dafi10-2501/dafi10-2501.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 10-2501';

UPDATE regulations SET
  url = 'https://static.e-publishing.af.mil/production/1/af_a4/publication/dafman32-1084/afman32-1084.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFMAN 32-1084';

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
  url = 'https://static.e-publishing.af.mil/production/1/af_a1/publication/dafi38-201/dafi38-201.pdf',
  storage_path = NULL, file_size_bytes = NULL
WHERE reg_id = 'AFI 38-201';

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

-- Verify: should show 21 rows with updated URLs
SELECT reg_id, url FROM regulations
WHERE url LIKE '%dafi%' OR url LIKE '%dafman%' OR url LIKE '%afman13-204v1%'
ORDER BY reg_id;
