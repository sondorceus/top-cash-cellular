#!/usr/bin/env python3
"""Refresh simple-base device categories (consoles, handhelds, VR) in
app/page.tsx from live IWM.

These devices quote as base x condition-multiplier (no additive specs);
their bases were hand-set ~2026-05-12 and drift. For each mapped variant
this pulls the IWM page grid and sets:

    base = round(0.90 x IWM Flawless at the variant's storage)

Variants whose IWM page/storage is missing are left untouched and logged.
Idempotent; rerun any time. Usage: refresh-simple-bases.py [--dry-run]
"""
from __future__ import annotations
import re, sys, importlib.util
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
PAGE = ROOT / "app" / "page.tsx"

spec = importlib.util.spec_from_file_location("h", HERE / "iwm-head-scrape.py")
h = importlib.util.module_from_spec(spec); spec.loader.exec_module(h)

MULT = 0.90
IWM = "https://www.itsworthmore.com/sell/"

# vid -> (iwm path, model-label regex or None = only/any model,
#         storage-label regex or None = max across storages)
VID_MAP = {
    "ps5pro":     ("sony-game-console/playstation-5-pro", None, None),
    "ps5slim":    ("sony-game-console/playstation-5-slim", None, None),
    "ps5":        ("sony-game-console/playstation-5", None, None),
    "ps4pro":     ("sony-game-console/playstation-4-pro", None, None),
    "ps4":        ("sony-game-console/playstation-4", None, None),
    "ps4slim":    ("sony-game-console/playstation-4-slim", None, None),
    "switch":     ("nintendo-game-console/switch-oled", None, None),
    "switchv2":   ("nintendo-game-console/switch", None, None),
    "switchlite": ("nintendo-game-console/switch-lite", None, None),
    # Xbox pages are storage-keyed grids (rows "1TB"/"2TB" = editions).
    # Pin the STANDARD edition — the 2TB Galaxy special would inflate.
    "xsx":        ("microsoft-game-console/xbox-series-x", r"^1tb$", None),
    "xss":        ("microsoft-game-console/xbox-series-s", r"^512", None),
    # Site sells generic "Xbox One"; the One S is the volume model and
    # IWM's cheapest One SKU, so it's the safe payout anchor.
    "xone":       ("microsoft-game-console/xbox-one-s", None, None),
    "avp_m5":     ("apple-vr/vision-pro-m5", None, None),
    "avp_m2":     ("apple-vr/vision-pro", None, None),
    # Meta Quest — one IWM page, models in the grid. Anchored so
    # "Quest 3S" can never match "Quest 3S Xbox Edition".
    "mq3":        ("meta-quest-vr/meta-vr", r"^quest 3$", r"512"),
    "mq3b":       ("meta-quest-vr/meta-vr", r"^quest 3$", r"128"),
    "mq3s256":    ("meta-quest-vr/meta-vr", r"^quest 3s$", r"256"),
    "mq3128":     ("meta-quest-vr/meta-vr", r"^quest 3s$", r"128"),
    "mq2256":     ("meta-quest-vr/meta-vr", r"^quest 2$", r"256"),
    "mq2128":     ("meta-quest-vr/meta-vr", r"^quest 2$", r"128"),
    "mqpro":      ("meta-quest-vr/meta-vr", r"^quest pro$", None),
    # Desktops — IWM added these series in the June-2026 restructure;
    # they were inquiry-only before. Legacy model-picker grids report
    # top-config Flawless, matching the "Up to $X" base convention.
    "awaurorar16": ("alienware-aurora-series-desktop/alienware-aurora-r16", None, None),
    "awaurorar15": ("alienware-aurora-series-desktop/alienware-aurora-r15", None, None),
    "awaurorar14": ("alienware-aurora-series-desktop/alienware-aurora-r14", None, None),
    "awaurorar13": ("alienware-aurora-series-desktop/alienware-aurora-r13", None, None),
    "awaurorar12": ("alienware-aurora-series-desktop/alienware-aurora-r12", None, None),
    "awaurorar10": ("alienware-aurora-series-desktop/alienware-aurora-r10", None, None),
    "awarea51desktop": ("alienware-area-series-desktop/alienware-area-51-aat2250", None, None),
    "dxps8960":   ("xps-desktop/xps-8960-desktop", None, None),
    "dxps8950":   ("xps-desktop/xps-8950-desktop", None, None),
    "doptiplex7010": ("dell-optiplex-desktop/optiplex-tower", r"7010", None),
    "doptiplex5000": ("dell-optiplex-desktop/optiplex-tower", r"5000", None),
    "hpomendsk":  ("hp-omen-desktop/hp-omen-45l-desktop", None, None),
    "hpomen40":   ("hp-omen-desktop/hp-omen-40l-desktop", None, None),
    "lnthinkm":   ("lenovo-thinkcentre/lenovo-thinkcentre-tower", r"m920", None),
    "lnthinkm90q": ("lenovo-thinkcentre/lenovo-thinkcentre-tiny-desktop", r"m90q", None),
    "lnlegion5dtwr": ("lenovo-legion/lenovo-legion-tower-5i", None, None),
    "lnlegion7dtwr": ("lenovo-legion/lenovo-legion-tower-7i", None, None),
    # Watches — mixed page shapes: Ultras are flat condition-absolute
    # pages; Series pages use a case-material picker whose answer carries
    # the absolute (grid_per_model adds it as branch base).
    "awu3":   ("apple-watch/apple-watch-ultra-3", None, None),
    "awu2":   ("apple-watch/apple-watch-ultra-2", None, None),
    "awu1":   ("apple-watch/apple-watch-ultra", None, None),
    "aws10":  ("apple-watch/apple-watch-series-10", None, None),
    "aws9":   ("apple-watch/apple-watch-series-9", None, None),
    "aws8":   ("apple-watch/apple-watch-series-8", None, None),
    "aws7":   ("apple-watch/apple-watch-series-7", None, None),
    "awse2":  ("apple-watch/apple-watch-se-2nd-gen", None, None),
    "awse1":  ("apple-watch/apple-watch-se", None, None),
    "sgwu25": ("samsung-watch/samsung-galaxy-watch-ultra-2025", None, None),
    "sgwu":   ("samsung-watch/samsung-galaxy-watch-ultra", None, None),
    "sgw8c":  ("samsung-watch/samsung-galaxy-watch-8-classic", None, None),
    "sgw8":   ("samsung-watch/samsung-galaxy-watch-8", None, None),
    "sgw7":   ("samsung-watch/samsung-galaxy-watch-7", None, None),
    # Dell G15/G16 — images unbridged (shared dell-xps.webp rows), so the
    # laptop apply never priced them; sat at $0 while IWM pays $500+.
    "d_g15_5510": ("dell-g-series/dell-g-series-g15", r"^5510$", None),
    "d_g15_5511": ("dell-g-series/dell-g-series-g15", r"^5511$", None),
    "d_g15_5515": ("dell-g-series/dell-g-series-g15", r"^5515$", None),
    "d_g15_5520": ("dell-g-series/dell-g-series-g15", r"^5520$", None),
    "d_g15_5521": ("dell-g-series/dell-g-series-g15", r"^5521$", None),
    "d_g15_5525": ("dell-g-series/dell-g-series-g15", r"^5525$", None),
    "d_g15_5530": ("dell-g-series/dell-g-series-g15", r"^5530$", None),
    "d_g15_5535": ("dell-g-series/dell-g-series-g15", r"^5535$", None),
    "d_g16_7620": ("dell-g-series/dell-g-series-g16", r"^7620$", None),
    "d_g16_7630": ("dell-g-series/dell-g-series-g16", r"^7630$", None),
}

FLAWLESS_LABELS = ("flawless", "excellent")


def grid_for(path, cache={}):
    if path in cache:
        return cache[path]
    url = IWM + path
    html = h.fetch_html(url)
    quiz = h.extract_quiz_blob(html) if html else None
    grid = h.extract_grid(quiz, url) if quiz else None
    cache[path] = grid
    return grid


def flawless_price(grid, model_re, storage_re):
    """Best Flawless price for the mapped (model, storage)."""
    best = None
    for model, storages in (grid or {}).items():
        if model_re and not re.search(model_re, model, re.I):
            continue
        for stor, conds in storages.items():
            if storage_re and not re.search(storage_re, stor, re.I):
                continue
            for cond, price in conds.items():
                if cond.lower() in FLAWLESS_LABELS and isinstance(price, (int, float)):
                    if best is None or price > best:
                        best = price
    return best


def main():
    dry = "--dry-run" in sys.argv
    src = PAGE.read_text(encoding="utf-8")
    changes, misses = [], []

    for vid, (path, model_re, storage_re) in VID_MAP.items():
        grid = grid_for(path)
        if not grid:
            misses.append((vid, f"no grid for {path}"))
            continue
        iwm = flawless_price(grid, model_re, storage_re)
        if not iwm or iwm <= 0:
            misses.append((vid, f"no flawless match in {path}"))
            continue
        new_base = max(1, round(iwm * MULT))
        m = re.search(
            r'(\{\s*id:\s*"%s",\s*label:\s*"([^"]+)",\s*base:\s*)(\d+)((?:,\s*inquiryOnly:\s*)(true|false))?' % re.escape(vid), src)
        if not m:
            misses.append((vid, "variant not found in page.tsx"))
            continue
        old = int(m.group(3))
        if old != new_base:
            head = m.group(1) + str(new_base)
            # A real base means the variant is quotable — clear inquiryOnly
            # so the picker shows the price instead of "Get an offer".
            tail = ", inquiryOnly: false" if m.group(4) else ""
            src = src[:m.start()] + head + tail + src[m.end():]
            changes.append((vid, m.group(2), old, new_base, iwm))

    print(f"{len(changes)} bases updated:")
    for vid, label, old, new, iwm in changes:
        print(f"  {vid:12s} {label:32s} IWM ${iwm:>5}  base: {old} -> {new}")
    if misses:
        print(f"{len(misses)} skipped:")
        for vid, why in misses:
            print(f"  {vid:12s} {why}")
    if not dry:
        PAGE.write_text(src, encoding="utf-8")
        print("wrote page.tsx")
    else:
        print("(dry-run)")


if __name__ == "__main__":
    main()
