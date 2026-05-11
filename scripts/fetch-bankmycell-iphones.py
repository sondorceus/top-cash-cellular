#!/usr/bin/env python3
"""Pull iPhone front-view images from bankmycell.com.

Their image URL pattern includes a product-id prefix, so the slug alone
isn't enough — we fetch each /sell/<slug> product page, grep the HTML
for a *-front.png URL pointing into /media/uploads/devices/, and pull
that PNG into public/devices/bm/.

Output goes to public/devices/bm/ so existing /devices/*.webp files
stay untouched until Skywalker greenlights the look.
"""
import os, sys, re, urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
OUT_DIR = os.path.join(ROOT, "public", "devices", "bm")
os.makedirs(OUT_DIR, exist_ok=True)

# variant id -> bankmycell page slug -> our output filename
TARGETS = [
    # iPhone 17 series (may 404 if not in their catalog yet)
    ("ip17pm",   "iphone-17-pro-max",      "iphone-17-pro-max.png"),
    ("ip17p",    "iphone-17-pro",          "iphone-17-pro.png"),
    ("ip17air",  "iphone-17-air",          "iphone-17-air.png"),
    ("ip17plus", "iphone-17-plus",         "iphone-17-plus.png"),
    ("ip17",     "iphone-17",              "iphone-17.png"),
    ("ip17e",    "apple-iphone-17e",       "iphone-17e.png"),
    # iPhone 16
    ("ip16pm",   "iphone-16-pro-max",      "iphone-16-pro-max.png"),
    ("ip16p",    "iphone-16-pro",          "iphone-16-pro.png"),
    ("ip16plus", "iphone-16-plus",         "iphone-16-plus.png"),
    ("ip16",     "iphone-16",              "iphone-16.png"),
    ("ip16e",    "apple-iphone-16e",       "iphone-16e.png"),
    # iPhone 15
    ("ip15pm",   "iphone-15-pro-max",      "iphone-15-pro-max.png"),
    ("ip15p",    "iphone-15-pro",          "iphone-15-pro.png"),
    ("ip15plus", "iphone-15-plus",         "iphone-15-plus.png"),
    ("ip15",     "iphone-15",              "iphone-15.png"),
    # iPhone 14
    ("ip14pm",   "iphone-14-pro-max",      "iphone-14-pro-max.png"),
    ("ip14p",    "iphone-14-pro",          "iphone-14-pro.png"),
    ("ip14plus", "iphone-14-plus",         "iphone-14-plus.png"),
    ("ip14",     "iphone-14",              "iphone-14.png"),
    # iPhone 13
    ("ip13pm",   "iphone-13-pro-max",      "iphone-13-pro-max.png"),
    ("ip13p",    "iphone-13-pro",          "iphone-13-pro.png"),
    ("ip13mini", "iphone-13-mini",         "iphone-13-mini.png"),
    ("ip13",     "iphone-13",              "iphone-13.png"),
    # iPhone 12
    ("ip12pm",   "iphone-12-pro-max",      "iphone-12-pro-max.png"),
    ("ip12p",    "iphone-12-pro",          "iphone-12-pro.png"),
    ("ip12mini", "iphone-12-mini",         "iphone-12-mini.png"),
    ("ip12",     "iphone-12",              "iphone-12.png"),
    # iPhone 11
    ("ip11pm",   "iphone-11-pro-max",      "iphone-11-pro-max.png"),
    ("ip11p",    "iphone-11-pro",          "iphone-11-pro.png"),
    ("ip11",     "iphone-11",              "iphone-11.png"),
    # SE + older
    ("ipse3",    "iphone-se-2022",         "iphone-se-2022.png"),
    ("ipse2",    "iphone-se-2020",         "iphone-se-2020.png"),
    ("ipxs_max", "iphone-xs-max",          "iphone-xs-max.png"),
    ("ipxs",     "iphone-xs",              "iphone-xs.png"),
    ("ipxr",     "iphone-xr",              "iphone-xr.png"),
    ("ipx",      "iphone-x",               "iphone-x.png"),
]

PAGE_HEADERS = {"User-Agent": UA}
IMG_HEADERS  = {"User-Agent": UA, "Referer": "https://www.bankmycell.com/"}
FRONT_PNG = re.compile(r"https://www\.bankmycell\.com/media/uploads/devices/[\w-]+-front[\w]*\.png")


def fetch_url(url, headers, timeout=20):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def main():
    ok, miss = 0, 0
    for vid, slug, out in TARGETS:
        page_url = f"https://www.bankmycell.com/sell/{slug}"
        try:
            html = fetch_url(page_url, PAGE_HEADERS).decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"  -- {vid:10} page {slug}: {e}")
            miss += 1
            continue
        m = FRONT_PNG.search(html)
        if not m:
            print(f"  -- {vid:10} page {slug}: no front.png in HTML")
            miss += 1
            continue
        img_url = m.group(0)
        try:
            data = fetch_url(img_url, IMG_HEADERS)
        except Exception as e:
            print(f"  -- {vid:10} image {img_url}: {e}")
            miss += 1
            continue
        out_path = os.path.join(OUT_DIR, out)
        with open(out_path, "wb") as f:
            f.write(data)
        print(f"  OK {vid:10} -> {out}  ({len(data)} bytes)")
        ok += 1

    print(f"\nDone: {ok} downloaded, {miss} missing")


if __name__ == "__main__":
    sys.exit(main() or 0)
