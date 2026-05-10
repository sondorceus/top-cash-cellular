#!/usr/bin/env python3
"""Splice Lenovo / HP / Acer / Samsung_PC per-model image paths into
page.tsx. Matches by id since the JSON ids were extracted directly
from page.tsx so they should be identical.
"""
import os, re, json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
PAGE_PATH = os.path.join(ROOT, "app", "page.tsx")
DEV_DIR = os.path.join(ROOT, "public", "devices")

BRANDS = ["lenovo", "hp", "acer", "samsung_pc"]


def main():
    by_id = {}
    total = 0
    for brand in BRANDS:
        path = os.path.join(ROOT, "scripts", f"{brand}-models.json")
        if not os.path.exists(path): continue
        with open(path, "r", encoding="utf-8") as f:
            for m in json.load(f):
                img = m.get("image", "")
                if not img.startswith("/devices/"): continue
                local = os.path.join(DEV_DIR, img.split("/")[-1])
                if not os.path.exists(local): continue
                by_id[m["id"]] = img
                total += 1
    print(f"Loaded {total} per-model images across {len(BRANDS)} brands")

    with open(PAGE_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    # Match every laptop variant entry. Two shapes exist in page.tsx:
    #   (a) {id, label, base, image, [inquiryOnly]}      — already has image
    #   (b) {id, label, base, [inquiryOnly]}             — missing image
    # We swap (a) and inject into (b).
    pat = re.compile(
        r'\{\s*id:\s*"([a-z0-9_-]+)",[^}]*\}'
    )
    swaps = injects = 0

    def repl(m):
        nonlocal swaps, injects
        block = m.group(0)
        id_ = m.group(1)
        new = by_id.get(id_)
        if not new:
            return block
        # If block already has image:, replace its value
        if re.search(r'image:\s*"[^"]*"', block):
            new_block = re.sub(r'(image:\s*")[^"]*(")', r'\1' + new + r'\2', block, count=1)
            swaps += 1
            return new_block
        # Otherwise inject `, image: "..."` before the closing brace
        new_block = re.sub(r'(\s*\})$', f', image: "{new}"\\1', block, count=1)
        injects += 1
        return new_block

    new_src = pat.sub(repl, src)
    print(f"swapped {swaps}, injected {injects}")
    if swaps + injects == 0:
        print("no changes"); return 1
    with open(PAGE_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(new_src)


if __name__ == "__main__":
    main()
