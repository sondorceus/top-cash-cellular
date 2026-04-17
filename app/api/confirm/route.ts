import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = "9b4dce8e03c1d2aaf86d272a2afda99a0157f49abd66450f";

export async function POST(req: NextRequest) {
  const { name, email, phone, model, storage, condition, quote, payout } = await req.json();

  if (!email) return NextResponse.json({ ok: false, error: "No email" });

  const emailBody = `Hi ${name || "there"},

Thanks for choosing Top Cash Cellular! Here's your quote summary:

📱 Device: ${model}
💾 Storage: ${storage || "N/A"}
✨ Condition: ${condition}
💰 Your Quote: $${quote}
💳 Payout Method: ${payout}

🔒 Your price is locked for 7 days.

Next steps:
• Austin local? We'll contact you within the hour to arrange pickup & payment.
• Shipping? Reply to this email and we'll send you a free prepaid label.

Questions? Call us at (512) 960-9256 or reply to this email.

— Top Cash Cellular
Austin, TX`;

  let emailSent = false;

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        to: email,
        subject: `Your $${quote} quote for ${model} — Top Cash Cellular`,
        text: emailBody,
      });
      emailSent = true;
    } catch {}
  }

  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: `[QUOTE CONFIRMATION${emailSent ? " — EMAIL SENT" : " — EMAIL PENDING (no Resend key)"}]\nTo: ${name} <${email}> | ${phone}\nDevice: ${model} | ${storage} | ${condition}\nQuote: $${quote} | Payout: ${payout}`,
        tags: ["confirmation", "lead"],
        priority: "normal",
      }),
    });
  } catch {}

  return NextResponse.json({ ok: true, emailSent });
}
