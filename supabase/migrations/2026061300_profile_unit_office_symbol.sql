-- Add Unit + Office Symbol to user profiles
--
-- These are USAF identity fields commonly needed alongside Rank and
-- EDIPI. Both are nullable — civilian users / contractors don't
-- always have them, and we don't want to gate signup on military
-- identity fields that may not apply.
--
-- Sources for value:
--   1. Self-service signup form (login page) — passed via
--      raw_user_meta_data through handle_new_user().
--   2. Settings → Profile (self-edit).
--   3. /users admin modal (admin edit) — passes through the existing
--      PATCH /api/admin/users/[id] route which already accepts an
--      arbitrary updates payload.
--
-- handle_new_user() is updated below to read both fields from
-- raw_user_meta_data on INSERT. CREATE OR REPLACE rewrites the
-- function body without dropping the trigger that depends on it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unit          TEXT,
  ADD COLUMN IF NOT EXISTS office_symbol TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_id        UUID;
  v_first_name     TEXT;
  v_last_name      TEXT;
  v_rank           TEXT;
  v_role           TEXT;
  v_name           TEXT;
  v_unit           TEXT;
  v_office_symbol  TEXT;
BEGIN
  v_first_name    := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name     := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_rank          := NULLIF(NEW.raw_user_meta_data->>'rank', '');
  v_role          := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'read_only');
  v_base_id       := NULLIF(NEW.raw_user_meta_data->>'primary_base_id', '')::UUID;
  v_unit          := NULLIF(NEW.raw_user_meta_data->>'unit', '');
  v_office_symbol := NULLIF(NEW.raw_user_meta_data->>'office_symbol', '');

  v_name := TRIM(COALESCE(v_first_name, '') || ' ' || COALESCE(v_last_name, ''));
  IF v_name = '' THEN
    v_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
  END IF;

  INSERT INTO public.profiles (
    id, email, name, first_name, last_name, rank,
    primary_base_id, role, status, unit, office_symbol
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_name,
    NULLIF(v_first_name, ''),
    NULLIF(v_last_name, ''),
    v_rank,
    v_base_id,
    v_role,
    'pending',
    v_unit,
    v_office_symbol
  )
  ON CONFLICT (id) DO UPDATE SET
    email           = EXCLUDED.email,
    name            = COALESCE(NULLIF(EXCLUDED.name, ''), profiles.name),
    first_name      = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name       = COALESCE(EXCLUDED.last_name, profiles.last_name),
    rank            = COALESCE(EXCLUDED.rank, profiles.rank),
    primary_base_id = COALESCE(EXCLUDED.primary_base_id, profiles.primary_base_id),
    role            = COALESCE(NULLIF(EXCLUDED.role, 'read_only'), profiles.role),
    unit            = COALESCE(EXCLUDED.unit, profiles.unit),
    office_symbol   = COALESCE(EXCLUDED.office_symbol, profiles.office_symbol),
    updated_at      = now();

  IF v_base_id IS NOT NULL THEN
    INSERT INTO public.base_members (base_id, user_id, role)
    VALUES (v_base_id, NEW.id, v_role)
    ON CONFLICT (base_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
