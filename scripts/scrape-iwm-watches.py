#!/usr/bin/env python3
"""Scrape IWM's pricingData tree for every Garmin sub-series and every
Samsung Galaxy Watch model.

Each Garmin URL (e.g. /sell/garmin-smartwatch/garmin-fenix) opens with a
"Select Model" picker — extract_all_submodels walks every sub-branch so
we get per-model pricing (Fenix 7 / 7S / 8 / etc). Samsung Watch URLs
are already per-model so the single-branch path returns one entry.

Output: iwm-watch-adjustments.json keyed by "{series}/{model}".

Run:
  python3 scripts/scrape-iwm-watches.py            # all
  python3 scripts/scrape-iwm-watches.py --limit 2  # smoke test
"""
from __future__ import annotations
import json, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.parent
OUT = ROOT / "iwm-watch-adjustments.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

COND_MAP = {
    "new": "sealed", "[new]": "sealed",
    "excellent": "mint", "[excellent]": "mint", "flawless": "mint",
    "very-good": "verygood", "[very-good]": "verygood", "very good": "verygood",
    "good": "good", "[good]": "good",
    "fair": "fair", "[fair]": "fair",
    "broken": "broken", "[broken]": "broken",
}

GARMIN_SERIES = [
    "garmin-approach", "garmin-descent", "garmin-enduro", "garmin-epix",
    "garmin-fenix", "garmin-forerunner", "garmin-instinct", "garmin-lily",
    "garmin-marq", "garmin-quatix", "garmin-tactix", "garmin-venu",
    "garmin-vivoactive",
]
SAMSUNG_WATCH = [
    "samsung-galaxy-watch-7", "samsung-galaxy-watch-8",
    "samsung-galaxy-watch-8-classic", "samsung-galaxy-watch-ultra",
    "samsung-galaxy-watch-ultra-2025",
]

TARGETS = (
    [{"series": "garmin-smartwatch", "model": m} for m in GARMIN_SERIES] +
    [{"series": "samsung-watch", "model": m} for m in SAMSUNG_WATCH]
)


def _as_int(v):
    if isinstance(v, (int, float)):
        return int(v)
    try:
        return int(str(v).replace(",", "").strip())
    except Exception:
        return 0


def _slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def _classify_q(qtext, ans_attrs):
    t = (qtext or "").lower()
    keys = set(ans_attrs)
    # Edition / device-model picker INSIDE a series branch — the answer
    # val is the per-edition Flawless price.
    if "select the device model" in t or "edition" in t or "select model" in t:
        return "edition"
    # Watch-specific:
    if "case size" in t or "case-size" in keys or re.search(r"\bsize\b", t):
        return "size"
    if "case" in t and ("material" in t or "color" in t or "case" in keys):
        return "case"
    if "band" in t or "strap" in t or "band" in keys:
        return "band"
    if "battery" in t:
        return "battery"
    if "charger" in t or "charging" in t or "accessories" in keys:
        return "charger"
    if "condition" in t or "condition" in keys:
        return "condition"
    if "fully operational" in t or "operational" in t:
        return "operational"
    if "connectivity" in t or "lte" in t or "cellular" in t or "wifi" in t:
        return "connectivity"
    if "storage" in t:
        return "storage"
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


def _direct_questions(tree, branch_idx):
    """Read ONLY the questions directly attached to a branch (no recursion).
    Used to capture per-branch editions without cross-polluting from sibling
    series whose go_to chains point back into the same shared follow-up tree."""
    out = {}
    if branch_idx < 0 or branch_idx >= len(tree):
        return out
    for q in tree[branch_idx].get("questions", []):
        qtext = q.get("text", "")
        for a in q.get("answers", []):
            attrs = {
                x.get("key"): (x.get("value") if not isinstance(x.get("value"), list) else "-".join(x.get("value")))
                for x in (a.get("attributes") or [])
            }
            qtype = _classify_q(qtext, attrs)
            out.setdefault(qtype, []).append({
                "label": (a.get("text") or "").strip(),
                "val": _as_int(a.get("value", 0)),
                "attrs": attrs,
            })
    return out


def _spec_from_branch(tree, branch_idx, model_label):
    # Editions must come from the DIRECT branch only — walk_branch's recursion
    # otherwise pulls in sibling series' editions via shared follow-up branches.
    direct = _direct_questions(tree, branch_idx)
    data = walk_branch(tree, branch_idx)
    if not data:
        return None
    # Override the recursively-collected editions with the direct-only set.
    if direct.get("edition"):
        data["edition"] = direct["edition"]
    # For watches IWM nests an "edition" picker INSIDE each series branch
    # whose answer val IS the per-edition Flawless price. When present:
    #   base_price = min(edition vals)
    #   edition_adj = {label: val - base_price}
    # Otherwise: fall back to condition[0].val (older-style trees) or
    # the first non-zero answer of any dimension.
    editions = data.get("edition", [])
    if editions:
        # Edition picker present (Garmin Fenix-style): each edition's val
        # IS its Flawless price. Base = cheapest edition; adj = deltas.
        edition_vals = [e["val"] for e in editions if e["val"] > 0]
        base = min(edition_vals) if edition_vals else 0
        edition_adj = {e["label"]: e["val"] - base for e in editions}
    else:
        # No edition picker (Samsung Watch-style): base Flawless price =
        # sum of first-option vals across non-condition dimensions, since
        # IWM anchors Condition.Flawless = 0 and puts the actual price
        # under Connectivity / Size / Case.
        edition_adj = {}
        base = 0
        for k in ("connectivity", "size", "case", "band", "storage"):
            rows = data.get(k, [])
            if rows:
                base += rows[0]["val"]
        if not base:
            # Older trees: fall back to condition[Flawless] = 0 → use
            # whichever condition has the largest val as a hint.
            cond = data.get("condition", [])
            if cond:
                base = max((c["val"] for c in cond), default=0)

    def deltas(rows):
        if not rows:
            return {}
        anchor = rows[0]["val"]
        return {r["label"]: r["val"] - anchor for r in rows}

    result = {
        "model_label": model_label,
        "base_price": base,
        "edition_adj": edition_adj,
        "size_adj": deltas(data.get("size", [])),
        "case_adj": deltas(data.get("case", [])),
        "band_adj": deltas(data.get("band", [])),
        "condition_adj": {
            COND_MAP.get(_cond_key(r), r["label"].lower()): r["val"]
            for r in data.get("condition", [])
        },
        "battery_adj": {r["label"].lower(): r["val"] for r in data.get("battery", [])},
        "charger_adj": {r["label"].lower(): r["val"] for r in data.get("charger", [])},
        "operational_adj": {r["label"].lower(): r["val"] for r in data.get("operational", [])},
        "connectivity_adj": deltas(data.get("connectivity", [])),
        "storage_adj": deltas(data.get("storage", [])),
    }
    return result


def _cond_key(row):
    c = (row.get("attrs") or {}).get("condition")
    if c:
        return c if not isinstance(c, list) else c[0]
    return row.get("label", "").lower()


def extract_all_submodels(tree):
    if not tree:
        return {}
    first = tree[0]
    first_qs = first.get("questions", [{}])
    first_q = first_qs[0] if first_qs else {}
    first_qtext = (first_q.get("text") or "").lower()
    is_picker = (
        "select model" in first_qtext
        or "which model" in first_qtext
        or "select series" in first_qtext
        or first_qtext.startswith("model")
        or first_qtext.startswith("series")
    )
    out = {}
    if is_picker:
        for ans in first_q.get("answers", []):
            label = (ans.get("text") or "").strip()
            gt = ans.get("go_to", "")
            if not gt or "," not in gt:
                continue
            branch_idx = int(gt.split(",")[0]) - 1
            spec = _spec_from_branch(tree, branch_idx, label)
            if spec:
                out[_slugify(label)] = spec
    else:
        spec = _spec_from_branch(tree, 0, "")
        if spec:
            out[""] = spec
    return out


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


def scrape(targets):
    state = {}
    if OUT.exists():
        state = json.loads(OUT.read_text())
    print(f"Targets: {len(targets)}  Already: {len(state)}")
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA)
        pg = ctx.new_page()
        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=20000)
        except Exception:
            pass
        for i, t in enumerate(targets):
            key = f"{t['series']}/{t['model']}"
            url = f"https://www.itsworthmore.com/sell/{t['series']}/{t['model']}"
            print(f"[{i+1}/{len(targets)}] {key}", flush=True)
            d = grab_pricing_data(pg, url)
            entry = {
                "series": t["series"], "model": t["model"], "url": url,
                "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            if not d:
                entry["error"] = "no_pricing"
                state[key] = entry
                OUT.write_text(json.dumps(state, indent=2, sort_keys=True))
                continue
            submodels = extract_all_submodels(d.get("pricing"))
            entry["iwm_name"] = d.get("name", "")
            entry["submodels"] = submodels
            if submodels:
                first = next(iter(submodels))
                entry.update({k: v for k, v in submodels[first].items() if k != "model_label"})
                top = max((s.get("base_price", 0) for s in submodels.values()), default=0)
                print(f"  submodels={len(submodels)}  top base=${top}")
            else:
                entry["error"] = "no_specs"
            state[key] = entry
            OUT.write_text(json.dumps(state, indent=2, sort_keys=True))
        b.close()
    print(f"Done → {OUT}")


if __name__ == "__main__":
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    targets = TARGETS[:limit] if limit else TARGETS
    scrape(targets)
