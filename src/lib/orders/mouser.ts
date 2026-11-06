// Mouser product links. Mouser's website blocks automated page reads, so details come from:
//  1. the link itself — /ProductDetail/<Manufacturer>/<Part number> (always works), and
//  2. Mouser's Search API, when the team (or the deployment, MOUSER_API_KEY) has a key: the real
//     description, Mouser's own part number and the price for one.
// Server-only.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/security/secret-box";

export interface MouserPart { name: string | null; partNumber: string | null; unitCost: number | null }

/** "/ProductDetail/Texas-Instruments/SN74HC595N" → Texas Instruments, SN74HC595N; "/ProductDetail/595-SN74HC595N" → that part number */
export function mouserFromUrl(url: URL): { manufacturer: string | null; part: string | null } {
  const parts = url.pathname.split("/").filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const i = parts.findIndex((p) => p.toLowerCase() === "productdetail");
  if (i < 0) return { manufacturer: null, part: null };
  const rest = parts.slice(i + 1);
  if (rest.length >= 2) return { manufacturer: rest[0].replace(/-/g, " ").trim() || null, part: rest[1].trim() || null };
  return { manufacturer: null, part: rest[0]?.trim() || null };
}

/** The team's Mouser key, else the deployment's shared one */
export const mouserKeyFor = cache(async (teamId: string | null | undefined): Promise<{ key: string; source: "team" | "shared" } | null> => {
  if (teamId) {
    const row = await prisma.teamVendorKeys.findUnique({ where: { teamId }, select: { mouserKeyEnc: true } });
    const own = row?.mouserKeyEnc ? open(row.mouserKeyEnc) : null;
    if (own) return { key: own, source: "team" };
  }
  const shared = process.env.MOUSER_API_KEY;
  return shared ? { key: shared, source: "shared" } : null;
});

interface SearchResponse {
  Errors?: { Message?: string }[];
  SearchResults?: { Parts?: {
    Description?: string; Manufacturer?: string; ManufacturerPartNumber?: string; MouserPartNumber?: string;
    PriceBreaks?: { Quantity?: number; Price?: string }[];
  }[] } | null;
}

/** Mouser's part-number search; null when the key is refused or nothing matched */
export async function mouserSearch(key: string, partNumber: string): Promise<SearchResponse | null> {
  const res = await fetch(`https://api.mouser.com/api/v1/search/partnumber?apiKey=${encodeURIComponent(key)}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify({ SearchByPartRequest: { mouserPartNumber: partNumber, partSearchOptions: "Exact" } }),
    signal:  AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  return await res.json() as SearchResponse;
}

/** Does Mouser accept this key? (searches for a common part) */
export async function checkMouserKey(key: string): Promise<boolean> {
  try {
    const r = await mouserSearch(key, "SN74HC595N");
    return !!r && !(r.Errors?.length) && !!r.SearchResults;
  } catch {
    return false;
  }
}

/** A Mouser link's product, as much as can be known */
export async function lookupMouser(url: URL, teamId: string | null | undefined): Promise<MouserPart> {
  const { manufacturer, part } = mouserFromUrl(url);
  const fallback: MouserPart = { name: part ? [manufacturer, part].filter(Boolean).join(" ") : null, partNumber: part, unitCost: null };
  if (!part) return fallback;
  const k = await mouserKeyFor(teamId).catch(() => null);
  if (!k) return fallback;
  try {
    const r = await mouserSearch(k.key, part);
    const p = r?.SearchResults?.Parts?.find((x) => x.ManufacturerPartNumber?.toLowerCase() === part.toLowerCase() || x.MouserPartNumber?.toLowerCase() === part.toLowerCase())
      ?? r?.SearchResults?.Parts?.[0];
    if (!p) return fallback;
    const one = [...(p.PriceBreaks ?? [])].sort((a, b) => (a.Quantity ?? 0) - (b.Quantity ?? 0))[0];
    const price = one?.Price ? Number(one.Price.replace(/[^0-9.]/g, "")) : NaN;
    const mpn = p.ManufacturerPartNumber || part;
    return {
      name:       [p.Manufacturer || manufacturer, mpn].filter(Boolean).join(" ") + (p.Description ? ` — ${p.Description}` : ""),
      partNumber: p.MouserPartNumber || mpn,
      unitCost:   Number.isFinite(price) && price > 0 ? price : null,
    };
  } catch {
    return fallback;
  }
}
