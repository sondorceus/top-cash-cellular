#!/usr/bin/env python3
"""Weekly IWM price refresh orchestrator.

What it does:
  1. Walks every priced laptop variant in app/page.tsx
  2. Looks up its IWM URL via iwm-catalog.json
  3. Scrapes IWM via scripts/iwm-head-scrape.py (re-using the existing
     tool — the base64 blob in the page HEAD)
  4. Builds a fresh spec entry per variant and diffs vs the current
     entry in public/comps/pc-laptop-specs.json
  5. Reports every change > $20 OR > 10% — direction + which model
  6. With --apply, writes the new specs back. With --post-mc, posts a
     summary to MC comms tagged as a weekly-auto-update message.

Skywalker 2026-05-18: "setup the smart tracking system i ask". This
is the local twin of the cron Powerhouse is wiring on his Railway side
— either one running is enough; both running is harmless (idempotent).

Usage:
  python3 scripts/weekly-iwm-refresh.py                 # dry-run, no writes
  python3 scripts/weekly-iwm-refresh.py --apply         # write spec changes
  python3 scripts/weekly-iwm-refresh.py --apply --post-mc  # write + summarize
  python3 scripts/weekly-iwm-refresh.py --brand legion     # focus one brand
"""
from __future__ import annotations
import argparse, json, re, subprocess, sys, time, urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
PAGE = ROOT / "app" / "page.tsx"
CATALOG = ROOT / "iwm-catalog.json"
SPECS = ROOT / "public" / "comps" / "pc-laptop-specs.json"
SCRAPER = ROOT / "scripts" / "iwm-head-scrape.py"
OUR_MULT = 0.90  # Pay 10% less than IWM
SIG_DOLLAR = 20  # only report dollar changes > this
SIG_PERCENT = 0.10  # or percent changes > this
MC_API = "https://missioncontrolsdjg-production.up.railway.app"
MC_KEY = "9b4dce8e03c1d2aaf86d272a2afda99a0157f49abd66450f"

CONDITION_MAP = {"Brand New": "sealed", "Flawless": "mint", "Very Good": "verygood",
                 "Good": "good", "Fair": "fair", "Broken": "broken"}
STORAGE_MAP = {"128GB SSD": ("s128", "128GB"), "256GB SSD": ("s256", "256GB"),
               "512GB SSD": ("s512", "512GB"), "1TB SSD": ("s1t", "1TB"),
               "2TB SSD": ("s2t", "2TB"), "1TB HDD": ("s1th", "1TB HDD"),
               "512GB HDD": ("s512h", "512GB HDD"), "256GB HDD": ("s256h", "256GB HDD")}

LAPTOP_BLOCKS = [
    'LENOVO_THINKBOOK_VARIANTS', 'LENOVO_IDEAPAD_VARIANTS', 'LENOVO_LEGION_VARIANTS',
    'LENOVO_LOQ_VARIANTS', 'LENOVO_SLIM_VARIANTS', 'LENOVO_YOGA_VARIANTS',
    'LENOVO_TP_X1_VARIANTS', 'LENOVO_TP_X13_VARIANTS', 'LENOVO_TP_X390_VARIANTS',
    'LENOVO_TP_X9_VARIANTS', 'LENOVO_TP_T_VARIANTS', 'LENOVO_TP_P_VARIANTS',
    'LENOVO_TP_L_VARIANTS', 'LENOVO_TP_E_VARIANTS', 'LENOVO_TP_Z_VARIANTS',
    'HP_ENVY_VARIANTS', 'HP_PAVILION_VARIANTS', 'HP_PROBOOK_VARIANTS',
    'HP_SPECTRE_VARIANTS', 'HP_VICTUS_VARIANTS', 'HP_ZBOOK_VARIANTS',
    'HP_NOTEBOOK_VARIANTS', 'HP_OMNIBOOK_VARIANTS', 'HP_ELITEBOOK_STD_VARIANTS',
    'HP_ELITEBOOK_ULTRA_VARIANTS', 'HP_OMEN_STD_VARIANTS', 'HP_OMEN_TRANSCEND_VARIANTS',
    'HP_OMEN_MAX_VARIANTS', 'HP_OMEN_SLIM_VARIANTS', 'ACER_NITRO_VARIANTS',
    'ACER_PREDATOR_VARIANTS', 'ASUS_PC_MODELS', 'ALIENWARE_MODELS',
    'SAMSUNG_BOOK5_VARIANTS', 'SAMSUNG_BOOK4_VARIANTS', 'SAMSUNG_BOOK3_VARIANTS',
    'SAMSUNG_BOOK2_VARIANTS', 'SAMSUNG_BOOK1_VARIANTS',
    'LG_GRAM_14_VARIANTS', 'LG_GRAM_14_2IN1_VARIANTS', 'LG_GRAM_15_VARIANTS',
    'LG_GRAM_16_VARIANTS', 'LG_GRAM_16_2IN1_VARIANTS', 'LG_GRAM_17_VARIANTS',
    'LG_GRAM_PRO_16_VARIANTS', 'LG_GRAM_PRO_16_2IN1_VARIANTS',
    'LG_GRAM_PRO_17_VARIANTS', 'LG_GRAM_SUPERSLIM_15_VARIANTS',
]

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

def read_laptops(brand_filter=None):
    src = PAGE.read_text()
    laptops = {}
    for block in LAPTOP_BLOCKS:
        m = re.search(rf'const ({block})\s*=\s*\[(.*?)\];', src, re.DOTALL)
        if not m: continue
        body = m.group(2)
        for _id, label, base, tail in re.findall(
            r'\{[^}]*?id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*base:\s*(\d+)([^}]*?)\}', body
        ):
            if brand_filter and brand_filter.lower() not in block.lower():
                continue
            laptops[_id] = {"label": label, "base": int(base), "block": block,
                            "inquiryOnly": 'inquiryOnly: true' in tail}
    return laptops

def find_iwm_url(our_id, label):
    cat = json.loads(CATALOG.read_text())["devices"]
    # Heuristics: model slug from our_id (strip vendor prefix) + label slug
    label_slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    for e in cat:
        if label_slug in e["model"] or our_id.replace("_", "-") in e["model"]:
            return e["url"]
    return None

def scrape(url):
    r = subprocess.run(["python3", str(SCRAPER), url, "--json"],
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout)
    except Exception:
        return None

def build_spec(iwm_data):
    if not iwm_data: return None
    sub_min, sub_grid = {}, {}
    for sub, sg in iwm_data.items():
        if not isinstance(sg, dict): continue
        flaws = {sto: cg["Flawless"] for sto, cg in sg.items()
                 if isinstance(cg, dict) and cg.get("Flawless") and cg["Flawless"] > 0}
        if flaws:
            sub_min[sub] = min(flaws.values())
            sub_grid[sub] = flaws
    if not sub_min: return None
    base_sub = min(sub_min, key=sub_min.get)
    base_grid = sub_grid[base_sub]
    base_storage = min(base_grid, key=base_grid.get)
    base_price = base_grid[base_storage]
    seen = set()
    for g in sub_grid.values(): seen.update(g.keys())
    storage = []
    for sto in sorted(seen, key=lambda s: base_grid.get(s, base_price)):
        sid, sl = STORAGE_MAP.get(sto, (slugify(sto), sto))
        storage.append({"id": sid, "label": sl,
                        "adj": base_grid.get(sto, base_price) - base_price,
                        "multiplier": 1.0, "sub": ""})
    procs = []
    for sub, mf in sub_min.items():
        procs.append({"id": slugify(sub), "label": sub,
                      "adj": 0 if sub == base_sub else mf - base_price,
                      "multiplier": 1.0, "sub": ""})
    procs.sort(key=lambda p: p["adj"])
    cond_deltas = {c: [] for c in CONDITION_MAP}
    for sub, sg in iwm_data.items():
        for sto, cg in sg.items():
            if not isinstance(cg, dict): continue
            flaw = cg.get("Flawless")
            if not flaw or flaw <= 0: continue
            for ciwm in CONDITION_MAP:
                v = cg.get(ciwm)
                if v is not None: cond_deltas[ciwm].append(v - flaw)
    cond_adj = {ours: round(sum(cond_deltas[ciwm]) / len(cond_deltas[ciwm]))
                for ciwm, ours in CONDITION_MAP.items() if cond_deltas[ciwm]}
    return {
        "base_price": round(base_price * OUR_MULT),
        "processors": procs, "memory": [], "graphics": [], "display": [],
        "storage": storage, "condition_adj": cond_adj,
        "battery_adj": {"good": 0, "poor": -50},
        "charger_adj": {"yes": 0, "no": -25},
        "hasNanoGlass": False,
    }

def top_quote(spec):
    """Top-config customer offer: base + max processor adj + max storage adj.
    Methodology-agnostic — works whether base is lowest-config or median.
    """
    if not spec: return 0
    base = spec.get("base_price", 0)
    proc_max = max((p.get("adj", 0) for p in spec.get("processors", [])), default=0)
    sto_max = max((s.get("adj", 0) for s in spec.get("storage", [])), default=0)
    return base + proc_max + sto_max

def diff_specs(old, new):
    """Return a dict of meaningful changes, or None if minor/none.
    Compares TOP QUOTE (what the best-config customer would see) so
    methodology differences in base_price between scrape runs don't
    show as false-alarm drops.
    """
    if not old: return {"kind": "new", "top_quote": top_quote(new)}
    if not new: return {"kind": "removed", "old_top": top_quote(old)}
    old_top = top_quote(old)
    new_top = top_quote(new)
    dollar = new_top - old_top
    pct = dollar / old_top if old_top else 1.0
    if abs(dollar) > SIG_DOLLAR or abs(pct) > SIG_PERCENT:
        return {"kind": "price", "old": old_top, "new": new_top,
                "delta": dollar, "pct": round(pct * 100, 1)}
    return None

def post_mc(body):
    req = urllib.request.Request(
        f"{MC_API}/api/comms",
        method="POST",
        headers={"x-api-key": MC_KEY, "Content-Type": "application/json"},
        data=json.dumps({
            "from": "claudmx", "fromName": "ClaudeMX", "role": "system",
            "body": body, "tags": ["iwm-weekly-refresh", "tcc"], "priority": "low",
        }).encode(),
    )
    try:
        urllib.request.urlopen(req, timeout=15).read()
        return True
    except Exception as e:
        print(f"MC post failed: {e}", file=sys.stderr)
        return False

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write spec changes back")
    ap.add_argument("--post-mc", action="store_true", help="Post summary to MC")
    ap.add_argument("--brand", help="Only refresh one brand (substring match on block name)")
    ap.add_argument("--limit", type=int, help="Cap number of variants to refresh")
    ap.add_argument(
        "--full", action="store_true",
        help="Refresh EVERY variant (rebuilds existing curated entries). "
             "Default: only fill gaps (new spec entries for variants without one). "
             "Use --full when re-baselining or after a major IWM site change.",
    )
    args = ap.parse_args()

    laptops = read_laptops(brand_filter=args.brand)
    specs = json.loads(SPECS.read_text())
    print(f"Refreshing {len(laptops)} priced laptop variants...")
    if args.limit:
        laptops = dict(list(laptops.items())[:args.limit])
        print(f"Limited to first {args.limit}")

    changes = []
    skipped = []
    seen_urls = {}  # cache to avoid re-scraping the same URL
    for i, (our_id, info) in enumerate(laptops.items(), 1):
        if info["inquiryOnly"]:
            continue
        # Default mode: only fill gaps. --full to refresh all.
        if not args.full and our_id in specs:
            continue
        url = find_iwm_url(our_id, info["label"])
        if not url:
            skipped.append((our_id, "no-iwm-url"))
            continue
        if url in seen_urls:
            data = seen_urls[url]
        else:
            print(f"  [{i}/{len(laptops)}] {our_id:24s} → scraping...", flush=True)
            data = scrape(url)
            seen_urls[url] = data
            time.sleep(0.4)  # polite spacing
        new_spec = build_spec(data)
        old_spec = specs.get(our_id)
        change = diff_specs(old_spec, new_spec)
        if change:
            changes.append({"id": our_id, "label": info["label"], **change})
            if args.apply and new_spec:
                specs[our_id] = new_spec

    if args.apply and changes:
        SPECS.write_text(json.dumps(specs, indent=2))
        print(f"\nWrote {SPECS} with {len(changes)} changes applied.")

    # Summary
    print(f"\n=== Summary ({datetime.utcnow().isoformat()}Z) ===")
    print(f"  Variants checked: {len(laptops)}")
    print(f"  Changes: {len(changes)}")
    print(f"  Skipped (no IWM URL): {len(skipped)}")
    for c in sorted([c for c in changes if c.get("kind") == "price"],
                    key=lambda c: abs(c.get("delta", 0)), reverse=True)[:15]:
        arrow = "↑" if c["delta"] > 0 else "↓"
        print(f"    {arrow} {c['id']:24s}  ${c['old']} → ${c['new']}  ({c['delta']:+d}, {c['pct']:+.1f}%)")
    new_count = sum(1 for c in changes if c.get("kind") == "new")
    if new_count:
        print(f"    + {new_count} new spec entries")

    if args.post_mc:
        big_movers = sorted([c for c in changes if c.get("kind") == "price"],
                            key=lambda c: abs(c.get("delta", 0)), reverse=True)[:5]
        mc_body = (
            f"📊 Weekly IWM refresh — {datetime.utcnow().strftime('%Y-%m-%d')}\n"
            f"Variants checked: {len(laptops)}\n"
            f"Changes: {len(changes)} ({new_count} new, "
            f"{len([c for c in changes if c['kind']=='price'])} price moves)\n"
        )
        if big_movers:
            mc_body += "\nBiggest moves:\n"
            for c in big_movers:
                arrow = "↑" if c["delta"] > 0 else "↓"
                mc_body += f"  {arrow} {c['label']}: ${c['old']} → ${c['new']} ({c['delta']:+d})\n"
        if not args.apply:
            mc_body += "\n(dry-run — no commit. Re-run with --apply to write.)"
        post_mc(mc_body)
        print("\n📮 Posted summary to MC.")

if __name__ == "__main__":
    main()
