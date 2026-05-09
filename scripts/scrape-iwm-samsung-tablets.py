#!/usr/bin/env python3
"""Scrape Samsung Galaxy Tab images from itsworthmore.com.

Pulls the 800x800 webp from each product page and saves to public/devices/
under the matching slug. Skips tablets we already have an image for.
"""
import os
import re
import sys
import time
import urllib.request
import urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

# Full Galaxy Tab catalog from itsworthmore.com /sell/samsung-tablet
SLUGS = [
    "galaxy-tab-s11-ultra",
    "galaxy-tab-s11",
    "galaxy-tab-s10-ultra",
    "galaxy-tab-s10-plus",
    "galaxy-tab-s10-lite",
    "galaxy-tab-s10-fe-plus",
    "galaxy-tab-s10-fe",
    "galaxy-tab-s9-ultra",
    "galaxy-tab-s9-plus",
    "galaxy-tab-s9-fe-plus",
    "galaxy-tab-s9-fe",
    "galaxy-tab-s9",
    "galaxy-tab-s8-ultra",
    "galaxy-tab-s8-plus",
    "galaxy-tab-s8",
    "galaxy-tab-s7-plus",
    "galaxy-tab-s7-fe",
    "galaxy-tab-s7",
    "galaxy-tab-s6-lite",
    "galaxy-tab-s6",
    "galaxy-tab-s5e",
    "galaxy-tab-s4-105",
]

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
OUT_DIR = os.path.join(ROOT, "public", "devices")

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()

def find_800_image(html: str, slug: str) -> str | None:
    # Match the 800x800 variant for this slug; prefer .jpg.webp if present.
    pat_webp = re.compile(rf'https://www\.itsworthmore\.com/media/cache/opt-resize/800x800/[\w-]+-{re.escape(slug)}\.jpg\.webp')
    pat_jpg = re.compile(rf'https://www\.itsworthmore\.com/media/cache/opt-resize/800x800/[\w-]+-{re.escape(slug)}\.jpg(?!\.)')
    pat_png = re.compile(rf'https://www\.itsworthmore\.com/media/cache/opt-resize/800x800/[\w-]+-{re.escape(slug)}\.png')
    for pat in (pat_webp, pat_jpg, pat_png):
        m = pat.search(html)
        if m:
            return m.group(0)
    return None

def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    summary = {"downloaded": [], "skipped_exists": [], "missed": []}

    for slug in SLUGS:
        # Determine output path. Prefer .webp; if image is png, use .png.
        webp_path = os.path.join(OUT_DIR, f"{slug}.webp")
        png_path = os.path.join(OUT_DIR, f"{slug}.png")
        jpg_path = os.path.join(OUT_DIR, f"{slug}.jpg")
        if any(os.path.exists(p) for p in (webp_path, png_path, jpg_path)):
            summary["skipped_exists"].append(slug)
            continue

        page_url = f"https://www.itsworthmore.com/sell/samsung-tablet/{slug}"
        try:
            html = fetch(page_url).decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"  ! fetch page failed for {slug}: {e}")
            summary["missed"].append(slug)
            continue

        img_url = find_800_image(html, slug)
        if not img_url:
            print(f"  ! no 800x800 image found on {page_url}")
            summary["missed"].append(slug)
            continue

        # Match output extension to source extension
        if img_url.endswith(".webp"):
            out_path = webp_path
        elif img_url.endswith(".png"):
            out_path = png_path
        else:
            out_path = jpg_path

        try:
            data = fetch(img_url)
            with open(out_path, "wb") as f:
                f.write(data)
            summary["downloaded"].append(slug)
            try:
                print(f"  OK {slug}: {len(data)/1024:.1f} KB -> {os.path.relpath(out_path, ROOT)}")
            except Exception:
                pass  # printing the path may fail on cp1252 consoles; the file still wrote
        except Exception as e:
            print(f"  ! download failed for {slug}: {e}")
            summary["missed"].append(slug)

        time.sleep(0.3)  # polite

    print()
    print(f"Downloaded:  {len(summary['downloaded'])} ({', '.join(summary['downloaded']) or '-'})")
    print(f"Already had: {len(summary['skipped_exists'])} ({', '.join(summary['skipped_exists']) or '-'})")
    print(f"Missed:      {len(summary['missed'])} ({', '.join(summary['missed']) or '-'})")
    return 0 if not summary["missed"] else 1

if __name__ == "__main__":
    sys.exit(main())
