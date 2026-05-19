#!/usr/bin/env python3
"""Comprehensive Atlas Mobile scrape — every pricing tab across both
spreadsheets. Output is a single structured JSON at
public/comps/atlas-reference.json that the funnel + admin can consume
as a "sold-price reference" (what Atlas pays us for each device).

Sources covered:

USED sheet (1pu4Adxq4MGB6Qour0k__4gBdgnggWRoSVYnJUKgxzEw):
  gid=0          Used iPhones (Grade A/B/C/D/DOA, Unlocked vs Locked)
  gid=1118039083 Google Pixel (Sealed/Open/Grade A/B+)
  gid=1323917402 Apple Watch
  gid=1559497964 Used iPads (Grade A/B/C/D/DOA)
  gid=1870830298 MDM-Locked iPhones (UL/MDM/Cr variants)
  gid=2071430745 MacBooks
  gid=536270645  Samsung phones
  gid=724685250  iCloud-Locked iPhones

NIB sheet (1f3b0rW1d5xTonDtkoPmLIAOjKc-CUF6clMBalPWyS80):
  gid=1148430169 NIB iPhones (Sealed/Open, Unlocked vs Locked)
  gid=1152661063 NIB iPads (Sealed/Open/Sealed-Activated, WiFi vs Cellular)
  gid=43866420   AirPods (single sealed price)

Skipped: legal disclaimer + "please offer" stubs.

Output JSON shape per category is intentionally close to the source so
it's easy to verify: each device row becomes a key, each price column
a sub-key. Specific category quirks (multi-column lock states, separate
condition tiers, etc.) are preserved.

Run:
  python scripts/scrape-atlas-full.py
  python scripts/scrape-atlas-full.py --dry-run   # don't write JSON
"""
from __future__ import annotations
import argparse, csv, io, json, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

USED_SHEET = "1pu4Adxq4MGB6Qour0k__4gBdgnggWRoSVYnJUKgxzEw"
NIB_SHEET = "1f3b0rW1d5xTonDtkoPmLIAOjKc-CUF6clMBalPWyS80"

OUT_PATH = Path(__file__).parent.parent / "public" / "comps" / "atlas-reference.json"


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def fetch_csv(sheet_id: str, gid: str | int) -> list[list[str]]:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    raw = http_get(url).decode("utf-8", errors="ignore")
    return list(csv.reader(io.StringIO(raw)))


def parse_money(s: str) -> int | None:
    if not s:
        return None
    s = s.strip().replace("$", "").replace(",", "").strip()
    if not s or s == "-":
        return None
    try:
        return int(round(float(s)))
    except Exception:
        return None


def trim(s: str) -> str:
    return (s or "").strip()


# =========================================================================
# Per-tab parsers (each tab has its own column layout)
# =========================================================================

def parse_used_iphones(rows):
    """USED gid=0 — column layout:
    [_, Model, SWAP/HSO, Grade A, Grade B, Grade C, Grade D, DOA, Model_again]
    Models look like: "iPhone 17 Pro Max 256GB Unlocked" or "... Carrier Locked".
    """
    COND_COLS = {2: "swap_hso", 3: "grade_a", 4: "grade_b", 5: "grade_c", 6: "grade_d", 7: "doa"}
    out = {}
    for row in rows:
        if not row or len(row) < 8:
            continue
        name = trim(row[1])
        if not name.lower().startswith("iphone"):
            continue
        if any(p in name.lower() for p in ["mdm", "icloud", "locked iphone"]):
            continue
        prices = {c: parse_money(row[i]) for i, c in COND_COLS.items()}
        if any(v is not None for v in prices.values()):
            out[name] = prices
    return out


def parse_pixel(rows):
    """USED gid=1118039083 — Pixel.
    Header: Google Pixel Factory Unlocked | Sealed (Not Actived) | Open (Activated) | A / HSO | B+ Grade
    """
    COND_COLS = {1: "sealed", 2: "open", 3: "grade_a", 4: "grade_b_plus"}
    out = {}
    for row in rows:
        if not row or len(row) < 5:
            continue
        name = trim(row[0])
        if not name or not name.upper().startswith("PIXEL"):
            continue
        prices = {c: parse_money(row[i]) for i, c in COND_COLS.items()}
        if any(v is not None for v in prices.values()):
            out[name] = prices
    return out


def parse_apple_watch(rows):
    """USED gid=1323917402 — Apple Watch. Sections like 'Series 11',
    'Ultra (3rd Gen) ~ 2025', 'SE (3rd Gen)'. Each section has a header
    row with 4 column labels (Sealed/Open/A-Hso/B-Grade), then 1-2 data
    rows per size variant (e.g. 'Series 11 46mm'). Prices may be '-' for
    older sealed/open columns (Atlas only buys those in used condition)."""
    COND_COLS = [(2, "sealed"), (3, "open"), (4, "grade_a_hso"), (5, "grade_b")]
    out = {}
    for row in rows:
        if not row or len(row) < 5:
            continue
        name = trim(row[1])
        if not name:
            continue
        # Skip header / section / disclaimer rows. Data rows always contain
        # a size token ('mm') in the model name.
        if "mm" not in name.lower():
            continue
        prices = {}
        for i, label in COND_COLS:
            v = parse_money(row[i]) if i < len(row) else None
            if v is not None:
                prices[label] = v
        if prices:
            out[name] = prices
    return out


def parse_used_ipads(rows):
    """USED gid=1559497964 — Used iPads (Grade A/B/C/D/DOA).
    Same column layout as used iPhones."""
    COND_COLS = {2: "grade_a", 3: "grade_b", 4: "grade_c", 5: "grade_d", 6: "doa"}
    out = {}
    for row in rows:
        if not row or len(row) < 7:
            continue
        name = trim(row[1])
        if not name or not name.lower().startswith("ipad"):
            continue
        prices = {c: parse_money(row[i]) for i, c in COND_COLS.items()}
        if any(v is not None for v in prices.values()):
            out[name] = prices
    return out


def parse_mdm_iphones(rows):
    """USED gid=1870830298 — MDM-locked iPhones.
    Header: MDM Locked iPhone | MDM/UL/Sealed | Open non-activated | Opened Activated | MDM/Cr/Sealed | OPEN non-activated | Opened Activated
    """
    COND_COLS = {
        1: "mdm_ul_sealed",
        2: "mdm_ul_open_nonact",
        3: "mdm_ul_opened_act",
        4: "mdm_cr_sealed",
        5: "mdm_cr_open_nonact",
        6: "mdm_cr_opened_act",
    }
    out = {}
    for row in rows:
        if not row or len(row) < 7:
            continue
        name = trim(row[0])
        if not name or not name.lower().startswith("iphone"):
            continue
        prices = {c: parse_money(row[i]) for i, c in COND_COLS.items()}
        if any(v is not None for v in prices.values()):
            out[name] = prices
    return out


def parse_macbooks(rows):
    """USED gid=2071430745 — MacBooks. Pattern is three-row groups:
       row N:   model header     'MACBOOK PRO - 2026 (M5 PRO 16-inch)'
       row N+1: spec row         '"M5 PRO / 18C-20C / 24GB / 1TB / 16""'
       row N+2: SKU + 3 prices   'MGEA4 MGE44, $1,980, $1,890, $1,890'
    Columns: [_, SKU, Sealed-N/A, Open, Sealed-Activated]. Sealed-N/A
    is usually blank for some models (Atlas doesn't keep them sealed).
    We capture the spec from N+1 + SKU from N+2 as the composite key."""
    out = {}
    current_model = None
    pending_spec = None
    for row in rows:
        if not row or len(row) < 2:
            continue
        first = trim(row[1]) if len(row) > 1 else ""
        # Model section header
        if first and "macbook" in first.lower() and "(" in first:
            current_model = first
            pending_spec = None
            continue
        # Spec row: contains "/" with chip/GB markers, no SKU codes
        if first and "/" in first and ("gb" in first.lower() or '"' in first):
            pending_spec = first
            continue
        # SKU row: has 3 dollar values
        prices_list: list[int] = []
        for col in range(2, min(len(row), 6)):
            v = parse_money(row[col])
            if v is not None:
                prices_list.append(v)
        if len(prices_list) >= 2 and first and current_model:
            sku = first
            label = f"{current_model} · {pending_spec or '?'} · SKU {sku}"
            entry = {}
            cols = ["sealed_na", "open", "sealed_activated"]
            for i, p in enumerate(prices_list[:3]):
                entry[cols[i] if i < len(cols) else f"col_{i}"] = p
            out[label] = entry
    return out


def parse_samsung(rows):
    """USED gid=536270645 — Samsung phones.

    Column layout:
      col 0: (empty, leading padding)
      col 1: model name (e.g. "Galaxy S26 Ultra") — only on first row per device
      col 2: lock state ("Unlocked" or "Carrier Locked (...)")
      cols 3-8: NEW / Grade A / B / C / D / DOA

    Each model spans two rows: Unlocked + Carrier Locked. Names only
    appear on row N; row N+1 has empty col 1. Carrier Locked entries
    are emitted as separate keys so downstream can pick lock state.

    "ASK" / "NOT BUYING" / empty cells parse as None.
    """
    COND_COLS = {3: "swap_hso", 4: "grade_a", 5: "grade_b", 6: "grade_c", 7: "grade_d", 8: "doa"}
    out = {}
    current_model = None
    for row in rows:
        if not row or len(row) < 3:
            continue
        col1 = trim(row[1])
        col2 = trim(row[2])
        # New model header — col 1 starts with Galaxy / Samsung / Note
        if col1:
            nl = col1.lower()
            if any(k in nl for k in ["galaxy", "samsung", "note "]):
                current_model = col1
        if not current_model:
            continue
        if len(row) < 9:
            continue
        prices = {c: parse_money(row[i]) for i, c in COND_COLS.items()}
        if not any(v is not None for v in prices.values()):
            continue
        # Suffix the model name with lock state to disambiguate
        lock = col2.lower()
        if "unlock" in lock:
            key = current_model
        elif "carrier locked" in lock or "locked" in lock:
            key = f"{current_model} (Carrier Locked)"
        else:
            key = current_model
        out[key] = prices
    return out


def parse_icloud_iphones(rows):
    """USED gid=724685250 — iCloud-locked iPhones."""
    out = {}
    for row in rows:
        if not row or len(row) < 2:
            continue
        name = trim(row[1]) or trim(row[0])
        if not name or not name.lower().startswith("iphone"):
            continue
        prices = []
        for col in range(2, len(row)):
            v = parse_money(row[col])
            if v is not None:
                prices.append(v)
        if prices:
            out[name] = {"prices": prices}
    return out


def parse_nib_iphones(rows):
    """NIB gid=1148430169 — Walks model headers + Unlocked/Locked rows.
    Each row format: [_, lock, storage, sealed_price, open_price, ...].
    """
    out = {}
    current_model = None
    for row in rows:
        if not row:
            continue
        cells = [trim(c) for c in row]
        # Pure model header row (e.g. ", iPhone 17 Pro, , , , …")
        if len(cells) >= 2 and cells[1] and "iphone" in cells[1].lower() and not (len(cells) > 3 and cells[3].startswith("$")):
            current_model = cells[1]
        if not current_model or len(cells) < 4:
            continue
        lock = "unlocked" if cells[1].lower() == "unlocked" else "locked" if cells[1].lower() == "carrier locked" else None
        if not lock:
            continue
        storage = cells[2]
        sealed = parse_money(cells[3])
        open_ = parse_money(cells[4]) if len(cells) > 4 else None
        if sealed is None and open_ is None:
            continue
        key = f"{current_model} {storage} {lock.title()}"
        out[key] = {"sealed": sealed, "open": open_}
    return out


def parse_nib_ipads(rows):
    """NIB gid=1152661063 — iPad row format:
    [_, model+storage label, Sealed, Open, Sealed (Activated)]
    """
    out = {}
    for row in rows:
        if not row or len(row) < 3:
            continue
        cells = [trim(c) for c in row]
        name = cells[1]
        if not name or not name.lower().startswith("ipad"):
            continue
        # Skip section header rows
        if any(p in cells[2].lower() for p in ["sealed", "open", "wifi"]):
            continue
        sealed = parse_money(cells[2]) if len(cells) > 2 else None
        open_ = parse_money(cells[3]) if len(cells) > 3 else None
        sealed_act = parse_money(cells[4]) if len(cells) > 4 else None
        if sealed is None and open_ is None and sealed_act is None:
            continue
        out[name] = {"sealed": sealed, "open": open_, "sealed_activated": sealed_act}
    return out


def parse_airpods(rows):
    """NIB gid=43866420 — AirPods. Format: [_, model_with_partnum, sealed_price]."""
    out = {}
    for row in rows:
        if not row or len(row) < 3:
            continue
        cells = [trim(c) for c in row]
        name = cells[1]
        if not name or not ("airpod" in name.lower()):
            continue
        sealed = parse_money(cells[2])
        if sealed is None:
            continue
        out[name] = {"sealed": sealed}
    return out


# =========================================================================
# Runner
# =========================================================================

TABS = [
    # (sheet_id, gid, category_key, parser, label)
    (USED_SHEET, "0", "iphones_used", parse_used_iphones, "Used iPhones"),
    (USED_SHEET, "1118039083", "pixel", parse_pixel, "Google Pixel"),
    (USED_SHEET, "1323917402", "apple_watches", parse_apple_watch, "Apple Watch"),
    (USED_SHEET, "1559497964", "ipads_used", parse_used_ipads, "Used iPads"),
    (USED_SHEET, "1870830298", "mdm_locked_iphones", parse_mdm_iphones, "MDM-Locked iPhones"),
    (USED_SHEET, "2071430745", "macbooks", parse_macbooks, "MacBooks"),
    (USED_SHEET, "536270645", "samsung", parse_samsung, "Samsung"),
    (USED_SHEET, "724685250", "icloud_locked_iphones", parse_icloud_iphones, "iCloud-Locked iPhones"),
    (NIB_SHEET, "1148430169", "iphones_nib", parse_nib_iphones, "NIB iPhones"),
    (NIB_SHEET, "1152661063", "ipads_nib", parse_nib_ipads, "NIB iPads"),
    (NIB_SHEET, "43866420", "airpods", parse_airpods, "AirPods"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    result = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "used_sheet": f"https://docs.google.com/spreadsheets/d/{USED_SHEET}",
            "nib_sheet": f"https://docs.google.com/spreadsheets/d/{NIB_SHEET}",
        },
        "categories": {},
        "counts": {},
    }

    for sheet_id, gid, key, parser, label in TABS:
        try:
            rows = fetch_csv(sheet_id, gid)
        except Exception as e:
            print(f"  {label}: fetch failed — {e}", file=sys.stderr)
            continue
        try:
            parsed = parser(rows)
        except Exception as e:
            print(f"  {label}: parse failed — {e}", file=sys.stderr)
            continue
        result["categories"][key] = parsed
        result["counts"][key] = len(parsed)
        print(f"  ✓ {label:<26} {len(parsed):>3} entries", file=sys.stderr)

    total = sum(result["counts"].values())
    print(f"\nTotal entries scraped: {total}", file=sys.stderr)

    if args.dry_run:
        print("(dry-run — not writing)", file=sys.stderr)
    else:
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUT_PATH.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)", file=sys.stderr)


if __name__ == "__main__":
    main()
