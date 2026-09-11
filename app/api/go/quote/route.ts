// /api/go/quote — deterministic quote for the /go chip flow.
// No AI involved: validated spec → resolveGoSpec → quoteDevice → number.
// Board models only (phones, iPads, consoles), so this public endpoint
// can't be scripted into a full price-table scraper (the funnel exposes
// prices anyway, but no reason to hand out a clean JSON API for the whole
// catalog).
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { appendChatMsg, validGoSession } from "../../../lib/gochat-store";
import { resolveGoSpec, goQuote } from "../../../go/spec";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // A human answering chips fires ~4 quotes per device. 60/5min covers a
  // multi-device session with a wide margin and still stops scripts.
  if (!rateLimit(`goq:${ip}`, 60, 5 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "slow down a sec" }, { status: 429 });
  }
  let body: { model?: unknown; storage?: unknown; condition?: unknown; carrier?: unknown; opt?: unknown; processor?: unknown; memory?: unknown; extras?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const res = resolveGoSpec(body);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  const spec = res.spec;
  const offer = await goQuote(spec);
  if (offer == null) {
    return NextResponse.json({ ok: false, manualReview: true });
  }
  // Chat-funnel breadcrumbs, written SERVER-SIDE with the engine result in
  // hand — the chat brain's FUNNEL STATE context and the restore-time
  // pendingQuote both read these, so they must never be client-authored
  // (a forged "quote shown: … → $950" note would put an invented number in
  // the bot's mouth). Notes here are engine-true by construction: worst
  // case an abuser writes REAL quotes for REAL specs into their own session.
  const sessionId = String(body.sessionId || "");
  if (validGoSession(sessionId)) {
    after(async () => {
      await appendChatMsg(sessionId, "note", `quote shown: ${spec.specLine} → $${offer}`);
      await appendChatMsg(sessionId, "note", `QSPEC: ${spec.entry.id}|${spec.storage}|${spec.condition}|${spec.secondary}|${offer}`);
    });
  }
  return NextResponse.json({ ok: true, offer });
}
