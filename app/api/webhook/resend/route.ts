import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { isNewsletterUnsubbed, markNewsletterUnsub } from "../../../lib/newsletter-unsub";

// =========================================================================
// RESEND EVENT WEBHOOK — bounces and complaints become durable opt-outs.
//
// Nothing read Resend's delivery feedback before (2026-09-27): a hard-bounced
// or complaining address stayed on the newsletter roster and was mailed again
// on every blast — the straight road to Gmail's 0.3 % spam-rate line.
// Register https://topcashcellular.com/api/webhook/resend in the Resend
// dashboard for `email.bounced` + `email.complained` and put its signing
// secret (whsec_…) in RESEND_WEBHOOK_SECRET.
//
// Verification is Svix's scheme (Resend signs with it): HMAC-SHA256 over
// "<svix-id>.<svix-timestamp>.<raw body>" keyed with the base64 bytes behind
// the whsec_ prefix, base64 signature, ±5 min timestamp tolerance. `svix` is
// not a dependency, so it is implemented inline. Fails CLOSED: no secret, no
// headers or a bad signature → 401 and nothing changes.
//
// Only a PERMANENT bounce or a complaint acts — a transient bounce (mailbox
// full) is not an opt-out. Idempotent: an address already opted out is left
// alone (no second marker), so Svix retries and duplicate events are free.
// =========================================================================

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TOLERANCE_S = 5 * 60;

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
  };
};

// Svix sends `svix-*`; the Standard Webhooks spelling is accepted too.
function header(req: NextRequest, svix: string, std: string): string {
  return req.headers.get(svix) || req.headers.get(std) || "";
}

function verifySvix(secret: string, id: string, ts: string, sigHeader: string, body: string): boolean {
  if (!id || !ts || !sigHeader) return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  // Space-separated "v1,<base64>" entries (a rotated key adds a second one).
  for (const part of sigHeader.split(/\s+/)) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

function isHardBounce(ev: ResendEvent): boolean {
  const b = ev.data?.bounce;
  const type = (b?.type || "").toLowerCase();
  if (type) return type === "permanent";
  // A payload without a type: only the known-dead sub-types count as hard.
  const sub = (b?.subType || "").toLowerCase();
  return ["general", "noemail", "suppressed", "onaccountsuppressionlist"].includes(sub);
}

async function postUnsubMarker(email: string, reason: "bounce" | "complaint"): Promise<void> {
  if (!MC_KEY) return;
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        // Same shape the roster parser reads (email=<addr>), plus the why.
        body: `[NEWSLETTER UNSUB] email=${email} reason=${reason}`,
        tags: ["newsletter", "unsubscribe", reason],
        priority: "low",
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {}
}

export async function POST(req: NextRequest) {
  const secret = (process.env.RESEND_WEBHOOK_SECRET || "").trim();
  if (!secret) return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET not configured" }, { status: 401 });
  const raw = await req.text();
  const verified = verifySvix(
    secret,
    header(req, "svix-id", "webhook-id"),
    header(req, "svix-timestamp", "webhook-timestamp"),
    header(req, "svix-signature", "webhook-signature"),
    raw,
  );
  if (!verified) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let ev: ResendEvent;
  try {
    ev = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = ev.type || "";
  const reason: "bounce" | "complaint" | null =
    type === "email.complained" ? "complaint" : type === "email.bounced" && isHardBounce(ev) ? "bounce" : null;
  if (!reason) return NextResponse.json({ ok: true, ignored: type || "unknown" });

  const toRaw = ev.data?.to;
  const addresses = (Array.isArray(toRaw) ? toRaw : toRaw ? [toRaw] : [])
    .map((a) => String(a).trim().toLowerCase())
    // "Name <addr>" → addr, then only a plain address survives (brackets and
    // whitespace never reach a comms body).
    .map((a) => a.match(/<([^>]+)>/)?.[1]?.trim() || a)
    .filter((a) => /^[^\s@\[\]<>]+@[^\s@\[\]<>]+\.[^\s@\[\]<>]+$/.test(a));

  let recorded = 0, already = 0, failed = 0;
  for (const email of addresses) {
    const known = await isNewsletterUnsubbed(email);
    if (known === true) { already += 1; continue; }
    const durable = await markNewsletterUnsub(email);
    if (!durable) { failed += 1; continue; }
    await postUnsubMarker(email, reason);
    recorded += 1;
  }
  // Nothing could be written → non-2xx so Svix retries the event.
  if (failed > 0 && recorded === 0 && already === 0) {
    return NextResponse.json({ ok: false, reason, failed }, { status: 500 });
  }
  return NextResponse.json({ ok: true, reason, recorded, already, failed });
}
