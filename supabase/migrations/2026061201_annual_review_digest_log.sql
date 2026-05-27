-- 2026061201 — annual_review_digest_log dedup table
--
-- Used by /api/annual-review-digest (Vercel cron, daily 13:30 UTC).
-- One row per (base_id, send_date) lets the route safely re-run
-- within the same day without sending duplicate emails — the
-- INSERT ... ON CONFLICT DO NOTHING (UNIQUE) is the dedup mechanism.
--
-- The digest covers AEP §139.325(d) annual reviews and WHMP
-- §139.337(c) annual reviews. Both have 12-month review cycles with
-- 60-day amber windows defined in lib/supabase/aep.ts
-- (nextAnnualReviewDue) and lib/supabase/whmp.ts (nextWhmpReviewDue).
-- The digest fires the email when either review crosses inside the
-- amber window OR has gone overdue, and continues firing daily until
-- the operator records a review (which moves the anchor forward and
-- pushes the next-due-date back outside the window).
--
-- No RLS — service-role-only access via the API route.

CREATE TABLE IF NOT EXISTS annual_review_digest_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  send_date     DATE NOT NULL,
  aep_due_date  DATE,                            -- the AEP next-review-due date at send time
  whmp_due_date DATE,                            -- the WHMP next-review-due date at send time
  reasons       TEXT[] NOT NULL DEFAULT '{}',    -- which modules triggered: aep / whmp
  recipient     TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_id, send_date)
);

CREATE INDEX IF NOT EXISTS idx_annual_review_digest_log_send_date
  ON annual_review_digest_log (send_date);

COMMENT ON TABLE annual_review_digest_log IS
  'Per-day dedup log for the AEP/WHMP annual-review digest cron. UNIQUE (base, day) makes the cron safely re-runnable.';
