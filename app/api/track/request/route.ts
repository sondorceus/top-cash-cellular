import { NextRequest, NextResponse, after } from "next/server";
import { rateLimit, clientIp } from "../../../lib/rate-limit";
import { makeTrackToken, normalizeContact } from "../../../lib/track-token";
import { sendCustomerEmail } from "../../../lib/customer-send";
import { sendSellerSms, optedOutIn } from "../../../lib/seller-sms";
import { fetchCommsPaged } from "../../../lib/mc-comms";

const SITE = "https://topcashcellular.com";
const MC_KEY = process.env.MC_API_KEY || "";

// A phone matches a trade the same way /api/track matches it: the lead's own
// Phone: field, digits only, leading 1 dropped.
function leadPhoneDigits(body: string): string {
  const v = body.match(/(?:^|\n)Phone:[ \t]*([^\n]*)/i)?.[1] || "";
  return v.replace(/\D/g, "").replace(/^1/, "");
}

// Sends a short-lived, signed magic link to the contact the customer enters,
// so trade status can only be viewed by whoever controls that inbox/phone
// (closes the old "type anyone's phone/email and see their trades" hole).
//
// Anti-enumeration: always returns { ok: true } regardless of whether the
// contact has trades — a stranger can never tell from the response. The link
// itself reveals nothing unless they actually receive it AND have trades.
// Rate-limited per IP to prevent SMS/email bombing.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`track-req:${clientIp(req)}`, 5, 15 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests — please wait a bit and try again." }, { status: 429 });
  }

  let payload: { contact?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const raw = typeof payload.contact === "string" ? payload.contact.trim() : "";
  const isEmail = raw.includes("@");
  const norm = normalizeContact(raw);
  const valid = isEmail
    ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)
    : norm.length === 10;
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Enter a valid phone number or email." }, { status: 400 });
  }

  const token = makeTrackToken(raw);
  const link = `${SITE}/track?t=${encodeURIComponent(token)}`;

  if (isEmail) {
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <p style="font-size:16px;font-weight:700;margin:0 0 8px">Track your Top Cash Cellular trade-in</p>
        <p style="font-size:14px;color:#444;margin:0 0 20px">Tap the button to see the status of every device tied to this email. This secure link expires in 30 minutes.</p>
        <a href="${link}" style="display:inline-block;background:#00c853;color:#0a0a0a;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:15px">View my trade-in status →</a>
        <p style="font-size:12px;color:#888;margin:20px 0 0">If you didn&rsquo;t request this, you can ignore it — no one can see your trades without this link.</p>
      </div>`;
    await sendCustomerEmail(raw, "Your Top Cash Cellular tracking link", html);
  } else {
    // SMS rides the Telnyx relay (app/lib/seller-sms.ts) like every other
    // customer text — sendCustomerSms is the dead Twilio account, so phone
    // requests silently received nothing while the page said "check your
    // phone". The relay number is live and not ours alone, so it only texts a
    // number that is actually on a trade /track would show and that hasn't
    // texted STOP — this endpoint must not become a "text any number" relay.
    // Done after the response so its timing can't reveal whether the number
    // has trades (the anti-enumeration promise above).
    after(async () => {
      if (!MC_KEY) return;
      // Same window /api/track reads.
      const messages = await fetchCommsPaged({ apiKey: MC_KEY, includeArchive: true, sinceMs: 365 * 24 * 60 * 60 * 1000, pageSize: 5000, maxPages: 6, memoMs: 30_000 });
      if (optedOutIn(messages, norm)) return;
      const hasTrade = messages.some((m) =>
        !!m.body &&
        (/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body) || m.body.includes("[CHAT LEAD]")) &&
        leadPhoneDigits(m.body) === norm);
      if (!hasTrade) return;
      await sendSellerSms(`+1${norm}`, `Top Cash Cellular: view your trade-in status (link expires in 30 min): ${link}\nReply STOP to opt out.`);
    });
  }

  // Identical response whether or not the contact has trades.
  return NextResponse.json({ ok: true });
}
