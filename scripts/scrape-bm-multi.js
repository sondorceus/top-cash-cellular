/**
 * Multi-category Backmarket scrape via stealth-Playwright.
 * Reads a list of {name, url} pairs, scrapes each category, dumps products to JSON.
 *
 * Usage: node scripts/scrape-bm-multi.js
 */
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');

chromium.use(stealth);

const CATEGORIES = [
  { key: 'iphone', url: 'https://www.backmarket.com/en-us/l/iphone/e8724fea-197e-4815-85ce-21b8068020cc' },
  { key: 'ipad', url: 'https://www.backmarket.com/en-us/l/apple-ipad/f78ae8f5-4611-4ad0-b2ad-ced07765b847' },
  { key: 'pixel', url: 'https://www.backmarket.com/en-us/l/google-pixel/5b368baa-338c-4f22-aa3e-6e95f39101dd' },
  { key: 'apple-watch', url: 'https://www.backmarket.com/en-us/l/apple-watch/38fd0158-d500-43d2-817c-738859e3e7dd' },
  { key: 'samsung-watch', url: 'https://www.backmarket.com/en-us/l/samsung-watch/53e36d28-75a4-421b-b70e-c13667d7c741' },
  { key: 'samsung-tab', url: 'https://www.backmarket.com/en-us/l/samsung-galaxy-tab/9da6c79a-baa0-4807-bb7d-18afd94dd3ed' },
  { key: 'playstation', url: 'https://www.backmarket.com/en-us/l/sony-playstation/dcbd8534-a5cd-4df0-9d54-dc80814fbcf6' },
  { key: 'xbox', url: 'https://www.backmarket.com/en-us/l/microsoft-xbox/95a6d5f7-222b-45c9-a99b-e27cb10395af' },
  { key: 'nintendo', url: 'https://www.backmarket.com/en-us/l/nintendo/cb51fe78-c8ca-495d-99d2-fbbfe669e58c' },
  { key: 'gaming-laptops', url: 'https://www.backmarket.com/en-us/l/gaming-laptops/15d04ae7-46e5-4ba9-af98-49c2e8f9e47b' },
  { key: 'windows-laptops', url: 'https://www.backmarket.com/en-us/l/windows-laptops/95d6f541-323f-4e25-bc85-5f567700354b' },
  { key: 'desktop', url: 'https://www.backmarket.com/en-us/l/desktop-computer/53eae2f9-83d6-4804-80e6-c56f8194dafd' },
  { key: 'unlocked-phones', url: 'https://www.backmarket.com/en-us/l/unlocked-cell-phones/32f9fadc-084b-4227-8f98-0cc5caf69383' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await ctx.newPage();
  const results = {};

  for (const cat of CATEGORIES) {
    console.log(`\n=== ${cat.key} ===`);
    try {
      await page.goto(cat.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      // Wait for Cloudflare clear
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(1000);
        const t = await page.title();
        if (!t.toLowerCase().includes('just a moment') && !t.toLowerCase().includes('attention required')) break;
      }
      // Scroll to load
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(600);
      }
      const products = await page.evaluate(() => {
        const seen = new Set();
        const out = [];
        document.querySelectorAll('a[href*="/en-us/p/"]').forEach((link) => {
          const href = link.href;
          if (seen.has(href)) return;
          seen.add(href);
          const card = link.closest('article, [class*="card"], [class*="Card"]') || link;
          const img = card.querySelector('img');
          const name = (card.querySelector('h2,h3,[class*="title"]')?.textContent || link.textContent || '').trim().slice(0, 120);
          if (img) {
            out.push({ name, productUrl: href, imageUrl: img.src || '' });
          }
        });
        return out;
      });
      console.log(`  ${products.length} products`);
      results[cat.key] = products;
    } catch (e) {
      console.error(`  FAIL: ${e.message}`);
      results[cat.key] = { error: e.message };
    }
  }

  const outFile = path.join(__dirname, 'bm-multi-products.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${outFile}`);
  await browser.close();
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
