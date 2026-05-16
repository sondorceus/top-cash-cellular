#!/usr/bin/env python3
"""Generate page.tsx code blocks (GARMIN_MODELS, SAMSUNGWATCH_MODELS,
MODEL_GROUPS.garmin, GARMIN_EDITIONS / SAMSUNGWATCH_EDITIONS) from
iwm-watch-adjustments.json. Apply IWM × 0.90 to base prices.

Strategy: one page variant per IWM SUBMODEL (e.g. Fenix 7, Fenix 8 Pro,
Forerunner 965). For submodels that carry an `edition_adj` map, expose
those as a per-variant brand_extras question (Standard / Sapphire Solar
/ etc.) so the user can match what they own exactly.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).parent.parent
ADJ = json.loads((ROOT / "iwm-watch-adjustments.json").read_text())
DISCOUNT = 0.10  # our price = IWM × 0.90

# Series → (group_label, brand_label)
GARMIN_SERIES = [
    ("garmin-fenix",       "Fenix",       "Fenix"),
    ("garmin-epix",        "Epix",        "Epix"),
    ("garmin-forerunner",  "Forerunner",  "Forerunner"),
    ("garmin-venu",        "Venu",        "Venu"),
    ("garmin-vivoactive",  "Vivoactive",  "Vivoactive"),
    ("garmin-instinct",    "Instinct",    "Instinct"),
    ("garmin-approach",    "Approach",    "Approach"),
    ("garmin-descent",     "Descent",     "Descent"),
    ("garmin-enduro",      "Enduro",      "Enduro"),
    ("garmin-marq",        "MARQ",        "MARQ"),
    ("garmin-quatix",      "Quatix",      "Quatix"),
    ("garmin-lily",        "Lily",        "Lily"),
]
# Tactix omitted — IWM lists 3 submodels with $0 prices (no buyback).

SAMSUNG = [
    ("samsung-galaxy-watch-ultra-2025", "sgwu25", "Galaxy Watch Ultra (2025)", "Ultra"),
    ("samsung-galaxy-watch-ultra",      "sgwu",   "Galaxy Watch Ultra",        "Ultra"),
    ("samsung-galaxy-watch-8-classic",  "sgw8c",  "Galaxy Watch 8 Classic",    "Watch 8"),
    ("samsung-galaxy-watch-8",          "sgw8",   "Galaxy Watch 8",            "Watch 8"),
    ("samsung-galaxy-watch-7",          "sgw7",   "Galaxy Watch 7",            "Watch 7"),
]


def discount(p):
    return max(1, round(p * (1 - DISCOUNT)))


def vid_from_submodel(series_short, submodel_slug):
    """e.g. fenix + fenix-7 → gfenix7  (drop redundant series prefix)."""
    if submodel_slug == series_short:
        # The "base" submodel that just equals the series name (e.g.
        # garmin-enduro/enduro) — give it a -orig suffix to keep IDs unique.
        sub_clean = "orig"
    else:
        sub = submodel_slug.replace(f"{series_short}-", "", 1)
        sub_clean = re.sub(r"[^a-z0-9]+", "", sub.lower())
    return f"g{series_short.replace('-','')}{sub_clean}"


# Submodels to skip: IWM tree quirks where the base_price ends up bogus
# (e.g. Venu 3 reads $5 because the picker re-enters the Venu 2 branch).
SKIP_SUBMODELS = {
    "garmin-venu/venu-3",
}


def _editions_clean_for_submodel(submodel_slug: str, edition_adj: dict) -> bool:
    """Heuristic: only keep edition options whose label clearly belongs to
    THIS submodel. e.g. "fenix-7s" should match "Fenix 7S *" labels. If
    >50% of edition labels reference a sibling submodel (like Marq's
    shared list across all submodels), reject the whole edition map."""
    # Build the submodel's key token (e.g. fenix-7s → "7s", venu-2 → "2")
    tokens = submodel_slug.split("-")
    if len(tokens) < 2:
        return True
    key = tokens[-1].lower()  # e.g. "7s", "8-pro" loses prefix → take last segment
    # Count labels that contain that token as a word/digit
    matched = 0
    for lbl in edition_adj:
        ll = lbl.lower()
        if key in ll.split() or key in re.split(r"[^a-z0-9]+", ll):
            matched += 1
    return matched / max(1, len(edition_adj)) >= 0.6


def emit_garmin():
    variants = []      # rendered TS lines for GARMIN_MODELS
    groups = []        # rendered TS lines for MODEL_GROUPS.garmin
    editions_map = []  # rendered TS lines for GARMIN_EDITIONS
    editions_map.append("const GARMIN_EDITIONS: Record<string, Array<{id: string; label: string; adj: number}>> = {")

    for series_key, group_label, brand_label in GARMIN_SERIES:
        series_short = series_key.replace("garmin-", "")
        full_key = f"garmin-smartwatch/{series_key}"
        e = ADJ.get(full_key, {})
        subs = e.get("submodels") or {}
        group_ids = []
        for sk, sv in sorted(subs.items(), key=lambda kv: -kv[1].get("base_price", 0)):
            base = sv.get("base_price", 0)
            if base <= 0:
                continue
            if f"{series_key}/{sk}" in SKIP_SUBMODELS:
                continue
            vid = vid_from_submodel(series_short, sk)
            if sk == series_short:
                label = f"{brand_label}"
            else:
                label = f"{brand_label} {sk[len(series_short)+1:].replace('-',' ').title()}"
            label = label.replace(" Amoled", " AMOLED").replace(" Lte", " LTE")
            our_base = discount(base)
            variants.append(f'  {{ id: "{vid}", label: {json.dumps(label)}, base: {our_base}, image: "/devices/pixel-watch.png" }},')
            group_ids.append(vid)
            edition_adj = sv.get("edition_adj") or {}
            # Skip series where the edition list cross-pollutes across
            # submodels (IWM tree quirk) — we'd offer users edition options
            # that don't match the model they selected.
            if edition_adj and _editions_clean_for_submodel(sk, edition_adj):
                items = sorted(edition_adj.items(), key=lambda kv: kv[1])
                editions_map.append(f'  {vid}: [')
                for lbl, d in items:
                    eid = re.sub(r"[^a-z0-9]+", "_", lbl.lower()).strip("_")[:30]
                    editions_map.append(f'    {{ id: "{eid}", label: {json.dumps(lbl)}, adj: {discount(d)} }},')
                editions_map.append("  ],")
        if group_ids:
            ids_lit = ", ".join(json.dumps(i) for i in group_ids)
            groups.append(f'    {{ label: "{group_label}", ids: [{ids_lit}] }},')
    editions_map.append("};")

    print("// === GARMIN_MODELS (drop-in replacement) ===")
    for v in variants:
        print(v)
    print()
    print("// === MODEL_GROUPS.garmin (drop-in replacement) ===")
    for g in groups:
        print(g)
    print()
    print("// === GARMIN_EDITIONS map (new constant; insert before brand_extras) ===")
    print("\n".join(editions_map))
    print()


def emit_samsung():
    variants = []
    groups = []
    for series_key, vid, label, group_label in SAMSUNG:
        full_key = f"samsung-watch/{series_key}"
        e = ADJ.get(full_key, {})
        subs = e.get("submodels") or {}
        if subs:
            top_sub = max(subs.values(), key=lambda s: s.get("base_price", 0))
            base = top_sub.get("base_price", 0)
        else:
            base = 0
        if base <= 0:
            continue
        variants.append(f'  {{ id: "{vid}", label: "{label}", base: {discount(base)}, image: "/devices/samsung-watch-7.webp" }},')
        groups.append(f'    {{ label: "{group_label}", ids: ["{vid}"] }},')
    print("// === SAMSUNGWATCH_MODELS (drop-in replacement) ===")
    for v in variants:
        print(v)
    print()
    print("// === MODEL_GROUPS.samsungwatch (drop-in replacement) ===")
    for g in groups:
        print(g)


emit_garmin()
emit_samsung()
