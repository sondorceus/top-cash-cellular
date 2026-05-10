"""Generic IWM tree probe. Usage: python probe-iwm.py <slug> [<slug2> ...]"""
import sys
from playwright.sync_api import sync_playwright

JS = """(leafFinal) => {
    const re = new RegExp('/sell/' + leafFinal + '/[a-z0-9-]+');
    const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.getAttribute('href') || '')
        .filter(h => re.test(h));
    const answers = Array.from(document.querySelectorAll('.answers > *'))
        .map(e => (e.innerText || '').trim().split('\\n')[0].trim())
        .filter(t => t && t.length > 2 && t.length < 80);
    // Also look for sibling category links at top-level /sell/ that mention this brand
    const sibling = Array.from(document.querySelectorAll('a[href*="/sell/"]'))
        .map(a => a.getAttribute('href') || '')
        .filter(h => h && /^(?:https?:\\/\\/[^\\/]+)?\\/sell\\/[a-z0-9-]+$/.test(h));
    return { links: Array.from(new Set(links)), answers, sibling: Array.from(new Set(sibling)) };
}"""

def probe(pg, slug):
    pg.goto(f"https://www.itsworthmore.com/sell/{slug}", wait_until="networkidle", timeout=45000)
    pg.wait_for_timeout(800)
    leaf_final = slug.split("/")[-1]
    info = pg.evaluate(JS, leaf_final)
    print(f"\n=== {slug} ===")
    print(f"  child product links ({len(info['links'])}):")
    for l in info["links"][:20]: print(f"    {l}")
    print(f"  .answers ({len(info['answers'])}):")
    for a in info["answers"][:20]: print(f"    {a}")
    # Filter sibling for relevant brand keyword
    keyword = slug.split("-")[0]
    rel = sorted({s.split("/sell/")[-1] for s in info["sibling"]
                  if keyword in s.lower() and slug.split("/")[-1] not in s})
    print(f"  sibling category candidates ({len(rel)}):")
    for s in rel[:20]: print(f"    {s}")


def main():
    slugs = sys.argv[1:]
    if not slugs:
        print("usage: python probe-iwm.py <slug> [<slug2> ...]")
        return 1
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        ctx = b.new_context(ignore_https_errors=True, user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36")
        pg = ctx.new_page()
        pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
        try:
            pg.click('button:has-text("Accept")', timeout=3000); pg.wait_for_timeout(400)
        except Exception: pass
        for s in slugs:
            try: probe(pg, s)
            except Exception as e: print(f"  ! {s}: {e}")
        b.close()


if __name__ == "__main__":
    sys.exit(main() or 0)
