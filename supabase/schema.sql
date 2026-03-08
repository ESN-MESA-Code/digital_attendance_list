-- ============================================================
-- MES Attendance – Supabase SQL Schema
-- Run this in the Supabase SQL Editor to set up the database.
-- ============================================================

-- 1. EVENTS TABLE
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  event_date  timestamptz not null,
  public_token text unique not null,
  created_at  timestamptz not null default now()
);

-- 2. PARTICIPANTS TABLE
create table if not exists public.participants (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  name           text not null,
  email          text,
  organization   text,
  signature_url  text,
  created_at     timestamptz not null default now(),
  unique(event_id, email)
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
