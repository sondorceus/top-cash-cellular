// Pings the business owner for real-time, high-signal events (hot leads,
// delivery choices, takeover links). Best-effort by design: never throws, so
// a notification failure can't break the request that triggered it.
//
// DELIVERY: email via Resend is the PRIMARY channel (Sonny: "i dont have
// twilo" — 2026-07-05). The Twilio attempt stays as a harmless best-effort
// extra: it silently no-ops if the account is dead and starts working again
// if it's ever revived. The exported name keeps its historical "Sms" for the
// ~dozen call sites.
import { mailShell, esc, MAIL } from "./email-shell";
import { sendSellerSms } from "./seller-sms";
import { contactedLink } from "./lead-token";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";
// Per-channel ceiling. notifyOwnerSms waits for all three channels, so one
// hanging provider used to hold every caller (the /go lock route bounds its
// alert at 12s and then reports failure even though a text went out).
const CHANNEL_TIMEOUT_MS = 8_000;

async function sendSms(body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: OWNER_PHONE, From: TWILIO_FROM, Body: body.slice(0, 1500) }),
      signal: AbortSignal.timeout(CHANNEL_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Public host of OUR Vercel Blob store (device photos, labels). The store id
// is the 4th `_` segment of the read-write token — the same parse
// @vercel/blob does internally. null when no token is configured.
export function ownBlobStoreHost(): string | null {
  const [, , , storeId = ""] = (process.env.BLOB_READ_WRITE_TOKEN || "").split("_");
  return /^[a-z0-9]+$/i.test(storeId) ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
}

// Only OUR links may become the big "Open link" button. It used to be the
// first URL anywhere in the body, and callers put customer text (a chat
// snippet, a lead's name) ABOVE the real link — so a visitor could make a
// TCC Alerts email's button point at a phishing page, and a `"` inside the
// old \S+ match broke out of the unescaped href. The match below can't hold
// quotes or angle brackets, and the host must be topcashcellular.com or our
// own blob store.
function isTrustedAlertUrl(u: string): boolean {
  try {
    const host = new URL(u).hostname.toLowerCase();
    return host === "topcashcellular.com" || host === "www.topcashcellular.com" || host === ownBlobStoreHost();
  } catch {
    return false;
  }
}

// Email alert via Resend — the channel that actually reaches Sonny. The first
// trusted URL in the message (the 🤫 takeover/mute link when present) becomes
// a real button; the rest renders as the alert text.
async function sendEmailAlert(body: string, leadId?: string): Promise<boolean> {
  const to = process.env.OWNER_EMAIL || "";
  const key = process.env.RESEND_API_KEY || "";
  if (!to || !key) return false;
  try {
    const url = (body.match(/https:\/\/[^\s"'<>]+/g) || []).find(isTrustedAlertUrl) || null;
    const isMute = !!url && url.includes("mute=");
    // ONE-TAP REPLY (Sonny 2026-09-12: "auto reply for the message on emails
    // so when I click it I can quickly message"): the seller's phone / email
    // in the alert become Text / Call / Email buttons with a prefilled
    // opener, and a session link becomes "Open chat". Phone = a real 10-digit
    // US number, never a run of digits inside an IMEI or tracking number.
    const phoneM = body.match(/(?<!\d)(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/);
    const sellerPhone = phoneM ? `${phoneM[1]}${phoneM[2]}${phoneM[3]}` : "";
    const sellerEmail = body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const consoleUrl = body.match(/https:\/\/topcashcellular\.com\/admin\/chats\?session=[A-Za-z0-9_-]+/)?.[0] || "";
    // The device, from the alert's own first line ("GO lock: iPhone 17 Pro 256
    // good unlocked — $560", "GO seller shipping: …", "TopCash chat: …").
    const firstLine = body.split("\n")[0];
    // A shop claim ("SHOP SALE PENDING: <name> wants the <device> (<grade>)
    // for $…", shop/buy) is a BUYER — the replies must not open with "the
    // device you quoted with us" under a "Your … offer" subject.
    const isShopClaim = /^SHOP SALE PENDING\b/.test(firstLine);
    const rawDevice = isShopClaim
      ? firstLine.match(/^SHOP SALE PENDING:.* wants the (.+?) \([^()]*\) for \$/)?.[1]?.replace(/\s*·\s*/g, " ")
      : firstLine.match(/(?:lock|shipping|chat(?: LOT)?|label FAILED for|DELIVERY):\s*(.+?)(?:\s+[—–-]\s+\$?\d|\s+\$\d|$)/)?.[1];
    const device = (rawDevice || "").replace(/[^\w .+&/-]/g, "").trim().slice(0, 50);
    const opener = encodeURIComponent(isShopClaim
      ? `Hi, this is Top Cash Cellular about the ${device || "device"} you reserved in our shop — `
      : `Hi, this is Top Cash Cellular about ${device ? `your ${device}` : "the device you quoted with us"} — `);
    const who = isShopClaim ? "buyer" : "seller";
    const mailSubject = isShopClaim ? "Your Top Cash Cellular shop reservation" : "Your Top Cash Cellular offer";
    // "I reached out" in one tap (2026-09-23 review: 26 leads, one status
    // flip): a signed GET that writes a [LEAD-CONTACTED] marker on MC, so the
    // watchdog stops nagging about this lead. Only alerts that carry the
    // lead's MC id (lock, chat lead, email fallback) get the pill.
    const contactedUrl = leadId ? contactedLink(leadId) : null;
    const pill = (href: string, label: string) => `<a href="${href}" style="display:inline-block;margin:4px 6px 0 0;padding:9px 14px;border-radius:999px;background:#1a1a1a;border:1px solid #2a2a2a;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;">${label}</a>`;
    const actions = [
      sellerPhone && sellerPhone !== OWNER_PHONE.replace(/\D/g, "").slice(-10) ? pill(`sms:+1${sellerPhone}?&body=${opener}`, `💬 Text the ${who}`) : "",
      sellerPhone && sellerPhone !== OWNER_PHONE.replace(/\D/g, "").slice(-10) ? pill(`tel:+1${sellerPhone}`, "📞 Call") : "",
      sellerEmail && !/topcashcellular\.com$/i.test(sellerEmail) ? pill(`mailto:${sellerEmail}?subject=${encodeURIComponent(mailSubject)}&body=${opener}`, `✉️ Email the ${who}`) : "",
      consoleUrl && consoleUrl !== url ? pill(consoleUrl, "Open the chat") : "",
      contactedUrl ? pill(contactedUrl, "✅ Mark contacted") : "",
    ].filter(Boolean).join("");
    const actionsHtml = actions
      ? `<div style="text-align:center;margin-top:14px;">${actions}</div>` +
        (contactedUrl ? `<div style="color:${MAIL.muted};font-size:12px;text-align:center;margin-top:8px;">Mark contacted = you reached out, so the watchdog stops nagging. It doesn't change the lead's status.</div>` : "")
      : "";
    const noUrl = url ? body.replace(url, "") : body;
    // Multi-line alerts render organized: line 1 = subject + title, every
    // other line its own row. The 🤫 link-label line is dropped — the button
    // carries it. Single-line callers keep the legacy flow untouched.
    const lines = noUrl
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l && !/^🤫/.test(l));
    const multiline = lines.length > 1;
    const textOnly = multiline ? lines[0] : noUrl.replace(/\s+/g, " ").trim();
    // Subject = the meat of the alert, minus link labels.
    const subject = textOnly.replace(/🤫.*$/,"").trim().slice(0, 90) || "TCC alert";
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    // The Resend SDK takes no abort signal — race it against the ceiling (a
    // late send may still land; it just stops holding the caller).
    const send = resend.emails.send({
      from: "TCC Alerts <noreply@topcashcellular.com>",
      to,
      subject,
      html: mailShell({
        preheader: textOnly.slice(0, 120),
        eyebrow: "Lead alert",
        eyebrowColor: MAIL.yellow,
        title: esc(textOnly.slice(0, 140)),
        titleSize: 17,
        introHtml: multiline
          ? `<span style="color:${MAIL.body}">${lines.slice(1).map(esc).join("<br>")}</span>`
          : textOnly.length > 140
            ? `<span style="color:${MAIL.body}">${esc(textOnly.slice(140))}</span>`
            : undefined,
        buttonHref: url,
        buttonLabel: url ? (isMute ? "🤫 Take over — mute bot 24h" : "Open link") : undefined,
        afterButtonHtml: (isMute
          ? `<div style="color:${MAIL.muted};font-size:12px;text-align:center;">One tap mutes the bot for this customer so you can reply from anywhere. The page has a hand-back button.</div>`
          : "") + actionsHtml || undefined,
      }),
      text: body,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const r = await Promise.race([
      send,
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), CHANNEL_TIMEOUT_MS); }),
    ]).finally(() => clearTimeout(timer));
    return !!r && !r.error;
  } catch {
    return false;
  }
}

// Third channel (2026-09-11): the same Telnyx relay that texts sellers also
// texts the OWNER. Email alone lost a $780 lead ("took too long to follow
// up") — a lock, a chat contact, a photo, or a takeover-ready ping now lands
// on Sonny's phone as a text, not just in an inbox. The first URL in the
// body stays inline as a tappable link.
async function sendRelaySms(body: string): Promise<boolean> {
  return sendSellerSms(OWNER_PHONE, body.replace(/[ \t]+/g, " ").trim().slice(0, 460));
}

// opts.skipEmail: the caller already put this news in the owner's inbox (the
// watchdog mails its digest first) — text channels only, so one run is one
// e-mail rather than two carrying the same alert.
export async function notifyOwnerSms(body: string, opts?: { leadId?: string; skipEmail?: boolean }): Promise<boolean> {
  const [sms, mail, relay] = await Promise.allSettled([
    sendSms(body),
    opts?.skipEmail ? Promise.resolve(false) : sendEmailAlert(body, opts?.leadId),
    sendRelaySms(body),
  ]);
  return (
    (sms.status === "fulfilled" && sms.value) ||
    (mail.status === "fulfilled" && mail.value) ||
    (relay.status === "fulfilled" && relay.value)
  );
}
