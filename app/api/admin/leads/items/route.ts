// POST /api/admin/leads/items
//
// Staff-side device correction. Used at handoff / inspection when
// the customer-submitted model turns out to be wrong (Rudy claimed
// "iPhone 14 Pro Max", physical device is "iPhone 14"). Re-uses the
// existing [ITEM-UPDATE: leadId] marker — same machinery the admin
// + offer GET routes already parse for customer-side edits, so the
// corrected device automatically becomes the canonical record on
// every subsequent admin refresh.
//
// Differs from the customer endpoint at /api/offer/[leadId]/items:
//   - admin-token gated (no "leadId is the secret" trust model)
//   - no status-lock — staff are the ones inspecting; if the device
//     is in the building they can correct it whether it's "received"
//     or "tested"
//   - no customer SMS — owner is doing the editing
//   - carries `imei` per device (the customer endpoint doesn't),
//     which is the whole point of this flow
//
// Marker body shape (same as the customer flow but tagged "Staff"):
//   [ITEM-UPDATE: <leadId>] Staff corrected device specs — total $N.
//   {"v":1,"devices":[…with imei…],"total":N,"source":"admin"}

import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

// Same sanitizer the offer endpoint uses — strip brackets / newlines
// so a stray ']' can't fake a downstream tag like [STATUS: …].
function clean(s: unknown, max: number): string {
  return String(s ?? "").replace(/[\[\]\n\r\t]/g, " ").trim().slice(0, max);
}

// IMEIs are 15 digits; strip non-digits then sanity-check length so a
// formatted "353 240..." pastes the same as a bare "353240...".
function normalizeImei(s: unknown): string {
  const digits = String(s ?? "").replace(/\D/g, "");
  return digits.length === 15 ? digits : "";
}

type InDevice = {
  model?: unknown;
  storage?: unknown;
  condition?: unknown;
  carrier?: unknown;
  quote?: unknown;
  quantity?: unknown;
  imei?: unknown;
  needsReview?: unknown;
};

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!MC_KEY) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  let payload: { leadId?: unknown; devices?: unknown; note?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const leadId = typeof payload.leadId === "string" ? payload.leadId.trim() : "";
  if (!leadId || !/^[\w-]+$/.test(leadId)) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }
  if (!Array.isArray(payload.devices) || payload.devices.length === 0 || payload.devices.length > 10) {
    return NextResponse.json({ error: "Send 1–10 devices." }, { status: 400 });
  }
  const note = typeof payload.note === "string" ? clean(payload.note, 200) : "";

  const devices = (payload.devices as InDevice[]).map((d) => {
    const quote = Math.round(Number(d.quote));
    const quantity = Math.round(Number(d.quantity) || 1);
    return {
      model: clean(d.model, 80),
      storage: clean(d.storage, 30),
      condition: clean(d.condition, 30),
      carrier: clean(d.carrier, 30),
      quote: Number.isFinite(quote) && quote >= 0 && quote <= 100000 ? quote : 0,
      quantity: quantity >= 1 && quantity <= 50 ? quantity : 1,
      imei: normalizeImei(d.imei),
      // Keep the same `needsReview` semantics as the customer flow,
      // even though admin edits rarely set it (staff are reviewing
      // BY making the edit). Carried through for parser symmetry.
      needsReview: !!d.needsReview,
    };
  });
  if (devices.some((d) => !d.model)) {
    return NextResponse.json({ error: "Every device needs a model." }, { status: 400 });
  }

  // Verify the lead actually exists before we post a correction; an
  // [ITEM-UPDATE] marker with no matching [LEAD: …] is harmless data
  // litter on MC but confusing in audit logs.
  let leadOk = false;
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (r.ok) {
      const data = await r.json();
      const messages: { id: string; body?: string }[] = data.messages || [];
      leadOk = messages.some((m) => m.id === leadId && /\[NEW BUYBACK LEAD/i.test(m.body || ""));
    }
  } catch { /* handled below */ }
  if (!leadOk) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Total is the sum of line totals (matches the customer flow's math).
  const total = devices.reduce((s, d) => s + d.quote, 0);
  const json = JSON.stringify({ v: 1, devices, total, source: "admin" });
  const lead = note
    ? `Staff corrected device specs — total $${total}. ${note}`
    : `Staff corrected device specs — total $${total}.`;
  const updateBody = `[ITEM-UPDATE: ${leadId}] ${lead} ${json}`;

  try {
    const postRes = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "Staff Device Correction",
        role: "system",
        body: updateBody,
        tags: ["item-update", "staff-correction"],
        priority: "high",
      }),
    });
    if (!postRes.ok) {
      return NextResponse.json({ error: `MC HTTP ${postRes.status}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, leadId, devices, total });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC unavailable" }, { status: 502 });
  }
}
