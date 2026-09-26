// The seller-facing lock-confirmation EMAIL, shared by /api/go/lock (email
// contacts) and /api/go/confirm-email — the fallback a phone contact reaches
// for when the text channel is down. 2026-09-23 review: the Telnyx relay sat
// unfunded for a week, 0 of 13 lock texts were delivered, and a seller who
// had been promised "we'll text you the details" had no other way to get
// the number. Moved here verbatim from the lock route (2026-09-11 version).
import { mailShell, esc, MAIL } from "./email-shell";
import { sidToken } from "./go-sid-token";
import { validGoSession } from "./gochat-store";

const RESEND_KEY = process.env.RESEND_API_KEY || "";
// The published promise: every quoted number holds 14 days.
export const LOCK_DAYS = 14;

export function lockDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
}

// Deep link back into the seller's own thread. Signed, so only links we
// mint can make a browser adopt the session (see go-sid-token.ts).
export function goChatLink(sessionId: string): string {
  const tok = validGoSession(sessionId) ? sidToken(sessionId) : "";
  return `https://topcashcellular.com/go${tok ? `?sid=${sessionId}&k=${tok}` : ""}`;
}

export async function sendLockConfirmationEmail(o: {
  to: string; dev: string; offer: number | null; lockUntil: string; sessionId: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!RESEND_KEY) return { sent: false, reason: "no resend key" };
  const { to, dev, offer, lockUntil, sessionId } = o;
  const link = goChatLink(sessionId);
  const until = lockDateLabel(lockUntil);
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);
    const title = offer != null ? `Locked in — $${offer} for your ${esc(dev)}` : `We're pricing your ${esc(dev)} by hand`;
    const intro = offer != null
      ? `That number holds until <strong style="color:${MAIL.ink}">${esc(until)}</strong> if the device matches what you told us. Meet up in the Austin area for cash on the spot, or we send a free FedEx label — your pick. Reply to this email with <strong style="color:${MAIL.ink}">MEET</strong> or <strong style="color:${MAIL.ink}">SHIP</strong>, or pick it back up in your chat.`
      : `We'll send you a real offer shortly. Reply to this email with <strong style="color:${MAIL.ink}">MEET</strong> if you're in the Austin area or <strong style="color:${MAIL.ink}">SHIP</strong> for a free FedEx label, or pick it back up in your chat.`;
    const send = resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to,
      subject: offer != null ? `Your ${dev} offer is locked — $${offer} until ${until}` : `Your ${dev} — we're pricing it by hand`,
      html: mailShell({
        preheader: offer != null ? `$${offer} locked until ${until}` : "a real offer is on the way",
        eyebrow: "Your offer",
        title,
        introHtml: `<span style="color:${MAIL.body}">${intro}</span>`,
        buttonHref: link,
        buttonLabel: "Open my chat",
      }),
      text: offer != null
        ? `Your ${dev} offer is locked at $${offer} until ${until}. Reply MEET for a cash meetup in the Austin area or SHIP for a free FedEx label. Your chat: ${link}`
        : `We're pricing your ${dev} by hand and will send a real offer shortly. Reply MEET if you're in the Austin area or SHIP for a free FedEx label. Your chat: ${link}`,
    });
    // The Resend SDK takes no abort signal — race it against a ceiling (same
    // pattern as owner-sms) so a stalled send can't hold the lock route open.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const r = await Promise.race([
      send,
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 10_000); }),
    ]).finally(() => clearTimeout(timer));
    if (!r) return { sent: false, reason: "email send timed out" };
    return { sent: !r.error, reason: r.error ? String(r.error.message || "resend error") : undefined };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "threw" };
  }
}
