#!/usr/bin/env python3
"""Re-scrape Galaxy S-series phone images from itsworthmore.com.

The current /devices/gs*.webp set is a mix of two sources with very
different aspect ratios (some 159x211, some ~709x600), which makes the
phones look uneven / "cut off" in the variant list. This grabs the
800x800 image off each IWM product page so all 27 S-series phones share
one clean source. Backs up existing files to /devices/_old/ before
overwriting.
"""
import os
import re
import sys
import shutil
import time
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

# IWM slug -> site model id (matches SAMSUNG_SERIES sseries variants in app/page.tsx)
SLUG_TO_ID = {
    "galaxy-s26-ultra": "gs26u",
    "galaxy-s26-plus": "gs26p",
    "galaxy-s26": "gs26",
    "galaxy-s25-ultra": "gs25u",
    "galaxy-s25-plus": "gs25p",
    "galaxy-s25-edge": "gs25edge",
    "galaxy-s25-fe": "gs25fe",
    "galaxy-s25": "gs25",
    "galaxy-s24-ultra": "gs24u",
    "galaxy-s24-plus": "gs24p",
    "galaxy-s24-fe": "gs24fe",
    "galaxy-s24": "gs24",
    "galaxy-s23-ultra": "gs23u",
    "galaxy-s23-plus": "gs23p",
    "galaxy-s23-fe": "gs23fe",
    "galaxy-s23": "gs23",
    "galaxy-s22-ultra-5g": "gs22u",
    "galaxy-s22-plus-5g": "gs22p",
    "galaxy-s22-5g": "gs22",
    "galaxy-s21-ultra-5g": "gs21u",
    "galaxy-s21-plus-5g": "gs21p",
    "galaxy-s21-fe-5g": "gs21fe",
    "galaxy-s21-5g": "gs21",
    "galaxy-s20-ultra-5g": "gs20u",
    "galaxy-s20-plus-5g": "gs20p",
    "galaxy-s20-fe-5g": "gs20fe",
    "galaxy-s20-5g": "gs20",
}

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
OUT_DIR = os.path.join(ROOT, "public", "devices")
BACKUP_DIR = os.path.join(OUT_DIR, "_old")

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()

def find_800_image(html: str, slug: str) -> str | None:
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
    os.makedirs(BACKUP_DIR, exist_ok=True)

    summary = {"replaced": [], "added": [], "missed": []}

    for slug, model_id in SLUG_TO_ID.items():
        out_webp = os.path.join(OUT_DIR, f"{model_id}.webp")
        out_png = os.path.join(OUT_DIR, f"{model_id}.png")
        out_jpg = os.path.join(OUT_DIR, f"{model_id}.jpg")
        existing = next((p for p in (out_webp, out_png, out_jpg) if os.path.exists(p)), None)

        page_url = f"https://www.itsworthmore.com/sell/galaxy-s-series/{slug}"
        try:
            html = fetch(page_url).decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"  ! page fetch failed for {slug}: {e}")
            summary["missed"].append(model_id)
            continue

        img_url = find_800_image(html, slug)
        if not img_url:
            print(f"  ! no 800x800 image found for {slug}")
            summary["missed"].append(model_id)
            continue

        if img_url.endswith(".webp"):
            out_path = out_webp
        elif img_url.endswith(".png"):
            out_path = out_png
        else:
            out_path = out_jpg

        # Backup the old file (whatever extension) before overwriting
        if existing:
            backup_path = os.path.join(BACKUP_DIR, os.path.basename(existing))
            try:
                shutil.copy2(existing, backup_path)
            except Exception:
                pass

        try:
            data = fetch(img_url)
            # If the new file uses a different extension than the existing one,
            # remove the existing so we don't double-serve
            if existing and existing != out_path:
                try: os.remove(existing)
                except Exception: pass
            with open(out_path, "wb") as f:
                f.write(data)
            tag = "replaced" if existing else "added"
            summary[tag].append(model_id)
            try:
                print(f"  OK {model_id}: {len(data)/1024:.1f} KB ({tag}) -> {os.path.relpath(out_path, ROOT)}")
            except Exception:
                pass
        except Exception as e:
            print(f"  ! download failed for {slug}: {e}")
            summary["missed"].append(model_id)

        time.sleep(0.3)  # polite

    print()
    print(f"Replaced: {len(summary['replaced'])} ({', '.join(summary['replaced']) or '-'})")
    print(f"Added:    {len(summary['added'])} ({', '.join(summary['added']) or '-'})")
    print(f"Missed:   {len(summary['missed'])} ({', '.join(summary['missed']) or '-'})")
    return 0 if not summary["missed"] else 1

if __name__ == "__main__":
    sys.exit(main())
