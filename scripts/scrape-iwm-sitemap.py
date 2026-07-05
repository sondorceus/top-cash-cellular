#!/usr/bin/env python3
"""Sitemap-driven IWM PC-laptop scraper — HTTP only, no browser.

Replaces the playwright pair (scrape-iwm-pc-laptop-prices.py +
scrape-iwm-laptop-specs.py) for the weekly refresh. Those walked a target
list derived from iwm-catalog.json + brand bridge files; IWM restructured
their laptop URLs (June 2026) so most of those targets now 404 and the
weekly refresh silently produced garbage (PR #5 would have dropped 184
variants' specs).

This script instead:
  1. Reads https://www.itsworthmore.com/sitemap.xml (the full live catalog)
  2. Filters to PC-laptop series via a curated series matcher
  3. For each product URL, pulls the embedded base64 pricing blob straight
     from the HTML (same tree as angular's pricingData — no quiz walk, no
     playwright; ~1s per page instead of ~25s)
  4. Extracts per-submodel additive specs (chip/RAM/storage/GPU/display/
     condition/battery/charger) in the exact shape scrape-iwm-laptop-specs
     produced
  5. MERGES into pc-laptop-iwm-adjustments.json — fresh scrapes win, prior
     entries whose URLs died are kept (flagged "stale") so existing page
     variants never lose pricing because IWM reshuffled a URL
  6. Regenerates public/comps/iwm-pc-laptop-prices.json with BOTH page-level
     keys ("{series}/{model}") and per-submodel keys ("{series}/{sub-slug}")
     so apply-iwm-pc-laptop-prices.py can resolve bridge slugs (e.g. dell
     "3520") against the new URL scheme.

Usage:
  python3 scripts/scrape-iwm-sitemap.py               # full run
  python3 scripts/scrape-iwm-sitemap.py --limit 10    # smoke test
  python3 scripts/scrape-iwm-sitemap.py --merge-only  # re-merge progress
"""
from __future__ import annotations
import json, re, sys, threading, time, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

HERE = Path(__file__).parent
ROOT = HERE.parent
ADJ = ROOT / "pc-laptop-iwm-adjustments.json"
PRICES = ROOT / "public" / "comps" / "iwm-pc-laptop-prices.json"
PROGRESS = ROOT / ".iwm-sitemap-progress.json"  # gitignored, resumable

SITEMAP = "https://www.itsworthmore.com/sitemap.xml"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
DISCOUNT = 0.10  # our price = IWM × 0.90 (Skywalker policy)
WORKERS = 4

# PC-laptop series on IWM as of the June-2026 URL restructure. Brand
# families the site actually buys (lenovo / hp / dell+alienware / asus /
# acer / lg / samsung / razer / msi). Chromebooks, Surface, Google,
# Panasonic, Sony VAIO are intentionally out — TCC doesn't list them.
SERIES_RE = re.compile(r"""^(
    lenovo-(thinkpad|thinkbook)-[\w-]+ | lenovo-legion(-laptop)? |
    lenovo-(yoga|ideapad|slim|pro)-laptop | lenovo-loq-series-laptop |
    hp-(elitebook|zbook|omnibook|probook|pavilion|spectre|envy|notebook)(-ultra)? |
    hp-omen-(laptop|max-laptop|slim-laptop|transcend-laptop) | hp-victus-laptop |
    xps-laptop | latitude-\d+-series-laptop | latitude-rugged-series |
    inspiron-\d+-series-laptop | vostro-\d+-series-laptop |
    precision-\d+-series-(laptop|1[4-7]) |
    dell-(g-series|vostro|laptop|1[3-8]-laptop|pro(-1[3-8]-laptop|-rugged)?|rugged) |
    alienware-(m-series-laptop|x-series-laptop|area-series-laptop|aurora-laptop|1[357]) |
    (zenbook|proart|expert|tuf|the-ultimate-force|republic-of-gamers)-laptop |
    vivobook(-1[4-6])?-laptop | msi-laptop |
    acer-(nitro|predator|aspire-laptop|swift) |
    lg-laptop | samsung-laptop | razer-(blade-laptop|book) |
    alienware-(aurora-series|area-series)-desktop |
    dell-optiplex-desktop | xps-desktop | precision-\d+-series-desktop |
    hp-desktop | hp-omen-desktop | hp-omnistudio-desktop |
    lenovo-(thinkcentre|yoga-desktop) | msi-desktop
)$""", re.X)

COND_MAP = {
    "new": "sealed", "[new]": "sealed",
    "excellent": "mint", "[excellent]": "mint", "flawless": "mint",
    "very-good": "verygood", "[very-good]": "verygood", "very good": "verygood",
    "good": "good", "[good]": "good",
    "fair": "fair", "[fair]": "fair",
    "broken": "broken", "[broken]": "broken",
}


# ------------------------------------------------------------------
# Fetch + blob extraction
# ------------------------------------------------------------------

def fetch(url: str, timeout=30) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def extract_quiz_blob(html: str):
    """Largest base64 string on the page that decodes to the questions-tree
    JSON (same shape as angular scope.pricingData)."""
    import base64
    best = None
    for s in re.findall(r'"([A-Za-z0-9+/=]{500,})"', html):
        try:
            decoded = base64.b64decode(s).decode("utf-8", errors="replace")
            data = json.loads(decoded)
            if isinstance(data, list) and any(isinstance(e, dict) and "questions" in e for e in data):
                if best is None or len(decoded) > len(best[1]):
                    best = (data, decoded)
        except Exception:
            continue
    return best[0] if best else None


def page_title(html: str) -> str:
    m = re.search(r"<title>([^<]*)</title>", html)
    return (m.group(1).split("|")[0].strip() if m else "")


# ------------------------------------------------------------------
# Tree → spec extraction (ported from scrape-iwm-laptop-specs.py with
# two fixes: value_current-aware values, and picker detection that also
# matches "Select the device model")
# ------------------------------------------------------------------

def _cur(a) -> int:
    v = a.get("value_current")
    if not isinstance(v, (int, float)):
        v = a.get("value")
    if isinstance(v, (int, float)):
        return int(v)
    try:
        return int(str(v).replace(",", "").strip())
    except Exception:
        return 0


def _attr_val(v):
    if isinstance(v, list):
        return "-".join(str(x) for x in v)
    return str(v) if v is not None else ""


def _classify_q(qtext, attr_keys):
    t = (qtext or "").lower()
    if "processor" in t or "processor_type" in attr_keys:
        return "chip"
    if "memory" in t or "memory" in attr_keys:
        return "ram"
    if ("storage" in t and "secondary" not in t) or "storage_size" in attr_keys:
        return "storage"
    if "condition" in t or "condition" in attr_keys:
        return "condition"
    if "battery" in t:
        return "battery"
    if "charger" in t or "accessories" in attr_keys:
        return "charger"
    if "display" in t or "resolution" in t or "display" in attr_keys:
        return "display"
    if "graphics" in t or "gpu" in t:
        return "gpu"
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
            attrs = {x.get("key"): _attr_val(x.get("value")) for x in (a.get("attributes") or [])}
            qtype = _classify_q(qtext, set(attrs))
            label = a.get("text", "").strip()
            out.setdefault(qtype, []).append({"label": label, "val": _cur(a), "attrs": attrs})
            gt = a.get("go_to", "")
            if gt and "," in str(gt):
                try:
                    sub_idx = int(str(gt).split(",")[0]) - 1
                    for k, v in walk_branch(tree, sub_idx, seen).items():
                        existing = {e["label"] for e in out.get(k, [])}
                        for entry in v:
                            if entry["label"] not in existing:
                                out.setdefault(k, []).append(entry)
                except Exception:
                    pass
    return out


def _slugify(label):
    return re.sub(r"[^a-z0-9]+", "-", (label or "").lower()).strip("-")


def _cond_key(row):
    cond = (row.get("attrs") or {}).get("condition")
    if cond:
        return cond.strip("[]") if isinstance(cond, str) else cond
    return row.get("label", "").lower()


def _spec_from_branch(tree, branch_idx, model_label, model_val=0):
    data = walk_branch(tree, branch_idx)
    if not data:
        return None
    chips = data.get("chip", [])
    # The Flawless base lives in two places depending on page shape:
    # single-model pages (and Dell XPS-style pickers) put the absolute in
    # chip[0].val with the picker answer at 0; HP ProBook-style pickers
    # put the per-model absolute on the PICKER answer (430 → $80) and the
    # branch carries chip deltas (0, +30). Summing both handles every
    # shape — one of the terms is always the absolute and the other 0.
    chip_anchor = chips[0]["val"] if chips else 0
    base_price = model_val + chip_anchor

    def deltas(rows):
        if not rows:
            return {}
        anchor = rows[0]["val"]
        return {r["label"]: r["val"] - anchor for r in rows}

    result = {
        "model_label": model_label,
        "base_price": base_price,
        "chips": [{"label": r["label"], "adj": r["val"] - chip_anchor, "attrs": r["attrs"]} for r in chips],
        "ram_adj": deltas(data.get("ram", [])),
        "storage_adj": deltas(data.get("storage", [])),
        "condition_adj": {COND_MAP.get(_cond_key(r), r["label"].lower()): r["val"] for r in data.get("condition", [])},
        "battery_adj": {r["label"].lower(): r["val"] for r in data.get("battery", [])},
        "charger_adj": {r["label"].lower(): r["val"] for r in data.get("charger", [])},
    }
    if data.get("display"):
        result["display_adj"] = deltas(data.get("display", []))
    if data.get("gpu"):
        result["gpu_adj"] = deltas(data.get("gpu", []))
    return result


def is_model_picker(entry) -> bool:
    """True when quiz[0] is a model-selection branch. IWM wording varies:
    'Select Model', 'Select the device model', 'Which model...'. Also
    require most answers to branch via go_to — a real picker always does."""
    qs = entry.get("questions") or [{}]
    q = qs[0] if qs else {}
    text = (q.get("text") or "").lower()
    answers = q.get("answers") or []
    if not answers:
        return False
    texty = ("model" in text and ("select" in text or "which" in text))
    branchy = sum(1 for a in answers if "," in str(a.get("go_to", ""))) >= max(1, len(answers) // 2)
    return texty and branchy


def extract_all_submodels(tree):
    if not tree:
        return {}
    out = {}
    if is_model_picker(tree[0]):
        for ans in tree[0]["questions"][0].get("answers", []):
            label = ans.get("text", "").strip()
            gt = str(ans.get("go_to", ""))
            if "," not in gt:
                continue
            try:
                branch_idx = int(gt.split(",")[0]) - 1
            except ValueError:
                continue
            if branch_idx < 0 or branch_idx >= len(tree):
                continue
            spec = _spec_from_branch(tree, branch_idx, label, model_val=_cur(ans))
            if spec:
                out[_slugify(label)] = spec
    else:
        spec = _spec_from_branch(tree, 0, "")
        if spec:
            out[""] = spec
    return out


# ------------------------------------------------------------------
# Targets
# ------------------------------------------------------------------

def load_targets():
    xml = fetch(SITEMAP, timeout=60)
    root = ElementTree.fromstring(xml)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [loc.text.strip() for loc in root.findall(".//sm:loc", ns) if loc.text]
    targets = []
    for u in urls:
        m = re.match(r"https://www\.itsworthmore\.com/sell/([^/]+)/([^/]+)$", u)
        if not m:
            continue
        series, model = m.group(1), m.group(2)
        if SERIES_RE.match(series):
            targets.append({"series": series, "model": model, "url": u})
    return targets


# ------------------------------------------------------------------
# Scrape
# ------------------------------------------------------------------

def scrape_one(t):
    key = f"{t['series']}/{t['model']}"
    entry = {
        "series": t["series"], "model": t["model"], "url": t["url"],
        "done": True,
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    try:
        html = fetch(t["url"])
    except Exception as e:
        entry["error"] = "no_pricing"
        entry["error_detail"] = repr(e)[:120]
        return key, entry
    tree = extract_quiz_blob(html)
    if not tree:
        entry["error"] = "no_pricing"
        return key, entry
    entry["iwm_name"] = page_title(html)
    submodels = extract_all_submodels(tree)
    entry["submodels"] = submodels
    if submodels:
        first_key = next(iter(submodels))
        entry.update({k: v for k, v in submodels[first_key].items() if k != "model_label"})
    else:
        entry["error"] = "no_specs"
    return key, entry


def run_scrape(limit=None):
    all_targets = load_targets()
    live_keys = {f"{t['series']}/{t['model']}" for t in all_targets}
    targets = all_targets[:limit] if limit else all_targets
    state = json.loads(PROGRESS.read_text()) if PROGRESS.exists() else {}
    todo = [t for t in targets if not state.get(f"{t['series']}/{t['model']}", {}).get("done")]
    print(f"Sitemap laptop targets: {len(all_targets)}  |  cached: {len(state)}  |  to scrape: {len(todo)}")

    lock = threading.Lock()
    done_ct = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(scrape_one, t): t for t in todo}
        for fut in as_completed(futures):
            key, entry = fut.result()
            with lock:
                state[key] = entry
                done_ct += 1
                if done_ct % 10 == 0 or done_ct == len(todo):
                    PROGRESS.write_text(json.dumps(state, indent=2))
                status = entry.get("error") or f"subs={len(entry.get('submodels') or {})} base=${entry.get('base_price', 0)}"
                print(f"[{done_ct}/{len(todo)}] {key}: {status}", flush=True)
    PROGRESS.write_text(json.dumps(state, indent=2))
    return state, live_keys


def merge(state, live_keys):
    """Merge fresh scrape into the adjustments + prices files."""
    adj = json.loads(ADJ.read_text(encoding="utf-8")) if ADJ.exists() else {}
    fresh_ok = {k: v for k, v in state.items() if not v.get("error")}
    fresh_err = {k: v for k, v in state.items() if v.get("error")}

    added = updated = 0
    for k, v in fresh_ok.items():
        if k in adj:
            updated += 1
        else:
            added += 1
        adj[k] = v
    # Record errors only for keys we don't already have good data for —
    # never let a transient fetch failure clobber a good prior scrape.
    err_kept = 0
    for k, v in fresh_err.items():
        if k not in adj or adj[k].get("error"):
            adj[k] = v
            err_kept += 1
    # Flag entries whose URL is gone from the live sitemap. Data stays —
    # page variants keep their last-known price — but the flag makes
    # staleness auditable.
    stale = 0
    for k, v in adj.items():
        if k not in live_keys and not v.get("error"):
            if not v.get("stale"):
                v["stale"] = True
            stale += 1
        elif k in live_keys and v.get("stale"):
            del v["stale"]
    ADJ.write_text(json.dumps(adj, indent=2, sort_keys=True), encoding="utf-8")
    print(f"adjustments: +{added} new, {updated} refreshed, {err_kept} errors recorded, {stale} stale (URL gone from sitemap)")

    # Prices file — iwm_flawless is the TOP-config Flawless price (best
    # chip + max RAM + max storage + best GPU/display), matching the
    # site's long-standing "Up to $X" semantics ("Each base = IWM
    # Flawless × max-storage × 0.90 (top-config baseline)" — page.tsx).
    # Page-level key gets the max across submodels; per-submodel keys get
    # their exact top-config. apply-iwm resolves bridge slugs (dell
    # '3520', lenovo 'lenovo-thinkpad-t480') via the submodel keys.
    def top_config_flawless(sub) -> int:
        base = sub.get("base_price", 0)
        if base <= 0:
            return 0

        def max_delta(d):
            vals = [x for x in (d or {}).values() if isinstance(x, (int, float))]
            return max(0, max(vals)) if vals else 0

        # Chip max uses the same continuity filter as build-pc-laptop-
        # specs.py: the go_to walk can bleed chips across submodel
        # branches (2024 "Core Ultra Series 2" on a 2016 XPS 9360 at
        # +$730). A gap over max($150, base) between consecutive sorted
        # deltas marks where the foreign chips start — cap there.
        adjs = sorted(int(c.get("adj", 0)) for c in (sub.get("chips") or []))
        chip_max = 0
        if adjs:
            gap_thresh = max(150, int(base))
            cut = adjs[0]
            for a in adjs[1:]:
                if a - cut > gap_thresh:
                    break
                cut = a
            chip_max = max(0, cut)
        return int(base + chip_max + max_delta(sub.get("ram_adj"))
                   + max_delta(sub.get("storage_adj")) + max_delta(sub.get("gpu_adj"))
                   + max_delta(sub.get("display_adj")))

    prices = json.loads(PRICES.read_text(encoding="utf-8")) if PRICES.exists() else {}
    pw = 0
    for k, v in fresh_ok.items():
        series = v["series"]
        subs = {sk: top_config_flawless(sv) for sk, sv in (v.get("submodels") or {}).items()}
        subs = {sk: fl for sk, fl in subs.items() if fl > 0}
        if not subs:
            continue
        stamp = v["scraped_at"]

        def price_entry(model_slug, flawless):
            return {
                "series": series, "model": model_slug, "url": v["url"],
                "iwm_flawless": int(flawless),
                "our_price": max(0, round(flawless * (1 - DISCOUNT))),
                "scraped_at": stamp, "done": True,
            }

        # Page-level key: if a submodel shares the page slug (the
        # galaxy-book4 page has a "Galaxy Book4" base submodel), use that
        # submodel's own top-config — pricing the base trim at the page
        # max would hand it the Ultra sibling's ceiling. Pages whose
        # submodels are all distinct keep the max as the umbrella price.
        prices[k] = price_entry(v["model"], subs.get(v["model"]) or max(subs.values()))
        pw += 1
        for sk, fl in subs.items():
            if not sk or sk == v["model"]:
                continue
            prices[f"{series}/{sk}"] = price_entry(sk, fl)
            pw += 1
    PRICES.parent.mkdir(parents=True, exist_ok=True)
    PRICES.write_text(json.dumps(prices, indent=2, sort_keys=True), encoding="utf-8")
    priced = sum(1 for v in prices.values() if v.get("iwm_flawless"))
    print(f"prices: wrote {pw} fresh entries ({len(prices)} total, {priced} priced) -> {PRICES}")


def main():
    args = sys.argv[1:]
    if "--merge-only" in args:
        state = json.loads(PROGRESS.read_text()) if PROGRESS.exists() else {}
        live = {f"{t['series']}/{t['model']}" for t in load_targets()}
        merge(state, live)
        return
    limit = None
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])
    state, live = run_scrape(limit=limit)
    if limit:
        print("(limit run: skipping merge — use --merge-only to merge)")
        return
    merge(state, live)


if __name__ == "__main__":
    main()
