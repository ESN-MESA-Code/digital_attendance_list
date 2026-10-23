-- ============================================================
-- MES Attendance – digital lists for regular events only
--
-- LMU does not accept digital attendance lists, so funded events (trips,
-- team building) keep the paper list. This app now serves regular events:
-- proof that participants accepted the participation terms, monitoring with
-- anonymous statistics, and proof towards finance that an event took place.
-- That changes what is stored and who sees it:
-- * no signatures (participants' or organisers'), no exports, no filing of
--   printed lists, no description or LEI fields;
-- * each sign-in records the version of the participation terms accepted;
-- * nationality, university, programme and ESNcard are optional; when the
--   list closes they are counted into events.stats and cleared in every row,
--   and nobody can read them per person in the meantime;
-- * sign-ins are possible from 2 hours before the event until 24 hours after
--   it (or the sign-off, if earlier);
-- * the creator signs off with the number of people counted (no signature);
-- * an optional risk notice per event, fixed once someone signed in (the
--   event date too);
-- * organisers see names only while the list is open; afterwards only
--   executives – members of a Google Workspace group, synced into
--   public.executives by the app – do;
-- * lists are deleted at the end of the third calendar year after the event.
--
-- Everything stored so far was test data and is deleted.
-- ============================================================

-- ── 0. Test data ────────────────────────────────────────────────────────────
delete from public.participants;
delete from public.events;

-- ── 1. The sign-in window ───────────────────────────────────────────────────
-- Keep in step with lib/events/window.ts (a test compares them).
create or replace function public.signins_open_at(event_date timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select event_date - interval '2 hours';
$$;

create or replace function public.signins_close_at(event_date timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select event_date + interval '24 hours';
$$;

-- ── 2. Participants ─────────────────────────────────────────────────────────
alter table public.participants
  drop column signature,
  add column terms_version text not null
    constraint participants_terms_version_check check (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  alter column nationality drop not null,
  alter column university drop not null,
  alter column exchange_program drop not null,
  alter column esn_card drop not null,
  alter column notice_version set not null;

-- Was NOT VALID because of rows from before 21 October 2026; none are left.
alter table public.participants validate constraint participants_notice_version_check;

-- The optional details are only for the statistics: nobody reads them per
-- person through the API, only compute_event_stats() counts them.
revoke select on public.participants from anon, authenticated;
grant select (id, event_id, first_name, last_name, entry_method, recorded_by, notice_version, terms_version, created_at)
  on public.participants to authenticated;

-- ── 3. Events ───────────────────────────────────────────────────────────────
alter table public.events
  drop constraint if exists events_signed_off_check,
  drop constraint if exists events_filed_after_signoff_check,
  drop constraint if exists events_filed_check,
  drop column description,
  drop column lei_responsible,
  drop column organiser_signature,
  drop column filed_at,
  drop column filed_by,
  -- Shown on the form above the participation terms, e.g. for hikes.
  add column risk_notice text
    constraint events_risk_notice_check check (length(risk_notice) between 1 and 2000),
  -- People counted by the organiser, entered with the sign-off.
  add column headcount integer
    constraint events_headcount_check check (headcount between 0 and 10000),
  -- Counts written when the list closes (compute_event_stats()).
  add column stats jsonb;

alter table public.events
  add constraint events_signed_off_check check (
    (signed_off_at is null and signed_off_by is null and headcount is null)
    or (signed_off_at is not null and signed_off_by is not null and headcount is not null)
  );

-- ── 4. Statistics ───────────────────────────────────────────────────────────
-- Counts per answer; 'not_given' where someone left a question out.
create or replace function public.compute_event_stats(event uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'signins', count(*),
    'kiosk', count(*) filter (where p.entry_method = 'kiosk'),
    'first_signin', min(p.created_at),
    'last_signin', max(p.created_at),
    'nationality', coalesce((
      select jsonb_object_agg(k, n) from (
        select coalesce(q.nationality, 'not_given') as k, count(*) as n
        from public.participants q where q.event_id = event group by 1
      ) s), '{}'::jsonb),
    'university', coalesce((
      select jsonb_object_agg(k, n) from (
        select coalesce(q.university, 'not_given') as k, count(*) as n
        from public.participants q where q.event_id = event group by 1
      ) s), '{}'::jsonb),
    'exchange_program', coalesce((
      select jsonb_object_agg(k, n) from (
        select coalesce(q.exchange_program, 'not_given') as k, count(*) as n
        from public.participants q where q.event_id = event group by 1
      ) s), '{}'::jsonb),
    'esn_card', coalesce((
      select jsonb_object_agg(k, n) from (
        select case q.esn_card when true then 'yes' when false then 'no' else 'not_given' end as k, count(*) as n
        from public.participants q where q.event_id = event group by 1
      ) s), '{}'::jsonb)
  )
  from public.participants p
  where p.event_id = event;
$$;

-- Once counted, the optional details are removed from every sign-in.
create or replace function public.clear_participant_details(event uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.participants
  set nationality = null, university = null, exchange_program = null, esn_card = null
  where event_id = event
    and (nationality is not null or university is not null or exchange_program is not null or esn_card is not null);
$$;

-- Internal: called by the sign-off trigger and the hourly job only.
revoke all on function public.compute_event_stats(uuid) from public, anon, authenticated;
revoke all on function public.clear_participant_details(uuid) from public, anon, authenticated;

-- Lists that closed without a sign-off (24 hours after the event) are
-- counted and cleared by an hourly job.
create or replace function public.close_expired_lists()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed_id uuid;
  n integer := 0;
begin
  for closed_id in
    update public.events e
    set stats = public.compute_event_stats(e.id)
    where e.stats is null and now() >= public.signins_close_at(e.event_date)
    returning e.id
  loop
    perform public.clear_participant_details(closed_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.close_expired_lists() from public, anon, authenticated;

select cron.schedule(
  'close-expired-lists',
  '5 * * * *',
  'select public.close_expired_lists()'
);

-- ── 5. Executives ───────────────────────────────────────────────────────────
-- Members of the executives' Google Workspace group (EXECUTIVES_GROUP), kept
-- in sync by the app: at each login for the person signing in, and daily for
-- everyone (app/api/cron/sync-executives). Nobody reads or writes the table
-- through the API; public.is_executive() answers for the signed-in user.
create table if not exists public.executives (
  email     text primary key
    constraint executives_email_check check (email = lower(email) and email like '%@esnmesa.org'),
  synced_at timestamptz not null default now()
);

alter table public.executives enable row level security;
revoke all on public.executives from anon, authenticated;

create or replace function public.is_executive()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_workspace_member()
     and exists (select 1 from public.executives x where x.email = lower(auth.jwt() ->> 'email'));
$$;

revoke all on function public.is_executive() from public;
grant execute on function public.is_executive() to anon, authenticated;

-- The daily sync: the group's members replace the table.
create or replace function public.replace_executives(emails text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text[] := array(
    select distinct lower(trim(e)) from unnest(emails) e where lower(trim(e)) like '%@esnmesa.org'
  );
begin
  delete from public.executives where email <> all(wanted);
  insert into public.executives (email)
  select unnest(wanted)
  on conflict (email) do update set synced_at = now();
  return cardinality(wanted);
end;
$$;

-- At login: whether this one person is in the group.
create or replace function public.set_executive(member_email text, member boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if member then
    insert into public.executives (email) values (lower(member_email))
    on conflict (email) do update set synced_at = now();
  else
    delete from public.executives where email = lower(member_email);
  end if;
end;
$$;

-- Only the app's server (service role) calls these.
revoke all on function public.replace_executives(text[]) from public, anon, authenticated;
revoke all on function public.set_executive(text, boolean) from public, anon, authenticated;

-- ── 6. Who sees names ───────────────────────────────────────────────────────
-- Open: not signed off and less than 24 hours after the event.
create or replace function public.event_list_open(event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = event and e.signed_off_at is null and now() < public.signins_close_at(e.event_date)
  );
$$;

revoke all on function public.event_list_open(uuid) from public;
grant execute on function public.event_list_open(uuid) to authenticated;

drop policy if exists "Workspace members can read participants" on public.participants;
drop policy if exists "Organisers read open lists, executives all lists" on public.participants;
create policy "Organisers read open lists, executives all lists"
  on public.participants for select
  to authenticated
  using (
    public.is_executive()
    or (public.is_workspace_member() and public.event_list_open(event_id))
  );

-- What every organiser (and finance) sees of an event: the counts. The
-- breakdown by answers only once the list is closed, so it cannot be matched
-- with the names visible while it is open.
create or replace function public.event_summary(event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
begin
  if not public.is_workspace_member() then
    return null;
  end if;
  select * into e from public.events where id = event;
  if not found then
    return null;
  end if;
  if e.stats is not null then
    return e.stats;
  end if;
  if e.signed_off_at is not null or now() >= public.signins_close_at(e.event_date) then
    return public.compute_event_stats(event);
  end if;
  return public.compute_event_stats(event) - array['nationality', 'university', 'exchange_program', 'esn_card'];
end;
$$;

revoke all on function public.event_summary(uuid) from public;
grant execute on function public.event_summary(uuid) to authenticated;

-- ── 7. Sign-ins only inside the window ──────────────────────────────────────
create or replace function public.event_accepts_signins(event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = event
      and e.signed_off_at is null
      and now() >= public.signins_open_at(e.event_date)
      and now() < public.signins_close_at(e.event_date)
  );
$$;

-- The public form learns the window and the risk notice (no organiser names).
drop function if exists public.get_public_event(text);
create function public.get_public_event(token text)
returns table (
  id uuid,
  title text,
  event_date timestamptz,
  risk_notice text,
  opens_at timestamptz,
  closes_at timestamptz,
  closed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.event_date, e.risk_notice,
         public.signins_open_at(e.event_date),
         public.signins_close_at(e.event_date),
         e.signed_off_at is not null or now() >= public.signins_close_at(e.event_date)
  from public.events e
  where e.public_token = token;
$$;

revoke all on function public.get_public_event(text) from public;
grant execute on function public.get_public_event(text) to anon, authenticated;

-- ── 8. Who may change what ──────────────────────────────────────────────────
-- Security definer now: it counts sign-ins and clears details, which the
-- organiser's own role may not. The JWT still says who is asking.
create or replace function public.guard_event_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- New events start open; the creator is whoever creates them, and is
    -- the responsible MESA member (Google name, else the email).
    new.responsible_member := coalesce(
      nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
      nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
      auth.jwt() ->> 'email'
    );
    new.signed_off_at := null;
    new.signed_off_by := null;
    new.headcount := null;
    new.stats := null;
    new.created_by := auth.jwt() ->> 'email';
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'The creator of an event cannot be changed' using errcode = '42501';
  end if;
  -- Fixed when the event is created; the statistics come from the database.
  new.responsible_member := old.responsible_member;
  new.stats := old.stats;

  -- What participants saw when they signed in stays as it was.
  if (new.event_date, new.risk_notice) is distinct from (old.event_date, old.risk_notice)
     and exists (select 1 from public.participants p where p.event_id = old.id) then
    raise exception 'The date and risk notice cannot change once people have signed in' using errcode = '42501';
  end if;

  if (new.signed_off_at, new.signed_off_by, new.headcount)
     is distinct from (old.signed_off_at, old.signed_off_by, old.headcount) then
    if old.signed_off_at is not null then
      raise exception 'This event is already signed off' using errcode = '42501';
    end if;
    if old.created_by is not null and lower(old.created_by) <> email then
      raise exception 'Only the organiser who created the event can sign it off' using errcode = '42501';
    end if;
    if new.headcount is null then
      raise exception 'A sign-off needs the number of people counted' using errcode = '23514';
    end if;
    -- Recorded by the database, not taken from the request.
    new.signed_off_at := now();
    new.signed_off_by := auth.jwt() ->> 'email';
    if old.stats is null then
      new.stats := public.compute_event_stats(old.id);
      perform public.clear_participant_details(old.id);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_event_writes() from public, anon, authenticated;

-- ── 9. Retention: three years ───────────────────────────────────────────────
-- Until the end of the third calendar year after the event (an event in 2026
-- is kept until 31 December 2029): the limitation period for claims a
-- participant could raise (§§ 195, 199 BGB). Keep legal/details.json
-- (retention) in step.
create or replace function public.delete_expired_events()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.events
    where event_date < date_trunc('year', now()) - interval '3 years'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.delete_expired_events() from public, anon, authenticated;

-- ── 10. New confidentiality rules ───────────────────────────────────────────
-- The rules now name the executives and no longer mention signatures or
-- exports: every organiser accepts them again. Keep in step with
-- confidentiality_version in legal/details.json.
create or replace function public.confidentiality_version()
returns text
language sql
immutable
as $$
  select '2026-10-23'::text;
$$;
