const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  await page.goto('https://www.backmarket.com/en-us/l/apple-macbook/a059fa0c-b88d-4095-b6a2-dcbeb9dd5b33', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);

  // Scroll to bottom to load all
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(800);
  }

  const html = await page.content();
  fs.writeFileSync('scripts/bm-debug.html', html);
  console.log('Wrote bm-debug.html', html.length, 'bytes');

  // Try multiple selector strategies
  for (const sel of ['article', '[data-test]', 'a[href*="/p/"]', '[class*="card"]', '[class*="Card"]', '[class*="grid"]', 'main img']) {
    const count = await page.locator(sel).count();
    console.log(`  ${sel}: ${count}`);
  }

  // Sample first 3 links
  const links = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href*="/p/"]')).slice(0, 5);
    return a.map(x => ({ href: x.href, text: (x.textContent || '').slice(0, 60) }));
  });
  console.log('Sample links:', JSON.stringify(links, null, 2));

  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
