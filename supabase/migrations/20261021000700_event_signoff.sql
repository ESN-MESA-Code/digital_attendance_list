-- ============================================================
-- MES Attendance – organisers sign off finished events
--
-- When an event is over, its creator signs the attendance list in the app
-- (the signature replaces the printed name in the PDF). Signing off
-- * closes the event: no new sign-ins, neither by QR code nor kiosk,
-- * is required before the PDF export (checked in the app) and before the
--   printed list can be marked as filed in the office (checked here).
--
-- Only the event's creator may sign off; events from before creators were
-- recorded (created_by is null) may be signed off by any organiser. For
-- organisers a sign-off is final – an admin can undo it in SQL.
--
-- The responsible MESA member is always the creator, taken from their Google
-- account; the LEI responsible person signs the printed list by hand, so the
-- app no longer stores a name for them. Older events keep their names.
-- ============================================================

alter table public.events
  add column if not exists signed_off_at timestamptz,
  add column if not exists signed_off_by text,
  -- Same format and limits as participants.signature.
  add column if not exists organiser_signature text
    constraint events_organiser_signature_check check (
      length(organiser_signature) < 16000
      and organiser_signature ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
    );

alter table public.events drop constraint if exists events_signed_off_check;
alter table public.events
  add constraint events_signed_off_check check (
    (signed_off_at is null and signed_off_by is null and organiser_signature is null)
    or (signed_off_at is not null and signed_off_by is not null and organiser_signature is not null)
  );

-- The printed list can only be filed once it was signed off.
alter table public.events drop constraint if exists events_filed_after_signoff_check;
alter table public.events
  add constraint events_filed_after_signoff_check check (filed_at is null or signed_off_at is not null);

-- ── Who may sign off, and when; who is responsible ─────────────────────────
-- RLS lets every organiser update events (to fix typos), so these rules live
-- in a trigger. It applies to signed-in users (the API); the service role
-- and SQL run by admins are not restricted.
create or replace function public.guard_event_writes()
returns trigger
language plpgsql
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
    new.lei_responsible := null;
    new.signed_off_at := null;
    new.signed_off_by := null;
    new.organiser_signature := null;
    new.filed_at := null;
    new.filed_by := null;
    new.created_by := auth.jwt() ->> 'email';
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'The creator of an event cannot be changed' using errcode = '42501';
  end if;
  -- Fixed when the event is created; editing an event leaves them alone.
  new.responsible_member := old.responsible_member;
  new.lei_responsible := old.lei_responsible;

  if (new.signed_off_at, new.signed_off_by, new.organiser_signature)
     is distinct from (old.signed_off_at, old.signed_off_by, old.organiser_signature) then
    if old.signed_off_at is not null then
      raise exception 'This event is already signed off' using errcode = '42501';
    end if;
    if old.created_by is not null and lower(old.created_by) <> email then
      raise exception 'Only the organiser who created the event can sign it off' using errcode = '42501';
    end if;
    if new.organiser_signature is null then
      raise exception 'A sign-off needs the organiser''s signature' using errcode = '23514';
    end if;
    -- Recorded by the database, not taken from the request.
    new.signed_off_at := now();
    new.signed_off_by := auth.jwt() ->> 'email';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_event_writes() from public, anon, authenticated;

drop trigger if exists guard_event_writes on public.events;
create trigger guard_event_writes
  before insert or update on public.events
  for each row execute function public.guard_event_writes();

-- ── Closed events take no new sign-ins ─────────────────────────────────────
-- Participants cannot read events, so the policy asks a definer function.
create or replace function public.event_accepts_signins(event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = event and e.signed_off_at is null);
$$;

revoke all on function public.event_accepts_signins(uuid) from public;
grant execute on function public.event_accepts_signins(uuid) to anon, authenticated;

drop policy if exists "Public can insert participants" on public.participants;
create policy "Public can insert participants"
  on public.participants for insert
  with check (
    public.event_accepts_signins(event_id)
    and (
      (entry_method = 'self' and recorded_by is null)
      or (
        entry_method = 'kiosk'
        and public.is_workspace_member()
        and lower(recorded_by) = lower(auth.jwt() ->> 'email')
      )
    )
  );

-- ── The public form learns whether the event is closed ─────────────────────
drop function if exists public.get_public_event(text);
create function public.get_public_event(token text)
returns table (id uuid, title text, description text, event_date timestamptz, closed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.description, e.event_date, e.signed_off_at is not null
  from public.events e
  where e.public_token = token;
$$;

revoke all on function public.get_public_event(text) from public;
grant execute on function public.get_public_event(text) to anon, authenticated;
