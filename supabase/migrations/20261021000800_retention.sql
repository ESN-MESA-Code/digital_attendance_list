-- ============================================================
-- MES Attendance – delete attendance lists after the retention period
--
-- The privacy notice (/privacy, /datenschutz) promises that events and their
-- sign-ins are deleted at the end of the tenth calendar year after the event:
-- an event in 2026 is kept until 31 December 2036. A nightly pg_cron job
-- deletes the events; their participants go with them (on delete cascade).
-- Keep lib/legal.ts (RETENTION_YEARS) in step when changing the period.
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.delete_expired_events()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.events
    where event_date < date_trunc('year', now()) - interval '10 years'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

-- Only the scheduled job (and admins in SQL) may run it.
revoke all on function public.delete_expired_events() from public, anon, authenticated;

-- cron.schedule replaces a job of the same name, so re-running is harmless.
select cron.schedule(
  'delete-expired-events',
  '30 3 * * *',
  'select public.delete_expired_events()'
);
