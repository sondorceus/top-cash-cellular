#!/usr/bin/env python3
"""Apply IWM-scraped PC laptop prices to app/page.tsx.

For every non-Apple laptop variant in page.tsx:
  1. Look up its image path in the brand bridge files (lenovo/hp/dell/asus/...)
  2. Derive the IWM model slug
  3. Cross-reference iwm-catalog.json to get the IWM (series, model) URL
  4. Look up the Flawless IWM price in public/comps/iwm-pc-laptop-prices.json
  5. If priced, set base = round(iwm_flawless * 0.90) and remove inquiryOnly.
     If not, leave the variant as-is.

Idempotent — run after each scrape refresh. Writes a report to
/tmp/iwm-pc-laptop-apply-report.txt listing matched, missing, and skipped.
"""
from __future__ import annotations
import json, re, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).parent.parent
PAGE = ROOT / "app" / "page.tsx"
CATALOG = ROOT / "iwm-catalog.json"
PRICES = ROOT / "public" / "comps" / "iwm-pc-laptop-prices.json"
BRIDGES = {
    "lenovo": ROOT / "scripts" / "lenovo-models.json",
    "hp": ROOT / "scripts" / "hp-models.json",
    "dell": ROOT / "scripts" / "dell-models.json",
    "asus": ROOT / "scripts" / "asus-models.json",
    "acer": ROOT / "scripts" / "acer-models.json",
    "lg": ROOT / "scripts" / "lg-models.json",
    "samsung_pc": ROOT / "scripts" / "samsung_pc-models.json",
}
DISCOUNT = 0.10
REPORT = Path(tempfile.gettempdir()) / "iwm-pc-laptop-apply-report.txt"

# vid → last real per-model image, captured before the 2026-05-16 swap to
# generic SVGs (see comment in the file). Fallback for image bridging.
_HIST_PATH = ROOT / "scripts" / "pc-vid-image-history.json"
VID_HIST = json.loads(_HIST_PATH.read_text(encoding="utf-8")) if _HIST_PATH.exists() else {}


# Manual overrides for page.tsx variants whose image filename doesn't
# follow the brand-bridge pattern (hand-rolled short names like
# `ln_tp_e14_g7.png`). Maps image path → IWM model slug.
MANUAL_IMAGE_TO_SLUG = {
    # Lenovo ThinkPad X-series legacy
    "/devices/ln_tp_x390.png": "lenovo-thinkpad-x390-series",
    "/devices/ln_tp_x9_14.png": "lenovo-thinkpad-x9",
    "/devices/ln_tp_x9_15.png": "lenovo-thinkpad-x9",
    # Lenovo ThinkPad E-series by generation
    "/devices/ln_tp_e14_g7.png": "lenovo-thinkpad-e14-gen-7",
    "/devices/ln_tp_e14_g6.png": "lenovo-thinkpad-e14-gen-6",
    "/devices/ln_tp_e14_g5.png": "lenovo-thinkpad-e14-gen-5",
    "/devices/ln_tp_e15.png": "lenovo-thinkpad-e15-gen-4",
    "/devices/ln_tp_e16_g3.png": "lenovo-thinkpad-e16-gen-3",
    "/devices/ln_tp_e16_g2.png": "lenovo-thinkpad-e16-gen-2",
    "/devices/ln_tp_e16_g1.png": "lenovo-thinkpad-e16-gen-1",
}


def build_image_to_slug():
    """Map page.tsx image path → IWM model slug, using bridge files."""
    img_to_slug = dict(MANUAL_IMAGE_TO_SLUG)

    # Lenovo / HP / ASUS — bridge has model_slug field
    for brand in ("lenovo", "hp", "asus"):
        with open(BRIDGES[brand]) as f:
            for entry in json.load(f):
                slug = entry.get("model_slug")
                img = entry.get("image")
                if slug and img:
                    img_to_slug[img] = slug

    # Dell — derive slug by stripping `dell_<sub_id>_` from `id`
    with open(BRIDGES["dell"]) as f:
        for entry in json.load(f):
            img = entry.get("image")
            sub = entry.get("sub_id") or ""
            bid = entry.get("id") or ""
            prefix = f"dell_{sub}_"
            if img and bid.startswith(prefix):
                slug = bid[len(prefix):]
                img_to_slug[img] = slug

    # Acer / LG / Samsung_PC — bridges use page.tsx-style ids without IWM slugs.
    # Fall back to label-based matching against catalog later.
    return img_to_slug


def build_catalog_index():
    """Map IWM model slug → list of catalog entries (series + model).
    Augmented with any (series, model) pairs found in the scrape output so
    bridge-only slugs (not in the official iwm-catalog.json) still resolve.
    """
    by_model = {}
    with open(CATALOG) as f:
        cat = json.load(f)
    for d in cat["devices"]:
        if d.get("category") != "laptops":
            continue
        by_model.setdefault(d["model"], []).append(d)

    # Augment from the scrape output — it contains every (series, model)
    # the scraper visited, including bridge-derived URLs.
    if PRICES.exists():
        for key, v in json.loads(PRICES.read_text()).items():
            series, model = v.get("series"), v.get("model")
            if not series or not model:
                continue
            existing = by_model.setdefault(model, [])
            if not any(e.get("series") == series for e in existing):
                existing.append({"series": series, "model": model})
    return by_model


def load_prices():
    if not PRICES.exists():
        print(f"WARN: {PRICES} not found — has the scrape finished?")
        return {}
    with open(PRICES) as f:
        return json.load(f)


def fuzzy_acer_lg_samsung_match(variant_label, catalog_models):
    """Try to find an IWM model slug by label for brands without bridge slugs.
    Uses token-set scoring (not substring) and penalizes slugs that carry
    tokens the variant doesn't have — otherwise "Galaxy Book" (no gen) would
    match "galaxy-book5" because the substring "book" appears in both.
    Returns (slug, series) or (None, None).
    """
    def tokens_of(s):
        return [t for t in re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-").split("-") if len(t) > 1]

    label_tokens = tokens_of(variant_label)
    if not label_tokens:
        return None, None
    label_set = set(label_tokens)

    best = None  # (hits, -extras, slug, series)
    for slug, entries in catalog_models.items():
        slug_tokens = tokens_of(slug)
        if not slug_tokens:
            continue
        slug_set = set(slug_tokens)
        hits = len(label_set & slug_set)
        if hits < 2:
            continue
        extras = len(slug_set - label_set)  # IWM tokens absent from variant label
        score = (hits, -extras)
        if best is None or score > best[:2]:
            best = (hits, -extras, slug, entries[0]["series"])
    if not best:
        return None, None
    return best[2], best[3]


# Variant-id prefixes allowed to use the fuzzy label matcher (brands
# without real bridge slugs). Keep tight — see the gate comment in main().
FUZZY_VID_RE = re.compile(r"^(ac_|sgbk_|lg_|aw[mx]?|aw_|razer|msi)")

# Regex captures a single variant object on one line:
#   { id: "...", label: "...", base: N, inquiryOnly: true|false, image: "..." }
# Field order is roughly stable in page.tsx.
VARIANT_RE = re.compile(
    r"""(\{\s*id:\s*"(?P<id>[^"]+)",\s*
         label:\s*"(?P<label>[^"]+)",\s*
         base:\s*(?P<base>\d+)
         (?:,\s*inquiryOnly:\s*(?P<inquiry>true|false))?
         \s*,\s*image:\s*"(?P<image>/devices/[^"]+)"\s*\})""",
    re.VERBOSE,
)


def page_text():
    return PAGE.read_text(encoding="utf-8")


def find_non_apple_variants(text):
    """Yield regex matches for every PC laptop variant in page.tsx.

    Scans the WHOLE file. This used to be pinned to lines 1260..2245, but
    page.tsx grew past 15k lines and the laptop arrays now live at lines
    ~668..1963 — the window silently skipped everything before 1260, so a
    large slice of laptop variants stopped receiving price updates (same
    bug class fixed in build-pc-laptop-specs.py on 2026-06-22).

    A full scan is safe: resolution below is slug-gated (bridge images /
    fuzzy label match against the IWM laptop catalog), so phone / tablet /
    MacBook / console variants that share the {id,label,base,image} shape
    simply don't resolve and are left untouched.
    """
    for m in VARIANT_RE.finditer(text):
        yield m


def main(dry_run=False):
    img_to_slug = build_image_to_slug()
    catalog = build_catalog_index()
    prices = load_prices()

    text = page_text()
    matched = []
    missing_in_bridge = []
    in_bridge_no_catalog = []
    in_catalog_no_price = []
    fuzzy_matched = []

    # Process matches end-to-start so byte offsets stay valid as we splice
    edits = []
    seen = 0
    for m in list(find_non_apple_variants(text)):
        seen += 1
        vid = m.group("id")
        label = m.group("label")
        image = m.group("image")
        cur_base = int(m.group("base"))
        cur_inquiry = m.group("inquiry") == "true"

        # Try bridge — live image first, then the pre-SVG-swap historical
        # image (2026-05-16 replaced 137 per-model PNGs with one generic
        # SVG, which broke image-keyed bridging for those variants).
        slug = img_to_slug.get(image) or img_to_slug.get(VID_HIST.get(vid, ""))
        source = "bridge"

        if slug:
            if slug not in catalog:
                in_bridge_no_catalog.append((vid, label, slug))
                continue
        else:
            # Fuzzy by label for non-bridge brands. Gated by variant-id
            # prefix (acer / samsung book / LG gram / alienware / razer /
            # msi) — with the whole-file scan, an ungated fuzzy match
            # could price a Galaxy S-series PHONE from a galaxy-book
            # laptop SKU on shared tokens.
            if not FUZZY_VID_RE.match(vid):
                missing_in_bridge.append((vid, label, image))
                continue
            # Desktops must never fuzzy-price off laptop SKUs ("Area-51
            # Desktop" token-matches the Alienware 16 Area-51 laptop).
            # The scrape only covers laptop series, so any desktop label
            # reaching this point has no legitimate match.
            if re.search(r"desktop|tower", label, re.I):
                missing_in_bridge.append((vid, label, image))
                continue
            slug2, series2 = fuzzy_acer_lg_samsung_match(label, catalog)
            if slug2:
                slug = slug2
                source = "fuzzy"
                fuzzy_matched.append((vid, label, slug))
            else:
                missing_in_bridge.append((vid, label, image))
                continue

        # Label-derived submodel keys FIRST: umbrella bridge slugs
        # (latitude-7000-13) price at the page max — the 2024 Core Ultra
        # sibling — while "Latitude 7300 Series" names the exact submodel
        # the prices file carries per-submodel ("…/latitude-7300").
        label_slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
        label_cands = [label_slug]
        if label_slug.endswith("-series"):
            label_cands.append(label_slug[: -len("-series")])

        # A slug can also resolve to several series — typically its
        # pre-June-2026 IWM URL (dead, stale price) plus its restructured
        # one (fresh). Across all candidate keys, take the NEWEST priced.
        key = None
        entry = None
        series_cands = {c["series"] for c in catalog.get(slug, [])}
        lookup_keys = [f"{s}/{c}" for s in series_cands for c in label_cands]
        lookup_keys += [f"{s}/{slug}" for s in series_cands]
        for k in lookup_keys:
            e = prices.get(k)
            if not e or not e.get("iwm_flawless"):
                continue
            if entry is None or (e.get("scraped_at") or "") > (entry.get("scraped_at") or ""):
                key, entry = k, e
        if not entry:
            in_catalog_no_price.append((vid, label, f"{catalog[slug][0]['series']}/{slug}"))
            continue

        iwm = entry["iwm_flawless"]
        new_base = max(1, round(iwm * (1 - DISCOUNT)))
        matched.append((vid, label, key, iwm, new_base, cur_base, cur_inquiry))

        # Build the new variant text. Keep `inquiryOnly: false` so the
        # variant shape stays uniform with siblings — several `as typeof X`
        # casts in page.tsx expect it as a required field.
        new_text = (
            f'{{ id: "{vid}", label: "{label}", base: {new_base}, '
            f'inquiryOnly: false, image: "{image}" }}'
        )
        edits.append((m.start(), m.end(), new_text))

    # Apply edits in reverse
    edits.sort(key=lambda e: -e[0])
    new_page = text
    for start, end, replacement in edits:
        new_page = new_page[:start] + replacement + new_page[end:]

    if not dry_run:
        PAGE.write_text(new_page, encoding="utf-8")

    # Report
    lines = [
        f"PC laptop price application report",
        f"=================================",
        f"Variants seen in span:     {seen}",
        f"Matched & priced:          {len(matched)}",
        f"  (via fuzzy label match:  {len(fuzzy_matched)})",
        f"In bridge, not in catalog: {len(in_bridge_no_catalog)}",
        f"No bridge mapping:         {len(missing_in_bridge)}",
        f"Bridged but no price:      {len(in_catalog_no_price)}",
        "",
        "MATCHED & APPLIED",
        "-----------------",
    ]
    for vid, label, key, iwm, new_base, cur_base, cur_inq in matched:
        change = f"{cur_base}{'(inq)' if cur_inq else ''} -> {new_base}"
        lines.append(f"  {vid:<28} {label:<45} IWM ${iwm:>5}  base: {change}")

    lines += ["", "IN CATALOG BUT NO PRICE SCRAPED YET", "-----------------------------------"]
    for vid, label, key in in_catalog_no_price[:40]:
        lines.append(f"  {vid:<28} {label:<45} {key}")
    if len(in_catalog_no_price) > 40:
        lines.append(f"  ... +{len(in_catalog_no_price)-40} more")

    lines += ["", "NOT FOUND IN IWM CATALOG (left inquiryOnly)", "-------------------------------------------"]
    for vid, label, image in missing_in_bridge[:40]:
        lines.append(f"  {vid:<28} {label:<45} {image}")
    if len(missing_in_bridge) > 40:
        lines.append(f"  ... +{len(missing_in_bridge)-40} more")

    lines += ["", "BRIDGE SAYS SLUG, CATALOG MISSING", "---------------------------------"]
    for vid, label, slug in in_bridge_no_catalog[:40]:
        lines.append(f"  {vid:<28} {label:<45} {slug}")
    if len(in_bridge_no_catalog) > 40:
        lines.append(f"  ... +{len(in_bridge_no_catalog)-40} more")

    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:14]))
    print(f"\nFull report: {REPORT}")
    if dry_run:
        print("(dry-run: page.tsx not modified)")


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
