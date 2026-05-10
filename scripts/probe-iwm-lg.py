from playwright.sync_api import sync_playwright

JS = """(leafFinal) => {
    const re = new RegExp('/sell/' + leafFinal + '/[a-z0-9-]+');
    const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.getAttribute('href') || '')
        .filter(h => re.test(h));
    const answers = Array.from(document.querySelectorAll('.answers > *'))
        .map(e => (e.innerText || '').trim().split('\\n')[0].trim())
        .filter(t => t && t.length > 2 && t.length < 80);
    return { links: Array.from(new Set(links)), answers };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
    ctx = b.new_context(ignore_https_errors=True, user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36")
    pg = ctx.new_page()
    pg.goto("https://www.itsworthmore.com/", wait_until="domcontentloaded", timeout=30000)
    try:
        pg.click('button:has-text("Accept")', timeout=3000); pg.wait_for_timeout(500)
    except Exception: pass
    for slug in ["lg-laptop/lg-gram", "lg-laptop/lg-gram-pro", "lg-laptop/lg-gram-superslim"]:
        pg.goto(f"https://www.itsworthmore.com/sell/{slug}", wait_until="networkidle", timeout=45000)
        pg.wait_for_timeout(800)
        leaf_final = slug.split("/")[-1]
        info = pg.evaluate(JS, leaf_final)
        print(f"\n=== {slug} ===")
        print(f"  links ({len(info['links'])}):")
        for l in info["links"][:12]:
            print(f"    {l}")
        print(f"  .answers ({len(info['answers'])}):")
        for a in info["answers"][:12]:
            print(f"    {a}")
    b.close()
