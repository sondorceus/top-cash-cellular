// Lightweight error monitor — posts unhandled API failures to MC comms
// as [ERROR: <context>] events so they show up in the daily-summary
// digest and the admin can react before a customer notices. No external
// dependency (Sentry would be cleaner UI but adds 5MB + a vendor
// subscription). MC is already the single source of truth for ops so
// piggybacking on it keeps the architecture tight.
//
// Usage:
//   import { reportError } from "@/app/lib/error-report";
//   try { ... } catch (e) { reportError("fedex.label.mint", e, { leadId }); throw e; }
//
// Reports are best-effort: if MC itself is down we swallow the post so
// the original error path isn't masked by a logging failure.
//
// Skywalker 2026-05-19 gap audit, item #6.

import { notifyOwnerSms } from "./owner-sms";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "";

export type ReportOpts = {
  // Optional structured fields for grep + filtering in MC. Keep small —
  // we serialize the whole payload into the comm body.
  leadId?: string;
  customerEmail?: string;
  // Mark "critical" for failures that block customer action and should
  // SMS the owner immediately (FedEx down, Resend quota hit, MC outage).
  critical?: boolean;
  // Any extra context the caller wants to surface (sanitize PII first).
  extra?: Record<string, string | number | boolean | null | undefined>;
};

export async function reportError(
  context: string,
  err: unknown,
  opts: ReportOpts = {},
): Promise<void> {
  const errMsg =
    err instanceof Error ? `${err.name}: ${err.message}` : typeof err === "string" ? err : JSON.stringify(err);
  // Short stack — first 4 frames. Keeps the MC comm body readable.
  const stack = err instanceof Error && err.stack
    ? err.stack.split("\n").slice(0, 5).join("\n").slice(0, 1200)
    : "";

  const lines: string[] = [
    `[ERROR: ${context}]${opts.critical ? " [CRITICAL]" : ""}`,
    `Message: ${errMsg}`,
  ];
  if (opts.leadId) lines.push(`Lead: ${opts.leadId}`);
  if (opts.customerEmail) lines.push(`Customer: ${opts.customerEmail}`);
  if (opts.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      if (v == null) continue;
      lines.push(`${k}: ${String(v).slice(0, 200)}`);
    }
  }
  if (stack) lines.push("---\n" + stack);

  const body = lines.join("\n");

  // Fire-and-forget — never throw from here. The caller's original
  // exception is what matters; logging failures must not mask it.
  if (MC_KEY) {
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular",
          role: "system",
          body,
          tags: ["error", opts.critical ? "critical" : "warn"],
          priority: opts.critical ? "high" : "normal",
        }),
      });
    } catch {
      // Swallow — see comment above.
    }
  }

  // Critical errors also SMS the owner so they don't wait for the
  // morning digest. Best-effort like the MC post.
  if (opts.critical) {
    try {
      const smsBody = `🚨 TCC CRITICAL: ${context}\n${errMsg.slice(0, 200)}${opts.leadId ? `\nLead: ${opts.leadId}` : ""}`;
      await notifyOwnerSms(smsBody);
    } catch {
      // Swallow.
    }
  }

  // Always console.error so the Vercel function log captures it too.
  // Critical events also get console.error tagged for log filtering.
  // eslint-disable-next-line no-console
  console.error(`[reportError:${context}]`, errMsg, stack ? `\n${stack}` : "");
}
