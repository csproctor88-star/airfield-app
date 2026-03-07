-- Add annual review tracking fields to QRC templates
ALTER TABLE qrc_templates ADD COLUMN last_reviewed_at TIMESTAMPTZ;
ALTER TABLE qrc_templates ADD COLUMN last_reviewed_by UUID;
ALTER TABLE qrc_templates ADD COLUMN review_notes TEXT;
