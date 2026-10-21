# MESAttendance

Digital attendance lists for MESA events.

A production-ready web application for managing event attendance using QR codes, built with **Next.js (App Router)** and **Supabase**.

---

## Features

- **Event creation** with title, description, and date
- **QR code generation** linking to the public attendance form
- **Signature capture** via a handwritten canvas pad
- **Realtime dashboard** – participant list updates live via Supabase Realtime
- **CSV export** of the full attendance list
- **PDF export** with embedded signature images

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|--------------------------------------------------|
| Frontend    | Next.js 16 (App Router), TypeScript, TailwindCSS |
| Backend     | Supabase (PostgreSQL + Realtime)                  |
| Forms       | react-hook-form + zod                             |
| Signatures  | react-signature-canvas                            |
| QR codes    | qrcode                                            |
| PDF         | pdf-lib                                           |

---

## Project Structure

```
app/
  dashboard/events/          # Organiser event list + creation
  dashboard/events/[id]/     # Event detail, QR code, participant table
  event/[token]/             # Public attendance form
  api/export/event/[id]/pdf/ # PDF export route
  api/export/event/[id]/csv/ # CSV export route
components/                  # Shared UI components
lib/
  supabase/                  # Supabase client helpers
  pdf/                       # PDF generation logic
hooks/                       # useParticipants (realtime hook)
types/                       # Shared TypeScript types
supabase/
  migrations/                # Database schema + RLS policies (applied by CI)
.github/workflows/
  db-migrate.yml             # Applies new migrations on push to main
```

---

## Setup Instructions

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Apply the database schema

The schema lives in [`supabase/migrations/`](supabase/migrations). The
[`db-migrate`](.github/workflows/db-migrate.yml) GitHub Action applies new migration files
to the production database whenever they are pushed to `main` (it can also be started by
hand under **Actions → Database migrations → Run workflow**).

It needs one secret, `SUPABASE_DB_URL`, in the repository's `production` environment:
the **Session pooler** connection string from **Connect** in the Supabase dashboard, with
your database password filled in. (The direct connection is IPv6-only and unreachable from
GitHub's runners.)

To change the schema, add a new file `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`;
never edit a migration that has already been applied.

The migrations create:
- `events` and `participants` tables
- Row Level Security policies (organiser access limited to esnmesa.org accounts)
- A trigger rejecting sign-ups from any other account
- `get_public_event()`, which lets the public form look up one event by its QR code token
  (events themselves are readable by organisers only)
- Realtime on `participants`
- A nightly `pg_cron` job deleting events (and their sign-ins) at the end of the tenth
  calendar year after the event, as the privacy notice promises

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
```

You can find these values in your Supabase project under **Settings → API**.

> ⚠️ The `SUPABASE_SERVICE_ROLE_KEY` is only used server-side (PDF/CSV export routes) and is never exposed to the browser.

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
machine. `seed:demo` prints the participant-form link of each demo event. For the phone view use
your browser's device mode (the local database is only reachable from this computer).
`npx supabase@2.121.0 db reset` wipes the local database back to the seed.
Stop `dev:local` before `npm run test:e2e`: Next.js runs only one dev server per folder.

### 7. Deploy

Deploy to [Vercel](https://vercel.com) or any Node.js-compatible host. Make sure to set the four environment variables in your hosting environment.

---

## Testing

| Command            | What it checks                                                                 | Needs              |
| ------------------ | ------------------------------------------------------------------------------ | ------------------ |
| `npm test`         | Signature encoder, PDF export, CSV escaping, auth helpers, countries, cookies | nothing            |
| `npm run test:db`  | Row Level Security, `get_public_event`, storage bucket, signup trigger, realtime | local Supabase     |
| `npm run test:e2e` | Public form (desktop + phone), kiosk, dashboard, exports, access control      | local Supabase     |

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

## Legal pages

Every page has a footer linking the **Impressum** (`/impressum`, § 5 DDG) and the
**privacy notice** (`/privacy` in English, `/datenschutz` in German, Art. 13 GDPR); the
attendance form links the privacy notice next to the disclaimer. The association's
details, the board, the data protection officer and the retention period live in
[`lib/legal.ts`](lib/legal.ts) – update it when the board changes. The two privacy
notices say the same thing; change them together.

---

## Workflow

1. **Organiser** signs in with their esnmesa.org Google account, opens `/dashboard/events` and creates an event.
2. The event page (`/dashboard/events/[id]`) shows a downloadable **QR code**.
3. **Participants** scan the QR code, which opens `/event/[token]`.
4. They fill in their name, nationality, university, exchange programme and ESNcard status and draw a **signature**.
5. The signature is shrunk to a ~1 KB 2-bit greyscale PNG and saved in the participant row.
   Nothing personal is readable without an esnmesa.org login.
6. The organiser's dashboard updates in **real time** as participants sign in.
7. The organiser can **Export CSV** or **Export PDF** (with embedded signatures).

---

## Database Schema

```sql
-- events (organisers only; the form uses get_public_event(token))
id                 uuid primary key
title              text
description        text
event_date         timestamptz
responsible_member text
lei_responsible    text
public_token       text unique
created_at         timestamptz default now()

-- participants (anyone may insert, organisers only may read)
id               uuid primary key
event_id         uuid references events(id)
first_name       text
last_name        text
nationality      text      -- ISO country code, e.g. 'DE'
university       text      -- 'LMU' | 'TUM' | 'Other'
exchange_program text      -- 'Erasmus+' | 'LMUexchange' | 'Full-time degree' | 'Other'
esn_card         boolean
signature        text      -- 'data:image/png;base64,…', about 1 KB
entry_method     text      -- 'self' | 'kiosk'
recorded_by      text      -- organiser email for kiosk sign-ins
created_at       timestamptz default now()
```

---

## License

MIT
# digital_attendance_list
# digital_attendance_list
