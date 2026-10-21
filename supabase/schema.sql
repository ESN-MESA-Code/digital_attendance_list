-- ============================================================
-- MES Attendance – Supabase SQL Schema
-- Run this in the Supabase SQL Editor to set up the database.
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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.events enable row level security;
alter table public.participants enable row level security;

-- Anyone can read events (needed for the public attendance form to look up by token)
create policy "Public can read events"
  on public.events for select
  using (true);

-- Organiser policies below are replaced by supabase/auth.sql, which
-- restricts them to esnmesa.org Google Workspace accounts.
-- Only authenticated users (organizers) can create / modify events
create policy "Authenticated can insert events"
  on public.events for insert
  with check (true);

create policy "Authenticated can update events"
  on public.events for update
  using (true);

create policy "Authenticated can delete events"
  on public.events for delete
  using (true);

-- Anyone can insert a participant (public attendance form)
-- but only if the referenced event exists
create policy "Public can insert participants"
  on public.participants for insert
  with check (
    exists (
      select 1 from public.events where id = event_id
    )
  );

-- Only authenticated users can read participants (organiser dashboard)
create policy "Authenticated can read participants"
  on public.participants for select
  using (true);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

-- Run in Supabase Storage UI or via management API:
--   Create bucket named "signatures"  (public: true)
--
-- Or via SQL (requires storage extension):
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', true)
on conflict (id) do nothing;

-- Storage RLS: anyone can upload signatures
create policy "Public can upload signatures"
  on storage.objects for insert
  with check (bucket_id = 'signatures');

-- Anyone can read / view signature images
create policy "Public can read signatures"
  on storage.objects for select
  using (bucket_id = 'signatures');

-- ============================================================
-- REALTIME
-- ============================================================

-- Enable realtime on participants table so the dashboard
-- receives live updates when new participants sign in.
alter publication supabase_realtime add table public.participants;

-- ============================================================
-- MIGRATION (run on existing databases to add new columns)
-- Skip this section if you are setting up a fresh database.
-- ============================================================

-- Events: add responsible member fields
alter table public.events
  add column if not exists responsible_member text,
  add column if not exists lei_responsible text;

-- Participants: add new demographic / programme fields
alter table public.participants
  add column if not exists first_name text,
  add column if not exists last_name  text,
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
    -- When there is a space: first_name = everything before, last_name = everything after
    -- When there is no space: put full name in first_name, leave last_name empty
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

    -- After back-fill, apply not-null defaults so new inserts are safe
    alter table public.participants
      alter column first_name set default '',
      alter column last_name  set default '';
  end if;
end $$;
