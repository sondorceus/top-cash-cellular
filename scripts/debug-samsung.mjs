import { lookupAtlasResell } from "../app/lib/atlas-lookup.ts";
import { readFileSync } from "fs";
const atlas = JSON.parse(readFileSync("./public/comps/atlas-reference.json", "utf-8"));

// Step into the lookup
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

const cat = atlas.categories.samsung;
const target = normLabel("Galaxy S25 Ultra");
console.log(`target="${target}"`);
for (const key of Object.keys(cat)) {
  const k = normLabel(key);
  const matches = k.includes(target);
  const locked = key.toLowerCase().includes("carrier locked");
  console.log(`  ${key.padEnd(45)} kNorm="${k}"  matches=${matches}  locked=${locked}`);
}

console.log("\nDirect lookup result:");
console.log("  gs25u unlocked:", lookupAtlasResell(atlas, "gs25u", "Galaxy S25 Ultra", "256", "mint", null));
console.log("  gs25u att:     ", lookupAtlasResell(atlas, "gs25u", "Galaxy S25 Ultra", "256", "mint", "att"));
