// Renders the 9:16 Reels video ad (scripts/ad-assets/reel.html) to an H.264
// MP4 with LIVE engine "up to" prices — Meta's Opportunity score asks for "a
// fullscreen vertical video (9:16) with audio in your Reels ads" (2026-09-23).
// The file is silent on purpose: this Mac only has the basic TTS voice, so
// add a track from Meta's free music library when uploading (Ads Manager →
// the ad's media → Add music), which is what satisfies "with audio".
//
//   npx tsx scripts/ad-assets/gen-reel.mjs
//
// Output: scripts/ad-assets/out/reel-9x16.mp4 (12s, 30fps, 1080x1920) and
// reel-cover.png. Frames are rendered frame-accurately by pausing every CSS
// animation and seeking it, then encoded with encode-frames.swift
// (AVFoundation — no ffmpeg with H.264 on this machine).
import { chromium } from "playwright";
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync, copyFileSync } from "fs";
import { execFileSync } from "child_process";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { quoteDevice, readPriceOverrides } from "../../app/lib/quote.ts";
import { PRICE_TABLE } from "../../app/data/prices.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
mkdirSync(out, { recursive: true });
const FPS = 30;
const SECONDS = 12;

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
const MODELS = [["ip17pm", "iPhone 17 Pro Max"], ["ip16pm", "iPhone 16 Pro Max"], ["gs25u", "Galaxy S25 Ultra"]];
let html = readFileSync(path.join(here, "reel.html"), "utf8");
for (const [id, label] of MODELS) {
  const p = await upTo(id, label);
  if (!p) throw new Error(`no engine price for ${id}`);
  console.log(label.padEnd(20), "$" + p);
  html = html.replaceAll(`{{PRICE:${id}}}`, `$${p.toLocaleString("en-US")}`);
}
const tmp = path.join(here, "reel.rendered.html");
writeFileSync(tmp, html);
const frames = path.join(os.tmpdir(), `tcc-reel-frames-${process.pid}`);
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto("file://" + tmp);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const total = FPS * SECONDS;
  for (let f = 0; f < total; f++) {
    const ms = (f / FPS) * 1000;
    await page.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t; }), ms);
    await page.screenshot({ path: path.join(frames, `frame-${String(f).padStart(5, "0")}.png`) });
    if (Math.round(ms) === 4800) await page.screenshot({ path: path.join(out, "reel-cover.png") });
  }
  console.log(`rendered ${total} frames`);
} finally {
  await browser.close();
  unlinkSync(tmp);
}
const mp4 = path.join(out, "reel-9x16.mp4");
execFileSync("swift", [path.join(here, "encode-frames.swift"), frames, mp4, String(FPS)], { stdio: "inherit" });
rmSync(frames, { recursive: true, force: true });
const dl = path.join(os.homedir(), "Downloads", "tcc-ads");
mkdirSync(dl, { recursive: true });
copyFileSync(mp4, path.join(dl, "reel-9x16.mp4"));
copyFileSync(path.join(out, "reel-cover.png"), path.join(dl, "reel-cover.png"));
console.log("copied to", dl);
