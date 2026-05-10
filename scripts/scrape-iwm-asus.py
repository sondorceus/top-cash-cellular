#!/usr/bin/env python3
"""Scrape ASUS laptop catalog from itsworthmore.com using Playwright.

IWM's brand pages are JS-rendered, so a plain `curl` returns the page
chrome but no products. This drives a headless Chromium instance with
the cert validation bypass needed by the sandbox env.

Output:
  - public/devices/asus-<series>-<slug>.png  (alpha-keyed phone-style PNGs)
  - scripts/asus-models.json  (model metadata for the page wiring)
"""
import os
import sys
import json
import time
import urllib.request
from urllib.parse import urljoin
from collections import deque
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DEV_DIR = os.path.join(ROOT, "public", "devices")
OUT_JSON = os.path.join(os.path.dirname(__file__), "asus-models.json")

# IWM has irregular nesting per series — some are flat, some need
# 2 levels (republic-of-gamers-strix has the actual models). Each
# entry is (series_id, label, [list of leaf-category-slugs]).
SERIES = [
    ("rog",        "Republic of Gamers", ["republic-of-gamers-strix", "republic-of-gamers-flow", "republic-of-gamers-zephyrus"]),
    ("tuf",        "TUF Gaming",         ["the-ultimate-force-laptop"]),
    ("proart",     "ProArt",             ["proart-laptop"]),
    ("vivobook",   "Vivobook",           ["vivobook-14-laptop", "vivobook-15-laptop", "vivobook-16-laptop"]),
    ("zenbook",    "Zenbook",            ["zenbook-laptop"]),
    ("expertbook", "ExpertBook",         ["expert-laptop"]),
]

BG_CUTOFF = 240


def alpha_key(img):
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    bg_mask = np.minimum(np.minimum(r, g), b) >= BG_CUTOFF
    arr[:, :, 3] = np.where(bg_mask, 0, 255)
    # Corner flood-fill
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
    # Largest connected component
    opaque = arr[:, :, 3] > 50
    labels = np.zeros_like(opaque, dtype=np.int32)
    next_label = 0
    sizes = {}
    for sy in range(h):
        for sx in range(w):
            if not opaque[sy, sx] or labels[sy, sx] != 0:
                continue
            next_label += 1
            size = 0
            cq = deque([(sx, sy)])
            while cq:
                cx, cy = cq.popleft()
                if cx < 0 or cx >= w or cy < 0 or cy >= h:
                    continue
                if not opaque[cy, cx] or labels[cy, cx] != 0:
                    continue
                labels[cy, cx] = next_label
                size += 1
                cq.append((cx + 1, cy)); cq.append((cx - 1, cy))
                cq.append((cx, cy + 1)); cq.append((cx, cy - 1))
            sizes[next_label] = size
    if sizes:
        biggest = max(sizes, key=sizes.get)
        kill = (labels != 0) & (labels != biggest)
        arr[kill, 3] = 0
    out = Image.fromarray(arr, "RGBA")
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def fetch_url(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def find_image_url(html, model_slug):
    """Find an 800x800 IWM image URL for the given model slug in HTML."""
    import re as _re
    pat = _re.compile(
        rf'https://www\.itsworthmore\.com/media/cache/opt-resize/800x800/'
        rf'[\w-]+-{_re.escape(model_slug)}\.(?:webp|jpe?g|png)(?:\.webp)?'
    )
    m = pat.search(html)
    return m.group(0) if m else None


def main():
    os.makedirs(DEV_DIR, exist_ok=True)
    all_models = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--ignore-certificate-errors"],
        )
        ctx = browser.new_context(ignore_https_errors=True, user_agent=UA)
        page = ctx.new_page()

        for series_id, series_label, leaf_slugs in SERIES:
            print(f"\n=== {series_label} ===")
            unique_links = []
            seen = set()
            for leaf in leaf_slugs:
                try:
                    page.goto(
                        f"https://www.itsworthmore.com/sell/{leaf}",
                        wait_until="networkidle", timeout=60000,
                    )
                except Exception as e:
                    print(f"  ! {leaf}: {e}")
                    continue
                links = page.evaluate(
                    f"""() => {{
                        const re = new RegExp('/sell/{leaf}/[a-z0-9-]+$');
                        return Array.from(document.querySelectorAll('a[href]'))
                            .map(a => ({{ href: a.getAttribute('href'),
                                           text: (a.innerText || a.textContent || '').trim().slice(0, 80) }}))
                            .filter(x => x.href && re.test(x.href));
                    }}"""
                )
                for l in links:
                    if l["href"] not in seen:
                        seen.add(l["href"])
                        unique_links.append(l)
            print(f"  found {len(unique_links)} models across {len(leaf_slugs)} sub-cat(s)")

            for ml in unique_links:
                model_slug = ml["href"].split("/")[-1]
                model_label = ml["text"] or model_slug.replace("-", " ").title()
                file_id = f"asus-{series_id}-{model_slug}"
                out_path = os.path.join(DEV_DIR, f"{file_id}.png")

                model_url = urljoin("https://www.itsworthmore.com/", ml["href"])
                # Use plain HTTP for the model page (Chromium DNS gets flaky after many fetches)
                try:
                    html = fetch_url(model_url).decode("utf-8", errors="ignore")
                except Exception as e:
                    print(f"  ! fetch {model_slug}: {e}")
                    continue
                img_url = find_image_url(html, model_slug)
                if not img_url:
                    print(f"  ! {model_slug}: no image")
                    continue

                try:
                    raw = fetch_url(img_url)
                    tmp = os.path.join(DEV_DIR, f"_tmp_{file_id}")
                    with open(tmp, "wb") as f:
                        f.write(raw)
                    img = Image.open(tmp)
                    out = alpha_key(img)
                    out.save(out_path, "PNG", optimize=True)
                    os.remove(tmp)
                    all_models.append({
                        "id": file_id,
                        "series_id": series_id,
                        "series_label": series_label,
                        "model_slug": model_slug,
                        "label": model_label,
                        "image": f"/devices/{file_id}.png",
                    })
                    try:
                        print(f"  OK {file_id}: {out.size}")
                    except Exception:
                        pass
                except Exception as e:
                    print(f"  ! {model_slug} download: {e}")

                time.sleep(0.3)

        browser.close()

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_models, f, indent=2)
    print(f"\nSaved {len(all_models)} models to {OUT_JSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
