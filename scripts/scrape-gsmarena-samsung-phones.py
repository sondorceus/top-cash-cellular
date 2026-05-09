#!/usr/bin/env python3
"""Re-scrape Galaxy S-series phone images from GSMArena.

The IWM 800x800 product shots crop the top (camera bump area) and bottom
(chin) off the phone, so the variants list looks "cut off". GSMArena's
/vv/bigpic/ images show the entire phone (back+front composite) on a clean
white background with margin. They're small (~160x212) but plenty for a
40x40 thumbnail.

For each phone, this script searches GSMArena for the phone name, picks
the matching spec page, extracts the bigpic URL, and downloads it to
public/devices/<id>.jpg. Existing files are backed up to _old/ first.
"""
import os
import re
import sys
import shutil
import time
import urllib.request
import urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

# (id, search query, expected phone-name match phrase) for each of 27 S-series
PHONES = [
    ("gs26u",   "samsung galaxy s26 ultra",  "Samsung Galaxy S26 Ultra"),
    ("gs26p",   "samsung galaxy s26+",       "Samsung Galaxy S26+"),
    ("gs26",    "samsung galaxy s26",        "Samsung Galaxy S26"),
    ("gs25u",   "samsung galaxy s25 ultra",  "Samsung Galaxy S25 Ultra"),
    ("gs25p",   "samsung galaxy s25+",       "Samsung Galaxy S25+"),
    ("gs25edge","samsung galaxy s25 edge",   "Samsung Galaxy S25 Edge"),
    ("gs25fe",  "samsung galaxy s25 fe",     "Samsung Galaxy S25 FE"),
    ("gs25",    "samsung galaxy s25",        "Samsung Galaxy S25"),
    ("gs24u",   "samsung galaxy s24 ultra",  "Samsung Galaxy S24 Ultra"),
    ("gs24p",   "samsung galaxy s24+",       "Samsung Galaxy S24+"),
    ("gs24fe",  "samsung galaxy s24 fe",     "Samsung Galaxy S24 FE"),
    ("gs24",    "samsung galaxy s24",        "Samsung Galaxy S24"),
    ("gs23u",   "samsung galaxy s23 ultra",  "Samsung Galaxy S23 Ultra"),
    ("gs23p",   "samsung galaxy s23+",       "Samsung Galaxy S23+"),
    ("gs23fe",  "samsung galaxy s23 fe",     "Samsung Galaxy S23 FE"),
    ("gs23",    "samsung galaxy s23",        "Samsung Galaxy S23"),
    ("gs22u",   "samsung galaxy s22 ultra",  "Samsung Galaxy S22 Ultra"),
    ("gs22p",   "samsung galaxy s22+",       "Samsung Galaxy S22+"),
    ("gs22",    "samsung galaxy s22",        "Samsung Galaxy S22"),
    ("gs21u",   "samsung galaxy s21 ultra",  "Samsung Galaxy S21 Ultra"),
    ("gs21p",   "samsung galaxy s21+",       "Samsung Galaxy S21+"),
    ("gs21fe",  "samsung galaxy s21 fe",     "Samsung Galaxy S21 FE"),
    ("gs21",    "samsung galaxy s21",        "Samsung Galaxy S21"),
    ("gs20u",   "samsung galaxy s20 ultra",  "Samsung Galaxy S20 Ultra"),
    ("gs20p",   "samsung galaxy s20+",       "Samsung Galaxy S20+"),
    ("gs20fe",  "samsung galaxy s20 fe",     "Samsung Galaxy S20 FE"),
    ("gs20",    "samsung galaxy s20",        "Samsung Galaxy S20"),
    # Note series
    ("gnote20u",   "samsung galaxy note 20 ultra 5g",  "Samsung Galaxy Note20 Ultra 5G"),
    ("gnote20",    "samsung galaxy note 20 5g",        "Samsung Galaxy Note20 5G"),
    ("gnote10p5g", "samsung galaxy note 10 plus 5g",   "Samsung Galaxy Note10+ 5G"),
    ("gnote10p",   "samsung galaxy note 10 plus",      "Samsung Galaxy Note10+"),
    ("gnote10",    "samsung galaxy note 10",           "Samsung Galaxy Note10"),
    ("gnote9",     "samsung galaxy note 9",            "Samsung Galaxy Note9"),
    # Z Fold/Flip series
    ("gztrifold",  "samsung galaxy z trifold",         "Samsung Galaxy Z TriFold"),
    ("gzfold7",    "samsung galaxy z fold7",           "Samsung Galaxy Z Fold7"),
    ("gzfold6",    "samsung galaxy z fold6",           "Samsung Galaxy Z Fold6"),
    ("gzfold5",    "samsung galaxy z fold5",           "Samsung Galaxy Z Fold5"),
    ("gzfold4",    "samsung galaxy z fold4",           "Samsung Galaxy Z Fold4"),
    ("gzfold3",    "samsung galaxy z fold3 5g",        "Samsung Galaxy Z Fold3 5G"),
    ("gzflip7",    "samsung galaxy z flip7",           "Samsung Galaxy Z Flip7"),
    ("gzflip6",    "samsung galaxy z flip6",           "Samsung Galaxy Z Flip6"),
    ("gzflip5",    "samsung galaxy z flip5",           "Samsung Galaxy Z Flip5"),
    ("gzflip4",    "samsung galaxy z flip4",           "Samsung Galaxy Z Flip4"),
    ("gzflip3",    "samsung galaxy z flip3 5g",        "Samsung Galaxy Z Flip3 5G"),
]

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
OUT_DIR = os.path.join(ROOT, "public", "devices")
BACKUP_DIR = os.path.join(OUT_DIR, "_old")

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()

# Search results page: <a href="samsung_galaxy_s25_ultra-13322.php"><img src=https://...bigpic...jpg title="Samsung Galaxy S25 Ultra ...">
SEARCH_LINK = re.compile(
    r'<a href="(samsung_galaxy[^"]+\.php)">'
    r'<img src=(https://fdn\d?\.gsmarena\.com/vv/bigpic/[^\s>]+\.jpg)'
    r' title="([^"]+)"',
)

def find_bigpic(query: str, expected: str) -> str | None:
    """Search GSMArena and return the bigpic URL for the best matching phone."""
    url = f"https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName={urllib.parse.quote_plus(query)}"
    try:
        html = fetch(url).decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"  ! search fetch failed for {query}: {e}")
        return None
    matches = SEARCH_LINK.findall(html)
    # title prefix is the phone model name, possibly with " 5G" suffix
    target = expected.lower().strip()
    for _href, bigpic, title in matches:
        # title looks like "Samsung Galaxy S25 Ultra Android smartphone. Announced..."
        first_part = title.split(" Android")[0].strip().lower()
        normalised = re.sub(r"\s+5g\s*$", "", first_part)
        if normalised == target:
            return bigpic
    # fallback: model name prefix-match, shortest extra wins
    candidates = []
    for _href, bigpic, title in matches:
        first_part = title.split(" Android")[0].strip().lower()
        normalised = re.sub(r"\s+5g\s*$", "", first_part)
        if normalised.startswith(target):
            candidates.append((len(normalised) - len(target), bigpic, title))
    if candidates:
        candidates.sort()
        return candidates[0][1]
    print(f"  ! no GSMArena match for {expected!r} in {query!r} (got {[m[2].split(' Android')[0] for m in matches[:5]]})")
    return None

def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    summary = {"ok": [], "missed": []}

    for phone_id, query, expected in PHONES:
        bigpic = find_bigpic(query, expected)
        if not bigpic:
            summary["missed"].append(phone_id)
            time.sleep(0.4)
            continue

        out_path = os.path.join(OUT_DIR, f"{phone_id}.jpg")
        # back up any existing variants under this id
        for ext in (".webp", ".jpg", ".png"):
            existing = os.path.join(OUT_DIR, f"{phone_id}{ext}")
            if os.path.exists(existing) and existing != out_path:
                try:
                    shutil.copy2(existing, os.path.join(BACKUP_DIR, f"{phone_id}{ext}"))
                except Exception:
                    pass
                # remove non-jpg variants so we don't double-serve
                try:
                    os.remove(existing)
                except Exception:
                    pass
            elif os.path.exists(existing):
                try:
                    shutil.copy2(existing, os.path.join(BACKUP_DIR, f"{phone_id}{ext}"))
                except Exception:
                    pass

        try:
            data = fetch(bigpic)
            with open(out_path, "wb") as f:
                f.write(data)
            summary["ok"].append(phone_id)
            try:
                print(f"  OK {phone_id}: {len(data)/1024:.1f} KB <- {bigpic}")
            except Exception:
                pass
        except Exception as e:
            print(f"  ! download failed for {phone_id}: {e}")
            summary["missed"].append(phone_id)

        time.sleep(0.4)

    print()
    print(f"OK:     {len(summary['ok'])} ({', '.join(summary['ok']) or '-'})")
    print(f"Missed: {len(summary['missed'])} ({', '.join(summary['missed']) or '-'})")
    return 0 if not summary["missed"] else 1

if __name__ == "__main__":
    sys.exit(main())
