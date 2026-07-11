// Inbox watchdog + RECOVERY — the safety net under both bot transports.
// Every 15 min: reads the page's real Messenger threads from Graph and finds
// conversations where the CUSTOMER spoke last and nobody (bot or human) has
// replied in 20+ minutes — the bot normally answers within ~2 min, so a
// customer-last thread this stale means a reply was dropped (ManyChat never
// forwarded it, a deploy killed the in-flight after(), a Graph send failed).
//
// It used to only email the owner. Live results said that's not enough: a
// seller answered the bot's own condition question on 2026-07-10 at 8:21am and
// the thread sat dead for 30+ hours. Now the watchdog also RE-RUNS the brain
// on the unanswered message and sends the reply itself — the alert still goes
// out, marked with whether the bot recovered or the owner is actually needed.
//
// Recovery is skipped when silence is the CORRECT behavior: the customer
// closed the thread ("never mind", "ok thank you"), stepped away ("I'll let
// you know when I get home"), the owner muted/took over the convo, or the
// message is past the 24h Send-API window. The brain re-checks its own guards
// (mute, defer, owner-takeover, burst markers) on top of these.
//
// Auth: CRON_SECRET on the Authorization header (same as the other crons).

import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { deferActive } from "../../../lib/msgr-signals";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STALE_MS = 20 * 60_000; // customer waiting this long = act on it
const MAX_AGE_MS = 48 * 3_600_000; // don't dredge up ancient threads
const MAX_RECOVER_MS = 20 * 3_600_000; // Send API standard window is 24h — stay clear of the edge

// Silence was deliberate — don't re-engage. Thread-enders, pure sign-off acks,
// and step-aways ("I'll text you when I find the box") resume on THEIR next
// message; recovering into them reads as chasing.
const ENDED = /\b(never ?mind|nvm|not interested|no thanks?|i'?m good|we'?re good|all good|maybe later|ya no|olv[ií]dalo|no gracias|d[eé]jalo)\b/i;
const ACK_ONLY = /^[\s.!,👍🙏❤️💯]*((ok(ay)?|k+|bet|cool+|thanks?|thank you|ty|gracias|sounds good|got it|will do|no problem|np|sure|va+|vale|dale|listo|perfecto)[\s.!,👍🙏❤️💯]*)+$/i;
const STEP_AWAY = /\b(i'?ll (get back|text|message|hit you|let you know|check|look|ask|think)|let me (check|think|ask|look|see)|give me (a |an? )?(min|sec|bit|minute|hour|day)|talk (to you )?later|when i (get|go|'?m) (home|back|off)|ma[ñn]ana te|later today|tonight i'?ll)\b/i;

type GraphMsg = { message?: string; created_time?: string; from?: { id?: string; name?: string } };
type GraphConvo = { id?: string; updated_time?: string; participants?: { data?: { id?: string; name?: string }[] }; messages?: { data?: GraphMsg[] } };

async function lastFlagged(convoId: string): Promise<string> {
  try {
    const { blobs } = await list({ prefix: `msgr-inboxwatch/${convoId}`, limit: 1 });
    if (!blobs.length) return "";
    const r = await fetch(blobs[0].url, { cache: "no-store" });
    return r.ok ? (await r.text()).trim() : "";
  } catch {
    return "";
  }
}
async function markFlagged(convoId: string, msgTime: string) {
  try {
    await put(`msgr-inboxwatch/${convoId}`, msgTime, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain" });
  } catch {
    /* best-effort */
  }
}

// Same msgr-mute marker the takeover link + Mission Control buttons write.
async function isMuted(psid: string): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: `msgr-mute/${psid}/`, limit: 100 });
    const marks = blobs
      .map((b) => b.pathname.match(/\/(\d{13})-(\d{1,3})$/))
      .filter(Boolean)
      .map((m) => ({ ts: Number((m as RegExpMatchArray)[1]), hours: Number((m as RegExpMatchArray)[2]) }));
    if (!marks.length) return false;
    const newest = marks.reduce((a, b) => (b.ts >= a.ts ? b : a));
    return Date.now() < newest.ts + newest.hours * 3_600_000;
  } catch {
    return false;
  }
}

// Re-run the brain on the unanswered message and send its reply. The brain
// gets psid so it reads the real thread, joins the shared burst/mute/takeover
// guards, and records its outbound in the ledger. Returns what was sent.
async function recoverThread(origin: string, psid: string, lastText: string, token: string): Promise<string[]> {
  const secret = process.env.MSGR_BOT_SECRET || "";
  if (!secret) return [];
  try {
    const r = await fetch(`${origin}/api/msgr-ai?s=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lastText, psid, deep: true, recover: true }),
    });
    if (!r.ok) return [];
    const out = (await r.json()) as { content?: { messages?: { text?: string }[] } };
    const texts = (out?.content?.messages ?? []).map((m) => m?.text).filter(Boolean) as string[];
    for (const text of texts) {
      const sent = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message: { text } }),
      });
      if (!sent.ok) {
        console.error("[inbox-watch] recovery send failed", sent.status, (await sent.text().catch(() => "")).slice(0, 300));
        return [];
      }
    }
    return texts;
  } catch (e) {
    console.error("[inbox-watch] recovery failed", (e as Error).message);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.PAGE_ACCESS_TOKEN || "";
  if (!token) return NextResponse.json({ ok: false, reason: "no PAGE_ACCESS_TOKEN" });

  const inbox = await fetch(
    `https://graph.facebook.com/v21.0/me/conversations?fields=updated_time,participants,messages.limit(4){message,from,created_time}&limit=20&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  ).then((r) => r.json()).catch(() => null);
  const convos: GraphConvo[] = Array.isArray(inbox?.data) ? inbox.data : [];

  // The page is the one participant present in EVERY conversation (a /me id
  // lookup is unreliable on this token — it failed live while conversations
  // worked). Count participant ids across threads; the max-count id = page.
  const seen = new Map<string, number>();
  for (const c of convos) for (const p of c.participants?.data || []) if (p.id) seen.set(p.id, (seen.get(p.id) || 0) + 1);
  const pageId = convos.length >= 2 ? [...seen.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "" : "";
  if (!pageId) return NextResponse.json({ ok: false, reason: "page id derivation failed", convos: convos.length });

  const botLive = process.env.MSGR_AI_ENABLED !== "0";
  const waiting: { name: string; text: string; ageMin: number; recovered: boolean }[] = [];
  let recoveries = 0;
  for (const c of convos) {
    const msgs = c.messages?.data || [];
    if (!c.id || !msgs.length) continue;
    const newest = msgs[0]; // Graph returns newest first
    const psid = newest.from?.id && newest.from.id !== pageId ? newest.from.id : "";
    if (!psid) continue; // page spoke last — nothing hanging
    const t = new Date(newest.created_time || 0).getTime();
    const age = Date.now() - t;
    if (age < STALE_MS || age > MAX_AGE_MS) continue;
    if ((await lastFlagged(c.id)) === newest.created_time) continue; // already handled this exact message
    await markFlagged(c.id, newest.created_time || "");

    const lastText = String(newest.message || "").trim();
    const name = c.participants?.data?.find((p) => p.id !== pageId)?.name || "Facebook user";

    // Recovery — only when silence looks like a DROP, not a choice.
    let sentTexts: string[] = [];
    const deliberate = ENDED.test(lastText) || ACK_ONLY.test(lastText) || STEP_AWAY.test(lastText);
    if (botLive && !deliberate && age <= MAX_RECOVER_MS && recoveries < 3 && !(await isMuted(psid)) && !(await deferActive(psid))) {
      sentTexts = await recoverThread(req.nextUrl.origin, psid, lastText, token);
      if (sentTexts.length) recoveries++;
    }

    waiting.push({
      name,
      text: (lastText || "(photo/attachment)").slice(0, 80),
      ageMin: Math.round(age / 60_000),
      recovered: sentTexts.length > 0,
    });
    if (waiting.length >= 5) break;
  }

  if (waiting.length) {
    // Threads the bot picked back up are FYI; threads it couldn't are on Sonny.
    const needsYou = waiting.filter((w) => !w.recovered);
    const fixed = waiting.filter((w) => w.recovered);
    const lines = [
      ...needsYou.map((w) => `⏰ ${w.name} (${w.ageMin}m, needs YOU): "${w.text}"`),
      ...fixed.map((w) => `🤖 ${w.name} (${w.ageMin}m): "${w.text}" — bot jumped back in`),
    ].join("\n");
    await notifyOwnerSms(`📥 ${waiting.length} Messenger thread${waiting.length > 1 ? "s" : ""} were waiting on a reply\n${lines}`);
  }
  return NextResponse.json({ ok: true, flagged: waiting.length, recovered: recoveries });
}
