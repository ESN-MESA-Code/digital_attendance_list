# MESAttendance – data protection documentation

How the MESAttendance app collects, uses, stores, shares and deletes personal data, and
how it protects it. Written for review by the board. It follows the
structure of a record of processing activities (Art. 30 GDPR), with the technical and
organisational measures (Art. 32 GDPR) and open points.

| | |
| --- | --- |
| Controller | Münchner Erasmus Studenten Assoziation (MESA) e.V. (byname ESN MESA München), c/o Referat Internationale Angelegenheiten, Geschwister-Scholl-Platz 1, 80539 München; Amtsgericht München VR 200385; info@esnmesa.org |
| Represented by | The board: two chairs and a treasurer; any two represent the association jointly (Satzung) |
| Data protection officer | None – not required (section 9a). Data protection requests go to info@esnmesa.org |
| Supervisory authority | Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach |
| System | MESAttendance web app (this repository): Next.js on Vercel, Supabase (PostgreSQL) in Frankfurt |
| Status | As of 21 October 2026, data processing notice version `2026-10-21` |

Facts in this document are taken from the code; file references point to the place that
implements them. All public-facing texts are in this folder and loaded by the app from
here (see [README](README.md)): [`privacy.en.md`](privacy.en.md) (`/privacy`),
[`privacy.de.md`](privacy.de.md) (`/datenschutz`), [`impressum.md`](impressum.md)
(`/impressum`) and the form texts `form-*.md`. Shared values (names, email, retention,
notice version): [`details.json`](details.json).

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
| Data | First and last name; nationality (ISO country code); university (LMU / TUM / Other); exchange programme (Erasmus+ / LMUexchange / Full-time degree / Other); ESNcard yes/no; handwritten signature (PNG image, max. 240 × 80 px, about 1 KB); time of sign-in; entry method (own device / organiser's device) and, for kiosk sign-ins, the organiser's email; version of the data processing notice shown |
| Not collected | Email, phone, address, date of birth, student ID, photos, IP address in the database, location |
| Purposes | Documenting attendance and the acceptance of the event's liability disclaimer; proof towards funding bodies and for accounting; anonymous statistics |
| Legal basis | **Legitimate interest**, Art. 6(1)(f) GDPR, for the list, the proof towards funders and anonymous statistics (balancing test in section 2.1a); **performance of the participation agreement**, Art. 6(1)(b) GDPR, for the acceptance of the disclaimer. No consent checkbox. Information in [`form-data-processing.en.md`](form-data-processing.en.md) on the form ([`components/AttendanceForm.tsx`](../components/AttendanceForm.tsx)) |
| Proof of information (Art. 5(2)) | Each row stores `notice_version` (the date of the notice shown, `notice_version` in [`details.json`](details.json)) and `created_at`; the database refuses new rows without a version ([migration](../supabase/migrations/20261021001000_legitimate_interest.sql)). Rows from 21 October 2026 created before that migration agreed to the consent text of that date |
| Obligation to provide | None by law. Needed for the attendance list; whoever does not want to sign in digitally can sign a paper list (same legal basis) |
| Objection (Art. 21) | By email to info@esnmesa.org; the entry is deleted unless it is still needed as proof for a funded event that a funder may audit – then it is deleted when that period ends, and the person is told (procedure in section 6) |
| Recipients | MESA organisers (Workspace accounts); funding bodies / auditors on request (printed or exported list); processors in section 4 |
| Retention | Until the end of the 10th calendar year after the event, then deleted automatically (section 5); earlier after a successful objection |
| Special categories (Art. 9) | None. Nationality is not an Art. 9 category. Signatures are stored as static images only (no pressure, speed or stroke timing) and are not used for biometric identification |

Rows from before 21 October 2026 have `notice_version = null`. At that time the form
showed a short data protection notice; they rest on the same legitimate interest.

### 2.1a Balancing of interests (Art. 6(1)(f))

| | |
| --- | --- |
| Our interest | MESA finances events with grants (e.g. "Lokale Erasmus+ Initiativen") and must prove that funded events took place and who took part; without signed lists funds can be reclaimed. Also documenting the acceptance of the disclaimer and planning events from anonymous statistics |
| Necessity | A signed attendance list is the usual proof funders ask for. Only fields the list or its statistics need are collected (no contact data). **Nationality** is necessary only if a funder asks for it per person – see open point 11 |
| Participants' interests | Names and signatures could be misused if leaked (forgery, identity fraud); nationality could reveal origin. Participants reasonably expect an attendance list at a funded event |
| Safeguards | Only Workspace organisers can read sign-ins (enforced by RLS); participants never see each other's entries; signatures as small images only; fixed retention with automatic deletion; no use for marketing; right to object at any time; measures in section 7 |
| Result | The interests of the association prevail. Reassess if the purpose, the fields or the circle of recipients change |

Why not consent: people who declined were still noted on paper (so the processing did not
depend on consent), and a withdrawal would delete exactly the proof the list exists for.

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
| A single sign-in after an objection | Promptly after the request, or when no funder can audit the event any more (section 2.1) | Manually by an admin (section 6) |
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

Requests reach info@esnmesa.org. Answer within one month (Art. 12(3)).
Verify the requester's identity sensibly (e.g. reply from the address they used, or ask
which events they attended) – the app stores no contact data.

Run in the Supabase dashboard → SQL editor (service role):

```sql
-- Access (Art. 15): all sign-ins of a person
select e.title, e.event_date, p.*
from participants p join events e on e.id = p.event_id
where lower(p.first_name) = lower('Erika') and lower(p.last_name) = lower('Mustermann')
order by e.event_date;

-- Objection / erasure (Art. 21, 17): delete those rows – unless the event was funded
-- and a funder may still audit it; then tell the person, restrict use and delete later
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
- The service role key is used only server-side in the export routes and kept only in
  the hosting environment (never in the repository or logs); it is rotated if it may have
  leaked.
- Two-factor authentication for every account with access: the `@esnmesa.org` Google
  accounts (enforced in the Workspace admin console) and the Supabase, Vercel and GitHub
  accounts – an admin there has full access to the data (open point 12).
- Few admins: only the people who maintain the app have access to the Supabase and Vercel
  projects; access is removed when someone leaves the role.

**Confidentiality and integrity**
- HTTPS only. Signatures live in the database row (not in public file storage); the old
  public storage bucket was closed.
- Encryption at rest: the database and its backups are stored encrypted by Supabase
  (AES-256, AWS Frankfurt).
- **No additional field-level encryption of signatures – a deliberate decision.** Organisers
  need the signatures in clear text for the dashboard and the PDF, so the key would have
  to be held by the app next to the credentials an attacker would need anyway (the service
  role key, or an organiser's session); it would only add protection against the hosting
  provider, which is bound by its data processing agreement and disk encryption. The
  printed list in the office shows the same signatures. The risk is covered by RLS,
  two-factor login, few admins and the export rule below. Revisit if signatures are ever
  stored in higher resolution or with stroke data.
- Input validation in the form and in database constraints (field lengths, allowed
  values, signature size and format, notice version).
- CSV export escapes formula injection; security headers: no framing
  (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), `nosniff`, `Referrer-Policy:
  same-origin` so the QR token is not leaked ([`next.config.ts`](../next.config.ts)).

**Data minimisation and privacy by default**
- No email or contact data from participants; no tracking, analytics or ads; no external
  fonts or scripts. The saved-details cookie is opt-in and never holds the signature.
- Signatures are reduced to a tiny 2-bit greyscale image.
- Kiosk mode never stores or pre-fills anyone's details; the form resets after each person.

**Organisational rules for organisers**
- Delete downloaded PDF/CSV files from your device once the list is printed and filed;
  never send them by messenger or store them in private cloud storage.
- Keep the office folder with printed lists locked; destroy printed lists with the
  digital ones at the end of the retention period (shredder or data protection bin).
- Carry a paper list for participants who do not want to sign in digitally.
- Organisers confirm in writing that they keep participants' data confidential
  (Verpflichtung auf Vertraulichkeit) before getting an `@esnmesa.org` account.

**Change management**
- Database changes only as reviewed migration files, applied by CI on `main`; the
  test suite (unit, database/RLS, end-to-end) runs on every pull request, so a change
  that weakens the privacy rules fails before it reaches production.

---

## 8. Transparency (Art. 12–14)

- **On the form, before submitting:** a "Data processing" box (who, what, why, who sees
  it, retention, legal basis, that no law obliges anyone to sign in, the right to object,
  contact email). No consent checkbox.
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

## 9a. Data protection officer (Art. 37 GDPR, § 38 BDSG)

Assessment: **not required**, so none is appointed.

- Art. 37(1): MESA is not a public body; its core activities are not large-scale regular
  and systematic monitoring, nor large-scale processing of special categories.
- § 38(1) BDSG: fewer than 20 people are regularly engaged in the automated processing of
  personal data, and no processing needs a DPIA (section 9). **Count everyone in the
  association who regularly works with personal data** (board, organisers using this app,
  member and finance administration) – not only this app's users. Re-check yearly.

Without a DPO the board stays responsible for compliance. There is no separate data
protection contact: questions and requests go to the association's general address,
info@esnmesa.org, named in the privacy notice and Impressum.

---

## 10. Open points for the board

1. **Legal basis switched to legitimate interest** (from consent, 21 October 2026): the
   board should confirm the balancing test in section 2.1a. Older sign-ins
   (`notice_version is null`) are covered by it as well.
2. **Data processing agreements** with Vercel, Supabase and Google Workspace: accept /
   confirm and file them.
3. **Paper alternative:** the notice tells people who don't want to sign in digitally to
   ask for a paper list – organisers need to know this and carry one (section 7).
4. **Printed lists:** destroying them at the end of the retention period must be part of
   the office routine.
5. **Organisational rules** (section 7): tell all organisers, collect the
   confidentiality commitments.
6. **Retention period:** confirm 10 years is needed by a funder (otherwise 8 or less).
7. **DPO removed** (section 9a): if a DPO was ever reported to BayLDA, withdraw that
   report; recount the people processing personal data each year and appoint a DPO
   once there are 20 or more.
8. **Record of processing activities:** take sections 2 and 4 into the association's
   Art. 30 record.
9. **Impressum contact:** besides email only office hours are given; a phone number or
   contact form would be safer under § 5 DDG.
10. **esnmesa.org Impressum** lacks board and register entry and links the discontinued
    EU ODR platform.
11. **Nationality:** check whether the funders' attendance-list template or funding terms
    ask for nationality per person. If yes, keep the field required and name that in the
    privacy notice; if only totals are needed, or not at all, remove the field (an
    optional field would not be "necessary" under Art. 6(1)(f) and would need consent).
12. **Two-factor authentication:** enforce it in the Google Workspace admin console and
    check it on the Supabase, Vercel and GitHub accounts with access (section 7).
13. **Minors:** the disclaimer assumes every participant is of full age. If minors may
    attend, the disclaimer and the sign-in (parents' signature) need changes.
