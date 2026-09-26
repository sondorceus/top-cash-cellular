import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../../lib/admin-auth";
import { fetchCommsRead } from "../../../../lib/mc-comms";
import { latestStatus } from "../../../../lib/lead-devices";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
// Server-only. The NEXT_PUBLIC_ fallback was removed: a NEXT_PUBLIC_ var
// is the master MC credential and must never be bundle-eligible. MC_API_KEY
// is set server-side in prod (the whole lead pipeline relies on it), so the
// fallback was dead weight that kept the dangerous public-var alive.
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

// Soft-delete a lead. MC /api/comms doesn't support DELETE, so we post
// a marker message that the admin GET route filters out. The original
// lead stays in MC for audit, but disappears from the admin feed.
//
// Hard-delete (PII scrub) would require MC server changes — flagged as
// follow-up if Skywalker wants full GDPR-style removal.

function checkAuth(req: NextRequest): boolean {
  // Header only (2026-09-26): a ?token= in the URL put the admin secret in
  // request logs and browser history. proxy.ts sets this header for a Google
  // admin session; server-side callers already send it.
  return safeEqual(req.headers.get("x-admin-token"), ADMIN_TOKEN);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let leadId = "";
  let reason = "";
  try {
    const body = await req.json();
    leadId = String(body?.leadId || "").trim();
    // Strip `[` and `]` from reason — it's interpolated into the
    // [DELETED-LEAD: ...] [REASON: ...] marker, and the admin parser
    // scans for [STATUS:] / [LEAD:] anywhere in any body. A reason
    // like "] [STATUS: paid] [LEAD: victimId]" would close the
    // REASON marker and inject a status flip on a target lead.
    reason = String(body?.reason || "").replace(/[\[\]]/g, "").trim().slice(0, 300);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }
  // leadId is consumed by both the marker AND by the response — only
  // accept the MC-generated shape (alphanumeric + dashes) so an
  // attacker can't smuggle markers via leadId either.
  if (!/^[\w-]{1,64}$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid leadId" }, { status: 400 });
  }

  // Fast-fail if MC_API_KEY isn't configured — surface a specific
  // error message so the admin UI shows "MC API key not configured"
  // instead of a generic 502 (which tripped Skywalker on 2026-05-17).
  if (!MC_KEY) {
    return NextResponse.json(
      { error: "MC API key not configured on Vercel — set MC_API_KEY (server-only)." },
      { status: 503 },
    );
  }

  // A paid/met lead is money already out the door: trashing it drops it from
  // the roster and analytics at once and (after 24 h) from Active. Require a
  // reason so a mis-tap on the phone can't silently bury it (2026-09-26).
  // The read fails closed — the marker post below needs MC anyway.
  const read = await fetchCommsRead({ apiKey: MC_KEY, pageSize: 5000, maxPages: 6, includeArchive: true, memoMs: 3_000 });
  if (!read.complete || read.messages.length === 0) {
    return NextResponse.json({ error: "Couldn't read the lead's status from Mission Control — nothing was trashed. Try again." }, { status: 502 });
  }
  const current = latestStatus(read.messages, leadId);
  if ((current === "paid" || current === "met") && reason.length < 5) {
    return NextResponse.json(
      { error: `This lead is ${current} — give a reason (5+ characters) to move it to Trash.`, needsReason: true, current },
      { status: 422 },
    );
  }

  // Post the soft-delete marker to MC comms.
  const markerBody = `[DELETED-LEAD: ${leadId}]${reason ? ` [REASON: ${reason}]` : ""}`;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular (admin)",
        role: "system",
        body: markerBody,
        tags: ["lead-deleted"],
        priority: "low",
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return NextResponse.json(
        { error: `MC returned ${r.status}${body ? ` — ${body.slice(0, 200)}` : ""}` },
        { status: 502 },
      );
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC error" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, leadId });
}
