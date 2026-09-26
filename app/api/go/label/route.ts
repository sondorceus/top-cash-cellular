// /go shipping handoff: the seller types their address and the FedEx label
// prints right there — no "we'll text you for the address" round trip.
//
// POST { session, name, phone?, street, unit?, city, state, zip }
//   → { ok:true, tracking, url, service, texted, emailed, devices }
//   → { ok:false, kind:"ADDRESS_INVALID"|"SERVICE_UNAVAILABLE", hint }
//
// Gated on the session's own server-written notes: a LOCKED note (a real
// lead exists) and a CONTACT note. The lead id comes from the LEAD-ID note
// the lock route writes, so the [LABEL:] marker lands on the right lead row.
// Idempotent per lock: a lock that already has a label gets it back, no
// re-mint; a second device locked in the same thread gets its own label.
// Several devices locked before the seller chose to ship ("+ i have another
// one") go in ONE box on ONE label: every lead in it gets the tracking.
// Labels cost money, so this is rate-limited harder than the chat.
import { NextRequest, NextResponse } from "next/server";
import { appendChatMsg, readChat, validGoSession } from "../../../lib/gochat-store";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { mintGoLabel } from "../../../lib/go-label";
import { deviceKindFromString } from "../../../lib/fedex";
import { sendSellerSms, looksLikePhone, notesHaveOptOut } from "../../../lib/seller-sms";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { mailShell, MAIL } from "../../../lib/email-shell";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Line breaks (U+2028/U+2029 included) become spaces: these fields are
// "Key: value" lines of the [DELIVERY OPTION] comm.
function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\[\]<>]/g, "").replace(/[\n\r\t\u2028\u2029]/g, " ").trim().slice(0, max) : "";
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "bad request" }, { status: 400 }); }
  const sid = typeof body.session === "string" ? body.session : "";
  if (!validGoSession(sid)) return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "start from your quote" }, { status: 400 });

  const state = await readChat(sid, 0);
  const noteMsgs = state.msgs.filter((m) => m.role === "note");
  const notes = noteMsgs.map((m) => m.text);
  const lockedNote = [...noteMsgs].reverse().find((m) => m.text.startsWith("LOCKED:"));
  const contactNote = [...notes].reverse().find((t) => t.startsWith("CONTACT: "));
  if (!lockedNote || !contactNote) {
    return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "lock in your quote first, then we print the label" }, { status: 400 });
  }
  const locked = lockedNote.text;
  // Everything below belongs to the NEWEST lock. "got another one?" lets a
  // seller lock a second device in the same thread, and that lead needs its
  // own label, [LABEL:] marker and delivery record — the session-wide check
  // handed device #2 device #1's label and returned before any of that was
  // written. The lock route writes LOCKED and LEAD-ID together, so notes
  // stamped at/after the newest LOCKED are this lock's.
  const sinceLock = noteMsgs.filter((m) => m.ts >= lockedNote.ts).map((m) => m.text);
  const leadId = [...sinceLock].reverse().find((t) => t.startsWith("LEAD-ID: "))?.slice("LEAD-ID: ".length).trim() || null;
  // Already issued for this lock → hand it back (no second FedEx charge).
  const prior = [...sinceLock].reverse().find((t) => t.startsWith("LABEL: "));
  if (prior) {
    const m = prior.match(/tracking=(\S+) url=(\S+)/);
    if (m) return NextResponse.json({ ok: true, tracking: m[1], url: m[2], service: "FedEx", existing: true });
  }
  const contact = contactNote.slice("CONTACT: ".length).trim();
  // "LOCKED: iPhone 17 Pro 256 good unlocked $560 — 512…" → device + value
  const lockBody = locked.slice("LOCKED:".length).split(" — ")[0].trim();
  const offer = Number(lockBody.match(/\$(\d+)/)?.[1] || 0) || undefined;
  const deviceLabel = lockBody.replace(/\s*\$\d+.*$/, "").replace(/\s*\(manual\)\s*$/, "").trim() || "device";
  // The box: every device locked since the seller last settled a handoff (a
  // label, or a meet/ship pick). The newest lock is always in it. A device
  // they already chose to MEET for, or one already labeled, is not.
  const lastDecisionTs = noteMsgs.reduce((t, m) => (/^(LABEL: |HANDOFF-CHOICE:)/.test(m.text) && m.ts > t ? m.ts : t), 0);
  const box = noteMsgs
    .filter((m) => m.text.startsWith("LOCKED:") && (m.ts > lastDecisionTs || m === lockedNote))
    .map((m) => {
      const b = m.text.slice("LOCKED:".length).split(" — ")[0].trim();
      return { device: b.replace(/\s*\$\d+.*$/, "").replace(/\s*\(manual\)\s*$/, "").trim() || "device", offer: Number(b.match(/\$(\d+)/)?.[1] || 0) || 0 };
    });
  const multi = box.length > 1;
  const boxLeadIds = multi
    ? noteMsgs.filter((m) => m.text.startsWith("LEAD-ID: ") && m.ts > lastDecisionTs).map((m) => m.text.slice("LEAD-ID: ".length).trim()).filter(Boolean)
    : [];
  const boxLabel = multi ? box.map((b) => b.device).join(" + ") : deviceLabel;
  const boxValue = multi ? box.reduce((sum, b) => sum + b.offer, 0) || undefined : offer;
  // Size the package for the heaviest thing in it (the kind check stops at
  // the first match, so "iPhone 16 + PS5" alone would read as a phone).
  const KIND_RANK: Record<string, number> = { desktop: 5, console: 4, laptop: 3, tablet: 2, phone: 1 };
  const kindLabel = multi ? [...box].sort((a, b) => (KIND_RANK[deviceKindFromString(b.device) || ""] || 0) - (KIND_RANK[deviceKindFromString(a.device) || ""] || 0))[0].device : undefined;
  const boxNoun = multi ? `${box.length} devices` : deviceLabel.split(" ").slice(0, 3).join(" ");

  const name = clean(body.name, 80);
  const phoneDigits = (clean(body.phone, 30) || (looksLikePhone(contact) ? contact : "")).replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
  const street = clean(body.street, 120), unit = clean(body.unit, 40), city = clean(body.city, 80);
  const stateCode = clean(body.state, 2).toUpperCase(), zip = clean(body.zip, 10);
  if (name.length < 2) return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "FedEx prints a name on the label — add yours" }, { status: 400 });
  if (phoneDigits.length !== 10) return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "FedEx needs a 10-digit phone number for the label" }, { status: 400 });
  if (!street || !city || stateCode.length !== 2 || !/^\d{5}(-\d{4})?$/.test(zip)) {
    return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "street, city, 2-letter state and 5-digit ZIP, please" }, { status: 400 });
  }

  // Labels cost money: 6 mints per IP per hour. Charged HERE — past the
  // name/phone/ZIP validation and the existing-label shortcut, so a typo'd
  // ZIP or re-opening a label already issued no longer spends a try — and
  // before the delivery comm below, so a 429 leaves nothing half-written.
  if (!rateLimit(`golabel:${ip}`, 6, 60 * 60_000).ok) {
    return NextResponse.json({ ok: false, kind: "SERVICE_UNAVAILABLE", hint: "too many tries — give it a few minutes" }, { status: 429 });
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
            `Device: ${boxLabel}`, boxValue ? `Quote: $${boxValue}` : null, multi ? `Box: ${box.length} devices on one label` : null, `Session: ${sid}`,
            `Chat: https://topcashcellular.com/admin/chats?session=${sid}`,
            "--- Shipping Address ---", `${street}${unit ? `, ${unit}` : ""}`, `${city}, ${stateCode} ${zip}`,
            "Action: FedEx label minted from /go at address entry (see [LABEL:] marker); regenerate via /admin if needed.",
          ].filter(Boolean).join("\n"),
          tags: ["lead", "delivery", "shipping", `sess-${sid}`], priority: "urgent",
        }),
      });
    } catch { /* best-effort */ }
  }
  if (!sinceLock.some((t) => t.startsWith("HANDOFF-CHOICE:"))) await appendChatMsg(sid, "note", "HANDOFF-CHOICE: ship (free label) — address entered on /go");

  const result = await mintGoLabel({ leadId, name, phoneDigits, street, unit: unit || undefined, city, state: stateCode, zip, deviceLabel: boxLabel, declaredValueUsd: boxValue, kindLabel, alsoLeadIds: boxLeadIds });
  const link = `https://topcashcellular.com/admin/chats?session=${sid}`;
  if (!result.ok) {
    await appendChatMsg(sid, "note", `LABEL-FAILED: ${result.kind} — ${name}, ${city} ${stateCode} ${zip}`);
    if (result.kind === "SERVICE_UNAVAILABLE") {
      await notifyOwnerSms(`⚠️ GO label FAILED for ${boxLabel} (${name}, ${phoneDigits}) — ${result.hint}\n${link}`).catch(() => {});
    }
    return NextResponse.json(result, { status: result.kind === "ADDRESS_INVALID" ? 400 : 502 });
  }
  await appendChatMsg(sid, "note", `LABEL: tracking=${result.tracking} url=${result.url}${leadId ? ` lead=${leadId}` : ""}${multi ? ` box=${box.length}` : ""} — ${name}, ${city} ${stateCode} ${zip}`);

  // Deliver the label to the seller — text (relay) and/or email. The card on
  // the page shows it too, so a failed text is not a dead end.
  // texted / emailed go back to the page: the label card only says "we
  // texted you this link" when a text actually went out (the relay has been
  // down for days at a time).
  let texted = false;
  let emailed = false;
  if (!notesHaveOptOut(notes) && phoneDigits.length === 10) {
    texted = await sendSellerSms(phoneDigits, `Top Cash Cellular: your free FedEx label is ready — ${result.url}\nTracking ${result.tracking}. Box the ${boxNoun}, drop it at any FedEx location, and we text you the moment it lands. Reply STOP to opt out.`).catch(() => false);
  }
  if (isEmail && RESEND_KEY) {
    try {
      const { Resend } = await import("resend");
      const r = await new Resend(RESEND_KEY).emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>", replyTo: "support@topcashcellular.com", to: contact,
        subject: `Your free FedEx label for the ${boxNoun}`,
        html: mailShell({
          preheader: `Tracking ${result.tracking}`, eyebrow: "Your label", title: "Your FedEx label is ready",
          introHtml: `<span style="color:${MAIL.body}">Print it, box the ${multi ? esc(boxNoun) : "device"}, and drop it at any FedEx location. We text you the moment it lands and pay within 24 hours of inspection. Tracking <strong style="color:${MAIL.ink}">${esc(result.tracking)}</strong>.</span>`,
          buttonHref: result.url, buttonLabel: "Open my label",
        }),
        text: `Your FedEx label: ${result.url}\nTracking ${result.tracking}. Drop it at any FedEx location; we text you when it lands.`,
      });
      emailed = !r.error;
    } catch { /* the page card still shows the label */ }
  }
  await appendChatMsg(sid, "note", texted || emailed ? `SMS/email sent (label)` : `label delivery FAILED (page card only)`);
  await notifyOwnerSms(`📦 GO seller shipping: ${boxLabel}${boxValue ? ` $${boxValue}` : ""}${multi ? ` (${box.length} devices, one box)` : ""} — label minted, ${result.tracking} · ${name} ${phoneDigits}\n${link}`).catch(() => {});
  return NextResponse.json({ ok: true, tracking: result.tracking, url: result.url, service: result.service, texted, emailed, devices: box.length });
}
