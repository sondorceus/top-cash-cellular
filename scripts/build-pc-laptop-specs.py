#!/usr/bin/env python3
"""Convert pc-laptop-iwm-adjustments.json (keyed by IWM series/model) into
public/comps/pc-laptop-specs.json keyed by page.tsx variant id, in the
MACBOOK_SPECS-compatible shape: {processors[], memory[], storage[],
condition_adj{}, battery_adj{}, charger_adj{}}.

Uses the same image-bridge logic as apply-iwm-pc-laptop-prices.py to map
variant.image → IWM model_slug → adjustments entry.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).parent.parent
PAGE = ROOT / "app" / "page.tsx"
ADJ = ROOT / "pc-laptop-iwm-adjustments.json"
OUT = ROOT / "public" / "comps" / "pc-laptop-specs.json"
BRIDGES = {
    "lenovo": ROOT / "scripts" / "lenovo-models.json",
    "hp": ROOT / "scripts" / "hp-models.json",
    "dell": ROOT / "scripts" / "dell-models.json",
    "asus": ROOT / "scripts" / "asus-models.json",
}

MANUAL_IMAGE_TO_SLUG = {
    "/devices/ln_tp_x390.png": "lenovo-thinkpad-x390-series",
    "/devices/ln_tp_x9_14.png": "lenovo-thinkpad-x9",
    "/devices/ln_tp_x9_15.png": "lenovo-thinkpad-x9",
    "/devices/ln_tp_e14_g7.png": "lenovo-thinkpad-e14-gen-7",
    "/devices/ln_tp_e14_g6.png": "lenovo-thinkpad-e14-gen-6",
    "/devices/ln_tp_e14_g5.png": "lenovo-thinkpad-e14-gen-5",
    "/devices/ln_tp_e15.png": "lenovo-thinkpad-e15-gen-4",
    "/devices/ln_tp_e16_g3.png": "lenovo-thinkpad-e16-gen-3",
    "/devices/ln_tp_e16_g2.png": "lenovo-thinkpad-e16-gen-2",
    "/devices/ln_tp_e16_g1.png": "lenovo-thinkpad-e16-gen-1",
}

# Page-variant-id → IWM model slug for brands without proper bridges
# (samsung_pc / lg_pc / acer / alienware). These map our short variant
# ids straight to the most-similar IWM laptop generation.
MANUAL_ID_TO_SLUG = {
    # Samsung Galaxy Book — all variants of a generation share that
    # generation's IWM SKU (sub-variants like 360 / Pro / Ultra / Edge
    # aren't separately priced on IWM).
    "sgbk_5": "galaxy-book5", "sgbk_5_360": "galaxy-book5",
    "sgbk_5_pro": "galaxy-book5", "sgbk_5_pro_360": "galaxy-book5",
    "sgbk_4": "galaxy-book4", "sgbk_4_360": "galaxy-book4",
    "sgbk_4_pro": "galaxy-book4", "sgbk_4_pro_360": "galaxy-book4",
    "sgbk_4_ultra": "galaxy-book4", "sgbk_4_edge": "galaxy-book4",
    "sgbk_3": "galaxy-book3", "sgbk_3_360": "galaxy-book3",
    "sgbk_3_pro": "galaxy-book3", "sgbk_3_pro_360": "galaxy-book3",
    "sgbk_3_ultra": "galaxy-book3",
    "sgbk_2": "galaxy-book2", "sgbk_2_360": "galaxy-book2",
    "sgbk_2_pro": "galaxy-book2", "sgbk_2_pro_360": "galaxy-book2",
    "sgbk_1": "galaxy-book", "sgbk_1_pro": "galaxy-book",
    "sgbk_1_pro_360": "galaxy-book", "sgbk_1_ion": "galaxy-book",
    "sgbk_1_flex": "galaxy-book", "sgbk_1_flex_alpha": "galaxy-book",
    "sgbk_1_flex2_alpha": "galaxy-book", "sgbk_1_odyssey": "galaxy-book",
    # LG Gram — IWM has 3 SKUs (lg-gram / lg-gram-pro / lg-gram-superslim)
    # Map page variants accordingly.
    "lg_gr14_24": "lg-gram", "lg_gr14_23": "lg-gram", "lg_grstyle14": "lg-gram",
    "lg_gr14t_24": "lg-gram", "lg_gr14t_23": "lg-gram",
    "lg_gr15_23": "lg-gram",
    "lg_gr16_24": "lg-gram", "lg_gr16_23": "lg-gram", "lg_grstyle16": "lg-gram",
    "lg_gr16t_24": "lg-gram", "lg_gr16t_23": "lg-gram",
    "lg_gr17_24": "lg-gram", "lg_gr17_23": "lg-gram",
    "lg_grpro16_25": "lg-gram-pro", "lg_grpro16_24": "lg-gram-pro",
    "lg_grpro16t_24": "lg-gram-pro",
    "lg_grpro17_25": "lg-gram-pro", "lg_grpro17_24": "lg-gram-pro",
    "lg_grultra15": "lg-gram-superslim",
    # Alienware m-series — page splits by gen+screen (m15 R5/R6/R7,
    # m16 R1/R2, m17 R5, m18 R1/R2) but IWM has just m15/m16/m17/m18.
    "awm15r5_ryzen": "alienware-m15", "awm15r6": "alienware-m15", "awm15r7": "alienware-m15",
    "awm16r1": "alienware-m16", "awm16r2": "alienware-m16",
    "awm17r5": "alienware-m17",
    "awm18r1": "alienware-m18", "awm18r2": "alienware-m18",
    # Alienware x-series
    "awx14r1": "alienware-x14", "awx14r2": "alienware-x14",
    "awx15r1": "alienware-x15", "awx15r2": "alienware-x15",
    "awx16r1": "alienware-x16", "awx16r2": "alienware-x16",
    "awx17r1": "alienware-x17", "awx17r2": "alienware-x17",
}


def build_image_to_slug():
    img_to_slug = dict(MANUAL_IMAGE_TO_SLUG)
    for brand in ("lenovo", "hp", "asus"):
        for e in json.load(open(BRIDGES[brand])):
            slug = e.get("model_slug")
            img = e.get("image")
            if slug and img:
                img_to_slug[img] = slug
    for e in json.load(open(BRIDGES["dell"])):
        img = e.get("image")
        sub = e.get("sub_id") or ""
        bid = e.get("id") or ""
        prefix = f"dell_{sub}_"
        if img and bid.startswith(prefix):
            img_to_slug[img] = bid[len(prefix):]
    return img_to_slug


# Slug helpers for RAM/storage tier labels
def ram_id(label):
    m = re.search(r"(\d+)", label)
    return f"r{m.group(1)}" if m else label.lower().replace(" ", "_")


def storage_id(label):
    s = label.lower().replace(" ", "")
    if "tb" in s:
        m = re.search(r"(\d+)\s*tb", s)
        return f"{m.group(1)}tb" if m else s
    m = re.search(r"(\d+)", s)
    return m.group(1) if m else s


def chip_id(label):
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")


def to_macspec(entry):
    """Convert a per-model IWM adjustment entry to MACBOOK_SPECS shape.

    All multipliers are 1.0 — pricing is purely additive per Skywalker.
    """
    base = entry.get("base_price", 0)
    if not base or not entry.get("chips"):
        return None

    chips = entry.get("chips", [])
    processors = [
        {
            "id": chip_id(c["label"]),
            "label": c["label"],
            "sub": "",
            "multiplier": 1.0,
            "adj": int(c.get("adj", 0)),
        }
        for c in chips
    ]
    memory = [
        {
            "id": ram_id(label),
            "label": label,
            "sub": "",
            "multiplier": 1.0,
            "adj": int(val),
        }
        for label, val in entry.get("ram_adj", {}).items()
    ]
    storage = [
        {
            "id": storage_id(label),
            "label": label,
            "sub": "",
            "multiplier": 1.0,
            "adj": int(val),
        }
        for label, val in entry.get("storage_adj", {}).items()
    ]
    # Sort memory by GB ascending so the first option (cheapest tier) reads
    # naturally. Storage already sorted by IWM ordering.
    def ram_num(opt):
        m = re.search(r"(\d+)", opt["label"])
        return int(m.group(1)) if m else 0
    memory.sort(key=ram_num)

    return {
        "base_price": int(base),
        "processors": processors,
        "memory": memory,
        "storage": storage,
        "condition_adj": entry.get("condition_adj", {}),
        "battery_adj": entry.get("battery_adj", {}),
        "charger_adj": entry.get("charger_adj", {}),
        "hasNanoGlass": False,
    }


def main():
    adj = json.load(open(ADJ))
    img_to_slug = build_image_to_slug()
    # Index adj data by IWM model slug (not series/model)
    by_slug = {}
    for k, v in adj.items():
        if not v.get("base_price"):
            continue
        slug = v.get("model")
        if slug:
            by_slug.setdefault(slug, []).append(v)

    # Read page.tsx variants in the PC laptop section to extract id ↔ image
    src = PAGE.read_text()
    # Non-Apple laptop span: lines ~1260..2245 (see apply script)
    lines = src.splitlines(keepends=True)
    starts = []
    pos = 0
    for ln in lines:
        starts.append(pos); pos += len(ln)
    span_start = starts[1259] if len(starts) > 1259 else 0
    span_end = starts[2245] if len(starts) > 2245 else len(src)
    vre = re.compile(
        r'\{\s*id:\s*"(?P<id>[^"]+)",\s*label:\s*"(?P<label>[^"]+)",\s*base:\s*\d+'
        r'(?:,\s*inquiryOnly:\s*(?:true|false))?\s*,\s*image:\s*"(?P<image>/devices/[^"]+)"\s*\}'
    )
    out = {}
    matched = 0
    for m in vre.finditer(src, span_start, span_end):
        vid, label, image = m.group("id"), m.group("label"), m.group("image")
        slug = MANUAL_ID_TO_SLUG.get(vid) or img_to_slug.get(image)
        if not slug:
            continue
        entries = by_slug.get(slug)
        if not entries:
            continue
        spec = to_macspec(entries[0])
        if not spec:
            continue
        out[vid] = spec
        matched += 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, sort_keys=True))
    print(f"Built specs for {matched} page.tsx variants → {OUT}")
    print(f"Total adj entries: {len(adj)}, with specs: {sum(1 for v in adj.values() if v.get('base_price'))}")


if __name__ == "__main__":
    main()
