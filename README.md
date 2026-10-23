# MESAttendance

Digital attendance lists for MESA's regular events.

A web application for event attendance by QR code, built with **Next.js (App Router)** and **Supabase**.
LMU does not accept digital attendance lists, so **funded events (trips, team building) keep
the paper list**; this app documents regular events: proof that participants accepted the
participation terms, anonymous statistics, and proof towards finance that an event took place.

---

## Features

- **Event creation** with title, date and an optional **risk notice** (e.g. for hikes)
- **QR code** linking to the public attendance form; sign-ins from 2 hours before the event
  until 24 hours after it
- **Participation terms** accepted with a checkbox; each sign-in stores the terms version
- **Optional statistics questions** (nationality, university, programme, ESNcard) – only
  counted per event, never stored with a name
- **Realtime dashboard** – participant names update live while the list is open
- **Sign-off with a headcount** – closes the list; finance checks the counts on the event page
- **Executives** (a Google Workspace group) see the names of closed lists; other organisers
  only while a list is open
- No signatures, no exports, no printed lists

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|--------------------------------------------------|
| Frontend    | Next.js 16 (App Router), TypeScript, TailwindCSS |
| Backend     | Supabase (PostgreSQL + Realtime)                  |
| Forms       | react-hook-form + zod                             |
| QR codes    | qrcode                                            |
| Groups      | Google Admin SDK Directory API (service account)  |

---

## Project Structure

```
app/
  dashboard/events/          # Organiser event list + creation
  dashboard/events/[id]/     # Event detail, QR code, participant table
  event/[token]/             # Public attendance form
  terms/                     # Participation terms
  api/cron/sync-executives/  # Daily sync of the executives' Google group
components/                  # Shared UI components
lib/
  supabase/                  # Supabase client helpers
  google/                    # Directory API client (group members)
  events/                    # Sign-in window, sign-off
hooks/                       # useParticipants (realtime hook)
types/                       # Shared TypeScript types
supabase/
  migrations/                # Database schema + RLS policies (applied by CI)
.github/workflows/
  db-migrate.yml             # Applies new migrations once Tests passed on main
```

---

## Setup Instructions

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Apply the database schema

The schema lives in [`supabase/migrations/`](supabase/migrations). The
[`db-migrate`](.github/workflows/db-migrate.yml) GitHub Action applies new migration files
to the production database after a push to `main`, once the **Tests** workflow passed on
that commit; if the tests fail, nothing is applied. It can also be started by hand under
**Actions → Database migrations → Run workflow** (without waiting for tests).

It needs one secret, `SUPABASE_DB_URL`, in the repository's `production` environment:
the **Session pooler** connection string from **Connect** in the Supabase dashboard, with
your database password filled in. (The direct connection is IPv6-only and unreachable from
GitHub's runners.)

To change the schema, add a new file `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`;
never edit a migration that has already been applied.

The migrations create:
- `events`, `participants`, `event_stats` (counts per answer) and `executives` tables
- Row Level Security policies (organiser access limited to esnmesa.org accounts; participant
  names only while a list is open, for executives always; counts not readable directly)
- `sign_in()` – the only way to sign in: stores the name and adds the optional answers to the
  event's counts
- A trigger rejecting sign-ups from any other account
- `get_public_event()`, which lets the public form look up one event by its QR code token
  (events themselves are readable by organisers only)
- Realtime on `participants`
- `participants.notice_version` and `terms_version`, required for every sign-in
- Sign-ins only from 2 hours before to 24 hours after the event (`event_accepts_signins()`)
- `event_summary()` – the numbers every organiser (and finance) sees, with the counts per
  answer once the list is closed
- A nightly `pg_cron` job deleting events (and their sign-ins) at the end of the third
  calendar year after the event, as the privacy notice promises
- A nightly `pg_cron` job removing organisers' IP addresses from Supabase Auth's audit log
  and sessions after 30 days
- No deleting of events or sign-ins through the API (only the retention job and admins in SQL)
- `organiser_acknowledgements`: organisers accept the confidentiality rules before they see
  any list (`is_workspace_member()` requires it); deleted after five years by a nightly job

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN=esnmesa.org
EXECUTIVES_GROUP=board@esnmesa.org
GOOGLE_SERVICE_ACCOUNT_EMAIL=…
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n…"
GOOGLE_ADMIN_SUBJECT=
CRON_SECRET=…
```

You can find the Supabase values in your project under **Settings → API**; the executives
values are explained in step 5a.

> ⚠️ The `SUPABASE_SERVICE_ROLE_KEY` and the service account key are only used server-side (executives sync) and are never exposed to the browser.

### 5. Set up Google Workspace login

The organiser dashboard and the exports are only accessible to `@esnmesa.org`
Google Workspace accounts. The public attendance form stays open.

1. In [Google Cloud Console](https://console.cloud.google.com) (in a project owned by the esnmesa.org organisation):
   - **APIs & Services → OAuth consent screen**: choose **Internal** as user type. This alone restricts sign-in to Workspace users.
   - **Credentials → Create credentials → OAuth client ID** (type *Web application*), with authorised redirect URI
     `https://<your-project>.supabase.co/auth/v1/callback`.
2. In Supabase under **Authentication → Sign In / Providers**, enable **Google** and paste the client ID and secret.
   Disable the **Email** provider and the other providers.
3. Under **Authentication → URL Configuration**, set the Site URL to your deployment URL and add
   `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback` to the redirect URLs.

### 5a. Set up the executives group

Executives – the members of one Google Workspace group, e.g. `board@esnmesa.org` – see the
names on closed lists. The app reads the group with a service account:

1. In the Google Cloud project of step 5: **IAM & Admin → Service Accounts → Create**, then
   **Keys → Add key → JSON**. Put `client_email` into `GOOGLE_SERVICE_ACCOUNT_EMAIL` and
   `private_key` into `GOOGLE_SERVICE_ACCOUNT_KEY`. Enable the **Admin SDK API**.
2. Give it read access to groups, either way:
   - **Admin console → Account → Admin roles**: create a role with the privilege
     *Admin API → Groups → Read* and assign it to the service account's email (leave
     `GOOGLE_ADMIN_SUBJECT` empty), or
   - **Admin console → Security → API controls → Domain-wide delegation**: add the service
     account's client ID with the scope
     `https://www.googleapis.com/auth/admin.directory.group.member.readonly`, and set
     `GOOGLE_ADMIN_SUBJECT` to a Workspace admin's email.
3. Set `EXECUTIVES_GROUP` to the group's address and `CRON_SECRET` to a long random string.

The app checks the group at every organiser login and syncs it daily at 04:00 UTC
(`vercel.json`; Vercel sends `CRON_SECRET`). Someone removed from the group loses access at
the next sync or login. Without these variables nobody is an executive.

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) – you will be redirected to the event dashboard.

### Try it locally without touching real data

To click through the app (or a branch) safely, run it against a local Supabase
instead of the project in `.env.local`. Needs Docker or Podman:

```bash
npm run supabase:start   # local database from supabase/migrations + seed.sql
npm run seed:demo        # demo events and participants (run again to reset them)
npm run dev:local        # the app on http://localhost:3000 with the local keys
```

Google sign-in does not work against the local stack, so the login page then shows a
**Local test sign-in** button (organiser@esnmesa.org from `supabase/seed.sql`). It only
appears with `npm run dev:local` and only while the app talks to a Supabase on your own
machine. `seed:demo` prints the participant-form link of each demo event. The seed also has
executive@esnmesa.org (password `local-test-password`), an executive, for the tests. For the phone view use
your browser's device mode (the local database is only reachable from this computer).
`npx supabase@2.121.0 db reset` wipes the local database back to the seed.
Stop `dev:local` before `npm run test:e2e`: Next.js runs only one dev server per folder.

### 7. Deploy

Deploy to [Vercel](https://vercel.com) or any Node.js-compatible host. Make sure to set the four environment variables in your hosting environment.

---

## Testing

| Command            | What it checks                                                                 | Needs              |
| ------------------ | ------------------------------------------------------------------------------ | ------------------ |
| `npm test`         | Legal texts, sign-in window, Directory API client, auth helpers, countries, saved details | nothing            |
| `npm run test:db`  | Row Level Security, sign-in window, statistics, executives, `get_public_event`, signup trigger, realtime | local Supabase     |
| `npm run test:e2e` | Public form (desktop + phone), kiosk, sign-off, executives, access control    | local Supabase     |

The database and end-to-end tests run against a local Supabase stack built from
`supabase/migrations` plus `supabase/seed.sql` (test organisers that sign in with a
password, since Google sign-in is unavailable locally). It needs Docker or Podman:

```bash
npm run supabase:start   # first run downloads the images
npm run test:db
npx playwright install chromium   # once
npm run test:e2e         # starts the app on port 3100 with the local keys
npm run supabase:stop
```

After changing a migration or the seed, run `npx supabase@2.121.0 db reset` to rebuild the
local database. The **Tests** GitHub workflow runs all of this on every pull request, so a
migration that weakens the privacy rules fails there before it reaches `main`.

---

## Legal pages and data protection

Everything legal lives in [`legal/`](legal): the Impressum (`/impressum`), the privacy
notice (`/privacy` English, `/datenschutz` German), the participation terms (`/terms`, with a
short version on the form), the data processing notice on the attendance form, the shared facts (`details.json`) and the full
data protection documentation for the board ([`legal/DATA_PROTECTION.md`](legal/DATA_PROTECTION.md)).
The app renders the Markdown files from there – see [`legal/README.md`](legal/README.md)
for how to edit them. Every page has a footer linking the Impressum and the privacy
notice. Sign-ins rest on the participation agreement and legitimate interest (Art. 6(1)(b)
and (f) GDPR); the form shows the terms and the data processing notice before signing in.

---

## Workflow

1. **Organiser** signs in with their esnmesa.org Google account, opens `/dashboard/events` and
   creates an event (title, date, optional risk notice).
2. The event page (`/dashboard/events/[id]`) shows a downloadable **QR code**.
3. **Participants** scan the QR code (from 2 hours before the event), which opens `/event/[token]`.
4. They enter their name, optionally nationality, university, exchange programme and ESNcard
   status, and **accept the participation terms** (and the risk notice). The answers are only
   added to the event's counts, never stored with the name.
5. The organiser's dashboard lists the names in **real time**.
6. After the event the creator **signs off** with the number of people they counted. That
   closes the list (it closes by itself 24 hours after the event). From then on only
   **executives** see the names; everyone sees the counts.
7. **Finance** opens the event page ("Copy link for finance") and checks the counts: sign-ins,
   headcount, kiosk sign-ins, the time range and the breakdown.

---

## Database Schema

```sql
-- events (organisers only; the form uses get_public_event(token))
id                 uuid primary key
title              text
event_date         timestamptz
responsible_member text        -- the creator's name, set by the database
public_token       text unique
created_by         text        -- organiser email
risk_notice        text        -- optional; fixed once someone signed in
signed_off_at      timestamptz
signed_off_by      text
headcount          integer     -- people counted, entered with the sign-off
created_at         timestamptz default now()

-- participants (written by sign_in() inside the window; organisers read the
-- names while the list is open, executives always)
id               uuid primary key
event_id         uuid references events(id)
first_name       text
last_name        text
entry_method     text      -- 'self' | 'kiosk'
recorded_by      text      -- organiser email for kiosk sign-ins
notice_version   text      -- date of the data processing notice shown
terms_version    text      -- date of the participation terms accepted
created_at       timestamptz default now()

-- event_stats (counts of the optional answers, never linked to a person;
-- written by sign_in(), reported by event_summary() once the list is closed)
event_id         uuid references events(id)
question         text      -- 'nationality' | 'university' | 'exchange_program' | 'esn_card'
answer           text      -- e.g. 'IT', 'LMU', 'yes', or 'not_given'
total            integer
primary key (event_id, question, answer)

-- executives (synced from the Google Workspace group; not readable through the API)
email            text primary key
synced_at        timestamptz
```

---

## License

MIT
# digital_attendance_list
# digital_attendance_list
