import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createReturnLabel, deviceKindFromString, type LabelInputs } from "../../../../lib/fedex";
import { logComm } from "../../../../lib/comms-log";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

// Generates a FedEx prepaid drop-off label for a lead, uploads the PDF
// to Vercel Blob, and posts a [LABEL: <leadId>] marker to MC so the
// admin GET parser surfaces the tracking + label URL on the lead row.
//
// Also emails the customer their label via Resend if RESEND_API_KEY is
// configured. Skywalker 2026-05-17.

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

type LabelPayload = {
  leadId: string;
  customer: LabelInputs;
  deviceLabel?: string;
  customerEmail?: string;
  silent?: boolean; // if true, skip customer email (e.g. auto-fire wants
  // to send its own combined SMS+email via the status endpoint)
};

async function emailLabel(to: string, name: string, tracking: string, labelUrl: string, serviceType: string) {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const first = name.split(" ")[0] || "there";
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to,
      subject: `Your prepaid FedEx label — drop it any time`,
      text: `Hi ${first},\n\nHere's your prepaid FedEx label for the device you're sending to Top Cash:\n\nDownload: ${labelUrl}\nTracking: ${tracking} (${serviceType})\n\nPrint the PDF, tape it to your box, and drop the package at any FedEx location — no appointment needed. We'll text you the moment it arrives.\n\nQuestions? Reply to this email.\n\n— Top Cash Cellular`,
      html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0a0a0a;color:#e6e6e6;margin:0;padding:32px 16px"><div style="max-width:600px;margin:0 auto;background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden"><div style="background:linear-gradient(135deg,#00e676 0%,#00a039 100%);padding:24px 28px;color:#0a0a0a"><div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:0.7;margin-bottom:4px">Top Cash Cellular</div><div style="font-size:22px;font-weight:800;line-height:1.1">Your label is ready</div></div><div style="padding:28px"><p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.6;margin:0 0 18px">Your prepaid FedEx label is attached and linked below. Print it, tape it to a padded box around your device, and drop at any FedEx location — no appointment needed.</p><div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-left:3px solid #00c853;border-radius:14px;padding:18px 20px;margin:0 0 22px"><div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#00c853;font-weight:800;margin-bottom:6px">Tracking</div><div style="font-size:16px;color:#fff;font-weight:700;font-family:ui-monospace,monospace">${tracking}</div><div style="font-size:12px;color:#b8b8b8;margin-top:4px">${serviceType.replace(/_/g, " ")}</div></div><div style="text-align:center;margin:0 0 14px"><a href="${labelUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(180deg,#00e676 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px">Download label PDF</a></div><p style="font-size:13px;color:#888;line-height:1.6;text-align:center;margin:18px 0 0">We'll text you the moment it arrives at our Austin office. Questions? Reply to this email.</p></div></div></body></html>`,
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
  let payload: LabelPayload;
  try {
    payload = (await req.json()) as LabelPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { leadId, customer, deviceLabel, customerEmail, silent } = payload;
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  if (!customer?.customerName || !customer?.customerPhone || !customer?.customerStreet || !customer?.customerCity || !customer?.customerState || !customer?.customerZip) {
    return NextResponse.json({ error: "Customer name, phone, and full address are required." }, { status: 400 });
  }

  // Try to infer device kind for weight default if caller didn't set it.
  // Also stamp the label with a customer reference (deviceLabel or
  // count) + lead ID so dock intake can match the box to its lead
  // without scanning the tracking number first.
  const labelInput: LabelInputs = {
    ...customer,
    deviceKind: customer.deviceKind || deviceKindFromString(deviceLabel),
    customerReference: customer.customerReference || (deviceLabel ? String(deviceLabel).slice(0, 30) : "1 device"),
    poNumber: customer.poNumber || `TCC-${leadId}`,
  };

  let label;
  try {
    label = await createReturnLabel(labelInput);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "FedEx error" },
      { status: 502 },
    );
  }

  // Persist the PDF to Vercel Blob so the customer link survives admin
  // refresh + email forwarding. Blob URLs are public; we use an
  // unguessable random suffix so a leaked tracking number can't be
  // pivoted to leaked labels.
  const pdfBytes = Buffer.from(label.labelPdfBase64, "base64");
  let labelUrl = "";
  try {
    const blob = await put(`fedex-labels/${leadId}-${Date.now()}.pdf`, pdfBytes, {
      access: "public",
      contentType: "application/pdf",
    });
    labelUrl = blob.url;
  } catch (e) {
    return NextResponse.json(
      { error: `Label generated but blob upload failed: ${e instanceof Error ? e.message : "blob error"}`, tracking: label.trackingNumber },
      { status: 502 },
    );
  }

  // Persist to MC so admin GET surfaces the tracking + URL.
  const markerBody = `[LABEL: ${leadId}] tracking=${label.trackingNumber} url=${labelUrl} service=${label.serviceType}`;
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: markerBody,
        tags: ["fedex-label"],
        priority: "low",
      }),
    });
  } catch {
    // Non-fatal — label already generated. Operator will see the
    // tracking in the API response.
  }

  // Email the label to the customer (unless caller asked us to stay
  // silent, e.g. the status-update auto-fire wants to merge with its
  // own status email).
  let emailSent = false;
  if (!silent && customerEmail) {
    emailSent = await emailLabel(customerEmail, customer.customerName, label.trackingNumber, labelUrl, label.serviceType);
    if (emailSent) {
      logComm({ leadId, channel: "email", kind: "label", to: customerEmail, subject: `FedEx label ${label.trackingNumber}` });
    }
  }

  return NextResponse.json({
    ok: true,
    tracking: label.trackingNumber,
    labelUrl,
    serviceType: label.serviceType,
    emailSent,
  });
}
