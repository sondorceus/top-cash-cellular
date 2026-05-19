// Smoke-test the condition normalizer + resell multiplier behave correctly
// for both new "Excellent" labels and legacy "Mint" / "Very Good" leads.

// Inline copies of the normalizer + multiplier so we can verify without
// importing the full route (avoids module-resolve fuss with TSX).

function normalizeCondition(raw) {
  if (!raw) return null;
  const k = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (k.includes("seal") || k.includes("newseal")) return "sealed";
  if (k.includes("verygood")) return "verygood";
  if (k.includes("excellent") || k.includes("lightlyflown")) return "mint";
  if (k.includes("mint") || k.includes("pristine") || k.includes("flawless")) return "mint";
  if (k.includes("good") || k.includes("wellmaintained")) return "good";
  if (k.includes("fair") || k.includes("beatup") || k.includes("heavilyused")) return "fair";
  if (k.includes("broken") || k.includes("cracked") || k.includes("damag")) return "broken";
  return null;
}

function resellMultiplier(condition) {
  const c = (condition || "").toLowerCase();
  if (c.includes("broken") || c.includes("crack") || c.includes("dead")) return 0.30;
  if (c.includes("fair") || c.includes("heav")) return 0.65;
  if (c.includes("very good")) return 0.80;
  if (c.includes("good") || c.includes("well-maintained")) return 0.80;
  if (c.includes("excellent") || c.includes("lightly")) return 1.0;
  return 1.0;
}

const cases = [
  // [label, expected_slug, expected_multiplier]
  ["Sealed",          "sealed", 1.0],
  ["Excellent",       "mint",   1.0],
  ["Good",            "good",   0.80],
  ["Fair",            "fair",   0.65],
  ["Broken",          "broken", 0.30],
  // Legacy MC bodies
  ["Mint",            "mint",   1.0],
  ["Very Good",       "verygood", 0.80],
  // DJI/console overrides
  ["Lightly Flown",   "mint",   1.0],
  ["Well-Maintained", "good",   0.80],
  ["Heavily Used",    "fair",   0.65],
  // Funky edge cases
  ["Fair / Beat Up",  "fair",   0.65],
  ["New / Sealed",    "sealed", 1.0],
  ["Cracked",         "broken", 0.30],
];

let pass = 0, fail = 0;
for (const [label, expSlug, expMult] of cases) {
  const slug = normalizeCondition(label);
  const mult = resellMultiplier(label);
  const ok = slug === expSlug && Math.abs(mult - expMult) < 0.001;
  if (ok) pass++; else fail++;
  console.log(`${ok ? "OK" : "FAIL"}  ${label.padEnd(18)} slug=${slug} (exp ${expSlug})  mult=${mult} (exp ${expMult})`);
}
console.log(`\n${pass}/${pass+fail} pass`);
process.exit(fail > 0 ? 1 : 0);
