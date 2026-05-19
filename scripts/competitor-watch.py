#!/usr/bin/env python3
"""Competitor watch — weekly Atlas + IWM price scrape, diff against TCC's
live PRICE_TABLE (with admin overrides applied), and post a summary to
Mission Control.

The goal is to eliminate the manual "ask Powerhouse to scrape" loop:
Skywalker wants to know when his competitors move so he can re-price
proactively. This script answers "what changed since last week?" with
concrete dollar deltas, plus surfaces any model where TCC is now wildly
under- or over-paying vs the market.

Sources:
  - Atlas Mobile USED wholesale sheet (CSV export, no auth)
  - Atlas Mobile NIB wholesale sheet (CSV export, no auth)
  - IWM product pages (HTML with embedded base64 `pricingData` blob)
  - TCC live prices via /api/admin/prices (public GET — includes overrides)

Run:
  python scripts/competitor-watch.py            # scrape + post to MC
  python scripts/competitor-watch.py --dry-run  # scrape + print, no MC post
  python scripts/competitor-watch.py --only-changes  # skip if no changes vs last run

History (last scrape result) is stored at
~/.competitor-watch-last.json so we can compute week-over-week deltas.
"""
from __future__ import annotations
import argparse, base64, csv, json, os, re, sys, urllib.request
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

# Windows cp1252 default chokes on the emoji/arrow chars we print —
# reconfigure stdout to UTF-8 so a `python scripts/competitor-watch.py`
# run doesn't crash before the MC post fires.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ATLAS_USED_SHEET = "1pu4Adxq4MGB6Qour0k__4gBdgnggWRoSVYnJUKgxzEw"
ATLAS_NIB_SHEET = "1f3b0rW1d5xTonDtkoPmLIAOjKc-CUF6clMBalPWyS80"
ATLAS_USED_GID = "0"
ATLAS_NIB_GID = "1148430169"

# iPhone 17 family — proven scraper. Expand later as needed.
IWM_PRODUCTS = [
    ("iphone-17",         "ip17"),
    ("iphone-17-pro",     "ip17p"),
    ("iphone-17-pro-max", "ip17pm"),
    ("iphone-17e",        "ip17e"),
]

TCC_API = "https://topcashcellular.com/api/admin/prices"
MC_API = "https://missioncontrolsdjg-production.up.railway.app/api/comms"
MC_KEY = os.environ.get("MC_API_KEY") or "9b4dce8e03c1d2aaf86d272a2afda99a0157f49abd66450f"

HISTORY_PATH = Path.home() / ".competitor-watch-last.json"

# Atlas USED sheet column layout: col 1 = Model, col 2-7 = SWAP/A/B/C/D/DOA
ATLAS_USED_COND_MAP = {2: "swap", 3: "mint", 4: "verygood", 5: "good", 6: "fair", 7: "broken"}
NAME_TO_TCC = [
    ("iPhone 17 Pro Max", "ip17pm"),
    ("iPhone 17 Pro",     "ip17p"),
    ("iPhone 17 Air",     "ip17air"),
    ("iPhone 17e",        "ip17e"),
    ("iPhone 17",         "ip17"),
]
STORAGE_LABEL_TO_ID = {"256GB": "256", "512GB": "512", "1TB": "1tb", "2TB": "2tb"}


def http_get(url: str, headers: dict | None = None, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def parse_dollars(s: str) -> int | None:
    if not s:
        return None
    s = s.strip().replace("$", "").replace(",", "").strip()
    if not s:
        return None
    try:
        return int(s)
    except Exception:
        return None


def match_tcc_id(text: str) -> str | None:
    t = (text or "").strip().lower()
    for name, tid in NAME_TO_TCC:
        prefix = name.lower()
        if t == prefix or t.startswith(prefix + " ") or t.startswith(prefix + ","):
            return tid
    return None


def storage_from_text(text: str) -> str | None:
    for k, v in STORAGE_LABEL_TO_ID.items():
        if k.lower() in (text or "").lower():
            return v
    return None


def scrape_atlas() -> dict:
    """Returns {tcc_id: {storage: {lock: {cond: $}}}} where lock is
    'unlocked' or 'locked'. Combines USED + NIB sheets."""
    out: dict = {}
    # USED sheet (Grade A/B/C/D/DOA — used phone conditions)
    csv_url = f"https://docs.google.com/spreadsheets/d/{ATLAS_USED_SHEET}/export?format=csv&gid={ATLAS_USED_GID}"
    raw = http_get(csv_url).decode("utf-8", errors="ignore")
    for row in csv.reader(StringIO(raw)):
        if not row or len(row) < 8:
            continue
        name = (row[1] or "").strip()
        tid = match_tcc_id(name)
        if not tid:
            continue
        stor = storage_from_text(name)
        if not stor:
            continue
        lock = "unlocked" if "unlocked" in name.lower() else "locked" if "carrier locked" in name.lower() else None
        if not lock:
            continue
        out.setdefault(tid, {}).setdefault(stor, {}).setdefault(lock, {})
        for col, cond in ATLAS_USED_COND_MAP.items():
            v = parse_dollars(row[col]) if col < len(row) else None
            if v is not None:
                out[tid][stor][lock][cond] = v
    # NIB sheet (Sealed prices for new-in-box)
    csv_url = f"https://docs.google.com/spreadsheets/d/{ATLAS_NIB_SHEET}/export?format=csv&gid={ATLAS_NIB_GID}"
    raw = http_get(csv_url).decode("utf-8", errors="ignore")
    current_model = None
    for row in csv.reader(StringIO(raw)):
        if not row:
            continue
        cells = [c.strip() for c in row]
        if len(cells) >= 2 and cells[1] and not (len(cells) > 3 and cells[3].startswith("$")):
            mid = match_tcc_id(cells[1])
            if mid:
                current_model = mid
        if not current_model or len(cells) < 4:
            continue
        lock = "unlocked" if cells[1].lower() == "unlocked" else "locked" if cells[1].lower() == "carrier locked" else None
        if not lock:
            continue
        stor = storage_from_text(cells[2])
        if not stor:
            continue
        sealed = parse_dollars(cells[3])
        if sealed is not None:
            out.setdefault(current_model, {}).setdefault(stor, {}).setdefault(lock, {})["sealed"] = sealed
    return out


def scrape_iwm() -> dict:
    """Returns {tcc_id: {condition_text: $, ...}} for the IWM pricingData
    top-tier (no storage premium baked in)."""
    out: dict = {}
    for slug, tid in IWM_PRODUCTS:
        try:
            html = http_get(f"https://www.itsworthmore.com/sell/iphone/{slug}").decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"  [iwm] {slug}: fetch failed: {e}", file=sys.stderr)
            continue
        m = re.search(r"'pricingData'\s*:\s*\"([A-Za-z0-9+/=]+)\"", html)
        if not m:
            print(f"  [iwm] {slug}: pricingData blob not found", file=sys.stderr)
            continue
        try:
            tree = json.loads(base64.b64decode(m.group(1)).decode("utf-8"))
        except Exception as e:
            print(f"  [iwm] {slug}: decode failed: {e}", file=sys.stderr)
            continue
        # Pull the top-level condition question (first one in the tree)
        def find_q(node, kw):
            res = []
            if isinstance(node, dict):
                if "text" in node and kw in node["text"].lower():
                    res.append(node)
                for v in node.values():
                    res.extend(find_q(v, kw))
            elif isinstance(node, list):
                for x in node:
                    res.extend(find_q(x, kw))
            return res
        cond_qs = find_q(tree, "condition of the phone")
        if not cond_qs:
            continue
        cond = {a.get("text", ""): a.get("value", 0) for a in cond_qs[0].get("answers", [])}
        out[tid] = cond
    return out


def fetch_tcc_prices() -> dict:
    """Returns TCC's effective price grid via the public API."""
    try:
        raw = http_get(TCC_API)
        d = json.loads(raw)
        return d.get("effective", {}).get("priceTable", {})
    except Exception as e:
        print(f"  [tcc] fetch failed: {e}", file=sys.stderr)
        return {}


def build_report(atlas: dict, iwm: dict, tcc: dict, last: dict | None) -> str:
    lines: list[str] = []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines.append(f"[COMPETITOR WATCH {today}]")
    lines.append(f"Atlas models scraped: {len(atlas)} | IWM: {len(iwm)} | TCC reference: {len(tcc)}")
    lines.append("")

    # Section 1: week-over-week changes (vs last run)
    if last:
        changes: list[str] = []
        last_atlas = last.get("atlas", {})
        last_iwm = last.get("iwm", {})
        # Atlas changes
        for mid, by_stor in atlas.items():
            for stor, by_lock in by_stor.items():
                for lock, conds in by_lock.items():
                    for cond, v in conds.items():
                        prev = last_atlas.get(mid, {}).get(stor, {}).get(lock, {}).get(cond)
                        if prev is not None and prev != v:
                            delta = v - prev
                            arrow = "↑" if delta > 0 else "↓"
                            changes.append(f"  Atlas {arrow} {mid} {stor} {lock} {cond}: ${prev} → ${v} ({delta:+d})")
        # IWM changes
        for mid, conds in iwm.items():
            for cond, v in conds.items():
                prev = last_iwm.get(mid, {}).get(cond)
                if prev is not None and prev != v:
                    delta = v - prev
                    arrow = "↑" if delta > 0 else "↓"
                    changes.append(f"  IWM   {arrow} {mid} {cond}: ${prev} → ${v} ({delta:+d})")
        if changes:
            lines.append("CHANGES SINCE LAST RUN")
            lines.extend(changes[:25])
            if len(changes) > 25:
                lines.append(f"  … +{len(changes) - 25} more changes")
        else:
            lines.append("CHANGES SINCE LAST RUN: none")
        lines.append("")
    else:
        lines.append("(first run — no week-over-week comparison)")
        lines.append("")

    # Section 2: TCC gap vs Atlas - $100 buffer (Skywalker's price rule)
    BUFFER = 100
    gaps: list[tuple[str, int]] = []
    for mid, by_stor in atlas.items():
        for stor, by_lock in by_stor.items():
            atlas_unlocked_sealed = by_lock.get("unlocked", {}).get("sealed")
            if atlas_unlocked_sealed is None:
                continue
            atlas_target = atlas_unlocked_sealed - BUFFER
            tcc_v = tcc.get(mid, {}).get(stor, {}).get("sealed")
            if tcc_v is None:
                continue
            gap = tcc_v - atlas_target
            if abs(gap) >= 25:  # only flag meaningful drift
                gaps.append((f"{mid} {stor} sealed: TCC ${tcc_v} vs Atlas-buf ${atlas_target} → off by ${gap:+d}", gap))
    if gaps:
        lines.append("TCC GAPS vs ATLAS (Unlocked Sealed - $100 buffer)")
        for line, _ in sorted(gaps, key=lambda x: -abs(x[1]))[:10]:
            arrow = "🔴" if abs(_) > 75 else "🟡"
            lines.append(f"  {arrow} {line}")
    else:
        lines.append("TCC vs ATLAS: all within $25 of target buffer ✓")
    lines.append("")
    lines.append("Edit at /admin/prices to apply changes — overrides go live in seconds.")
    return "\n".join(lines)


def post_to_mc(body: str) -> bool:
    payload = json.dumps({
        "from": "competitor-watch",
        "fromName": "Competitor Watch",
        "role": "system",
        "priority": "normal",
        "body": body,
        "tags": ["competitor-watch"],
    }).encode("utf-8")
    req = urllib.request.Request(MC_API, data=payload, method="POST", headers={
        "Content-Type": "application/json",
        "x-api-key": MC_KEY,
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status < 300
    except Exception as e:
        print(f"MC post failed: {e}", file=sys.stderr)
        return False


def load_last() -> dict | None:
    if not HISTORY_PATH.exists():
        return None
    try:
        return json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None


def save_last(state: dict) -> None:
    try:
        HISTORY_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"history save failed: {e}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Print report, don't post to MC")
    ap.add_argument("--only-changes", action="store_true", help="Skip posting if no week-over-week changes")
    args = ap.parse_args()

    print("Scraping Atlas…", file=sys.stderr)
    atlas = scrape_atlas()
    print(f"  → {len(atlas)} model entries", file=sys.stderr)
    print("Scraping IWM…", file=sys.stderr)
    iwm = scrape_iwm()
    print(f"  → {len(iwm)} model entries", file=sys.stderr)
    print("Fetching TCC live prices…", file=sys.stderr)
    tcc = fetch_tcc_prices()
    print(f"  → {len(tcc)} model entries", file=sys.stderr)

    last = load_last()
    report = build_report(atlas, iwm, tcc, last)

    print(report)

    if args.dry_run:
        return

    if args.only_changes and last:
        if "CHANGES SINCE LAST RUN: none" in report and "TCC vs ATLAS: all within" in report:
            print("(no changes — skipping MC post)", file=sys.stderr)
            return

    if post_to_mc(report):
        print("✓ Posted to MC", file=sys.stderr)
    else:
        print("✗ MC post failed", file=sys.stderr)

    save_last({"atlas": atlas, "iwm": iwm, "at": datetime.now(timezone.utc).isoformat()})


if __name__ == "__main__":
    main()
