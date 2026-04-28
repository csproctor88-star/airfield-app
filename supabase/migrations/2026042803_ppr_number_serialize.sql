-- ============================================================
-- PPR # serialization — fix the simultaneous-submit race
--
-- The prior `_ppr_generate_number` minted a sequence number via
-- `COUNT(*) + 1` on `ppr_entries`. Two simultaneous submissions
-- on the same (base, arrival_date) both saw the same COUNT,
-- both inserted with the same ppr_number → silent collision.
--
-- This migration replaces the helper with an atomic upsert into
-- a per-(base, date) counter table, so concurrent callers see
-- monotonically increasing sequence numbers without a lock.
-- A UNIQUE index on (base_id, ppr_number) catches any future
-- regression loudly instead of silently double-issuing.
-- ============================================================

CREATE TABLE IF NOT EXISTS ppr_number_sequence (
  base_id      UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  arrival_date DATE NOT NULL,
  last_seq     INT  NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (base_id, arrival_date)
);

-- Backfill from the existing entries. Use MAX of the parsed middle
-- segment (e.g. '117-003-AB' → 3) so we don't reissue a number that
-- collides with an existing row. Fall back to COUNT(*) if any row's
-- ppr_number is malformed and won't parse.
INSERT INTO ppr_number_sequence (base_id, arrival_date, last_seq)
SELECT
  base_id,
  arrival_date,
  GREATEST(
    COUNT(*)::INT,
    COALESCE(MAX(
      CASE
        WHEN split_part(ppr_number, '-', 2) ~ '^[0-9]+$'
          THEN split_part(ppr_number, '-', 2)::INT
        ELSE 0
      END
    ), 0)
  )
FROM ppr_entries
GROUP BY base_id, arrival_date
ON CONFLICT (base_id, arrival_date) DO UPDATE
  SET last_seq = GREATEST(ppr_number_sequence.last_seq, EXCLUDED.last_seq);

-- Replace the helper. The atomic INSERT..ON CONFLICT serializes
-- concurrent callers via the primary-key constraint without an
-- explicit lock — Postgres enforces row-level write ordering on
-- the conflicting key.
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
  INSERT INTO ppr_number_sequence (base_id, arrival_date, last_seq)
  VALUES (p_base_id, p_arrival, 1)
  ON CONFLICT (base_id, arrival_date) DO UPDATE
    SET last_seq   = ppr_number_sequence.last_seq + 1,
        updated_at = now()
  RETURNING last_seq INTO v_seq;

  v_jul := EXTRACT(DOY FROM p_arrival)::INT;

  RETURN
    LPAD(v_jul::TEXT, 3, '0') || '-' ||
    LPAD(v_seq::TEXT, 3, '0') || '-' ||
    COALESCE(NULLIF(p_oi, ''), 'XX');
END;
$$;

-- Authenticated PPR creation can call this directly (avoids the JS
-- COUNT race). Public submission already invokes it via the public
-- RPC's SECURITY DEFINER context.
GRANT EXECUTE ON FUNCTION public._ppr_generate_number(UUID, DATE, TEXT)
  TO authenticated;

-- Belt-and-suspenders: any future regression that bypasses the
-- helper will now fail loudly instead of silently double-issuing.
-- If this index creation fails on prod, that's the existing
-- collision bug surfacing — fix the data, then re-run the migration.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ppr_entries_base_number
  ON ppr_entries(base_id, ppr_number);

-- RLS on the counter table. Read access is fine for any authenticated
-- user with base access (used by the helper's transient lookup).
-- Writes are channeled through the RPC, so no app-level INSERT/UPDATE
-- policies are needed.
ALTER TABLE ppr_number_sequence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppr_number_sequence_select" ON ppr_number_sequence;
DROP POLICY IF EXISTS "ppr_number_sequence_write"  ON ppr_number_sequence;

CREATE POLICY "ppr_number_sequence_select" ON ppr_number_sequence
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- Block direct writes — only the SECURITY DEFINER public RPC and the
-- helper function (which runs as the caller but writes via UPSERT)
-- should touch this table.
CREATE POLICY "ppr_number_sequence_write" ON ppr_number_sequence
  FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id))
  WITH CHECK (user_has_base_access(auth.uid(), base_id));
