#!/usr/bin/env python
"""
Scrape device images, with GSMArena as primary source.

Usage:
    py scripts/scrape-device-images.py [--force] [--source=gsmarena|commons]

Pipeline per device:
  1. If device-list.json entry has "gsmarena_url": fetch directly.
  2. Else if "gsmarena_slug": construct URL and fetch.
  3. Else: search GSMArena, parse HTML for first device link, derive slug.
  4. Fallback to Wikimedia Commons search if all GSMArena attempts fail.

GSMArena URL structure:
    https://fdn2.gsmarena.com/vv/pics/<brand>/<slug>-1.jpg
    where <brand> is lowercase brand (samsung, apple) and <slug> is
    the device identifier (samsung-galaxy-s22-ultra-5g).

The fetch is rate-limited (1 req / 1.5 sec) to be polite. GSMArena
images are JPEG product photos suitable for thumbnail use; final
attribution/licensing happens when Skywalker replaces with original
photos.

Pass --force to re-download even when output already exists.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST_PATH = os.path.join(ROOT, "scripts", "device-list.json")
MANIFEST_PATH = os.path.join(ROOT, "scripts", "device-image-manifest.json")
PUBLIC_DEVICES = os.path.join(ROOT, "public", "devices")

UA_BROWSER = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
)
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
GSMARENA_BASE = "https://fdn2.gsmarena.com/vv/pics"
GSMARENA_SEARCH = "https://www.gsmarena.com/results.php3"


def http_get(url, expect_json=False):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA_BROWSER,
        "Accept": "application/json,text/html,*/*",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        body = r.read()
    if expect_json:
        return json.loads(body)
    try:
        return body.decode("utf-8", errors="ignore")
    except Exception:
        return body


def http_download(url, path):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA_BROWSER,
        "Referer": "https://www.gsmarena.com/",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    if len(data) < 2048:
        raise ValueError(f"image too small ({len(data)}b), likely placeholder")
    with open(path, "wb") as f:
        f.write(data)


def gsmarena_search_slug(query):
    """Search GSMArena for a device, return its URL slug (samsung-galaxy-s22-ultra-5g)."""
    params = urllib.parse.urlencode({"sQuickSearch": "yes", "sName": query})
    url = f"{GSMARENA_SEARCH}?{params}"
    try:
        html = http_get(url)
    except Exception as e:
        print(f"  gsmarena search err: {e}")
        return None
    # First product link in results: <a href="samsung_galaxy_s22_ultra_5g-11251.php" ...
    m = re.search(r'href="([a-z0-9_]+)-(\d+)\.php"', html)
    if not m:
        return None
    underscore_slug = m.group(1)  # samsung_galaxy_s22_ultra_5g
    # Image slug uses dashes, not underscores
    return underscore_slug.replace("_", "-")


def gsmarena_image_url(slug, brand="samsung"):
    """Construct the GSMArena product-image URL for a slug."""
    # Try -1.jpg first (canonical front shot), then -2 -3 if needed
    return f"{GSMARENA_BASE}/{brand}/{slug}-1.jpg"


def commons_search(query):
    """Fallback: search Wikimedia Commons file namespace."""
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
            data = http_get(url, expect_json=True)
            new = [r["title"] for r in data.get("query", {}).get("search", [])]
            for t in new:
                if t not in titles:
                    titles.append(t)
        except Exception as e:
            print(f"  commons search err: {e}")
        time.sleep(0.4)
    return titles


def commons_resolve(file_title):
    params = {
        "action": "query",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json",
    }
    url = COMMONS_API + "?" + urllib.parse.urlencode(params)
    try:
        data = http_get(url, expect_json=True)
        pages = data.get("query", {}).get("pages", {})
        for p in pages.values():
            info = p.get("imageinfo", [])
            if info:
                return info[0].get("url")
    except Exception:
        pass
    return None


def commons_pick(query, titles):
    if not titles:
        return None
    qlower = query.lower()
    qwords = set(w for w in qlower.replace(",", "").split() if len(w) > 1)
    skip_kw = ("logo", "icon", "render", "diagram", "screenshot", "buds", "wordmark", "vp9", "mp4", ".webm", ".mov")
    multidev = ("series", " and ", " & ", ", ", " vs ")
    qhas_fe = "fe" in qwords
    qhas_plus = "+" in query or "plus" in qwords
    qhas_ultra = "ultra" in qwords
    qhas_edge = "edge" in qwords
    scored = []
    for t in titles:
        tl = t.lower()
        if not any(tl.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
            continue
        if any(k in tl for k in skip_kw):
            continue
        score = sum(1 for w in qwords if w in tl) * 2
        if any(m in tl for m in multidev):
            score -= 5
        if not qhas_fe and " fe" in tl:
            score -= 4
        if not qhas_plus and ("plus" in tl or "+" in t):
            score -= 3
        if not qhas_ultra and "ultra" in tl:
            score -= 3
        if not qhas_edge and "edge" in tl:
            score -= 3
        clean = tl.replace("file:", "").rsplit(".", 1)[0]
        if clean.strip() == qlower:
            score += 6
        scored.append((score, t))
    if not scored:
        return None
    scored.sort(reverse=True)
    return scored[0][1] if scored[0][0] > 0 else None


def gsmarena_probe(slug, brand):
    """Try slug variants in /vv/pics/ then /vv/bigpic/ until one returns a valid image."""
    BIGPIC = "https://fdn2.gsmarena.com/vv/bigpic"
    slug_variants = [slug]
    if slug.endswith("-5g"):
        slug_variants.append(slug[:-3])
    else:
        slug_variants.append(slug + "-5g")
    for c in list(slug_variants):
        if "-plus" in c:
            slug_variants.append(c.replace("-plus", ""))
    seen = set()
    # Try /vv/pics/<slug>-N.jpg first (smaller thumbs but commonly available)
    for c in slug_variants:
        if c in seen:
            continue
        seen.add(c)
        for idx in (1, 2, 3):
            url = f"{GSMARENA_BASE}/{brand}/{c}-{idx}.jpg"
            try:
                req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA_BROWSER, "Referer": "https://www.gsmarena.com/"})
                with urllib.request.urlopen(req, timeout=10) as r:
                    if r.status == 200:
                        return url
            except Exception:
                pass
            time.sleep(0.2)
    # Fall back to /vv/bigpic/<slug>.jpg (high-res, no index suffix)
    seen.clear()
    for c in slug_variants:
        if c in seen:
            continue
        seen.add(c)
        for filename in (f"{c}.jpg", f"{c}-1.jpg"):
            url = f"{BIGPIC}/{filename}"
            try:
                req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA_BROWSER, "Referer": "https://www.gsmarena.com/"})
                with urllib.request.urlopen(req, timeout=10) as r:
                    if r.status == 200:
                        return url
            except Exception:
                pass
            time.sleep(0.2)
    return None


def gsmarena_parse_page_for_image(query):
    """Last resort: search GSMArena, fetch the device's product page, parse for image URL."""
    params = urllib.parse.urlencode({"sQuickSearch": "yes", "sName": query})
    search_url = f"{GSMARENA_SEARCH}?{params}"
    try:
        html = http_get(search_url)
    except Exception:
        return None
    m = re.search(r'href="([a-z0-9_]+-\d+\.php)"', html)
    if not m:
        return None
    page_path = m.group(1)
    page_url = f"https://www.gsmarena.com/{page_path}"
    time.sleep(1.0)
    try:
        page_html = http_get(page_url)
    except Exception:
        return None
    # Look for the main product image: <img src="https://fdn2.gsmarena.com/vv/bigpic/...">
    m = re.search(r'<img[^>]+src="(https://fdn2?\.gsmarena\.com/vv/(?:bigpic|pics)/[^"]+\.(?:jpg|jpeg|png))"', page_html)
    return m.group(1) if m else None


def fetch_via_gsmarena(d, query):
    """Returns image URL or None."""
    if d.get("gsmarena_url"):
        return d["gsmarena_url"]
    slug = d.get("gsmarena_slug")
    if not slug:
        slug = gsmarena_search_slug(query)
        time.sleep(1.0)
    if slug:
        brand = d.get("gsmarena_brand", "samsung")
        url = gsmarena_probe(slug, brand)
        if url:
            return url
    # NOTE: page-HTML fallback existed in earlier rev but was unreliable
    # (regex'd the first <img> on a product page, often a sidebar
    # "Recommended" phone, not the actual product). Removed.
    return None


def fetch_via_commons(query):
    titles = commons_search(query)
    chosen = commons_pick(query, titles)
    if not chosen:
        return None
    return commons_resolve(chosen)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    force = "--force" in sys.argv
    source_arg = next((a for a in sys.argv if a.startswith("--source=")), None)
    only_source = source_arg.split("=", 1)[1] if source_arg else None  # gsmarena | commons | None
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
        img_url = None
        # Try GSMArena first unless --source=commons
        if only_source != "commons":
            img_url = fetch_via_gsmarena(d, query)
            if img_url:
                try:
                    http_download(img_url, out)
                    manifest[did] = f"/devices/{did}.jpg"
                    print(f"ok   {did} <- gsmarena {img_url.rsplit('/', 1)[-1]}")
                    ok += 1
                    time.sleep(1.5)
                    continue
                except Exception as e:
                    print(f"  gsmarena 404/err for {did}: {e}")
                    img_url = None
        # Fall back to Commons unless --source=gsmarena
        if only_source != "gsmarena":
            img_url = fetch_via_commons(query)
            if img_url:
                try:
                    http_download(img_url, out)
                    manifest[did] = f"/devices/{did}.jpg"
                    print(f"ok   {did} <- commons {img_url.rsplit('/', 1)[-1][:60]}")
                    ok += 1
                    time.sleep(1.5)
                    continue
                except Exception as e:
                    print(f"  commons err for {did}: {e}")
        print(f"FAIL {did}: no image found")
        fail += 1
        time.sleep(0.5)

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\nDone. ok={ok} skip={skip} fail={fail}. Manifest -> {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
