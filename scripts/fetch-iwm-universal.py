#!/usr/bin/env python3
"""Universal IWM scraper — prices, images, storage tiers, all conditions.
Handles: Samsung phones, iPhones, MacBooks, iPads, laptops.
Adapts quiz flow per device type.

Scrapes:
  - Prices for every condition x carrier x storage combo
  - Product images (800x800)
  - Available storage tiers
  - Available conditions
  - Available carriers

Usage:
  python3 fetch-iwm-universal.py samsung
  python3 fetch-iwm-universal.py macbook
  python3 fetch-iwm-universal.py iphone
  python3 fetch-iwm-universal.py ipad
  python3 fetch-iwm-universal.py debug <series> <model>
  python3 fetch-iwm-universal.py analyze
"""
import sys, re, json, os, time, urllib.request
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
DOLLAR = re.compile(r"\$\s*([0-9]+(?:,[0-9]{3})*)(?!\d)")
DISCOUNT = 20
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

# ========== TARGETS ==========
TARGETS = {
    "samsung": [
        ("galaxy-z-fold-series", "galaxy-z-trifold", "gztrifold"),
        ("galaxy-z-fold-series", "galaxy-z-fold-7", "gzfold7"),
        ("galaxy-z-fold-series", "galaxy-z-fold-6", "gzfold6"),
        ("galaxy-z-fold-series", "galaxy-z-fold-5", "gzfold5"),
        ("galaxy-z-fold-series", "galaxy-z-fold-4", "gzfold4"),
        ("galaxy-z-fold-series", "galaxy-z-fold-3-5g", "gzfold3"),
        ("galaxy-z-fold-series", "galaxy-z-flip-7", "gzflip7"),
        ("galaxy-z-fold-series", "galaxy-z-flip-6", "gzflip6"),
        ("galaxy-z-fold-series", "galaxy-z-flip5", "gzflip5"),
        ("galaxy-z-fold-series", "galaxy-z-flip4", "gzflip4"),
        ("galaxy-z-fold-series", "galaxy-z-flip3-5g", "gzflip3"),
        ("galaxy-s-series", "galaxy-s26-ultra", "gs26u"),
        ("galaxy-s-series", "galaxy-s26-plus", "gs26p"),
        ("galaxy-s-series", "galaxy-s26", "gs26"),
        ("galaxy-s-series", "galaxy-s25-ultra", "gs25u"),
        ("galaxy-s-series", "galaxy-s25-plus", "gs25p"),
        ("galaxy-s-series", "galaxy-s25", "gs25"),
        ("galaxy-s-series", "galaxy-s24-ultra", "gs24u"),
        ("galaxy-s-series", "galaxy-s24-plus", "gs24p"),
        ("galaxy-s-series", "galaxy-s24", "gs24"),
        ("galaxy-s-series", "galaxy-s23-ultra", "gs23u"),
        ("galaxy-s-series", "galaxy-s23-plus", "gs23p"),
        ("galaxy-s-series", "galaxy-s23", "gs23"),
        ("galaxy-s-series", "galaxy-s22-ultra-5g", "gs22u"),
        ("galaxy-s-series", "galaxy-s22-5g", "gs22"),
        ("galaxy-s-series", "galaxy-s21-ultra-5g", "gs21u"),
        ("galaxy-s-series", "galaxy-s21-5g", "gs21"),
        ("galaxy-s-series", "galaxy-s20-ultra-5g", "gs20u"),
        ("galaxy-s-series", "galaxy-s20-5g", "gs20"),
        ("galaxy-note-series", "galaxy-note-20-ultra-5g", "gnote20u"),
        ("galaxy-note-series", "galaxy-note-20-5g", "gnote20"),
        ("galaxy-note-series", "galaxy-note-10-plus", "gnote10p"),
        ("galaxy-note-series", "galaxy-note-10", "gnote10"),
    ],
    "macbook": [
        ("macbook-pro", "macbook-pro-16-inch-m4-max-2024", "mbp16m4max"),
        ("macbook-pro", "macbook-pro-16-inch-m4-pro-2024", "mbp16m4pro"),
        ("macbook-pro", "macbook-pro-14-inch-m4-2024", "mbp14m4"),
        ("macbook-pro", "macbook-pro-16-inch-m3-max-2023", "mbp16m3max"),
        ("macbook-pro", "macbook-pro-16-inch-m3-pro-2023", "mbp16m3pro"),
        ("macbook-pro", "macbook-pro-14-inch-m3-2023", "mbp14m3"),
        ("macbook-pro", "macbook-pro-16-inch-m2-max-2023", "mbp16m2max"),
        ("macbook-pro", "macbook-pro-16-inch-m2-pro-2023", "mbp16m2pro"),
        ("macbook-pro", "macbook-pro-13-inch-m2-2022", "mbp13m2"),
        ("macbook-pro", "macbook-pro-16-inch-m1-pro-2021", "mbp16m1pro"),
        ("macbook-pro", "macbook-pro-14-inch-m1-pro-2021", "mbp14m1pro"),
        ("macbook-air", "macbook-air-15-inch-m4-2025", "mba15m4"),
        ("macbook-air", "macbook-air-13-inch-m4-2025", "mba13m4"),
        ("macbook-air", "macbook-air-15-inch-m3-2024", "mba15m3"),
        ("macbook-air", "macbook-air-13-inch-m3-2024", "mba13m3"),
        ("macbook-air", "macbook-air-15-inch-m2-2023", "mba15m2"),
        ("macbook-air", "macbook-air-m2-2022", "mba13m2"),
        ("macbook-air", "macbook-air-m1-2020", "mba13m1"),
    ],
    "iphone": [
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
    ],
    "ipad": [
        ("ipad", "ipad-pro-13-inch-m4-2024", "ipadpro13m4"),
        ("ipad", "ipad-pro-11-inch-m4-2024", "ipadpro11m4"),
        ("ipad", "ipad-air-13-inch-m2-2024", "ipadair13m2"),
        ("ipad", "ipad-air-11-inch-m2-2024", "ipadair11m2"),
        ("ipad", "ipad-10th-generation-2022", "ipad10"),
        ("ipad", "ipad-9th-generation-2021", "ipad9"),
        ("ipad", "ipad-mini-7th-generation-a17-pro-2024", "ipadmini7"),
        ("ipad", "ipad-mini-6th-generation-2021", "ipadmini6"),
    ],
}

HAS_CARRIER = {"samsung": True, "iphone": True, "macbook": False, "ipad": True}
CONDITIONS = ["Flawless", "Good", "Fair"]
PHONE_CARRIERS = ["Unlocked", "AT&T"]
NO_CARRIER = ["N/A"]

# ========== PRICE GRABBER (uses Powerhouse's h3.your-offer selector) ==========
def grab_price(pg):
    """Grab actual quiz result from h3.your-offer, not promo banners."""
    direct = pg.evaluate("""() => {
        const candidates = [
            'section#product-pricing-ctrl h3.your-offer strong',
            'h3.your-offer strong',
            '.pricing-form-final-offer .your-offer strong',
            '.your-offer strong',
        ];
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            const t = (el.innerText || '').trim();
            if (t) return t;
        }
        return '';
    }""")
    if direct:
        m = DOLLAR.search(direct)
        if m:
            try:
                v = int(m.group(1).replace(",", ""))
                if v >= 5 and v <= 6000:
                    return v
            except:
                pass

    # Fallback: filtered DOM walk skipping hidden elements
    text = pg.evaluate("""() => {
        const banner = document.querySelector('.banner-coupon-v2, .banner-coupon, .banner-coupon-desktop');
        const ignore = new Set(['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER']);
        const hiddenAncestor = (el) => {
            let cur = el && el.parentElement;
            while (cur) {
                if (cur.classList && (cur.classList.contains('ng-hide') || cur.classList.contains('reveal-modal'))) return true;
                try {
                    const cs = window.getComputedStyle(cur);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
                } catch(e) {}
                cur = cur.parentElement;
            }
            return false;
        };
        let out = '';
        const walk = (el) => {
            if (!el) return;
            if (ignore.has(el.tagName)) return;
            if (banner && (banner === el || banner.contains(el))) return;
            if (el.nodeType === 3) {
                if (!hiddenAncestor(el)) out += el.textContent || '';
                return;
            }
            if (el.nodeType === 1) {
                if (el.classList && (el.classList.contains('ng-hide') || el.classList.contains('reveal-modal'))) return;
                try {
                    const cs = window.getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return;
                } catch(e) {}
            }
            for (const c of el.childNodes) walk(c);
        };
        walk(document.body);
        return out;
    }""")
    matches = DOLLAR.findall(text)
    vals = [int(m.replace(",", "")) for m in matches]
    vals = [v for v in vals if 5 <= v <= 6000]
    return max(vals) if vals else None

# ========== IMAGE GRABBER ==========
def grab_image_url(pg):
    """Grab the main product image URL from the page."""
    return pg.evaluate("""() => {
        // Look for the product image specifically
        const imgs = Array.from(document.querySelectorAll('img'));
        // IWM product images are usually in a specific container
        for (const img of imgs) {
            const src = img.src || img.getAttribute('data-src') || '';
            if (!src) continue;
            // Skip tiny icons, logos, badges
            if (img.width < 80 || img.height < 80) continue;
            if (src.includes('logo') || src.includes('icon') || src.includes('badge')) continue;
            if (src.includes('banner') || src.includes('promo')) continue;
            // Product images usually have product name or device in path
            if (src.includes('/products/') || src.includes('/devices/') ||
                src.includes('/uploads/') || src.includes('galaxy') ||
                src.includes('iphone') || src.includes('macbook') ||
                src.includes('ipad') || img.width >= 200) {
                return src;
            }
        }
        // Fallback: largest non-logo image
        let best = null, bestArea = 0;
        for (const img of imgs) {
            const a = (img.naturalWidth || img.width) * (img.naturalHeight || img.height);
            const src = img.src || '';
            if (a > bestArea && !src.includes('logo') && !src.includes('banner') && a > 10000) {
                best = src;
                bestArea = a;
            }
        }
        return best;
    }""")

def download_image(url, filename):
    """Download image to public/devices/ folder."""
    if not url:
        return False
    outdir = os.path.join(ROOT, "public", "devices")
    os.makedirs(outdir, exist_ok=True)
    outpath = os.path.join(outdir, filename)
    if os.path.exists(outpath):
        return True  # already downloaded
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        with open(outpath, "wb") as f:
            f.write(data)
        return True
    except:
        return False

# ========== QUIZ OPTIONS READER ==========
def read_quiz_options(pg):
    """Read all available options at current quiz step."""
    return pg.evaluate("""() => {
        const wrap = Array.from(document.querySelectorAll('.answers')).find(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        });
        if (!wrap) return null;
        const cls = wrap.className || '';
        const kids = Array.from(wrap.children).filter(c => {
            if (c.classList.contains('ng-hide')) return false;
            return (c.innerText || '').trim();
        });
        return {
            cls: cls,
            type: cls.includes('condition') ? 'condition' :
                  cls.includes('carrier') ? 'carrier' :
                  cls.includes('storage') ? 'storage' : 'unknown',
            options: kids.map(k => (k.innerText || '').trim().slice(0, 50))
        };
    }""")

def click_quiz_option(pg, prefs):
    """Click a quiz option matching preferences."""
    return pg.evaluate("""([prefList]) => {
        const wrap = Array.from(document.querySelectorAll('.answers')).find(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && el.children.length > 0;
        });
        if (!wrap) return {ok: false};
        const kids = Array.from(wrap.children).filter(c => {
            if (c.classList.contains('ng-hide')) return false;
            const txt = (c.innerText || '').trim();
            return txt && c.getAttribute('ng-click');
        });
        if (!kids.length) return {ok: false};
        let chosen = null;
        for (const pref of prefList) {
            chosen = kids.find(k => (k.innerText || '').toLowerCase().includes(pref.toLowerCase()));
            if (chosen) break;
        }
        if (!chosen) chosen = kids[kids.length - 1];
        chosen.click();
        return {ok: true, clicked: (chosen.innerText || '').slice(0, 40)};
    }""", [prefs])

def click_next(pg):
    pg.evaluate("""() => {
        const next = Array.from(document.querySelectorAll('button')).find(b => {
            const t = (b.innerText || '').trim().toLowerCase();
            return (t === 'next step' || t === 'next' || t === 'continue') && b.getBoundingClientRect().width > 0;
        });
        if (next) next.click();
    }""")

# ========== DISCOVERY: find available options for a device ==========
def discover_device(pg, series, model):
    """Visit device page and discover all available conditions, carriers, storage."""
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except:
        return None
    pg.wait_for_timeout(1500)

    image_url = grab_image_url(pg)
    discovered = {"conditions": [], "carriers": [], "storage": [], "image": image_url}

    for i in range(10):
        opts = read_quiz_options(pg)
        if not opts:
            break

        if opts["type"] == "condition" or "condition" in opts["cls"].lower():
            discovered["conditions"] = opts["options"]
        elif opts["type"] == "carrier" or any(c in " ".join(opts["options"]).lower() for c in ["at&t", "unlocked", "verizon", "t-mobile"]):
            discovered["carriers"] = opts["options"]
        elif opts["type"] == "storage" or any(c in " ".join(opts["options"]).lower() for c in ["gb", "tb"]):
            discovered["storage"] = opts["options"]

        # Click through (pick first option just to advance)
        click_quiz_option(pg, ["Flawless", "Unlocked", "No"])
        pg.wait_for_timeout(400)
        click_next(pg)
        pg.wait_for_timeout(800)

    return discovered

# ========== WALK QUIZ FOR SPECIFIC CONFIG ==========
def walk_quiz(pg, series, model, condition="Flawless", carrier="Unlocked", storage=None):
    """Walk quiz for specific condition/carrier/storage combo. Return price."""
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except:
        return None
    pg.wait_for_timeout(1500)

    carrier_prefs = ["Unlocked", "No"] if carrier in ["Unlocked", "N/A"] else [carrier]
    storage_prefs = [storage] if storage else []

    for i in range(10):
        opts = read_quiz_options(pg)
        if not opts:
            break

        # Pick prefs based on question type
        if "condition" in opts["cls"].lower():
            prefs = [condition]
        elif any(c in " ".join(opts["options"]).lower() for c in ["at&t", "unlocked", "verizon"]):
            prefs = carrier_prefs
        elif any(c in " ".join(opts["options"]).lower() for c in ["gb", "tb"]):
            prefs = storage_prefs if storage_prefs else []  # empty = pick last (highest)
        else:
            prefs = [condition] + carrier_prefs

        click_quiz_option(pg, prefs)
        pg.wait_for_timeout(400)
        click_next(pg)
        pg.wait_for_timeout(800)

    pg.wait_for_timeout(1200)
    return grab_price(pg)

# ========== FULL SCRAPE ==========
def scrape_category(category, download_images=True):
    targets = TARGETS.get(category, [])
    if not targets:
        print(f"Unknown: {category}. Available: {', '.join(TARGETS.keys())}")
        return

    has_carrier = HAS_CARRIER.get(category, True)
    carriers = PHONE_CARRIERS if has_carrier else NO_CARRIER

    print(f"=== SCRAPING {category.upper()} ({len(targets)} models) ===\n")

    results = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA)
        pg = ctx.new_page()

        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            pg.click('button:has-text("Accept")', timeout=3000)
        except:
            pass

        for series, model, mid in targets:
            print(f"\n--- {model} ({mid}) ---")

            # Step 1: Discover available options
            info = discover_device(pg, series, model)
            if not info:
                print(f"  FAIL: could not load page")
                continue

            print(f"  Conditions: {info['conditions']}")
            print(f"  Carriers: {info['carriers']}")
            print(f"  Storage: {info['storage']}")
            if info['image']:
                print(f"  Image: {info['image'][:60]}...")

            # Step 2: Download image
            if download_images and info["image"]:
                ext = "webp" if "webp" in info["image"] else "png" if "png" in info["image"] else "jpg"
                img_file = f"{mid}.{ext}"
                if download_image(info["image"], img_file):
                    print(f"  Image saved: devices/{img_file}")

            # Step 3: Scrape prices for each combo
            entry = {
                "id": mid, "model": model, "series": series,
                "image": info["image"],
                "available_conditions": info["conditions"],
                "available_carriers": info["carriers"],
                "available_storage": info["storage"],
                "prices": {}
            }

            use_conditions = [c for c in CONDITIONS if any(c.lower() in o.lower() for o in info["conditions"])] or CONDITIONS

            for cond in use_conditions:
                for carr in carriers:
                    try:
                        price = walk_quiz(pg, series, model, condition=cond, carrier=carr)
                    except Exception as e:
                        price = None

                    if price:
                        our_price = max(0, price - DISCOUNT)
                        key = f"{cond.lower()}_{carr.lower().replace(' ', '_').replace('&', 'and')}"
                        entry["prices"][key] = {"iwm": price, "ours": our_price}
                        print(f"  {cond:10} {carr:10} IWM=${price:5d} ours=${our_price:5d}")
                    else:
                        print(f"  {cond:10} {carr:10} FAILED")

            results.append(entry)

        b.close()

    # Save
    outfile = f"{category}-prices-full.json"
    with open(outfile, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved {len(results)} models to {outfile}")
    return results

# ========== ANALYZE ==========
def analyze():
    """Analyze pricing patterns from all saved data."""
    files = [f for f in os.listdir('.') if f.endswith('-prices-full.json') or f.endswith('-prices.json')]
    all_data = []
    for f in files:
        with open(f) as fh:
            all_data.extend(json.load(fh))

    if not all_data:
        print("No data files found. Run scraper first.")
        return

    print(f"=== PRICING ANALYSIS ({len(all_data)} models) ===\n")

    good_ratios = []
    fair_ratios = []
    lock_ratios = []

    for entry in all_data:
        p = entry.get("prices", {})
        fl_u = p.get("flawless_unlocked", p.get("flawless_n/a", {})).get("iwm")
        gd_u = p.get("good_unlocked", p.get("good_n/a", {})).get("iwm")
        fr_u = p.get("fair_unlocked", p.get("fair_n/a", {})).get("iwm")
        fl_l = p.get("flawless_atandt", p.get("flawless_at&t", {})).get("iwm")

        if fl_u and gd_u and fl_u > 50:
            good_ratios.append(gd_u / fl_u)
        if fl_u and fr_u and fl_u > 50:
            fair_ratios.append(fr_u / fl_u)
        if fl_u and fl_l and fl_u > 50:
            lock_ratios.append(fl_l / fl_u)

    print("IWM PRICING RULES:\n")
    if good_ratios:
        avg = sum(good_ratios) / len(good_ratios)
        print(f"  Good = Flawless × {avg:.3f}  (avg from {len(good_ratios)} models)")
        print(f"    Range: {min(good_ratios):.3f} — {max(good_ratios):.3f}")
    if fair_ratios:
        avg = sum(fair_ratios) / len(fair_ratios)
        print(f"  Fair = Flawless × {avg:.3f}  (avg from {len(fair_ratios)} models)")
        print(f"    Range: {min(fair_ratios):.3f} — {max(fair_ratios):.3f}")
    if lock_ratios:
        avg = sum(lock_ratios) / len(lock_ratios)
        print(f"  Locked = Unlocked × {avg:.3f}  (avg from {len(lock_ratios)} models)")
        print(f"    Range: {min(lock_ratios):.3f} — {max(lock_ratios):.3f}")

    print("\n=== OUR PRICING FORMULA ===")
    g = sum(good_ratios) / len(good_ratios) if good_ratios else 0.93
    f = sum(fair_ratios) / len(fair_ratios) if fair_ratios else 0.73
    l = sum(lock_ratios) / len(lock_ratios) if lock_ratios else 0.83
    print(f"  base = IWM_flawless_unlocked - ${DISCOUNT}")
    print(f"  good = base × {g:.2f}")
    print(f"  fair = base × {f:.2f}")
    print(f"  locked = price × {l:.2f}")

# ========== CLI ==========
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd in TARGETS:
        scrape_category(cmd)
    elif cmd == "all":
        for cat in TARGETS:
            scrape_category(cat)
        analyze()
    elif cmd == "analyze":
        analyze()
    elif cmd == "debug":
        series = sys.argv[2] if len(sys.argv) > 2 else "galaxy-s-series"
        model = sys.argv[3] if len(sys.argv) > 3 else "galaxy-s24-ultra"
        with sync_playwright() as p:
            b = p.chromium.launch(headless=False, args=["--no-sandbox"], slow_mo=300)
            ctx = b.new_context(user_agent=UA)
            pg = ctx.new_page()
            try:
                pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
                pg.click('button:has-text("Accept")', timeout=3000)
            except: pass
            info = discover_device(pg, series, model)
            print(f"\nDiscovered: {json.dumps(info, indent=2)}")
            for cond in CONDITIONS:
                for carr in ["Unlocked", "AT&T"]:
                    price = walk_quiz(pg, series, model, condition=cond, carrier=carr)
                    our = max(0, price - DISCOUNT) if price else None
                    print(f"  {cond:10} {carr:10} IWM=${price} ours=${our}")
            b.close()
    else:
        print("""
Universal IWM Scraper — Prices + Images + Storage + Conditions

  python3 fetch-iwm-universal.py samsung    # Samsung phones
  python3 fetch-iwm-universal.py macbook    # MacBooks
  python3 fetch-iwm-universal.py iphone     # iPhones
  python3 fetch-iwm-universal.py ipad       # iPads
  python3 fetch-iwm-universal.py all        # Everything
  python3 fetch-iwm-universal.py analyze    # Analyze pricing rules
  python3 fetch-iwm-universal.py debug <series> <model>  # Debug (visible browser)
""")
