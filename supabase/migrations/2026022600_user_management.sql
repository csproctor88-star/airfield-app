-- ============================================================
-- User Management: schema changes & RLS policies
-- ============================================================

-- 1. Add 'status' column to profiles (active/deactivated/pending)
--    This is more granular than the existing is_active boolean.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
  -- Values: 'active', 'deactivated', 'pending'

-- Backfill: sync status from is_active boolean
UPDATE profiles SET status = 'active' WHERE is_active = TRUE AND status = 'active';
UPDATE profiles SET status = 'deactivated' WHERE is_active = FALSE;

-- 2. Indexes for user management queries
CREATE INDEX IF NOT EXISTS idx_profiles_primary_base_id ON profiles(primary_base_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- 3. Helper function: check if user is base_admin at a specific base
CREATE OR REPLACE FUNCTION user_is_base_admin_at(p_user_id UUID, p_base_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND role = 'base_admin'
      AND primary_base_id = p_base_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. RLS policy updates for profiles
--    Existing policies:
--      profiles_select (FOR SELECT, TRUE) — keep as-is
--      profiles_update_own (FOR UPDATE, id = auth.uid()) — keep as-is
--    New policies for admin management:

-- System admins can update any profile
CREATE POLICY "profiles_update_sys_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- Base admins can update profiles at their own base
CREATE POLICY "profiles_update_base_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (
    user_is_base_admin_at(auth.uid(), profiles.primary_base_id)
  );

-- System admins can delete profiles
CREATE POLICY "profiles_delete_sys_admin" ON profiles
  FOR DELETE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- System admins can insert profiles (for invite flow)
CREATE POLICY "profiles_insert_sys_admin" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_is_sys_admin(auth.uid()));

-- Base admins can insert profiles at their own base (for invite flow)
CREATE POLICY "profiles_insert_base_admin" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_is_base_admin_at(auth.uid(), primary_base_id)
  );
