#!/usr/bin/env python3
"""Ours (engine, unlocked, live overrides) vs ItsWorthMore payout grid.
Sonny's rule: pay ~10% under IWM (OUR_MULT 0.90 in the scraper). Reports
per-cell gaps and a per-model verdict. Never proposes invented numbers."""
import json, glob, os, statistics
COND = {"Brand New": "sealed", "Flawless": "mint", "Good": "good", "Fair": "fair", "Broken": "broken"}
LABEL = {"ip11pm":"iPhone 11 Pro Max","ip12":"iPhone 12","ip12p":"iPhone 12 Pro","ip12pm":"iPhone 12 Pro Max","ip13":"iPhone 13","ip13mini":"iPhone 13 mini","ip13p":"iPhone 13 Pro","ip13pm":"iPhone 13 Pro Max","ip14":"iPhone 14","ip14plus":"iPhone 14 Plus","ip14p":"iPhone 14 Pro","ip14pm":"iPhone 14 Pro Max","ip15":"iPhone 15","ip15plus":"iPhone 15 Plus","ip15p":"iPhone 15 Pro","ip15pm":"iPhone 15 Pro Max","ip16":"iPhone 16","ip16plus":"iPhone 16 Plus","ip16p":"iPhone 16 Pro","ip16pm":"iPhone 16 Pro Max","ip16e":"iPhone 16e","ip17":"iPhone 17","ip17p":"iPhone 17 Pro","ip17pm":"iPhone 17 Pro Max","ip17air":"iPhone 17 Air","ip17e":"iPhone 17e","gs23u":"Galaxy S23 Ultra","gs24":"Galaxy S24","gs24p":"Galaxy S24+","gs24u":"Galaxy S24 Ultra","gs24fe":"Galaxy S24 FE","gs25":"Galaxy S25","gs25p":"Galaxy S25+","gs25u":"Galaxy S25 Ultra","gs25edge":"Galaxy S25 Edge","gs25fe":"Galaxy S25 FE","gs26":"Galaxy S26","gs26p":"Galaxy S26+","gs26u":"Galaxy S26 Ultra"}
ours = json.load(open("price-scan-ours.json"))
def st_key(s):
    s = s.upper().replace("GB", "").replace("TB", "tb")
    return s.lower()
rows = []; per_model = {}
for f in sorted(glob.glob("iwm/*.json")):
    mid = os.path.basename(f)[:-5]; d = json.load(open(f)); grid = next(iter(d.values()))
    cells = []
    for st, conds in grid.items():
        for ic, ours_c in COND.items():
            if ic not in conds: continue
            iwm = conds[ic]; target = round(iwm * 0.9)
            k = f"{mid}|{st_key(st)}|{ours_c}|unlocked"
            if k not in ours: continue
            o = ours[k]["o"]; capped = ours[k]["c"]; raw = ours[k]["r"]
            gap = None if o is None else o - target
            cells.append((st_key(st), ours_c, iwm, target, o, gap, capped, raw))
            rows.append((mid, st_key(st), ours_c, iwm, target, o, gap, capped, raw))
    if not cells: continue
    gaps = [c[5] for c in cells if c[5] is not None]
    working = [c for c in cells if c[1] in ("good", "fair", "mint") and c[5] is not None]
    wg = [c[5] for c in working]
    below = sum(1 for g in wg if g < -30); above = sum(1 for g in wg if g > 30)
    capped_n = sum(1 for c in cells if c[6])
    # what the table alone would have paid (raw = before cap; raw 0 when unpriced)
    raw_gaps = [c[7] - c[3] for c in working if c[7]]
    per_model[mid] = dict(label=LABEL.get(mid, mid), n=len(cells), median_gap=statistics.median(wg) if wg else None, below=below, above=above, capped=capped_n,
                          raw_median_gap=statistics.median(raw_gaps) if raw_gaps else None,
                          good=[(c[0], c[2], c[4], c[5]) for c in cells if c[1] == "good"],
                          broken=[(c[0], c[2], c[4], c[5]) for c in cells if c[1] == "broken"])
json.dump(rows, open("iwm-compare-rows.json", "w")); json.dump(per_model, open("iwm-compare-models.json", "w"))
print(f"{'model':<20}{'cells':>6}{'median gap':>12}{'<−$30':>7}{'>+$30':>7}{'capped':>8}{'table-only gap':>16}   good-tier: (storage IWM ours gap)")
for mid, m in sorted(per_model.items(), key=lambda x: (x[1]['median_gap'] if x[1]['median_gap'] is not None else 0)):
    g = " ".join(f"{s}:{i}/{o if o is not None else 'man'}({gp if gp is not None else '-'})" for s, i, o, gp in m["good"])
    print(f"{m['label']:<20}{m['n']:>6}{(str(m['median_gap'])+'$') if m['median_gap'] is not None else '-':>12}{m['below']:>7}{m['above']:>7}{m['capped']:>8}{(str(m['raw_median_gap'])+'$') if m['raw_median_gap'] is not None else '-':>16}   {g}")
