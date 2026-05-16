#!/usr/bin/env python3
"""Split Lenovo page.tsx variants into per-generation entries so each
gen gets its real IWM submodel price + chip/RAM/storage menu.

Currently page.tsx has e.g. `ln_tp_x1_carbon` as one variant — internally
we pick Gen 13 (the newest with the highest base) and apply that to
every X1 Carbon owner. A Gen 6 owner gets quoted $725 baseline when
they should see $115. Same problem across L13, L14, L15, L16, P50-P53,
X1 Carbon / Extreme / Yoga / Nano / 2-in-1, X13, X13 Yoga, X390, X9,
Z13, Z16.

For each multi-gen IWM submodel pair we emit a new variant entry with:
  - id = parent_id + '_' + gen_slug (e.g. ln_tp_x1_carbon_g13)
  - label = parent_label + ' Gen N' (or sub-variant suffix)
  - image = parent image (reused — gen-specific cutouts can come later)
  - base = round(submodel.base_price * 0.9)
  - inquiryOnly: false

Also emits MANUAL_ID_TO_SUBMODEL entries so the build script wires each
new variant to the right IWM submodel slug.

Run:
  python3 scripts/split-lenovo-multi-gen.py            # dry-run
  python3 scripts/split-lenovo-multi-gen.py --write   # mutate page.tsx
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
PAGE = ROOT / "app" / "page.tsx"
ADJ = ROOT / "pc-laptop-iwm-adjustments.json"
BUILDER = ROOT / "scripts" / "build-pc-laptop-specs.py"
DISCOUNT = 0.10  # our price = IWM × 0.90


# Each entry: (parent_variant_id, parent_label, parent_image, iwm_url, gen_filter)
# gen_filter optionally constrains which submodels to use (e.g. only
# x1-carbon-* not x1-2-in-1-*).
SPLITS = [
    # === ThinkPad X1 series ===
    ("ln_tp_x1_carbon", "ThinkPad X1 Carbon",
     "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-carbon.png",
     "lenovo-thinkpad-x1-series/lenovo-thinkpad-x1-carbon",
     r"^x1-carbon-gen-\d+$"),
    ("ln_tp_x1_extreme", "ThinkPad X1 Extreme",
     "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-extreme.png",
     "lenovo-thinkpad-x1-series/lenovo-thinkpad-x1-extreme",
     r"^x1-extreme-gen-\d+$"),
    ("ln_tp_x1_yoga", "ThinkPad X1 Yoga",
     "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-yoga.png",
     "lenovo-thinkpad-x1-series/lenovo-thinkpad-x1-yoga",
     r"^x1-yoga-gen-\d+$"),
    ("ln_tp_x1_nano", "ThinkPad X1 Nano",
     "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-nano.png",
     "lenovo-thinkpad-x1-series/lenovo-thinkpad-x1-nano",
     r"^x1-nano-gen-\d+$"),
    ("ln_tp_x1_2in1", "ThinkPad X1 2-in-1",
     "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-2-in-1.png",
     "lenovo-thinkpad-x1-series/lenovo-thinkpad-x1-2-in-1",
     r"^x1-2-in-1-gen-\d+$"),
    # === ThinkPad X13 ===
    ("ln_tp_x13", "ThinkPad X13",
     "/devices/lenovo-thinkpad-tp_x13-lenovo-thinkpad-x13.png",
     "lenovo-thinkpad-x13-series-laptop/lenovo-thinkpad-x13",
     r"^x13-gen-\d+$"),
    ("ln_tp_x13_yoga", "ThinkPad X13 Yoga",
     "/devices/lenovo-thinkpad-tp_x13-lenovo-thinkpad-x13-yoga.png",
     "lenovo-thinkpad-x13-series-laptop/lenovo-thinkpad-x13-yoga",
     r"^x13-yoga-gen-\d+$"),
    # === ThinkPad L-series ===
    ("ln_tp_l13", "ThinkPad L13",
     "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l13-series.png",
     "lenovo-thinkpad-l-series/lenovo-thinkpad-l13-series",
     r"^l13-gen-\d+$"),
    ("ln_tp_l14", "ThinkPad L14",
     "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l14-series.png",
     "lenovo-thinkpad-l-series/lenovo-thinkpad-l14-series",
     r"^l14-gen-\d+$"),
    ("ln_tp_l15", "ThinkPad L15",
     "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l15-series.png",
     "lenovo-thinkpad-l-series/lenovo-thinkpad-l15-series",
     r"^l15-gen-\d+$"),
    ("ln_tp_l16", "ThinkPad L16",
     "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l16-series.png",
     "lenovo-thinkpad-l-series/lenovo-thinkpad-l16-series",
     r"^l16-gen-\d+$"),
    # === ThinkPad Z-series ===
    ("ln_tp_z13", "ThinkPad Z13",
     "/devices/lenovo-thinkpad-tp_z-lenovo-thinkpad-z13.png",
     "lenovo-thinkpad-z-series/lenovo-thinkpad-z13",
     r"^z13-gen-\d+$"),
    ("ln_tp_z16", "ThinkPad Z16",
     "/devices/lenovo-thinkpad-tp_z-lenovo-thinkpad-z16.png",
     "lenovo-thinkpad-z-series/lenovo-thinkpad-z16",
     r"^z16-gen-\d+$"),
]


def gen_num(slug: str) -> int:
    """Extract gen number from a slug like x1-carbon-gen-13."""
    m = re.search(r"gen-(\d+)$", slug)
    return int(m.group(1)) if m else 0


def split_variants(adj, parent_id, parent_label, parent_image, url, gen_re):
    entry = adj.get(url, {})
    subs = (entry.get("submodels") or {})
    pat = re.compile(gen_re)
    matches = [(sk, sv) for sk, sv in subs.items() if pat.match(sk) and sv.get("base_price")]
    if not matches:
        return [], {}
    # Sort newest gen first (highest number)
    matches.sort(key=lambda kv: -gen_num(kv[0]))
    variants = []
    submap = {}
    for sk, sv in matches:
        gn = gen_num(sk)
        if gn == 0:
            continue
        new_id = f"{parent_id}_g{gn}"
        new_label = f"{parent_label} Gen {gn}"
        base = max(1, round(sv["base_price"] * (1 - DISCOUNT)))
        variants.append({
            "id": new_id,
            "label": new_label,
            "base": base,
            "image": parent_image,
        })
        submap[new_id] = sk
    return variants, submap


def fmt_variant(v):
    return (f'  {{ id: "{v["id"]}", label: "{v["label"]}", base: {v["base"]}, '
            f'inquiryOnly: false, image: "{v["image"]}" }},')


def main():
    write = "--write" in sys.argv
    adj = json.loads(ADJ.read_text())
    all_new = {}  # parent_id → list of new variant dicts
    all_submap = {}

    for parent_id, parent_label, parent_image, url, gen_re in SPLITS:
        variants, submap = split_variants(adj, parent_id, parent_label, parent_image, url, gen_re)
        if variants:
            all_new[parent_id] = variants
            all_submap.update(submap)

    print(f"Generated {sum(len(v) for v in all_new.values())} per-gen variants for "
          f"{len(all_new)} parent variants:")
    for pid, vars_ in all_new.items():
        print(f"\n  {pid} ({len(vars_)} gens):")
        for v in vars_:
            print(f'    {v["id"]:30s} ${v["base"]:>5}  → IWM {all_submap[v["id"]]}')

    if not write:
        print("\n(dry-run — re-run with --write to mutate page.tsx + build script)")
        return

    # Mutate page.tsx: replace each parent variant line with the new per-gen lines.
    src = PAGE.read_text()
    for parent_id, vars_ in all_new.items():
        # Match the parent variant's single line in any variants array
        line_re = re.compile(
            rf'\{{\s*id:\s*"{re.escape(parent_id)}",\s*label:\s*"[^"]+",\s*base:\s*\d+'
            rf'(?:,\s*inquiryOnly:\s*(?:true|false))?\s*,\s*image:\s*"[^"]+"\s*\}}\s*,?'
        )
        new_block = "\n".join(fmt_variant(v) for v in vars_)
        m = line_re.search(src)
        if not m:
            print(f"WARN: parent {parent_id} line not found in page.tsx — skipped")
            continue
        # Preserve trailing comma if the original had one
        had_comma = m.group(0).rstrip().endswith(",")
        if had_comma and not new_block.rstrip().endswith(","):
            new_block += ""  # already trailing-comma'd by fmt_variant
        src = src[:m.start()] + new_block.strip() + src[m.end():]
    PAGE.write_text(src)

    # Mutate build script's MANUAL_ID_TO_SUBMODEL: append new entries.
    bsrc = BUILDER.read_text()
    # Find the MANUAL_ID_TO_SUBMODEL dict opening
    marker = "MANUAL_ID_TO_SUBMODEL = {"
    idx = bsrc.find(marker)
    if idx < 0:
        print("WARN: MANUAL_ID_TO_SUBMODEL not found in build script — manual update needed")
        return
    end = bsrc.find("}", idx)
    insertion = "\n    # Lenovo per-gen splits (auto-added by split-lenovo-multi-gen.py)\n"
    for vid, sk in sorted(all_submap.items()):
        insertion += f'    "{vid}": "{sk}",\n'
    bsrc = bsrc[:end] + insertion + bsrc[end:]
    BUILDER.write_text(bsrc)

    print(f"\nWrote {sum(len(v) for v in all_new.values())} new variants to page.tsx and "
          f"{len(all_submap)} MANUAL_ID_TO_SUBMODEL entries to build script.")
    print("\nNext: python3 scripts/build-pc-laptop-specs.py "
          "&& python3 scripts/build-lenovo-desktop-specs.py "
          "&& python3 scripts/fix-toppirce.py "
          "&& python3 scripts/verifier.py")


if __name__ == "__main__":
    main()
