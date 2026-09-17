// Customer referral program — shared config + helpers.
// Skywalker 2026-05-22 "build a referral program".
//
// There's no SQL database — the whole program lives as "marker"
// comm messages in Mission Control, the same way coupons, statuses,
// and FedEx events do. Two marker types:
//
//   [REFERRAL-CODE: code=REF-XXXXXX email=foo@bar.com]
//     posted when a customer's code is shown to them (the /account
//     dashboard via /api/referral, and the /offer page via the offer GET)
//     and no marker is in the recent comms window. Maps a referral code
//     back to its owner's email.
//
//   [REFERRAL-EARNED: referrer=foo@bar.com amount=10 code=REF-XXXXXX referee-lead=<leadId>]
//     posted once when a referee's trade completes (status flips to
//     paid/met). One per referee-lead — scan-before-post avoids
//     double-crediting if a lead's status is re-flipped.
//
// This module is the single source of truth for the two payout
// numbers and the code-derivation logic so the API route, the funnel,
// the lead route, and the admin status route all agree.

import crypto from "crypto";
import { isCustomerLeadPost } from "./lead-devices";

// --- Config constants — change here, applies everywhere ---------------
// Dollars added to a NEW customer's payout when they redeem a referral
// code on their first trade. Applied flat, the same way a coupon's
// dollar value is applied in /api/lead.
export const REFERRAL_REFEREE_BONUS = 10;
// Dollars the referrer earns once their referee's trade completes
// (admin flips the referee's lead to paid or met).
export const REFERRAL_REFERRER_REWARD = 10;

// Public-facing referral code pattern: REF- + 6 uppercase alphanumeric.
// Used everywhere a code is validated (funnel, lead route, admin route).
export const REFERRAL_CODE_RE = /^REF-[A-Z0-9]{6}$/;

// Generate a customer's referral code deterministically from their
// email. SHA-256 the lowercased+trimmed email, take the hex digest,
// and map the first 6 hex nibbles onto a 32-char alphanumeric alphabet
// (0-9 + A-Z minus the visually-ambiguous I/O/0/1 — keeps codes easy
// to read aloud and re-type). Same email always yields the same code,
// so we never need to "store" the code itself — only the code→email
// mapping marker, posted once for reverse lookup.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars, no I/O/0/1
export function referralCodeForEmail(email: string): string {
  const normalized = (email || "").toLowerCase().trim();
  const hash = crypto.createHash("sha256").update(normalized).digest();
  let code = "";
  for (let i = 0; i < 6; i++) {
    // One byte per character — modulo 32 maps cleanly onto the alphabet.
    code += CODE_ALPHABET[hash[i] % CODE_ALPHABET.length];
  }
  return `REF-${code}`;
}

// Build the share link a customer hands to a friend. The funnel reads
// the ?ref= param off this URL on mount.
export function referralLinkForCode(code: string): string {
  return `https://topcashcellular.com/?ref=${code}`;
}

// Same marker regex /api/lead and /api/referral resolve codes with.
const REFERRAL_CODE_MARKER_RE = /\[REFERRAL-CODE:\s*code=(REF-[A-Z0-9]{6})\s+email=([^\s\]]+)/i;

// The [REFERRAL-CODE:] reverse-lookup marker body for a code + its owner's
// email, or null when the email can't be written safely (the email must be
// one token with no marker delimiters, or the lookup regex can't read it
// back / a crafted value could close the marker).
export function referralCodeMarker(code: string, email: string): string | null {
  const e = (email || "").toLowerCase().trim();
  if (!REFERRAL_CODE_RE.test(code) || !/^[^\s@[\]]+@[^\s@[\]]+\.[^\s@[\]]+$/.test(e)) return null;
  return `[REFERRAL-CODE: code=${code} email=${e}]`;
}

// True when `messages` already carry a [REFERRAL-CODE:] marker for `code`.
// A copy inside a customer lead body doesn't count (/api/lead ignores it).
export function hasReferralCodeMarker(messages: { body?: string }[], code: string): boolean {
  return messages.some((m) => {
    if (isCustomerLeadPost(m.body)) return false;
    const cm = m.body?.match(REFERRAL_CODE_MARKER_RE);
    return !!cm && cm[1].toUpperCase() === code;
  });
}
