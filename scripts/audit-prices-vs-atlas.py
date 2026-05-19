#!/usr/bin/env python3
"""Audit PRICE_TABLE against Atlas wholesale (the real resell channel).

Atlas is what we sell devices to after buying them from customers. Our
customer-paid price must stay below Atlas grade × some margin or we lose
money on every flip.

For each model:
  customer_paid = PRICE_TABLE[storage][condition] + 25 (popular bonus, phones only)
  atlas_grade   = atlas reference[matching grade]
  margin_pct    = (atlas_grade - customer_paid) / atlas_grade

Flag any cell where:
  margin_pct < 0      →  LOSING MONEY (we pay more than Atlas pays us)
  margin_pct < 0.10   →  TIGHT (under 10% margin)

Atlas reference at public/comps/atlas-reference.json.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POPULAR_BONUS = 25  # phones + cellular iPads add this

# Atlas grade → our condition mapping. Atlas grades roughly:
#   swap_hso       — sealed/NIB swap value (top tier)
#   grade_a        — mint
#   grade_b        — good (or very good — Atlas doesn't split)
#   grade_c        — fair
#   grade_d        — broken
#   doa            — non-working
ATLAS_GRADE_FOR = {
    "sealed":   "swap_hso",
    "mint":     "grade_a",
    "verygood": "grade_b",  # Atlas doesn't split very-good vs good
    "good":     "grade_b",
    "fair":     "grade_c",
    "broken":   "grade_d",
}

# Margin floor — we want at least this fraction of Atlas to ourselves
MARGIN_MIN = 0.10  # 10% min margin
LOSING_FLAG = 0.00


def read_price_table():
    src = (ROOT / "app" / "data" / "prices.ts").read_text()
    m = re.search(r"^export const PRICE_TABLE[^=]*=\s*\{", src, re.MULTILINE)
    if not m: return None
    i = m.end() - 1
    depth = 0
    j = i
    while j < len(src):
        if src[j] == "{": depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0: break
        j += 1
    obj = src[i:j+1]
    obj = re.sub(r"//[^\n]*", "", obj)
    obj = re.sub(r"/\*.*?\*/", "", obj, flags=re.DOTALL)
    obj_json = re.sub(r"([\{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:", r'\1"\2":', obj)
    obj_json = re.sub(r",(\s*[}\]])", r"\1", obj_json)
    return json.loads(obj_json)


def load_atlas():
    return json.load(open(ROOT / "public" / "comps" / "atlas-reference.json"))


# Map our model_id → Atlas entry key. Hand-curated since Atlas keys are
# verbose ("Galaxy S24 Ultra", "iPhone 17 Pro Max 256GB Unlocked").
# For iPhones we use the iphones_used category with storage in the key.
# For Samsung Galaxy we use the samsung category (single-list format).
# For Pixel we use the pixel category.

def find_atlas_for(mid, storage, atlas):
    """Look up Atlas grade dict for a model_id + storage. Returns
    {grade: dollars} or None."""
    # iPhones — iphones_used for grade_a..grade_d, iphones_nib for sealed.
    # Atlas pays a real "true new in box" premium that the used.swap_hso
    # column undersells, so sealed comparisons need the NIB sheet.
    if mid.startswith("ip") and not mid.startswith("ipad"):
        label_map = {
            "ip11": "iPhone 11", "ip11p": "iPhone 11 Pro", "ip11pm": "iPhone 11 Pro Max",
            "ip12mini": "iPhone 12 mini", "ip12": "iPhone 12", "ip12p": "iPhone 12 Pro", "ip12pm": "iPhone 12 Pro Max",
            "ip13mini": "iPhone 13 mini", "ip13": "iPhone 13", "ip13p": "iPhone 13 Pro", "ip13pm": "iPhone 13 Pro Max",
            "ip14": "iPhone 14", "ip14plus": "iPhone 14 Plus", "ip14p": "iPhone 14 Pro", "ip14pm": "iPhone 14 Pro Max",
            "ip15": "iPhone 15", "ip15plus": "iPhone 15 Plus", "ip15p": "iPhone 15 Pro", "ip15pm": "iPhone 15 Pro Max",
            "ip16": "iPhone 16", "ip16e": "iPhone 16e", "ip16plus": "iPhone 16 Plus", "ip16p": "iPhone 16 Pro", "ip16pm": "iPhone 16 Pro Max",
            "ip17": "iPhone 17", "ip17e": "iPhone 17e", "ip17air": "iPhone Air", "ip17p": "iPhone 17 Pro", "ip17pm": "iPhone 17 Pro Max",
        }
        label = label_map.get(mid)
        if not label: return None
        storage_label = {"64":"64GB","128":"128GB","256":"256GB","512":"512GB","1tb":"1TB","2tb":"2TB"}.get(storage, storage)
        key = f"{label} {storage_label} Unlocked"
        used = atlas["categories"].get("iphones_used", {}).get(key, {})
        nib  = atlas["categories"].get("iphones_nib",  {}).get(key, {})
        # Merge: used grades + NIB sealed/open override swap_hso if NIB exists
        merged = dict(used) if used else {}
        if nib.get("sealed") is not None:
            merged["swap_hso"] = nib["sealed"]  # repoint our sealed → NIB sealed
        return merged or None
    # Samsung Galaxy / Z / Note — samsung category, list format
    if mid.startswith(("gs", "gz", "gnote")):
        label_map = {
            "gs20":"Galaxy S20", "gs20p":"Galaxy S20 Plus", "gs20u":"Galaxy S20 Ultra", "gs20fe":"Galaxy S20 FE",
            "gs21":"Galaxy S21", "gs21p":"Galaxy S21 Plus", "gs21u":"Galaxy S21 Ultra", "gs21fe":"Galaxy S21 FE",
            "gs22":"Galaxy S22", "gs22p":"Galaxy S22 Plus", "gs22u":"Galaxy S22 Ultra",
            "gs23":"Galaxy S23", "gs23p":"Galaxy S23 Plus", "gs23u":"Galaxy S23 Ultra", "gs23fe":"Galaxy S23 FE",
            "gs24":"Galaxy S24", "gs24p":"Galaxy S24 Plus", "gs24u":"Galaxy S24 Ultra", "gs24fe":"Galaxy S24 FE",
            "gs25":"Galaxy S25", "gs25p":"Galaxy S25 Plus", "gs25u":"Galaxy S25 Ultra", "gs25fe":"Galaxy S25 FE", "gs25edge":"Galaxy S25 EDGE",
            "gs26":"Galaxy S26", "gs26p":"Galaxy S26 Plus", "gs26u":"Galaxy S26 Ultra",
            "gzflip3":"Z Flip3", "gzflip4":"Galaxy Z Flip 4", "gzflip5":"Galaxy Z Flip 5", "gzflip6":"Galaxy Z Flip 6", "gzflip7":"Galaxy Z Flip 7",
            "gzfold3":"Z Fold3", "gzfold4":"Galaxy Z Fold 4", "gzfold5":"Galaxy Z Fold 5", "gzfold6":"Galaxy Z Fold 6", "gzfold7":"Galaxy Z Fold 7",
            "gnote9":"Galaxy Note 9", "gnote10":"Galaxy Note 10", "gnote10p":"Galaxy Note 10 Plus", "gnote20":"Galaxy Note 20",
        }
        label = label_map.get(mid)
        if not label: return None
        entry = atlas["categories"].get("samsung", {}).get(label)
        if not entry: return None
        # New format: entry is already a {grade: dollars} dict (parse_samsung
        # rewritten 2026-05-19). Filter Nones so callers see only real prices.
        return {k: v for k, v in entry.items() if v is not None}
    return None


def main():
    pt = read_price_table()
    atlas = load_atlas()
    is_phone = lambda mid: mid.startswith(("ip", "gs", "gz", "gnote", "px")) and not mid.startswith("ipad")

    losing = []
    tight = []
    safe = 0
    no_atlas = 0
    for mid, storages in pt.items():
        bonus = POPULAR_BONUS if is_phone(mid) else 0
        for storage, conds in storages.items():
            atlas_grades = find_atlas_for(mid, storage, atlas)
            for cond, our_price in conds.items():
                customer_paid = our_price + bonus
                if atlas_grades is None:
                    no_atlas += 1
                    continue
                atlas_key = ATLAS_GRADE_FOR.get(cond)
                if not atlas_key:
                    continue
                atlas_val = atlas_grades.get(atlas_key)
                if atlas_val is None or atlas_val <= 0:
                    continue
                margin_dollars = atlas_val - customer_paid
                margin_pct = margin_dollars / atlas_val
                row = (mid, storage, cond, our_price, customer_paid, atlas_val, margin_dollars, margin_pct)
                if margin_pct < LOSING_FLAG:
                    losing.append(row)
                elif margin_pct < MARGIN_MIN:
                    tight.append(row)
                else:
                    safe += 1

    print(f"=== ATLAS MARGIN AUDIT ===")
    print(f"  LOSING (we pay > Atlas):  {len(losing)}")
    print(f"  TIGHT (< 10% margin):     {len(tight)}")
    print(f"  SAFE (>= 10% margin):     {safe}")
    print(f"  No Atlas mapping:         {no_atlas}")
    print()

    print(f"=== TOP 20 LOSING CELLS ===")
    losing.sort(key=lambda r: r[6])  # most-negative first
    for mid, storage, cond, ours, customer, atlas_val, dollars, pct in losing[:20]:
        print(f"  {mid:10s} {storage:5s} {cond:9s}  customer=${customer:>4}  atlas=${atlas_val:>4}  LOSS=${-dollars}")
    if len(losing) > 20:
        print(f"  ... and {len(losing) - 20} more")

    # Write CSV
    import csv
    csv_path = ROOT / "atlas-margin-audit.csv"
    with open(csv_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["model","storage","condition","price_table","customer_paid","atlas_value","margin_dollars","margin_pct","flag"])
        for row in losing:
            w.writerow(list(row) + ["LOSING"])
        for row in tight:
            w.writerow(list(row) + ["TIGHT"])
    print(f"\nFull CSV: {csv_path}")


if __name__ == "__main__":
    main()
