/**
 * Headless Chrome scrape of Backmarket MacBook listings.
 * Bypasses their Cloudflare bot protection by using a real browser engine.
 *
 * Usage: node scripts/scrape-backmarket-macbook.js
 *
 * Output: writes scripts/backmarket-macbook-urls.json with { name, productUrl, imageUrl } per SKU
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LISTING_URL = 'https://www.backmarket.com/en-us/l/apple-macbook/a059fa0c-b88d-4095-b6a2-dcbeb9dd5b33';
const OUTPUT = path.join(__dirname, 'backmarket-macbook-urls.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  console.log('Visiting listing page...');
  await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for Cloudflare challenge to clear + product cards to render
  console.log('Waiting for challenge to clear and products to load...');
  await page.waitForTimeout(8000);

  // Try to find product cards. Backmarket uses different selectors but products typically have data-test or article tags
  await page.waitForSelector('article, [data-test], .productCard, [class*="product"]', { timeout: 30000 }).catch(() => {});

  // Scroll to trigger lazy-loaded images
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
  }

  // Extract product images + names
  const products = await page.evaluate(() => {
    const out = [];
    const cards = document.querySelectorAll('article, [data-test*="product"], [data-qa*="product"]');
    cards.forEach((card) => {
      const img = card.querySelector('img');
      const link = card.querySelector('a[href*="/p/"], a[href*="/en-us/p/"]');
      const name = card.querySelector('h2, h3, [data-test*="title"]')?.textContent?.trim() || '';
      if (img && link) {
        out.push({
          name,
          productUrl: link.href,
          imageUrl: img.src || img.getAttribute('data-src') || '',
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
