#!/usr/bin/env python3
"""Compare every PC_LAPTOP_SPECS entry to its IWM raw data and flag
discrepancies in every dimension: chips, RAM, storage, condition,
battery, charger, GPU, display.

Output is grouped by severity:
  CRITICAL — spec exists but IWM has more priced options we're hiding,
             or our base_price differs from IWM's
  WARN     — minor count or label-only mismatches
  INFO     — clean matches

Run: python3 scripts/audit-specs-vs-iwm.py [brand-prefix]
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
ADJ = ROOT / "pc-laptop-iwm-adjustments.json"
SPECS = ROOT / "public" / "comps" / "pc-laptop-specs.json"
BUILDER = ROOT / "scripts" / "build-pc-laptop-specs.py"


def parse_manual_submodel():
    """Read MANUAL_ID_TO_SUBMODEL from the build script. Handles
    multiple entries per line (re.finditer not re.match)."""
    bsrc = BUILDER.read_text()
    out = {}
    in_block = False
    for line in bsrc.splitlines():
        if "MANUAL_ID_TO_SUBMODEL = {" in line:
            in_block = True
            continue
        if in_block and line.strip() == "}":
            break
        if in_block:
            for m in re.finditer(r'"([^"]+)":\s*"([^"]+)"', line):
                out[m.group(1)] = m.group(2)
    return out


def parse_manual_image_to_slug():
    bsrc = BUILDER.read_text()
    out = {}
    in_block = False
    for line in bsrc.splitlines():
        if "MANUAL_IMAGE_TO_SLUG = {" in line:
            in_block = True
            continue
        if in_block and line.strip() == "}":
            break
        if in_block:
            m = re.match(r'\s*"([^"]+)":\s*"([^"]+)"', line)
            if m:
                out[m.group(1)] = m.group(2)
    return out


def parse_manual_id_to_slug():
    """Top-level MANUAL_ID_TO_SLUG."""
    bsrc = BUILDER.read_text()
    out = {}
    in_block = False
    for line in bsrc.splitlines():
        if "MANUAL_ID_TO_SLUG = {" in line:
            in_block = True
            continue
        if in_block and line.strip() == "}":
            break
        if in_block:
            for m in re.finditer(r'"([^"]+)":\s*"([^"]+)"', line):
                out[m.group(1)] = m.group(2)
    return out


def find_iwm_data(vid: str, page_image: str, adj: dict,
                  id_to_sub: dict, img_to_slug: dict, manual_img: dict, manual_id_to_slug: dict):
    """Locate the IWM raw spec data for a page variant. Returns the
    submodel dict or None."""
    # Manual id → submodel slug
    target_sub = id_to_sub.get(vid)
    # Manual id → top-level slug
    top_slug = manual_id_to_slug.get(vid)
    # Manual image override
    if not top_slug and page_image in manual_img:
        top_slug = manual_img[page_image]
    # Bridge img → slug
    if not top_slug:
        top_slug = img_to_slug.get(page_image)

    if not top_slug and not target_sub:
        return None

    # Build candidate URL entries
    candidates = []
    for k, v in adj.items():
        if v.get("model") == top_slug:
            candidates.append(v)
        if target_sub and target_sub in (v.get("submodels") or {}):
            candidates.append(v)
        if top_slug and top_slug in (v.get("submodels") or {}):
            candidates.append(v)

    for c in candidates:
        subs = c.get("submodels") or {}
        if target_sub and target_sub in subs and subs[target_sub].get("base_price"):
            return subs[target_sub]
        if top_slug in subs and subs[top_slug].get("base_price"):
            return subs[top_slug]
        # Highest priced fallback
        priced = [s for s in subs.values() if s.get("base_price")]
        if priced:
            priced.sort(key=lambda s: -s["base_price"])
            return priced[0]
        if c.get("base_price"):
            return c
    return None


def compare_dim(our_list, iwm_dict_or_list, label):
    """Given our spec dimension (list of {label, adj}) and IWM raw
    (dict or list), return discrepancy report."""
    our_labels = set(o["label"] for o in our_list) if our_list else set()
    if isinstance(iwm_dict_or_list, dict):
        iwm_labels = set(iwm_dict_or_list.keys())
    elif isinstance(iwm_dict_or_list, list):
        iwm_labels = set(c.get("label", "") for c in iwm_dict_or_list)
    else:
        iwm_labels = set()
    extra = our_labels - iwm_labels
    missing = iwm_labels - our_labels
    return extra, missing


def main():
    prefix = sys.argv[1] if len(sys.argv) > 1 else ""
    adj = json.loads(ADJ.read_text())
    specs = json.loads(SPECS.read_text())
    id_to_sub = parse_manual_submodel()
    manual_img = parse_manual_image_to_slug()
    manual_id_slug = parse_manual_id_to_slug()

    # Parse page.tsx for variant_id → image map
    src = (ROOT / "app" / "page.tsx").read_text()
    vid_to_image = {}
    for m in re.finditer(r'\{\s*id:\s*"([^"]+)",\s*label:\s*"[^"]+",\s*base:\s*\d+(?:,\s*inquiryOnly:\s*(?:true|false))?,\s*image:\s*"(/devices/[^"]+)"', src):
        vid_to_image[m.group(1)] = m.group(2)

    # Img → slug from bridges
    img_to_slug = {}
    for brand in ("lenovo", "hp", "asus"):
        bpath = ROOT / "scripts" / f"{brand}-models.json"
        if not bpath.exists(): continue
        for e in json.loads(bpath.read_text()):
            if e.get("model_slug") and e.get("image"):
                img_to_slug[e["image"]] = e["model_slug"]

    critical = []
    warn = []
    no_iwm = 0
    clean = 0
    for vid in sorted(specs):
        if prefix and not vid.startswith(prefix):
            continue
        s = specs[vid]
        if s.get("_inquiry_only"):
            continue
        iwm_sub = find_iwm_data(vid, vid_to_image.get(vid, ""), adj, id_to_sub, img_to_slug, manual_img, manual_id_slug)
        if not iwm_sub:
            no_iwm += 1
            continue

        # Base price check
        our_base = s.get("base_price", 0)
        iwm_base = iwm_sub.get("base_price", 0)
        issues = []
        if our_base != iwm_base:
            issues.append(("CRIT", f"base mismatch: ours=${our_base} IWM=${iwm_base}"))

        # Chip count check (after filter — IWM may legitimately have
        # more out-of-era chips we filtered. Only warn if our count is
        # less than IWM's IN-ERA count.)
        iwm_chip_labels = [c["label"] for c in iwm_sub.get("chips", [])]
        our_chip_labels = [p["label"] for p in s.get("processors", [])]
        extra_chips = set(our_chip_labels) - set(iwm_chip_labels)
        if extra_chips:
            issues.append(("CRIT", f"chip(s) in ours but NOT in IWM: {extra_chips}"))

        # RAM / storage / condition / battery / charger / GPU / display
        # — every label in our spec must exist in IWM raw, but the
        # reverse is fine (we filter chips so missing-from-ours is
        # expected for out-of-era options).
        for dim_name, our_dim, iwm_raw in [
            ("ram",       s.get("memory",   []),  iwm_sub.get("ram_adj",       {})),
            ("storage",   s.get("storage",  []),  iwm_sub.get("storage_adj",   {})),
            ("gpu",       s.get("graphics", []),  iwm_sub.get("gpu_adj",       {})),
            ("display",   s.get("display",  []),  iwm_sub.get("display_adj",   {})),
        ]:
            our_labels = {o["label"] for o in our_dim}
            iwm_labels = set(iwm_raw.keys()) if isinstance(iwm_raw, dict) else set()
            extra = our_labels - iwm_labels
            missing = iwm_labels - our_labels
            if extra:
                issues.append(("CRIT", f"{dim_name}: extra in ours: {extra}"))
            if missing:
                issues.append(("WARN", f"{dim_name}: missing in ours: {missing}"))

        # Condition / battery / charger comparisons
        for adjkey in ("condition_adj", "battery_adj", "charger_adj"):
            ours = s.get(adjkey, {})
            theirs = iwm_sub.get(adjkey, {})
            for k, v in theirs.items():
                if k not in ours:
                    issues.append(("WARN", f"{adjkey}: missing {k}={v}"))
                elif ours[k] != v:
                    issues.append(("WARN", f"{adjkey}: {k} ours={ours[k]} iwm={v}"))
            for k in ours:
                if k not in theirs:
                    issues.append(("WARN", f"{adjkey}: extra {k}={ours[k]}"))

        if not issues:
            clean += 1
        else:
            crit = [m for sev, m in issues if sev == "CRIT"]
            warn_ = [m for sev, m in issues if sev == "WARN"]
            if crit:
                critical.append((vid, crit, warn_))
            else:
                warn.append((vid, warn_))

    print(f"Audited {len(specs)} specs, prefix={prefix!r}")
    print(f"  CRITICAL mismatches: {len(critical)}")
    print(f"  WARN-only:           {len(warn)}")
    print(f"  No IWM mapping:      {no_iwm}")
    print(f"  Clean:               {clean}")

    print("\n=== CRITICAL ===")
    for vid, crit, warns in critical[:40]:
        print(f"\n  {vid}")
        for m in crit: print(f"    CRIT: {m}")
        for m in warns[:3]: print(f"    warn: {m}")
        if len(warns) > 3: print(f"    ... +{len(warns)-3} more warns")
    if len(critical) > 40:
        print(f"\n  ... +{len(critical)-40} more critical entries")

    if warn:
        print(f"\n=== WARN-ONLY ({len(warn)} entries, showing first 5) ===")
        for vid, warns in warn[:5]:
            print(f"\n  {vid}")
            for m in warns[:3]: print(f"    warn: {m}")


if __name__ == "__main__":
    main()
