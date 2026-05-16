#!/usr/bin/env python3
"""Scrape IWM prices for every non-Apple laptop in iwm-catalog.json.

Drives fetch-iwm-universal's playwright primitives over the laptop URLs we
already discovered. Output: public/comps/iwm-pc-laptop-prices.json keyed by
"{series}/{model}" with Flawless/Good/Fair IWM prices and our 10%-discounted
price. Resume support: progress saved to /tmp/iwm_pc_laptop_progress.json so
the run can be interrupted and restarted.
"""
from __future__ import annotations
import json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

from playwright.sync_api import sync_playwright

# Import primitives from the universal scraper
import importlib.util
spec = importlib.util.spec_from_file_location(
    "iwm_universal", HERE / "fetch-iwm-universal.py"
)
iwm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(iwm)

CATALOG = ROOT / "iwm-catalog.json"
OUT = ROOT / "public" / "comps" / "iwm-pc-laptop-prices.json"
PROGRESS = Path("/tmp/iwm_pc_laptop_progress.json")
CONDITIONS = ["Flawless"]  # only need Flawless for base price (× 0.90)
DISCOUNT = 0.10  # our price = iwm * 0.90 (matches Skywalker policy)

# Parallel worker support: each worker reads/writes its own shard file
# /tmp/iwm_pc_laptop_progress.shard<N>.json, then merge writes OUT.
SHARD_PREFIX = "/tmp/iwm_pc_laptop_progress.shard"

# Per-brand bridge-derived URL series. The IWM catalog scraper missed
# many sub-category pages (e.g. ThinkPad X1, EliteBook G-series, XPS by
# year). The brand scrapers (scrape-iwm-{lenovo,hp,dell,asus}.py) walked
# those pages so we know the URL series. Mirror that mapping here so
# the price scraper can hit those URLs.
LENOVO_SUB_TO_SERIES = {
    "tp_x1": "lenovo-thinkpad-x1-series",
    "tp_x13": "lenovo-thinkpad-x13-series-laptop",
    "tp_x390": "lenovo-thinkpad-x390-series-laptop",
    "tp_x9": "lenovo-thinkpad-x9-series-laptop",
    "tp_z": "lenovo-thinkpad-z-series",
    "tp_t": "lenovo-thinkpad-t-series",
    "tp_p": "lenovo-thinkpad-p-series-laptop",
    "tp_l": "lenovo-thinkpad-l-series",
    "tp_e": "lenovo-thinkpad-e-series",
    "tb_13": "lenovo-thinkbook-series/lenovo-thinkbook-13-series",
    "tb_14": "lenovo-thinkbook-series/lenovo-thinkbook-14-series",
    "tb_15": "lenovo-thinkbook-series/lenovo-thinkbook-15-series",
    "tb_16": "lenovo-thinkbook-series/lenovo-thinkbook-16-series",
    "": None,  # flat: ideapad/legion/loq/slim/yoga handled below by series_id
}
LENOVO_FLAT_TO_SERIES = {
    "ideapad": "lenovo-ideapad-laptop",
    "legion": "lenovo-legion-laptop",
    "loq": "lenovo-loq-series-laptop",
    "slim": "lenovo-slim-laptop",
    "yoga": "lenovo-yoga-laptop",
}

HP_SUB_TO_SERIES = {
    "eb_std": "hp-elitebook",
    "eb_ultra": "hp-elitebook-ultra",
    "omen_std": "hp-omen-laptop",
    "omen_max": "hp-omen-max-laptop",
    "omen_slim": "hp-omen-slim-laptop",
    "omen_trans": "hp-omen-transcend-laptop",
}
# HP bridge entries without a sub_id (flat series like Envy / Pavilion /
# ProBook) — match by series_id instead.
HP_SERIES_TO_SERIES = {
    "envy": "hp-envy",
    "omnibook": "hp-omnibook",
    "pavilion": "hp-pavilion",
    "probook": "hp-probook",
    "spectre": "hp-spectre",
    "victus": "hp-victus-laptop",
    "zbook": "hp-zbook",
    "notebook": "hp-notebook",
}

DELL_SUB_TO_SERIES = {
    "xps_13": "xps-laptop",
    "xps_14": "xps-laptop",
    "xps_15": "xps-laptop",
    "xps_16": "xps-laptop",
    "xps_17": "xps-laptop",
    "latitude_3000": "latitude-3000-series-laptop",
    "latitude_5000": "latitude-5000-series-laptop",
    "latitude_7000": "latitude-7000-series-laptop",
    "latitude_9000": "latitude-9000-series-laptop",
    "latitude_rugged": "latitude-rugged-series",
    "inspiron_3000": "inspiron-3000-series-laptop",
    "inspiron_5000": "inspiron-5000-series-laptop",
    "inspiron_7000": "inspiron-7000-series-laptop",
    "vostro_3000": "vostro-3000-series-laptop",
    "vostro_5000": "vostro-5000-series-laptop",
    "vostro_7000": "vostro-7000-series-laptop",
    "precision_3000": "precision-3000-series-laptop",
    "g3": "g-series-laptop",
    "g5": "g-series-laptop",
    "g7": "g-series-laptop",
    "g15": "g-series-laptop",
    "g16": "g-series-laptop",
    "dell_pro_13": "dell-pro-13-laptop",
    "dell_pro_14": "dell-pro-14-laptop",
    "dell_pro_16": "dell-pro-16-laptop",
    "dell_pro_18": "dell-pro-18-laptop",
}

ASUS_SERIES_TO_SERIES = {
    "rog": "republic-of-gamers-laptop",
    "tuf": "tuf-laptop",
    "proart": "proart-laptop",
    "vivobook": "vivobook-laptop",
    "zenbook": "zenbook-laptop",
    "expertbook": "expert-laptop",
}


def derive_targets_from_bridges():
    """Build IWM (series, model) targets from brand bridge files."""
    out = []
    seen = set()

    # Lenovo
    try:
        with open(ROOT / "scripts" / "lenovo-models.json") as f:
            for e in json.load(f):
                slug = e.get("model_slug")
                if not slug:
                    continue
                sub = e.get("sub_id", "")
                series_id = e.get("series_id", "")
                series = LENOVO_SUB_TO_SERIES.get(sub) if sub else LENOVO_FLAT_TO_SERIES.get(series_id)
                if not series:
                    continue
                key = (series, slug)
                if key in seen:
                    continue
                seen.add(key)
                out.append({
                    "series": series, "model": slug,
                    "url": f"https://www.itsworthmore.com/sell/{series}/{slug}",
                })
    except FileNotFoundError:
        pass

    # HP
    try:
        with open(ROOT / "scripts" / "hp-models.json") as f:
            for e in json.load(f):
                slug = e.get("model_slug")
                if not slug:
                    continue
                sub = e.get("sub_id", "")
                if sub:
                    series = HP_SUB_TO_SERIES.get(sub)
                else:
                    series = HP_SERIES_TO_SERIES.get(e.get("series_id", ""))
                if not series:
                    continue
                key = (series, slug)
                if key in seen:
                    continue
                seen.add(key)
                out.append({
                    "series": series, "model": slug,
                    "url": f"https://www.itsworthmore.com/sell/{series}/{slug}",
                })
    except FileNotFoundError:
        pass

    # Dell
    try:
        with open(ROOT / "scripts" / "dell-models.json") as f:
            for e in json.load(f):
                sub = e.get("sub_id", "")
                bid = e.get("id", "")
                prefix = f"dell_{sub}_"
                if not bid.startswith(prefix):
                    continue
                slug = bid[len(prefix):]
                series = DELL_SUB_TO_SERIES.get(sub)
                if not series:
                    continue
                key = (series, slug)
                if key in seen:
                    continue
                seen.add(key)
                out.append({
                    "series": series, "model": slug,
                    "url": f"https://www.itsworthmore.com/sell/{series}/{slug}",
                })
    except FileNotFoundError:
        pass

    # ASUS
    try:
        with open(ROOT / "scripts" / "asus-models.json") as f:
            for e in json.load(f):
                slug = e.get("model_slug")
                if not slug:
                    continue
                series_id = e.get("series_id", "")
                series = ASUS_SERIES_TO_SERIES.get(series_id)
                if not series:
                    continue
                key = (series, slug)
                if key in seen:
                    continue
                seen.add(key)
                out.append({
                    "series": series, "model": slug,
                    "url": f"https://www.itsworthmore.com/sell/{series}/{slug}",
                })
    except FileNotFoundError:
        pass

    return out


def load_targets():
    # Catalog targets (non-Apple)
    with open(CATALOG) as f:
        cat = json.load(f)
    laptops = [d for d in cat["devices"] if d.get("category") == "laptops"]
    cat_targets = [d for d in laptops if "macbook" not in d.get("series", "").lower()]

    # Bridge-derived targets
    bridge_targets = derive_targets_from_bridges()

    # Merge: catalog first, then bridge entries not in catalog
    seen = set()
    merged = []
    for t in cat_targets + bridge_targets:
        key = (t["series"], t["model"])
        if key in seen:
            continue
        seen.add(key)
        merged.append(t)
    return merged


def load_progress(path=None):
    p = Path(path) if path else PROGRESS
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return {}
    return {}


def save_progress(state, path=None):
    p = Path(path) if path else PROGRESS
    p.write_text(json.dumps(state, indent=2))


def merge_shards(num_shards=4):
    """Merge shard progress files into the final OUT JSON."""
    merged = {}
    for i in range(num_shards):
        p = Path(f"{SHARD_PREFIX}{i}.json")
        if p.exists():
            merged.update(json.loads(p.read_text()))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(merged, indent=2, sort_keys=True))
    priced = sum(1 for v in merged.values() if v.get("iwm_flawless"))
    print(f"Merged {len(merged)} entries, {priced} with prices → {OUT}")
    return merged


def our_price(iwm_price):
    if not iwm_price:
        return None
    return max(0, int(iwm_price * (1 - DISCOUNT)))


def scrape(limit=None, resume=True, shard=None, num_shards=1):
    targets = load_targets()
    if shard is not None:
        # Round-robin shard split for even distribution across workers
        targets = [t for i, t in enumerate(targets) if i % num_shards == shard]
    if limit:
        targets = targets[:limit]

    progress_path = f"{SHARD_PREFIX}{shard}.json" if shard is not None else None
    state = load_progress(progress_path) if resume else {}
    label = f"shard {shard}/{num_shards}" if shard is not None else "full"
    print(f"[{label}] Targets: {len(targets)}  |  Already scraped: {len(state)}")

    OUT.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=iwm.UA)
        pg = ctx.new_page()

        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            try:
                pg.click('button:has-text("Accept")', timeout=2000)
            except Exception:
                pass
        except Exception:
            pass

        for i, t in enumerate(targets):
            key = f"{t['series']}/{t['model']}"
            if key in state and state[key].get("done"):
                print(f"[{i+1}/{len(targets)}] {key}: SKIP (cached: ${state[key].get('iwm_flawless')})")
                continue

            print(f"[{i+1}/{len(targets)}] {key}: scraping...")
            entry = {
                "series": t["series"],
                "model": t["model"],
                "url": t["url"],
                "iwm_flawless": None,
                "our_price": None,
                "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "done": False,
            }
            for cond in CONDITIONS:
                try:
                    price = iwm.walk_quiz(pg, t["series"], t["model"], condition=cond, carrier="N/A")
                    entry[f"iwm_{cond.lower()}"] = price
                    print(f"  {cond}: ${price}")
                except Exception as e:
                    print(f"  {cond}: ERROR {e}")

            entry["our_price"] = our_price(entry["iwm_flawless"])
            entry["done"] = True
            state[key] = entry
            save_progress(state, progress_path)

        b.close()

    priced = sum(1 for v in state.values() if v.get("iwm_flawless"))
    print(f"\n[{label}] DONE. {priced}/{len(state)} have IWM Flawless prices.")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--shard":
        # --shard <i> <n_total>  e.g. --shard 0 4
        scrape(shard=int(args[1]), num_shards=int(args[2]))
    elif args and args[0] == "--merge":
        n = int(args[1]) if len(args) > 1 else 4
        merge_shards(n)
    elif args and args[0] == "--limit":
        scrape(limit=int(args[1]))
    elif args and args[0] == "--no-resume":
        scrape(resume=False)
    else:
        scrape()
