-- Add 'signature_required' (trainee-owed signature, fired by the daily
-- reconcile) to the amtr_notifications kind CHECK. Additive (expand) change.
ALTER TABLE amtr_notifications DROP CONSTRAINT IF EXISTS amtr_notifications_kind_check;
ALTER TABLE amtr_notifications ADD CONSTRAINT amtr_notifications_kind_check
  CHECK (kind IN
    ('training_due','signoff','entry_623a','item_797_added','signature_797','signature_required'));
