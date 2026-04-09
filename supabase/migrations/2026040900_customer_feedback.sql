-- Customer Feedback — public form submissions from QR code scans
-- Each base configures their own form fields and generates a QR code

-- Form configuration stored on bases table
ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS feedback_form_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Feedback submissions
CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  -- Common fields
  name TEXT,
  email TEXT,
  organization TEXT,
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  comments TEXT,
  -- Custom field responses (keyed by field id)
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Metadata
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT -- hashed for rate limiting, not stored raw
);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_base ON customer_feedback(base_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_date ON customer_feedback(base_id, submitted_at DESC);

-- RLS: anyone can insert (public form), only authenticated base members can read
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON customer_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Base members can read feedback"
  ON customer_feedback FOR SELECT
  TO authenticated
  USING (base_id IN (
    SELECT p.base_id FROM profiles p WHERE p.id = auth.uid()
    UNION
    SELECT uba.base_id FROM user_base_access uba WHERE uba.user_id = auth.uid()
  ));

CREATE POLICY "Admins can delete feedback"
  ON customer_feedback FOR DELETE
  TO authenticated
  USING (base_id IN (
    SELECT p.base_id FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('sys_admin', 'base_admin', 'airfield_manager')
  ));
