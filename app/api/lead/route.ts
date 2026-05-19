import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createReturnLabel, deviceKindFromString, aggregateWeight, shouldBlockAutoShip } from "../../lib/fedex";

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
// listings 2026-05-16. Condition strings come from the funnel — after
// Skywalker's 2026-05-19 collapse the live values are:
//   "Sealed" → 1.0   "Excellent" → 1.0 (= old Mint)
//   "Good"   → 0.80  "Fair"      → 0.65   "Broken" → 0.30
// Plus DJI/console label overrides ("Lightly Flown", "Well-Maintained",
// "Heavily Used") that fold into the same buckets. Legacy MC leads with
// "Mint" or "Very Good" still in the body parse correctly — VG drops to
// Good-tier per the new pricing intent.
function resellMultiplierForCondition(condition: string | undefined): number {
  const c = (condition || "").toLowerCase();
  if (c.includes("broken") || c.includes("crack") || c.includes("dead") || c.includes("won't")) return 0.30;
  // "heav" catches both "heavy" and DJI's "Heavily Used" (heavily ≠ heavy
  // as a substring — easy to miss; checked it).
  if (c.includes("fair") || c.includes("heav")) return 0.65;
  // very good check before plain good (substring) — legacy VG leads fall
  // to Good-tier under the new pricing intent.
  if (c.includes("very good")) return 0.80;
  if (c.includes("good") || c.includes("well-maintained") || c.includes("wellmaintained")) return 0.80;
  // "Excellent" is the new top working-condition tier (= old Mint, 1.0x).
  // "Lightly Flown" is DJI's Excellent override.
  if (c.includes("excellent") || c.includes("lightly")) return 1.0;
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
  let { payout } = data;
  const { name, phone, email, device, model, storage, condition, carrier, quote, quantity, photos, imei, imeiWarnings, handoff, brokenGlass, brokenFunctional, processor, memory, graphics, displayResolution, displayGlass, batteryHealth, charger, connectivity, extras, paidOff, devices, bestContact, notes, smsOptIn, attribution, couponCode } = data;
  // TCPA defense in depth — client checkbox is `required`, but a
  // bypass (DevTools, malformed client) could submit phone without
  // consent. Reject any phone-bearing lead that didn't get explicit
  // smsOptIn=true. Ship handoffs without a phone don't need consent
  // (we'll only email).
  if (phone && typeof phone === "string" && phone.replace(/\D/g, "").length >= 10 && smsOptIn !== true) {
    return NextResponse.json({ error: "SMS consent required when providing a phone number." }, { status: 400 });
  }
  if (!name || (!phone && !email)) return NextResponse.json({ error: "Name and contact info required" }, { status: 400 });

  // Server-side guard: Cash is local-only. If a ship handoff slips
  // through with payout=Cash (client filter bypass, stale state, bad
  // client), coerce to "Cash App" so the lead still saves but doesn't
  // promise an impossible payment method. Staff will catch in admin.
  // Skywalker 2026-05-18.
  if (
    handoff && typeof handoff === "object" &&
    (handoff as { method?: string }).method === "ship" &&
    typeof payout === "string" && payout.toLowerCase() === "cash"
  ) {
    payout = "Cash App (coerced — Cash not valid for shipping)";
  }

  // Dedup check — wider window for custom-quote flows (free-text descriptions)
  const isCustom = !quote || quote === 0 || quote === "0";
  if (isDuplicate(email, phone, device, model, isCustom)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Coupon redemption — Skywalker 2026-05-18 review-reward feature.
  // Tries to redeem the customer's $25 thank-you code if they
  // entered one. Identity is bound to email + phone on mint, so the
  // PATCH refuses if the redeemer doesn't match. Failures (invalid,
  // used, expired, mismatch) silently skip applying the bonus —
  // the lead still saves, just without the +$25. Runs BEFORE line
  // construction so couponLines + margin math both see the result.
  let couponApplied: { code: string; value: number } | null = null;
  let couponError: string | null = null;
  if (typeof couponCode === "string" && couponCode.trim()) {
    const cleanCode = couponCode.trim().toUpperCase();
    try {
      const phoneDigits = (phone || "").replace(/\D/g, "");
      const cr = await fetch(`${MC_API}/api/coupons`, {
        method: "PATCH",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          action: "redeem",
          email: (email || "").toLowerCase().trim(),
          phone: phoneDigits,
        }),
      });
      const cd = await cr.json().catch(() => ({}));
      if (cr.ok && cd?.coupon?.value) {
        couponApplied = { code: cd.coupon.code || cleanCode, value: Number(cd.coupon.value) || 0 };
      } else {
        couponError = cd?.error || `Coupon couldn't be applied (${cr.status})`;
      }
    } catch (e) {
      couponError = e instanceof Error ? e.message : "Coupon service unavailable";
    }
  }
  const baseQuoteNum = typeof quote === "number" ? quote : parseInt(quote as string) || 0;
  // Bonus from the coupon is applied AFTER margin reference but
  // BEFORE line construction so couponLines can render the totals.
  const quoteNum = baseQuoteNum + (couponApplied?.value || 0);

  const photoLines = (photos as string[] | undefined)?.length
    ? [`Photos: ${(photos as string[]).join(" | ")}`]
    : [];

  // Multi-device submission — Skywalker 2026-05-17: "when customers
  // have mutiple it all comes in as separate leads we need to make
  // one need highly organized". Single consolidated lead with an
  // indented device block per item.
  type DeviceEntry = {
    model?: string;
    storage?: string;
    condition?: string;
    quote?: number;
    quantity?: number;
    photos?: string[];
    carrier?: string;
    connectivity?: string;
    processor?: string;
    memory?: string;
    graphics?: string;
    displayResolution?: string;
    displayGlass?: string;
    batteryHealth?: string;
    charger?: string;
    extras?: string[];
    brokenGlass?: "front" | "back" | "both" | null;
    brokenFunctional?: boolean | null;
    paidOff?: boolean | null;
    imei?: string;
  };
  const deviceList = Array.isArray(devices) ? (devices as DeviceEntry[]).filter((d) => d && (d.model || d.condition)) : [];
  const isMulti = deviceList.length > 1;
  const multiLines: string[] = [];
  if (isMulti) {
    multiLines.push(`Devices: ${deviceList.length}`);
    deviceList.forEach((d, i) => {
      multiLines.push(`  ${i + 1}. ${d.model || "—"}${d.storage ? ` · ${d.storage}` : ""}${d.condition ? ` · ${d.condition}` : ""}${d.quote ? ` · $${d.quote}` : ""}${d.quantity && d.quantity > 1 ? ` (×${d.quantity})` : ""}`);
      // Per-device specs — indented under the device line so the admin
      // parser can pick them up via the "[Spec]: <value>" prefix. Each
      // line is the same key the single-device flow uses (Chip / RAM /
      // GPU / Display / Battery health / etc.) so one parser handles
      // both. Skywalker 2026-05-17: "all the important meat are missing".
      const specBits: string[] = [];
      if (d.processor)         specBits.push(`Chip: ${d.processor}`);
      if (d.memory)            specBits.push(`RAM: ${d.memory}`);
      if (d.graphics)          specBits.push(`GPU: ${d.graphics}`);
      if (d.displayResolution) specBits.push(`Display: ${d.displayResolution}`);
      if (d.displayGlass)      specBits.push(`Display glass: ${d.displayGlass}`);
      if (d.batteryHealth)     specBits.push(`Battery health: ${d.batteryHealth}`);
      if (d.charger)           specBits.push(`Charger: ${d.charger}`);
      if (d.carrier)           specBits.push(`Carrier: ${d.carrier}`);
      if (d.connectivity)      specBits.push(`Connectivity: ${d.connectivity}`);
      if (d.imei)              specBits.push(`IMEI: ${d.imei}`);
      if (Array.isArray(d.extras) && d.extras.length > 0) specBits.push(`Extras: ${d.extras.join(", ")}`);
      if (d.paidOff === false) specBits.push("Balance: ⚠️ NOT PAID OFF");
      else if (d.paidOff === true) specBits.push("Balance: Fully paid off");
      if (d.brokenFunctional === false) specBits.push("Broken: NOT FUNCTIONAL");
      else if (d.brokenFunctional === true) specBits.push("Broken: still functional");
      if (d.brokenGlass === "front") specBits.push("Glass: FRONT (display) cracked");
      else if (d.brokenGlass === "back") specBits.push("Glass: BACK only cracked");
      else if (d.brokenGlass === "both") specBits.push("Glass: BOTH front and back cracked");
      for (const bit of specBits) multiLines.push(`     ${bit}`);
      if (Array.isArray(d.photos) && d.photos.length > 0) {
        multiLines.push(`     Photos: ${d.photos.join(" | ")}`);
      }
    });
    const total = deviceList.reduce((s, d) => s + (Number(d.quote) || 0), 0);
    multiLines.push(`Total payout: $${total}`);
  }

  const brokenLines: string[] = [];
  if (brokenFunctional === false) brokenLines.push("Broken: NOT FUNCTIONAL — manual review");
  else if (brokenFunctional === true) brokenLines.push("Broken: still functional");
  if (brokenGlass === "front") brokenLines.push("Glass: FRONT (display) cracked");
  else if (brokenGlass === "back") brokenLines.push("Glass: BACK only cracked (display intact)");
  else if (brokenGlass === "both") brokenLines.push("Glass: BOTH front and back cracked");

  // Full spec answers from the funnel — Skywalker 2026-05-17: "all
  // questions need to be in staff for accurate pricing not half". For
  // MacBooks the chip/RAM/GPU/display drive most of the resell value;
  // for phones the battery health and OEM-charger flag matter; for
  // tablets the connectivity (WiFi vs cellular). Without these surfaced
  // staff can't price the device — they're guessing.
  const specLines: string[] = [];
  if (processor)         specLines.push(`Chip: ${processor}`);
  if (memory)            specLines.push(`RAM: ${memory}`);
  if (graphics)          specLines.push(`GPU: ${graphics}`);
  if (displayResolution) specLines.push(`Display: ${displayResolution}`);
  if (displayGlass)      specLines.push(`Display glass: ${displayGlass}`);
  if (batteryHealth)     specLines.push(`Battery health: ${batteryHealth}`);
  if (charger)           specLines.push(`Charger: ${charger}`);
  if (connectivity)      specLines.push(`Connectivity: ${connectivity}`);
  if (Array.isArray(extras) && extras.length > 0) {
    specLines.push(`Extras: ${(extras as string[]).join(", ")}`);
  }
  // Carrier balance status — Skywalker 2026-05-17. We DO buy devices
  // with a balance, but the offer is adjusted for blacklist risk.
  if (paidOff === false) specLines.push("Balance: ⚠️ NOT PAID OFF — blacklist risk, adjust offer");
  else if (paidOff === true) specLines.push("Balance: Fully paid off");

  const imeiLines: string[] = [];
  if (imei) imeiLines.push(`IMEI: ${imei}`);
  if (Array.isArray(imeiWarnings) && imeiWarnings.length > 0) {
    imeiLines.push(`[IMEI WARNINGS] ${(imeiWarnings as string[]).join(" | ")}`);
  }

  // Coupon outcome — shown to admin in the lead body. Successful
  // redemptions write a "Coupon applied" + "Total payout" line.
  // Failed attempts write a "Coupon attempt" line so admin can spot
  // abuse / wrong-customer attempts.
  const couponLines: string[] = [];
  if (couponApplied) {
    couponLines.push(`Coupon applied: ${couponApplied.code} (+$${couponApplied.value} thank-you bonus)`);
    couponLines.push(`Total payout amount: $${quoteNum} (base $${baseQuoteNum} + bonus $${couponApplied.value})`);
  } else if (couponError && typeof couponCode === "string" && couponCode.trim()) {
    couponLines.push(`Coupon attempt: ${couponCode.trim().toUpperCase()} · failed: ${couponError.slice(0, 200)}`);
  }

  // Customer-level meta lines — best contact preference, free-form
  // note, quantity (single-device only). Skywalker 2026-05-18 "make
  // sure im getting every detail". These travel as plain "Key: value"
  // lines so admin's existing parseField helper picks them up. Notes
  // can contain newlines so we collapse to " · " to keep a single
  // line. Capped at 500 chars (client also caps, defense in depth).
  const customerMetaLines: string[] = [];
  const qtyNum = typeof quantity === "number" ? quantity : parseInt(quantity as string);
  if (Number.isFinite(qtyNum) && qtyNum > 1 && !Array.isArray(devices)) {
    customerMetaLines.push(`Quantity: ${qtyNum}`);
  }
  if (typeof bestContact === "string" && /^(text|call|email)$/i.test(bestContact)) {
    customerMetaLines.push(`Best contact: ${bestContact.toUpperCase()}`);
  }
  if (typeof notes === "string" && notes.trim()) {
    const clean = notes.replace(/[\r\n]+/g, " · ").trim().slice(0, 500);
    customerMetaLines.push(`Note from customer: ${clean}`);
  }
  // Record SMS-consent disposition (TCPA audit trail). When phone is
  // absent the lead won't get SMS regardless, so we omit the line.
  if (phone) {
    customerMetaLines.push(`SMS opt-in: ${smsOptIn === true ? "YES" : "no"}`);
  }
  // Source attribution — UTM params + referrer captured on first
  // landing, persisted to localStorage with 30-day TTL, then sent
  // with the submit. Tells Skywalker which channel (Google Ads vs
  // organic vs referral) is actually producing customers.
  if (attribution && typeof attribution === "object") {
    const a = attribution as { source?: string; medium?: string; campaign?: string; term?: string; content?: string; referrer?: string; landed?: string };
    const bits: string[] = [];
    if (a.source) bits.push(`source=${a.source}`);
    if (a.medium) bits.push(`medium=${a.medium}`);
    if (a.campaign) bits.push(`campaign=${a.campaign}`);
    if (a.term) bits.push(`term=${a.term}`);
    if (a.content) bits.push(`content=${a.content}`);
    if (a.referrer) bits.push(`ref=${a.referrer.slice(0, 120)}`);
    if (a.landed) bits.push(`landed=${a.landed}`);
    if (bits.length > 0) {
      customerMetaLines.push(`Source: ${bits.join(" · ").slice(0, 480)}`);
    }
  }

  const handoffLines: string[] = [];
  if (handoff && typeof handoff === "object") {
    const h = handoff as { method?: string; address?: Record<string, string>; area?: string; slot?: { id: string; date: string; time: string; label?: string } };
    if (h.method === "ship" && h.address) {
      const { street, unit, city, state, zip } = h.address;
      handoffLines.push("--- Handoff: SHIPPING ---");
      handoffLines.push(`Address: ${street}${unit ? `, ${unit}` : ""}, ${city}, ${state} ${zip}`);
      handoffLines.push("Packaging: Seller sources own box (we don't ship kits).");
      handoffLines.push("Action: FedEx label auto-mints at submit (sandbox until prod cert lands). Confirm receipt + inspect on arrival.");
    } else if (h.method === "local") {
      handoffLines.push("--- Handoff: LOCAL MEETUP ---");
      if (h.area) handoffLines.push(`Area: ${h.area}`);
      if (h.slot) {
        const [hh, mm] = h.slot.time.split(":").map(Number);
        const ampm = hh >= 12 ? "PM" : "AM";
        const h12 = hh % 12 || 12;
        handoffLines.push(`Slot: ${h.slot.date} ${h12}:${String(mm).padStart(2, "0")} ${ampm}${h.slot.label ? ` · ${h.slot.label}` : ""} (id=${h.slot.id})`);
        handoffLines.push("Action: Confirm meetup spot with seller for the booked window.");
      } else {
        handoffLines.push("Action: Reach out to schedule meetup time and location.");
      }
    }
  }

  // Margin analysis — estimate profit on this deal. Resell value is the
  // working-condition Swappa mid price, scaled down for damaged devices
  // (broken phones sell for parts at ~30% of working). Without this
  // condition scaling, broken-tier quotes claimed huge fake margins.
  // quoteNum (computed above) includes the coupon bonus so margin math
  // reflects the real outlay.
  const resellWorking = getResellEstimate(model as string);
  const condMult = resellMultiplierForCondition(condition as string);
  const resellEst = resellWorking != null ? Math.round(resellWorking * condMult) : null;
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

  const leadBody = isMulti
    ? [
        `[NEW BUYBACK LEAD — ${deviceList.length} DEVICES]`,
        `Name: ${name}`,
        `Phone: ${phone}`,
        email ? `Email: ${email}` : null,
        // Headline summary so the staff feed's model column reads
        // sensibly without parsing the indented device list.
        `Device: ${device || "multi"} — ${model || `${deviceList.length} devices`}`,
        `Condition: Multi-device (${deviceList.length})`,
        carrier ? `Carrier: ${carrier}` : null,
        `Quote: $${deviceList.reduce((s, d) => s + (Number(d.quote) || 0) * (Number(d.quantity) || 1), 0)}`,
        `Payout: ${payout}`,
        ...couponLines,
        ...customerMetaLines,
        ...multiLines,
        ...handoffLines,
      ].filter(Boolean).join("\n")
    : [
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
        ...couponLines,
        ...customerMetaLines,
        ...specLines,
        ...brokenLines,
        ...reviewLines,
        ...marginLines,
        ...imeiLines,
        ...photoLines,
        ...handoffLines,
      ].filter(Boolean).join("\n");

  // Post the lead to MC and capture the assigned message ID — used as the
  // leadId for the [LABEL: <id>] marker below so the admin lead row picks
  // up tracking automatically.
  let leadId: string | null = null;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
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
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      leadId = data?.message?.id || null;
    }
  } catch {}

  // FedEx prepaid label — only for SHIP handoffs with a complete address
  // AND a customer phone (FedEx requires it). We mint at submission time
  // (rather than waiting for admin "shipped" status) so the customer can
  // print + drop their device immediately. Skywalker 2026-05-17. Local
  // meetups never call FedEx. Failures here are non-fatal — the lead is
  // already saved; staff can regenerate from /admin if needed.
  let fedexLabel: { tracking: string; url: string; service: string } | null = null;
  // When a ship-handoff label can't be minted, we tell the customer
  // why on the done page — so they can fix a bad address themselves
  // instead of staring at a silent dead-end. Classified to two kinds:
  //   ADDRESS_INVALID: customer-fixable (street/city/state/zip wrong)
  //   SERVICE_UNAVAILABLE: our problem (auth, downstream FedEx outage)
  // We never echo the raw FedEx response back — it can include keys
  // or internal codes. Only a sanitized human-readable hint.
  let fedexError: { kind: "ADDRESS_INVALID" | "SERVICE_UNAVAILABLE"; hint: string } | null = null;
  if (handoff && typeof handoff === "object") {
    const h = handoff as { method?: string; address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string } };
    const a = h.address;
    const hasFullAddress =
      !!a && typeof a.street === "string" && a.street.trim() &&
      typeof a.city === "string" && a.city.trim() &&
      typeof a.state === "string" && a.state.trim().length === 2 &&
      typeof a.zip === "string" && /^\d{5}/.test(a.zip);
    const phoneDigits = String(phone || "").replace(/\D/g, "");
    if (h.method === "ship" && hasFullAddress && phoneDigits.length >= 10 && leadId) {
      // Multi-device shipments fit in ONE box. Total weight = sum of
      // per-device defaults + 2 lb packaging. Skywalker 2026-05-18:
      // FedEx bills the actual scanned weight regardless of what we
      // declare — but declaring the realistic weight upfront sets the
      // right service tier and avoids correction surcharges of $5-15.
      const deviceKinds = isMulti
        ? deviceList.map((d) => ({ deviceKind: deviceKindFromString(d.model || "") }))
        : [{ deviceKind: deviceKindFromString(model as string) }];
      const totalWeight = aggregateWeight(deviceKinds);

      // Auto-skip when ANY device in the order is too heavy/expensive
      // to ship blindly (desktops). Staff will quote the actual label
      // cost via the admin Generate FedEx label button after sanity-
      // checking the package contents. We continue past this block
      // (lead still saves) but skip the FedEx call.
      const blockedReason = deviceKinds
        .map((d) => shouldBlockAutoShip(d.deviceKind))
        .find((r) => r);
      if (blockedReason) {
        try {
          await fetch(`${MC_API}/api/comms`, {
            method: "POST",
            headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "topcash-web",
              fromName: "Top Cash Cellular",
              role: "system",
              body: `[LABEL-WITHHELD: ${leadId}] reason=${blockedReason}`,
              tags: ["fedex-label", "blocked"],
              priority: "normal",
            }),
          });
        } catch {}
        fedexError = { kind: "SERVICE_UNAVAILABLE", hint: blockedReason };
        // Don't try {} below — go straight to the catch path equivalent.
      } else { try {
        // Build a customerReference that prints on the label stub.
        // Single-device: "iPhone 17 Pro Max" (or whatever model the
        // customer selected). Multi-device: "3 devices" so the dock
        // intake person immediately sees how many to expect.
        const deviceCount = deviceList.length || 1;
        const refText = deviceCount > 1
          ? `${deviceCount} devices`
          : (model ? String(model).slice(0, 30) : "1 device");
        const label = await createReturnLabel({
          customerName: String(name),
          customerPhone: phoneDigits,
          customerStreet: a!.street!,
          customerUnit: a!.unit,
          customerCity: a!.city!,
          customerState: a!.state!,
          customerZip: a!.zip!,
          deviceKind: deviceKindFromString(model as string),
          weightLbs: totalWeight,
          customerReference: refText,
          poNumber: `TCC-${leadId}`,
        });
        // Upload to Vercel Blob — random suffix so the tracking number
        // alone can't be pivoted to a leaked label.
        const pdfBytes = Buffer.from(label.labelPdfBase64, "base64");
        const blob = await put(`fedex-labels/${leadId}-${Date.now()}.pdf`, pdfBytes, {
          access: "public",
          contentType: "application/pdf",
        });
        fedexLabel = { tracking: label.trackingNumber, url: blob.url, service: label.serviceType };
        // Post the [LABEL: <leadId>] marker so the admin GET parser
        // attaches tracking + URL to the lead row.
        try {
          await fetch(`${MC_API}/api/comms`, {
            method: "POST",
            headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "topcash-web",
              fromName: "Top Cash Cellular",
              role: "system",
              body: `[LABEL: ${leadId}] tracking=${label.trackingNumber} url=${blob.url} service=${label.serviceType}`,
              tags: ["fedex-label", "auto-generated"],
              priority: "low",
            }),
          });
        } catch {}
      } catch (err) {
        // Classify so the done page can show actionable feedback.
        // FedEx error bodies contain JSON like:
        //   {"errors":[{"code":"ADDRESS.STATEORPROVINCECODE.INVALID",...}]}
        // We look for ADDRESS / POSTAL / CITY / STATE / STREET tokens.
        const raw = err instanceof Error ? err.message : String(err);
        const addressy = /address|postal|street|city|state|zip/i.test(raw);
        fedexError = addressy
          ? { kind: "ADDRESS_INVALID", hint: "FedEx couldn't validate your shipping address. Please double-check the street, city, state, and ZIP — then email CustomerService@topcashcells.com with the correction and we'll resend your label." }
          : { kind: "SERVICE_UNAVAILABLE", hint: "We couldn't print your FedEx label right now. Your trade-in is saved — we'll email your label as soon as the issue clears (usually within an hour)." };
        // Post a marker so admin can see which leads need a manual
        // label generation. Sanitized message — no FedEx key leakage.
        try {
          await fetch(`${MC_API}/api/comms`, {
            method: "POST",
            headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "topcash-web",
              fromName: "Top Cash Cellular",
              role: "system",
              body: `[LABEL-FAILED: ${leadId}] kind=${fedexError.kind} reason=${raw.replace(/[\n\r]/g, " ").slice(0, 300)}`,
              tags: ["fedex-label", "failed"],
              priority: "high",
            }),
          });
        } catch {}
      }
      }
    }
  }

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

  return NextResponse.json({ ok: true, leadId, fedexLabel, fedexError, couponApplied, couponError });
}
