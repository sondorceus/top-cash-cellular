// =========================================================================
// iPHONE ISSUE-DEDUCTION SCHEDULE
// =========================================================================
// Source: the wholesale buyer's "Machine purchase quotation" sheet
// (2026-07-14, Downloads/2.pdf) — the exit channel most TCC iPhones sell
// into. Every used grade there takes these flat deductions on top of the
// A/B/C/D price, so when one of these issues surfaces at inspection it is
// a real dollar-for-dollar loss on our resale. Amounts mirror the sheet.
//
// Consumers rarely know about half of these (genuine-part messages,
// unknown-parts warnings), so the funnel does NOT ask about them upfront —
// the quote screen states the assumptions ("no MDM, Face ID works,
// original parts") and staff applies these at inspection via the
// counter-offer itemized invoice (admin one-click chips). The two
// exceptions a seller always knows about:
//   - Face ID: asked in the broken flow (broken-faceid step).
//   - MDM / Face ID flags on bot quotes: QuoteSpec.mdmLocked / faceIdBroken.

export type DeductionItem = {
  id: string;
  // Customer-facing line on the itemized invoice.
  label: string;
};

export const DEDUCTION_ITEMS: DeductionItem[] = [
  { id: "mdm", label: "MDM / company management lock" },
  { id: "faceid", label: "Face ID / Touch ID not working" },
  { id: "parts_msg", label: "Unknown / aftermarket parts message" },
  { id: "battery", label: "Aftermarket battery / battery service message" },
  { id: "camera", label: "Bad camera" },
  { id: "two_cameras", label: "Two bad cameras" },
  { id: "charge_port", label: "Bad charging port" },
  { id: "cam_lens", label: "Cracked camera lens" },
  { id: "back_crack", label: "Cracked back glass" },
  { id: "genuine_msg", label: "Non-genuine part warning (per message)" },
  { id: "radio_button", label: "Wi-Fi / button / speaker fault (each)" },
];

// Deduction eras. Pro-tier and base-tier iPhones take different hits on
// the sheet, so eras split where the sheet splits. A 0 means the sheet
// doesn't price that issue for the era (chip hidden in admin).
type EraSchedule = Record<string, number>;

const ERA_SCHEDULES: Record<string, EraSchedule> = {
  // 17 Pro / Pro Max
  ip17pro: { mdm: 150, faceid: 250, parts_msg: 80, battery: 50, camera: 100, two_cameras: 200, charge_port: 100, cam_lens: 60, back_crack: 60, genuine_msg: 40, radio_button: 0 },
  // 17 / 17 Air / 17e
  ip17: { mdm: 150, faceid: 200, parts_msg: 80, battery: 50, camera: 100, two_cameras: 200, charge_port: 100, cam_lens: 50, back_crack: 40, genuine_msg: 40, radio_button: 0 },
  // 16 Pro / Pro Max
  ip16pro: { mdm: 120, faceid: 150, parts_msg: 80, battery: 40, camera: 100, two_cameras: 200, charge_port: 100, cam_lens: 60, back_crack: 40, genuine_msg: 30, radio_button: 0 },
  // 16 / 16 Plus / 16e
  ip16: { mdm: 100, faceid: 150, parts_msg: 60, battery: 40, camera: 100, two_cameras: 160, charge_port: 100, cam_lens: 50, back_crack: 40, genuine_msg: 30, radio_button: 0 },
  // 15 Pro / Pro Max
  ip15pro: { mdm: 70, faceid: 100, parts_msg: 150, battery: 0, camera: 100, two_cameras: 200, charge_port: 100, cam_lens: 40, back_crack: 40, genuine_msg: 30, radio_button: 60 },
  // 15 / 15 Plus
  ip15: { mdm: 60, faceid: 100, parts_msg: 120, battery: 0, camera: 40, two_cameras: 80, charge_port: 100, cam_lens: 30, back_crack: 30, genuine_msg: 30, radio_button: 60 },
  // 14 Pro / Pro Max
  ip14pro: { mdm: 60, faceid: 80, parts_msg: 0, battery: 90, camera: 50, two_cameras: 100, charge_port: 100, cam_lens: 30, back_crack: 30, genuine_msg: 20, radio_button: 60 },
  // 14 / 14 Plus
  ip14: { mdm: 50, faceid: 80, parts_msg: 0, battery: 60, camera: 40, two_cameras: 80, charge_port: 100, cam_lens: 30, back_crack: 30, genuine_msg: 20, radio_button: 60 },
  // 13 Pro / Pro Max
  ip13pro: { mdm: 50, faceid: 50, parts_msg: 0, battery: 70, camera: 40, two_cameras: 80, charge_port: 100, cam_lens: 30, back_crack: 30, genuine_msg: 20, radio_button: 60 },
  // 13 / 13 mini
  ip13: { mdm: 50, faceid: 50, parts_msg: 0, battery: 80, camera: 40, two_cameras: 80, charge_port: 100, cam_lens: 30, back_crack: 30, genuine_msg: 20, radio_button: 80 },
  // 12 Pro / Pro Max
  ip12pro: { mdm: 50, faceid: 50, parts_msg: 0, battery: 80, camera: 60, two_cameras: 80, charge_port: 50, cam_lens: 30, back_crack: 30, genuine_msg: 20, radio_button: 70 },
  // 12 / 12 mini
  ip12: { mdm: 30, faceid: 30, parts_msg: 0, battery: 40, camera: 40, two_cameras: 60, charge_port: 0, cam_lens: 30, back_crack: 30, genuine_msg: 10, radio_button: 50 },
  // 11 Pro / Pro Max
  ip11pro: { mdm: 30, faceid: 30, parts_msg: 0, battery: 50, camera: 60, two_cameras: 120, charge_port: 0, cam_lens: 30, back_crack: 30, genuine_msg: 10, radio_button: 40 },
  // 11
  ip11: { mdm: 30, faceid: 30, parts_msg: 0, battery: 30, camera: 40, two_cameras: 80, charge_port: 0, cam_lens: 30, back_crack: 30, genuine_msg: 10, radio_button: 40 },
  // SE 2 / SE 3
  ipse: { mdm: 20, faceid: 20, parts_msg: 0, battery: 40, camera: 40, two_cameras: 60, charge_port: 0, cam_lens: 20, back_crack: 20, genuine_msg: 0, radio_button: 30 },
};

// PRICE_TABLE model id → era key. Anything unmapped returns null (not an
// iPhone we hold a schedule for) and callers skip deductions entirely.
const MODEL_ERA: Record<string, string> = {
  ip17pm: "ip17pro", ip17p: "ip17pro", ip17air: "ip17", ip17: "ip17", ip17e: "ip17",
  ip16pm: "ip16pro", ip16p: "ip16pro", ip16plus: "ip16", ip16: "ip16", ip16e: "ip16",
  ip15pm: "ip15pro", ip15p: "ip15pro", ip15plus: "ip15", ip15: "ip15",
  ip14pm: "ip14pro", ip14p: "ip14pro", ip14plus: "ip14", ip14: "ip14",
  ip13pm: "ip13pro", ip13p: "ip13pro", ip13mini: "ip13", ip13: "ip13",
  ip12pm: "ip12pro", ip12p: "ip12pro", ip12mini: "ip12", ip12: "ip12",
  ip11pm: "ip11pro", ip11p: "ip11pro", ip11: "ip11",
  ipse2: "ipse", ipse3: "ipse",
};

/** Full schedule for a PRICE_TABLE model id, or null when we hold none. */
export function deductionScheduleForModelId(modelId: string | undefined | null): EraSchedule | null {
  if (!modelId) return null;
  const era = MODEL_ERA[modelId];
  return era ? ERA_SCHEDULES[era] : null;
}

/** Single-item amount (0 when the sheet doesn't price it for the era). */
export function deductionAmount(modelId: string | undefined | null, itemId: string): number {
  return deductionScheduleForModelId(modelId)?.[itemId] ?? 0;
}

// Resolve a human device label ("iPhone 14 Pro Max 256GB · Excellent") to a
// model id well enough to pick the right era. Used by the admin counter
// modal, which only has the lead's free-text model string.
export function modelIdFromLabel(label: string | undefined | null): string | null {
  if (!label) return null;
  const t = label.toLowerCase().replace(/\s+/g, " ");
  if (!t.includes("iphone")) return null;
  const m = t.match(/iphone\s*(se\s*3|se\s*2|se|17|16|15|14|13|12|11)\s*(e)?\s*(pro\s*max|pro|plus|air|mini)?/);
  if (!m) return null;
  const gen = m[1].replace(/\s/g, "");
  if (gen.startsWith("se")) return "ipse2";
  const e = m[2] === "e" || /\b1[67]e\b/.test(t);
  const variant = (m[3] || "").replace(/\s/g, "");
  const suffix = variant === "promax" ? "pm" : variant === "pro" ? "p" : variant;
  const id = `ip${gen}${e ? "e" : suffix}`;
  return MODEL_ERA[id] ? id : null;
}

/**
 * Admin chip list for a device label: every schedule item priced (>0) for
 * that model's era, ready to drop into the counter-offer deductions editor.
 */
export function deductionChipsForLabel(label: string | undefined | null): Array<{ id: string; label: string; amount: number }> {
  const sched = deductionScheduleForModelId(modelIdFromLabel(label));
  if (!sched) return [];
  return DEDUCTION_ITEMS
    .map((it) => ({ id: it.id, label: it.label, amount: sched[it.id] ?? 0 }))
    .filter((it) => it.amount > 0);
}
