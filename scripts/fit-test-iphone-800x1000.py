#!/usr/bin/env python3
"""Take Skywalker's new transparent Pro Max image, tight-crop to phone,
then letterbox into an 800x1000 canvas (the size I asked him to send)
with ~6% breathing room around the phone.

Run: python scripts/fit-test-iphone-800x1000.py <src> <out>
"""
import sys
from PIL import Image

TARGET_W, TARGET_H = 800, 1000
MARGIN_PCT = 0.06  # 6% margin on each side


def main():
    if len(sys.argv) < 3:
        print("usage: fit-test-iphone-800x1000.py <src> <out>")
        return 1
    src, out = sys.argv[1], sys.argv[2]
    img = Image.open(src).convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    sw, sh = img.size
    avail_w = int(TARGET_W * (1 - 2 * MARGIN_PCT))
    avail_h = int(TARGET_H * (1 - 2 * MARGIN_PCT))
    ratio = min(avail_w / sw, avail_h / sh)
    new_w = int(sw * ratio)
    new_h = int(sh * ratio)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    paste_x = (TARGET_W - new_w) // 2
    paste_y = (TARGET_H - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y), resized)
    canvas.save(out, "PNG", optimize=True)
    print(f"OK {src} ({sw}x{sh}) -> {out} ({TARGET_W}x{TARGET_H}, phone {new_w}x{new_h})")


if __name__ == "__main__":
    sys.exit(main() or 0)
