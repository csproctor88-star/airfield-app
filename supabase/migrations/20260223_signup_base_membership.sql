-- Auto-create profile + base_members row when a new user signs up.
--
-- This trigger function fires AFTER INSERT on auth.users. It:
--   1. Creates a profile row with first_name, last_name, rank, role
--   2. Sets primary_base_id from the auth metadata if provided
--   3. Inserts a base_members row so the user passes RLS checks
--
-- If you already have a handle_new_user() function, this REPLACES it.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_id    UUID;
  v_first_name TEXT;
  v_last_name  TEXT;
  v_rank       TEXT;
  v_role       TEXT;
  v_name       TEXT;
BEGIN
  -- Extract metadata
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_rank       := NULLIF(NEW.raw_user_meta_data->>'rank', '');
  v_role       := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'read_only');
  v_base_id    := NULLIF(NEW.raw_user_meta_data->>'primary_base_id', '')::UUID;

  -- Build composite name for backwards compatibility
  v_name := TRIM(COALESCE(v_first_name, '') || ' ' || COALESCE(v_last_name, ''));
  IF v_name = '' THEN
    v_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
  END IF;

  -- 1. Upsert profile row
  INSERT INTO public.profiles (id, email, name, first_name, last_name, rank, primary_base_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_name,
    NULLIF(v_first_name, ''),
    NULLIF(v_last_name, ''),
    v_rank,
    v_base_id,
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email           = EXCLUDED.email,
    name            = COALESCE(NULLIF(EXCLUDED.name, ''), profiles.name),
    first_name      = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name       = COALESCE(EXCLUDED.last_name, profiles.last_name),
    rank            = COALESCE(EXCLUDED.rank, profiles.rank),
    primary_base_id = COALESCE(EXCLUDED.primary_base_id, profiles.primary_base_id),
    role            = COALESCE(NULLIF(EXCLUDED.role, 'read_only'), profiles.role),
    updated_at      = now();

  -- 2. Insert base_members row (skip if no base selected or base doesn't exist)
  IF v_base_id IS NOT NULL THEN
    INSERT INTO public.base_members (base_id, user_id, role)
    VALUES (v_base_id, NEW.id, v_role)
    ON CONFLICT (base_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger (drop first to be idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
