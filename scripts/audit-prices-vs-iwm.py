#!/usr/bin/env python3
"""IWM ↔ PRICE_TABLE audit.

For every model in app/data/prices.ts PRICE_TABLE, scrape IWM and diff
each (storage, condition) cell against our value. Flag cells where:
  - ours / (iwm * 0.9) > 1.10  →  OVERPAY (margin risk, we lose money)
  - ours / (iwm * 0.9) < 0.70  →  UNDERPAY (we lose leads to IWM)

Run from repo root:  python3 scripts/audit-prices-vs-iwm.py
"""
import sys, re, json, base64, time
import urllib.request, urllib.error
from pathlib import Path

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
OUR_MULT = 0.90
OVER_THRESHOLD = 1.10
UNDER_THRESHOLD = 0.70
ROOT = Path(__file__).resolve().parent.parent

# Map every PRICE_TABLE model id → IWM URL. Built from page.tsx model
# labels + known IWM slug conventions. Models not in this map will be
# reported as "skipped — no URL mapping" so we don't silently miss them.
IWM_URLS = {
    # iPhones — /sell/iphone/iphone-N{,-plus,-pro,-pro-max,-mini,-air}
    "ip11":   "iphone-11", "ip11p": "iphone-11-pro", "ip11pm": "iphone-11-pro-max",
    "ip12mini":"iphone-12-mini", "ip12":"iphone-12", "ip12p":"iphone-12-pro", "ip12pm":"iphone-12-pro-max",
    "ip13mini":"iphone-13-mini", "ip13":"iphone-13", "ip13p":"iphone-13-pro", "ip13pm":"iphone-13-pro-max",
    "ip14":"iphone-14", "ip14plus":"iphone-14-plus", "ip14p":"iphone-14-pro", "ip14pm":"iphone-14-pro-max",
    "ip15":"iphone-15", "ip15plus":"iphone-15-plus", "ip15p":"iphone-15-pro", "ip15pm":"iphone-15-pro-max",
    "ip16":"iphone-16", "ip16e":"iphone-16e", "ip16plus":"iphone-16-plus", "ip16p":"iphone-16-pro", "ip16pm":"iphone-16-pro-max",
    "ip17":"iphone-17", "ip17e":"iphone-17e", "ip17air":("iphone","iphone-air"), "ip17p":"iphone-17-pro", "ip17pm":"iphone-17-pro-max",

    # Samsung Galaxy S — /sell/galaxy-s-series/galaxy-s{N}{,-plus,-ultra,-fe,-edge}{,-5g}
    # IWM uses "-5g" suffix for S20-S22 series, no suffix for S23+.
    "gs20":   ("galaxy-s-series", "galaxy-s20-5g"),
    "gs20p":  ("galaxy-s-series", "galaxy-s20-plus-5g"),
    "gs20u":  ("galaxy-s-series", "galaxy-s20-ultra-5g"),
    "gs20fe": ("galaxy-s-series", "galaxy-s20-fe-5g"),
    "gs21":   ("galaxy-s-series", "galaxy-s21-5g"),
    "gs21p":  ("galaxy-s-series", "galaxy-s21-plus-5g"),
    "gs21u":  ("galaxy-s-series", "galaxy-s21-ultra-5g"),
    "gs21fe": ("galaxy-s-series", "galaxy-s21-fe-5g"),
    "gs22":   ("galaxy-s-series", "galaxy-s22-5g"),
    "gs22p":  ("galaxy-s-series", "galaxy-s22-plus-5g"),
    "gs22u":  ("galaxy-s-series", "galaxy-s22-ultra-5g"),
    "gs23":   ("galaxy-s-series", "galaxy-s23"),
    "gs23p":  ("galaxy-s-series", "galaxy-s23-plus"),
    "gs23u":  ("galaxy-s-series", "galaxy-s23-ultra"),
    "gs23fe": ("galaxy-s-series", "galaxy-s23-fe"),
    "gs24":   ("galaxy-s-series", "galaxy-s24"),
    "gs24p":  ("galaxy-s-series", "galaxy-s24-plus"),
    "gs24u":  ("galaxy-s-series", "galaxy-s24-ultra"),
    "gs24fe": ("galaxy-s-series", "galaxy-s24-fe"),
    "gs25":   ("galaxy-s-series", "galaxy-s25"),
    "gs25p":  ("galaxy-s-series", "galaxy-s25-plus"),
    "gs25u":  ("galaxy-s-series", "galaxy-s25-ultra"),
    "gs25fe": ("galaxy-s-series", "galaxy-s25-fe"),
    "gs25edge": ("galaxy-s-series", "galaxy-s25-edge"),
    "gs26":   ("galaxy-s-series", "galaxy-s26"),
    "gs26p":  ("galaxy-s-series", "galaxy-s26-plus"),
    "gs26u":  ("galaxy-s-series", "galaxy-s26-ultra"),

    # Galaxy Notes — /sell/galaxy-note-series/galaxy-note-{N}{-plus,-ultra}{-5g}
    "gnote9":     ("galaxy-note-series", "galaxy-note-9"),
    "gnote10":    ("galaxy-note-series", "galaxy-note-10"),
    "gnote10p":   ("galaxy-note-series", "galaxy-note-10-plus"),
    "gnote10p5g": ("galaxy-note-series", "galaxy-note-10-plus-5g"),
    "gnote20":    ("galaxy-note-series", "galaxy-note-20-5g"),

    # Galaxy Z foldables — /sell/galaxy-z-fold-series/galaxy-z-{flip,fold}-{N}
    # Older Flip/Fold use concatenated "flip5" / "flip4"; newer use hyphenated.
    "gzflip3":   ("galaxy-z-fold-series", "galaxy-z-flip3-5g"),
    "gzflip4":   ("galaxy-z-fold-series", "galaxy-z-flip4"),
    "gzflip5":   ("galaxy-z-fold-series", "galaxy-z-flip5"),
    "gzflip6":   ("galaxy-z-fold-series", "galaxy-z-flip-6"),
    "gzflip7":   ("galaxy-z-fold-series", "galaxy-z-flip-7"),
    "gzfold3":   ("galaxy-z-fold-series", "galaxy-z-fold-3-5g"),
    "gzfold4":   ("galaxy-z-fold-series", "galaxy-z-fold-4"),
    "gzfold5":   ("galaxy-z-fold-series", "galaxy-z-fold-5"),
    "gzfold6":   ("galaxy-z-fold-series", "galaxy-z-fold-6"),
    "gzfold7":   ("galaxy-z-fold-series", "galaxy-z-fold-7"),
    "gztrifold": ("galaxy-z-fold-series", "galaxy-z-trifold"),

    # Pixel — /sell/google-phone/google-pixel-N{,-pro,-pro-xl,-pro-fold,a}
    "px5":      ("google-phone", "google-pixel-5"),
    "px5a":     ("google-phone", "google-pixel-5a-5g"),
    "px6":      ("google-phone", "google-pixel-6"),
    "px6p":     ("google-phone", "google-pixel-6-pro"),
    "px7":      ("google-phone", "google-pixel-7"),
    "px7p":     ("google-phone", "google-pixel-7-pro"),
    "px7a":     ("google-phone", "google-pixel-7a"),
    "px8":      ("google-phone", "google-pixel-8"),
    "px8p":     ("google-phone", "google-pixel-8-pro"),
    "px8a":     ("google-phone", "google-pixel-8a"),
    "px9":      ("google-phone", "google-pixel-9"),
    "px9p":     ("google-phone", "google-pixel-9-pro"),
    "px9pxl":   ("google-phone", "google-pixel-9-pro-xl"),
    "px9a":     ("google-phone", "google-pixel-9a"),
    "px9pfold": ("google-phone", "google-pixel-9-pro-fold"),
    "px10":     ("google-phone", "google-pixel-10"),
    "px10p":    ("google-phone", "google-pixel-10-pro"),
    "px10pxl":  ("google-phone", "google-pixel-10-pro-xl"),
    "px10a":    ("google-phone", "google-pixel-10a"),
    "px10pfold":("google-phone", "google-pixel-10-pro-fold"),
    "pxfold":   ("google-phone", "google-pixel-fold"),

    # PlayStation — /sell/sony-playstation
    "ps4":     ("sony-playstation", "sony-playstation-4"),
    "ps4pro":  ("sony-playstation", "sony-playstation-4-pro"),
    "ps5":     ("sony-playstation", "sony-playstation-5"),
    "ps5slim": ("sony-playstation", "sony-playstation-5-slim"),
    "ps5pro":  ("sony-playstation", "sony-playstation-5-pro"),

    # Xbox
    "xss": ("microsoft-xbox", "microsoft-xbox-series-s"),
    "xsx": ("microsoft-xbox", "microsoft-xbox-series-x"),

    # Switch — /sell/nintendo-switch
    "switch":   ("nintendo-switch", "nintendo-switch"),
    "switchv2": ("nintendo-switch", "nintendo-switch-v2"),
    "switchlite":("nintendo-switch", "nintendo-switch-lite"),
    "nswoled":  ("nintendo-switch", "nintendo-switch-oled"),
    "nsw2":     ("nintendo-switch", "nintendo-switch-2"),

    # Xbox One (older)
    "xone":     ("microsoft-xbox", "microsoft-xbox-one"),

    # Apple Watch
    "aws7":   ("apple-watch", "apple-watch-series-7"),
    "aws8":   ("apple-watch", "apple-watch-series-8"),
    "aws9":   ("apple-watch", "apple-watch-series-9"),
    "aws10":  ("apple-watch", "apple-watch-series-10"),
    "awse2":  ("apple-watch", "apple-watch-se-2nd-gen"),
    "awu1":   ("apple-watch", "apple-watch-ultra"),
    "awu2":   ("apple-watch", "apple-watch-ultra-2"),
    "awu3":   ("apple-watch", "apple-watch-ultra-3"),

    # Pixel Watch
    "pw1": ("google-pixel-watch", "google-pixel-watch"),
    "pw2": ("google-pixel-watch", "google-pixel-watch-2"),
    "pw3": ("google-pixel-watch", "google-pixel-watch-3"),
    "pw4": ("google-pixel-watch", "google-pixel-watch-4"),

    # Samsung Watch
    "sgw7":   ("samsung-galaxy-watch", "samsung-galaxy-watch-7"),
    "sgw8":   ("samsung-galaxy-watch", "samsung-galaxy-watch-8"),
    "sgw8c":  ("samsung-galaxy-watch", "samsung-galaxy-watch-8-classic"),
    "sgwu":   ("samsung-galaxy-watch", "samsung-galaxy-watch-ultra"),
    "sgwu25": ("samsung-galaxy-watch", "samsung-galaxy-watch-ultra-2025"),

    # Samsung Tabs
    "stabs9":   ("samsung-galaxy-tab", "samsung-galaxy-tab-s9"),
    "stabs10u": ("samsung-galaxy-tab", "samsung-galaxy-tab-s10-ultra"),
    "stabs11":  ("samsung-galaxy-tab", "samsung-galaxy-tab-s11"),
    "stabs11u": ("samsung-galaxy-tab", "samsung-galaxy-tab-s11-ultra"),

    # MacBook Air/Pro
    "mba13m2":   ("macbook", "apple-macbook-air-13-m2"),
    "mba15m2":   ("macbook", "apple-macbook-air-15-m2"),
    "mba13m3":   ("macbook", "apple-macbook-air-13-m3"),
    "mba15m3":   ("macbook", "apple-macbook-air-15-m3"),
    "mba_m4_2025": ("macbook", "apple-macbook-air-2025"),
    "mba_m5_2026": ("macbook", "apple-macbook-air-2026"),
    "mbp13m1":   ("macbook", "apple-macbook-pro-13-m1"),
    "mbp14m2":   ("macbook", "apple-macbook-pro-14-m2"),
    "mbp14m3":   ("macbook", "apple-macbook-pro-14-m3"),
    "mbp14m4":   ("macbook", "apple-macbook-pro-14-m4"),
    "mbp14_m5_2025":      ("macbook", "apple-macbook-pro-14-m5"),
    "mbp14_m5pmax_2026":  ("macbook", "apple-macbook-pro-14-m5-pro-max-2026"),
    "mbp16m2":   ("macbook", "apple-macbook-pro-16-m2"),
    "mbp16m3":   ("macbook", "apple-macbook-pro-16-m3"),
    "mbp16m4":   ("macbook", "apple-macbook-pro-16-m4"),
    "mbp16_m5pmax_2026":  ("macbook", "apple-macbook-pro-16-m5-pro-max-2026"),

    # iPads — IWM lists each model with its own page under apple-tablet
    "ipad9":         ("apple-tablet", "apple-ipad-9"),
    "ipad10":        ("apple-tablet", "apple-ipad-10"),
    "ipad11":        ("apple-tablet", "apple-ipad-11"),
    "ipadair11m2":   ("apple-tablet", "apple-ipad-air-11-m2"),
    "ipadair13m2":   ("apple-tablet", "apple-ipad-air-13-m2"),
    "ipadair11m3":   ("apple-tablet", "apple-ipad-air-11-m3"),
    "ipadair13m3":   ("apple-tablet", "apple-ipad-air-13-m3"),
    "ipadmini6":     ("apple-tablet", "apple-ipad-mini-6"),
    "ipadmini7":     ("apple-tablet", "apple-ipad-mini-7"),
    "ipadpro11g4":   ("apple-tablet", "apple-ipad-pro-11-m2"),
    "ipadpro129g6":  ("apple-tablet", "apple-ipad-pro-12-9-m2"),
    "ipadpro11m4":   ("apple-tablet", "apple-ipad-pro-11-m4"),
    "ipadpro13m4":   ("apple-tablet", "apple-ipad-pro-13-m4"),
    "ipadpro11m5":   ("apple-tablet", "apple-ipad-pro-11-m5"),
    "ipadpro13m5":   ("apple-tablet", "apple-ipad-pro-13-m5"),

    # Apple desktops
    "imac24m1":     ("apple-imac", "apple-imac-24-m1"),
    "imac24m3":     ("apple-imac", "apple-imac-24-m3"),
    "imac24m4":     ("apple-imac", "apple-imac-24-m4"),
    "macminim1":    ("apple-mac-mini", "apple-mac-mini-m1"),
    "macminim2":    ("apple-mac-mini", "apple-mac-mini-m2"),
    "macminim4":    ("apple-mac-mini", "apple-mac-mini-m4"),
    "macminim4p":   ("apple-mac-mini", "apple-mac-mini-m4-pro"),
    "macstudiom2m": ("apple-mac-studio", "apple-mac-studio-m2-max"),
    "macstudiom2u": ("apple-mac-studio", "apple-mac-studio-m2-ultra"),
    "macstudiom4m": ("apple-mac-studio", "apple-mac-studio-m4-max"),
    "macstudiom4u": ("apple-mac-studio", "apple-mac-studio-m4-ultra"),
    "macprom2u":    ("apple-mac-pro", "apple-mac-pro-m2-ultra"),
}

# Phones default to apple-phone for ip*, otherwise specific series above.
PHONE_SERIES_DEFAULTS = {
    "ip": "apple-phone",
    "gs": "galaxy-s-series",  # overridden in IWM_URLS for foldables/notes
    "px": "google-phone",
}


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return None
    except Exception:
        return None


def parse_iwm_blob(html):
    """Find largest base64 string > 50KB on the page, decode as JSON."""
    if not html:
        return None
    # base64 strings of meaningful size
    # Find every base64-like literal > 10KB, then pick the one that
    # decodes as a JSON array containing the question tree.
    blobs = re.findall(r"'([A-Za-z0-9+/=]{10000,})'", html) + re.findall(r'"([A-Za-z0-9+/=]{10000,})"', html)
    for b in sorted(blobs, key=len, reverse=True):
        try:
            decoded = base64.b64decode(b).decode("utf-8")
            data = json.loads(decoded)
            if isinstance(data, list) and any(isinstance(e, dict) and "questions" in e for e in data):
                return data
        except Exception:
            continue
    return None


def extract_price_grid(tree):
    """Walk IWM tree and return {storage_id: {condition_id: iwm_dollars}}.

    IWM trees look like:
        [
          {name: 'Conditions',           questions: [{text: 'condition', answers: [...]}]},
          {name: '2. Brand New',         questions: [{text: 'carrier', answers}, {text: 'storage', answers}]},
          {name: '3. Flawless/Good/Fair',questions: [..., 'accessories']},
          {name: '4. Broken',            questions: [..., 'fully operational?']}
        ]

    Total for a (condition, storage, unlocked) cell:
      condition_base + storage_delta_for_that_tier + carrier_delta(unlocked=$0)

    For devices without a storage question (watches, consoles), storage_id
    defaults to "base". Carrier defaults to the unlocked / Wi-Fi option.
    All other secondary questions (material/size/accessories) default to
    the answer with value_current == 0 (the "no premium" choice).
    """
    if not isinstance(tree, list):
        return {}

    # 1) Find the Conditions entry — first entry whose only question is
    # the condition question.
    condition_bases = {}  # {condition_id: base $}
    for entry in tree:
        if not isinstance(entry, dict):
            continue
        for q in entry.get("questions") or []:
            qt = (q.get("text") or "").lower()
            if "condition" in qt or "shape" in qt:
                for a in q.get("answers") or []:
                    cid = _normalize_condition(a.get("text", ""))
                    if cid is None: continue
                    val = a.get("value_current") or 0
                    condition_bases[cid] = max(condition_bases.get(cid, 0), int(val))
                break
        if condition_bases:
            break

    if not condition_bases:
        return {}

    # 2) For each subsequent entry, parse its name → applicable conditions,
    # and extract storage deltas + default carrier delta.
    grids = {}
    for entry in tree:
        if not isinstance(entry, dict): continue
        name = (entry.get("name") or "").lower()
        if "condition" in name:
            continue  # skip the top conditions entry

        # Map entry name → list of condition_ids it applies to
        applicable = []
        for label, cid in [
            ("brand new", "sealed"),
            ("sealed", "sealed"),
            ("flawless", "mint"),
            ("mint", "mint"),
            ("good", "good"),
            ("very good", "verygood"),
            ("fair", "fair"),
            ("poor", "fair"),
            ("broken", "broken"),
            ("cracked", "broken"),
        ]:
            if label in name and cid not in applicable:
                applicable.append(cid)
        if not applicable:
            continue

        # Pull storage answers + default-extras delta
        storages = [{"text": "base", "value_current": 0}]
        extras_delta = 0
        for q in entry.get("questions") or []:
            qt = (q.get("text") or "").lower()
            answers = q.get("answers") or []
            if "storage" in qt or "memory" in qt or "capacity" in qt:
                storages = answers
            elif "carrier" in qt:
                # default to unlocked / Wi-Fi
                for a in answers:
                    at = (a.get("text") or "").lower()
                    if "unlock" in at or "wifi" in at or "wi-fi" in at:
                        extras_delta += int(a.get("value_current") or 0)
                        break
            elif "operational" in qt:
                # Take the "Yes" answer (broken-but-working pricing).
                for a in answers:
                    if (a.get("text") or "").lower().startswith("yes"):
                        extras_delta += int(a.get("value_current") or 0)
                        break
            elif "accessor" in qt or "include" in qt or "box" in qt:
                # Skip accessory adjustments — we don't model them in PRICE_TABLE.
                continue
            else:
                # Default secondary questions (material/size/connectivity):
                # pick the answer with value_current == 0 (no premium).
                for a in answers:
                    if (a.get("value_current") or 0) == 0:
                        break
                # No-op — the $0 answer adds nothing.

        for s in storages:
            s_id = _normalize_storage(s.get("text", ""))
            s_val = int(s.get("value_current") or 0)
            for cid in applicable:
                price = condition_bases[cid] + s_val + extras_delta
                if price <= 0:
                    continue
                grids.setdefault(s_id, {})[cid] = price
    return grids


def _normalize_storage(text):
    t = (text or "").lower().replace(" ", "")
    if "1tb" in t or "1000gb" in t: return "1tb"
    if "2tb" in t: return "2tb"
    if "4tb" in t: return "4tb"
    if "512" in t: return "512"
    if "256" in t: return "256"
    if "128" in t: return "128"
    if "64" in t:  return "64"
    if "32" in t:  return "32"
    if "16" in t and "gb" in t: return "16"
    return "base"


def _normalize_condition(text):
    t = (text or "").lower()
    if "broken" in t or "crack" in t: return "broken"
    if "fair" in t or "heavy" in t or "poor" in t: return "fair"
    if "very good" in t or "excellent" in t or "light" in t: return "verygood"
    if "good" in t: return "good"
    if "mint" in t or "flawless" in t or "pristine" in t: return "mint"
    if "sealed" in t or "new" in t: return "sealed"
    return None


def read_price_table():
    src = (ROOT / "app" / "data" / "prices.ts").read_text()
    # Anchor to the literal declaration line so we don't pick up a comment.
    m = re.search(r"^export const PRICE_TABLE[^=]*=\s*\{", src, re.MULTILINE)
    if not m:
        return None
    i = m.end() - 1  # position of opening brace
    depth = 0
    j = i
    while j < len(src):
        ch = src[j]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    obj = src[i:j+1]
    # Strip line/block comments
    obj = re.sub(r"//[^\n]*", "", obj)
    obj = re.sub(r"/\*.*?\*/", "", obj, flags=re.DOTALL)
    # Quote unquoted keys
    obj_json = re.sub(r"([\{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:", r'\1"\2":', obj)
    # Numeric keys ("128", "256") — already quoted in source, leave alone
    # Remove trailing commas
    obj_json = re.sub(r",(\s*[}\]])", r"\1", obj_json)
    try:
        return json.loads(obj_json)
    except json.JSONDecodeError as e:
        print(f"JSON decode failed: {e}", file=sys.stderr)
        # Dump the offending region for debug
        snippet = obj_json[max(0, e.pos - 80): e.pos + 80]
        print(f"  near pos {e.pos}: ...{snippet}...", file=sys.stderr)
        return None


def url_for(mid):
    spec = IWM_URLS.get(mid)
    if spec is None:
        return None
    if isinstance(spec, tuple):
        series, slug = spec
    elif mid.startswith(("ip", "gs", "px")) and isinstance(spec, str):
        # phone shorthand
        prefix = mid[:2]
        if prefix == "ip":
            series = "apple-phone"
        elif prefix == "gs":
            series = "galaxy-s-series"
        elif prefix == "px":
            series = "google-phone"
        else:
            return None
        slug = spec
    else:
        return None
    return f"https://www.itsworthmore.com/sell/{series}/{slug}"


def main():
    print("Reading PRICE_TABLE...", file=sys.stderr)
    pt = read_price_table()
    if not pt:
        print("FATAL: couldn't parse PRICE_TABLE", file=sys.stderr)
        sys.exit(1)
    models = list(pt.keys())
    print(f"  {len(models)} models in PRICE_TABLE", file=sys.stderr)

    audit = {"models": {}, "skipped": [], "errors": []}
    for i, mid in enumerate(models, 1):
        url = url_for(mid)
        if not url:
            audit["skipped"].append(mid)
            continue
        print(f"[{i}/{len(models)}]  {mid:20s}  {url}", file=sys.stderr)
        html = fetch_html(url)
        if not html:
            audit["errors"].append({"model": mid, "url": url, "error": "fetch failed"})
            continue
        tree = parse_iwm_blob(html)
        if not tree:
            audit["errors"].append({"model": mid, "url": url, "error": "no IWM blob"})
            continue
        iwm_grid = extract_price_grid(tree)
        if not iwm_grid:
            audit["errors"].append({"model": mid, "url": url, "error": "empty grid"})
            continue
        audit["models"][mid] = {"url": url, "iwm": iwm_grid, "ours": pt[mid]}
        time.sleep(0.3)  # be gentle on IWM

    out = ROOT / "iwm-audit-raw.json"
    out.write_text(json.dumps(audit, indent=2))
    print(f"\nWrote {out}  — {len(audit['models'])} models scraped, {len(audit['skipped'])} skipped, {len(audit['errors'])} errors", file=sys.stderr)


if __name__ == "__main__":
    main()
