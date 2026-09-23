// Renders the /go RETARGETING creative (scripts/ad-assets/retarget.html) to
// Meta-ready PNGs with the LIVE engine ceiling for the 17 Pro Max — same
// rule as gen.mjs (max over storages at sealed/unlocked), never a pasted
// number. 2026-09-23: the retargeting set from docs/go-ads-playbook.md §3.
//
//   npx tsx scripts/ad-assets/gen-retarget.mjs
//
// Output: scripts/ad-assets/out/retarget-square.png (1080x1080) and
// retarget-story.png (1080x1920).
import { chromium } from "playwright";
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { quoteDevice, readPriceOverrides } from "../../app/lib/quote.ts";
import { PRICE_TABLE } from "../../app/data/prices.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
mkdirSync(out, { recursive: true });

const overrides = await readPriceOverrides();
async function upTo(id, label) {
  let best = 0;
  for (const s of Object.keys(PRICE_TABLE[id] || {})) {
    const r = await quoteDevice(
      { modelId: id, modelLabel: label, storage: s, condition: "sealed", carrier: "unlocked", isPhone: true },
      overrides,
    ).catch(() => null);
    if (r?.offer && r.offer > best) best = r.offer;
  }
  return best;
}
const p17 = await upTo("ip17pm", "iPhone 17 Pro Max");
if (!p17) throw new Error("no engine price for ip17pm");
console.log("iPhone 17 Pro Max up to $" + p17);

const html = readFileSync(path.join(here, "retarget.html"), "utf8").replace(/\{\{PRICE:ip17pm\}\}/g, `$${p17.toLocaleString("en-US")}`);
const tmp = path.join(here, "retarget.rendered.html");
writeFileSync(tmp, html);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 3200 }, deviceScaleFactor: 1 });
  await page.goto("file://" + tmp);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.locator(".sq").screenshot({ path: path.join(out, "retarget-square.png") });
  await page.locator(".st").screenshot({ path: path.join(out, "retarget-story.png") });
  console.log("wrote", path.join(out, "retarget-square.png"), "and retarget-story.png");
} finally {
  await browser.close();
  unlinkSync(tmp);
}
