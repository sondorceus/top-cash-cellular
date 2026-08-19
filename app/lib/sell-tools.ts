// Shared sell-side AI tools — the REAL quote engine + IMEI identification,
// exposed as Anthropic tool definitions.
//
// Extracted from /api/msgr-ai for the SITE chat (/api/chat). NOTE: the
// Messenger route still runs its own local copies of these tools (the
// extraction never swapped them in) — a change here must be MIRRORED in
// app/api/msgr-ai/route.ts until that route is ported. Both surfaces price
// from app/data/prices.ts through quoteDevice() — the same path the funnel
// uses — so a device can never be worth one number in the chat and a
// different number in the cart.
//
// What is deliberately NOT here: the per-channel POLICY. Messenger never
// quotes to the customer; the site chat quotes single catalog devices and
// escalates multi-device lots to the owner. That split lives in each route's
// system prompt, not in the tools.

import { after } from "next/server";
import { quoteDevice, normalizeStorage, type QuoteSpec } from "./quote";
import { PRICE_TABLE } from "../data/prices";
import { notifyOwnerSms } from "./owner-sms";

const have = (slug: string): boolean => !!PRICE_TABLE[slug];

/** Slug → clean display name for quote text (we control this, so it's accurate). */
export function slugToDisplay(slug: string): string {
  let m;
  if ((m = slug.match(/^ip(\d+)(pm|p|plus|mini|e|air)?$/))) {
    const v: Record<string, string> = { pm: " Pro Max", p: " Pro", plus: " Plus", mini: " mini", air: " Air" };
    return m[2] === "e" ? `iPhone ${m[1]}e` : `iPhone ${m[1]}${v[m[2] || ""] || ""}`;
  }
  if ((m = slug.match(/^gs(\d+)(u|p|fe)?$/))) {
    const v: Record<string, string> = { u: " Ultra", p: "+", fe: " FE" };
    return `Galaxy S${m[1]}${v[m[2] || ""] || ""}`;
  }
  if ((m = slug.match(/^gzflip(\d+)$/))) return `Galaxy Z Flip ${m[1]}`;
  if ((m = slug.match(/^gzfold(\d+)$/))) return `Galaxy Z Fold ${m[1]}`;
  if ((m = slug.match(/^px(\d+)(pxl|pfold|p|a)?$/))) {
    const v: Record<string, string> = { pxl: " Pro XL", pfold: " Pro Fold", p: " Pro" };
    return m[2] === "a" ? `Pixel ${m[1]}a` : `Pixel ${m[1]}${v[m[2] || ""] || ""}`;
  }
  return slug;
}

/**
 * Free-text model name → catalog slug. Forgiving on word order and spacing
 * because real sellers type "samsung ultra 26" and "i phone 14 promax".
 * Every branch is gated by have() so it can only ever return a real row.
 */
export function nameToSlug(raw: string): { slug: string; label: string } | null {
  const n = " " + raw.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ") + " ";
  const pro = /\bpro\b/.test(n);
  const max = /pro\s*max|\bmax\b/.test(n);
  const plus = /\bplus\b|\+/.test(n);
  const ultra = /\bultra\b/.test(n);
  const fe = /\bfe\b/.test(n);
  const mini = /\bmini\b/.test(n);
  const air = /\bair\b/.test(n);
  const xl = /\bxl\b/.test(n);
  const fold = /\bfold\b/.test(n);
  const aser = /\d+\s*a\b|\b\d+a\b/.test(n);

  // iPhone
  let m = n.match(/i\s*phone\s*(\d{1,2})/) || (/iphone/.test(n) ? n.match(/\b(\d{1,2})\b/) : null);
  if (m) {
    const g = m[1];
    const v = max ? "pm" : pro ? "p" : plus ? "plus" : mini ? "mini" : air ? "air" : /\b\d+\s*e\b|\be\b/.test(n) ? "e" : "";
    if (have("ip" + g + v)) return { slug: "ip" + g + v, label: slugToDisplay("ip" + g + v) };
  }
  // Samsung Galaxy
  if (/galaxy|samsung/.test(n)) {
    let g2 = n.match(/z\s*flip\s*(\d+)/);
    if (g2 && have("gzflip" + g2[1])) return { slug: "gzflip" + g2[1], label: slugToDisplay("gzflip" + g2[1]) };
    g2 = n.match(/z\s*fold\s*(\d+)/);
    if (g2 && have("gzfold" + g2[1])) return { slug: "gzfold" + g2[1], label: slugToDisplay("gzfold" + g2[1]) };
    g2 = n.match(/s\s*(\d{2})/);
    if (g2) {
      const v = ultra ? "u" : plus ? "p" : fe ? "fe" : "";
      if (have("gs" + g2[1] + v)) return { slug: "gs" + g2[1] + v, label: slugToDisplay("gs" + g2[1] + v) };
    }
    // Word-order tolerance: "Samsung Ultra 26" / "galaxy 26 ultra" — people put
    // the variant before the number and skip the S. A real lead typed exactly
    // this on 2026-07-05 and got no quote. Two-digit bound keeps it in the
    // S20-S26 range; have() gates it to real catalog rows either way.
    g2 = n.match(/\b(2\d)\b/);
    if (g2) {
      const v = ultra ? "u" : plus ? "p" : fe ? "fe" : "";
      if (have("gs" + g2[1] + v)) return { slug: "gs" + g2[1] + v, label: slugToDisplay("gs" + g2[1] + v) };
    }
  }
  // Google Pixel
  m = n.match(/pixel\s*(\d+)/);
  if (m) {
    const g = m[1];
    const v = pro && xl ? "pxl" : pro && fold ? "pfold" : pro ? "p" : aser ? "a" : "";
    if (have("px" + g + v)) return { slug: "px" + g + v, label: slugToDisplay("px" + g + v) };
  }
  return null;
}

/**
 * Multi-device / bulk-lot detector. Used two ways:
 *  - Messenger: gates follow-up nudges to lots worth chasing.
 *  - Site chat: server-side backstop for the routing rule — a multi-device
 *    seller goes to the owner to close, so this must not depend on the model
 *    choosing to behave.
 */
export function looksBulk(text: string): boolean {
  return (
    /\b(?:two|three|four|five|six|\d{1,2})\s+(?:iphones?|samsungs?|galaxys?|pixels?|phones?|devices?|macbooks?|laptops?|ipads?|tablets?|consoles?)\b/i.test(text) ||
    /\b(?:bulk|wholesale|a lot of (?:phones|devices)|several (?:phones|devices))\b/i.test(text)
  );
}

export type QuoteToolInput = {
  model?: string;
  storage?: string;
  condition?: string;
  carrier?: string;
  mdm_locked?: boolean;
  faceid_broken?: boolean;
};

export type QuoteToolResult = { ok: boolean; offer?: number; device?: string; slug?: string; reason?: string };

/** Run get_quote through the real engine — identical to the funnel's path. */
export async function runQuote(input: QuoteToolInput): Promise<QuoteToolResult> {
  const hit = nameToSlug(input.model || "");
  if (!hit) return { ok: false, reason: "not in the instant catalog — needs a manual quote from the team" };
  // Off-tier storage guard: a storage we don't carry a price row for must
  // never be silently routed to "team will quote it" as if the config were
  // real — the live bot accepted "17 Pro Max 128gb" (2026-08-19). But
  // PRICE_TABLE keys are the tiers we PRICE, not proof of what shipped
  // (e.g. gs24fe has no 512 row yet a 512 S24 FE exists), so the reason
  // nudges a re-check without denying the device — and escalates instead
  // of dead-ending if the seller insists.
  if (input.storage) {
    const row = PRICE_TABLE[hit.slug];
    const keys = row ? Object.keys(row) : [];
    const norm = normalizeStorage(input.storage);
    if (keys.length && !keys.includes("base") && (!norm || !keys.includes(norm))) {
      return {
        ok: false,
        device: hit.label,
        slug: hit.slug,
        reason: `no instant price for a ${hit.label} in ${input.storage} — the tiers we price instantly are ${keys.join("/")}. Most sellers misremember storage: have them check Settings > General > About (or the box) and confirm which of ${keys.join("/")} it is. If they're sure it really is ${input.storage}, hand it to the team as a manual quote — do NOT tell them the device doesn't exist, and do NOT invent a number.`,
      };
    }
  }
  const spec: QuoteSpec = {
    modelId: hit.slug,
    modelLabel: hit.label,
    storage: input.storage,
    condition: (input.condition || "good").toLowerCase(),
    carrier: (input.carrier || "unlocked").toLowerCase(),
    isPhone: true,
    // Volunteered issues → buyer-sheet schedule deductions (deductions.ts),
    // so the reference number is already honest for a known-MDM / dead-Face-ID
    // unit instead of surprising the owner at inspection.
    mdmLocked: !!input.mdm_locked,
    faceIdBroken: !!input.faceid_broken,
  };
  const r = await quoteDevice(spec).catch(() => null);
  if (!r || r.offer == null || r.manualReview) {
    return { ok: false, device: hit.label, slug: hit.slug, reason: r?.reason || "no auto-offer; team will quote it" };
  }
  return { ok: true, offer: r.offer, device: hit.label, slug: hit.slug };
}

export function luhnValid(num: string): boolean {
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

/**
 * IMEI → model identification (Sickw, same plumbing as /api/imei/check).
 * Luhn runs first so typos never reach the paid API.
 *
 * Blacklist / Find-My flags go to the OWNER only. The bot makes no buy/pass
 * decision and never mentions a lock to the customer — Sonny decides.
 */
export async function runImeiCheck(input: { imei?: string }): Promise<Record<string, unknown>> {
  const clean = String(input.imei || "").replace(/\D/g, "");
  if (clean.length !== 15 || !luhnValid(clean)) {
    return { ok: false, reason: "not a valid 15-digit IMEI — have them dial *#06# and re-send it" };
  }
  const key = process.env.SICKW_API_KEY || "";
  if (!key) return { ok: false, reason: "lookup unavailable — take the IMEI and notify_team" };
  try {
    const r = await fetch(`https://sickw.com/api.php?format=json&key=${key}&imei=${clean}&service=0`, { cache: "no-store" });
    const data = await r.json();
    if (data.status !== "success" || !data.result) {
      return { ok: false, reason: "lookup failed — take the IMEI and notify_team" };
    }
    const text = String(data.result);
    const get = (label: string) => text.match(new RegExp(`${label}:\\s*([^\\r\\n<]+)`, "i"))?.[1]?.trim() || null;
    const model = get("Model") || get("Model Description");
    const fmiRaw = get("Find My iPhone") || get("FMI Status") || get("iCloud Lock") || get("iCloud Status");
    const blacklistRaw = get("Blacklist Status") || get("Blacklist") || get("GSMA Blacklist");
    const findMyOn = !!fmiRaw && /on|locked|active/i.test(fmiRaw);
    const blacklisted = !!blacklistRaw && /black|locked|reported|stolen/i.test(blacklistRaw);
    if (blacklisted || findMyOn) {
      const flags = [blacklisted ? "BLACKLISTED" : "", findMyOn ? "Find My ON" : ""].filter(Boolean).join(" + ");
      after(() => notifyOwnerSms(`⚠️ TCC IMEI flag: ${model || "unknown model"} (${clean}) — ${flags}. Bot is quoting normally; your call.`));
    }
    // The model only learns WHAT the device is.
    return { ok: true, model };
  } catch {
    return { ok: false, reason: "lookup failed — take the IMEI and notify_team" };
  }
}

/**
 * Anthropic tool definitions shared by both sell surfaces.
 *
 * NOTE on notify_team: the summary field is the ONLY thing the owner prices
 * from, so its description demands a full itemized intake. Do not trim it.
 */
export const SELL_TOOLS = [
  {
    name: "get_quote",
    description:
      "Get the REAL cash offer for a phone from Top Cash Cellular's pricing engine. Call this for any price question — never guess a price yourself.",
    input_schema: {
      type: "object" as const,
      properties: {
        model: { type: "string", description: "Model as the customer said it, e.g. 'iPhone 14 Pro Max', 'Galaxy S24 Ultra', 'Pixel 9'." },
        storage: { type: "string", description: "Storage: 64, 128, 256, 512, or 1TB." },
        condition: {
          type: "string",
          enum: ["sealed", "mint", "good", "fair", "broken"],
          description: "sealed=new in plastic, mint=like new, good, fair=visible wear, broken=cracked/not working.",
        },
        carrier: { type: "string", enum: ["unlocked", "att", "tmobile", "verizon", "other"] },
        mdm_locked: { type: "boolean", description: "true ONLY if the customer said the phone has an MDM / company / school management lock. Never ask about it unprompted." },
        faceid_broken: { type: "boolean", description: "true ONLY if the customer said Face ID / Touch ID doesn't work. Never ask about it unprompted." },
      },
      required: ["model", "condition"],
    },
  },
  {
    name: "notify_team",
    description:
      "Alert a real Top Cash Cellular teammate to follow up. Call when the customer wants to proceed/lock in, asks for a human, gives contact info, has a device/bulk lot that needs a manual quote, or is a wholesale buyer/vendor pitching to buy FROM us (include their price sheet details).",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description:
            "Complete itemized intake — EVERY device with storage/condition/carrier per unit + their asking number, e.g. '2x iPhone 15 Pro Max sealed 256: one unlocked, one AT&T — wants 700/ea'. The owner prices from this line alone, so missing details cost money.",
        },
        contact: { type: "string", description: "Phone or email if given, else empty." },
      },
      required: ["summary"],
    },
  },
  {
    name: "check_imei",
    description:
      "Confirm what a device is from its 15-digit IMEI (customer dials *#06#). Returns the exact model, often with storage. ONLY call when the customer's message actually contains a 15-digit number — never preemptively.",
    input_schema: {
      type: "object" as const,
      properties: {
        imei: { type: "string", description: "The 15-digit IMEI exactly as the customer sent it." },
      },
      required: ["imei"],
    },
  },
];
