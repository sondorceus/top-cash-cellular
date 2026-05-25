// POST /api/admin/fedex/regenerate?token=<...>
// Body: { leadId }
//
// Staff-triggered manual retry of a failed FedEx label. Wraps the same
// retryFedexLabel() the cron uses, so both paths produce identical
// markers + outcomes. Returns the new tracking + URL on success, or a
// classified error on failure so the admin UI can show actionable copy.

import { NextRequest, NextResponse } from "next/server";
import { retryFedexLabel } from "../../../../lib/fedex-retry";

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || (() => { throw new Error("TCC_ADMIN_TOKEN env required"); })();

export async function POST(req: NextRequest) {
  if (
    req.nextUrl.searchParams.get("token") !== ADMIN_TOKEN &&
    req.headers.get("x-admin-token") !== ADMIN_TOKEN
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let payload: { leadId?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const leadId = typeof payload.leadId === "string" ? payload.leadId.trim() : "";
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const result = await retryFedexLabel(leadId);
  if (result.ok) return NextResponse.json({ ok: true, label: result.label });
  // Status codes: ADDRESS_INVALID/WRONG_HANDOFF/NOT_FOUND → 400 (caller can't retry as-is)
  // SERVICE_UNAVAILABLE → 502 (transient — caller can retry)
  // ALREADY_LABELED → 200 (no-op)
  if (result.kind === "ALREADY_LABELED") return NextResponse.json({ ok: true, alreadyLabeled: true });
  const status = result.kind === "SERVICE_UNAVAILABLE" ? 502 : 400;
  return NextResponse.json({ ok: false, kind: result.kind, error: result.error }, { status });
}
