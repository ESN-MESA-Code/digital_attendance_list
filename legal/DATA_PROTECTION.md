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

The lists document attendance, prove to the bodies that fund the association (e.g. "Lokale
Erasmus+ Initiativen") that its events took place and who took part, and feed anonymous
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
| Objection (Art. 21) | By email to info@esnmesa.org; the entry is deleted unless it is still needed for the year's report to funders – then it is deleted once that report is done, and the person is told (procedure in section 6) |
| Recipients | MESA organisers (Workspace accounts); funding bodies / auditors on request (printed or exported list); processors in section 4 |
| Retention | Until the end of the fifth calendar year after the event, then deleted automatically (section 5); earlier after a successful objection |
| Special categories (Art. 9) | None. Nationality is not an Art. 9 category. Signatures are stored as static images only (no pressure, speed or stroke timing) and are not used for biometric identification |

Rows from before 21 October 2026 have `notice_version = null`. At that time the form
showed a short data protection notice; they rest on the same legitimate interest.

### 2.1a Balancing of interests (Art. 6(1)(f))

| | |
| --- | --- |
| Our interest | MESA is financed by grants to the association (e.g. "Lokale Erasmus+ Initiativen") and must prove to its funders that its events take place and who takes part; without signed lists funding can be lost or reclaimed. Also documenting the acceptance of the disclaimer and planning events from anonymous statistics |
| Necessity | A signed attendance list is the usual proof funders ask for. The funders' attendance-list template asks for **nationality, university, exchange programme and ESNcard status per person**, so these fields are required. Nothing else is collected (no contact data) |
| Participants' interests | Names and signatures could be misused if leaked (forgery, identity fraud); nationality could reveal origin. Participants reasonably expect an attendance list at a funded event |
| Safeguards | Only Workspace organisers can read sign-ins (enforced by RLS); participants never see each other's entries; signatures as small images only; fixed retention with automatic deletion; no use for marketing; right to object at any time; measures in section 7 |
| Result | The interests of the association prevail. Reassess if the purpose, the fields or the circle of recipients change |

Why not consent: people who declined were still noted on paper (so the processing did not
depend on consent), and a withdrawal would delete exactly the proof the list exists for.

### 2.2 "Save my details" (participants, optional)

| | |
| --- | --- |
| Data | Name, nationality, university, exchange programme, ESNcard status – **not** the signature |
| Where | Only in the participant's browser: `localStorage`, key `mesa_attendance_details`, ignored and removed after 12 months. Unlike a cookie it is never sent to the server ([`lib/savedDetails.ts`](../lib/savedDetails.ts)). Details saved in the cookie of earlier versions are moved over and the cookie deleted on the next visit |
| Purpose | Pre-filling the form at the next event |
| Legal basis | Consent, § 25(1) TDDDG (storage on the device, cookie or not) and Art. 6(1)(a) GDPR: only saved after clicking "Save my details" on the thank-you screen |
| Withdrawal | "No, thanks", "Not you? Remove saved details" or "Remove them" deletes the details; or deleting the site data in the browser |
| Kiosk | Never offered and never pre-filled on organiser devices (shared device) |

### 2.3 Organiser accounts and actions

| | |
| --- | --- |
| Data subjects | MESA members acting as organisers |
| Data | From Google: name, email, profile picture URL, account ID (in Supabase Auth); session cookies; IP address and user agent of logins (Supabase Auth: `auth.audit_log_entries`, `auth.sessions`); in events: creator email, sign-off (time, email, handwritten signature), filed-in-office (time, email), kiosk sign-ins recorded (email) |
| Purpose | Secure access to the dashboard; accountability for each list |
| Legal basis | Legitimate interest, Art. 6(1)(f) GDPR (and the membership relationship) |
| Cookies | Supabase session cookies, strictly necessary – § 25(2) No. 2 TDDDG, no consent |
| Third party | The profile picture is loaded from Google's servers (`referrerpolicy="no-referrer"`), so Google sees the organiser's IP address |
| Retention | Event-related data as long as the event (section 5); login IP addresses and user agents 30 days (nightly job, section 5); Auth accounts are deleted by an admin when the person leaves the organiser role |

### 2.4 Hosting and technical logs

| | |
| --- | --- |
| Data | IP address, time, requested URL, user agent – processed by Vercel and Supabase in their logs |
| Purpose | Delivering the app, security, error analysis |
| Legal basis | Legitimate interest, Art. 6(1)(f) GDPR |
| Retention | Providers' log retention (short, plan-dependent). The app's database stores no participant IP addresses; organisers' login IPs see section 2.3 |

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
| Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA | Hosting of the app (functions pinned to Frankfurt, `fra1`, in [`vercel.json`](../vercel.json)) | EU; CDN edge may serve from the nearest location | Vercel DPA with EU standard contractual clauses; EU–US Data Privacy Framework where certified |
| Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992 | Database, authentication, realtime | AWS eu-central-1 (Frankfurt) | Supabase DPA with standard contractual clauses (support access from third countries) |
| Google Ireland Limited, Gordon House, Barrow Street, Dublin 4 | Organiser login (Google Workspace) | EU / Google infrastructure | Google Workspace data processing terms; DPF for transfers to Google LLC |

GitHub (source code and CI) holds no personal data of participants: tests use a local
database with fake data.

**Status of the data processing agreements:** Supabase's and Vercel's DPAs are part of their
terms of service and apply automatically – nothing to sign. Google Workspace's Cloud Data
Processing Addendum is accepted in the admin console (open point 2). Dated copies of the
DPAs (and Supabase's transfer impact assessment) are kept with the association's data
protection documents as evidence (Art. 5(2)).

---

## 5. Retention and deletion

| What | When deleted | How |
| --- | --- | --- |
| Events and their sign-ins | End of the fifth calendar year after the event (event in 2026 → 31 Dec 2031) | Nightly `pg_cron` job `delete-expired-events` (03:30 UTC) runs `public.delete_expired_events()`; participants are deleted with their event (`on delete cascade`) ([job](../supabase/migrations/20261021000800_retention.sql), [period](../supabase/migrations/20261021001100_retention_five_years.sql), tested in [`tests/db/retention.test.ts`](../tests/db/retention.test.ts)) |
| Organisers' login IP addresses and user agents | After 30 days | Nightly `pg_cron` job `purge-auth-ip-addresses` (03:45 UTC) deletes older `auth.audit_log_entries` and clears `ip`/`user_agent` of older `auth.sessions` ([migration](../supabase/migrations/20261021001300_purge_auth_ip_addresses.sql)) |
| A single sign-in after an objection | Promptly after the request, or once the year's report to funders is done (section 2.1) | Manually by an admin (section 6) |
| Events deleted early | Any time | Only by an admin in SQL; its sign-ins go with it. The API refuses deletes of events and sign-ins for everyone, so a list – the proof that an event took place – cannot be destroyed from an organiser session ([migration](../supabase/migrations/20261021001200_no_event_deletes.sql)) |
| Saved details | After 12 months, or when the participant removes them | Browser |
| Printed lists | Same time as the digital ones | Organisational – office folder (open point 4) |
| Downloaded PDF/CSV files | – | On organisers' devices, not controlled by the app (open point 5) |
| Supabase backups | Per Supabase plan (daily backups, limited retention) | Provider |

Why five years: the lists are supporting documents for the reports to funders, and grant
terms (e.g. those incorporating ANBest-P) usually require keeping such documents for five
years after the report. Keep them longer only if a grant agreement sets a longer period, or
if a list becomes an accounting record (e.g. supporting an expense) – those are kept 8 years
under tax law (§ 147 AO). Changing the period needs
`details.json` plus a new migration for the deletion job.

---

## 6. Data subject rights – how to handle requests

Requests reach info@esnmesa.org. Answer within one month (Art. 12(3)).
Verify the requester's identity sensibly (e.g. reply from the address they used, or ask
which events they attended) – the app stores no contact data.

Run in the Supabase dashboard → SQL editor (service role) – the API refuses deletes:

```sql
-- Access (Art. 15): all sign-ins of a person
select e.title, e.event_date, p.*
from participants p join events e on e.id = p.event_id
where lower(p.first_name) = lower('Erika') and lower(p.last_name) = lower('Mustermann')
order by e.event_date;

-- Objection / erasure (Art. 21, 17): delete those rows – unless they are still needed
-- for this year's report to funders; then tell the person, restrict use and delete later
delete from participants where id in ('<id>', '<id>');

-- Rectification (Art. 16)
update participants set last_name = 'Musterfrau' where id = '<id>';
```

After a deletion, also remove the person from the printed list in the office folder
(black out) and tell organisers to delete old exports. Deleted rows remain in Supabase's
backups until these rotate out; they are not restored from there. Portability (Art. 20) applies only
to data processed on contract or consent – here name and signature as acceptance of the
disclaimer (Art. 6(1)(b)); export those columns of the query result as CSV. The saved details
(consent) are on the participant's own device.

### 6a. Data breaches (Art. 33, 34)

E.g. a leaked service role key, a lost unlocked organiser device, a lost printed list.

1. Whoever notices it tells the board at once (info@esnmesa.org); stop the leak (rotate the
   key, sign the account out, …).
2. The board reports it to BayLDA within **72 hours** of becoming aware
   (online form on lda.bayern.de), unless it is unlikely to put anyone at risk.
3. If the risk is high (e.g. signatures exposed), also inform the participants affected.
4. Note every breach – facts, effects, measures, and why it was or was not reported – in
   the association's breach log, even if not reported (Art. 33(5)).

---

## 7. Technical and organisational measures (Art. 32)

**Access control**
- Organiser area, kiosk and exports require a Google login with an `@esnmesa.org`
  Workspace account; checked on the server (`hd` claim and email domain,
  [`lib/auth.ts`](../lib/auth.ts), [`proxy.ts`](../proxy.ts)) and again in the database.
- Row Level Security on all tables: anyone may **insert** a sign-in, nobody but Workspace
  members may **read** participants, nobody may update participant rows; events are
  readable by Workspace members only. Nobody may **delete** events or sign-ins through the
  API – only the retention job and admins in SQL. A trigger rejects sign-ups from other domains.
- Need-to-know: every `@esnmesa.org` account belongs to a member of the association who
  organises events, so all of them may read all lists; organisers regularly cover each other's events. Accounts are only given
  to such members and removed when they leave. Revisit if accounts are ever given to
  people who do not organise events.
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
  fonts or scripts. Saved details are opt-in, stay in the browser (never sent to the
  server) and never hold the signature.
- Signatures are reduced to a tiny 2-bit greyscale image.
- Kiosk mode never stores or pre-fills anyone's details, and tells the browser not to
  remember entered names (`autocomplete="off"`); the form resets after each person.
- Organisers' login IP addresses are removed after 30 days (section 5).

**Organisational rules for organisers**
- Delete downloaded PDF/CSV files from your device once the list is printed and filed;
  never send them by messenger or store them in private cloud storage.
- Keep the office folder with printed lists locked; destroy printed lists with the
  digital ones at the end of the retention period (shredder or data protection bin).
- Carry a paper list for participants who do not want to sign in digitally.
- **Kiosk mode (signing in on your device):** your device is signed in to the organiser
  area, so anyone holding it can leave the form and see every attendance list. Never leave
  the device alone with a participant – stay next to them while they sign in. Where possible
  pin the browser to the form (Android: app pinning; iPhone/iPad: Guided Access) and lock the
  device when you put it down.
- Organisers use participants' data only for the attendance lists and keep it confidential.
  Written confidentiality commitments (Verpflichtung auf Vertraulichkeit) are not collected
  yet – recommended as proof of this instruction (open point 5).

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
thousand sign-ins a year, kept for five years). The processing is not on the BayLDA list of operations that
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
2. **Data processing agreements:** accept the Cloud Data Processing Addendum in the Google
   Workspace admin console. Save dated PDFs of the Supabase DPA and TIA (Organisation →
   Settings → Legal Documents) and of vercel.com/legal/dpa – not strictly required, but
   the easiest evidence of which version applied.
3. **Paper alternative:** the notice tells people who don't want to sign in digitally to
   ask for a paper list – organisers need to know this and carry one (section 7).
4. **Printed lists:** destroying them at the end of the retention period must be part of
   the office routine.
5. **Organisational rules** (section 7): tell all organisers. Recommended: have current
   organisers sign a short confidentiality commitment, and new ones when they get an
   `@esnmesa.org` account (date it when signed; not legally required, but the usual
   evidence for Art. 5(2), 24 and 32(4) GDPR).
6. **Retention period** (set to five years, 21 October 2026): confirm it against the grant
   agreements (e.g. LEI), and check whether lists are ever used as accounting records
   (8 years). If so, lengthen it.
7. **DPO removed** (section 9a): if a DPO was ever reported to BayLDA, withdraw that
   report; recount the people processing personal data each year and appoint a DPO
   once there are 20 or more.
8. **Record of processing activities:** take sections 2 and 4 into the association's
   Art. 30 record.
9. **Impressum contact:** besides email only office hours are given; a phone number or
   contact form would be safer under § 5 DDG.
10. **esnmesa.org Impressum** lacks board and register entry and links the discontinued
    EU ODR platform.
11. **Nationality and the other statistics fields:** resolved – the funders'
    attendance-list template asks for them per person (named in the privacy notice).
    Keep a copy of the template with the data protection documents as evidence, and
    remove a field if a new template no longer asks for it.
12. **Two-factor authentication:** enforce it in the Google Workspace admin console and
    check it on the Supabase, Vercel and GitHub accounts with access (section 7).
13. **Minors:** the disclaimer assumes every participant is of full age. If minors may
    attend, the disclaimer and the sign-in (parents' signature) need changes.
