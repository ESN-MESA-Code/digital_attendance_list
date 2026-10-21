# MESAttendance – data protection documentation

How the MESAttendance app collects, uses, stores, shares and deletes personal data, and
how it protects it. Written for review by the data protection officer. It follows the
structure of a record of processing activities (Art. 30 GDPR), with the technical and
organisational measures (Art. 32 GDPR) and open points.

| | |
| --- | --- |
| Controller | Münchner Erasmus Studenten Assoziation (MESA) e.V. (byname ESN MESA München), c/o Referat Internationale Angelegenheiten, Geschwister-Scholl-Platz 1, 80539 München; Amtsgericht München VR 200385; info@lmu-mesa.org |
| Represented by | The board: two chairs and a treasurer; any two represent the association jointly (Satzung) |
| Data protection officer | Cevin Neubauer, it@esnmesa.org |
| Supervisory authority | Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach |
| System | MESAttendance web app (this repository): Next.js on Vercel, Supabase (PostgreSQL) in Frankfurt |
| Status | As of 21 October 2026, consent text version `2026-10-21` |

Facts in this document are taken from the code; file references point to the place that
implements them. All public-facing texts are in this folder and loaded by the app from
here (see [README](README.md)): [`privacy.en.md`](privacy.en.md) (`/privacy`),
[`privacy.de.md`](privacy.de.md) (`/datenschutz`), [`impressum.md`](impressum.md)
(`/impressum`) and the form texts `form-*.md`. Shared values (names, DPO, retention,
consent version): [`details.json`](details.json).

---

## 1. What the app does

MESA organises events for international students. At each event participants sign a
digital attendance list instead of a paper one:

1. An organiser (a MESA member with an `@esnmesa.org` Google Workspace account) creates an
   event in the dashboard. The app shows a QR code with a random link token.
2. Participants scan the QR code with their own phone and fill in the form at
   `/event/<token>` – or sign in on an organiser's device ("kiosk mode") if they have no
   phone.
3. The organiser sees the list live, signs it off after the event (with their own
   signature), exports it as PDF/CSV, prints the PDF and files it in the office folder.

The lists document attendance, prove to funding bodies (e.g. "Lokale Erasmus+
Initiativen") that funded events took place and who took part, and feed anonymous
statistics (participants per university, country, ESNcard) for reports.

---

## 2. Processing activities

### 2.1 Event sign-ins (participants)

| | |
| --- | --- |
| Data subjects | Event participants, mostly international students in Munich |
| Data | First and last name; nationality (ISO country code); university (LMU / TUM / Other); exchange programme (Erasmus+ / LMUexchange / Full-time degree / Other); ESNcard yes/no; handwritten signature (PNG image, max. 240 × 80 px, about 1 KB); time of sign-in; entry method (own device / organiser's device) and, for kiosk sign-ins, the organiser's email; version of the consent text agreed to |
| Not collected | Email, phone, address, date of birth, student ID, photos, IP address in the database, location |
| Purposes | Documenting attendance and the acceptance of the event's liability disclaimer; proof towards funding bodies and for accounting; anonymous statistics |
| Legal basis | **Consent**, Art. 6(1)(a) GDPR – required checkbox on the form, never pre-ticked; text in [`form-consent.en.md`](form-consent.en.md), shown with [`form-data-processing.en.md`](form-data-processing.en.md) ([`components/AttendanceForm.tsx`](../components/AttendanceForm.tsx)) |
| Proof of consent (Art. 7(1)) | Each row stores `consent_version` (the date of the consent text, `consent_version` in [`details.json`](details.json)) and `created_at`; the database refuses new rows without a version ([migration](../supabase/migrations/20261021000900_participant_consent.sql)) |
| Voluntariness | Stated on the form and in the notice: whoever does not consent can ask the organisers to note their attendance on paper |
| Withdrawal | By email to the DPO or info@; the entry is then deleted (procedure in section 6) |
| Recipients | MESA organisers (Workspace accounts); funding bodies / auditors on request (printed or exported list); processors in section 4 |
| Retention | Until the end of the 10th calendar year after the event, then deleted automatically (section 5); earlier on withdrawal |
| Special categories (Art. 9) | None. Nationality is not an Art. 9 category. Signatures are stored as images only and are not used for biometric identification |

Rows from before the consent checkbox (21 October 2026) have `consent_version = null`.
At that time the form only showed a short data protection notice; see open point 1.

### 2.2 "Save my details" cookie (participants, optional)

| | |
| --- | --- |
| Data | Name, nationality, university, exchange programme, ESNcard status – **not** the signature |
| Where | Only in the participant's browser (cookie `mesa_attendance_details`, 12 months, `SameSite=Lax`, `Secure` on HTTPS). Not stored on the server ([`lib/savedDetails.ts`](../lib/savedDetails.ts)) |
| Purpose | Pre-filling the form at the next event |
| Legal basis | Consent, § 25(1) TDDDG and Art. 6(1)(a) GDPR: only set after clicking "Save my details" on the thank-you screen |
| Withdrawal | "No, thanks", "Not you? Remove saved details" or "Remove them" deletes the cookie; or deleting cookies in the browser |
| Kiosk | Never offered and never pre-filled on organiser devices (shared device) |

### 2.3 Organiser accounts and actions

| | |
| --- | --- |
| Data subjects | MESA members acting as organisers |
| Data | From Google: name, email, profile picture URL, account ID (in Supabase Auth); session cookies; in events: creator email, sign-off (time, email, handwritten signature), filed-in-office (time, email), kiosk sign-ins recorded (email) |
| Purpose | Secure access to the dashboard; accountability for each list |
| Legal basis | Legitimate interest, Art. 6(1)(f) GDPR (and the membership relationship) |
| Cookies | Supabase session cookies, strictly necessary – § 25(2) No. 2 TDDDG, no consent |
| Third party | The profile picture is loaded from Google's servers (`referrerpolicy="no-referrer"`), so Google sees the organiser's IP address |
| Retention | Event-related data as long as the event (section 5); Auth accounts until removed by an admin |

### 2.4 Hosting and technical logs

| | |
| --- | --- |
| Data | IP address, time, requested URL, user agent – processed by Vercel and Supabase in their logs |
| Purpose | Delivering the app, security, error analysis |
| Legal basis | Legitimate interest, Art. 6(1)(f) GDPR |
| Retention | Providers' log retention (short, plan-dependent); the app itself stores no IP addresses |

### 2.5 Exports and printed lists

- **PDF** ([`lib/pdf/generate.ts`](../lib/pdf/generate.ts)): the official list layout with
  all participant fields and signatures plus the organiser's sign-off signature. Only
  after sign-off.
- **CSV**: all fields **except** signatures; values are escaped against spreadsheet
  formula injection ([`lib/csv.ts`](../lib/csv.ts)).
- Both are generated server-side for logged-in organisers only and downloaded to the
  organiser's device. The printed PDF goes into the office folder; the app records when
  and by whom.

---

## 3. Data flow

```
Participant's phone ──HTTPS──▶ Vercel (Next.js, EU) ──▶ page only, no personal data stored
        │
        └──HTTPS (Supabase API, anon key)──▶ Supabase Postgres, Frankfurt
                                               INSERT participants (RLS: insert only,
                                               never read back)

Organiser's browser ──Google Workspace login──▶ Supabase Auth (Google OAuth, hd=esnmesa.org)
        │
        ├──HTTPS──▶ Supabase: read participants (RLS: Workspace members only),
        │           live updates via Supabase Realtime
        └──HTTPS──▶ Vercel export routes ──service role──▶ Supabase ──▶ PDF/CSV download
                                                                         │
                                                              printed ──▶ office folder
```

The public form never reads the events table; it gets title and date of one event by its
token through `get_public_event()`, which does not return organiser names.

---

## 4. Processors and transfers

| Processor | Role | Location of data | Transfer safeguard |
| --- | --- | --- | --- |
| Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA | Hosting of the app (functions in an EU region) | EU; CDN edge may serve from the nearest location | Vercel DPA with EU standard contractual clauses; EU–US Data Privacy Framework where certified |
| Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992 | Database, authentication, realtime | AWS eu-central-1 (Frankfurt) | Supabase DPA with standard contractual clauses (support access from third countries) |
| Google Ireland Limited, Gordon House, Barrow Street, Dublin 4 | Organiser login (Google Workspace) | EU / Google infrastructure | Google Workspace data processing terms; DPF for transfers to Google LLC |

GitHub (source code and CI) holds no personal data of participants: tests use a local
database with fake data.

**Status of the data processing agreements: to be confirmed by the board** (open point 2).

---

## 5. Retention and deletion

| What | When deleted | How |
| --- | --- | --- |
| Events and their sign-ins | End of the 10th calendar year after the event (event in 2026 → 31 Dec 2036) | Nightly `pg_cron` job `delete-expired-events` (03:30 UTC) runs `public.delete_expired_events()`; participants are deleted with their event (`on delete cascade`) ([migration](../supabase/migrations/20261021000800_retention.sql), tested in [`tests/db/retention.test.ts`](../tests/db/retention.test.ts)) |
| A single sign-in on withdrawal of consent | Promptly after the request | Manually by an admin (section 6) |
| Events deleted early | Any time | Organisers can delete an event in the app; its sign-ins go with it |
| Saved-details cookie | After 12 months, or when the participant removes it | Browser |
| Printed lists | Same time as the digital ones | Organisational – office folder (open point 4) |
| Downloaded PDF/CSV files | – | On organisers' devices, not controlled by the app (open point 5) |
| Supabase backups | Per Supabase plan (daily backups, limited retention) | Provider |

Why 10 years: funders may ask for the lists as proof of the use of funds. (Tax law
requires 8 years for accounting receipts since 2025; if no funder needs 10, the period
can be shortened in `details.json` plus a new migration for the deletion job.)

---

## 6. Data subject rights – how to handle requests

Requests reach it@esnmesa.org or info@lmu-mesa.org. Answer within one month (Art. 12(3)).
Verify the requester's identity sensibly (e.g. reply from the address they used, or ask
which events they attended) – the app stores no contact data.

Run in the Supabase dashboard → SQL editor (service role):

```sql
-- Access (Art. 15): all sign-ins of a person
select e.title, e.event_date, p.*
from participants p join events e on e.id = p.event_id
where lower(p.first_name) = lower('Erika') and lower(p.last_name) = lower('Mustermann')
order by e.event_date;

-- Withdrawal of consent / erasure (Art. 7(3), 17): delete those rows
delete from participants where id in ('<id>', '<id>');

-- Rectification (Art. 16)
update participants set last_name = 'Musterfrau' where id = '<id>';
```

After a deletion, also remove the person from the printed list in the office folder
(black out) and tell organisers to delete old exports. Portability (Art. 20): export the
query result as CSV.

---

## 7. Technical and organisational measures (Art. 32)

**Access control**
- Organiser area, kiosk and exports require a Google login with an `@esnmesa.org`
  Workspace account; checked on the server (`hd` claim and email domain,
  [`lib/auth.ts`](../lib/auth.ts), [`proxy.ts`](../proxy.ts)) and again in the database.
- Row Level Security on all tables: anyone may **insert** a sign-in, nobody but Workspace
  members may **read** participants, nobody may update participant rows; events are
  readable by Workspace members only. A trigger rejects sign-ups from other domains.
- Signed-off events accept no further sign-ins (enforced in the database).
- The service role key is used only server-side in the export routes.

**Confidentiality and integrity**
- HTTPS only. Signatures live in the database row (not in public file storage); the old
  public storage bucket was closed.
- Input validation in the form and in database constraints (field lengths, allowed
  values, signature size and format, consent version).
- CSV export escapes formula injection; security headers: no framing
  (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), `nosniff`, `Referrer-Policy:
  same-origin` so the QR token is not leaked ([`next.config.ts`](../next.config.ts)).

**Data minimisation and privacy by default**
- No email or contact data from participants; no tracking, analytics or ads; no external
  fonts or scripts. The saved-details cookie is opt-in and never holds the signature.
- Signatures are reduced to a tiny 2-bit greyscale image.
- Kiosk mode never stores or pre-fills anyone's details; the form resets after each person.

**Change management**
- Database changes only as reviewed migration files, applied by CI on `main`; the
  test suite (unit, database/RLS, end-to-end) runs on every pull request, so a change
  that weakens the privacy rules fails before it reaches production.

---

## 8. Transparency (Art. 12–14)

- **On the form, before submitting:** a "Data processing" box (who, what, why, who sees
  it, retention, voluntariness, how to withdraw, DPO contact) and the consent checkbox.
- **Full notice:** `/privacy` and `/datenschutz`, linked in the footer of every page (new
  tab on the form so nothing is lost).
- **Impressum:** `/impressum` (§ 5 DDG), linked in the footer of every page.

---

## 9. Data protection impact assessment (Art. 35)

Assessment: **not required.** No special categories, no profiling or automated decisions,
no systematic monitoring, no new technologies with high risk, moderate scale (a few
thousand sign-ins a year). The processing is not on the BayLDA list of operations that
require a DPIA. Main risk – exposure of names and signatures – is mitigated by the
measures in section 7.

---

## 10. Open points for the DPO / board

1. **Sign-ins before 21 October 2026** were collected without the consent checkbox
   (`consent_version is null`). Decide: rely on legitimate interest for those, or delete
   them.
2. **Data processing agreements** with Vercel, Supabase and Google Workspace: accept /
   confirm and file them.
3. **Paper alternative:** the notice promises that people who don't consent can be
   noted on paper – organisers need to know this and carry a paper list.
4. **Printed lists:** destroying them at the end of the retention period must be part of
   the office routine.
5. **Downloaded exports** on organisers' devices: a rule like "delete local PDF/CSV
   files once the list is filed".
6. **Retention period:** confirm 10 years is needed by a funder (otherwise 8 or less).
7. **DPO role:** the DPO also develops and runs this app; authorities often see a
   conflict of interest for heads of IT. If a DPO is formally appointed, report the
   appointment to BayLDA (Art. 37(7)).
8. **Record of processing activities:** take sections 2 and 4 into the association's
   Art. 30 record.
9. **Impressum contact:** besides email only office hours are given; a phone number or
   contact form would be safer under § 5 DDG.
10. **esnmesa.org Impressum** lacks board and register entry and links the discontinued
    EU ODR platform.
