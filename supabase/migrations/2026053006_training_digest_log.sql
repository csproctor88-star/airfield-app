-- ============================================================
-- Phase 3a step 7 — §139.303 Training: expiry-digest dedup log
--
-- Used by /api/training-expiry-digest (Vercel cron, daily 13:00 UTC).
-- One row per (base_id, user_id, send_date) lets the route reliably
-- re-run within the same day without sending duplicates — the
-- INSERT ... ON CONFLICT DO NOTHING is the dedup mechanism.
--
-- Send-date granularity is intentional. If a user has the same
-- expiring topic for a week, they receive ONE digest per day until
-- the topic is renewed or expires past the 30-day window. Acceptable
-- cadence — daily nag is the point.
--
-- No RLS on this table — service-role-only access via the API route.
-- ============================================================

CREATE TABLE IF NOT EXISTS training_digest_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  send_date   DATE NOT NULL,
  topic_codes TEXT[] NOT NULL DEFAULT '{}',  -- which topics were in this digest
  recipient   TEXT NOT NULL,                  -- who got emailed (training admin)
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_id, user_id, send_date)
);

CREATE INDEX IF NOT EXISTS idx_training_digest_log_send_date ON training_digest_log (send_date);

COMMENT ON TABLE training_digest_log IS 'Per-day dedup log for the training-expiry digest cron. UNIQUE (base, user, day) makes the cron safely re-runnable.';
