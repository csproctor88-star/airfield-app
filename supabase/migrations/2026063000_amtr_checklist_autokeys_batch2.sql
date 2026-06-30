-- Connect the new auto-checks (2.3 skill-level-vs-DAFSC, 4.2 transcribe-reason)
-- to existing per-base inspection checklists. Additive; only fills NULLs so a
-- base that already customized these items is untouched.
update amtr_inspection_checklist set auto_key = 'skill_levels_attained'
  where auto_key is null and item_number = '2.3';
update amtr_inspection_checklist set auto_key = 'transcribe_reason'
  where auto_key is null and item_number = '4.2';
