-- 2026061601_kiosk_token_isolation.sql  (EXPAND — backward compatible, safe to apply anytime)
--
-- The kiosk_token lived as a plain column on `bases`, whose SELECT policy is
-- `USING (TRUE)` for all authenticated users — so any logged-in user could read
-- every base's secret kiosk token and open another base's status board.
--
-- Fix: move the secret into its own table that ONLY the service role can read
-- (RLS on, no policies, privileges revoked from anon/authenticated). The kiosk
-- auto-login route and the admin generate/rotate route both use the service-role
-- client, so they keep working. For the UI, a non-secret boolean
-- `bases.kiosk_enabled` indicates whether a token exists (knowing a base HAS a
-- kiosk URL is not sensitive — only the token value is).
--
-- EXPAND/CONTRACT: this migration is additive and leaves bases.kiosk_token in
-- place + populated, so the currently-deployed code keeps working. The exposed
-- column is removed by the follow-up 2026061602_kiosk_token_drop_column.sql,
-- which MUST be run only AFTER the new code (reading base_kiosk_tokens +
-- kiosk_enabled) is deployed.

-- 1) Protected token table — service-role only.
CREATE TABLE IF NOT EXISTS public.base_kiosk_tokens (
  base_id    uuid PRIMARY KEY REFERENCES public.bases(id) ON DELETE CASCADE,
  token      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.base_kiosk_tokens ENABLE ROW LEVEL SECURITY;
-- No policies → every non-service-role principal is denied. Belt-and-suspenders:
-- also strip table privileges so a future stray policy can't accidentally expose it.
REVOKE ALL ON public.base_kiosk_tokens FROM anon, authenticated;

-- 2) Non-secret "is a kiosk URL configured?" flag for the base-setup UI.
ALTER TABLE public.bases
  ADD COLUMN IF NOT EXISTS kiosk_enabled boolean NOT NULL DEFAULT false;

-- 3) Copy existing tokens into the protected table and set the flag.
--    (bases.kiosk_token is intentionally left intact here — see header.)
INSERT INTO public.base_kiosk_tokens (base_id, token)
SELECT id, kiosk_token FROM public.bases WHERE kiosk_token IS NOT NULL
ON CONFLICT (base_id) DO UPDATE SET token = EXCLUDED.token, updated_at = now();

UPDATE public.bases SET kiosk_enabled = (kiosk_token IS NOT NULL);

COMMENT ON TABLE public.base_kiosk_tokens IS
  'Per-base kiosk auto-login secret. Service-role only (RLS on, no policies). Read/written exclusively by app/kiosk/[icao]/route.ts and app/api/admin/kiosk-token/route.ts.';
COMMENT ON COLUMN public.bases.kiosk_enabled IS
  'True when a kiosk URL/token is configured for this base. Non-secret; safe to expose to authenticated users. The token itself lives in base_kiosk_tokens.';
