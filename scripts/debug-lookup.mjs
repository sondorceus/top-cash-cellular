// Inline the lookup so we can trace
import { readFileSync } from "fs";
const atlas = JSON.parse(readFileSync("./public/comps/atlas-reference.json", "utf-8"));

function normLabel(s) {
  return s
    .toLowerCase()
    .replace(/[''′"`]/g, "")
    .replace(/\((.*?)\)/g, " $1 ")
    .replace(/\b(\d+)(st|nd|rd|th)\s+gen\b/g, "$1")
    .replace(/\bapple watch\s+/g, "")
    .replace(/\b(galaxy\s+)?note\b/g, "note")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function atlasStorage(s) {
  const k = s.toLowerCase();
  if (k === "1tb") return "1TB";
  if (k === "2tb") return "2TB";
  if (/^\d+$/.test(k)) return `${k}GB`;
  return s.toUpperCase();
}

const category = "ipads_used";
const modelLabel = "iPad 10th Gen";
const storage = "64";
const target = normLabel(modelLabel);
const targetStor = atlasStorage(storage).toLowerCase();
console.log(`target="${target}"  targetStor="${targetStor}"`);

const cat = atlas.categories[category];
for (const key of Object.keys(cat)) {
  const kNorm = normLabel(key);
  if (!kNorm.includes(target)) continue;
  const storFlat = kNorm.replace(/\s+/g, "");
  const hasStor = storFlat.includes(targetStor);
  const idx = kNorm.indexOf(target);
  const after = kNorm.charAt(idx + target.length);
  const trailingBad = after && /[a-z0-9]/.test(after);
  console.log(`  key="${key}"  kNorm="${kNorm}"  hasStor=${hasStor}  after="${after}"  trailingBad=${trailingBad}`);
}
