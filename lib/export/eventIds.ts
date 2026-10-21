// The ?ids=… list of the combined PDF export: comma-separated event uuids.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Most events one combined export may hold. */
export const MAX_EXPORT_EVENTS = 50;

/** The distinct, lower-cased ids, or null if the list is empty, too long or malformed. */
export function parseEventIds(value: string | null | undefined): string[] | null {
  if (!value) return null;
  const ids = [...new Set(value.split(",").map((id) => id.trim().toLowerCase()))];
  if (ids.length === 0 || ids.length > MAX_EXPORT_EVENTS) return null;
  return ids.every((id) => UUID.test(id)) ? ids : null;
}
