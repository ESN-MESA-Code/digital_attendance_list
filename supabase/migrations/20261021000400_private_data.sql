-- ============================================================
-- MES Attendance – keep personal data private
--
-- 1. Signatures move from the public Storage bucket into the participants
--    row (a small PNG data URL), so they are protected by the same
--    Workspace-only RLS as the rest of the row.
-- 2. Events are no longer readable by everyone. The public attendance form
--    looks up a single event by its token through get_public_event(), which
--    returns only what the form shows.
--
-- Runs after the participants table was emptied by hand (old rows point to
-- signature files in Storage); it refuses to run if rows exist rather than
-- dropping their signatures.
-- ============================================================

do $$
begin
  if exists (select 1 from public.participants) then
    raise exception 'participants is not empty – empty it before applying this migration';
  end if;
end $$;

-- ── 1. Signatures in the participants row ──────────────────────────────────

alter table public.participants
  drop column if exists signature_url;

-- The form stores a trimmed, at most 240 × 80, 2-bit greyscale PNG: about
-- 1 KB, and under ~7 KB as base64 even uncompressed. The checks only stop
-- abuse of the public insert.
alter table public.participants
  add column signature text not null
    constraint participants_signature_check check (
      length(signature) < 16000
      and signature ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
    );

-- Anyone can insert through the public form, so keep the free-text fields sane.
alter table public.participants
  drop constraint if exists participants_name_length_check;
alter table public.participants
  add constraint participants_name_length_check
    check (length(first_name) between 1 and 200 and length(last_name) between 1 and 200);

-- Close the old public bucket. Its files cannot be deleted from SQL – empty
-- Storage → signatures in the Supabase dashboard.
drop policy if exists "Public can upload signatures" on storage.objects;
drop policy if exists "Public can read signatures" on storage.objects;
update storage.buckets set public = false where id = 'signatures';

-- ── 2. Events: Workspace members only, plus a token lookup for the form ────

drop policy if exists "Public can read events" on public.events;
drop policy if exists "Workspace members can read events" on public.events;
create policy "Workspace members can read events"
  on public.events for select
  to authenticated
  using (public.is_workspace_member());

-- The public form needs exactly one event, found by the token in its QR code,
-- and never the organisers' names.
create or replace function public.get_public_event(token text)
returns table (id uuid, title text, description text, event_date timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.description, e.event_date
  from public.events e
  where e.public_token = token;
$$;

revoke all on function public.get_public_event(text) from public;
grant execute on function public.get_public_event(text) to anon, authenticated;

-- The insert policy used to check exists(select … from events), which anon can
-- no longer read. The foreign key on event_id already guarantees the event
-- exists (foreign key checks ignore RLS), so only the entry method is checked.
drop policy if exists "Public can insert participants" on public.participants;
create policy "Public can insert participants"
  on public.participants for insert
  with check (
    (entry_method = 'self' and recorded_by is null)
    or (
      entry_method = 'kiosk'
      and public.is_workspace_member()
      and lower(recorded_by) = lower(auth.jwt() ->> 'email')
    )
  );

-- ── 3. Functions ───────────────────────────────────────────────────────────

-- Trigger function only; nobody needs to call it through the API.
revoke all on function public.enforce_workspace_signup() from public, anon, authenticated;
