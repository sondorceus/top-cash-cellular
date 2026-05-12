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

// Estimated resell values (eBay sold medians) — updated periodically.
// Used to calculate profit margin on each lead for the owner's review.
// Format: { "model_keyword": resell_price }
const RESELL_ESTIMATES: Record<string, number> = {
  // iPhones (eBay used sold median)
  "iPhone 17 Pro Max": 1050, "iPhone 17 Pro": 900, "iPhone 17 Air": 750, "iPhone 17": 650,
  "iPhone 16 Pro Max": 750, "iPhone 16 Pro": 620, "iPhone 16 Plus": 520, "iPhone 16": 480,
  "iPhone 15 Pro Max": 550, "iPhone 15 Pro": 480, "iPhone 15 Plus": 400, "iPhone 15": 350,
  "iPhone 14 Pro Max": 450, "iPhone 14 Pro": 380, "iPhone 14": 280,
  "iPhone 13 Pro Max": 350, "iPhone 13 Pro": 300, "iPhone 13": 220,
  // Samsung
  "Galaxy S26 Ultra": 720, "Galaxy S25 Ultra": 630, "Galaxy S24 Ultra": 500,
  "Galaxy S26": 480, "Galaxy S25": 380, "Galaxy Z Fold 7": 830, "Galaxy Z Fold 6": 520,
  "Galaxy Z Flip 7": 450, "Galaxy Z Flip 6": 300,
  // Pixel
  "Pixel 10 Pro XL": 500, "Pixel 10 Pro": 430, "Pixel 9 Pro XL": 380, "Pixel 9 Pro": 300,
  // Consoles
  "PlayStation 5 Pro": 680, "PlayStation 5 Slim": 310, "PlayStation 5": 347,
  "Xbox Series X": 220, "Xbox Series S": 130,
  "Nintendo Switch 2": 370, "Nintendo Switch OLED": 180,
  // MacBook
  "MacBook Pro 16\" M4": 1500, "MacBook Pro 14\" M4": 1000, "MacBook Pro 16\" M3": 1100,
  "MacBook Pro 14\" M3": 700, "MacBook Air M4": 600, "MacBook Air M3": 450,
};

function getResellEstimate(modelName: string): number | null {
  if (!modelName) return null;
  // Try exact match first, then partial
  for (const [key, val] of Object.entries(RESELL_ESTIMATES)) {
    if (modelName.includes(key) || key.includes(modelName)) return val;
  }
  return null;
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

  // Margin analysis — estimate profit on this deal
  const resellEst = getResellEstimate(model as string);
  const quoteNum = typeof quote === "number" ? quote : parseInt(quote as string) || 0;
  const marginLines: string[] = [];
  if (resellEst && quoteNum > 0) {
    const margin = resellEst - quoteNum;
    const marginPct = Math.round((margin / resellEst) * 100);
    const shipping = 10;
    const netProfit = margin - shipping;
    marginLines.push("--- MARGIN ANALYSIS ---");
    marginLines.push(`Est. resell: $${resellEst} (eBay/market)`);
    marginLines.push(`Our buy: $${quoteNum}`);
    marginLines.push(`Gross margin: $${margin} (${marginPct}%)`);
    marginLines.push(`Net (after ~$${shipping} ship): $${netProfit}`);
    if (marginPct < 10) marginLines.push("⚠️ LOW MARGIN — review before accepting");
    else if (marginPct < 15) marginLines.push("⚡ Thin margin — proceed with caution");
    else marginLines.push("✅ Healthy margin");
  } else if (quoteNum === 0) {
    marginLines.push("--- MARGIN: Manual quote needed (no auto-price) ---");
  }

  const leadBody = [
    `[NEW BUYBACK LEAD]`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    email ? `Email: ${email}` : null,
    `Device: ${device} — ${model}`,
    storage ? `Storage: ${storage}` : null,
    carrier ? `Carrier: ${carrier}` : null,
    `Condition: ${condition}`,
    quote ? `Quote: $${quote}` : `Quote: TBD (custom)`,
    `Payout: ${payout}`,
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
    const ownerSms = `NEW LEAD: ${name} wants to sell ${model} (${condition})${quote ? ` for $${quote}` : " — custom quote needed"}. Phone: ${phone || "N/A"} Email: ${email || "N/A"}${photoNote}`;
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
