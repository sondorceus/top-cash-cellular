#!/usr/bin/env python3
"""Crop GSMArena bigpic to front-only and pad with margin.

The /vv/bigpic/ images we scraped are 160x212 back+front composites with
the phones edge-to-edge — at 40x40 the rounded corners look clipped
because there's no white margin. This crops just the right half (front
view), pads to a square canvas with ~17% white margin, so the variant-list
thumbnail shows one full phone with breathing room.
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

def process(phone_id: str) -> bool:
    path = os.path.join(DEV_DIR, f"{phone_id}.jpg")
    if not os.path.exists(path):
        print(f"  ! missing {path}")
        return False
    img = Image.open(path).convert("RGB")
    w, h = img.size
    # right half of the back+front composite is the front view
    front = img.crop((w // 2, 0, w, h))
    fw, fh = front.size
    # pad to square with ~20% margin so the phone doesn't fill edge-to-edge
    margin = max(fw, fh) // 5
    side = max(fw, fh) + margin
    canvas = Image.new("RGB", (side, side), "white")
    canvas.paste(front, ((side - fw) // 2, (side - fh) // 2))
    canvas.save(path, quality=92)
    print(f"  OK {phone_id}: {fw}x{fh} -> {side}x{side}")
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
