import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../../lib/admin-auth";
import { logComm } from "../../../../lib/comms-log";
import { mailShell, mailDetails, esc } from "../../../../lib/email-shell";

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

// Resend an EXISTING FedEx label to a customer — no new label mint,
// no new FedEx API call, no new tracking number. Staff uses this when
// a customer says "I lost my email." Costs nothing, takes 0.5s.
// Skywalker 2026-05-18.

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
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
      replyTo: "support@topcashcellular.com",
      to,
      subject: `Your FedEx label (resent) — Top Cash Cellular`,
      text: `Hi ${first},\n\nHere's your prepaid FedEx label again — sent at your request:\n\nDownload: ${labelUrl}\nTracking: ${tracking} (${serviceType})\n\nPrint the PDF, tape it to your padded box, and drop the package at any FedEx location.\n\nShipping coverage: this prepaid label includes $100 of base coverage if the package is lost or damaged. We do not cover full device value — declare additional insurance at the FedEx counter for more. By shipping, you agree to the $100 coverage limit.\n\nQuestions? Reply to this email.\n\n— Top Cash Cellular`,
      html: mailShell({
        preheader: `Your FedEx label (resent) — tracking ${tracking}`,
        eyebrow: "Prepaid label",
        title: "Your label (resent)",
        introHtml: `Hi ${esc(first)},<br><br>Here's your FedEx label again — same tracking, same drop-off process. Print, tape, drop.`,
        contentHtml: mailDetails([
          ["Tracking", `<span style="font-family:ui-monospace,monospace">${esc(tracking)}</span>`],
          ["Service", esc(serviceType.replace(/_/g, " "))],
        ]),
        buttonHref: labelUrl,
        buttonLabel: "Download label PDF",
        footerHtml: `<strong style="color:#b7bacb">Shipping coverage:</strong> this prepaid label includes $100 of base coverage if lost or damaged. We do not cover full device value — declare additional insurance at the FedEx counter for more. By shipping, you agree to the $100 coverage limit.`,
      }),
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
