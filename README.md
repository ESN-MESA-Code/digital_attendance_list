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
| Backend     | Supabase (PostgreSQL + Storage + Realtime)        |
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
  schema.sql                 # Database schema + RLS policies
```

---

## Setup Instructions

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Apply the database schema

Open the **SQL Editor** in your Supabase dashboard and run the contents of [`supabase/schema.sql`](supabase/schema.sql).

This creates:
- `events` table
- `participants` table (with unique constraint on `(event_id, email)`)
- Row Level Security policies
- A public `signatures` storage bucket

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
```

You can find these values in your Supabase project under **Settings → API**.

> ⚠️ The `SUPABASE_SERVICE_ROLE_KEY` is only used server-side (PDF/CSV export routes) and is never exposed to the browser.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) – you will be redirected to the event dashboard.

### 6. Deploy

Deploy to [Vercel](https://vercel.com) or any Node.js-compatible host. Make sure to set the three environment variables in your hosting environment.

---

## Workflow

1. **Organiser** opens `/dashboard/events` and creates an event.
2. The event page (`/dashboard/events/[id]`) shows a downloadable **QR code**.
3. **Participants** scan the QR code, which opens `/event/[token]`.
4. They fill in their name (+ optional email / organisation) and draw a **signature**.
5. The signature is uploaded to Supabase Storage; the participant record is saved.
6. The organiser's dashboard updates in **real time** as participants sign in.
7. The organiser can **Export CSV** or **Export PDF** (with embedded signatures).

---

## Database Schema

```sql
-- events
id          uuid primary key
title       text
description text
event_date  timestamptz
public_token text unique
created_at  timestamptz default now()

-- participants
id             uuid primary key
event_id       uuid references events(id)
name           text
email          text
organization   text
signature_url  text
created_at     timestamptz default now()
unique(event_id, email)
```

---

## License

MIT
# digital_attendance_list
