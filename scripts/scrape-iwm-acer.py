#!/usr/bin/env python3
"""Scrape Acer laptop catalog from IWM. Tree per probe 2026-05-10:
  Nitro (5: Nitro 5/7/16/17/V)
  Predator (2: Triton, Helios)
IWM doesn't carry Aspire / Swift — strict comp mirror drops them.
"""
import os, sys, json, time, re, urllib.request, io
from collections import deque
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DEV_DIR = os.path.join(ROOT, "public", "devices")
OUT_JSON = os.path.join(os.path.dirname(__file__), "acer-iwm-models.json")

SERIES = [
    ("nitro", "Nitro", [("", "", "acer-nitro")]),
    ("predator", "Predator", [("", "", "acer-predator")]),
]
BG_CUTOFF = 240


def alpha_key(img):
    rgba = img.convert("RGBA"); arr = np.array(rgba)
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    bg_mask = np.minimum(np.minimum(r, g), b) >= BG_CUTOFF
    arr[:, :, 3] = np.where(bg_mask, 0, 255)
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for cx, cy in ((0,0),(w-1,0),(0,h-1),(w-1,h-1)): q.append((cx,cy))
    while q:
        x, y = q.popleft()
        if x<0 or x>=w or y<0 or y>=h or visited[y,x]: continue
        visited[y,x] = True
        if min(arr[y,x,0], arr[y,x,1], arr[y,x,2]) < 200: continue
        arr[y,x,3] = 0
        q.append((x+1,y)); q.append((x-1,y)); q.append((x,y+1)); q.append((x,y-1))
    out = Image.fromarray(arr, "RGBA")
    bb = out.getbbox()
    return out.crop(bb) if bb else out


def fetch_url(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def find_image_url(html, model_slug):
    pat = re.compile(
        rf'https://www\.itsworthmore\.com/media/cache/opt-resize/800x800/'
        rf'[\w-]+-{re.escape(model_slug)}\.(?:webp|jpe?g|png)(?:\.webp)?'
    )
    m = pat.search(html)
    return m.group(0) if m else None


JS = """(leafFinal) => {
    const re = new RegExp('/sell/' + leafFinal + '/[a-z0-9-]+');
    const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.getAttribute('href') || '',
                     text: (a.innerText || a.textContent || '').trim().split('\\n')[0].trim() }))
        .filter(x => re.test(x.href));
    return { links };
}"""


def main():
    os.makedirs(DEV_DIR, exist_ok=True)
    all_models = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        ctx = b.new_context(ignore_https_errors=True, user_agent=UA)
        pg = ctx.new_page()
        pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
        try: pg.click('button:has-text("Accept")', timeout=3000); pg.wait_for_timeout(500)
        except Exception: pass

        for series_id, series_label, sub_leaves in SERIES:
            print(f"\n=== {series_label} ===")
            for sub_id, sub_label, leaf_path in sub_leaves:
                pg.goto(f"https://www.itsworthmore.com/sell/{leaf_path}", wait_until="networkidle", timeout=45000)
                pg.wait_for_timeout(700)
                leaf_final = leaf_path.split("/")[-1]
                info = pg.evaluate(JS, leaf_final)
                seen = set(); unique = []
                for l in info["links"]:
                    if l["href"] in seen: continue
                    seen.add(l["href"]); unique.append(l)
                print(f"  {len(unique)} links")

                for ml in unique:
                    slug = ml["href"].split("/")[-1]
                    label = ml["text"] or slug.replace("-", " ").title()
                    file_id = re.sub(r'[^a-z0-9_-]', '', f"acer-{series_id}-{slug}".lower())[:80]
                    out = os.path.join(DEV_DIR, f"{file_id}.png")
                    url = f"https://www.itsworthmore.com{ml['href']}" if ml["href"].startswith("/") else ml["href"]
                    try:
                        html = fetch_url(url).decode("utf-8", errors="ignore")
                    except Exception as e:
                        print(f"    ! fetch {slug}: {e}"); continue
                    img_url = find_image_url(html, slug)
                    record = {"id": file_id, "series_id": series_id, "series_label": series_label,
                              "model_slug": slug, "label": label, "image": ""}
                    if img_url:
                        try:
                            raw = fetch_url(img_url)
                            img = Image.open(io.BytesIO(raw))
                            cleaned = alpha_key(img)
                            cleaned.save(out, "PNG", optimize=True)
                            record["image"] = f"/devices/{file_id}.png"
                            print(f"    OK {slug}: {cleaned.size}")
                        except Exception as e:
                            print(f"    ! image {slug}: {e}")
                    else:
                        print(f"    -- {slug}: no image")
                    all_models.append(record)
                    time.sleep(0.25)
        b.close()

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_models, f, indent=2)
    print(f"\nSaved {len(all_models)} models")


if __name__ == "__main__":
    sys.exit(main() or 0)
