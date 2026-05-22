// Payout-handle verification helpers.
//
// Two methods get extra validation past the existing double-entry match:
//   * Bitcoin — full checksum validation via bitcoin-address-validation
//     (mainnet only; rejects testnet/regtest/signet so a customer can't
//     accidentally paste a non-payable test address). Definitive: a
//     checksum failure means the payout would bounce, so the funnel
//     hard-blocks advancing past the payout step.
//   * Cash App — cheap format check ($ + alphanumeric handle) + a
//     best-effort scrape of the public cash.app profile page to confirm
//     the handle actually exists. The scrape is fragile (Cloudflare in
//     front, no documented API, may break any time), so its result is
//     advisory — only format failures hard-block; "not found" / "unknown"
//     show an amber warning but still let the customer continue.
//
// Hand-rolled BTC checksum code is too error-prone for money, so we lean
// on a dedicated package (bitcoin-address-validation@3) that handles
// P2PKH (1…), P2SH (3…), bech32 P2WPKH/P2WSH (bc1q…) and taproot
// P2TR (bc1p…).
import { validate as validateBtc, Network } from "bitcoin-address-validation";

// Strict $cashtag format. Cash App's published rule is: starts with $,
// then a letter, then 0-19 more alphanumerics (so 1-20 chars after the $
// total, max length including $ is 21). We deliberately keep the
// alphabet permissive (just A-Z/a-z/0-9) instead of trying to mirror
// every Cash App edge case — the actual existence scrape is the real
// filter. Skywalker 2026-05-22.
const CASHTAG_RE = /^\$[A-Za-z][A-Za-z0-9]{0,19}$/;

/**
 * Validate a mainnet Bitcoin address (checksum + network check).
 * Trims input first. Returns true only when the package confirms the
 * address parses as mainnet — testnet/regtest/signet addresses return
 * false so a customer can't accidentally paste a non-payable test addr.
 */
export function validateBtcAddress(addr: string): boolean {
  if (typeof addr !== "string") return false;
  const trimmed = addr.trim();
  if (!trimmed) return false;
  try {
    // validate() throws on malformed input; treat any throw as invalid.
    return validateBtc(trimmed, Network.mainnet);
  } catch {
    return false;
  }
}

/**
 * Cheap format check for a Cash App $cashtag.
 * - Leading/trailing whitespace allowed (we trim).
 * - Must be: `$`, then a letter, then 0-19 alphanumerics.
 * - Doesn't auto-prepend `$` — use normalizeCashtag for that. Callers
 *   that want "accept input without $" should normalize first.
 */
export function cashtagFormatValid(tag: string): boolean {
  if (typeof tag !== "string") return false;
  return CASHTAG_RE.test(tag.trim());
}

/**
 * Trim whitespace and ensure a leading `$`. Doesn't validate the rest of
 * the format (that's cashtagFormatValid's job). Useful when the customer
 * pastes their handle without the `$` prefix.
 */
export function normalizeCashtag(tag: string): string {
  if (typeof tag !== "string") return "";
  const trimmed = tag.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}
