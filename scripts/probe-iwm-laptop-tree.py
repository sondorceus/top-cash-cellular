#!/usr/bin/env python3
"""Probe IWM's embedded pricingData tree for a PC laptop.

scrape-fast.py handles phones (condition × carrier × storage). PC laptops
add chip and RAM dimensions. Goal: see the raw tree so I can extend the
walker to capture chip_adj / ram_adj / storage_adj / condition_adj per
model — matching the macbook-iwm-adjustments.json shape.
"""
import json, sys
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

URLS = [
    "https://www.itsworthmore.com/sell/lenovo-thinkpad-x1-series/lenovo-thinkpad-x1-carbon",
    "https://www.itsworthmore.com/sell/hp-elitebook/hp-elitebook-g11",
    "https://www.itsworthmore.com/sell/xps-laptop/xps-15-9530",
]

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA)
        pg = ctx.new_page()
        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            try: pg.click('button:has-text("Accept")', timeout=2000)
            except: pass
        except: pass

        for url in URLS:
            print(f"\n=== {url} ===")
            try:
                pg.goto(url, wait_until="networkidle", timeout=30000)
            except Exception as e:
                print(f"  goto failed: {e}")
                continue
            pg.wait_for_timeout(1200)
            data = pg.evaluate("""() => {
                try {
                    const el = document.querySelector("[ng-controller='product-pricing-ctrl']")
                        || document.querySelector("section[ng-controller]");
                    if (!el) return null;
                    const scope = angular.element(el).scope();
                    return {
                        name: scope.productName || '',
                        pricing: scope.pricingData || null,
                    };
                } catch(e) { return {error: e.message}; }
            }""")
            if not data or not data.get("pricing"):
                print("  no pricingData")
                continue
            tree = data["pricing"]
            print(f"  Name: {data.get('name')}")
            print(f"  Tree branches: {len(tree)}")
            for i, br in enumerate(tree):
                qs = br.get("questions", [])
                for q in qs:
                    qtxt = q.get("text", "")[:60]
                    n = len(q.get("answers", []))
                    print(f"    [branch {i}] {qtxt!r} ({n} answers)")
                    for a in q.get("answers", [])[:6]:
                        at = a.get("text", "")[:40]
                        av = a.get("value", "")
                        gt = a.get("go_to", "")
                        attrs = ", ".join(f"{x['key']}={x['value']}" for x in a.get("attributes", []))
                        print(f"      - {at!r:<40} val={av!r:<8} go_to={gt!r:<8} {attrs}")
        b.close()

if __name__ == "__main__":
    main()
