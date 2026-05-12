#!/usr/bin/env python3
"""eBay Sold Listings Scraper — get actual resell prices for devices.

Scrapes eBay's completed/sold listings to determine real market value.
This is the gold standard for "what can I actually sell this device for?"

Usage:
  python3 scripts/ebay-resell.py "iPhone 15 Pro 256GB"
  python3 scripts/ebay-resell.py "Galaxy S25 Ultra 512GB"
  python3 scripts/ebay-resell.py "PS5 Pro"
  python3 scripts/ebay-resell.py all              # Scrape all site devices
  python3 scripts/ebay-resell.py margins           # Calculate margins for all devices
"""
import sys, re, json, os, time, statistics
from urllib.parse import quote_plus

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
RESELL_FILE = os.path.join(ROOT, "ebay-resell-data.json")

# Condition IDs on eBay
EBAY_CONDITIONS = {
    "new": "1000", "openbox": "1500", "refurbished": "2000%7C2500",
    "used": "3000", "parts": "7000",
}

# Shared Playwright browser instance
_browser = None
_page = None

def get_page():
    """Get or create a shared Playwright page (reuse browser across searches)."""
    global _browser, _page
    if _page:
        return _page
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    _browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = _browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36")
    _page = ctx.new_page()
    return _page

def close_browser():
    global _browser, _page
    if _browser:
        _browser.close()
        _browser = None
        _page = None

def search_ebay_sold(query, condition="used", max_results=40):
    """Search eBay sold listings using Playwright (real browser bypasses security)."""
    encoded = quote_plus(query)
    cond_filter = f"&LH_ItemCondition={EBAY_CONDITIONS[condition]}" if condition in EBAY_CONDITIONS else ""
    url = (f"https://www.ebay.com/sch/i.html?_nkw={encoded}"
           f"&LH_Sold=1&LH_Complete=1{cond_filter}"
           f"&_ipg={max_results}&rt=nc&_sop=13")

    pg = get_page()
    try:
        pg.goto(url, wait_until="domcontentloaded", timeout=20000)
        pg.wait_for_timeout(2000)
    except:
        return []

    items = pg.evaluate("""() => {
        const results = [];
        document.querySelectorAll('.s-item').forEach(item => {
            const titleEl = item.querySelector('.s-item__title span') || item.querySelector('.s-item__title');
            if (!titleEl) return;
            const title = titleEl.innerText.trim();
            if (title.toLowerCase().startsWith('shop on ebay')) return;

            const priceEl = item.querySelector('.s-item__price');
            if (!priceEl) return;
            const priceMatch = priceEl.innerText.match(/\\$([0-9,]+\\.?\\d*)/);
            if (!priceMatch) return;
            const price = parseFloat(priceMatch[1].replace(',', ''));
            if (price < 10) return;

            const condEl = item.querySelector('.SECONDARY_INFO');
            const dateEl = item.querySelector('.s-item__title--tagblock .POSITIVE');
            const linkEl = item.querySelector('a.s-item__link');

            results.push({
                title: title,
                price: price,
                condition: condEl ? condEl.innerText.trim() : '',
                date: dateEl ? dateEl.innerText.trim() : '',
                url: linkEl ? linkEl.href : '',
            });
        });
        return results;
    }""")

    return items or []

def analyze_prices(items, query=""):
    """Analyze sold prices and return stats."""
    if not items:
        return {"query": query, "count": 0, "error": "no results"}

    prices = [i["price"] for i in items]

    # Remove outliers (beyond 2 standard deviations)
    if len(prices) >= 5:
        mean = statistics.mean(prices)
        stdev = statistics.stdev(prices)
        filtered = [p for p in prices if abs(p - mean) <= 2 * stdev]
        if len(filtered) >= 3:
            prices = filtered

    return {
        "query": query,
        "count": len(items),
        "prices_used": len(prices),
        "median": round(statistics.median(prices)),
        "mean": round(statistics.mean(prices)),
        "low": round(min(prices)),
        "high": round(max(prices)),
        "p25": round(sorted(prices)[len(prices) // 4]) if len(prices) >= 4 else round(min(prices)),
        "p75": round(sorted(prices)[3 * len(prices) // 4]) if len(prices) >= 4 else round(max(prices)),
    }

def get_resell_value(device_name, storage="", condition="used"):
    """Get the resell value for a device from eBay sold data.

    Returns the median sold price (best estimate of market value).
    """
    query = f"{device_name} {storage}".strip()
    # Add "unlocked" for phones to get better results
    if any(w in device_name.lower() for w in ["iphone", "galaxy", "pixel", "oneplus"]):
        query += " unlocked"

    items = search_ebay_sold(query, condition=condition)
    stats = analyze_prices(items, query)
    return stats

# ========== ALL DEVICES ==========
# Map our device IDs to eBay search queries
DEVICE_QUERIES = {
    # iPhone 17
    "ip17pm": ("iPhone 17 Pro Max", ["256GB", "512GB", "1TB"]),
    "ip17p": ("iPhone 17 Pro", ["256GB", "512GB", "1TB"]),
    "ip17air": ("iPhone 17 Air", ["256GB", "512GB"]),
    "ip17": ("iPhone 17", ["256GB", "512GB"]),
    "ip17e": ("iPhone 17e", ["256GB"]),
    # iPhone 16
    "ip16pm": ("iPhone 16 Pro Max", ["256GB", "512GB", "1TB"]),
    "ip16p": ("iPhone 16 Pro", ["128GB", "256GB", "512GB", "1TB"]),
    "ip16plus": ("iPhone 16 Plus", ["128GB", "256GB", "512GB"]),
    "ip16": ("iPhone 16", ["128GB", "256GB", "512GB"]),
    # iPhone 15
    "ip15pm": ("iPhone 15 Pro Max", ["256GB", "512GB", "1TB"]),
    "ip15p": ("iPhone 15 Pro", ["128GB", "256GB", "512GB", "1TB"]),
    "ip15plus": ("iPhone 15 Plus", ["128GB", "256GB", "512GB"]),
    "ip15": ("iPhone 15", ["128GB", "256GB"]),
    # iPhone 14
    "ip14pm": ("iPhone 14 Pro Max", ["128GB", "256GB", "512GB"]),
    "ip14p": ("iPhone 14 Pro", ["128GB", "256GB", "512GB"]),
    "ip14": ("iPhone 14", ["128GB", "256GB"]),
    # iPhone 13
    "ip13pm": ("iPhone 13 Pro Max", ["128GB", "256GB", "512GB"]),
    "ip13p": ("iPhone 13 Pro", ["128GB", "256GB"]),
    "ip13": ("iPhone 13", ["128GB", "256GB"]),
    # Samsung S series
    "gs26u": ("Galaxy S26 Ultra", ["256GB", "512GB", "1TB"]),
    "gs25u": ("Galaxy S25 Ultra", ["256GB", "512GB", "1TB"]),
    "gs24u": ("Galaxy S24 Ultra", ["256GB", "512GB", "1TB"]),
    "gs26": ("Galaxy S26", ["256GB", "512GB"]),
    "gs25": ("Galaxy S25", ["128GB", "256GB"]),
    # Samsung Z
    "gzfold7": ("Galaxy Z Fold 7", ["256GB", "512GB"]),
    "gzfold6": ("Galaxy Z Fold 6", ["256GB", "512GB"]),
    "gzflip7": ("Galaxy Z Flip 7", ["256GB", "512GB"]),
    "gzflip6": ("Galaxy Z Flip 6", ["256GB", "512GB"]),
    # Pixel
    "px10pxl": ("Pixel 10 Pro XL", ["256GB", "512GB"]),
    "px10p": ("Pixel 10 Pro", ["128GB", "256GB"]),
    "px9pxl": ("Pixel 9 Pro XL", ["128GB", "256GB", "512GB"]),
    "px9p": ("Pixel 9 Pro", ["128GB", "256GB"]),
    # Consoles
    "ps5pro": ("PlayStation 5 Pro", [""]),
    "ps5slim": ("PlayStation 5 Slim", [""]),
    "ps5": ("PlayStation 5", [""]),
    "xbsx": ("Xbox Series X", [""]),
    "xbss": ("Xbox Series S", [""]),
    "nsw2": ("Nintendo Switch 2", [""]),
    "nswoled": ("Nintendo Switch OLED", [""]),
    # MacBook
    "mbp16m4": ("MacBook Pro 16 M4", [""]),
    "mbp14m4": ("MacBook Pro 14 M4", [""]),
    "mbp16m3": ("MacBook Pro 16 M3", [""]),
    "mbp14m3": ("MacBook Pro 14 M3", [""]),
}

def scrape_all():
    """Scrape eBay sold data for all devices."""
    results = {}

    # Load existing
    if os.path.exists(RESELL_FILE):
        results = json.load(open(RESELL_FILE))

    total = sum(len(storages) for _, storages in DEVICE_QUERIES.values())
    done = 0

    print(f"=== EBAY SOLD PRICE SCRAPE ({total} queries) ===\n")

    for did, (name, storages) in DEVICE_QUERIES.items():
        for storage in storages:
            key = f"{did}_{storage}".replace("GB", "").replace("TB", "tb").strip("_")

            if key in results and results[key].get("count", 0) > 0:
                done += 1
                continue

            stats = get_resell_value(name, storage, condition="used")
            results[key] = {**stats, "device_id": did, "storage": storage, "scraped_at": time.strftime("%Y-%m-%d")}
            done += 1

            if stats["count"] > 0:
                print(f"  [{done}/{total}] {name} {storage}: median ${stats['median']} ({stats['count']} sold)")
            else:
                print(f"  [{done}/{total}] {name} {storage}: no results")

            # Save periodically
            if done % 5 == 0:
                with open(RESELL_FILE, "w") as f:
                    json.dump(results, f, indent=2)

            time.sleep(1.5)  # Rate limit

    with open(RESELL_FILE, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved {len(results)} entries to {RESELL_FILE}")

def show_margins():
    """Calculate and display profit margins for all devices."""
    if not os.path.exists(RESELL_FILE):
        print("No resell data. Run: python3 ebay-resell.py all")
        return

    resell = json.load(open(RESELL_FILE))

    # Load our buy prices from PRICE_TABLE (read from page.tsx would be complex,
    # so use iwm-all-prices.json or price-table-iphone.json)
    buy_prices = {}
    iphone_file = os.path.join(ROOT, "price-table-iphone.json")
    if os.path.exists(iphone_file):
        data = json.load(open(iphone_file))
        for did, storages in data.items():
            for sid, conds in storages.items():
                if "mint" in conds:
                    buy_prices[f"{did}_{sid}"] = conds["mint"]

    print(f"{'Device':<30} {'Storage':<8} {'Buy':>6} {'Resell':>8} {'Margin':>8} {'%':>6}")
    print("-" * 75)

    for key, data in sorted(resell.items()):
        if data.get("count", 0) == 0:
            continue

        did = data.get("device_id", "")
        storage = data.get("storage", "")
        resell_price = data.get("median", 0)

        # Find our buy price
        sid = storage.lower().replace("gb", "").replace("tb", "tb").strip()
        buy_key = f"{did}_{sid}"
        our_buy = buy_prices.get(buy_key, 0)

        if our_buy and resell_price:
            margin = resell_price - our_buy
            margin_pct = round(margin / resell_price * 100) if resell_price else 0
            flag = " !!!" if margin_pct < 10 else " !" if margin_pct < 15 else ""
            print(f"  {data.get('query', key):<28} {storage:<8} ${our_buy:>5} ${resell_price:>6} ${margin:>6} {margin_pct:>5}%{flag}")
        else:
            print(f"  {data.get('query', key):<28} {storage:<8} {'?':>6} ${resell_price:>6}")

# ========== CLI ==========
if __name__ == "__main__":
    args = sys.argv[1:]

    if not args or args[0] == "help":
        print("""
eBay Sold Price Scraper — real market resell values

  python3 ebay-resell.py "iPhone 15 Pro 256GB"   # Single device lookup
  python3 ebay-resell.py all                       # Scrape all devices
  python3 ebay-resell.py margins                   # Show profit margins
""")
    elif args[0] == "all":
        scrape_all()
    elif args[0] == "margins":
        show_margins()
    else:
        query = " ".join(args)
        print(f"Searching eBay sold: {query}\n")
        items = search_ebay_sold(query)
        stats = analyze_prices(items, query)

        if stats["count"] == 0:
            print("No results found.")
        else:
            print(f"Results: {stats['count']} sold listings")
            print(f"  Median:  ${stats['median']}")
            print(f"  Mean:    ${stats['mean']}")
            print(f"  Range:   ${stats['low']} - ${stats['high']}")
            print(f"  P25-P75: ${stats['p25']} - ${stats['p75']}")
            print()
            print("Recent sales:")
            for i in items[:10]:
                print(f"  ${i['price']:>7.2f}  {i['condition']:>15s}  {i['title'][:60]}")
