-- ============================================================
-- base_id-leading indexes on base-filtered tables
--
-- Finding (audit 2026-07-01, LOW): these tables are queried/filtered by base but
-- were indexed only by member_id / PK / parent-FK, so base-scoped list queries
-- seq-scan. Row counts are small today; add the indexes ahead of growth.
-- All 15 tables were verified to have a base_id column before writing this.
-- Log-style tables get (base_id, created_at DESC) to match their ordering.
-- ============================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_amtr_797_base_id              ON public.amtr_797 (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_803_base_id              ON public.amtr_803 (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_files_base_id            ON public.amtr_files (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_qtp_base_id              ON public.amtr_qtp (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_quals_base_id            ON public.amtr_quals (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_qtp_lessons_base_id      ON public.amtr_qtp_lessons (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_1098_progress_base_id    ON public.amtr_1098_progress (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_formal_progress_base_id  ON public.amtr_formal_progress (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_jqs_progress_base_id     ON public.amtr_jqs_progress (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_milestone_progress_base_id ON public.amtr_milestone_progress (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_qual_progress_base_id    ON public.amtr_qual_progress (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_rat_progress_base_id     ON public.amtr_rat_progress (base_id);
CREATE INDEX IF NOT EXISTS idx_amtr_audit_log_base_id        ON public.amtr_audit_log (base_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flip_change_events_base_id    ON public.flip_change_events (base_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppr_remarks_base_id           ON public.ppr_remarks (base_id, created_at DESC);

COMMIT;
