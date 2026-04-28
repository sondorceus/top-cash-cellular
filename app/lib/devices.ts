export type Device = {
  slug: string;
  name: string;
  category: "iPhone" | "Samsung" | "MacBook" | "Console";
  price: number;
  year: number;
};

export const DEVICES: Device[] = [
  { slug: "iphone-17-pro-max", name: "iPhone 17 Pro Max", category: "iPhone", price: 580, year: 2025 },
  { slug: "iphone-17-pro", name: "iPhone 17 Pro", category: "iPhone", price: 500, year: 2025 },
  { slug: "iphone-17", name: "iPhone 17", category: "iPhone", price: 400, year: 2025 },
  { slug: "iphone-16-pro-max", name: "iPhone 16 Pro Max", category: "iPhone", price: 500, year: 2024 },
  { slug: "iphone-16-pro", name: "iPhone 16 Pro", category: "iPhone", price: 420, year: 2024 },
  { slug: "iphone-16", name: "iPhone 16", category: "iPhone", price: 350, year: 2024 },
  { slug: "iphone-15-pro-max", name: "iPhone 15 Pro Max", category: "iPhone", price: 310, year: 2023 },
  { slug: "iphone-15-pro", name: "iPhone 15 Pro", category: "iPhone", price: 260, year: 2023 },
  { slug: "iphone-15", name: "iPhone 15", category: "iPhone", price: 210, year: 2023 },
  { slug: "iphone-14-pro-max", name: "iPhone 14 Pro Max", category: "iPhone", price: 250, year: 2022 },
  { slug: "iphone-14-pro", name: "iPhone 14 Pro", category: "iPhone", price: 210, year: 2022 },
  { slug: "iphone-14", name: "iPhone 14", category: "iPhone", price: 160, year: 2022 },
  { slug: "iphone-13-pro-max", name: "iPhone 13 Pro Max", category: "iPhone", price: 200, year: 2021 },
  { slug: "iphone-13", name: "iPhone 13", category: "iPhone", price: 140, year: 2021 },
  { slug: "iphone-12", name: "iPhone 12", category: "iPhone", price: 100, year: 2020 },
  { slug: "iphone-11", name: "iPhone 11", category: "iPhone", price: 80, year: 2019 },
  { slug: "samsung-galaxy-s24-ultra", name: "Samsung Galaxy S24 Ultra", category: "Samsung", price: 500, year: 2024 },
  { slug: "samsung-galaxy-s24", name: "Samsung Galaxy S24", category: "Samsung", price: 320, year: 2024 },
  { slug: "samsung-galaxy-s23-ultra", name: "Samsung Galaxy S23 Ultra", category: "Samsung", price: 350, year: 2023 },
  { slug: "samsung-galaxy-s23", name: "Samsung Galaxy S23", category: "Samsung", price: 200, year: 2023 },
  { slug: "samsung-galaxy-z-fold-5", name: "Samsung Galaxy Z Fold 5", category: "Samsung", price: 500, year: 2023 },
  { slug: "samsung-galaxy-z-flip-5", name: "Samsung Galaxy Z Flip 5", category: "Samsung", price: 280, year: 2023 },
  { slug: "macbook-pro-16-m4", name: "MacBook Pro 16\" M4", category: "MacBook", price: 1200, year: 2024 },
  { slug: "macbook-pro-14-m4", name: "MacBook Pro 14\" M4", category: "MacBook", price: 900, year: 2024 },
  { slug: "macbook-air-m3", name: "MacBook Air M3", category: "MacBook", price: 600, year: 2024 },
  { slug: "macbook-pro-16-m3", name: "MacBook Pro 16\" M3", category: "MacBook", price: 900, year: 2023 },
  { slug: "macbook-air-m2", name: "MacBook Air M2", category: "MacBook", price: 400, year: 2022 },
  { slug: "playstation-5", name: "PlayStation 5", category: "Console", price: 300, year: 2020 },
  { slug: "xbox-series-x", name: "Xbox Series X", category: "Console", price: 250, year: 2020 },
  { slug: "nintendo-switch-oled", name: "Nintendo Switch OLED", category: "Console", price: 180, year: 2021 },
];

export type ConditionId = "brandnew" | "flawless" | "verygood" | "good" | "fair" | "broken";

export const CONDITION_TIERS: { id: ConditionId; label: string; desc: string; multiplier: number }[] = [
  { id: "brandnew", label: "Brand New", desc: "Factory sealed, never activated", multiplier: 1.15 },
  { id: "flawless", label: "Flawless", desc: "Like new, zero signs of use", multiplier: 1.00 },
  { id: "verygood", label: "Very Good", desc: "Minimal use, no visible scratches at arm's length", multiplier: 0.95 },
  { id: "good", label: "Good", desc: "Light wear, fully functional", multiplier: 0.88 },
  { id: "fair", label: "Fair", desc: "Moderate to heavy wear, functional", multiplier: 0.72 },
  { id: "broken", label: "Broken", desc: "Cracked, defective, or damaged", multiplier: 0.50 },
];

export type StorageId = "64" | "128" | "256" | "512" | "1tb" | "2tb";

export const STORAGE_TIERS: { id: StorageId; label: string; multiplier: number }[] = [
  { id: "64", label: "64 GB", multiplier: 0.85 },
  { id: "128", label: "128 GB", multiplier: 1.00 },
  { id: "256", label: "256 GB", multiplier: 1.12 },
  { id: "512", label: "512 GB", multiplier: 1.25 },
  { id: "1tb", label: "1 TB", multiplier: 1.40 },
  { id: "2tb", label: "2 TB", multiplier: 1.55 },
];

export type CarrierId = "unlocked" | "att" | "tmobile" | "verizon" | "other";

export const CARRIERS: { id: CarrierId; label: string; multiplier: number }[] = [
  { id: "unlocked", label: "Unlocked", multiplier: 1.00 },
  { id: "att", label: "AT&T", multiplier: 0.95 },
  { id: "tmobile", label: "T-Mobile", multiplier: 0.95 },
  { id: "verizon", label: "Verizon", multiplier: 0.95 },
  { id: "other", label: "Other / Locked", multiplier: 0.85 },
];

export function computeQuote(opts: {
  basePrice: number;
  condition: ConditionId;
  storage: StorageId;
  carrier?: CarrierId;
}): { quote: number; multipliers: { condition: number; storage: number; carrier: number } } | null {
  const c = CONDITION_TIERS.find((t) => t.id === opts.condition);
  const s = STORAGE_TIERS.find((t) => t.id === opts.storage);
  const car = CARRIERS.find((t) => t.id === (opts.carrier ?? "unlocked"));
  if (!c || !s || !car) return null;
  const quote = Math.round(opts.basePrice * s.multiplier * c.multiplier * car.multiplier);
  return { quote, multipliers: { condition: c.multiplier, storage: s.multiplier, carrier: car.multiplier } };
}
