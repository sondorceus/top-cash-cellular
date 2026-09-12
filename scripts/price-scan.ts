// Run: BLOB_READ_WRITE_TOKEN=… npx tsx scripts/price-scan.ts  (writes price-scan-report.md + price-scan-ours.json in cwd)
// Then: python3 scripts/iwm-head-scrape.py <iwm url> --json > iwm/<id>.json per model, and python3 scripts/iwm-compare.py
// Full price scan: internal consistency + margin exposure across the whole
// PRICE_TABLE phone catalog and the /go board (iPads, consoles, MacBooks),
// priced through the SAME engine calls the site uses, with the live admin
// overrides. Findings → price-scan-report.md. Never invents a price.
import { PRICE_TABLE, MIN_OFFER, MANUAL_REVIEW_DEVICES } from "../app/data/prices";
import { quoteDevice, readPriceOverrides, type PriceOverrides } from "../app/lib/quote";
import { NET_PAYOUTS, RESELL_MODEL_IDS, RESELL_ESTIMATES } from "../app/lib/resell-estimates";
import { BOARD_MODELS, storageKeysFor, CELLULAR_MULT, CELLULAR_BONUS } from "../app/go/board";
import { resolveGoSpec, goQuote } from "../app/go/spec";
import { macCeiling } from "../app/lib/macbook-quote";
import { writeFileSync } from "node:fs";

const CONDS = ["broken", "fair", "good", "mint", "sealed"] as const;
const CARRIERS: [string, boolean][] = [["unlocked", false], ["att", false], ["tmobile", false], ["verizon", true], ["other", false]];
const stNum = (s: string) => s === "base" ? 0 : /tb$/.test(s) ? Number(s.replace("tb", "")) * 1024 : Number(s);
const label = new Map(BOARD_MODELS.map((m) => [m.id, m.label]));
const lbl = (id: string) => label.get(id) ?? id;
const out: string[] = [];
const say = (s = "") => { out.push(s); };

type Cell = { offer: number | null; cap: number | null; capped: boolean; raw: number; resell: number | null };
const cells = new Map<string, Cell>();
const k = (id: string, st: string, c: string, car: string) => `${id}|${st}|${c}|${car}`;

(async () => {
  const ov: PriceOverrides = await readPriceOverrides();
  say(`# Price scan — ${new Date().toISOString().slice(0, 16)}Z`);
  say(`overrides: updatedAt=${ov.updatedAt ?? "none"} · priceTable models overridden=${Object.keys(ov.priceTable || {}).length} · carrier overrides=${Object.keys(ov.carrierDeductions || {}).length}`);
  const phoneIds = Object.keys(PRICE_TABLE).filter((id) => /^(ip|gs|gz|gnote|px)/.test(id) && !MANUAL_REVIEW_DEVICES.has(id));

  // ---- price every phone cell through the engine
  for (const id of phoneIds) {
    for (const st of Object.keys(PRICE_TABLE[id])) for (const c of CONDS) for (const [car, locked] of CARRIERS) {
      const r = await quoteDevice({ modelId: id, modelLabel: lbl(id), storage: st, condition: c, carrier: car, carrierLocked: locked, isPhone: true }, ov);
      cells.set(k(id, st, c, car), { offer: r.offer ?? null, cap: r.breakdown?.marginCap ?? null, capped: !!r.breakdown?.capped, raw: r.breakdown?.rawQuote ?? 0, resell: r.breakdown?.resellEstimate ?? null });
    }
  }
  const get = (id: string, st: string, c: string, car = "unlocked") => cells.get(k(id, st, c, car));

  // ---- 1. ladders
  const condInv: string[] = [], stInv: string[] = [], carInv: string[] = [], manualAbove: string[] = [];
  for (const id of phoneIds) {
    const sts = Object.keys(PRICE_TABLE[id]).sort((a, b) => stNum(a) - stNum(b));
    for (const st of sts) for (const [car] of CARRIERS) {
      for (let i = 1; i < CONDS.length; i++) {
        const lo = get(id, st, CONDS[i - 1], car)!, hi = get(id, st, CONDS[i], car)!;
        if (lo.offer != null && hi.offer != null && hi.offer < lo.offer) condInv.push(`${lbl(id)} ${st} ${car}: ${CONDS[i]} $${hi.offer} < ${CONDS[i - 1]} $${lo.offer}`);
        if (lo.offer != null && hi.offer == null) manualAbove.push(`${lbl(id)} ${st} ${car}: ${CONDS[i]} = manual but ${CONDS[i - 1]} = $${lo.offer}`);
      }
    }
    for (const c of CONDS) for (const [car] of CARRIERS) for (let i = 1; i < sts.length; i++) {
      const lo = get(id, sts[i - 1], c, car)!, hi = get(id, sts[i], c, car)!;
      if (lo.offer != null && hi.offer != null && hi.offer < lo.offer) stInv.push(`${lbl(id)} ${c} ${car}: ${sts[i]} $${hi.offer} < ${sts[i - 1]} $${lo.offer}`);
    }
    for (const st of sts) for (const c of CONDS) {
      const u = get(id, st, c, "unlocked")!;
      for (const [car] of CARRIERS.slice(1)) { const l = get(id, st, c, car)!; if (u.offer != null && l.offer != null && l.offer > u.offer) carInv.push(`${lbl(id)} ${st} ${c}: ${car} $${l.offer} > unlocked $${u.offer}`); }
    }
  }
  const section = (title: string, rows: string[], max = 40) => { say(`\n## ${title} (${rows.length})`); rows.slice(0, max).forEach((r) => say(`- ${r}`)); if (rows.length > max) say(`- … ${rows.length - max} more`); };
  section("Condition ladder inversions (worse condition pays more)", condInv);
  section("Storage ladder inversions (smaller storage pays more)", stInv);
  section("Carrier inversions (locked pays more than unlocked)", carInv);
  section("Manual above a priced tier (better condition → no number)", manualAbove);

  // ---- 2. family ordering (unlocked)
  const fam: string[] = [];
  const tierOf = (id: string): { fam: string; gen: number; tier: number; code: string } | null => {
    let m = id.match(/^ip(\d+)(pm|plus|p|air|mini|e)?$/); if (m) return { fam: "iPhone", gen: +m[1], code: m[2] || "base", tier: ({ pm: 5, p: 4, plus: 3, air: 3, base: 2, e: 1, mini: 1 } as Record<string, number>)[m[2] || "base"] };
    m = id.match(/^gs(\d+)(u|p|fe|edge)?$/); if (m) return { fam: "Galaxy S", gen: +m[1], code: m[2] || "base", tier: ({ u: 4, p: 3, edge: 3, base: 2, fe: 1 } as Record<string, number>)[m[2] || "base"] };
    m = id.match(/^px(\d+)(pxl|p|a)?$/); if (m) return { fam: "Pixel", gen: +m[1], code: m[2] || "base", tier: ({ pxl: 4, p: 3, base: 2, a: 1 } as Record<string, number>)[m[2] || "base"] };
    return null;
  };
  const tiers = phoneIds.map((id) => ({ id, t: tierOf(id) })).filter((x) => x.t) as { id: string; t: NonNullable<ReturnType<typeof tierOf>> }[];
  for (const a of tiers) for (const b of tiers) {
    if (a.t.fam !== b.t.fam) continue;
    const sameGenHigher = a.t.gen === b.t.gen && a.t.tier > b.t.tier;
    const newerSameTier = a.t.code === b.t.code && a.t.gen === b.t.gen + 1;
    if (!sameGenHigher && !newerSameTier) continue;
    for (const st of Object.keys(PRICE_TABLE[a.id])) { if (!PRICE_TABLE[b.id][st]) continue;
      for (const c of CONDS) { const x = get(a.id, st, c)!, y = get(b.id, st, c)!; if (x.offer != null && y.offer != null && x.offer < y.offer) fam.push(`${lbl(a.id)} ${st} ${c} $${x.offer}${x.capped ? " (CAPPED)" : ""} < ${lbl(b.id)} $${y.offer}${y.capped ? " (capped)" : ""}`); }
    }
  }
  section("Family inversions (higher tier or newer gen pays LESS, unlocked)", fam, 400);

  // ---- 3. margin cap exposure + no-guard models
  say("\n## Margin guard per phone model (unlocked, best storage)");
  say("| model | comp | cap-bound cells | sealed raw→offer | mint raw→offer | good | fair | broken | broken/good |");
  say("|---|---|---|---|---|---|---|---|---|");
  const noGuard: string[] = []; const thin: string[] = [];
  for (const id of phoneIds) {
    const sts = Object.keys(PRICE_TABLE[id]).sort((a, b) => stNum(a) - stNum(b)); const best = sts[sts.length - 1];
    let cappedN = 0, total = 0; for (const st of sts) for (const c of CONDS) for (const [car] of CARRIERS) { total++; if (get(id, st, c, car)!.capped) cappedN++; }
    const g = (c: string) => get(id, best, c)!;
    const comp = NET_PAYOUTS[id] ? `NET ${NET_PAYOUTS[id].unlocked}/${NET_PAYOUTS[id].locked}` : RESELL_MODEL_IDS[id] ? `${RESELL_ESTIMATES[RESELL_MODEL_IDS[id]]}` : "—";
    const f = (c: string) => { const x = g(c); return x.offer == null ? "manual" : x.capped ? `$${x.raw}→$${x.offer}` : `$${x.offer}`; };
    const bg = g("broken").offer != null && g("good").offer ? (g("broken").offer! / g("good").offer!).toFixed(2) : "—";
    say(`| ${lbl(id)} | ${comp} | ${cappedN}/${total} | ${f("sealed")} | ${f("mint")} | ${f("good")} | ${f("fair")} | ${f("broken")} | ${bg} |`);
    if (comp === "—") { const top = Math.max(...sts.map((st) => get(id, st, "sealed")!.offer ?? 0)); if (top >= 150) noGuard.push(`${lbl(id)}: up to $${top}, no resell comp → nothing stops an overpay`); }
    for (const st of sts) for (const c of CONDS) for (const [car] of CARRIERS) { const x = get(id, st, c, car)!; if (x.offer != null && x.cap != null && x.cap > 0 && x.offer > x.cap) thin.push(`${lbl(id)} ${st} ${c} ${car}: $${x.offer} above its own cap $${x.cap}`); }
  }
  section("No margin guard (no comp) — priced purely off the table", noGuard, 60);
  section("Offer above its own margin cap (should be impossible)", thin);

  // ---- 4. broken tier sanity
  const brokenHi: string[] = [], brokenLo: string[] = [];
  for (const id of phoneIds) for (const st of Object.keys(PRICE_TABLE[id])) { const b = get(id, st, "broken")!, g = get(id, st, "good")!; if (b.offer != null && g.offer != null) { const r = b.offer / g.offer; if (r > 0.8) brokenHi.push(`${lbl(id)} ${st}: broken $${b.offer} is ${Math.round(r * 100)}% of good $${g.offer}`); if (g.offer >= 150 && r < 0.12) brokenLo.push(`${lbl(id)} ${st}: broken $${b.offer} is ${Math.round(r * 100)}% of good $${g.offer}`); } }
  section("Broken tier close to GOOD (cracked paying ≥80% of a clean unit)", brokenHi);
  section("Broken tier very low vs GOOD (<12% of a $150+ clean unit)", brokenLo);

  // ---- 5. /go ceilings
  say("\n## /go ceilings (what the ad page and typeahead show)");
  say("| model | up to | table max (sealed+25) | cap-bound? |");
  say("|---|---|---|---|");
  const ceil: { id: string; upTo: number; raw: number }[] = [];
  for (const m of BOARD_MODELS) {
    if (m.cat === "macbook") { const u = macCeiling(m.id, ov); say(`| ${m.label} | $${u} | — | — |`); continue; }
    let upTo = 0, raw = 0;
    for (const st of storageKeysFor(m.id)) {
      const r = await quoteDevice({ modelId: m.id, modelLabel: m.label, storage: st, condition: "sealed", carrier: m.cat === "phone" ? "unlocked" : undefined, isPhone: m.cat === "phone" }, ov);
      const o = r.offer == null ? 0 : m.cat === "ipad" ? Math.round(r.offer * CELLULAR_MULT) + CELLULAR_BONUS : r.offer;
      const rw = (r.breakdown?.rawQuote ?? 0) + (r.breakdown?.sealedPremium ?? 0);
      upTo = Math.max(upTo, o); raw = Math.max(raw, m.cat === "ipad" ? Math.round(rw * CELLULAR_MULT) + CELLULAR_BONUS : rw);
    }
    ceil.push({ id: m.id, upTo, raw });
    say(`| ${m.label} | $${upTo} | $${raw} | ${upTo < raw ? `YES (−$${raw - upTo})` : ""} |`);
  }

  // ---- 6. iPad / console ladders through the /go resolver
  const goInv: string[] = [];
  for (const m of BOARD_MODELS.filter((x) => x.cat === "ipad" || x.cat === "console")) {
    const conds = m.cat === "console" ? ["broken", "fair", "good", "sealed"] : [...CONDS];
    const opts = m.cat === "ipad" ? ["wifi", "cellular"] : m.steps.includes("disc") ? ["digital", "disc"] : ["na"];
    const sts = storageKeysFor(m.id).sort((a, b) => stNum(a) - stNum(b));
    const q = async (st: string, c: string, opt: string) => { const r = resolveGoSpec({ model: m.id, storage: st, condition: c, opt }); return r.ok ? await goQuote(r.spec) : null; };
    const grid = new Map<string, number | null>();
    for (const st of sts) for (const c of conds) for (const opt of opts) grid.set(`${st}|${c}|${opt}`, await q(st, c, opt));
    for (const opt of opts) {
      for (const st of sts) for (let i = 1; i < conds.length; i++) { const lo = grid.get(`${st}|${conds[i - 1]}|${opt}`), hi = grid.get(`${st}|${conds[i]}|${opt}`); if (lo != null && hi != null && hi < lo) goInv.push(`${m.label} ${st} ${opt}: ${conds[i]} $${hi} < ${conds[i - 1]} $${lo}`); if (lo != null && hi == null) goInv.push(`${m.label} ${st} ${opt}: ${conds[i]} manual but ${conds[i - 1]} $${lo}`); }
      for (const c of conds) for (let i = 1; i < sts.length; i++) { const lo = grid.get(`${sts[i - 1]}|${c}|${opt}`), hi = grid.get(`${sts[i]}|${c}|${opt}`); if (lo != null && hi != null && hi < lo) goInv.push(`${m.label} ${c} ${opt}: ${sts[i]} $${hi} < ${sts[i - 1]} $${lo}`); }
    }
    if (opts.length === 2) for (const st of sts) for (const c of conds) { const a = grid.get(`${st}|${c}|${opts[0]}`), b = grid.get(`${st}|${c}|${opts[1]}`); if (a != null && b != null && b < a) goInv.push(`${m.label} ${st} ${c}: ${opts[1]} $${b} < ${opts[0]} $${a}`); }
  }
  section("iPad / console inversions on /go", goInv);

  writeFileSync("price-scan-ours.json", JSON.stringify(Object.fromEntries([...cells].map(([kk, v]) => [kk, { o: v.offer, c: v.capped, r: v.raw, cap: v.cap }]))));
  writeFileSync("price-scan-report.md", out.join("\n"));
  console.log(out.filter((l) => /^## |^overrides|^# /.test(l)).join("\n"));
})();
