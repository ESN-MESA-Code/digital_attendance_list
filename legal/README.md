# Legal texts and data protection

Everything about data protection and the legal pages of MESAttendance is in this folder.
The app loads the texts from here, so changing a file here changes the app (after a
deploy) – no code changes needed.

| File | What it is | Shown at |
| --- | --- | --- |
| [`DATA_PROTECTION.md`](DATA_PROTECTION.md) | Full documentation of how personal data is collected, used, protected and deleted – for the board | not shown in the app |
| [`details.json`](details.json) | The facts the texts share: association, supervisory authority, processors, retention, notice version | filled into the texts below |
| [`impressum.md`](impressum.md) | Impressum / legal notice (§ 5 DDG), incl. the board | `/impressum` |
| [`privacy.en.md`](privacy.en.md) | Privacy notice (Art. 13 GDPR), English | `/privacy` |
| [`privacy.de.md`](privacy.de.md) | Datenschutzerklärung, German – must say the same as the English one | `/datenschutz` |
| [`form-disclaimer.en.md`](form-disclaimer.en.md) | Liability disclaimer box on the attendance form | form, step 1 |
| [`form-data-processing.en.md`](form-data-processing.en.md) | "Data processing" box on the attendance form | form, step 1 |

## Editing

- The texts are Markdown. A line ending in `\` keeps the next line on a new line
  (addresses); `<name@example.org>` becomes an email link.
- `{{association.email}}`, `{{association.name}}` and so on are replaced with the values in
  `details.json`. An unknown placeholder makes the build and the tests fail, so typos
  cannot reach the live site.
- Change the English and German privacy notices together, and update `as_of` in
  `details.json`.

## Changes that need more than a text edit

- **Data processing notice** (`form-data-processing.en.md`, or what the privacy notice
  says about sign-ins): bump `notice_version` in `details.json` to the date of the
  change. Every sign-in stores the version it was shown. Sign-ins rest on legitimate
  interest (Art. 6(1)(f)), not consent – see section 2.1a of `DATA_PROTECTION.md` before
  adding fields.
- **Retention period** (`retention` in `details.json`): the automatic deletion runs in
  the database, so it also needs a new migration in `supabase/migrations/` that changes
  `public.delete_expired_events()` (see `20261021001100_retention_five_years.sql`).
- **The printed PDF** has its own bilingual disclaimer, laid out line by line in
  `lib/pdf/generate.ts`.
