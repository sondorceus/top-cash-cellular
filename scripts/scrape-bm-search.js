/**
 * Search-based stealth scrape on Backmarket for specific products by name.
 * Runs once per query, picks the first result whose name matches a regex,
 * outputs JSON of {query, name, productUrl, imageUrl}.
 */
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');

chromium.use(stealth);

// {key, query, matchRegex, requireKeyword (optional)}
const QUERIES = [
  // HP laptops
  { key: 'hp-spectre-x360-14', query: 'hp spectre x360 14', match: /spectre x360 14/i },
  { key: 'hp-spectre-x360-16', query: 'hp spectre x360 16', match: /spectre x360 16/i },
  { key: 'hp-envy-15', query: 'hp envy x360 15', match: /envy x360 15/i },
  { key: 'hp-envy-16', query: 'hp envy 16', match: /envy 16/i },
  { key: 'hp-omen-16', query: 'hp omen 16', match: /omen 16/i },
  { key: 'hp-omen-17', query: 'hp omen 17', match: /omen 17/i },
  { key: 'hp-pavilion-15', query: 'hp pavilion 15', match: /pavilion 15/i },
  { key: 'hp-victus-15', query: 'hp victus 15', match: /victus 15/i },
  // Acer
  { key: 'acer-nitro-v-16', query: 'acer nitro v 16', match: /nitro v 16/i },
  { key: 'acer-nitro-5', query: 'acer nitro 5', match: /acer nitro/i },
  { key: 'acer-predator-helios', query: 'acer predator helios', match: /predator/i },
  { key: 'acer-swift-go', query: 'acer swift go', match: /swift go|swift 3/i },
  { key: 'acer-aspire', query: 'acer aspire 5', match: /aspire/i },
  // Asus
  { key: 'asus-rog-strix', query: 'asus rog strix g15', match: /rog strix/i },
  { key: 'asus-rog-zephyrus', query: 'asus rog zephyrus g14', match: /rog zephyrus/i },
  { key: 'asus-tuf-gaming', query: 'asus tuf gaming a15', match: /tuf gaming/i },
  { key: 'asus-zenbook', query: 'asus zenbook', match: /zenbook/i },
  { key: 'asus-vivobook', query: 'asus vivobook', match: /vivobook/i },
  // Dell laptop variants
  { key: 'dell-inspiron-16-plus', query: 'dell inspiron 16 plus', match: /inspiron 16/i },
  { key: 'dell-inspiron-15', query: 'dell inspiron 15', match: /inspiron 15/i },
  { key: 'dell-inspiron-14', query: 'dell inspiron 14', match: /inspiron 14/i },
  { key: 'dell-g15', query: 'dell g15 gaming', match: /g15/i },
  // Razer / MSI
  { key: 'razer-blade-15', query: 'razer blade 15', match: /razer blade 15/i },
  { key: 'razer-blade-16', query: 'razer blade 16', match: /razer blade 16/i },
  { key: 'msi-stealth', query: 'msi stealth gs66', match: /msi stealth/i },
  { key: 'msi-katana', query: 'msi katana', match: /msi katana/i },
  // Apple desktops
  { key: 'imac-24-m4', query: 'imac 24 m4', match: /imac.*m4/i },
  { key: 'imac-24-m3', query: 'imac 24 m3', match: /imac.*m3/i },
  { key: 'imac-24-m1', query: 'imac 24 m1', match: /imac.*m1/i },
  { key: 'mac-mini-m4', query: 'mac mini m4', match: /mac mini.*m4/i },
  { key: 'mac-mini-m2', query: 'mac mini m2', match: /mac mini.*m2/i },
  { key: 'mac-mini-m1', query: 'mac mini m1', match: /mac mini.*m1/i },
  { key: 'mac-studio-m2', query: 'mac studio m2', match: /mac studio/i },
  // Galaxy Book
  { key: 'galaxy-book-4-ultra', query: 'samsung galaxy book 4 ultra', match: /book 4 ultra/i },
  { key: 'galaxy-book-4-pro', query: 'samsung galaxy book 4 pro', match: /book 4 pro/i },
  { key: 'galaxy-book-3-ultra', query: 'samsung galaxy book 3 ultra', match: /book 3 ultra/i },
  { key: 'galaxy-book-3-pro', query: 'samsung galaxy book 3 pro', match: /book 3 pro/i },
  // HP / Lenovo desktops
  { key: 'hp-elitedesk-800', query: 'hp elitedesk 800 g9', match: /elitedesk.*g9|elitedesk 800/i },
  { key: 'hp-prodesk-400', query: 'hp prodesk 400', match: /prodesk 400/i },
  { key: 'hp-envy-34-aio', query: 'hp envy 34 all-in-one', match: /envy 34|envy aio/i },
  { key: 'hp-pavilion-32-aio', query: 'hp pavilion 32 all-in-one', match: /pavilion 32|pavilion aio/i },
  { key: 'lenovo-ideacentre', query: 'lenovo ideacentre', match: /ideacentre/i },
  // AirPods / Vision / Quest
  { key: 'airpods-pro-2', query: 'airpods pro 2', match: /airpods pro 2/i },
  { key: 'airpods-pro', query: 'airpods pro', match: /airpods pro/i },
  { key: 'airpods-3', query: 'airpods 3rd gen', match: /airpods 3/i },
  { key: 'airpods-max', query: 'airpods max', match: /airpods max/i },
  { key: 'vision-pro', query: 'apple vision pro', match: /vision pro/i },
  { key: 'meta-quest-3', query: 'meta quest 3', match: /quest 3/i },
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

  for (const q of QUERIES) {
    process.stdout.write(`${q.key} ... `);
    try {
      await page.goto(`https://www.backmarket.com/en-us/search?q=${encodeURIComponent(q.query)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      // Wait for Cloudflare clear
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(800);
        const t = await page.title();
        if (!t.toLowerCase().includes('just a moment') && !t.toLowerCase().includes('attention')) break;
      }
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(400);
      }
      const products = await page.evaluate(() => {
        const seen = new Set();
        const out = [];
        document.querySelectorAll('a[href*="/en-us/p/"]').forEach((link) => {
          const href = link.href;
          if (seen.has(href)) return;
          seen.add(href);
          const card = link.closest('article, [class*="card"]') || link;
          const img = card.querySelector('img');
          const name = (card.querySelector('h2,h3,[class*="title"]')?.textContent || link.textContent || '').trim().slice(0, 120);
          if (img) out.push({ name, productUrl: href, imageUrl: img.src || '' });
        });
        return out;
      });
      const match = products.find((p) => q.match.test(p.name));
      if (match) {
        results[q.key] = { name: match.name, productUrl: match.productUrl, imageUrl: match.imageUrl };
        console.log(`OK: ${match.name.slice(0, 50)}`);
      } else {
        console.log(`NO MATCH (got ${products.length})`);
        results[q.key] = { error: 'no match', sampleNames: products.slice(0, 3).map((p) => p.name) };
      }
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      results[q.key] = { error: e.message };
    }
  }

  const outFile = path.join(__dirname, 'bm-search-products.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${outFile}`);
  await browser.close();
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
