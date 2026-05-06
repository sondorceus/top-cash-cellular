#!/usr/bin/env python
"""
Scrape device images from Wikipedia REST API (CC-licensed).

Usage:
    py scripts/scrape-device-images.py

Reads scripts/device-list.json (list of {id, label, query?} entries),
fetches each via Wikipedia summary endpoint, downloads the page-summary
image to public/devices/<id>.jpg, and writes scripts/device-image-manifest.json
mapping id -> image path. Skips ids whose target file already exists.

Wikipedia summary endpoint returns the article's lead image, which for
device articles is typically the official press-kit photo released by
the manufacturer. These images are CC-licensed via Wikimedia Commons.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST_PATH = os.path.join(ROOT, "scripts", "device-list.json")
MANIFEST_PATH = os.path.join(ROOT, "scripts", "device-image-manifest.json")
PUBLIC_DEVICES = os.path.join(ROOT, "public", "devices")

UA = "TopCashCellular-DeviceImageScraper/1.0 (https://topcashcellular.com)"


def wiki_summary(title):
    """Fetch summary JSON for a Wikipedia article title."""
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title.replace(" ", "_"))
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}


def pick_image_url(summary):
    """Prefer originalimage over thumbnail."""
    if not summary or summary.get("error"):
        return None
    orig = (summary.get("originalimage") or {}).get("source")
    thumb = (summary.get("thumbnail") or {}).get("source")
    return orig or thumb


def download(url, path, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    last_err = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            with open(path, "wb") as f:
                f.write(data)
            return
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                wait = 5 * (attempt + 1)
                print(f"  ... 429 rate-limited, sleeping {wait}s")
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            last_err = e
            time.sleep(2)
    raise last_err


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if not os.path.exists(LIST_PATH):
        print(f"FAIL: {LIST_PATH} not found")
        sys.exit(1)
    with open(LIST_PATH, "r", encoding="utf-8") as f:
        devices = json.load(f)
    os.makedirs(PUBLIC_DEVICES, exist_ok=True)

    manifest = {}
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    ok = 0
    skip = 0
    fail = 0
    for d in devices:
        did = d["id"]
        query = d.get("query") or d["label"]
        out = os.path.join(PUBLIC_DEVICES, f"{did}.jpg")
        if os.path.exists(out):
            print(f"skip {did} (file exists)")
            manifest[did] = f"/devices/{did}.jpg"
            skip += 1
            continue
        summary = wiki_summary(query)
        img = pick_image_url(summary)
        if not img:
            print(f"FAIL {did}: no image for '{query}' — {summary.get('error') or 'no thumbnail'}")
            fail += 1
            time.sleep(0.3)
            continue
        try:
            download(img, out)
            manifest[did] = f"/devices/{did}.jpg"
            print(f"ok   {did} <- {query}")
            ok += 1
        except Exception as e:
            print(f"FAIL {did}: download error {e}")
            fail += 1
        time.sleep(1.5)  # polite pacing — Wikimedia rate limits aggressively

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\nDone. ok={ok} skip={skip} fail={fail}. Manifest -> {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
