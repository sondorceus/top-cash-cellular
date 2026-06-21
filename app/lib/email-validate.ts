// Guest email validation — stops typo'd / fake / disposable emails from
// creating dead leads (and cuts form spam). Three layers:
//   1. format (a real-looking address)
//   2. typo catch + suggestion (gmial.com -> gmail.com, .con -> .com)
//   3. disposable-domain block + MX lookup (does the domain actually accept mail)
// The MX check fails OPEN on transient DNS errors so a real customer is never
// blocked by a network hiccup — it only rejects domains that definitively
// can't receive mail.
import { promises as dns } from "node:dns";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(e: string): string {
  return (e || "").trim().toLowerCase();
}

export function looksLikeEmail(e: string): boolean {
  const v = normalizeEmail(e);
  return EMAIL_RE.test(v) && !v.includes("..") && !v.startsWith(".") && v.length <= 254;
}

// Misspelled popular domains -> the correct one.
const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com", "gnail.com": "gmail.com", "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com", "gmail.co": "gmail.com", "gmailo.com": "gmail.com",
  "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "yahoo.co": "yahoo.com", "ymail.con": "ymail.com",
  "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmal.com": "hotmail.com",
  "hotmail.con": "hotmail.com", "hotmail.co": "hotmail.com", "hotnail.com": "hotmail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.con": "outlook.com",
  "iclould.com": "icloud.com", "iclod.com": "icloud.com", "icould.com": "icloud.com",
  "icloud.con": "icloud.com", "icloud.co": "icloud.com",
  "live.con": "live.com", "aol.con": "aol.com", "comcast.com": "comcast.net",
};

// TLD typos on otherwise-fine domains.
function fixTld(domain: string): string | null {
  if (domain.endsWith(".con")) return domain.slice(0, -4) + ".com";
  if (domain.endsWith(".cmo")) return domain.slice(0, -4) + ".com";
  if (domain.endsWith(".vom")) return domain.slice(0, -4) + ".com";
  if (domain.endsWith(".cm")) return domain.slice(0, -3) + ".com";
  if (/(gmail|yahoo|hotmail|outlook|icloud|live|aol)\.co$/.test(domain)) return domain.slice(0, -3) + ".com";
  return null;
}

// If the address has an obvious typo, return the corrected version.
export function suggestEmail(email: string): string | null {
  const e = normalizeEmail(email);
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (DOMAIN_TYPOS[domain]) return `${local}@${DOMAIN_TYPOS[domain]}`;
  const tld = fixTld(domain);
  if (tld && tld !== domain) return `${local}@${tld}`;
  return null;
}

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "10minutemail.com",
  "tempmail.com", "temp-mail.org", "throwawaymail.com", "yopmail.com", "trashmail.com",
  "getnada.com", "sharklasers.com", "dispostable.com", "maildrop.cc", "fakeinbox.com",
  "mailnesia.com", "tempmailo.com", "emailondeck.com", "mintemail.com", "spam4.me",
  "grr.la", "guerrillamail.biz", "mohmal.com", "tmail.com", "tmpmail.org", "33mail.com",
]);

export function isDisposableEmail(email: string): boolean {
  const d = normalizeEmail(email).split("@")[1] || "";
  return DISPOSABLE.has(d);
}

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
        // Some valid domains accept mail on the A record (RFC 5321 fallback);
        // only reject when there's no MX AND no A record.
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
