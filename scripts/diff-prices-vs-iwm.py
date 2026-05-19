#!/usr/bin/env python3
"""Diff ours vs IWM × 0.9 from iwm-audit-raw.json.

Output:
  - iwm-audit-flagged.csv  — every cell where we're outside the band
  - iwm-audit-summary.txt  — top-line stats for MC
"""
import json, csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUR_MULT = 0.90
OVER_THRESHOLD = 1.10   # ours > IWM*0.9*1.10 → over-paying (margin risk)
UNDER_THRESHOLD = 0.70  # ours < IWM*0.9*0.70 → under-paying (losing leads)


def main():
    raw_path = ROOT / "iwm-audit-raw.json"
    if not raw_path.exists():
        print(f"missing {raw_path}")
        return 1
    raw = json.loads(raw_path.read_text())

    flagged = []  # rows with abs(pct - 1.0) > tolerance
    all_diffs = []  # for stats
    over_cells = 0
    under_cells = 0
    in_band_cells = 0
    missing_cells = 0  # we price but IWM doesn't

    for mid, data in raw["models"].items():
        ours = data["ours"]
        iwm = data["iwm"]
        for storage, cond_map in ours.items():
            for cond, our_price in cond_map.items():
                iwm_price = iwm.get(storage, {}).get(cond)
                if iwm_price is None:
                    # We price something IWM doesn't grade (e.g. "broken")
                    missing_cells += 1
                    flagged.append({
                        "model": mid, "storage": storage, "condition": cond,
                        "ours": our_price, "iwm": "N/A", "iwm*0.9": "N/A",
                        "pct": "N/A", "flag": "IWM_MISSING",
                    })
                    continue
                target = iwm_price * OUR_MULT
                pct = our_price / target if target > 0 else 0
                all_diffs.append((mid, storage, cond, our_price, iwm_price, pct))
                row = {
                    "model": mid, "storage": storage, "condition": cond,
                    "ours": our_price, "iwm": iwm_price, "iwm*0.9": round(target, 2),
                    "pct": round(pct, 3),
                }
                if pct > OVER_THRESHOLD:
                    over_cells += 1
                    row["flag"] = "OVERPAY"
                    flagged.append(row)
                elif pct < UNDER_THRESHOLD:
                    under_cells += 1
                    row["flag"] = "UNDERPAY"
                    flagged.append(row)
                else:
                    in_band_cells += 1

    csv_path = ROOT / "iwm-audit-flagged.csv"
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["model","storage","condition","ours","iwm","iwm*0.9","pct","flag"])
        w.writeheader()
        for row in sorted(flagged, key=lambda r: (r.get("flag",""), r["model"], r["storage"], r["condition"])):
            w.writerow(row)

    # Worst over / under
    real_diffs = [d for d in all_diffs if d[4] > 0]
    real_diffs.sort(key=lambda d: d[5])
    worst_under = real_diffs[:8]
    worst_over = real_diffs[-8:][::-1]

    total = over_cells + under_cells + in_band_cells + missing_cells
    summary = []
    summary.append(f"IWM audit summary — {len(raw['models'])} models, {total} cells")
    summary.append(f"  in band       : {in_band_cells:4d}  ({100*in_band_cells/total if total else 0:.1f}%)")
    summary.append(f"  overpay (>10%): {over_cells:4d}  ← margin risk")
    summary.append(f"  underpay (<30%): {under_cells:4d}  ← losing leads")
    summary.append(f"  IWM missing   : {missing_cells:4d}  (we price, IWM doesn't grade)")
    summary.append(f"  skipped models: {len(raw['skipped'])} (no URL mapping)")
    summary.append(f"  scrape errors : {len(raw['errors'])}")
    summary.append("")
    summary.append("Top 8 OVERPAY (worst margin risk — we pay > IWM × 0.9 × 1.10):")
    for d in worst_over:
        if d[5] > OVER_THRESHOLD:
            summary.append(f"  {d[0]:14s} {d[1]:5s} {d[2]:9s}  ours=${d[3]:>4}  iwm=${d[4]:>4}  pct={d[5]:.2f}")
    summary.append("")
    summary.append("Top 8 UNDERPAY (worst lead leakage — we pay < IWM × 0.9 × 0.70):")
    for d in worst_under:
        if d[5] < UNDER_THRESHOLD:
            summary.append(f"  {d[0]:14s} {d[1]:5s} {d[2]:9s}  ours=${d[3]:>4}  iwm=${d[4]:>4}  pct={d[5]:.2f}")

    text = "\n".join(summary)
    (ROOT / "iwm-audit-summary.txt").write_text(text + "\n")
    print(text)
    print(f"\nFull flagged list: {csv_path}")


if __name__ == "__main__":
    main()
