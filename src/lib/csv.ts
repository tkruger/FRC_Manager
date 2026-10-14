// CSV cells for exports. Quotes cells that need it, and defuses spreadsheet formulas: a
// cell starting with = + - @ (or a tab/carriage return) is prefixed with ' so Excel and
// Google Sheets show it as text instead of running it.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (FORMULA_START.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
