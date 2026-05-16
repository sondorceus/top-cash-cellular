#!/usr/bin/env python3
"""Snapshot Swappa buy-page pricing data per DJI variant.

Swappa exposes structured AggregateOffer JSON-LD on each /buy/{slug}
page — offerCount + lowPrice + highPrice. For DJI specifically, Swappa
has near-zero active inventory (verified 2026-05-16: only dji-air-2s
had a single $952 listing across 27 probed slugs). Capturing the snapshot
anyway so we have a frozen comp record at ship time.

Output: public/comps/swappa-dji-prices.json keyed by our variant id.

Run:
  python3 scripts/scrape-swappa-dji-prices.py
"""
from __future__ import annotations
import json, re, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "iwm-drone-adjustments.json"
OUT = ROOT / "public" / "comps" / "swappa-dji-prices.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        return None
    except Exception:
        return None


def parse_agg(html):
    if not html:
        return None
    out = {}
    for key in ("offerCount", "lowPrice", "highPrice"):
        m = re.search(rf'"{key}":\s*"([^"]*)"', html)
        if m:
            v = m.group(1)
            out[key] = int(v) if key == "offerCount" else float(v)
    avail = re.search(r'"availability":\s*"https://schema.org/(\w+)"', html)
    if avail:
        out["availability"] = avail.group(1)
    return out


def vid_from_slug(slug):
    return slug.replace("dji-drone-", "dji-").replace("-", "_").replace("dji_", "dji_")


def swappa_slug(slug):
    return "dji-" + slug.replace("dji-drone-", "")


def main():
    d = json.loads(SRC.read_text(encoding="utf-8"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    results = {}
    have_inventory = 0
    for key, entry in d.items():
        if entry.get("iwm_flawless", 0) <= 0:
            continue
        vid = vid_from_slug(entry["model"])
        sslug = swappa_slug(entry["model"])
        url = f"https://swappa.com/buy/{sslug}"
        html = fetch(url)
        agg = parse_agg(html) if html else None
        iwm_base = round(entry["iwm_flawless"] * 0.90)
        record = {
            "vid": vid,
            "swappa_slug": sslug,
            "swappa_url": url,
            "iwm_flawless": entry["iwm_flawless"],
            "our_price_iwm_x_0.90": iwm_base,
            "swappa": agg or {"error": "fetch_failed"},
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }
        results[vid] = record
        ic = agg.get("offerCount", 0) if agg else 0
        lp = agg.get("lowPrice", 0) if agg else 0
        if ic > 0 and lp > 0:
            have_inventory += 1
            print(f"  {vid:30}  offerCount={ic}  swappa=${lp:.0f}  ours=${iwm_base}", flush=True)
        else:
            print(f"  {vid:30}  swappa sold-out / no listings  ours=${iwm_base}", flush=True)
        time.sleep(0.3)
    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nDone. {have_inventory}/{len(results)} have active Swappa listings. -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
