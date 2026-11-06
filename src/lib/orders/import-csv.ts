// Reading order items from a CSV file into the New order form. Client-safe.
//
// Takes the app's own export (no header row: item ID, Vendor, Part Name, Link, Unit Price, Qty,
// Order Notes, Order Date — see itemsToCsv) or any spreadsheet with a header row naming its columns
// (Item / Part / Name, Vendor, Link / URL, Price / Unit cost, Qty / Quantity, Part number, Notes,
// Sub-team, Importance, Reason). Prices like "$1,234.50" are fine. Rows without a name are skipped.

import { parseCsvRows } from "@/lib/csv";
import { SUBTEAM_OPTIONS } from "@/lib/schedule-helpers";

export interface ImportedItem {
  name:       string;
  vendorName: string;
  partNumber: string;
  link:       string;
  unitCost:   string;
  quantity:   string;
  notes:      string;
  reasoning:  string;
  subTeam:    string;
  importance: string;
}

type Field = keyof ImportedItem;

/** Header names → fields (lowercase, letters only) */
const HEADERS: Record<string, Field> = {
  name: "name", item: "name", itemname: "name", part: "name", partname: "name", product: "name", productname: "name", description: "name",
  vendor: "vendorName", vendorname: "vendorName", supplier: "vendorName", store: "vendorName",
  partnumber: "partNumber", partno: "partNumber", sku: "partNumber", vendorpartnumber: "partNumber", mpn: "partNumber",
  link: "link", url: "link", productlink: "link", producturl: "link", vendorproducturl: "link",
  price: "unitCost", unitprice: "unitCost", unitcost: "unitCost", cost: "unitCost", priceeach: "unitCost", each: "unitCost",
  qty: "quantity", quantity: "quantity", count: "quantity", amount: "quantity",
  notes: "notes", note: "notes", ordernotes: "notes", comments: "notes",
  reason: "reasoning", reasoning: "reasoning", why: "reasoning", justification: "reasoning", whyneeded: "reasoning",
  subteam: "subTeam", team: "subTeam",
  importance: "importance", priority: "importance",
};

/** The app's export: item ID, Vendor, Part Name, Link, Unit Price, Qty, Order Notes, Order Date */
const EXPORT_ORDER: (Field | null)[] = [null, "vendorName", "name", "link", "unitCost", "quantity", "notes", null];

const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const SUBTEAMS = new Map(SUBTEAM_OPTIONS.flatMap((o) => [[key(o.value), o.value], [key(o.label), o.value]]));

function money(v: string): string {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return v.trim() && Number.isFinite(n) && n >= 0 ? n.toFixed(2) : "";
}
function qty(v: string): string {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? String(n) : "1";
}

export function parseOrderCsv(text: string): { items: ImportedItem[]; skipped: number; error?: string } {
  const rows = parseCsvRows(text.replace(/^﻿/, "")).filter((r) => r.some((c) => c.trim()));
  if (rows.length === 0) return { items: [], skipped: 0, error: "That file is empty." };

  // A header row names at least two columns we know
  const named = rows[0].map((c) => HEADERS[key(c)] ?? null);
  const hasHeader = named.filter(Boolean).length >= 2;
  const columns = hasHeader ? named : EXPORT_ORDER;
  if (!hasHeader && rows[0].length < 3) {
    return { items: [], skipped: 0, error: "Couldn't find the columns. Use the app's CSV export, or add a header row (Item, Vendor, Link, Price, Qty…)." };
  }

  const items: ImportedItem[] = [];
  let skipped = 0;
  for (const row of rows.slice(hasHeader ? 1 : 0)) {
    const get = (f: Field) => { const i = columns.indexOf(f); return i >= 0 ? (row[i] ?? "").trim() : ""; };
    const name = get("name");
    if (!name) { skipped++; continue; }
    const imp = get("importance").toUpperCase();
    items.push({
      name:       name.slice(0, 300),
      vendorName: get("vendorName").slice(0, 200),
      partNumber: get("partNumber").slice(0, 100),
      link:       /^https?:\/\//i.test(get("link")) ? get("link") : "",
      unitCost:   money(get("unitCost")),
      quantity:   qty(get("quantity")),
      notes:      get("notes").slice(0, 2000),
      reasoning:  get("reasoning").slice(0, 2000),
      subTeam:    SUBTEAMS.get(key(get("subTeam"))) ?? "",
      importance: imp === "URGENT" || imp === "EMERGENCY" ? imp : "ROUTINE",
    });
  }
  if (items.length === 0) return { items, skipped, error: "No items found — each row needs an item name." };
  if (items.length > 200) return { items: [], skipped, error: "That's more than 200 items — split it into smaller orders." };
  return { items, skipped };
}
