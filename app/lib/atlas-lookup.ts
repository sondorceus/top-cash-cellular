// Atlas per-cell resell lookup. Given a TCC SKU + storage + condition
// (+ optional carrier), return the matching Atlas wholesale-buy value.
//
// Atlas data lives in public/comps/atlas-reference.json (scraped by
// scripts/scrape-atlas-full.py). Each category has its own column shape
// — iPhones get the full sealed/grade_a-d/DOA matrix, iPads skip sealed,
// Pixels collapse to sealed/open/grade_a/grade_b_plus, Apple Watches
// drop storage entirely. This module hides those quirks so callers can
// ask for one cell's resell value and get a number or null.

type Grades = Record<string, number | null>;
export type AtlasReference = {
  scraped_at?: string;
  sources?: Record<string, string>;
  categories?: Record<string, Record<string, Grades>>;
  counts?: Record<string, number>;
};

// TCC condition slugs → Atlas grade column, per category. We pick the
// "most analogous" column for each TCC bucket. Unmapped slots return
// null (e.g. iPad has no "sealed" data; Pixel has no grade_c/d).
const CONDITION_MAP: Record<string, Record<string, string>> = {
  iphones_used: {
    sealed: "swap_hso", mint: "grade_a", verygood: "grade_b",
    good: "grade_c", fair: "grade_d", broken: "doa",
  },
  ipads_used: {
    mint: "grade_a", verygood: "grade_b",
    good: "grade_c", fair: "grade_d", broken: "doa",
  },
  pixel: {
    sealed: "sealed", mint: "grade_a", verygood: "grade_b_plus",
  },
  samsung: {
    sealed: "swap_hso", mint: "grade_a", verygood: "grade_b",
    good: "grade_c", fair: "grade_d", broken: "doa",
  },
  apple_watches: {
    sealed: "sealed", mint: "grade_a_hso", verygood: "grade_b",
  },
};

// TCC storage slug → Atlas storage label.
function atlasStorage(s: string): string {
  const k = s.toLowerCase();
  if (k === "1tb") return "1TB";
  if (k === "2tb") return "2TB";
  if (/^\d+$/.test(k)) return `${k}GB`;
  return s.toUpperCase();
}

// TCC SKU → (atlasCategory, atlasModelLabel) for the label-without-
// storage-suffix used as the Atlas key prefix. Returns null when the
// SKU isn't covered by Atlas at all (no point trying to look up). Order
// matters — more-specific prefixes (ipad, aw) checked before the
// shorter ip / a families.
function skuToAtlas(sku: string, label: string): { category: string; modelLabel: string } | null {
  // iPads: "iPad Pro 13\" (M5)" etc. Must come before the "ip" prefix.
  if (sku.startsWith("ipad")) return { category: "ipads_used", modelLabel: label };
  // Apple Watches: no storage, look up by series + size where possible.
  if (sku.startsWith("aws") || sku.startsWith("awu") || sku.startsWith("awse")) {
    return { category: "apple_watches", modelLabel: label };
  }
  // iPhones: TCC label is "iPhone 17 Pro Max" → Atlas key prefix "iPhone 17 Pro Max"
  if (sku.startsWith("ip")) return { category: "iphones_used", modelLabel: label };
  // Pixel: TCC "Pixel 10 Pro Max" needs to match Atlas's noisy upper-case
  // factory labels — resolved by upper-cased substring scan in
  // resolveKey, not exact match.
  if (sku.startsWith("px")) return { category: "pixel", modelLabel: label };
  // Samsung Galaxy phones / Notes: "Galaxy S26 Ultra" etc.
  if (sku.startsWith("gs") || sku.startsWith("gz") || sku.startsWith("gn")) {
    // Atlas keys use "Galaxy S26 Ultra" / "Note 20 Ultra" — strip the Galaxy
    // prefix for Note-series.
    let m = label;
    if (m.startsWith("Galaxy Note ")) m = m.replace("Galaxy ", "");
    return { category: "samsung", modelLabel: m };
  }
  return null;
}

// Normalize a label for fuzzy substring matching across Atlas's
// inconsistent capitalization, punctuation, and "th Gen" / "(M3)" /
// quoted-inches noise. Returns the model name as a compact alphanumeric
// run (no parens, no commas, no quotes, "th gen"/"nd gen"/etc stripped).
function normLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''′"`]/g, "")        // strip quotes / apostrophes
    .replace(/\((.*?)\)/g, " $1 ")  // unwrap parens: "(M3)" → " M3 "
    .replace(/\b(\d+)(st|nd|rd|th)\s+gen\b/g, "$1") // "10th Gen" → "10"
    .replace(/\bapple watch\s+/g, "")  // AW labels strip the prefix
    .replace(/\b(galaxy\s+)?note\b/g, "note") // unify Note labels
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Whether this Atlas category carries the storage suffix inside its key
// (iPhones + iPads do; Pixel / Apple Watch / Samsung phones don't).
function categoryHasStorageInKey(category: string): boolean {
  return category === "iphones_used" || category === "ipads_used" ||
         category === "iphones_nib" || category === "ipads_nib";
}

// Find the matching Atlas key for a given (modelLabel, storage, carrier).
// Atlas keys are case-and-spacing-sloppy ("iPhone 17 AIR", "PIXEL 10 PRO
// 6.3' 5G FACTORY ORIGINAL UNLOCKED") so we normalize both sides and
// substring-match the model label, then disambiguate by storage + lock.
function resolveKey(
  ref: AtlasReference,
  category: string,
  modelLabel: string,
  storage: string | null,
  locked: boolean,
): Grades | null {
  const cat = ref.categories?.[category];
  if (!cat) return null;
  const targetLabel = normLabel(modelLabel);
  const targetStor = storage ? atlasStorage(storage).toLowerCase() : null;
  const storageMatters = categoryHasStorageInKey(category);
  // Trailing token of the model label — used to reject keys where our
  // number is a prefix of a longer model number (e.g. "Pixel 10" vs
  // "Pixel 10a"). We anchor on the last alphanumeric chunk.
  const lastChunk = targetLabel.split(" ").pop() || "";
  let best: { key: string; score: number } | null = null;
  for (const key of Object.keys(cat)) {
    const kNorm = normLabel(key);
    const kLower = key.toLowerCase();
    // Lock filter
    const keyLocked = kLower.includes("carrier locked");
    if (keyLocked !== locked) continue;
    // Label must be a substring of the normalized key.
    if (!kNorm.includes(targetLabel)) continue;
    // Storage filter (only iPhones / iPads have storage in the key).
    if (storageMatters && targetStor && !kNorm.replace(/\s+/g, "").includes(targetStor)) continue;
    // Trailing-token guard: if our label ends in a number/token, the
    // candidate key must not extend that token with another alphanum.
    // E.g. target "pixel 10" must NOT match key "pixel 10a" — but it's
    // fine if the next char is a space (separator).
    if (lastChunk) {
      const idx = kNorm.indexOf(targetLabel);
      const after = kNorm.charAt(idx + targetLabel.length);
      if (after && /[a-z0-9]/.test(after)) continue;
    }
    const score = -kNorm.length; // prefer the shortest / least-specific key
    if (!best || score > best.score) best = { key, score };
  }
  if (!best) return null;
  return cat[best.key];
}

export type CellLookup = {
  sku: string;
  storage: string | null;
  condition: string;
  carrier?: "att" | "tmobile" | "other" | null;
};

// Main entry point: returns Atlas wholesale-buy value (USD) for the
// requested cell, or null when Atlas doesn't carry that variant.
export function lookupAtlasResell(
  ref: AtlasReference,
  sku: string,
  label: string,
  storage: string | null,
  condition: string,
  carrier?: "att" | "tmobile" | "other" | null,
): number | null {
  const mapping = skuToAtlas(sku, label);
  if (!mapping) return null;
  const condCol = CONDITION_MAP[mapping.category]?.[condition];
  if (!condCol) return null;
  const grades = resolveKey(ref, mapping.category, mapping.modelLabel, storage, !!carrier);
  if (!grades) return null;
  const v = grades[condCol];
  return typeof v === "number" ? v : null;
}
