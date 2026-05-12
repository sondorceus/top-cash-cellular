#!/usr/bin/env python3
"""FAST IWM scraper — extracts ALL prices from embedded Angular data.

IWM's pricing is embedded client-side in `pricingData` (Angular scope).
One page load = every condition × carrier × storage price for that device.
No quiz walking needed. ~2 seconds per device instead of minutes.

Usage:
  python3 scripts/scrape-fast.py                 # Scrape all 1,453 devices
  python3 scripts/scrape-fast.py phones           # Just phones
  python3 scripts/scrape-fast.py tablets laptops  # Multiple categories
  python3 scripts/scrape-fast.py status           # Show progress
  python3 scripts/scrape-fast.py export           # Export price table for site
"""
import sys, json, os, time, re
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
CATALOG_FILE = os.path.join(ROOT, "iwm-catalog.json")
PRICES_FILE = os.path.join(ROOT, "iwm-all-prices.json")
RATE_LIMIT = 1.0

IPHONE_DISCOUNT = 0.05
DEFAULT_DISCOUNT = 0.10
IPHONE_SERIES = {"iphone"}

COND_MAP = {"[new]": "sealed", "[excellent]": "mint", "[very-good]": "verygood",
            "[good]": "good", "[fair]": "fair", "[broken]": "broken",
            "brand new": "sealed", "flawless": "mint", "very good": "verygood",
            "good": "good", "fair": "fair", "broken": "broken"}

def normalize_storage(label):
    label = label.lower().strip().replace(" ssd", "").replace(" ", "")
    if "tb" in label:
        num = re.search(r"(\d+)", label)
        return f"{num.group(1)}tb" if num else label
    num = re.search(r"(\d+)", label)
    return num.group(1) if num else label

def get_discount(series):
    return IPHONE_DISCOUNT if series in IPHONE_SERIES else DEFAULT_DISCOUNT

def extract_prices_from_tree(tree, discount):
    """Extract all prices from IWM's additive pricing tree.

    IWM uses: final_price = condition_base + carrier_adj + storage_adj
    - Branch 1, Q1: conditions with base prices ($720, $640, etc.)
    - Each condition's go_to leads to carrier/storage branches
    - Carrier answers are adjustments (AT&T -$120, Verizon $0, etc.)
    - Storage answers are adjustments (256GB $0, 512GB +$55, 1TB +$140)

    Returns dict: { storage_id: { condition_id: our_price } }
    """
    if not isinstance(tree, list) or not tree:
        return {}

    results = {}

    # Step 1: Get conditions from the first branch
    first_branch = tree[0]
    conditions_q = first_branch.get("questions", [{}])[0]
    conditions = []

    for ans in conditions_q.get("answers", []):
        base_price = ans.get("value", 0)
        if not base_price or base_price <= 0:
            continue
        if not ans.get("value_enabled", 1):
            continue

        attrs = {a["key"]: a["value"] for a in ans.get("attributes", [])}
        cond_key = attrs.get("condition", ans.get("text", "").lower())
        cond_id = COND_MAP.get(cond_key, COND_MAP.get(ans.get("text", "").lower(), "unknown"))
        go_to = ans.get("go_to", "")

        # Find the branch this condition leads to
        storage_adjustments = {}
        if go_to and "," in go_to:
            try:
                branch_idx = int(go_to.split(",")[0]) - 1
                if 0 <= branch_idx < len(tree):
                    branch = tree[branch_idx]
                    for q in branch.get("questions", []):
                        q_text = q.get("text", "").lower()
                        for a in q.get("answers", []):
                            a_attrs = {x["key"]: x["value"] for x in a.get("attributes", [])}
                            a_text = a.get("text", "")
                            a_val = a.get("value", 0)
                            if isinstance(a_val, str):
                                try: a_val = int(a_val)
                                except: a_val = 0

                            # Storage adjustments
                            if "storage" in q_text or "capacity" in q_text or "storage_size" in a_attrs:
                                sid = normalize_storage(a_text)
                                storage_adjustments[sid] = a_val

                            # Also follow sub-branch go_to for storage
                            sub_go = a.get("go_to", "")
                            if sub_go and "," in sub_go:
                                try:
                                    sub_idx = int(sub_go.split(",")[0]) - 1
                                    if 0 <= sub_idx < len(tree):
                                        for sq in tree[sub_idx].get("questions", []):
                                            sq_text = sq.get("text", "").lower()
                                            for sa in sq.get("answers", []):
                                                sa_attrs = {x["key"]: x["value"] for x in sa.get("attributes", [])}
                                                if "storage" in sq_text or "capacity" in sq_text or "storage_size" in sa_attrs:
                                                    sid = normalize_storage(sa.get("text", ""))
                                                    sa_val = sa.get("value", 0)
                                                    if isinstance(sa_val, str):
                                                        try: sa_val = int(sa_val)
                                                        except: sa_val = 0
                                                    storage_adjustments[sid] = sa_val
                                except:
                                    pass
            except:
                pass

        # Calculate final prices: base + storage adjustment
        if not storage_adjustments:
            storage_adjustments = {"base": 0}

        for sid, adj in storage_adjustments.items():
            iwm_price = base_price + adj
            if iwm_price <= 0:
                continue
            our_price = round(iwm_price * (1 - discount))
            if sid not in results:
                results[sid] = {}
            results[sid][cond_id] = our_price

    return results

def scrape_device_fast(pg, series, model):
    """Load one page, extract ALL prices from embedded data. ~2 seconds."""
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=30000)
    except:
        return None
    pg.wait_for_timeout(1000)

    data = pg.evaluate("""() => {
        try {
            const el = document.querySelector("[ng-controller='product-pricing-ctrl']")
                || document.querySelector("section[ng-controller]");
            if (!el) return null;
            const scope = angular.element(el).scope();
            return {
                name: scope.productName || '',
                brand: scope.productBrand || '',
                category: scope.productCategory || '',
                pricing: scope.pricingData || null,
            };
        } catch(e) { return {error: e.message}; }
    }""")

    if not data or "error" in data or not data.get("pricing"):
        return None

    return data

def load_prices():
    if os.path.exists(PRICES_FILE):
        with open(PRICES_FILE) as f:
            return json.load(f)
    return {}

def save_prices(prices):
    with open(PRICES_FILE, "w") as f:
        json.dump(prices, f, indent=2)

def scrape(categories=None):
    if not os.path.exists(CATALOG_FILE):
        print("No catalog. Run: python3 scrape-all.py discover")
        return

    catalog = json.load(open(CATALOG_FILE))
    devices = catalog["devices"]

    if categories:
        devices = [d for d in devices if d["category"] in categories]

    prices = load_prices()
    total = len(devices)
    done = sum(1 for d in devices if f"{d['series']}/{d['model']}" in prices)
    print(f"=== FAST SCRAPE: {total} devices, {done} already done, {total-done} remaining ===\n")

    if done >= total:
        print("All devices already scraped!")
        return

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA)
        pg = ctx.new_page()

        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            pg.click('button:has-text("Accept")', timeout=3000)
        except:
            pass

        scraped = 0
        failed = 0
        start = time.time()

        for idx, device in enumerate(devices):
            series = device["series"]
            model = device["model"]
            key = f"{series}/{model}"

            if key in prices:
                continue

            discount = get_discount(series)
            data = scrape_device_fast(pg, series, model)

            if not data or not data.get("pricing"):
                print(f"  [{idx+1}/{total}] {model} — FAILED (no pricing data)")
                prices[key] = {"error": "no_pricing_data", "series": series, "model": model}
                failed += 1
            else:
                device_prices = extract_prices_from_tree(data["pricing"], discount)

                # Add broken estimate
                for sid in device_prices:
                    if "mint" in device_prices[sid] and "broken" not in device_prices[sid]:
                        device_prices[sid]["broken"] = round(device_prices[sid]["mint"] * 0.50)

                combo_count = sum(len(v) for v in device_prices.values())
                prices[key] = {
                    "name": data.get("name", model),
                    "brand": data.get("brand", ""),
                    "category": device["category"],
                    "series": series,
                    "model": model,
                    "prices": device_prices,
                    "scraped_at": time.strftime("%Y-%m-%d %H:%M"),
                }
                scraped += 1
                elapsed = time.time() - start
                rate = scraped / elapsed if elapsed > 0 else 0
                remaining = (total - done - scraped - failed) / rate if rate > 0 else 0
                print(f"  [{idx+1}/{total}] {model} — {combo_count} prices ({rate:.1f}/s, ~{remaining:.0f}s left)")

            # Save every 10 devices
            if (scraped + failed) % 10 == 0:
                save_prices(prices)

            time.sleep(RATE_LIMIT)

        save_prices(prices)
        b.close()

    elapsed = time.time() - start
    print(f"\n=== DONE: {scraped} scraped, {failed} failed in {elapsed:.0f}s ===")

def show_status():
    if not os.path.exists(CATALOG_FILE):
        print("No catalog. Run: python3 scrape-all.py discover")
        return

    catalog = json.load(open(CATALOG_FILE))
    prices = load_prices()

    by_cat = {}
    for d in catalog["devices"]:
        cat = d["category"]
        key = f"{d['series']}/{d['model']}"
        by_cat.setdefault(cat, {"total": 0, "done": 0, "failed": 0})
        by_cat[cat]["total"] += 1
        if key in prices:
            if "error" in prices[key]:
                by_cat[cat]["failed"] += 1
            else:
                by_cat[cat]["done"] += 1

    total = sum(v["total"] for v in by_cat.values())
    done = sum(v["done"] for v in by_cat.values())
    failed = sum(v["failed"] for v in by_cat.values())

    print(f"=== SCRAPE STATUS: {done}/{total} done, {failed} failed ===\n")
    for cat in sorted(by_cat):
        t = by_cat[cat]["total"]
        d = by_cat[cat]["done"]
        f = by_cat[cat]["failed"]
        pct = round(d / t * 100) if t else 0
        print(f"  {cat:12s} {d:3d}/{t:3d} done, {f} failed  ({pct}%)")

def export():
    """Export all prices as a clean price table JSON."""
    prices = load_prices()
    table = {}
    for key, data in prices.items():
        if "error" in data or "prices" not in data:
            continue
        table[key] = data["prices"]

    out = os.path.join(ROOT, "price-table-all.json")
    with open(out, "w") as f:
        json.dump(table, f, indent=2)
    print(f"Exported {len(table)} devices to {out}")

if __name__ == "__main__":
    args = sys.argv[1:]

    if not args or args[0] == "help":
        print("""
Fast IWM Scraper — extracts embedded pricing data (~2s per device)

  python3 scrape-fast.py                # Scrape all devices
  python3 scrape-fast.py phones         # Just phones (367)
  python3 scrape-fast.py tablets        # Just tablets (122)
  python3 scrape-fast.py laptops        # Just laptops (346)
  python3 scrape-fast.py consoles       # Just consoles (46)
  python3 scrape-fast.py watches gpus   # Multiple categories
  python3 scrape-fast.py status         # Progress report
  python3 scrape-fast.py export         # Output price table JSON
""")
    elif args[0] == "status":
        show_status()
    elif args[0] == "export":
        export()
    else:
        # Treat all args as category filters
        categories = args if args[0] not in ("status", "export") else None
        scrape(categories)
