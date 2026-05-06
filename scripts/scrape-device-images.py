#!/usr/bin/env python
"""
Scrape device images from Wikimedia Commons (CC-licensed).

Usage:
    py scripts/scrape-device-images.py [--force]

Reads scripts/device-list.json (list of {id, label, query?} entries),
searches Wikimedia Commons file namespace per device, picks the first
JPG/PNG hit, downloads to public/devices/<id>.jpg, and writes
scripts/device-image-manifest.json.

Why Commons search over Wikipedia article lead-image: Wikipedia article
lead images are often family-lineup shots (e.g., S22 article shows
base+Plus+Ultra side-by-side). Commons file search returns individual
device images uploaded as standalone files.

Pass --force to re-download even when output already exists.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST_PATH = os.path.join(ROOT, "scripts", "device-list.json")
MANIFEST_PATH = os.path.join(ROOT, "scripts", "device-image-manifest.json")
PUBLIC_DEVICES = os.path.join(ROOT, "public", "devices")

UA = "TopCashCellular-DeviceImageScraper/1.0 (https://topcashcellular.com)"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"


def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def search_commons(query):
    """Search Commons File: namespace with exact phrase, then fallback to loose."""
    titles = []
    for srsearch in (f'"{query}"', query):
        params = {
            "action": "query",
            "list": "search",
            "srnamespace": "6",
            "srsearch": srsearch,
            "format": "json",
            "srlimit": "20",
        }
        url = COMMONS_API + "?" + urllib.parse.urlencode(params)
        try:
            data = http_json(url)
            new = [r["title"] for r in data.get("query", {}).get("search", [])]
            for t in new:
                if t not in titles:
                    titles.append(t)
        except Exception as e:
            print(f"  search err: {e}")
        time.sleep(0.4)
    return titles


def get_image_url(file_title):
    """Resolve a 'File:foo.jpg' to its direct upload URL."""
    params = {
        "action": "query",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json",
    }
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    try:
        data = http_json(url)
        pages = data.get("query", {}).get("pages", {})
        for p in pages.values():
            info = p.get("imageinfo", [])
            if info:
                return info[0].get("url")
    except Exception as e:
        print(f"  resolve err: {e}")
    return None


def pick_best_match(query, titles):
    """Score candidates with strong penalties for multi-device shots and wrong-variant matches."""
    if not titles:
        return None
    qlower = query.lower()
    qwords = set(w for w in qlower.replace(",", "").split() if len(w) > 1)
    skip_keywords = ("logo", "icon", "render", "diagram", "screenshot", "buds", "wordmark", "vp9", "mp4", ".webm", ".mov")
    multidev_indicators = ("series", " and ", " & ", ", ", " vs ", "+ ")
    qhas_fe = "fe" in qwords
    qhas_plus = "+" in query or "plus" in qwords
    qhas_ultra = "ultra" in qwords
    qhas_edge = "edge" in qwords

    scored = []
    for t in titles:
        tl = t.lower()
        if not any(tl.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
            continue
        if any(k in tl for k in skip_keywords):
            continue
        # base score = how many query words appear in title
        score = sum(1 for w in qwords if w in tl) * 2
        # penalty: multi-device shots (titles with " and " or "Series" or commas)
        if any(m in tl for m in multidev_indicators):
            score -= 5
        # penalty: wrong variant flavor
        if not qhas_fe and " fe" in tl:
            score -= 4
        if not qhas_plus and ("plus" in tl or "+" in t):
            score -= 3
        if not qhas_ultra and "ultra" in tl:
            score -= 3
        if not qhas_edge and "edge" in tl:
            score -= 3
        # bonus: title looks like a single clean shot
        clean_title = tl.replace("file:", "").rsplit(".", 1)[0]
        if clean_title.strip() == qlower:
            score += 6
        scored.append((score, t))
    if not scored:
        return None
    scored.sort(reverse=True)
    if scored[0][0] <= 0:
        return None
    return scored[0][1]


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
                print(f"  ... 429, sleeping {wait}s")
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            last_err = e
            time.sleep(2)
    raise last_err


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    force = "--force" in sys.argv
    if not os.path.exists(LIST_PATH):
        print(f"FAIL: {LIST_PATH} not found")
        sys.exit(1)
    with open(LIST_PATH, "r", encoding="utf-8") as f:
        devices = json.load(f)
    os.makedirs(PUBLIC_DEVICES, exist_ok=True)

    manifest = {}
    if os.path.exists(MANIFEST_PATH) and not force:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    ok = skip = fail = 0
    for d in devices:
        did = d["id"]
        query = d.get("query") or d["label"]
        out = os.path.join(PUBLIC_DEVICES, f"{did}.jpg")
        if not force and os.path.exists(out):
            print(f"skip {did}")
            manifest[did] = f"/devices/{did}.jpg"
            skip += 1
            continue
        # Per-device manual override: {"file": "Samsung Galaxy S22 Ultra Burgundy.jpg"}
        # bypasses search and goes straight to that Commons file.
        if "file" in d:
            chosen = "File:" + d["file"] if not d["file"].startswith("File:") else d["file"]
        else:
            titles = search_commons(query)
            time.sleep(1.0)
            chosen = pick_best_match(query, titles)
        if not chosen:
            print(f"FAIL {did}: no Commons file match for '{query}'")
            fail += 1
            time.sleep(0.5)
            continue
        img_url = get_image_url(chosen)
        time.sleep(1.0)
        if not img_url:
            print(f"FAIL {did}: could not resolve {chosen}")
            fail += 1
            continue
        try:
            download(img_url, out)
            manifest[did] = f"/devices/{did}.jpg"
            print(f"ok   {did} <- {chosen}")
            ok += 1
        except Exception as e:
            print(f"FAIL {did}: download error {e}")
            fail += 1
        time.sleep(1.5)

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\nDone. ok={ok} skip={skip} fail={fail}. Manifest -> {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
