#!/usr/bin/env python3
"""Headed debug walk for Note 20 Ultra 5G — save screenshots + page text after each step."""
import os
import re
import sys
import json
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
OUT = os.path.dirname(os.path.abspath(__file__))

CLICK_JS = """([prefList]) => {
    const wrap = Array.from(document.querySelectorAll('.answers')).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.children.length > 0;
    });
    if (!wrap) return { ok: false, reason: 'no visible .answers' };
    const cls = wrap.className || '';
    const kids = Array.from(wrap.children).filter(c => {
        if (c.classList.contains('ng-hide')) return false;
        const txt = (c.innerText || '').trim();
        return txt && c.getAttribute('ng-click');
    });
    if (!kids.length) return { ok: false, reason: 'no visible kid answers', cls };
    const kidTexts = kids.map(k => (k.innerText || '').slice(0, 40));
    let chosen = null;
    for (const pref of prefList) {
        chosen = kids.find(k => (k.innerText || '').toLowerCase().includes(pref.toLowerCase()));
        if (chosen) break;
    }
    if (!chosen) chosen = kids[kids.length - 1];
    chosen.click();
    return { ok: true, clicked: (chosen.innerText || '').slice(0, 40), cls, kidTexts };
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

DOLLAR = re.compile(r"\$\s*([0-9]+(?:,[0-9]{3})*)(?!\d)")

PAGE_TEXT_JS = """() => {
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

# Find ALL dollar values on page, with surrounding context, to see where $200 comes from.
DOLLAR_CTX_JS = """() => {
    const results = [];
    const walk = (el) => {
        if (!el) return;
        if (['SCRIPT','STYLE'].includes(el.tagName)) return;
        if (el.nodeType === 3) {
            const txt = el.textContent || '';
            if (/\\$\\s*\\d/.test(txt)) {
                // climb to nearest element
                let parent = el.parentElement;
                let path = [];
                let p = parent;
                for (let i=0; i<5 && p; i++) {
                    path.push(p.tagName + (p.className ? '.'+String(p.className).slice(0,60).replace(/\\s+/g,'.') : '') + (p.id ? '#'+p.id : ''));
                    p = p.parentElement;
                }
                results.push({
                    text: txt.trim().slice(0, 120),
                    parentTag: parent ? parent.tagName : '',
                    parentClass: parent ? String(parent.className).slice(0,120) : '',
                    parentId: parent ? parent.id : '',
                    visible: parent ? (parent.getBoundingClientRect().width > 0 && parent.getBoundingClientRect().height > 0) : false,
                    hidden: parent ? parent.classList.contains('ng-hide') : false,
                    path: path.join(' < ')
                });
            }
            return;
        }
        for (const c of el.childNodes) walk(c);
    };
    walk(document.body);
    return results;
}"""


def run():
    url = "https://www.itsworthmore.com/sell/galaxy-note-series/galaxy-note-20-ultra-5g"
    log = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=False, args=["--no-sandbox"])
        ctx = b.new_context(user_agent=UA, viewport={"width": 1400, "height": 900})
        pg = ctx.new_page()
        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            try: pg.click('button:has-text("Accept")', timeout=3000)
            except Exception: pass
        except Exception as e:
            print(f"home goto fail: {e}")

        print(f"GOTO {url}")
        pg.goto(url, wait_until="networkidle", timeout=45000)
        pg.wait_for_timeout(2000)
        pg.screenshot(path=os.path.join(OUT, "step00_loaded.png"), full_page=True)

        for i in range(10):
            visible = pg.evaluate(
                "() => Array.from(document.querySelectorAll('.answers')).some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })"
            )
            if not visible:
                print(f"step {i+1}: no .answers visible, breaking")
                log.append({"step": i+1, "state": "no .answers visible"})
                break
            res = pg.evaluate(CLICK_JS, [["Flawless", "Unlocked", "No"]])
            pg.wait_for_timeout(400)
            advanced = pg.evaluate(NEXT_JS)
            pg.wait_for_timeout(1500 if advanced else 700)
            print(f"step {i+1}: cls={res.get('cls','?')[:80]} | kids={res.get('kidTexts')} | clicked={res.get('clicked','?')} | advanced={advanced}")
            log.append({"step": i+1, **res, "advanced": advanced})
            pg.screenshot(path=os.path.join(OUT, f"step{i+1:02d}.png"), full_page=True)

        pg.wait_for_timeout(2000)
        pg.screenshot(path=os.path.join(OUT, "final.png"), full_page=True)

        # Dump dollar contexts
        ctxs = pg.evaluate(DOLLAR_CTX_JS)
        with open(os.path.join(OUT, "dollar_contexts.json"), "w", encoding="utf-8") as f:
            json.dump(ctxs, f, indent=2, ensure_ascii=False)
        print(f"\n=== {len(ctxs)} dollar-bearing nodes ===")
        for c in ctxs:
            print(f"  vis={c['visible']} hidden={c['hidden']} | {c['parentTag']}.{(c['parentClass'] or '')[:50]} | {c['text'][:80]}")

        # Page text used by scraper
        full_text = pg.evaluate(PAGE_TEXT_JS)
        with open(os.path.join(OUT, "scraper_text.txt"), "w", encoding="utf-8") as f:
            f.write(full_text)
        matches = DOLLAR.findall(full_text)
        vals = [int(m.replace(",", "")) for m in matches]
        plausible = [v for v in vals if 30 <= v <= 4000]
        print(f"\n=== All $ matches: {vals} ===")
        print(f"=== Plausible (30-4000): {plausible} ===")
        print(f"=== max = {max(plausible) if plausible else None} ===")

        with open(os.path.join(OUT, "walk_log.json"), "w", encoding="utf-8") as f:
            json.dump(log, f, indent=2, ensure_ascii=False)

        print("\nDone. Holding browser 5s.")
        pg.wait_for_timeout(5000)
        b.close()


if __name__ == "__main__":
    run()
