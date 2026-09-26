// Server-side email validation. Reuses the client-safe format/typo/disposable
// checks from email-format.ts and adds an MX/A DNS lookup (Node-only) so a
// fake-but-well-formed domain can't slip through. Used by /api/lead.
import { promises as dns } from "node:dns";
import { normalizeEmail, looksLikeEmail, suggestEmail, isDisposableEmail } from "./email-format";

export { normalizeEmail, looksLikeEmail, suggestEmail, isDisposableEmail } from "./email-format";

export type EmailCheck = { ok: boolean; reason?: string; suggestion?: string };

// Bounded lookups. The default resolver retries each nameserver for ~20 s
// before giving up, and /api/lead awaits this with the seller waiting; a
// lookup that timed out then fell into the "domain can't receive mail" 400.
// Every query races a 2 s ceiling, and only a definite "no such records"
// (ENOTFOUND / ENODATA, or an empty answer) may reject — a timeout or any
// other error is "unknown" and fails OPEN.
const DNS_TIMEOUT_MS = 2_000;
const resolver = new dns.Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });
type DnsOutcome = "found" | "empty" | "nx" | "unknown";
async function lookup(kind: "MX" | "A", domain: string): Promise<DnsOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const query: Promise<unknown[]> = kind === "MX" ? resolver.resolveMx(domain) : resolver.resolve(domain);
  try {
    return await Promise.race([
      query.then((rows): DnsOutcome => (Array.isArray(rows) && rows.length > 0 ? "found" : "empty")),
      new Promise<DnsOutcome>((resolve) => { timer = setTimeout(() => resolve("unknown"), DNS_TIMEOUT_MS); }),
    ]);
  } catch (e) {
    const code = (e as { code?: string })?.code || "";
    return code === "ENOTFOUND" || code === "ENODATA" ? "nx" : "unknown";
  } finally {
    clearTimeout(timer);
  }
}

// Full check. Pass { checkMx: true } on real submissions (it does a DNS lookup).
export async function validateEmail(emailRaw: string, opts: { checkMx?: boolean } = {}): Promise<EmailCheck> {
  const email = normalizeEmail(emailRaw);

  if (!looksLikeEmail(email)) {
    const s = suggestEmail(email);
    return { ok: false, reason: "That doesn't look like a valid email address.", suggestion: s || undefined };
  }

  const sug = suggestEmail(email);
  if (sug) return { ok: false, reason: `Did you mean ${sug}?`, suggestion: sug };

  if (isDisposableEmail(email)) {
    return { ok: false, reason: "Please use a real email address (temporary inboxes aren't accepted)." };
  }

  if (opts.checkMx) {
    const domain = email.split("@")[1];
    const mx = await lookup("MX", domain);
    if (mx === "empty" || mx === "nx") {
      const a = await lookup("A", domain);
      if (a === "empty" || a === "nx") {
        return {
          ok: false,
          reason: mx === "nx"
            ? "That email domain doesn't exist — please double-check it."
            : "That email domain can't receive mail — please double-check it.",
        };
      }
    }
    // "unknown" (timeout, transient DNS error): fail open, don't block a real customer.
  }

  return { ok: true };
}
