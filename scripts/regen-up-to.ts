// REGEN "UP TO" — rewrites the generated headline block in
// app/data/catalog-prices.ts from advertisedUpTo() (app/lib/advertised-up-to.ts),
// the quote engine's own best offer. /sell/[slug], the landing pages and the
// homepage cards read that block; /go computes the same function live.
// Replaces scripts/check-up-to.py, a Python re-implementation of the engine
// that drifted (no cellular iPads, base-chip MacBooks).
//
//   npx tsx scripts/regen-up-to.ts           dry run: every change, > $50 flagged
//   npx tsx scripts/regen-up-to.ts --write   rewrite the block
//   npx tsx scripts/regen-up-to.ts --check   exit 1 when the block is stale
//
// Run it after ANY PRICE_TABLE, RESELL/NET_PAYOUTS/IWM, MacBook spec or
// homepage STORAGE_MAP change (tsx: the app modules use extensionless imports).
//
// Headline = the best engine offer over the storage tiers the HOMEPAGE funnel
// offers (its STORAGE_MAP, read from app/page.tsx) — /sell and the cards link
// there, so they never name a tier that funnel can't pick. Rows keyed by
// edition ("base") use all their cells.
//
// Gate before writing: tableOfferIgnoringReviewFlag (how manual-review rows
// such as the Z TriFold are priced) must equal quoteDeviceSync on every other
// cell, so that copy of the engine math can't drift unnoticed.

import { readFileSync, writeFileSync } from "fs";
import { PRICE_TABLE, MANUAL_REVIEW_DEVICES } from "../app/data/prices";
import { quoteDeviceSync, EMPTY_OVERRIDES } from "../app/lib/quote-engine";
import { advertisedUpTo, engineCeiling, engineModelIds, tableOfferIgnoringReviewFlag } from "../app/lib/advertised-up-to";
import { DEVICES } from "../app/data/sell-catalog";
import skuLabelsJson from "../app/data/sku-labels.json";

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const SKU_LABELS = skuLabelsJson as Record<string, string>;
const CATALOG = new URL("../app/data/catalog-prices.ts", import.meta.url);
const OPEN = "// <generated:up-to>";
const CLOSE = "// </generated:up-to>";
const PHONE_ID = /^(ip(?!ad)|gs|gz|px|gnote)/;

// ── gate: the manual-review copy of the engine math still matches ──
let cells = 0;
const drift: string[] = [];
for (const id of Object.keys(PRICE_TABLE)) {
  if (MANUAL_REVIEW_DEVICES.has(id)) continue;
  const isPhone = PHONE_ID.test(id);
  for (const [storage, row] of Object.entries(PRICE_TABLE[id])) {
    for (const condition of Object.keys(row)) {
      const r = quoteDeviceSync({ modelId: id, modelLabel: SKU_LABELS[id], storage, condition, carrier: isPhone ? "unlocked" : undefined, isPhone }, EMPTY_OVERRIDES);
      if (r.source !== "price-table") continue;
      cells++;
      const engine = r.manualReview ? null : r.offer;
      const copy = tableOfferIgnoringReviewFlag(id, storage, condition, isPhone);
      if (engine !== copy) drift.push(`${id} ${storage} ${condition}: engine ${engine} vs copy ${copy}`);
    }
  }
}
console.log(`manual-review pricing vs quoteDeviceSync: ${drift.length ? drift.length + " MISMATCHES" : "CLEAN"} (${cells} cells)`);
if (drift.length) {
  for (const d of drift.slice(0, 20)) console.log("  DRIFT " + d);
  console.log("Fix tableOfferIgnoringReviewFlag in app/lib/advertised-up-to.ts to match quote-engine.ts first.");
  process.exit(1);
}

// ── homepage storage tiers ──
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const mapStart = page.indexOf("const STORAGE_MAP");
const mapEnd = page.indexOf("\n};", mapStart);
if (mapStart < 0 || mapEnd < 0) throw new Error("STORAGE_MAP not found in app/page.tsx");
const TIERS: Record<string, string[]> = {};
for (const m of page.slice(mapStart, mapEnd).matchAll(/^\s+(\w+):\s*\[([^\]]*)\]/gm)) {
  TIERS[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

// ── new block ──
const next: Record<string, number> = {};
for (const id of engineModelIds()) {
  const v = advertisedUpTo(id, { storages: TIERS[id] });
  if (v != null) next[id] = v;
}

// ── current block ──
const src = readFileSync(CATALOG, "utf8");
const a = src.indexOf(OPEN);
const b = src.indexOf(CLOSE);
if (a < 0 || b < a) throw new Error(`markers ${OPEN} / ${CLOSE} not found in app/data/catalog-prices.ts`);
const cur: Record<string, number> = {};
for (const m of src.slice(a, b).matchAll(/^\s+(\w+):\s*(\d+),/gm)) cur[m[1]] = Number(m[2]);

// ── report ──
const fmt = (v: number | undefined) => (v == null ? "—" : `$${v}`);
const big = (x?: number, y?: number) => (x != null && y != null && Math.abs(x - y) > 50 ? "  <-- >$50" : "");
const changes: string[] = [];
for (const id of [...new Set([...Object.keys(cur), ...Object.keys(next)])].sort()) {
  if (cur[id] === next[id]) continue;
  const c = engineCeiling(id, { storages: TIERS[id] });
  const at = c ? ` (${c.storage}/${c.condition})` : " (no instant engine number)";
  changes.push(`  ${id.padEnd(20)} ${fmt(cur[id]).padStart(6)} -> ${fmt(next[id]).padStart(6)}${at}${big(cur[id], next[id])}`);
}
console.log(`\nengine headlines: ${Object.keys(next).length} models, ${changes.length} changed`);
for (const line of changes) console.log(line);

// /sell pages read the same map (DEVICES in app/data/sell-catalog.ts).
// Hand-priced models (HAND_PRICED) keep their number; only engine ids move.
const engineIds = new Set(engineModelIds());
const sell = DEVICES
  .filter((d) => d.modelId && engineIds.has(d.modelId))
  .map((d) => ({ d, before: d.customQuote ? undefined : d.price, after: next[d.modelId!] }))
  .filter((x) => x.before !== x.after);
if (sell.length) {
  console.log(`\n/sell pages that change: ${sell.length}`);
  for (const { d, before, after } of sell) {
    console.log(`  ${d.slug.padEnd(34)} ${before == null ? "custom quote" : fmt(before)} -> ${after == null ? "custom quote" : fmt(after)}${big(before, after)}`);
  }
}

if (CHECK) {
  if (changes.length) {
    console.log("\nSTALE — run: npx tsx scripts/regen-up-to.ts --write");
    process.exit(1);
  }
  console.log("\nup-to headlines: CLEAN");
} else if (WRITE) {
  const body = Object.keys(next).sort().map((id) => `  ${id}: ${next[id]},`).join("\n");
  const head = src.slice(0, a);
  const tail = src.slice(b);
  const firstLine = src.slice(a, src.indexOf("\n", a) + 1);
  const decl = "const ENGINE_UP_TO: Record<string, number> = {\n";
  writeFileSync(CATALOG, `${head}${firstLine}${decl}${body}\n};\n${tail}`);
  console.log(`\nWROTE ${Object.keys(next).length} headlines to app/data/catalog-prices.ts`);
} else {
  console.log("\n(dry run — --write to apply)");
}
