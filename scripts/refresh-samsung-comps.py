"""Refresh Samsung Trade-In max values for every Galaxy phone in our
catalog. Mirrors scripts/refresh-apple-comps.py — same JSON shape,
same anomaly threshold, same 'keep previous on failure' safety.

Run by:   python scripts/refresh-samsung-comps.py
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

OUT = Path(__file__).parent.parent / "public" / "comps" / "samsung-trade-in.json"
ANOMALY_THRESHOLD = 0.40
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)

SAMSUNG_MODEL_LABELS: Dict[str, str] = {
    "gs26u": "Galaxy S26 Ultra",
    "gs25u": "Galaxy S25 Ultra",
    "gs24u": "Galaxy S24 Ultra",
    "gs23u": "Galaxy S23 Ultra",
    "gs22u": "Galaxy S22 Ultra",
    "gs21u": "Galaxy S21 Ultra",
    "gs20u": "Galaxy S20 Ultra",
    "gs25edge": "Galaxy S25 Edge",
    "gs26p":  "Galaxy S26+",
    "gs25p":  "Galaxy S25+",
    "gs24p":  "Galaxy S24+",
    "gs23p":  "Galaxy S23+",
    "gs22p":  "Galaxy S22+",
    "gs21p":  "Galaxy S21+",
    "gs20p":  "Galaxy S20+",
    "gs26":   "Galaxy S26",
    "gs25":   "Galaxy S25",
    "gs24":   "Galaxy S24",
    "gs23":   "Galaxy S23",
    "gs22":   "Galaxy S22",
    "gs21":   "Galaxy S21",
    "gs20":   "Galaxy S20",
    "gs25fe": "Galaxy S25 FE",
    "gs24fe": "Galaxy S24 FE",
    "gs23fe": "Galaxy S23 FE",
    "gs21fe": "Galaxy S21 FE",
    "gs20fe": "Galaxy S20 FE",
    "gztrifold": "Galaxy Z TriFold",
    "gzfold7":   "Galaxy Z Fold 7",
    "gzfold6":   "Galaxy Z Fold 6",
    "gzfold5":   "Galaxy Z Fold 5",
    "gzfold4":   "Galaxy Z Fold 4",
    "gzfold3":   "Galaxy Z Fold 3",
    "gzflip7":   "Galaxy Z Flip 7",
    "gzflip6":   "Galaxy Z Flip 6",
    "gzflip5":   "Galaxy Z Flip 5",
    "gzflip4":   "Galaxy Z Flip 4",
    "gzflip3":   "Galaxy Z Flip 3",
    "gnote20u":  "Galaxy Note 20 Ultra",
    "gnote20":   "Galaxy Note 20",
    "gnote10p5g":"Galaxy Note 10+ 5G",
    "gnote10p":  "Galaxy Note 10+",
    "gnote10":   "Galaxy Note 10",
    "gnote9":    "Galaxy Note 9",
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
        vals = [v for v in vals if 10 <= v <= 2500]
        if not vals:
            return None
        return max(vals)
    except Exception:
        return None


def scrape_one(pg: Page, model_id: str, label: str) -> Optional[int]:
    try:
        pg.goto("https://www.samsung.com/us/shop/mobile/trade-in/", wait_until="domcontentloaded", timeout=30000)
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
        for model_id, label in SAMSUNG_MODEL_LABELS.items():
            try:
                v = scrape_one(pg, model_id, label)
            except Exception as e:
                v = None
                warnings.append(f"  [scrape-error] {model_id} ({label}): {e}")
            if v is None:
                print(f"  -- {model_id:12} {label:28} no value (keeping ${prev.get(model_id, '—')})")
                continue
            old = prev.get(model_id)
            if old is not None and old > 0:
                ratio = abs(v - old) / old
                if ratio > ANOMALY_THRESHOLD:
                    warnings.append(f"  [anomaly] {model_id}: ${old} -> ${v} ({ratio*100:.0f}% swing) — kept previous")
                    print(f"  !! {model_id:12} {label:28} ${old} -> ${v} ANOMALY, kept old")
                    continue
            new[model_id] = v
            print(f"  OK {model_id:12} {label:28} ${v}{'' if old is None else f' (was ${old})'}")
        b.close()

    snap["values"] = new
    snap["updatedAt"] = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    snap["source"] = "https://www.samsung.com/us/shop/mobile/trade-in/"

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
