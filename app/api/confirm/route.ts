import { NextRequest, NextResponse } from "next/server";

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
    const offerNum = Date.now().toString(36).toUpperCase();
    const offerDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const htmlEmail = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a">
<tr><td align="center" style="padding:20px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 100%);padding:24px 20px;text-align:center;border-bottom:2px solid #00c853">
<div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px">💰 Top Cash Cellular</div>
<div style="font-size:13px;color:#00c853;margin-top:4px;font-weight:600">Austin's #1 Device Buyback</div>
</td></tr>

<!-- Welcome -->
<tr><td style="background:#111;padding:24px 20px 16px">
<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">We're thrilled you decided to sell to us!</div>
<div style="font-size:14px;color:#aaa;line-height:1.5;margin-bottom:16px">Hi <strong style="color:#fff">${name || "there"}</strong>, below you'll find everything you need for a successful trade-in.</div>

<!-- Offer Info -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
<tr><td style="font-size:12px;color:#888">Offer #${offerNum}</td><td style="font-size:12px;color:#888;text-align:right">${offerDate}</td></tr>
</table>

<!-- Quote Card -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:10px;border:1px solid #333">
<tr><td style="padding:20px 20px;text-align:center;border-bottom:1px solid #333">
<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Your Locked-In Offer</div>
<div style="font-size:44px;font-weight:800;color:#00c853">$${quote}</div>
</td></tr>
<tr><td style="padding:12px 20px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:7px 0;color:#888;font-size:14px;border-bottom:1px solid #222">Device</td><td style="padding:7px 0;color:#fff;font-size:14px;text-align:right;border-bottom:1px solid #222;font-weight:600">${model}</td></tr>
<tr><td style="padding:7px 0;color:#888;font-size:14px;border-bottom:1px solid #222">Storage</td><td style="padding:7px 0;color:#fff;font-size:14px;text-align:right;border-bottom:1px solid #222">${storage || "N/A"}</td></tr>
<tr><td style="padding:7px 0;color:#888;font-size:14px;border-bottom:1px solid #222">Condition</td><td style="padding:7px 0;color:#fff;font-size:14px;text-align:right;border-bottom:1px solid #222">${condition}</td></tr>
<tr><td style="padding:7px 0;color:#888;font-size:14px">Payout</td><td style="padding:7px 0;color:#00c853;font-size:14px;text-align:right;font-weight:600">${payout}</td></tr>
</table>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
<tr><td style="background:#00c853;border-radius:10px;text-align:center;padding:12px 20px">
<div style="color:#000;font-size:14px;font-weight:800">🔒 Offer valid for 7 days</div>
</td></tr>
</table>
</td></tr>

<!-- Device Prep -->
<tr><td style="background:#111;padding:8px 20px 20px">
<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px">Before we meet — device preparation:</div>
<table cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:6px 0;font-size:13px;color:#ccc;line-height:1.5">☑ <strong>Required:</strong> Reset your device and turn off "Find My" or Android Activation Lock</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#ccc;line-height:1.5">☑ <strong>Optional:</strong> Confirm your device is fully paid off (financed devices may have offers adjusted up to 75%)</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#ccc;line-height:1.5">☑ <strong>Optional:</strong> Remove SIM cards, SD cards, screen protectors, and cases</td></tr>
</table>
</td></tr>

<!-- What Happens Next -->
<tr><td style="background:#111;padding:0 20px 20px">
<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px">What happens next:</div>
<table cellpadding="0" cellspacing="0" width="100%">
<tr><td width="36" style="padding:8px 0;vertical-align:top"><table cellpadding="0" cellspacing="0"><tr><td style="width:28px;height:28px;background:#00c853;color:#000;border-radius:14px;text-align:center;font-weight:800;font-size:13px;line-height:28px">1</td></tr></table></td><td style="padding:8px 0 8px 10px;font-size:14px;color:#ccc;line-height:1.5;vertical-align:middle">We'll reach out to schedule a local meetup</td></tr>
<tr><td width="36" style="padding:8px 0;vertical-align:top"><table cellpadding="0" cellspacing="0"><tr><td style="width:28px;height:28px;background:#00c853;color:#000;border-radius:14px;text-align:center;font-weight:800;font-size:13px;line-height:28px">2</td></tr></table></td><td style="padding:8px 0 8px 10px;font-size:14px;color:#ccc;line-height:1.5;vertical-align:middle">Quick inspection confirms your quoted price</td></tr>
<tr><td width="36" style="padding:8px 0;vertical-align:top"><table cellpadding="0" cellspacing="0"><tr><td style="width:28px;height:28px;background:#00c853;color:#000;border-radius:14px;text-align:center;font-weight:800;font-size:13px;line-height:28px">3</td></tr></table></td><td style="padding:8px 0 8px 10px;font-size:14px;color:#ccc;line-height:1.5;vertical-align:middle">Get paid on the spot — Cash, Venmo, Zelle, or PayPal</td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td style="background:#1a1a2e;border:1px solid #333;border-radius:10px;padding:14px 20px;font-size:13px;color:#888;text-align:center">
🏠 <strong style="color:#ccc">Austin local? We meet locally!</strong> Prefer to ship? Just reply and we'll send you a prepaid label.
</td></tr></table>
</td></tr>

<!-- Submission Summary -->
<tr><td style="background:#111;padding:0 20px 20px">
<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px">Your Submission Summary</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:10px;border:1px solid #333;padding:16px 20px">
<tr><td style="padding:5px 0;color:#888;font-size:13px">Device</td><td style="padding:5px 0;color:#fff;font-size:13px;text-align:right;font-weight:600">${model}</td></tr>
<tr><td style="padding:5px 0;color:#888;font-size:13px">Storage</td><td style="padding:5px 0;color:#fff;font-size:13px;text-align:right">${storage || "N/A"}</td></tr>
<tr><td style="padding:5px 0;color:#888;font-size:13px">Condition</td><td style="padding:5px 0;color:#fff;font-size:13px;text-align:right">${condition}</td></tr>
<tr><td style="padding:5px 0;color:#888;font-size:13px">Quoted Price</td><td style="padding:5px 0;color:#00c853;font-size:13px;text-align:right;font-weight:700">$${quote}</td></tr>
<tr><td style="padding:5px 0;color:#888;font-size:13px">Payout Method</td><td style="padding:5px 0;color:#fff;font-size:13px;text-align:right">${payout}</td></tr>
<tr><td colspan="2" style="padding:8px 0 0;border-top:1px solid #333"></td></tr>
<tr><td style="padding:5px 0;color:#888;font-size:13px">Name</td><td style="padding:5px 0;color:#fff;font-size:13px;text-align:right">${name || "N/A"}</td></tr>
<tr><td style="padding:5px 0;color:#888;font-size:13px">Email</td><td style="padding:5px 0;color:#fff;font-size:13px;text-align:right">${email}</td></tr>
${phone ? `<tr><td style="padding:5px 0;color:#888;font-size:13px">Phone</td><td style="padding:5px 0;color:#fff;font-size:13px;text-align:right">${phone}</td></tr>` : ''}
</table>
</td></tr>

<!-- Footer -->
<tr><td style="background:#0a0a0a;padding:20px;text-align:center;border-top:1px solid #222">
<div style="margin-bottom:6px"><a href="tel:+18775492056" style="color:#00c853;text-decoration:none;font-size:15px;font-weight:700">(877) 549-2056</a></div>
<div style="font-size:12px;color:#555;line-height:1.5">Top Cash Cellular · Austin, TX</div>
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
        replyTo: "topcashcellular@gmail.com",
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

  return NextResponse.json({ ok: true, emailSent, smsSent });
}
