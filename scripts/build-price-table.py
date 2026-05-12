#!/usr/bin/env python3
"""Scrape IWM for EVERY condition × storage combo per device.
Outputs a TypeScript-ready PRICE_TABLE for page.tsx.

Usage:
  python3 scripts/build-price-table.py iphone     # Scrape all iPhones
  python3 scripts/build-price-table.py samsung     # Scrape all Samsung
  python3 scripts/build-price-table.py macbook     # Use existing macbook-prices-full.json
  python3 scripts/build-price-table.py all         # Everything
  python3 scripts/build-price-table.py merge       # Merge all JSON into one table + TS output
"""
import sys, re, json, os, time
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
DOLLAR = re.compile(r"\$\s*([0-9]+(?:,[0-9]{3})*)(?!\d)")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

# Discount: iPhone 5%, everything else 10%
IPHONE_DISCOUNT = 0.05
OTHER_DISCOUNT = 0.10

# IWM condition → our condition ID
COND_MAP = {
    "brand new": "sealed",
    "flawless": "mint",
    "very good": "verygood",
    "good": "good",
    "fair": "fair",
    "broken": "broken",
}

# IWM storage label → our storage ID
def normalize_storage(label):
    """'256GB' → '256', '1TB SSD' → '1tb', '512GB SSD' → '512'"""
    label = label.lower().strip().replace(" ssd", "").replace(" ", "")
    if "tb" in label:
        num = re.search(r"(\d+)", label)
        return f"{num.group(1)}tb" if num else label
    num = re.search(r"(\d+)", label)
    return num.group(1) if num else label

# ========== TARGETS ==========
IPHONE_TARGETS = [
    ("iphone", "iphone-17-pro-max", "ip17pm"),
    ("iphone", "iphone-17-pro", "ip17p"),
    ("iphone", "iphone-17-air", "ip17air"),
    ("iphone", "iphone-17", "ip17"),
    ("iphone", "iphone-17e", "ip17e"),
    ("iphone", "iphone-16-pro-max", "ip16pm"),
    ("iphone", "iphone-16-pro", "ip16p"),
    ("iphone", "iphone-16-plus", "ip16plus"),
    ("iphone", "iphone-16", "ip16"),
    ("iphone", "iphone-15-pro-max", "ip15pm"),
    ("iphone", "iphone-15-pro", "ip15p"),
    ("iphone", "iphone-15-plus", "ip15plus"),
    ("iphone", "iphone-15", "ip15"),
    ("iphone", "iphone-14-pro-max", "ip14pm"),
    ("iphone", "iphone-14-pro", "ip14p"),
    ("iphone", "iphone-14", "ip14"),
    ("iphone", "iphone-13-pro-max", "ip13pm"),
    ("iphone", "iphone-13-pro", "ip13p"),
    ("iphone", "iphone-13", "ip13"),
    ("iphone", "iphone-12-pro-max", "ip12pm"),
    ("iphone", "iphone-12", "ip12"),
    ("iphone", "iphone-11-pro-max", "ip11pm"),
    ("iphone", "iphone-11", "ip11"),
]

SAMSUNG_TARGETS = [
    ("galaxy-s-series", "galaxy-s26-ultra", "gs26u"),
    ("galaxy-s-series", "galaxy-s25-ultra", "gs25u"),
    ("galaxy-s-series", "galaxy-s24-ultra", "gs24u"),
    ("galaxy-s-series", "galaxy-s26-plus", "gs26p"),
    ("galaxy-s-series", "galaxy-s25-plus", "gs25p"),
    ("galaxy-s-series", "galaxy-s26", "gs26"),
    ("galaxy-s-series", "galaxy-s25", "gs25"),
    ("galaxy-s-series", "galaxy-s24", "gs24"),
    ("galaxy-z-fold-series", "galaxy-z-fold-7", "gzfold7"),
    ("galaxy-z-fold-series", "galaxy-z-fold-6", "gzfold6"),
    ("galaxy-z-fold-series", "galaxy-z-flip-7", "gzflip7"),
    ("galaxy-z-fold-series", "galaxy-z-flip-6", "gzflip6"),
]

ALL_CONDITIONS = ["Brand New", "Flawless", "Very Good", "Good", "Fair"]

# ========== QUIZ HELPERS (reuse from universal scraper) ==========
def read_quiz_options(pg):
    return pg.evaluate("""() => {
        const wrap = Array.from(document.querySelectorAll('.answers')).find(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        });
        if (!wrap) return null;
        const kids = Array.from(wrap.children).filter(c => {
            if (c.classList.contains('ng-hide')) return false;
            return (c.innerText || '').trim();
        });
        return kids.map(k => (k.innerText || '').trim().slice(0, 60));
    }""")

def click_option(pg, pref):
    return pg.evaluate("""([pref]) => {
        const wrap = Array.from(document.querySelectorAll('.answers')).find(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && el.children.length > 0;
        });
        if (!wrap) return false;
        const kids = Array.from(wrap.children).filter(c => {
            if (c.classList.contains('ng-hide')) return false;
            return (c.innerText || '').trim() && c.getAttribute('ng-click');
        });
        if (!kids.length) return false;
        let chosen = null;
        if (pref === '__FIRST__') {
            chosen = kids[0];
        } else if (pref === '__LAST__') {
            chosen = kids[kids.length - 1];
        } else {
            chosen = kids.find(k => (k.innerText || '').toLowerCase().includes(pref.toLowerCase()));
        }
        if (!chosen) chosen = kids[0];
        chosen.click();
        return true;
    }""", [pref])

def click_next(pg):
    pg.evaluate("""() => {
        const next = Array.from(document.querySelectorAll('button')).find(b => {
            const t = (b.innerText || '').trim().toLowerCase();
            return (t === 'next step' || t === 'next' || t === 'continue') && b.getBoundingClientRect().width > 0;
        });
        if (next) next.click();
    }""")

def grab_price(pg):
    direct = pg.evaluate("""() => {
        const el = document.querySelector('h3.your-offer strong');
        return el ? (el.innerText || '').trim() : '';
    }""")
    if direct:
        m = DOLLAR.search(direct)
        if m:
            v = int(m.group(1).replace(",", ""))
            if 5 <= v <= 8000:
                return v
    return None

def classify_step(opts):
    joined = " ".join(opts).lower()
    if any(c in joined for c in ["brand new", "flawless", "broken", "fair"]):
        return "condition"
    if any(c in joined for c in ["at&t", "unlocked", "verizon", "t-mobile"]):
        return "carrier"
    chip_words = ["m1 ", "m2 ", "m3 ", "m4 ", "m5 ", "core cpu", "core gpu", "intel"]
    if any(c in joined for c in chip_words) and "gb" not in joined:
        return "chip"
    if "tb" in joined:
        return "storage"
    if "gb" in joined:
        nums = [int(x) for x in re.findall(r"(\d+)\s*gb", joined)]
        if nums and max(nums) <= 192:
            return "ram"
        return "storage"
    return "other"

def walk_quiz(pg, series, model, condition, storage=None):
    """Walk IWM quiz for a specific condition + storage. Returns price."""
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except:
        return None
    pg.wait_for_timeout(1500)

    for i in range(12):
        opts = read_quiz_options(pg)
        if not opts:
            break

        step = classify_step(opts)

        if step == "condition":
            click_option(pg, condition)
        elif step == "carrier":
            click_option(pg, "Unlocked")
        elif step == "storage":
            if storage:
                click_option(pg, storage)
            else:
                click_option(pg, "__FIRST__")
        elif step == "chip":
            click_option(pg, "__FIRST__")
        elif step == "ram":
            click_option(pg, "__FIRST__")
        else:
            click_option(pg, "Yes")

        pg.wait_for_timeout(400)
        click_next(pg)
        pg.wait_for_timeout(800)

    pg.wait_for_timeout(1200)
    return grab_price(pg)

def discover_storage(pg, series, model):
    """Quick discovery of available storage tiers."""
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except:
        return []
    pg.wait_for_timeout(1500)

    for i in range(12):
        opts = read_quiz_options(pg)
        if not opts:
            break
        step = classify_step(opts)
        if step == "storage":
            return opts
        click_option(pg, "__FIRST__")
        pg.wait_for_timeout(400)
        click_next(pg)
        pg.wait_for_timeout(800)
    return []

# ========== SCRAPE ==========
def scrape_device(pg, series, model, mid, discount):
    """Scrape all conditions × storage for one device. Returns price dict."""
    print(f"\n--- {model} ({mid}) ---")

    # Discover storage tiers
    storages = discover_storage(pg, series, model)
    if not storages:
        print(f"  No storage options found, trying single-storage")
        storages = ["default"]
    else:
        print(f"  Storage: {storages}")

    prices = {}  # { storage_id: { condition_id: price } }

    for storage_label in storages:
        storage_id = normalize_storage(storage_label) if storage_label != "default" else "default"
        if storage_id not in prices:
            prices[storage_id] = {}

        for cond_name in ALL_CONDITIONS:
            cond_id = COND_MAP.get(cond_name.lower(), cond_name.lower())

            storage_pref = storage_label if storage_label != "default" else None
            iwm_price = walk_quiz(pg, series, model, cond_name, storage_pref)

            if iwm_price:
                our_price = round(iwm_price * (1 - discount))
                prices[storage_id][cond_id] = our_price
                print(f"  {cond_name:12s} {storage_label:12s} IWM=${iwm_price:5d}  ours=${our_price:5d}")
            else:
                print(f"  {cond_name:12s} {storage_label:12s} FAILED")

            time.sleep(1)

    # Add broken estimate (50% of mint)
    for sid in prices:
        if "mint" in prices[sid]:
            prices[sid]["broken"] = round(prices[sid]["mint"] * 0.50)

    return prices

def scrape_category(category):
    """Scrape all devices in a category."""
    if category == "iphone":
        targets = IPHONE_TARGETS
        discount = IPHONE_DISCOUNT
    elif category == "samsung":
        targets = SAMSUNG_TARGETS
        discount = OTHER_DISCOUNT
    else:
        print(f"Unknown category: {category}")
        return {}

    output_file = os.path.join(ROOT, f"price-table-{category}.json")

    # Load existing progress
    existing = {}
    if os.path.exists(output_file):
        with open(output_file) as f:
            existing = json.load(f)

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA)
        pg = ctx.new_page()

        # Accept cookies
        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            pg.click('button:has-text("Accept")', timeout=3000)
        except:
            pass

        for series, model, mid in targets:
            if mid in existing:
                print(f"\n--- {model} ({mid}) --- SKIPPED (already scraped)")
                continue

            prices = scrape_device(pg, series, model, mid, discount)
            if prices:
                existing[mid] = prices
                # Save after each device
                with open(output_file, "w") as f:
                    json.dump(existing, f, indent=2)

        b.close()

    print(f"\nSaved {len(existing)} devices to {output_file}")
    return existing

def convert_macbook_data():
    """Convert existing macbook-prices-full.json to price table format."""
    src = os.path.join(ROOT, "macbook-prices-full.json")
    if not os.path.exists(src):
        print("No macbook-prices-full.json found")
        return {}

    data = json.load(open(src))
    table = {}

    for device in data:
        mid = device["id"]
        prices_by_storage = {}

        for key, val in device.get("prices", {}).items():
            # key format: "flawless_n/a_512gbssd"
            parts = key.split("_")
            cond_raw = parts[0]
            storage_raw = parts[-1] if len(parts) >= 3 else ""

            cond_id = COND_MAP.get(cond_raw, cond_raw)
            storage_id = normalize_storage(storage_raw)

            if storage_id not in prices_by_storage:
                prices_by_storage[storage_id] = {}

            # Apply 10% discount (MacBooks)
            iwm = val["iwm"]
            our_price = round(iwm * (1 - OTHER_DISCOUNT))
            prices_by_storage[storage_id][cond_id] = our_price

        # Fix broken prices (scraper data unreliable for broken)
        for sid in prices_by_storage:
            if "mint" in prices_by_storage[sid]:
                prices_by_storage[sid]["broken"] = round(prices_by_storage[sid]["mint"] * 0.50)

        if prices_by_storage:
            table[mid] = prices_by_storage

    output = os.path.join(ROOT, "price-table-macbook.json")
    with open(output, "w") as f:
        json.dump(table, f, indent=2)
    print(f"Converted {len(table)} MacBook models to {output}")
    return table

def merge_and_output():
    """Merge all price-table-*.json files into one and output TypeScript."""
    merged = {}

    for fname in sorted(os.listdir(ROOT)):
        if fname.startswith("price-table-") and fname.endswith(".json"):
            path = os.path.join(ROOT, fname)
            data = json.load(open(path))
            merged.update(data)
            print(f"  Loaded {len(data)} devices from {fname}")

    # Save merged JSON
    merged_path = os.path.join(ROOT, "price-table.json")
    with open(merged_path, "w") as f:
        json.dump(merged, f, indent=2)

    # Output TypeScript for page.tsx
    ts_lines = ["const PRICE_TABLE: Record<string, Record<string, Record<string, number>>> = {"]
    for mid in sorted(merged.keys()):
        ts_lines.append(f'  {mid}: {{')
        for sid in sorted(merged[mid].keys()):
            conds = merged[mid][sid]
            pairs = ", ".join(f'{c}: {p}' for c, p in sorted(conds.items()))
            ts_lines.append(f'    "{sid}": {{ {pairs} }},')
        ts_lines.append('  },')
    ts_lines.append("};")

    ts_path = os.path.join(ROOT, "price-table.ts")
    with open(ts_path, "w") as f:
        f.write("\n".join(ts_lines) + "\n")

    print(f"\nMerged {len(merged)} devices → {merged_path}")
    print(f"TypeScript output → {ts_path}")
    print(f"Copy the contents of {ts_path} into page.tsx to replace the empty PRICE_TABLE.")

# ========== CLI ==========
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd == "iphone":
        scrape_category("iphone")
    elif cmd == "samsung":
        scrape_category("samsung")
    elif cmd == "macbook":
        convert_macbook_data()
    elif cmd == "all":
        scrape_category("iphone")
        scrape_category("samsung")
        convert_macbook_data()
        merge_and_output()
    elif cmd == "merge":
        merge_and_output()
    else:
        print("""
Price Table Builder — scrape IWM for exact per-combo pricing

  python3 scripts/build-price-table.py iphone   # Scrape iPhones (5% below)
  python3 scripts/build-price-table.py samsung   # Scrape Samsung (10% below)
  python3 scripts/build-price-table.py macbook   # Convert existing MacBook data
  python3 scripts/build-price-table.py all       # Everything + merge
  python3 scripts/build-price-table.py merge     # Merge existing JSONs → TypeScript
""")
