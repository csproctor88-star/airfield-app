-- Remove the NULL-base_id escape hatch from user_has_base_access (the systemic
-- follow-up to the 2026-06-06 pentest remediation).
--
-- Context: previously a NULL base_id returned TRUE, so a write that failed to set
-- base_id was silently accepted as an orphan row (then hidden cross-tenant only by
-- the table-level read policies added in 2026062011). Now that every write path
-- populates base_id via lib/supabase/resolve-base-id.ts, a NULL means "the base
-- could not be determined" and must be REFUSED — so a bad write errors loudly at
-- the DB instead of disappearing into an invisible orphan.
--
-- Reversible: change the NULL branch back to `RETURN TRUE` to roll back.

create or replace function public.user_has_base_access(p_user_id uuid, p_base_id uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  -- Non-active accounts (pending / deactivated) have no access anywhere.
  if not exists (
    select 1 from profiles where id = p_user_id and status = 'active'
  ) then
    return false;
  end if;

  -- base_id is always populated on writes now; a NULL means the base could not
  -- be resolved → refuse access (was: legacy escape hatch returning TRUE).
  if p_base_id is null then
    return false;
  end if;

  -- sys_admin can access all bases.
  if user_is_sys_admin(p_user_id) then
    return true;
  end if;

  return exists (
    select 1 from base_members
    where user_id = p_user_id
      and base_id = p_base_id
  );
end;
$function$;
