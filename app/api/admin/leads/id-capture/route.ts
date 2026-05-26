import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

// Texas Secondhand Dealer Act compliance — captures the seller's
// government-ID photo + DOB + ID number when staff handles a buyback.
// Skywalker 2026-05-18 #2 from the 8-item ask. Triggered manually in
// /admin at handoff (or before payout for ship-handoff leads).
//
// Storage caveat: Vercel Blob is public-URL-only. We mitigate with a
// 32-random-byte suffix in the blob path so URLs are unguessable, but
// once an admin sees the URL it's permanent. Acceptable for now (the
// admin page itself is OAuth-gated to allowlisted emails); upgrade to
// a server-only signed-URL store before scaling staff headcount.
//
// Marker format (posted to MC):
//   "[ID-CAPTURED: <leadId>] type=DL id_last4=1234 dob_year=1989 photo=<blob-url>"
// We deliberately store only the LAST 4 of the ID number and the
// YEAR of birth in the marker — full ID# stays only on the photo,
// reducing surface area for any future MC export/dump.

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

// Feature flag. Skywalker 2026-05-18 "we are small, can't store
// private info safely yet". Vercel Blob is public-URL-only — fine
// for device photos, NOT fine for government IDs even with random
// path suffixes. Endpoint refuses calls until proper signed-URL
// storage is in place. Flip TCC_ID_CAPTURE_ENABLED=true to re-enable.
const ID_CAPTURE_ENABLED = process.env.TCC_ID_CAPTURE_ENABLED === "true";

export async function POST(req: NextRequest) {
  if (!ID_CAPTURE_ENABLED) {
    return NextResponse.json(
      { error: "ID capture is disabled — needs secure-storage upgrade before re-enabling. Set TCC_ID_CAPTURE_ENABLED=true once signed-URL Blob storage is in place." },
      { status: 410 },
    );
  }
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Storage not configured — BLOB_READ_WRITE_TOKEN missing" }, { status: 500 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Multipart form data required" }, { status: 400 });
  }
  const leadId = String(form.get("leadId") || "").trim();
  const idType = String(form.get("idType") || "").trim().toUpperCase();
  const idNumber = String(form.get("idNumber") || "").trim();
  const dob = String(form.get("dob") || "").trim(); // YYYY-MM-DD
  const file = form.get("photo") as File | null;

  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  if (!idType || !["DL", "STATE_ID", "PASSPORT", "MILITARY", "OTHER"].includes(idType)) {
    return NextResponse.json({ error: "idType must be one of DL, STATE_ID, PASSPORT, MILITARY, OTHER" }, { status: 400 });
  }
  if (!idNumber || idNumber.length < 4) {
    return NextResponse.json({ error: "idNumber required (min 4 chars)" }, { status: 400 });
  }
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return NextResponse.json({ error: "dob required as YYYY-MM-DD" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "photo (ID image) file required" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo too large (max 10MB)" }, { status: 400 });
  }

  // Unguessable path — 32 random bytes = 256 bits of entropy.
  const suffix = randomBytes(32).toString("hex");
  const ext = (file.name.match(/\.[a-zA-Z0-9]{1,5}$/)?.[0] || ".jpg").toLowerCase();
  let blobUrl = "";
  try {
    const blob = await put(`customer-ids/${leadId}/${suffix}${ext}`, file, {
      access: "public",
      contentType: file.type || "image/jpeg",
    });
    blobUrl = blob.url;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Blob upload failed" }, { status: 502 });
  }

  const last4 = idNumber.replace(/\s/g, "").slice(-4);
  const dobYear = dob.slice(0, 4);
  const marker = `[ID-CAPTURED: ${leadId}] type=${idType} id_last4=${last4} dob_year=${dobYear} photo=${blobUrl}`;
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: marker,
        tags: ["id-captured", "compliance"],
        priority: "low",
      }),
    });
  } catch {}

  return NextResponse.json({ ok: true, idType, last4, dobYear, photoUrl: blobUrl });
}
