#!/usr/bin/env python3
"""Per-model photos for the remaining 4 laptop brands: Lenovo, HP,
Acer, Samsung Galaxy Book. Reads scripts/<brand>-models.json files
and writes per-model PNGs to public/devices/<id>.png.
"""
import os, sys, json, time, re, html as html_lib, urllib.parse, urllib.request, io
from collections import deque
import numpy as np
from PIL import Image

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DEV_DIR = os.path.join(ROOT, "public", "devices")

BRANDS = ["lenovo", "hp", "acer", "samsung_pc"]
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


# Brand-specific search query templates
def query_for(brand, label):
    # Strip trailing escaped-quote artifacts from regex extraction
    label = label.rstrip("\\").strip()
    if brand == "lenovo": return f"{label} Lenovo laptop"
    if brand == "hp": return f"HP {label} laptop"
    if brand == "acer": return f"Acer {label} laptop"
    if brand == "samsung_pc": return f"Samsung {label} laptop"
    return f"{label} laptop"


def main():
    grand_updated = grand_failed = 0
    for brand in BRANDS:
        json_path = os.path.join(ROOT, "scripts", f"{brand}-models.json")
        if not os.path.exists(json_path):
            print(f"!! {json_path} missing, skipping"); continue
        with open(json_path, "r", encoding="utf-8") as f:
            models = json.load(f)
        print(f"\n=== {brand}: {len(models)} models ===")
        updated = failed = 0
        for i, m in enumerate(models, 1):
            file_id = re.sub(r'[^a-z0-9_-]', '', m["id"].lower())
            out = os.path.join(DEV_DIR, f"{file_id}.png")
            q = query_for(brand, m["label"])
            print(f"[{i}/{len(models)}] {q} -> ", end="", flush=True)
            saved = False
            try:
                urls = bing(q, count=8)
            except Exception as e:
                print(f"search-fail: {e}"); failed += 1; continue
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
            if not saved:
                print("no-good-image"); failed += 1
            else:
                updated += 1
            time.sleep(0.4)
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(models, f, indent=2)
        print(f"  -> {brand}: {updated} ok, {failed} failed")
        grand_updated += updated; grand_failed += failed
    print(f"\n=== ALL DONE ===\nupdated: {grand_updated}\nfailed: {grand_failed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
