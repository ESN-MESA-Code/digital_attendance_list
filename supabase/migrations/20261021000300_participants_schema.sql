-- ============================================================
-- MES Attendance – participants schema cleanup
--
-- Nationality is stored as an ISO 3166-1 alpha-2 code ("DE") so exports can
-- print country names in any language. Runs after the participants table was
-- emptied by hand (old rows held free-text nationalities); it refuses to run
-- if rows exist rather than dropping their data.
-- ============================================================

do $$
begin
  if exists (select 1 from public.participants) then
    raise exception 'participants is not empty – empty it before applying this migration';
  end if;
end $$;

-- Columns no longer used: email was removed from the form, "name" predates
-- first_name/last_name, and nationality is re-created as a code.
alter table public.participants
  drop column if exists email,
  drop column if exists name,
  drop column if exists nationality;

alter table public.participants
  add column nationality text not null
    constraint participants_nationality_check check (nationality ~ '^[A-Z]{2}$');

-- Every sign-in answers all questions; only accept the options the form offers.
alter table public.participants
  alter column first_name drop default,
  alter column last_name  drop default,
  alter column university       set not null,
  alter column exchange_program set not null,
  alter column esn_card         set not null,
  alter column signature_url    set not null;

alter table public.participants
  drop constraint if exists participants_university_check,
  drop constraint if exists participants_exchange_program_check;
alter table public.participants
  add constraint participants_university_check
    check (university in ('LMU', 'TUM', 'Other')),
  add constraint participants_exchange_program_check
    check (exchange_program in ('Erasmus+', 'LMUexchange', 'Full-time degree', 'Other'));
