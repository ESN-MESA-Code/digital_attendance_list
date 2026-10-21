-- ============================================================
-- MES Attendance – organisers accept the confidentiality rules
--
-- Before an organiser sees any attendance list, they accept the rules in
-- legal/organiser-confidentiality.md once (and again when the text changes).
-- The acceptance is recorded here – email, text version, time – as proof
-- that everyone with access was bound to confidentiality (Art. 5(2), 24 and
-- 32(4) GDPR).
--
-- public.is_workspace_member(), which every organiser policy uses, now also
-- requires an acceptance of the current version: until then an organiser can
-- read and write nothing. The domain check alone moves to
-- public.is_workspace_account().
--
-- Acceptances are kept until the end of the fifth calendar year after they
-- were given, like the attendance lists they cover; an organiser whose
-- acceptance was deleted is simply asked again.
-- ============================================================

create table if not exists public.organiser_acknowledgements (
  email       text not null,
  -- Version (date) of legal/organiser-confidentiality.md
  version     text not null
    constraint organiser_acknowledgements_version_check check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  accepted_at timestamptz not null default now(),
  primary key (email, version)
);

alter table public.organiser_acknowledgements enable row level security;

-- Organisers see their own acceptances; nobody writes the table directly
-- (only through acknowledge_confidentiality()), nobody changes or deletes it.
drop policy if exists "Organisers read their own acknowledgements" on public.organiser_acknowledgements;
create policy "Organisers read their own acknowledgements"
  on public.organiser_acknowledgements for select
  to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

revoke insert, update, delete, truncate on public.organiser_acknowledgements from anon, authenticated;

-- ── The current version ─────────────────────────────────────────────────────
-- Keep in step with confidentiality_version in legal/details.json (a test
-- checks this). A new version needs a new migration replacing this function;
-- every organiser is then asked again.
create or replace function public.confidentiality_version()
returns text
language sql
immutable
as $$
  select '2026-10-21'::text;
$$;

-- ── Who is an organiser ─────────────────────────────────────────────────────
-- The domain check of 20261021000100_workspace_auth.sql, unchanged.
create or replace function public.is_workspace_account()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@esnmesa.org'
     and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google';
$$;

-- Used by every organiser policy: a Workspace account that accepted the
-- current confidentiality rules.
create or replace function public.is_workspace_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_workspace_account()
     and exists (
       select 1 from public.organiser_acknowledgements a
       where a.email = lower(auth.jwt() ->> 'email')
         and a.version = public.confidentiality_version()
     );
$$;

-- ── Accepting ───────────────────────────────────────────────────────────────
-- The email and time come from the session and the database, not the request.
-- The version must be the one shown, so nobody accepts a text they did not see.
create or replace function public.acknowledge_confidentiality(accepted_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_workspace_account() then
    raise exception 'Only esnmesa.org organisers accept the confidentiality rules' using errcode = '42501';
  end if;
  if accepted_version is distinct from public.confidentiality_version() then
    raise exception 'The confidentiality rules have changed – please reload the page' using errcode = '22023';
  end if;
  insert into public.organiser_acknowledgements (email, version)
  values (lower(auth.jwt() ->> 'email'), accepted_version)
  on conflict do nothing;
end;
$$;

revoke all on function public.acknowledge_confidentiality(text) from public, anon;
grant execute on function public.acknowledge_confidentiality(text) to authenticated;

-- ── Retention ───────────────────────────────────────────────────────────────
create or replace function public.delete_expired_acknowledgements()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.organiser_acknowledgements
    where accepted_at < date_trunc('year', now()) - interval '5 years'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

-- Only the scheduled job (and admins in SQL) may run it.
revoke all on function public.delete_expired_acknowledgements() from public, anon, authenticated;

select cron.schedule(
  'delete-expired-acknowledgements',
  '50 3 * * *',
  'select public.delete_expired_acknowledgements()'
);
