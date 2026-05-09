#!/usr/bin/env python3
"""Convert GSMArena bigpic JPEGs to transparent-background PNGs.

The site is dark mode; opaque white backgrounds around each phone
look bad. This crops just the right half (front view) of each bigpic,
removes the white background by alpha-keying near-white pixels, and
saves as PNG. The phone shape sits cleanly on whatever bg the page uses.
"""
import os
import sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DEV_DIR = os.path.join(ROOT, "public", "devices")

PHONES = [
    "gs26u", "gs26p", "gs26",
    "gs25u", "gs25p", "gs25edge", "gs25fe", "gs25",
    "gs24u", "gs24p", "gs24fe", "gs24",
    "gs23u", "gs23p", "gs23fe", "gs23",
    "gs22u", "gs22p", "gs22",
    "gs21u", "gs21p", "gs21fe", "gs21",
    "gs20u", "gs20p", "gs20fe", "gs20",
]

WHITE_THRESHOLD = 240  # pixels with all RGB >= this become transparent

def alpha_key(img: Image.Image) -> Image.Image:
    """Return RGBA image with near-white pixels made transparent.

    Soft alpha is applied based on how close to white the pixel is, so
    the phone's anti-aliased edges blend cleanly instead of looking jagged.
    """
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            # how close to white (0=pure white, higher=more colored)
            min_rgb = min(r, g, b)
            if min_rgb >= WHITE_THRESHOLD:
                # full transparent for very white pixels
                px[x, y] = (r, g, b, 0)
            elif min_rgb >= 220:
                # soft falloff for near-white anti-aliased edges
                alpha = int(255 * (WHITE_THRESHOLD - min_rgb) / (WHITE_THRESHOLD - 220))
                px[x, y] = (r, g, b, alpha)
    return rgba

def process(phone_id: str) -> bool:
    jpg_path = os.path.join(DEV_DIR, f"{phone_id}.jpg")
    png_path = os.path.join(DEV_DIR, f"{phone_id}.png")
    if not os.path.exists(jpg_path):
        print(f"  ! missing {jpg_path}")
        return False
    img = Image.open(jpg_path).convert("RGB")
    w, h = img.size
    front = img.crop((w // 2, 0, w, h))  # 80x212
    transparent = alpha_key(front)
    # crop alpha bbox so the PNG isn't padded with empty pixels
    bbox = transparent.getbbox()
    if bbox:
        transparent = transparent.crop(bbox)
    transparent.save(png_path, "PNG", optimize=True)
    os.remove(jpg_path)  # don't double-serve; keep only the png
    print(f"  OK {phone_id}: {transparent.size}")
    return True

def main() -> int:
    ok = 0
    miss = 0
    for pid in PHONES:
        if process(pid):
            ok += 1
        else:
            miss += 1
    print()
    print(f"OK: {ok}  Missed: {miss}")
    return 0 if miss == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
