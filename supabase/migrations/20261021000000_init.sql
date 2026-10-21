-- ============================================================
-- MES Attendance – base schema
-- Written to be safe on a database where (parts of) the old
-- schema.sql were already applied by hand.
-- ============================================================

-- 1. EVENTS TABLE
create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text not null default '',
  event_date          timestamptz not null,
  -- Name of the responsible MESA member (Verantwortliche*r MESAnt*in)
  responsible_member  text,
  -- Name of the LEI responsible person (LEI-Verantwortliche*r)
  lei_responsible     text,
  public_token        text unique not null,
  created_at          timestamptz not null default now()
);

-- 2. PARTICIPANTS TABLE
create table if not exists public.participants (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  first_name       text not null,
  last_name        text not null,
  email            text,
  nationality      text,
  -- University attended: 'LMU' | 'TUM' | 'Other'
  university       text,
  -- Exchange programme: 'Erasmus+' | 'LMUexchange' | 'Full-time degree' | 'Other'
  exchange_program text,
  -- Whether the participant holds an ESNcard
  esn_card         boolean,
  signature_url    text,
  created_at       timestamptz not null default now()
);

create index if not exists participants_event_id_idx on public.participants(event_id);

-- Columns added after the first version (no-ops on a fresh database)
alter table public.events
  add column if not exists responsible_member text,
  add column if not exists lei_responsible text;

alter table public.participants
  add column if not exists first_name       text,
  add column if not exists last_name        text,
  add column if not exists nationality      text,
  add column if not exists university       text,
  add column if not exists exchange_program text,
  add column if not exists esn_card         boolean;

-- Back-fill first_name/last_name from the legacy name column (if it exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'participants'
      and column_name  = 'name'
  ) then
    update public.participants
    set
      first_name = case
        when position(' ' in name) > 0 then split_part(name, ' ', 1)
        else name
      end,
      last_name = case
        when position(' ' in name) > 0 then substring(name from position(' ' in name) + 1)
        else ''
      end
    where first_name is null;

    alter table public.participants
      alter column first_name set default '',
      alter column last_name  set default '';
  end if;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- Organiser policies are added in the workspace_auth migration.
-- ============================================================

alter table public.events enable row level security;
alter table public.participants enable row level security;

-- Anyone can read events (needed for the public attendance form to look up by token)
drop policy if exists "Public can read events" on public.events;
create policy "Public can read events"
  on public.events for select
  using (true);

-- Anyone can insert a participant (public attendance form)
-- but only if the referenced event exists
drop policy if exists "Public can insert participants" on public.participants;
create policy "Public can insert participants"
  on public.participants for insert
  with check (
    exists (
      select 1 from public.events where id = event_id
    )
  );

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', true)
on conflict (id) do nothing;

drop policy if exists "Public can upload signatures" on storage.objects;
create policy "Public can upload signatures"
  on storage.objects for insert
  with check (bucket_id = 'signatures');

drop policy if exists "Public can read signatures" on storage.objects;
create policy "Public can read signatures"
  on storage.objects for select
  using (bucket_id = 'signatures');

-- ============================================================
-- REALTIME
-- The dashboard receives live updates when participants sign in.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;
