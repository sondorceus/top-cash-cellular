import { NextRequest, NextResponse, after } from "next/server";
import { safeEqual } from "../../../../lib/admin-auth";
import { put } from "@vercel/blob";
import { createReturnLabel, deviceKindFor, type LabelInputs } from "../../../../lib/fedex";
import { findFreshLabel } from "../../../../lib/fedex-retry";
import { logComm } from "../../../../lib/comms-log";
import { mailShell, mailDetails, esc } from "../../../../lib/email-shell";
import { fetchCommsRead } from "../../../../lib/mc-comms";
import { field, isCustomerLeadPost } from "../../../../lib/lead-devices";
import { appendChatMsg, readChat, validGoSession } from "../../../../lib/gochat-store";

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
  // Header only (2026-09-26): a ?token= in the URL put the admin secret in
  // request logs and browser history. proxy.ts sets this header for a Google
  // admin session; server-side callers already send it.
  return safeEqual(req.headers.get("x-admin-token"), ADMIN_TOKEN);
}

type LabelPayload = {
  leadId: string;
  customer: LabelInputs;
  deviceLabel?: string;
  customerEmail?: string;
  silent?: boolean; // if true, skip customer email (e.g. auto-fire wants
  // to send its own combined SMS+email via the status endpoint)
  // Funnel device type ("lenovo", "msi_desktop") — package-kind fallback
  // when the model name alone is unknown.
  deviceType?: string;
  // Tracking number of the label staff are REPLACING (Edit address /
  // Regenerate). Only that exact label may be superseded; see below.
  replace?: string;
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

// A /go lead's label reaches its /go thread too (2026-09-30, review): this
// route wrote only the MC [LABEL:] marker, so a lock whose page print failed
// on the address and was finished here stayed "waiting for a box" — the
// seller's next lock minted one label "covering" both, overwrote this
// label's marker, and fedex-poll tracked the wrong box. The LABEL note
// closes that window (go-box WINDOW_CLOSE_RE), and the page and the chat
// show this label for that lock. Stamped inside the lead's own lock span
// (before the next LOCKED note), so a device locked after it doesn't read
// as labeled. Best-effort, after the response.
async function noteGoThread(leadId: string, tracking: string, url: string): Promise<void> {
  if (!MC_KEY || !tracking || !/^https:\/\/\S+$/.test(url)) return;
  const read = await fetchCommsRead({ apiKey: MC_KEY, pageSize: 5000, maxPages: 6, includeArchive: true, memoMs: 3_000 });
  const lead = read.messages.find((m) => m.id === leadId && isCustomerLeadPost(m.body));
  const sid = lead?.body ? field(lead.body, "Session") || "" : "";
  if (!validGoSession(sid)) return;
  const notes = (await readChat(sid, 0)).msgs.filter((m) => m.role === "note");
  // Already known here: the page printed it, adopted it, or a join rode on it.
  if (notes.some((m) => m.text.includes(`tracking=${tracking} `))) return;
  const leadNote = notes.find((m) => m.text.startsWith("LEAD-ID: ") && m.text.slice("LEAD-ID: ".length).trim() === leadId);
  if (!leadNote) return;
  const next = notes.find((m) => m.text.startsWith("LOCKED:") && m.ts > leadNote.ts);
  const ts = next ? Math.min(Date.now(), next.ts - 1) : Date.now();
  if (ts < leadNote.ts) return;
  await appendChatMsg(sid, "note", `LABEL: tracking=${tracking} url=${url} lead=${leadId} — minted by the team in /admin`, ts);
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
  const deviceType = typeof payload.deviceType === "string" ? payload.deviceType.slice(0, 40) : undefined;
  const replaceTracking = typeof payload.replace === "string" ? payload.replace.trim() : "";
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
    deviceKind: customer.deviceKind || deviceKindFor(deviceLabel, deviceType),
    customerReference: customer.customerReference || (deviceLabel ? String(deviceLabel).slice(0, 30) : "1 device"),
    poNumber: customer.poNumber || `TCC-${leadId}`,
  };

  // Idempotency guard. createReturnLabel hits the FedEx Ship API, which BILLS
  // per call and mints a NEW tracking number every time. If a fresh label
  // already exists (operator double-click, or the status-route auto-fire
  // raced this manual call), reuse it instead of creating — and paying for —
  // a second shipment the customer would never use.
  // Staff replacing a label on purpose (wrong address, wrong weight) name
  // the tracking on their screen: when that is still the newest label we
  // mint. findFreshLabel looks back ~60 days, so without this the Edit
  // address / Regenerate buttons silently handed back the old label. A
  // different newest label means it was already replaced — reuse that one.
  // The status auto-fire and the first-time Generate never send `replace`.
  const existing = await findFreshLabel(leadId);
  if (existing && !(replaceTracking && existing.tracking === replaceTracking)) {
    // A reuse reaches the /go thread too (2026-09-30, review) — a label
    // minted here before noteGoThread existed.
    after(() => noteGoThread(leadId, existing.tracking, existing.url).catch((e) => console.error(`[admin/label] /go thread note failed for ${leadId}`, e)));
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
  // cost= (2026-09-26): /api/lead and go-label already record it; without it
  // every staff-minted label read as "unknown cost" on the profit page.
  const markerBody = `[LABEL: ${leadId}] tracking=${label.trackingNumber} url=${labelUrl} service=${label.serviceType}${label.cost != null ? ` cost=$${label.cost}` : ""}`;
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
  // The /go thread, if this is a /go lead (2026-09-30, review).
  const mintedTracking: string = label.trackingNumber;
  after(() => noteGoThread(leadId, mintedTracking, labelUrl).catch((e) => console.error(`[admin/label] /go thread note failed for ${leadId}`, e)));

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
