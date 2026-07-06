// Inbox watchdog — the safety net UNDER ManyChat. Hourly: reads the page's
// real Messenger threads from Graph (same source as the /api/messenger inbox
// peek) and emails the owner about any conversation where the CUSTOMER spoke
// last and nobody (bot or human) has replied in 45+ minutes. Catches the
// messages ManyChat silently never forwards (real case 2026-07-05: a seller
// sent "I have an iPhone 13 Pro Max I want to sell" six ways and got 90 min
// of silence). One alert per unanswered message, deduped via blob marker.
//
// Auth: CRON_SECRET on the Authorization header (same as the other crons).

import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { notifyOwnerSms } from "../../../lib/owner-sms";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STALE_MS = 45 * 60_000; // customer waiting this long = flag it
const MAX_AGE_MS = 48 * 3_600_000; // don't dredge up ancient threads

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

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.PAGE_ACCESS_TOKEN || "";
  if (!token) return NextResponse.json({ ok: false, reason: "no PAGE_ACCESS_TOKEN" });

  const me = await fetch(`https://graph.facebook.com/v21.0/me?fields=id&access_token=${encodeURIComponent(token)}`, { cache: "no-store" })
    .then((r) => r.json()).catch(() => null);
  const pageId = String(me?.id || "");
  if (!pageId) return NextResponse.json({ ok: false, reason: "page id lookup failed" });

  const inbox = await fetch(
    `https://graph.facebook.com/v21.0/me/conversations?fields=updated_time,participants,messages.limit(4){message,from,created_time}&limit=20&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  ).then((r) => r.json()).catch(() => null);
  const convos: GraphConvo[] = Array.isArray(inbox?.data) ? inbox.data : [];

  const waiting: { name: string; text: string; ageMin: number }[] = [];
  for (const c of convos) {
    const msgs = c.messages?.data || [];
    if (!c.id || !msgs.length) continue;
    const newest = msgs[0]; // Graph returns newest first
    const fromCustomer = newest.from?.id && newest.from.id !== pageId;
    if (!fromCustomer) continue;
    const t = new Date(newest.created_time || 0).getTime();
    const age = Date.now() - t;
    if (age < STALE_MS || age > MAX_AGE_MS) continue;
    if ((await lastFlagged(c.id)) === newest.created_time) continue; // already alerted for this exact message
    const name = c.participants?.data?.find((p) => p.id !== pageId)?.name || "Facebook user";
    waiting.push({ name, text: String(newest.message || "(attachment/no text)").slice(0, 80), ageMin: Math.round(age / 60_000) });
    await markFlagged(c.id, newest.created_time || "");
    if (waiting.length >= 5) break;
  }

  if (waiting.length) {
    const lines = waiting.map((w) => `${w.name} (${w.ageMin}m ago): "${w.text}"`).join(" · ");
    await notifyOwnerSms(`📥 ${waiting.length} Messenger thread${waiting.length > 1 ? "s" : ""} waiting on a reply — ${lines}`);
  }
  return NextResponse.json({ ok: true, flagged: waiting.length });
}
