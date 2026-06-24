import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "../../../lib/rate-limit";
import { makeTrackToken, normalizeContact } from "../../../lib/track-token";
import { sendCustomerSms, sendCustomerEmail } from "../../../lib/customer-send";

const SITE = "https://topcashcellular.com";

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
    await sendCustomerSms(`+1${norm}`, `Top Cash Cellular: view your trade-in status (link expires in 30 min): ${link}`);
  }

  // Identical response whether or not the contact has trades.
  return NextResponse.json({ ok: true });
}
