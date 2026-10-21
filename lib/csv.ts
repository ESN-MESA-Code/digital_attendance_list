// CSV export helpers.

// Spreadsheet apps run cells starting with these as formulas. Names come from
// the public form, so "=HYPERLINK(…)" must not reach an organiser's Excel.
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell: formulas neutralised with a leading ', quoted when needed. */
export function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  let str = String(value);
  if (FORMULA_START.test(str)) str = `'${str}`;
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
