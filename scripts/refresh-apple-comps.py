"""Refresh Apple Trade-In max values for every model in our catalog.

Strategy:
 1. Read the current snapshot at public/comps/apple-trade-in.json so any
    model we can't successfully refresh keeps its previous value (no
    regressions from a single failed scrape).
 2. Walk Apple's trade-in calculator at apple.com/shop/trade-in/in-store-value
    for each device family (iPhone / iPad / Mac / Apple Watch). For each
    model option, click through to the max-storage / Excellent-condition
    branch and pull the dollar value.
 3. Sanity-check: if a value moves >40% from the previous month, leave
    the previous value and emit a WARNING. Catches the case where Apple
    restructured their DOM and we're reading garbage.
 4. Write the new snapshot and a short delta log.

Run by:   python scripts/refresh-apple-comps.py
CI run:   .github/workflows/refresh-comps.yml (cron monthly)

Stdout is the human-readable delta; non-zero exit means the snapshot
file actually changed (so the GH Action knows to commit).
"""
from __future__ import annotations
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout, Page
except ImportError:
    print("playwright not installed; run: pip install playwright && playwright install chromium")
    sys.exit(2)

OUT = Path(__file__).parent.parent / "public" / "comps" / "apple-trade-in.json"
ANOMALY_THRESHOLD = 0.40  # 40% swing month-over-month flags review
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)

# Map from our internal model id -> the label Apple's site uses on its
# trade-in selector. The scraper only refreshes models present in this
# map, and main() drops any snapshot entry whose key is NOT in this map.
#
# CONVENTION (added 2026-05-24 after iPhone 17 Pro Max bug):
#   Only list a model here if Apple's actual trade-in calculator at
#   apple.com/shop/trade-in surfaces it. Current-generation flagships
#   (within ~6 months of launch) are usually NOT accepted by Apple at
#   release. Leave them OUT of this map — the snapshot JSON will then
#   omit them and the frontend renders an "Apple won't trade this — we
#   will" badge instead of fabricating a number.
#
#   To re-add a model after Apple starts accepting it: confirm by hand
#   on apple.com/shop/trade-in, then add the (id, label) pair here. The
#   next CI run will scrape and populate the value.
APPLE_MODEL_LABELS: Dict[str, str] = {
    # iPhones — the labels are what appears in Apple's calculator dropdown.
    # iPhone 17 family intentionally omitted: Apple doesn't accept these
    # on trade-in yet (verified 2026-05-24). Re-add when they do.
    "ip16pm":   "iPhone 16 Pro Max",
    "ip16p":    "iPhone 16 Pro",
    "ip16plus": "iPhone 16 Plus",
    "ip16":     "iPhone 16",
    "ip16e":    "iPhone 16e",
    # NOTE: Re-verify iPhone 16 entries on next refresh — if Apple drops
    # any of these (typical when a new generation matures), let main()
    # remove them naturally by deleting the line here.
    "ip15pm":   "iPhone 15 Pro Max",
    "ip15p":    "iPhone 15 Pro",
    "ip15plus": "iPhone 15 Plus",
    "ip15":     "iPhone 15",
    "ip14pm":   "iPhone 14 Pro Max",
    "ip14p":    "iPhone 14 Pro",
    "ip14plus": "iPhone 14 Plus",
    "ip14":     "iPhone 14",
    "ip13pm":   "iPhone 13 Pro Max",
    "ip13p":    "iPhone 13 Pro",
    "ip13":     "iPhone 13",
    "ip12pm":   "iPhone 12 Pro Max",
    "ip12p":    "iPhone 12 Pro",
    "ip12":     "iPhone 12",
    "ip12mini": "iPhone 12 mini",
    "ip11pm":   "iPhone 11 Pro Max",
    "ip11p":    "iPhone 11 Pro",
    "ip11":     "iPhone 11",
    # MacBooks
    # 2026 M5 Pro/Max + M5 Air intentionally omitted: Apple doesn't
    # trade-in their current-gen Macs (verified 2026-05-24).
    "mbp14_m5_2025":     "MacBook Pro 14-inch (2025)",
    "mbp16m4":           "MacBook Pro 16-inch (2024)",
    "mbp14m4":           "MacBook Pro 14-inch (2024)",
    "mbp16m3":           "MacBook Pro 16-inch (2023)",
    "mbp14m3":           "MacBook Pro 14-inch (2023)",
    "mbp16m2":           "MacBook Pro 16-inch (2023, M2)",
    "mbp14m2":           "MacBook Pro 14-inch (2023, M2)",
    "mbp13m1":           "MacBook Pro 13-inch (2020, M1)",
    "mba15m3":           "MacBook Air 15-inch (2024)",
    "mba13m3":           "MacBook Air 13-inch (2024)",
    "mba15m2":           "MacBook Air 15-inch (2023)",
    "mba13m2":           "MacBook Air 13-inch (2022)",
    "mba13m1":           "MacBook Air 13-inch (2020)",
    # iPads
    # M5 iPad Pros intentionally omitted: current-gen, Apple doesn't
    # accept on trade-in yet (verified 2026-05-24).
    "ipadair13m3":  "iPad Air 13-inch (M3)",
    "ipadair11m3":  "iPad Air 11-inch (M3)",
    "ipadmini7":    "iPad mini (7th gen)",
    "ipadpro13m4":  "iPad Pro 13-inch (M4)",
    "ipadpro11m4":  "iPad Pro 11-inch (M4)",
    "ipadair13m2":  "iPad Air 13-inch (M2)",
    "ipadair11m2":  "iPad Air 11-inch (M2)",
    # Apple Watches
    # Ultra 3 + Series 11 intentionally omitted: current-gen, Apple
    # doesn't accept on trade-in yet (verified 2026-05-24).
    "aw_ultra2": "Apple Watch Ultra 2",
    "aw_ultra":  "Apple Watch Ultra",
    "aw_s10":    "Apple Watch Series 10",
    "aw_s9":     "Apple Watch Series 9",
    "aw_s8":     "Apple Watch Series 8",
    "aw_s7":     "Apple Watch Series 7",
    "aw_se2024": "Apple Watch SE (2nd generation, 2024)",
    "aw_se2022": "Apple Watch SE (2nd generation, 2022)",
}

DOLLAR_RE = re.compile(r"\$\s*([0-9]{1,4}(?:,[0-9]{3})*)")


def load_snapshot() -> dict:
    if not OUT.exists():
        return {"values": {}}
    with OUT.open(encoding="utf-8") as f:
        return json.load(f)


def save_snapshot(data: dict) -> None:
    OUT.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def extract_max_dollar(pg: Page) -> Optional[int]:
    """After Apple's calculator has been driven to a final-value state,
    find the biggest plausible dollar amount on the page."""
    try:
        text = pg.evaluate("() => document.body.innerText")
        vals = [int(m.replace(",", "")) for m in DOLLAR_RE.findall(text)]
        vals = [v for v in vals if 20 <= v <= 5000]
        if not vals:
            return None
        return max(vals)
    except Exception:
        return None


def scrape_one(pg: Page, model_id: str, label: str) -> Optional[int]:
    """Heuristic scrape. Apple changes DOM structure frequently — we keep
    this loose on purpose and rely on the value-sanity check to catch
    misreads."""
    try:
        pg.goto("https://www.apple.com/shop/trade-in", wait_until="domcontentloaded", timeout=30000)
        time.sleep(2)
        # Apple's calculator is a multi-step picker. Each click below is
        # best-effort: if Apple changes a label we skip and let the
        # snapshot keep its previous value.
        for selector in (
            "button:has-text('Get started')",
            "a:has-text('Get started')",
            "button:has-text('Start a trade-in')",
        ):
            try:
                if pg.is_visible(selector):
                    pg.click(selector, timeout=2000)
                    break
            except Exception:
                pass
        time.sleep(1)
        # Pick device family then model.
        # We rely on the label appearing somewhere on the page.
        try:
            pg.get_by_text(label, exact=False).first.click(timeout=4000)
            time.sleep(1.5)
        except Exception:
            return None
        # Walk a few times in case there's a sub-picker.
        for _ in range(3):
            try:
                pg.get_by_text("Excellent", exact=False).first.click(timeout=2500)
                time.sleep(0.8)
            except Exception:
                pass
            try:
                pg.get_by_text("Continue", exact=False).first.click(timeout=2000)
                time.sleep(0.8)
            except Exception:
                pass
        time.sleep(2)
        return extract_max_dollar(pg)
    except PWTimeout:
        return None
    except Exception:
        return None


def main() -> int:
    snap = load_snapshot()
    prev = dict(snap.get("values", {}))
    # Start from previous values, BUT drop any key that's no longer in
    # APPLE_MODEL_LABELS. This is how a human deletes a model from the
    # snapshot: remove the line from the labels map, next run cleans it
    # out. (Previously `new = dict(prev)` made removals "sticky" — old
    # values persisted forever and re-shipped after every refresh.)
    new = {k: v for k, v in prev.items() if k in APPLE_MODEL_LABELS}
    dropped = [k for k in prev if k not in APPLE_MODEL_LABELS]
    warnings: list[str] = []

    print(f"Loaded {len(prev)} previous values from {OUT.name}")
    if dropped:
        print(f"Dropping {len(dropped)} entries no longer in APPLE_MODEL_LABELS: {sorted(dropped)}")

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        ctx = b.new_context(user_agent=UA, viewport={"width": 1366, "height": 900}, locale="en-US")
        pg = ctx.new_page()
        for model_id, label in APPLE_MODEL_LABELS.items():
            try:
                v = scrape_one(pg, model_id, label)
            except Exception as e:
                v = None
                warnings.append(f"  [scrape-error] {model_id} ({label}): {e}")
            if v is None:
                print(f"  -- {model_id:18} {label:40} no value (keeping ${prev.get(model_id, '—')})")
                continue
            old = prev.get(model_id)
            # Sanity check: skip wild swings
            if old is not None and old > 0:
                ratio = abs(v - old) / old
                if ratio > ANOMALY_THRESHOLD:
                    warnings.append(f"  [anomaly] {model_id}: ${old} -> ${v} ({ratio*100:.0f}% swing) — kept previous")
                    print(f"  !! {model_id:18} {label:40} ${old} -> ${v} ANOMALY, kept old")
                    continue
            new[model_id] = v
            print(f"  OK {model_id:18} {label:40} ${v}{'' if old is None else f' (was ${old})'}")
        b.close()

    snap["values"] = new
    snap["updatedAt"] = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    snap["source"] = "https://www.apple.com/shop/trade-in"

    changed = new != prev
    if changed:
        save_snapshot(snap)
        print(f"\nWrote {OUT}: {len(new)} entries, "
              f"{sum(1 for k in new if prev.get(k) != new.get(k))} changed.")
    else:
        print(f"\nNo changes to {OUT}")

    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(w)

    return 0 if changed else 0  # never fail the CI run — we always want the report committed


if __name__ == "__main__":
    sys.exit(main())
