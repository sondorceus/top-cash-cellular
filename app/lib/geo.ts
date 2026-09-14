// Visitor location from Vercel's edge headers — set by Vercel on every
// request (a client can't spoof them; the edge overwrites). Used so the
// owner sees where each chat / lead comes from and the bot never offers an
// Austin meetup to someone in Houston or Ohio. Sonny 2026-09-14: "make sure
// our ads aren't getting leaked outside of Austin, I keep getting messages".
import type { NextRequest } from "next/server";

export type Geo = { city: string; region: string; country: string; label: string; area: "metro" | "tx" | "us" | "intl" | "unknown" };

// Austin metro + the towns a "meet in Austin" seller realistically drives
// from. Anything else in Texas is a ship (or a long drive they choose).
const METRO = new Set(["austin", "round rock", "cedar park", "pflugerville", "georgetown", "leander", "kyle", "buda", "san marcos", "hutto", "manor", "lakeway", "bee cave", "dripping springs", "elgin", "bastrop", "lockhart", "liberty hill", "taylor", "wimberley", "west lake hills", "sunset valley", "del valle", "jonestown", "spicewood", "new braunfels"]);

export function classifyGeo(city: string, region: string, country: string): Geo["area"] {
  if (!country) return "unknown";
  if (country !== "US") return "intl";
  if (region !== "TX") return "us";
  if (city && METRO.has(city.toLowerCase())) return "metro";
  return city ? "tx" : "tx";
}

export function clientGeo(req: NextRequest): Geo {
  const dec = (v: string | null) => { try { return decodeURIComponent(v || "").trim(); } catch { return (v || "").trim(); } };
  const city = dec(req.headers.get("x-vercel-ip-city")).slice(0, 40);
  const region = dec(req.headers.get("x-vercel-ip-country-region")).slice(0, 10).toUpperCase();
  const country = dec(req.headers.get("x-vercel-ip-country")).slice(0, 4).toUpperCase();
  const area = classifyGeo(city, region, country);
  const label = [city, region, country && country !== "US" ? country : ""].filter(Boolean).join(", ") || "unknown location";
  return { city, region, country, label, area };
}

export const AREA_WORDS: Record<Geo["area"], string> = {
  metro: "Austin area", tx: "Texas, outside the Austin area", us: "outside Texas", intl: "outside the US", unknown: "location unknown",
};
