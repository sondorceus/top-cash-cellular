#!/usr/bin/env python3
"""Auto-refresh ALL device prices from ItsWorthMore.com.

Runs monthly via GitHub Actions (same cron as other refresh scripts).
Scrapes IWM for every device category, applies our 15% discount,
and updates public/comps/iwm-prices.json + base prices in page.tsx.

Device categories handled differently:
  - PHONES (Samsung, iPhone): condition × carrier × storage
  - LAPTOPS (MacBook): condition × chip × RAM × storage × screen
  - TABLETS (iPad): condition × connectivity × storage
  - CONSOLES (PS5, Xbox, Switch): condition only (no storage/carrier)
  - WATCHES (Apple Watch): condition × size

Each category has its own quiz flow adapter.

Safety:
  - Anomaly threshold: if price moves >40%, keep old value
  - Resume support: saves progress, skips already-scraped models
  - Rate limiting: 1.5s between requests
  - Backs up previous data before overwriting

Run by:   python scripts/refresh-iwm-prices.py [category]
CI run:   .github/workflows/refresh-comps.yml (cron monthly)
"""
from __future__ import annotations
import json, re, sys, time, os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, List

try:
    from playwright.sync_api import sync_playwright, Page
except ImportError:
    print("playwright not installed; pip install playwright && playwright install chromium")
    sys.exit(2)

ROOT = Path(__file__).parent.parent
OUT = ROOT / "public" / "comps" / "iwm-prices.json"
BACKUP = ROOT / "public" / "comps" / "iwm-prices.backup.json"
PROGRESS = Path("/tmp/iwm-refresh-progress.json")
ANOMALY_THRESHOLD = 0.40
DISCOUNT = 0.15  # Our prices = IWM × (1 - 0.15)
RATE_LIMIT = 1.5
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
DOLLAR = re.compile(r"\$\s*([0-9]+(?:,[0-9]{3})*)(?!\d)")

# ========== DEVICE CONFIGS ==========
# Each category defines: targets, quiz flow, what to scrape
DEVICE_CONFIGS = {
    "phones": {
        "description": "Samsung + iPhone — condition × carrier",
        "conditions": ["Flawless", "Good", "Fair"],
        "carriers": ["Unlocked", "AT&T"],
        "storage": False,  # use IWM's max storage default
    },
    "laptops": {
        "description": "MacBook — condition only (max config)",
        "conditions": ["Flawless", "Good", "Fair"],
        "carriers": None,
        "storage": False,  # pick max
    },
    "tablets": {
        "description": "iPad — condition × WiFi/Cellular",
        "conditions": ["Flawless", "Good", "Fair"],
        "carriers": ["Wi-Fi", "Wi-Fi + Cellular"],
        "storage": False,
    },
    "consoles": {
        "description": "PS5, Xbox, Switch — condition only",
        "conditions": ["Flawless", "Good", "Fair"],
        "carriers": None,
        "storage": False,
    },
}

# ========== PRICE GRABBER ==========
def grab_price(pg: Page) -> Optional[int]:
    """Grab price from IWM's h3.your-offer element."""
    direct = pg.evaluate("""() => {
        const selectors = [
            'section#product-pricing-ctrl h3.your-offer strong',
            'h3.your-offer strong', '.your-offer strong',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const s = window.getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            return (el.innerText || '').trim();
        }
        return '';
    }""")
    if direct:
        m = DOLLAR.search(direct)
        if m:
            v = int(m.group(1).replace(",", ""))
            if 5 <= v <= 10000:
                return v
    return None

def walk_quiz(pg: Page, url: str, condition: str = "Flawless",
              carrier: str = "Unlocked") -> Optional[int]:
    """Walk IWM quiz for any device type."""
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except:
        return None
    pg.wait_for_timeout(1500)

    carrier_prefs = ["Unlocked", "No"] if carrier in ["Unlocked", "N/A", None] else [carrier]

    for _ in range(12):
        visible = pg.evaluate("""() => Array.from(document.querySelectorAll('.answers')).some(
            el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })""")
        if not visible:
            break

        qtype = pg.evaluate("""() => {
            const w = Array.from(document.querySelectorAll('.answers')).find(
                el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0);
            return w ? w.className : '';
        }""")

        if "condition" in qtype.lower():
            prefs = [condition]
        elif any(k in qtype.lower() for k in ["carrier", "lock"]):
            prefs = carrier_prefs
        else:
            prefs = [condition] + carrier_prefs

        pg.evaluate("""([prefs]) => {
            const w = Array.from(document.querySelectorAll('.answers')).find(
                el => el.getBoundingClientRect().width > 0 && el.children.length > 0);
            if (!w) return;
            const kids = Array.from(w.children).filter(c =>
                !c.classList.contains('ng-hide') && (c.innerText||'').trim() && c.getAttribute('ng-click'));
            let ch = null;
            for (const p of prefs) { ch = kids.find(k => (k.innerText||'').toLowerCase().includes(p.toLowerCase())); if (ch) break; }
            if (!ch) ch = kids[kids.length - 1];
            if (ch) ch.click();
        }""", [prefs])
        pg.wait_for_timeout(400)

        pg.evaluate("""() => {
            const n = Array.from(document.querySelectorAll('button')).find(b =>
                ['next step','next','continue'].includes((b.innerText||'').trim().toLowerCase()) && b.getBoundingClientRect().width > 0);
            if (n) n.click();
        }""")
        pg.wait_for_timeout(800)

    pg.wait_for_timeout(1200)
    return grab_price(pg)

# ========== LOAD/SAVE ==========
def load_previous() -> Dict:
    if OUT.exists():
        return json.loads(OUT.read_text())
    return {}

def save_snapshot(data: Dict):
    if OUT.exists():
        BACKUP.write_text(OUT.read_text())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2))

def load_progress() -> Dict:
    try:
        return json.loads(PROGRESS.read_text())
    except:
        return {}

def save_progress(data: Dict):
    PROGRESS.write_text(json.dumps(data))

# ========== ANOMALY CHECK ==========
def check_anomaly(model_id: str, new_price: int, prev_data: Dict) -> bool:
    prev = prev_data.get(model_id, {}).get("flawless_unlocked", {}).get("iwm")
    if prev and prev > 50:
        change = abs(new_price - prev) / prev
        if change > ANOMALY_THRESHOLD:
            print(f"  ⚠ ANOMALY {model_id}: ${prev} → ${new_price} ({change:.0%} change) — keeping old")
            return True
    return False

# ========== MAIN REFRESH ==========
def refresh(targets: List[tuple], config: Dict, prev_data: Dict) -> Dict:
    """Refresh prices for a list of (series, model, id) targets."""
    conditions = config.get("conditions", ["Flawless", "Good", "Fair"])
    carriers = config.get("carriers") or ["N/A"]
    progress = load_progress()
    results = {}

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        pg = b.new_context(user_agent=UA).new_page()

        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            pg.click('button:has-text("Accept")', timeout=3000)
        except:
            pass

        for series, model, mid in targets:
            if mid in progress:
                results[mid] = progress[mid]
                continue

            url = f"https://www.itsworthmore.com/sell/{series}/{model}"
            entry = {"id": mid, "model": model, "updated": datetime.now(timezone.utc).isoformat()}

            for cond in conditions:
                for carr in carriers:
                    try:
                        iwm = walk_quiz(pg, url, condition=cond, carrier=carr)
                    except:
                        iwm = None

                    if iwm:
                        key = f"{cond.lower()}_{carr.lower().replace(' ', '_').replace('&', 'and')}"
                        ours = int(iwm * (1 - DISCOUNT))

                        # Anomaly check on flawless unlocked
                        if cond == "Flawless" and carr in ["Unlocked", "N/A"]:
                            if check_anomaly(mid, iwm, prev_data):
                                old = prev_data.get(mid, {}).get("flawless_unlocked", {})
                                entry[key] = old
                                continue

                        entry[key] = {"iwm": iwm, "ours": ours}
                        print(f"  {mid:14s} {cond:10s} {carr:10s} IWM=${iwm:5d} ours=${ours:5d}")

                    time.sleep(RATE_LIMIT)

            results[mid] = entry
            progress[mid] = entry
            save_progress(progress)

        b.close()

    return results

# ========== CLI ==========
if __name__ == "__main__":
    print(f"IWM Price Refresh — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Discount: {DISCOUNT:.0%} | Anomaly threshold: {ANOMALY_THRESHOLD:.0%}\n")

    prev = load_previous()

    # Can specify category: python refresh-iwm-prices.py samsung
    category = sys.argv[1] if len(sys.argv) > 1 else "all"

    if category == "all":
        print("Full refresh — all categories")
        # Import targets from universal scraper
        from fetch_iwm_universal import TARGETS as ALL_TARGETS
        all_results = {}
        for cat, targets in ALL_TARGETS.items():
            config = DEVICE_CONFIGS.get(cat.split("_")[0],
                     DEVICE_CONFIGS.get("phones"))
            print(f"\n{'='*50}")
            print(f"Category: {cat} ({len(targets)} models)")
            print(f"{'='*50}")
            results = refresh(targets, config, prev)
            all_results.update(results)
        save_snapshot(all_results)
    else:
        print(f"Refreshing: {category}")
        try:
            from fetch_iwm_universal import TARGETS
            targets = TARGETS.get(category, [])
        except:
            targets = []
        if not targets:
            print(f"No targets for '{category}'")
            sys.exit(1)
        config = DEVICE_CONFIGS.get(category, DEVICE_CONFIGS["phones"])
        results = refresh(targets, config, prev)
        # Merge with existing
        existing = load_previous()
        existing.update(results)
        save_snapshot(existing)

    print(f"\nSaved to {OUT}")
    print("Done.")
