import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { lookupAtlasResell, type AtlasReference } from "../../../lib/atlas-lookup";
import { ebayGrossToNet, atlasResellToNet } from "../../../lib/comp-economics";
import { parseDollarAmount } from "../../../lib/lead-money";
import skuLabelsJson from "../../../data/sku-labels.json";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || (() => { throw new Error("TCC_ADMIN_TOKEN env required"); })();

const SKU_LABELS: Record<string, string> = skuLabelsJson as Record<string, string>;
// Reverse-lookup: human-readable label → SKU. The lead body carries the
// label string ("iPhone 17 Pro Max"); we need the slug for Atlas + eBay
// lookups. Built once per cold start.
const LABEL_TO_SKU: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [sku, label] of Object.entries(SKU_LABELS)) {
    out[label.toLowerCase().trim()] = sku;
  }
  return out;
})();

// Cached compute-side comps. Loaded lazily on first GET; survives across
// hot requests in the same lambda instance.
type EbayCell = { count: number; average: number; median: number; net_average?: number; net_median?: number; min: number; max: number };
type EbayReference = {
  models?: Record<string, {
    by_cell?: Record<string, Record<string, EbayCell>>;
  }>;
};
let atlasRefCache: AtlasReference | null = null;
let ebayRefCache: EbayReference | null = null;
async function loadCompRefs(): Promise<{ atlas: AtlasReference; ebay: EbayReference }> {
  if (atlasRefCache && ebayRefCache) return { atlas: atlasRefCache, ebay: ebayRefCache };
  try {
    const [a, e] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "public", "comps", "atlas-reference.json"), "utf-8").then(JSON.parse).catch(() => ({})),
      fs.readFile(path.join(process.cwd(), "public", "comps", "ebay-sold.json"), "utf-8").then(JSON.parse).catch(() => ({})),
    ]);
    atlasRefCache = a;
    ebayRefCache = e;
  } catch {
    atlasRefCache = atlasRefCache || {};
    ebayRefCache = ebayRefCache || {};
  }
  return { atlas: atlasRefCache!, ebay: ebayRefCache! };
}

// Normalize a label-form storage ("256 GB", "1 TB") to a price-table slug
// ("256", "1tb"). Returns null when the value doesn't look like a size.
function normalizeStorage(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/\s+/g, "");
  if (/^(\d+)tb$/.test(s)) return s; // 1tb / 2tb
  const m = /^(\d+)gb?$/.exec(s);
  if (m) return m[1];
  if (/^\d+$/.test(s)) return s;
  return null;
}

// Normalize a condition label ("Excellent", "Very Good", "Fair / Beat Up",
// "Sealed", …) to the canonical slug used by Atlas + eBay lookups.
//
// Skywalker 2026-05-19 collapsed Mint+Very Good into a single "Excellent"
// tier. New funnel leads carry "Condition: Excellent" — that maps to the
// `mint` slug (same as the slug the funnel still emits internally). Old
// MC leads with "Mint" or "Very Good" in the body keep parsing:
//   - "Mint"      → mint        (no change)
//   - "Very Good" → verygood    (atlas-lookup aliases this to grade_c,
//                                resell-estimates to 0.80x — both
//                                resolve to Good-tier numbers under the
//                                new pricing intent)
//   - "Excellent" → mint        (new label → existing slug)
// "Lightly Flown" is DJI's Excellent override and folds into mint too.
function normalizeCondition(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (k.includes("seal") || k.includes("newseal")) return "sealed";
  // verygood check MUST come before plain "good" since "verygood" contains
  // "good" as a substring. Same with "excellent" before "good".
  if (k.includes("verygood")) return "verygood";
  if (k.includes("excellent") || k.includes("lightlyflown")) return "mint";
  if (k.includes("mint") || k.includes("pristine") || k.includes("flawless")) return "mint";
  if (k.includes("good") || k.includes("wellmaintained")) return "good";
  if (k.includes("fair") || k.includes("beatup") || k.includes("heavilyused")) return "fair";
  if (k.includes("broken") || k.includes("cracked") || k.includes("damag")) return "broken";
  return null;
}

// Carrier label → slug. Returns null for unlocked (the funnel writes
// "Unlocked" or omits the field entirely).
function normalizeCarrier(raw: string | undefined | null): "att" | "tmobile" | "other" | null {
  if (!raw) return null;
  const k = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (k.includes("unlock") || k === "none" || k === "n/a") return null;
  if (k.includes("att") || k.includes("at&t") || k.includes("cricket")) return "att";
  if (k.includes("tmobile") || k.includes("metro") || k.includes("mint")) return "tmobile";
  // Anything else (Verizon, US Cellular, Boost, Straight Talk, etc.)
  return "other";
}

// eBay condition mapping. Atlas has its own scheme; eBay buckets are
// just "sealed" / "used" / "broken".
function ebayBucketForCondition(cond: string | null): "sealed" | "used" | "broken" | null {
  if (!cond) return null;
  if (cond === "sealed") return "sealed";
  if (cond === "broken") return "broken";
  return "used";
}

// Look up a lead's eBay net-median resale value for its exact cell.
// Recomputes net from the stored GROSS median using the current FVF +
// shipping config (comp-economics), so the pre-baked net_median field
// in ebay-sold.json (which was scraped at the old 12% FVF) doesn't
// drift from Skywalker's real 13% account rate. Skywalker 2026-05-19.
function lookupEbayNet(
  ebay: EbayReference,
  sku: string,
  storage: string | null,
  condition: string | null,
): { netMedian: number; sampleCount: number } | null {
  const model = ebay.models?.[sku];
  if (!model?.by_cell) return null;
  const bucket = ebayBucketForCondition(condition);
  if (!bucket) return null;
  // Storage-keyed: by_cell[storage][bucket]
  if (storage && model.by_cell[storage]) {
    const cell = model.by_cell[storage][bucket];
    if (cell?.median) return { netMedian: ebayGrossToNet(cell.median, sku), sampleCount: cell.count };
  }
  // Fallback: try ANY storage if the lead's storage isn't represented.
  // Take the storage bucket with the most samples.
  let best: { netMedian: number; sampleCount: number } | null = null;
  for (const stor of Object.values(model.by_cell)) {
    const cell = stor[bucket];
    if (!cell?.median) continue;
    const net = ebayGrossToNet(cell.median, sku);
    if (!best || cell.count > best.sampleCount) best = { netMedian: net, sampleCount: cell.count };
  }
  return best;
}

// Resolve a lead's SKU from its model label. Falls back to a case-
// insensitive partial match if exact lookup fails (handles minor
// punctuation drift like "iPhone 13 mini" vs "iPhone 13 Mini").
function resolveSku(modelLabel: string | undefined | null): string | null {
  if (!modelLabel) return null;
  const key = modelLabel.toLowerCase().trim();
  if (LABEL_TO_SKU[key]) return LABEL_TO_SKU[key];
  // Partial: pick the SKU whose label is a substring of (or contains)
  // the lead label. Prefer the longest matching label.
  let best: { sku: string; len: number } | null = null;
  for (const [lab, sku] of Object.entries(LABEL_TO_SKU)) {
    if (key.includes(lab) || lab.includes(key)) {
      if (!best || lab.length > best.len) best = { sku, len: lab.length };
    }
  }
  return best?.sku || null;
}

// Admin leads dashboard backend.
// Pulls last ~300 MC comms, extracts [NEW BUYBACK LEAD] messages, joins
// each with its most recent [STATUS: <status>] reply (matched by lead id),
// and returns the 50 most recent leads with current status.

// Internal identifiers — leads matching ANY of these are tagged
// isInternal=true so the admin can hide them with one toggle. Skywalker
// 2026-05-19: stop polluting analytics with his own test submissions.
// Env vars override the bakedinto-code defaults so he can add more
// identifiers without a redeploy.
const INTERNAL_IPS = (process.env.TCC_INTERNAL_IPS || "136.49.4.25").split(",").map((s) => s.trim()).filter(Boolean);
const INTERNAL_EMAILS = (process.env.TCC_INTERNAL_EMAILS || "sondorceus@gmail.com,sellurcell@topcashcells.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

interface AdminLead {
  id: string;
  timestamp: string;
  name?: string;
  phone?: string;
  email?: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  carrier?: string;
  quote?: string;
  payout?: string;
  imei?: string;
  imeiWarnings?: string[];
  photos?: string[];
  // Broken-condition detail surfaced from the lead body. Skywalker
  // 2026-05-17 — staff page must show front/back-glass status so the
  // tech knows what damage to expect at handoff.
  brokenGlass?: "front" | "back" | "both" | null;
  brokenFunctional?: boolean | null;
  // Full spec answers from the funnel — surfaced so staff can price
  // accurately without dropping into the body text. Skywalker 2026-05-17.
  processor?: string;
  memory?: string;
  graphics?: string;
  displayResolution?: string;
  displayGlass?: string;
  batteryHealth?: string;
  charger?: string;
  connectivity?: string;
  extras?: string[];
  paidOff?: boolean | null;
  // Customer-meta from the contact step — Skywalker 2026-05-18 "make
  // sure im getting every detail". bestContact is how the seller
  // wants to be reached; customerNote is the free-form "anything
  // else?" answer; quantity is the single-device unit count.
  bestContact?: "text" | "call" | "email";
  customerNote?: string;
  quantity?: number;
  // TCPA opt-in disposition (yes/no) for the captured phone. Lets
  // staff see at a glance whether they can SMS this customer.
  smsOptIn?: boolean;
  // First-touch attribution captured on the funnel landing — UTM
  // bits + referrer host, parsed back out of the "Source: ..." line.
  source?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string; referrer?: string; landed?: string; raw: string };
  // Multi-device leads — when one lead bundles N items, the indented
  // device block from /api/lead gets parsed here so staff sees each
  // unit without dropping into the raw body. Skywalker 2026-05-17.
  devices?: Array<{
    model: string;
    storage?: string;
    condition?: string;
    quote?: number;
    quantity?: number;
    photos?: string[];
    // Per-device specs surfaced from the indented lines under each
    // device entry in the lead body. Lets staff price each unit in a
    // bundled trade without flying blind.
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
  }>;
  deviceCount?: number;
  totalPayout?: number;
  // Set when the customer edited their device(s) post-submission via
  // the offer page — timestamp of the latest [ITEM-UPDATE] marker. The
  // device/spec/quote fields above already reflect the edit; this just
  // flags that an edit happened so the UI can badge it.
  itemsEditedAt?: string;
  // True when a customer edit set a device to a broken condition —
  // it can't be auto-quoted and needs a hands-on staff re-quote.
  itemsNeedReview?: boolean;
  // Soft-trash metadata. Populated for leads in the Trash view. The
  // hoursToAutoPurge field counts down from 24h since deletedAt.
  // Skywalker 2026-05-17: "next time save my quotes for 24hr".
  deletedAt?: string;
  hoursToAutoPurge?: number | null;
  status: string;
  statusUpdatedAt?: string;
  latestNote?: string;
  latestNoteAt?: string;
  noteCount?: number;
  // Margin analysis
  resellEstimate?: number;
  grossMargin?: number;
  marginPercent?: number;
  marginFlag?: string; // "healthy" | "thin" | "low" | "manual"
  // Handoff details parsed out of /api/lead's body. Staff needs these to
  // know whether to print a shipping label or text the seller about a
  // meetup. Skywalker 2026-05-17.
  handoffMethod?: "ship" | "local";
  shipAddress?: string;
  shipPackaging?: string;
  localArea?: string;
  localSlot?: string;
  handoffAction?: string;
  // Stale-lead flag — true when the lead is in a non-terminal status
  // (anything other than paid/met/rejected) AND the most recent
  // status update (or submission if never updated) is older than 7
  // days. Skywalker 2026-05-18 — surfaces forgotten leads in admin.
  staleHours?: number;
  // Customer history — number of PRIOR leads from the same customer
  // (matched on normalized phone OR lowercased email, whichever
  // matches first), plus lifetime $ summed from those prior leads.
  // Doesn't include the current lead. Skywalker 2026-05-18.
  priorLeads?: number;
  lifetimeSpend?: number;
  // Communication audit trail — count of staff comms sent per lead,
  // parsed from [COMM-SENT: leadId] markers. Skywalker 2026-05-18.
  commsSent?: { sms: number; email: number; lastAt?: string };
  // Funded-payout confirmation, parsed from the most recent
  // "Payout-confirmation: method=X · ref=Y · note=Z" line attached
  // to the [STATUS: paid|met] marker. Skywalker 2026-05-18 — answers
  // "did we actually pay them, and how?" without digging into MC.
  payoutConfirmation?: { method?: string; reference?: string; note?: string; at: string };
  // Texas Secondhand Dealer Act ID capture, parsed from
  // [ID-CAPTURED: leadId] markers. Most recent wins. We never surface
  // the full ID# — only last4 + DOB year + the photo URL.
  idCaptured?: { type: string; last4: string; dobYear: string; photoUrl: string; at: string };
  // Active review-token (single-use), only present when a paid/met
  // status flip has minted one AND it hasn't been redeemed yet AND
  // it hasn't expired. Empty otherwise. Used by the admin "Copy
  // review link" button.
  reviewToken?: string;
  // FedEx label info, populated from [LABEL: <leadId>] markers in MC.
  // Surfaces the latest label per lead (regenerate-friendly).
  fedexTracking?: string;
  fedexLabelUrl?: string;
  fedexService?: string;
  // Most recent FedEx label FAILURE (ADDRESS_INVALID or
  // SERVICE_UNAVAILABLE) parsed from [LABEL-FAILED: leadId] markers
  // that /api/lead writes when FedEx rejects auto-generation. Cleared
  // when a successful [LABEL:] later wins on timestamp. Skywalker
  // 2026-05-18 — admin manager surface.
  fedexLabelError?: { kind: string; reason: string; at: string };
  // Customer review left for this lead. Pulled from MC's /api/reviews
  // store by joining on leadId. Skywalker 2026-05-18 — admin row
  // shows the rating + body so staff can see what the customer said
  // without leaving the lead. Empty if no review yet (or if pre-token
  // and not yet manually attributed).
  review?: { id: string; rating: number; title?: string; body: string; verified?: boolean; createdAt: string };
  // Coupon applied at submission — parsed from the "Coupon applied:
  // TCC-XXXX (+$25 thank-you bonus)" line we write in the lead body.
  // Empty if the customer didn't apply one (or attempted one that
  // failed identity check — those write a "Coupon attempt:" line
  // which we'd surface separately if needed).
  couponApplied?: { code: string; value: number };
  // True when the lead matches TCC_INTERNAL_IPS / TCC_INTERNAL_EMAILS
  // (Skywalker's own testing). Admin defaults to hiding these to
  // keep customer-facing metrics clean. Toggle in the UI shows them
  // back. 2026-05-19.
  isInternal?: boolean;
  // True when the customer opted into free responsible recycling
  // (no payout, no FedEx label) instead of a buyback. Parsed from
  // the "Recycle-only: yes" line /api/lead writes for recycle leads.
  // Skywalker 2026-05-22.
  recycleOnly?: boolean;
  // Live competitor margin — computed at GET time using the current
  // Atlas wholesale + eBay sold-listing data for the lead's exact
  // (sku, storage, condition, carrier) cell. Both can be missing when
  // the corresponding comp dataset doesn't carry the variant.
  //  - atlas: what we'd net selling to Atlas (wholesale exit)
  //  - ebay:  what we'd net selling on eBay after fees (net_median)
  // Skywalker 2026-05-19 — staff sees accurate margin per lead.
  compMargin?: {
    sku?: string;
    quote?: number;
    atlas?: { resell: number; margin: number; marginPct: number; carrierKey: string };
    ebay?: { netMedian: number; sampleCount: number; margin: number; marginPct: number };
  };
  // Counter-offer state, parsed from [COUNTER-OFFER: leadId] +
  // [COUNTER-RESPONSE: leadId] markers. status:
  //  - "pending"  → offer sent, customer hasn't responded
  //  - "accepted" → customer accepted the revised offer
  //  - "declined" → customer declined (we ship the device back)
  // Missing when no counter-offer has ever been minted for this lead.
  counterOffer?: {
    status: "pending" | "accepted" | "declined";
    originalQuote: number;
    offer: number;
    reason: string;
    sentAt: string;
    respondedAt?: string;
    customerNote?: string;
  };
  // AI verdicts on this lead, parsed from [AI-FLAG: leadId] /
  // [AI-NOTE: leadId] / [AI-SUMMARY: leadId] markers. Most-recent of
  // each KIND wins (not just one across all kinds), so the photo-check
  // FLAG and Theot's channel-rec SUMMARY can render side-by-side
  // instead of the latter hiding the former. Skywalker 2026-05-19.
  //
  // Conventions per kind:
  //   - flag:    photo-check vision QA caught a mismatch / fraud-check.
  //   - summary: Theot's channel-rec ("sell on Atlas +$120 …").
  //   - note:    photo-check "all clear" verdict — only surfaces when
  //              no flag or summary exists (otherwise it's noise).
  ai?: {
    flag?: { body: string; at: string; fromName?: string };
    note?: { body: string; at: string; fromName?: string };
    summary?: { body: string; at: string; fromName?: string };
  };
}

// Includes "met" (in-person handoff terminal) alongside "paid" (digital
// payout terminal) — Skywalker 2026-05-17.
const STATUSES = ["quote_requested", "shipped", "received", "tested", "paid", "met", "rejected"];

function parseField(body: string, key: string): string | undefined {
  // Anchor to start-of-line and only allow inline whitespace ([ \t]*)
  // after the key. The previous \s* was greedy AND included \n, so an
  // empty field swallowed the next line's content — e.g. "Phone: \n
  // Email: rose@x.com" parsed phone as "Email: rose@x.com". Bug surfaced
  // on every customer who didn't fill phone (Skywalker 2026-05-18 "Rose"
  // lead). Also use [^\n]* (zero-or-more) so an explicitly-empty field
  // matches as "" rather than failing to match → we still collapse to
  // undefined via the v || undefined return.
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  if (!m) return undefined;
  const v = m[1].trim();
  return v || undefined;
}

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bumped 300 → 1000 so lead backlog of 100+ stays addressable. Each
  // lead can have status / note / delete / restore comms in addition to
  // the original [NEW BUYBACK LEAD], so 300 was running thin.
  // Also pull customer reviews so admin row can render the attached
  // review inline (Skywalker 2026-05-18 "I should be able to see what
  // they review on the back end").
  const [r, reviewsRes] = await Promise.all([
    fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    }),
    fetch(`${MC_API}/api/reviews?limit=500`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    }),
  ]);
  if (!r.ok) {
    return NextResponse.json({ error: "MC unavailable" }, { status: 502 });
  }
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string; fromName?: string; from?: string }[] = data.messages || [];

  // Index reviews by leadId. Reviews without a leadId (pre-token,
  // unbackfilled) stay un-attached — they still show on /reviews
  // publicly, just not inline on a lead row.
  type ReviewRow = { id: string; leadId?: string; rating: number; title?: string; body: string; verified?: boolean; createdAt: string };
  const reviewsByLead = new Map<string, ReviewRow>();
  if (reviewsRes.ok) {
    try {
      const rData = await reviewsRes.json();
      const reviews: ReviewRow[] = Array.isArray(rData.reviews) ? rData.reviews : [];
      for (const rev of reviews) {
        if (!rev.leadId) continue;
        // Keep the most-recent review per lead (a customer could resubmit
        // if we re-mint a token, though strict gate makes that rare).
        const prev = reviewsByLead.get(rev.leadId);
        if (!prev || (rev.createdAt && prev.createdAt && rev.createdAt > prev.createdAt)) {
          reviewsByLead.set(rev.leadId, rev);
        }
      }
    } catch {}
  }

  // Pass 1: index status updates + notes + soft-deletes + restores by lead id.
  // Status post format:  "[STATUS: <status>] [LEAD: <leadId>]"
  // Note post format:    "[NOTE: <text>] [LEAD: <leadId>]"
  // Delete marker:       "[DELETED-LEAD: <leadId>] [REASON: <opt>]"
  // Restore marker:      "[RESTORED-LEAD: <leadId>]"
  //
  // Trash semantics (Skywalker 2026-05-17 "save my quotes for 24hr"):
  // For each leadId we keep the MOST RECENT delete or restore. If the
  // latest event is a delete and it's within 24h, the lead is "in trash"
  // (recoverable). If the latest is a delete >24h ago, the lead is
  // hard-purged from the feed entirely. If the latest is a restore, the
  // lead is active again.
  const statusByLead = new Map<string, { status: string; timestamp: string }>();
  // Payout confirmations keyed by lead — captured on the [STATUS: paid|met]
  // marker's Payout-confirmation line. Most recent wins.
  const payoutConfirmByLead = new Map<string, { method?: string; reference?: string; note?: string; amount?: number; timestamp: string }>();
  const notesByLead = new Map<string, { text: string; timestamp: string }[]>();
  // Latest FedEx label per lead. We keep only the most recent so
  // regenerating overrides the prior label on the UI.
  const labelByLead = new Map<string, { tracking: string; url: string; service?: string; timestamp: string }>();
  const labelErrorByLead = new Map<string, { kind: string; reason: string; timestamp: string }>();
  // Customer device edits — the latest [ITEM-UPDATE: leadId] marker per
  // lead (posted by the offer-page editor). Most recent wins.
  const itemUpdateByLead = new Map<string, { devices: Array<{ model?: unknown; storage?: unknown; condition?: unknown; quote?: unknown; quantity?: unknown; needsReview?: unknown }>; total?: unknown; timestamp: string }>();
  const commsByLead = new Map<string, { sms: number; email: number; lastAt?: string }>();
  const idCapturedByLead = new Map<string, { type: string; last4: string; dobYear: string; photoUrl: string; timestamp: string }>();
  // Review token bookkeeping. minted = "[REVIEW-TOKEN: leadId] token=X
  // expires=...". used = "[REVIEW-USED: token=X]". A lead has an
  // ACTIVE token iff one is minted, not yet used, and not yet expired.
  const reviewTokenByLead = new Map<string, { token: string; expires?: string; timestamp: string }>();
  const usedReviewTokens = new Set<string>();
  // Counter-offer state per lead. We keep the MOST RECENT offer + its
  // response (if any). Re-minting an offer overrides the prior one.
  const counterOfferByLead = new Map<string, { originalQuote: number; offer: number; reason: string; timestamp: string }>();
  const counterResponseByLead = new Map<string, { response: "accept" | "decline"; timestamp: string; note?: string }>();
  // AI markers per lead, tracked PER KIND so a photo-check FLAG and
  // Theot's channel-rec SUMMARY can both surface on the lead row
  // instead of the latter hiding the former. Most-recent wins per kind.
  // Skywalker 2026-05-19.
  type AIKind = "AI-FLAG" | "AI-NOTE" | "AI-SUMMARY";
  type AIEntry = { body: string; timestamp: string; fromName?: string };
  const aiByLead = new Map<string, Partial<Record<AIKind, AIEntry>>>();
  const deletedAtByLead = new Map<string, string>();  // most-recent deletion timestamp
  const restoredAtByLead = new Map<string, string>(); // most-recent restore timestamp
  for (const m of messages) {
    if (!m.body) continue;
    const dm = m.body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (dm) {
      const id = dm[1];
      const prev = deletedAtByLead.get(id);
      if (!prev || m.timestamp > prev) deletedAtByLead.set(id, m.timestamp);
    }
    const rm = m.body.match(/\[RESTORED-LEAD:\s*([\w-]+)\]/i);
    if (rm) {
      const id = rm[1];
      const prev = restoredAtByLead.get(id);
      if (!prev || m.timestamp > prev) restoredAtByLead.set(id, m.timestamp);
    }
    // FedEx label SUCCESS marker — self-contained (no separate [LEAD:]
    // tag). Must be parsed OUTSIDE the [LEAD:]-gated block below or
    // auto-generated labels from /api/lead never index. Skywalker
    // 2026-05-18 bug fix.
    // Format: "[LABEL: <leadId>] tracking=X url=Y service=Z"
    const lblMarker = m.body.match(/\[LABEL:\s*([\w-]+)\]/i);
    if (lblMarker) {
      const lid = lblMarker[1];
      const t = m.body.match(/tracking=([^\s]+)/i)?.[1];
      const u = m.body.match(/url=([^\s]+)/i)?.[1];
      const sv = m.body.match(/service=([^\s]+)/i)?.[1];
      if (t && u) {
        const prev = labelByLead.get(lid);
        if (!prev || m.timestamp > prev.timestamp) {
          labelByLead.set(lid, { tracking: t, url: u, service: sv, timestamp: m.timestamp });
        }
      }
    }
    // Review-token mint marker — generated by the status route on
    // paid/met flip. Most recent wins per lead.
    const rtm = m.body.match(/\[REVIEW-TOKEN:\s*([\w-]+)\]/i);
    if (rtm) {
      const lid = rtm[1];
      const tok = m.body.match(/token=([\w]+)/i)?.[1];
      const exp = m.body.match(/expires=([^\s]+)/i)?.[1];
      if (tok) {
        const prev = reviewTokenByLead.get(lid);
        if (!prev || m.timestamp > prev.timestamp) {
          reviewTokenByLead.set(lid, { token: tok, expires: exp, timestamp: m.timestamp });
        }
      }
    }
    // Used-token marker — token has been redeemed for a review.
    const rum = m.body.match(/\[REVIEW-USED:\s*([\w]+)\]/i);
    if (rum) usedReviewTokens.add(rum[1]);
    // ID-capture marker — Texas Secondhand Dealer Act compliance.
    // "[ID-CAPTURED: leadId] type=DL id_last4=1234 dob_year=1989 photo=url"
    const idMarker = m.body.match(/\[ID-CAPTURED:\s*([\w-]+)\]/i);
    if (idMarker) {
      const lid = idMarker[1];
      const type = m.body.match(/type=([^\s]+)/i)?.[1] || "OTHER";
      const last4 = m.body.match(/id_last4=([^\s]+)/i)?.[1] || "";
      const dobYear = m.body.match(/dob_year=(\d{4})/i)?.[1] || "";
      const photoUrl = m.body.match(/photo=([^\s]+)/i)?.[1] || "";
      const prev = idCapturedByLead.get(lid);
      if (!prev || m.timestamp > prev.timestamp) {
        idCapturedByLead.set(lid, { type, last4, dobYear, photoUrl, timestamp: m.timestamp });
      }
    }
    // Communication audit trail — "[COMM-SENT: leadId] channel=sms|email …"
    // markers posted by admin SMS/status/label routes when staff
    // messages the customer. Skywalker 2026-05-18 — admin row shows
    // how many comms went out + when. Self-contained (no [LEAD:]
    // gate), parsed BEFORE the lm guard.
    const commMarker = m.body.match(/\[COMM-SENT:\s*([\w-]+)\]/i);
    if (commMarker) {
      const lid = commMarker[1];
      const channel = (m.body.match(/channel=([^\s]+)/i)?.[1] || "").toLowerCase();
      const slot = commsByLead.get(lid) || { sms: 0, email: 0 };
      if (channel === "sms") slot.sms += 1;
      else if (channel === "email") slot.email += 1;
      if (!slot.lastAt || m.timestamp > slot.lastAt) slot.lastAt = m.timestamp;
      commsByLead.set(lid, slot);
    }
    // AI verdict marker — posted by the photo-check auto-fire on
    // /api/lead, the admin fraud-check button, and Theot's channel-rec.
    // Format:
    //   "[AI-FLAG: <leadId>] <body>"
    //   "[AI-NOTE: <leadId>] <body>"
    //   "[AI-SUMMARY: <leadId>] <body>"
    // Self-contained (no [LEAD:] tag). Tracked PER KIND — most-recent
    // wins within a kind, but different kinds (e.g. a photo-check FLAG
    // and Theot's channel-rec SUMMARY) coexist on the same lead.
    const aiMarker = m.body.match(/\[(AI-FLAG|AI-NOTE|AI-SUMMARY):\s*([\w-]+)\]\s*([\s\S]*)/i);
    if (aiMarker) {
      const kind = aiMarker[1].toUpperCase() as AIKind;
      const lid = aiMarker[2];
      const aiBody = aiMarker[3].trim().slice(0, 1500);
      const bucket = aiByLead.get(lid) || {};
      const prev = bucket[kind];
      if (!prev || m.timestamp > prev.timestamp) {
        bucket[kind] = { body: aiBody, timestamp: m.timestamp, fromName: m.fromName };
        aiByLead.set(lid, bucket);
      }
    }
    // Counter-offer mint marker — admin posts this when staff sends a
    // revised offer to a customer. Format:
    // "[COUNTER-OFFER: <leadId>] original=$X offer=$Y reason=... token=..."
    const coMarker = m.body.match(/\[COUNTER-OFFER:\s*([\w-]+)\]/i);
    if (coMarker) {
      const lid = coMarker[1];
      // Comma-grouped + decimal-safe. The old /\$?(\d+)/ pattern parsed
      // "original=$1,250" as 1 — same shape as the broader $1,250→$1
      // bug killed in 4438ba8. Multi-device counter-offers (>$999)
      // were being stored as $1.
      const origRaw = m.body.match(/original=\$?([\d,]+(?:\.\d+)?)/i)?.[1];
      const offerRaw = m.body.match(/offer=\$?([\d,]+(?:\.\d+)?)/i)?.[1];
      const orig = origRaw ? Math.round(parseFloat(origRaw.replace(/,/g, ""))) : NaN;
      const offer = offerRaw ? Math.round(parseFloat(offerRaw.replace(/,/g, ""))) : NaN;
      // Reason runs until the next " token=" or end-of-line. Greedy
      // grab so multi-word reasons survive.
      const reason = m.body.match(/reason=(.+?)(?=\s+token=|\s*$)/im)?.[1]?.trim() || "";
      if (Number.isFinite(orig) && Number.isFinite(offer)) {
        const prev = counterOfferByLead.get(lid);
        if (!prev || m.timestamp > prev.timestamp) {
          counterOfferByLead.set(lid, { originalQuote: orig, offer, reason, timestamp: m.timestamp });
        }
      }
    }
    // Counter-offer response marker — posted by the customer-side
    // /api/counter-offer/respond endpoint.
    // Format: "[COUNTER-RESPONSE: leadId] response=accept|decline ..."
    const crMarker = m.body.match(/\[COUNTER-RESPONSE:\s*([\w-]+)\]/i);
    if (crMarker) {
      const lid = crMarker[1];
      const resp = m.body.match(/response=(accept|decline)/i)?.[1]?.toLowerCase();
      const note = m.body.match(/note=(.+?)$/im)?.[1]?.trim();
      if (resp === "accept" || resp === "decline") {
        const prev = counterResponseByLead.get(lid);
        if (!prev || m.timestamp > prev.timestamp) {
          counterResponseByLead.set(lid, { response: resp, timestamp: m.timestamp, note });
        }
      }
    }
    // FedEx label FAILURE marker — same self-contained shape.
    // Format: "[LABEL-FAILED: <leadId>] kind=X reason=..."
    const failMarker = m.body.match(/\[LABEL-FAILED:\s*([\w-]+)\]/i);
    if (failMarker) {
      const lid = failMarker[1];
      const kind = m.body.match(/kind=([^\s]+)/i)?.[1] || "UNKNOWN";
      const reason = m.body.match(/reason=(.+)$/im)?.[1]?.trim() || "";
      const prev = labelErrorByLead.get(lid);
      if (!prev || m.timestamp > prev.timestamp) {
        labelErrorByLead.set(lid, { kind, reason, timestamp: m.timestamp });
      }
    }
    // Customer device-edit marker — self-contained, posted by the
    // offer-page editor. "[ITEM-UPDATE: leadId] …text… {json}". Latest
    // wins per lead.
    const iuMarker = m.body.match(/\[ITEM-UPDATE:\s*([\w-]+)\][^\n]*?(\{.*\})/i);
    if (iuMarker) {
      const lid = iuMarker[1];
      try {
        const parsed = JSON.parse(iuMarker[2]);
        if (parsed && Array.isArray(parsed.devices)) {
          const prev = itemUpdateByLead.get(lid);
          if (!prev || m.timestamp > prev.timestamp) {
            itemUpdateByLead.set(lid, { devices: parsed.devices, total: parsed.total, timestamp: m.timestamp });
          }
        }
      } catch { /* ignore malformed marker */ }
    }
    const lm = m.body.match(/\[LEAD:\s*([\w-]+)\]/i);
    if (!lm) continue;
    const leadId = lm[1];
    const sm = m.body.match(/\[STATUS:\s*(\w+)\]/i);
    if (sm && STATUSES.includes(sm[1].toLowerCase())) {
      const existing = statusByLead.get(leadId);
      if (!existing || m.timestamp > existing.timestamp) {
        statusByLead.set(leadId, { status: sm[1].toLowerCase(), timestamp: m.timestamp });
      }
      // Payout-confirmation line lives inside the same [STATUS: paid|met]
      // message body. Parse it alongside.
      const pcLine = m.body.match(/Payout-confirmation:\s*(.+)$/im)?.[1];
      if (pcLine && (sm[1].toLowerCase() === "paid" || sm[1].toLowerCase() === "met")) {
        const method = pcLine.match(/method=([^·\n]+)/i)?.[1]?.trim();
        const reference = pcLine.match(/ref=([^·\n]+)/i)?.[1]?.trim();
        const note = pcLine.match(/note=(.+)$/i)?.[1]?.trim();
        // Actual amount paid — added 2026-05-24 to capture in-person
        // downgrades (Rudy: quoted Pro Max, paid 80 on actual 14).
        const amountRaw = pcLine.match(/amount=([\d.]+)/i)?.[1];
        const amount = amountRaw ? Number(amountRaw) : undefined;
        const prev = payoutConfirmByLead.get(leadId);
        if (!prev || m.timestamp > prev.timestamp) {
          payoutConfirmByLead.set(leadId, {
            method, reference, note,
            amount: Number.isFinite(amount) ? amount : undefined,
            timestamp: m.timestamp,
          });
        }
      }
    }
    const nm = m.body.match(/\[NOTE:\s*([^\]]+)\]/i);
    if (nm) {
      const arr = notesByLead.get(leadId) || [];
      arr.push({ text: nm[1].trim(), timestamp: m.timestamp });
      notesByLead.set(leadId, arr);
    }
  }

  // Determine each lead's bucket — active / trashed (recoverable) / purged.
  //
  // Auto-purge policy (Skywalker 2026-05-19):
  //   - ACTIVE (in-flight) leads — paid hasn't happened yet, customer
  //     could still come back: NEVER auto-purge. Stays in Trash
  //     indefinitely so we don't lose any data on a misclick.
  //   - FINISHED leads (paid / met / rejected) — money's settled, lead
  //     is closed: auto-purge from trash after 24h to keep the view
  //     uncluttered. Comms history in MC is permanent regardless.
  const TRASH_TTL_FINISHED_MS = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const view = (req.nextUrl.searchParams.get("view") || "active").toLowerCase(); // active | trash | all
  const FINISHED_STATUSES = new Set(["paid", "met", "rejected"]);
  function bucketFor(leadId: string, status?: string): { kind: "active" } | { kind: "trashed"; deletedAt: string; hoursLeft: number | null } | { kind: "purged" } {
    const delAt = deletedAtByLead.get(leadId);
    const resAt = restoredAtByLead.get(leadId);
    if (!delAt) return { kind: "active" };
    if (resAt && resAt > delAt) return { kind: "active" };
    const ageMs = nowMs - new Date(delAt).getTime();
    const isFinished = status ? FINISHED_STATUSES.has(status) : false;
    // Only finished leads auto-purge. Active leads stay in trash forever.
    if (isFinished && ageMs >= TRASH_TTL_FINISHED_MS) return { kind: "purged" };
    const hoursLeft = isFinished
      ? Math.max(0, Math.round((TRASH_TTL_FINISHED_MS - ageMs) / (60 * 60 * 1000)))
      : null; // null = no expiry
    return { kind: "trashed", deletedAt: delAt, hoursLeft };
  }

  // Pass 2: collect leads.
  const leads: AdminLead[] = [];
  for (const m of messages) {
    // Match BOTH the single-device header "[NEW BUYBACK LEAD]" AND
    // the multi-device header "[NEW BUYBACK LEAD — N DEVICES]".
    // Skywalker 2026-05-17: multi-device leads were getting skipped
    // because the literal includes() check missed them.
    if (!m.body || !/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body)) continue;
    // Status drives the auto-purge policy (active leads stay forever in
    // trash, finished leads purge after 24h) so look it up before
    // bucketing. Skywalker 2026-05-19. (Fixed 2026-05-19: pass the
    // status string, not the {status, timestamp} record.)
    const status = statusByLead.get(m.id);
    const bucket = bucketFor(m.id, status?.status);
    if (bucket.kind === "purged") continue;
    if (view === "active" && bucket.kind !== "active") continue;
    if (view === "trash"  && bucket.kind !== "trashed") continue;
    const deviceLine = parseField(m.body, "Device");
    const photosLine = parseField(m.body, "Photos");
    const photos = photosLine ? photosLine.split(" | ").map((s) => s.trim()).filter(Boolean) : undefined;
    const warningsMatch = m.body.match(/\[IMEI WARNINGS\]\s*([^\n]+)/i);
    const imeiWarnings = warningsMatch ? warningsMatch[1].split(" | ").map((s) => s.trim()).filter(Boolean) : undefined;
    // Parse the broken-condition lines that /api/lead writes into the
    // comms body — "Glass: FRONT|BACK only|BOTH ... cracked" and
    // "Broken: NOT FUNCTIONAL|still functional".
    const glassLine = parseField(m.body, "Glass");
    let brokenGlass: AdminLead["brokenGlass"] = undefined;
    if (glassLine) {
      const g = glassLine.toLowerCase();
      if (g.includes("both")) brokenGlass = "both";
      else if (g.startsWith("front") || g.includes("front (display)")) brokenGlass = "front";
      else if (g.startsWith("back")) brokenGlass = "back";
    }
    const brokenLine = parseField(m.body, "Broken");
    let brokenFunctional: AdminLead["brokenFunctional"] = undefined;
    if (brokenLine) {
      const b = brokenLine.toLowerCase();
      if (b.includes("not functional")) brokenFunctional = false;
      else if (b.includes("still functional")) brokenFunctional = true;
    }
    const extrasLine = parseField(m.body, "Extras");
    const extras = extrasLine ? extrasLine.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const balanceLine = parseField(m.body, "Balance");
    let paidOff: AdminLead["paidOff"] = undefined;
    if (balanceLine) {
      const b = balanceLine.toLowerCase();
      if (b.includes("not paid")) paidOff = false;
      else if (b.includes("fully paid") || b.includes("paid off")) paidOff = true;
    }
    // Multi-device parsing — /api/lead writes lines like:
    //   Devices: 3
    //     1. iPhone 17 Pro Max · 256GB · Flawless · $700
    //     2. iPhone 16 · 128GB · Good · $250
    //        Photos: https://... | https://...
    //     3. MacBook Pro 14" M4 · 512GB · Mint · $1000
    //   Total payout: $1950
    let deviceCount: number | undefined = undefined;
    let totalPayout: number | undefined = undefined;
    let devices: AdminLead["devices"] = undefined;
    const devicesHeaderMatch = m.body.match(/^Devices:\s*(\d+)\s*$/m);
    if (devicesHeaderMatch) {
      deviceCount = parseInt(devicesHeaderMatch[1], 10);
      // Split the body into lines so we can walk each indented device
      // entry + grab the indented spec lines that follow it (Chip / RAM
      // / Battery / Photos / etc.) until the next numbered device or the
      // "Total payout" footer.
      const bodyLines = m.body.split("\n");
      const deviceLineRe = /^\s{2,4}(\d+)\.\s+([^·\n]+?)(?:\s·\s+([^·\n]+?))?(?:\s·\s+([^·\n$]+?))?(?:\s·\s+\$([0-9,]+))?(?:\s+\(×(\d+)\))?\s*$/;
      const specLineRe = /^\s{4,}([A-Z][^:]+):\s*(.+)$/;
      devices = [];
      let current: NonNullable<AdminLead["devices"]>[number] | null = null;
      const flush = () => { if (current) devices!.push(current); current = null; };
      for (const line of bodyLines) {
        const dm = line.match(deviceLineRe);
        if (dm) {
          flush();
          const [, , dLabel, dStorage, dCondition, dQuoteStr, dQtyStr] = dm;
          current = {
            model: dLabel.trim(),
            storage: dStorage?.trim() || undefined,
            condition: dCondition?.trim() || undefined,
            quote: dQuoteStr ? parseInt(dQuoteStr.replace(/,/g, ""), 10) : undefined,
            quantity: dQtyStr ? parseInt(dQtyStr, 10) : undefined,
          };
          continue;
        }
        if (!current) continue;
        // Footer terminates the per-device block.
        if (/^Total payout:/.test(line)) { flush(); break; }
        const sm = line.match(specLineRe);
        if (!sm) continue;
        const key = sm[1].trim().toLowerCase();
        const val = sm[2].trim();
        switch (key) {
          case "chip":          current.processor = val; break;
          case "ram":           current.memory = val; break;
          case "gpu":           current.graphics = val; break;
          case "display":       current.displayResolution = val; break;
          case "display glass": current.displayGlass = val; break;
          case "battery health":current.batteryHealth = val; break;
          case "charger":       current.charger = val; break;
          case "carrier":       current.carrier = val; break;
          case "connectivity":  current.connectivity = val; break;
          case "imei":          current.imei = val; break;
          case "extras":        current.extras = val.split(",").map((s) => s.trim()).filter(Boolean); break;
          case "balance": {
            const v = val.toLowerCase();
            if (v.includes("not paid")) current.paidOff = false;
            else if (v.includes("fully paid") || v.includes("paid off")) current.paidOff = true;
            break;
          }
          case "broken": {
            const v = val.toLowerCase();
            if (v.includes("not functional")) current.brokenFunctional = false;
            else if (v.includes("still functional")) current.brokenFunctional = true;
            break;
          }
          case "glass": {
            const v = val.toLowerCase();
            if (v.includes("both")) current.brokenGlass = "both";
            else if (v.startsWith("front") || v.includes("front (display)")) current.brokenGlass = "front";
            else if (v.startsWith("back")) current.brokenGlass = "back";
            break;
          }
          case "photos":
            current.photos = val.split(" | ").map((s) => s.trim()).filter(Boolean);
            break;
        }
      }
      flush();
      if (devices.length === 0) devices = undefined;
      const totalMatch = m.body.match(/Total payout:\s*\$([0-9,]+)/);
      if (totalMatch) totalPayout = parseInt(totalMatch[1].replace(/,/g, ""), 10);
    }
    // Apply a customer device edit (latest [ITEM-UPDATE] marker) so the
    // admin card shows the edited specs + total, not the original
    // submission. Multi-device leads keep their list; single-device
    // leads keep rendering as single (top-level fields overridden).
    // Skywalker 2026-05-20.
    let modelOverride: string | undefined;
    let storageOverride: string | undefined;
    let conditionOverride: string | undefined;
    let quoteOverride: string | undefined;
    let itemsEditedAt: string | undefined;
    let itemsNeedReview = false;
    const itemUpd = itemUpdateByLead.get(m.id);
    if (itemUpd) {
      itemsEditedAt = itemUpd.timestamp;
      const editedDevices = itemUpd.devices.map((d) => ({
        model: String(d.model ?? "Device"),
        storage: d.storage ? String(d.storage) : undefined,
        condition: d.condition ? String(d.condition) : undefined,
        quote: Number.isFinite(Number(d.quote)) ? Number(d.quote) : undefined,
        quantity: Number.isFinite(Number(d.quantity)) ? Number(d.quantity) : undefined,
        needsReview: !!d.needsReview,
      }));
      itemsNeedReview = editedDevices.some((d) => d.needsReview);
      const editedTotal = Number.isFinite(Number(itemUpd.total))
        ? Number(itemUpd.total)
        : editedDevices.reduce((s, d) => s + (d.quote || 0), 0);
      if (devicesHeaderMatch || editedDevices.length > 1) {
        devices = editedDevices;
        deviceCount = editedDevices.length;
        totalPayout = editedTotal;
      } else if (editedDevices.length === 1) {
        const d0 = editedDevices[0];
        modelOverride = d0.model;
        storageOverride = d0.storage;
        conditionOverride = d0.condition;
        quoteOverride = d0.quote != null ? `$${d0.quote}` : undefined;
      }
    }
    // Handoff method + details. /api/lead writes a header line like
    //   "--- Handoff: SHIPPING ---" or "--- Handoff: LOCAL MEETUP ---"
    // followed by Address/Packaging/Area/Slot/Action lines. Surface the
    // method as a typed enum and each detail as its own field so the
    // admin UI can render them neatly without re-parsing the body.
    let handoffMethod: AdminLead["handoffMethod"] = undefined;
    if (/--- Handoff:\s*SHIPPING/i.test(m.body)) handoffMethod = "ship";
    else if (/--- Handoff:\s*LOCAL MEETUP/i.test(m.body)) handoffMethod = "local";
    const shipAddress = parseField(m.body, "Address");
    const shipPackaging = parseField(m.body, "Packaging");
    const localArea = parseField(m.body, "Area");
    const localSlot = parseField(m.body, "Slot");
    const handoffAction = parseField(m.body, "Action");
    const notes = notesByLead.get(m.id) || [];
    notes.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const latestNote = notes[0];
    // Parse margin data
    const resellStr = parseField(m.body, "Est. resell");
    const resellEstimate = resellStr ? parseInt(resellStr.replace(/[^0-9]/g, "")) || undefined : undefined;
    const grossStr = parseField(m.body, "Gross margin");
    const grossMargin = grossStr ? parseInt(grossStr.replace(/[^0-9-]/g, "")) || undefined : undefined;
    const pctMatch = grossStr?.match(/(\d+)%/);
    const marginPercent = pctMatch ? parseInt(pctMatch[1]) : undefined;
    const marginFlag = m.body.includes("LOW MARGIN") ? "low"
      : m.body.includes("Thin margin") ? "thin"
      : m.body.includes("Healthy margin") ? "healthy"
      : m.body.includes("Manual quote") ? "manual" : undefined;

    leads.push({
      id: m.id,
      timestamp: m.timestamp,
      name: parseField(m.body, "Name"),
      phone: parseField(m.body, "Phone"),
      email: parseField(m.body, "Email"),
      device: deviceLine?.split(" — ")[0],
      model: modelOverride ?? deviceLine?.split(" — ")[1],
      storage: storageOverride ?? parseField(m.body, "Storage"),
      condition: conditionOverride ?? parseField(m.body, "Condition"),
      carrier: parseField(m.body, "Carrier"),
      quote: quoteOverride ?? (parseField(m.body, "Quote") || parseField(m.body, "Offer")),
      payout: parseField(m.body, "Payout"),
      imei: parseField(m.body, "IMEI"),
      imeiWarnings,
      photos,
      brokenGlass,
      brokenFunctional,
      processor:         parseField(m.body, "Chip"),
      memory:            parseField(m.body, "RAM"),
      graphics:          parseField(m.body, "GPU"),
      displayResolution: parseField(m.body, "Display"),
      displayGlass:      parseField(m.body, "Display glass"),
      batteryHealth:     parseField(m.body, "Battery health"),
      charger:           parseField(m.body, "Charger"),
      connectivity:      parseField(m.body, "Connectivity"),
      extras,
      paidOff,
      bestContact: (() => {
        const raw = parseField(m.body, "Best contact")?.toLowerCase();
        if (raw === "text" || raw === "call" || raw === "email") return raw;
        return undefined;
      })(),
      customerNote: parseField(m.body, "Note from customer"),
      quantity: (() => {
        const raw = parseField(m.body, "Quantity");
        const n = raw ? parseInt(raw, 10) : NaN;
        return Number.isFinite(n) ? n : undefined;
      })(),
      smsOptIn: (() => {
        const raw = parseField(m.body, "SMS opt-in")?.toLowerCase();
        if (raw === "yes") return true;
        if (raw === "no") return false;
        return undefined;
      })(),
      source: (() => {
        const raw = parseField(m.body, "Source");
        if (!raw) return undefined;
        // Bits are " · " separated key=value pairs (source=X · medium=Y …)
        const out: { source?: string; medium?: string; campaign?: string; term?: string; content?: string; referrer?: string; landed?: string; raw: string } = { raw };
        for (const part of raw.split(/\s·\s|\s\|\s/)) {
          const m2 = part.match(/^(source|medium|campaign|term|content|ref|referrer|landed)=(.+)$/i);
          if (!m2) continue;
          const k = m2[1].toLowerCase() === "ref" ? "referrer" : m2[1].toLowerCase();
          (out as Record<string, string>)[k] = m2[2].trim();
        }
        return out;
      })(),
      devices,
      deviceCount,
      totalPayout,
      itemsEditedAt,
      itemsNeedReview,
      deletedAt:        bucket.kind === "trashed" ? bucket.deletedAt : undefined,
      // null hoursLeft means "no auto-purge" (active in-flight lead) —
      // pass through as null so the UI can display "kept indefinitely"
      // instead of a countdown.
      hoursToAutoPurge: bucket.kind === "trashed" ? (bucket.hoursLeft ?? null) : undefined,
      status: status?.status || "quote_requested",
      statusUpdatedAt: status?.timestamp,
      latestNote: latestNote?.text,
      latestNoteAt: latestNote?.timestamp,
      noteCount: notes.length,
      // Submit-time margin fields go stale once a customer edits the
      // device — drop them on edited leads so staff rely on the live
      // compMargin (recomputed below on the edited specs) instead of a
      // stale flag. Skywalker 2026-05-20.
      resellEstimate: itemsEditedAt ? undefined : resellEstimate,
      grossMargin:    itemsEditedAt ? undefined : grossMargin,
      marginPercent:  itemsEditedAt ? undefined : marginPercent,
      marginFlag:     itemsEditedAt ? undefined : marginFlag,
      handoffMethod,
      shipAddress,
      shipPackaging,
      localArea,
      localSlot,
      handoffAction,
      staleHours: (() => {
        // Terminal statuses don't get stale — they're done.
        const s = (status?.status || "quote_requested").toLowerCase();
        if (s === "paid" || s === "met" || s === "rejected") return undefined;
        const lastTs = status?.timestamp || m.timestamp;
        const ageMs = Date.now() - new Date(lastTs).getTime();
        const hours = Math.floor(ageMs / (60 * 60 * 1000));
        return hours >= 168 ? hours : undefined; // 7 days
      })(),
      fedexTracking: labelByLead.get(m.id)?.tracking,
      fedexLabelUrl: labelByLead.get(m.id)?.url,
      fedexService: labelByLead.get(m.id)?.service,
      // Only surface the error if there's no successful label that
      // came AFTER it (regeneration cleared the failure).
      fedexLabelError: (() => {
        const err = labelErrorByLead.get(m.id);
        if (!err) return undefined;
        const ok = labelByLead.get(m.id);
        if (ok && ok.timestamp > err.timestamp) return undefined;
        return { kind: err.kind, reason: err.reason, at: err.timestamp };
      })(),
      commsSent: commsByLead.get(m.id),
      ai: (() => {
        const bucket = aiByLead.get(m.id);
        if (!bucket) return undefined;
        const out: { flag?: { body: string; at: string; fromName?: string }; note?: { body: string; at: string; fromName?: string }; summary?: { body: string; at: string; fromName?: string } } = {};
        if (bucket["AI-FLAG"])    out.flag    = { body: bucket["AI-FLAG"]!.body,    at: bucket["AI-FLAG"]!.timestamp,    fromName: bucket["AI-FLAG"]!.fromName };
        if (bucket["AI-SUMMARY"]) out.summary = { body: bucket["AI-SUMMARY"]!.body, at: bucket["AI-SUMMARY"]!.timestamp, fromName: bucket["AI-SUMMARY"]!.fromName };
        // AI-NOTE is the "all clear" verdict — only worth surfacing
        // when neither a flag nor a summary already conveys signal.
        if (bucket["AI-NOTE"] && !out.flag && !out.summary) {
          out.note = { body: bucket["AI-NOTE"]!.body, at: bucket["AI-NOTE"]!.timestamp, fromName: bucket["AI-NOTE"]!.fromName };
        }
        if (!out.flag && !out.note && !out.summary) return undefined;
        return out;
      })(),
      payoutConfirmation: (() => {
        const pc = payoutConfirmByLead.get(m.id);
        if (!pc) return undefined;
        return { method: pc.method, reference: pc.reference, note: pc.note, amount: pc.amount, at: pc.timestamp };
      })(),
      idCaptured: (() => {
        const ic = idCapturedByLead.get(m.id);
        if (!ic) return undefined;
        return { type: ic.type, last4: ic.last4, dobYear: ic.dobYear, photoUrl: ic.photoUrl, at: ic.timestamp };
      })(),
      reviewToken: (() => {
        const rt = reviewTokenByLead.get(m.id);
        if (!rt) return undefined;
        if (usedReviewTokens.has(rt.token)) return undefined;
        if (rt.expires && new Date(rt.expires).getTime() < Date.now()) return undefined;
        return rt.token;
      })(),
      review: (() => {
        const rev = reviewsByLead.get(m.id);
        if (!rev) return undefined;
        return {
          id: rev.id,
          rating: rev.rating,
          title: rev.title,
          body: rev.body,
          verified: rev.verified,
          createdAt: rev.createdAt,
        };
      })(),
      counterOffer: (() => {
        const co = counterOfferByLead.get(m.id);
        if (!co) return undefined;
        const cr = counterResponseByLead.get(m.id);
        // Pair an offer with a response only if the response came AFTER
        // the most recent offer. A response timestamped before the
        // latest mint is stale (staff re-issued after a decline).
        const paired = cr && cr.timestamp >= co.timestamp ? cr : undefined;
        const status: "pending" | "accepted" | "declined" = !paired
          ? "pending"
          : paired.response === "accept"
            ? "accepted"
            : "declined";
        return {
          status,
          originalQuote: co.originalQuote,
          offer: co.offer,
          reason: co.reason,
          sentAt: co.timestamp,
          respondedAt: paired?.timestamp,
          customerNote: paired?.note,
        };
      })(),
      couponApplied: (() => {
        // Parse the "Coupon applied: TCC-XXXX (+$N thank-you bonus)" line.
        const m2 = m.body?.match(/Coupon applied:\s*(\S+)\s*\(\+\$(\d+)/i);
        if (!m2) return undefined;
        const value = parseInt(m2[2], 10);
        if (!Number.isFinite(value)) return undefined;
        return { code: m2[1], value };
      })(),
      isInternal: (() => {
        const body = m.body || "";
        const ipLine = body.match(/(?:^|\n)Source-IP:[ \t]*([^\n]*)/i);
        const ip = ipLine?.[1]?.trim() || "";
        if (ip && INTERNAL_IPS.includes(ip)) return true;
        const emailLine = body.match(/(?:^|\n)Email:[ \t]*([^\n]*)/i);
        const em = emailLine?.[1]?.trim().toLowerCase() || "";
        if (em && INTERNAL_EMAILS.includes(em)) return true;
        return false;
      })(),
      recycleOnly: (() => {
        const v = parseField(m.body, "Recycle-only")?.toLowerCase();
        return v === "yes" || v === "true";
      })(),
    });
  }

  leads.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Internal-lead visibility filter. `?internal=show` reveals leads
  // tagged isInternal=true (Skywalker's own testing). Default hides
  // them so customer-facing metrics stay clean.
  const internalView = req.nextUrl.searchParams.get("internal") || "hide";
  const visibleLeads = internalView === "show"
    ? leads
    : leads.filter((l) => !l.isInternal);

  // Live competitor margin enrichment. Per lead: look up Atlas wholesale
  // value for the exact (sku, storage, condition, carrier) variant and
  // eBay net-median for the same cell. Margin = comp − customer quote.
  // Lets staff see at a glance whether the offer leaves room or not.
  // Skywalker 2026-05-19.
  try {
    const { atlas, ebay } = await loadCompRefs();
    for (const lead of leads) {
      // Pick the right device data — single-device uses lead.model directly,
      // multi-device leads use the first sub-device (good-enough heuristic).
      const primaryModel = lead.model || lead.devices?.[0]?.model;
      if (!primaryModel) continue;
      const sku = resolveSku(primaryModel);
      if (!sku) continue;
      const storage = normalizeStorage(lead.storage || lead.devices?.[0]?.storage);
      const condition = normalizeCondition(lead.condition || lead.devices?.[0]?.condition);
      const carrier = normalizeCarrier(lead.carrier || lead.devices?.[0]?.carrier);
      const quoteRaw = lead.quote || (lead.totalPayout != null ? `$${lead.totalPayout}` : undefined);
      // parseDollarAmount returns 0 for missing input — normalize to
      // undefined here so the downstream comp.atlas / comp.ebay blocks
      // (which check `quote != null`) treat "no quote" the same as
      // before. The old /\d+/ regex returned $1 for "$1,250" which
      // made compMargin under-report margin for any 4-figure quote.
      const parsed = parseDollarAmount(quoteRaw);
      const quote = parsed > 0 ? parsed : undefined;
      const comp: AdminLead["compMargin"] = { sku, quote };
      // Atlas — try the requested carrier variant first, fall back to
      // unlocked when no carrier match (e.g. when the funnel didn't
      // record carrier).
      const atlasResell = lookupAtlasResell(atlas, sku, primaryModel, storage, condition || "mint", carrier);
      if (atlasResell != null && quote != null) {
        // Atlas charges no FVF — only outbound shipping cost gets
        // deducted from the wholesale resell. Skywalker 2026-05-19.
        const atlasNet = atlasResellToNet(atlasResell, sku);
        comp.atlas = {
          resell: atlasResell,
          margin: atlasNet - quote,
          marginPct: atlasNet > 0 ? Math.round(((atlasNet - quote) / atlasNet) * 100) : 0,
          carrierKey: carrier || "unlocked",
        };
      }
      // eBay net median for this cell
      const ebayMatch = lookupEbayNet(ebay, sku, storage, condition);
      if (ebayMatch && quote != null) {
        comp.ebay = {
          netMedian: Math.round(ebayMatch.netMedian),
          sampleCount: ebayMatch.sampleCount,
          margin: Math.round(ebayMatch.netMedian) - quote,
          marginPct: ebayMatch.netMedian > 0 ? Math.round(((ebayMatch.netMedian - quote) / ebayMatch.netMedian) * 100) : 0,
        };
      }
      if (comp.atlas || comp.ebay) lead.compMargin = comp;
    }
  } catch {
    // Comp enrichment is best-effort; never fail the leads response over it.
  }

  // Customer history pass — Skywalker 2026-05-18 "customers history on
  // returning leads". Index every lead by normalized phone digits AND
  // lowercased email so a returning customer gets matched on either.
  // Then for each lead, count prior leads + sum the prior quote dollars.
  // PRIOR means strictly before this lead's timestamp; doesn't count the
  // current lead. Lifetime $ uses totalPayout for multi-device (already
  // summed) or quote for single-device.
  function quoteToInt(q?: string | number): number {
    if (typeof q === "number") return q;
    if (!q) return 0;
    const m = String(q).match(/(\d[\d,]*)/);
    return m ? parseInt(m[1].replace(/,/g, ""), 10) || 0 : 0;
  }
  const customerIndex = new Map<string, Array<{ ts: string; spend: number }>>();
  const pushIdx = (key: string | undefined, ts: string, spend: number) => {
    if (!key) return;
    const arr = customerIndex.get(key) || [];
    arr.push({ ts, spend });
    customerIndex.set(key, arr);
  };
  for (const l of leads) {
    const spend = l.totalPayout ?? quoteToInt(l.quote);
    const phoneKey = l.phone ? l.phone.replace(/\D/g, "") : undefined;
    const emailKey = l.email ? l.email.toLowerCase().trim() : undefined;
    pushIdx(phoneKey, l.timestamp, spend);
    if (emailKey && emailKey !== phoneKey) pushIdx(emailKey, l.timestamp, spend);
  }
  for (const l of leads) {
    const phoneKey = l.phone ? l.phone.replace(/\D/g, "") : undefined;
    const emailKey = l.email ? l.email.toLowerCase().trim() : undefined;
    // Union prior leads from BOTH keys (so a customer who used a phone
    // last time + email this time still gets matched). Dedupe by ts.
    const seen = new Set<string>();
    let priorCount = 0;
    let lifetime = 0;
    const accumulate = (key?: string) => {
      if (!key) return;
      const arr = customerIndex.get(key) || [];
      for (const entry of arr) {
        if (entry.ts >= l.timestamp) continue; // strictly prior
        if (seen.has(entry.ts)) continue;
        seen.add(entry.ts);
        priorCount += 1;
        lifetime += entry.spend;
      }
    };
    accumulate(phoneKey);
    accumulate(emailKey);
    if (priorCount > 0) {
      l.priorLeads = priorCount;
      l.lifetimeSpend = lifetime;
    }
  }

  // Cap raised from 50 → 200 so Skywalker can see the full backlog from
  // the admin without paging. MC returns 300 messages per fetch and most
  // are non-lead chatter, so 200 leaves headroom without breaking the
  // page render. internal-hidden filter applied above already.
  const internalCount = leads.length - visibleLeads.length;
  return NextResponse.json({
    leads: visibleLeads.slice(0, 200),
    count: visibleLeads.length,
    internalHidden: internalCount,
  });
}
