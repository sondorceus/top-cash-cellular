#!/usr/bin/env python3
"""Scrape eBay sold-listings for DJI drones — resale market data.

Captures sold prices from the last ~30 days of completed listings.
Used to determine TCC's resale margin per model (we pay sellers
IWM x 0.90 and resell at this eBay price).

Output: public/comps/ebay-dji-sold.json keyed by our variant id.

Run:
  python3 scripts/scrape-ebay-dji.py
  python3 scripts/scrape-ebay-dji.py --limit 3
"""
from __future__ import annotations
import json, re, sys, time, statistics
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.parent
SRC = ROOT / "iwm-drone-adjustments.json"
OUT = ROOT / "public" / "comps" / "ebay-dji-sold.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def vid_from_slug(slug):
    return slug.replace("dji-drone-", "dji-").replace("-", "_").replace("dji_", "dji_")


def ebay_query(label):
    # Use exact model phrase
    return label.replace(" ", "+")


def extract_sold(page, label):
    url = (
        f"https://www.ebay.com/sch/i.html?_nkw={ebay_query(label)}"
        f"&LH_Sold=1&LH_Complete=1&_sop=13&LH_ItemCondition=3000|2500|2000|1500"
    )
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except Exception:
        return None
    page.wait_for_timeout(1200)
    # Pull item cards
    items = page.evaluate("""() => {
        const out = [];
        for (const li of document.querySelectorAll('li.s-item, li.s-card, li[class*="item"]')) {
            const t = (li.querySelector('.s-item__title, .s-card__title, [class*="title"]')?.innerText || '').trim();
            const p = (li.querySelector('.s-item__price, .s-card__price, [class*="price"]')?.innerText || '').trim();
            const d = (li.querySelector('.s-item__caption--row, .s-item__title--tagblock, [class*="caption"]')?.innerText || '').trim();
            const cond = (li.querySelector('.SECONDARY_INFO, .s-item__subtitle')?.innerText || '').trim();
            if (!t || !p) continue;
            if (/shop on ebay/i.test(t)) continue;
            out.push({title:t, price:p, sold:d, cond:cond});
        }
        return out;
    }""")
    return items


def parse_price(s):
    if not s: return None
    nums = re.findall(r"\d+(?:\.\d{2})?", s.replace(",", ""))
    if not nums: return None
    return float(nums[0])


def aggregate(items, label, iwm_flawless=0):
    if not items:
        return {"count": 0}
    # Reject listings below 30% of IWM Flawless — those are almost
    # certainly accessories (batteries / propellers / chargers / cases)
    # that eBay groups under the drone's product page. Without this
    # filter, $8K Inspire 2 medians out at $100 from battery listings.
    min_price = iwm_flawless * 0.30 if iwm_flawless else 0
    # Match by model phrase (after "DJI ") as a contiguous substring in
    # the title. Handles "DJI Avata 2 Combo" matching "DJI Avata 2" but
    # not collapsing to "DJI Avata" alone.
    family = re.sub(r"^DJI\s+", "", label, flags=re.I).strip().lower()
    matched = []
    for it in items:
        t_lower = it.get("title", "").lower()
        if family not in t_lower:
            continue
        # Reject titles that are about accessories/parts ONLY
        bad = ("battery", "case", "propeller", "remote only", "controller only",
               "charger", "blade", "cable", "lens", "filter pack", "manual",
               "parts only", "for parts")
        if any(b in t_lower for b in bad):
            continue
        # Disambiguate longer model in series — reject if a higher-tier sibling
        # phrase appears that should have priced separately (e.g. "avata" matches
        # "avata 2 combo" — we drop it from the bare avata bucket).
        if family in ("avata", "mavic 3", "mavic pro", "mini 3", "mini 2",
                       "mavic", "phantom 4", "air", "inspire", "mavic 2 pro"):
            disambig = {
                "avata": ["avata 2"],
                "mavic 3": ["mavic 3 pro", "mavic 3 classic", "mavic 3 cine"],
                "mavic pro": ["mavic pro platinum"],
                "mini 3": ["mini 3 pro"],
                "mini 2": ["mini 2 se"],
                "mavic": ["mavic 2", "mavic 3", "mavic 4", "mavic air", "mavic mini", "mavic pro"],
                "phantom 4": ["phantom 4 pro", "phantom 4 advanced"],
                "air": ["air 2s", "air 3", "air 3s", "mavic air"],
                "inspire": ["inspire 1", "inspire 2"],
                "mavic 2 pro": [],
            }.get(family, [])
            if any(sib in t_lower for sib in disambig):
                continue
        p = parse_price(it.get("price"))
        if p and min_price < p < 10000:
            matched.append({"price": p, "title": it.get("title"), "cond": it.get("cond")})
    if not matched:
        return {"count": 0}
    prices = sorted(p["price"] for p in matched)
    return {
        "count": len(matched),
        "min": prices[0],
        "max": prices[-1],
        "median": statistics.median(prices),
        "mean": round(statistics.mean(prices), 2),
        "samples": matched[:10],
    }


def main():
    args = sys.argv[1:]
    limit = None
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])

    d = json.loads(SRC.read_text(encoding="utf-8"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    targets = [(vid_from_slug(v["model"]), v["model_label"], v["iwm_flawless"])
               for v in d.values() if v.get("iwm_flawless", 0) > 0]
    if limit:
        targets = targets[:limit]
    print(f"Scraping eBay sold-listings for {len(targets)} DJI variants", flush=True)
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent=UA,
            viewport={"width": 1280, "height": 900},
            locale="en-US",
        )
        page = ctx.new_page()
        for i, (vid, label, iwm) in enumerate(targets, 1):
            iwm_x90 = round(iwm * 0.90)
            print(f"[{i}/{len(targets)}] {vid:30}  iwm=${iwm}  ours=${iwm_x90}", flush=True)
            items = extract_sold(page, label)
            agg = aggregate(items or [], label, iwm_flawless=iwm)
            agg["model_label"] = label
            agg["iwm_flawless"] = iwm
            agg["our_payout_iwm_x_0.90"] = iwm_x90
            if agg.get("count", 0) > 0:
                margin = agg["median"] - iwm_x90
                agg["est_margin"] = round(margin)
                agg["est_margin_pct"] = round((margin / iwm_x90) * 100, 1) if iwm_x90 else None
                print(f"   {agg['count']} sold  median=${agg['median']:.0f}  margin=${margin:.0f} ({agg['est_margin_pct']}%)", flush=True)
            else:
                print(f"   no sold listings matched", flush=True)
            agg["scraped_at"] = datetime.now(timezone.utc).isoformat()
            results[vid] = agg
            time.sleep(2.0)  # polite between queries
        browser.close()
    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    found = sum(1 for r in results.values() if r.get("count", 0) > 0)
    total_margin = sum(r.get("est_margin", 0) * r.get("count", 0)
                       for r in results.values() if r.get("count", 0) > 0)
    print(f"\nDone. {found}/{len(results)} have sold data. -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
