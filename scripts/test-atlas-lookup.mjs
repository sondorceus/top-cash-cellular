import { lookupAtlasResell } from "../app/lib/atlas-lookup.ts";
import { readFileSync } from "fs";
const atlas = JSON.parse(readFileSync("./public/comps/atlas-reference.json", "utf-8"));

const tests = [
  ["ip17pm", "iPhone 17 Pro Max", "256", "mint", null],
  ["ip17pm", "iPhone 17 Pro Max", "256", "mint", "att"],
  ["ip17pm", "iPhone 17 Pro Max", "512", "fair", null],
  ["ip17pm", "iPhone 17 Pro Max", "1tb", "broken", null],
  ["ip17air", "iPhone 17 Air", "256", "mint", null],
  ["ip16e", "iPhone 16E", "128", "mint", null],
  ["ip13mini", "iPhone 13 mini", "256", "mint", null],
  ["px10a", "Pixel 10a", null, "mint", null],
  ["px10", "Pixel 10", null, "mint", null],
  ["ipad10", "iPad 10th Gen", "64", "mint", null],
  ["ipadair11m3", "iPad Air 11\" (M3)", "128", "mint", null],
  ["aws10", "Apple Watch Series 10", null, "mint", null],
  ["gs26u", "Galaxy S26 Ultra", "256", "mint", null],
  ["gs26u", "Galaxy S26 Ultra", "256", "mint", "att"],
  ["gs25u", "Galaxy S25 Ultra", "256", "mint", null],
  ["gs25u", "Galaxy S25 Ultra", "256", "mint", "att"],
];
for (const [sku, lbl, stor, cond, car] of tests) {
  const v = lookupAtlasResell(atlas, sku, lbl, stor, cond, car);
  console.log(`${sku.padEnd(10)} ${lbl.padEnd(28)} ${(stor || "?").padEnd(5)} ${cond.padEnd(8)} ${car || "unlocked"} -> ${v ?? "null"}`);
}
console.log("---");
console.log("Same-model condition variants (S25 Ultra unlocked):");
for (const c of ["sealed","mint","verygood","good","fair","broken"]) {
  console.log(`  ${c.padEnd(10)} -> ${lookupAtlasResell(atlas, "gs25u", "Galaxy S25 Ultra", "256", c, null)}`);
}
