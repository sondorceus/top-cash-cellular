"""Refresh Google Store Trade-In max values for every Pixel device in
our catalog. Mirrors scripts/refresh-apple-comps.py — same JSON shape,
same anomaly threshold, same 'keep previous on failure' safety.

Run by:   python scripts/refresh-google-comps.py
CI run:   .github/workflows/refresh-comps.yml (cron monthly)
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

OUT = Path(__file__).parent.parent / "public" / "comps" / "google-trade-in.json"
ANOMALY_THRESHOLD = 0.40
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)

# Internal model id -> the label shown on Google Store's trade-in
# selector. Google's calculator (https://store.google.com/us/buy/trade-in)
# uses these exact strings.
GOOGLE_MODEL_LABELS: Dict[str, str] = {
    "px10pxl":   "Pixel 10 Pro XL",
    "px10p":     "Pixel 10 Pro",
    "px10":      "Pixel 10",
    "px10pfold": "Pixel 10 Pro Fold",
    "px9pxl":    "Pixel 9 Pro XL",
    "px9p":      "Pixel 9 Pro",
    "px9pfold":  "Pixel 9 Pro Fold",
    "px9":       "Pixel 9",
    "px9a":      "Pixel 9a",
    "px8p":      "Pixel 8 Pro",
    "px8":       "Pixel 8",
    "px8a":      "Pixel 8a",
    "pxfold":    "Pixel Fold",
    "px7p":      "Pixel 7 Pro",
    "px7":       "Pixel 7",
    "px7a":      "Pixel 7a",
    "px6p":      "Pixel 6 Pro",
    "px6":       "Pixel 6",
    "px6a":      "Pixel 6a",
    "px5":       "Pixel 5",
    "px5a":      "Pixel 5a",
    "pw3":       "Pixel Watch 3",
    "pw2":       "Pixel Watch 2",
    "pw1":       "Pixel Watch",
    "gpixeltab": "Pixel Tablet",
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
    try:
        text = pg.evaluate("() => document.body.innerText")
        vals = [int(m.replace(",", "")) for m in DOLLAR_RE.findall(text)]
        vals = [v for v in vals if 5 <= v <= 1500]
        if not vals:
            return None
        return max(vals)
    except Exception:
        return None


def scrape_one(pg: Page, model_id: str, label: str) -> Optional[int]:
    try:
        pg.goto("https://store.google.com/us/buy/trade-in", wait_until="domcontentloaded", timeout=30000)
        time.sleep(2)
        for selector in (
            "button:has-text('Get started')",
            "a:has-text('Get started')",
            "button:has-text('Start trade-in')",
        ):
            try:
                if pg.is_visible(selector):
                    pg.click(selector, timeout=2000)
                    break
            except Exception:
                pass
        time.sleep(1)
        try:
            pg.get_by_text(label, exact=False).first.click(timeout=4000)
            time.sleep(1.5)
        except Exception:
            return None
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
    new = dict(prev)
    warnings: list[str] = []

    print(f"Loaded {len(prev)} previous values from {OUT.name}")

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        ctx = b.new_context(user_agent=UA, viewport={"width": 1366, "height": 900}, locale="en-US")
        pg = ctx.new_page()
        for model_id, label in GOOGLE_MODEL_LABELS.items():
            try:
                v = scrape_one(pg, model_id, label)
            except Exception as e:
                v = None
                warnings.append(f"  [scrape-error] {model_id} ({label}): {e}")
            if v is None:
                print(f"  -- {model_id:12} {label:24} no value (keeping ${prev.get(model_id, '—')})")
                continue
            old = prev.get(model_id)
            if old is not None and old > 0:
                ratio = abs(v - old) / old
                if ratio > ANOMALY_THRESHOLD:
                    warnings.append(f"  [anomaly] {model_id}: ${old} -> ${v} ({ratio*100:.0f}% swing) — kept previous")
                    print(f"  !! {model_id:12} {label:24} ${old} -> ${v} ANOMALY, kept old")
                    continue
            new[model_id] = v
            print(f"  OK {model_id:12} {label:24} ${v}{'' if old is None else f' (was ${old})'}")
        b.close()

    snap["values"] = new
    snap["updatedAt"] = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    snap["source"] = "https://store.google.com/us/buy/trade-in"

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

    return 0


if __name__ == "__main__":
    sys.exit(main())
