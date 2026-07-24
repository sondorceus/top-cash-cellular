// TCC Messenger bot — Meta Messenger Send API RENDERER (the OWNED transport).
//
// This is Track 2: a direct Meta Messenger webhook that reuses the SAME brain
// as the ManyChat pipe (app/lib/msgr-brain.ts). Once the Meta App has
// `pages_messaging` Advanced Access (App Review) and the ad points here,
// ManyChat can be cancelled — the conversation is identical because both share
// the brain. Until then this coexists harmlessly (ManyChat drives the live ad).
//
//   GET  /api/messenger   → webhook verification (hub.challenge)
//   POST /api/messenger   → message/postback events → brain → Send API reply
//
// Env:
//   MESSENGER_VERIFY_TOKEN  — arbitrary token you also enter in the Meta webhook UI
//   PAGE_ACCESS_TOKEN       — Page token from the Meta App (send messages)
//   MESSENGER_APP_SECRET    — App Secret; when set, X-Hub-Signature-256 is verified
//   MSGR_NOTIFY_URL         — optional: POSTed a JSON blip on handoff / hot lead
//
// Docs: https://developers.facebook.com/docs/messenger-platform

import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { put, list, del } from "@vercel/blob";
import { advance, type BotReply, type ConvoState } from "../../lib/msgr-brain";
import { recordOutbound, markDefer as markDeferShared, deferActive as deferActiveShared, DEFER_MS as DEFER_MS_SHARED } from "../../lib/msgr-signals";

export const dynamic = "force-dynamic";
// Human-pace delay (up to ~2 min) + AI rounds happen in after(); keep the
// function alive through the longest per-sender wait (senders run concurrently).
export const maxDuration = 300;

const GRAPH = "https://graph.facebook.com/v21.0/me/messages";
// Meta caps quick-reply and button titles at 20 chars.
const clip = (s: string, n = 20) => (Array.from(s).length > n ? Array.from(s).slice(0, n).join("") : s);

// ---- webhook verification (GET) -------------------------------------------
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  // Maintenance (secret-gated): re-subscribe app + page with message_echoes so
  // the webhook sees PAGE-sent messages — that's how human takeover is detected
  // (a human reply makes the bot stand down instead of talking over the human).
  // Same MSGR_BOT_SECRET-or-CRON_SECRET rule as the inbox peek below — only
  // CRON_SECRET survives `vercel env pull`, and the webhook-subscription lapse
  // of Jul 2026 sat unrepaired partly because nobody could call this.
  const adminSecretOk =
    (!!process.env.MSGR_BOT_SECRET && p.get("s") === process.env.MSGR_BOT_SECRET) ||
    (!!process.env.CRON_SECRET && p.get("s") === process.env.CRON_SECRET);
  if (p.get("admin") === "resubscribe" && adminSecretOk) {
    const fields = "messages,messaging_postbacks,message_echoes";
    const appId = process.env.MESSENGER_APP_ID || "4405612649655084";
    const appToken = `${appId}|${process.env.MESSENGER_APP_SECRET}`;
    const pageToken = process.env.PAGE_ACCESS_TOKEN || "";
    const cb = `${req.nextUrl.origin}/api/messenger`;
    const appRes = await fetch(
      `https://graph.facebook.com/v21.0/${appId}/subscriptions?object=page&callback_url=${encodeURIComponent(cb)}&fields=${encodeURIComponent(fields)}&verify_token=${encodeURIComponent(process.env.MESSENGER_VERIFY_TOKEN || "")}&access_token=${encodeURIComponent(appToken)}`,
      { method: "POST" },
    ).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    const pageRes = await fetch(
      `https://graph.facebook.com/v21.0/me/subscribed_apps?subscribed_fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageToken)}`,
      { method: "POST" },
    ).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    const now = await fetch(`https://graph.facebook.com/v21.0/me/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`)
      .then((r) => r.json()).catch((e) => ({ error: String(e) }));
    return NextResponse.json({ app: appRes, page: pageRes, now });
  }

  // Inbox peek (secret-gated, read-only): the page's real Messenger threads
  // straight from Graph — ground truth for "did they even send a chat?" when
  // ManyChat forwarding is in doubt. PAGE_ACCESS_TOKEN is sensitive/write-only
  // in Vercel, so this is the only way to use it: server-side.
  // Accepts MSGR_BOT_SECRET or CRON_SECRET: both are server-tier secrets, but
  // only CRON_SECRET survives `vercel env pull` (MSGR_BOT_SECRET is sensitive/
  // write-only) — without this, nobody can operate the read-only inbox peek.
  const inboxSecretOk =
    (!!process.env.MSGR_BOT_SECRET && p.get("s") === process.env.MSGR_BOT_SECRET) ||
    (!!process.env.CRON_SECRET && p.get("s") === process.env.CRON_SECRET);
  if (p.get("admin") === "inbox" && inboxSecretOk) {
    const pageToken = process.env.PAGE_ACCESS_TOKEN || "";
    const limit = Math.min(25, Math.max(1, Number(p.get("n") || 8)));
    // m = messages per conversation (default 8, up to 100 for full-thread review)
    const depth = Math.min(100, Math.max(1, Number(p.get("m") || 8)));
    // u = filter to one user's thread by PSID — same user_id lookup the AI
    // brain's threadFromGraph awareness merge relies on.
    const user = (p.get("u") || "").trim();
    const userQ = /^\d{3,20}$/.test(user) ? `user_id=${user}&` : "";
    const r = await fetch(
      `https://graph.facebook.com/v21.0/me/conversations?${userQ}fields=updated_time,participants,messages.limit(${depth}){message,from,created_time}&limit=${limit}&access_token=${encodeURIComponent(pageToken)}`,
      { cache: "no-store" },
    ).then((x) => x.json()).catch((e) => ({ error: String(e) }));
    return NextResponse.json(r);
  }

  // Conversations overview (secret-gated): compact per-customer view — name,
  // PSID, last message, mute/standdown state. This is what Mission Control's
  // Messenger panel renders; the mute buttons + Theot's "pause chat with X"
  // resolve names against it.
  if (p.get("admin") === "convos" && inboxSecretOk) {
    const pageToken = process.env.PAGE_ACCESS_TOKEN || "";
    const limit = Math.min(25, Math.max(1, Number(p.get("n") || 12)));
    const meId = await fetch(`https://graph.facebook.com/v21.0/me?fields=id&access_token=${encodeURIComponent(pageToken)}`, { cache: "no-store" })
      .then((x) => x.json()).then((j) => String(j?.id || "")).catch(() => "");
    const r = (await fetch(
      `https://graph.facebook.com/v21.0/me/conversations?fields=updated_time,participants,messages.limit(3){message,from,created_time}&limit=${limit}&access_token=${encodeURIComponent(pageToken)}`,
      { cache: "no-store" },
    ).then((x) => x.json()).catch((e) => ({ error: String(e) }))) as {
      error?: unknown;
      data?: { id?: string; updated_time?: string; participants?: { data?: { id?: string; name?: string }[] }; messages?: { data?: { message?: string; from?: { id?: string }; created_time?: string }[] } }[];
    };
    if (r.error || !Array.isArray(r.data)) return NextResponse.json({ ok: false, error: r.error || "no data" }, { status: 502 });
    const convos = await Promise.all(
      r.data.map(async (c) => {
        const other = (c.participants?.data || []).find((pp) => pp.id && pp.id !== meId) || {};
        const psid = String(other.id || "");
        const last = (c.messages?.data || []).find((m) => (m.message || "").trim()) || {};
        const [muted, deferred] = psid ? await Promise.all([isMuted(psid), deferActive(psid)]) : [false, false];
        return {
          id: c.id || "",
          psid,
          name: String((other as { name?: string }).name || ""),
          updated: c.updated_time || "",
          lastMsg: String((last as { message?: string }).message || "").slice(0, 140),
          lastFrom: (last as { from?: { id?: string } }).from?.id === psid ? "customer" : "page",
          muted,
          deferred,
        };
      }),
    );
    return NextResponse.json({ ok: true, convos });
  }

  // Mute / unmute by PSID (secret-gated, server-to-server): writes the same
  // msgr-mute/{psid}/{ts13}-{hours} marker the email take-over link mints —
  // newest wins, h=0 unmutes. Mission Control's buttons + comms commands land here.
  if (p.get("admin") === "mute" && inboxSecretOk) {
    const u = (p.get("u") || "").trim();
    if (!/^\d{3,20}$/.test(u)) return NextResponse.json({ ok: false, error: "bad psid" }, { status: 400 });
    const h = Math.min(999, Math.max(0, Math.round(Number(p.get("h") ?? 24)) || 0));
    await put(`msgr-mute/${u}/${String(Date.now()).padStart(13, "0")}-${h}`, ".", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
    return NextResponse.json({ ok: true, psid: u, muted: h > 0, hours: h });
  }

  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.MESSENGER_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// ---- signature check ------------------------------------------------------
function signatureOk(raw: string, header: string | null): boolean {
  const secret = process.env.MESSENGER_APP_SECRET;
  if (!secret) return true; // not configured → skip (dev/pre-review)
  if (!header?.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ---- Send API render + send -----------------------------------------------
// One Send-API POST with a single retry + error logging. Every outbound used
// to be fetch().catch(() => {}) — a transient Graph failure dropped the reply
// with zero trace (the likeliest shape of the 2026-07-10 silent-drop lead).
async function graphPost(token: string, payload: Record<string, unknown>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${GRAPH}?access_token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) return true;
      console.error("[messenger] send failed", r.status, (await r.text().catch(() => "")).slice(0, 300));
    } catch (e) {
      console.error("[messenger] send threw", (e as Error).message);
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  return false;
}

// Turn a BotReply into Meta message payloads and send them in order.
async function send(recipientId: string, reply: BotReply, token: string) {
  // Outbound ledger — lets the AI brain tell its own page messages from the
  // owner's Business-Suite replies when it reads the thread via Graph.
  recordOutbound(recipientId, reply.texts).catch(() => {});
  const quickReplies = reply.quickReplies.map((qr) => ({
    content_type: "text",
    title: clip(qr.caption),
    payload: JSON.stringify(qr.state),
  }));

  const payloads: Record<string, unknown>[] = [];
  reply.texts.forEach((text, i) => {
    const isLast = i === reply.texts.length - 1;
    if (isLast && reply.urlButtons?.length) {
      // Last message becomes a button template carrying the CTA URL button(s)...
      payloads.push({
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text,
            buttons: reply.urlButtons.map((b) => ({ type: "web_url", title: clip(b.caption), url: b.url })),
          },
        },
        ...(quickReplies.length ? { quick_replies: quickReplies } : {}),
      });
    } else if (isLast && quickReplies.length) {
      payloads.push({ text, quick_replies: quickReplies });
    } else {
      payloads.push({ text });
    }
  });

  for (const message of payloads) {
    await graphPost(token, { recipient: { id: recipientId }, messaging_type: "RESPONSE", message });
  }
}

// Fire-and-forget lead alert (handoff / hot offer) to an optional webhook.
function notify(kind: string, recipientId: string, reply: BotReply) {
  const url = process.env.MSGR_NOTIFY_URL;
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, recipientId, handoff: reply.handoff, offer: reply.offer, at: new Date().toISOString() }),
  }).catch(() => {});
}

// Decode the ConvoState a user's tap/typed message carries.
function stateFrom(event: Record<string, any>): ConvoState {
  const qrPayload = event?.message?.quick_reply?.payload;
  const pbPayload = event?.postback?.payload;
  const raw = qrPayload ?? pbPayload;
  if (raw && raw !== "GET_STARTED") {
    try {
      const s = JSON.parse(raw);
      if (s && typeof s.step === "string") return s as ConvoState;
    } catch {
      /* not JSON → fall through to a fresh start */
    }
  }
  return { step: "start" };
}

// ---- conversational AI brain (typed messages) -----------------------------
// A single plain-text Send-API message.
async function sendText(recipientId: string, text: string, token: string) {
  await graphPost(token, { recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { text } });
}

// Per-user conversation memory: the AI brain's compact base64 transcript, stored
// in Vercel Blob keyed by PSID so the bot remembers the device/quote across
// messages. Public blob w/ unguessable store URL (same pattern as the FedEx
// labels) — fine for launch; migrate to private blob when hardening.
//
// UNIQUE ts-prefixed pathnames, newest wins — NOT a fixed-path overwrite. A
// fixed path is CDN-stale for ~60s after a write, and with the ~30s human-paced
// reply delay a quick customer answer reads the PREVIOUS turn's memory: the bot
// re-asks what was just answered (live failure 2026-07-05: "wanna lock it in?"
// → "Yes" → bot restated the offer and asked again → "I said yes fuck").
async function loadCtx(psid: string): Promise<string> {
  try {
    const { blobs } = await list({ prefix: `msgr-ctx/${psid}/`, limit: 100 });
    const entries = blobs
      .map((b) => ({ ts: Number(b.pathname.match(/\/(\d{13})\.txt$/)?.[1] || 0), url: b.url }))
      .filter((x) => x.ts)
      .sort((a, b) => b.ts - a.ts);
    if (entries.length) {
      // Sweep all but the newest 3 so the ts-sorted (oldest-first) listing never
      // pushes the newest entry out of the 100-item window.
      const old = entries.slice(3).map((x) => x.url);
      if (old.length) del(old).catch(() => {});
      const r = await fetch(entries[0].url, { cache: "no-store" });
      if (r.ok) return await r.text();
    }
    // Legacy fixed-path blob (pre unique-pathname migration) — read-only fallback.
    const legacy = await list({ prefix: `msgr-ctx/${psid}.txt`, limit: 1 });
    if (!legacy.blobs.length) return "";
    const r = await fetch(legacy.blobs[0].url, { cache: "no-store" });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}
async function saveCtx(psid: string, ctx: string) {
  try {
    await put(`msgr-ctx/${psid}/${String(Date.now()).padStart(13, "0")}.txt`, ctx, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
  } catch {
    /* best-effort memory */
  }
}

// Human pacing: a real person doesn't answer in 2 seconds (customers literally
// called it out — "how are you replying so damn fast"). Each typed message waits
// before the reply: quiet pause, then a typing bubble. The newest-message marker
// makes bursts collapse — if the user says more during the wait, the stale reply
// is dropped and only the final message gets answered.
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Total pre-reply delay, varied so answers never feel metronomic: usually ~45s,
// sometimes a minute, occasionally ~2 min — like someone who's mid-something.
// (The last ~10s of this is the typing bubble.)
function replyDelayMs(): number {
  const r = Math.random();
  if (r < 0.65) return 40_000 + Math.random() * 12_000; // ~40–52s  — most replies
  if (r < 0.88) return 55_000 + Math.random() * 20_000; // ~55–75s  — about a minute
  return 100_000 + Math.random() * 35_000; //               ~100–135s — occasionally ~2 min
}

async function typingOn(recipientId: string, token: string) {
  await fetch(`${GRAPH}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, sender_action: "typing_on" }),
  }).catch(() => {});
}

// Unique-pathname markers, newest wins. Overwriting one fixed blob pathname is
// NOT safe here — Vercel Blob overwrites take up to ~60s to propagate through
// the CDN, so a same-path re-read seconds later can return the stale copy.
function midHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}
async function markLatest(psid: string, mid: string) {
  try {
    await put(`msgr-latest/${psid}/${String(Date.now()).padStart(13, "0")}-${midHash(mid)}`, ".", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
  } catch {
    /* best-effort */
  }
}
// Human-takeover / other-sender standdown: any PAGE-sent message that did NOT
// come from this app (Sonny replying from the ManyChat inbox or Business Suite,
// or a ManyChat automation) writes a defer marker; the AI stays silent for that
// customer for DEFER_MS afterwards. The bot can't see the human's words (they
// never enter its memory), so "be smart around the human" is impossible — the
// smart behavior is to stand down and resume once the human stops (or the
// conversation is closed and the customer writes again after the window).
// Shared with the AI brain via lib/msgr-signals — one defer marker system.
const DEFER_MS = DEFER_MS_SHARED;
const markDefer = markDeferShared;
const deferActive = deferActiveShared;

// Owner mute (the takeover link in the lead alert → /api/msgr-ai?mute=): the
// bot goes fully silent for that contact until the mute window expires. The link
// writes msgr-mute/{psid}/{ts13}-{hours}; newest wins, hours=0 unmutes. The
// owned webhook MUST read it here — otherwise the alert page says "Bot muted"
// while this path keeps replying: the msgr-ai brain's own mute guards are gated
// on a psid, and aiReply() calls the brain without one, so they never fire.
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
    return false; // fail open — better an extra reply than a silent bot on infra errors
  }
}

// True when `mid` is still the newest message this user has sent. Also sweeps
// markers older than 10 min so the ts-sorted (oldest-first) listing never
// pushes the newest entries out of the window.
async function latestIs(psid: string, mid: string): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: `msgr-latest/${psid}/`, limit: 100 });
    const parsed = blobs
      .map((b) => ({ m: b.pathname.match(/\/(\d{13})-([0-9a-f]{8})$/), url: b.url }))
      .filter((x) => x.m) as { m: RegExpMatchArray; url: string }[];
    if (!parsed.length) return true;
    const old = parsed.filter((x) => Date.now() - Number(x.m[1]) > 600_000).map((x) => x.url);
    if (old.length) del(old).catch(() => {});
    const newest = parsed.reduce((a, b) => (Number(b.m[1]) >= Number(a.m[1]) ? b : a));
    return newest.m[2] === midHash(mid);
  } catch {
    return true; // fail open: better a possible duplicate than a silent bot
  }
}

// Route a typed message to the SAME conversational AI the ManyChat pipe uses
// (/api/msgr-ai) — with per-user memory — then Send-API each reply line. This is
// the continuous back-and-forth ManyChat's one-shot Default Reply couldn't do.
async function aiReply(origin: string, senderId: string, text: string, token: string, images: string[] = []) {
  type BrainOut = {
    content?: { messages?: { text?: string }[]; quick_replies?: { caption?: string; payload?: { state?: unknown } }[] };
    ctx?: string;
  };
  const secret = process.env.MSGR_BOT_SECRET || "";
  const ctx = await loadCtx(senderId);
  let out: BrainOut | null = null;
  try {
    const r = await fetch(`${origin}/api/msgr-ai?s=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // deep: blob-backed memory has no ManyChat field-size limit — the brain
      // keeps a longer transcript window (device/quote stay in view all convo).
      // psid: lets the brain read the REAL thread, and — critically — joins the
      // shared burst-dedupe markers, so this path and ManyChat (which BOTH get
      // every message while the two transports coexist) stop double-replying
      // to the same customer text (live doubles on 2026-07-09, one saying
      // "disc PS4" right after the other heard "digital").
      // images: photo attachment URLs — the brain looks at them.
      body: JSON.stringify({ text, ctx, deep: true, psid: senderId, images }),
    });
    out = (await r.json()) as BrainOut;
  } catch {
    return;
  }
  const texts = (out?.content?.messages ?? []).map((m) => m?.text).filter(Boolean) as string[];
  // The brain can answer with a FUNNEL step (menu/model picker) whose buttons
  // ride as ManyChat-style quick replies carrying ConvoState payloads. Convert
  // them to native Messenger quick replies on the last message — the tap comes
  // back as message.quick_reply.payload, which stateFrom() already parses.
  const qrs = (out?.content?.quick_replies ?? [])
    .filter((q) => q && q.caption)
    .slice(0, 13)
    .map((q) => ({
      content_type: "text",
      title: String(q.caption).slice(0, 20),
      payload: JSON.stringify((q.payload && q.payload.state) || { step: "start" }),
    }));
  for (let i = 0; i < texts.length; i++) {
    const isLast = i === texts.length - 1;
    if (isLast && qrs.length) {
      await graphPost(token, { recipient: { id: senderId }, messaging_type: "RESPONSE", message: { text: texts[i], quick_replies: qrs } });
    } else {
      await sendText(senderId, texts[i], token);
    }
  }
  if (out?.ctx) await saveCtx(senderId, out.ctx);
}

// ---- events (POST) --------------------------------------------------------
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!signatureOk(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("bad signature", { status: 403 });
  }

  const token = process.env.PAGE_ACCESS_TOKEN;
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  if (data?.object !== "page") return new NextResponse("ok", { status: 200 });

  const origin = req.nextUrl.origin;
  // Meta demands a fast 200 (it retries + disables slow webhooks). The AI brain
  // takes a few seconds, so ACK immediately and do all the work in after().
  after(async () => {
    // Pass 1: taps answer instantly (menus must be snappy); typed messages are
    // collected last-one-wins per sender and their newest-marker is written NOW,
    // so any earlier in-flight delayed reply for this sender knows it's stale.
    // Photo attachments ride along (merged across events in this delivery) so
    // the brain can LOOK at them — attachment-only messages used to be dropped
    // on the floor here (live: device pics ignored outright, 2026-07-09/10).
    const typedBySender = new Map<string, { text: string; mid: string; images: string[] }>();
    for (const entry of data.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event?.sender?.id;
        if (event.message?.is_echo) {
          // A message the PAGE sent. Ours carry our app_id; anything else means a
          // human (ManyChat inbox / Business Suite) or ManyChat's automation is
          // talking to this customer → the AI stands down for DEFER_MS.
          const echoApp = String(event.message.app_id ?? "");
          const customer = event?.recipient?.id;
          if (customer && echoApp !== (process.env.MESSENGER_APP_ID || "4405612649655084")) {
            await markDefer(customer);
          }
          continue;
        }
        if (!senderId) continue;
        if (!event.message && !event.postback) continue;
        if (!token) continue;

        // A quick-reply / button TAP carries a ConvoState payload → deterministic
        // funnel brain (lock-in, team handoff, sell menu).
        const tapPayload = event?.message?.quick_reply?.payload ?? event?.postback?.payload;
        if (tapPayload && tapPayload !== "GET_STARTED") {
          if (await isMuted(senderId)) continue; // owner took over — don't talk over him
          const reply = await advance(stateFrom(event), origin);
          if (reply.handoff) notify(reply.handoff.bulk ? "bulk" : "handoff", senderId, reply);
          else if (reply.offer?.hot) notify("hot_lead", senderId, reply);
          await send(senderId, reply, token);
          continue;
        }

        // Free-typed text and/or photos → conversational AI brain.
        const typed = typeof event?.message?.text === "string" ? event.message.text.trim() : "";
        const imgs = (Array.isArray(event?.message?.attachments) ? event.message.attachments : [])
          .filter((a: any) => a?.type === "image" && typeof a?.payload?.url === "string")
          .map((a: any) => String(a.payload.url));
        if (typed || imgs.length) {
          const mid = String(event?.message?.mid || typed || imgs[0]).slice(0, 120);
          const prev = typedBySender.get(senderId);
          typedBySender.set(senderId, {
            // Text wins over a photo-only placeholder; photos accumulate across
            // the delivery so "two pics then the question" answers as one turn.
            text: typed || prev?.text || "",
            mid,
            images: [...(prev?.images || []), ...imgs].slice(0, 4),
          });
          await markLatest(senderId, mid);
        }
      }
    }

    // Pass 2: human-paced AI replies — ~20s quiet, ~10s typing bubble, then send.
    // If the user said something newer during the wait, drop this one (the newer
    // webhook delivery owns the reply).
    // Each sender waits independently (concurrently) so one contact's ~2 min
    // delay never eats another's — and a multi-sender burst can't run the 300s
    // function budget dry the way sequential long delays would.
    await Promise.all(
      [...typedBySender].map(async ([senderId, { text, mid, images }]) => {
        if (await isMuted(senderId)) return; // owner muted this convo via the takeover link
        if (await deferActive(senderId)) return; // a human/other sender owns this convo
        const total = replyDelayMs();
        await sleep(Math.max(0, total - 10_000)); // quiet pause...
        await typingOn(senderId, token as string);
        await sleep(10_000); // ...then a ~10s typing bubble
        if (!(await latestIs(senderId, mid))) return;
        if (await isMuted(senderId)) return; // owner tapped mute during the reply delay
        if (await deferActive(senderId)) return; // human jumped in during the wait
        await aiReply(origin, senderId, text, token as string, images);
      }),
    );
  });

  return new NextResponse("ok", { status: 200 });
}
