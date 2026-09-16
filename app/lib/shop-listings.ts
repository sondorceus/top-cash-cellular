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
// PRIVACY — the reason the pathname is unguessable. Blob URLs are public and
// the store hostname leaks through every listing photo we serve. A
// predictable pathname like shop/listings.json would let anyone fetch the
// raw document, and the raw document carries costCents — what TCC paid for
// each device. Every doc pathname carries a secret tag (random for the first
// doc, then an HMAC of the previous doc's pathname keyed with the store's RW
// token); only the server can find them, via list() with the RW token. The
// KEY is what keeps the chain secret: with a plain hash, anyone who saw one
// doc URL once could derive every later doc offline, forever. The public
// API strips cost before anything leaves the server. Do not "simplify" this
// to a fixed pathname or an unkeyed hash.
//
// Concurrency (2026-09-16 — before this, two overlapping writes each pruned
// the other's blob and the store was EMPTY, one failed read made an admin
// post replace the inventory with itself, and two buyers could both be told
// the same unit was theirs). Writes are read-modify-write over the whole doc
// and buyers write too (a claim flips a unit to on_hold), so:
//   1. A failed read THROWS (ListingsUnavailableError). Only a successful
//      list() with zero blobs means "no listings". Never write after a
//      failed read.
//   2. Docs are GENERATIONS: listings-g<N>-<tag>.json. The doc written on top
//      of generation N has a pathname every writer derives the same way from
//      N's pathname, and Blob refuses to create a pathname that exists. So of
//      two writers who read the same N, exactly one lands N+1; the other
//      re-reads and re-applies (mutateListings). That is a real
//      compare-and-swap — no lost updates, and a buyer claim is simply a
//      write that only one buyer can win.
//   3. The newest generation always wins; older ones are pruned only once
//      they are a minute older than the doc just written, so a slow writer
//      can't re-create a pruned pathname unnoticed.
// The one unguarded case: two writes racing on a store with NO doc at all
// (each picks a random first tag). Buyers can't write to an empty store.
// If a second poster or real checkout ever exists, move to Postgres first.

import { createHmac, randomBytes } from "node:crypto";
import { list, put, del, head, BlobNotFoundError, type ListBlobResultBlob } from "@vercel/blob";
import type { ListingGrade } from "./shop-grades";

const PREFIX = "shop-private/listings-";
// Pre-2026-09-16 docs are listings-doc-<random suffix>.json = generation 0.
const GEN_RE = /^shop-private\/listings-g(\d{1,12})-[0-9a-f]{32}\.json$/;
const PRUNE_AFTER_MS = 60_000;

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
  // PRIVATE. The [SALE: id] this unit was logged under in the MC profit
  // ledger — set only once that write is confirmed, so a relist can
  // tombstone exactly that sale. Never serialized by toPublic().
  saleId?: string;
  updatedAt: string;
};

export type ShopListingPublic = Omit<ShopListing, "costCents" | "saleId">;

export function toPublic(l: ShopListing): ShopListingPublic {
  const { costCents: _cost, saleId: _sale, ...pub } = l;
  return pub;
}

// writeId lets a writer recognise its own doc when the SDK's retry of a put
// that already landed comes back "already exists".
type ListingsDoc = { listings: ShopListing[]; updatedAt: string; writeId?: string };
// A factory, never a shared constant: callers mutate the doc they get back
// (push, sort), and a module-level EMPTY would carry those edits into every
// later "empty" read on the same warm instance.
const emptyDoc = (): ListingsDoc => ({ listings: [], updatedAt: "" });

/** The store couldn't be read or written (list/fetch/put failed, or the doc
 *  is corrupt). NOT the same as "no listings" — callers must not write, and
 *  routes answer 503. `maybeWritten` = a write's outcome couldn't be read
 *  back, so it may have landed: don't tell anyone "nothing was changed". */
export class ListingsUnavailableError extends Error {
  maybeWritten: boolean;
  constructor(message: string, maybeWritten = false) {
    super(message);
    this.name = "ListingsUnavailableError";
    this.maybeWritten = maybeWritten;
  }
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function listDocBlobs(): Promise<ListBlobResultBlob[]> {
  const out: ListBlobResultBlob[] = [];
  let cursor: string | undefined;
  try {
    do {
      const page = await list({ prefix: PREFIX, limit: 1000, cursor });
      out.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (e) {
    throw new ListingsUnavailableError(`listings list failed: ${errMsg(e)}`);
  }
  return out;
}

const genOf = (b: ListBlobResultBlob) => Number(GEN_RE.exec(b.pathname)?.[1] ?? 0);
const ts = (b: ListBlobResultBlob) => new Date(b.uploadedAt).getTime();
// Total order — generation, then upload time, then url — so every reader and
// writer agrees on which doc is "the newest".
const newer = (a: ListBlobResultBlob, b: ListBlobResultBlob) =>
  genOf(a) !== genOf(b) ? genOf(a) > genOf(b) : ts(a) !== ts(b) ? ts(a) > ts(b) : a.url > b.url;
const newestOf = (blobs: ListBlobResultBlob[]) => blobs.reduce((a, b) => (newer(a, b) ? a : b));

/** The pathname of the generation written on top of `base`. Deterministic
 *  (so concurrent writers collide on it) and secret (see header). Keyed with
 *  the RW token because every writer of this store already shares it (so
 *  they all derive the same pathname) and whoever holds it can list() the
 *  docs anyway. Trimmed the way the Blob SDK reads it. */
function nextPathname(base: ListBlobResultBlob | null): string {
  const gen = base ? genOf(base) + 1 : 1;
  let tag: string;
  if (base) {
    const key = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
    if (!key) throw new ListingsUnavailableError("BLOB_READ_WRITE_TOKEN missing — can't derive the next listings doc");
    tag = createHmac("sha256", key).update(base.pathname).digest("hex").slice(0, 32);
  } else {
    tag = randomBytes(16).toString("hex");
  }
  return `${PREFIX}g${String(gen).padStart(9, "0")}-${tag}.json`;
}

/** null = the blob is gone (404). Throws on any other failure. */
async function fetchDoc(url: string): Promise<ListingsDoc | null> {
  let r: Response;
  try {
    r = await fetch(url, { cache: "no-store" });
  } catch (e) {
    throw new ListingsUnavailableError(`listings fetch failed: ${errMsg(e)}`);
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new ListingsUnavailableError(`listings fetch HTTP ${r.status}`);
  let d: { listings?: unknown; updatedAt?: unknown; writeId?: unknown };
  try {
    d = await r.json();
  } catch {
    throw new ListingsUnavailableError("listings doc is not JSON");
  }
  if (!d || !Array.isArray(d.listings)) throw new ListingsUnavailableError("listings doc has no listings array");
  return {
    listings: d.listings as ShopListing[],
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : "",
    writeId: typeof d.writeId === "string" ? d.writeId : undefined,
  };
}

/** Newest doc wins. Older generations linger for a minute after a write. */
async function readNewest(): Promise<{ doc: ListingsDoc; base: ListBlobResultBlob | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const blobs = await listDocBlobs();
    if (!blobs.length) return { doc: emptyDoc(), base: null };
    const newest = newestOf(blobs);
    const doc = await fetchDoc(newest.url);
    // Pruned between our list() and fetch() — re-list and follow the newer
    // doc instead of calling the store empty.
    if (!doc) continue;
    return { doc, base: newest };
  }
  throw new ListingsUnavailableError("newest listings doc kept disappearing");
}

/** Throws ListingsUnavailableError when the store can't be read. */
export async function readListingsDoc(): Promise<ListingsDoc> {
  const { doc } = await readNewest();
  return { listings: doc.listings, updatedAt: doc.updatedAt };
}

/** Write the generation after `base`. false = another writer got there first
 *  (caller re-reads and re-applies). Prune failures are swallowed — a stale
 *  extra blob costs cents and loses the newest-wins race anyway. */
async function writeDoc(listings: ShopListing[], base: ListBlobResultBlob | null): Promise<boolean> {
  const pathname = nextPathname(base);
  const writeId = randomBytes(12).toString("hex");
  const doc: ListingsDoc = { listings, updatedAt: new Date().toISOString(), writeId };
  try {
    // No allowOverwrite: Blob refuses an existing pathname — that refusal IS
    // the compare-and-swap.
    await put(pathname, JSON.stringify(doc, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });
  } catch (e) {
    // Refused, or failed? Look. Missing → a real failure. Couldn't look →
    // it may have landed.
    let url: string;
    try {
      url = (await head(pathname)).url;
    } catch (he) {
      throw new ListingsUnavailableError(`listings write failed: ${errMsg(e)}`, !(he instanceof BlobNotFoundError));
    }
    // Present: ours (the SDK retried a put that had landed) or a rival's.
    // Only a doc we actually READ decides which. Counting an unreadable one
    // as a rival's re-ran apply on top of our own landed write — a buyer
    // told "someone beat you" by their own hold, a post pushed twice. So
    // retry, and if it stays unreadable, fail without guessing.
    let there: ListingsDoc | null = null;
    for (let i = 0; i < 3 && !there; i++) {
      if (i) await new Promise((r) => setTimeout(r, 250 * i));
      there = await fetchDoc(url).catch(() => null);
    }
    if (!there) throw new ListingsUnavailableError("listings write outcome unknown — the new doc can't be read back", true);
    if (there.writeId !== writeId) return false;
  }
  try {
    const blobs = await listDocBlobs();
    const mine = blobs.find((b) => b.pathname === pathname);
    if (mine) {
      // A NEWER generation that predates ours means our pathname had been
      // pruned and we re-created it from a stale read: our doc is an orphan
      // nobody reads. Start over.
      if (blobs.some((b) => genOf(b) > genOf(mine) && ts(b) < ts(mine))) return false;
      for (const b of blobs) {
        if (genOf(b) < genOf(mine) && ts(mine) - ts(b) > PRUNE_AFTER_MS) {
          try {
            await del(b.url);
          } catch {}
        }
      }
    }
  } catch {}
  return true;
}

/** The only way to change listings. `apply` gets a FRESH copy of the
 *  listings, edits it in place, and says whether to write; it may run more
 *  than once (only when a rival's doc was READ in our slot, or ours was
 *  orphaned — never on a doc that already holds this call's change), so it
 *  must be free of side effects — do MC/SMS/email after this resolves.
 *  Throws ListingsUnavailableError when the store can't be read or written. */
export async function mutateListings<T>(
  apply: (listings: ShopListing[]) => { write: boolean; result: T },
): Promise<T> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { doc, base } = await readNewest();
    const { write, result } = apply(doc.listings);
    if (!write) return result;
    if (await writeDoc(doc.listings, base)) return result;
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * Math.min(attempt + 1, 5)));
  }
  throw new ListingsUnavailableError("listings kept changing under this write — try again");
}

export function newListingId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `tcc-${t}${r}`;
}

/** Everything a buyer may see: listed units, plus on_hold ones (shown with a
 *  "reserve pending" badge so a second buyer isn't burned at inquiry time),
 *  plus sold (for "recently sold" social proof). Removed is admin-only.
 *  Public pages never write, so by default a failed read degrades to
 *  "nothing to show" (the storefront's coming-soon state). `strict` throws
 *  instead, for callers where "nothing" would be a lie about ONE unit — a
 *  listing page must not 404 (and get de-indexed) over a Blob hiccup. */
export async function readPublicListings(opts: { strict?: boolean } = {}): Promise<ShopListingPublic[]> {
  let listings: ShopListing[];
  try {
    ({ listings } = await readListingsDoc());
  } catch (e) {
    if (opts.strict) throw e;
    return [];
  }
  return listings.filter((l) => l.status !== "removed").map(toPublic);
}
