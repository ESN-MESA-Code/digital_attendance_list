-- ============================================================
-- MES Attendance – events cannot be deleted through the API
--
-- A signed-off list is the proof that an event took place; no organiser
-- session (or stolen one) may destroy it. Events – and with them their
-- sign-ins – are deleted only by the nightly retention job and by admins in
-- SQL (e.g. after an objection, see legal/DATA_PROTECTION.md, section 6).
-- Sign-ins already had no delete policy.
-- ============================================================

drop policy if exists "Workspace members can delete events" on public.events;

-- Without a policy RLS already refuses; revoking the privilege makes the
-- API answer with an error instead of silently deleting nothing.
revoke delete on public.events from anon, authenticated;
revoke delete on public.participants from anon, authenticated;
