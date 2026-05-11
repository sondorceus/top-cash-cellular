"""After clicking Flawless, wait 4 seconds then dump page content."""
import sys
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        pg = b.new_context(user_agent=UA).new_page()
        try:
            pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
            pg.click('button:has-text("Accept")', timeout=3000)
        except Exception:
            pass
        url = "https://www.itsworthmore.com/sell/galaxy-z-fold-series/galaxy-z-flip-7"
        pg.goto(url, wait_until="networkidle", timeout=45000)
        pg.wait_for_timeout(2000)
        # Click Flawless
        pg.evaluate("""
            () => {
                const els = document.querySelectorAll('.answers > [ng-click]');
                for (const e of els) {
                    if ((e.innerText||'').toLowerCase().startsWith('flawless')) { e.click(); break; }
                }
            }
        """)
        print("Waiting 4 seconds for any auto-advance...")
        pg.wait_for_timeout(4000)
        # Dump every visible element with text starting with capital letters (potential buttons)
        out = pg.evaluate("""
            () => {
                const skip = new Set(['HEAD', 'STYLE', 'SCRIPT', 'NAV', 'HEADER', 'FOOTER']);
                const visible = el => {
                    const r = el.getBoundingClientRect();
                    return r.width > 5 && r.height > 5 && window.getComputedStyle(el).display !== 'none';
                };
                const out = [];
                const walk = (el) => {
                    if (!el || skip.has(el.tagName)) return;
                    if (el.tagName === 'BUTTON' || (el.tagName === 'A' && el.getAttribute('href')) || el.getAttribute('ng-click')) {
                        if (visible(el)) {
                            const t = (el.innerText || el.textContent || '').trim();
                            if (t && t.length < 100) {
                                const cls = (el.className || '').toString().slice(0, 80);
                                out.push({tag: el.tagName, cls, text: t.slice(0, 60)});
                            }
                        }
                    }
                    for (const c of el.children) walk(c);
                };
                walk(document.querySelector('.quote-wrap, .quiz-wrap, main, body'));
                return out.slice(0, 40);
            }
        """)
        print("\nVisible clickable elements (buttons + anchors + ng-click):")
        for o in out:
            line = f"  <{o['tag']} class='{o['cls']}'> {o['text']}"
            print(line.encode('ascii', 'replace').decode('ascii'))
        # Also check class of .answers
        cls = pg.evaluate("() => { const e = Array.from(document.querySelectorAll('.answers')).find(el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; }); return e ? e.className : '(none)'; }")
        print(f"\n.answers class now: {cls}")
        b.close()


if __name__ == "__main__":
    sys.exit(main() or 0)
