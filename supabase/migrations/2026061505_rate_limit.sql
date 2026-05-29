-- Server-side rate limiting for unauthenticated email-sending endpoints
-- (/api/forgot-password, /api/signup-email, /api/send-ppr-confirmation).
--
-- These routes trigger Resend emails / account creation with no auth, so a
-- script can spam arbitrary addresses and burn the Resend quota. The only
-- prior throttle was a client-side localStorage cooldown on the feedback form,
-- which is trivially bypassed. The app runs on Vercel serverless, so an
-- in-memory limiter wouldn't be shared across instances — state must be
-- durable. This is the Postgres-backed limiter: a hit-log table plus a
-- SECURITY DEFINER RPC that does a sliding-window count.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket TEXT NOT NULL,                       -- e.g. 'forgot-password:email:foo@bar.mil'
  hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookups are always (bucket, recent hit_at).
CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_time_idx
  ON rate_limit_hits (bucket, hit_at);

-- No client ever reads/writes this table directly — only the RPC below, which
-- runs as the table owner. Enable RLS with no policies so direct PostgREST
-- access (even with a leaked anon key) is denied.
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;

-- check_rate_limit(bucket, max, window_seconds) -> allowed?
--
-- Sliding window: prune the bucket's expired hits, count what remains, and if
-- it's already at the cap return false (deny) WITHOUT recording. Otherwise
-- record this hit and return true (allow). Pruning on each call keeps the
-- table bounded to roughly (active buckets x hits-per-window).
--
-- Minor over-count is possible under concurrent calls (count-then-insert isn't
-- atomic); acceptable for an email/abuse throttle.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_bucket          TEXT,
  p_max             INTEGER,
  p_window_seconds  INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM rate_limit_hits
   WHERE bucket = p_bucket
     AND hit_at < now() - make_interval(secs => p_window_seconds);

  SELECT count(*) INTO v_count
    FROM rate_limit_hits
   WHERE bucket = p_bucket;

  IF v_count >= p_max THEN
    RETURN false;
  END IF;

  INSERT INTO rate_limit_hits (bucket) VALUES (p_bucket);
  RETURN true;
END;
$$;

-- Callable only from trusted server contexts (service role bypasses grants;
-- authenticated server clients may also call it). Never exposed to anon, so a
-- stranger can't bloat the table with arbitrary buckets via PostgREST.
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role, authenticated;
