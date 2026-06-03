-- ============================================================
-- AMTR — backfill new inspection auto-keys onto seeded checklists.
--
-- Five previously-manual checklist lines now have an automated check in the gap
-- engine: the four "if transcribed, do transcriptions have dates/initials" lines
-- (797/1098/803/JQS) and "monthly training records inspection conducted". Bases
-- using the bundled default get these automatically; bases that seeded their own
-- amtr_inspection_checklist need the auto_key set on the matching rows.
--
-- Matched by label text + section prefix; only fills rows whose auto_key is still
-- empty, so any manual customization is left untouched.
-- ============================================================

UPDATE amtr_inspection_checklist SET auto_key = '797_transcribed'
  WHERE kind = 'item' AND (auto_key IS NULL OR auto_key = '')
    AND label ILIKE '%transcri%' AND item_number LIKE '5.%';

UPDATE amtr_inspection_checklist SET auto_key = '1098_transcribed'
  WHERE kind = 'item' AND (auto_key IS NULL OR auto_key = '')
    AND label ILIKE '%transcri%' AND item_number LIKE '6.%';

UPDATE amtr_inspection_checklist SET auto_key = '803_transcribed'
  WHERE kind = 'item' AND (auto_key IS NULL OR auto_key = '')
    AND label ILIKE '%transcri%' AND item_number LIKE '7.%';

UPDATE amtr_inspection_checklist SET auto_key = 'jqs_transcribed'
  WHERE kind = 'item' AND (auto_key IS NULL OR auto_key = '')
    AND label ILIKE '%transcri%' AND item_number LIKE '9.%';

UPDATE amtr_inspection_checklist SET auto_key = 'monthly_inspection_done'
  WHERE kind = 'item' AND (auto_key IS NULL OR auto_key = '')
    AND label ILIKE '%monthly training records inspection%';
