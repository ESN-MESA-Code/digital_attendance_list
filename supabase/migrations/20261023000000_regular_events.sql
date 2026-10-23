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
-- * nationality, university, programme and ESNcard are optional and never
--   stored with a name: public.sign_in() saves the sign-in and adds 1 to the
--   event's count for each answer (public.event_stats);
-- * sign-ins are possible from 2 hours before the event until 24 hours after
--   it (or the sign-off, if earlier);
-- * the creator signs off with the number of people counted (no signature);
-- * an optional risk notice per event, fixed once someone signed in (the
--   event date too);
-- * organisers see names only while the list is open; afterwards only
--   executives – members of a Google Workspace group, synced into
--   public.executives by the app – do. The counts per answer are shown once
--   the list is closed, so they cannot be matched with names appearing live;
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

-- ── 2. Participants: who signed in, and to which terms ──────────────────────
alter table public.participants
  drop column signature,
  drop column nationality,
  drop column university,
  drop column exchange_program,
  drop column esn_card,
  add column terms_version text not null
    constraint participants_terms_version_check check (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  -- (Not null already on a fresh database; production's table is older.)
  alter column first_name set not null,
  alter column last_name set not null,
  alter column notice_version set not null;

-- Was NOT VALID because of rows from before 21 October 2026; none are left.
alter table public.participants validate constraint participants_notice_version_check;

-- Sign-ins go through public.sign_in() only, which also counts the answers.
drop policy if exists "Public can insert participants" on public.participants;
revoke insert on public.participants from anon, authenticated;

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
    constraint events_headcount_check check (headcount between 0 and 10000);

alter table public.events
  add constraint events_signed_off_check check (
    (signed_off_at is null and signed_off_by is null and headcount is null)
    or (signed_off_at is not null and signed_off_by is not null and headcount is not null)
  );

-- ── 4. Statistics: counts per answer, never linked to a person ──────────────
-- One row per event, question and answer ('not_given' when left out). Not
-- readable or writable through the API; public.event_summary() reports it.
create table if not exists public.event_stats (
  event_id uuid not null references public.events(id) on delete cascade,
  question text not null
    constraint event_stats_question_check check (question in ('nationality', 'university', 'exchange_program', 'esn_card')),
  answer   text not null
    constraint event_stats_answer_check check (length(answer) between 1 and 30),
  total    integer not null default 0
    constraint event_stats_total_check check (total >= 0),
  primary key (event_id, question, answer)
);

alter table public.event_stats enable row level security;
revoke all on public.event_stats from anon, authenticated;

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

-- ── 6. Signing in ───────────────────────────────────────────────────────────
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

-- Saves the sign-in (name, terms, notice) and counts the optional answers;
-- the answers are never stored with the name. Kiosk sign-ins are recorded
-- under the signed-in organiser's email, taken from the session.
create or replace function public.sign_in(
  event uuid,
  first_name text,
  last_name text,
  notice_version text,
  terms_version text,
  nationality text default null,
  university text default null,
  exchange_program text default null,
  esn_card boolean default null,
  kiosk boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  nat text := nullif(nationality, '');
  uni text := nullif(university, '');
  prog text := nullif(exchange_program, '');
begin
  if not public.event_accepts_signins(event) then
    raise exception 'This attendance list is not open for sign-ins' using errcode = '42501';
  end if;
  if kiosk and not public.is_workspace_member() then
    raise exception 'Only organisers record sign-ins on their device' using errcode = '42501';
  end if;
  -- The same answers the form offers.
  if nat !~ '^[A-Z]{2}$'
     or uni not in ('LMU', 'TUM', 'Other')
     or prog not in ('Erasmus+', 'LMUexchange', 'Full-time degree', 'Other') then
    raise exception 'Unknown answer' using errcode = '23514';
  end if;

  -- Names, versions and lengths are checked by the table's constraints.
  insert into public.participants (event_id, first_name, last_name, entry_method, recorded_by, notice_version, terms_version)
  values (
    event, first_name, last_name,
    case when kiosk then 'kiosk' else 'self' end,
    case when kiosk then lower(auth.jwt() ->> 'email') end,
    notice_version, terms_version
  );

  insert into public.event_stats as s (event_id, question, answer, total)
  values
    (event, 'nationality', coalesce(nat, 'not_given'), 1),
    (event, 'university', coalesce(uni, 'not_given'), 1),
    (event, 'exchange_program', coalesce(prog, 'not_given'), 1),
    (event, 'esn_card', case esn_card when true then 'yes' when false then 'no' else 'not_given' end, 1)
  on conflict (event_id, question, answer) do update set total = s.total + 1;
end;
$$;

revoke all on function public.sign_in(uuid, text, text, text, text, text, text, text, boolean, boolean) from public;
grant execute on function public.sign_in(uuid, text, text, text, text, text, text, text, boolean, boolean) to anon, authenticated;

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

-- ── 7. Who sees what ────────────────────────────────────────────────────────
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

-- Names: organisers while the list is open, executives always.
drop policy if exists "Workspace members can read participants" on public.participants;
drop policy if exists "Organisers read open lists, executives all lists" on public.participants;
create policy "Organisers read open lists, executives all lists"
  on public.participants for select
  to authenticated
  using (
    public.is_executive()
    or (public.is_workspace_member() and public.event_list_open(event_id))
  );

-- What every organiser (and finance) sees of an event: the numbers, and once
-- the list is closed the counts per answer.
create or replace function public.event_summary(event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
  summary jsonb;
begin
  if not public.is_workspace_member() then
    return null;
  end if;
  select * into e from public.events where id = event;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'signins', count(*),
    'kiosk', count(*) filter (where p.entry_method = 'kiosk'),
    'first_signin', min(p.created_at),
    'last_signin', max(p.created_at)
  ) into summary
  from public.participants p
  where p.event_id = event;

  if e.signed_off_at is not null or now() >= public.signins_close_at(e.event_date) then
    summary := summary || coalesce((
      select jsonb_object_agg(q.question, q.answers)
      from (
        select s.question, jsonb_object_agg(s.answer, s.total) as answers
        from public.event_stats s
        where s.event_id = event
        group by s.question
      ) q
    ), '{}'::jsonb);
  end if;
  return summary;
end;
$$;

revoke all on function public.event_summary(uuid) from public;
grant execute on function public.event_summary(uuid) to authenticated;

-- Sign-ins per event for the events list (numbers only).
create or replace function public.event_signin_counts()
returns table (event_id uuid, signins integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.event_id, count(*)::integer
  from public.participants p
  where public.is_workspace_member()
  group by p.event_id;
$$;

revoke all on function public.event_signin_counts() from public;
grant execute on function public.event_signin_counts() to authenticated;

-- ── 8. Who may change what ──────────────────────────────────────────────────
-- Security definer now: it checks for sign-ins the organiser may no longer
-- see. The JWT still says who is asking.
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
    new.created_by := auth.jwt() ->> 'email';
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'The creator of an event cannot be changed' using errcode = '42501';
  end if;
  -- Fixed when the event is created; editing an event leaves it alone.
  new.responsible_member := old.responsible_member;

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
  end if;

  return new;
end;
$$;

revoke all on function public.guard_event_writes() from public, anon, authenticated;

-- ── 9. Retention: three years ───────────────────────────────────────────────
-- Until the end of the third calendar year after the event (an event in 2026
-- is kept until 31 December 2029): the limitation period for claims a
-- participant could raise (§§ 195, 199 BGB). The counts go with the event.
-- Keep legal/details.json (retention) in step.
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
