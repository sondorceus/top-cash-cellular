// /go shipping handoff: the seller types their address and the FedEx label
// prints right there — no "we'll text you for the address" round trip.
//
// POST { session, name, phone?, street, unit?, city, state, zip }
//   → { ok:true, tracking, url, service }
//   → { ok:false, kind:"ADDRESS_INVALID"|"SERVICE_UNAVAILABLE", hint }
//
// Gated on the session's own server-written notes: a LOCKED note (a real
// lead exists) and a CONTACT note. The lead id comes from the LEAD-ID note
// the lock route writes, so the [LABEL:] marker lands on the right lead row.
// Idempotent: a session that already has a label gets it back, no re-mint.
// Labels cost money, so this is rate-limited harder than the chat.
import { NextRequest, NextResponse } from "next/server";
import { appendChatMsg, readChat, validGoSession } from "../../../lib/gochat-store";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { mintGoLabel } from "../../../lib/go-label";
import { sendSellerSms, looksLikePhone, notesHaveOptOut } from "../../../lib/seller-sms";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { mailShell, MAIL } from "../../../lib/email-shell";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\[\]<>]/g, "").trim().slice(0, max) : "";
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`golabel:${ip}`, 6, 60 * 60_000).ok) {
    return NextResponse.json({ ok: false, kind: "SERVICE_UNAVAILABLE", hint: "too many tries — give it a few minutes" }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "bad request" }, { status: 400 }); }
  const sid = typeof body.session === "string" ? body.session : "";
  if (!validGoSession(sid)) return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "start from your quote" }, { status: 400 });

  const state = await readChat(sid, 0);
  const notes = state.msgs.filter((m) => m.role === "note").map((m) => m.text);
  const locked = [...notes].reverse().find((t) => t.startsWith("LOCKED:"));
  const contactNote = [...notes].reverse().find((t) => t.startsWith("CONTACT: "));
  if (!locked || !contactNote) {
    return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "lock in your quote first, then we print the label" }, { status: 400 });
  }
  // Already issued for this session → hand it back (no second FedEx charge).
  const prior = [...notes].reverse().find((t) => t.startsWith("LABEL: "));
  if (prior) {
    const m = prior.match(/tracking=(\S+) url=(\S+)/);
    if (m) return NextResponse.json({ ok: true, tracking: m[1], url: m[2], service: "FedEx", existing: true });
  }
  const contact = contactNote.slice("CONTACT: ".length).trim();
  const leadId = [...notes].reverse().find((t) => t.startsWith("LEAD-ID: "))?.slice("LEAD-ID: ".length).trim() || null;
  // "LOCKED: iPhone 17 Pro 256 good unlocked $560 — 512…" → device + value
  const lockBody = locked.slice("LOCKED:".length).split(" — ")[0].trim();
  const offer = Number(lockBody.match(/\$(\d+)/)?.[1] || 0) || undefined;
  const deviceLabel = lockBody.replace(/\s*\$\d+.*$/, "").replace(/\s*\(manual\)\s*$/, "").trim() || "device";

  const name = clean(body.name, 80);
  const phoneDigits = (clean(body.phone, 30) || (looksLikePhone(contact) ? contact : "")).replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
  const street = clean(body.street, 120), unit = clean(body.unit, 40), city = clean(body.city, 80);
  const stateCode = clean(body.state, 2).toUpperCase(), zip = clean(body.zip, 10);
  if (name.length < 2) return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "FedEx prints a name on the label — add yours" }, { status: 400 });
  if (phoneDigits.length !== 10) return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "FedEx needs a 10-digit phone number for the label" }, { status: 400 });
  if (!street || !city || stateCode.length !== 2 || !/^\d{5}(-\d{4})?$/.test(zip)) {
    return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "street, city, 2-letter state and 5-digit ZIP, please" }, { status: 400 });
  }

  // The same [DELIVERY OPTION] SHIPPING comm the homepage funnel writes, so
  // the admin lead row and the reminders cron see the choice + address.
  const isEmail = EMAIL_RE.test(contact);
  if (MC_KEY) {
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web", fromName: "Top Cash Cellular", role: "system",
          body: [
            "[DELIVERY OPTION] SHIPPING", `Name: ${name}`, `Phone: ${phoneDigits}`, isEmail ? `Email: ${contact}` : null,
            `Device: ${deviceLabel}`, offer ? `Quote: $${offer}` : null, `Session: ${sid}`,
            `Chat: https://topcashcellular.com/admin/chats?session=${sid}`,
            "--- Shipping Address ---", `${street}${unit ? `, ${unit}` : ""}`, `${city}, ${stateCode} ${zip}`,
            "Action: FedEx label minted from /go at address entry (see [LABEL:] marker); regenerate via /admin if needed.",
          ].filter(Boolean).join("\n"),
          tags: ["lead", "delivery", "shipping", `sess-${sid}`], priority: "urgent",
        }),
      });
    } catch { /* best-effort */ }
  }
  if (!notes.some((t) => t.startsWith("HANDOFF-CHOICE:"))) await appendChatMsg(sid, "note", "HANDOFF-CHOICE: ship (free label) — address entered on /go");

  const result = await mintGoLabel({ leadId, name, phoneDigits, street, unit: unit || undefined, city, state: stateCode, zip, deviceLabel, declaredValueUsd: offer });
  const link = `https://topcashcellular.com/admin/chats?session=${sid}`;
  if (!result.ok) {
    await appendChatMsg(sid, "note", `LABEL-FAILED: ${result.kind} — ${name}, ${city} ${stateCode} ${zip}`);
    if (result.kind === "SERVICE_UNAVAILABLE") {
      await notifyOwnerSms(`⚠️ GO label FAILED for ${deviceLabel} (${name}, ${phoneDigits}) — ${result.hint}\n${link}`).catch(() => {});
    }
    return NextResponse.json(result, { status: result.kind === "ADDRESS_INVALID" ? 400 : 502 });
  }
  await appendChatMsg(sid, "note", `LABEL: tracking=${result.tracking} url=${result.url} — ${name}, ${city} ${stateCode} ${zip}`);

  // Deliver the label to the seller — text (relay) and/or email. The card on
  // the page shows it too, so a failed text is not a dead end.
  let sent = false;
  if (!notesHaveOptOut(notes) && phoneDigits.length === 10) {
    sent = await sendSellerSms(phoneDigits, `Top Cash Cellular: your free FedEx label is ready — ${result.url}\nTracking ${result.tracking}. Box the ${deviceLabel.split(" ").slice(0, 3).join(" ")}, drop it at any FedEx location, and we text you the moment it lands. Reply STOP to opt out.`).catch(() => false);
  }
  if (isEmail && RESEND_KEY) {
    try {
      const { Resend } = await import("resend");
      const r = await new Resend(RESEND_KEY).emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>", replyTo: "support@topcashcellular.com", to: contact,
        subject: `Your free FedEx label for the ${deviceLabel.split(" ").slice(0, 3).join(" ")}`,
        html: mailShell({
          preheader: `Tracking ${result.tracking}`, eyebrow: "Your label", title: "Your FedEx label is ready",
          introHtml: `<span style="color:${MAIL.body}">Print it, box the device, and drop it at any FedEx location. We text you the moment it lands and pay within 24 hours of inspection. Tracking <strong style="color:${MAIL.ink}">${esc(result.tracking)}</strong>.</span>`,
          buttonHref: result.url, buttonLabel: "Open my label",
        }),
        text: `Your FedEx label: ${result.url}\nTracking ${result.tracking}. Drop it at any FedEx location; we text you when it lands.`,
      });
      sent = sent || !r.error;
    } catch { /* the page card still shows the label */ }
  }
  await appendChatMsg(sid, "note", sent ? `SMS/email sent (label)` : `label delivery FAILED (page card only)`);
  await notifyOwnerSms(`📦 GO seller shipping: ${deviceLabel}${offer ? ` $${offer}` : ""} — label minted, ${result.tracking} · ${name} ${phoneDigits}\n${link}`).catch(() => {});
  return NextResponse.json({ ok: true, tracking: result.tracking, url: result.url, service: result.service });
}
