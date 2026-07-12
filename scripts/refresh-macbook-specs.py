#!/usr/bin/env python3
"""Refresh MACBOOK_SPECS adj values in app/data/prices.ts from live IWM.

The additive MacBook entries were hand-calibrated ~2026-05-12 and drifted
badly by July (chips $50-450 HIGH vs IWM -> negative-margin overquotes,
worst: mbp14m4 M4 Max 14/32 spec $2150 vs IWM $1700). This script scrapes
the mapped IWM page per model and rewrites ONLY the `adj:` numbers in
place — ids, labels, subs, multipliers, structure all stay untouched so
admin overrides and saved quotes keep working.

Chip matching is by normalized (family, cpu-cores, gpu-cores) tuple:
  spec  label "M5 Pro" sub "18-Core CPU / 20-Core GPU"
  IWM   label "M5 Pro 18-Core, 20-Core GPU"
Memory/storage match by capacity number, re-anchored to the spec's first
tier. Unmatched options are left as-is and reported.

Usage: python3 scripts/refresh-macbook-specs.py [--dry-run]
"""
from __future__ import annotations
import json, re, sys, importlib.util
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
PRICES_TS = ROOT / "app" / "data" / "prices.ts"

spec_mod = importlib.util.spec_from_file_location("s", HERE / "scrape-iwm-sitemap.py")
s = importlib.util.module_from_spec(spec_mod); spec_mod.loader.exec_module(s)

IWM = "https://www.itsworthmore.com/sell/"

# spec key -> (iwm path, strategy)
#   chips: page prices per chip (base + delta)  |  ram: page prices per RAM
#   tier (single-chip models: chip[0] absolute = first RAM tier value)
MODEL_MAP = {
    "mbp16_m5pmax_2026": ("macbook-pro-m1/macbook-pro-16-m5", "chips"),
    "mbp14_m5pmax_2026": ("macbook-pro-m1/macbook-pro-14-m5", "chips"),
    "mbp14_m5_2025":     ("macbook-pro-m1/macbook-pro-14-m5", "chips"),
    "mbp16m4":           ("macbook-pro-m1/macbook-pro-16-m4", "chips"),
    "mbp14m4":           ("macbook-pro-m1/macbook-pro-14-m4", "chips"),
    "mbp16m3":           ("macbook-pro-m1/macbook-pro-16-m3", "chips"),
    "mbp14m3":           ("macbook-pro-m1/macbook-pro-14-m3", "chips"),
    "mbp16m2":           ("macbook-pro-m1/macbook-pro-16-m2", "chips"),
    "mbp14m2":           ("macbook-pro-m1/macbook-pro-14-m2", "chips"),
    "mba13m3":           ("macbook-air-2021-m/macbook-air-13-2024", "chips"),
    "mba13m2":           ("macbook-air-2021-m/macbook-air-13-2022", "chips"),
    "mba13m1":           ("macbook-air-2018-2020/macbook-air-13-2020", "chips"),
    "mba15m3":           ("macbook-air-2021-m/macbook-air-15-2024", "ram"),
    "mba15m2":           ("macbook-air-2021-m/macbook-air-15", "ram"),
    # Two-size entries: chips are "(13-inch)" / "(15-inch)" — each maps to
    # its own page. 13" pages are chip-keyed, 15" pages are RAM-keyed
    # (absolute = first RAM tier).
    "mba_m5_2026": ({"13": ("macbook-air-2021-m/macbook-air-13-m5", "chips"),
                     "15": ("macbook-air-2021-m/macbook-air-15-m5", "ram")}, "two-size"),
    "mba_m4_2025": ({"13": ("macbook-air-2021-m/macbook-air-13-2025", "chips"),
                     "15": ("macbook-air-2021-m/macbook-air-15-2025", "ram")}, "two-size"),
}


def fetch_page(path):
    html = s.fetch(IWM + path)
    tree = s.extract_quiz_blob(html)
    if not tree:
        return None
    subs = s.extract_all_submodels(tree)
    return subs.get("") or (next(iter(subs.values())) if subs else None)


def norm_family(text):
    t = text.lower().replace("chip", " ")
    m = re.search(r"\bm(\d+)\b(?:\s+(pro|max))?", t)
    if not m:
        return None
    return f"m{m.group(1)}" + (f" {m.group(2)}" if m.group(2) else "")


def cores_of(text):
    """(cpu, gpu) core counts from '
    18-Core CPU / 20-Core GPU' or '18-Core, 20-Core GPU'."""
    nums = re.findall(r"(\d+)-Core", text, re.I)
    if len(nums) >= 2:
        return int(nums[0]), int(nums[1])
    if len(nums) == 1:
        return int(nums[0]), None
    return None, None


def cap_gb(label):
    m = re.search(r"(\d+)\s*TB", label, re.I)
    if m:
        return int(m.group(1)) * 1024
    m = re.search(r"(\d+)\s*GB", label, re.I)
    return int(m.group(1)) if m else None


def iwm_chip_absolutes(page):
    base = page.get("base_price", 0)
    out = []
    for c in page.get("chips") or []:
        fam = norm_family(c["label"])
        cpu, gpu = cores_of(c["label"])
        out.append({"family": fam, "cpu": cpu, "gpu": gpu,
                    "label": c["label"], "abs": base + c["adj"]})
    return out


def iwm_cap_deltas(rows):
    """{capacity_gb: delta} from a label->delta dict."""
    out = {}
    for label, delta in (rows or {}).items():
        n = cap_gb(label)
        if n is not None and n not in out:
            out[n] = delta
    return out


def ram_keyed_absolutes(page):
    """RAM-keyed pages: 'chips' are RAM tiers. Returns (base_abs,
    {ram_gb: delta-from-first})."""
    base = page.get("base_price", 0)
    tiers = {}
    for c in page.get("chips") or []:
        n = cap_gb(c["label"])
        if n is not None and n not in tiers:
            tiers[n] = c["adj"]
    return base, tiers


def main():
    dry = "--dry-run" in sys.argv
    src = PRICES_TS.read_text(encoding="utf-8")
    blk_start = src.index("export const MACBOOK_SPECS")
    blk_end = src.find("\nexport ", blk_start + 10)
    # find() returns -1 when MACBOOK_SPECS is the file's last export; the
    # later `blk_end += len(seg) - (j - i)` then walks -1 up to 0 after the
    # first length-changing edit, and every remaining entry_span searches an
    # empty slice → phantom "entry not found" for all subsequent models.
    if blk_end == -1:
        blk_end = len(src)

    pages = {}
    changes, misses = [], []

    def get_page(path):
        if path not in pages:
            print(f"scraping {path} ...", flush=True)
            pages[path] = fetch_page(path)
        return pages[path]

    def entry_span(key):
        m = re.search(r"\n  %s: \{" % re.escape(key), src[blk_start:blk_end])
        if not m:
            return None
        i = blk_start + m.start()
        j = src.index("{", i)
        depth = 0
        while True:
            if src[j] == "{":
                depth += 1
            elif src[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        return i, j + 1

    def dimension_monotonic(seg, field):
        """True when the field's adj ladder never DECREASES with capacity.
        IWM merges per-chip RAM ladders across quiz branches, so a naive
        capacity match can yield 36GB=+250 but 48GB=0 (48 is the M3 Max
        branch's base). A non-monotonic result means the source data is
        cross-branch garbage for this dimension — keep the hand-set values."""
        fm = re.search(r"%s: \[(.*?)\n    \]" % field, seg, re.S)
        if not fm:
            return True
        rows = re.findall(r'label: "([^"]+)"[^}]*?adj: (-?\d+)', fm.group(1))
        ladder = [(cap_gb(l), int(a)) for l, a in rows if cap_gb(l) is not None]
        ladder.sort()
        return all(b[1] >= a[1] for a, b in zip(ladder, ladder[1:]))

    def set_adj(seg, field, label, sub, new_val, key):
        """Replace adj on the option line matching label(+sub) inside the
        field array. Returns updated segment or None if not found."""
        fm = re.search(r"%s: \[(.*?)\n    \]" % field, seg, re.S)
        if not fm:
            return None
        arr = fm.group(1)
        if sub:
            opt_re = re.compile(
                r'(\{[^}]*label: "%s", sub: "%s"[^}]*adj: )(-?\d+)' %
                (re.escape(label), re.escape(sub)))
        else:
            opt_re = re.compile(
                r'(\{[^}]*label: "%s"[^}]*adj: )(-?\d+)' % re.escape(label))
        m2 = opt_re.search(arr)
        if not m2:
            return None
        old = int(m2.group(2))
        if old == new_val:
            return seg
        changes.append((key, field, label, sub, old, new_val))
        new_arr = arr[:m2.start()] + m2.group(1) + str(new_val) + arr[m2.end():]
        return seg[:fm.start(1)] + new_arr + seg[fm.end(1):]

    for key, (source, strategy) in MODEL_MAP.items():
        span = entry_span(key)
        if not span:
            misses.append((key, "entry not found"))
            continue
        i, j = span
        seg = src[i:j]

        # Parse the spec's option labels
        def spec_opts(field):
            fm = re.search(r"%s: \[(.*?)\n    \]" % field, seg, re.S)
            if not fm:
                return []
            return re.findall(
                r'label: "([^"]+)"(?:, sub: "([^"]*)")?[^}]*?adj: (-?\d+)',
                fm.group(1))

        if strategy == "two-size":
            for size, (path, sub_strategy) in source.items():
                page = get_page(path)
                if not page:
                    misses.append((key, f"no data for {path}"))
                    continue
                for label, sub, old in spec_opts("processors"):
                    if f"({size}-inch)" not in label:
                        continue
                    if sub_strategy == "ram":
                        new_abs = page.get("base_price", 0)
                    else:
                        cands = iwm_chip_absolutes(page)
                        cpu, gpu = cores_of(sub)
                        hit = [c for c in cands if c["gpu"] == gpu] if gpu is not None else cands
                        if not hit:
                            misses.append((key, f"chip {label}/{sub}"))
                            continue
                        new_abs = hit[0]["abs"]
                    upd = set_adj(seg, "processors", label, sub, int(new_abs), key)
                    if upd:
                        seg = upd
            src = src[:i] + seg + src[j:]
            blk_end += len(seg) - (j - i)
            continue

        page = get_page(source)
        if not page:
            misses.append((key, f"no data for {source}"))
            continue

        if strategy == "ram":
            base_abs, ram_tiers = ram_keyed_absolutes(page)
            procs = spec_opts("processors")
            if len(procs) == 1:
                label, sub, old = procs[0]
                upd = set_adj(seg, "processors", label, sub, int(base_abs), key)
                if upd:
                    seg = upd
            else:
                misses.append((key, f"ram-keyed page but {len(procs)} spec chips"))
            # memory from the RAM tiers, re-anchored to the spec's first tier
            mems = spec_opts("memory")
            if mems:
                first_n = cap_gb(mems[0][0])
                if first_n in ram_tiers:
                    before, mark = seg, len(changes)
                    anchor = ram_tiers[first_n]
                    for label, sub, old in mems:
                        n = cap_gb(label)
                        if n in ram_tiers:
                            upd = set_adj(seg, "memory", label, sub, int(ram_tiers[n] - anchor), key)
                            if upd:
                                seg = upd
                        else:
                            misses.append((key, f"mem {label}"))
                    if not dimension_monotonic(seg, "memory"):
                        seg = before
                        del changes[mark:]
                        misses.append((key, "memory non-monotonic - kept hand values"))
            stor_deltas = iwm_cap_deltas(page.get("storage_adj"))
        else:  # chips
            cands = iwm_chip_absolutes(page)
            for label, sub, old in spec_opts("processors"):
                fam = norm_family(label)
                cpu, gpu = cores_of(sub or "")
                hit = [c for c in cands if c["family"] == fam]
                if gpu is not None:
                    hit = [c for c in hit if c["gpu"] == gpu and (cpu is None or c["cpu"] == cpu)]
                if len(hit) != 1:
                    misses.append((key, f"chip {label}/{sub} -> {len(hit)} matches"))
                    continue
                upd = set_adj(seg, "processors", label, sub, int(hit[0]["abs"]), key)
                if upd:
                    seg = upd
            # memory from ram_adj, re-anchored
            ram_deltas = iwm_cap_deltas(page.get("ram_adj"))
            mems = spec_opts("memory")
            if mems and ram_deltas:
                first_n = cap_gb(mems[0][0])
                if first_n in ram_deltas:
                    before, mark = seg, len(changes)
                    anchor = ram_deltas[first_n]
                    for label, sub, old in mems:
                        n = cap_gb(label)
                        if n in ram_deltas:
                            upd = set_adj(seg, "memory", label, sub, int(ram_deltas[n] - anchor), key)
                            if upd:
                                seg = upd
                    if not dimension_monotonic(seg, "memory"):
                        seg = before
                        del changes[mark:]
                        misses.append((key, "memory non-monotonic - kept hand values"))
            stor_deltas = iwm_cap_deltas(page.get("storage_adj"))

        # storage, re-anchored to the spec's first tier
        stors = spec_opts("storage")
        if stors and stor_deltas:
            first_n = cap_gb(stors[0][0])
            if first_n in stor_deltas:
                before, mark = seg, len(changes)
                anchor = stor_deltas[first_n]
                for label, sub, old in stors:
                    n = cap_gb(label)
                    if n in stor_deltas:
                        upd = set_adj(seg, "storage", label, sub, int(stor_deltas[n] - anchor), key)
                        if upd:
                            seg = upd
                if not dimension_monotonic(seg, "storage"):
                    seg = before
                    del changes[mark:]
                    misses.append((key, "storage non-monotonic - kept hand values"))

        src = src[:i] + seg + src[j:]
        blk_end += len(seg) - (j - i)

    print(f"\n{len(changes)} adj values updated:")
    for key, field, label, sub, old, new in changes:
        print(f"  {key:20s} {field:10s} {label} {sub or '':28s} {old:>5} -> {new}")
    if misses:
        print(f"\n{len(misses)} unmatched (left as-is):")
        for key, what in misses:
            print(f"  {key:20s} {what}")

    if not dry:
        PRICES_TS.write_text(src, encoding="utf-8", newline="")
        print(f"\nwrote {PRICES_TS}")
    else:
        print("\n(dry-run: prices.ts not modified)")


if __name__ == "__main__":
    main()
