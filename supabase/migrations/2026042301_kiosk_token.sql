-- ============================================================
-- Per-base kiosk token.
--
-- The /kiosk/<ICAO> auto-login URL previously trusted the ICAO alone,
-- but ICAO codes are public knowledge — anyone could guess /kiosk/KBCV
-- and land on a base's status board once the shared KIOSK_PASSWORD env
-- var was set.
--
-- This migration adds a per-base opaque token. The kiosk URL becomes
--   /kiosk/<ICAO>?token=<long-random>
-- and the route handler rejects any request that doesn't carry the
-- exact token for that base. Bases with NULL kiosk_token cannot be
-- accessed via the kiosk URL at all — explicit opt-in.
-- ============================================================

ALTER TABLE public.bases
  ADD COLUMN IF NOT EXISTS kiosk_token TEXT;

-- Partial index for the lookup path in the /kiosk route. Bases without
-- a token are skipped entirely, so index only the rows that matter.
CREATE INDEX IF NOT EXISTS idx_bases_kiosk_token
  ON public.bases (kiosk_token)
  WHERE kiosk_token IS NOT NULL;

COMMENT ON COLUMN public.bases.kiosk_token IS
  'Opaque random token required in the /kiosk/<ICAO>?token=... URL. NULL disables kiosk URL for this base. Treat like a share link — anyone with the full URL can view the airfield status board.';
