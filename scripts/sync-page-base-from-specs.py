#!/usr/bin/env python3
"""Sync each page.tsx variant's `base` to its PC_LAPTOP_SPECS base_price
× 0.90 when the variant has a spec entry and is currently inquiryOnly /
base 0. Catches cases like Dell XPS where the spec data lives in
pc-laptop-specs.json but page.tsx was never updated because the legacy
iwm-pc-laptop-prices.json never had a real price (IWM hosts the data
under umbrella URLs that the original price scrape didn't visit).

After this, the model picker shows accurate "Up to $X" ceilings and the
inquiryOnly flag is dropped so users get a real quote flow.
"""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path(__file__).parent.parent
PAGE = ROOT / "app" / "page.tsx"
SPECS = ROOT / "public" / "comps" / "pc-laptop-specs.json"
DISCOUNT = 0.10  # our price = IWM × 0.90


def main():
    specs = json.loads(SPECS.read_text())
    src = PAGE.read_text()

    # Match a variant object with id + label + base + inquiryOnly + image
    variant_re = re.compile(
        r'(\{\s*id:\s*"(?P<id>[^"]+)",\s*label:\s*"(?P<label>[^"]+)",\s*base:\s*(?P<base>\d+)'
        r'(?:,\s*inquiryOnly:\s*(?P<inquiry>true|false))?\s*,\s*image:\s*"(?P<image>/devices/[^"]+)"\s*\})'
    )

    updated = []
    edits = []  # (start, end, new_text)

    for m in variant_re.finditer(src):
        vid = m.group("id")
        label = m.group("label")
        base = int(m.group("base"))
        inq = m.group("inquiry") == "true"
        image = m.group("image")

        spec = specs.get(vid)
        if not spec or not spec.get("base_price"):
            continue
        if spec.get("_inquiry_only"):
            # Research-agent placeholders — leave as inquiry-only.
            continue
        # Compute our base from spec base_price (×0.90).
        our_base = max(1, round(spec["base_price"] * (1 - DISCOUNT)))

        # Only sync variants currently in inquiryOnly / base=0 state.
        # For variants that already have a real base from the simple
        # quiz scrape (apply-iwm-pc-laptop-prices.py), leave them alone
        # — that price represents Flawless × max-storage, which is
        # closer to the picker's "Up to $X" semantic than spec.base
        # (which anchors at the minimum chip/RAM/storage config).
        if not inq and base > 0:
            continue

        new_text = (
            f'{{ id: "{vid}", label: "{label}", base: {our_base}, '
            f'inquiryOnly: false, image: "{image}" }}'
        )
        edits.append((m.start(), m.end(), new_text))
        updated.append((vid, base, our_base, inq))

    if not edits:
        print("No variants needed syncing.")
        return

    edits.sort(key=lambda e: -e[0])
    new_src = src
    for start, end, replacement in edits:
        new_src = new_src[:start] + replacement + new_src[end:]
    PAGE.write_text(new_src)

    print(f"Synced {len(updated)} variants from spec base_price × 0.90:")
    for vid, old, new, was_inq in sorted(updated):
        flag = " [inq→priced]" if was_inq else ""
        print(f"  {vid:30s} {old:>4} -> {new:>4}{flag}")


if __name__ == "__main__":
    main()
