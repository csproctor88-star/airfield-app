-- ============================================================
-- Create auth.users rows for the 8 fabricated KDRA staff, cloned from the
-- demo user's row (af9a39db). Overrides id + email; last_sign_in_at nulled;
-- generated columns (confirmed_at) excluded. replica mode so the
-- on_auth_user_created trigger (if any) won't collide with existing profiles.
-- Idempotent via ON CONFLICT (id) DO NOTHING.
-- ============================================================
BEGIN;
SET LOCAL session_replication_role = replica;

DO $do$
DECLARE
  collist text;
  sellist text;
BEGIN
  SELECT
    string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position),
    string_agg(CASE column_name
      WHEN 'id'              THEN 's.id'
      WHEN 'email'           THEN 's.email'
      WHEN 'last_sign_in_at' THEN 'NULL::timestamptz'
      ELSE 't.' || quote_ident(column_name) END, ', ' ORDER BY ordinal_position)
    INTO collist, sellist
  FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'users' AND is_generated <> 'ALWAYS';

  IF collist IS NULL THEN
    RAISE EXCEPTION 'Could not read auth.users columns (permission?)';
  END IF;

  EXECUTE format($f$
    INSERT INTO auth.users (%s)
    SELECT %s
    FROM auth.users t
    CROSS JOIN (VALUES
      ('af5eed97-5425-d64b-358f-8c1b0e8050af'::uuid, 'kwhitfield@draregional.com'),
      ('4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid, 'aruiz@draregional.com'),
      ('44cc521d-5850-0faa-8f92-c030a19fce37'::uuid, 'dpearce@draregional.com'),
      ('00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid, 'bokafor@draregional.com'),
      ('57a1c585-209a-5012-9983-ff95142a9ff0'::uuid, 'obrenner@draregional.com'),
      ('d3666d88-527f-b006-2afe-96b9573674e2'::uuid, 'slindqvist@draregional.com'),
      ('f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd'::uuid, 'jholloway@draregional.com'),
      ('10bd2c31-e693-c4d5-2455-d3af3506d106'::uuid, 'rcastellano@draregional.com')
    ) AS s(id, email)
    WHERE t.id = 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'
    ON CONFLICT (id) DO NOTHING
  $f$, collist, sellist);
END
$do$;

COMMIT;

-- Confirm all 10 roster ids now exist in auth.users.
SELECT count(*) AS roster_in_auth
FROM auth.users
WHERE id IN (
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6','6be75b3b-cab7-4acb-9c47-b353796d6438',
  'af5eed97-5425-d64b-358f-8c1b0e8050af','4f8ab1a5-c662-a906-7ae3-2730db18551f',
  '44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474',
  '57a1c585-209a-5012-9983-ff95142a9ff0','d3666d88-527f-b006-2afe-96b9573674e2',
  'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd','10bd2c31-e693-c4d5-2455-d3af3506d106'
);
