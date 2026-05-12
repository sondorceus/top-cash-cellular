#!/usr/bin/env python3
"""Walk through IWM's Angular quiz on each Samsung product page and pull
the final 'best case' price (Flawless / Unlocked / max storage).

Strategy:
 1. Visit /sell/<series-slug>/<model-slug>
 2. For each step, look at the .answers wrapper's class (which encodes
    the active question, e.g. 'v2-condition-question', '*-carrier-*',
    '*-storage-*', etc.). Click the preferred answer via JS:
       condition -> Flawless
       any carrier-locked question -> No / Unlocked
       any storage question -> the highest tier (last child)
       anything else -> last child
 3. After each click, wait for Angular to swap the question. Repeat up
    to ~8 steps.
 4. When the .answers wrapper disappears or stops changing, grab the
    largest plausible dollar amount on the page.
"""
import sys
import re
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

TARGETS = [
    # (series-slug, model-slug, our-model-id)
    ("galaxy-z-fold-series", "galaxy-z-trifold",   "gztrifold"),
    ("galaxy-z-fold-series", "galaxy-z-fold-7",    "gzfold7"),
    ("galaxy-z-fold-series", "galaxy-z-fold-6",    "gzfold6"),
    ("galaxy-z-fold-series", "galaxy-z-fold-5",    "gzfold5"),
    ("galaxy-z-fold-series", "galaxy-z-fold-4",    "gzfold4"),
    ("galaxy-z-fold-series", "galaxy-z-fold-3-5g", "gzfold3"),
    ("galaxy-z-fold-series", "galaxy-z-flip-7",    "gzflip7"),
    ("galaxy-z-fold-series", "galaxy-z-flip-6",    "gzflip6"),
    ("galaxy-z-fold-series", "galaxy-z-flip5",     "gzflip5"),
    ("galaxy-z-fold-series", "galaxy-z-flip4",     "gzflip4"),
    ("galaxy-z-fold-series", "galaxy-z-flip3-5g",  "gzflip3"),
    # IWM dropped the '-5g' suffix on S23 and newer (verified 2026-05-12).
    # S22 and older keep '-5g' in the URL.
    ("galaxy-s-series", "galaxy-s26-ultra",        "gs26u"),
    ("galaxy-s-series", "galaxy-s26-plus",         "gs26p"),
    ("galaxy-s-series", "galaxy-s26",              "gs26"),
    ("galaxy-s-series", "galaxy-s25-edge",         "gs25edge"),
    ("galaxy-s-series", "galaxy-s25-ultra",        "gs25u"),
    ("galaxy-s-series", "galaxy-s25-plus",         "gs25p"),
    ("galaxy-s-series", "galaxy-s25",              "gs25"),
    ("galaxy-s-series", "galaxy-s25-fe",           "gs25fe"),
    ("galaxy-s-series", "galaxy-s24-ultra",        "gs24u"),
    ("galaxy-s-series", "galaxy-s24-plus",         "gs24p"),
    ("galaxy-s-series", "galaxy-s24",              "gs24"),
    ("galaxy-s-series", "galaxy-s24-fe",           "gs24fe"),
    ("galaxy-s-series", "galaxy-s23-ultra",        "gs23u"),
    ("galaxy-s-series", "galaxy-s23-plus",         "gs23p"),
    ("galaxy-s-series", "galaxy-s23",              "gs23"),
    ("galaxy-s-series", "galaxy-s23-fe",           "gs23fe"),
    ("galaxy-s-series", "galaxy-s22-ultra-5g",     "gs22u"),
    ("galaxy-s-series", "galaxy-s22-plus-5g",      "gs22p"),
    ("galaxy-s-series", "galaxy-s22-5g",           "gs22"),
    ("galaxy-s-series", "galaxy-s21-ultra-5g",     "gs21u"),
    ("galaxy-s-series", "galaxy-s21-plus-5g",      "gs21p"),
    ("galaxy-s-series", "galaxy-s21-5g",           "gs21"),
    ("galaxy-s-series", "galaxy-s21-fe-5g",        "gs21fe"),
    ("galaxy-s-series", "galaxy-s20-ultra-5g",     "gs20u"),
    ("galaxy-s-series", "galaxy-s20-plus-5g",      "gs20p"),
    ("galaxy-s-series", "galaxy-s20-5g",           "gs20"),
    ("galaxy-s-series", "galaxy-s20-fe-5g",        "gs20fe"),
    # Note series under /sell/galaxy-note-series/
    ("galaxy-note-series", "galaxy-note-20-ultra-5g", "gnote20u"),
    ("galaxy-note-series", "galaxy-note-20-5g",       "gnote20"),
    ("galaxy-note-series", "galaxy-note-10-plus-5g",  "gnote10p5g"),
    ("galaxy-note-series", "galaxy-note-10-plus",     "gnote10p"),
    ("galaxy-note-series", "galaxy-note-10",          "gnote10"),
    ("galaxy-note-series", "galaxy-note-9",           "gnote9"),
]

DOLLAR = re.compile(r"\$\s*([0-9]+(?:,[0-9]{3})*)(?!\d)")

CLICK_JS = """([prefList]) => {
    const wrap = Array.from(document.querySelectorAll('.answers')).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.children.length > 0;
    });
    if (!wrap) return { ok: false, reason: 'no visible .answers' };
    const cls = wrap.className || '';
    // Only consider answers that are NOT ng-hide (already selected
    // ones get hidden by Angular but stay in the DOM).
    const kids = Array.from(wrap.children).filter(c => {
        if (c.classList.contains('ng-hide')) return false;
        const txt = (c.innerText || '').trim();
        return txt && c.getAttribute('ng-click');
    });
    if (!kids.length) return { ok: false, reason: 'no visible kid answers' };
    let chosen = null;
    for (const pref of prefList) {
        chosen = kids.find(k => (k.innerText || '').toLowerCase().includes(pref.toLowerCase()));
        if (chosen) break;
    }
    if (!chosen) chosen = kids[kids.length - 1];
    chosen.click();
    return { ok: true, clicked: (chosen.innerText || '').slice(0, 40), cls: cls };
}"""

NEXT_JS = """() => {
    const next = Array.from(document.querySelectorAll('button')).find(b => {
        const t = (b.innerText || '').trim().toLowerCase();
        const r = b.getBoundingClientRect();
        return (t === 'next step' || t === 'next' || t === 'continue') && r.width > 0 && r.height > 0;
    });
    if (!next) return false;
    next.click();
    return true;
}"""


def grab_price(pg):
    # PREFERRED: read the visible 'Your Offer' element directly. IWM renders
    # the final value inside h3.your-offer > strong. Pulling it from there
    # avoids harvesting hidden disclaimer text — earlier versions grabbed a
    # '$200 deduction' line buried in an ng-hide modal which masked every
    # price below $200 (see scripts/debug-iwm/ run on 2026-05-12).
    direct = pg.evaluate(
        """() => {
            const candidates = [
                'section#product-pricing-ctrl h3.your-offer strong',
                'h3.your-offer strong',
                '.pricing-form-final-offer .your-offer strong',
                '.your-offer strong',
            ];
            for (const sel of candidates) {
                const el = document.querySelector(sel);
                if (!el) continue;
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                const t = (el.innerText || '').trim();
                if (t) return t;
            }
            return '';
        }"""
    )
    if direct:
        m = DOLLAR.search(direct)
        if m:
            try:
                v = int(m.group(1).replace(",", ""))
                if 20 <= v <= 5000:
                    return v
            except Exception:
                pass
    # FALLBACK: filtered DOM walk that respects display:none / visibility:hidden
    # and ng-hide ancestors. Skips the coupon banner as before.
    text = pg.evaluate(
        """() => {
            const banner = document.querySelector('.banner-coupon-v2, .banner-coupon, .banner-coupon-desktop');
            const ignore = new Set(['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER']);
            const hiddenAncestor = (el) => {
                let cur = el && el.parentElement;
                while (cur) {
                    if (cur.classList && (cur.classList.contains('ng-hide') || cur.classList.contains('reveal-modal'))) return true;
                    const cs = window.getComputedStyle(cur);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
                    cur = cur.parentElement;
                }
                return false;
            };
            let out = '';
            const walk = (el) => {
                if (!el) return;
                if (ignore.has(el.tagName)) return;
                if (banner && (banner === el || banner.contains(el))) return;
                if (el.nodeType === 3) {
                    if (!hiddenAncestor(el)) out += el.textContent || '';
                    return;
                }
                if (el.nodeType === 1) {
                    if (el.classList && (el.classList.contains('ng-hide') || el.classList.contains('reveal-modal'))) return;
                    const cs = window.getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return;
                }
                for (const c of el.childNodes) walk(c);
            };
            walk(document.body);
            return out;
        }"""
    )
    matches = DOLLAR.findall(text)
    vals = [int(m.replace(",", "")) for m in matches]
    vals = [v for v in vals if 30 <= v <= 4000]
    if not vals:
        return None
    return max(vals)


def step(pg, prefs):
    res = pg.evaluate(CLICK_JS, [prefs])
    pg.wait_for_timeout(400)
    # Push the quiz forward.
    advanced = pg.evaluate(NEXT_JS)
    pg.wait_for_timeout(1200 if advanced else 600)
    res["advanced"] = advanced
    return res


def walk(pg, series, model, condition="Flawless", carrier="Unlocked", verbose=False):
    """Walk IWM quiz for a specific condition + carrier combo.
    condition: Flawless | Good | Fair
    carrier: Unlocked | AT&T | T-Mobile | Verizon | Sprint
    """
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except Exception as e:
        return None, f"goto fail: {e}"
    pg.wait_for_timeout(1500)

    # Build preference list based on condition + carrier
    # The quiz asks questions in varying order — condition, carrier, storage, etc.
    # We match by keyword: if the question is about condition, pick our condition.
    # If about carrier, pick our carrier. Storage always picks highest.
    carrier_prefs = ["Unlocked", "No"] if carrier == "Unlocked" else [carrier]

    for i in range(10):
        visible = pg.evaluate(
            "() => Array.from(document.querySelectorAll('.answers')).some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })"
        )
        if not visible:
            if verbose: print(f"    step {i+1}: no .answers visible, breaking")
            break

        # Detect question type from wrapper class
        qtype = pg.evaluate(
            """() => {
                const wrap = Array.from(document.querySelectorAll('.answers')).find(el => {
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                });
                return wrap ? wrap.className : '';
            }"""
        )

        # Pick preferences based on question type
        if "condition" in qtype.lower():
            prefs = [condition]
        elif "carrier" in qtype.lower() or "lock" in qtype.lower():
            prefs = carrier_prefs
        else:
            # Storage or other — pick highest (last child handled by CLICK_JS default)
            prefs = [condition] + carrier_prefs

        res = step(pg, prefs)
        if verbose: print(f"    step {i+1}: cls={res.get('cls','?')} clicked={res.get('clicked','?')} (q={qtype[:30]})")

    pg.wait_for_timeout(1200)
    return grab_price(pg), None


# Condition/carrier combos to scrape
CONDITIONS = ["Flawless", "Good", "Fair"]
CARRIERS = ["Unlocked", "AT&T"]  # AT&T as proxy for "locked" pricing
DISCOUNT = 20  # subtract from IWM price


def main():
    results = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA)
        pg = ctx.new_page()
        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            pg.click('button:has-text("Accept")', timeout=3000)
        except Exception:
            pass

        # Diagnostic mode
        if len(sys.argv) > 1 and sys.argv[1] == "debug":
            target = sys.argv[2] if len(sys.argv) > 2 else "galaxy-z-flip-7"
            series = "galaxy-z-fold-series" if "fold" in target or "flip" in target or "trifold" in target else "galaxy-s-series"
            print(f"=== DEBUG: {target} ===")
            for cond in CONDITIONS:
                for carr in CARRIERS:
                    price, err = walk(pg, series, target, condition=cond, carrier=carr, verbose=True)
                    our_price = max(0, price - DISCOUNT) if price else None
                    print(f"  {cond:10} {carr:10} IWM=${price}  ours=${our_price}  (err={err})")
            return 0

        # Full scrape: all models x conditions x carriers
        print(f"Scraping {len(TARGETS)} models x {len(CONDITIONS)} conditions x {len(CARRIERS)} carriers")
        print(f"Discount: -${DISCOUNT} from IWM\n")

        for series, model, mid in TARGETS:
            model_prices = {"id": mid, "model": model, "prices": {}}
            for cond in CONDITIONS:
                for carr in CARRIERS:
                    label = f"{carr.lower()}"
                    try:
                        price, err = walk(pg, series, model, condition=cond, carrier=carr)
                    except Exception as e:
                        price, err = None, str(e)

                    if price:
                        our_price = max(0, price - DISCOUNT)
                        key = f"{cond.lower()}_{label}"
                        model_prices["prices"][key] = {"iwm": price, "ours": our_price}
                        print(f"  OK {mid:10} {cond:10} {carr:10} IWM=${price:4d} ours=${our_price:4d}")
                    else:
                        print(f"  -- {mid:10} {cond:10} {carr:10} {err or 'no price'}")

            results.append(model_prices)

        b.close()

    # Summary
    print(f"\n{'='*60}")
    print(f"RESULTS: {len(results)} models scraped")
    print(f"{'='*60}")
    for r in results:
        prices = r["prices"]
        if prices:
            fl_unlocked = prices.get("flawless_unlocked", {}).get("ours", "?")
            fl_locked = prices.get("flawless_at&t", {}).get("ours", "?")
            good_unlocked = prices.get("good_unlocked", {}).get("ours", "?")
            print(f"  {r['id']:10} Flawless: unlocked=${fl_unlocked} locked=${fl_locked}  Good: unlocked=${good_unlocked}")

    # Output JSON for easy import
    import json
    with open("samsung-prices.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved to samsung-prices.json")


if __name__ == "__main__":
    sys.exit(main() or 0)
