import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file in form data" }, { status: 400 });

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
