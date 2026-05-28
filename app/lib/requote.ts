// Shared re-quote tables for the offer-page device editor.
//
// The funnel prices off an absolute per-condition table (app/data/prices.ts)
// — the deliberate "big-buyback-company" model, NOT global multipliers. The
// offer page can't re-run that table without the device's SKU, so when a
// customer edits condition/storage here it re-quotes by DELTA: take the
// original (locked) quote and scale by the ratio of the new vs. old tier.
// Reverting to the original specs returns the EXACT original number.
//
// NOTE these ratios only APPROXIMATE the absolute table (which sets prices
// per device, not a uniform curve), so an edited re-quote can differ
// slightly from what the funnel would show for that exact config. The
// re-quoted figure is explicitly an estimate — final price is confirmed at
// inspection. Skywalker 2026-05-20.

export type RequoteTier = { id: string; label: string; multiplier: number };

export const REQUOTE_CONDITIONS: RequoteTier[] = [
  { id: "sealed", label: "Sealed",    multiplier: 1.03 },
  { id: "mint",   label: "Excellent", multiplier: 1.00 },
  { id: "good",   label: "Good",      multiplier: 0.969 },
  { id: "fair",   label: "Fair",      multiplier: 0.852 },
  { id: "broken", label: "Broken",    multiplier: 0.50 },
];

export const REQUOTE_STORAGE: RequoteTier[] = [
  { id: "64",  label: "64 GB",  multiplier: 0.85 },
  { id: "128", label: "128 GB", multiplier: 1.00 },
  { id: "256", label: "256 GB", multiplier: 1.12 },
  { id: "512", label: "512 GB", multiplier: 1.25 },
  { id: "1tb", label: "1 TB",   multiplier: 1.40 },
  { id: "2tb", label: "2 TB",   multiplier: 1.55 },
];

// Loose label match — the lead body stores human labels ("Excellent",
// "256 GB"), sometimes with extra words. Returns the tier or undefined.
export function matchTier(tiers: RequoteTier[], label?: string): RequoteTier | undefined {
  if (!label) return undefined;
  const norm = label.trim().toLowerCase();
  return tiers.find((t) => t.label.toLowerCase() === norm)
      || tiers.find((t) => t.id === norm)
      || tiers.find((t) => norm.includes(t.label.toLowerCase()) || t.label.toLowerCase().includes(norm));
}

// Re-quote by delta. originalQuote is the locked quote tied to the
// fromCondition/fromStorage. Returns a rounded integer; if a tier
// can't be resolved that factor is simply skipped (quote unchanged
// for that dimension) rather than guessed.
export function requote(opts: {
  originalQuote: number;
  fromCondition?: string; toCondition?: string;
  fromStorage?: string;  toStorage?: string;
}): number {
  let q = opts.originalQuote;
  const fc = matchTier(REQUOTE_CONDITIONS, opts.fromCondition);
  const tc = matchTier(REQUOTE_CONDITIONS, opts.toCondition);
  if (fc && tc && fc.multiplier > 0) q = q * (tc.multiplier / fc.multiplier);
  const fs = matchTier(REQUOTE_STORAGE, opts.fromStorage);
  const ts = matchTier(REQUOTE_STORAGE, opts.toStorage);
  if (fs && ts && fs.multiplier > 0) q = q * (ts.multiplier / fs.multiplier);
  return Math.max(0, Math.round(q));
}
