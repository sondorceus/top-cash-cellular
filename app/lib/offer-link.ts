// Signed offer links (2026-09-26). An offer page used to be protected by
// nothing but its lead id — and that id is also the public "Offer #" on the
// done screen, in every e-mail and on the receipt, so one shared screenshot
// opened the customer's name, ship address and payout handle to anyone, and
// let them cancel or edit the trade. Every link we mint now carries
// `?k=<hmac over the lead id>`; a bare id still opens the page, but the API
// answers with the redacted view (device, quote, status — nothing private)
// and refuses every write. The visible Offer # is unchanged.
//
// Keyed on TCC_ADMIN_TOKEN like lead-token (the other signed-link-over-a-
// lead-id scheme), and only that: a cascade over several env names would
// silently re-key every link the day someone sets one of the others. No
// secret → no key → every view is the redacted one (fail closed), never an
// unsigned full view. Rotating the token invalidates every link sent so far
// (customers then see the redacted page and re-open from a newer e-mail or
// their account).
import { createHmac, timingSafeEqual } from "crypto";

const SITE = "https://topcashcellular.com";

function secret(): string {
  return process.env.TCC_ADMIN_TOKEN || "";
}

/** Lead ids are MC uids (`[\w-]+`); anything else gets no key. */
export function validLeadId(leadId: unknown): leadId is string {
  return typeof leadId === "string" && /^[\w-]{1,64}$/.test(leadId);
}

/** The signature for a lead's offer link — "" when no secret is configured. */
export function offerKey(leadId: string): string {
  const key = secret();
  if (!key || !validLeadId(leadId)) return "";
  // 24 hex chars = 96 bits: far beyond guessable, short enough for a text.
  return createHmac("sha256", key).update(`offer:${leadId}`).digest("hex").slice(0, 24);
}

/** True only for the exact key of this lead (constant-time compare). */
export function offerKeyValid(leadId: string, k: unknown): boolean {
  const want = offerKey(leadId);
  if (!want || typeof k !== "string" || k.length !== want.length) return false;
  try {
    return timingSafeEqual(Buffer.from(k), Buffer.from(want));
  } catch {
    return false;
  }
}

/** Relative signed path, e.g. `/offer/abc-123?k=…` (`&fresh=1` on request). */
export function offerPath(leadId: string, opts?: { fresh?: boolean }): string {
  const base = `/offer/${encodeURIComponent(leadId)}`;
  const k = offerKey(leadId);
  const qs = [k ? `k=${k}` : "", opts?.fresh ? "fresh=1" : ""].filter(Boolean).join("&");
  return qs ? `${base}?${qs}` : base;
}

/** Absolute signed URL for e-mails and texts. */
export function offerUrl(leadId: string, opts?: { fresh?: boolean }): string {
  return `${SITE}${offerPath(leadId, opts)}`;
}
