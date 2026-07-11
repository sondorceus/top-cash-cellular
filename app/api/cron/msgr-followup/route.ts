// Next-day follow-up — Sonny's "You still wanna sell bro", automated, but ONLY
// for deals worth chasing (Skywalker 2026-07-11: "some deals arent worth it").
//
// Hourly: finds threads where WE spoke last and the customer has been quiet
// 16–23h (Meta's Send API standard window counts 24h from the CUSTOMER's last
// message — past it, no send is possible, so this is the one shot). A cheap
// Haiku pass reads the thread and decides if the lead clears the bar:
// iPhone 13+/recent Galaxy/Pixel, MacBooks/recent iPads, current consoles,
// bulk/multi-device, or money on the table ≥ $MSGR_FOLLOWUP_MIN (default 100).
// Scrap-tier phones, junk, vendor pitches, and spam get left alone — chasing a
// $30 deal reads desperate and wastes the owner's time when they bite.
//
// Guards: one follow-up per customer per 30 days (blob marker), never when
// muted / takeover-deferred, never over a thread whose last page message isn't
// in the bot's outbound ledger (that's the OWNER typing from Business Suite —
// his convo, his follow-up), and only 9am–8pm Austin time.
//
// Auth: CRON_SECRET on the Authorization header (same as the other crons).

import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { recordOutbound, listSentHashes, sentHash, deferActive } from "../../../lib/msgr-signals";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MIN_AGE_MS = 16 * 3_600_000; // quiet this long = they went cold overnight
const MAX_AGE_MS = 23 * 3_600_000; // stay clear of the 24h Send API edge
const REFOLLOW_MS = 30 * 24 * 3_600_000; // one nudge per customer per month
const WORTH_MIN = Number(process.env.MSGR_FOLLOWUP_MIN ?? 100);

type GraphMsg = { message?: string; created_time?: string; from?: { id?: string } };
type GraphConvo = { id?: string; participants?: { data?: { id?: string; name?: string }[] }; messages?: { data?: GraphMsg[] } };

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

async function lastFollowupTs(psid: string): Promise<number> {
  try {
    const { blobs } = await list({ prefix: `msgr-followup/${psid}/`, limit: 100 });
    const ts = blobs.map((b) => Number(b.pathname.match(/\/(\d{13})$/)?.[1] || 0)).filter(Boolean);
    return ts.length ? Math.max(...ts) : 0;
  } catch {
    return Date.now(); // infra error → pretend we just followed up (never spam on flaky list())
  }
}
async function markFollowup(psid: string) {
  try {
    await put(`msgr-followup/${psid}/${String(Date.now()).padStart(13, "0")}`, ".", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
  } catch {
    /* best-effort */
  }
}

// Haiku reads the thread and decides if this lead clears the value bar.
// Conservative by design: parse failure or uncertainty = not worth it.
type Verdict = { worth: boolean; device: string; lang: "en" | "es"; closed: boolean };
async function judgeThread(transcript: string): Promise<Verdict> {
  const fallback: Verdict = { worth: false, device: "", lang: "en", closed: false };
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      system:
        `You judge phone-buyback leads for ONE follow-up text. WORTH a follow-up: iPhone 13 or newer, Galaxy S21+/Z Flip/Z Fold, Pixel 6+, MacBook or recent iPad, PS5/Xbox Series, Apple Watch Ultra or Series 9+, multiple devices or a bulk lot, or any deal where the money discussed is $${WORTH_MIN} or more. NOT worth: single older/scrap phones (iPhone 12 and below, old Galaxy/Pixel), broken-only junk, PS4-era or older consoles, Fitbits/accessories, wholesale vendors pitching to sell TO us, spam or trolling. closed=true when the customer explicitly backed out ("never mind", "ima keep it", "not interested"). If unsure, worth=false. Output ONLY JSON: {"worth":bool,"device":"short name","lang":"en"|"es","closed":bool}`,
      messages: [{ role: "user", content: transcript.slice(0, 4000) }],
    });
    const flat = (r.content as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join("");
    const j = JSON.parse(flat.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return {
      worth: j.worth === true,
      device: String(j.device || "").slice(0, 40),
      lang: j.lang === "es" ? "es" : "en",
      closed: j.closed === true,
    };
  } catch {
    return fallback;
  }
}

// The nudge, in the owner's voice. Ghosted mid-intake gets his literal classic;
// an explicit walk-away on a GOOD deal gets one no-pressure standing-offer line.
function followupLine(v: Verdict, psid: string): string {
  const dev = v.device && !/unknown|multiple|various/i.test(v.device) ? v.device : "";
  if (v.closed) {
    return v.lang === "es"
      ? "Sin problema si cambiaste de opinión — la oferta sigue en pie cuando quieras 👍"
      : "All good if you changed your mind — offer still stands whenever 👍";
  }
  const en = [
    "You still wanna sell bro",
    dev ? `Still got the ${dev}? I'm out doing pickups today if you wanna get it done` : "Still selling? I'm out doing pickups today if you wanna get it done",
    dev ? `Yo — still interested in selling the ${dev}? Cash in hand today if you're around` : "Yo — still interested? Cash in hand today if you're around",
  ];
  const es = [
    "¿Sigues queriendo vender? Ando haciendo recogidas hoy si te queda 💵",
    dev ? `¿Todavía tienes el ${dev}? Te pago en efectivo hoy mismo` : "¿Todavía lo tienes? Te pago en efectivo hoy mismo",
  ];
  const pool = v.lang === "es" ? es : en;
  let h = 0;
  for (const ch of psid) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return pool[Math.abs(h) % pool.length];
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (process.env.MSGR_AI_ENABLED === "0") return NextResponse.json({ ok: true, skipped: "bot disabled" });
  const token = process.env.PAGE_ACCESS_TOKEN || "";
  if (!token) return NextResponse.json({ ok: false, reason: "no PAGE_ACCESS_TOKEN" });

  // Follow-ups only land 9am–8pm Austin — a 3am nudge reads like a bot.
  const hr = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }).format(new Date())) % 24;
  if (hr < 9 || hr >= 20) return NextResponse.json({ ok: true, skipped: "quiet hours" });

  const inbox = await fetch(
    `https://graph.facebook.com/v21.0/me/conversations?fields=participants,messages.limit(12){message,from,created_time}&limit=25&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  ).then((r) => r.json()).catch(() => null);
  const convos: GraphConvo[] = Array.isArray(inbox?.data) ? inbox.data : [];

  // Page id = the participant present in every conversation (same trick as
  // inbox-watch; /me is unreliable on this token).
  const seen = new Map<string, number>();
  for (const c of convos) for (const p of c.participants?.data || []) if (p.id) seen.set(p.id, (seen.get(p.id) || 0) + 1);
  const pageId = convos.length >= 2 ? [...seen.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "" : "";
  if (!pageId) return NextResponse.json({ ok: false, reason: "page id derivation failed", convos: convos.length });

  const results: { name: string; action: string }[] = [];
  let sends = 0;
  for (const c of convos) {
    if (sends >= 3) break;
    const msgs = (c.messages?.data || []).filter((m) => (m.message || "").trim() || m.from);
    if (!msgs.length) continue;
    const psid = c.participants?.data?.find((p) => p.id && p.id !== pageId)?.id || "";
    const name = c.participants?.data?.find((p) => p.id === psid)?.name || "Facebook user";
    if (!psid) continue;

    // We spoke last, and the customer's silence is in the 16–23h window.
    const newest = msgs[0]; // Graph returns newest first
    if (newest.from?.id !== pageId) continue; // customer-last = inbox-watch territory
    const lastCust = msgs.find((m) => m.from?.id === psid);
    if (!lastCust) continue;
    const custAge = Date.now() - (Date.parse(lastCust.created_time || "") || 0);
    if (custAge < MIN_AGE_MS || custAge > MAX_AGE_MS) continue;

    if (await isMuted(psid)) continue;
    if (await deferActive(psid)) continue;
    if (Date.now() - (await lastFollowupTs(psid)) < REFOLLOW_MS) continue;

    // If the newest page message isn't in the bot's outbound ledger, a human
    // (Sonny from Business Suite, or a ManyChat automation) sent it — their
    // conversation, their follow-up. Never nudge over the owner.
    const ledger = await listSentHashes(psid);
    const newestPageText = String(newest.message || "").trim();
    if (!newestPageText || !ledger.has(sentHash(newestPageText))) {
      results.push({ name, action: "skip: owner/non-bot spoke last" });
      continue;
    }

    // Value gate — some deals aren't worth chasing.
    const transcript = [...msgs]
      .reverse()
      .map((m) => `${m.from?.id === psid ? "CUSTOMER" : "PAGE"}: ${String(m.message || "(photo)").slice(0, 300)}`)
      .join("\n");
    const verdict = await judgeThread(transcript);
    if (!verdict.worth) {
      await markFollowup(psid); // judged once — don't re-run Haiku on this thread every hour
      results.push({ name, action: `skip: not worth it (${verdict.device || "?"})` });
      continue;
    }

    const line = followupLine(verdict, psid);
    const sent = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message: { text: line } }),
    });
    if (!sent.ok) {
      console.error("[msgr-followup] send failed", sent.status, (await sent.text().catch(() => "")).slice(0, 300));
      results.push({ name, action: "send failed" });
      continue;
    }
    await recordOutbound(psid, [line]); // ledger — so takeover detection knows this was the bot
    await markFollowup(psid);
    sends++;
    results.push({ name, action: `nudged (${verdict.device || "device"}): "${line}"` });
  }

  return NextResponse.json({ ok: true, sends, results });
}
