-- Customer Feedback — public form submissions from QR code scans

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS feedback_form_config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  organization TEXT,
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  comments TEXT,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_base ON customer_feedback(base_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_date ON customer_feedback(base_id, submitted_at DESC);

ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON customer_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Base members can read feedback"
  ON customer_feedback FOR SELECT
  TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "Admins can delete feedback"
  ON customer_feedback FOR DELETE
  TO authenticated
  USING (user_is_admin(auth.uid()));
