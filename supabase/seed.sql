-- ============================================================
-- Local development and tests only.
-- `supabase start` / `supabase db reset` load this file; the production
-- `supabase db push` in .github/workflows/db-migrate.yml never does.
-- ============================================================

-- esnmesa.org organisers that sign in with a password, because Google
-- sign-in is not available locally. The metadata matches what Google sign-in
-- stores, so the signup trigger and is_workspace_member() accept it.
-- Used by tests/helpers/local.ts.
-- organiser@esnmesa.org is used by most tests; signout@esnmesa.org only by
-- the sign-out test, because signing out ends all of a user's sessions.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
  '{"provider": "google", "providers": ["google"]}',
  '{"full_name": "Test Organiser", "custom_claims": {"hd": "esnmesa.org"}}',
  now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'organiser@esnmesa.org'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'signout@esnmesa.org')
) as organisers (id, email);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id, 'email', email), 'email', now(), now(), now()
from auth.users
where email in ('organiser@esnmesa.org', 'signout@esnmesa.org');

-- Hosted projects have the GraphQL API enabled; mirror that so the tests
-- check it does not expose more than the REST API.
create extension if not exists pg_graphql;
