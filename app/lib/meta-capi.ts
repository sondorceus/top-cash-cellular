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

// Test traffic must never reach Meta as a conversion: verification runs
// (src=verify, go-verify-* sessions) and the owner's own number used to
// land in the dataset as real Leads, teaching the campaign to find people
// like the person testing it.
const TEST_SRC_RE = /^(verify|test|audit|review)$/i;
const OWNER_DIGITS = (process.env.OWNER_PHONE || "+15129609256").replace(/\D/g, "").slice(-10);
const INTERNAL_EMAILS = (process.env.TCC_INTERNAL_EMAILS || "sondorceus@gmail.com,sellurcell@topcashcells.com")
  .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
export function isTestConversion(o: { src?: string | null; sessionId?: string | null; contact?: string | null }): boolean {
  if (o.src && TEST_SRC_RE.test(o.src)) return true;
  if (o.sessionId && /^go-(verify|test|audit)/i.test(o.sessionId)) return true;
  const c = o.contact || "";
  const ph = PHONE_RE.exec(c)?.[0]?.replace(/\D/g, "").slice(-10);
  if (ph && OWNER_DIGITS && ph === OWNER_DIGITS) return true;
  const em = EMAIL_RE.exec(c)?.[0]?.toLowerCase();
  if (em && INTERNAL_EMAILS.includes(em)) return true;
  return false;
}

// Everything Meta can match a person on, normalized per its spec
// (lowercase, no spaces/punctuation, then SHA-256). EMQ was 7.2/10 on
// 2026-09-23 with only phone-or-email + IP + UA + browser ids; the city /
// state / zip / country from Vercel's edge geo, the seller's name when they
// gave one, and a stable external_id (the chat session) are the documented
// next keys. Every field is optional — a missing one is simply left out.
export type CapiUser = {
  ip?: string | null;
  userAgent?: string | null;
  contact?: string | null; // raw phone or email; hashed here, never sent plain
  phone?: string | null;   // when both are known (admin status flips)
  email?: string | null;
  name?: string | null;
  city?: string | null;
  region?: string | null;  // US state code, e.g. TX
  country?: string | null; // ISO-2, e.g. US
  zip?: string | null;
  externalId?: string | null;
  fbp?: string | null; // _fbp cookie, forwarded by the client
  fbc?: string | null; // _fbc cookie (fbclid), forwarded by the client
};

const norm = (v: string) => v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function buildUserData(u: CapiUser): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // clientIp() falls back to the literal "unknown", which Meta rejects.
  if (u.ip && u.ip !== "unknown") out.client_ip_address = u.ip;
  if (u.userAgent) out.client_user_agent = u.userAgent;
  const em = hashEmail(u.email || "") || hashEmail(u.contact || "");
  const ph = hashPhone(u.phone || "") || (hashEmail(u.contact || "") ? null : hashPhone(u.contact || ""));
  if (em) out.em = [em];
  if (ph) out.ph = [ph];
  const parts = norm(u.name || "").replace(/[^a-z\s'-]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 1) out.fn = [sha256(parts[0].replace(/['-]/g, ""))];
  if (parts.length >= 2) out.ln = [sha256(parts[parts.length - 1].replace(/['-]/g, ""))];
  const ct = norm(u.city || "").replace(/[^a-z]/g, "");
  if (ct) out.ct = [sha256(ct)];
  const st = norm(u.region || "").replace(/[^a-z]/g, "");
  if (st.length === 2) out.st = [sha256(st)];
  const zp = (u.zip || "").replace(/\D/g, "").slice(0, 5);
  if (zp.length === 5) out.zp = [sha256(zp)];
  const country = norm(u.country || "").replace(/[^a-z]/g, "");
  if (country.length === 2) out.country = [sha256(country)];
  const ext = (u.externalId || "").trim();
  if (ext) out.external_id = [sha256(ext)];
  const fbp = fbCookie(u.fbp);
  const fbc = fbCookie(u.fbc);
  if (fbp) out.fbp = fbp;
  if (fbc) out.fbc = fbc;
  return out;
}

export type CapiEvent = {
  eventName: "Lead" | "Purchase";
  eventId: string;
  // website = happened on the page (Lead). A completed trade happens at a
  // meetup (physical_store) or when the payout goes out (system_generated).
  actionSource: "website" | "physical_store" | "system_generated";
  sourceUrl?: string | null;
  value?: number | null;
  contentName?: string | null;
  contentCategory?: string | null;
  user: CapiUser;
};

export async function sendCapiEvent(e: CapiEvent): Promise<boolean> {
  if (!PIXEL_ID || !CAPI_TOKEN) return false;
  const custom: Record<string, unknown> = {};
  if (e.value != null && Number.isFinite(e.value)) { custom.value = e.value; custom.currency = "USD"; }
  if (e.contentName) custom.content_name = e.contentName;
  if (e.contentCategory) custom.content_category = e.contentCategory;
  const body = {
    data: [{
      event_name: e.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: e.eventId,
      action_source: e.actionSource,
      ...(e.actionSource === "website" && e.sourceUrl ? { event_source_url: e.sourceUrl } : {}),
      user_data: buildUserData(e.user),
      ...(Object.keys(custom).length ? { custom_data: custom } : {}),
    }],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`capi ${e.eventName} failed`, res.status, (await res.text().catch(() => "")).slice(0, 200));
    return res.ok;
  } catch (err) {
    console.error(`capi ${e.eventName} threw`, err);
    return false;
  }
}

// The Lead twin of the browser pixel (lock + chat contact). Kept as the
// call-site shape both routes already use.
export type CapiLead = {
  eventId: string;
  sourceUrl: string;
  value?: number | null;
  contentName?: string | null;
} & Omit<CapiUser, "phone" | "email">;

export async function sendCapiLead(e: CapiLead): Promise<boolean> {
  const { eventId, sourceUrl, value, contentName, ...user } = e;
  return sendCapiEvent({ eventName: "Lead", eventId, actionSource: "website", sourceUrl, value, contentName, user });
}
