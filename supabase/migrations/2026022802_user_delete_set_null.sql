-- Allow user deletion by changing FK references to ON DELETE SET NULL.
-- This preserves historical records (discrepancies, waivers, activity, etc.)
-- while allowing the profile to be removed.

-- 1. Drop NOT NULL constraints on FK columns that reference profiles(id)

ALTER TABLE discrepancies ALTER COLUMN reported_by DROP NOT NULL;
ALTER TABLE photos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE navaid_statuses ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE obstruction_evaluations ALTER COLUMN evaluated_by DROP NOT NULL;
ALTER TABLE activity_log ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE status_updates ALTER COLUMN updated_by DROP NOT NULL;

-- 2. Replace FK constraints with ON DELETE SET NULL

-- waivers.created_by
ALTER TABLE waivers DROP CONSTRAINT IF EXISTS waivers_created_by_fkey;
ALTER TABLE waivers ADD CONSTRAINT waivers_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- waivers.updated_by
ALTER TABLE waivers DROP CONSTRAINT IF EXISTS waivers_updated_by_fkey;
ALTER TABLE waivers ADD CONSTRAINT waivers_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- inspections.inspector_id
ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_inspector_id_fkey;
ALTER TABLE inspections ADD CONSTRAINT inspections_inspector_id_fkey
  FOREIGN KEY (inspector_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- discrepancies.assigned_to
ALTER TABLE discrepancies DROP CONSTRAINT IF EXISTS discrepancies_assigned_to_fkey;
ALTER TABLE discrepancies ADD CONSTRAINT discrepancies_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

-- discrepancies.reported_by
ALTER TABLE discrepancies DROP CONSTRAINT IF EXISTS discrepancies_reported_by_fkey;
ALTER TABLE discrepancies ADD CONSTRAINT discrepancies_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- photos.uploaded_by
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_uploaded_by_fkey;
ALTER TABLE photos ADD CONSTRAINT photos_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- navaid_statuses.updated_by
ALTER TABLE navaid_statuses DROP CONSTRAINT IF EXISTS navaid_statuses_updated_by_fkey;
ALTER TABLE navaid_statuses ADD CONSTRAINT navaid_statuses_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- status_updates.updated_by
ALTER TABLE status_updates DROP CONSTRAINT IF EXISTS status_updates_updated_by_fkey;
ALTER TABLE status_updates ADD CONSTRAINT status_updates_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- obstruction_evaluations.evaluated_by
ALTER TABLE obstruction_evaluations DROP CONSTRAINT IF EXISTS obstruction_evaluations_evaluated_by_fkey;
ALTER TABLE obstruction_evaluations ADD CONSTRAINT obstruction_evaluations_evaluated_by_fkey
  FOREIGN KEY (evaluated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- activity_log.user_id
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- waiver_reviews.reviewed_by
ALTER TABLE waiver_reviews DROP CONSTRAINT IF EXISTS waiver_reviews_reviewed_by_fkey;
ALTER TABLE waiver_reviews ADD CONSTRAINT waiver_reviews_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- runway_status_log.changed_by
ALTER TABLE runway_status_log DROP CONSTRAINT IF EXISTS runway_status_log_changed_by_fkey;
ALTER TABLE runway_status_log ADD CONSTRAINT runway_status_log_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL;
