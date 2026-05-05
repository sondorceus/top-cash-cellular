import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";

const STATUSES = ["quote_requested", "shipped", "received", "tested", "paid", "rejected"];

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

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

function smsTemplate(status: string, ctx: { name?: string; device?: string; quote?: string; payout?: string; rejectionReason?: string }): string {
  const dev = ctx.device || "your device";
  const first = ctx.name?.split(" ")[0] || "there";
  switch (status) {
    case "shipped":
      return `Top Cash: Hi ${first}, your shipping label is on the way. Drop ${dev} at any USPS — we'll text you when it arrives. (877) 549-2056`;
    case "received":
      return `Top Cash: We got ${dev}, ${first}! Testing now — payout within 24 hrs. Questions? (877) 549-2056`;
    case "tested":
      return `Top Cash: ${dev} passed inspection ✅ Finalizing your ${ctx.quote || "payout"} via ${ctx.payout || "your chosen method"} now.`;
    case "paid":
      return `Top Cash: ${ctx.quote || "Payment"} sent via ${ctx.payout || "your method"}! Thanks for selling with us, ${first}. — TCC Austin`;
    case "rejected":
      if (ctx.rejectionReason) {
        return `Top Cash: Hi ${first}, we couldn't accept ${dev} — ${ctx.rejectionReason}. Call (877) 549-2056 if you'd like to discuss.`;
      }
      return `Top Cash: There's an issue with ${dev}, ${first}. Please call (877) 549-2056 — we'll work it out.`;
    default:
      return `Top Cash: Status update on your ${dev} — ${status}. Call (877) 549-2056 with questions.`;
  }
}

async function emailStatus(to: string, status: string, ctx: { name?: string; device?: string; quote?: string; payout?: string; rejectionReason?: string }) {
  if (!process.env.RESEND_API_KEY) return false;
  const first = ctx.name?.split(" ")[0] || "there";
  const dev = ctx.device || "your device";
  const subjectMap: Record<string, string> = {
    shipped: `Your shipping label is on the way`,
    received: `We received ${dev}`,
    tested: `${dev} passed inspection`,
    paid: `Payment sent — thanks!`,
    rejected: `Issue with ${dev}`,
  };
  const subject = subjectMap[status] || `Status update on your trade-in`;
  const body = smsTemplate(status, ctx);
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
<table width="600" style="max-width:600px;margin:0 auto;background:#111;border:1px solid #222;border-radius:12px;padding:24px">
<tr><td>
<div style="font-size:22px;font-weight:800;color:#00c853;margin-bottom:8px">💰 Top Cash Cellular</div>
<div style="font-size:14px;color:#888;margin-bottom:20px">Austin's #1 Device Buyback</div>
<div style="font-size:18px;color:#fff;font-weight:700;margin-bottom:12px">Hi ${first},</div>
<div style="font-size:15px;color:#ccc;line-height:1.6;margin-bottom:20px">${body}</div>
<div style="font-size:13px;color:#888;border-top:1px solid #222;padding-top:16px">
Questions? Call <a href="tel:+18775492056" style="color:#00c853">(877) 549-2056</a> or just reply to this email.
</div>
</td></tr></table></body></html>`;
    const r = await resend.emails.send({
      from: "Top Cash Cellular <topcash@resend.dev>",
      replyTo: "topcashcellular@gmail.com",
      to,
      subject: `${subject} — Top Cash Cellular`,
      html,
      text: body,
    });
    return !!(r?.data?.id);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { leadId, status, name, phone, email, device, quote, payout, rejectionReason } = body;

  if (!leadId || !status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "leadId and valid status required" }, { status: 400 });
  }

  // 1. Persist by posting [STATUS: ...] [LEAD: ...] reply to MC comms.
  const reasonLine = status === "rejected" && rejectionReason ? `\nReason: ${rejectionReason}` : "";
  const statusBody = `[STATUS: ${status}] [LEAD: ${leadId}]\nDevice: ${device || "—"}\nCustomer: ${name || "—"}\nQuote: ${quote || "—"}\nPayout: ${payout || "—"}${reasonLine}`;
  let mcOk = false;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: statusBody,
        priority: "normal",
      }),
    });
    mcOk = r.ok;
  } catch {}

  // 2. Fire SMS + email in parallel.
  const ctx = { name, device, quote, payout, rejectionReason };
  const [smsSent, emailSent] = await Promise.all([
    phone ? sendSms(phone, smsTemplate(status, ctx)) : Promise.resolve(false),
    email ? emailStatus(email, status, ctx) : Promise.resolve(false),
  ]);

  return NextResponse.json({ ok: true, mcOk, smsSent, emailSent, status });
}
