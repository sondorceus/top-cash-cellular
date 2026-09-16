// Shared FedEx label retry — used by both the admin "Retry label"
// button and the cron-driven auto-retry. Pulls the original lead body
// from MC, parses out the address + phone + device info, calls
// createReturnLabel, and posts the appropriate [LABEL: …] or
// [LABEL-FAILED: …] marker. Skywalker 2026-05-19.
//
// Returns { ok, label?, error?, kind? } so callers can branch on
// transient (SERVICE_UNAVAILABLE → retry later) vs hard (ADDRESS_INVALID
// → customer must fix) failures.

import { put } from "@vercel/blob";
import { createReturnLabel, deviceKindFor, type LabelInputs } from "./fedex";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

export type RetryResult =
  | { ok: true; label: { tracking: string; url: string; service: string }; leadId: string }
  | { ok: false; kind: "ADDRESS_INVALID" | "SERVICE_UNAVAILABLE" | "NOT_FOUND" | "ALREADY_LABELED" | "WRONG_HANDOFF"; error: string; leadId: string };

function field(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  return m?.[1]?.trim() || undefined;
}

type McMsg = { id?: string; body?: string; timestamp: string };

// Read MC comms back far enough to see EVERY label marker for a lead. Its
// [LABEL:]/[LABEL-FAILED:] markers are always written after the lead itself,
// so paging back (before=<oldest ts>, includeArchive) until the lead's own
// message shows up covers all of them. The old fixed newest-500 slice did
// not: once a ship lead was a day or two old its submit-time [LABEL:] fell
// outside the slice, findFreshLabel said "no label", and flipping the lead to
// Shipped made the admin label route BUY a second FedEx label and email it
// to a customer whose box was already on its way. Bounded at ~60 days.
const LEAD_SCAN_PAGE = 1000;
const LEAD_SCAN_MAX_PAGES = 20;
async function readCommsThroughLead(leadId: string): Promise<McMsg[]> {
  if (!MC_KEY) return [];
  const byId = new Map<string, McMsg>();
  let before: string | undefined;
  for (let page = 0; page < LEAD_SCAN_MAX_PAGES; page++) {
    const qs = new URLSearchParams({ limit: String(LEAD_SCAN_PAGE), includeArchive: "true" });
    if (before) qs.set("before", before);
    let msgs: McMsg[] = [];
    try {
      const r = await fetch(`${MC_API}/api/comms?${qs.toString()}`, {
        headers: { "x-api-key": MC_KEY },
        cache: "no-store",
      });
      if (!r.ok) break;
      const data = await r.json();
      msgs = Array.isArray(data.messages) ? data.messages : [];
    } catch {
      break;
    }
    if (msgs.length === 0) break;
    for (const m of msgs) if (m?.id) byId.set(m.id, m);
    if (byId.has(leadId)) break; // reached the lead — nothing older can mention it
    if (msgs.length < LEAD_SCAN_PAGE) break; // exhausted
    // Pages come back ascending, so the first message is the page's oldest.
    const oldest = msgs[0]?.timestamp;
    if (!oldest || oldest === before) break; // no progress guard
    before = oldest;
  }
  return [...byId.values()];
}

// Newest successful [LABEL: …] marker and newest [LABEL-FAILED: …] for a lead.
function labelMarkers(messages: McMsg[], leadId: string): { best: { ts: string; body: string } | null; lastFailAt: string } {
  let lastFailAt = "";
  let best: { ts: string; body: string } | null = null;
  const wantedFail = `[LABEL-FAILED: ${leadId}]`;
  const wantedSuccess = `[LABEL: ${leadId}]`;
  for (const m of messages) {
    if (!m.body) continue;
    if (m.body.includes(wantedFail) && m.timestamp > lastFailAt) lastFailAt = m.timestamp;
    if (m.body.includes(wantedSuccess) && (!best || m.timestamp > best.ts)) best = { ts: m.timestamp, body: m.body };
  }
  return { best, lastFailAt };
}

// Check whether the lead already has a fresh successful [LABEL: …] that
// post-dates the most recent failure. If so, the retry is unnecessary
// (someone else already minted it — admin click race, or a prior cron
// run beat us to it).
function hasFreshLabelIn(messages: McMsg[], leadId: string): boolean {
  const { best, lastFailAt } = labelMarkers(messages, leadId);
  return !!best && best.ts > lastFailAt;
}

// Like hasFreshLabel, but returns the existing label's parsed marker
// (tracking/url/service) so callers can REUSE it instead of minting a new
// one. createReturnLabel hits the FedEx Ship API, which BILLS per call and
// issues a fresh tracking number, so the label-mint path must be idempotent.
export async function findFreshLabel(leadId: string): Promise<{ tracking: string; url: string; service: string } | null> {
  const { best, lastFailAt } = labelMarkers(await readCommsThroughLead(leadId), leadId);
  if (!best || best.ts <= lastFailAt) return null;
  const tracking = best.body.match(/\[LABEL:[^\]]*\]\s*tracking=(\S+)/)?.[1] || "";
  const url = best.body.match(/url=(\S+)/)?.[1] || "";
  const service = best.body.match(/service=(\S+)/)?.[1] || "";
  return tracking && url ? { tracking, url, service } : null;
}

export async function retryFedexLabel(leadId: string): Promise<RetryResult> {
  // One scan serves both checks — the label markers and the lead body.
  const messages = await readCommsThroughLead(leadId);
  if (hasFreshLabelIn(messages, leadId)) {
    return { ok: false, kind: "ALREADY_LABELED", error: "Label already minted for this lead.", leadId };
  }
  const leadMsg = messages.find((x) => x.id === leadId);
  if (!leadMsg?.body) return { ok: false, kind: "NOT_FOUND", error: "Lead not found in MC.", leadId };
  const { body } = leadMsg;

  // Only ship-handoff leads should ever have a label. Bail if this is
  // a local-meetup lead — caller misuse.
  const handoff = field(body, "Handoff")?.toLowerCase() || "";
  if (handoff && !handoff.includes("ship")) {
    return { ok: false, kind: "WRONG_HANDOFF", error: "This lead is a local meetup — no label needed.", leadId };
  }

  const name = field(body, "Name") || "Customer";
  const phone = field(body, "Phone") || "";
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    return { ok: false, kind: "ADDRESS_INVALID", error: "Lead is missing a 10-digit phone number — FedEx label requires one.", leadId };
  }

  // Address lives in the body as either separate Street/City/State/Zip
  // lines or as a single Address: line. /api/lead emits the separate
  // form, so that's what we look for first.
  const street = field(body, "Street") || field(body, "Address");
  const unit = field(body, "Unit") || undefined;
  const city = field(body, "City");
  const state = field(body, "State");
  const zip = field(body, "Zip") || field(body, "ZIP");
  if (!street || !city || !state || !zip) {
    return { ok: false, kind: "ADDRESS_INVALID", error: "Lead is missing a complete shipping address.", leadId };
  }

  const model = field(body, "Model") || field(body, "Device") || "device";
  // Lead bodies carry "Device: <funnel type> — <model>". The model name
  // decides the package kind; the type id ("lenovo", "msi_desktop") is the
  // fallback when the name alone is unknown ("IdeaPad 5", "Aegis RS").
  const [deviceType, ...modelParts] = String(field(body, "Device") || "").split(" — ");
  const deviceKind = modelParts.length
    ? deviceKindFor(field(body, "Model") || modelParts.join(" — "), deviceType)
    : deviceKindFor(String(model));
  const deviceCountMatch = body.match(/^Devices:\s*(\d+)\s*$/m);
  const deviceCount = deviceCountMatch ? parseInt(deviceCountMatch[1], 10) || 1 : 1;
  const refText = deviceCount > 1 ? `${deviceCount} devices` : String(model).slice(0, 30);

  // Declared value — parse the quoted payout from the lead body so a
  // retried label carries the same FedEx liability cap as the original.
  const quoteRaw = field(body, "Total payout") || field(body, "Quote") || "";
  const declaredValueUsd = parseInt(quoteRaw.replace(/[^0-9]/g, ""), 10) || undefined;

  const inputs: LabelInputs = {
    customerName: name,
    customerPhone: phoneDigits,
    customerStreet: street,
    customerUnit: unit,
    customerCity: city,
    customerState: state.toUpperCase().slice(0, 2),
    customerZip: zip.replace(/\D/g, "").slice(0, 5),
    deviceKind,
    customerReference: refText,
    poNumber: `TCC-${leadId}`,
    declaredValueUsd,
  };

  try {
    const result = await createReturnLabel(inputs);
    const pdfBytes = Buffer.from(result.labelPdfBase64, "base64");
    const blob = await put(`fedex-labels/${leadId}-${Date.now()}.pdf`, pdfBytes, {
      access: "public",
      contentType: "application/pdf",
    });
    // Post the success marker so admin + customer /track pick up the new label.
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular",
          role: "system",
          body: `[LABEL: ${leadId}] tracking=${result.trackingNumber} url=${blob.url} service=${result.serviceType}`,
          tags: ["fedex-label", "retry-success"],
          priority: "low",
        }),
      });
    } catch {}
    return { ok: true, label: { tracking: result.trackingNumber, url: blob.url, service: result.serviceType }, leadId };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const addressy = /address|postal|street|city|state|zip/i.test(raw);
    const kind: "ADDRESS_INVALID" | "SERVICE_UNAVAILABLE" = addressy ? "ADDRESS_INVALID" : "SERVICE_UNAVAILABLE";
    // Post a fresh fail marker so the auto-retry policy knows the
    // failure is current (a stale marker from 3 hours ago shouldn't
    // count toward the retry-limit).
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular",
          role: "system",
          body: `[LABEL-FAILED: ${leadId}] kind=${kind} reason=${raw.replace(/[\n\r]/g, " ").slice(0, 300)}`,
          tags: ["fedex-label", "failed", "retry"],
          priority: "high",
        }),
      });
    } catch {}
    return { ok: false, kind, error: raw.slice(0, 400), leadId };
  }
}
