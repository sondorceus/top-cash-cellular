// Photo upload for the /go chat — the seller taps the camera button and the
// picture lands in the thread, the admin console, and Theot's eyes (the chat
// route feeds it to the model as a vision block, so condition talk can be
// about what's actually visible).
//
// The photo is stored as its own blob under gochat-img/<sid>/<ts>-<rand>.<ext>
// (UNIQUE path — same-path overwrites go CDN-stale for ~60s, nothing here is
// ever overwritten), then recorded in the chat store as a user message with
// the text convention `IMG::<url>`. Every renderer (go client, admin console)
// and the chat route key on that prefix.
//
// Public endpoint, so the gates mirror chat-sync: session ids only the /go
// client can mint, per-IP rate limits, a hard size cap (the client downscales
// to ~1600px JPEG before upload — Vercel cuts request bodies at ~4.5MB, the
// same ceiling that broke the notary scan uploads), an image-type allowlist,
// and MAGIC-BYTE sniffing so an HTML file with an image content-type can't
// become a stored-XSS blob on our store domain.
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { put, list } from "@vercel/blob";
import { appendChatMsg, validGoSession } from "../../../lib/gochat-store";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { notifyOwnerSms } from "../../../lib/owner-sms";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's body ceiling is ~4.5MB; stay under it
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// First bytes must match the claimed type — content-type alone is attacker-
// controlled. JPEG: FF D8 FF · PNG: 89 50 4E 47 · WEBP: "RIFF"...."WEBP".
function sniffOk(type: string, b: Uint8Array): boolean {
  if (b.length < 12) return false;
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === "image/webp") return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return false;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // 40 photos / 10 min per IP covers a real lot seller (the ad literally says
  // "i got 15 phones"; multi-pick sends up to 6/batch, one photo per phone)
  // and still stops a scripted flood of 4MB bodies.
  if (!rateLimit(`goupload:${ip}`, 40, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "slow down a sec" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad upload" }, { status: 400 });
  }
  const sid = String(form.get("session") || "");
  const file = form.get("file");
  if (!validGoSession(sid) || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "bad upload" }, { status: 400 });
  }
  const type = (file.type || "").toLowerCase();
  const ext = EXT[type];
  if (!ext) return NextResponse.json({ ok: false, error: "photos only (jpg/png/webp)" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "photo too large" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffOk(type, bytes)) {
    return NextResponse.json({ ok: false, error: "that file isn't a photo" }, { status: 400 });
  }

  // First photo for this session? One cheap prefix list BEFORE storing — used
  // below to ping the owner exactly once per session, off a fact in storage
  // rather than anything the client claims.
  let firstPhoto = false;
  try {
    const existing = await list({ prefix: `gochat-img/${sid}/`, limit: 1 });
    firstPhoto = existing.blobs.length === 0;
  } catch { /* ping is best-effort */ }

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  let url: string;
  try {
    const blob = await put(`gochat-img/${sid}/${ts}-${rand}.${ext}`, Buffer.from(bytes), {
      access: "public",
      contentType: type,
      addRandomSuffix: false,
    });
    url = blob.url;
  } catch {
    return NextResponse.json({ ok: false, error: "upload didn't stick — try again" }, { status: 502 });
  }

  // Into the thread (store slices at 2000 chars; blob URLs are ~100).
  await appendChatMsg(sid, "user", `IMG::${url}`);

  // A seller photographing their device is a high-intent moment — surface the
  // first one per session to MC + the owner's phone (same global SMS backstop
  // the chat route uses, so a photo spree can't bomb the phone).
  if (firstPhoto) {
    // Photo pings ride their OWN global bucket, not the shared chat-sms:global
    // one — a photo flood must never starve real [CHAT LEAD]/handoff owner
    // SMS (and vice versa).
    const smsOk = rateLimit(`goupload-sms:${ip}`, 2, 15 * 60_000).ok
      && rateLimit("goupload-sms:global", 20, 10 * 60_000).ok;
    const link = `https://topcashcellular.com/admin/chats?session=${sid}`;
    after(async () => {
      try {
        await fetch(`${MC_API}/api/comms`, {
          method: "POST",
          headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "topcash-web",
            fromName: "Top Cash Cellular Chat",
            role: "system",
            body: `[CHAT PHOTO] sess:${sid} · seller sent a photo of their device\n${url}\ntake over: ${link}`,
            tags: ["chat-lead", "chat-photo", `sess-${sid}`],
            priority: "high",
          }),
        });
      } catch { /* silent */ }
      if (smsOk) await notifyOwnerSms(`📸 TopCash chat: seller sent a device photo.\n${url}\nTake over: ${link}`);
    });
  }

  return NextResponse.json({ ok: true, url });
}
