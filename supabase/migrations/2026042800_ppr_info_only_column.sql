-- ============================================================
-- PPR Info-only columns
--
-- Adds a new column type that displays static text/data on the
-- public request form, internal create modal, and confirmation /
-- approval emails — but takes no input from the requester. Used
-- for things like airfield hours, parking restrictions, fuel
-- availability, hazardous-cargo procedures, etc. that the base
-- wants every aircrew to see when filing a PPR.
--
-- Storage: per-column `info_text` body, displayed verbatim. The
-- column's existing `column_name` continues to act as the heading.
-- info_text is nullable; it's only meaningful when column_type =
-- 'info_only'.
-- ============================================================

ALTER TABLE ppr_columns
  ADD COLUMN IF NOT EXISTS info_text TEXT;

-- Replace the column_type CHECK constraint to admit 'info_only'.
-- DROP-then-ADD is the only way; Postgres has no MODIFY CONSTRAINT.
ALTER TABLE ppr_columns
  DROP CONSTRAINT IF EXISTS ppr_columns_column_type_check;

ALTER TABLE ppr_columns
  ADD CONSTRAINT ppr_columns_column_type_check
  CHECK (column_type IN (
    'text', 'date', 'time', 'yes_no_na', 'phone', 'number', 'email', 'info_only'
  ));

-- ── Refresh the public-form RPC ──────────────────────────────
-- Add info_text to the JSONB column payload so the public form
-- can render the read-only block without a separate fetch. Same
-- shape as 2026042600_ppr_coordination.sql; only the projected
-- fields differ.
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
                   'sort_order',  c.sort_order,
                   'info_text',   c.info_text
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
