-- Audit log for System-Admin broadcast emails ("Email all users").
-- Additive, new table — no expand/contract concern.
create table if not exists public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  body text not null,
  filters jsonb not null default '{}'::jsonb,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.email_broadcasts enable row level security;

-- Server writes use the service-role key (bypasses RLS). These policies are
-- defense-in-depth so no anon/auth client can read or forge broadcast rows.
drop policy if exists email_broadcasts_select on public.email_broadcasts;
create policy email_broadcasts_select on public.email_broadcasts
  for select using (public.user_is_sys_admin(auth.uid()));

drop policy if exists email_broadcasts_insert on public.email_broadcasts;
create policy email_broadcasts_insert on public.email_broadcasts
  for insert with check (public.user_is_sys_admin(auth.uid()));
