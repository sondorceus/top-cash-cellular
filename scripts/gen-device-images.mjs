// Extracts device "label" -> "image" pairs from the sell-funnel catalog
// in app/page.tsx and writes app/lib/device-images.ts — a shared lookup
// the offer page uses to show real product photos.
//
// Run: node scripts/gen-device-images.mjs
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const labelRe = /label:\s*"((?:[^"\\]|\\.)*)"/;
const imageRe = /image:\s*"((?:[^"\\]|\\.)*)"/;

const map = {};
for (const line of src.split("\n")) {
  const l = line.match(labelRe);
  const i = line.match(imageRe);
  if (l && i && i[1]) {
    const label = l[1].replace(/\\"/g, '"');
    if (!map[label]) map[label] = i[1];
  }
}

const entries = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
const body = entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
const out = `// AUTO-GENERATED — do not edit by hand.
// Device label -> product image path (under /public), extracted from
// the sell-funnel catalog in app/page.tsx.
// Regenerate: node scripts/gen-device-images.mjs

export const DEVICE_IMAGES: Record<string, string> = {
${body}
};

// Resolve a product image for a device model name (exact match, then
// case-insensitive). Returns null when the catalog has no image.
export function imageForModel(model?: string | null): string | null {
  if (!model) return null;
  if (DEVICE_IMAGES[model]) return DEVICE_IMAGES[model];
  const norm = model.trim().toLowerCase();
  for (const k in DEVICE_IMAGES) {
    if (k.toLowerCase() === norm) return DEVICE_IMAGES[k];
  }
  return null;
}
`;
writeFileSync(new URL("../app/lib/device-images.ts", import.meta.url), out);
console.log(`wrote app/lib/device-images.ts — ${entries.length} entries`);
