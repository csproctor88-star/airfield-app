-- 2026061602_kiosk_token_drop_column.sql  (CONTRACT — run ONLY after deploy)
--
-- Removes the now-unused, publicly-readable bases.kiosk_token column. The secret
-- already lives in base_kiosk_tokens (migration 2026061601) and the deployed
-- code no longer reads or writes bases.kiosk_token.
--
-- ⚠️  DO NOT APPLY until the code that uses base_kiosk_tokens + kiosk_enabled
--     (kiosk route, admin/kiosk-token route, base-config page) is live in
--     production. Applying it while the old code is still deployed would 500
--     the old kiosk/admin routes that still SELECT/UPDATE this column.
--
-- This file is intentionally NOT applied by the Phase 1 migration step; it is a
-- documented post-deploy follow-up.

DROP INDEX IF EXISTS public.idx_bases_kiosk_token;
ALTER TABLE public.bases DROP COLUMN IF EXISTS kiosk_token;
