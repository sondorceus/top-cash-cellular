#!/usr/bin/env python3
"""After scrape-iwm-dell + fetch-dell-images, splice the per-model image
paths into app/page.tsx. Matches by label since the page.tsx ids and the
JSON ids use different naming conventions.
"""
import os
import re
import json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
JSON_PATH = os.path.join(ROOT, "scripts", "dell-models.json")
PAGE_PATH = os.path.join(ROOT, "app", "page.tsx")
DEV_DIR = os.path.join(ROOT, "public", "devices")


def main():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        models = json.load(f)

    def norm(s):
        return re.sub(r"[^a-z0-9]", "", s.lower())

    # Build label -> image, plus a "model number" → image fallback to handle
    # the JSON storing bare "5510" while page.tsx has "G15 5510".
    by_label = {}
    by_modelnum = {}
    for m in models:
        img = m.get("image", "")
        if not img.startswith("/devices/"):
            continue
        local = os.path.join(DEV_DIR, img.split("/")[-1])
        if not os.path.exists(local):
            continue
        by_label[norm(m["label"])] = img
        # Combined "<sub_label> <label>" key for cases where JSON has bare "5510"
        if m.get("sub_label"):
            combo = f"{m['sub_label']} {m['label']}"
            by_label[norm(combo)] = img
        # Look up by trailing model number / hex token (e.g., "5510", "PB13255",
        # "9340"). Picks the longest alphanumeric run >= 4 chars.
        toks = re.findall(r"[A-Za-z0-9]{4,}", m["label"])
        for t in toks:
            t_norm = t.lower()
            # Avoid common/ambiguous tokens
            if t_norm in {"series", "plus", "essential", "premium", "max", "rugged", "extreme"}:
                continue
            by_modelnum.setdefault(t_norm, img)

    print(f"Loaded {len(by_label)} per-model labels, {len(by_modelnum)} model numbers")

    with open(PAGE_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    # Find variant lines that look like:
    #   { id: "d_xps_13_...", label: "XPS 13 ...", base: 0, inquiryOnly: true, image: "/devices/dell-xps.webp" },
    pat = re.compile(
        r'(\{\s*id:\s*"d_[a-z0-9_-]+",\s*label:\s*")([^"]+)(",\s*base:\s*\d+,\s*inquiryOnly:\s*true,\s*image:\s*")([^"]+)("\s*\},)'
    )

    swaps = 0
    misses = 0

    def repl(m):
        nonlocal swaps, misses
        label = m.group(2)
        # 1. Try exact normalized label match.
        new_img = by_label.get(norm(label))
        # 2. Fall back to model-number tokens in the label.
        if not new_img:
            for t in re.findall(r"[A-Za-z0-9]{4,}", label):
                if t.lower() in by_modelnum:
                    new_img = by_modelnum[t.lower()]
                    break
        if new_img:
            swaps += 1
            return m.group(1) + label + m.group(3) + new_img + m.group(5)
        misses += 1
        return m.group(0)

    new_src = pat.sub(repl, src)

    if new_src == src:
        print("no changes (label match might be off — investigating)")
        return 1

    with open(PAGE_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(new_src)
    print(f"Swapped {swaps} image paths, missed {misses}")
    return 0


if __name__ == "__main__":
    main()
