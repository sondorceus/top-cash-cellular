#!/usr/bin/env python3
"""One-off: strip the background off Skywalker's manually-cleaned iPhone
test images so they sit clean on the dark site bg.

Auto-detects whether the bg is light or dark by sampling the four corners:
- Light bg (>=200): drop any pixel near-white by min(R,G,B) >= BG_CUTOFF,
  then flood-fill from corners to catch JPG noise.
- Dark bg (<200):  use the corner color as the reference and drop any
  pixel within a delta of it. This handles dark studio backdrops like
  the iPhone 17 regular shot where corners are ~(52,52,52).
"""
import os
import sys
from collections import deque
from PIL import Image
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DEV_DIR = os.path.join(ROOT, "public", "devices")

TARGETS = [
    # 17 Pro Max is already alpha-keyed; only process the regular 17 here.
    "iphone-17-test.png",
]

LIGHT_BG_CUTOFF = 215
LIGHT_FLOOD_THRESHOLD = 175
DARK_BG_DELTA = 18   # if pixel distance from corner color <= delta -> bg
DARK_FLOOD_DELTA = 28


def color_dist(a, b):
    return max(abs(a[0]-b[0]), abs(a[1]-b[1]), abs(a[2]-b[2]))


def alpha_key_light(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if min(r, g, b) >= LIGHT_BG_CUTOFF:
                px[x, y] = (r, g, b, 0)
            else:
                px[x, y] = (r, g, b, 255)
    flood_kill(rgba, lambda r,g,b: min(r,g,b) >= LIGHT_FLOOD_THRESHOLD)
    return keep_largest_blob(rgba)


def alpha_key_dark(img: Image.Image, corner_color) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    cr, cg, cb = corner_color
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if color_dist((r, g, b), (cr, cg, cb)) <= DARK_BG_DELTA:
                px[x, y] = (r, g, b, 0)
            else:
                px[x, y] = (r, g, b, 255)
    flood_kill(rgba, lambda r,g,b: color_dist((r,g,b),(cr,cg,cb)) <= DARK_FLOOD_DELTA)
    return keep_largest_blob(rgba)


def flood_kill(rgba: Image.Image, is_bg):
    w, h = rgba.size
    px = rgba.load()
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
        if not is_bg(r, g, b):
            continue
        px[x, y] = (r, g, b, 0)
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))


def keep_largest_blob(rgba: Image.Image) -> Image.Image:
    arr = np.array(rgba)
    h, w = arr.shape[:2]
    opaque = arr[:, :, 3] > 50
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
    return Image.fromarray(arr, "RGBA")


def main():
    for fname in TARGETS:
        path = os.path.join(DEV_DIR, fname)
        if not os.path.exists(path):
            print(f"  !! missing {path}")
            continue
        img = Image.open(path)
        rgb = img.convert("RGB")
        w, h = rgb.size
        corners = [rgb.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
        avg_corner = tuple(int(sum(c[i] for c in corners) / 4) for i in range(3))
        is_light = min(avg_corner) >= 200
        if is_light:
            out = alpha_key_light(img)
            mode = "light"
        else:
            out = alpha_key_dark(img, avg_corner)
            mode = f"dark({avg_corner})"
        bbox = out.getbbox()
        if bbox:
            out = out.crop(bbox)
        out.save(path, "PNG", optimize=True)
        print(f"  OK {fname}: {mode} -> {out.size}")


if __name__ == "__main__":
    sys.exit(main() or 0)
