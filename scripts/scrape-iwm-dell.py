#!/usr/bin/env python3
"""Extract Dell laptop model names from itsworthmore.com.

Dell's IWM pages use a quiz-style UI where models are .answers divs,
not <a> tags. So we can't follow individual product URLs to scrape
per-model photos like we did for ASUS. Instead we just collect the
model labels under each (series, sub-series) bucket and pair them
with existing series-level placeholder images.

Output: scripts/dell-models.json
"""
import os
import sys
import json
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
OUT_JSON = os.path.join(os.path.dirname(__file__), "dell-models.json")

# Each entry: (series_id, series_label, default_image, [(sub_id, sub_label, leaf_path)])
SERIES = [
    ("xps", "XPS", "/devices/dell-xps.webp", [
        ("xps_13", "XPS 13", "xps-laptop/xps-13-laptop"),
        ("xps_14", "XPS 14", "xps-laptop/xps-14-laptop"),
        ("xps_15", "XPS 15", "xps-laptop/xps-15-laptop"),
        ("xps_16", "XPS 16", "xps-laptop/xps-16-laptop"),
        ("xps_17", "XPS 17", "xps-laptop/xps-17-laptop"),
    ]),
    ("latitude", "Latitude", "/devices/dell-latitude.jpg", [
        ("latitude_3000", "Latitude 3000", "latitude-3000-series-laptop"),
        ("latitude_5000", "Latitude 5000", "latitude-5000-series-laptop"),
        ("latitude_7000", "Latitude 7000", "latitude-7000-series-laptop"),
        ("latitude_9000", "Latitude 9000", "latitude-9000-series-laptop"),
    ]),
    ("inspiron", "Inspiron", "/devices/dell-inspiron-15.webp", [
        ("inspiron_3000", "Inspiron 3000", "inspiron-3000-series-laptop"),
        ("inspiron_5000", "Inspiron 5000", "inspiron-5000-series-laptop"),
        ("inspiron_7000", "Inspiron 7000", "inspiron-7000-series-laptop"),
    ]),
    ("precision", "Precision", "/devices/dell-latitude.jpg", [
        ("precision_3000", "Precision 3000", "precision-3000-series-laptop"),
        ("precision_5000", "Precision 5000", "precision-5000-series-laptop"),
        ("precision_7000", "Precision 7000", "precision-7000-series-laptop"),
    ]),
    ("vostro", "Vostro", "/devices/dell-inspiron-15.webp", [
        ("vostro_3000", "Vostro 3000", "dell-vostro/dell-vostro-3000"),
        ("vostro_5000", "Vostro 5000", "dell-vostro/dell-vostro-5000"),
        ("vostro_7000", "Vostro 7000", "dell-vostro/dell-vostro-7000"),
    ]),
    ("g_series", "G Series", "/devices/dell-xps.webp", [
        ("g3", "G3", "dell-g-series/dell-g-series-g3"),
        ("g5", "G5", "dell-g-series/dell-g-series-g5"),
        ("g7", "G7", "dell-g-series/dell-g-series-g7"),
        ("g15", "G15", "dell-g-series/dell-g-series-g15"),
        ("g16", "G16", "dell-g-series/dell-g-series-g16"),
    ]),
    ("dell_pro", "Dell Pro", "/devices/dell-xps.webp", [
        ("dell_pro_13", "Dell Pro 13", "dell-pro-13-laptop"),
        ("dell_pro_14", "Dell Pro 14", "dell-pro-14-laptop"),
        ("dell_pro_16", "Dell Pro 16", "dell-pro-16-laptop"),
        ("dell_pro_18", "Dell Pro 18", "dell-pro-18-laptop"),
    ]),
    ("rugged", "Rugged", "/devices/dell-latitude.jpg", [
        ("latitude_rugged", "Latitude Rugged", "dell-rugged/latitude-rugged"),
    ]),
]


def main():
    all_models = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        ctx = browser.new_context(ignore_https_errors=True, user_agent=UA)
        page = ctx.new_page()
        # Pre-accept cookies
        page.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
        try:
            page.click('button:has-text("Accept")', timeout=3000)
            page.wait_for_timeout(500)
        except Exception:
            pass

        for series_id, series_label, default_img, sub_leaves in SERIES:
            print(f"\n=== {series_label} ===")
            for sub_id, sub_label, leaf_path in sub_leaves:
                url = f"https://www.itsworthmore.com/sell/{leaf_path}"
                print(f"  [{sub_label}] {url}")
                try:
                    page.goto(url, wait_until="networkidle", timeout=45000)
                    page.wait_for_timeout(800)
                except Exception as e:
                    print(f"    ! {e}")
                    continue
                # Extract model names from .answers descendants (Dell quiz UI)
                # AND from any /sell/<leaf>/<product> anchors (some pages use links)
                leaf_final = leaf_path.split("/")[-1]
                names = page.evaluate(
                    f"""() => {{
                        const out = [];
                        // .answers children — quiz UI
                        const answers = document.querySelectorAll('.answers > *');
                        answers.forEach(a => {{
                            const t = (a.innerText || '').trim().split('\\n')[0].trim();
                            if (t && t.length > 2 && t.length < 80) out.push({{ source: 'answers', text: t }});
                        }});
                        // Anchor-based products
                        const anchors = document.querySelectorAll('a[href]');
                        const re = new RegExp('/sell/{leaf_final}/[a-z0-9-]+$');
                        anchors.forEach(a => {{
                            const h = a.getAttribute('href') || '';
                            if (re.test(h)) {{
                                const t = (a.innerText || a.textContent || '').trim().split('\\n')[0].trim();
                                if (t && t.length > 2 && t.length < 80) out.push({{ source: 'anchor', text: t, slug: h.split('/').pop() }});
                            }}
                        }});
                        return out;
                    }}"""
                )
                # Dedup by name
                seen_names = set()
                unique = []
                for n in names:
                    key = n['text'].lower()
                    if key in seen_names:
                        continue
                    seen_names.add(key)
                    unique.append(n)
                print(f"    found {len(unique)} models")

                for n in unique:
                    label = n['text']
                    # Make a stable id from label
                    slug = (n.get('slug') or label.lower()
                            .replace(' ', '-').replace('/', '-')
                            .replace("'", "").replace('"', ''))
                    import re as _re
                    slug = _re.sub(r'[^a-z0-9-]', '', slug)[:50]
                    all_models.append({
                        "id": f"dell_{sub_id}_{slug}",
                        "series_id": series_id,
                        "series_label": series_label,
                        "sub_id": sub_id,
                        "sub_label": sub_label,
                        "label": label,
                        "image": default_img,
                    })
        browser.close()

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_models, f, indent=2)
    print(f"\nSaved {len(all_models)} models to {OUT_JSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
