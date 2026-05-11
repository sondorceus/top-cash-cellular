#!/usr/bin/env python3
"""End-to-end processor for Skywalker's raw phone uploads.

Pipeline:
  1. alpha-key (auto light or dark bg)
  2. crop to phone bbox
  3. kill near-white halo (anti-aliasing artifacts)
  4. letterbox into an 800x1000 canvas with 6% margin

usage: process-upload.py <src> <out>
"""
import os
import sys
from collections import deque
from PIL import Image
import numpy as np

TARGET_W, TARGET_H = 800, 1000
MARGIN_PCT = 0.06

LIGHT_BG_CUTOFF = 215
LIGHT_FLOOD_THRESHOLD = 175
DARK_BG_DELTA = 22
DARK_FLOOD_DELTA = 32

# Halo killer (final pass to remove anti-aliased white edges).
HALO_NEAR_WHITE = 205
HALO_NEAR_WHITE_OPAQUE = 240

def color_dist(a, b):
    return max(abs(a[0]-b[0]), abs(a[1]-b[1]), abs(a[2]-b[2]))

def flood_kill(rgba, is_bg):
    w, h = rgba.size
    px = rgba.load()
    visited = [[False]*w for _ in range(h)]
    q = deque()
    for cx, cy in ((0,0),(w-1,0),(0,h-1),(w-1,h-1)):
        q.append((cx, cy))
    while q:
        x, y = q.popleft()
        if x<0 or x>=w or y<0 or y>=h or visited[y][x]: continue
        visited[y][x] = True
        r, g, b, _ = px[x,y]
        if not is_bg(r,g,b): continue
        px[x,y] = (r,g,b,0)
        q.append((x+1,y)); q.append((x-1,y)); q.append((x,y+1)); q.append((x,y-1))

def keep_largest_blob(rgba):
    arr = np.array(rgba)
    h, w = arr.shape[:2]
    opaque = arr[:,:,3] > 50
    labels = np.zeros_like(opaque, dtype=np.int32)
    next_label = 0
    sizes = {}
    for sy in range(h):
        for sx in range(w):
            if not opaque[sy,sx] or labels[sy,sx] != 0:
                continue
            next_label += 1
            size = 0
            cq = deque([(sx,sy)])
            while cq:
                cx,cy = cq.popleft()
                if cx<0 or cx>=w or cy<0 or cy>=h:
                    continue
                if not opaque[cy,cx] or labels[cy,cx] != 0:
                    continue
                labels[cy,cx] = next_label
                size += 1
                cq.append((cx+1,cy)); cq.append((cx-1,cy))
                cq.append((cx,cy+1)); cq.append((cx,cy-1))
            sizes[next_label] = size
    if sizes:
        biggest = max(sizes, key=sizes.get)
        kill_mask = (labels != 0) & (labels != biggest)
        arr[kill_mask, 3] = 0
    return Image.fromarray(arr, "RGBA")

def alpha_key_auto(img):
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    # If image already has transparency around the edges, just halo-kill.
    # Otherwise detect light vs dark bg from corner sample.
    corner_alpha = min(px[0,0][3], px[w-1,0][3], px[0,h-1][3], px[w-1,h-1][3])
    if corner_alpha < 10:
        # already keyed — nothing to flood
        return rgba
    rgb_corners = [px[p][:3] for p in ((0,0),(w-1,0),(0,h-1),(w-1,h-1))]
    avg = tuple(int(sum(c[i] for c in rgb_corners)/4) for i in range(3))
    if min(avg) >= 200:
        # light bg
        for y in range(h):
            for x in range(w):
                r,g,b,_ = px[x,y]
                if min(r,g,b) >= LIGHT_BG_CUTOFF:
                    px[x,y] = (r,g,b,0)
                else:
                    px[x,y] = (r,g,b,255)
        flood_kill(rgba, lambda r,g,b: min(r,g,b) >= LIGHT_FLOOD_THRESHOLD)
    else:
        # dark bg
        cr,cg,cb = avg
        for y in range(h):
            for x in range(w):
                r,g,b,_ = px[x,y]
                if color_dist((r,g,b),(cr,cg,cb)) <= DARK_BG_DELTA:
                    px[x,y] = (r,g,b,0)
                else:
                    px[x,y] = (r,g,b,255)
        flood_kill(rgba, lambda r,g,b: color_dist((r,g,b),(cr,cg,cb)) <= DARK_FLOOD_DELTA)
    return keep_largest_blob(rgba)

def kill_white_halo(img):
    arr = np.array(img)
    r = arr[:,:,0]; g = arr[:,:,1]; b = arr[:,:,2]; a = arr[:,:,3]
    min_rgb = np.minimum(np.minimum(r,g),b)
    halo_partial = (a < 250) & (a > 0) & (min_rgb >= HALO_NEAR_WHITE)
    arr[halo_partial, 3] = 0
    halo_opaque = (a == 255) & (min_rgb >= HALO_NEAR_WHITE_OPAQUE)
    arr[halo_opaque, 3] = 0
    return Image.fromarray(arr, "RGBA")

def fit_canvas(img):
    bbox = img.getbbox()
    if bbox: img = img.crop(bbox)
    sw, sh = img.size
    avail_w = int(TARGET_W * (1 - 2 * MARGIN_PCT))
    avail_h = int(TARGET_H * (1 - 2 * MARGIN_PCT))
    ratio = min(avail_w/sw, avail_h/sh)
    nw, nh = int(sw*ratio), int(sh*ratio)
    resized = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0,0,0,0))
    px = (TARGET_W - nw)//2
    py = (TARGET_H - nh)//2
    canvas.paste(resized, (px, py), resized)
    return canvas

def main():
    if len(sys.argv) < 3:
        print("usage: process-upload.py <src> <out>")
        return 1
    src, out = sys.argv[1], sys.argv[2]
    img = Image.open(src)
    keyed = alpha_key_auto(img)
    halo_killed = kill_white_halo(keyed)
    final = fit_canvas(halo_killed)
    final.save(out, "PNG", optimize=True)
    print(f"OK {src} -> {out} ({final.size})")

if __name__ == "__main__":
    sys.exit(main() or 0)
