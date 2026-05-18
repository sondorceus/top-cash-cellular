// Shared helper — log a customer-facing comm (SMS or email) to MC so
// the admin lead row can show "💬 3 SMS · ✉️ 2 emails · last 2h ago".
// Skywalker 2026-05-18 — communication audit trail. Called from every
// admin route that sends to a customer (status / label / label-resend
// / adjust / sms). Best-effort: failures don't break the underlying
// send, they just leave the lead's count un-incremented.
//
// Marker format: "[COMM-SENT: <leadId>] channel=<sms|email>
// kind=<status|label|adjust|resend> to=<sanitized> subject=<…>"

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

type LogArgs = {
  leadId: string;
  channel: "sms" | "email";
  kind: "status" | "label" | "label-resend" | "adjust" | "manual";
  to: string;
  // One-line summary so a human skimming MC comms can see what went
  // out. Truncated + newlines collapsed when written to the marker.
  subject?: string;
};

export async function logComm(args: LogArgs): Promise<void> {
  if (!args.leadId || !MC_KEY) return;
  const subject = args.subject
    ? ` subject=${args.subject.replace(/[\r\n]+/g, " ").slice(0, 140)}`
    : "";
  const body = `[COMM-SENT: ${args.leadId}] channel=${args.channel} kind=${args.kind} to=${sanitizeTo(args.to)}${subject}`;
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body,
        tags: ["comm-sent", args.channel, args.kind],
        priority: "low",
      }),
    });
  } catch {
    // Non-fatal — the underlying message already went out.
  }
}

function sanitizeTo(to: string): string {
  if (!to) return "";
  // Email: keep local-part + @domain; strip names/spaces.
  if (to.includes("@")) return to.trim().slice(0, 80);
  // Phone: strip non-digits, keep first 11, last 4 visible (mask middle).
  const digits = to.replace(/\D/g, "");
  if (digits.length >= 10) {
    return `***-***-${digits.slice(-4)}`;
  }
  return to.slice(0, 30);
}
