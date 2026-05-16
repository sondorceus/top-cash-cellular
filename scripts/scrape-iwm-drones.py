#!/usr/bin/env python3
"""Scrape IWM's pricingData tree for every DJI drone listed in iwm-catalog.json.

Drones have a simpler tree than watches — usually just condition +
accessories (controller, battery, charger, original box). Output:
iwm-drone-adjustments.json keyed by "{series}/{model}".

Run:
  python3 scripts/scrape-iwm-drones.py
  python3 scripts/scrape-iwm-drones.py --limit 3   # smoke test
"""
from __future__ import annotations
import json, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.parent
CATALOG = ROOT / "iwm-catalog.json"
OUT = ROOT / "iwm-drone-adjustments.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

COND_MAP = {
    "new": "sealed", "[new]": "sealed",
    "excellent": "mint", "[excellent]": "mint", "flawless": "mint",
    "very-good": "verygood", "[very-good]": "verygood", "very good": "verygood",
    "good": "good", "[good]": "good",
    "fair": "fair", "[fair]": "fair",
    "broken": "broken", "[broken]": "broken",
}


def _as_int(v):
    if isinstance(v, (int, float)):
        return int(v)
    try:
        return int(str(v).replace(",", "").strip())
    except Exception:
        return 0


def _classify_q(qtext, ans_attrs):
    t = (qtext or "").lower()
    if "select the device model" in t or "select model" in t:
        return "model"
    if "condition" in t:
        return "condition"
    if "controller" in t:
        return "controller"
    if "battery" in t or "batteries" in t:
        return "battery"
    if "charger" in t or "charging" in t:
        return "charger"
    if "original box" in t or "packaging" in t or "box" in t:
        return "box"
    if "accessor" in t:
        return "accessories"
    return "other"


def walk_branch(tree, branch_idx, seen=None):
    if seen is None:
        seen = set()
    if branch_idx in seen or branch_idx < 0 or branch_idx >= len(tree):
        return {}
    seen.add(branch_idx)
    out = {}
    for q in tree[branch_idx].get("questions", []):
        qtext = q.get("text", "")
        for a in q.get("answers", []):
            attrs = {
                x.get("key"): (x.get("value") if not isinstance(x.get("value"), list) else "-".join(x.get("value")))
                for x in (a.get("attributes") or [])
            }
            qtype = _classify_q(qtext, attrs)
            label = (a.get("text") or "").strip()
            val = _as_int(a.get("value", 0))
            out.setdefault(qtype, []).append({"label": label, "val": val, "attrs": attrs})
            gt = a.get("go_to", "")
            if gt and "," in gt:
                try:
                    sub_idx = int(gt.split(",")[0]) - 1
                    sub_out = walk_branch(tree, sub_idx, seen)
                    for k, v in sub_out.items():
                        existing = {e["label"] for e in out.get(k, [])}
                        for entry in v:
                            if entry["label"] not in existing:
                                out.setdefault(k, []).append(entry)
                except Exception:
                    pass
    return out


def _cond_key(row):
    c = (row.get("attrs") or {}).get("condition")
    if c:
        return c if not isinstance(c, list) else c[0]
    return row.get("label", "").lower()


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
                return { name: scope.productName || '', pricing: scope.pricingData || null };
            } catch(e) { return {error: e.message}; }
        }""")
        if d and d.get("pricing"):
            return d
    return None


def extract_drone_spec(tree, name):
    if not tree:
        return None
    # Drones are single-product pages — questions start at branch 0.
    data = walk_branch(tree, 0)
    if not data:
        return None
    # Drone base price = max condition val (Flawless is typically the top)
    conds = data.get("condition", [])
    cond_map = {}
    flawless_price = 0
    for r in conds:
        key = COND_MAP.get(_cond_key(r), r["label"].lower())
        cond_map[key] = r["val"]
        if "flaw" in r["label"].lower() or "mint" in key:
            flawless_price = max(flawless_price, r["val"])
    if not flawless_price and conds:
        flawless_price = max(r["val"] for r in conds)

    def first_anchor_deltas(rows):
        if not rows:
            return {}
        return {r["label"]: r["val"] for r in rows}

    return {
        "model_label": name,
        "iwm_flawless": flawless_price,
        "condition_adj": cond_map,
        "controller_adj": first_anchor_deltas(data.get("controller", [])),
        "battery_adj":   first_anchor_deltas(data.get("battery", [])),
        "charger_adj":   first_anchor_deltas(data.get("charger", [])),
        "box_adj":       first_anchor_deltas(data.get("box", [])),
        "accessories_adj": first_anchor_deltas(data.get("accessories", [])),
    }


def scrape(targets):
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=UA, viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        for i, t in enumerate(targets, 1):
            url = t["url"]
            key = f'{t["series"]}/{t["model"]}'
            print(f"[{i}/{len(targets)}] {key}", flush=True)
            d = grab_pricing_data(page, url)
            if not d:
                print(f"   no pricing data", flush=True)
                out[key] = {"error": "no_pricing_data", "url": url}
                continue
            spec = extract_drone_spec(d.get("pricing") or [], d.get("name") or t["model"])
            if not spec:
                out[key] = {"error": "no_spec", "url": url}
                continue
            spec["url"] = url
            spec["series"] = t["series"]
            spec["model"] = t["model"]
            spec["scraped_at"] = datetime.now(timezone.utc).isoformat()
            out[key] = spec
            print(f"   ${spec['iwm_flawless']}  ({spec['model_label']})", flush=True)
        browser.close()
    return out


def main():
    args = sys.argv[1:]
    limit = None
    if "--limit" in args:
        idx = args.index("--limit")
        limit = int(args[idx + 1])
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    devices = catalog.get("devices") if isinstance(catalog, dict) else catalog
    drones = [
        {"series": d["series"], "model": d["model"], "url": d["url"]}
        for d in devices
        if d.get("category") == "drones" and "dji-drone" in (d.get("series") or "")
    ]
    if limit:
        drones = drones[:limit]
    print(f"Scraping {len(drones)} DJI drone URLs", flush=True)
    results = scrape(drones)
    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    priced = sum(1 for v in results.values() if v.get("iwm_flawless", 0) > 0)
    print(f"\nDone. {priced}/{len(results)} priced. -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
