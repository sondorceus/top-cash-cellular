// POST /api/go/confirm-email { sessionId, email } — the fallback under a
// locked card whose confirmation TEXT failed. 2026-09-23 review: the Telnyx
// relay sat unfunded for a week, 0 of 13 lock texts went out, and the card
// had promised "we'll text you the details" and then went quiet. The seller
// drops an email, gets the same confirmation by email, and the console +
// owner get the address (the only working way to reach them now).
// Server-side facts only: the LOCKED note the lock route wrote (device +
// offer) and its timestamp (+14d = the lock end). Phone contacts reach for
// this; an email contact already got the email from the lock route.
import { NextRequest, NextResponse, after } from "next/server";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { appendChatMsg, readChat, validGoSession } from "../../../lib/gochat-store";
import { legacySession, linkBinds, sessionOwned, setOwnerCookie } from "../../../lib/go-owner";
import { sendLockConfirmationEmail, LOCK_DAYS } from "../../../lib/lock-confirmation";
import { notifyOwnerSms } from "../../../lib/owner-sms";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const D = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`goconfirm:${ip}`, 8, 30 * 60_000).ok || !rateLimit("goconfirm:global", 60, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "too many tries — give it a minute" }, { status: 429 });
  }
  let body: { sessionId?: unknown; email?: unknown; k?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }
  const sessionId = String(body.sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  if (!validGoSession(sessionId)) return NextResponse.json({ ok: false, error: "start from your quote" }, { status: 400 });
  // OWNERSHIP (2026-09-26): only the browser that started this thread (its
  // tcc_go_owner cookie) or a texted link's k may mail the offer anywhere —
  // before any read, same shape as the label route's refusal.
  const k = typeof body.k === "string" ? body.k : "";
  // LEGACY GRACE (2026-09-26): a session started before binding shipped has
  // no cookie anywhere — the first cookie-less browser that presents one is
  // its owner (go-owner legacySession); one flags-only list, no fetches.
  let graceBind = false;
  if (!sessionOwned(req, sessionId, k)) {
    const flags = await readChat(sessionId, Date.now());
    if (!legacySession(flags.firstTs) || flags.bound) return NextResponse.json({ ok: false, kind: "UNBOUND", hint: "Open the link from your text to add an email." }, { status: 403 });
    graceBind = true;
    await appendChatMsg(sessionId, "ctl", "bound"); // the grace is spent on this take
  }
  const bound = (res: NextResponse) => { if (graceBind || linkBinds(req, sessionId, k)) setOwnerCookie(res, sessionId); return res; };
  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "that email doesn't look right" }, { status: 400 });

  const state = await readChat(sessionId, 0);
  const noteMsgs = state.msgs.filter((m) => m.role === "note");
  const lockedNote = [...noteMsgs].reverse().find((m) => m.text.startsWith("LOCKED:"));
  if (!lockedNote) return NextResponse.json({ ok: false, error: "lock in your quote first" }, { status: 400 });
  // Notes at/after the newest LOCKED belong to this lock (the label route's rule).
  const sinceLock = noteMsgs.filter((m) => m.ts >= lockedNote.ts).map((m) => m.text);
  // One fallback per lock — a second tap says "sent", it doesn't resend.
  if (sinceLock.some((t) => /^Email sent to .* \(lock confirmation/.test(t))) {
    return bound(NextResponse.json({ ok: true, sent: true, already: true }));
  }
  const leadId = [...sinceLock].reverse().find((t) => t.startsWith("LEAD-ID: "))?.slice("LEAD-ID: ".length).trim() || "";

  // "LOCKED: iPhone 17 Pro 256 good unlocked $560 — 512…" / "… (manual) — …"
  const lockBody = lockedNote.text.slice("LOCKED:".length).split(" — ")[0].trim();
  const offer = Number(lockBody.match(/\$(\d+)/)?.[1] || 0) || null;
  const dev = lockBody.replace(/\s*\$\d+\s*$/, "").replace(/\s*\(manual\)\s*$/, "").trim() || "device";
  const lockUntil = new Date(lockedNote.ts + LOCK_DAYS * D).toISOString();

  const r = await sendLockConfirmationEmail({ to: email, dev, offer, lockUntil, sessionId });
  await Promise.all([
    // Its own note, not a CONTACT (2026-09-26): the newest CONTACT is the
    // number the console texts and the label route texts the label to — an
    // email written over it read as "no phone on file" in the console, and
    // anyone holding the session id could plant one. The label route reads
    // this note to email the label as well.
    appendChatMsg(sessionId, "note", `EMAIL-FALLBACK: ${email}`),
    appendChatMsg(
      sessionId,
      "note",
      r.sent
        ? `Email sent to ${email} (lock confirmation, text fallback)`
        : `Email FAILED to ${email} (lock confirmation, text fallback${r.reason ? ` — ${r.reason}` : ""})`,
    ),
  ]);
  // The lead alert went out with a phone that can't be texted — tell the
  // owner the seller just handed over an address that works.
  after(() =>
    notifyOwnerSms(
      `✉️ GO lock — seller added an email (their text didn't go through): ${email}\n${dev}${offer != null ? ` — $${offer}` : " — needs manual quote"}\nhttps://topcashcellular.com/admin/chats?session=${sessionId}`,
      leadId ? { leadId } : undefined,
    ).catch(() => false),
  );
  return bound(NextResponse.json({ ok: true, sent: r.sent }));
}
