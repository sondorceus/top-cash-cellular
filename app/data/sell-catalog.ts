// =========================================================================
// SELL CATALOG — shared device list + OEM trade-in comparison helpers.
// =========================================================================
// Extracted from app/sell/[slug]/page.tsx 2026-06-19 so the per-device
// pages AND the Austin SEO landing pages (/sell-iphone-austin, etc.) read
// one source of truth for headline prices and the "we beat {OEM}" logic.
// Headline prices here are synced from the main catalog (app/data/prices.ts
// is the pricing SoT for the funnel; these are the display "up to" numbers).
// =========================================================================
import appleTradeIn from "../../public/comps/apple-trade-in.json";
import samsungTradeIn from "../../public/comps/samsung-trade-in.json";
import googleTradeIn from "../../public/comps/google-trade-in.json";

export type Device = {
  slug: string;
  name: string;
  category: string;
  price: number;
  year: number;
};


// Slug -> OEM trade-in model id, for the subset of devices that have a
// brand-direct trade-in program. If a slug isn't in the map (or the OEM
// JSON doesn't list the model id), the per-slug page WILL NOT make any
// "we pay more than {OEM}" claim — keeps the marketing honest when the
// OEM either doesn't accept the device or pays more than us.
export const OEM_SLUG_TO_MODEL: Record<string, { oem: "apple" | "samsung" | "google"; modelId: string }> = {
  // iPhones — Apple Trade-In
  "iphone-17-pro-max": { oem: "apple", modelId: "ip17pm" },
  "iphone-17-pro": { oem: "apple", modelId: "ip17p" },
  "iphone-17-air": { oem: "apple", modelId: "ip17air" },
  "iphone-17": { oem: "apple", modelId: "ip17" },
  "iphone-17e": { oem: "apple", modelId: "ip17e" },
  "iphone-16-pro-max": { oem: "apple", modelId: "ip16pm" },
  "iphone-16-pro": { oem: "apple", modelId: "ip16p" },
  "iphone-16-plus": { oem: "apple", modelId: "ip16plus" },
  "iphone-16": { oem: "apple", modelId: "ip16" },
  "iphone-16e": { oem: "apple", modelId: "ip16e" },
  "iphone-15-pro-max": { oem: "apple", modelId: "ip15pm" },
  "iphone-15-pro": { oem: "apple", modelId: "ip15p" },
  "iphone-15-plus": { oem: "apple", modelId: "ip15plus" },
  "iphone-15": { oem: "apple", modelId: "ip15" },
  "iphone-14-pro-max": { oem: "apple", modelId: "ip14pm" },
  "iphone-14-pro": { oem: "apple", modelId: "ip14p" },
  "iphone-14-plus": { oem: "apple", modelId: "ip14plus" },
  "iphone-14": { oem: "apple", modelId: "ip14" },
  "iphone-13-pro-max": { oem: "apple", modelId: "ip13pm" },
  "iphone-13-pro": { oem: "apple", modelId: "ip13p" },
  "iphone-13": { oem: "apple", modelId: "ip13" },
  "iphone-12-pro-max": { oem: "apple", modelId: "ip12pm" },
  "iphone-12-pro": { oem: "apple", modelId: "ip12p" },
  "iphone-12": { oem: "apple", modelId: "ip12" },
  "iphone-12-mini": { oem: "apple", modelId: "ip12mini" },
  "iphone-11-pro-max": { oem: "apple", modelId: "ip11pm" },
  "iphone-11-pro": { oem: "apple", modelId: "ip11p" },
  "iphone-11": { oem: "apple", modelId: "ip11" },

  // Samsung Galaxy S — Samsung Trade-In
  "galaxy-s26-ultra": { oem: "samsung", modelId: "gs26u" },
  "galaxy-s25-ultra": { oem: "samsung", modelId: "gs25u" },
  "galaxy-s24-ultra": { oem: "samsung", modelId: "gs24u" },
  "galaxy-s23-ultra": { oem: "samsung", modelId: "gs23u" },
  "galaxy-s22-ultra": { oem: "samsung", modelId: "gs22u" },
  "galaxy-s21-ultra": { oem: "samsung", modelId: "gs21u" },
  "galaxy-s20-ultra": { oem: "samsung", modelId: "gs20u" },
  "galaxy-s25-edge":  { oem: "samsung", modelId: "gs25edge" },
  "galaxy-s26-plus":  { oem: "samsung", modelId: "gs26p" },
  "galaxy-s25-plus":  { oem: "samsung", modelId: "gs25p" },
  "galaxy-s24-plus":  { oem: "samsung", modelId: "gs24p" },
  "galaxy-s23-plus":  { oem: "samsung", modelId: "gs23p" },
  "galaxy-s22-plus":  { oem: "samsung", modelId: "gs22p" },
  "galaxy-s21-plus":  { oem: "samsung", modelId: "gs21p" },
  "galaxy-s20-plus":  { oem: "samsung", modelId: "gs20p" },
  "galaxy-s26":       { oem: "samsung", modelId: "gs26" },
  "galaxy-s25":       { oem: "samsung", modelId: "gs25" },
  "galaxy-s24":       { oem: "samsung", modelId: "gs24" },
  "galaxy-s23":       { oem: "samsung", modelId: "gs23" },
  "galaxy-s22":       { oem: "samsung", modelId: "gs22" },
  "galaxy-s21":       { oem: "samsung", modelId: "gs21" },
  "galaxy-s20":       { oem: "samsung", modelId: "gs20" },
  "galaxy-s25-fe":    { oem: "samsung", modelId: "gs25fe" },
  "galaxy-s24-fe":    { oem: "samsung", modelId: "gs24fe" },
  "galaxy-s23-fe":    { oem: "samsung", modelId: "gs23fe" },
  "galaxy-s21-fe":    { oem: "samsung", modelId: "gs21fe" },
  "galaxy-s20-fe":    { oem: "samsung", modelId: "gs20fe" },
  // Samsung Galaxy Z (foldables) — Samsung Trade-In
  "galaxy-z-trifold": { oem: "samsung", modelId: "gztrifold" },
  "galaxy-z-fold-7":  { oem: "samsung", modelId: "gzfold7" },
  "galaxy-z-fold-6":  { oem: "samsung", modelId: "gzfold6" },
  "galaxy-z-fold-5":  { oem: "samsung", modelId: "gzfold5" },
  "galaxy-z-fold-4":  { oem: "samsung", modelId: "gzfold4" },
  "galaxy-z-fold-3":  { oem: "samsung", modelId: "gzfold3" },
  "galaxy-z-flip-7":  { oem: "samsung", modelId: "gzflip7" },
  "galaxy-z-flip-6":  { oem: "samsung", modelId: "gzflip6" },
  "galaxy-z-flip-5":  { oem: "samsung", modelId: "gzflip5" },
  "galaxy-z-flip-4":  { oem: "samsung", modelId: "gzflip4" },
  "galaxy-z-flip-3":  { oem: "samsung", modelId: "gzflip3" },
  // Galaxy Note — Samsung Trade-In
  "galaxy-note-20-ultra-5g": { oem: "samsung", modelId: "gnote20u" },
  "galaxy-note-20-5g":       { oem: "samsung", modelId: "gnote20" },
  "galaxy-note-10-plus-5g":  { oem: "samsung", modelId: "gnote10p5g" },
  "galaxy-note-10-plus":     { oem: "samsung", modelId: "gnote10p" },
  "galaxy-note-10":          { oem: "samsung", modelId: "gnote10" },
  "galaxy-note-9":           { oem: "samsung", modelId: "gnote9" },

  // Google Pixel — Google Store Trade-In
  "pixel-10-pro-xl":   { oem: "google", modelId: "px10pxl" },
  "pixel-10-pro":      { oem: "google", modelId: "px10p" },
  "pixel-10":          { oem: "google", modelId: "px10" },
  "pixel-10-pro-fold": { oem: "google", modelId: "px10pfold" },
  "pixel-9-pro-xl":    { oem: "google", modelId: "px9pxl" },
  "pixel-9-pro":       { oem: "google", modelId: "px9p" },
  "pixel-9-pro-fold":  { oem: "google", modelId: "px9pfold" },
  "pixel-9":           { oem: "google", modelId: "px9" },
  "pixel-9a":          { oem: "google", modelId: "px9a" },
  "pixel-8-pro":       { oem: "google", modelId: "px8p" },
  "pixel-8":           { oem: "google", modelId: "px8" },
  "pixel-8a":          { oem: "google", modelId: "px8a" },
  "pixel-fold":        { oem: "google", modelId: "pxfold" },
  "pixel-7-pro":       { oem: "google", modelId: "px7p" },
  "pixel-7":           { oem: "google", modelId: "px7" },
  "pixel-7a":          { oem: "google", modelId: "px7a" },
  "pixel-6-pro":       { oem: "google", modelId: "px6p" },
  "pixel-6":           { oem: "google", modelId: "px6" },
  "pixel-5":           { oem: "google", modelId: "px5" },
  "pixel-5a-5g":       { oem: "google", modelId: "px5a" },

  // MacBook — Apple Trade-In
  "macbook-pro-16-m5-pro-max-2026": { oem: "apple", modelId: "mbp16_m5pmax_2026" },
  "macbook-pro-14-m5-pro-max-2026": { oem: "apple", modelId: "mbp14_m5pmax_2026" },
  "macbook-pro-14-m5-2025":         { oem: "apple", modelId: "mbp14_m5_2025" },
  "macbook-pro-16-m4-2024":         { oem: "apple", modelId: "mbp16m4" },
  "macbook-pro-14-m4-2024":         { oem: "apple", modelId: "mbp14m4" },
  "macbook-pro-16-m3-2023":         { oem: "apple", modelId: "mbp16m3" },
  "macbook-pro-14-m3-2023":         { oem: "apple", modelId: "mbp14m3" },
  "macbook-pro-16-m2-2023":         { oem: "apple", modelId: "mbp16m2" },
  "macbook-pro-14-m2-2023":         { oem: "apple", modelId: "mbp14m2" },
  "macbook-pro-13-m1-2020":         { oem: "apple", modelId: "mbp13m1" },
  "macbook-air-m5-2026":            { oem: "apple", modelId: "mba_m5_2026" },
  "macbook-air-15-m3-2024":         { oem: "apple", modelId: "mba15m3" },
  "macbook-air-13-m3-2024":         { oem: "apple", modelId: "mba13m3" },
  "macbook-air-15-m2-2023":         { oem: "apple", modelId: "mba15m2" },
  "macbook-air-13-m2-2022":         { oem: "apple", modelId: "mba13m2" },
  "macbook-air-13-m1-2020":         { oem: "apple", modelId: "mba13m1" },

  // iPad — Apple Trade-In
  "ipad-pro-13-m5":  { oem: "apple", modelId: "ipadpro13m5" },
  "ipad-pro-11-m5":  { oem: "apple", modelId: "ipadpro11m5" },
  "ipad-pro-13-m4":  { oem: "apple", modelId: "ipadpro13m4" },
  "ipad-pro-11-m4":  { oem: "apple", modelId: "ipadpro11m4" },
  "ipad-air-13-m4":  { oem: "apple", modelId: "ipadair13m4" },
  "ipad-air-11-m4":  { oem: "apple", modelId: "ipadair11m4" },
  "ipad-air-13-m3":  { oem: "apple", modelId: "ipadair13m3" },
  "ipad-air-11-m3":  { oem: "apple", modelId: "ipadair11m3" },
  "ipad-air-13-m2":  { oem: "apple", modelId: "ipadair13m2" },
  "ipad-air-11-m2":  { oem: "apple", modelId: "ipadair11m2" },
  "ipad-mini-7th-gen": { oem: "apple", modelId: "ipadmini7" },

  // Apple Watch — Apple Trade-In
  "apple-watch-ultra-3":  { oem: "apple", modelId: "aw_ultra3" },
  "apple-watch-ultra-2":  { oem: "apple", modelId: "aw_ultra2" },
  "apple-watch-ultra":    { oem: "apple", modelId: "aw_ultra" },
  "apple-watch-series-10": { oem: "apple", modelId: "aw_s10" },
  "apple-watch-series-9":  { oem: "apple", modelId: "aw_s9" },
  "apple-watch-series-8":  { oem: "apple", modelId: "aw_s8" },
  "apple-watch-series-7":  { oem: "apple", modelId: "aw_s7" },
  "apple-watch-se-2nd-gen": { oem: "apple", modelId: "aw_se2022" },
};

export type OemComparison =
  | { kind: "we-beat"; oem: "Apple" | "Samsung" | "Google"; diff: number }
  | { kind: "wont-trade"; oem: "Apple" | "Samsung" | "Google" }
  | { kind: "none" };

export function getOemComparison(slug: string, devicePrice: number): OemComparison {
  const entry = OEM_SLUG_TO_MODEL[slug];
  if (!entry) return { kind: "none" };
  const oemPretty = (entry.oem.charAt(0).toUpperCase() + entry.oem.slice(1)) as "Apple" | "Samsung" | "Google";
  const values =
    entry.oem === "apple" ? (appleTradeIn as { values: Record<string, number> }).values :
    entry.oem === "samsung" ? (samsungTradeIn as { values: Record<string, number> }).values :
    (googleTradeIn as { values: Record<string, number> }).values;
  const oemValue = values[entry.modelId];
  // OEM doesn't list the model -> they don't accept it on trade-in.
  // Strong marketing angle: "they won't take it, we will".
  if (typeof oemValue !== "number") return { kind: "wont-trade", oem: oemPretty };
  // OEM lists it AND we beat them at our headline price -> "we pay more".
  if (devicePrice > oemValue) return { kind: "we-beat", oem: oemPretty, diff: devicePrice - oemValue };
  // OEM pays as much or more than our headline. Don't claim anything.
  return { kind: "none" };
}

export const DEVICES: Device[] = [
  // ── iPhone (synced from main catalog 2026-05-11) ──
  { slug: "iphone-17-pro-max", name: "iPhone 17 Pro Max", category: "iPhone", price: 1250, year: 2025 },
  { slug: "iphone-17-pro", name: "iPhone 17 Pro", category: "iPhone", price: 619, year: 2025 },
  { slug: "iphone-17-air", name: "iPhone 17 Air", category: "iPhone", price: 835, year: 2025 },
  { slug: "iphone-17", name: "iPhone 17", category: "iPhone", price: 453, year: 2025 },
  { slug: "iphone-17e", name: "iPhone 17E", category: "iPhone", price: 335, year: 2025 },
  { slug: "iphone-16-pro-max", name: "iPhone 16 Pro Max", category: "iPhone", price: 470, year: 2024 },
  { slug: "iphone-16-pro", name: "iPhone 16 Pro", category: "iPhone", price: 416, year: 2024 },
  { slug: "iphone-16-plus", name: "iPhone 16 Plus", category: "iPhone", price: 279, year: 2024 },
  { slug: "iphone-16", name: "iPhone 16", category: "iPhone", price: 339, year: 2024 },
  { slug: "iphone-16e", name: "iPhone 16E", category: "iPhone", price: 390, year: 2024 },
  { slug: "iphone-15-pro-max", name: "iPhone 15 Pro Max", category: "iPhone", price: 343, year: 2023 },
  { slug: "iphone-15-pro", name: "iPhone 15 Pro", category: "iPhone", price: 345, year: 2023 },
  { slug: "iphone-15-plus", name: "iPhone 15 Plus", category: "iPhone", price: 314, year: 2023 },
  { slug: "iphone-15", name: "iPhone 15", category: "iPhone", price: 228, year: 2023 },
  { slug: "iphone-14-pro-max", name: "iPhone 14 Pro Max", category: "iPhone", price: 272, year: 2022 },
  { slug: "iphone-14-pro", name: "iPhone 14 Pro", category: "iPhone", price: 234, year: 2022 },
  { slug: "iphone-14-plus", name: "iPhone 14 Plus", category: "iPhone", price: 242, year: 2022 },
  { slug: "iphone-14", name: "iPhone 14", category: "iPhone", price: 175, year: 2022 },
  { slug: "iphone-13-pro-max", name: "iPhone 13 Pro Max", category: "iPhone", price: 300, year: 2021 },
  { slug: "iphone-13-pro", name: "iPhone 13 Pro", category: "iPhone", price: 261, year: 2021 },
  { slug: "iphone-13", name: "iPhone 13", category: "iPhone", price: 215, year: 2021 },
  { slug: "iphone-12-pro-max", name: "iPhone 12 Pro Max", category: "iPhone", price: 240, year: 2020 },
  { slug: "iphone-12-pro", name: "iPhone 12 Pro", category: "iPhone", price: 193, year: 2020 },
  { slug: "iphone-12", name: "iPhone 12", category: "iPhone", price: 142, year: 2020 },
  { slug: "iphone-12-mini", name: "iPhone 12 Mini", category: "iPhone", price: 139, year: 2020 },
  { slug: "iphone-11-pro-max", name: "iPhone 11 Pro Max", category: "iPhone", price: 180, year: 2019 },
  { slug: "iphone-11-pro", name: "iPhone 11 Pro", category: "iPhone", price: 150, year: 2019 },
  { slug: "iphone-11", name: "iPhone 11", category: "iPhone", price: 129, year: 2019 },

  // ── Samsung Galaxy S Series ──
  { slug: "galaxy-s26-ultra", name: "Galaxy S26 Ultra", category: "Samsung", price: 530, year: 2026 },
  { slug: "galaxy-s25-ultra", name: "Galaxy S25 Ultra", category: "Samsung", price: 391, year: 2025 },
  { slug: "galaxy-s24-ultra", name: "Galaxy S24 Ultra", category: "Samsung", price: 280, year: 2024 },
  { slug: "galaxy-s23-ultra", name: "Galaxy S23 Ultra", category: "Samsung", price: 239, year: 2023 },
  { slug: "galaxy-s22-ultra", name: "Galaxy S22 Ultra", category: "Samsung", price: 305, year: 2022 },
  { slug: "galaxy-s21-ultra", name: "Galaxy S21 Ultra", category: "Samsung", price: 137, year: 2021 },
  { slug: "galaxy-s20-ultra", name: "Galaxy S20 Ultra", category: "Samsung", price: 191, year: 2020 },
  { slug: "galaxy-s25-edge", name: "Galaxy S25 Edge", category: "Samsung", price: 332, year: 2025 },
  { slug: "galaxy-s26-plus", name: "Galaxy S26+", category: "Samsung", price: 490, year: 2026 },
  { slug: "galaxy-s25-plus", name: "Galaxy S25+", category: "Samsung", price: 391, year: 2025 },
  { slug: "galaxy-s24-plus", name: "Galaxy S24+", category: "Samsung", price: 197, year: 2024 },
  { slug: "galaxy-s23-plus", name: "Galaxy S23+", category: "Samsung", price: 191, year: 2023 },
  { slug: "galaxy-s22-plus", name: "Galaxy S22+", category: "Samsung", price: 173, year: 2022 },
  { slug: "galaxy-s21-plus", name: "Galaxy S21+", category: "Samsung", price: 143, year: 2021 },
  { slug: "galaxy-s20-plus", name: "Galaxy S20+", category: "Samsung", price: 155, year: 2020 },
  { slug: "galaxy-s26", name: "Galaxy S26", category: "Samsung", price: 409, year: 2026 },
  { slug: "galaxy-s25", name: "Galaxy S25", category: "Samsung", price: 243, year: 2025 },
  { slug: "galaxy-s24", name: "Galaxy S24", category: "Samsung", price: 212, year: 2024 },
  { slug: "galaxy-s23", name: "Galaxy S23", category: "Samsung", price: 157, year: 2023 },
  { slug: "galaxy-s22", name: "Galaxy S22", category: "Samsung", price: 133, year: 2022 },
  { slug: "galaxy-s21", name: "Galaxy S21", category: "Samsung", price: 111, year: 2021 },
  { slug: "galaxy-s20", name: "Galaxy S20", category: "Samsung", price: 115, year: 2020 },
  { slug: "galaxy-s25-fe", name: "Galaxy S25 FE", category: "Samsung", price: 240, year: 2025 },
  { slug: "galaxy-s24-fe", name: "Galaxy S24 FE", category: "Samsung", price: 214, year: 2024 },
  { slug: "galaxy-s23-fe", name: "Galaxy S23 FE", category: "Samsung", price: 133, year: 2023 },
  { slug: "galaxy-s21-fe", name: "Galaxy S21 FE", category: "Samsung", price: 97, year: 2021 },
  { slug: "galaxy-s20-fe", name: "Galaxy S20 FE", category: "Samsung", price: 106, year: 2020 },

  // ── Samsung Galaxy Z Series ──
  { slug: "galaxy-z-trifold", name: "Galaxy Z TriFold", category: "Samsung", price: 2163, year: 2025 },
  { slug: "galaxy-z-fold-7", name: "Galaxy Z Fold 7", category: "Samsung", price: 715, year: 2025 },
  { slug: "galaxy-z-fold-6", name: "Galaxy Z Fold 6", category: "Samsung", price: 454, year: 2024 },
  { slug: "galaxy-z-fold-5", name: "Galaxy Z Fold 5", category: "Samsung", price: 265, year: 2023 },
  { slug: "galaxy-z-fold-4", name: "Galaxy Z Fold 4", category: "Samsung", price: 225, year: 2022 },
  { slug: "galaxy-z-fold-3", name: "Galaxy Z Fold 3", category: "Samsung", price: 205, year: 2021 },
  { slug: "galaxy-z-flip-7", name: "Galaxy Z Flip 7", category: "Samsung", price: 418, year: 2025 },
  { slug: "galaxy-z-flip-6", name: "Galaxy Z Flip 6", category: "Samsung", price: 256, year: 2024 },
  { slug: "galaxy-z-flip-5", name: "Galaxy Z Flip 5", category: "Samsung", price: 238, year: 2023 },
  { slug: "galaxy-z-flip-4", name: "Galaxy Z Flip 4", category: "Samsung", price: 83, year: 2022 },
  { slug: "galaxy-z-flip-3", name: "Galaxy Z Flip 3", category: "Samsung", price: 93, year: 2021 },

  // ── Samsung Galaxy Note Series ──
  { slug: "galaxy-note-20-ultra-5g", name: "Galaxy Note 20 Ultra 5G", category: "Samsung", price: 126, year: 2020 },
  { slug: "galaxy-note-20-5g", name: "Galaxy Note 20 5G", category: "Samsung", price: 155, year: 2020 },
  { slug: "galaxy-note-10-plus-5g", name: "Galaxy Note 10+ 5G", category: "Samsung", price: 183, year: 2019 },
  { slug: "galaxy-note-10-plus", name: "Galaxy Note 10+", category: "Samsung", price: 183, year: 2019 },
  { slug: "galaxy-note-10", name: "Galaxy Note 10", category: "Samsung", price: 124, year: 2019 },
  { slug: "galaxy-note-9", name: "Galaxy Note 9", category: "Samsung", price: 138, year: 2018 },

  // ── Google Pixel Pro Series ──
  { slug: "pixel-10-pro-xl", name: "Pixel 10 Pro XL", category: "Pixel", price: 429, year: 2025 },
  { slug: "pixel-10-pro", name: "Pixel 10 Pro", category: "Pixel", price: 370, year: 2025 },
  { slug: "pixel-9-pro-xl", name: "Pixel 9 Pro XL", category: "Pixel", price: 256, year: 2024 },
  { slug: "pixel-9-pro", name: "Pixel 9 Pro", category: "Pixel", price: 245, year: 2024 },
  { slug: "pixel-8-pro", name: "Pixel 8 Pro", category: "Pixel", price: 147, year: 2023 },
  { slug: "pixel-7-pro", name: "Pixel 7 Pro", category: "Pixel", price: 173, year: 2022 },
  { slug: "pixel-6-pro", name: "Pixel 6 Pro", category: "Pixel", price: 142, year: 2021 },

  // ── Google Pixel Standard / a-series ──
  { slug: "pixel-10", name: "Pixel 10", category: "Pixel", price: 206, year: 2025 },
  { slug: "pixel-10a", name: "Pixel 10a", category: "Pixel", price: 273, year: 2025 },
  { slug: "pixel-9", name: "Pixel 9", category: "Pixel", price: 137, year: 2024 },
  { slug: "pixel-9a", name: "Pixel 9a", category: "Pixel", price: 237, year: 2024 },
  { slug: "pixel-8", name: "Pixel 8", category: "Pixel", price: 214, year: 2023 },
  { slug: "pixel-8a", name: "Pixel 8a", category: "Pixel", price: 209, year: 2023 },
  { slug: "pixel-7", name: "Pixel 7", category: "Pixel", price: 133, year: 2022 },
  { slug: "pixel-7a", name: "Pixel 7a", category: "Pixel", price: 124, year: 2022 },
  { slug: "pixel-6", name: "Pixel 6", category: "Pixel", price: 124, year: 2021 },
  { slug: "pixel-5", name: "Pixel 5", category: "Pixel", price: 79, year: 2020 },
  { slug: "pixel-5a-5g", name: "Pixel 5a (5G)", category: "Pixel", price: 75, year: 2021 },

  // ── Google Pixel Fold Series ──
  { slug: "pixel-10-pro-fold", name: "Pixel 10 Pro Fold", category: "Pixel", price: 800, year: 2025 },
  { slug: "pixel-9-pro-fold", name: "Pixel 9 Pro Fold", category: "Pixel", price: 382, year: 2024 },
  { slug: "pixel-fold", name: "Pixel Fold", category: "Pixel", price: 273, year: 2023 },

  // ── MacBook Pro ──
  { slug: "macbook-pro-16-m5-pro-max-2026", name: "MacBook Pro 16\" M5 Pro/Max (2026)", category: "MacBook", price: 1737, year: 2026 },
  { slug: "macbook-pro-14-m5-pro-max-2026", name: "MacBook Pro 14\" M5 Pro/Max (2026)", category: "MacBook", price: 1334, year: 2026 },
  { slug: "macbook-pro-14-m5-2025", name: "MacBook Pro 14\" M5 (2025)", category: "MacBook", price: 1043, year: 2025 },
  { slug: "macbook-pro-16-m4-2024", name: "MacBook Pro 16\" M4 (2024)", category: "MacBook", price: 1456, year: 2024 },
  { slug: "macbook-pro-14-m4-2024", name: "MacBook Pro 14\" M4 (2024)", category: "MacBook", price: 768, year: 2024 },
  { slug: "macbook-pro-16-m3-2023", name: "MacBook Pro 16\" M3 (2023)", category: "MacBook", price: 847, year: 2023 },
  { slug: "macbook-pro-14-m3-2023", name: "MacBook Pro 14\" M3 (2023)", category: "MacBook", price: 635, year: 2023 },
  { slug: "macbook-pro-16-m2-2023", name: "MacBook Pro 16\" M2 (2023)", category: "MacBook", price: 604, year: 2023 },
  { slug: "macbook-pro-14-m2-2023", name: "MacBook Pro 14\" M2 (2023)", category: "MacBook", price: 445, year: 2023 },
  { slug: "macbook-pro-13-m1-2020", name: "MacBook Pro 13\" M1 (2020)", category: "MacBook", price: 180, year: 2020 },

  // ── MacBook Air ──
  { slug: "macbook-air-m5-2026", name: "MacBook Air M5 (13\" & 15\", 2026)", category: "MacBook", price: 662, year: 2026 },
  { slug: "macbook-air-m4-2025", name: "MacBook Air M4 (13\" & 15\", 2025)", category: "MacBook", price: 498, year: 2025 },
  { slug: "macbook-air-15-m3-2024", name: "MacBook Air 15\" M3 (2024)", category: "MacBook", price: 540, year: 2024 },
  { slug: "macbook-air-13-m3-2024", name: "MacBook Air 13\" M3 (2024)", category: "MacBook", price: 365, year: 2024 },
  { slug: "macbook-air-15-m2-2023", name: "MacBook Air 15\" M2 (2023)", category: "MacBook", price: 328, year: 2023 },
  { slug: "macbook-air-13-m2-2022", name: "MacBook Air 13\" M2 (2022)", category: "MacBook", price: 297, year: 2022 },
  { slug: "macbook-air-13-m1-2020", name: "MacBook Air 13\" M1 (2020)", category: "MacBook", price: 212, year: 2020 },

  // ── Dell Laptops ──
  { slug: "dell-xps-17-2024", name: "Dell XPS 17 (2024)", category: "Dell", price: 750, year: 2024 },
  { slug: "dell-xps-15-2024", name: "Dell XPS 15 (2024)", category: "Dell", price: 620, year: 2024 },
  { slug: "dell-xps-13-2024", name: "Dell XPS 13 (2024)", category: "Dell", price: 480, year: 2024 },
  { slug: "dell-xps-15-2023", name: "Dell XPS 15 (2023)", category: "Dell", price: 500, year: 2023 },
  { slug: "dell-xps-13-2023", name: "Dell XPS 13 (2023)", category: "Dell", price: 380, year: 2023 },
  { slug: "dell-latitude-7440", name: "Dell Latitude 7440", category: "Dell", price: 420, year: 2023 },
  { slug: "dell-latitude-5540", name: "Dell Latitude 5540", category: "Dell", price: 300, year: 2023 },
  { slug: "dell-inspiron-16-plus", name: "Dell Inspiron 16 Plus", category: "Dell", price: 350, year: 2023 },
  { slug: "dell-inspiron-15", name: "Dell Inspiron 15", category: "Dell", price: 220, year: 2023 },
  { slug: "dell-inspiron-14", name: "Dell Inspiron 14", category: "Dell", price: 200, year: 2023 },

  // ── iPad ──
  { slug: "ipad-pro-13-m5", name: "iPad Pro 13\" M5", category: "iPad", price: 610, year: 2025 },
  { slug: "ipad-pro-11-m5", name: "iPad Pro 11\" M5", category: "iPad", price: 475, year: 2025 },
  { slug: "ipad-pro-13-m4", name: "iPad Pro 13\" M4", category: "iPad", price: 500, year: 2024 },
  { slug: "ipad-pro-11-m4", name: "iPad Pro 11\" M4", category: "iPad", price: 350, year: 2024 },
  { slug: "ipad-pro-12-9-6th-gen", name: "iPad Pro 12.9\" 6th Gen", category: "iPad", price: 270, year: 2022 },
  { slug: "ipad-pro-11-4th-gen", name: "iPad Pro 11\" 4th Gen", category: "iPad", price: 225, year: 2022 },
  { slug: "ipad-air-13-m3", name: "iPad Air 13\" M3", category: "iPad", price: 360, year: 2025 },
  { slug: "ipad-air-11-m3", name: "iPad Air 11\" M3", category: "iPad", price: 275, year: 2025 },
  { slug: "ipad-air-13-m2", name: "iPad Air 13\" M2", category: "iPad", price: 275, year: 2024 },
  { slug: "ipad-air-11-m2", name: "iPad Air 11\" M2", category: "iPad", price: 200, year: 2024 },
  { slug: "ipad-mini-7th-gen", name: "iPad Mini 7th Gen", category: "iPad", price: 412, year: 2024 },
  { slug: "ipad-mini-6th-gen", name: "iPad Mini 6th Gen", category: "iPad", price: 209, year: 2021 },
  { slug: "ipad-11th-gen", name: "iPad 11th Gen", category: "iPad", price: 322, year: 2025 },
  { slug: "ipad-10th-gen", name: "iPad 10th Gen", category: "iPad", price: 223, year: 2022 },
  { slug: "ipad-9th-gen", name: "iPad 9th Gen", category: "iPad", price: 119, year: 2021 },

  // ── Consoles ──
  { slug: "playstation-5-pro", name: "PlayStation 5 Pro", category: "Console", price: 495, year: 2024 },
  { slug: "playstation-5-slim", name: "PlayStation 5 Slim", category: "Console", price: 252, year: 2023 },
  { slug: "playstation-5", name: "PlayStation 5", category: "Console", price: 270, year: 2020 },
  { slug: "playstation-4-pro", name: "PlayStation 4 Pro", category: "Console", price: 135, year: 2016 },
  { slug: "playstation-4", name: "PlayStation 4", category: "Console", price: 63, year: 2013 },
  { slug: "xbox-series-x", name: "Xbox Series X", category: "Console", price: 428, year: 2020 },
  { slug: "xbox-series-s", name: "Xbox Series S", category: "Console", price: 220, year: 2020 },
  { slug: "xbox-one", name: "Xbox One", category: "Console", price: 117, year: 2013 },
  { slug: "nintendo-switch-oled", name: "Nintendo Switch OLED", category: "Console", price: 112, year: 2021 },
  { slug: "nintendo-switch-v2", name: "Nintendo Switch V2", category: "Console", price: 108, year: 2019 },
  { slug: "nintendo-switch-lite", name: "Nintendo Switch Lite", category: "Console", price: 68, year: 2019 },

  // ── Apple Watch ──
  { slug: "apple-watch-ultra-3", name: "Apple Watch Ultra 3", category: "Watch", price: 319, year: 2025 },
  { slug: "apple-watch-ultra-2", name: "Apple Watch Ultra 2", category: "Watch", price: 204, year: 2023 },
  { slug: "apple-watch-ultra", name: "Apple Watch Ultra", category: "Watch", price: 130, year: 2022 },
  { slug: "apple-watch-series-10", name: "Apple Watch Series 10", category: "Watch", price: 106, year: 2024 },
  { slug: "apple-watch-series-9", name: "Apple Watch Series 9", category: "Watch", price: 75, year: 2023 },
  { slug: "apple-watch-series-8", name: "Apple Watch Series 8", category: "Watch", price: 60, year: 2022 },
  { slug: "apple-watch-series-7", name: "Apple Watch Series 7", category: "Watch", price: 38, year: 2021 },
  { slug: "apple-watch-se-2nd-gen", name: "Apple Watch SE (2nd Gen)", category: "Watch", price: 38, year: 2022 },
  { slug: "apple-watch-se-1st-gen", name: "Apple Watch SE (1st Gen)", category: "Watch", price: 80, year: 2020 },

  // ── Samsung Watch ──
  { slug: "galaxy-watch-ultra", name: "Galaxy Watch Ultra", category: "Watch", price: 112, year: 2024 },
  { slug: "galaxy-watch-7", name: "Galaxy Watch 7", category: "Watch", price: 36, year: 2024 },

  // ── Pixel Watch ──
  { slug: "pixel-watch-3", name: "Pixel Watch 3", category: "Watch", price: 58, year: 2024 },
  { slug: "pixel-watch-2", name: "Pixel Watch 2", category: "Watch", price: 32, year: 2023 },
  { slug: "pixel-watch", name: "Pixel Watch", category: "Watch", price: 32, year: 2022 },

  // ── Alienware Desktops ──
  { slug: "alienware-aurora-r16", name: "Alienware Aurora R16", category: "Desktop", price: 800, year: 2023 },
  { slug: "alienware-aurora-r15", name: "Alienware Aurora R15", category: "Desktop", price: 600, year: 2022 },
  { slug: "alienware-aurora-r13", name: "Alienware Aurora R13", category: "Desktop", price: 450, year: 2022 },

  // ── MSI Desktops ──
  { slug: "msi-meg-trident-x2", name: "MSI MEG Trident X2", category: "Desktop", price: 900, year: 2023 },
  { slug: "msi-mag-trident-s5", name: "MSI MAG Trident S5", category: "Desktop", price: 550, year: 2023 },
  { slug: "msi-mag-codex-6", name: "MSI MAG Codex 6", category: "Desktop", price: 650, year: 2023 },
  { slug: "msi-mag-codex-5", name: "MSI MAG Codex 5", category: "Desktop", price: 450, year: 2022 },
  { slug: "msi-pro-dp180", name: "MSI PRO DP180", category: "Desktop", price: 300, year: 2023 },
];

// ── Lookup helpers ───────────────────────────────────────────────────────

export function getDevice(slug: string): Device | undefined {
  return DEVICES.find((d) => d.slug === slug);
}

export function devicesByCategory(category: string): Device[] {
  return DEVICES.filter((d) => d.category === category);
}

// Top N devices in a category by headline price (highest first) — used by
// the landing pages to show the most valuable / most-searched models.
export function topDevicesByCategory(category: string, n: number): Device[] {
  return devicesByCategory(category)
    .slice()
    .sort((a, b) => b.price - a.price)
    .slice(0, n);
}

// Highest headline price across a set of slugs (or a whole category) — the
// honest "up to $X" hero number, sourced from the catalog, never invented.
export function maxPrice(devices: Device[]): number {
  return devices.reduce((m, d) => Math.max(m, d.price), 0);
}
