-- ============================================================
-- MES Attendance – participants consent to the processing of their data
--
-- Sign-ins are processed on the basis of consent (Art. 6(1)(a) GDPR): the
-- form has a required consent checkbox. Each sign-in stores the version
-- (date) of the consent text it agreed to, so we can show what was agreed
-- (Art. 7(1) GDPR); the time is created_at. See CONSENT_VERSION in
-- lib/legal.ts.
--
-- Rows from before this migration have no version. The check is NOT VALID,
-- so they are left alone and only new sign-ins must carry one.
-- ============================================================

alter table public.participants
  add column if not exists consent_version text;

alter table public.participants
  drop constraint if exists participants_consent_version_check;
alter table public.participants
  add constraint participants_consent_version_check
    check (consent_version is not null and consent_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    not valid;
