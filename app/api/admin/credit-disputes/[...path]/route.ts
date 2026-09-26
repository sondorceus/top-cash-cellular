import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/app/lib/admin-auth";

// Proxies the credit-intake operator API so the dashboard can live natively
// inside the TCC admin. The intake operator key stays server-side here (never
// shipped to the browser); auth reuses the same x-admin-token gate as every
// other /api/admin route (proxy.ts injects it for a valid Google admin session).
export const runtime = "nodejs";

const BASE = process.env.CREDIT_INTAKE_URL || "https://credit-intake.vercel.app";
const OP_KEY = process.env.CREDIT_INTAKE_OPERATOR_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

function authed(req: NextRequest): boolean {
  // Header only (2026-09-26): ?token= put the admin secret in request logs.
  return safeEqual(req.headers.get("x-admin-token"), ADMIN_TOKEN);
}

function cleanSearch(req: NextRequest): string {
  const sp = new URLSearchParams(req.nextUrl.search);
  sp.delete("token"); // never forward the TCC admin token to the intake API
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function forward(req: NextRequest, path: string[]) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OP_KEY) {
    return NextResponse.json({ error: "CREDIT_INTAKE_OPERATOR_KEY not configured" }, { status: 500 });
  }
  const url = `${BASE}/api/operator/${path.map(encodeURIComponent).join("/")}${cleanSearch(req)}`;
  const init: RequestInit = { method: req.method, headers: { "x-operator-key": OP_KEY } };
  if (req.method === "POST" || req.method === "PUT") {
    (init.headers as Record<string, string>)["content-type"] = "application/json";
    init.body = await req.text();
  }
  const res = await fetch(url, init);
  const headers = new Headers({ "cache-control": "no-store" });
  const ct = res.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const cd = res.headers.get("content-disposition");
  if (cd) headers.set("content-disposition", cd);
  // The console only ever DISPLAYS a client's SSN, so the full number never
  // needs to reach the browser: every `ssn` field in a JSON body is masked to
  // its last 4 before it leaves the server (2026-09-26). File downloads and
  // other content types stream through untouched.
  if (ct && /application\/json/i.test(ct)) {
    const text = await res.text();
    return new NextResponse(maskSsn(text), { status: res.status, headers });
  }
  return new NextResponse(res.body, { status: res.status, headers });
}

function maskSsn(text: string): string {
  const mask = (v: string): string => {
    const d = v.replace(/\D/g, "");
    return d.length >= 4 ? `•••-••-${d.slice(-4)}` : "••••";
  };
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = /^ssn$/i.test(k) && typeof val === "string" ? mask(val) : walk(val);
      }
      return out;
    }
    return v;
  };
  try {
    return JSON.stringify(walk(JSON.parse(text)));
  } catch {
    return text; // not JSON after all — pass through
  }
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).path); }
export async function POST(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).path); }
export async function DELETE(req: NextRequest, ctx: Ctx) { return forward(req, (await ctx.params).path); }
