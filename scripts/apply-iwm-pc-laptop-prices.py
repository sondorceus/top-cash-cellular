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
import json, re, sys
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
REPORT = Path("/tmp/iwm-pc-laptop-apply-report.txt")


def build_image_to_slug():
    """Map page.tsx image path → IWM model slug, using bridge files."""
    img_to_slug = {}

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


# Regex captures a single variant object on one line:
#   { id: "...", label: "...", base: N, inquiryOnly: true|false, image: "..." }
# Field order is roughly stable in page.tsx.
VARIANT_RE = re.compile(
    r"""(\{\s*id:\s*"(?P<id>[^"]+)",\s*
         label:\s*"(?P<label>[^"]+)",\s*
         base:\s*(?P<base>\d+)
         (?P<inquiry>,\s*inquiryOnly:\s*true)?
         ,?\s*image:\s*"(?P<image>/devices/[^"]+)"\s*\})""",
    re.VERBOSE,
)


def page_text():
    return PAGE.read_text()


def find_non_apple_variants(text):
    """Yield (start, end, fields) for every PC laptop variant in page.tsx.
    Bounded to lines 1260..2245 covering all non-Apple laptop arrays.
    Some Apple desktop / Dell desktop arrays fall in the range but their
    images aren't in any bridge, so they fall through unchanged.
    """
    lines = text.splitlines(keepends=True)
    line_starts = []
    pos = 0
    for ln in lines:
        line_starts.append(pos)
        pos += len(ln)
    span_start = line_starts[1259] if len(line_starts) > 1259 else 0
    span_end = line_starts[2245] if len(line_starts) > 2245 else len(text)

    for m in VARIANT_RE.finditer(text, span_start, span_end):
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
        cur_inquiry = bool(m.group("inquiry"))

        # Try bridge
        slug = img_to_slug.get(image)
        series = None
        source = "bridge"

        if slug:
            # Look up series in catalog
            entries = catalog.get(slug)
            if entries:
                series = entries[0]["series"]
            else:
                in_bridge_no_catalog.append((vid, label, slug))
                continue
        else:
            # Fuzzy by label for non-bridge brands
            slug2, series2 = fuzzy_acer_lg_samsung_match(label, catalog)
            if slug2:
                slug = slug2
                series = series2
                source = "fuzzy"
                fuzzy_matched.append((vid, label, slug))
            else:
                missing_in_bridge.append((vid, label, image))
                continue

        key = f"{series}/{slug}"
        entry = prices.get(key)
        if not entry or not entry.get("iwm_flawless"):
            in_catalog_no_price.append((vid, label, key))
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
        PAGE.write_text(new_page)

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

    REPORT.write_text("\n".join(lines))
    print("\n".join(lines[:14]))
    print(f"\nFull report: {REPORT}")
    if dry_run:
        print("(dry-run: page.tsx not modified)")


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
