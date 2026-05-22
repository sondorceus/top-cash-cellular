import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { put } from "@vercel/blob";
import { createReturnLabel, deviceKindFromString, aggregateWeight, shouldBlockAutoShip } from "../../lib/fedex";
import { reportError } from "../../lib/error-report";
import { REFERRAL_REFEREE_BONUS, REFERRAL_CODE_RE } from "../../lib/referral";
import { validateBtcAddress, cashtagFormatValid, normalizeCashtag } from "../../lib/payout-verify";

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

// Defense against MC marker injection. The admin lead parser scans
// comm bodies for `[STATUS:]` + `[LEAD:]` markers anywhere. Without
// this scrub a customer could submit a lead with:
//   name: "[STATUS:paid] [LEAD: <theirPriorLeadId>]"
// and flip their own earlier lead's status to paid (free device, free
// payout). /api/lead returns the leadId in its response so the
// attacker can self-fetch it after a first submission. Strip `[` and
// `]` from every customer-supplied string before interpolating into
// the lead body. The legitimate `[NEW BUYBACK LEAD]` / `[IMEI
// WARNINGS]` markers are added by us in plain template strings, so
// they're unaffected by this strip.
function cleanField(s: unknown, max = 300): string {
  if (s === undefined || s === null) return "";
  const str = typeof s === "string" ? s : String(s);
  return str.replace(/[\[\]]/g, "").slice(0, max).trim();
}

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
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  let { payout } = data;
  const { name, phone, email, device, model, storage, condition, carrier, quote, quantity, photos, imei, imeiWarnings, handoff, brokenGlass, brokenFunctional, processor, memory, graphics, displayResolution, displayGlass, batteryHealth, charger, connectivity, extras, paidOff, devices, bestContact, notes, smsOptIn, attribution, couponCode, referralCode } = data;
  // TCPA defense in depth — client checkbox is `required`, but a
  // bypass (DevTools, malformed client) could submit phone without
  // consent. Reject any phone-bearing lead that didn't get explicit
  // smsOptIn=true. EXCEPTION: ship handoffs collect the phone for
  // FedEx label routing (FedEx prints + uses it for delivery issues)
  // not for our SMS marketing. Skipping TCPA consent there is correct
  // — admin status SMS still gates on the smsOptIn flag saved on the
  // lead, so we won't accidentally text a ship customer who only
  // wanted us to print it on the label.
  const isShipHandoff =
    handoff && typeof handoff === "object" &&
    (handoff as { method?: string }).method === "ship";
  if (
    phone && typeof phone === "string" && phone.replace(/\D/g, "").length >= 10 &&
    smsOptIn !== true && !isShipHandoff
  ) {
    return NextResponse.json({ error: "SMS consent required when providing a phone number." }, { status: 400 });
  }
  if (!name || (!phone && !email)) return NextResponse.json({ error: "Name and contact info required" }, { status: 400 });
  // FedEx requires a recipient phone on every label. Reject ship
  // handoffs that arrive without one so the auto-label-mint downstream
  // doesn't silently fail. UI already requires the field, this is the
  // defense-in-depth guard for malformed / scripted submissions.
  if (isShipHandoff && (!phone || (phone as string).replace(/\D/g, "").length < 10)) {
    return NextResponse.json({ error: "A 10-digit phone number is required for shipping — FedEx prints it on the label." }, { status: 400 });
  }

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

  // Payout-handle guard — Skywalker 2026-05-22. The funnel sends payout
  // as "<Method Label>: <handle>" (see app/page.tsx where payoutValue is
  // built). When the method is Bitcoin we reject any submission whose
  // handle fails the BTC checksum — a bad checksum guarantees the
  // payout would bounce, and crypto transfers can't be reversed. When
  // the method is Cash App we reject bad FORMAT only (the funnel runs
  // a separate /api/payout/verify-cashapp existence check, but that's
  // a fragile scrape — too slow and too prone to false negatives for
  // the submit path). Zelle / Cash skip this guard.
  if (typeof payout === "string" && payout.includes(":")) {
    const colonIdx = payout.indexOf(":");
    const methodPart = payout.slice(0, colonIdx).trim().toLowerCase();
    const handlePart = payout.slice(colonIdx + 1).trim();
    if (handlePart) {
      if (methodPart === "bitcoin" || methodPart === "btc") {
        if (!validateBtcAddress(handlePart)) {
          return NextResponse.json(
            { error: "That doesn't look like a valid Bitcoin address — please double-check the receiving address you entered." },
            { status: 400 }
          );
        }
      } else if (methodPart === "cash app" || methodPart === "cashapp") {
        // Normalize so a customer who omitted the leading $ still passes
        // when their handle is otherwise valid. The format check is the
        // hard gate; the live existence scrape lives in the funnel.
        const normalized = normalizeCashtag(handlePart);
        if (!cashtagFormatValid(normalized)) {
          return NextResponse.json(
            { error: "A Cash App handle should look like $yourname (letters and numbers only). Please re-enter it on the payout step." },
            { status: 400 }
          );
        }
      }
    }
  }

  // Dedup check — wider window for custom-quote flows (free-text descriptions).
  // Skywalker 2026-05-19: the funnel's quote-step auto-save fires a partial
  // lead (payout="TBD", no handoff) when the user enters email. That used to
  // poison the dedup window — the user's actual ship/local submission ~30s
  // later got rejected as duplicate, FedEx label never minted, success
  // screen still shown. Now we skip the dedup CHECK + WRITE for incomplete
  // previews so they don't block the real submission. Identifier: no
  // handoff AND payout is "TBD" or empty.
  const isPreviewSave = (!handoff || (typeof handoff === "object" && !(handoff as { method?: string }).method))
    && (!payout || payout === "TBD");
  const isCustom = !quote || quote === 0 || quote === "0";
  if (!isPreviewSave && isDuplicate(email, phone, device, model, isCustom)) {
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
  // Referral redemption — Skywalker 2026-05-22 referral program. When
  // a friend's REF-XXXXXX code rode in on the funnel's ?ref= param, we
  // resolve it to the referrer's email by scanning MC for the
  // [REFERRAL-CODE:] marker that /api/referral posted. A valid resolve
  // adds a flat REFERRAL_REFEREE_BONUS to this lead's payout — applied
  // the SAME way the coupon dollar value is (folded into quoteNum
  // below). The referrer's own reward is paid later, when the admin
  // status route flips this lead to paid/met (it reads the
  // "Referred-by:" line we write into the body). Fails safe: malformed
  // codes, unresolvable codes, self-referral, and MC outages all skip
  // the bonus silently — the lead still saves.
  let referralApplied: { code: string; referrerEmail: string } | null = null;
  if (typeof referralCode === "string" && referralCode.trim()) {
    const cleanRef = referralCode.trim().toUpperCase();
    // Format guard — only well-formed REF-XXXXXX codes get to query MC.
    if (REFERRAL_CODE_RE.test(cleanRef)) {
      try {
        const rr = await fetch(`${MC_API}/api/comms?limit=1000`, {
          headers: { "x-api-key": MC_KEY },
          cache: "no-store",
        });
        if (rr.ok) {
          const rd = await rr.json().catch(() => ({}));
          const refMsgs: { body?: string }[] = Array.isArray(rd.messages) ? rd.messages : [];
          let referrerEmail: string | null = null;
          for (const m of refMsgs) {
            if (!m.body) continue;
            const cm = m.body.match(/\[REFERRAL-CODE:\s*code=(REF-[A-Z0-9]{6})\s+email=([^\s\]]+)/i);
            if (cm && cm[1].toUpperCase() === cleanRef) {
              referrerEmail = cm[2].toLowerCase().trim();
              break;
            }
          }
          // Self-referral guard — a customer can't refer themselves for
          // a free $10. Compared case-insensitively against this lead's
          // own email. On a match we drop the referral entirely.
          const ownEmail = (email || "").toLowerCase().trim();
          if (referrerEmail && referrerEmail !== ownEmail) {
            referralApplied = { code: cleanRef, referrerEmail };
          }
        }
      } catch {
        // MC unreachable — skip the bonus, lead still saves.
      }
    }
  }
  const referralBonus = referralApplied ? REFERRAL_REFEREE_BONUS : 0;

  const baseQuoteNum = typeof quote === "number" ? quote : parseInt(quote as string) || 0;
  // Bonus from the coupon is applied AFTER margin reference but
  // BEFORE line construction so couponLines can render the totals.
  // The referral referee bonus stacks on top — both may apply, that's
  // intentional (a coupon and a referral are independent rewards).
  const quoteNum = baseQuoteNum + (couponApplied?.value || 0) + referralBonus;

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
      multiLines.push(`  ${i + 1}. ${cleanField(d.model, 120) || "—"}${d.storage ? ` · ${cleanField(d.storage, 30)}` : ""}${d.condition ? ` · ${cleanField(d.condition, 60)}` : ""}${d.quote ? ` · $${Number(d.quote) || 0}` : ""}${d.quantity && d.quantity > 1 ? ` (×${Number(d.quantity)})` : ""}`);
      // Per-device specs — indented under the device line so the admin
      // parser can pick them up via the "[Spec]: <value>" prefix. Each
      // line is the same key the single-device flow uses (Chip / RAM /
      // GPU / Display / Battery health / etc.) so one parser handles
      // both. Skywalker 2026-05-17: "all the important meat are missing".
      // All per-device fields are customer-controlled — sanitized
      // through cleanField() so they can't inject MC markers.
      const specBits: string[] = [];
      if (d.processor)         specBits.push(`Chip: ${cleanField(d.processor, 60)}`);
      if (d.memory)            specBits.push(`RAM: ${cleanField(d.memory, 30)}`);
      if (d.graphics)          specBits.push(`GPU: ${cleanField(d.graphics, 60)}`);
      if (d.displayResolution) specBits.push(`Display: ${cleanField(d.displayResolution, 60)}`);
      if (d.displayGlass)      specBits.push(`Display glass: ${cleanField(d.displayGlass, 40)}`);
      if (d.batteryHealth)     specBits.push(`Battery health: ${cleanField(d.batteryHealth, 30)}`);
      if (d.charger)           specBits.push(`Charger: ${cleanField(d.charger, 40)}`);
      if (d.carrier)           specBits.push(`Carrier: ${cleanField(d.carrier, 40)}`);
      if (d.connectivity)      specBits.push(`Connectivity: ${cleanField(d.connectivity, 40)}`);
      if (d.imei)              specBits.push(`IMEI: ${cleanField(d.imei, 20).replace(/[^0-9]/g, "")}`);
      if (Array.isArray(d.extras) && d.extras.length > 0) specBits.push(`Extras: ${(d.extras as unknown[]).map((x) => cleanField(x, 40)).filter(Boolean).join(", ")}`);
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
  // All these fields are customer-controlled and end up in the MC
  // lead body — sanitize through cleanField() so an attacker can't
  // inject [STATUS:] / [LEAD:] markers via the funnel form. See the
  // cleanField() comment near the top of this file.
  const specLines: string[] = [];
  if (processor)         specLines.push(`Chip: ${cleanField(processor, 60)}`);
  if (memory)            specLines.push(`RAM: ${cleanField(memory, 30)}`);
  if (graphics)          specLines.push(`GPU: ${cleanField(graphics, 60)}`);
  if (displayResolution) specLines.push(`Display: ${cleanField(displayResolution, 60)}`);
  if (displayGlass)      specLines.push(`Display glass: ${cleanField(displayGlass, 40)}`);
  if (batteryHealth)     specLines.push(`Battery health: ${cleanField(batteryHealth, 30)}`);
  if (charger)           specLines.push(`Charger: ${cleanField(charger, 40)}`);
  if (connectivity)      specLines.push(`Connectivity: ${cleanField(connectivity, 40)}`);
  if (Array.isArray(extras) && extras.length > 0) {
    specLines.push(`Extras: ${(extras as unknown[]).map((x) => cleanField(x, 40)).filter(Boolean).join(", ")}`);
  }
  // Carrier balance status — Skywalker 2026-05-17. We DO buy devices
  // with a balance, but the offer is adjusted for blacklist risk.
  if (paidOff === false) specLines.push("Balance: ⚠️ NOT PAID OFF — blacklist risk, adjust offer");
  else if (paidOff === true) specLines.push("Balance: Fully paid off");

  const imeiLines: string[] = [];
  if (imei) imeiLines.push(`IMEI: ${cleanField(imei, 20).replace(/[^0-9]/g, "")}`);
  if (Array.isArray(imeiWarnings) && imeiWarnings.length > 0) {
    imeiLines.push(`[IMEI WARNINGS] ${(imeiWarnings as unknown[]).map((x) => cleanField(x, 100)).filter(Boolean).join(" | ")}`);
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

  // Referral outcome — written into the lead body so (a) admin sees the
  // referral on the lead row, and (b) the admin status route can read
  // the "Referred-by:" line when this lead completes to credit the
  // referrer. The code is format-validated and the email came straight
  // from a marker we posted, so neither can carry a marker-injection
  // payload — but cleanField() is applied anyway for defense in depth.
  const referralLines: string[] = [];
  if (referralApplied) {
    referralLines.push(`Referred-by: ${referralApplied.code} (${cleanField(referralApplied.referrerEmail, 200)})`);
    referralLines.push(`Referral bonus: +$${REFERRAL_REFEREE_BONUS} off-the-top (referee first-trade bonus)`);
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
    // Strip [ and ] too — collapse-to-bullet handled newlines, but the
    // marker-injection threat requires removing brackets as well.
    const clean = notes.replace(/[\r\n]+/g, " · ").replace(/[\[\]]/g, "").trim().slice(0, 500);
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
    // Attribution fields are URL params captured by the funnel — fully
    // user-controlled (UTM, referrer). Sanitize each before joining
    // into the MC line so a crafted referrer can't inject [STATUS:].
    const bits: string[] = [];
    if (a.source) bits.push(`source=${cleanField(a.source, 80)}`);
    if (a.medium) bits.push(`medium=${cleanField(a.medium, 80)}`);
    if (a.campaign) bits.push(`campaign=${cleanField(a.campaign, 120)}`);
    if (a.term) bits.push(`term=${cleanField(a.term, 80)}`);
    if (a.content) bits.push(`content=${cleanField(a.content, 80)}`);
    if (a.referrer) bits.push(`ref=${cleanField(a.referrer, 120)}`);
    if (a.landed) bits.push(`landed=${cleanField(a.landed, 200)}`);
    if (bits.length > 0) {
      customerMetaLines.push(`Source: ${bits.join(" · ").slice(0, 480)}`);
    }
  }

  // Server-side IP + UA + visitor ID logging — Skywalker 2026-05-19
  // Tier-1 data-driven push. Each lead now carries the upstream IP,
  // truncated user-agent string, and the first-party visitor cookie
  // that layout.tsx sets on first page-view. Used for:
  //   - fraud detection (same IP submitting many leads)
  //   - geo sanity check (claims-to-be-Austin-but-IP-in-Florida)
  //   - cross-session attribution (came back N times before converting)
  const ip = (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  ).slice(0, 64);
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 240);
  const visitorId = (req.cookies.get("tcc_visitor_id")?.value || "").slice(0, 64);
  customerMetaLines.push(`Source-IP: ${ip}`);
  customerMetaLines.push(`Source-UA: ${ua}`);
  if (visitorId) customerMetaLines.push(`Visitor-ID: ${visitorId}`);

  const handoffLines: string[] = [];
  if (handoff && typeof handoff === "object") {
    const h = handoff as { method?: string; address?: Record<string, string>; area?: string; slot?: { id: string; date: string; time: string; label?: string } };
    if (h.method === "ship" && h.address) {
      // Address parts are customer-controlled — sanitize through
      // cleanField() to defuse MC marker injection (same threat as
      // name/model/etc).
      const street = cleanField(h.address.street, 120);
      const unit   = cleanField(h.address.unit, 40);
      const city   = cleanField(h.address.city, 80);
      const state  = cleanField(h.address.state, 2);
      const zip    = cleanField(h.address.zip, 10);
      handoffLines.push("--- Handoff: SHIPPING ---");
      handoffLines.push(`Address: ${street}${unit ? `, ${unit}` : ""}, ${city}, ${state} ${zip}`);
      handoffLines.push("Packaging: Seller sources own box (we don't ship kits).");
      handoffLines.push("Action: FedEx label auto-mints at submit (sandbox until prod cert lands). Confirm receipt + inspect on arrival.");
    } else if (h.method === "local") {
      handoffLines.push("--- Handoff: LOCAL MEETUP ---");
      if (h.area) handoffLines.push(`Area: ${cleanField(h.area, 80)}`);
      if (h.slot) {
        const [hh, mm] = String(h.slot.time || "").split(":").map(Number);
        const ampm = hh >= 12 ? "PM" : "AM";
        const h12 = hh % 12 || 12;
        const slotDate = cleanField(h.slot.date, 30);
        const slotLabel = cleanField(h.slot.label, 80);
        const slotId = cleanField(h.slot.id, 60);
        handoffLines.push(`Slot: ${slotDate} ${h12}:${String(mm).padStart(2, "0")} ${ampm}${slotLabel ? ` · ${slotLabel}` : ""} (id=${slotId})`);
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

  // Scrub user-controlled fields right before they hit the MC body.
  // See cleanField() comment for the marker-injection threat model.
  // We keep the originals untouched so downstream FedEx label + email
  // template code still sees the raw values; only the MC marker sees
  // the sanitized form.
  const safeName = cleanField(name, 120);
  const safePhone = cleanField(phone, 30);
  const safeEmail = cleanField(email, 200);
  const safeDevice = cleanField(device, 80);
  const safeModel = cleanField(model, 120);
  const safeStorage = cleanField(storage, 30);
  const safeCarrier = cleanField(carrier, 40);
  const safeCondition = cleanField(condition, 60);
  const safePayout = cleanField(payout, 80);

  const leadBody = isMulti
    ? [
        `[NEW BUYBACK LEAD — ${deviceList.length} DEVICES]`,
        `Name: ${safeName}`,
        `Phone: ${safePhone}`,
        safeEmail ? `Email: ${safeEmail}` : null,
        // Headline summary so the staff feed's model column reads
        // sensibly without parsing the indented device list.
        `Device: ${safeDevice || "multi"} — ${safeModel || `${deviceList.length} devices`}`,
        `Condition: Multi-device (${deviceList.length})`,
        safeCarrier ? `Carrier: ${safeCarrier}` : null,
        `Quote: $${deviceList.reduce((s, d) => s + (Number(d.quote) || 0) * (Number(d.quantity) || 1), 0)}`,
        `Payout: ${safePayout}`,
        ...couponLines,
        ...referralLines,
        ...customerMetaLines,
        ...multiLines,
        ...handoffLines,
      ].filter(Boolean).join("\n")
    : [
        `[NEW BUYBACK LEAD]${reviewRequired ? " ⚠️ NEEDS REVIEW" : ""}`,
        `Name: ${safeName}`,
        `Phone: ${safePhone}`,
        safeEmail ? `Email: ${safeEmail}` : null,
        `Device: ${safeDevice} — ${safeModel}`,
        safeStorage ? `Storage: ${safeStorage}` : null,
        safeCarrier ? `Carrier: ${safeCarrier}` : null,
        `Condition: ${safeCondition}`,
        quote ? `Quote: $${quote}` : `Quote: TBD (custom)`,
        `Payout: ${safePayout}`,
        ...couponLines,
        ...referralLines,
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

  // FedEx label minting must NOT depend on MC being reachable — the
  // customer paid us their time, they need their prepaid label even
  // if Mission Control is down. When MC didn't hand back a message id
  // (outage, auth failure), fall back to a timestamp-based id so the
  // label still gets a PO number + a unique blob path. The [LABEL:]
  // marker post stays gated on the REAL leadId since it needs MC
  // anyway — staff reconcile from the FedEx PO number on the label.
  // Skywalker 2026-05-19: caught when MC was down and submits stopped
  // producing labels entirely.
  const effectiveLeadId = leadId || `offline-${Date.now().toString(36)}`;

  // AI photo QA — fire-and-forget via Next.js after(). The customer's
  // funnel already returned by the time Claude Sonnet finishes the
  // vision call (~5-15s), and the [AI-FLAG] / [AI-NOTE] marker shows
  // up on the admin lead row a few seconds after the lead does.
  // Skywalker 2026-05-19. Only runs when photos are present + we
  // have a leadId to tie the marker to. Auto-skips for multi-device
  // leads since per-device photos are nested differently.
  if (leadId && Array.isArray(photos) && photos.length > 0 && !isMulti && model) {
    after(async () => {
      try {
        const { callAI, postAIMarker } = await import("../../lib/ai-gateway");
        const imageItems = (photos as string[]).slice(0, 4).map((url) => ({
          type: "image_url" as const,
          image_url: { url },
        }));
        const sysPrompt = `You are a device-inspection assistant for Top Cash Cellular, a phone-buyback service. The customer claimed a specific device + condition. Inspect the attached photos and return STRICT JSON: {"match": true|false, "observed_model": "<best guess or 'unclear'>", "observed_condition": "Excellent|Good|Fair|Broken|unclear", "issues": [<short strings>], "confidence": "high|medium|low", "recommendation": "approve|manual-review|reject"}. Flag two-tier condition discrepancies (Excellent vs Broken). Flag screenshots (visible OS UI). Skip minor cosmetic noise.`;
        const userPrompt = `Customer claim:\n- Model: ${model}\n- Condition: ${condition || "(n/a)"}\n\nInspect the ${(photos as string[]).length} photo(s).`;
        const result = await callAI({
          model: "anthropic/claude-sonnet-4-6",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: [{ type: "text", text: userPrompt }, ...imageItems] },
          ],
          json: true,
          maxTokens: 600,
        });
        type Verdict = { match?: boolean; observed_model?: string; observed_condition?: string; issues?: string[]; confidence?: string; recommendation?: string };
        const v = (result.parsed || {}) as Verdict;
        const issueCount = v.issues?.length || 0;
        const flagged = v.match === false || issueCount > 0 || v.recommendation === "reject";
        const summary = flagged
          ? `${v.recommendation || "review"} · ${v.observed_model ? `observed=${v.observed_model} vs claimed=${model}` : ""} · ${(v.issues || []).join("; ")}`
          : `clean · matches ${model}${v.confidence ? ` (${v.confidence} confidence)` : ""}`;
        await postAIMarker({
          kind: flagged ? "AI-FLAG" : "AI-NOTE",
          leadId: leadId as string,
          body: `photo-check · ${summary}`,
          tags: ["ai", "photo-check", flagged ? "flagged" : "clean"],
        });
      } catch {
        // Best-effort — never break the lead flow on AI failures.
      }
    });
  }

  // Theot's channel recommendation — looks up Atlas wholesale + eBay
  // sold-listing comps for each device in the lead, runs the math
  // through 13% FVF + family shipping (comp-economics), and asks the
  // AI Gateway to recommend the best sell channel. Posts an
  // [AI-SUMMARY: leadId] marker signed as Theot so the lead row reads
  // "Theot says: sell on Atlas, +$X vs eBay +$Y because …".
  // Skywalker 2026-05-19. Multi-device support added same day — bundles
  // get one consolidated recommendation covering per-device channels
  // and total expected profit.
  if (leadId && (model || deviceList.length > 0)) {
    after(async () => {
      try {
        const { loadCompFiles, lookupCellEconomics } = await import("../../lib/comp-lookup");
        const { callAI, postAIMarker } = await import("../../lib/ai-gateway");
        const { atlas, ebay } = await loadCompFiles();

        const parseQuote = (q: unknown): number | null => {
          const m = /\d+/.exec(String(q || ""));
          return m ? parseInt(m[0], 10) : null;
        };

        // Build the per-device economics array. Single-device leads get
        // one row built from the top-level fields; multi-device leads
        // get one row per cart item.
        type Row = {
          index: number;
          label: string;
          storage: string;
          condition: string;
          carrier: string;
          payout: number | null;
          quantity: number;
          ship: number;
          atlasResell: number | null;
          atlasNet: number | null;
          atlasMargin: number | null;
          ebayGross: number | null;
          ebayNet: number | null;
          ebayMargin: number | null;
          ebaySamples: number;
        };
        const sources = isMulti
          ? deviceList.map((d, i) => ({
              index: i + 1,
              label: d.model || "",
              storage: d.storage,
              condition: d.condition,
              carrier: d.carrier,
              quote: d.quote,
              quantity: Number(d.quantity) || 1,
            }))
          : [{
              index: 1,
              label: model || "",
              storage,
              condition,
              carrier,
              quote,
              quantity: Number(quantity) || 1,
            }];

        const rows: Row[] = [];
        for (const s of sources) {
          if (!s.label) continue;
          const econ = lookupCellEconomics({
            modelLabel: s.label,
            storage: s.storage as string | null | undefined,
            condition: s.condition as string | null | undefined,
            carrier: s.carrier as string | null | undefined,
            atlas, ebay,
          });
          if (!econ) continue;
          const payout = parseQuote(s.quote);
          rows.push({
            index: s.index,
            label: s.label,
            storage: econ.storageSlug,
            condition: econ.conditionSlug,
            carrier: econ.carrierSlug || "unlocked",
            payout,
            quantity: s.quantity,
            ship: econ.shipCost,
            atlasResell: econ.atlasResell,
            atlasNet: econ.atlasNet,
            atlasMargin: econ.atlasNet != null && payout != null ? Math.round(econ.atlasNet - payout) : null,
            ebayGross: econ.ebayGross,
            ebayNet: econ.ebayNet,
            ebayMargin: econ.ebayNet != null && payout != null ? Math.round(econ.ebayNet - payout) : null,
            ebaySamples: econ.ebaySamples,
          });
        }
        if (rows.length === 0) return;

        const sysPrompt = `You are Theot, the resale-channel strategist for Top Cash Cellular. For each device in a lead, pick the best exit channel — Atlas (wholesale, no FVF, family shipping only), eBay (13% FVF + $0.40 + family shipping), Swappa (private sale, ~no fee), or pass on a bad-margin device. Return STRICT JSON:
{
  "devices": [
    { "index": <int>, "channel": "atlas" | "ebay" | "swappa" | "pass", "expected_margin": <integer or null>, "rationale": "<one-line, <100 chars>" }
  ],
  "total_profit": <sum of expected_margin × quantity across all devices, integer>,
  "summary": "<one-line, <140 chars, action-oriented bundle summary>"
}

Rules:
- Prefer Atlas when atlas_margin within 15% of ebay_margin — faster, no FVF, no return risk.
- Prefer eBay only when its margin is meaningfully better AND sample count is solid (n≥5).
- "swappa" if both Atlas and eBay are thin AND device is premium current-gen.
- "pass" when neither channel beats $10 profit AND no relationship play.
- expected_margin is the SINGLE-UNIT margin (don't multiply by quantity — total_profit does that).
- Concrete numbers in rationale, no fluff.`;

        const isBundle = rows.length > 1;
        const deviceLines = rows.map(r => `[${r.index}] ${r.label} ${r.storage}${/^\d+tb$/.test(r.storage) ? "" : "GB"} ${r.condition}${r.carrier !== "unlocked" ? ` ${r.carrier.toUpperCase()}` : ""}${r.quantity > 1 ? ` ×${r.quantity}` : ""}
    paid customer: $${r.payout ?? "?"}
    Atlas: ${r.atlasResell != null ? `wholesale $${r.atlasResell} − $${r.ship} ship = net $${Math.round(r.atlasNet!)}` : "no data"}${r.atlasMargin != null ? ` → margin ${r.atlasMargin >= 0 ? "+" : ""}$${r.atlasMargin}` : ""}
    eBay: ${r.ebayGross != null ? `gross median $${Math.round(r.ebayGross)} (n=${r.ebaySamples}) − 13% FVF − $0.40 − $${r.ship} ship = net $${Math.round(r.ebayNet!)}` : "no data"}${r.ebayMargin != null ? ` → margin ${r.ebayMargin >= 0 ? "+" : ""}$${r.ebayMargin}` : ""}`).join("\n\n");

        const userPrompt = `${isBundle ? `Bundle of ${rows.length} devices:` : "Single-device lead:"}

${deviceLines}

Pick the best channel per device. Be concise.`;

        const result = await callAI({
          model: "anthropic/claude-haiku-4-5",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          json: true,
          maxTokens: 600,
        });
        type DeviceRec = { index?: number; channel?: string; expected_margin?: number | null; rationale?: string };
        type Rec = { devices?: DeviceRec[]; total_profit?: number; summary?: string };
        const rec = (result.parsed || {}) as Rec;
        if (!Array.isArray(rec.devices) || rec.devices.length === 0 || !rec.summary) return;

        // Build the marker body. For single devices we keep the
        // legacy "sell on X · rationale" shape so the admin pill reads
        // the same. For bundles we lead with the summary line and
        // append per-device picks below.
        const channelLabel = (ch?: string) => ch === "atlas" ? "Atlas" : ch === "ebay" ? "eBay" : ch === "swappa" ? "Swappa" : "Pass";
        let body: string;
        const tagBits: string[] = ["ai", "channel-rec", "theot"];
        if (isBundle) {
          const lines = rec.devices.map(d => {
            const r = rows.find(x => x.index === d.index);
            return `[${d.index}] ${r?.label || "?"} → ${channelLabel(d.channel)}${d.expected_margin != null ? ` ${d.expected_margin >= 0 ? "+" : ""}$${d.expected_margin}` : ""}${d.rationale ? ` · ${d.rationale}` : ""}`;
          });
          body = `channel-rec · ${rec.summary}${rec.total_profit != null ? ` · total ${rec.total_profit >= 0 ? "+" : ""}$${rec.total_profit}` : ""}\n${lines.join("\n")}`;
          tagBits.push("bundle");
          for (const d of rec.devices) if (d.channel) tagBits.push(`channel-${d.channel}`);
        } else {
          const d = rec.devices[0] || {};
          body = `channel-rec · sell on ${channelLabel(d.channel)} · ${d.rationale || rec.summary}`;
          if (d.channel) tagBits.push(`channel-${d.channel}`);
        }
        await postAIMarker({
          kind: "AI-SUMMARY",
          leadId: leadId as string,
          body,
          tags: tagBits,
          signAs: { from: "theot", fromName: "Theot" },
        });
      } catch {
        // Best-effort — never break the lead flow on AI failures.
      }
    });
  }

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
    // Silent-skip diagnostic — when a ship handoff arrives but FedEx
    // can't be called (missing phone, incomplete address), write a
    // [LABEL-WITHHELD: leadId] marker so admin sees WHY no label exists
    // instead of staring at a ship lead with nothing attached. Skywalker
    // 2026-05-19 caught the silent skip when his mobile test came
    // through with an empty phone field. Don't gate the lead save —
    // we still want the customer's submission in the system; staff can
    // text them to collect the missing data + regenerate the label.
    if (h.method === "ship" && leadId) {
      const missing: string[] = [];
      if (!hasFullAddress) missing.push("address");
      if (phoneDigits.length < 10) missing.push("phone");
      if (missing.length > 0) {
        try {
          await fetch(`${MC_API}/api/comms`, {
            method: "POST",
            headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "topcash-web",
              fromName: "Top Cash Cellular",
              role: "system",
              body: `[LABEL-WITHHELD: ${leadId}] reason=missing_${missing.join("_and_")}`,
              tags: ["fedex-label", "withheld"],
              priority: "normal",
            }),
          });
        } catch {}
      }
    }
    if (h.method === "ship" && hasFullAddress && phoneDigits.length >= 10) {
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
        // Declared value = the full quoted payout for everything in the
        // box. FedEx caps its liability at this amount if the package is
        // lost or damaged; we absorb the small declared-value fee.
        const shipDeclaredValue = isMulti
          ? deviceList.reduce((s, d) => s + (Number(d.quote) || 0), 0)
          : quoteNum;
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
          poNumber: `TCC-${effectiveLeadId}`,
          declaredValueUsd: shipDeclaredValue,
        });
        // Upload to Vercel Blob — random suffix so the tracking number
        // alone can't be pivoted to a leaked label.
        const pdfBytes = Buffer.from(label.labelPdfBase64, "base64");
        const blob = await put(`fedex-labels/${effectiveLeadId}-${Date.now()}.pdf`, pdfBytes, {
          access: "public",
          contentType: "application/pdf",
        });
        fedexLabel = { tracking: label.trackingNumber, url: blob.url, service: label.serviceType };
        // Post the [LABEL: <leadId>] marker so the admin GET parser
        // attaches tracking + URL to the lead row. Gated on a REAL
        // leadId — when MC is down there's nothing to attach it to;
        // the label is still returned to the customer regardless.
        if (leadId) {
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
        }
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
        // Address-invalid is a customer-data issue — staff doesn't need
        // a 3am SMS. Service-unavailable means our FedEx integration is
        // broken (key expired, API down, account suspended); SMS owner
        // immediately so we can fix before more leads pile up.
        reportError("fedex.label.mint", err, {
          leadId: leadId || effectiveLeadId,
          critical: !addressy,
          extra: { kind: fedexError.kind, weight: totalWeight, deviceCount: deviceList.length || 1 },
        });
        // Post a marker so admin can see which leads need a manual
        // label generation. Sanitized message — no FedEx key leakage.
        // Gated on a real leadId — without MC there's no row to flag.
        if (leadId) {
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

  return NextResponse.json({
    ok: true, leadId, fedexLabel, fedexError, couponApplied, couponError,
    // Surface the referral outcome so the funnel can confirm the bonus
    // landed. Only the code is echoed — not the referrer's email.
    referralApplied: referralApplied ? { code: referralApplied.code, bonus: REFERRAL_REFEREE_BONUS } : null,
  });
}
