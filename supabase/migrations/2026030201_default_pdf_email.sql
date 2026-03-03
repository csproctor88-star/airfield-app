-- Add default PDF email column to profiles
ALTER TABLE public.profiles ADD COLUMN default_pdf_email text;
