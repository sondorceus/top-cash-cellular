#!/usr/bin/env python3
"""Fetch DJI drone hero PNGs from Swappa for each variant we just priced.

For each id in iwm-drone-adjustments.json, try https://swappa.com/buy/{slug}
and extract the first /images/cache/.../*.png. Save to public/devices/{id}.png.

Run:
  python3 scripts/scrape-swappa-dji.py
  python3 scripts/scrape-swappa-dji.py --dry-run
"""
from __future__ import annotations
import json, re, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "iwm-drone-adjustments.json"
DEVICES = ROOT / "public" / "devices"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def vid_from_slug(slug):
    return slug.replace("dji-drone-", "dji-").replace("-", "_").replace("dji_", "dji_")


def swappa_slug(slug):
    # Strip "dji-drone-" and prepend "dji-" -> e.g. dji-mavic-3-pro
    return "dji-" + slug.replace("dji-drone-", "")


def fetch(url, accept_404=True, retries=2):
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404 and accept_404:
                return None
            time.sleep(1)
        except Exception:
            time.sleep(1)
    return None


def find_hero_image(html_bytes):
    if not html_bytes:
        return None
    html = html_bytes.decode("utf-8", "ignore")
    # Skip favicon — find first /images/cache/.../*.png
    m = re.search(r'https://static\.swappa\.com/images/cache/[a-f0-9/]+\.png', html)
    return m.group(0) if m else None


def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    d = json.loads(SRC.read_text(encoding="utf-8"))
    DEVICES.mkdir(parents=True, exist_ok=True)
    results = {}
    for key, entry in d.items():
        if entry.get("iwm_flawless", 0) <= 0:
            continue
        slug = entry["model"]
        vid = vid_from_slug(slug)
        sslug = swappa_slug(slug)
        url = f"https://swappa.com/buy/{sslug}"
        print(f"[{vid}] {url}", flush=True)
        html = fetch(url)
        if html is None:
            print(f"   no page (404)", flush=True)
            results[vid] = {"swappa_slug": sslug, "found": False}
            continue
        img_url = find_hero_image(html)
        if not img_url:
            print(f"   no image", flush=True)
            results[vid] = {"swappa_slug": sslug, "found": False}
            continue
        dst = DEVICES / f"{vid}.png"
        if dry:
            print(f"   would save {img_url} -> {dst.name}", flush=True)
        else:
            img = fetch(img_url, accept_404=False)
            if img:
                dst.write_bytes(img)
                print(f"   saved {dst.name} ({len(img)} bytes)", flush=True)
                results[vid] = {"swappa_slug": sslug, "found": True, "img_url": img_url, "size": len(img)}
            else:
                results[vid] = {"swappa_slug": sslug, "found": False, "error": "download_failed"}
        time.sleep(0.4)  # be polite
    out = ROOT / "swappa-dji-images.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    found = sum(1 for r in results.values() if r.get("found"))
    print(f"\nDone. {found}/{len(results)} found. -> {out}", flush=True)


if __name__ == "__main__":
    main()
