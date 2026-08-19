// /api/go/lock — the /go board's "Lock In My Offer". Re-quotes SERVER-SIDE
// (the client's number is never trusted), then routes the lead down the
// same paths every other TCC lead takes: Mission Control comms + owner
// alert. Unlike the chat route's fire-and-forget fan-out, delivery here is
// AWAITED — "locked in." must not render unless at least one alert path
// actually accepted the lead, because there is no other durable record yet.
//
// Carries the 18+/ownership attestation marker ([ATTEST: yes]) like
// /api/lead does — chat-side leads skipping the compliance trail was a
// flagged audit gap; this surface starts with it.
import { NextRequest, NextResponse } from "next/server";
import { quoteDevice } from "../../../lib/quote";
import { cachedOverrides } from "../../../lib/overrides-cache";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { BOARD_MODELS } from "../../../go/board";
import { PRICE_TABLE } from "../../../data/prices";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const CONDITIONS = new Set(["sealed", "mint", "good", "fair", "broken"]);
const CARRIERS = new Set(["unlocked", "att", "tmobile", "verizon", "other"]);

// Same defusal as /api/chat: the admin lead parser keys on bracket markers
// anywhere in a comm body, so user text never gets to carry brackets.
function sanitize(s: string): string {
  return s.replace(/[\[\]]/g, "").slice(0, 200);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // Cheap pre-parse cap only. The REAL per-IP and global budgets are
  // charged after validation passes, so junk POSTs can't burn a legit
  // seller's allowance (the /api/chat convention, which this route
  // originally inverted).
  if (!rateLimit(`golockraw:${ip}`, 30, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "too many tries — give it a minute" }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const model = String(body.model || "");
  const entry = BOARD_MODELS.find((m) => m.id === model);
  const storage = String(body.storage || "");
  const condition = String(body.condition || "");
  const carrier = String(body.carrier || "");
  const name = sanitize(String(body.name || "")).slice(0, 80);
  const contact = sanitize(String(body.contact || "")).slice(0, 120);
  const attest = body.attest === true;
  const src = String(body.src || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8);
  const sessionId = String(body.sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);

  if (!entry || !Object.hasOwn(PRICE_TABLE[model] || {}, storage) || !CONDITIONS.has(condition) || !CARRIERS.has(carrier)) {
    return NextResponse.json({ ok: false, error: "bad spec" }, { status: 400 });
  }
  if (!EMAIL_RE.test(contact) && !PHONE_RE.test(contact)) {
    return NextResponse.json({ ok: false, error: "we need a real phone or email to reach you" }, { status: 400 });
  }
  if (!attest) {
    return NextResponse.json({ ok: false, error: "attestation required" }, { status: 400 });
  }

  // Validation passed — now charge the real budgets. Per-IP guards one
  // abuser; the "global" bucket is per-lambda-instance (rate-limit.ts is
  // in-process), so it bounds burst-per-instance, NOT a true fleet-wide
  // cap — an honest backstop, not a guarantee.
  if (!rateLimit(`golock:${ip}`, 6, 30 * 60_000).ok || !rateLimit("golock:global", 40, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "too many tries — give it a minute" }, { status: 429 });
  }

  // Engine is the only price authority — quote fresh at lock time.
  const r = await quoteDevice(
    {
      modelId: model,
      modelLabel: entry.label,
      storage,
      condition,
      carrier,
      // "locked to a carrier" answered "verizon" = a Verizon-locked phone.
      carrierLocked: carrier === "verizon",
      isPhone: true,
    },
    await cachedOverrides(),
  ).catch(() => null);
  const offer = r && r.offer != null && !r.manualReview ? r.offer : null;

  const isEmail = EMAIL_RE.test(contact);
  const specLine = `${entry.label} ${storage} ${condition} ${carrier}`;
  // "Phone:"/"Email:" lines match what the admin lookup tooling extracts
  // from lead comms, so a GO LOCK lead is findable by contact like any
  // other lead even before the full /api/lead bridge exists.
  const mcBody =
    `[GO LOCK ✅]${sessionId ? ` sess:${sessionId} ·` : ""}${src ? ` src:${src} ·` : ""} ${specLine}` +
    `${offer != null ? ` — engine $${offer}` : " — MANUAL QUOTE (no engine offer)"}` +
    `\n${isEmail ? "Email" : "Phone"}: ${contact}${name ? `\nName: ${name}` : ""}\n[ATTEST: yes] ip:${sanitize(ip).slice(0, 60)}`;

  // AWAITED delivery — a lead that vanishes after "locked in." is worse
  // than a visible failure. ok only if at least one path accepted it.
  let mcOk = false;
  try {
    const res = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular Chat",
        role: "system",
        body: mcBody,
        tags: ["chat-lead", "go-lock", "has-contact", "lead-complete", "needs-callback", ...(sessionId ? [`sess-${sessionId}`] : [])],
        priority: "high",
      }),
    });
    mcOk = res.ok;
    if (!res.ok) console.error(`[go/lock] MC post failed: ${res.status}`);
  } catch (e) {
    console.error("[go/lock] MC post threw:", e);
  }
  let smsOk = false;
  try {
    smsOk = await notifyOwnerSms(
      `💰 GO lock: ${specLine}${offer != null ? ` — $${offer}` : " — needs manual quote"}\nReply to: ${contact}${name ? ` (${name})` : ""}`,
    );
  } catch (e) {
    console.error("[go/lock] owner alert threw:", e);
  }
  if (!mcOk && !smsOk) {
    return NextResponse.json({ ok: false, error: "couldn't save that — tap it once more" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, offer });
}
