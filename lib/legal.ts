// Details for the Impressum and the privacy notice, in one place so both
// pages stay in sync. Update them when the board, the office or the
// processors change (board as on mesa.esn-germany.de/legal-notice).

export const ASSOCIATION = {
  name: "Münchner Erasmus Studenten Assoziation (MESA) e.V.",
  shortName: "MESA e.V.",
  address: [
    "c/o Referat Internationale Angelegenheiten",
    "Geschwister-Scholl-Platz 1",
    "80539 München",
    "Germany",
  ],
  email: "info@lmu-mesa.org",
  // Second, direct way to reach us besides email (§ 5 DDG).
  office: {
    de: "Büro: Schellingstraße 7, Raum 012, 80799 München – Sprechstunde dienstags 18:00–19:30 Uhr",
    en: "Office: Schellingstraße 7, room 012, 80799 Munich – office hours Tuesdays 18:00–19:30",
  },
  // Board members authorised to represent the association (§ 26 BGB).
  board: [
    { name: "Luis Pardo de la Puente", de: "Erster Vorstand", en: "First chair" },
    { name: "Tim Burgtorf", de: "Zweiter Vorstand", en: "Second chair" },
    { name: "Zubenil Mandal", de: "Schatzmeister", en: "Treasurer" },
  ],
  registerCourt: "Amtsgericht München",
  registerNumber: "VR 200385",
  website: "https://mesa.esn-germany.de",
} as const;

export const DATA_PROTECTION_OFFICER = {
  name: "Cevin Neubauer",
  email: "it@esnmesa.org",
} as const;

/** The supervisory authority for private bodies in Bavaria. */
export const SUPERVISORY_AUTHORITY = {
  name: "Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)",
  address: "Promenade 18, 91522 Ansbach, Germany",
  website: "https://www.lda.bayern.de",
} as const;

/**
 * Events and their sign-ins are deleted at the end of the tenth calendar year
 * after the event (supabase/migrations/…_retention.sql).
 */
export const RETENTION_YEARS = 10;

/** Processors that handle personal data for the app (Art. 28 GDPR). */
export const PROCESSORS = {
  hosting: {
    name: "Vercel Inc.",
    address: "440 N Barranca Ave #4133, Covina, CA 91723, USA",
    privacy: "https://vercel.com/legal/privacy-policy",
  },
  database: {
    name: "Supabase Inc.",
    address: "970 Toa Payoh North #07-04, Singapore 318992",
    privacy: "https://supabase.com/privacy",
  },
  login: {
    name: "Google Ireland Limited",
    address: "Gordon House, Barrow Street, Dublin 4, Ireland",
    privacy: "https://policies.google.com/privacy",
  },
} as const;
