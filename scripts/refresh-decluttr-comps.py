"""Refresh Decluttr max values for every LG phone in our catalog
(Decluttr is the leading buyback for LG devices since LG Mobile shut
down). Mirrors scripts/refresh-apple-comps.py.

Run by:   python scripts/refresh-decluttr-comps.py
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

OUT = Path(__file__).parent.parent / "public" / "comps" / "decluttr.json"
ANOMALY_THRESHOLD = 0.40
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)

DECLUTTR_MODEL_LABELS: Dict[str, str] = {
    "lgv60":    "LG V60 ThinQ",
    "lgv50":    "LG V50 ThinQ",
    "lgv40":    "LG V40 ThinQ",
    "lgv35":    "LG V35 ThinQ",
    "lgv30":    "LG V30",
    "lgv20":    "LG V20",
    "lgg8x":    "LG G8X ThinQ",
    "lgg8":     "LG G8 ThinQ",
    "lgg7":     "LG G7 ThinQ",
    "lgg6":     "LG G6",
    "lgwing":   "LG Wing",
    "lgvelvet": "LG Velvet",
    "lgstylo6": "LG Stylo 6",
    "lgstylo5": "LG Stylo 5",
    "lgk92":    "LG K92",
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
        # Decluttr's search URL puts the device name in the path.
        slug = label.lower().replace(" ", "-")
        pg.goto(f"https://www.decluttr.com/search?q={slug}", wait_until="domcontentloaded", timeout=30000)
        time.sleep(2)
        try:
            pg.get_by_text(label, exact=False).first.click(timeout=4000)
            time.sleep(2)
        except Exception:
            return None
        # Pick "Excellent" condition if shown.
        for _ in range(2):
            try:
                pg.get_by_text("Excellent", exact=False).first.click(timeout=2500)
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
        for model_id, label in DECLUTTR_MODEL_LABELS.items():
            try:
                v = scrape_one(pg, model_id, label)
            except Exception as e:
                v = None
                warnings.append(f"  [scrape-error] {model_id} ({label}): {e}")
            if v is None:
                print(f"  -- {model_id:10} {label:24} no value (keeping ${prev.get(model_id, '—')})")
                continue
            old = prev.get(model_id)
            if old is not None and old > 0:
                ratio = abs(v - old) / old
                if ratio > ANOMALY_THRESHOLD:
                    warnings.append(f"  [anomaly] {model_id}: ${old} -> ${v} ({ratio*100:.0f}% swing) — kept previous")
                    print(f"  !! {model_id:10} {label:24} ${old} -> ${v} ANOMALY, kept old")
                    continue
            new[model_id] = v
            print(f"  OK {model_id:10} {label:24} ${v}{'' if old is None else f' (was ${old})'}")
        b.close()

    snap["values"] = new
    snap["updatedAt"] = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    snap["source"] = "https://www.decluttr.com/"

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
