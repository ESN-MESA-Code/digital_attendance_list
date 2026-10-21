-- ============================================================
-- MES Attendance – keep attendance lists for five years, not ten
--
-- Attendance lists back the reports to the bodies that fund the association
-- (e.g. "Lokale Erasmus+ Initiativen"); grant terms usually require keeping
-- such supporting documents for five years. Lists are kept until the end of
-- the fifth calendar year after the event (an event in 2026 is kept until
-- 31 December 2031).
-- Keep legal/details.json (retention) in step when changing the period.
--
-- The nightly job delete-expired-events (20261021000800_retention.sql) keeps
-- running this function; only the period changes.
-- ============================================================

create or replace function public.delete_expired_events()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.events
    where event_date < date_trunc('year', now()) - interval '5 years'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.delete_expired_events() from public, anon, authenticated;
