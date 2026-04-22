-- ============================================================
-- Phase C — New roles + Safety RPC
--
-- 1. Seed role_permissions for three NEW roles:
--      • airfield_status  — kiosk; only airfield_status:view
--      • ppr              — PPR Log writer, Airfield Status viewer
--      • majcom_rfm       — multi-base read-only across assigned bases
-- 2. Expand `safety` role:
--      • wildlife:view/write/delete (log sightings & strikes)
--      • airfield_status:write:rsc_bwc_only (narrow write via RPC)
-- 3. Tighten `atc` to match `airfield_status` kiosk (per user
--    direction: "same abilities as the Airfield Status Role").
-- 4. safety_update_rsc_bwc(...) SECURITY DEFINER RPC that lets
--    the narrow permission write RSC / RCR / BWC on airfield_status
--    (which otherwise requires full `airfield_status:write`).
--
-- Idempotent — uses DELETE+INSERT on role_permissions for the four
-- roles touched here.
-- ============================================================

-- ── Clear prior presets for the four roles we're (re)defining ─
DELETE FROM role_permissions WHERE role IN ('safety', 'atc', 'airfield_status', 'ppr', 'majcom_rfm');

-- ── safety — Wildlife write + narrow RSC/BWC + views ──────
INSERT INTO role_permissions (role, permission_key) VALUES
  ('safety', 'airfield_status:view'),
  ('safety', 'airfield_status:write:rsc_bwc_only'),
  ('safety', 'wildlife:view'),
  ('safety', 'wildlife:write'),
  ('safety', 'wildlife:delete'),
  ('safety', 'activity_log:view'),
  ('safety', 'training:view'),
  ('safety', 'settings:view');

-- ── atc — Kiosk-equivalent; only airfield_status view ──────
-- Per user direction: keep for future ATC-specific modules, but
-- for now atc == airfield_status (view-only). Training + settings
-- kept so they can see their own profile and open the training
-- page the user mentioned is cross-cutting.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('atc', 'airfield_status:view'),
  ('atc', 'training:view'),
  ('atc', 'settings:view');

-- ── airfield_status — Kiosk login; view only ───────────────
-- Per user direction: generic per-base login, sees only the
-- airfield status page, no other nav.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('airfield_status', 'airfield_status:view');

-- ── ppr — PPR Log + Airfield Status views + write PPR entries ─
INSERT INTO role_permissions (role, permission_key) VALUES
  ('ppr', 'airfield_status:view'),
  ('ppr', 'ppr:view'),
  ('ppr', 'ppr:write'),
  ('ppr', 'training:view'),
  ('ppr', 'settings:view');

-- ── majcom_rfm — Multi-base read-only + installation switcher ─
-- Every `*:view` key (reference + modules + admin-view). No write,
-- no delete, no sign. Uses base_members rows for base assignments.
INSERT INTO role_permissions (role, permission_key)
SELECT 'majcom_rfm', key FROM permissions
WHERE key LIKE '%:view'
   OR key IN ('aircraft:view','regulations:view','training:view','settings:view','installations:switch','reports:export');

-- ── Safety narrow-write RPC ────────────────────────────────
-- Updates only RSC, RCR (touchdown/midpoint/rollout/condition),
-- and BWC on airfield_status. Caller must hold
-- `airfield_status:write:rsc_bwc_only` (or the full
-- `airfield_status:write`), plus base access. Writes both the
-- _updated_at timestamps and the runway_status_log audit row for
-- RSC/BWC changes so the Daily Ops PDF picks them up.
CREATE OR REPLACE FUNCTION public.safety_update_rsc_bwc(
  p_base_id UUID,
  p_rsc_condition TEXT DEFAULT NULL,
  p_rcr_touchdown TEXT DEFAULT NULL,
  p_rcr_midpoint  TEXT DEFAULT NULL,
  p_rcr_rollout   TEXT DEFAULT NULL,
  p_rcr_condition TEXT DEFAULT NULL,
  p_bwc_value     TEXT DEFAULT NULL,
  p_reason        TEXT DEFAULT NULL
)
RETURNS airfield_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_old     airfield_status;
  v_updated airfield_status;
  v_rsc_changed BOOLEAN := FALSE;
  v_bwc_changed BOOLEAN := FALSE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (public.user_has_permission(v_caller, 'airfield_status:write:rsc_bwc_only')
          OR public.user_has_permission(v_caller, 'airfield_status:write')) THEN
    RAISE EXCEPTION 'permission denied: airfield_status:write:rsc_bwc_only';
  END IF;

  IF NOT public.user_has_base_access(v_caller, p_base_id) THEN
    RAISE EXCEPTION 'permission denied: no access to base %', p_base_id;
  END IF;

  SELECT * INTO v_old FROM airfield_status WHERE base_id = p_base_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'airfield_status row not found for base %', p_base_id;
  END IF;

  -- Detect what changed (for the audit log)
  v_rsc_changed := (
    (p_rsc_condition IS NOT NULL AND p_rsc_condition IS DISTINCT FROM v_old.rsc_condition)
    OR (p_rcr_touchdown IS NOT NULL AND p_rcr_touchdown IS DISTINCT FROM v_old.rcr_touchdown)
    OR (p_rcr_midpoint  IS NOT NULL AND p_rcr_midpoint  IS DISTINCT FROM v_old.rcr_midpoint)
    OR (p_rcr_rollout   IS NOT NULL AND p_rcr_rollout   IS DISTINCT FROM v_old.rcr_rollout)
    OR (p_rcr_condition IS NOT NULL AND p_rcr_condition IS DISTINCT FROM v_old.rcr_condition)
  );
  v_bwc_changed := (p_bwc_value IS NOT NULL AND p_bwc_value IS DISTINCT FROM v_old.bwc_value);

  UPDATE airfield_status SET
    rsc_condition  = COALESCE(p_rsc_condition,  rsc_condition),
    rcr_touchdown  = COALESCE(p_rcr_touchdown,  rcr_touchdown),
    rcr_midpoint   = COALESCE(p_rcr_midpoint,   rcr_midpoint),
    rcr_rollout    = COALESCE(p_rcr_rollout,    rcr_rollout),
    rcr_condition  = COALESCE(p_rcr_condition,  rcr_condition),
    bwc_value      = COALESCE(p_bwc_value,      bwc_value),
    rsc_updated_at = CASE WHEN v_rsc_changed THEN now() ELSE rsc_updated_at END,
    rcr_updated_at = CASE WHEN v_rsc_changed THEN now() ELSE rcr_updated_at END,
    bwc_updated_at = CASE WHEN v_bwc_changed THEN now() ELSE bwc_updated_at END
  WHERE base_id = p_base_id
  RETURNING * INTO v_updated;

  -- Audit row (runway_status_log has no base_id scope today — see
  -- SESSION_HANDOFF; log it with a Safety: prefix on reason).
  IF v_rsc_changed OR v_bwc_changed THEN
    INSERT INTO runway_status_log (
      old_runway_status, new_runway_status,
      old_advisory_type, new_advisory_type,
      old_advisory_text, new_advisory_text,
      changed_by, reason
    ) VALUES (
      NULL, NULL, NULL, NULL, NULL, NULL,
      v_caller,
      COALESCE(p_reason, '') ||
      CASE WHEN v_rsc_changed THEN ' [RSC updated]' ELSE '' END ||
      CASE WHEN v_bwc_changed THEN ' [BWC updated]' ELSE '' END
    );
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.safety_update_rsc_bwc(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
