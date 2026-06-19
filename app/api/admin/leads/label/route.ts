import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../../lib/admin-auth";
import { put } from "@vercel/blob";
import { createReturnLabel, deviceKindFromString, type LabelInputs } from "../../../../lib/fedex";
import { findFreshLabel } from "../../../../lib/fedex-retry";
import { logComm } from "../../../../lib/comms-log";
import { mailShell, mailDetails, esc } from "../../../../lib/email-shell";

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
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
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
      text: `Hi ${first},\n\nHere's your prepaid FedEx label for the device you're sending to Top Cash:\n\nDownload: ${labelUrl}\nTracking: ${tracking} (${serviceType})\n\nPrint the PDF, tape it to your box, and drop the package at any FedEx location — no appointment needed. We'll text you the moment it arrives.\n\nShipping coverage: this prepaid label includes $100 of base coverage if the package is lost or damaged. We do not cover full device value — for more, declare additional insurance at the FedEx counter. By shipping, you agree to the $100 coverage limit.\n\nQuestions? Reply to this email.\n\n— Top Cash Cellular`,
      html: mailShell({
        preheader: `Your prepaid FedEx label — tracking ${tracking}`,
        eyebrow: "Prepaid label",
        title: "Your label is ready",
        introHtml: `Hi ${esc(first)},<br><br>Your prepaid FedEx label is attached and linked below. Print it, tape it to a padded box around your device, and drop at any FedEx location — no appointment needed.`,
        contentHtml: mailDetails([
          ["Tracking", `<span style="font-family:ui-monospace,monospace">${esc(tracking)}</span>`],
          ["Service", esc(serviceType.replace(/_/g, " "))],
        ]),
        buttonHref: labelUrl,
        buttonLabel: "Download label PDF",
        afterButtonHtml: `<p style="font-size:13px;color:#8a8fa3;line-height:1.6;text-align:center;margin:6px 0 0">We&apos;ll text you the moment it arrives at our Austin office.</p>`,
        footerHtml: `<strong style="color:#b7bacb">Shipping coverage:</strong> this prepaid label includes $100 of base coverage if the package is lost or damaged. We do not cover full device value — for more, declare additional insurance at the FedEx counter. By shipping, you agree to the $100 coverage limit.`,
      }),
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

  // Idempotency guard. createReturnLabel hits the FedEx Ship API, which BILLS
  // per call and mints a NEW tracking number every time. If a fresh label
  // already exists (operator double-click, or the status-route auto-fire
  // raced this manual call), reuse it instead of creating — and paying for —
  // a second shipment the customer would never use.
  const existing = await findFreshLabel(leadId);
  if (existing) {
    return NextResponse.json({
      ok: true,
      tracking: existing.tracking,
      labelUrl: existing.url,
      serviceType: existing.service,
      emailSent: false,
      reused: true,
    });
  }

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
