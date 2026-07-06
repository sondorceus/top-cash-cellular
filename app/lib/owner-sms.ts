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

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

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
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Email alert via Resend — the channel that actually reaches Sonny. The first
// URL in the message (the 🤫 takeover/mute link when present) becomes a real
// button; the rest renders as the alert text.
async function sendEmailAlert(body: string): Promise<boolean> {
  const to = process.env.OWNER_EMAIL || "";
  const key = process.env.RESEND_API_KEY || "";
  if (!to || !key) return false;
  try {
    const url = body.match(/https?:\/\/\S+/)?.[0] || null;
    const isMute = !!url && url.includes("mute=");
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
    const r = await resend.emails.send({
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
        afterButtonHtml: isMute
          ? `<div style="color:${MAIL.muted};font-size:12px;text-align:center;">One tap mutes the bot for this customer so you can reply from anywhere. The page has a hand-back button.</div>`
          : undefined,
      }),
      text: body,
    });
    return !r.error;
  } catch {
    return false;
  }
}

export async function notifyOwnerSms(body: string): Promise<boolean> {
  const [sms, mail] = await Promise.allSettled([sendSms(body), sendEmailAlert(body)]);
  return (sms.status === "fulfilled" && sms.value) || (mail.status === "fulfilled" && mail.value);
}
