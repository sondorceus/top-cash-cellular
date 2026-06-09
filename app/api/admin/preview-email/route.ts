import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";

// Admin-gated email preview — Skywalker 2026-05-19 wanted to check that
// the /api/confirm template renders cleanly on desktop (the live email
// only shows up in the customer's inbox). This endpoint synthesizes a
// sample payload and returns the HTML so you can pop it open in the
// browser at any width to verify spacing, FedEx wordmark, etc.
//
//   GET /api/admin/preview-email?token=<TCC_ADMIN_TOKEN>
//   GET /api/admin/preview-email?token=<...>&ship=0   (local-handoff variant)
//   GET /api/admin/preview-email?token=<...>&multi=1  (multi-device variant)
//
// Returns text/html so the browser renders it directly. No Resend call,
// no MC post, no side effects.

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (!safeEqual(q.get("token"), ADMIN_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isShip = q.get("ship") !== "0";
  const isMulti = q.get("multi") === "1";
  const payload = {
    name: "Sample Customer",
    email: "preview@topcashcellular.com",
    phone: "5125550100",
    handoffMethod: isShip ? "ship" : "local",
    fedexLabel: isShip
      ? {
          tracking: "794818590432",
          url: "https://ut6nohctxlfcqfaf.public.blob.vercel-storage.com/fedex-labels/preview-label.pdf",
          service: "FEDEX_GROUND",
        }
      : null,
    payout: isShip ? "Cash App" : "Cash",
    model: isMulti ? undefined : "iPhone 17 Pro Max",
    storage: isMulti ? undefined : "256 GB",
    condition: isMulti ? undefined : "Excellent",
    quote: isMulti ? undefined : 712,
    devices: isMulti
      ? [
          { model: "iPhone 17 Pro Max", storage: "256 GB", condition: "Excellent", quote: 712, quantity: 1 },
          { model: 'MacBook Pro 14" M4', storage: "1 TB", condition: "Good", quote: 1100, quantity: 1 },
        ]
      : [],
  };
  // Just delegate to the same code path /api/confirm uses by POSTing
  // to ourselves at /api/confirm — but that would actually SEND an
  // email via Resend. Instead we re-build the template inline by
  // fetching the route source... too brittle. Simpler: call confirm
  // with a synthetic mode that returns the HTML instead of sending.
  // For now, inline a slim recreate so the preview shows the structure
  // changes without firing Resend.
  //
  // Note this is INTENTIONALLY a slim recreation — to truly preview
  // the live template I would need to refactor /api/confirm to expose
  // its HTML builder as a function. That's a follow-up. For now this
  // gives a fast visual smoke test of the wrapper + FedEx wordmark.
  const sampleHtml = await buildPreview(payload);
  return new NextResponse(sampleHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function buildPreview(p: {
  name: string;
  email: string;
  phone: string;
  handoffMethod: string;
  fedexLabel: { tracking: string; url: string; service: string } | null;
  payout: string;
  model?: string;
  storage?: string;
  condition?: string;
  quote?: number;
  devices: Array<{ model: string; storage: string; condition: string; quote: number; quantity: number }>;
}): Promise<string> {
  // Pull the exact template by importing the helper. /api/confirm
  // doesn't currently export a builder, so this is a slim inline
  // duplicate that mirrors the production template wrapper. Once
  // /api/confirm is refactored to export buildConfirmHtml(), swap to
  // that import for true source-of-truth parity.
  const isShipping = p.handoffMethod === "ship";
  const hasLabel = isShipping && !!p.fedexLabel;
  const isMulti = p.devices.length > 1;
  const model = isMulti ? `${p.devices.length} devices` : p.model || "—";
  const storage = isMulti ? "Multiple" : p.storage || "N/A";
  const condition = isMulti ? "See list below" : p.condition || "—";
  const quote = isMulti ? p.devices.reduce((s, d) => s + d.quote * (d.quantity || 1), 0) : p.quote || 0;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview — TCC confirmation</title></head>
<body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;color:#e6e6e6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#13142b;background-image:radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.22) 0%, transparent 62%)">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;margin:0 auto;border-collapse:separate;background:#13142b;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.45)">

<tr><td style="padding:28px 28px;border-bottom:1px solid rgba(255,255,255,0.12)">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle">
<img src="https://topcashcellular.com/logo-wordmark-glass.png" alt="Top Cash Cellular" width="150" style="display:block;width:150px;height:auto;border:0;outline:none;margin:0" />
<div style="font-size:24px;font-weight:800;color:#ffffff;line-height:1.15">You're locked in</div>
</td>
<td style="vertical-align:middle;text-align:right">
<div style="display:inline-block;padding:8px 14px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);border-radius:999px;font-size:11px;font-weight:800;color:#ffffff;letter-spacing:0.1em;text-transform:uppercase">Austin, TX</div>
</td></tr></table>
</td></tr>

<tr><td style="padding:28px 28px 12px 28px">
<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Hi ${p.name},</div>
<div style="font-size:14px;color:#bdbdbd;line-height:1.6">Below is everything you need for a successful trade-in. (PREVIEW MODE — slim recreate, see app/api/confirm for live template.)</div>
</td></tr>

<tr><td style="padding:6px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:14px">
<tr><td style="padding:22px 24px;text-align:center">
<div style="font-size:10px;color:#00c853;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:6px;font-weight:800">Locked-In Offer</div>
<div style="font-size:48px;font-weight:800;color:#00c853;line-height:1;text-shadow:0 0 18px rgba(0,200,83,0.4)">$${quote}</div>
<div style="font-size:11px;color:#888;margin-top:10px;letter-spacing:0.08em;text-transform:uppercase">${model} · ${storage} · ${condition}</div>
</td></tr></table>
</td></tr>

${hasLabel ? `
<tr><td style="padding:24px 28px 8px 28px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px"><tr>
  <td style="vertical-align:middle;padding-right:10px">
    <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:900;font-size:26px;letter-spacing:-1.5px;line-height:1">
      <span style="color:#4D148C">Fed</span><span style="color:#FF6600">Ex</span>
    </span>
  </td>
  <td style="vertical-align:middle;border-left:1px solid rgba(255,255,255,0.18);padding-left:12px">
    <div style="font-size:10px;color:#00c853;letter-spacing:0.18em;text-transform:uppercase;font-weight:800">Prepaid return label</div>
    <div style="font-size:11px;color:#a8a8a8;margin-top:2px">Generated at submit · billed to TCC</div>
  </td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(0,200,83,0.30);border-radius:14px">
<tr><td style="padding:18px 20px">
<div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#00c853;font-weight:800;margin-bottom:6px">Tracking</div>
<div style="font-size:16px;color:#fff;font-weight:700;font-family:ui-monospace,SFMono-Regular,monospace">${p.fedexLabel?.tracking}</div>
<div style="font-size:12px;color:#b8b8b8;margin-top:4px">FedEx Ground · prepaid · drop at any FedEx location</div>
<div style="margin-top:14px;text-align:center">
<a href="${p.fedexLabel?.url}" style="display:inline-block;padding:13px 28px;background:linear-gradient(180deg,#00c853 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px">Download label PDF</a>
</div>
</td></tr></table>
</td></tr>` : ""}

<tr><td style="padding:24px 28px 28px 28px">
<div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:18px"></div>
<div style="text-align:center">
<a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-size:14px;font-weight:700">support@topcashcellular.com</a>
<div style="font-size:12px;color:#666;line-height:1.5;margin-top:6px">Top Cash Cellular · Austin, TX</div>
</div>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}
