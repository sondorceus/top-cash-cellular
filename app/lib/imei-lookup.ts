// ONE Sickw IMEI lookup for every surface (site chat tool, /api/imei/check
// which the homepage funnel and the MC lead bot call).
//
// Service 0 ("APPLE SOLD BY & COUNTRY INFO") was being used for every check
// at $1.80 each — the account sat at $1.52, every lookup answered "Error
// B01: Low Balance!", and the bots silently fell back to "check by hand"
// (Sonny's own IMEI, 2026-09-12). This uses the cheap services instead:
//   203  BRAND & MODEL INFO                 $0.02   any brand → who made it
//    61  iPHONE CARRIER & FMI & BLACKLIST   $0.10   Apple: model, capacity,
//                                                    carrier, SIM-lock,
//                                                    iCloud lock, blacklist
//    92  iPHONE MODEL COLOR & CAPACITY      $0.022  Apple: readable model
//     1  SAMSUNG INFO - PRO                 $0.10
//    42  GOOGLE PIXEL INFO                  $0.12
//    54  WW BLACKLIST STATUS                $0.04   non-Apple blacklist
// ≈ $0.14 per iPhone, ≈ $0.16 per Samsung/Pixel. Sickw bills per call.
//
// Lock / blacklist flags are for the OWNER: callers decide what the customer
// hears (the chat tool says only the model).
import { notifyOwnerSms } from "./owner-sms";
import { rateLimit } from "./rate-limit";

export type ImeiLookup = {
  ok: boolean; // brand/model resolved
  imei: string;
  brand?: string;
  model?: string; // human-readable ("iPhone 17 Pro Max 256GB Cosmic Orange")
  capacity?: string;
  carrier?: string;
  simLock?: string;
  fmiOn: boolean;
  blacklisted: boolean;
  fmiRaw?: string;
  blacklistRaw?: string;
  error?: string; // Sickw's own error text, e.g. "Error B01: Low Balance!"
  balance?: number;
  cost: number;
  ownerNote: string; // "IMEI: <n> → <model> · <carrier> · ⚠️ Find My ON" or the error
};

type Raw = { status: string; text: string; balance?: number; price?: number; error?: string };

async function sickw(service: number, imei: string): Promise<Raw> {
  const key = process.env.SICKW_API_KEY || "";
  if (!key) return { status: "nokey", text: "", error: "no SICKW_API_KEY" };
  try {
    const r = await fetch(`https://sickw.com/api.php?format=json&key=${key}&imei=${imei}&service=${service}`, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
    if (!r.ok) return { status: "http", text: "", error: `HTTP ${r.status}` };
    const d = await r.json();
    const balance = d.balance != null ? Number(d.balance) : undefined;
    const price = d.price != null ? Number(d.price) : undefined;
    if (d.status !== "success" || !d.result) return { status: "error", text: "", balance, price, error: typeof d.result === "string" ? d.result.replace(/<[^>]+>/g, "").trim() : "lookup failed" };
    return { status: "success", text: String(d.result), balance, price };
  } catch (e) {
    return { status: "threw", text: "", error: e instanceof Error ? e.message : "threw" };
  }
}

// Sickw result text is HTML-ish "Label: value<br>Label: value"; the label
// match stops at a tag or newline.
const field = (text: string, ...labels: string[]): string | undefined => {
  for (const l of labels) {
    const m = text.match(new RegExp(`${l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*([^\\r\\n<]+)`, "i"));
    if (m && m[1].trim()) return m[1].replace(/<[^>]+>/g, "").trim();
  }
  return undefined;
};
const titleCase = (s: string) => s.toLowerCase().replace(/\b(iphone|ipad|ipod|imac)\b/g, (w) => ({ iphone: "iPhone", ipad: "iPad", ipod: "iPod", imac: "iMac" }[w] as string)).replace(/\b([a-z])(\w*)/g, (m, a, b) => /^(i(phone|pad|pod|mac))$/i.test(m) ? m : a.toUpperCase() + b);

/** Pure parse of Sickw's "Label: value<br>Label: value" text — exported for tests. */
export function parseSickwFields(text: string): { model?: string; capacity?: string; carrier?: string; simLock?: string; fmiRaw?: string; blacklistRaw?: string; fmiOn: boolean; blacklisted: boolean } {
  const desc = field(text, "Model Description", "Model Name", "Model");
  const model = desc ? (/^[A-Z0-9 ,()-]+$/.test(desc) ? titleCase(desc.split(",")[0]) : desc) : undefined;
  const capacity = field(text, "Capacity", "Storage") || text.match(/\b(\d{2,4}\s?GB|\d\s?TB)\b/i)?.[1];
  const carrier = field(text, "Locked Carrier", "Carrier", "Network", "Original Carrier");
  const simLock = field(text, "Sim-Lock Status", "SIM Lock", "Sim Lock", "Simlock", "Lock Status");
  const fmiLock = field(text, "iCloud Lock", "Find My iPhone", "FMI Status", "Find My");
  const fmiRaw = fmiLock || field(text, "iCloud Status");
  const blacklistRaw = field(text, "Blacklist Status", "Blacklist", "GSMA Blacklist");
  const fmiOn = !!fmiLock && /\bon\b|locked|active/i.test(fmiLock);
  let blacklisted = !!blacklistRaw && /black|reported|stolen|lost/i.test(blacklistRaw) && !/clean/i.test(blacklistRaw);
  const st = field(text, "iCloud Status");
  if (!blacklisted && st && /lost|stolen|erased/i.test(st)) blacklisted = true;
  return { model, capacity, carrier, simLock, fmiRaw, blacklistRaw, fmiOn, blacklisted };
}

let alerted = false;
async function alertOwnerOnce(error: string, balance?: number) {
  // One text per 6h, process-local flag on top — a Low Balance day must not
  // become a text per lookup.
  if (alerted || !rateLimit("sickw-owner-alert", 1, 6 * 60 * 60_000).ok) return;
  alerted = true;
  await notifyOwnerSms(`⚠️ Sickw IMEI lookups are failing: ${error}${balance != null ? ` (balance $${balance.toFixed(2)})` : ""}. Top up at sickw.com — bots are recording IMEIs but can't identify devices until then.`).catch(() => {});
}

export async function lookupImei(cleanImei: string): Promise<ImeiLookup> {
  const imei = cleanImei.replace(/\D/g, "");
  let cost = 0;
  const out: ImeiLookup = { ok: false, imei, fmiOn: false, blacklisted: false, cost: 0, ownerNote: "" };
  const brandCall = await sickw(203, imei);
  if (brandCall.price) cost += brandCall.price;
  if (brandCall.status !== "success") {
    out.error = brandCall.error; out.balance = brandCall.balance; out.cost = cost;
    out.ownerNote = `IMEI: ${imei} → lookup error: ${brandCall.error}${brandCall.balance != null ? ` (Sickw balance $${brandCall.balance})` : ""} — check by hand`;
    if (brandCall.status === "error") void alertOwnerOnce(brandCall.error || "error", brandCall.balance);
    return out;
  }
  out.balance = brandCall.balance;
  const brand = (field(brandCall.text, "Manufacturer", "Brand") || "").toUpperCase();
  const baseModel = field(brandCall.text, "Model Name", "Model", "Model Code");
  out.brand = brand || undefined;
  out.model = baseModel ? titleCase(baseModel) : undefined;
  out.ok = !!out.model;

  const isApple = /APPLE/.test(brand) || /iphone|ipad/i.test(baseModel || "");
  const isSamsung = /SAMSUNG/.test(brand);
  const isGoogle = /GOOGLE/.test(brand);
  const calls: Promise<Raw>[] = isApple ? [sickw(61, imei), sickw(92, imei)] : isSamsung ? [sickw(1, imei), sickw(54, imei)] : isGoogle ? [sickw(42, imei), sickw(54, imei)] : [sickw(54, imei)];
  const results = await Promise.all(calls);
  for (const r of results) { if (r.price) cost += r.price; if (r.balance != null) out.balance = r.balance; }
  const text = results.filter((r) => r.status === "success").map((r) => r.text).join("\n");
  // Diagnostic (owner-side logs only): the shape of each sub-call, so a
  // "success" payload the parser can't read is visible.
  console.log(`[imei-lookup] ${imei} brand=${brand} ` + results.map((r, i) => `${(isApple ? [61, 92] : isSamsung ? [1, 54] : isGoogle ? [42, 54] : [54])[i]}=${r.status}:${JSON.stringify(r.text).slice(0, 160)}`).join(" | "));
  if (text) {
    const nice = isApple ? field(results[1]?.text || "", "Model Description") : undefined;
    const f = parseSickwFields(text);
    if (nice) out.model = nice;
    else if (f.model && (!out.model || f.model.length > out.model.length)) out.model = f.model;
    Object.assign(out, { capacity: f.capacity, carrier: f.carrier, simLock: f.simLock, fmiRaw: f.fmiRaw, blacklistRaw: f.blacklistRaw, fmiOn: f.fmiOn, blacklisted: f.blacklisted });
  }
  // Every sub-call that didn't succeed is named in the note and logged — a
  // silently dropped Apple call left the owner's own IMEI without its
  // Find My / SIM-lock flags on the first live run (2026-09-12).
  const services = isApple ? [61, 92] : isSamsung ? [1, 54] : isGoogle ? [42, 54] : [54];
  const failed = results.map((r, i) => (r.status === "success" ? null : `${services[i]}:${r.status}${r.error ? ` ${r.error}` : ""}`)).filter((x): x is string => !!x);
  if (failed.length) {
    console.error(`[imei-lookup] ${imei} sub-call failures: ${failed.join(" | ")}`);
    out.error = failed.join("; ");
    const sickwErr = results.find((r) => r.status === "error" && r.error)?.error;
    if (sickwErr) void alertOwnerOnce(sickwErr, out.balance);
  }
  out.cost = Math.round(cost * 1000) / 1000;
  const bits = [
    out.model || "unknown model",
    out.capacity && !(out.model || "").includes(out.capacity) ? out.capacity : "",
    out.simLock ? `SIM ${out.simLock}` : "",
    out.carrier && !/unlock/i.test(out.carrier) ? out.carrier : "",
    out.fmiOn ? "⚠️ Find My ON" : out.fmiRaw ? "Find My off" : "",
    out.blacklisted ? "⚠️ BLACKLISTED" : out.blacklistRaw ? "blacklist clean" : "",
    out.error ? `(partial: ${out.error})` : "",
  ].filter(Boolean);
  out.ownerNote = `IMEI: ${imei} → ${bits.join(" · ")}`;
  return out;
}
