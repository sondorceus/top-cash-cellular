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
    const htmlEmail = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e6e6e6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin:0 auto;border-collapse:separate;background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5)">

<!-- Hero header — green gradient with inset rim light -->
<tr><td style="background:linear-gradient(135deg,#00e676 0%,#00a039 100%);padding:28px 28px;border-bottom:1px solid rgba(255,255,255,0.12)">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:middle">
<div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#0a0a0a;opacity:0.7;margin-bottom:4px">Top Cash Cellular</div>
<div style="font-size:24px;font-weight:800;color:#0a0a0a;line-height:1.15">You're locked in</div>
</td>
<td style="vertical-align:middle;text-align:right">
<div style="display:inline-block;padding:8px 14px;background:rgba(10,10,10,0.18);border:1px solid rgba(10,10,10,0.22);border-radius:999px;font-size:11px;font-weight:800;color:#0a0a0a;letter-spacing:0.1em;text-transform:uppercase">Austin, TX</div>
</td>
</tr>
</table>
</td></tr>

<!-- Welcome -->
<tr><td style="padding:28px 28px 12px 28px">
<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Hi ${name || "there"},</div>
<div style="font-size:14px;color:#bdbdbd;line-height:1.6">Below is everything you need for a successful trade-in. We'll reach out within the hour to set up pickup.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">
<tr><td style="font-size:11px;color:#777;letter-spacing:0.1em;text-transform:uppercase">Offer #${offerNum}</td><td style="font-size:11px;color:#777;text-align:right;letter-spacing:0.1em;text-transform:uppercase">${offerDate}</td></tr>
</table>
</td></tr>

<!-- Quote card — glass + left accent rim -->
<tr><td style="padding:6px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-left:3px solid #00c853;border-radius:14px">
<tr><td style="padding:22px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08)">
<div style="font-size:10px;color:#00c853;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:6px;font-weight:800">Locked-In Offer</div>
<div style="font-size:48px;font-weight:800;color:#00c853;line-height:1;text-shadow:0 0 18px rgba(0,200,83,0.4)">$${quote}</div>
<div style="font-size:11px;color:#888;margin-top:10px;letter-spacing:0.08em;text-transform:uppercase">Valid for 7 days</div>
</td></tr>
<tr><td style="padding:16px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Device</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:600">${model}</td></tr>
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Storage</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06)">${storage || "N/A"}</td></tr>
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Condition</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06)">${condition}</td></tr>
<tr><td style="padding:8px 0;color:#888;font-size:13px">Payout</td><td style="padding:8px 0;color:#00c853;font-size:13px;text-align:right;font-weight:700">${payout}</td></tr>
</table>
</td></tr>
</table>
</td></tr>

<!-- Device Prep -->
<tr><td style="padding:24px 28px 8px 28px">
<div style="font-size:11px;color:#00c853;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;margin-bottom:10px">Before we meet</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px">
<tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#d4d4d4;line-height:1.55"><strong style="color:#fff">Required:</strong> Reset your device and turn off "Find My" or Android Activation Lock.</td></tr>
<tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#d4d4d4;line-height:1.55"><strong style="color:#fff">Optional:</strong> Confirm the device is fully paid off (financed offers may be adjusted up to 75%).</td></tr>
<tr><td style="padding:14px 20px;font-size:13px;color:#d4d4d4;line-height:1.55"><strong style="color:#fff">Optional:</strong> Remove SIM, SD card, screen protector, and case.</td></tr>
</table>
</td></tr>

<!-- What Happens Next -->
<tr><td style="padding:24px 28px 8px 28px">
<div style="font-size:11px;color:#00c853;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;margin-bottom:10px">What happens next</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="40" valign="top" style="padding:8px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:30px;height:30px;background:linear-gradient(180deg,#00e676 0%,#00a039 100%);color:#0a0a0a;border-radius:50%;text-align:center;font-weight:800;font-size:14px;line-height:30px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4)">1</td></tr></table>
</td>
<td style="padding:8px 0 8px 12px;font-size:14px;color:#e6e6e6;line-height:1.5;vertical-align:middle">We reach out to schedule a local meetup</td>
</tr>
<tr>
<td width="40" valign="top" style="padding:8px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:30px;height:30px;background:linear-gradient(180deg,#00e676 0%,#00a039 100%);color:#0a0a0a;border-radius:50%;text-align:center;font-weight:800;font-size:14px;line-height:30px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4)">2</td></tr></table>
</td>
<td style="padding:8px 0 8px 12px;font-size:14px;color:#e6e6e6;line-height:1.5;vertical-align:middle">Quick inspection confirms the quote</td>
</tr>
<tr>
<td width="40" valign="top" style="padding:8px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:30px;height:30px;background:linear-gradient(180deg,#00e676 0%,#00a039 100%);color:#0a0a0a;border-radius:50%;text-align:center;font-weight:800;font-size:14px;line-height:30px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4)">3</td></tr></table>
</td>
<td style="padding:8px 0 8px 12px;font-size:14px;color:#e6e6e6;line-height:1.5;vertical-align:middle">You get paid on the spot — Cash, Cash App, Zelle, or BTC</td>
</tr>
</table>
</td></tr>

<!-- CTA -->
<tr><td style="padding:18px 28px 6px 28px;text-align:center">
<a href="mailto:topcashcellular@gmail.com" style="display:inline-block;padding:14px 32px;background:linear-gradient(180deg,#00e676 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),0 4px 14px rgba(0,200,83,0.35)">Reply with questions</a>
</td></tr>

<!-- Local note -->
<tr><td style="padding:18px 28px 8px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(0,200,83,0.06);border:1px solid rgba(0,200,83,0.22);border-radius:12px">
<tr><td style="padding:14px 18px;font-size:13px;color:#e6e6e6;line-height:1.55;text-align:center">
<strong style="color:#00c853">Austin local?</strong> We meet locally — no shipping. Prefer to ship? Reply and we'll send a prepaid label.
</td></tr>
</table>
</td></tr>

<!-- Submission summary -->
<tr><td style="padding:20px 28px 8px 28px">
<div style="font-size:11px;color:#888;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;margin-bottom:10px">Submission summary</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
<tr><td style="padding:14px 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:4px 0;color:#888;font-size:12px">Device</td><td style="padding:4px 0;color:#fff;font-size:12px;text-align:right;font-weight:600">${model}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Storage</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${storage || "N/A"}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Condition</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${condition}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Quote</td><td style="padding:4px 0;color:#00c853;font-size:12px;text-align:right;font-weight:700">$${quote}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Payout</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${payout}</td></tr>
<tr><td colspan="2" style="padding:6px 0 0"><div style="height:1px;background:rgba(255,255,255,0.06)"></div></td></tr>
<tr><td style="padding:6px 0 4px;color:#888;font-size:12px">Name</td><td style="padding:6px 0 4px;color:#e6e6e6;font-size:12px;text-align:right">${name || "N/A"}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Email</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${email}</td></tr>
${phone ? `<tr><td style="padding:4px 0;color:#888;font-size:12px">Phone</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${phone}</td></tr>` : ''}
</table>
</td></tr>
</table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 28px 28px 28px">
<div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:18px"></div>
<div style="text-align:center">
<div style="margin-bottom:6px"><a href="mailto:topcashcellular@gmail.com" style="color:#00c853;text-decoration:none;font-size:14px;font-weight:700">topcashcellular@gmail.com</a></div>
<div style="font-size:12px;color:#666;line-height:1.5">Top Cash Cellular · Austin, TX · <a href="https://topcashcellular.com" style="color:#666;text-decoration:none">topcashcellular.com</a></div>
<div style="font-size:11px;color:#555;margin-top:6px">Questions? Just reply to this email.</div>
</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const textFallback = `Hi ${name || "there"}, your $${quote} quote for ${model} (${condition}, ${storage || "N/A"}) is locked for 7 days. We'll contact you within the hour. Reply to this email or write to topcashcellular@gmail.com — Top Cash Cellular, Austin TX`;

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
