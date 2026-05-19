// Comp-economics — converts raw resale comps into the net dollars TCC
// actually pockets after fees and shipping. Used by admin routes to
// show staff a *real* margin number per lead.
//
// Skywalker 2026-05-19 correction: eBay charges 13% across all
// categories on his account (not the 12/13.25/15% per-category split
// the ebay-sold.json scraper baked in). Selling to Atlas has no FVF
// but we still eat the shipping cost. Doing both nets here, in one
// place, so admin/leads + admin/prices stay in sync.
//
// Override any of these via env vars without code changes:
//   TCC_EBAY_FVF        — final-value-fee % (default 0.13)
//   TCC_EBAY_FIXED      — fixed per-order fee (default $0.40)
//   TCC_SHIP_PHONE      — shipping cost per family (defaults below)
//   …same for TABLET, LAPTOP, CONSOLE, WATCH, DRONE, VR

const FVF = parseFloat(process.env.TCC_EBAY_FVF || "0.13");
const FIXED = parseFloat(process.env.TCC_EBAY_FIXED || "0.40");

const SHIP: Record<Family, number> = {
  phone:   parseFloat(process.env.TCC_SHIP_PHONE   || "10"),
  tablet:  parseFloat(process.env.TCC_SHIP_TABLET  || "12"),
  laptop:  parseFloat(process.env.TCC_SHIP_LAPTOP  || "20"),
  console: parseFloat(process.env.TCC_SHIP_CONSOLE || "25"),
  watch:   parseFloat(process.env.TCC_SHIP_WATCH   || "7"),
  drone:   parseFloat(process.env.TCC_SHIP_DRONE   || "25"),
  vr:      parseFloat(process.env.TCC_SHIP_VR      || "20"),
};

export type Family = "phone" | "tablet" | "laptop" | "console" | "watch" | "drone" | "vr";

// SKU prefix → shipping family. Mirrors the family_for() logic in the
// Python eBay scraper so net math stays identical across both sides.
export function familyForSku(sku: string): Family {
  if (sku.startsWith("ipad") || sku.startsWith("stab") || sku.startsWith("ln_tab") || sku.startsWith("op_tab")) {
    return "tablet";
  }
  if (sku.startsWith("ip") || sku.startsWith("gs") || sku.startsWith("gz") || sku.startsWith("gnote") || sku.startsWith("px")) {
    return "phone";
  }
  if (sku.startsWith("mba") || sku.startsWith("mbp") || sku.startsWith("imac") || sku.startsWith("macmini") || sku.startsWith("macstud") || sku.startsWith("macpro")) {
    return "laptop";
  }
  if (sku.startsWith("ps") || sku.startsWith("xs") || sku.startsWith("switch") || sku.startsWith("nsw")) {
    return "console";
  }
  if (sku.startsWith("aw") || sku.startsWith("pw") || sku.startsWith("sgw") || sku.startsWith("garmin")) {
    return "watch";
  }
  if (sku.startsWith("dji")) return "drone";
  if (sku.startsWith("apple_vr") || sku.startsWith("meta_vr") || sku.startsWith("valve_vr") || sku.startsWith("psvr")) {
    return "vr";
  }
  return "phone"; // safe default — phones are most of TCC's volume
}

// Gross eBay sale → seller's net cash in pocket.
// net = gross × (1 − FVF) − fixed − shipping
export function ebayGrossToNet(gross: number, sku: string): number {
  const fam = familyForSku(sku);
  const net = gross * (1 - FVF) - FIXED - SHIP[fam];
  return Math.max(0, net);
}

// Atlas wholesale → seller's net cash in pocket.
// Atlas charges no FVF — TCC just eats the outbound shipping cost.
export function atlasResellToNet(resell: number, sku: string): number {
  const fam = familyForSku(sku);
  return Math.max(0, resell - SHIP[fam]);
}

// Best resale exit for a SKU = max(atlasNet, ebayNet). Returns the
// larger of the two when both are available, or whichever is set.
export function bestNetExit(opts: { atlasResell?: number; ebayGross?: number; sku: string }): number | null {
  const { atlasResell, ebayGross, sku } = opts;
  const a = atlasResell != null ? atlasResellToNet(atlasResell, sku) : null;
  const e = ebayGross != null ? ebayGrossToNet(ebayGross, sku) : null;
  if (a == null && e == null) return null;
  if (a == null) return e;
  if (e == null) return a;
  return Math.max(a, e);
}

// Per-family shipping cost — exposed for places that want to show the
// deduction line separately (e.g. "$X resell − $20 ship = $Y net").
export function shippingFor(sku: string): number {
  return SHIP[familyForSku(sku)];
}

export const EBAY_FVF_RATE = FVF;
export const EBAY_FIXED_FEE = FIXED;
