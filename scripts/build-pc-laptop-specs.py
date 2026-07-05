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
    # IWM dropped the 'i' on Pro variants (lenovo-legion-7-pro covers both
    # 7 and 7i Pro; same for Slim 7 Pro X). Override the bridge slug so
    # those page variants resolve to the priced IWM SKU.
    "/devices/lenovo-legion-lenovo-legion-7i-pro.png": "lenovo-legion-7-pro",
    "/devices/lenovo-slim-lenovo-slim-7i-pro-x.png": "lenovo-slim-7-pro-x",
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
    img_to_slug = {}
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
    # Apply manual overrides AFTER bridges so they always win
    # (used when IWM SKU naming diverges from Lenovo / Dell catalog
    # naming — e.g. Legion 7i Pro lives under IWM lenovo-legion-7-pro
    # because IWM doesn't split Intel/AMD pro variants).
    img_to_slug.update(MANUAL_IMAGE_TO_SLUG)
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
    # Require at least one RAM tier — IWM sometimes folds memory into the
    # chip label (e.g. galaxy-book3-ultra). Without separate RAM options
    # the additive flow has nothing to ask for, so skip and let the
    # variant fall back to the simple model → condition → battery flow.
    if not entry.get("ram_adj"):
        return None

    chips = entry.get("chips", [])
    # MacBook semantics: chip.adj is the ABSOLUTE IWM price for that chip
    # at baseline RAM/storage/condition. The IWM tree gives us a delta
    # from chip[0] but the math needs the absolute, so re-anchor here.
    # Without this, picking baseline-chip + baseline-RAM + baseline-storage
    # gave a $0 quote — the LG-class bug class 2.
    #
    # Filter: drop chip options whose delta from chip[0] is below
    # -50% of base. IWM occasionally serves stale 8th-gen Intel
    # options on a Gen 13 X1 Carbon page (delta -$610 on $725 base);
    # those chips don't physically exist on the modern chassis and
    # showing them as quiz options confuses the user.
    #
    # Also drop the INVERSE contamination: the scraper's go_to walk can
    # bleed answers across submodel branches on multi-model pages, e.g.
    # a 2016 XPS 13 9360 (base $45) listing "Intel Core Ultra 9
    # Series 2" at +$730 — picking it would overpay by ~$650. Real chip
    # ladders climb in small steps; a gap over max($150, base) between
    # consecutive sorted deltas marks where foreign-branch chips start.
    floor_delta = -int(base * 0.5)
    kept = sorted(
        (c for c in chips if int(c.get("adj", 0)) >= floor_delta),
        key=lambda c: int(c.get("adj", 0)),
    )
    gap_thresh = max(150, int(base))
    cut = len(kept)
    for i in range(1, len(kept)):
        if int(kept[i].get("adj", 0)) - int(kept[i - 1].get("adj", 0)) > gap_thresh:
            cut = i
            break
    plausible = {id(c) for c in kept[:cut]}
    processors = [
        {
            "id": chip_id(c["label"]),
            "label": c["label"],
            "sub": "",
            "multiplier": 1.0,
            "adj": int(base) + int(c.get("adj", 0)),
        }
        for c in chips
        if id(c) in plausible
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

    # Graphics (GPU) options when IWM offers them as a price-altering
    # answer — gaming laptops + workstations all have a GPU step.
    gpu = []
    for label, val in (entry.get("gpu_adj") or {}).items():
        gpu.append({"id": chip_id(label), "label": label, "sub": "", "multiplier": 1.0, "adj": int(val)})
    # Display resolution (FHD / 2K / QHD / UHD / OLED) on flagship gaming
    # laptops where IWM prices it as a separate choice.
    display = []
    for label, val in (entry.get("display_adj") or {}).items():
        display.append({"id": chip_id(label), "label": label, "sub": "", "multiplier": 1.0, "adj": int(val)})
    return {
        "base_price": int(base),
        "processors": processors,
        "memory": memory,
        "storage": storage,
        "graphics": gpu,
        "display": display,
        "condition_adj": entry.get("condition_adj", {}),
        "battery_adj": entry.get("battery_adj", {}),
        "charger_adj": entry.get("charger_adj", {}),
        "hasNanoGlass": False,
    }


# Page variant id → specific IWM submodel slug. Used when one IWM URL
# covers multiple generations / sub-models that page.tsx wants priced
# separately (Alienware m/x R-versions, HP EliteBook G10/G11 sub-ids,
# ASUS ExpertBook B-series, etc.). The auto-fallback when this dict
# doesn't have an entry: pick the FIRST submodel (newest by IWM ordering).
MANUAL_ID_TO_SUBMODEL = {
    # Alienware m-series gens
    "awm15r5_ryzen": "alienware-m15-r5", "awm15r6": "alienware-m15-r6", "awm15r7": "alienware-m15-r7",
    "awm16r1": "alienware-m16-r1", "awm16r2": "alienware-m16-r2",
    "awm17r5": "alienware-m17-r5",
    "awm18r1": "alienware-m18-r1", "awm18r2": "alienware-m18-r2",
    # Alienware x-series gens
    "awx14r1": "alienware-x14-r1", "awx14r2": "alienware-x14-r2",
    "awx15r1": "alienware-x15-r1", "awx15r2": "alienware-x15-r2",
    "awx16r1": "alienware-x16-r1", "awx16r2": "alienware-x16-r2",
    "awx17r1": "alienware-x17-r1", "awx17r2": "alienware-x17-r2",
    # Alienware Area-51m
    "aw_a51m_r1": "alienware-area-51m-r1", "aw_a51m_r2": "alienware-area-51m-r2",
    # LG Gram — IWM groups by size; map to the right size submodel
    "lg_gr14_24": "gram-14", "lg_gr14_23": "gram-14", "lg_grstyle14": "gram-14",
    "lg_gr14t_24": "gram-14-2-in-1", "lg_gr14t_23": "gram-14-2-in-1",
    "lg_gr15_23": "gram-15",
    "lg_gr16_24": "gram-16", "lg_gr16_23": "gram-16", "lg_grstyle16": "gram-16",
    "lg_gr16t_24": "gram-16-2-in-1", "lg_gr16t_23": "gram-16-2-in-1",
    "lg_gr17_24": "gram-17", "lg_gr17_23": "gram-17",
    "lg_grpro16_25": "gram-pro-16", "lg_grpro16_24": "gram-pro-16",
    "lg_grpro16t_24": "gram-pro-16-2-in-1",
    "lg_grpro17_25": "gram-pro-17", "lg_grpro17_24": "gram-pro-17",
    "lg_grultra15": "gram-superslim-15",
    # Samsung Galaxy Book gens (IWM splits each gen by sub-SKU)
    "sgbk_5": "galaxy-book5", "sgbk_5_360": "galaxy-book5-360",
    "sgbk_5_pro": "galaxy-book5-pro", "sgbk_5_pro_360": "galaxy-book5-pro-360",
    "sgbk_4": "galaxy-book4", "sgbk_4_360": "galaxy-book4-360",
    "sgbk_4_pro": "galaxy-book4-pro", "sgbk_4_pro_360": "galaxy-book4-pro-360",
    "sgbk_4_ultra": "galaxy-book4-ultra", "sgbk_4_edge": "galaxy-book4-edge",
    "sgbk_3": "galaxy-book3", "sgbk_3_360": "galaxy-book3-360",
    "sgbk_3_pro": "galaxy-book3-pro", "sgbk_3_pro_360": "galaxy-book3-pro-360",
    "sgbk_3_ultra": "galaxy-book3-ultra",
    "sgbk_2": "galaxy-book2", "sgbk_2_360": "galaxy-book2-360",
    "sgbk_2_pro": "galaxy-book2-pro", "sgbk_2_pro_360": "galaxy-book2-pro-360",
    # Razer Blade by year — IWM uses model_year flag
    "razer-blade-15": "razer-blade-15-2024", "razer-blade-16": "razer-blade-16-2025",
    "razer-blade-18": "razer-blade-18-2024",
    # MSI desktops — page.tsx labels vs IWM submodel slugs
    "msiinfinity": "trident-x",     # MEG Trident X2 → IWM trident-x flagship
    "msitrident": "trident-3",      # MAG Trident S5 → IWM trident-3
    "msinightblade": "codex-r2",    # MAG Codex 6 → IWM codex-r2 (latest)
    "msicodex5": "codex-r",         # MAG Codex 5 → IWM codex-r
    "msipro": "aegis-r",            # PRO DP180 closest IWM analog

    # Lenovo per-gen splits (auto-added by split-lenovo-multi-gen.py)
    "ln_tp_l13_g1": "l13-gen-1",
    "ln_tp_l13_g2": "l13-gen-2",
    "ln_tp_l13_g3": "l13-gen-3",
    "ln_tp_l13_g4": "l13-gen-4",
    "ln_tp_l13_g5": "l13-gen-5",
    "ln_tp_l14_g1": "l14-gen-1",
    "ln_tp_l14_g2": "l14-gen-2",
    "ln_tp_l14_g3": "l14-gen-3",
    "ln_tp_l14_g4": "l14-gen-4",
    "ln_tp_l14_g5": "l14-gen-5",
    "ln_tp_l14_g6": "l14-gen-6",
    "ln_tp_l15_g1": "l15-gen-1",
    "ln_tp_l15_g2": "l15-gen-2",
    "ln_tp_l15_g3": "l15-gen-3",
    "ln_tp_l15_g4": "l15-gen-4",
    "ln_tp_l16_g1": "l16-gen-1",
    "ln_tp_l16_g2": "l16-gen-2",
    "ln_tp_x13_g1": "x13-gen-1",
    "ln_tp_x13_g2": "x13-gen-2",
    "ln_tp_x13_g3": "x13-gen-3",
    "ln_tp_x13_g4": "x13-gen-4",
    "ln_tp_x13_g5": "x13-gen-5",
    "ln_tp_x13_g6": "x13-gen-6",
    "ln_tp_x13_yoga_g1": "x13-yoga-gen-1",
    "ln_tp_x13_yoga_g2": "x13-yoga-gen-2",
    "ln_tp_x13_yoga_g3": "x13-yoga-gen-3",
    "ln_tp_x13_yoga_g4": "x13-yoga-gen-4",
    "ln_tp_x1_2in1_g10": "x1-2-in-1-gen-10",
    "ln_tp_x1_2in1_g9": "x1-2-in-1-gen-9",
    "ln_tp_x1_carbon_g10": "x1-carbon-gen-10",
    "ln_tp_x1_carbon_g11": "x1-carbon-gen-11",
    "ln_tp_x1_carbon_g12": "x1-carbon-gen-12",
    "ln_tp_x1_carbon_g13": "x1-carbon-gen-13",
    "ln_tp_x1_carbon_g6": "x1-carbon-gen-6",
    "ln_tp_x1_carbon_g7": "x1-carbon-gen-7",
    "ln_tp_x1_carbon_g8": "x1-carbon-gen-8",
    "ln_tp_x1_carbon_g9": "x1-carbon-gen-9",
    "ln_tp_x1_extreme_g1": "x1-extreme-gen-1",
    "ln_tp_x1_extreme_g2": "x1-extreme-gen-2",
    "ln_tp_x1_extreme_g3": "x1-extreme-gen-3",
    "ln_tp_x1_extreme_g4": "x1-extreme-gen-4",
    "ln_tp_x1_extreme_g5": "x1-extreme-gen-5",
    "ln_tp_x1_nano_g1": "x1-nano-gen-1",
    "ln_tp_x1_nano_g2": "x1-nano-gen-2",
    "ln_tp_x1_nano_g3": "x1-nano-gen-3",
    "ln_tp_x1_yoga_g3": "x1-yoga-gen-3",
    "ln_tp_x1_yoga_g4": "x1-yoga-gen-4",
    "ln_tp_x1_yoga_g5": "x1-yoga-gen-5",
    "ln_tp_x1_yoga_g6": "x1-yoga-gen-6",
    "ln_tp_x1_yoga_g7": "x1-yoga-gen-7",
    "ln_tp_x1_yoga_g8": "x1-yoga-gen-8",
    "ln_tp_z13_g1": "z13-gen-1",
    "ln_tp_z13_g2": "z13-gen-2",
    "ln_tp_z16_g1": "z16-gen-1",
    "ln_tp_z16_g2": "z16-gen-2",
    # Dell G15/G16 exact submodels (paired with MANUAL_ID_TO_DESKTOP_SLUG)
    "d_g15_5510": "5510", "d_g15_5511": "5511", "d_g15_5515": "5515",
    "d_g15_5520": "5520", "d_g15_5521": "5521", "d_g15_5525": "5525",
    "d_g15_5530": "5530", "d_g15_5535": "5535",
    "d_g16_7620": "7620", "d_g16_7630": "7630",
}

# Page variants whose IWM URL slug needs a manual hint (not derivable
# from bridge files or image filenames). Desktops became IWM-priceable in
# the June-2026 restructure — these were inquiry-only placeholders before.
MANUAL_ID_TO_DESKTOP_SLUG = {
    "msiinfinity": "msi-trident-gaming-desktop",
    "msitrident": "msi-trident-gaming-desktop",
    "msinightblade": "msi-codex-gaming-desktop",
    "msicodex5": "msi-codex-gaming-desktop",
    "msipro": "msi-aegis-gaming-desktop",
    "awaurorar16": "alienware-aurora-r16",
    "awaurorar15": "alienware-aurora-r15",
    "awaurorar14": "alienware-aurora-r14",
    "awaurorar13": "alienware-aurora-r13",
    "awaurorar12": "alienware-aurora-r12",
    "awaurorar10": "alienware-aurora-r10",
    "awarea51desktop": "alienware-area-51-aat2250",
    "dxps8960": "xps-8960-desktop",
    "dxps8950": "xps-8950-desktop",
    "doptiplex7010": "optiplex-tower",
    "doptiplex5000": "optiplex-tower",
    "hpomendsk": "hp-omen-45l-desktop",
    "hpomen40": "hp-omen-40l-desktop",
    "lnthinkm": "lenovo-thinkcentre-tower",
    "lnthinkm90q": "lenovo-thinkcentre-tiny-desktop",
    "lnlegion5dtwr": "lenovo-legion-tower-5i",
    "lnlegion7dtwr": "lenovo-legion-tower-7i",
    # Dell G15/G16 — page images are per-model PNGs the dell bridge never
    # covered (bridge rows share dell-xps.webp), so these sat at $0
    # inquiry-only while IWM pays $500+. Route via the umbrella model
    # slug; MANUAL_ID_TO_SUBMODEL below pins the exact submodel.
    "d_g15_5510": "dell-g-series-g15", "d_g15_5511": "dell-g-series-g15",
    "d_g15_5515": "dell-g-series-g15", "d_g15_5520": "dell-g-series-g15",
    "d_g15_5521": "dell-g-series-g15", "d_g15_5525": "dell-g-series-g15",
    "d_g15_5530": "dell-g-series-g15", "d_g15_5535": "dell-g-series-g15",
    "d_g16_7620": "dell-g-series-g16", "d_g16_7630": "dell-g-series-g16",
}


def label_slug_candidates(label: str):
    """Derive IWM submodel-slug candidates from a page variant label.
    "Latitude 7300 Series" → ["latitude-7300-series", "latitude-7300"].
    Used to pin a variant to ITS submodel on umbrella pages — without
    this, d_lat_7300 (a 2019 8th-gen machine) fell through to the
    highest-priced submodel on latitude-7000-13, i.e. the 2024 Core
    Ultra Latitude 7350 — the exact mis-bridge behind the $473 Amber
    overquote / the 104-model Core Ultra audit.
    """
    s = re.sub(r"[^a-z0-9]+", "-", (label or "").lower()).strip("-")
    if not s:
        return []
    cands = [s]
    if s.endswith("-series"):
        cands.append(s[: -len("-series")])
    return cands


def match_submodel_by_label(subs: dict, label: str):
    """Find the submodel whose slug matches the variant label — exact
    first, then boundary prefix/suffix (sub "latitude-7300" matches
    label-slug "latitude-7300"; sub "inspiron-7300-2-in-1" matches
    "inspiron-7300"). Ambiguity resolves to the highest-priced match."""
    cands = label_slug_candidates(label)
    for c in cands:
        if c in subs and subs[c].get("base_price", 0) > 0:
            return subs[c]
    hits = []
    for c in cands:
        for sk, sv in subs.items():
            if not sk or sv.get("base_price", 0) <= 0:
                continue
            if sk.startswith(c + "-") or c.startswith(sk + "-") or c.endswith("-" + sk):
                hits.append(sv)
    if hits:
        return max(hits, key=lambda s: s.get("base_price") or 0)
    return None


def pick_submodel(v: dict, page_vid: str, target_slug=None, label=None):
    """Given a v2 adjustments entry (has 'submodels' dict), return the
    submodel dict the build should use for this page variant. Priority:
    1) MANUAL_ID_TO_SUBMODEL exact slug match
    2) target_slug from the page variant (e.g. d_xps_13_7390 → xps-13-7390)
    3) Submodel matching the variant LABEL (umbrella pages: "Latitude
       7300 Series" → latitude-7300)
    4) Highest-priced submodel as "newest" proxy
    5) None if no submodels
    """
    subs = v.get("submodels") or {}
    if not subs:
        # Legacy flat entries — return the entry itself
        if v.get("base_price"):
            return v
        return None
    # Manual override — but only if the targeted submodel actually has
    # usable spec data. IWM occasionally packs a sub-SKU as a single
    # combined label with no chip/RAM tiers (e.g. galaxy-book3 base);
    # in that case fall through to the auto-pick.
    want = MANUAL_ID_TO_SUBMODEL.get(page_vid)
    if want and want in subs:
        candidate = subs[want]
        if candidate.get("base_price", 0) > 0 and candidate.get("chips"):
            return candidate
    # Target slug match (e.g. when the page variant's bridge slug is
    # also a submodel slug like xps-13-7390). This lets each XPS
    # variant pick up its exact submodel pricing instead of the
    # umbrella max.
    if target_slug and target_slug in subs:
        candidate = subs[target_slug]
        if candidate.get("base_price", 0) > 0:
            return candidate
    # Label match — umbrella bridge slugs (latitude-7000-13) cover many
    # submodels; the variant label names the right one.
    if label:
        candidate = match_submodel_by_label(subs, label)
        if candidate:
            return candidate
    # Default: highest-priced submodel. For multi-gen URLs (X1 Carbon
    # Gen 6..13, Razer Blade by year, etc.) the newest gen reliably
    # has the highest IWM base, so this is a good "newest" proxy when
    # sort order is unreliable.
    priced = [(s.get("base_price") or 0, k, s) for k, s in subs.items()]
    if not priced:
        return None
    priced.sort(reverse=True)  # highest first
    return priced[0][2]


def main():
    adj = json.load(open(ADJ))
    # Drop scrape artifacts / placeholder rows so a test or generic entry
    # (e.g. "...-testing", IWM's catch-all "windows-laptop" / "laptop") can
    # never map to a customer-facing spec. Skywalker: kill false-wording specs.
    PLACEHOLDER = re.compile(
        r"-testing\b|(?:^|/)windows-laptop$|(?:^|/)laptop$|placeholder|\bsample\b|\bdummy\b",
        re.I,
    )
    adj = {
        k: v for k, v in adj.items()
        if not (PLACEHOLDER.search(k) or PLACEHOLDER.search(v.get("model") or ""))
    }
    img_to_slug = build_image_to_slug()
    # Index adj entries by IWM model slug AND by submodel slug. Some
    # umbrella URLs (xps-laptop/xps-13-laptop) host the per-submodel
    # data — the page variant's bridge slug (xps-13-7390) matches a
    # submodel key, not the model field. Index both so the lookup works.
    by_slug = {}
    for k, v in adj.items():
        slug = v.get("model")
        if slug:
            by_slug.setdefault(slug, []).append(v)
        # Also index every submodel slug as a fake top-level lookup
        # that points back at this URL's entry — pick_submodel will
        # then dive into the matching submodel.
        for subkey in (v.get("submodels") or {}):
            if PLACEHOLDER.search(subkey):
                continue
            by_slug.setdefault(subkey, []).append(v)
    # A slug often resolves through BOTH its pre-June-2026 IWM URL (dead,
    # stale data) and its restructured one (fresh). Try newest first.
    for entries in by_slug.values():
        entries.sort(key=lambda v: v.get("scraped_at") or "", reverse=True)

    # Read page.tsx variants to extract id ↔ image.
    src = PAGE.read_text(encoding="utf-8")
    # Scan the WHOLE file, not a hardcoded line window. This used to be
    # pinned to lines ~1260..2280, but page.tsx grew past 15k lines and the
    # PC-laptop variant arrays drifted out of that window — so the build
    # silently resolved only a fraction of variants (451 -> ~110), and the
    # committed specs file went stale because no refresh PR merged for weeks.
    # Resolution below is slug-gated (img_to_slug / MANUAL maps are built from
    # the laptop bridges only), so phone/tablet/MacBook/console variants that
    # share the {id,label,base,image} shape simply don't resolve and are
    # skipped — making a full-file scan safe.
    span_start = 0
    span_end = len(src)
    vre = re.compile(
        r'\{\s*id:\s*"(?P<id>[^"]+)",\s*label:\s*"(?P<label>[^"]+)",\s*base:\s*\d+'
        r'(?:,\s*inquiryOnly:\s*(?:true|false))?\s*,\s*image:\s*"(?P<image>/devices/[^"]+)"\s*\}'
    )
    # vid → last real per-model image. On 2026-05-16 (9cf5c34) 137 Lenovo
    # variants swapped their per-model PNGs for one shared generic SVG —
    # which silently broke this image-keyed bridge for all of them (the
    # committed specs file kept serving a stale 451-variant build). Look
    # up the live image first, then fall back to the historical one.
    hist_path = ROOT / "scripts" / "pc-vid-image-history.json"
    vid_hist = json.load(open(hist_path)) if hist_path.exists() else {}

    out = {}
    matched = 0
    for m in vre.finditer(src, span_start, span_end):
        vid, label, image = m.group("id"), m.group("label"), m.group("image")
        slug = (MANUAL_ID_TO_SLUG.get(vid) or
                MANUAL_ID_TO_DESKTOP_SLUG.get(vid) or
                img_to_slug.get(image) or
                img_to_slug.get(vid_hist.get(vid, "")))
        if not slug:
            continue
        entries = by_slug.get(slug)
        if not entries:
            continue
        # Resolve to a specific submodel (newest by default, manual override
        # via MANUAL_ID_TO_SUBMODEL for per-gen page variants, or use the
        # exact submodel matching the page variant's bridge slug — XPS
        # umbrella URLs need this). Prefer entries whose submodels actually
        # contain the target slug — otherwise we might pick an empty stub
        # entry (e.g. xps-laptop/xps-13-7390 has no data, the real spec
        # lives under xps-laptop/xps-13-laptop submodel xps-13-7390).
        sub = None
        for entry in entries:
            sub = pick_submodel(entry, vid, target_slug=slug, label=label)
            if sub and sub.get("base_price"):
                break
        if not sub or not sub.get("base_price"):
            continue
        spec = to_macspec(sub)
        if not spec:
            continue
        out[vid] = spec
        matched += 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, sort_keys=True))
    print(f"Built specs for {matched} page.tsx variants -> {OUT}")
    print(f"Total adj entries: {len(adj)}, with specs: {sum(1 for v in adj.values() if v.get('base_price'))}")


if __name__ == "__main__":
    main()
