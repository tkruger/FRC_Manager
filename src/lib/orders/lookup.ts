// Fill an order item from a product link. Server-only.
//
// Most FRC vendors (AndyMark, REV, WCP, Swyft, TTB, …) run Shopify, which serves
// product data at /products/<handle>.js — the same approach frctools/order-list uses.
// Other sites fall back to schema.org Product JSON-LD and OpenGraph tags. Some sites
// (McMaster-Carr) block automated requests; then we just fill the vendor.
//
// Pages that sell several products return them as `choices` for the person to pick:
// Shopify products with several variants, and WCP "family" pages (one page, many part
// numbers, listed from a published spreadsheet). Amazon gets its own parser.

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface ProductInfo {
  vendorName: string | null;
  name:       string | null;
  partNumber: string | null;
  unitCost:   number | null;
  /** The page sells several products — the person picks which to add */
  choices?:   ProductChoice[];
}

export interface ProductChoice {
  label:      string;
  partNumber: string | null;
  unitCost:   number | null;
  /** Link to that exact product */
  url:        string;
}

const KNOWN_VENDORS: [RegExp, string][] = [
  [/(^|\.)andymark\.com$/, "AndyMark"],
  [/(^|\.)revrobotics\.com$/, "REV Robotics"],
  [/(^|\.)wcproducts\.com$/, "West Coast Products"],
  [/(^|\.)swyftrobotics\.com$/, "Swyft Robotics"],
  [/(^|\.)thethriftybot\.com$/, "The Thrifty Bot"],
  [/(^|\.)ctr-electronics\.com$/, "CTR Electronics"],
  [/(^|\.)vexrobotics\.com$/, "VEX Robotics"],
  [/(^|\.)mcmaster\.com$/, "McMaster-Carr"],
  [/(^|\.)amazon\.[a-z.]+$/, "Amazon"],
  [/^(a\.co|amzn\.to|amzn\.com)$/, "Amazon"],
  [/(^|\.)digikey\.com$/, "Digi-Key"],
  [/(^|\.)mouser\.com$/, "Mouser"],
  [/(^|\.)automationdirect\.com$/, "AutomationDirect"],
  [/(^|\.)reduxrobotics\.com$/, "Redux Robotics"],
  [/(^|\.)studica\.com$/, "Studica"],
  [/(^|\.)playingwithfusion\.com$/, "Playing With Fusion"],
  [/(^|\.)homedepot\.com$/, "Home Depot"],
  [/(^|\.)lowes\.com$/, "Lowe's"],
];

export function vendorFromHost(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (isIP(host)) return host;
  const known = KNOWN_VENDORS.find(([re]) => re.test(host));
  if (known) return known[1];
  const base = host.split(".").slice(-2, -1)[0] ?? host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ── Safe fetching (never reach private/internal addresses) ───────────────────

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:") && isPrivateIp(v.slice(7));
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
         (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only web links are supported.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Unsupported link.");
  const addresses = await dnsLookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) throw new Error("Unsupported link.");
}

const MAX_BYTES = 2_000_000;

async function safeFetch(url: URL, accept: string, headers: Record<string, string> = {}): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal:   AbortSignal.timeout(6000),
      headers:  { Accept: accept, "User-Agent": "FRC-Manager/1.0 (team order list)", ...headers },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      continue;
    }
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); break; }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  return null;
}

// ── Shopify ─────────────────────────────────────────────────────────────────

interface ShopifyVariant { id: number; title?: string; price?: number | string; sku?: string }
interface ShopifyProduct {
  title?: string;
  vendor?: string;
  variants?: ShopifyVariant[];
}

/** .js endpoints give prices in cents; .json endpoints as "12.99" */
function shopifyPrice(v: ShopifyVariant | undefined): number | null {
  const price = typeof v?.price === "number" ? v.price / 100 : v?.price ? Number(v.price) : null;
  return price != null && Number.isFinite(price) ? price : null;
}

async function fromShopify(url: URL): Promise<Partial<ProductInfo> | null> {
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("products");
  const handle = idx >= 0 ? parts[idx + 1] : null;
  if (!handle) return null;

  const body = await safeFetch(new URL(`/products/${handle}.js`, url.origin), "application/json");
  if (!body) return null;
  let p: ShopifyProduct;
  try { p = JSON.parse(body); } catch { return null; }
  if (!p.title || !p.variants?.length) return null;

  const nameOf = (v: ShopifyVariant) => `${p.title}${v.title && v.title !== "Default Title" ? ` — ${v.title}` : ""}`;
  const wanted = url.searchParams.get("variant");
  const chosen = p.variants.find((x) => String(x.id) === wanted);

  // Several variants (sizes, bores, …) and the link doesn't name one: let the person choose
  if (!chosen && p.variants.length > 1) {
    return {
      name: null, partNumber: null, unitCost: null, vendorName: p.vendor || null,
      choices: p.variants.map((v) => {
        const u = new URL(url.toString());
        u.searchParams.set("variant", String(v.id));
        return { label: nameOf(v), partNumber: v.sku || null, unitCost: shopifyPrice(v), url: u.toString() };
      }),
    };
  }
  const v = chosen ?? p.variants[0];
  return {
    name:       nameOf(v),
    partNumber: v.sku || null,
    unitCost:   shopifyPrice(v),
    vendorName: p.vendor || null,
  };
}

// ── WCP family pages ────────────────────────────────────────────────────────

/** Parse CSV (quoted fields, doubled quotes, line breaks inside quotes) */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const WCP_SHEET = /https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[A-Za-z0-9_-]+\/pub\?[^"'\s<]*output=csv/;

/**
 * WCP pages like "Aluminum HTD Timing Pulleys" list many parts from a published Google
 * Sheet (part number + description); each part is its own product with its own price.
 */
async function fromWcpFamily(url: URL): Promise<ProductInfo | null> {
  const html = await safeFetch(url, "text/html");
  const sheet = html?.match(WCP_SHEET)?.[0];
  if (!sheet) return null;
  const csv = await safeFetch(new URL(sheet.replace(/&amp;/g, "&")), "text/csv");
  if (!csv) return null;

  const [header = [], ...rows] = parseCsv(csv);
  const col = (name: string) => header.findIndex((h) => h.replace(/^﻿/, "").trim().toUpperCase() === name);
  const pn = col("P/N"), desc = col("DESCRIPTION"), live = col("LIVE");
  if (pn < 0) return null;

  const parts = rows
    .filter((r) => /^WCP-\d+$/i.test(r[pn]?.trim() ?? "") && (live < 0 || r[live]?.trim().toUpperCase() !== "FALSE"))
    .slice(0, 120)
    .map((r) => ({ partNumber: r[pn].trim().toUpperCase(), label: (desc >= 0 ? r[desc]?.trim() : "") || r[pn].trim() }));
  if (parts.length < 2) return null;

  // Prices live on each part's own product page; fetch them together
  const choices = await Promise.all(parts.map(async (p) => {
    const productUrl = new URL(`/products/${p.partNumber.toLowerCase()}`, url.origin);
    let unitCost: number | null = null;
    try {
      const body = await safeFetch(new URL(`${productUrl.pathname}.js`, url.origin), "application/json");
      unitCost = body ? shopifyPrice((JSON.parse(body) as ShopifyProduct).variants?.[0]) : null;
    } catch { /* price stays blank; filled in when picked */ }
    return { label: p.label, partNumber: p.partNumber, unitCost, url: productUrl.toString() };
  }));

  return { vendorName: "West Coast Products", name: null, partNumber: null, unitCost: null, choices };
}

// ── Amazon ──────────────────────────────────────────────────────────────────

// Amazon only serves its product page to browser-like requests
const BROWSER_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const AMAZON_SHORT = /^(a\.co|amzn\.to|amzn\.com)$/i;

function asinFrom(url: URL): string | null {
  return url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1]?.toUpperCase() ?? null;
}

/** Short links (a.co, amzn.to) redirect to the product page — follow them first */
async function resolveShortLink(url: URL): Promise<URL> {
  if (!AMAZON_SHORT.test(url.hostname)) return url;
  let current = url;
  for (let hop = 0; hop < 4 && !asinFrom(current); hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(6000), headers: BROWSER_HEADERS });
    const next = res.headers.get("location");
    if (!next || res.status < 300 || res.status >= 400) break;
    current = new URL(next, current);
  }
  return current;
}

async function fromAmazon(input: URL): Promise<ProductInfo> {
  const url = await resolveShortLink(input);
  const asin = asinFrom(url);
  // The link itself usually carries the product name: /Some-Product-Name/dp/B0…
  const slug = url.pathname.match(/^\/([^/]+)\/(?:dp|gp)\//)?.[1];
  const fallback: ProductInfo = {
    vendorName: "Amazon",
    name:       slug ? decodeURIComponent(slug).replace(/-/g, " ") : null,
    partNumber: asin,
    unitCost:   null,
  };
  if (!asin || AMAZON_SHORT.test(url.hostname)) return fallback;

  const host = url.hostname.startsWith("www.") ? url.hostname : `www.${url.hostname}`;
  const html = await safeFetch(new URL(`https://${host}/dp/${asin}`), "text/html,application/xhtml+xml", BROWSER_HEADERS)
    .catch(() => null);
  // Amazon sometimes answers automated requests with a robot check instead of the page
  if (!html || !html.includes('id="productTitle"')) return fallback;

  const title = html.match(/id="productTitle"[^>]*>\s*([^<]+?)\s*</)?.[1];
  const price = Number(
    html.match(/"priceAmount":\s*([\d.]+)/)?.[1] ??
    html.match(/priceToPay[\s\S]{0,600}?\$\s*([\d,]+\.\d{2})/)?.[1]?.replace(/,/g, "") ??
    NaN,
  );
  return {
    ...fallback,
    name:     title ? decodeEntities(title) : fallback.name,
    unitCost: Number.isFinite(price) && price > 0 ? price : null,
  };
}

// ── Generic HTML ────────────────────────────────────────────────────────────

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function metaContent(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re) ?? html.match(re2);
  return m ? decodeEntities(m[1]).trim() : null;
}

function fromHtml(html: string): Partial<ProductInfo> {
  // schema.org Product in JSON-LD
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes: Record<string, unknown>[] = Array.isArray(data) ? data : data["@graph"] ?? [data];
      const product = nodes.find((n) => {
        const t = n["@type"];
        return t === "Product" || (Array.isArray(t) && t.includes("Product"));
      }) as { name?: string; sku?: string; mpn?: string; offers?: unknown } | undefined;
      if (product?.name) {
        const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers as { price?: string | number; lowPrice?: string | number } | undefined;
        const price = Number((offer as { price?: unknown; lowPrice?: unknown })?.price ?? (offer as { lowPrice?: unknown })?.lowPrice);
        return {
          name:       decodeEntities(product.name),
          partNumber: product.sku || product.mpn || null,
          unitCost:   Number.isFinite(price) && price > 0 ? price : null,
        };
      }
    } catch { /* not valid JSON-LD — keep looking */ }
  }
  // OpenGraph / product meta tags
  const price = Number(metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount"));
  return {
    name:     metaContent(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? null,
    unitCost: Number.isFinite(price) && price > 0 ? price : null,
  };
}

/** Best-effort product details from a link. Never throws for unreachable pages. */
export async function lookupProduct(rawUrl: string): Promise<ProductInfo> {
  const url = new URL(rawUrl);
  const vendorName = vendorFromHost(url.hostname);
  const empty: ProductInfo = { vendorName, name: null, partNumber: null, unitCost: null };

  if (vendorName === "Amazon") {
    try { return await fromAmazon(url); } catch { return empty; }
  }

  // A WCP page listing many parts (its own product is just a placeholder)
  if (vendorName === "West Coast Products" && !/^\/products\/wcp-\d+/i.test(url.pathname)) {
    try {
      const family = await fromWcpFamily(url);
      if (family) return family;
    } catch { /* not a family page — read it like any other */ }
  }

  try {
    const shopify = await fromShopify(url);
    if (shopify?.name || shopify?.choices) return { ...empty, ...shopify, vendorName: vendorName ?? shopify.vendorName ?? null };
  } catch { /* fall through to HTML */ }

  try {
    const html = await safeFetch(url, "text/html,application/xhtml+xml");
    if (html) {
      const found = fromHtml(html);
      // Blocked or generic pages just repeat the store's name — that isn't a product name
      const generic = !found.name ||
        (found.name.toLowerCase().includes(vendorName.toLowerCase()) && found.name.length <= vendorName.length + 15);
      return { ...empty, ...found, name: generic ? null : found.name ?? null, vendorName };
    }
  } catch { /* site blocked us — vendor name is still useful */ }

  return empty;
}
