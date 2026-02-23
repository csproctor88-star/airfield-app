-- Auto-create base_members row when a new user signs up with a primary_base_id.
--
-- This trigger function fires AFTER INSERT on auth.users. It:
--   1. Creates a profile row (standard Supabase pattern)
--   2. Sets primary_base_id from the auth metadata if provided
--   3. Inserts a base_members row so the user passes RLS checks
--
-- If you already have a handle_new_user() function, this REPLACES it.
-- Make sure the existing logic is preserved in the body below.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_id UUID;
  v_name    TEXT;
BEGIN
  -- Extract metadata
  v_name    := COALESCE(NEW.raw_user_meta_data->>'name', '');
  v_base_id := NULLIF(NEW.raw_user_meta_data->>'primary_base_id', '')::UUID;

  -- 1. Upsert profile row
  INSERT INTO public.profiles (id, email, name, primary_base_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_name,
    v_base_id,
    'observer'
  )
  ON CONFLICT (id) DO UPDATE SET
    email           = EXCLUDED.email,
    name            = COALESCE(NULLIF(EXCLUDED.name, ''), profiles.name),
    primary_base_id = COALESCE(EXCLUDED.primary_base_id, profiles.primary_base_id),
    updated_at      = now();

  -- 2. Insert base_members row (skip if no base selected or base doesn't exist)
  IF v_base_id IS NOT NULL THEN
    INSERT INTO public.base_members (base_id, user_id, role)
    VALUES (v_base_id, NEW.id, 'observer')
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
