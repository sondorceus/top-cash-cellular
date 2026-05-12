#!/usr/bin/env python3
"""Universal IWM scraper — auto-discovers ALL devices and scrapes every combo.

Discovers devices from IWM's sitemap, walks every condition × storage combo,
outputs a unified price table. Handles phones, laptops, tablets, consoles,
watches, GPUs, cameras, audio, drones, VR — any device type.

Usage:
  python3 scripts/scrape-all.py discover          # Discover all devices from sitemap
  python3 scripts/scrape-all.py scrape             # Scrape all discovered devices
  python3 scripts/scrape-all.py scrape phones      # Scrape only phones
  python3 scripts/scrape-all.py scrape tablets
  python3 scripts/scrape-all.py scrape laptops
  python3 scripts/scrape-all.py scrape consoles
  python3 scripts/scrape-all.py scrape watches
  python3 scripts/scrape-all.py scrape gpus
  python3 scripts/scrape-all.py scrape desktops
  python3 scripts/scrape-all.py status             # Show scrape progress
  python3 scripts/scrape-all.py export             # Export price table for site
"""
import sys, re, json, os, time, xml.etree.ElementTree as ET
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
DOLLAR = re.compile(r"\$\s*([0-9]+(?:,[0-9]{3})*)(?!\d)")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
CATALOG_FILE = os.path.join(ROOT, "iwm-catalog.json")
PRICES_FILE = os.path.join(ROOT, "iwm-all-prices.json")
RATE_LIMIT = 1.2  # seconds between page loads

# Discount rules
IPHONE_DISCOUNT = 0.05
DEFAULT_DISCOUNT = 0.10

# IWM condition → our ID
COND_MAP = {"brand new": "sealed", "flawless": "mint", "very good": "verygood",
            "good": "good", "fair": "fair", "broken": "broken"}
ALL_CONDITIONS = ["Brand New", "Flawless", "Very Good", "Good", "Fair"]

# Series that are iPhones (5% discount)
IPHONE_SERIES = {"iphone"}

# Category grouping by series slug patterns
CATEGORY_PATTERNS = {
    "phones": ["iphone", "galaxy-s", "galaxy-z", "galaxy-note", "galaxy-a", "galaxy-xcover",
               "google-phone", "oneplus-phone", "motorola", "nothing-phone", "sony-phone",
               "sony-xperia", "lg-phone", "htc-phone", "blackberry", "xiaomi", "huawei",
               "nokia", "asus-phone", "asus-rog-phone", "razer-phone", "microsoft-phone",
               "zte-phone", "kyocera"],
    "tablets": ["ipad", "samsung-tablet", "surface", "google-tablet", "lenovo-tablet", "oneplus-tablet"],
    "laptops": ["macbook", "razer-blade", "razer-laptop", "samsung-laptop", "expert-laptop",
                "google-laptop", "hp-omnibook", "laptop", "microsoft-laptop", "dell-laptop",
                "lenovo-laptop", "hp-laptop", "asus-laptop", "alienware-laptop", "msi-laptop",
                "panasonic-laptop", "acer-laptop", "lg-laptop", "acer-aspire"],
    "desktops": ["imac", "mac-mini", "mac-studio", "mac-pro", "microsoft-desktop",
                 "dell-desktop", "lenovo-desktop", "hp-desktop", "asus-desktop",
                 "alienware-desktop", "msi-desktop"],
    "watches": ["apple-watch", "samsung-watch", "google-watch", "garmin", "fitbit", "oneplus-watch"],
    "consoles": ["sony-game", "microsoft-game", "nintendo", "steam-deck", "asus-game",
                 "lenovo-game", "msi-game", "ayaneo", "razer-game", "onexplayer", "logitech-game"],
    "gpus": ["rtx-", "gtx-", "quadro", "titan-graphics", "nvidia", "amd", "intel", "apple-graphics"],
    "cameras": ["gopro", "nikon", "canon", "sony-camera", "leica", "fujifilm", "panasonic-camera", "olympus", "dji-camera"],
    "audio": ["apple-audio", "bose", "sonos", "sony-audio", "jbl"],
    "drones": ["dji-drone"],
    "vr": ["apple-vr", "meta-vr", "meta-quest", "ray-ban-meta", "vr"],
    "monitors": ["apple-monitor", "lg-monitor"],
}

def normalize_storage(label):
    label = label.lower().strip().replace(" ssd", "").replace(" ", "")
    if "tb" in label:
        num = re.search(r"(\d+)", label)
        return f"{num.group(1)}tb" if num else label
    num = re.search(r"(\d+)", label)
    return num.group(1) if num else label

def get_category(series):
    for cat, patterns in CATEGORY_PATTERNS.items():
        for pat in patterns:
            if pat in series:
                return cat
    return "other"

def get_discount(series):
    return IPHONE_DISCOUNT if series in IPHONE_SERIES else DEFAULT_DISCOUNT

# ========== DISCOVERY ==========
def discover_from_sitemap():
    """Fetch IWM sitemap and extract all /sell/ URLs."""
    print("Fetching sitemap...")
    devices = {}  # { "series/model": { series, model, url, category } }

    for sitemap_url in [
        "https://www.itsworthmore.com/sitemap.xml",
        "https://www.itsworthmore.com/sitemap-main.xml",
    ]:
        try:
            req = Request(sitemap_url, headers={"User-Agent": UA})
            resp = urlopen(req, timeout=15)
            xml_data = resp.read().decode()

            # Handle sitemap index (links to other sitemaps)
            root = ET.fromstring(xml_data)
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

            # Check if it's a sitemap index
            sub_sitemaps = root.findall(".//sm:sitemap/sm:loc", ns)
            if sub_sitemaps:
                for sub in sub_sitemaps:
                    sub_url = sub.text.strip()
                    try:
                        req2 = Request(sub_url, headers={"User-Agent": UA})
                        resp2 = urlopen(req2, timeout=15)
                        xml2 = resp2.read().decode()
                        root2 = ET.fromstring(xml2)
                        for loc in root2.findall(".//sm:url/sm:loc", ns):
                            url = loc.text.strip()
                            _add_sell_url(devices, url)
                    except:
                        pass
            else:
                for loc in root.findall(".//sm:url/sm:loc", ns):
                    url = loc.text.strip()
                    _add_sell_url(devices, url)
        except Exception as e:
            print(f"  Failed to fetch {sitemap_url}: {e}")

    # Also try scraping the /sell page directly for categories
    try:
        req = Request("https://www.itsworthmore.com/sell", headers={"User-Agent": UA})
        resp = urlopen(req, timeout=15)
        html = resp.read().decode()
        # Find /sell/xxx/yyy patterns
        for m in re.finditer(r'href="/sell/([^"]+)/([^"]+)"', html):
            series, model = m.group(1), m.group(2)
            key = f"{series}/{model}"
            if key not in devices:
                devices[key] = {
                    "series": series, "model": model,
                    "url": f"https://www.itsworthmore.com/sell/{series}/{model}",
                    "category": get_category(series),
                }
    except:
        pass

    print(f"Discovered {len(devices)} devices")

    # Save catalog
    catalog = {"devices": list(devices.values()), "discovered_at": time.strftime("%Y-%m-%d %H:%M")}
    with open(CATALOG_FILE, "w") as f:
        json.dump(catalog, f, indent=2)
    print(f"Saved to {CATALOG_FILE}")

    # Print summary
    by_cat = {}
    for d in devices.values():
        by_cat.setdefault(d["category"], []).append(d)
    for cat in sorted(by_cat):
        print(f"  {cat:12s}: {len(by_cat[cat])} devices")

    return catalog

def _add_sell_url(devices, url):
    m = re.match(r"https?://www\.itsworthmore\.com/sell/([^/]+)/([^/]+)/?$", url)
    if m:
        series, model = m.group(1), m.group(2)
        key = f"{series}/{model}"
        if key not in devices:
            devices[key] = {
                "series": series, "model": model,
                "url": url,
                "category": get_category(series),
            }

# ========== QUIZ HELPERS ==========
def read_options(pg):
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

def click(pg, pref):
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
        if (pref === '__FIRST__') { chosen = kids[0]; }
        else if (pref === '__LAST__') { chosen = kids[kids.length - 1]; }
        else { chosen = kids.find(k => (k.innerText || '').toLowerCase().includes(pref.toLowerCase())); }
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
            if 5 <= v <= 15000:
                return v
    return None

def classify_step(opts):
    joined = " ".join(opts).lower()
    if any(c in joined for c in ["brand new", "flawless", "broken", "damaged"]):
        return "condition"
    if any(c in joined for c in ["at&t", "unlocked", "verizon", "t-mobile", "sprint"]):
        return "carrier"
    chip_words = ["m1 ", "m2 ", "m3 ", "m4 ", "m5 ", "core cpu", "core gpu", "intel",
                  "a18", "snapdragon", "ryzen", "i5", "i7", "i9"]
    if any(c in joined for c in chip_words) and "gb" not in joined and "tb" not in joined:
        return "chip"
    if "tb" in joined:
        return "storage"
    if "gb" in joined:
        nums = [int(x) for x in re.findall(r"(\d+)\s*gb", joined)]
        if nums and max(nums) <= 192:
            return "ram"
        return "storage"
    if any(c in joined for c in ["80%", "battery", "cycle", "health"]):
        return "battery"
    if any(c in joined for c in ["charger", "adapter", "power cable"]):
        return "accessory"
    if any(c in joined for c in ["nano", "standard glass", "coating"]):
        return "screen"
    if any(c in joined for c in ["disc drive", "digital edition", "disc version"]):
        return "variant"
    if any(c in joined for c in ["controller", "joy-con", "dock"]):
        return "accessory"
    if any(c in joined for c in ["gps", "cellular", "wi-fi", "wifi", "lte"]):
        return "connectivity"
    stripped = {o.strip().lower() for o in opts}
    if stripped <= {"yes", "no"} or stripped <= {"yes", "no", "n/a"}:
        return "yesno"
    return "other"

def discover_device_options(pg, series, model):
    """Walk quiz once to discover all available options."""
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except:
        return None
    pg.wait_for_timeout(1500)

    found = {"conditions": [], "storage": [], "carriers": [], "steps": []}

    for i in range(15):
        opts = read_options(pg)
        if not opts:
            break
        step = classify_step(opts)
        found["steps"].append({"type": step, "options": opts})

        if step == "condition":
            found["conditions"] = opts
        elif step == "storage":
            found["storage"] = opts
        elif step == "carrier":
            found["carriers"] = opts

        click(pg, "__FIRST__")
        pg.wait_for_timeout(400)
        click_next(pg)
        pg.wait_for_timeout(800)

    return found

def walk_quiz(pg, series, model, condition, storage=None):
    """Walk quiz for a specific condition + storage. Returns IWM price."""
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except:
        return None
    pg.wait_for_timeout(1500)

    for i in range(15):
        opts = read_options(pg)
        if not opts:
            break

        step = classify_step(opts)

        if step == "condition":
            click(pg, condition)
        elif step == "carrier":
            click(pg, "Unlocked")
        elif step == "storage":
            click(pg, storage if storage else "__FIRST__")
        elif step in ("chip", "ram"):
            click(pg, "__FIRST__")  # Base config
        elif step == "connectivity":
            click(pg, "Wi-Fi")  # Base WiFi
        elif step == "battery":
            click(pg, "80")
        elif step in ("accessory", "yesno"):
            click(pg, "Yes")
        elif step == "screen":
            click(pg, "Standard")
        elif step == "variant":
            click(pg, "__FIRST__")
        else:
            click(pg, "__FIRST__")

        pg.wait_for_timeout(400)
        click_next(pg)
        pg.wait_for_timeout(800)

    pg.wait_for_timeout(1200)
    return grab_price(pg)

# ========== SCRAPE ==========
def load_prices():
    if os.path.exists(PRICES_FILE):
        with open(PRICES_FILE) as f:
            return json.load(f)
    return {}

def save_prices(prices):
    with open(PRICES_FILE, "w") as f:
        json.dump(prices, f, indent=2)

def scrape_devices(category_filter=None):
    """Scrape all devices (or filtered category)."""
    if not os.path.exists(CATALOG_FILE):
        print("No catalog found. Run: python3 scrape-all.py discover")
        return

    catalog = json.load(open(CATALOG_FILE))
    devices = catalog["devices"]

    if category_filter:
        devices = [d for d in devices if d["category"] == category_filter]

    prices = load_prices()
    total = len(devices)
    done = sum(1 for d in devices if f"{d['series']}/{d['model']}" in prices)
    print(f"=== SCRAPING {category_filter or 'ALL'}: {total} devices, {done} already done ===\n")

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA)
        pg = ctx.new_page()

        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            pg.click('button:has-text("Accept")', timeout=3000)
        except:
            pass

        for idx, device in enumerate(devices):
            series = device["series"]
            model = device["model"]
            key = f"{series}/{model}"

            if key in prices:
                continue

            discount = get_discount(series)
            pct = round(discount * 100)
            print(f"\n[{idx+1}/{total}] {model} ({series}) — {pct}% below IWM")

            # Discover options
            info = discover_device_options(pg, series, model)
            if not info:
                print(f"  SKIP: could not load page")
                prices[key] = {"error": "page_load_failed"}
                save_prices(prices)
                continue

            conditions = info["conditions"] or ["Flawless", "Good", "Fair"]
            storages = info["storage"] or ["default"]

            print(f"  Conditions: {[c[:15] for c in conditions]}")
            print(f"  Storage: {storages}")

            device_prices = {}

            for storage_label in storages:
                sid = normalize_storage(storage_label) if storage_label != "default" else "base"
                if sid not in device_prices:
                    device_prices[sid] = {}

                for cond_name in ALL_CONDITIONS:
                    # Skip conditions IWM doesn't offer for this device
                    if not any(cond_name.lower() in c.lower() for c in conditions):
                        continue

                    cond_id = COND_MAP.get(cond_name.lower(), cond_name.lower().replace(" ", ""))
                    storage_pref = storage_label if storage_label != "default" else None

                    iwm_price = walk_quiz(pg, series, model, cond_name, storage_pref)

                    if iwm_price:
                        our_price = round(iwm_price * (1 - discount))
                        device_prices[sid][cond_id] = our_price
                        print(f"  {cond_name:12s} {storage_label:12s} IWM=${iwm_price:5d} ours=${our_price:5d}")
                    else:
                        print(f"  {cond_name:12s} {storage_label:12s} FAILED")

                    time.sleep(RATE_LIMIT)

            # Estimate broken (50% of mint) if we got mint data
            for sid in device_prices:
                if "mint" in device_prices[sid] and "broken" not in device_prices[sid]:
                    device_prices[sid]["broken"] = round(device_prices[sid]["mint"] * 0.50)

            prices[key] = {
                "category": device["category"],
                "series": series,
                "model": model,
                "prices": device_prices,
                "scraped_at": time.strftime("%Y-%m-%d %H:%M"),
            }
            save_prices(prices)

        b.close()

    done_now = sum(1 for d in devices if f"{d['series']}/{d['model']}" in prices)
    print(f"\n=== DONE: {done_now}/{total} devices scraped ===")

# ========== STATUS ==========
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
        by_cat.setdefault(cat, {"total": 0, "done": 0})
        by_cat[cat]["total"] += 1
        if key in prices:
            by_cat[cat]["done"] += 1

    total = sum(v["total"] for v in by_cat.values())
    done = sum(v["done"] for v in by_cat.values())

    print(f"=== SCRAPE STATUS ({done}/{total} devices) ===\n")
    for cat in sorted(by_cat):
        t, d = by_cat[cat]["total"], by_cat[cat]["done"]
        bar = "█" * d + "░" * (t - d)
        pct = round(d / t * 100) if t else 0
        print(f"  {cat:12s} {d:3d}/{t:3d} [{bar[:30]}] {pct}%")

# ========== EXPORT ==========
def export_price_table():
    """Export scraped prices as TypeScript PRICE_TABLE for page.tsx."""
    prices = load_prices()
    if not prices:
        print("No prices scraped yet.")
        return

    # Build the table: { our_device_id: { storage_id: { condition_id: price } } }
    # We need to map IWM model slugs to our device IDs
    # For now, create a clean model ID from the slug
    table = {}
    for key, data in prices.items():
        if "error" in data or "prices" not in data:
            continue

        model_slug = data["model"]
        device_prices = data["prices"]

        if not device_prices:
            continue

        table[model_slug] = device_prices

    # Save as JSON
    out_json = os.path.join(ROOT, "price-table-all.json")
    with open(out_json, "w") as f:
        json.dump(table, f, indent=2)

    # Save as TypeScript
    ts_lines = ["const PRICE_TABLE: Record<string, Record<string, Record<string, number>>> = {"]
    for mid in sorted(table.keys()):
        ts_lines.append(f'  "{mid}": {{')
        for sid in sorted(table[mid].keys()):
            conds = table[mid][sid]
            if not isinstance(conds, dict):
                continue
            pairs = ", ".join(f'{c}: {p}' for c, p in sorted(conds.items()))
            ts_lines.append(f'    "{sid}": {{ {pairs} }},')
        ts_lines.append('  },')
    ts_lines.append("};")

    ts_path = os.path.join(ROOT, "price-table-all.ts")
    with open(ts_path, "w") as f:
        f.write("\n".join(ts_lines) + "\n")

    print(f"Exported {len(table)} devices")
    print(f"  JSON: {out_json}")
    print(f"  TypeScript: {ts_path}")

# ========== CLI ==========
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd == "discover":
        discover_from_sitemap()
    elif cmd == "scrape":
        cat = sys.argv[2] if len(sys.argv) > 2 else None
        scrape_devices(cat)
    elif cmd == "status":
        show_status()
    elif cmd == "export":
        export_price_table()
    else:
        print("""
Universal IWM Scraper — discover and scrape ALL devices

  python3 scrape-all.py discover        # Find all devices from IWM sitemap
  python3 scrape-all.py scrape          # Scrape everything (resume-safe)
  python3 scrape-all.py scrape phones   # Just phones
  python3 scrape-all.py scrape tablets  # Just tablets
  python3 scrape-all.py scrape laptops  # Just laptops
  python3 scrape-all.py scrape consoles # Just consoles
  python3 scrape-all.py scrape watches  # Just watches
  python3 scrape-all.py scrape gpus     # Just GPUs
  python3 scrape-all.py status          # Show progress
  python3 scrape-all.py export          # Output price table for site

Categories: phones, tablets, laptops, desktops, watches, consoles, gpus, cameras, audio, drones, vr, monitors
""")
