#!/usr/bin/env python3
"""Scrape IWM pricingData for Samsung / Lenovo / OnePlus / Google
tablets. Same shape as scripts/scrape-iwm-watches.py — each URL is
already per-model so we walk the single branch (no Series picker).
Storage / connectivity / band are the main price drivers.

Output: iwm-tablet-adjustments.json keyed by "{series}/{model}".
"""
from __future__ import annotations
import json, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.parent
OUT = ROOT / "iwm-tablet-adjustments.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

COND_MAP = {
    "new": "sealed", "[new]": "sealed",
    "excellent": "mint", "[excellent]": "mint", "flawless": "mint",
    "very-good": "verygood", "[very-good]": "verygood", "very good": "verygood",
    "good": "good", "[good]": "good", "fair": "fair", "[fair]": "fair",
    "broken": "broken", "[broken]": "broken",
}

TARGETS = [
    # === Microsoft Surface ===
    ("microsoft-surface-pro", "microsoft-surface-pro-12in"),
    ("microsoft-surface-pro", "microsoft-surface-pro-11"),
    ("microsoft-surface-pro", "microsoft-surface-pro-10"),
    ("microsoft-surface-pro", "microsoft-surface-pro-9"),
    ("microsoft-surface-pro", "microsoft-surface-pro-8"),
    ("microsoft-surface-pro", "microsoft-surface-pro-7-plus"),
    ("microsoft-surface-pro", "microsoft-surface-pro-7"),
    ("microsoft-surface-pro", "microsoft-surface-pro-6"),
    ("microsoft-surface-pro", "microsoft-surface-pro-5"),
    ("microsoft-surface-pro", "microsoft-surface-pro-4"),
    ("microsoft-surface-go",  "microsoft-surface-go-4"),
    ("microsoft-surface-go",  "microsoft-surface-go-3"),
    ("microsoft-surface-go",  "microsoft-surface-go-2"),
    ("microsoft-surface-go",  "microsoft-surface-go-1"),
    ("microsoft-surface-pro-x", "microsoft-surface-pro-x"),
    # === Samsung / Lenovo / OnePlus / Google (existing) ===
    ("samsung-tablet", "galaxy-tab-s11-ultra"),
    ("samsung-tablet", "galaxy-tab-s11"),
    ("samsung-tablet", "galaxy-tab-s10-ultra"),
    ("samsung-tablet", "galaxy-tab-s10-plus"),
    ("samsung-tablet", "galaxy-tab-s10-fe-plus"),
    ("samsung-tablet", "galaxy-tab-s10-fe"),
    ("samsung-tablet", "galaxy-tab-s10-lite"),
    ("samsung-tablet", "galaxy-tab-s7-plus"),
    ("samsung-tablet", "galaxy-tab-s7-fe"),
    ("samsung-tablet", "galaxy-tab-s7"),
    ("samsung-tablet", "galaxy-tab-s6-lite"),
    ("samsung-tablet", "galaxy-tab-s6"),
    ("samsung-tablet", "galaxy-tab-s5e"),
    ("samsung-tablet", "galaxy-tab-s4-105"),
    ("lenovo-tablet", "lenovo-legion-tab-gen-3"),
    ("lenovo-tablet", "lenovo-thinkpad-x12-detachable"),
    ("lenovo-tablet", "lenovo-yoga-tab-plus"),
    ("oneplus-tablet", "oneplus-pad-3"),
    ("oneplus-tablet", "oneplus-pad-2"),
    ("oneplus-tablet", "oneplus-pad-go-2"),
    ("oneplus-tablet", "oneplus-pad"),
    ("google-tablet", "google-pixel-tablet"),
    ("google-tablet", "google-pixel-slate"),
]


def _as_int(v):
    if isinstance(v, (int, float)): return int(v)
    try: return int(str(v).replace(",", "").strip())
    except Exception: return 0


def _classify_q(qtext, ans_attrs):
    t = (qtext or "").lower()
    keys = set(ans_attrs)
    if "storage" in t or "capacity" in t or "storage_size" in keys: return "storage"
    if "connectivity" in t or "wifi" in t or "wi-fi" in t or "cellular" in t or "lte" in t or "carrier" in t: return "connectivity"
    if "size" in t or "screen" in t: return "size"
    if "condition" in t or "condition" in keys: return "condition"
    if "charger" in t or "accessories" in keys: return "charger"
    if "stylus" in t or "pen" in t or "s pen" in t: return "stylus"
    if "fully operational" in t or "operational" in t: return "operational"
    if "battery" in t: return "battery"
    return "other"


def walk_branch(tree, branch_idx, seen=None):
    if seen is None: seen = set()
    if branch_idx in seen or branch_idx < 0 or branch_idx >= len(tree): return {}
    seen.add(branch_idx)
    out = {}
    for q in tree[branch_idx].get("questions", []):
        qtext = q.get("text", "")
        for a in q.get("answers", []):
            attrs = {x.get("key"): (x.get("value") if not isinstance(x.get("value"), list) else "-".join(x.get("value"))) for x in (a.get("attributes") or [])}
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
    if c: return c if not isinstance(c, list) else c[0]
    return row.get("label", "").lower()


def _spec_from_branch(tree, branch_idx, model_label):
    data = walk_branch(tree, branch_idx)
    if not data: return None
    # Tablets: IWM's first question is usually "Select Condition" with
    # Flawless = the base Flawless price (not 0 anchor). The other
    # dimensions (storage/connectivity/pen) are additive deltas to that.
    # Newer Surface trees flip the order — condition is later and
    # storage/connectivity carry the base. Handle both:
    base = 0
    cond = data.get("condition", [])
    if cond:
        # Find the Flawless entry by attrs.condition key or label
        flawless = None
        for c in cond:
            ck = (c.get("attrs") or {}).get("condition", "")
            ck = ck if not isinstance(ck, list) else (ck[0] if ck else "")
            if ck == "excellent" or (c.get("label") or "").lower() == "flawless":
                flawless = c; break
        if flawless and flawless["val"] > 0:
            base = flawless["val"]
    if not base:
        # Fall back to summing first-option vals across price-driver dims.
        for k in ("storage", "connectivity", "size"):
            rows = data.get(k, [])
            if rows: base += rows[0]["val"]
    if not base and cond:
        # Last resort: max condition val (Brand New).
        base = max((c["val"] for c in cond), default=0)

    def deltas(rows):
        if not rows: return {}
        anchor = rows[0]["val"]
        return {r["label"]: r["val"] - anchor for r in rows}

    return {
        "model_label": model_label,
        "base_price": base,
        "storage_adj": deltas(data.get("storage", [])),
        "connectivity_adj": deltas(data.get("connectivity", [])),
        "size_adj": deltas(data.get("size", [])),
        "condition_adj": {COND_MAP.get(_cond_key(r), r["label"].lower()): r["val"] for r in data.get("condition", [])},
        "battery_adj": {r["label"].lower(): r["val"] for r in data.get("battery", [])},
        "charger_adj": {r["label"].lower(): r["val"] for r in data.get("charger", [])},
        "stylus_adj": {r["label"].lower(): r["val"] for r in data.get("stylus", [])},
        "operational_adj": {r["label"].lower(): r["val"] for r in data.get("operational", [])},
    }


def grab(pg, url, retries=2):
    for _ in range(retries):
        try:
            pg.goto(url, wait_until="networkidle", timeout=30000)
        except Exception:
            time.sleep(1); continue
        pg.wait_for_timeout(900)
        d = pg.evaluate("""() => {
            try {
                const el=document.querySelector("[ng-controller='product-pricing-ctrl']")||document.querySelector("section[ng-controller]");
                if(!el) return null;
                const scope=angular.element(el).scope();
                return {name:scope.productName||'', pricing:scope.pricingData||null};
            } catch(e){ return {error:e.message}; }
        }""")
        if d and d.get("pricing"): return d
    return None


def scrape(targets):
    state = json.loads(OUT.read_text()) if OUT.exists() else {}
    print(f"Targets: {len(targets)}  Already: {len(state)}")
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        pg = b.new_context(user_agent=UA).new_page()
        try: pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=20000)
        except: pass
        for i, (series, model) in enumerate(targets):
            key = f"{series}/{model}"
            url = f"https://www.itsworthmore.com/sell/{series}/{model}"
            print(f"[{i+1}/{len(targets)}] {key}", flush=True)
            d = grab(pg, url)
            entry = {"series": series, "model": model, "url": url,
                     "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
            if not d:
                entry["error"] = "no_pricing"
                state[key] = entry
                OUT.write_text(json.dumps(state, indent=2, sort_keys=True))
                continue
            entry["iwm_name"] = d.get("name", "")
            spec = _spec_from_branch(d.get("pricing"), 0, "")
            if spec:
                entry.update({k: v for k, v in spec.items() if k != "model_label"})
                print(f"  base=${spec.get('base_price',0)}")
            else:
                entry["error"] = "no_specs"
            state[key] = entry
            OUT.write_text(json.dumps(state, indent=2, sort_keys=True))
        b.close()
    print(f"Done → {OUT}")


if __name__ == "__main__":
    scrape(TARGETS)
