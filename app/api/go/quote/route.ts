// /api/go/quote — deterministic quote for the /go board's chip flow.
// No AI involved: validated spec → quoteDevice() → number. Board models
// only, so this public endpoint can't be scripted into a full price-table
// scraper (the funnel exposes prices anyway, but no reason to hand out a
// clean JSON API for the whole catalog).
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { quoteDevice } from "../../../lib/quote";
import { cachedOverrides } from "../../../lib/overrides-cache";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { appendChatMsg, validGoSession } from "../../../lib/gochat-store";
import { BOARD_MODELS } from "../../../go/board";
import { PRICE_TABLE } from "../../../data/prices";

const CONDITIONS = new Set(["sealed", "mint", "good", "fair", "broken"]);
const CARRIERS = new Set(["unlocked", "att", "tmobile", "verizon", "other"]);

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // A human answering chips fires ~4 quotes per device. 60/5min covers a
  // multi-device session with a wide margin and still stops scripts.
  if (!rateLimit(`goq:${ip}`, 60, 5 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "slow down a sec" }, { status: 429 });
  }
  let body: { model?: unknown; storage?: unknown; condition?: unknown; carrier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const model = String(body.model || "");
  const entry = BOARD_MODELS.find((m) => m.id === model);
  if (!entry) return NextResponse.json({ ok: false, error: "unknown model" }, { status: 400 });
  const storage = String(body.storage || "");
  const condition = String(body.condition || "");
  const carrier = String(body.carrier || "");
  // Object.hasOwn: a truthy in-lookup would accept inherited keys
  // ("constructor", "__proto__", …) as storage names.
  if (!Object.hasOwn(PRICE_TABLE[model] || {}, storage) || !CONDITIONS.has(condition) || !CARRIERS.has(carrier)) {
    return NextResponse.json({ ok: false, error: "bad spec" }, { status: 400 });
  }
  const r = await quoteDevice(
    {
      modelId: model,
      modelLabel: entry.label,
      storage,
      condition,
      carrier,
      // The /go chip question is "locked to a carrier" — answering
      // "verizon" IS declaring a Verizon-locked phone. att/tmobile gaps
      // apply off the carrier name alone, but the Verizon deduction only
      // fires on this flag (quote.ts:190-197); without it a truthful
      // verizon answer was quoted at the full unlocked price.
      carrierLocked: carrier === "verizon",
      isPhone: true,
    },
    await cachedOverrides(),
  ).catch(() => null);
  if (!r || r.offer == null || r.manualReview) {
    return NextResponse.json({ ok: false, manualReview: true });
  }
  // Chat-funnel breadcrumbs, written SERVER-SIDE with the engine result in
  // hand — the chat brain's FUNNEL STATE context and the restore-time
  // pendingQuote both read these, so they must never be client-authored
  // (a forged "quote shown: … → $950" note would put an invented number in
  // the bot's mouth). The client passes sessionId only from the in-chat
  // chip flow; the bare board flow omits it. Notes here are engine-true by
  // construction: worst case an abuser writes REAL quotes for REAL specs
  // into their own session.
  const sessionId = String(body && (body as { sessionId?: unknown }).sessionId || "");
  if (validGoSession(sessionId)) {
    const offer = r.offer;
    after(async () => {
      await appendChatMsg(sessionId, "note", `quote shown: ${entry.label} ${storage} ${condition} ${carrier} → $${offer}`);
      await appendChatMsg(sessionId, "note", `QSPEC: ${model}|${storage}|${condition}|${carrier}|${offer}`);
    });
  }
  return NextResponse.json({ ok: true, offer: r.offer });
}
