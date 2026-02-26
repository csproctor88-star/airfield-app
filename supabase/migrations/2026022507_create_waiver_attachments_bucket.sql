-- Create storage bucket for waiver attachments (photos, site maps, AF Form 505, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('waiver-attachments', 'waiver-attachments', false, 52428800)
ON CONFLICT (id) DO NOTHING;
