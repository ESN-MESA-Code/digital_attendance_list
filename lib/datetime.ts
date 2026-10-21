// <input type="datetime-local"> holds a wall-clock time without a zone
// ("2026-11-05T19:00"). Convert in the browser, so 19:00 means 19:00 where
// the organiser is, not 19:00 UTC.

/** "2026-11-05T19:00" (local time) → ISO timestamp with zone. */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

/** ISO timestamp → "2026-11-05T19:00" in local time, for the input. */
export function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
