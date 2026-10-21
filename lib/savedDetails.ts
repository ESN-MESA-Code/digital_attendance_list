// Participant details remembered in this browser's localStorage (only with
// their consent), used to pre-fill the attendance form next time. Unlike a
// cookie, localStorage is never sent to the server. The signature is not
// stored – participants sign again for every event.
const STORAGE_KEY = "mesa_attendance_details";
// Saved details are forgotten after 12 months, like the cookie used before.
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
// Name of the cookie that held the details before; moved over on first load.
const LEGACY_COOKIE = "mesa_attendance_details";

export interface SavedDetails {
  first_name: string;
  last_name: string;
  /** ISO country code, e.g. "DE" */
  nationality: string;
  university: string;
  exchange_program: string;
  esn_card: "yes" | "no";
}

interface Stored {
  savedAt: number;
  details: SavedDetails;
}

// localStorage can be missing or throw (private mode, blocked site data).
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function write(details: SavedDetails, savedAt = Date.now()) {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify({ savedAt, details } satisfies Stored));
  } catch {
    // Storage full or blocked – the form simply is not pre-filled next time.
  }
}

/** Moves details saved in the old cookie to localStorage and deletes the cookie. */
function migrateLegacyCookie() {
  if (typeof document === "undefined") return;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${LEGACY_COOKIE}=`));
  if (!match) return;
  document.cookie = `${LEGACY_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  try {
    write(JSON.parse(decodeURIComponent(match.slice(LEGACY_COOKIE.length + 1))) as SavedDetails);
  } catch {
    // Corrupt cookie – nothing to keep.
  }
}

export function loadSavedDetails(): SavedDetails | null {
  migrateLegacyCookie();
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (!stored?.details || !(Date.now() - stored.savedAt < MAX_AGE_MS)) {
      forgetSavedDetails();
      return null;
    }
    return stored.details;
  } catch {
    return null;
  }
}

export function saveDetails(details: SavedDetails) {
  write(details);
}

export function forgetSavedDetails() {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored that could be removed.
  }
  if (typeof document !== "undefined") {
    document.cookie = `${LEGACY_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}
