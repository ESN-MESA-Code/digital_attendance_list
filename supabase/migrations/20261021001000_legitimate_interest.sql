-- ============================================================
-- MES Attendance – sign-ins rest on legitimate interest, not consent
--
-- Attendance lists are kept to prove to funders that events took place and
-- who attended: Art. 6(1)(f) GDPR (and Art. 6(1)(b) for the disclaimer).
-- Consent did not fit – people who declined were still noted on paper, and a
-- withdrawal would have deleted the proof the list exists for.
--
-- The form no longer has a consent checkbox. Each sign-in still records which
-- data processing notice it was shown (Art. 5(2) GDPR), so consent_version
-- becomes notice_version. Values stay as they are: a row created before this
-- migration was applied agreed to the consent text of that date; a row
-- created after it was shown the notice of that date. See NOTICE_VERSION in
-- lib/legal.ts.
-- ============================================================

alter table public.participants
  rename column consent_version to notice_version;

-- The check (still NOT VALID for rows from before 2026-10-21) follows the
-- column; only its name changes.
alter table public.participants
  rename constraint participants_consent_version_check to participants_notice_version_check;
