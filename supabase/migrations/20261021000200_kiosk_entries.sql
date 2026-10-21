-- ============================================================
-- MES Attendance – sign-ins recorded on an organiser's device
-- (kiosk mode, for participants without a phone or internet).
-- ============================================================

-- 'self'  – the participant signed in on their own phone (QR code)
-- 'kiosk' – the participant signed in on an organiser's device
alter table public.participants
  add column if not exists entry_method text not null default 'self',
  -- Email of the organiser whose device recorded a kiosk sign-in
  add column if not exists recorded_by  text;

alter table public.participants
  drop constraint if exists participants_entry_method_check;
alter table public.participants
  add constraint participants_entry_method_check
  check (entry_method in ('self', 'kiosk'));

-- Anyone may still sign in themselves, but only a signed-in Workspace member
-- may record a kiosk sign-in, and only under their own email.
drop policy if exists "Public can insert participants" on public.participants;
create policy "Public can insert participants"
  on public.participants for insert
  with check (
    exists (
      select 1 from public.events where id = event_id
    )
    and (
      (entry_method = 'self' and recorded_by is null)
      or (
        entry_method = 'kiosk'
        and public.is_workspace_member()
        and lower(recorded_by) = lower(auth.jwt() ->> 'email')
      )
    )
  );
