import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

// Lead dedup: track recent submissions to prevent duplicates.
// Custom-quote flows (no instant price) get a wider window keyed on
// device-category + email — this catches the case where a user re-submits
// the same kind of device with a tweaked free-text description.
const recentLeads = new Map<string, number>();
const DEDUP_REGULAR_MS = 60 * 1000; // 60s for instant-quote flows
const DEDUP_CUSTOM_MS = 5 * 60 * 1000; // 5min for custom-quote flows

function isDuplicate(email: string, contact: string, device: string, model: string, isCustom: boolean): boolean {
  const e = (email || "").toLowerCase().trim();
  const c = (contact || "").replace(/\D/g, "");
  // For custom flows: key on device-category only (Tablet/Desktop/etc.) so
  // free-text condition tweaks dedupe. For regular flows: key on full model.
  const productKey = isCustom ? (device || "").toLowerCase() : (model || "").toLowerCase();
  const key = `${e || c}|${productKey}|${isCustom ? "custom" : "regular"}`;
  const window = isCustom ? DEDUP_CUSTOM_MS : DEDUP_REGULAR_MS;
  const now = Date.now();
  const lastSeen = recentLeads.get(key);
  if (lastSeen && (now - lastSeen) < window) return true;
  recentLeads.set(key, now);
  if (recentLeads.size > 50) {
    for (const [k, t] of recentLeads) {
      if (now - t > DEDUP_CUSTOM_MS * 2) recentLeads.delete(k);
    }
  }
  return false;
}

// Resell values from Swappa (real market data, scraped 2026-05-12).
// Used to calculate profit margin on each lead for the owner's review.
const RESELL_ESTIMATES: Record<string, number> = {
  // iPhones — Swappa mid price (actual listings)
  "iPhone 17 Pro Max": 1081, "iPhone 17 Pro": 949, "iPhone 17": 695,
  "iPhone 16 Pro Max": 721, "iPhone 16 Pro": 638, "iPhone 16 Plus": 428, "iPhone 16": 520,
  "iPhone 15 Pro Max": 525, "iPhone 15 Pro": 528, "iPhone 15": 349,
  "iPhone 14 Pro Max": 417, "iPhone 14 Pro": 358, "iPhone 14": 268,
  "iPhone 13 Pro Max": 338, "iPhone 13 Pro": 268, "iPhone 13": 211,
  // Samsung — Swappa mid price
  "Galaxy S26 Ultra": 927, "Galaxy S25 Ultra": 714, "Galaxy S24 Ultra": 544,
  "Galaxy S26": 741, "Galaxy S25": 372,
  // Pixel — Swappa mid price
  "Pixel 10 Pro XL": 657, "Pixel 10 Pro": 567, "Pixel 9 Pro XL": 392, "Pixel 9 Pro": 375,
  // Consoles — PriceCharting
  "PlayStation 5 Pro": 680, "PlayStation 5 Slim": 310, "PlayStation 5": 347,
  "Xbox Series X": 220, "Xbox Series S": 130,
  "Nintendo Switch 2": 370, "Nintendo Switch OLED": 180,
  // MacBook — estimates pending eBay API
  "MacBook Pro 16\" M4": 1500, "MacBook Pro 14\" M4": 1000, "MacBook Pro 16\" M3": 1100,
  "MacBook Pro 14\" M3": 700, "MacBook Air M4": 600, "MacBook Air M3": 450,
};

// Match the customer's model name against RESELL_ESTIMATES. The naive
// previous implementation used `includes()` in dictionary order, which
// matched "iPhone 16" against "iPhone 16 Pro Max" first (Pro Max appears
// earlier in the dict and contains "iPhone 16" as a substring) and quoted
// a wildly inflated $721 resell value for a regular iPhone 16. Fix: walk
// every key, prefer an exact match, otherwise pick the LONGEST key whose
// label is fully contained in the customer's model string. Longest-key
// match avoids "iPhone 16" matching "iPhone 16 Pro Max" while still
// letting "iPhone 16 Pro Max 256GB" match "iPhone 16 Pro Max".
function getResellEstimate(modelName: string): number | null {
  if (!modelName) return null;
  const m = modelName.trim();
  let best: { key: string; val: number } | null = null;
  for (const [key, val] of Object.entries(RESELL_ESTIMATES)) {
    if (m === key) return val; // exact wins immediately
    if (m.includes(key) && (!best || key.length > best.key.length)) {
      best = { key, val };
    }
  }
  return best ? best.val : null;
}

// Broken / heavily-damaged devices resell as parts on eBay for a fraction
// of working price. Cap the resell estimate accordingly so the margin
// math doesn't claim a $595 win on a $721 reference price when the device
// is broken. Multipliers calibrated against actual eBay "for parts" sold
// listings 2026-05-16. condition strings come from the funnel ("Broken",
// "Fair", "Good", "Very Good", "Mint", "Sealed", "Flawless").
function resellMultiplierForCondition(condition: string | undefined): number {
  const c = (condition || "").toLowerCase();
  if (c.includes("broken") || c.includes("crack") || c.includes("dead") || c.includes("won't")) return 0.30;
  if (c.includes("fair") || c.includes("heavy")) return 0.65;
  if (c.includes("good") && !c.includes("very")) return 0.80;
  if (c.includes("very good") || c.includes("excellent") || c.includes("light")) return 0.92;
  // mint, sealed, flawless, like-new, pristine — full resell
  return 1.0;
}

// High-value devices that need manual review before payout
const REVIEW_KEYWORDS = [
  "Mac Studio", "Mac Pro", "MacBook Pro 16", "MacBook Pro 14\" M3",
  "MacBook Pro 14\" M5", "MacBook Air M5", "Z TriFold",
  "Mac Mini M4",
];
function needsManualReview(modelName: string, quoteAmt: number): boolean {
  if (quoteAmt >= 1000) return true;
  return REVIEW_KEYWORDS.some(kw => modelName?.includes(kw));
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { name, phone, email, device, model, storage, condition, carrier, quote, payout, photos, imei, imeiWarnings, handoff } = data;
  if (!name || (!phone && !email)) return NextResponse.json({ error: "Name and contact info required" }, { status: 400 });

  // Dedup check — wider window for custom-quote flows (free-text descriptions)
  const isCustom = !quote || quote === 0 || quote === "0";
  if (isDuplicate(email, phone, device, model, isCustom)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const photoLines = (photos as string[] | undefined)?.length
    ? [`Photos: ${(photos as string[]).join(" | ")}`]
    : [];

  const imeiLines: string[] = [];
  if (imei) imeiLines.push(`IMEI: ${imei}`);
  if (Array.isArray(imeiWarnings) && imeiWarnings.length > 0) {
    imeiLines.push(`[IMEI WARNINGS] ${(imeiWarnings as string[]).join(" | ")}`);
  }

  const handoffLines: string[] = [];
  if (handoff && typeof handoff === "object") {
    const h = handoff as { method?: string; address?: Record<string, string>; area?: string };
    if (h.method === "ship" && h.address) {
      const { street, unit, city, state, zip } = h.address;
      handoffLines.push("--- Handoff: SHIPPING ---");
      handoffLines.push(`Address: ${street}${unit ? `, ${unit}` : ""}, ${city}, ${state} ${zip}`);
      handoffLines.push("Action: Email USPS prepaid label.");
    } else if (h.method === "local") {
      handoffLines.push("--- Handoff: LOCAL MEETUP ---");
      if (h.area) handoffLines.push(`Area: ${h.area}`);
      handoffLines.push("Action: Reach out to schedule meetup time and location.");
    }
  }

  // Margin analysis — estimate profit on this deal. Resell value is the
  // working-condition Swappa mid price, scaled down for damaged devices
  // (broken phones sell for parts at ~30% of working). Without this
  // condition scaling, broken-tier quotes claimed huge fake margins.
  const resellWorking = getResellEstimate(model as string);
  const condMult = resellMultiplierForCondition(condition as string);
  const resellEst = resellWorking != null ? Math.round(resellWorking * condMult) : null;
  const quoteNum = typeof quote === "number" ? quote : parseInt(quote as string) || 0;
  const marginLines: string[] = [];
  if (resellEst && quoteNum > 0) {
    const margin = resellEst - quoteNum;
    const marginPct = Math.round((margin / resellEst) * 100);
    const shipping = 10;
    const netProfit = margin - shipping;
    marginLines.push("--- MARGIN ANALYSIS ---");
    const refNote = condMult < 1 ? ` (working: $${resellWorking}, ${Math.round(condMult*100)}% for ${condition})` : "";
    marginLines.push(`Sells for: ~$${resellEst}${refNote}`);
    marginLines.push(`You pay: $${quoteNum}`);
    marginLines.push(`You make: $${netProfit} after shipping (${marginPct}% margin)`);
    if (netProfit <= 0) marginLines.push("🚨 LOSS — DO NOT ACCEPT without manual review");
    else if (marginPct < 10) marginLines.push("⚠️ LOW — review before accepting");
    else if (marginPct < 15) marginLines.push("⚡ THIN — proceed with caution");
    else marginLines.push("✅ GOOD DEAL");
  } else if (quoteNum === 0) {
    marginLines.push("--- MARGIN: Manual quote needed (no auto-price) ---");
  }

  const reviewRequired = needsManualReview(model as string, quoteNum);
  const reviewLines: string[] = [];
  if (reviewRequired) {
    reviewLines.push("⚠️ MANUAL REVIEW REQUIRED — high-value device");
    reviewLines.push("Verify: condition matches description, check IMEI, confirm config (chip/RAM/storage)");
  }

  const leadBody = [
    `[NEW BUYBACK LEAD]${reviewRequired ? " ⚠️ NEEDS REVIEW" : ""}`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    email ? `Email: ${email}` : null,
    `Device: ${device} — ${model}`,
    storage ? `Storage: ${storage}` : null,
    carrier ? `Carrier: ${carrier}` : null,
    `Condition: ${condition}`,
    quote ? `Quote: $${quote}` : `Quote: TBD (custom)`,
    `Payout: ${payout}`,
    ...reviewLines,
    ...marginLines,
    ...imeiLines,
    ...photoLines,
    ...handoffLines,
  ].filter(Boolean).join("\n");

  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: leadBody,
        tags: ["lead", "buyback"],
        priority: "urgent",
      }),
    });
  } catch {}

  if (TWILIO_SID && TWILIO_AUTH) {
    const photoNote = (photos as string[] | undefined)?.length ? ` Photos: ${(photos as string[])[0]}` : "";
    const reviewTag = reviewRequired ? "⚠️ REVIEW: " : "";
    const ownerSms = `${reviewTag}NEW LEAD: ${name} wants to sell ${model} (${condition})${quote ? ` for $${quote}` : " — custom quote needed"}. Phone: ${phone || "N/A"} Email: ${email || "N/A"}${photoNote}`;
    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: OWNER_PHONE, From: TWILIO_FROM, Body: ownerSms }),
      });
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
