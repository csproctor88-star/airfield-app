-- Two fixes bundled because they both block admin user-management
-- workflows that surfaced this session.
--
-- 1. User delete fails when the user has acted on a PPR coordination
--    row because ppr_coordination.coordinated_by FK to profiles(id)
--    was created without ON DELETE clause (defaults to NO ACTION).
--    Same gap exists on the audit columns of ppr_entries and on
--    ppr_remarks.created_by. Switch all to ON DELETE SET NULL —
--    we want to preserve the historical record (concur stays a
--    concur even if the actor is later deleted) but disconnect the
--    deleted user from the row.
--
--    ppr_agency_members.user_id already has ON DELETE CASCADE
--    (correct semantic — a membership without a user makes no
--    sense), so it isn't touched here.
--
-- 2. Admin invite needs to assign a default temp password and force
--    a change on first sign-in. Add must_change_password BOOLEAN
--    to profiles. The login page checks this after sign-in and
--    redirects to /setup-account; /setup-account clears the flag
--    after the user picks a new password. New self-signups default
--    to FALSE (they pick their password at signup time).

-- ────────────────────────────────────────────
-- Part 1: PPR FK constraints → ON DELETE SET NULL
-- ────────────────────────────────────────────

-- Helper that drops + recreates a FK constraint. Idempotent: skips
-- if the constraint doesn't exist (e.g., a fresh DB on a different
-- naming convention).
DO $$
DECLARE
  rec RECORD;
  fk_names TEXT[] := ARRAY[
    'ppr_entries_created_by_fkey',
    'ppr_entries_updated_by_fkey',
    'ppr_entries_triaged_by_fkey',
    'ppr_entries_approval_user_id_fkey',
    'ppr_coordination_coordinated_by_fkey',
    'ppr_remarks_created_by_fkey'
  ];
  fk TEXT;
BEGIN
  FOREACH fk IN ARRAY fk_names LOOP
    EXECUTE format(
      'SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS def
         FROM pg_constraint WHERE conname = %L',
      fk
    ) INTO rec;

    IF rec.table_name IS NULL THEN
      RAISE NOTICE 'FK % not found, skipping', fk;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.table_name, fk);
    -- Recreate with ON DELETE SET NULL. Column name matches the
    -- constraint name pattern: <constraint> = <table>_<column>_fkey.
    -- Extract the column from the definition's "FOREIGN KEY (col)".
    DECLARE
      col_name TEXT;
    BEGIN
      col_name := substring(rec.def FROM 'FOREIGN KEY \(([^)]+)\)');
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES profiles(id) ON DELETE SET NULL',
        rec.table_name, fk, col_name
      );
    END;
  END LOOP;
END $$;

-- ────────────────────────────────────────────
-- Part 2: profiles.must_change_password
-- ────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Index isn't necessary — this column is read once on every sign-in
-- (point lookup by id) and rarely written. Skip the index.
