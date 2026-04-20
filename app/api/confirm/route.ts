import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH) return false;
  const digits = to.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
  if (!e164) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: body }),
    });
    return res.ok;
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const { name, email, phone, model, storage, condition, quote, payout } = await req.json();

  if (!email && !phone) return NextResponse.json({ ok: false, error: "No contact info" });

  let emailSent = false;
  let smsSent = false;

  if (email && process.env.RESEND_API_KEY) {
    const htmlEmail = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:100%;width:100%">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 100%);padding:24px 40px;text-align:center;border-bottom:2px solid #00c853">
<div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px">💰 Top Cash Cellular</div>
<div style="font-size:13px;color:#00c853;margin-top:4px;font-weight:600">Austin's #1 Device Buyback</div>
</td></tr>

<!-- Quote Card -->
<tr><td style="background:#111;padding:24px 40px 16px">
<div style="font-size:16px;color:#ccc;margin-bottom:16px">Hi <strong style="color:#fff">${name || "there"}</strong>,</div>
<div style="font-size:15px;color:#aaa;line-height:1.5;margin-bottom:20px">Great news — your quote is ready:</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;border:1px solid #333;overflow:hidden">
<tr><td style="padding:20px 24px;text-align:center;border-bottom:1px solid #333">
<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Your Offer</div>
<div style="font-size:48px;font-weight:800;color:#00c853">$${quote}</div>
</td></tr>
<tr><td style="padding:14px 24px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:7px 0;color:#888;font-size:13px;border-bottom:1px solid #222">Device</td><td style="padding:7px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #222;font-weight:600">${model}</td></tr>
<tr><td style="padding:7px 0;color:#888;font-size:13px;border-bottom:1px solid #222">Storage</td><td style="padding:7px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #222">${storage || "N/A"}</td></tr>
<tr><td style="padding:7px 0;color:#888;font-size:13px;border-bottom:1px solid #222">Condition</td><td style="padding:7px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #222">${condition}</td></tr>
<tr><td style="padding:7px 0;color:#888;font-size:13px">Payout</td><td style="padding:7px 0;color:#00c853;font-size:13px;text-align:right;font-weight:600">${payout}</td></tr>
</table>
</td></tr>
</table>

<!-- CTA Button -->
<div style="text-align:center;margin-top:20px">
<a href="https://topcashcellular.com" style="display:inline-block;background:#00c853;color:#000;padding:16px 48px;border-radius:50px;font-size:18px;font-weight:800;text-decoration:none;letter-spacing:-0.3px">Accept Your $${quote} Offer</a>
</div>
<div style="text-align:center;margin-top:10px;font-size:12px;color:#888">Your offer expires in 7 days. Prices may change after.</div>

<!-- Trust Signals -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
<tr>
<td style="text-align:center;padding:8px;font-size:12px;color:#aaa;border-right:1px solid #222">✓ No hidden fees</td>
<td style="text-align:center;padding:8px;font-size:12px;color:#aaa;border-right:1px solid #222">✓ Price guaranteed</td>
<td style="text-align:center;padding:8px;font-size:12px;color:#aaa">✓ Paid instantly</td>
</tr>
</table>
</td></tr>

<!-- 3-Step Process -->
<tr><td style="background:#111;padding:8px 40px 20px">
<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:10px">How it works:</div>
<table cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:6px 0;font-size:13px;color:#ccc;line-height:1.4"><span style="display:inline-block;width:24px;height:24px;background:#00c853;color:#000;border-radius:50%;text-align:center;line-height:24px;font-weight:800;font-size:12px;margin-right:10px;vertical-align:middle">1</span> Accept your offer</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#ccc;line-height:1.4"><span style="display:inline-block;width:24px;height:24px;background:#00c853;color:#000;border-radius:50%;text-align:center;line-height:24px;font-weight:800;font-size:12px;margin-right:10px;vertical-align:middle">2</span> Schedule pickup — we come to you</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#ccc;line-height:1.4"><span style="display:inline-block;width:24px;height:24px;background:#00c853;color:#000;border-radius:50%;text-align:center;line-height:24px;font-weight:800;font-size:12px;margin-right:10px;vertical-align:middle">3</span> Get paid on the spot</td></tr>
</table>
<div style="background:#1a1a2e;border:1px solid #333;border-radius:10px;padding:12px 20px;margin-top:12px;font-size:12px;color:#888;text-align:center">
📦 <strong style="color:#ccc">Prefer shipping?</strong> Reply to this email for a free prepaid label.
</div>
</td></tr>

<!-- Footer -->
<tr><td style="background:#0a0a0a;padding:20px 40px;text-align:center;border-top:1px solid #222">
<div style="margin-bottom:6px"><a href="tel:+18775492056" style="color:#00c853;text-decoration:none;font-size:15px;font-weight:700">(877) 549-2056</a></div>
<div style="font-size:12px;color:#555">Top Cash Cellular · Austin, TX</div>
<div style="font-size:11px;color:#444;margin-top:6px">Questions? Call or reply to this email.</div>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    const textFallback = `Hi ${name || "there"}, your $${quote} quote for ${model} (${condition}, ${storage || "N/A"}) is locked for 7 days. We'll contact you within the hour. Call (877) 549-2056 — Top Cash Cellular, Austin TX`;

    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: "Top Cash Cellular <topcash@resend.dev>",
        to: email,
        subject: `Your $${quote} quote for ${model} — Top Cash Cellular`,
        html: htmlEmail,
        text: textFallback,
      });
      emailSent = !!(result?.data?.id);
    } catch {}
  }

  if (phone) {
    const smsBody = `Top Cash Cellular: Your $${quote} quote for ${model} is locked for 7 days! We'll contact you within the hour. Questions? Call (877) 549-2056`;
    smsSent = await sendSms(phone, smsBody);
  }

  const status = [
    emailSent ? "EMAIL SENT" : null,
    smsSent ? "SMS SENT" : null,
    !emailSent && !smsSent ? "NO CONFIRMATION SENT" : null,
  ].filter(Boolean).join(" + ");

  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: `[QUOTE CONFIRMATION — ${status}]\nTo: ${name} <${email || "no email"}> | ${phone || "no phone"}\nDevice: ${model} | ${storage} | ${condition}\nQuote: $${quote} | Payout: ${payout}`,
        tags: ["confirmation", "lead"],
        priority: "normal",
      }),
    });
  } catch {}

  return NextResponse.json({ ok: true, emailSent, smsSent });
}
