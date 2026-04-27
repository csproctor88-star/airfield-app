-- ============================================================
-- PPR Module — public submissions, multi-agency coordination,
-- final approval, approval/confirmation emails.
--
-- "AMOPS" in status names below is the office (Airfield Management
-- Operations), not a role restriction. The triage and approve steps
-- are open to any user holding `ppr:triage` / `ppr:approve`, which
-- the seeds at the bottom of this migration grant to: AFM, NAMO,
-- AMOPS, base_admin, sys_admin.
--
-- Lifecycle:
--   pending_amops_triage   ← public submission lands here
--     │ approver picks which agencies must coordinate (or skips)
--     ▼
--   pending_coordination   ← (also where internal create with agencies starts)
--     │ all coord rows non-pending
--     ▼
--   pending_amops_approval ← approver approves or denies
--     │
--     ├─► approved           (sends approval email)
--     └─► denied
--
-- Internal create with "Pre-coordinated — no agencies needed"
-- skips straight to `approved`.
--
-- New tables:
--   ppr_agencies     — per-base list of free-text coordinating agencies
--   ppr_coordination — one row per (entry × selected agency)
--
-- Augmented tables:
--   ppr_entries  + status, requester_name/email, triage/approval audit
--                  fields, denial_reason, public_submission flag.
--   ppr_columns  + is_public flag (admin opts each column into the
--                   public form).
--   bases        + amops_email (used as reply-to on emails).
--
-- New permission keys:
--   ppr:triage      Triage step (assign agencies). Default grant to
--                   AFM / NAMO / AMOPS / base_admin / sys_admin.
--   ppr:coordinate  Any agency user acting on coord rows.
--   ppr:approve     Final approve / deny. Same default grant set as
--                   ppr:triage.
--
-- New RPCs (SECURITY DEFINER, callable by anon):
--   get_public_ppr_config(base_id)        — returns base name +
--                                            is_public columns.
--   submit_public_ppr_request(...)        — inserts ppr_entries with
--                                            status=pending_amops_triage.
--                                            Returns { ok: true } —
--                                            does NOT expose the
--                                            generated PPR number.
-- ============================================================

-- ── ppr_entries: status + requester + triage + approval audit ─
ALTER TABLE ppr_entries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN (
      'pending_amops_triage',
      'pending_coordination',
      'pending_amops_approval',
      'approved',
      'denied'
    )),
  ADD COLUMN IF NOT EXISTS requester_name   TEXT,
  ADD COLUMN IF NOT EXISTS requester_email  TEXT,
  ADD COLUMN IF NOT EXISTS triaged_by       UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS triaged_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_user_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approval_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS denial_reason    TEXT,
  ADD COLUMN IF NOT EXISTS public_submission BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ppr_entries_status ON ppr_entries(base_id, status);

-- ── ppr_columns: is_public flag ────────────────────────────
ALTER TABLE ppr_columns
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- ── bases: amops_email (reply-to on outbound PPR emails) ──
ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS amops_email TEXT;

-- ── ppr_agencies (per-base config) ─────────────────────────
CREATE TABLE IF NOT EXISTS ppr_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  agency_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, agency_name)
);

CREATE INDEX IF NOT EXISTS idx_ppr_agencies_base ON ppr_agencies(base_id, sort_order);

-- ── ppr_coordination (one row per entry × agency) ─────────
CREATE TABLE IF NOT EXISTS ppr_coordination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES ppr_entries(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES ppr_agencies(id) ON DELETE SET NULL,
  agency_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'concur', 'non_concur')),
  comment TEXT,
  coordinated_by UUID REFERENCES profiles(id),
  coordinated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppr_coordination_entry ON ppr_coordination(entry_id);
CREATE INDEX IF NOT EXISTS idx_ppr_coordination_agency_pending
  ON ppr_coordination(agency_id) WHERE status = 'pending';

-- ── RLS: ppr_agencies ──────────────────────────────────────
ALTER TABLE ppr_agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppr_agencies_select" ON ppr_agencies;
DROP POLICY IF EXISTS "ppr_agencies_insert" ON ppr_agencies;
DROP POLICY IF EXISTS "ppr_agencies_update" ON ppr_agencies;
DROP POLICY IF EXISTS "ppr_agencies_delete" ON ppr_agencies;

CREATE POLICY "ppr_agencies_select" ON ppr_agencies
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "ppr_agencies_insert" ON ppr_agencies
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

CREATE POLICY "ppr_agencies_update" ON ppr_agencies
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

CREATE POLICY "ppr_agencies_delete" ON ppr_agencies
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

-- ── RLS: ppr_coordination (scoped via parent entry) ───────
ALTER TABLE ppr_coordination ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppr_coordination_select" ON ppr_coordination;
DROP POLICY IF EXISTS "ppr_coordination_insert" ON ppr_coordination;
DROP POLICY IF EXISTS "ppr_coordination_update" ON ppr_coordination;
DROP POLICY IF EXISTS "ppr_coordination_delete" ON ppr_coordination;

CREATE POLICY "ppr_coordination_select" ON ppr_coordination
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ppr_entries e
      WHERE e.id = ppr_coordination.entry_id
        AND user_has_base_access(auth.uid(), e.base_id)
        AND user_has_permission(auth.uid(), 'ppr:view')
    )
  );

CREATE POLICY "ppr_coordination_insert" ON ppr_coordination
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ppr_entries e
      WHERE e.id = ppr_coordination.entry_id
        AND user_has_base_access(auth.uid(), e.base_id)
        AND (
          user_has_permission(auth.uid(), 'ppr:triage')
          OR user_has_permission(auth.uid(), 'ppr:write')
        )
    )
  );

CREATE POLICY "ppr_coordination_update" ON ppr_coordination
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ppr_entries e
      WHERE e.id = ppr_coordination.entry_id
        AND user_has_base_access(auth.uid(), e.base_id)
        AND user_has_permission(auth.uid(), 'ppr:coordinate')
    )
  );

CREATE POLICY "ppr_coordination_delete" ON ppr_coordination
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ppr_entries e
      WHERE e.id = ppr_coordination.entry_id
        AND user_has_base_access(auth.uid(), e.base_id)
        AND user_has_permission(auth.uid(), 'ppr:write')
    )
  );

-- ── New permission keys + role grants ─────────────────────
INSERT INTO permissions (key, label, category, description) VALUES
  ('ppr:triage',     'Triage PPR Submissions',
     'ops', 'Open a public PPR submission and assign which agencies must coordinate.'),
  ('ppr:coordinate', 'Coordinate on PPR Requests',
     'ops', 'Concur or non-concur on coordination rows assigned to any agency.'),
  ('ppr:approve',    'Approve / Deny PPR Requests',
     'ops', 'Final AMOPS approve or deny step after agency coordination.')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- triage + approve + coordinate seeded to all approver-class roles
-- (AFM, NAMO, AMOPS, base_admin, sys_admin). The plain `ppr` role
-- gets coordinate only — they don't triage or give final approval.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops',            'ppr:triage'),
  ('amops',            'ppr:approve'),
  ('amops',            'ppr:coordinate'),
  ('airfield_manager', 'ppr:triage'),
  ('airfield_manager', 'ppr:approve'),
  ('airfield_manager', 'ppr:coordinate'),
  ('namo',             'ppr:triage'),
  ('namo',             'ppr:approve'),
  ('namo',             'ppr:coordinate'),
  ('base_admin',       'ppr:triage'),
  ('base_admin',       'ppr:approve'),
  ('base_admin',       'ppr:coordinate'),
  ('sys_admin',        'ppr:triage'),
  ('sys_admin',        'ppr:approve'),
  ('sys_admin',        'ppr:coordinate'),
  -- ppr role: see + write entries (existing) + coordinate
  ('ppr',              'ppr:coordinate')
ON CONFLICT DO NOTHING;

-- ── PPR number generation helper (plpgsql port) ───────────
-- Mirrors lib/supabase/ppr.ts:generatePprNumber so the public
-- submission RPC can mint a number without the JS layer. OI is
-- empty for public submissions → falls through to 'XX' sentinel.
CREATE OR REPLACE FUNCTION public._ppr_generate_number(
  p_base_id UUID,
  p_arrival DATE,
  p_oi      TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq INT;
  v_jul INT;
BEGIN
  SELECT COUNT(*)::INT + 1 INTO v_seq
    FROM ppr_entries
   WHERE base_id = p_base_id
     AND arrival_date = p_arrival;

  v_jul := EXTRACT(DOY FROM p_arrival)::INT;

  RETURN
    LPAD(v_jul::TEXT, 3, '0') || '-' ||
    LPAD(v_seq::TEXT, 3, '0') || '-' ||
    COALESCE(NULLIF(p_oi, ''), 'XX');
END;
$$;

-- ── Public read: PPR config for the QR-form page ──────────
-- Returns the base name, whether the ppr module is enabled,
-- and the list of columns flagged is_public=true. Allows anon
-- callers to render the public form without a SELECT on bases.
CREATE OR REPLACE FUNCTION public.get_public_ppr_config(p_base_id UUID)
RETURNS TABLE (
  base_name      TEXT,
  module_enabled BOOLEAN,
  columns        JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT
    b.name AS base_name,
    CASE
      WHEN b.enabled_modules IS NULL THEN TRUE
      ELSE 'ppr' = ANY(b.enabled_modules)
    END AS module_enabled,
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id',          c.id,
                   'name',        c.column_name,
                   'type',        c.column_type,
                   'is_required', c.is_required,
                   'sort_order',  c.sort_order
                 )
                 ORDER BY c.sort_order, c.column_name
               )
          FROM ppr_columns c
         WHERE c.base_id = b.id
           AND c.is_public = TRUE
      ),
      '[]'::jsonb
    ) AS columns
  FROM bases b
  WHERE b.id = p_base_id
$$;

GRANT EXECUTE ON FUNCTION public.get_public_ppr_config(UUID) TO anon, authenticated;

-- ── Public write: submit a PPR request ────────────────────
-- Inserts into ppr_entries with status=pending_amops_triage.
-- Does NOT create coordination rows — AMOPS chooses agencies
-- in the triage step. Returns a generic ok flag; the caller
-- never sees the generated PPR number until AMOPS approves
-- and the approval email goes out.
CREATE OR REPLACE FUNCTION public.submit_public_ppr_request(
  p_base_id          UUID,
  p_requester_name   TEXT,
  p_requester_email  TEXT,
  p_arrival_date     DATE,
  p_column_values    JSONB,
  p_notes            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_base_exists  BOOLEAN;
  v_module_on    BOOLEAN;
  v_missing_keys TEXT[];
  v_ppr_number   TEXT;
BEGIN
  -- Base must exist
  SELECT EXISTS (SELECT 1 FROM bases WHERE id = p_base_id) INTO v_base_exists;
  IF NOT v_base_exists THEN
    RAISE EXCEPTION 'Base not found' USING ERRCODE = 'P0002';
  END IF;

  -- Module must be enabled on the base
  SELECT
    CASE
      WHEN enabled_modules IS NULL THEN TRUE
      ELSE 'ppr' = ANY(enabled_modules)
    END
  INTO v_module_on
  FROM bases
  WHERE id = p_base_id;

  IF NOT COALESCE(v_module_on, FALSE) THEN
    RAISE EXCEPTION 'PPR module is not enabled at this base' USING ERRCODE = 'P0001';
  END IF;

  -- Required public columns must all be present in the payload.
  -- (Empty string values count as missing — coerce via NULLIF.)
  SELECT COALESCE(array_agg(c.column_name), ARRAY[]::TEXT[])
    INTO v_missing_keys
    FROM ppr_columns c
   WHERE c.base_id = p_base_id
     AND c.is_public = TRUE
     AND c.is_required = TRUE
     AND COALESCE(NULLIF(p_column_values ->> c.id::TEXT, ''), NULL) IS NULL;

  IF array_length(v_missing_keys, 1) > 0 THEN
    RAISE EXCEPTION 'Missing required field(s): %', array_to_string(v_missing_keys, ', ')
      USING ERRCODE = 'P0001';
  END IF;

  -- Sanity bounds on requester contact (avoid silent NULLs).
  IF COALESCE(NULLIF(TRIM(p_requester_name), ''), NULL) IS NULL THEN
    RAISE EXCEPTION 'Requester name is required' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(NULLIF(TRIM(p_requester_email), ''), NULL) IS NULL THEN
    RAISE EXCEPTION 'Requester email is required' USING ERRCODE = 'P0001';
  END IF;

  -- Mint PPR number (uses 'XX' placeholder for the OI segment
  -- since there's no logged-in user on a public submission).
  v_ppr_number := public._ppr_generate_number(p_base_id, p_arrival_date, '');

  INSERT INTO ppr_entries (
    base_id,
    ppr_number,
    arrival_date,
    column_values,
    notes,
    status,
    requester_name,
    requester_email,
    public_submission,
    created_by,
    updated_by
  ) VALUES (
    p_base_id,
    v_ppr_number,
    p_arrival_date,
    COALESCE(p_column_values, '{}'::jsonb),
    NULLIF(TRIM(p_notes), ''),
    'pending_amops_triage',
    TRIM(p_requester_name),
    TRIM(p_requester_email),
    TRUE,
    NULL,
    NULL
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_ppr_request(UUID, TEXT, TEXT, DATE, JSONB, TEXT)
  TO anon, authenticated;
