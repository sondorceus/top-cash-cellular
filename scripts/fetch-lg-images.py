#!/usr/bin/env python3
"""Per-model photos for the 24 LG laptops via Bing image search.
Same pipeline as fetch-dell-images.py — model codes (17Z90S, 16Z90R)
are very searchable so quality should be high.
"""
import os, sys, json, time, re, html as html_lib, urllib.parse, urllib.request, io
from collections import deque
import numpy as np
from PIL import Image

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DEV_DIR = os.path.join(ROOT, "public", "devices")
JSON_PATH = os.path.join(os.path.dirname(__file__), "lg-models.json")

BG_CUTOFF = 240


def alpha_key(img):
    rgba = img.convert("RGBA"); arr = np.array(rgba)
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
        if x < 0 or x >= w or y < 0 or y >= h or visited[y, x]: continue
        visited[y, x] = True
        if min(arr[y, x, 0], arr[y, x, 1], arr[y, x, 2]) < 200: continue
        arr[y, x, 3] = 0
        q.append((x+1, y)); q.append((x-1, y)); q.append((x, y+1)); q.append((x, y-1))
    out = Image.fromarray(arr, "RGBA")
    bb = out.getbbox()
    return out.crop(bb) if bb else out


def bing(query, count=8):
    url = f"https://www.bing.com/images/async?q={urllib.parse.quote(query)}&first=0&count=35"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    with urllib.request.urlopen(req, timeout=20) as r:
        body = r.read().decode("utf-8", errors="ignore")
    out = []
    for m in re.findall(r'class="iusc"[^>]*m="([^"]+)"', body):
        try:
            d = json.loads(html_lib.unescape(m))
            if d.get("murl"): out.append(d["murl"])
        except: pass
        if len(out) >= count: break
    return out


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=12) as r:
        return r.read()


def acceptable(img):
    if img.size[0] < 400 or img.size[1] < 250: return False
    a = img.size[0] / img.size[1]
    return 0.5 <= a <= 2.2


def main():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        models = json.load(f)
    updated = failed = 0
    for i, m in enumerate(models, 1):
        # extract model code in parens (e.g., "17Z90S")
        code_m = re.search(r"\(([A-Z0-9]{4,8})", m["label"])
        code = code_m.group(1) if code_m else m["label"]
        file_id = re.sub(r'[^a-z0-9_-]', '', m["id"].lower().replace(' ', '-'))
        out = os.path.join(DEV_DIR, f"{file_id}.png")
        # Try the model code first (very specific), fall back to full label
        queries = [f"LG {code} laptop", f"{m['label']} LG laptop"]
        saved = False
        for q in queries:
            print(f"[{i}/{len(models)}] {q} -> ", end="", flush=True)
            try:
                urls = bing(q, count=8)
            except Exception as e:
                print(f"search-fail: {e}"); continue
            for url in urls:
                try:
                    raw = download(url)
                    img = Image.open(io.BytesIO(raw))
                    if not acceptable(img): continue
                    cleaned = alpha_key(img)
                    cleaned.save(out, "PNG", optimize=True)
                    m["image"] = f"/devices/{file_id}.png"
                    print(f"OK {cleaned.size}")
                    saved = True; break
                except Exception:
                    continue
            if saved: break
            print("retry")
        if saved: updated += 1
        else: failed += 1; print("  - no image")
        time.sleep(0.4)
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(models, f, indent=2)
    print(f"\n=== done ===\nupdated: {updated}\nfailed: {failed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
