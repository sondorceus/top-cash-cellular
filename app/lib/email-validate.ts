// Server-side email validation. Reuses the client-safe format/typo/disposable
// checks from email-format.ts and adds an MX/A DNS lookup (Node-only) so a
// fake-but-well-formed domain can't slip through. Used by /api/lead.
import { promises as dns } from "node:dns";
import { normalizeEmail, looksLikeEmail, suggestEmail, isDisposableEmail } from "./email-format";

export { normalizeEmail, looksLikeEmail, suggestEmail, isDisposableEmail } from "./email-format";

export type EmailCheck = { ok: boolean; reason?: string; suggestion?: string };

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
    try {
      const mx = await dns.resolveMx(domain);
      if (!mx || mx.length === 0) {
        try { await dns.resolve(domain); } catch { return { ok: false, reason: "That email domain can't receive mail — please double-check it." }; }
      }
    } catch (e) {
      const code = (e as { code?: string })?.code || "";
      if (code === "ENOTFOUND" || code === "ENODATA") {
        try { await dns.resolve(domain); } catch { return { ok: false, reason: "That email domain doesn't exist — please double-check it." }; }
      }
      // Any other (transient) DNS error: fail open, don't block a real customer.
    }
  }

  return { ok: true };
}
