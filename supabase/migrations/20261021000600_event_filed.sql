-- ============================================================
-- MES Attendance – track printed attendance lists filed in the office
--
-- After an event the list is printed, signed by the responsible people and
-- put into the office folder. filed_at / filed_by record that step (both
-- null while the list is still to be filed). RLS is unchanged: only
-- public.is_workspace_member() can read or update events.
-- ============================================================

alter table public.events
  add column if not exists filed_at timestamptz,
  add column if not exists filed_by text;

-- Both set or both empty.
alter table public.events
  drop constraint if exists events_filed_check;
alter table public.events
  add constraint events_filed_check check ((filed_at is null) = (filed_by is null));
