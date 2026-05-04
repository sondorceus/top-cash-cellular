import { NextRequest, NextResponse } from "next/server";

// Sickw IMEI/serial check.
// Free TAC validation runs first (Luhn + length); if that passes, we hit
// Sickw's paid lookup for blacklist + iCloud-lock signals.
// Sickw API: GET https://sickw.com/api.php?format=json&key=<key>&imei=<imei>&service=<id>
// Service 0 = "Apple Basic Info" (cheapest, ~$0.05). Other services give
// more detail at higher cost. We use 0 because it returns enough for
// our blacklist+iCloud-lock signal.

const SICKW_KEY = process.env.SICKW_API_KEY || "";

function luhnValid(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export async function POST(req: NextRequest) {
  const { imei, deviceCategory } = await req.json();
  if (!imei || typeof imei !== "string") {
    return NextResponse.json({ ok: false, error: "IMEI required" }, { status: 400 });
  }
  const clean = imei.replace(/\D/g, "");

  // Stage 1: free format check (Luhn + 15-digit). Catches typos.
  if (clean.length !== 15) {
    return NextResponse.json({
      ok: false,
      stage: "format",
      error: "IMEI must be 15 digits. Tap *#06# on the device to display it.",
    });
  }
  if (!luhnValid(clean)) {
    return NextResponse.json({
      ok: false,
      stage: "format",
      error: "That doesn't look like a valid IMEI — please double-check.",
    });
  }

  // Stage 2: Sickw lookup (paid). Skip silently if no key configured.
  if (!SICKW_KEY) {
    return NextResponse.json({ ok: true, stage: "format-only", imei: clean });
  }

  try {
    const url = `https://sickw.com/api.php?format=json&key=${SICKW_KEY}&imei=${clean}&service=0`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      return NextResponse.json({ ok: true, stage: "format-only", imei: clean, sickwError: `HTTP ${r.status}` });
    }
    const data = await r.json();
    // Sickw returns { status: "success" | "rejected", result: "<plaintext>", ... }
    // The result text contains lines like:
    //   Model: iPhone 15 Pro Max
    //   Find My iPhone: ON
    //   Blacklist Status: CLEAN | BLACKLISTED
    //   Loaner Device: NO
    if (data.status !== "success" || !data.result) {
      return NextResponse.json({ ok: true, stage: "format-only", imei: clean, sickwError: data.result || "lookup failed" });
    }
    const text = String(data.result);
    const get = (label: string) => {
      const m = text.match(new RegExp(`${label}:\\s*([^\\r\\n<]+)`, "i"));
      return m ? m[1].trim() : null;
    };
    const model = get("Model") || get("Model Description");
    const fmiRaw = get("Find My iPhone") || get("FMI Status") || get("iCloud Lock") || get("iCloud Status");
    const blacklistRaw = get("Blacklist Status") || get("Blacklist") || get("GSMA Blacklist");
    const fmiOn = !!fmiRaw && /on|locked|active/i.test(fmiRaw);
    const blacklisted = !!blacklistRaw && /black|locked|reported|stolen/i.test(blacklistRaw);
    const warnings: string[] = [];
    if (fmiOn) warnings.push("Find My / iCloud lock is ON — must be turned off before payout.");
    if (blacklisted) warnings.push("Device is blacklisted — typically reported lost or stolen.");

    // Light cross-check vs the device category the customer picked.
    if (deviceCategory && model) {
      const lc = model.toLowerCase();
      const cat = String(deviceCategory).toLowerCase();
      if (cat === "samsung" && !/samsung|galaxy/.test(lc)) warnings.push(`IMEI returns "${model}" but you selected Samsung.`);
      if (cat === "iphone" && !/iphone/.test(lc)) warnings.push(`IMEI returns "${model}" but you selected iPhone.`);
    }

    return NextResponse.json({
      ok: warnings.length === 0,
      stage: "full",
      imei: clean,
      model,
      fmiOn,
      blacklisted,
      warnings,
      raw: text.slice(0, 500),
    });
  } catch (e) {
    return NextResponse.json({ ok: true, stage: "format-only", imei: clean, sickwError: e instanceof Error ? e.message : "unknown" });
  }
}
