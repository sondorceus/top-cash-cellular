// FedEx label mint for a /go seller — the single-device slice of what
// app/api/lead/route.ts does at submit (createReturnLabel → Vercel Blob →
// [LABEL: leadId] marker), kept separate so the 1,500-line lead route is
// untouched. Sonny 2026-09-12: "customers who pick shipping — it says we'll
// text you a label; why not just take them to our label page, we have the
// logic built." Same FedEx account, same weight defaults, same $100 declared
// value cap, same blob path, same MC markers the admin lead row reads.
import { put } from "@vercel/blob";
import { createReturnLabel, deviceKindFromString, shouldBlockAutoShip } from "./fedex";
import { registerEasyPostTracker } from "./easypost";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

export type GoLabelInput = {
  leadId: string | null;
  name: string;
  phoneDigits: string;
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  deviceLabel: string; // "iPhone 17 Pro 256 good unlocked" — kind + reference come from this
  declaredValueUsd?: number;
};
export type GoLabelResult =
  | { ok: true; tracking: string; url: string; service: string; cost?: number }
  | { ok: false; kind: "ADDRESS_INVALID" | "SERVICE_UNAVAILABLE"; hint: string };

async function mcPost(body: string, tags: string[], priority: "low" | "normal" | "urgent" = "normal") {
  if (!MC_KEY) return;
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "topcash-web", fromName: "Top Cash Cellular", role: "system", body, tags, priority }),
    });
  } catch { /* markers are best-effort; the label still goes to the seller */ }
}

export async function mintGoLabel(input: GoLabelInput): Promise<GoLabelResult> {
  const kind = deviceKindFromString(input.deviceLabel);
  const blocked = shouldBlockAutoShip(kind);
  if (blocked) {
    if (input.leadId) await mcPost(`[LABEL-WITHHELD: ${input.leadId}] reason=${blocked}`, ["fedex-label", "blocked"]);
    return { ok: false, kind: "SERVICE_UNAVAILABLE", hint: blocked };
  }
  const ref = input.leadId ? `TCC-${input.leadId}` : `go-${Date.now().toString(36)}`;
  try {
    const label = await createReturnLabel({
      customerName: input.name,
      customerPhone: input.phoneDigits,
      customerStreet: input.street,
      customerUnit: input.unit,
      customerCity: input.city,
      customerState: input.state,
      customerZip: input.zip,
      deviceKind: kind,
      customerReference: input.deviceLabel.slice(0, 30),
      poNumber: ref,
      declaredValueUsd: input.declaredValueUsd,
    });
    // Random suffix so a tracking number alone can't be pivoted to the PDF.
    const pdf = Buffer.from(label.labelPdfBase64, "base64");
    const blob = await put(`fedex-labels/${ref}-${Date.now()}.pdf`, pdf, { access: "public", contentType: "application/pdf" });
    registerEasyPostTracker(label.trackingNumber).catch(() => {});
    if (input.leadId) {
      await mcPost(
        `[LABEL: ${input.leadId}] tracking=${label.trackingNumber} url=${blob.url} service=${label.serviceType}${label.cost != null ? ` cost=$${label.cost.toFixed(2)}` : ""} source=go`,
        ["fedex-label", "auto-generated"],
        "low",
      );
    }
    return { ok: true, tracking: label.trackingNumber, url: blob.url, service: label.serviceType, cost: label.cost };
  } catch (err) {
    // Same classification as /api/lead: an address-shaped FedEx error is the
    // seller's to fix; anything else is ours. Never echo the raw body.
    const raw = err instanceof Error ? err.message : String(err);
    const addressy = /address|postal|street|city|state|zip/i.test(raw);
    if (input.leadId) await mcPost(`[LABEL-FAILED: ${input.leadId}] kind=${addressy ? "ADDRESS_INVALID" : "SERVICE_UNAVAILABLE"} reason=${raw.replace(/[\n\r]/g, " ").slice(0, 300)}`, ["fedex-label", "failed"], addressy ? "normal" : "urgent");
    return addressy
      ? { ok: false, kind: "ADDRESS_INVALID", hint: "FedEx couldn’t validate that address — double-check the street, city, state and ZIP and try again." }
      : { ok: false, kind: "SERVICE_UNAVAILABLE", hint: "couldn’t print the label right now — your quote is saved and we’ll text you the label shortly." };
  }
}
