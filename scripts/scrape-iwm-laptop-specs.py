#!/usr/bin/env python3
"""Scrape IWM's full additive pricing tree for every PC laptop URL.

IWM embeds the full quiz tree as pricingData on each product page. Each
answer has a `val` (additive $) and `attributes` (processor_type, memory,
storage_size, condition, etc). This script extracts per-model:

  - base price (= flawless + base chip + base RAM + base storage)
  - chip_adj[]          (additive $ per chip option)
  - ram_adj[]           (additive $ per RAM tier)
  - storage_adj[]       (additive $ per storage tier)
  - condition_adj[]     (additive $ per condition)
  - battery_adj[]       (additive $ per battery state)
  - charger_adj[]       (additive $ per charger Yes/No)

For URLs whose tree starts with a "Select Model" branch (e.g. ThinkPad
X1 Carbon → Gen 6..13), we pick the LATEST generation's branch as the
canonical answer for the page.tsx variant. Generation splitting can
come later if needed.

Output: pc-laptop-iwm-adjustments.json keyed by "{series}/{model}".

Usage:
  python3 scripts/scrape-iwm-laptop-specs.py            # all targets
  python3 scripts/scrape-iwm-laptop-specs.py --limit 5  # smoke test
  python3 scripts/scrape-iwm-laptop-specs.py --shard 0 4  # one worker of four
"""
from __future__ import annotations
import json, os, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import importlib.util
spec = importlib.util.spec_from_file_location("scraper", HERE / "scrape-iwm-pc-laptop-prices.py")
scraper = importlib.util.module_from_spec(spec); spec.loader.exec_module(scraper)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
ROOT = HERE.parent
OUT = ROOT / "pc-laptop-iwm-adjustments.json"
SHARD_PREFIX = "/tmp/iwm_laptop_specs.shard"
PROGRESS = Path("/tmp/iwm_laptop_specs_progress.json")

COND_MAP = {
    "new": "sealed", "[new]": "sealed",
    "excellent": "mint", "[excellent]": "mint", "flawless": "mint",
    "very-good": "verygood", "[very-good]": "verygood", "very good": "verygood",
    "good": "good", "[good]": "good",
    "fair": "fair", "[fair]": "fair",
    "broken": "broken", "[broken]": "broken",
}


def grab_pricing_data(pg, url, retries=2):
    for _ in range(retries):
        try:
            pg.goto(url, wait_until="networkidle", timeout=30000)
        except Exception:
            time.sleep(1)
            continue
        pg.wait_for_timeout(900)
        d = pg.evaluate("""() => {
            try {
                const el = document.querySelector("[ng-controller='product-pricing-ctrl']")
                    || document.querySelector("section[ng-controller]");
                if (!el) return null;
                const scope = angular.element(el).scope();
                return {
                    name: scope.productName || '',
                    pricing: scope.pricingData || null,
                };
            } catch(e) { return {error: e.message}; }
        }""")
        if d and d.get("pricing"):
            return d
    return None


def _as_int(v):
    if isinstance(v, (int, float)):
        return int(v)
    try:
        return int(str(v).replace(",", "").strip())
    except Exception:
        return 0


def _attr(ans, key):
    """Read attributes value (handles list form [a-b-c] which IWM uses)."""
    for x in ans.get("attributes", []) or []:
        if x.get("key") == key:
            v = x.get("value")
            if isinstance(v, list):
                return "-".join(v)
            return v
    return ""


def _classify_q(qtext, ans_attrs):
    t = (qtext or "").lower()
    keys = set(ans_attrs)
    if "processor" in t or "processor_type" in keys:
        return "chip"
    if "memory" in t or "memory" in keys:
        return "ram"
    if "storage" in t or "capacity" in t or "storage_size" in keys:
        return "storage"
    if "condition" in t or "condition" in keys:
        return "condition"
    if "battery" in t:
        return "battery"
    if "charger" in t or "accessories" in keys:
        return "charger"
    if "display" in t or "resolution" in t or "display" in keys:
        return "display"
    if "graphics" in t or "gpu" in t:
        return "gpu"
    return "other"


def walk_branch(tree, branch_idx, seen=None):
    """Walk a branch + any sub-branches via go_to, returning a flat dict
    of question_type → list of (label_key, val_int)."""
    if seen is None:
        seen = set()
    if branch_idx in seen or branch_idx < 0 or branch_idx >= len(tree):
        return {}
    seen.add(branch_idx)
    out = {}
    for q in tree[branch_idx].get("questions", []):
        qtext = q.get("text", "")
        for a in q.get("answers", []):
            attrs = {x.get("key"): (x.get("value") if not isinstance(x.get("value"), list) else "-".join(x.get("value"))) for x in (a.get("attributes") or [])}
            qtype = _classify_q(qtext, attrs)
            label = a.get("text", "").strip()
            val = _as_int(a.get("value", 0))
            out.setdefault(qtype, []).append({"label": label, "val": val, "attrs": attrs})
            # Follow sub-branch
            gt = a.get("go_to", "")
            if gt and "," in gt:
                try:
                    sub_idx = int(gt.split(",")[0]) - 1
                    sub_out = walk_branch(tree, sub_idx, seen)
                    for k, v in sub_out.items():
                        # Merge: prefer FIRST occurrence per label
                        existing_labels = {e["label"] for e in out.get(k, [])}
                        for entry in v:
                            if entry["label"] not in existing_labels:
                                out.setdefault(k, []).append(entry)
                except Exception:
                    pass
    return out


def _slugify(label):
    return re.sub(r"[^a-z0-9]+", "-", (label or "").lower()).strip("-")


def extract_all_submodels(tree):
    """Detect a top-level Select-Model branch and emit one spec entry per
    sub-model. If no model picker exists, returns a single-entry dict with
    key "" (empty) holding the base data. This is what fixes the LG Gram
    bug — the old extract_specs only walked the first sub-model's branch.
    """
    if not tree:
        return {}
    first = tree[0]
    first_qs = first.get("questions", [{}])
    first_q = first_qs[0] if first_qs else {}
    first_qtext = (first_q.get("text") or "").lower()
    is_picker = "select model" in first_qtext or "which" in first_qtext

    out = {}
    if is_picker:
        for ans in first_q.get("answers", []):
            label = ans.get("text", "").strip()
            gt = ans.get("go_to", "")
            if not gt or "," not in gt:
                continue
            branch_idx = int(gt.split(",")[0]) - 1
            if branch_idx < 0 or branch_idx >= len(tree):
                continue
            spec = _spec_from_branch(tree, branch_idx, label)
            if spec:
                out[_slugify(label)] = spec
    else:
        spec = _spec_from_branch(tree, 0, "")
        if spec:
            out[""] = spec
    return out


def _spec_from_branch(tree, branch_idx, model_label):
    data = walk_branch(tree, branch_idx)
    if not data:
        return None

    # The base price for IWM = chip[0].val (Flawless, base RAM/storage).
    # Find chip's first option's val. The other dimensions are deltas off
    # that baseline.
    chips = data.get("chip", [])
    base_price = chips[0]["val"] if chips else 0

    # Convert to MacBook-shape adjustments
    def deltas(rows, base_label_first=True):
        if not rows:
            return {}
        # Take first row's val as 0-anchor; emit (label → delta)
        anchor = rows[0]["val"] if base_label_first else 0
        return {r["label"]: r["val"] - anchor for r in rows}

    result = {
        "model_label": model_label,
        "base_price": base_price,  # = chip[0].val (Flawless, base RAM/storage at this submodel/gen)
        "chips": [{"label": r["label"], "adj": r["val"] - base_price, "attrs": r["attrs"]} for r in chips],
        "ram_adj": deltas(data.get("ram", [])),
        "storage_adj": deltas(data.get("storage", [])),
        "condition_adj": {COND_MAP.get(_attr_or_text(r), r["label"].lower()): r["val"] for r in data.get("condition", [])},
        "battery_adj": {r["label"].lower(): r["val"] for r in data.get("battery", [])},
        "charger_adj": {r["label"].lower(): r["val"] for r in data.get("charger", [])},
    }
    # Optional extras
    if data.get("display"):
        result["display_adj"] = deltas(data.get("display", []))
    if data.get("gpu"):
        result["gpu_adj"] = deltas(data.get("gpu", []))
    return result


def _attr_or_text(row):
    cond = (row.get("attrs") or {}).get("condition")
    if cond:
        return cond if not isinstance(cond, list) else cond[0]
    return row.get("label", "").lower()


def scrape(targets, shard_idx=None, total_shards=1):
    progress_path = Path(f"{SHARD_PREFIX}{shard_idx}.json") if shard_idx is not None else PROGRESS
    state = json.loads(progress_path.read_text()) if progress_path.exists() else {}
    print(f"Targets: {len(targets)}  Already: {len(state)}")
    OUT.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA)
        pg = ctx.new_page()
        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=20000)
            try: pg.click('button:has-text("Accept")', timeout=2000)
            except: pass
        except: pass

        for i, t in enumerate(targets):
            key = f"{t['series']}/{t['model']}"
            if state.get(key, {}).get("done"):
                continue
            url = f"https://www.itsworthmore.com/sell/{t['series']}/{t['model']}"
            print(f"[{i+1}/{len(targets)}] {key}", flush=True)
            d = grab_pricing_data(pg, url)
            if not d:
                state[key] = {"series": t["series"], "model": t["model"], "url": url, "done": True, "error": "no_pricing", "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
                progress_path.write_text(json.dumps(state, indent=2))
                continue
            submodels = extract_all_submodels(d.get("pricing"))
            entry = {
                "series": t["series"], "model": t["model"], "url": url,
                "iwm_name": d.get("name", ""),
                "done": True,
                "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "submodels": submodels,
            }
            if submodels:
                # Also flatten the first submodel into entry for back-compat
                first_key = next(iter(submodels))
                entry.update({k: v for k, v in submodels[first_key].items() if k != "model_label"})
                print(f"  submodels={len(submodels)}  first base=${submodels[first_key].get('base_price', 0)}")
            else:
                entry["error"] = "no_specs"
            state[key] = entry
            progress_path.write_text(json.dumps(state, indent=2))
        b.close()
    print(f"Done. Wrote shard {shard_idx} to {progress_path}")


def merge(num=4):
    merged = {}
    for i in range(num):
        p = Path(f"{SHARD_PREFIX}{i}.json")
        if p.exists():
            merged.update(json.loads(p.read_text()))
    OUT.write_text(json.dumps(merged, indent=2, sort_keys=True))
    spec_count = sum(1 for v in merged.values() if v.get("base_price"))
    print(f"Merged {len(merged)} entries, {spec_count} with specs → {OUT}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--merge":
        merge(int(args[1]) if len(args) > 1 else 4)
        sys.exit(0)
    all_t = scraper.load_targets()
    if args and args[0] == "--limit":
        all_t = all_t[:int(args[1])]
    if args and args[0] == "--shard":
        i, n = int(args[1]), int(args[2])
        chunk = [t for k, t in enumerate(all_t) if k % n == i]
        scrape(chunk, shard_idx=i, total_shards=n)
    else:
        scrape(all_t)
