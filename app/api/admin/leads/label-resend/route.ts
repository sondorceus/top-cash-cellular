import { NextRequest, NextResponse } from "next/server";
import { logComm } from "../../../../lib/comms-log";

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

// Resend an EXISTING FedEx label to a customer — no new label mint,
// no new FedEx API call, no new tracking number. Staff uses this when
// a customer says "I lost my email." Costs nothing, takes 0.5s.
// Skywalker 2026-05-18.

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

type Payload = {
  leadId?: string;
  to: string;
  customerName: string;
  tracking: string;
  labelUrl: string;
  serviceType?: string;
};

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { leadId, to, customerName, tracking, labelUrl, serviceType = "FEDEX_GROUND" } = payload;
  if (!to || !labelUrl || !tracking) {
    return NextResponse.json({ error: "to, tracking, and labelUrl are required" }, { status: 400 });
  }
  // SECURITY: even though this endpoint is admin-gated, validate
  // labelUrl is OUR Vercel blob domain before emailing it to the
  // customer. If TCC_ADMIN_TOKEN ever leaks (env-only as of 2026-05-24),
  // an attacker could otherwise call resend with arbitrary labelUrl and
  // Resend would phish from our verified DKIM-signed domain. Same
  // defense as /api/confirm a8e6fc1.
  const isVercelBlobUrl =
    /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/fedex-labels\/[\w.\-/]+\.pdf$/i.test(labelUrl);
  const isValidTracking = /^[A-Z0-9]{8,30}$/i.test(tracking);
  if (!isVercelBlobUrl || !isValidTracking) {
    return NextResponse.json({ error: "labelUrl must be our hosted PDF and tracking must match FedEx format" }, { status: 400 });
  }
  if (!/^[A-Z_]{3,40}$/i.test(String(serviceType))) {
    return NextResponse.json({ error: "Invalid serviceType" }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured (RESEND_API_KEY missing)" }, { status: 503 });
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const first = (customerName || "there").split(" ")[0];
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "CustomerService@topcashcells.com",
      to,
      subject: `Your FedEx label (resent) — Top Cash Cellular`,
      text: `Hi ${first},\n\nHere's your prepaid FedEx label again — sent at your request:\n\nDownload: ${labelUrl}\nTracking: ${tracking} (${serviceType})\n\nPrint the PDF, tape it to your padded box, and drop the package at any FedEx location.\n\nQuestions? Reply to this email.\n\n— Top Cash Cellular`,
      html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0a0a0a;color:#e6e6e6;margin:0;padding:32px 16px"><div style="max-width:600px;margin:0 auto;background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden"><div style="background:linear-gradient(135deg,#00e676 0%,#00a039 100%);padding:24px 28px;color:#0a0a0a"><div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:0.7;margin-bottom:4px">Top Cash Cellular</div><div style="font-size:22px;font-weight:800;line-height:1.1">Your label (resent)</div></div><div style="padding:28px"><p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.6;margin:0 0 18px">Here's your FedEx label again — same tracking, same drop-off process. Print, tape, drop.</p><div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-left:3px solid #00c853;border-radius:14px;padding:18px 20px;margin:0 0 22px"><div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#00c853;font-weight:800;margin-bottom:6px">Tracking</div><div style="font-size:16px;color:#fff;font-weight:700;font-family:ui-monospace,monospace">${tracking}</div><div style="font-size:12px;color:#b8b8b8;margin-top:4px">${serviceType.replace(/_/g, " ")}</div></div><div style="text-align:center"><a href="${labelUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(180deg,#00e676 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px">Download label PDF</a></div></div></div></body></html>`,
    });
    if (!r?.data?.id) {
      return NextResponse.json({ error: "Resend accepted nothing back" }, { status: 502 });
    }
    if (leadId) {
      logComm({ leadId, channel: "email", kind: "label-resend", to, subject: `Resent label ${tracking}` });
    }
    return NextResponse.json({ ok: true, emailId: r.data.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Email send failed" },
      { status: 502 },
    );
  }
}
