#!/usr/bin/env python3
"""Convert GSMArena bigpic JPEGs to transparent-background PNGs.

The site is dark mode; opaque white backgrounds around each phone
look bad. This crops just the right half (front view) of each bigpic,
removes the white background by alpha-keying near-white pixels, and
saves as PNG. The phone shape sits cleanly on whatever bg the page uses.
"""
import os
import sys
from collections import deque
import numpy as np
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
    # Note series
    "gnote20u", "gnote20", "gnote10p5g", "gnote10p", "gnote10", "gnote9",
    # Z Fold/Flip series
    "gztrifold",
    "gzfold7", "gzfold6", "gzfold5", "gzfold4", "gzfold3",
    "gzflip7", "gzflip6", "gzflip5", "gzflip4", "gzflip3",
]

BG_CUTOFF = 220  # min_rgb >= this -> bg, alpha 0
FLOOD_THRESHOLD = 180  # corner flood-fill catches bg pixels above this
# Binary alpha (no soft falloff) — soft anti-aliased edges turned into
# semi-transparent grey halos on the dark site bg, so we hard-cut instead.

def alpha_key(img: Image.Image) -> Image.Image:
    """Return RGBA image with bg pixels made transparent.

    Two-pass:
      1. Per-pixel: pixels with min(R,G,B) >= BG_CUTOFF -> alpha 0;
         pixels in [SOFT_FLOOR, BG_CUTOFF) get soft alpha for clean
         anti-aliased phone edges.
      2. Corner flood-fill with looser threshold (FLOOD_THRESHOLD)
         catches JPG-compression noise in the bg that pass-1 missed.
         Only pixels reachable from the image corners get killed —
         interior near-white phone areas (silver bodies, screen
         highlights) stay opaque.
    """
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    # pass 1: binary alpha — pixels are either fully transparent or fully opaque
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if min(r, g, b) >= BG_CUTOFF:
                px[x, y] = (r, g, b, 0)
            else:
                px[x, y] = (r, g, b, 255)

    # pass 2: flood-fill from corners
    visited = [[False] * w for _ in range(h)]
    q: deque = deque()
    for cx, cy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        q.append((cx, cy))
    while q:
        x, y = q.popleft()
        if x < 0 or x >= w or y < 0 or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        r, g, b, _ = px[x, y]
        if min(r, g, b) < FLOOD_THRESHOLD:
            continue  # hit phone body, stop
        # this pixel is bg-connected -> force transparent
        px[x, y] = (r, g, b, 0)
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))

    # pass 3: keep only the largest connected component of opaque pixels.
    # Tiny isolated noise specks (JPG artifacts dark enough to escape the
    # flood-fill) get killed off so they don't show as dots on dark bg.
    arr = np.array(rgba)
    opaque = arr[:, :, 3] > 50  # binary mask: where the phone (and any noise) is
    labels = np.zeros_like(opaque, dtype=np.int32)
    next_label = 0
    sizes: dict[int, int] = {}
    for sy in range(h):
        for sx in range(w):
            if not opaque[sy, sx] or labels[sy, sx] != 0:
                continue
            next_label += 1
            size = 0
            cq: deque = deque([(sx, sy)])
            while cq:
                cx, cy = cq.popleft()
                if cx < 0 or cx >= w or cy < 0 or cy >= h:
                    continue
                if not opaque[cy, cx] or labels[cy, cx] != 0:
                    continue
                labels[cy, cx] = next_label
                size += 1
                cq.append((cx + 1, cy))
                cq.append((cx - 1, cy))
                cq.append((cx, cy + 1))
                cq.append((cx, cy - 1))
            sizes[next_label] = size
    if sizes:
        biggest = max(sizes, key=sizes.get)
        kill_mask = (labels != 0) & (labels != biggest)
        arr[kill_mask, 3] = 0
    rgba = Image.fromarray(arr, "RGBA")

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
