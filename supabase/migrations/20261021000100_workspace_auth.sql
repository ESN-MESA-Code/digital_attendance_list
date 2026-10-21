-- ============================================================
-- MES Attendance – Google Workspace login (esnmesa.org only)
-- Applied automatically by the db-migrate GitHub Action.
-- Change 'esnmesa.org' below if the Workspace domain ever changes.
-- ============================================================

-- 1. Reject every sign-up that is not a Google Workspace account of our
--    domain, so no other Google account ever gets a Supabase user.
--    Google sets the `hd` claim only for Workspace accounts.
create or replace function public.enforce_workspace_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google'
     or lower(coalesce(new.email, '')) not like '%@esnmesa.org'
     or lower(coalesce(new.raw_user_meta_data -> 'custom_claims' ->> 'hd', '')) <> 'esnmesa.org'
  then
    raise exception 'Only esnmesa.org Google Workspace accounts may sign in';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_workspace_signup on auth.users;
create trigger enforce_workspace_signup
  before insert on auth.users
  for each row execute function public.enforce_workspace_signup();

-- 2. Helper used by the RLS policies below.
create or replace function public.is_workspace_member()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@esnmesa.org'
     and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google';
$$;

-- 3. Organiser policies: only esnmesa.org Workspace members.
--    Also removes the open "using (true)" policies of the old schema.sql.
drop policy if exists "Authenticated can insert events" on public.events;
drop policy if exists "Authenticated can update events" on public.events;
drop policy if exists "Authenticated can delete events" on public.events;
drop policy if exists "Authenticated can read participants" on public.participants;

drop policy if exists "Workspace members can insert events" on public.events;
create policy "Workspace members can insert events"
  on public.events for insert
  to authenticated
  with check (public.is_workspace_member());

drop policy if exists "Workspace members can update events" on public.events;
create policy "Workspace members can update events"
  on public.events for update
  to authenticated
  using (public.is_workspace_member());

drop policy if exists "Workspace members can delete events" on public.events;
create policy "Workspace members can delete events"
  on public.events for delete
  to authenticated
  using (public.is_workspace_member());

drop policy if exists "Workspace members can read participants" on public.participants;
create policy "Workspace members can read participants"
  on public.participants for select
  to authenticated
  using (public.is_workspace_member());
