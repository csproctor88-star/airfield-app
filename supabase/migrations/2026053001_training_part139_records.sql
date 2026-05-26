-- ============================================================
-- Phase 3a step 2 — §139.303 Training: completion records + renewals
--
-- training_records is the append-only log of (user, topic) completions
-- with a stored expires_at set by the _training_set_expiry trigger at
-- INSERT time from the topic's current recurrent_frequency_months.
-- Storing the value (rather than GENERATEing it live) protects the
-- record's intent against later changes to topic frequency — an FAA
-- inspector reviewing a 2025 record sees the expiry that applied when
-- the training was logged, not whatever the topic says today.
--
-- training_renewals chains records explicitly: (previous_record_id,
-- renewed_record_id). This lets backfilled history not require strict
-- chronological order on completed_at and makes the supersession order
-- readable in an inspector packet. base_id is denormalized onto the
-- chain row so RLS can gate it without joining records.
-- ============================================================

CREATE TABLE IF NOT EXISTS training_records (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id                   UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id                  UUID NOT NULL REFERENCES training_topics(id) ON DELETE RESTRICT,
  completed_at              DATE NOT NULL,
  training_type             TEXT NOT NULL CHECK (training_type IN ('initial','recurrent','remedial')),
  instructor_user_id        UUID REFERENCES profiles(id),
  instructor_name_external  TEXT,
  evidence_url              TEXT,
  expires_at                DATE,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID REFERENCES profiles(id),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_records_base_user_topic ON training_records (base_id, user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_training_records_base_expires   ON training_records (base_id, expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_records_user           ON training_records (user_id);

COMMENT ON TABLE  training_records IS '§139.303 per-user training completion log. Append-only; supersession via training_renewals.';
COMMENT ON COLUMN training_records.expires_at IS 'Set by trigger _training_set_expiry at insert time from the topic''s recurrent_frequency_months. NULL only if topic has no recurrent cadence.';

-- ── Expiry trigger ──────────────────────────────────────────
-- Pulls the topic's frequency at insert time so the stored value
-- captures the rule that was in effect when the training was logged.
CREATE OR REPLACE FUNCTION _training_set_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  freq_months INT;
BEGIN
  IF NEW.expires_at IS NULL THEN
    SELECT recurrent_frequency_months INTO freq_months
      FROM training_topics
      WHERE id = NEW.topic_id;
    IF freq_months IS NOT NULL AND freq_months > 0 THEN
      NEW.expires_at := NEW.completed_at + (freq_months || ' months')::INTERVAL;
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_records_set_expiry ON training_records;
CREATE TRIGGER training_records_set_expiry
  BEFORE INSERT OR UPDATE ON training_records
  FOR EACH ROW EXECUTE FUNCTION _training_set_expiry();

-- ── Renewal chain ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_renewals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id             UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  previous_record_id  UUID NOT NULL REFERENCES training_records(id) ON DELETE CASCADE,
  renewed_record_id   UUID NOT NULL REFERENCES training_records(id) ON DELETE CASCADE,
  renewed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (previous_record_id, renewed_record_id)
);

CREATE INDEX IF NOT EXISTS idx_training_renewals_renewed ON training_renewals (renewed_record_id);
CREATE INDEX IF NOT EXISTS idx_training_renewals_base    ON training_renewals (base_id);

COMMENT ON TABLE training_renewals IS 'Explicit supersession chain. previous → renewed. Both records remain in training_records (24-month retention per §139.303).';
