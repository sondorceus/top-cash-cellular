#!/usr/bin/env python3
"""Fetch a per-model product photo for every Dell laptop in dell-models.json.

IWM doesn't expose individual product-detail pages for Dell (they use a
quiz UI), so we can't reuse the IWM image pipeline. Instead we hit Bing
image search for each model, pick the first result that looks like a
laptop product shot, alpha-key white background, and save under
public/devices/.

Updates dell-models.json in place with the new per-model image paths.
"""
import os
import sys
import json
import time
import re
import html as html_lib
import urllib.parse
import urllib.request
from collections import deque
import numpy as np
from PIL import Image
import io

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DEV_DIR = os.path.join(ROOT, "public", "devices")
JSON_PATH = os.path.join(os.path.dirname(__file__), "dell-models.json")

BG_CUTOFF = 240


def alpha_key(img):
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    bg_mask = np.minimum(np.minimum(r, g), b) >= BG_CUTOFF
    arr[:, :, 3] = np.where(bg_mask, 0, 255)
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for cx, cy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        q.append((cx, cy))
    while q:
        x, y = q.popleft()
        if x < 0 or x >= w or y < 0 or y >= h or visited[y, x]:
            continue
        visited[y, x] = True
        if min(arr[y, x, 0], arr[y, x, 1], arr[y, x, 2]) < 200:
            continue
        arr[y, x, 3] = 0
        q.append((x + 1, y)); q.append((x - 1, y))
        q.append((x, y + 1)); q.append((x, y - 1))
    out = Image.fromarray(arr, "RGBA")
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def bing_image_search(query, count=5):
    # Bing's /images/search page only ships 1 anchor inline (rest are dynamic).
    # The async endpoint returns 30+ results in one HTML chunk. No API key needed.
    url = f"https://www.bing.com/images/async?q={urllib.parse.quote(query)}&first=0&count=35"
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,*/*",
        "Accept-Language": "en-US,en;q=0.5",
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8", errors="ignore")
    # The iusc anchor's `m` attribute holds JSON with the original image URL
    pat = re.compile(r'class="iusc"[^>]*m="([^"]+)"')
    matches = pat.findall(body)
    results = []
    for m in matches:
        m = html_lib.unescape(m)
        try:
            data = json.loads(m)
            url = data.get("murl") or data.get("turl")
            if url:
                results.append(url)
        except Exception:
            continue
        if len(results) >= count:
            break
    return results


def download(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def acceptable(img):
    """Filter: laptop product shots are usually 400x300+ with aspect 0.6-1.6."""
    if img.size[0] < 400 or img.size[1] < 250:
        return False
    aspect = img.size[0] / img.size[1]
    if aspect < 0.5 or aspect > 2.2:
        return False
    return True


def main():
    if not os.path.exists(JSON_PATH):
        print(f"!! {JSON_PATH} not found")
        return 1
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        models = json.load(f)
    print(f"Processing {len(models)} models")

    # Skip already-done if marked
    skip_existing = "--keep" in sys.argv

    updated = 0
    failed = 0
    for i, m in enumerate(models, 1):
        file_id = f"dell-{m['series_id']}-{m['sub_id']}-{m['id'].split('_', 2)[-1]}"
        # Sanitize file_id
        file_id = re.sub(r'[^a-z0-9_-]', '', file_id.lower().replace(' ', '-'))[:80]
        out_path = os.path.join(DEV_DIR, f"{file_id}.png")
        if skip_existing and os.path.exists(out_path):
            m["image"] = f"/devices/{file_id}.png"
            continue

        query = f"{m['label']} Dell laptop"
        print(f"[{i}/{len(models)}] {query} -> ", end="", flush=True)
        try:
            urls = bing_image_search(query, count=8)
        except Exception as e:
            print(f"search-fail: {e}")
            failed += 1
            time.sleep(1.5)
            continue
        saved = False
        for url in urls:
            try:
                raw = download(url, timeout=12)
                img = Image.open(io.BytesIO(raw))
                if not acceptable(img):
                    continue
                # Alpha key white bg if it has one
                cleaned = alpha_key(img)
                cleaned.save(out_path, "PNG", optimize=True)
                m["image"] = f"/devices/{file_id}.png"
                updated += 1
                saved = True
                print(f"OK {cleaned.size}")
                break
            except Exception as e:
                continue
        if not saved:
            print("no-good-image")
            failed += 1
        # Polite pacing
        time.sleep(0.6)

    # Save updated JSON
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(models, f, indent=2)
    print(f"\n=== done ===\nupdated: {updated}\nfailed: {failed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
