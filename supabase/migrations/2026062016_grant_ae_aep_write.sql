-- Grant the Accountable Executive role aep:write.
--
-- The AE previously had aep:read + aep:sign but not aep:write, so an AE could
-- view and sign the Airport Emergency Plan but not author/upload it — the AEP
-- create/upload then failed the storage + table RLS (aep:write) with a generic
-- permission error. At small Part 139 airports the Accountable Executive
-- commonly manages the AEP directly, so the AE is granted authoring rights.
-- The page already gates the create/upload affordance on aep:write
-- (usePermissions → has(AEP_WRITE)), so roles without it (e.g. sms_manager)
-- still see a read-only view.
INSERT INTO role_permissions (role, permission_key)
SELECT 'accountable_executive', 'aep:write'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role = 'accountable_executive' AND permission_key = 'aep:write'
);
