-- Per-user page-view capture (aggregated daily rollup)
--
-- The activity_log only records write/mutation events, so it can't answer
-- "which features do users actually open / read?" This adds lightweight
-- page-view capture for the sys-admin user-activity monitoring view.
--
-- Design: an aggregated daily rollup, NOT one row per hit. The client
-- normalizes each route to a pattern (e.g. /discrepancies/[id]) and calls
-- record_page_view(); the row for (user, base, route, today) is upserted
-- with count = count + 1. Row growth is bounded to
-- (active users x distinct routes x days), which stays tiny.
--
-- Privacy: this is admin-visible per-user usage tracking. Reads are gated to
-- admins only (sys admin, or users:view at the row's base). Writes happen
-- exclusively through the SECURITY DEFINER RPC below (stamped with auth.uid()),
-- so a client can't forge another user's rows or read the table directly.

CREATE TABLE IF NOT EXISTS public.page_view_daily (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_id        UUID NOT NULL REFERENCES public.bases(id) ON DELETE CASCADE,
  route          TEXT NOT NULL,
  view_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  count          INTEGER NOT NULL DEFAULT 1,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, base_id, route, view_date)
);

-- Aggregation query shapes: app-wide (base, recent dates) and per-user.
CREATE INDEX IF NOT EXISTS page_view_daily_base_date_idx ON public.page_view_daily (base_id, view_date);
CREATE INDEX IF NOT EXISTS page_view_daily_user_date_idx ON public.page_view_daily (user_id, view_date);

ALTER TABLE public.page_view_daily ENABLE ROW LEVEL SECURITY;

-- Admins only: a sys admin sees everything; a base admin (users:view at the
-- base) sees their base's rows. No self-read for ordinary users — this is
-- admin telemetry, not a personal dashboard.
DROP POLICY IF EXISTS "page_view_daily_select_admin" ON public.page_view_daily;
CREATE POLICY "page_view_daily_select_admin" ON public.page_view_daily
  FOR SELECT TO authenticated
  USING (
    user_is_sys_admin(auth.uid())
    OR (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'users:view'))
  );

GRANT SELECT ON public.page_view_daily TO authenticated;

-- record_page_view(route, base_id) — upsert today's rollup row for the caller.
-- SECURITY DEFINER so it writes despite the table having no client INSERT/UPDATE
-- policy. Stamps user_id from auth.uid() (clients can't attribute to others) and
-- no-ops unless the caller actually has access to the base.
CREATE OR REPLACE FUNCTION public.record_page_view(
  p_route   TEXT,
  p_base_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_base_id IS NULL OR p_route IS NULL OR p_route = '' THEN
    RETURN;
  END IF;
  IF NOT user_has_base_access(v_uid, p_base_id) THEN
    RETURN;
  END IF;

  INSERT INTO page_view_daily (user_id, base_id, route, view_date, count, last_viewed_at)
  VALUES (v_uid, p_base_id, p_route, CURRENT_DATE, 1, now())
  ON CONFLICT (user_id, base_id, route, view_date)
  DO UPDATE SET count = page_view_daily.count + 1, last_viewed_at = now();
END;
$$;

-- Authenticated callers only — never anon (matches the security-linter
-- hardening convention for privileged SECURITY DEFINER RPCs).
REVOKE ALL ON FUNCTION public.record_page_view(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_page_view(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_page_view(TEXT, UUID) TO authenticated;
