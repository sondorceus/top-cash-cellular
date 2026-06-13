import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { put } from "@vercel/blob";
import { createReturnLabel, deviceKindFromString, aggregateWeight, shouldBlockAutoShip } from "../../lib/fedex";
import { reportError } from "../../lib/error-report";
import { REFERRAL_REFEREE_BONUS, REFERRAL_CODE_RE } from "../../lib/referral";
import { validateBtcAddress, cashtagFormatValid, normalizeCashtag, validateZelle } from "../../lib/payout-verify";
import { clientIp, rateLimit, rateLimitResponse } from "../../lib/rate-limit";
import { formatOfferNumber } from "../../lib/offer-number";
import { getResellEstimate, resellMultiplierForCondition } from "../../lib/resell-estimates";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";
// Where new-lead alerts get emailed. Set this env to a personal inbox to
// get pinged personally — or to a carrier email-to-SMS gateway (e.g.
// 5125550199@vtext.com / @txt.att.net / @tmomail.net) to get a real text
// on your phone without Twilio. Defaults to the support inbox.
const OWNER_EMAIL = process.env.OWNER_EMAIL || "support@topcashcellular.com";

// Lead dedup: track recent submissions to prevent duplicates.
// Custom-quote flows (no instant price) get a wider window keyed on
// device-category + email — this catches the case where a user re-submits
// the same kind of device with a tweaked free-text description.
//
// STORAGE NOTE: this Map is only a same-instance FAST PATH (instant block
// for a rapid double-click on a warm Lambda). It resets on cold start and
// isn't shared across concurrent instances, so on its own it left a
// duplicate-payout window (resubmit right after a deploy, or two parallel
// submits landing on different Lambdas). The cross-instance authority is
// isDuplicateMC() below, which checks Mission Control — the shared store
// every Lambda already reads/writes — before posting. (Audit 2026-05-24
// flagged the gap; this closes it without needing Vercel KV provisioned.
// If KV is ever added, it can replace BOTH layers.)
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
  // Phone normalization: strip every non-digit (handles spaces, dashes,
  // parens), then strip a leading 1 from an 11-digit US number so
  // "+15125550000" and "5125550000" dedup as the same number. Without
  // this, a customer who hit submit twice with and without the
  // country-code prefix sailed past dedup. Skywalker 2026-05-23.
  const c = (contact || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
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

// Cross-instance dedup authority. Scans recent Mission Control comms for
// a [NEW BUYBACK LEAD] from the same contact (email or normalized phone)
// for the same product, inside the dedup window. Because MC is shared
// across every Lambda, this catches duplicates the in-memory Map can't:
// cold starts and concurrent submits on different instances. Fails OPEN
// (returns false) on any MC error so a real lead is never blocked by an
// MC outage — matching the rest of this route's "MC down ≠ lost lead"
// stance. Skywalker 2026-05-28.
async function isDuplicateMC(email: string, contact: string, device: string, model: string, isCustom: boolean): Promise<boolean> {
  const e = (email || "").toLowerCase().trim();
  const c = (contact || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (!e && !c) return false;
  const productKey = (isCustom ? (device || "") : (model || "")).toLowerCase().trim();
  const windowMs = isCustom ? DEDUP_CUSTOM_MS : DEDUP_REGULAR_MS;
  const cutoff = Date.now() - windowMs;
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=200`, { headers: { "x-api-key": MC_KEY }, cache: "no-store" });
    if (!r.ok) return false;
    const data = await r.json().catch(() => ({}));
    const msgs: { body?: string; timestamp?: string }[] = Array.isArray(data.messages) ? data.messages : [];
    for (const m of msgs) {
      const b = m.body || "";
      if (!/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(b)) continue;
      const ts = m.timestamp ? new Date(m.timestamp).getTime() : 0;
      if (!ts || ts < cutoff) continue; // outside the window
      const bodyEmail = (b.match(/(?:^|\n)Email:[ \t]*([^\n]*)/i)?.[1] || "").toLowerCase().trim();
      const bodyPhone = (b.match(/(?:^|\n)Phone:[ \t]*([^\n]*)/i)?.[1] || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      const contactMatch = (!!e && bodyEmail === e) || (!!c && !!bodyPhone && bodyPhone === c);
      if (!contactMatch) continue;
      // Product match mirrors the in-memory key: regular → model, custom →
      // device-category. Empty productKey falls back to contact-in-window.
      if (!productKey || b.toLowerCase().includes(productKey)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Resell values from Swappa (real market data, scraped 2026-05-12).
// Used to calculate profit margin on each lead for the owner's review.
// Resell estimates + condition/brokenGlass multipliers live in the shared
// lib/resell-estimates.ts so the server margin guardrail uses the EXACT
// same table the funnel quotes from. (This route used to carry a private
// fork that drifted — stale Xbox numbers, missing Pixels/Watches/iPad, and
// no brokenGlass deduction — which silently clamped legit quotes down and
// false-flagged them as tampered. Always import; never re-fork.)

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
  // Per-IP rate limit: 5 lead submissions per 5 min. A normal customer
  // submits 1–2 leads in a session even when comparison-shopping; a
  // CSRF-driven hijack attempt or scripted spammer hits this immediately.
  // Sits BEFORE JSON parse so malformed-body floods are throttled too.
  // 2026-05-24.
  const rlIp = clientIp(req);
  const rl = rateLimit(`lead:${rlIp}`, 5, 5 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs, "Too many submissions — please wait a few minutes before trying again.");

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Free-recycling fork — Skywalker 2026-05-22. When recycle:true the
  // customer is opting into responsible disposal of a $0 / no-value /
  // manual-review device instead of bouncing. No payout, no FedEx label,
  // no payment-method validation. We still write the standard
  // [NEW BUYBACK LEAD] marker (with Recycle-only: yes flagged) so the
  // lead appears in the admin feed, and we send an e-waste certificate
  // email via Resend instead of the normal payout-confirmation email.
  // Branch handled in a dedicated helper below — falls through to the
  // standard pricing/payment path otherwise.
  if (data?.recycle === true) {
    return handleRecycleLead(req, data);
  }
  // Quote-save / progress preview — the funnel fires a lightweight POST
  // (previewSave:true) when the customer enters their email at the
  // "save this quote for later" box or the account step ("Continue as
  // Guest" / returning / Google), BEFORE they've chosen a payout method
  // or handoff. Those are NOT confirmed buyback leads: routing them
  // through the normal path posted a full urgent [NEW BUYBACK LEAD] +
  // owner-alert email — and, for guests who went on to finish, a
  // duplicate of their real lead. Record them under a non-urgent
  // [QUOTE SAVED] marker (so abandoners can be followed up) with no owner
  // email, no FedEx, no coupon redemption. NOTE the custom/inquiry-device
  // submit also posts payout:"TBD" with no handoff but IS a real lead —
  // it does not set previewSave, so it still flows through the main path.
  if (data?.previewSave === true) {
    return handleQuoteSave(req, data);
  }
  let { payout } = data;
  const { name, phone, email, device, model, storage, condition, carrier, carrierLock, accessoriesIncluded, quote, quantity, photos, imei, imeiWarnings, handoff, brokenGlass, brokenFunctional, processor, memory, graphics, displayResolution, displayGlass, batteryHealth, charger, connectivity, extras, paidOff, devices, bestContact, notes, smsOptIn, attribution, couponCode, promoCode, referralCode } = data;
  // TCPA defense in depth — client checkbox is `required`, but a
  // bypass (DevTools, malformed client) could submit phone without
  // consent. Reject any phone-bearing lead that didn't get explicit
  // smsOptIn=true. EXCEPTION: ship handoffs collect the phone for
  // FedEx label routing (FedEx prints + uses it for delivery issues)
  // not for our SMS marketing. Skipping TCPA consent there is correct
  // — admin status SMS still gates on the smsOptIn flag saved on the
  // lead, so we won't accidentally text a ship customer who only
  // wanted us to print it on the label.
  // Treat "mixed" the same as "ship" for SMS-consent purposes — both
  // collect the phone for the FedEx label, not for marketing texts.
  const isShipHandoff =
    handoff && typeof handoff === "object" &&
    ((handoff as { method?: string }).method === "ship" ||
     (handoff as { method?: string }).method === "mixed");
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
    ((handoff as { method?: string }).method === "ship" ||
     (handoff as { method?: string }).method === "mixed") &&
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
      } else if (methodPart === "zelle") {
        // Zelle accepts an email or a US phone — anything else won't
        // route. Same fail-fast rule as the others.
        if (!validateZelle(handlePart)) {
          return NextResponse.json(
            { error: "A Zelle handle should be an email or a 10-digit US phone number. Please re-enter it on the payout step." },
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
  // In-memory fast path first (instant, side-effect records the key), then
  // the MC cross-instance authority for the cold-start/concurrent case.
  if (!isPreviewSave && (isDuplicate(email, phone, device, model, isCustom) || await isDuplicateMC(email, phone, device, model, isCustom))) {
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

  const submittedQuoteNum = typeof quote === "number" ? quote : parseInt(quote as string) || 0;
  // Server-side anti-tamper guardrail. The funnel calculates the quote
  // client-side and posts it back here; nothing previously verified the
  // value, so DevTools could rewrite the hidden input and submit any
  // amount. Recompute the allowed server-side ceiling from RESELL_ESTIMATES
  // × condition multiplier × margin floor (0.75). If the submitted quote
  // exceeds that ceiling by more than $5 (tolerance for accessory/popular-
  // device bonuses that legitimately stack on top), clamp it down to the
  // ceiling and flag the lead for manual review. Unknown models (no
  // resell estimate) bypass — those already route through needsManualReview
  // by other means. 2026-05-24.
  const SERVER_MARGIN_FLOOR_MULT = 0.75;
  const SERVER_QUOTE_TOLERANCE = 5;
  // For a multi-device submission the order-level `model` is a summary
  // string ("3 devices — iPhone … + 2 more") that getResellEstimate can't
  // resolve, so the per-item cap is null and tampering goes through. Sum
  // a real cap by walking the `devices` array and capping each item by
  // its OWN resell × condition × margin-floor × quantity. Single-device
  // submissions keep the original headline-model lookup.
  const isMultiDeviceCart = Array.isArray((data as { devices?: unknown }).devices)
    && ((data as { devices?: unknown[] }).devices?.length || 0) > 1;
  const computeCap = (m: unknown, c: unknown, bg?: unknown): number | null => {
    const r = getResellEstimate(typeof m === "string" ? m : "");
    if (r == null) return null;
    const glass = bg === "front" || bg === "back" || bg === "both" ? bg : null;
    const cm = resellMultiplierForCondition(typeof c === "string" ? c : "", glass);
    return Math.round(r * cm * SERVER_MARGIN_FLOOR_MULT);
  };
  let serverQuoteCap: number | null;
  if (isMultiDeviceCart) {
    const devs = (data as { devices: { model?: string; condition?: string; quantity?: number; brokenGlass?: unknown }[] }).devices;
    let acc = 0;
    let anyKnown = false;
    for (const d of devs) {
      const cap = computeCap(d.model, d.condition, d.brokenGlass);
      if (cap != null) {
        anyKnown = true;
        acc += cap * (Number(d.quantity) || 1);
      }
    }
    // If NO device in the cart is recognized we can't cap — leave null
    // so the lead saves; manual review will catch it via other guards.
    serverQuoteCap = anyKnown ? acc : null;
  } else {
    serverQuoteCap = computeCap(model, condition, brokenGlass);
  }
  // Quote-step promo coupons (/coupons.json) apply a PERCENT bonus that the
  // client folds into the submitted quote. The server MUST re-validate the code
  // against the same source (never trust a client-claimed percent) and raise the
  // cap by that percent — otherwise a legit promo quote trips the tamper clamp,
  // silently dropping the customer's discount AND logging them as a fraudster.
  // Single-device only: the cap is one device's ceiling, so a validated percent
  // maps cleanly. Multi-device carts snapshot per-item prices under possibly
  // different promo states, so raising the summed cap there would be a small
  // fraud vector — left for a deliberate fix. (bug fix)
  let promoApplied: { code: string; percent: number } | null = null;
  if (typeof promoCode === "string" && promoCode.trim() && !isMultiDeviceCart && serverQuoteCap != null) {
    const cleanPromo = promoCode.trim().toUpperCase();
    try {
      const origin = new URL(req.url).origin;
      const pr = await fetch(`${origin}/coupons.json`, { cache: "no-store" });
      if (pr.ok) {
        const promos = (await pr.json().catch(() => ({}))) as Record<string, { percent?: number; active?: boolean }>;
        const p = promos[cleanPromo];
        const pct = Number(p?.percent);
        if (p?.active && Number.isFinite(pct) && pct > 0) {
          const safePct = Math.min(pct, 50); // hard ceiling, defense-in-depth
          promoApplied = { code: cleanPromo, percent: safePct };
          serverQuoteCap = Math.round(serverQuoteCap * (1 + safePct / 100));
        }
      }
    } catch { /* non-fatal — fall through to the un-raised cap */ }
  }
  let quoteTampered = false;
  let baseQuoteNum = submittedQuoteNum;
  if (serverQuoteCap != null && submittedQuoteNum > serverQuoteCap + SERVER_QUOTE_TOLERANCE) {
    quoteTampered = true;
    baseQuoteNum = serverQuoteCap;
    console.warn(`[lead] Quote tamper detected: ${isMultiDeviceCart ? "multi-device" : `model=${String(model).slice(0,60)} condition=${String(condition).slice(0,30)}`} submitted=$${submittedQuoteNum} cap=$${serverQuoteCap} — clamped.`);
  }
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
    imeiWarnings?: string[];
    // Per-item handoff (ship | local) for mixed-cart orders so staff
    // know which devices to expect in the FedEx box vs at the meetup.
    handoff?: "ship" | "local";
  };
  const deviceList = Array.isArray(devices) ? (devices as DeviceEntry[]).filter((d) => d && (d.model || d.condition)) : [];
  const isMulti = deviceList.length > 1;
  const multiLines: string[] = [];
  if (isMulti) {
    multiLines.push(`Devices: ${deviceList.length}`);
    deviceList.forEach((d, i) => {
      const handoffTag = d.handoff === "ship" ? " · 📦 SHIP"
                       : d.handoff === "local" ? " · 🤝 LOCAL"
                       : "";
      multiLines.push(`  ${i + 1}. ${cleanField(d.model, 120) || "—"}${d.storage ? ` · ${cleanField(d.storage, 30)}` : ""}${d.condition ? ` · ${cleanField(d.condition, 60)}` : ""}${d.quote ? ` · $${Number(d.quote) || 0}${d.quantity && d.quantity > 1 ? " total" : ""}` : ""}${d.quantity && d.quantity > 1 ? ` (×${Number(d.quantity)})` : ""}${handoffTag}`);
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
      if (Array.isArray(d.imeiWarnings) && d.imeiWarnings.length > 0) specBits.push(`[IMEI WARNINGS] ${(d.imeiWarnings as unknown[]).map((x) => cleanField(x, 100)).filter(Boolean).join(" | ")}`);
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
    // The thank-you ($) coupon and referral referee bonus are NOT gated to
    // single-device (only the percent promo is), so a multi-device cart can
    // carry them — and they ARE part of what we pay. parseTotalPayoutLine /
    // the analytics + customers rollups read this "Total payout:" line, so
    // it must include the bonus or the recorded payout undercounts the real
    // one (the single-device Quote/headline already folds the bonus in).
    const multiBonus = (couponApplied?.value || 0) + referralBonus;
    // On tamper the per-device quotes are the inflated client values, so
    // the honest figure is the clamped baseQuoteNum — keep this line in
    // sync with the clamped headline above (review note has the detail).
    multiLines.push(
      quoteTampered
        ? `Total payout: $${baseQuoteNum + multiBonus} (clamped from $${total})`
        : `Total payout: $${total + multiBonus}`
    );
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
  // Carrier lock + accessories both move the quote (−$200 lock deduction,
  // +$10–30 accessory bonus) but weren't surfaced to staff. Without them
  // the admin can't reconcile the quote against the device on arrival.
  if (carrierLock) specLines.push(`Carrier lock: ${cleanField(carrierLock, 40)}`);
  if (accessoriesIncluded === true) specLines.push("Accessories: ✅ all original accessories included (bonus applied)");
  else if (accessoriesIncluded === false) specLines.push("Accessories: none included");

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
  // Promo (percent) coupon audit — the discount is already inside the quote;
  // this line records that the cap was raised so the offer wasn't clamped.
  if (promoApplied) {
    couponLines.push(`Promo applied: ${promoApplied.code} (+${promoApplied.percent}% — included in quote)`);
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
    // Helper — renders an address block. Address parts are
    // customer-controlled, so sanitize through cleanField().
    const renderShipBlock = (header: string) => {
      handoffLines.push(header);
      // Custom / inquiry leads capture the ship PREFERENCE before any
      // quote exists — there's no address yet (and no FedEx label mints,
      // see the mint guard below). Record the intent so staff know to
      // collect the address + mint the label once the price is agreed,
      // instead of leaving the handoff section blank. Skywalker 2026-06-12.
      if (!h.address) {
        handoffLines.push("Address: (not collected yet — custom/TBD quote)");
        handoffLines.push("Action: Send quote first, then collect shipping address + mint label.");
        return;
      }
      const street = cleanField(h.address.street, 120);
      const unit   = cleanField(h.address.unit, 40);
      const city   = cleanField(h.address.city, 80);
      const state  = cleanField(h.address.state, 2);
      const zip    = cleanField(h.address.zip, 10);
      handoffLines.push(`Address: ${street}${unit ? `, ${unit}` : ""}, ${city}, ${state} ${zip}`);
      handoffLines.push("Packaging: Seller sources own box (we don't ship kits).");
      handoffLines.push("Action: FedEx label auto-mints at submit (sandbox until prod cert lands). Confirm receipt + inspect on arrival.");
    };
    const renderLocalBlock = (header: string) => {
      handoffLines.push(header);
      if (h.area) handoffLines.push(`Area: ${cleanField(h.area, 80)}`);
      if (h.slot) {
        // Open-day / all-day slots carry an empty time. The old code did
        // "".split(":") → [NaN], printing "12:undefined AM". Treat a
        // missing/!HH:MM time as "Any time" (matches the funnel picker).
        const rawTime = String(h.slot.time || "").trim();
        const tm = rawTime.match(/^(\d{1,2}):(\d{2})$/);
        let slotTime = "Any time";
        if (tm) {
          const hh = Number(tm[1]);
          const ampm = hh >= 12 ? "PM" : "AM";
          const h12 = hh % 12 || 12;
          slotTime = `${h12}:${tm[2]} ${ampm}`;
        }
        const slotDateRaw = cleanField(h.slot.date, 30);
        let slotDate = slotDateRaw;
        const dt = new Date(`${slotDateRaw}T12:00:00`);
        if (!Number.isNaN(dt.getTime())) {
          slotDate = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        }
        const slotLabel = cleanField(h.slot.label, 80);
        const slotId = cleanField(h.slot.id, 60);
        handoffLines.push(`Slot: ${slotDate} · ${slotTime}${slotLabel ? ` · ${slotLabel}` : ""} (id=${slotId})`);
        handoffLines.push("Action: Confirm meetup spot with seller for the booked window.");
      } else {
        handoffLines.push("Action: Reach out to schedule meetup time and location.");
      }
    };
    if (h.method === "ship") {
      renderShipBlock("--- Handoff: SHIPPING ---");
    } else if (h.method === "local") {
      renderLocalBlock("--- Handoff: LOCAL MEETUP ---");
    } else if (h.method === "mixed") {
      // Mixed cart — customer had ship items AND local items in the
      // same order. Render both fulfillment blocks; per-device .handoff
      // on `devices` below tells staff which item goes where. FedEx
      // label still auto-mints (address present), and the chosen slot
      // covers the local items.
      handoffLines.push("--- Handoff: MIXED (some ship, some local) ---");
      handoffLines.push("Per-device handoff is listed in the devices section below.");
      renderShipBlock("  --- Shipping items ---");
      renderLocalBlock("  --- Local items ---");
    }
  }

  // Margin analysis — estimate profit on this deal. Resell value is the
  // working-condition Swappa mid price, scaled down for damaged devices
  // (broken phones sell for parts at ~30% of working). Without this
  // condition scaling, broken-tier quotes claimed huge fake margins.
  // quoteNum (computed above) includes the coupon bonus so margin math
  // reflects the real outlay.
  const resellWorking = getResellEstimate(model as string);
  const condMult = resellMultiplierForCondition(condition as string, (brokenGlass ?? null) as "front" | "back" | "both" | null);
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

  // High-value review trigger. For a bundle the order-level `model` is a
  // summary string and quoteNum is the whole-cart total — judging review
  // on that flagged EVERY bundle over $1000 (cheap-phone carts cross it
  // easily). Judge per-device instead: a bundle needs review only if some
  // INDIVIDUAL device is high-value (>= $1000 or a review-keyword model).
  // Single-device keeps the original headline-model check.
  const highValueReview = isMulti
    ? deviceList.some((d) => needsManualReview(typeof d.model === "string" ? d.model : "", Number(d.quote) || 0))
    : needsManualReview(model as string, quoteNum);
  const reviewRequired = highValueReview || quoteTampered;
  const reviewLines: string[] = [];
  if (quoteTampered) {
    reviewLines.push("🚨 QUOTE TAMPER DETECTED — client posted a quote above the server-side margin ceiling.");
    reviewLines.push(`Submitted: $${submittedQuoteNum} · Server cap: $${serverQuoteCap} · Clamped to: $${baseQuoteNum} (before coupon/referral).`);
    reviewLines.push("Verify funnel integrity / inspect lead source before paying out.");
  }
  if (highValueReview) {
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
        // NEEDS REVIEW flag mirrors the single-device path — bundles
        // were silently skipping it even when the summed quote tripped
        // the high-value / tamper guards.
        `[NEW BUYBACK LEAD — ${deviceList.length} DEVICES]${reviewRequired ? " ⚠️ NEEDS REVIEW" : ""}`,
        `Name: ${safeName}`,
        `Phone: ${safePhone}`,
        safeEmail ? `Email: ${safeEmail}` : null,
        // Headline summary so the staff feed's model column reads
        // sensibly without parsing the indented device list.
        `Device: ${safeModel || `${deviceList.length} devices`}`,
        `Condition: Multi-device (${deviceList.length})`,
        // No top-level Carrier on a bundle — `carrier` here is leftover
        // single-device state and misrepresents a mixed-carrier cart
        // (e.g. an AT&T + Verizon bundle showed "Carrier: Verizon").
        // Each device's real carrier is listed per-row in multiLines.
        // Show the server-VALIDATED total: on tamper the per-device sum
        // is the inflated client value, so fall back to the clamped
        // baseQuoteNum (the summed per-item cap) and note the original.
        `Quote: $${quoteTampered ? baseQuoteNum : deviceList.reduce((s, d) => s + (Number(d.quote) || 0), 0)}${quoteTampered ? ` (clamped from $${submittedQuoteNum})` : ""}`,
        `Payout: ${safePayout}`,
        ...couponLines,
        ...referralLines,
        ...reviewLines,
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
        quote ? `Quote: $${quoteNum}${quoteTampered ? ` (clamped from $${submittedQuoteNum})` : ""}` : `Quote: TBD (custom)`,
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

        // Shared comma-aware money parser — old /\d+/ collapsed
        // "$1,250" to 1, which made the AI's "Operator pays $1, sells
        // for $200, profit $199" summary nonsensical. Inline import
        // (instead of top-level) because this whole block runs inside
        // the after() callback that already lazy-imports comp-lookup.
        const { parseDollarAmount } = await import("../../lib/lead-money");
        const parseQuote = (q: unknown): number | null => {
          const n = parseDollarAmount(String(q ?? ""));
          return n > 0 ? n : null;
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
    // Mixed cart handoff includes an address for the ship items, so the
    // FedEx label needs to fire on "mixed" as well as "ship". The local
    // items are tracked separately via the slot booked client-side.
    const needsLabel = h.method === "ship" || h.method === "mixed";
    if (needsLabel && leadId) {
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
    if (needsLabel && hasFullAddress && phoneDigits.length >= 10) {
      // Mixed carts only ship items whose per-device handoff is "ship";
      // local items go to the meetup and must NOT count toward the FedEx
      // box's weight, declared value, or device manifest. Pure-ship and
      // single-device orders pass every device through unchanged.
      const shipOnlyDevices = (h.method === "mixed")
        ? deviceList.filter((d) => d.handoff !== "local")
        : deviceList;
      const shipOnlyMulti = shipOnlyDevices.length > 1;
      // Multi-device shipments fit in ONE box. Total weight = sum of
      // per-device defaults + 2 lb packaging. Skywalker 2026-05-18:
      // FedEx bills the actual scanned weight regardless of what we
      // declare — but declaring the realistic weight upfront sets the
      // right service tier and avoids correction surcharges of $5-15.
      const deviceKinds = shipOnlyMulti
        ? shipOnlyDevices.map((d) => ({ deviceKind: deviceKindFromString(d.model || "") }))
        : [{ deviceKind: deviceKindFromString((shipOnlyDevices[0]?.model || model) as string) }];
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
        // intake person immediately sees how many to expect. Mixed cart
        // counts ship items only — local items aren't in this box.
        const deviceCount = shipOnlyDevices.length || 1;
        const refText = deviceCount > 1
          ? `${deviceCount} devices`
          : (shipOnlyDevices[0]?.model
              ? String(shipOnlyDevices[0].model).slice(0, 30)
              : (model ? String(model).slice(0, 30) : "1 device"));
        // Declared value = the full quoted payout for everything in the
        // box. FedEx caps its liability at this amount if the package is
        // lost or damaged; we absorb the small declared-value fee. Mixed
        // carts only insure the ship items — local items are paid at the
        // meetup and never enter this box.
        const shipDeclaredValue = shipOnlyMulti
          ? shipOnlyDevices.reduce((s, d) => s + (Number(d.quote) || 0), 0)
          : (shipOnlyDevices[0]?.quote != null ? Number(shipOnlyDevices[0].quote) : quoteNum);
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
          ? { kind: "ADDRESS_INVALID", hint: "FedEx couldn't validate your shipping address. Please double-check the street, city, state, and ZIP — then email support@topcashcellular.com with the correction and we'll resend your label." }
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
    // Surface the fulfillment method so staff can dispatch immediately
    // without opening the lead (ship needs warehouse intake, local needs
    // a scheduled meetup, mixed needs both).
    const handoffMethodStr = (handoff && typeof handoff === "object")
      ? String((handoff as { method?: string }).method || "")
      : "";
    const handoffTag = handoffMethodStr === "ship" ? " [📦 SHIP]"
                     : handoffMethodStr === "local" ? " [🤝 LOCAL]"
                     : handoffMethodStr === "mixed" ? " [📦+🤝 MIXED]"
                     : "";
    const ownerSms = `${reviewTag}NEW LEAD${handoffTag}: ${name} wants to sell ${model} (${condition})${quote ? ` for $${quote}` : " — custom quote needed"}. Phone: ${phone || "N/A"} Email: ${email || "N/A"}${photoNote}`;
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

  // Auto-scheduling outreach — Skywalker 2026-05-28. A local/mixed lead
  // that comes in WITHOUT a booked meetup slot used to rely on staff
  // manually reaching out (the confirmation email literally says "we
  // reach out to schedule"). Instead, immediately email the customer to
  // lock in a time, and flag in the owner alert below that it auto-sent
  // — so a lead never sits unscheduled and the owner sees the outreach
  // fired (within seconds of submit). Ship-only leads are skipped (they
  // get a prepaid label, no meetup); leads that already picked a slot in
  // the funnel are skipped too.
  const schedHandoff = (handoff && typeof handoff === "object")
    ? (handoff as { method?: string; slot?: { id?: string } })
    : null;
  const schedMethod = schedHandoff?.method || "";
  const alreadyScheduled = !!(schedHandoff?.slot && schedHandoff.slot.id);
  const needsScheduling = (schedMethod === "local" || schedMethod === "mixed") && !alreadyScheduled;
  let schedulingEmailSent = false;
  if (needsScheduling && email && typeof email === "string" && process.env.RESEND_API_KEY) {
    try {
      const escS = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (ch) => (ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&amp;"));
      const offerHref = `https://topcashcellular.com/offer/${encodeURIComponent(effectiveLeadId)}`;
      const offerRef = formatOfferNumber(effectiveLeadId);
      const firstName = (typeof name === "string" ? name.trim().split(/\s+/)[0] : "") || "there";
      const deviceLabel = cleanField(model, 120) || cleanField(device, 80) || "your device";
      const lockLine = quoteNum > 0
        ? `Your offer of $${quoteNum} for ${deviceLabel} is locked in for 14 days.`
        : `We've got your request for ${deviceLabel}.`;
      const schedHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#13142b;color:#e6e6e6;margin:0;padding:24px 16px"><div style="max-width:520px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden"><div style="padding:18px 22px;color:#ffffff;font-weight:800;font-size:18px">Let&apos;s set up your Austin meetup</div><div style="padding:20px 22px;font-size:14px;line-height:1.7">Hi ${escS(firstName)},<br><br>${escS(lockLine)}<br><br>To get you paid, just <b>reply to this email with a couple of times that work this week</b> and we&apos;ll confirm a quick Austin meetup — most wrap in under 15 minutes, paid on the spot (cash, Zelle, Cash App, or Venmo).<br><br><a href="${offerHref}" style="display:inline-block;margin-top:6px;padding:10px 20px;background:#00c853;color:#0a0a0a;font-weight:800;text-decoration:none;border-radius:999px;font-size:13px">View your offer →</a><div style="margin-top:16px;font-size:12px;color:#888">Reference: Offer #${escS(offerRef)}</div></div></div></div>`;
      const schedText = `Hi ${firstName}, ${lockLine} To get paid, reply with a couple of times that work this week and we'll confirm a quick Austin meetup. View your offer: ${offerHref} — Offer #${offerRef}`;
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const sr = await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: email,
        subject: `Pick a time for your Top Cash payout — Offer #${offerRef}`,
        html: schedHtml,
        text: schedText,
      });
      schedulingEmailSent = !!(sr?.data?.id);
    } catch {}
  }

  // Owner alert via EMAIL — the Twilio SMS above is dead until 10DLC
  // lands, so email is the working channel. Goes to OWNER_EMAIL; point
  // that env at a personal inbox (or a carrier SMS gateway) to be pinged
  // personally on every new lead. Customer-supplied values are HTML-
  // escaped before they enter the template.
  if (process.env.RESEND_API_KEY) {
    try {
      const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (ch) => (ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&amp;"));
      const oneLine = (s: unknown) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
      const handoffMethodStr = (handoff && typeof handoff === "object") ? String((handoff as { method?: string }).method || "") : "";
      const handoffTag = handoffMethodStr === "ship" ? "📦 SHIP" : handoffMethodStr === "local" ? "🤝 LOCAL" : handoffMethodStr === "mixed" ? "📦+🤝 MIXED" : "";
      const firstPhoto = (photos as string[] | undefined)?.length ? (photos as string[])[0] : "";
      const rows: [string, string][] = [
        ["Customer", oneLine(name) || "—"],
        ["Device", `${oneLine(model)} · ${oneLine(condition)}`],
        ["Quote", quote ? `$${quote}` : "Custom / manual quote"],
        ["Phone", oneLine(phone) || "N/A"],
        ["Email", oneLine(email) || "N/A"],
      ];
      if (handoffTag) rows.push(["Handoff", handoffTag]);
      // Confirm the auto-scheduling outreach fired (or flag that it
      // couldn't) so the owner knows a no-slot lead is already being
      // chased — no manual "did we reach out yet?" guessing.
      if (needsScheduling) rows.push(["Auto-scheduling", schedulingEmailSent ? "✅ emailed customer to pick a time" : (email ? "⚠️ email failed — reach out manually" : "⚠️ no email on file — text/call to schedule")]);
      if (firstPhoto) rows.push(["Photo", firstPhoto]);
      const subject = oneLine(`${reviewRequired ? "⚠️ REVIEW · " : ""}New lead: ${oneLine(name)} — ${oneLine(model)}${quote ? ` ($${quote})` : " (custom)"}`).slice(0, 180);
      const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#13142b;color:#e6e6e6;margin:0;padding:24px 16px"><div style="max-width:520px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden"><div style="padding:18px 22px;color:#ffffff;font-weight:800;font-size:18px">${reviewRequired ? "⚠️ " : ""}New buyback lead</div><div style="padding:20px 22px;font-size:14px;line-height:1.7">${rows.map(([k, v]) => `<div><span style="color:#888">${esc(k)}:</span> <span style="color:#fff">${esc(v)}</span></div>`).join("")}<div style="margin-top:18px"><a href="https://topcashcellular.com/admin" style="display:inline-block;padding:10px 20px;background:#00c853;color:#0a0a0a;font-weight:800;text-decoration:none;border-radius:999px;font-size:13px">Open admin</a></div></div></div></div>`;
      const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\nhttps://topcashcellular.com/admin";
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: OWNER_EMAIL,
        subject,
        html,
        text,
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

// ---------------------------------------------------------------------------
// Recycle-only lead handler — Skywalker 2026-05-22.
//
// Customers landing at a $0 / manual-review / pending-quote state can opt
// into free responsible recycling instead of bouncing. We:
//   1. Skip ALL payout/payment-method validation (no money is moving).
//   2. Skip the FedEx label auto-mint (the seller can drop in any plain
//      box at our address or visit Austin local — no insured label
//      needed for a no-value device).
//   3. Write the standard [NEW BUYBACK LEAD] marker with a
//      "Recycle-only: yes" line so the admin parser flags the row.
//   4. Fire a branded e-waste certificate email via Resend (separate
//      template — Certificate of Responsible Recycling, dark theme,
//      green accent, NIST 800-88 wording).
//
// Required body fields: name, email, model. device/storage/condition/
// carrier are optional (whatever the funnel collected before bouncing).
// Phone is NOT required for recycle-only — we only need email to
// deliver the certificate.
async function handleRecycleLead(req: NextRequest, data: Record<string, unknown>) {
  const name = typeof data.name === "string" ? data.name : "";
  const email = typeof data.email === "string" ? data.email : "";
  const device = typeof data.device === "string" ? data.device : "";
  const model = typeof data.model === "string" ? data.model : "";
  const storage = typeof data.storage === "string" ? data.storage : "";
  const condition = typeof data.condition === "string" ? data.condition : "";
  const carrier = typeof data.carrier === "string" ? data.carrier : "";

  if (!name.trim() || !email.trim() || !/.+@.+\..+/.test(email.trim())) {
    return NextResponse.json(
      { error: "Name and a valid email are required to send your e-waste certificate." },
      { status: 400 }
    );
  }
  if (!model.trim()) {
    return NextResponse.json(
      { error: "Device model is required so we know what we're receiving." },
      { status: 400 }
    );
  }

  // Sanitize every customer-supplied field before interpolating into MC
  // — same marker-injection defense the main path uses.
  const safeName = cleanField(name, 120);
  const safeEmail = cleanField(email, 200);
  const safeDevice = cleanField(device, 80);
  const safeModel = cleanField(model, 120);
  const safeStorage = cleanField(storage, 30);
  const safeCondition = cleanField(condition, 60);
  const safeCarrier = cleanField(carrier, 40);

  // Server-side IP + UA + visitor cookie — same audit trail the main
  // path captures, so recycle leads also support fraud + attribution.
  const ip = (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  ).slice(0, 64);
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 240);
  const visitorId = (req.cookies.get("tcc_visitor_id")?.value || "").slice(0, 64);

  const leadBody = [
    `[NEW BUYBACK LEAD] ♻ RECYCLE-ONLY`,
    `Name: ${safeName}`,
    `Phone: `,
    `Email: ${safeEmail}`,
    `Device: ${safeDevice || "—"} — ${safeModel}`,
    safeStorage ? `Storage: ${safeStorage}` : null,
    safeCarrier ? `Carrier: ${safeCarrier}` : null,
    safeCondition ? `Condition: ${safeCondition}` : null,
    `Quote: $0`,
    `Payout: Free recycling`,
    `Recycle-only: yes`,
    `Source-IP: ${ip}`,
    `Source-UA: ${ua}`,
    visitorId ? `Visitor-ID: ${visitorId}` : null,
    "--- Handoff: RECYCLE ---",
    "Action: Customer is shipping or dropping off for free responsible recycling. No payout, no FedEx label auto-mint. E-waste certificate emailed at submit.",
  ].filter(Boolean).join("\n");

  // Post the lead to MC. Best-effort — if MC is down we still send the
  // certificate email so the customer isn't left in limbo.
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
        tags: ["lead", "buyback", "recycle"],
        priority: "normal",
      }),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      leadId = d?.message?.id || null;
    }
  } catch {}

  // E-waste certificate email — branded HTML matching the existing
  // /api/confirm aesthetic (dark theme, green accent, gradient header).
  // Customer name + device label + lead id + date go on a "certificate"
  // panel inside the email body. NIST 800-88 wording is intentional
  // since that IS our wipe standard — but we don't claim third-party
  // certification we don't have.
  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    // Format the leadId as #XXXX-XXXX for display (offer page convention).
    const idSource = (leadId || `R${Date.now().toString(36).toUpperCase()}`).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const padded = (idSource + "00000000").slice(0, 8);
    const certNumber = `${padded.slice(0, 4)}-${padded.slice(4, 8)}`;
    const certDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const deviceLabel = [safeModel, safeStorage, safeCondition].filter(Boolean).join(" · ") || safeModel || "Device";
    const html = renderRecycleCertificateEmail({
      customerName: safeName,
      deviceLabel,
      certNumber,
      certDate,
    });
    const text = `Hi ${safeName}, your Certificate of Responsible Recycling from Top Cash Cellular is attached as a PDF. Device: ${deviceLabel}. Certificate #${certNumber}. Issued ${certDate}. Your device will be securely wiped to NIST 800-88 and either refurbished for reuse or broken down for component recovery — never landfilled. Questions? Reply to this email or write to support@topcashcellular.com.`;
    // Generate the actual certificate PDF to attach. Graceful: if PDF gen
    // ever fails, we still send the email (which has the certificate panel
    // in-body) rather than leaving the customer with nothing.
    let certAttachments: { filename: string; content: Buffer }[] | undefined;
    try {
      const { generateRecycleCertificatePdf } = await import("../../lib/recycle-certificate-pdf");
      const pdfBytes = await generateRecycleCertificatePdf({ customerName: safeName, deviceLabel, certNumber, certDate });
      certAttachments = [{ filename: `Recycling-Certificate-${certNumber}.pdf`, content: Buffer.from(pdfBytes) }];
    } catch (err) {
      reportError("recycle.cert.pdf", err, { customerEmail: email, critical: false, extra: { model: safeModel } });
    }
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: email.trim(),
        subject: "Your e-waste certificate — Top Cash Cellular",
        html,
        text,
        ...(certAttachments ? { attachments: certAttachments } : {}),
      });
      emailSent = !!(result?.data?.id);
      if (!emailSent) {
        reportError("recycle.email.no-id", new Error("Resend returned no message id"), {
          customerEmail: email,
          critical: false,
          extra: { model: safeModel },
        });
      }
    } catch (err) {
      reportError("recycle.email.send", err, {
        customerEmail: email,
        critical: false,
        extra: { model: safeModel },
      });
    }
  }

  return NextResponse.json({ ok: true, recycle: true, leadId, emailSent });
}

// ---------------------------------------------------------------------------
// Quote-save handler — see the previewSave branch in POST for the why.
//
// A preview-save is fired by the funnel when the customer enters their
// email but hasn't picked a payout method or handoff yet. We capture it
// under a [QUOTE SAVED] marker (NOT [NEW BUYBACK LEAD], so the admin
// buyback feed — which keys on that marker — ignores it) at NORMAL
// priority and with no "lead"/"buyback" tags, so it doesn't fire the
// urgent new-lead alert. We deliberately skip the owner-alert email,
// FedEx label mint, and coupon/referral redemption: none of those should
// happen for a half-finished funnel. Best-effort — never blocks the UI
// (the funnel calls this fire-and-forget).
async function handleQuoteSave(req: NextRequest, data: Record<string, unknown>) {
  const email = typeof data.email === "string" ? data.email : "";
  // Nothing to capture without an email — the whole point is to be able
  // to follow up with the customer later.
  if (!email.trim() || !/.+@.+\..+/.test(email.trim())) {
    return NextResponse.json({ ok: true, quoteSaved: false });
  }

  const name = typeof data.name === "string" ? data.name : "";
  const device = typeof data.device === "string" ? data.device : "";
  const model = typeof data.model === "string" ? data.model : "";
  const storage = typeof data.storage === "string" ? data.storage : "";
  const condition = typeof data.condition === "string" ? data.condition : "";
  const carrier = typeof data.carrier === "string" ? data.carrier : "";
  const quoteNum = Number(data.quote) || 0;

  // Same marker-injection scrub the main + recycle paths use.
  const safeName = cleanField(name, 120);
  const safeEmail = cleanField(email, 200);
  const safeDevice = cleanField(device, 80);
  const safeModel = cleanField(model, 120);
  const safeStorage = cleanField(storage, 30);
  const safeCondition = cleanField(condition, 60);
  const safeCarrier = cleanField(carrier, 40);

  const ip = (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  ).slice(0, 64);
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 240);
  const visitorId = (req.cookies.get("tcc_visitor_id")?.value || "").slice(0, 64);

  const leadBody = [
    `[QUOTE SAVED]`,
    `Name: ${safeName || "(not provided yet)"}`,
    `Email: ${safeEmail}`,
    (safeDevice || safeModel) ? `Device: ${safeDevice || "—"} — ${safeModel}` : null,
    safeStorage ? `Storage: ${safeStorage}` : null,
    safeCarrier ? `Carrier: ${safeCarrier}` : null,
    safeCondition ? `Condition: ${safeCondition}` : null,
    quoteNum > 0 ? `Quote: $${quoteNum}` : `Quote: TBD`,
    `Status: Incomplete — customer entered email but has not chosen a payout method or handoff. Not a confirmed buyback lead; follow up if it never completes.`,
    `Source-IP: ${ip}`,
    `Source-UA: ${ua}`,
    visitorId ? `Visitor-ID: ${visitorId}` : null,
  ].filter(Boolean).join("\n");

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
        tags: ["quote-saved"],
        priority: "normal",
      }),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      leadId = d?.message?.id || null;
    }
  } catch {}

  return NextResponse.json({ ok: true, quoteSaved: true, leadId });
}

// Branded e-waste certificate email template. Dark theme, green accent,
// gradient header — matches the look of /api/confirm so the customer
// recognizes it as the same brand. Honest wording: we describe what we
// actually do (wipe to NIST 800-88, refurbish or component-recover);
// we do NOT claim third-party certification ("Certificate of Responsible
// Recycling" is a transactional acknowledgement, not a legal/audit doc).
function renderRecycleCertificateEmail(opts: {
  customerName: string;
  deviceLabel: string;
  certNumber: string;
  certDate: string;
}): string {
  const { customerName, deviceLabel, certNumber, certDate } = opts;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;color:#e6e6e6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#13142b;background-image:radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.22) 0%, transparent 62%)">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;margin:0 auto;border-collapse:separate;background:#171936;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.4)">

<!-- Header — clean: brand wordmark + thin green accent rule, no green block -->
<tr><td style="padding:30px 32px 22px;border-bottom:1px solid rgba(255,255,255,0.08)">
<img src="https://topcashcellular.com/logo-wordmark-glass.png" alt="Top Cash Cellular" width="150" style="display:block;width:150px;height:auto;border:0;outline:none;margin:0" />
<div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;margin-top:11px">Certificate of Responsible Recycling</div>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:28px 28px 6px 28px">
<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Hi ${customerName || "there"},</div>
<div style="font-size:14px;color:#bdbdbd;line-height:1.6">Thank you for choosing to recycle responsibly. Your certificate is <strong style="color:#fff">attached as a PDF</strong> — and shown below for your records.</div>
</td></tr>

<!-- Certificate panel -->
<tr><td style="padding:18px 28px 6px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.09);border-radius:14px">
<tr><td style="padding:22px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08)">
<div style="font-size:10px;color:#00c853;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:8px;font-weight:800">Certificate</div>
<div style="font-size:34px;font-weight:800;color:#fff;line-height:1;letter-spacing:-0.01em;font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,monospace">#${certNumber}</div>
<div style="font-size:11px;color:#888;margin-top:10px;letter-spacing:0.08em;text-transform:uppercase">Issued ${certDate}</div>
</td></tr>
<tr><td style="padding:18px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Issued to</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700">${customerName || "—"}</td></tr>
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Device</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06)">${deviceLabel}</td></tr>
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Recycler</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06)">Top Cash Cellular · Austin, TX</td></tr>
<tr><td style="padding:8px 0;color:#888;font-size:13px">Date issued</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right">${certDate}</td></tr>
</table>
</td></tr>
</table>
</td></tr>

<!-- What happens to the device -->
<tr><td style="padding:24px 28px 8px 28px">
<div style="font-size:13px;color:#fff;font-weight:800;margin-bottom:10px;letter-spacing:-0.01em">What happens to your device</div>
<div style="font-size:13px;color:#dcdcdc;line-height:1.7">
Your device will be securely wiped to <strong style="color:#fff">NIST 800-88</strong> media-sanitization standard, then either <strong style="color:#fff">refurbished for reuse</strong> by a new owner or <strong style="color:#fff">broken down for component recovery</strong> (precious metals, plastics, glass). It will never be dumped in a landfill or shipped overseas as e-waste.
</div>
</td></tr>

<!-- Next step — short, no follow-up promise -->
<tr><td style="padding:16px 28px 4px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px">
<tr><td style="padding:14px 18px;font-size:13px;color:#e6e6e6;line-height:1.55">
<strong style="color:#00c853">Heads up:</strong> we&#39;ll be in touch within one business day to arrange the handoff — drop-off in Austin or a prepaid recycle label by mail if you&#39;re out of town. No payout, no follow-up — this is on us.
</td></tr>
</table>
</td></tr>

<!-- Footer — customer service pill (same look as the site footer) -->
<tr><td style="padding:28px 28px 28px 28px">
<div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:18px"></div>
<div style="text-align:center">
<div style="font-size:10px;color:#00c853;text-transform:uppercase;letter-spacing:0.18em;font-weight:800;margin-bottom:8px">Customer Service</div>
<div style="margin-bottom:8px"><a href="mailto:support@topcashcellular.com" style="display:inline-block;padding:8px 16px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.10);border-radius:999px;color:#fff;text-decoration:none;font-size:13px;font-weight:700">support@topcashcellular.com</a></div>
<div style="font-size:12px;color:#888;line-height:1.6">Top Cash Cellular · Austin, TX</div>
<div style="font-size:12px;color:#888;line-height:1.6"><a href="https://topcashcellular.com" style="color:#00c853;text-decoration:none">topcashcellular.com</a> · Mon–Sat 8 AM–8 PM CT</div>
<div style="font-size:11px;color:#555;margin-top:10px">© ${new Date().getFullYear()} Top Cash Cellular. All rights reserved.</div>
<div style="font-size:11px;color:#555;margin-top:4px">This is a transactional acknowledgement of free responsible recycling — not a legal/audit certification.</div>
</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

