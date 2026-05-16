#!/usr/bin/env python3
"""Convert lenovo-desktop-specs.json (research-agent output) into
PC_LAPTOP_SPECS-shape entries appended to pc-laptop-specs.json.

Lenovo desktops aren't on IWM (verified by URL probe + catalog scan),
so we can't apply IWM × 0.90 pricing. Per Skywalker's rules these stay
inquiry-only. But baking the spec metadata into PC_LAPTOP_SPECS means
the funnel asks the user for chip / RAM / storage / GPU before the
inquiry — turning a useless "we don't price these" dead-end into a
useful lead intake with full config detail.

base_price stays 0 so the additive math computes $0 → triggers manual
review in the existing UI. condition_adj is left empty so condition
selections also don't change the quote.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC_FILES = [
    ROOT / "lenovo-desktop-specs.json",
    ROOT / "desktop-specs.json",
]
SPECS = ROOT / "public" / "comps" / "pc-laptop-specs.json"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def ram_label(s):
    # "16GB" -> id "r16"
    m = re.search(r"(\d+)", s)
    return f"r{m.group(1)}" if m else slug(s)


def storage_id(s):
    s2 = s.lower().replace(" ", "").replace("ssd", "").replace("hdd", "").replace("+", "_plus_").strip("_")
    return s2


def to_macspec(entry):
    chips = entry.get("chips", [])
    ram = entry.get("ram_tiers", [])
    storage = entry.get("storage_tiers", [])
    gpu = entry.get("gpu_tiers", [])

    # Flatten chip groups (research listed them as comma-sep strings, expand)
    flat_chips = []
    for c in chips:
        # Split on common delimiters but keep "Core i7-8700" intact
        parts = [p.strip() for p in c.split(",") if p.strip()]
        # If parts have a Gen prefix like "Gen2: Core i3...", strip prefix
        for p in parts:
            p2 = re.sub(r"^Gen\s*\d+:\s*", "", p)
            flat_chips.append(p2)
    # Dedupe preserving order
    seen = set()
    dedup_chips = [c for c in flat_chips if not (c in seen or seen.add(c))]

    processors = [
        {"id": slug(c), "label": c, "sub": "", "multiplier": 1.0, "adj": 0}
        for c in dedup_chips
    ]
    memory = [
        {"id": ram_label(r), "label": r, "sub": "", "multiplier": 1.0, "adj": 0}
        for r in ram
    ]
    storage_opts = [
        {"id": storage_id(s), "label": s, "sub": "", "multiplier": 1.0, "adj": 0}
        for s in storage
    ]
    return {
        "base_price": 0,
        "processors": processors,
        "memory": memory,
        "storage": storage_opts,
        "condition_adj": {},
        "battery_adj": {},
        "charger_adj": {},
        "hasNanoGlass": False,
        "_inquiry_only": True,
        "_form_factor": entry.get("form_factor", ""),
        "_gpu_tiers": gpu,
        "_market_value_usd": entry.get("market_value_usd", ""),
    }


def main():
    specs = json.loads(SPECS.read_text())
    added = []
    for src_path in SRC_FILES:
        if not src_path.exists():
            continue
        src = json.loads(src_path.read_text())
        for vid, entry in src.items():
            if vid.startswith("_"):
                continue
            # Skip if a real (priced) IWM-based spec already exists — we
            # don't want research-agent placeholders to overwrite scraped
            # data. Detect via base_price > 0.
            existing = specs.get(vid)
            if existing and existing.get("base_price", 0) > 0:
                continue
            specs[vid] = to_macspec(entry)
            added.append(vid)
    SPECS.write_text(json.dumps(specs, indent=2, sort_keys=True))
    print(f"Added {len(added)} desktop entries to pc-laptop-specs.json:")
    for vid in added:
        s = specs[vid]
        print(f"  {vid}: {len(s['processors'])} chips, {len(s['memory'])} RAM tiers, {len(s['storage'])} storage tiers")


if __name__ == "__main__":
    main()
