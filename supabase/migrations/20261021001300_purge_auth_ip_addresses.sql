-- ============================================================
-- MES Attendance – organisers' IP addresses are kept for 30 days
--
-- Supabase Auth records the IP address (and browser) of every organiser
-- login: in auth.audit_log_entries (one row per login, logout, token
-- refresh …) and in auth.sessions. The app does not need them; Auth keeps
-- them for security. A nightly job removes them after 30 days:
-- * audit log entries older than 30 days are deleted,
-- * sessions started more than 30 days ago lose their IP address and user
--   agent – the session itself stays, so nobody is signed out.
-- The privacy notice (section 4) promises this period.
-- ============================================================

create or replace function public.purge_auth_ip_addresses()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.audit_log_entries
  where created_at < now() - interval '30 days';

  update auth.sessions
  set ip = null, user_agent = null
  where created_at < now() - interval '30 days'
    and (ip is not null or user_agent is not null);
end;
$$;

-- Only the scheduled job (and admins in SQL) may run it.
revoke all on function public.purge_auth_ip_addresses() from public, anon, authenticated;

select cron.schedule(
  'purge-auth-ip-addresses',
  '45 3 * * *',
  'select public.purge_auth_ip_addresses()'
);
