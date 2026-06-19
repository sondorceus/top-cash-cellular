// Shared lead-body parsing for the offer routes (GET / items / append).
//
// Leads live as plaintext MC messages. Several routes re-derive the same
// things from a lead body: a "Field: value" line, the per-device line
// shape, the latest [STATUS:] marker, and the order's CURRENT device list
// (latest [ITEM-UPDATE] JSON → multi-device block → single-device fields).
// These used to be copy-pasted per route and DRIFTED — the device-line
// regex was fixed in three places at three different times, and the
// status parse applied a whitelist in GET but not in the write routes,
// so a typo'd marker could open an edit/cancel gate GET would ignore.
// This module is the single source of truth. Skywalker 2026-06-12.

import { parseTotalPayoutLine, parseDollarAmount } from "./lead-money";

export type LeadMessage = { id: string; body?: string; timestamp: string };

export type ParsedDevice = {
  model: string;
  storage?: string;
  condition?: string;
  quote: number; // line total (price × qty), always ≥ 0
  quantity: number;
  needsReview?: boolean;
};

// The full set of valid pipeline statuses. Anything outside this set is a
// typo / future value and must be IGNORED so a stray marker can't override
// the real status (GET has always whitelisted; the write routes did not).
export const OFFER_STATUSES = [
  "quote_requested", "shipped", "received", "tested", "paid", "met", "rejected",
] as const;

// Statuses that lock an offer from customer edits / additions.
export const LOCKED_STATUSES = new Set(["shipped", "received", "tested", "paid", "met"]);

// Canonical per-device line written by /api/lead:
//   "  1. Model · Storage · Condition · $Quote[ total][ (×N)][ · 🤝 LOCAL]"
// Tolerates the optional " total" suffix, the (×N) qty tag, and any
// trailing " · …" segment (the 🤝 LOCAL / 📦 SHIP handoff tag).
//
// The Storage/Condition groups exclude `$` so the price segment can't be
// swallowed into them on a sparse line (e.g. "  1. iPhone 14 · $500" with
// no storage/condition) — that previously left the $Quote group undefined
// and the device parsed to $0, undercounting the rebuilt order total. The
// money group also accepts cents (e.g. $1,250.50).
export const DEVICE_LINE_RE = /^\s{2,4}(\d+)\.\s+([^·\n]+?)(?:\s·\s+([^·\n$]+?))?(?:\s·\s+([^·\n$]+?))?(?:\s·\s+\$([0-9,]+(?:\.\d+)?)(?:\s+total)?)?(?:\s+\(×(\d+)\))?(?:\s·\s+.*)?$/;

// "Field: value" line lookup (case-insensitive).
export function field(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|\\n)${reEscape(key)}:[ \\t]*([^\\n]*)`, "i"));
  return m?.[1]?.trim() || undefined;
}

// Sanitize a customer-controlled value before it enters an MC body / JSON
// marker: strip the [ ] marker delimiters and control chars.
export function cleanField(s: unknown, max: number): string {
  return String(s ?? "").replace(/[\[\]\n\r\t]/g, " ").trim().slice(0, max);
}

// Escape a string for safe interpolation into a RegExp. leadId is
// validated to [\w-]+ at every route boundary so nothing is special
// today, but escaping keeps these matchers safe if that ever loosens.
export function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Latest VALID [STATUS: x][LEAD: id] for a lead. Unknown statuses are
// ignored (see OFFER_STATUSES). Returns "quote_requested" when none.
export function latestStatus(messages: LeadMessage[], leadId: string): string {
  const re = new RegExp(`\\[STATUS:\\s*(\\w+)\\]\\s*\\[LEAD:\\s*${reEscape(leadId)}\\]`, "i");
  let status = "quote_requested";
  let at = "";
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(re);
    if (!sm) continue;
    const s = sm[1].toLowerCase();
    if (!(OFFER_STATUSES as readonly string[]).includes(s)) continue;
    if (!at || m.timestamp > at) { status = s; at = m.timestamp; }
  }
  return status;
}

function normDevice(d: Record<string, unknown>): ParsedDevice {
  const quote = Math.round(Number(d.quote));
  const quantity = Math.round(Number(d.quantity));
  return {
    model: cleanField(d.model, 80) || "Device",
    storage: d.storage ? cleanField(d.storage, 30) : undefined,
    condition: d.condition ? cleanField(d.condition, 30) : undefined,
    quote: Number.isFinite(quote) ? Math.max(0, quote) : 0,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    needsReview: !!d.needsReview,
  };
}

// The order's CURRENT authoritative device list, rebuilt server-side.
// Resolution order (mirrors the offer GET route exactly):
//   1. latest [ITEM-UPDATE] JSON marker wins
//   2. the multi-device "Devices: N" block
//   3. the single-device lead fields
// Returned quotes are line totals and authoritative — never client data.
export function resolveCurrentDevices(
  body: string,
  messages: LeadMessage[],
  leadId: string,
): ParsedDevice[] {
  // 1. Latest [ITEM-UPDATE] marker — its JSON is the source of truth.
  const iuRe = new RegExp(`\\[ITEM-UPDATE:\\s*${reEscape(leadId)}\\][^\\n]*?(\\{.*\\})`, "i");
  let itemDevices: Record<string, unknown>[] | null = null;
  let itemUpdateAt = "";
  for (const m of messages) {
    if (!m.body) continue;
    const iu = m.body.match(iuRe);
    if (iu && (!itemUpdateAt || m.timestamp > itemUpdateAt)) {
      try {
        const parsed = JSON.parse(iu[1]);
        if (parsed && Array.isArray(parsed.devices)) {
          itemDevices = parsed.devices as Record<string, unknown>[];
          itemUpdateAt = m.timestamp;
        }
      } catch { /* ignore malformed marker */ }
    }
  }
  if (itemDevices) return itemDevices.map(normDevice);

  // 2. Multi-device "Devices: N" block.
  if (/^Devices:\s*\d+\s*$/m.test(body)) {
    const out: ParsedDevice[] = [];
    for (const line of body.split("\n")) {
      const dm = line.match(DEVICE_LINE_RE);
      if (!dm) continue;
      const [, , dLabel, dStorage, dCondition, dQuote, dQty] = dm;
      out.push(normDevice({
        model: dLabel.trim(),
        storage: dStorage?.trim(),
        condition: dCondition?.trim(),
        quote: dQuote ? parseInt(dQuote.replace(/,/g, ""), 10) : 0,
        quantity: dQty ? parseInt(dQty, 10) : 1,
      }));
    }
    if (out.length) return out;
  }

  // 3. Single-device lead.
  const q = parseTotalPayoutLine(body) || parseDollarAmount(field(body, "Quote"));
  return [normDevice({
    model: field(body, "Model") || field(body, "Device")?.split(" — ")[1] || field(body, "Device") || "Device",
    storage: field(body, "Storage"),
    condition: field(body, "Condition"),
    quote: q,
    quantity: field(body, "Quantity") ? parseInt(field(body, "Quantity")!, 10) : 1,
  })];
}

// Sum of line totals for a resolved device list.
export function devicesTotal(devices: ParsedDevice[]): number {
  return devices.reduce((s, d) => s + (d.quote || 0), 0);
}
