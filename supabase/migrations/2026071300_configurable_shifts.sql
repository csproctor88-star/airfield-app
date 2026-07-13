-- Configurable shifts: 1-3 shifts per base, renameable.
-- Spec: docs/superpowers/specs/2026-07-13-configurable-shifts-design.md
--
-- 1) bases.shift_count may now be 1 (single-shift operations). Default
--    stays 2; existing rows untouched.
-- 2) Per-shift custom display names on bases (NULL/blank = default
--    label). Internal keys stay day/swing/mid everywhere.
-- 3) sign_daily_review_slot now reads shift_count from the bases row
--    (server-side truth) instead of trusting the client's p_shift_count,
--    which previously let a caller certify a 3-shift review early by
--    passing a smaller count. The parameter is kept in the signature for
--    call-site compatibility but ignored. Swing is required only when
--    count >= 2, mid only when count = 3.

-- 1. Allow 1-shift bases -------------------------------------------------
ALTER TABLE public.bases DROP CONSTRAINT IF EXISTS bases_shift_count_check;
ALTER TABLE public.bases ADD CONSTRAINT bases_shift_count_check
  CHECK (shift_count IN (1, 2, 3));

-- 2. Custom shift names (additive; NULL = default label) -----------------
ALTER TABLE public.bases ADD COLUMN IF NOT EXISTS shift_name_day   TEXT;
ALTER TABLE public.bases ADD COLUMN IF NOT EXISTS shift_name_swing TEXT;
ALTER TABLE public.bases ADD COLUMN IF NOT EXISTS shift_name_mid   TEXT;

-- 3. Replace the signing RPC (same signature — grants persist) -----------
create or replace function public.sign_daily_review_slot(
  p_base_id     uuid,
  p_date        date,
  p_slot        text,
  p_events_hash text,
  p_notes       text default null,
  p_shift_count int  default 3
) returns public.daily_reviews
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_signer          uuid := auth.uid();
  v_perm            text;
  v_existing_signer uuid;
  v_row             public.daily_reviews;
  v_all_signed      boolean;
  v_shift_count     int;
begin
  if v_signer is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_slot not in ('day_amsl','swing_amsl','mid_amsl','namo','afm') then
    raise exception 'invalid daily-review slot: %', p_slot using errcode = '22023';
  end if;

  if not public.user_has_base_access(v_signer, p_base_id) then
    raise exception 'no access to base' using errcode = '42501';
  end if;

  v_perm := case
    when p_slot in ('day_amsl','swing_amsl','mid_amsl') then 'daily_reviews:sign:amsl'
    when p_slot = 'namo' then 'daily_reviews:sign:namo'
    when p_slot = 'afm'  then 'daily_reviews:sign:afm'
  end;
  if not public.user_has_permission(v_signer, v_perm) then
    raise exception 'not authorized to sign the % slot', p_slot using errcode = '42501';
  end if;

  -- Ensure the row exists (one per base_id + review_date).
  select * into v_row from public.daily_reviews
   where base_id = p_base_id and review_date = p_date;
  if not found then
    insert into public.daily_reviews (base_id, review_date)
    values (p_base_id, p_date)
    returning * into v_row;
  end if;

  -- Forbid overwriting a slot already signed by a DIFFERENT user.
  execute format(
    'select %I from public.daily_reviews where base_id = $1 and review_date = $2',
    p_slot || '_signed_by'
  ) into v_existing_signer using p_base_id, p_date;
  if v_existing_signer is not null and v_existing_signer <> v_signer then
    raise exception 'the % slot was already signed by another user', p_slot using errcode = '42501';
  end if;

  -- Write only this slot's columns; signed_by is the authenticated signer.
  execute format(
    'update public.daily_reviews
        set %I = $1, %I = now(), %I = $2, %I = $3, updated_at = now()
      where base_id = $4 and review_date = $5
      returning *',
    p_slot || '_signed_by', p_slot || '_signed_at',
    p_slot || '_notes',     p_slot || '_events_hash'
  ) into v_row using v_signer, p_notes, p_events_hash, p_base_id, p_date;

  -- Recompute fully_certified_at server-side. Required slots come from
  -- the base's own shift_count (never the client): swing only when the
  -- base runs >= 2 shifts, mid only when it runs 3. Matches
  -- requiredSlotsForShifts in lib/supabase/daily-reviews.ts.
  select shift_count into v_shift_count from public.bases where id = p_base_id;
  v_shift_count := coalesce(v_shift_count, 2);

  v_all_signed :=
        v_row.day_amsl_signed_at   is not null
    and (v_shift_count < 2  or v_row.swing_amsl_signed_at is not null)
    and (v_shift_count <> 3 or v_row.mid_amsl_signed_at   is not null)
    and v_row.namo_signed_at       is not null
    and v_row.afm_signed_at        is not null;

  if v_all_signed and v_row.fully_certified_at is null then
    update public.daily_reviews set fully_certified_at = now()
     where base_id = p_base_id and review_date = p_date
     returning * into v_row;
  end if;

  return v_row;
end;
$function$;

revoke all on function public.sign_daily_review_slot(uuid, date, text, text, text, int) from public;
grant execute on function public.sign_daily_review_slot(uuid, date, text, text, text, int) to authenticated;
