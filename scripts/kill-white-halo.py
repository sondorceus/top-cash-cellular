#!/usr/bin/env python3
"""Kill any anti-aliased white halo on a transparent-background PNG.

Skywalker's manually-cleaned uploads sometimes have soft-edge pixels
that are mostly transparent but still light-colored. On the dark site
bg those show up as a faint white outline. This walks every pixel and
zeros alpha if the pixel is both partially transparent AND near-white.
"""
import sys
from PIL import Image
import numpy as np

ALPHA_MAX = 250        # any partial-alpha edge pixel below this is suspect
NEAR_WHITE_MIN = 205   # treat as white if min(R,G,B) >= this

def main():
    if len(sys.argv) < 2:
        print("usage: kill-white-halo.py <png>")
        return 1
    path = sys.argv[1]
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]
    a = arr[:, :, 3]
    min_rgb = np.minimum(np.minimum(r, g), b)
    halo_mask = (a < ALPHA_MAX) & (a > 0) & (min_rgb >= NEAR_WHITE_MIN)
    arr[halo_mask, 3] = 0
    killed = int(halo_mask.sum())
    # Also kill fully-opaque near-white pixels that border transparent ones
    # (those are typically the very first row of the halo).
    opaque_white = (a == 255) & (min_rgb >= 245)
    arr[opaque_white, 3] = 0
    killed_op = int(opaque_white.sum())
    out = Image.fromarray(arr, "RGBA")
    out.save(path, "PNG", optimize=True)
    print(f"OK {path}: killed {killed} halo + {killed_op} near-white opaque")

if __name__ == "__main__":
    sys.exit(main() or 0)
