-- 2026062401_flip_appointment.sql
-- Structured "Current Appointment Letter" for the FLIP Home page: the uploaded
-- appointment-letter file plus the designated custodians (primary + alternates).
-- One row per base. Replaces the free-text appt_letter section in the UI.

CREATE TABLE flip_appointment (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL UNIQUE REFERENCES bases(id) ON DELETE CASCADE,
  file_path  TEXT,                              -- storage path in the 'flip' bucket
  file_name  TEXT,
  custodians JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ name, role: 'primary'|'alternate' }]
  notes      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE flip_appointment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flip_appointment_select" ON flip_appointment FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:view'));
CREATE POLICY "flip_appointment_insert" ON flip_appointment FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
CREATE POLICY "flip_appointment_update" ON flip_appointment FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
