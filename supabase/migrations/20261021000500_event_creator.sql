-- ============================================================
-- MES Attendance – remember who created an event
--
-- The dashboard shows "Your events" before "All events". The creator is the
-- organiser's Workspace email (like participants.recorded_by): readable in
-- the table and still meaningful if the auth user is ever deleted.
-- Existing events and events inserted with the service role have no creator.
-- RLS is unchanged: events stay readable and writable only by
-- public.is_workspace_member().
-- ============================================================

alter table public.events
  add column if not exists created_by text default (auth.jwt() ->> 'email');
