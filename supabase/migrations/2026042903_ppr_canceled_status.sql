-- ─────────────────────────────────────────────────────────────
-- 2026042903 · PPR canceled status
-- ─────────────────────────────────────────────────────────────
-- Soft-cancel: keeps the row in place for audit, flips status to
-- 'canceled' so it renders with strikethrough across the slim Log,
-- the Airfield Status Today's-PPRs panel, the detail card, and the
-- PPR Log PDF. Distinct from denied — denied is "AMOPS rejected the
-- request"; canceled is "the requester or AMOPS pulled a previously
-- approved/pending entry" (e.g., aircrew cancellation, weather
-- scrub, schedule slip).
--
-- Non-trivial: the existing CHECK constraint on ppr_entries.status
-- can't be modified in-place, so DROP and re-ADD with 'canceled'
-- included. Idempotent via DO block (constraint name varies by
-- environment — Postgres default-names it `ppr_entries_status_check`
-- when the column was created with an inline CHECK, which the
-- 2026042600 migration did).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ppr_entries_status_check'
      AND conrelid = 'public.ppr_entries'::regclass
  ) THEN
    ALTER TABLE public.ppr_entries DROP CONSTRAINT ppr_entries_status_check;
  END IF;
END $$;

ALTER TABLE public.ppr_entries
  ADD CONSTRAINT ppr_entries_status_check CHECK (status IN (
    'pending_amops_triage',
    'pending_coordination',
    'pending_amops_approval',
    'approved',
    'denied',
    'canceled'
  ));

ALTER TABLE public.ppr_entries
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
