#!/usr/bin/env python3
"""Scrape eBay sold-listings for every priced device in PRICE_TABLE.

Captures completed-listing prices from the last ~90 days. Used as a
margin reference alongside Atlas wholesale: eBay is the actual final
sale price (whatever buyers actually paid), Atlas is what we'd get if
we sell to them wholesale. eBay typically pays more (private sale
premium) but with fees + shipping + return risk.

Output: public/comps/ebay-sold.json keyed by our model id, with
per-storage aggregates (count, min/max/median/mean, sample titles).

Run:
  python3 scripts/scrape-ebay-sold.py                  # full catalog
  python3 scripts/scrape-ebay-sold.py --only ip17pm    # one model
  python3 scripts/scrape-ebay-sold.py --category iphone # one family
  python3 scripts/scrape-ebay-sold.py --limit 5        # first N models
"""
from __future__ import annotations
import argparse, json, re, sys, time, statistics
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.parent
PRICES_TS = ROOT / "app" / "data" / "prices.ts"
OUT = ROOT / "public" / "comps" / "ebay-sold.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"

# Map model_id → (search_label, family, accessory_filter_words, sibling_disambig)
# search_label is what we'd type into eBay search ("iPhone 17 Pro Max").
# family is a phrase that MUST appear in the listing title to match.
LABEL_MAP = {
    # iPhones
    "ip11":     ("iPhone 11",          "iphone 11"),
    "ip11p":    ("iPhone 11 Pro",      "iphone 11 pro"),
    "ip11pm":   ("iPhone 11 Pro Max",  "iphone 11 pro max"),
    "ip12mini": ("iPhone 12 mini",     "iphone 12 mini"),
    "ip12":     ("iPhone 12",          "iphone 12"),
    "ip12p":    ("iPhone 12 Pro",      "iphone 12 pro"),
    "ip12pm":   ("iPhone 12 Pro Max",  "iphone 12 pro max"),
    "ip13mini": ("iPhone 13 mini",     "iphone 13 mini"),
    "ip13":     ("iPhone 13",          "iphone 13"),
    "ip13p":    ("iPhone 13 Pro",      "iphone 13 pro"),
    "ip13pm":   ("iPhone 13 Pro Max",  "iphone 13 pro max"),
    "ip14":     ("iPhone 14",          "iphone 14"),
    "ip14plus": ("iPhone 14 Plus",     "iphone 14 plus"),
    "ip14p":    ("iPhone 14 Pro",      "iphone 14 pro"),
    "ip14pm":   ("iPhone 14 Pro Max",  "iphone 14 pro max"),
    "ip15":     ("iPhone 15",          "iphone 15"),
    "ip15plus": ("iPhone 15 Plus",     "iphone 15 plus"),
    "ip15p":    ("iPhone 15 Pro",      "iphone 15 pro"),
    "ip15pm":   ("iPhone 15 Pro Max",  "iphone 15 pro max"),
    "ip16":     ("iPhone 16",          "iphone 16"),
    "ip16e":    ("iPhone 16e",         "iphone 16e"),
    "ip16plus": ("iPhone 16 Plus",     "iphone 16 plus"),
    "ip16p":    ("iPhone 16 Pro",      "iphone 16 pro"),
    "ip16pm":   ("iPhone 16 Pro Max",  "iphone 16 pro max"),
    "ip17":     ("iPhone 17",          "iphone 17"),
    "ip17e":    ("iPhone 17e",         "iphone 17e"),
    "ip17air":  ("iPhone Air",         "iphone air"),
    "ip17p":    ("iPhone 17 Pro",      "iphone 17 pro"),
    "ip17pm":   ("iPhone 17 Pro Max",  "iphone 17 pro max"),

    # Samsung Galaxy S
    "gs20":   ("Galaxy S20",       "galaxy s20"),
    "gs20p":  ("Galaxy S20+",      "galaxy s20+"),
    "gs20u":  ("Galaxy S20 Ultra", "galaxy s20 ultra"),
    "gs20fe": ("Galaxy S20 FE",    "galaxy s20 fe"),
    "gs21":   ("Galaxy S21",       "galaxy s21"),
    "gs21p":  ("Galaxy S21+",      "galaxy s21+"),
    "gs21u":  ("Galaxy S21 Ultra", "galaxy s21 ultra"),
    "gs21fe": ("Galaxy S21 FE",    "galaxy s21 fe"),
    "gs22":   ("Galaxy S22",       "galaxy s22"),
    "gs22p":  ("Galaxy S22+",      "galaxy s22+"),
    "gs22u":  ("Galaxy S22 Ultra", "galaxy s22 ultra"),
    "gs23":   ("Galaxy S23",       "galaxy s23"),
    "gs23p":  ("Galaxy S23+",      "galaxy s23+"),
    "gs23u":  ("Galaxy S23 Ultra", "galaxy s23 ultra"),
    "gs23fe": ("Galaxy S23 FE",    "galaxy s23 fe"),
    "gs24":   ("Galaxy S24",       "galaxy s24"),
    "gs24p":  ("Galaxy S24+",      "galaxy s24+"),
    "gs24u":  ("Galaxy S24 Ultra", "galaxy s24 ultra"),
    "gs24fe": ("Galaxy S24 FE",    "galaxy s24 fe"),
    "gs25":   ("Galaxy S25",       "galaxy s25"),
    "gs25p":  ("Galaxy S25+",      "galaxy s25+"),
    "gs25u":  ("Galaxy S25 Ultra", "galaxy s25 ultra"),
    "gs25fe": ("Galaxy S25 FE",    "galaxy s25 fe"),
    "gs25edge":("Galaxy S25 Edge", "galaxy s25 edge"),
    "gs26":   ("Galaxy S26",       "galaxy s26"),
    "gs26p":  ("Galaxy S26+",      "galaxy s26+"),
    "gs26u":  ("Galaxy S26 Ultra", "galaxy s26 ultra"),

    # Galaxy Z foldables
    "gzflip3": ("Galaxy Z Flip 3", "galaxy z flip 3"),
    "gzflip4": ("Galaxy Z Flip 4", "galaxy z flip 4"),
    "gzflip5": ("Galaxy Z Flip 5", "galaxy z flip 5"),
    "gzflip6": ("Galaxy Z Flip 6", "galaxy z flip 6"),
    "gzflip7": ("Galaxy Z Flip 7", "galaxy z flip 7"),
    "gzfold3": ("Galaxy Z Fold 3", "galaxy z fold 3"),
    "gzfold4": ("Galaxy Z Fold 4", "galaxy z fold 4"),
    "gzfold5": ("Galaxy Z Fold 5", "galaxy z fold 5"),
    "gzfold6": ("Galaxy Z Fold 6", "galaxy z fold 6"),
    "gzfold7": ("Galaxy Z Fold 7", "galaxy z fold 7"),

    # Pixel
    "px5":     ("Google Pixel 5",        "pixel 5"),
    "px5a":    ("Google Pixel 5a",       "pixel 5a"),
    "px6":     ("Google Pixel 6",        "pixel 6"),
    "px6p":    ("Google Pixel 6 Pro",    "pixel 6 pro"),
    "px7":     ("Google Pixel 7",        "pixel 7"),
    "px7a":    ("Google Pixel 7a",       "pixel 7a"),
    "px7p":    ("Google Pixel 7 Pro",    "pixel 7 pro"),
    "px8":     ("Google Pixel 8",        "pixel 8"),
    "px8a":    ("Google Pixel 8a",       "pixel 8a"),
    "px8p":    ("Google Pixel 8 Pro",    "pixel 8 pro"),
    "px9":     ("Google Pixel 9",        "pixel 9"),
    "px9a":    ("Google Pixel 9a",       "pixel 9a"),
    "px9p":    ("Google Pixel 9 Pro",    "pixel 9 pro"),
    "px9pxl":  ("Google Pixel 9 Pro XL", "pixel 9 pro xl"),
    "px9pfold":("Google Pixel 9 Pro Fold","pixel 9 pro fold"),
    "px10":    ("Google Pixel 10",       "pixel 10"),
    "px10a":   ("Google Pixel 10a",      "pixel 10a"),
    "px10p":   ("Google Pixel 10 Pro",   "pixel 10 pro"),
    "px10pxl": ("Google Pixel 10 Pro XL","pixel 10 pro xl"),
    "pxfold":  ("Google Pixel Fold",     "pixel fold"),

    # Consoles
    "ps4":     ("PlayStation 4",       "playstation 4"),
    "ps4pro":  ("PlayStation 4 Pro",   "playstation 4 pro"),
    "ps5":     ("PlayStation 5",       "playstation 5"),
    "ps5slim": ("PlayStation 5 Slim",  "playstation 5 slim"),
    "ps5pro":  ("PlayStation 5 Pro",   "playstation 5 pro"),
    "xss":     ("Xbox Series S",       "xbox series s"),
    "xsx":     ("Xbox Series X",       "xbox series x"),
    "switch":  ("Nintendo Switch",     "nintendo switch"),
    "switchv2":("Nintendo Switch V2",  "nintendo switch v2"),
    "switchlite":("Nintendo Switch Lite","nintendo switch lite"),
    "nswoled": ("Nintendo Switch OLED","nintendo switch oled"),
    "nsw2":    ("Nintendo Switch 2",   "nintendo switch 2"),

    # Watches
    "aws7":    ("Apple Watch Series 7", "apple watch series 7"),
    "aws8":    ("Apple Watch Series 8", "apple watch series 8"),
    "aws9":    ("Apple Watch Series 9", "apple watch series 9"),
    "aws10":   ("Apple Watch Series 10","apple watch series 10"),
    "awse2":   ("Apple Watch SE",       "apple watch se"),
    "awu1":    ("Apple Watch Ultra",    "apple watch ultra"),
    "awu2":    ("Apple Watch Ultra 2",  "apple watch ultra 2"),
    "awu3":    ("Apple Watch Ultra 3",  "apple watch ultra 3"),
    "pw1":     ("Pixel Watch",          "pixel watch"),
    "pw2":     ("Pixel Watch 2",        "pixel watch 2"),
    "pw3":     ("Pixel Watch 3",        "pixel watch 3"),
    "pw4":     ("Pixel Watch 4",        "pixel watch 4"),
    "sgw7":    ("Galaxy Watch 7",       "galaxy watch 7"),
    "sgw8":    ("Galaxy Watch 8",       "galaxy watch 8"),
    "sgw8c":   ("Galaxy Watch 8 Classic","galaxy watch 8 classic"),
    "sgwu":    ("Galaxy Watch Ultra",   "galaxy watch ultra"),
    "sgwu25":  ("Galaxy Watch Ultra 2025","galaxy watch ultra 2025"),

    # MacBooks
    "mba13m2":   ("MacBook Air 13 M2",       "macbook air 13"),
    "mba15m2":   ("MacBook Air 15 M2",       "macbook air 15"),
    "mba13m3":   ("MacBook Air 13 M3",       "macbook air 13"),
    "mba15m3":   ("MacBook Air 15 M3",       "macbook air 15"),
    "mba_m4_2025":("MacBook Air M4 2025",    "macbook air"),
    "mba_m5_2026":("MacBook Air M5 2026",    "macbook air"),
    "mbp13m1":   ("MacBook Pro 13 M1",       "macbook pro 13"),
    "mbp14m2":   ("MacBook Pro 14 M2",       "macbook pro 14"),
    "mbp14m3":   ("MacBook Pro 14 M3",       "macbook pro 14"),
    "mbp14m4":   ("MacBook Pro 14 M4",       "macbook pro 14"),
    "mbp14_m5_2025":     ("MacBook Pro 14 M5 2025", "macbook pro 14"),
    "mbp14_m5pmax_2026": ("MacBook Pro 14 M5 Pro Max 2026", "macbook pro 14"),
    "mbp16m2":   ("MacBook Pro 16 M2",       "macbook pro 16"),
    "mbp16m3":   ("MacBook Pro 16 M3",       "macbook pro 16"),
    "mbp16m4":   ("MacBook Pro 16 M4",       "macbook pro 16"),
    "mbp16_m5pmax_2026": ("MacBook Pro 16 M5 Pro Max 2026", "macbook pro 16"),

    # iPads
    "ipad9":         ("iPad 9th Gen",            "ipad 9"),
    "ipad10":        ("iPad 10th Gen",           "ipad 10"),
    "ipadair11m2":   ("iPad Air 11 M2",          "ipad air"),
    "ipadair13m2":   ("iPad Air 13 M2",          "ipad air"),
    "ipadair11m3":   ("iPad Air 11 M3",          "ipad air"),
    "ipadair13m3":   ("iPad Air 13 M3",          "ipad air"),
    "ipadmini6":     ("iPad Mini 6",             "ipad mini"),
    "ipadmini7":     ("iPad Mini 7",             "ipad mini"),
    "ipadpro11g4":   ("iPad Pro 11 4th Gen M2",  "ipad pro 11"),
    "ipadpro129g6":  ("iPad Pro 12.9 6th Gen M2","ipad pro 12.9"),
    "ipadpro11m4":   ("iPad Pro 11 M4",          "ipad pro 11"),
    "ipadpro13m4":   ("iPad Pro 13 M4",          "ipad pro 13"),
    "ipadpro11m5":   ("iPad Pro 11 M5",          "ipad pro 11"),
    "ipadpro13m5":   ("iPad Pro 13 M5",          "ipad pro 13"),
}

# Family-level disambiguation: when one query matches multiple variant tiers
# (e.g. "iPhone 17" also matches "iPhone 17 Pro Max"), reject titles that
# contain higher-tier suffixes from the same family.
DISAMBIG = {
    "iphone 17":       ["pro max", "pro", "air", "plus", "17e"],
    "iphone 16":       ["pro max", "pro", "plus", "16e"],
    "iphone 15":       ["pro max", "pro", "plus"],
    "iphone 14":       ["pro max", "pro", "plus"],
    "iphone 13":       ["pro max", "pro", "mini"],
    "iphone 12":       ["pro max", "pro", "mini"],
    "iphone 11":       ["pro max", "pro"],
    "iphone 17 pro":   ["max"],
    "iphone 16 pro":   ["max"],
    "iphone 15 pro":   ["max"],
    "iphone 14 pro":   ["max"],
    "iphone 13 pro":   ["max"],
    "iphone 12 pro":   ["max"],
    "iphone 11 pro":   ["max"],
    "galaxy s20":      ["plus", "ultra", "fe"],
    "galaxy s21":      ["plus", "ultra", "fe"],
    "galaxy s22":      ["plus", "ultra", "fe"],
    "galaxy s23":      ["plus", "ultra", "fe"],
    "galaxy s24":      ["plus", "ultra", "fe"],
    "galaxy s25":      ["plus", "ultra", "fe", "edge"],
    "galaxy s26":      ["plus", "ultra", "fe"],
    "pixel 8":         ["pro", "8a"],
    "pixel 9":         ["pro", "9a", "fold"],
    "pixel 9 pro":     ["xl", "fold"],
    "pixel 10":        ["pro", "10a", "fold"],
    "pixel 10 pro":    ["xl", "fold"],
    "playstation 4":   ["pro", "slim"],
    "playstation 5":   ["pro", "slim"],
    "nintendo switch": ["lite", "oled", "v2", "2"],
    "apple watch":     ["series", "ultra", "se"],
    "galaxy watch":    ["classic", "ultra"],
}

# Words that indicate parts/accessories, not the full device
ACCESSORY_WORDS = (
    "case ", "cases ", "screen protector", "charger only", "cable only",
    "battery only", "for parts", "parts only", "broken for parts",
    "as is", "icloud locked", "icloud-locked", "activation locked",
    "blacklisted", "blocked", "bad esn", "for repair only",
    "wallet case", "phone case", "screen cover", "tempered glass",
    "lightning cable", "wireless charger", "stand only", "manual only",
    "box only", "empty box",
)


def parse_price(s):
    if not s: return None
    # Handle ranges "$100 to $200"
    nums = re.findall(r"\d+(?:,\d{3})*(?:\.\d{2})?", s)
    if not nums: return None
    # Take first price (usually the actual sold price; ranges are bid auctions)
    val = float(nums[0].replace(",", ""))
    return val


def extract_sold(page, query, pages=2):
    """Scrape sold listings across N pages (default 3 ≈ ~180 results).
    eBay paginates via `_pgn=N` in the search URL. Caller must warm the
    session via warmup_session() before first call to dodge Akamai.
    """
    all_items = []
    for pgn in range(1, pages + 1):
        url = (
            f"https://www.ebay.com/sch/i.html?_nkw={query.replace(' ', '+')}"
            f"&LH_Sold=1&LH_Complete=1&_sop=13&_pgn={pgn}"
        )
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
        except Exception:
            break
        page.wait_for_timeout(1800)
        if "Access Denied" in (page.title() or ""):
            break
        items = page.evaluate("""() => {
            const out = [];
            for (const li of document.querySelectorAll('li.s-card, li.s-item')) {
                const t = (li.querySelector('[class*="title"]')?.innerText || '').trim();
                const p = (li.querySelector('[class*="price"]')?.innerText || '').trim();
                const d = (li.querySelector('[class*="caption"]')?.innerText || '').trim();
                const cond = (li.querySelector('[class*="subtitle"], .SECONDARY_INFO')?.innerText || '').trim();
                if (!t || !p) continue;
                if (/shop on ebay/i.test(t)) continue;
                const title = t.replace(/^NEW LISTING/, '').replace(/Opens in a new.*$/s, '').trim();
                out.push({title, price: p, sold: d, cond: cond});
            }
            return out;
        }""")
        if not items:
            break
        # eBay sometimes repeats results when there's no next page — dedupe by title+price
        seen = {f"{i['title']}__{i['price']}" for i in all_items}
        new_items = [i for i in items if f"{i['title']}__{i['price']}" not in seen]
        if not new_items:
            break  # we've reached the end (eBay served the same page)
        all_items.extend(new_items)
        if pgn < pages:
            page.wait_for_timeout(1200)  # polite delay between pages
    return all_items


# eBay seller economics — what the seller actually pockets per sale.
#
# Skywalker 2026-05-19: eBay charges 13% across all categories on his
# account. Earlier per-category 12/13.25/15% split was a published-
# schedule estimate and didn't match his actual statements. We flatten
# every family to 13% so net_* fields in the output JSON line up with
# what hits his bank. Override per-family via env vars if his account
# ever changes.
#
# Plus a $0.40 fixed per-order fee ($0.30 if order ≤ $10).
#
# Per-category shipping is the seller's USPS/UPS cost. Phones are easy
# (small flat-rate box), laptops and consoles are heavy + insured. Set
# via TCC_EBAY_SHIP_PHONE etc. env vars if you ship differently.
import os
EBAY_FVF_BY_FAMILY = {
    "phone":   float(os.environ.get("TCC_EBAY_FVF_PHONE",   "0.13")),
    "tablet":  float(os.environ.get("TCC_EBAY_FVF_TABLET",  "0.13")),
    "laptop":  float(os.environ.get("TCC_EBAY_FVF_LAPTOP",  "0.13")),
    "console": float(os.environ.get("TCC_EBAY_FVF_CONSOLE", "0.13")),
    "watch":   float(os.environ.get("TCC_EBAY_FVF_WATCH",   "0.13")),
    "drone":   float(os.environ.get("TCC_EBAY_FVF_DRONE",   "0.13")),
    "vr":      float(os.environ.get("TCC_EBAY_FVF_VR",      "0.13")),
}
EBAY_FIXED_FEE = 0.40
SHIP_BY_FAMILY = {
    "phone":   float(os.environ.get("TCC_EBAY_SHIP_PHONE",   "10.0")),
    "tablet":  float(os.environ.get("TCC_EBAY_SHIP_TABLET",  "12.0")),
    "laptop":  float(os.environ.get("TCC_EBAY_SHIP_LAPTOP",  "20.0")),
    "console": float(os.environ.get("TCC_EBAY_SHIP_CONSOLE", "25.0")),
    "watch":   float(os.environ.get("TCC_EBAY_SHIP_WATCH",    "7.0")),
    "drone":   float(os.environ.get("TCC_EBAY_SHIP_DRONE",   "25.0")),
    "vr":      float(os.environ.get("TCC_EBAY_SHIP_VR",      "20.0")),
}


def family_for(mid):
    """Map model_id prefix → shipping family for cost lookup."""
    if mid.startswith(("ip", "gs", "gz", "gnote", "px")) and not mid.startswith("ipad"):
        return "phone"
    if mid.startswith("ipad") or mid.startswith("stab") or mid.startswith("ln_tab") or mid.startswith("op_tab"):
        return "tablet"
    if mid.startswith(("mba", "mbp", "imac", "macmini", "macstud", "macpro")):
        return "laptop"
    if mid.startswith(("ps", "xs", "switch", "nsw")):
        return "console"
    if mid.startswith(("aw", "pw", "sgw", "garmin")):
        return "watch"
    if mid.startswith("dji"):
        return "drone"
    if mid.startswith(("apple_vr", "meta_vr", "valve_vr", "psvr")):
        return "vr"
    return "phone"  # fallback


def gross_to_net(gross, mid=None):
    """Convert eBay gross sold price → seller's net cash in pocket.

    net = gross × (1 − fvf%_for_family) − $0.40 fixed − shipping_for_family

    Both FVF and shipping vary by device family — phones use the lowest
    FVF (12%) while watches use 15% per eBay's category schedule.
    """
    fam = family_for(mid) if mid else "phone"
    fvf = EBAY_FVF_BY_FAMILY.get(fam, 0.12)
    ship = SHIP_BY_FAMILY.get(fam, 10.0)
    net = gross * (1 - fvf) - EBAY_FIXED_FEE - ship
    return max(0, round(net, 2))


def warmup_session(page):
    """Visit eBay homepage to establish cookies before first search.
    Without this Akamai serves an Access Denied for the search URL."""
    try:
        page.goto("https://www.ebay.com/", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(1500)
    except Exception:
        pass


def normalize_condition(cond_str):
    """Map eBay's condition strings → our condition tiers.

    eBay's secondary_info looks like:
      "Brand New · Apple iPhone 17 Pro Max · 256 GB · Unlocked"
      "Pre-Owned · Apple iPhone 17 Pro Max · 512 GB · Unlocked"
      "For parts or not working · Apple iPhone 17 Pro Max"
      "Open Box · ..."
      "Very Good - Refurbished · ..."

    Returns one of: sealed | used | broken | None (unknown).
    We don't try to split "used" further (mint vs good vs fair) because
    eBay only marks "Pre-Owned" without a sub-grade — a per-listing
    title keyword parse is unreliable enough that one bucket is safer.
    """
    if not cond_str: return None
    c = cond_str.lower()
    if "brand new" in c or "new (open box)" in c or c.startswith("new ·"): return "sealed"
    if "open box" in c: return "sealed"
    if "for parts" in c or "not working" in c: return "broken"
    if "refurbish" in c or "pre-owned" in c or "preowned" in c or "used" in c: return "used"
    return None


def normalize_storage(cond_str, title):
    """Extract storage tier from cond_str (preferred) or title.
    Returns: 64 / 128 / 256 / 512 / 1tb / 2tb / None.
    """
    blob = (cond_str + " " + title).lower()
    # Order matters — match larger tiers first so "1tb" doesn't get
    # swallowed by "1".
    if re.search(r"\b2\s*tb\b", blob): return "2tb"
    if re.search(r"\b1\s*tb\b", blob): return "1tb"
    if re.search(r"\b512\s*gb\b", blob): return "512"
    if re.search(r"\b256\s*gb\b", blob): return "256"
    if re.search(r"\b128\s*gb\b", blob): return "128"
    if re.search(r"\b64\s*gb\b", blob): return "64"
    if re.search(r"\b32\s*gb\b", blob): return "32"
    return None


def reject_outliers_iqr(prices, k=1.5):
    """Drop prices outside [Q1 - k*IQR, Q3 + k*IQR]. Returns (kept, rejected).
    Standard Tukey fence — kills fake clickbait listings ($1 starting bid
    that closed at $50 because nobody bid, scam "iPhone 17 Pro Max $200"
    that's actually a phone case in disguise, and inflated $5K outliers).
    """
    if len(prices) < 4:
        return prices, []
    s = sorted(prices)
    n = len(s)
    q1 = s[n // 4]
    q3 = s[(3 * n) // 4]
    iqr = q3 - q1
    lo, hi = q1 - k * iqr, q3 + k * iqr
    kept = [p for p in prices if lo <= p <= hi]
    rejected = [p for p in prices if p < lo or p > hi]
    return kept, rejected


def aggregate(items, family, atlas_floor=None, mid=None):
    """Bucket eBay listings by (storage, condition) and aggregate per cell.

    Filters:
      - Title must contain `family` substring
      - Sibling-tier rejects via DISAMBIG (so "iPhone 17" doesn't catch "Pro Max")
      - Accessory/parts title rejects via ACCESSORY_WORDS
      - Per-cell IQR outlier rejection (Tukey fence) — kills fake listings
        and abnormal $1 / $5K extremes
      - Optional `atlas_floor`: prices below atlas_floor × 0.4 are likely
        fake (clickbait) and get rejected at parse time

    Returns:
        {
            "by_cell": { storage: { condition: {count, average, median, ...} } },
            "samples": [...],
            "unmatched": int,
            "outliers_rejected": int,
        }
    """
    if not items:
        return {"by_cell": {}, "samples": [], "unmatched": 0, "outliers_rejected": 0}
    family_l = family.lower()
    rejects = DISAMBIG.get(family_l, [])
    # Atlas floor — anything below 40% of the cheapest Atlas grade is almost
    # certainly a fake listing (most flagrant scam: $1 iPhone). Use Atlas's
    # smallest non-null grade as the reference.
    hard_floor = (atlas_floor * 0.4) if atlas_floor else 20

    bucketed: dict = {}  # {storage: {cond: [listings]}}
    samples_out = []
    unmatched = 0
    outliers_rejected_total = 0
    for it in items:
        t = it.get("title", "")
        t_lower = t.lower()
        if family_l not in t_lower:
            continue
        if any(sib in t_lower for sib in rejects):
            continue
        if any(w in t_lower for w in ACCESSORY_WORDS):
            continue
        p = parse_price(it.get("price"))
        if p is None or p < hard_floor or p > 10000:
            continue
        cond_str = it.get("cond", "")
        condition = normalize_condition(cond_str)
        storage = normalize_storage(cond_str, t)
        if condition is None or storage is None:
            unmatched += 1
            continue
        bucketed.setdefault(storage, {}).setdefault(condition, []).append({
            "price": p, "title": t[:100], "cond": cond_str[:80],
        })

    by_cell: dict = {}
    for storage, conds in bucketed.items():
        by_cell[storage] = {}
        for cond, listings in conds.items():
            raw_prices = [l["price"] for l in listings]
            # Primary outlier rejection: IQR (Tukey fence). Strong with n≥4.
            kept, rejected = reject_outliers_iqr(raw_prices)
            # Secondary: half-median rule. Catches obvious fakes in
            # small-sample buckets where IQR can't fire — e.g. a $500
            # iPhone 17 Pro Max 1TB listing when the rest cluster at $1400.
            if kept:
                med0 = statistics.median(kept)
                half = med0 * 0.5
                kept2 = [p for p in kept if p >= half]
                rejected.extend([p for p in kept if p < half])
                kept = kept2
            outliers_rejected_total += len(rejected)
            if not kept:
                continue
            kept_sorted = sorted(kept)
            gross_avg = round(statistics.mean(kept), 2)
            gross_median = statistics.median(kept)
            by_cell[storage][cond] = {
                "count": len(kept),
                "average": gross_avg,                       # eBay gross (what buyer paid)
                "median": gross_median,
                "net_average": gross_to_net(gross_avg, mid),  # what seller pocketed after FVF + shipping
                "net_median": gross_to_net(gross_median, mid),
                "min": kept_sorted[0],
                "max": kept_sorted[-1],
                "rejected_outliers": len(rejected),
            }
            # Keep 2 sample listings from the kept set (cheapest + most-typical)
            kept_set = set(kept)
            kept_listings = [l for l in listings if l["price"] in kept_set]
            samples_out.extend(kept_listings[:2])
    return {
        "by_cell": by_cell,
        "samples": samples_out[:12],
        "unmatched": unmatched,
        "outliers_rejected": outliers_rejected_total,
    }


def read_price_table_models():
    """Parse PRICE_TABLE from app/data/prices.ts → list of model ids."""
    src = PRICES_TS.read_text()
    m = re.search(r"^export const PRICE_TABLE[^=]*=\s*\{", src, re.MULTILINE)
    if not m: return []
    i = m.end() - 1
    depth = 0; j = i
    while j < len(src):
        if src[j] == "{": depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0: break
        j += 1
    body = src[i:j+1]
    body = re.sub(r"//[^\n]*", "", body)
    return re.findall(r"^  ([a-zA-Z0-9_]+):\s*\{", body, re.MULTILINE)


def load_atlas_floors():
    """Return {model_id: atlas_min_price} for every model with Atlas data.
    Used as a fake-listing floor (listings below 40% of this are dropped
    at parse time, before bucketing).

    Only the 44 phones that scripts/audit-prices-vs-atlas.py covers will
    have an entry — that's the trustable subset Skywalker wants to start
    with. Other models in LABEL_MAP get None (less-aggressive floor of $20).
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location("audit", str(ROOT / "scripts" / "audit-prices-vs-atlas.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    atlas = mod.load_atlas()
    pt = mod.read_price_table()
    out = {}
    for mid in pt:
        for storage in pt[mid]:
            grades = mod.find_atlas_for(mid, storage, atlas)
            if not grades: continue
            values = [v for v in grades.values() if v is not None and v > 0]
            if not values: continue
            out[mid] = min(values)  # use lowest grade as floor reference
            break
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Single model id (skip rest)")
    parser.add_argument("--category", help="Filter to family prefix (e.g. 'ip', 'gs', 'mba')")
    parser.add_argument("--limit", type=int, help="First N models only")
    parser.add_argument("--out", default=str(OUT))
    parser.add_argument("--atlas-only", action="store_true",
                        help="Restrict to models with Atlas reference data (the 44 trustable phones)")
    args = parser.parse_args()

    atlas_floors = load_atlas_floors()
    targets = []
    if args.only:
        if args.only not in LABEL_MAP:
            print(f"Unknown model {args.only}. Add to LABEL_MAP.", file=sys.stderr); sys.exit(1)
        targets = [args.only]
    else:
        model_ids = read_price_table_models()
        targets = [m for m in model_ids if m in LABEL_MAP]
        if args.atlas_only:
            targets = [m for m in targets if m in atlas_floors]
        if args.category:
            targets = [m for m in targets if m.startswith(args.category)]
        if args.limit:
            targets = targets[:args.limit]

    print(f"Scraping eBay sold-listings for {len(targets)} models", flush=True)
    results = {}
    out_path = Path(args.out)
    # Preserve previous results so partial runs don't lose data
    if out_path.exists():
        try:
            results = json.loads(out_path.read_text()).get("models", {})
        except Exception:
            results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = browser.new_context(
            user_agent=UA,
            viewport={"width": 1366, "height": 768},
            locale="en-US",
            timezone_id="America/Chicago",
        )
        ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")
        page = ctx.new_page()
        warmup_session(page)
        for i, mid in enumerate(targets, 1):
            label, family = LABEL_MAP[mid]
            print(f"[{i}/{len(targets)}] {mid:18s}  {label}", flush=True)
            items = extract_sold(page, label)
            agg = aggregate(items or [], family, atlas_floor=atlas_floors.get(mid), mid=mid)
            agg["label"] = label
            agg["family"] = family
            agg["scraped_at"] = datetime.now(timezone.utc).isoformat()
            cells = agg.get("by_cell", {})
            total_n = sum(c.get("count", 0) for s in cells.values() for c in s.values())
            unmatched = agg.get("unmatched", 0)
            if total_n > 0:
                # Compact summary: 256 sealed=1100/n12, 256 used=950/n8, ...
                pieces = []
                for storage in sorted(cells.keys()):
                    for cond, stats in sorted(cells[storage].items()):
                        pieces.append(f"{storage}/{cond}=${stats['median']:.0f}/n{stats['count']}")
                print(f"    {total_n} bucketed  {'  '.join(pieces[:6])}{' ...' if len(pieces) > 6 else ''}  unmatched={unmatched}", flush=True)
            else:
                print(f"    no bucketed listings (unmatched={unmatched})", flush=True)
            results[mid] = agg
            # If we got 0 listings, eBay is probably rate-limiting — back off
            # longer before the next model so we don't burn the session.
            cells = agg.get("by_cell", {})
            had_data = any(cells.get(s, {}) for s in cells)
            time.sleep(5.0 if not had_data else 3.0)
        browser.close()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "eBay sold-listings (LH_Sold=1, LH_Complete=1)",
        "note": "Median/mean of completed-listing prices. Accessory + sibling-tier filtered. Use as resale reference vs Atlas wholesale.",
        "models": results,
    }
    out_path.write_text(json.dumps(out, indent=2))
    # Count models with at least one bucketed (storage, condition) cell
    found = sum(1 for r in results.values()
                if any(r.get("by_cell", {}).get(s, {}) for s in r.get("by_cell", {})))
    total_cells = sum(len(c) for r in results.values() for c in r.get("by_cell", {}).values())
    print(f"\nDone. {found}/{len(results)} models have bucketed data ({total_cells} cells total). → {out_path}", flush=True)


if __name__ == "__main__":
    main()
