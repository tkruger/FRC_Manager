// Fill an order item from a product link. Server-only.
//
// Most FRC vendors (AndyMark, REV, WCP, Swyft, TTB, …) run Shopify, which serves
// product data at /products/<handle>.js — the same approach frctools/order-list uses.
// Other sites fall back to schema.org Product JSON-LD and OpenGraph tags. Some sites
// (McMaster-Carr, Amazon) block automated requests; then we just fill the vendor.

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface ProductInfo {
  vendorName: string | null;
  name:       string | null;
  partNumber: string | null;
  unitCost:   number | null;
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

async function safeFetch(url: URL, accept: string): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal:   AbortSignal.timeout(6000),
      headers:  { Accept: accept, "User-Agent": "FRC-Manager/1.0 (team order list)" },
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

// ── Parsers ─────────────────────────────────────────────────────────────────

interface ShopifyProduct {
  title?: string;
  vendor?: string;
  variants?: { id: number; title?: string; price?: number | string; sku?: string }[];
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

  const wanted = url.searchParams.get("variant");
  const v = p.variants.find((x) => String(x.id) === wanted) ?? p.variants[0];
  // .js endpoints give prices in cents; .json endpoints as "12.99"
  const price = typeof v.price === "number" ? v.price / 100 : v.price ? Number(v.price) : null;
  const variantTitle = v.title && v.title !== "Default Title" ? ` — ${v.title}` : "";
  return {
    name:       `${p.title}${variantTitle}`,
    partNumber: v.sku || null,
    unitCost:   price != null && Number.isFinite(price) ? price : null,
    vendorName: p.vendor || null,
  };
}

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

  try {
    const shopify = await fromShopify(url);
    if (shopify?.name) return { ...empty, ...shopify, vendorName: vendorName ?? shopify.vendorName ?? null };
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
