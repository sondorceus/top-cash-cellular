// Shop listings store — Vercel Blob JSON, same pattern as the price
// overrides (app/lib/quote.ts readPriceOverrides / app/api/admin/prices).
//
// WHY BLOB AND NOT THE POSTGRES SCHEMA IN db/schema.sql: the schema is the
// destination, but it isn't provisioned, and Skywalker wants to post devices
// NOW. v1 sells by inquiry (buyer reserves, owner closes in person or by
// Zelle/Cash App — the rails the buyback side already uses), so there is no
// automated checkout race to lose: a double-inquiry is mediated by a human,
// not by claim_unit(). When Stripe lands, listings migrate into `unit` rows
// and this file becomes the import script's source.
//
// PRIVACY — the reason for the random suffix. Blob URLs are public and the
// store hostname leaks through every listing photo we serve. A predictable
// pathname like shop/listings.json would let anyone fetch the raw document,
// and the raw document carries costCents — what TCC paid for each device.
// addRandomSuffix:true makes the pathname unguessable; only the server can
// find it, via list() with the RW token. The public API strips cost before
// anything leaves the server. Do not "simplify" this to a fixed pathname.
//
// Concurrency: single-writer (one owner posting from /admin/shop). Writes are
// read-modify-write over the whole doc — fine for one admin, wrong for two.
// If a second poster ever exists, move to Postgres first.

import { list, put, del } from "@vercel/blob";
import type { ListingGrade } from "./shop-grades";

const PREFIX = "shop-private/listings-";

export type ListingStatus = "listed" | "on_hold" | "sold" | "removed";

export type ShopListing = {
  id: string; // "tcc-<base36 time><rand>" — stable across edits
  modelLabel: string; // "iPhone 14 Pro" — RESELL_ESTIMATES key when possible
  category: string; // sell-catalog Device.category ("iPhone", "Samsung", "MacBook"…) — drives browse filters
  familySku: string; // prefix key for familyForSku() shipping math, e.g. "ip14pro"
  storage?: string; // "256GB"
  color?: string;
  carrier: string; // "Unlocked" | "AT&T" | "T-Mobile" | "Verizon"
  grade: ListingGrade;
  batteryPct?: number; // shown on the listing — one-of-one's advantage over stock-photo stores
  priceCents: number;
  costCents?: number; // PRIVATE. Never serialized by toPublic(). See header.
  photos: string[]; // real photos of THIS unit (Blob URLs from /api/upload)
  stockImage?: string; // DEVICE_IMAGES fallback when photos is empty
  notes?: string; // public copy, e.g. "includes original box"
  status: ListingStatus;
  postedAt: string; // ISO
  soldAt?: string;
  updatedAt: string;
};

export type ShopListingPublic = Omit<ShopListing, "costCents">;

export function toPublic(l: ShopListing): ShopListingPublic {
  const { costCents: _cost, ...pub } = l;
  return pub;
}

type ListingsDoc = { listings: ShopListing[]; updatedAt: string };
const EMPTY: ListingsDoc = { listings: [], updatedAt: "" };

/** Newest doc wins. Multiple blobs can coexist for the seconds between a
 *  write and its prune; uploadedAt disambiguates. */
export async function readListingsDoc(): Promise<ListingsDoc> {
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 20 });
    if (!blobs.length) return EMPTY;
    const newest = blobs.reduce((a, b) =>
      new Date(a.uploadedAt) > new Date(b.uploadedAt) ? a : b,
    );
    const r = await fetch(newest.url, { cache: "no-store" });
    if (!r.ok) return EMPTY;
    const d = await r.json();
    if (!Array.isArray(d.listings)) return EMPTY;
    return { listings: d.listings, updatedAt: d.updatedAt || "" };
  } catch {
    return EMPTY;
  }
}

/** Replace the whole doc: write new suffixed blob, then prune older ones.
 *  Prune failures are swallowed — a stale extra blob costs cents and loses
 *  the newest-wins race anyway. */
export async function writeListingsDoc(listings: ShopListing[]): Promise<void> {
  const doc: ListingsDoc = { listings, updatedAt: new Date().toISOString() };
  const written = await put(`${PREFIX}doc.json`, JSON.stringify(doc, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true,
  });
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    for (const b of blobs) {
      if (b.url !== written.url) {
        try {
          await del(b.url);
        } catch {}
      }
    }
  } catch {}
}

export function newListingId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `tcc-${t}${r}`;
}

/** Everything a buyer may see: listed units, plus on_hold ones (shown with a
 *  "reserve pending" badge so a second buyer isn't burned at inquiry time),
 *  plus sold (for "recently sold" social proof). Removed is admin-only. */
export async function readPublicListings(): Promise<ShopListingPublic[]> {
  const { listings } = await readListingsDoc();
  return listings.filter((l) => l.status !== "removed").map(toPublic);
}
