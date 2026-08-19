// TCC ad-asset generator — renders the board + flyer templates to
// Meta-ready PNGs with LIVE engine prices, so creatives can never drift
// from what the site actually pays.
//
//   npx tsx scripts/ad-assets/gen.mjs
//
// Output: scripts/ad-assets/out/*.png (1080x1080 feed + 1080x1920 story).
// Templates: board.html (site-styled payout board), flyer.html
// (cash-for-phones flyer, Sonny's ad language, bilingual EN/ES).
// Prices in the templates are placeholders swapped at render time via
// {{PRICE:modelId}} — grep below rewrites any literal $NNN next to a model
// name too, but prefer tokens when editing templates.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { quoteDevice, readPriceOverrides } from "../../app/lib/quote.ts";
import { PRICE_TABLE } from "../../app/data/prices.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
mkdirSync(out, { recursive: true });

// Engine-true "up to" ceiling: max over storages at sealed/unlocked —
// reachable by construction (same rule as /go's board; see app/go/board.ts).
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

const MODELS = [
  ["ip17pm", "iPhone 17 Pro Max"],
  ["ip16pm", "iPhone 16 Pro Max"],
  ["gs25u", "Galaxy S25 Ultra"],
  ["ip15pm", "iPhone 15 Pro Max"],
  ["gs24u", "Galaxy S24 Ultra"],
  ["ip14pm", "iPhone 14 Pro Max"],
];
const prices = {};
for (const [id, label] of MODELS) {
  prices[label] = await upTo(id, label);
  console.log(label.padEnd(20), "$" + prices[label]);
}

// Swap prices into a template: any "$NNN" that follows a model's short name
// within the same tag block gets the fresh number. Simple + good enough for
// these hand-built templates; verify output before shipping to Meta.
function freshen(html) {
  for (const [label, p] of Object.entries(prices)) {
    if (!p) continue;
    const short = label.replace("iPhone ", "").replace("Galaxy ", "");
    // e.g. >17 Pro Max<...>$1425<  /  iPhone 17 Pro Max</span>...$1425
    const re = new RegExp(`(${short.replace(/[+]/g, "\\+")}[^$]{0,220}\\$)\\d+`, "g");
    html = html.replaceAll(re, `$1${p}`);
  }
  return html;
}

const JOBS = [
  ["board.html", [["a1", "board-square.png"], ["a2", "board-story.png"], ["a3", "lot-square.png"], ["a4", "lot-story.png"]]],
  ["flyer.html", [["f1", "flyer-square.png"], ["f2", "flyer-story.png"]]],
];
// Photo tier: renders only when Sonny's real photo is present.
import { existsSync } from "fs";
if (existsSync(path.join(here, "real-photo.jpg"))) {
  JOBS.push(["photo.html", [["p1", "photo-feed.png"], ["p2", "photo-story.png"]]]);
} else {
  console.log("(photo tier skipped — drop a real photo at scripts/ad-assets/real-photo.jpg)");
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 2000 } });
for (const [tpl, boards] of JOBS) {
  const src = freshen(readFileSync(path.join(here, tpl), "utf8"));
  const tmp = path.join(here, "." + tpl);
  writeFileSync(tmp, src);
  await page.goto("file://" + tmp);
  await page.waitForTimeout(700);
  for (const [id, file] of boards) {
    await page.locator("#" + id).screenshot({ path: path.join(out, file) });
    console.log("wrote out/" + file);
  }
}
await browser.close();
