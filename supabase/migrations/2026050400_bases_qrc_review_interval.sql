-- ============================================================
-- Per-base QRC review interval
--
-- Bases pick whether operators must re-review each QRC every
-- calendar month or every calendar quarter. Drives the threshold
-- on the /qrc Reviews tab (30 vs 90 days), the period picker
-- (month vs quarter), and the consolidated compliance PDF
-- (title, subtitle, window, filename).
--
-- Default is 'monthly' to preserve current behavior for existing
-- bases. Per-template override is not supported — interval is
-- base-wide.
-- ============================================================

ALTER TABLE bases
  ADD COLUMN qrc_review_interval TEXT NOT NULL DEFAULT 'monthly'
  CHECK (qrc_review_interval IN ('monthly', 'quarterly'));
