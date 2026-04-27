-- ============================================================
-- PPR Request — ICAO-based public form URL
--
-- Adds a SECURITY DEFINER RPC that resolves a base by ICAO and
-- returns the same shape as get_public_ppr_config plus the base_id
-- so the public form can submit using the resolved UUID. Lookup is
-- case-insensitive so /kmtc/ppr-request and /KMTC/ppr-request
-- behave identically — URLs are usually lowercase but the
-- bases.icao column is uppercase.
--
-- The original UUID-based RPC stays valid; existing QR codes
-- already in print continue to work.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_ppr_config_by_icao(p_icao TEXT)
RETURNS TABLE (
  base_id        UUID,
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
    b.id   AS base_id,
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
  WHERE lower(b.icao) = lower(p_icao)
$$;

GRANT EXECUTE ON FUNCTION public.get_public_ppr_config_by_icao(TEXT) TO anon, authenticated;
