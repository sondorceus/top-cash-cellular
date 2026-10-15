// Atlas Mobile wholesale reference (public/comps/atlas-reference.json, from
// scripts/scrape-atlas-full.py): what the wholesale buyer pays per grade,
// keyed by the label Atlas prints ("iPhone 16 Pro Max 1TB Unlocked"). The
// admin price editor kept a private copy of this loader; it lives here now so
// /api/quote's resale view reads the same file. Read-only data.
import { promises as fs } from "fs";
import path from "path";

export type AtlasRow = Record<string, number | null>; // swap_hso, grade_a .. grade_d, doa
export type AtlasReference = {
  scraped_at?: string;
  sources?: Record<string, string>;
  categories?: Record<string, Record<string, AtlasRow>>;
  counts?: Record<string, number>;
};

let cache: AtlasReference | null = null;

export async function loadAtlasReference(): Promise<AtlasReference> {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), "public", "comps", "atlas-reference.json");
    cache = JSON.parse(await fs.readFile(p, "utf-8")) as AtlasReference;
  } catch {
    cache = {};
  }
  return cache;
}

/** "256" -> "256GB", "1tb" -> "1TB" (the way Atlas labels read). */
export function atlasStorageWord(storage: string | null | undefined): string | null {
  const t = String(storage ?? "").toLowerCase().replace(/\s|gb/g, "");
  if (!t) return null;
  if (/^\d+tb$/.test(t)) return t.toUpperCase();
  if (/^\d+$/.test(t)) return `${t}GB`;
  return null;
}

export type AtlasGrade = "grade_a" | "grade_b" | "grade_c" | "grade_d";

/** The Atlas grade a website condition sells as. */
export function atlasGradeFor(condition: string | null | undefined): AtlasGrade {
  const c = String(condition ?? "").toLowerCase();
  if (/brok|crack/.test(c)) return "grade_d";
  if (/fair/.test(c)) return "grade_c";
  if (/good/.test(c)) return "grade_b";
  return "grade_a"; // sealed / mint / excellent
}

/**
 * The Atlas row for a device label + storage, searched across every
 * category by its exact "<label> <storage> Unlocked" key. Atlas lists
 * unlocked units (the MDM-locked list is a different product), so a
 * carrier-locked phone has no row here by design.
 */
export function atlasRowFor(
  ref: AtlasReference,
  label: string | null | undefined,
  storage: string | null | undefined,
): { key: string; row: AtlasRow } | null {
  const stor = atlasStorageWord(storage);
  if (!label || !stor) return null;
  const want = `${label} ${stor} unlocked`.toLowerCase().replace(/\s+/g, " ");
  for (const cat of Object.values(ref.categories || {})) {
    for (const [key, row] of Object.entries(cat || {})) {
      if (key.toLowerCase().replace(/\s+/g, " ") === want) return { key, row };
    }
  }
  return null;
}
