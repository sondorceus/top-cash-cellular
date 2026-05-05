import { NextRequest, NextResponse } from "next/server";

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";

// Customer SMS conversation thread for a single lead. Pulls both directions
// (TCC ↔ customer) from Twilio, sorts chronologically, returns last 30.
// Read-only — sending is handled by the existing status-change flow.

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}

interface TwilioMsg {
  sid: string;
  body: string;
  direction: "inbound" | "outbound-api" | "outbound-call" | "outbound-reply";
  from: string;
  to: string;
  status: string;
  date_sent: string;
  date_created: string;
}

async function fetchTwilio(params: URLSearchParams): Promise<TwilioMsg[]> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json?${params}`;
  const r = await fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64") },
    cache: "no-store",
  });
  if (!r.ok) return [];
  const data = await r.json();
  return data.messages || [];
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone query param required" }, { status: 400 });
  const e164 = toE164(phone);
  if (!e164) return NextResponse.json({ error: "Invalid phone format" }, { status: 400 });
  if (!TWILIO_SID || !TWILIO_AUTH) {
    return NextResponse.json({ ok: true, messages: [], note: "Twilio not configured" });
  }

  // Fetch both directions in parallel.
  const [inbound, outbound] = await Promise.all([
    fetchTwilio(new URLSearchParams({ From: e164, To: TWILIO_FROM, PageSize: "30" })),
    fetchTwilio(new URLSearchParams({ From: TWILIO_FROM, To: e164, PageSize: "30" })),
  ]);

  const all = [...inbound, ...outbound]
    .map((m) => ({
      sid: m.sid,
      body: m.body,
      direction: m.direction.startsWith("inbound") ? "in" : "out",
      from: m.from,
      to: m.to,
      status: m.status,
      timestamp: m.date_sent || m.date_created,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-30);

  return NextResponse.json({ ok: true, messages: all, count: all.length });
}
