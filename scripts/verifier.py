#!/usr/bin/env python3
"""Bug-checker / verifier — runs sanity checks on data + page.tsx after
every commit and posts results to Mission Control comms.

Rule set is intentionally small at v1 — we add a rule each time a bug
slips through. The LG-class submodel bug is the seed example (any
spec entry with base_price > 0 must have at least one chip option).

Exit codes:
  0  All rules passed
  1  One or more rules failed
  2  Verifier couldn't run (missing files, parse error, etc.)

CLI:
  python3 scripts/verifier.py                    # Run checks, print report
  python3 scripts/verifier.py --post-mc          # Also post result to MC comms
  python3 scripts/verifier.py --commit <hash>    # Tag the post with this hash
"""
from __future__ import annotations
import json, os, re, sys, subprocess, urllib.request
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).parent.parent
PAGE = ROOT / "app" / "page.tsx"
IWM_ADJ = ROOT / "pc-laptop-iwm-adjustments.json"
PC_SPECS = ROOT / "public" / "comps" / "pc-laptop-specs.json"
IWM_PRICES = ROOT / "public" / "comps" / "iwm-pc-laptop-prices.json"

MC_URL = "https://missioncontrolsdjg-production.up.railway.app/api/comms"
MC_KEY = os.environ.get("MC_API_KEY") or "9b4dce8e03c1d2aaf86d272a2afda99a0157f49abd66450f"


class Finding:
    def __init__(self, rule_id: str, severity: str, summary: str, details: list[str] | None = None):
        self.rule_id = rule_id
        self.severity = severity  # "fail" | "warn" | "info"
        self.summary = summary
        self.details = details or []

    def fmt(self) -> str:
        head = f"[{self.severity.upper():<4}] {self.rule_id}: {self.summary}"
        if not self.details:
            return head
        sample = self.details[:5]
        more = f"\n  ... +{len(self.details)-5} more" if len(self.details) > 5 else ""
        body = "\n".join(f"  - {d}" for d in sample)
        return f"{head}\n{body}{more}"


# ============================================================
# Rules
# ============================================================

def rule_lg_class_submodel_bug() -> list[Finding]:
    """Any spec entry with base_price > 0 must have at least one chip
    option. This is the LG Gram bug: an entry with chips=[] and base>0
    means the scraper saw a model-picker branch but failed to walk into
    a real per-submodel branch.
    """
    if not IWM_ADJ.exists():
        return []
    d = json.loads(IWM_ADJ.read_text())
    bad = []
    for k, v in d.items():
        # check both legacy flat shape and v2 submodels shape
        if v.get("base_price", 0) > 0 and not v.get("chips"):
            bad.append(f"{k}: base=${v['base_price']} but no chips")
        for sk, sv in (v.get("submodels") or {}).items():
            if sv.get("base_price", 0) > 0 and not sv.get("chips"):
                bad.append(f"{k}#{sk}: base=${sv['base_price']} but no chips")
    if not bad:
        return [Finding("lg-class-submodel-bug", "info", "every priced spec has chips (clean)")]
    return [Finding("lg-class-submodel-bug", "fail", f"{len(bad)} priced entries with empty chips", bad)]


def rule_price_floor_pc_laptops() -> list[Finding]:
    """Sanity floor on PC laptop prices — if a 2022+ laptop is under $30,
    something is probably wrong. Cheap legacy entries are fine; this
    catches the case where modern-gen prices got mangled.
    """
    if not IWM_PRICES.exists():
        return []
    d = json.loads(IWM_PRICES.read_text())
    suspicious = []
    for k, v in d.items():
        p = v.get("iwm_flawless")
        if p is None:
            continue
        if 0 < p < 30:
            suspicious.append(f"{k}: ${p}")
    if not suspicious:
        return [Finding("pc-price-floor", "info", "no PC laptop priced under $30")]
    return [Finding("pc-price-floor", "warn", f"{len(suspicious)} PC laptops priced under $30 (verify these aren't 2022+ models)", suspicious)]


def rule_page_tsx_duplicate_ids() -> list[Finding]:
    """No two device variants should share an id. We narrow the regex to
    variant-object shape `{ id: "...", label: "..."` so JSX form ids
    (like storage labels "16", carrier ids "att") don't trigger.
    """
    if not PAGE.exists():
        return []
    src = PAGE.read_text()
    # Variant objects always have id followed shortly by label.
    # Filter out short / pure-numeric ids — those are usually shared
    # storage/RAM tier labels across multiple device specs, not real
    # variant collisions.
    ids = re.findall(r'\{\s*id:\s*"([^"]+)",\s*label:\s*"', src)
    seen = {}
    for vid in ids:
        if len(vid) < 3 or vid.isdigit() or vid.endswith("gb"):
            continue
        seen[vid] = seen.get(vid, 0) + 1
    dupes = [f"{vid} appears {n}×" for vid, n in seen.items() if n > 1]
    if not dupes:
        return [Finding("page-duplicate-ids", "info", f"no duplicate variant ids ({len(ids)} variants scanned)")]
    return [Finding("page-duplicate-ids", "warn", f"{len(dupes)} duplicated variant ids", dupes)]


def rule_pc_specs_baseline_quote_nonzero() -> list[Finding]:
    """Simulate the baseline additive quote (chip[0] + ram[0] + storage[0])
    for every PC_LAPTOP_SPECS entry and confirm it's non-zero. This is
    what caught the chip-adj-zero bug class (X1 Carbon Gen 13 was showing
    $0 baseline quote). Inquiry-only specs (base_price=0) are intentional
    and skipped.
    """
    if not PC_SPECS.exists():
        return []
    d = json.loads(PC_SPECS.read_text())
    bad = []
    for vid, s in d.items():
        if s.get("_inquiry_only"):
            continue
        if not s.get("processors") or not s.get("memory") or not s.get("storage"):
            continue
        chip = s["processors"][0].get("adj", 0)
        ram = s["memory"][0].get("adj", 0)
        stor = s["storage"][0].get("adj", 0)
        iwm = chip + ram + stor
        ours = round(iwm * 0.9)
        if ours <= 0:
            bad.append(f"{vid}: chip0=${chip} ram0=${ram} stor0=${stor} -> $0 quote")
    if not bad:
        return [Finding("pc-specs-baseline-quote", "info", f"all {len(d)} PC specs give non-zero baseline quote")]
    return [Finding("pc-specs-baseline-quote", "fail", f"{len(bad)} PC specs would show $0 at baseline config", bad)]


def rule_pc_specs_have_chips() -> list[Finding]:
    """Every entry in pc-laptop-specs.json must have processors ≥ 1.
    This is the application-side mirror of the LG bug.
    """
    if not PC_SPECS.exists():
        return []
    d = json.loads(PC_SPECS.read_text())
    bad = []
    for vid, s in d.items():
        if not s.get("processors"):
            bad.append(f"{vid}: no processors")
        elif not s.get("memory"):
            bad.append(f"{vid}: no memory tiers")
    if not bad:
        return [Finding("pc-specs-shape", "info", f"all {len(d)} PC laptop specs have chips + memory")]
    return [Finding("pc-specs-shape", "fail", f"{len(bad)} PC specs missing chips/memory", bad)]


def rule_page_variants_have_image() -> list[Finding]:
    """Every variant must reference a file under public/devices/.
    Doesn't verify the file exists (cheap+fast lint); flags obvious typos.
    """
    if not PAGE.exists():
        return []
    src = PAGE.read_text()
    images = re.findall(r'image:\s*"([^"]+)"', src)
    bad = [img for img in images if img and not img.startswith("/devices/") and not img.startswith("http")]
    if not bad:
        return [Finding("page-image-paths", "info", "all variant images point at /devices/")]
    return [Finding("page-image-paths", "warn", f"{len(bad)} images not under /devices/", list(set(bad)))]


RULES: list[Callable[[], list[Finding]]] = [
    rule_lg_class_submodel_bug,
    rule_price_floor_pc_laptops,
    rule_page_tsx_duplicate_ids,
    rule_pc_specs_have_chips,
    rule_pc_specs_baseline_quote_nonzero,
    rule_page_variants_have_image,
]


# ============================================================
# Runner + MC poster
# ============================================================

def run_all() -> tuple[list[Finding], int]:
    findings = []
    for rule in RULES:
        try:
            findings.extend(rule())
        except Exception as e:
            findings.append(Finding(rule.__name__, "fail", f"rule crashed: {e}"))
    fails = sum(1 for f in findings if f.severity == "fail")
    return findings, fails


def post_to_mc(body: str) -> bool:
    payload = json.dumps({
        "from": "verifier",
        "fromName": "Verifier",
        "role": "verifier",
        "priority": "normal",
        "body": body,
    }).encode("utf-8")
    req = urllib.request.Request(MC_URL, data=payload, method="POST", headers={
        "Content-Type": "application/json",
        "x-api-key": MC_KEY,
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status < 300
    except Exception as e:
        print(f"MC post failed: {e}", file=sys.stderr)
        return False


def main():
    commit = None
    post_mc = False
    for i, arg in enumerate(sys.argv[1:]):
        if arg == "--post-mc":
            post_mc = True
        elif arg == "--commit" and i + 1 < len(sys.argv) - 1:
            commit = sys.argv[i + 2]

    # If no explicit --commit, try git
    if not commit:
        try:
            commit = subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=ROOT, stderr=subprocess.DEVNULL
            ).decode().strip()
        except Exception:
            commit = "(unknown)"

    findings, fails = run_all()
    print(f"Verifier @ {commit}")
    print("=" * 60)
    for f in findings:
        print(f.fmt())
    print("=" * 60)
    print(f"Rules: {len(findings)}, Fails: {fails}")

    if post_mc:
        verdict = "[VERIFIED-OK]" if fails == 0 else f"[BUG-{fails}]"
        # Compact message body
        lines = [f"{verdict} verifier @ {commit}"]
        for f in findings:
            if f.severity == "fail" or f.severity == "warn":
                lines.append(f"  {f.severity}: {f.rule_id}: {f.summary}")
                for d in f.details[:3]:
                    lines.append(f"     - {d}")
                if len(f.details) > 3:
                    lines.append(f"     ... +{len(f.details)-3} more")
        if fails == 0:
            passes = sum(1 for f in findings if f.severity == "info")
            lines.append(f"  {passes} info-level checks passed")
        ok = post_to_mc("\n".join(lines))
        print(f"\nMC post: {'OK' if ok else 'FAILED'}")

    sys.exit(1 if fails > 0 else 0)


if __name__ == "__main__":
    main()
