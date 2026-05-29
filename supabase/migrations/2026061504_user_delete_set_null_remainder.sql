-- Complete the user-deletion FK cleanup started in 2026022802.
--
-- 2026022802 converted 13 profiles(id) FK columns to ON DELETE SET NULL so a
-- profile could be deleted without a foreign-key violation. Every table added
-- *after* that migration created its actor columns (created_by / signed_by /
-- changed_by / etc.) without an ON DELETE clause, so they defaulted to
-- NO ACTION. Deleting a user referenced by any of them — e.g. someone who
-- signed a daily review, changed ARFF status, or created a NOTAM — fails with
-- a FK violation, and these columns are NOT in the delete route's manual
-- nullify list.
--
-- This converts every remaining NO ACTION profiles(id) FK to ON DELETE SET
-- NULL. The columns are all nullable already, and they record *who* did
-- something on a historical/operational row — we want to keep the row and just
-- drop the actor link, never cascade-delete the record. The authoritative list
-- was taken from the live DB (pg_constraint.confdeltype = 'a').
--
-- Idempotent: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT. Re-runnable.

-- airfield_status
ALTER TABLE airfield_status DROP CONSTRAINT IF EXISTS airfield_status_updated_by_fkey;
ALTER TABLE airfield_status ADD CONSTRAINT airfield_status_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- arff_status_log
ALTER TABLE arff_status_log DROP CONSTRAINT IF EXISTS arff_status_log_changed_by_fkey;
ALTER TABLE arff_status_log ADD CONSTRAINT arff_status_log_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- custom_status_boards
ALTER TABLE custom_status_boards DROP CONSTRAINT IF EXISTS custom_status_boards_created_by_fkey;
ALTER TABLE custom_status_boards ADD CONSTRAINT custom_status_boards_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- custom_status_items
ALTER TABLE custom_status_items DROP CONSTRAINT IF EXISTS custom_status_items_updated_by_fkey;
ALTER TABLE custom_status_items ADD CONSTRAINT custom_status_items_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- daily_reviews (five shift sign-off slots)
ALTER TABLE daily_reviews DROP CONSTRAINT IF EXISTS daily_reviews_day_amsl_signed_by_fkey;
ALTER TABLE daily_reviews ADD CONSTRAINT daily_reviews_day_amsl_signed_by_fkey
  FOREIGN KEY (day_amsl_signed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE daily_reviews DROP CONSTRAINT IF EXISTS daily_reviews_swing_amsl_signed_by_fkey;
ALTER TABLE daily_reviews ADD CONSTRAINT daily_reviews_swing_amsl_signed_by_fkey
  FOREIGN KEY (swing_amsl_signed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE daily_reviews DROP CONSTRAINT IF EXISTS daily_reviews_mid_amsl_signed_by_fkey;
ALTER TABLE daily_reviews ADD CONSTRAINT daily_reviews_mid_amsl_signed_by_fkey
  FOREIGN KEY (mid_amsl_signed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE daily_reviews DROP CONSTRAINT IF EXISTS daily_reviews_namo_signed_by_fkey;
ALTER TABLE daily_reviews ADD CONSTRAINT daily_reviews_namo_signed_by_fkey
  FOREIGN KEY (namo_signed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE daily_reviews DROP CONSTRAINT IF EXISTS daily_reviews_afm_signed_by_fkey;
ALTER TABLE daily_reviews ADD CONSTRAINT daily_reviews_afm_signed_by_fkey
  FOREIGN KEY (afm_signed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- infrastructure_features
ALTER TABLE infrastructure_features DROP CONSTRAINT IF EXISTS infrastructure_features_created_by_fkey;
ALTER TABLE infrastructure_features ADD CONSTRAINT infrastructure_features_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE infrastructure_features DROP CONSTRAINT IF EXISTS infrastructure_features_status_changed_by_fkey;
ALTER TABLE infrastructure_features ADD CONSTRAINT infrastructure_features_status_changed_by_fkey
  FOREIGN KEY (status_changed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- inspections (completed_filed_by columns added in 2026022200)
ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_completed_by_id_fkey;
ALTER TABLE inspections ADD CONSTRAINT inspections_completed_by_id_fkey
  FOREIGN KEY (completed_by_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_filed_by_id_fkey;
ALTER TABLE inspections ADD CONSTRAINT inspections_filed_by_id_fkey
  FOREIGN KEY (filed_by_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- notams
ALTER TABLE notams DROP CONSTRAINT IF EXISTS notams_created_by_fkey;
ALTER TABLE notams ADD CONSTRAINT notams_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE notams DROP CONSTRAINT IF EXISTS notams_cancelled_by_fkey;
ALTER TABLE notams ADD CONSTRAINT notams_cancelled_by_fkey
  FOREIGN KEY (cancelled_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- outage_events
ALTER TABLE outage_events DROP CONSTRAINT IF EXISTS outage_events_reported_by_fkey;
ALTER TABLE outage_events ADD CONSTRAINT outage_events_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- scn_checks
ALTER TABLE scn_checks DROP CONSTRAINT IF EXISTS scn_checks_completed_by_fkey;
ALTER TABLE scn_checks ADD CONSTRAINT scn_checks_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- training_records (Part 139)
ALTER TABLE training_records DROP CONSTRAINT IF EXISTS training_records_created_by_fkey;
ALTER TABLE training_records ADD CONSTRAINT training_records_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE training_records DROP CONSTRAINT IF EXISTS training_records_instructor_user_id_fkey;
ALTER TABLE training_records ADD CONSTRAINT training_records_instructor_user_id_fkey
  FOREIGN KEY (instructor_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- training_certificates (Part 139)
ALTER TABLE training_certificates DROP CONSTRAINT IF EXISTS training_certificates_created_by_fkey;
ALTER TABLE training_certificates ADD CONSTRAINT training_certificates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- waiver_attachments
ALTER TABLE waiver_attachments DROP CONSTRAINT IF EXISTS waiver_attachments_uploaded_by_fkey;
ALTER TABLE waiver_attachments ADD CONSTRAINT waiver_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
