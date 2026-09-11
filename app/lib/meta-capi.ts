// Meta Conversions API — server-side twin of the browser pixel's Lead event.
//
// WHY: /go traffic arrives inside the Facebook in-app browser, which is
// exactly where the browser pixel degrades most (ITP, iOS ATT, webview
// storage limits). At 10-20 leads/week every dropped conversion is training
// data Meta never gets back. The lock route already holds everything CAPI
// wants: offer value, contact, client IP, user agent.
//
// DEDUP: the client fires fbq('track','Lead',params,{eventID}) and the
// server sends the SAME event_id here — Meta keeps one copy. Event ids are
// derived from the sessionId so both sides can compute them independently.
//
// MATCH QUALITY (2026-09-11): the client now forwards the pixel's own
// browser ids — _fbp (browser id) and _fbc (the click id Meta stamps as
// ?fbclid= on every ad click, cookied by MetaPixel.tsx) — so a conversion
// matches the ad click directly instead of on IP + UA + one hashed contact.
// META_TEST_EVENT_CODE (optional env) routes events to Events Manager's
// Test Events tab for verification without touching production data.
//
// Best-effort by design: no-ops without META_CAPI_TOKEN, never throws, and
// callers run it inside after() so it can't delay a seller-facing response.
import { createHash } from "crypto";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const CAPI_TOKEN = process.env.META_CAPI_TOKEN || "";
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || "";

function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

// Meta-normalized hashes. The contact field is only guaranteed to CONTAIN
// an email or phone ("call me at 512-555-1212 after 5pm" passes the routes'
// validation), so hash the extracted MATCH, never the whole field — hashing
// surrounding words produces keys that can never match a Meta profile.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
export function hashEmail(contact: string): string | null {
  const m = EMAIL_RE.exec(contact)?.[0];
  return m ? sha256(m.trim().toLowerCase()) : null;
}
export function hashPhone(contact: string): string | null {
  const m = PHONE_RE.exec(contact)?.[0];
  if (!m) return null;
  let d = m.replace(/\D/g, "");
  if (d.length === 10) d = "1" + d; // US default, same rule as the SMS path
  return d.length === 11 ? sha256(d) : null;
}

// Cookie shapes Meta documents: fb.<subdomainIndex>.<creationTime>.<id>.
// Anything else is dropped — a malformed value is rejected by the API and
// can fail the whole event.
const FB_COOKIE_RE = /^fb\.\d\.\d{10,16}\.[A-Za-z0-9_-]{4,200}$/;
function fbCookie(v: unknown): string | null {
  return typeof v === "string" && FB_COOKIE_RE.test(v) ? v : null;
}

export type CapiLead = {
  eventId: string;
  sourceUrl: string;
  ip?: string | null;
  userAgent?: string | null;
  contact?: string | null; // raw phone or email; hashed here, never sent plain
  value?: number | null;
  contentName?: string | null;
  fbp?: string | null; // _fbp cookie, forwarded by the client
  fbc?: string | null; // _fbc cookie (fbclid), forwarded by the client
};

export async function sendCapiLead(e: CapiLead): Promise<boolean> {
  if (!PIXEL_ID || !CAPI_TOKEN) return false;
  const user_data: Record<string, unknown> = {};
  // clientIp() falls back to the literal "unknown", which Meta rejects.
  if (e.ip && e.ip !== "unknown") user_data.client_ip_address = e.ip;
  if (e.userAgent) user_data.client_user_agent = e.userAgent;
  if (e.contact) {
    const em = hashEmail(e.contact);
    const ph = em ? null : hashPhone(e.contact);
    if (em) user_data.em = [em];
    if (ph) user_data.ph = [ph];
  }
  const fbp = fbCookie(e.fbp);
  const fbc = fbCookie(e.fbc);
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;
  const body = {
    data: [{
      event_name: "Lead",
      event_time: Math.floor(Date.now() / 1000),
      event_id: e.eventId,
      action_source: "website",
      event_source_url: e.sourceUrl,
      user_data,
      ...(e.value != null || e.contentName
        ? { custom_data: { ...(e.value != null ? { value: e.value, currency: "USD" } : {}), ...(e.contentName ? { content_name: e.contentName } : {}) } }
        : {}),
    }],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("capi lead failed", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return res.ok;
  } catch (err) {
    console.error("capi lead threw", err);
    return false;
  }
}
