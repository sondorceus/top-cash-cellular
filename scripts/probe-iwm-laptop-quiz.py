#!/usr/bin/env python3
"""Probe IWM PC-laptop quiz flows to learn the exact question sequence.

Visits a representative sample across brands and walks the quiz step-by-
step, recording the class name and option list at each step. The goal is
to understand what to ask the user in our spec'd flow (RAM tiers?
storage tiers? battery? charger? screen?) — and which brands diverge.

Run:  python3 scripts/probe-iwm-laptop-quiz.py
Out:  /tmp/iwm-laptop-quiz-probe.json
"""
from __future__ import annotations
import json, sys
from pathlib import Path
HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import importlib.util
spec = importlib.util.spec_from_file_location("iwm", HERE / "fetch-iwm-universal.py")
iwm = importlib.util.module_from_spec(spec); spec.loader.exec_module(iwm)
from playwright.sync_api import sync_playwright

# One representative model per brand/category to probe
TARGETS = [
    ("lenovo-thinkpad-x1-series", "lenovo-thinkpad-x1-carbon"),
    ("lenovo-yoga-laptop", "lenovo-yoga-9i"),
    ("lenovo-legion-laptop", "lenovo-legion-7i-pro"),
    ("hp-elitebook", "hp-elitebook-g11"),
    ("hp-omen-laptop", "hp-omen-17"),
    ("hp-spectre", "hp-spectre-13-x360"),
    ("xps-laptop", "xps-16-9640"),
    ("alienware-m-series-laptop", "alienware-m18"),
    ("republic-of-gamers-laptop", "republic-of-gamers-strix-scar-18-g835"),
    ("samsung-laptop", "galaxy-book5"),
    ("lg-laptop", "lg-gram-pro"),
    ("razer-blade-laptop", "razer-blade-16"),
]

def probe(pg, series, model):
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except Exception as e:
        return {"url": url, "error": str(e)}
    pg.wait_for_timeout(1200)
    steps = []
    for i in range(12):
        opts = iwm.read_quiz_options(pg)
        if not opts:
            break
        step_type = iwm.classify_quiz_step(opts)
        steps.append({"cls": opts["cls"], "type": step_type, "options": opts["options"]})
        # Advance: pick first option (or condition-Flawless etc.)
        prefs = ["Flawless"] if step_type == "condition" else ["__FIRST__"]
        iwm.click_quiz_option(pg, prefs)
        pg.wait_for_timeout(350)
        iwm.click_next(pg)
        pg.wait_for_timeout(700)
    return {"url": url, "steps": steps}

def main():
    out = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=iwm.UA)
        pg = ctx.new_page()
        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            try: pg.click('button:has-text("Accept")', timeout=2000)
            except Exception: pass
        except Exception: pass
        for series, model in TARGETS:
            print(f"Probing {series}/{model} ...")
            r = probe(pg, series, model)
            r["target"] = f"{series}/{model}"
            print(f"  steps: {len(r.get('steps', []))}")
            for s in r.get("steps", []):
                opts_preview = ", ".join(s["options"][:4])
                print(f"    [{s['type']:<10}] {s['cls'][:35]:<35}  -> {opts_preview}")
            out.append(r)
        b.close()
    Path("/tmp/iwm-laptop-quiz-probe.json").write_text(json.dumps(out, indent=2))
    print(f"\nSaved to /tmp/iwm-laptop-quiz-probe.json")

if __name__ == "__main__":
    main()
