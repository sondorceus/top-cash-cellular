#!/usr/bin/env python3
"""Splice LG per-model images into page.tsx by id match (LG ids in JSON
were extracted from page.tsx directly, so exact id matching is reliable)."""
import os, re, json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
JSON_PATH = os.path.join(ROOT, "scripts", "lg-models.json")
PAGE_PATH = os.path.join(ROOT, "app", "page.tsx")
DEV_DIR = os.path.join(ROOT, "public", "devices")


def main():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        models = json.load(f)
    by_id = {}
    for m in models:
        img = m.get("image", "")
        if not img.startswith("/devices/"): continue
        local = os.path.join(DEV_DIR, img.split("/")[-1])
        if not os.path.exists(local): continue
        by_id[m["id"]] = img
    print(f"Loaded {len(by_id)} per-model images")

    with open(PAGE_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    pat = re.compile(
        r'(\{\s*id:\s*")(lg_[a-z0-9_-]+)(",\s*label:\s*"[^"]+",\s*base:\s*\d+,\s*inquiryOnly:\s*true,\s*image:\s*")([^"]+)("\s*\})'
    )
    swaps = misses = 0
    def repl(m):
        nonlocal swaps, misses
        new = by_id.get(m.group(2))
        if new:
            swaps += 1
            return m.group(1) + m.group(2) + m.group(3) + new + m.group(5)
        misses += 1
        return m.group(0)
    new_src = pat.sub(repl, src)
    if new_src == src:
        print("no changes"); return 1
    with open(PAGE_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(new_src)
    print(f"Swapped {swaps}, missed {misses}")


if __name__ == "__main__":
    main()
