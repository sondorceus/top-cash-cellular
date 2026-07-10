import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { clientIp, rateLimit, rateLimitResponse } from "../../lib/rate-limit";
import { safeEqual } from "../../lib/admin-auth";

// Customer photo upload. Funnel posts JPEG/PNG/WEBP captures of the
// device for the AI fraud + condition check on the lead side. Hardened
// 2026-05-24: was previously unauthenticated with no MIME/size/rate
// validation — a scripted client could burn Blob storage at will.
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB / file
const UPLOAD_LIMIT = 12; // uploads per IP per 10-min window
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

// Magic-byte sniff. file.type is client-supplied — spoofable, and empty on
// some HEIC captures — so the declared MIME can't be trusted. This inspects
// the actual leading bytes and is the one check a lying client can't bypass.
function sniffAllowedImage(head: Buffer): boolean {
  if (head.length < 12) return false;
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true; // JPEG
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true; // PNG
  if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") return true; // WEBP
  if (head.toString("ascii", 4, 8) === "ftyp") { // HEIC/HEIF (ISO-BMFF)
    const brand = head.toString("ascii", 8, 12).toLowerCase();
    if (/heic|heif|heix|hevc|hevm|hevs|heim|heis|mif1|msf1/.test(brand)) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  // Per-IP rate limit. 12 uploads per 10 min covers a legit customer
  // photographing every angle of one device with retries; rejects
  // scripted Blob-quota floods. A valid admin token bypasses the cap —
  // posting a batch of shop listings (up to 8 photos each) from
  // /admin/shop would trip it in one device and a half otherwise.
  const isAdmin = safeEqual(req.headers.get("x-admin-token"), process.env.TCC_ADMIN_TOKEN);
  if (!isAdmin) {
    const ip = clientIp(req);
    const rl = rateLimit(`upload:${ip}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS);
    if (!rl.ok) return rateLimitResponse(rl.retryAfterMs, "Too many uploads — wait a moment and try again.");
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file in form data" }, { status: 400 });

    // Defense-in-depth validation. file.type is supplied by the client
    // and can be spoofed, but combined with the size cap and the
    // safeName extension scrub it's still meaningful protection vs
    // casual abuse. (For stronger validation we'd sniff magic bytes;
    // overkill here.)
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File size must be 1 byte – ${Math.round(MAX_BYTES / 1024 / 1024)}MB.` }, { status: 413 });
    }
    if (file.type && !ALLOWED_MIME.has(file.type.toLowerCase())) {
      return NextResponse.json({ error: `Unsupported file type "${file.type}". Use JPEG, PNG, WEBP, or HEIC.` }, { status: 415 });
    }
    // Authoritative check: verify the real bytes, not the (spoofable, possibly
    // empty) declared type — closes the "blank Content-Type stores arbitrary
    // bytes as a public blob" bypass, which matters since these URLs are later
    // fed to the vision model.
    const head = Buffer.from(await file.slice(0, 16).arrayBuffer());
    if (!sniffAllowedImage(head)) {
      return NextResponse.json({ error: "That file doesn't look like a JPEG, PNG, WEBP, or HEIC image." }, { status: 415 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Storage not configured — BLOB_READ_WRITE_TOKEN missing on server" },
        { status: 500 },
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "photo.jpg";
    const blob = await put(`devices/${Date.now()}-${safeName}`, file, {
      access: "public",
    });
    return NextResponse.json({ url: blob.url, size: file.size, type: file.type });
  } catch (err) {
    const msg = (err as Error).message || "Unknown server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
