/**
 * Stealth-mode Backmarket MacBook scrape.
 * Uses playwright-extra + puppeteer-extra-plugin-stealth to mask headless detection.
 *
 * Usage: node scripts/scrape-backmarket-stealth.js
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');

chromium.use(stealth);

const LISTING_URL = 'https://www.backmarket.com/en-us/l/apple-macbook/a059fa0c-b88d-4095-b6a2-dcbeb9dd5b33';
const OUTPUT = path.join(__dirname, 'backmarket-macbook-urls.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const page = await context.newPage();

  console.log('Visiting listing page (stealth)...');
  await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });

  console.log('Waiting up to 30s for Cloudflare to clear...');
  // Wait for Cloudflare challenge to clear — check title shifts away from "Just a moment..."
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const title = await page.title();
    if (!title.toLowerCase().includes('just a moment') && !title.toLowerCase().includes('attention required')) {
      console.log(`Challenge cleared at ${i}s, title: "${title}"`);
      break;
    }
    if (i === 29) console.log('Challenge did NOT clear after 30s, title still:', title);
  }

  // Scroll to trigger lazy-load
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(700);
  }

  const html = await page.content();
  fs.writeFileSync(path.join(__dirname, 'bm-stealth.html'), html);
  console.log(`Wrote bm-stealth.html (${html.length} bytes)`);

  // Diagnostic selector counts
  for (const sel of ['article', '[data-test]', 'a[href*="/p/"]', 'a[href*="/en-us/p/"]', 'main img']) {
    const count = await page.locator(sel).count();
    console.log(`  ${sel}: ${count}`);
  }

  // Extract products
  const products = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/en-us/p/"], a[href*="/p/"]').forEach((link) => {
      const href = link.href;
      if (seen.has(href)) return;
      seen.add(href);
      const card = link.closest('article, [class*="card"], [class*="Card"]') || link;
      const img = card.querySelector('img');
      const name = (card.querySelector('h2, h3, [class*="title"]')?.textContent || link.textContent || '').trim().slice(0, 120);
      if (img) {
        out.push({
          name,
          productUrl: href,
          imageUrl: img.src || img.getAttribute('data-src') || img.getAttribute('srcset')?.split(' ')[0] || '',
        });
      }
    });
    return out;
  });

  console.log(`Found ${products.length} products`);
  fs.writeFileSync(OUTPUT, JSON.stringify(products, null, 2));
  console.log(`Wrote ${OUTPUT}`);

  await browser.close();
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
