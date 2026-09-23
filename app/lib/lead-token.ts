// Signed one-tap "✅ mark contacted" link for the owner's lead-alert emails.
// 2026-09-23 review: 26 leads had ONE status change between them — Sonny
// works leads from his phone and never opens the console to flip a status,
// so the watchdog kept nagging about locks he had already texted. The link
// is a GET (an inbox can only follow GETs) that mutates, so it carries an
// HMAC over the lead id keyed on TCC_ADMIN_TOKEN — the go-sid-token scheme —
// and no other secret leaves the server. No key = no link (fail closed).
import { createHmac, timingSafeEqual } from "crypto";

export function leadToken(leadId: string): string {
  const key = process.env.TCC_ADMIN_TOKEN || "";
  if (!key || !leadId) return "";
  return createHmac("sha256", key).update(`leadcontacted:${leadId}`).digest("hex").slice(0, 20);
}

export function leadTokenValid(leadId: string, k: string): boolean {
  const want = leadToken(leadId);
  if (!want || !k || k.length !== want.length) return false;
  try {
    return timingSafeEqual(Buffer.from(k), Buffer.from(want));
  } catch {
    return false;
  }
}

/** The one-tap URL for a lead, or null when no signing key is configured. */
export function contactedLink(leadId: string): string | null {
  if (!/^[\w-]{1,64}$/.test(leadId)) return null;
  const k = leadToken(leadId);
  return k ? `https://topcashcellular.com/api/go/contacted?lead=${encodeURIComponent(leadId)}&k=${k}` : null;
}
