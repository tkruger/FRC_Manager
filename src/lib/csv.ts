// CSV cells for exports, and reading CSV files back in. Client-safe.
//
// Exports: Quotes cells that need it, and defuses spreadsheet formulas: a
// cell starting with = + - @ (or a tab/carriage return) is prefixed with ' so Excel and
// Google Sheets show it as text instead of running it.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (FORMULA_START.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Splits CSV text into rows of cells. Quoted cells may contain commas, "" and line breaks
 * (multi-line Markdown details), so rows are found here rather than by splitting lines.
 */
export function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur); cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && content[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  // Undo the ' that exports put in front of formula-like text (see csvCell)
  return rows.map((r) => r.map((c) => (/^'[=+\-@\t\r]/.test(c) ? c.slice(1) : c.replace(/\r\n/g, "\n"))));
}
