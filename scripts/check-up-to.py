#!/usr/bin/env python3
"""Verify every "up to $X" surface equals the true engine ceiling.

Run this after ANY PRICE_TABLE / resell / catalog recab (this is the
"regen-up-to" the catalog-prices.ts header refers to). Dry-run reports
mismatches; --apply rewrites catalog-prices.ts + sell-catalog.ts.

Per-cell engine replica (mirrors page.tsx funnel + getMaxPrice):
  offer(cell, cond) = cell + popular(dt) + accessory(dt, cond != sealed)
  cap(cond) = round(round(resell*condMult(cond)) * 0.87 * 0.75)  [JS rounding]
  offer = min(offer, cap); Galaxy S23+/Z5-7: applyGalaxyDrop (monotone
  floor at GALAXY_DROP_MIN_OFFER-1, see resell-estimates.ts 2026-07-13)
  ceiling = max over all cells.

CATALOG_PRICE_BY_MODEL_ID is re-capped and re-dropped by getMaxPrice at
render, so it must store a value whose runtime result equals the ceiling
(post-cap, pre-drop). sell-catalog prices render raw on /sell/[slug], so
they store the final ceiling itself.

Usage: python scripts/check-up-to.py [--apply]
"""
import json, re, sys, importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
APPLY = "--apply" in sys.argv

def jround(x):  # JS Math.round: half-up (incl. x.5)
    import math
    return math.floor(x + 0.5)

spec = importlib.util.spec_from_file_location("audit", REPO / "scripts" / "audit-prices-vs-iwm.py")
audit = importlib.util.module_from_spec(spec); spec.loader.exec_module(audit)
PT = audit.read_price_table()
SKU = json.loads((REPO / "app" / "data" / "sku-labels.json").read_text(encoding="utf-8"))

rs_src = (REPO / "app" / "lib" / "resell-estimates.ts").read_text(encoding="utf-8")
m = re.search(r"RESELL_ESTIMATES[^=]*=\s*\{(.*?)\n\};", rs_src, re.S)
RESELL = {k.replace('\\"', '"'): int(v) for k, v in re.findall(r'"((?:[^"\\]|\\.)*)":\s*(\d+)', m.group(1))}

cat_path = REPO / "app" / "data" / "catalog-prices.ts"
cat_src = cat_path.read_text(encoding="utf-8")
CAT = {k: int(v) for k, v in re.findall(r"^\s+(\w+):\s*(\d+),", cat_src, re.M)}

sell_path = REPO / "app" / "data" / "sell-catalog.ts"
sell_src = sell_path.read_text(encoding="utf-8")
SELL = {}
for mm in re.finditer(r'\{\s*slug:\s*"([^"]+)",\s*name:\s*"((?:[^"\\]|\\.)*)",[^}]*price:\s*(\d+)', sell_src):
    SELL[mm.group(1)] = (mm.group(2).replace('\\"', '"'), int(mm.group(3)))

page_src = (REPO / "app" / "page.tsx").read_text(encoding="utf-8")
VARIANT_IDS = set(re.findall(r'id:\s*"(\w+)"', page_src))

COND_MULT = {"sealed": 1.0, "mint": 1.0, "verygood": 0.8, "good": 0.8, "fair": 0.65, "broken": 0.55}

def resell_of(label):
    if not label: return None
    q = label.strip()
    if q in RESELL: return RESELL[q]
    best = None
    for key, val in RESELL.items():
        if key not in q: continue
        rest = q[q.index(key) + len(key):].strip()
        if rest != "" and not re.match(r"^\d+\s?(gb|tb)$", rest, re.I): continue
        if best is None or len(key) > len(best[0]): best = (key, val)
    return best[1] if best else None

def dt_of(mid):
    if mid.startswith("ipad"): return "ipad"
    if mid.startswith("ip"): return "iphone"
    if mid.startswith(("gs", "gz", "gnote")): return "android"
    if mid.startswith("px") and not mid.startswith("pw"): return "pixel"
    if mid.startswith(("mba", "mbp")): return "macbook"
    return "other"

def galaxy_drop(mid):
    return 75 if (re.match(r"^gs2[3-6]", mid) or re.match(r"^gz(flip|fold)[5-7]$", mid)) else 0

def ceiling_of(mid, debug=False):
    table = PT.get(mid)
    if not table: return None
    dt = dt_of(mid)
    pop = 25 if dt in ("iphone", "android", "pixel", "ipad") else 0
    acc_amt = 30 if dt == "macbook" else 10 if dt == "iphone" else 0
    resell = resell_of(SKU.get(mid))
    gd = galaxy_drop(mid)
    best = 0
    for st, conds in table.items():
        for cond, cell in conds.items():
            if cell <= 0: continue
            offer = cell + pop + (acc_amt if cond != "sealed" else 0)
            if resell is not None:
                cap = jround(jround(resell * COND_MULT.get(cond, 1.0)) * 0.87 * 0.75)
                offer = min(offer, cap)
            if gd and offer >= 250:
                offer = max(offer - gd, 249)  # applyGalaxyDrop monotone floor
            if debug: print(f"    {mid} {st}/{cond}: cell {cell} -> offer {offer}")
            best = max(best, offer)
    return best or None

def runtime_card(stored, mid):
    """what getMaxPrice displays for a stored catalog value"""
    val = stored
    resell = resell_of(SKU.get(mid))
    if resell is not None:
        val = min(val, jround(resell * 0.87 * 0.75))
    gd = galaxy_drop(mid)
    if gd and val >= 250: val = max(val - gd, 249)  # applyGalaxyDrop monotone floor
    return val

def stored_for(mid, ceiling):
    """smallest stored value whose runtime_card == ceiling (try ceiling, ceiling+75)"""
    for cand in (ceiling, ceiling + galaxy_drop(mid)):
        if runtime_card(cand, mid) == ceiling: return cand
    return None

LABEL2ID = {v.lower().strip(): k for k, v in SKU.items()}
REKEY = {"aw_s7": "aws7", "aw_s8": "aws8", "aw_s9": "aws9", "aw_s10": "aws10",
         "aw_se2022": "awse2", "aw_ultra": "awu1", "aw_ultra2": "awu2", "aw_ultra3": "awu3"}

# ---------- catalog ----------
cat_fixes, cat_dead, cat_skip = [], [], []
for key, stored in sorted(CAT.items()):
    mid = key if key in VARIANT_IDS else REKEY.get(key)
    if mid is None or mid not in PT:
        cat_skip.append(key); continue
    ceil = ceiling_of(mid)
    want = stored_for(mid, ceil)
    if want is None:
        print(f"  !! no stored value can display {ceil} for {key} — manual"); continue
    if key in REKEY:
        cat_dead.append((key, mid, stored, want))
    elif stored != want:
        cat_fixes.append((key, stored, want, ceil, runtime_card(stored, mid)))

print(f"\ncatalog: {len(CAT)} keys | {len(cat_fixes)} wrong | {len(cat_dead)} rekeys | skipped: {cat_skip}")
for k, old, new, ceil, shown in cat_fixes:
    print(f"  CAT  {k:14s} stored {old:>4} -> {new:>4}   card shows {shown} -> {ceil}")
for k, mid, old, new in cat_dead:
    tag = "" if old == new else f"  value {old} -> {new}"
    print(f"  DEAD {k:12s} -> {mid}{tag}")

# ---------- sell-catalog ----------
sell_fixes, sell_skip = [], []
for slug, (name, price) in sorted(SELL.items()):
    mid = LABEL2ID.get(name.lower().strip())
    if mid is None or mid not in PT:
        sell_skip.append(slug); continue
    ceil = ceiling_of(mid)
    if price != ceil: sell_fixes.append((slug, price, ceil))

print(f"\nsell-catalog: {len(SELL)} entries | {len(sell_fixes)} wrong | {len(sell_skip)} skipped (no PT/label)")
for s, old, new in sell_fixes: print(f"  SELL {s:34s} {old:>4} -> {new:>4}")
print("  skipped:", ", ".join(sell_skip))

if APPLY:
    for k, old, new, _, _ in cat_fixes:
        cat_src = re.sub(r"(\n\s+%s:\s*)%d," % (k, old), r"\g<1>%d," % new, cat_src, count=1)
    for k, mid, old, new in cat_dead:
        cat_src = re.sub(r"(\n\s+)%s:\s*%d," % (k, old), r"\g<1>%s: %d," % (mid, new), cat_src, count=1)
    cat_path.write_text(cat_src, encoding="utf-8")
    for slug, old, new in sell_fixes:
        sell_src = re.sub(r'(slug:\s*"%s",[^}]*price:\s*)%d' % (re.escape(slug), old), r"\g<1>%d" % new, sell_src, count=1)
    sell_path.write_text(sell_src, encoding="utf-8")
    print(f"\nAPPLIED: {len(cat_fixes)} catalog, {len(cat_dead)} rekeys, {len(sell_fixes)} sell")
else:
    print("\n(dry-run)")
