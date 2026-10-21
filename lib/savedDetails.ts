// Participant details remembered in a cookie on this device (only with their
// consent), used to pre-fill the attendance form next time. The signature is
// not stored – participants sign again for every event.
const COOKIE_NAME = "mesa_attendance_details";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface SavedDetails {
  first_name: string;
  last_name: string;
  /** ISO country code, e.g. "DE" */
  nationality: string;
  university: string;
  exchange_program: string;
  esn_card: "yes" | "no";
}

export function loadSavedDetails(): SavedDetails | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.slice(COOKIE_NAME.length + 1))) as SavedDetails;
  } catch {
    return null;
  }
}

export function saveDetails(details: SavedDetails) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(details))}` +
    `; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function forgetSavedDetails() {
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}
