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
    ("galaxy-s-series", "galaxy-s25-ultra-5g",     "gs25u"),
    ("galaxy-s-series", "galaxy-s25-plus-5g",      "gs25p"),
    ("galaxy-s-series", "galaxy-s25-5g",           "gs25"),
    ("galaxy-s-series", "galaxy-s24-ultra-5g",     "gs24u"),
    ("galaxy-s-series", "galaxy-s24-plus-5g",      "gs24p"),
    ("galaxy-s-series", "galaxy-s24-5g",           "gs24"),
    ("galaxy-s-series", "galaxy-s23-ultra-5g",     "gs23u"),
    ("galaxy-s-series", "galaxy-s23-plus-5g",      "gs23p"),
    ("galaxy-s-series", "galaxy-s23-5g",           "gs23"),
    ("galaxy-s-series", "galaxy-s22-ultra-5g",     "gs22u"),
    ("galaxy-s-series", "galaxy-s22-plus-5g",      "gs22p"),
    ("galaxy-s-series", "galaxy-s22-5g",           "gs22"),
    ("galaxy-s-series", "galaxy-s21-ultra-5g",     "gs21u"),
    ("galaxy-s-series", "galaxy-s21-plus-5g",      "gs21p"),
    ("galaxy-s-series", "galaxy-s21-5g",           "gs21"),
    ("galaxy-s-series", "galaxy-s20-ultra-5g",     "gs20u"),
    ("galaxy-s-series", "galaxy-s20-plus-5g",      "gs20p"),
    ("galaxy-s-series", "galaxy-s20-5g",           "gs20"),
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
    # Strip the banner-coupon promo so its '$25/$100' numbers don't get
    # treated as the device price. Then grab the largest plausible value.
    text = pg.evaluate(
        """() => {
            const banner = document.querySelector('.banner-coupon-v2, .banner-coupon, .banner-coupon-desktop');
            const ignore = new Set(['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER']);
            let out = '';
            const walk = (el) => {
                if (!el) return;
                if (ignore.has(el.tagName)) return;
                if (banner && (banner === el || banner.contains(el))) return;
                if (el.nodeType === 3) { out += el.textContent || ''; return; }
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


def walk(pg, series, model, verbose=False):
    url = f"https://www.itsworthmore.com/sell/{series}/{model}"
    try:
        pg.goto(url, wait_until="networkidle", timeout=45000)
    except Exception as e:
        return None, f"goto fail: {e}"
    pg.wait_for_timeout(1500)
    # Walk up to 10 steps
    for i in range(10):
        visible = pg.evaluate(
            "() => Array.from(document.querySelectorAll('.answers')).some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })"
        )
        if not visible:
            if verbose: print(f"    step {i+1}: no .answers visible, breaking")
            break
        prefs = ["Flawless", "Unlocked", "No"]
        res = step(pg, prefs)
        if verbose: print(f"    step {i+1}: cls={res.get('cls','?')} clicked={res.get('clicked','?')}")
    pg.wait_for_timeout(1200)
    return grab_price(pg), None


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
        # Diagnostic run on Z Flip 7 only first
        if len(sys.argv) > 1 and sys.argv[1] == "debug":
            print("=== DEBUG: galaxy-z-flip-7 ===")
            price, err = walk(pg, "galaxy-z-fold-series", "galaxy-z-flip-7", verbose=True)
            print(f"\nFinal price: {price} (err={err})")
            return 0
        for series, model, mid in TARGETS:
            try:
                price, err = walk(pg, series, model)
            except Exception as e:
                price, err = None, str(e)
            if price:
                print(f"  OK {mid:10}  {model:32}  ${price}")
                results.append((mid, model, price))
            else:
                print(f"  -- {mid:10}  {model:32}  {err or 'no price'}")
        b.close()
    print("\n--- Summary ---")
    for mid, model, price in results:
        print(f"{mid:10}  ${price}")


if __name__ == "__main__":
    sys.exit(main() or 0)
