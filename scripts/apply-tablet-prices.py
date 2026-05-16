#!/usr/bin/env python3
"""Apply iwm-tablet-adjustments.json prices to existing tablet variant
arrays in app/page.tsx. Updates inquiry-only Samsung / Lenovo / OnePlus
/ Google tablet variants with real bases (IWM Flawless × 0.90).

Skips entries with clearly bogus IWM bases (under $20 or negative)."""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path(__file__).parent.parent
PAGE = ROOT / "app" / "page.tsx"
ADJ = json.loads((ROOT / "iwm-tablet-adjustments.json").read_text())
DISCOUNT = 0.10

# page variant id → IWM key
MAP = {
    # Samsung Galaxy Tab
    "stabs11u":   "samsung-tablet/galaxy-tab-s11-ultra",
    "stabs11":    "samsung-tablet/galaxy-tab-s11",
    "stabs10u":   "samsung-tablet/galaxy-tab-s10-ultra",
    "stabs10p":   "samsung-tablet/galaxy-tab-s10-plus",
    "stabs10fep": "samsung-tablet/galaxy-tab-s10-fe-plus",
    "stabs10fe":  "samsung-tablet/galaxy-tab-s10-fe",
    "stabs10l":   "samsung-tablet/galaxy-tab-s10-lite",
    "stabs7p":    "samsung-tablet/galaxy-tab-s7-plus",
    "stabs7fe":   "samsung-tablet/galaxy-tab-s7-fe",
    "stabs7":     "samsung-tablet/galaxy-tab-s7",
    "stabs6l":    "samsung-tablet/galaxy-tab-s6-lite",
    "stabs6":     "samsung-tablet/galaxy-tab-s6",
    "stabs5e":    "samsung-tablet/galaxy-tab-s5e",
    "stabs4":     "samsung-tablet/galaxy-tab-s4-105",
    # Lenovo Tab
    "legtabg3":   "lenovo-tablet/lenovo-legion-tab-gen-3",
    # OnePlus
    "oppad2":     "oneplus-tablet/oneplus-pad-2",
    "oppad":      "oneplus-tablet/oneplus-pad",
    # Google
    "gpixeltab":  "google-tablet/google-pixel-tablet",
}


def main():
    src = PAGE.read_text()
    updates = []
    for vid, adj_key in MAP.items():
        entry = ADJ.get(adj_key, {})
        base_iwm = entry.get("base_price", 0)
        if base_iwm < 20:
            print(f"  SKIP {vid:14s} IWM=${base_iwm} too low")
            continue
        our_base = max(1, round(base_iwm * (1 - DISCOUNT)))
        # Match either form:
        #   { id: "vid", label: "...", image: "..." }              (no base)
        #   { id: "vid", label: "...", base: N, inquiryOnly: ... } (existing base)
        pat = re.compile(
            r'(\{\s*id:\s*"' + re.escape(vid) + r'",\s*label:\s*"[^"]+")'
            r'(?:\s*,\s*base:\s*\d+)?'
            r'(?:\s*,\s*inquiryOnly:\s*(?:true|false))?'
            r'(\s*,\s*image:\s*"[^"]+")?'
            r'\s*\}'
        )
        m = pat.search(src)
        if not m:
            print(f"  MISS {vid:14s} no match in page.tsx")
            continue
        image_part = m.group(2) or ""
        new = m.group(1) + f", base: {our_base}, inquiryOnly: false" + image_part + " }"
        src = src[:m.start()] + new + src[m.end():]
        updates.append((vid, our_base))
        print(f"  OK   {vid:14s} IWM ${base_iwm} → ours ${our_base}")
    PAGE.write_text(src)
    print(f"\nWrote {len(updates)} variant updates to {PAGE}")


if __name__ == "__main__":
    main()
