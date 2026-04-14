-- DAFMAN 13-204v1 Para 2.5.2.10.3 / 10.4 digital sign-off workflow.
-- Shift leads (AMSLs) sign their shifts; NAMO and AFM add supervisory certifications.
-- Replaces the T-3 waiver for CAC signature on AF Form 3616.

-- Per-base shift count: 2 = day + swing, 3 = day + swing + mid
ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS shift_count SMALLINT NOT NULL DEFAULT 2
  CHECK (shift_count IN (2, 3));

CREATE TABLE IF NOT EXISTS daily_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,

  day_amsl_signed_by UUID REFERENCES profiles(id),
  day_amsl_signed_at TIMESTAMPTZ,
  day_amsl_notes TEXT,
  day_amsl_events_hash TEXT,

  swing_amsl_signed_by UUID REFERENCES profiles(id),
  swing_amsl_signed_at TIMESTAMPTZ,
  swing_amsl_notes TEXT,
  swing_amsl_events_hash TEXT,

  mid_amsl_signed_by UUID REFERENCES profiles(id),
  mid_amsl_signed_at TIMESTAMPTZ,
  mid_amsl_notes TEXT,
  mid_amsl_events_hash TEXT,

  namo_signed_by UUID REFERENCES profiles(id),
  namo_signed_at TIMESTAMPTZ,
  namo_notes TEXT,
  namo_events_hash TEXT,

  afm_signed_by UUID REFERENCES profiles(id),
  afm_signed_at TIMESTAMPTZ,
  afm_notes TEXT,
  afm_events_hash TEXT,

  fully_certified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (base_id, review_date)
);

CREATE INDEX IF NOT EXISTS daily_reviews_base_date_idx ON daily_reviews (base_id, review_date DESC);

-- RLS: base-scoped read, writable by any role with base access (app enforces per-slot role).
ALTER TABLE daily_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_reviews_select" ON daily_reviews
  FOR SELECT USING (user_has_base_access(base_id));

CREATE POLICY "daily_reviews_insert" ON daily_reviews
  FOR INSERT WITH CHECK (user_has_base_access(base_id) AND user_can_write());

CREATE POLICY "daily_reviews_update" ON daily_reviews
  FOR UPDATE USING (user_has_base_access(base_id) AND user_can_write());
