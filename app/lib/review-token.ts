// One-use review-token verification, shared by GET /api/reviews/verify-token
// (the /reviews/new page) and POST /api/reviews (the submission).
//
// /api/reviews used to reach this over an HTTP hop to its own origin. That
// hop carries the FUNCTION's egress IP, not the reviewer's, so once
// verify-token got a per-IP limit every reviewer's submission shared one
// bucket — a flood of junk submissions 429'd real customers out of their
// review + $25 code. Calling this directly keeps the submission behind
// /api/reviews' own per-client limit only.
//
// Skywalker 2026-05-18: "BE STRICT — random people can't see the
// review page. Even if customer checkout, if not marked paid, can't
// review."
//
// A token is valid iff ALL of these hold:
//   1. A [REVIEW-TOKEN: <leadId>] token=X expires=ISO marker exists in MC
//   2. The expires timestamp is in the future
//   3. NO [REVIEW-USED: token=X] marker exists yet (single-use)
//   4. The bound lead's most recent status is "paid" OR "met"
//
// Condition (4) is the belt-and-suspenders: even if a token marker
// somehow got minted without a paid/met flip (shouldn't happen, but
// defense in depth), we refuse access unless the lead actually paid.

import { fetchCommsPaged } from "./mc-comms";
import { field } from "./lead-devices";

const MC_KEY = process.env.MC_API_KEY || "";

export type ReviewTokenResult =
  | { valid: true; leadId: string; name?: string; device?: string; email?: string; phone?: string }
  | { valid: false; error: string; status: number };

// Cheap shape gate, no I/O. Every token ever minted is randomBytes(32) hex
// (admin status route + reminders cron); anything else is refused before
// the archive read below, which is ~30× the old single slice.
export function reviewTokenShapeError(token: string | null | undefined): string | null {
  if (!token || token.length < 32) return "Missing token";
  if (!/^[0-9a-f]{64}$/i.test(token)) return "Invalid review link";
  return null;
}

export async function verifyReviewToken(token: string): Promise<ReviewTokenResult> {
  const shape = reviewTokenShapeError(token);
  if (shape) return { valid: false, error: shape, status: 401 };

  // Paged read through the archive. A single limit=1000 slice covers only
  // ~3 days of the shared feed, but the token lives 60 days and the reminders
  // cron re-sends it days after the paid flip — by then the [REVIEW-TOKEN] /
  // paid [STATUS] markers had scrolled out and a real customer got "Invalid
  // review link". The lead body (for the coupon's email/phone binding) is
  // older still, so no 60-day floor — up to 30k messages (~3 months at
  // ~1000 per 3 days: the token's life plus a slow lead-to-paid gap). The
  // helper returns [] on an MC failure; the feed is never empty, so treat
  // that as unavailable.
  const messages: { id?: string; body?: string; timestamp: string }[] = MC_KEY
    // memoMs: the review page verifies on load and again on submit.
    ? await fetchCommsPaged({ apiKey: MC_KEY, includeArchive: true, pageSize: 5000, maxPages: 6, memoMs: 30_000 })
    : [];
  if (messages.length === 0) {
    return { valid: false, error: "Verification service unavailable", status: 502 };
  }

  // Find the token-mint marker by the exact token value.
  let tokenLeadId: string | undefined;
  let tokenExpiry: string | undefined;
  let tokenName: string | undefined;
  let tokenDevice: string | undefined;
  for (const m of messages) {
    if (!m.body) continue;
    const head = m.body.match(/\[REVIEW-TOKEN:\s*([\w-]+)\]/i);
    if (!head) continue;
    const tk = m.body.match(/token=([\w]+)/i)?.[1];
    if (tk !== token) continue;
    tokenLeadId = head[1];
    tokenExpiry = m.body.match(/expires=([^\s]+)/i)?.[1];
    tokenName = m.body.match(/name=([^\s]+)/i)?.[1]?.replace(/_/g, " ");
    tokenDevice = m.body.match(/device=([^\s]+)/i)?.[1]?.replace(/_/g, " ");
    break;
  }
  if (!tokenLeadId) {
    return { valid: false, error: "Invalid review link", status: 401 };
  }
  if (tokenExpiry && new Date(tokenExpiry).getTime() < Date.now()) {
    return { valid: false, error: "This review link has expired", status: 401 };
  }

  // Single-use: refuse if token already redeemed.
  const used = messages.some((m) => m.body && new RegExp(`\\[REVIEW-USED:\\s*${token}\\]`, "i").test(m.body));
  if (used) {
    return { valid: false, error: "This review link has already been used", status: 401 };
  }

  // Belt-and-suspenders: the bound lead must be in paid/met status.
  let mostRecentStatus: { status: string; ts: string } | undefined;
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[STATUS:\s*(\w+)\]/i);
    const lm = m.body.match(/\[LEAD:\s*([\w-]+)\]/i);
    if (!sm || !lm || lm[1] !== tokenLeadId) continue;
    if (!mostRecentStatus || m.timestamp > mostRecentStatus.ts) {
      mostRecentStatus = { status: sm[1].toLowerCase(), ts: m.timestamp };
    }
  }
  if (!mostRecentStatus || (mostRecentStatus.status !== "paid" && mostRecentStatus.status !== "met")) {
    return { valid: false, error: "Review access requires a completed trade", status: 401 };
  }

  // Pull the original lead body so /api/reviews can bind the coupon
  // to the customer's email + phone. Token-mint markers only carry
  // name + device; identity (email/phone) lives in the lead body.
  let leadEmail: string | undefined;
  let leadPhone: string | undefined;
  for (const m of messages) {
    if (m.id === tokenLeadId && m.body) {
      // The lead's own first Phone:/Email: line, inline whitespace only.
      // `^Phone:\s*(.+)$` crossed the newline on an email-only lead
      // ("Phone: " left blank) and bound the coupon phone to the text of
      // the next line ("Email: …").
      const e = field(m.body, "Email");
      const p = field(m.body, "Phone");
      if (e) leadEmail = e;
      if (p) leadPhone = p;
      break;
    }
  }

  return {
    valid: true,
    leadId: tokenLeadId,
    name: tokenName,
    device: tokenDevice,
    email: leadEmail,
    phone: leadPhone,
  };
}
