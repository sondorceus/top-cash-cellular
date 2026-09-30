// /go shipping handoff: the seller types their address and the FedEx label
// prints right there — no "we'll text you for the address" round trip.
//
// POST { session, name, phone?, street, unit?, city, state, zip }
//   → { ok:true, tracking, url, service, texted, emailed, devices: string[], count, room }
//   → { ok:false, kind:"ADDRESS_INVALID"|"SERVICE_UNAVAILABLE", hint, withheld? }
//     (withheld, 2026-09-30: a desktop — no retry will print it)
// POST { session, join: true } (2026-09-30) — "put it in my box, same label":
//   the newest lock joins the open box (app/lib/go-box), no new label.
//   → { ok:true, tracking, url, joined:true, already, devices, count, room }
//   → 409 { ok:false, kind:"NOT_JOINABLE", reason, hint }
// POST { session, newLabel: true, …address } (2026-09-30) — "my box already
//   shipped" AFTER a join: the newest lock's joined label is set aside and it
//   gets a label of its own (a join can't be undone any other way).
//
// Gated on the session's own server-written notes: a LOCKED note (a real
// lead exists) and a CONTACT note. The lead id comes from the LEAD-ID note
// the lock route writes, so the [LABEL:] marker lands on the right lead row.
// Idempotent per lock: a lock that already has a label gets it back, no
// re-mint; a second device locked in the same thread gets its own label
// only when the seller says the first box already shipped — otherwise it
// joins that box (join:true, 2026-09-30).
// Several devices locked before the seller chose to ship ("+ i have another
// one") go in ONE box on ONE label: every lead in it gets the tracking.
// Labels cost money, so this is rate-limited harder than the chat.
import { NextRequest, NextResponse } from "next/server";
import { appendChatMsg, readChat, validGoSession } from "../../../lib/gochat-store";
import { legacySession, linkBinds, sessionOwned, setOwnerCookie } from "../../../lib/go-owner";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { mintGoLabel } from "../../../lib/go-label";
import { deviceKindFromString } from "../../../lib/fedex";
import { sendSellerSms, looksLikePhone, notesHaveOptOut } from "../../../lib/seller-sms";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { mailShell, MAIL } from "../../../lib/email-shell";
import { boxFor, boxRoom, isBoxClosed, joinable, joinOpenBox, labelLbs, openBox, openRoom, settledOffThread, shortDevice, windowStart } from "../../../lib/go-box";
import { findFreshLabel } from "../../../lib/fedex-retry";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Store read + MC comm + FedEx (25 s ceiling) + label blob + the seller's
// text/email — never legitimately more; the plan default let a stall hold
// "printing your label…" for five minutes (2026-09-26).
export const maxDuration = 90;

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
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "bad request" }, { status: 400 });
  const sid = typeof body.session === "string" ? body.session : "";
  if (!validGoSession(sid)) return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "start from your quote" }, { status: 400 });
  // OWNERSHIP (2026-09-26): only the browser that started this thread (its
  // tcc_go_owner cookie) or a texted link's k may print a label — checked
  // before any read or validation, so a bare session id in a stranger's
  // hands can't spend a FedEx label on their own address.
  const k = typeof body.k === "string" ? body.k : "";
  // LEGACY GRACE (2026-09-26): a session started before binding shipped has
  // no cookie anywhere — the first cookie-less browser that presents one is
  // its owner (go-owner legacySession); one flags-only list, no fetches.
  let graceBind = false;
  if (!sessionOwned(req, sid, k)) {
    const flags = await readChat(sid, Date.now());
    if (!legacySession(flags.firstTs) || flags.bound) return NextResponse.json({ ok: false, kind: "UNBOUND", hint: "Open the link from your text to print your label." }, { status: 403 });
    graceBind = true;
    await appendChatMsg(sid, "ctl", "bound"); // the grace is spent on this take
  }
  // A link (or the grace) that just proved ownership binds this browser for
  // the rest of the visit (the reply carries the cookie).
  const bound = (res: NextResponse) => { if (graceBind || linkBinds(req, sid, k)) setOwnerCookie(res, sid); return res; };

  // "put it in my box — same label" (2026-09-30): a device locked after the
  // first one was labeled rides in that box. No address, no FedEx call, no
  // spend — so no mint rate limit; joinOpenBox is idempotent per lock.
  if (body.join === true) {
    const r = await joinOpenBox(sid, "page");
    if (!r.ok) return bound(NextResponse.json({ ok: false, kind: "NOT_JOINABLE", reason: r.reason, hint: r.hint }, { status: 409 }));
    return bound(NextResponse.json({ ok: true, tracking: r.tracking, url: r.url, joined: true, already: r.already, devices: r.devices, count: r.count, room: r.room }));
  }

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
  // "my box already shipped" after a join (2026-09-30, review): nothing else
  // takes a join back, and every "newest lock is labeled" check would hand
  // the shipped box's label back forever. Only a lock whose every label is a
  // join — never one we minted for it. Once asked, that box is closed, so a
  // retry after a failed print (plain "ship") still gets the new label.
  const priorTracking = prior?.match(/tracking=(\S+)/)?.[1] || "";
  const undoJoin = !!prior && sinceLock.filter((t) => t.startsWith("LABEL: ")).every((t) => / joined=1\b/.test(t))
    && (body.newLabel === true || isBoxClosed(noteMsgs, priorTracking));
  if (prior && !undoJoin) {
    const m = prior.match(/tracking=(\S+) url=(\S+)/);
    // With the box's device list (2026-09-30): the card said "box the
    // device" over a label that covered two phones. Room only while the box
    // is open (2026-09-30, review: a closed or stale box still said "more
    // phones? they can go in this same box").
    const pb = m ? boxFor(noteMsgs, m[1]) : null;
    if (m) return bound(NextResponse.json({ ok: true, tracking: m[1], url: m[2], service: "FedEx", existing: true, ...(pb ? { devices: pb.devices, count: pb.count, room: openRoom(noteMsgs, pb) } : {}) }));
  }
  const contact = contactNote.slice("CONTACT: ".length).trim();
  // "LOCKED: iPhone 17 Pro 256 good unlocked $560 — 512…" → device + value
  const lockBody = locked.slice("LOCKED:".length).split(" — ")[0].trim();
  const offer = Number(lockBody.match(/\$(\d+)/)?.[1] || 0) || undefined;
  const deviceLabel = lockBody.replace(/\s*\$\d+.*$/, "").replace(/\s*\(manual\)\s*$/, "").trim() || "device";

  const name = clean(body.name, 80);
  const phoneDigits = (clean(body.phone, 30) || (looksLikePhone(contact) ? contact : "")).replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
  const street = clean(body.street, 120), unit = clean(body.unit, 40), city = clean(body.city, 80);
  const stateCode = clean(body.state, 2).toUpperCase(), zip = clean(body.zip, 10);
  const invalid = (): NextResponse | null => {
    if (name.length < 2) return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "FedEx prints a name on the label — add yours" }, { status: 400 });
    if (phoneDigits.length !== 10) return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "FedEx needs a 10-digit phone number for the label" }, { status: 400 });
    if (!street || !city || stateCode.length !== 2 || !/^\d{5}(-\d{4})?$/.test(zip)) {
      return NextResponse.json({ ok: false, kind: "ADDRESS_INVALID", hint: "street, city, 2-letter state and 5-digit ZIP, please" }, { status: 400 });
    }
    return null;
  };
  // A posted address is checked before the Mission Control looks below
  // (2026-09-30, review), so a typo'd ZIP costs no scan. A POST with no
  // address at all — the page asking for this lock's label after a join
  // was refused "labeled" — is checked after the /admin-label look, which
  // may hand that label back.
  if (street) { const bad = invalid(); if (bad) return bad; }

  // The box: every device locked since the seller last settled a handoff (a
  // label, a meet pick, or a pick that sent the label to the team — go-box
  // WINDOW_CLOSE_RE). The newest lock is always in it. A device they already
  // chose to MEET for, one already labeled, or one staff are labeling from
  // /admin is not. The page's own "ship" pick doesn't close it (2026-09-30):
  // "ship" on #1, then lock #2, then the address form left #1 out of the box
  // with no label at all. Only a handoff settled BEFORE the newest lock
  // counts — one after it is this lock's own (an outage retry).
  const lastDecisionTs = windowStart(noteMsgs, lockedNote.ts);
  // Belt and braces (2026-09-30, review): an earlier waiting lock whose own
  // print failed (or stalled at "address entered") may have been finished
  // off this thread — sold at a meetup arranged by text, cancelled, or
  // labeled in /admin before /admin wrote a LABEL note here. It isn't
  // waiting for this box: this label would "cover" it and overwrite its
  // [LABEL:] marker. Looked up only for such a lock (go-box).
  const offThread = await settledOffThread(sid, noteMsgs);
  const box = noteMsgs
    .filter((m) => m.text.startsWith("LOCKED:") && (m.ts > lastDecisionTs || m === lockedNote) && (m === lockedNote || !offThread.lockTs.has(m.ts)))
    .map((m) => {
      const b = m.text.slice("LOCKED:".length).split(" — ")[0].trim();
      return { device: b.replace(/\s*\$\d+.*$/, "").replace(/\s*\(manual\)\s*$/, "").trim() || "device", offer: Number(b.match(/\$(\d+)/)?.[1] || 0) || 0 };
    });
  const multi = box.length > 1;
  const boxLeadIds = multi
    ? noteMsgs.filter((m) => m.text.startsWith("LEAD-ID: ") && m.ts > lastDecisionTs).map((m) => m.text.slice("LEAD-ID: ".length).trim()).filter((id) => !!id && !offThread.leadIds.has(id))
    : [];
  const boxLabel = multi ? box.map((b) => b.device).join(" + ") : deviceLabel;
  const boxValue = multi ? box.reduce((sum, b) => sum + b.offer, 0) || undefined : offer;
  // Size the package for the heaviest thing in it (the kind check stops at
  // the first match, so "iPhone 16 + PS5" alone would read as a phone).
  const KIND_RANK: Record<string, number> = { desktop: 5, console: 4, laptop: 3, tablet: 2, phone: 1 };
  const kindLabel = multi ? [...box].sort((a, b) => (KIND_RANK[deviceKindFromString(b.device) || ""] || 0) - (KIND_RANK[deviceKindFromString(a.device) || ""] || 0))[0].device : undefined;
  // The weight FedEx rates this label at (2026-09-30, review): several
  // devices were rated as the heaviest one alone — two PS5s on a 12 lb label.
  // The BOX note keeps it, so a later join never outgrows it.
  const lbs = labelLbs(box.map((b) => b.device));
  const room = boxRoom({ count: box.length, heaviest: kindLabel || deviceLabel, lbs });
  const boxNoun = multi ? `${box.length} devices` : shortDevice(deviceLabel);
  // The seller copy names what goes in the box (2026-09-30): "put the iPhone
  // 16 Pro Max and iPhone 17 Pro Max in one box", not "box the device".
  const shorts = box.map((b) => shortDevice(b.device));
  const boxList = shorts.length <= 1 ? shorts.join("") : `${shorts.slice(0, -1).join(", ")} and ${shorts[shorts.length - 1]}`;

  // A lock the team was handed — an SMS SHIP ("generate the label from
  // /admin") or a FedEx outage the owner was alerted to mint — may already
  // have its label from /admin, which writes only the MC [LABEL:] marker,
  // never a note here. The outage hint invites a retry, so look before
  // buying a second label (2026-09-30, review). Bounded: a slow MC read
  // falls through to the mint, as before.
  // The undo path too (2026-09-30, review): a joined lock whose box already
  // went out may have been handed to staff (an SMS SHIP join, the bot's
  // "NEW LABEL NEEDED") who minted it a label in /admin — "my box already
  // shipped" then bought a second one the page never showed.
  // And an SMS SHIP that got the box question (BOX-ASK, 2026-09-30,
  // review): the owner was told to answer it himself and may have minted
  // this lock's label in /admin.
  const link = `https://topcashcellular.com/admin/chats?session=${sid}`;
  // An /admin label this box can't ride on (see below) — the mint's owner
  // alert says to void it.
  let staffUnused = null as { tracking: string } | null;
  // Runs once per request: before the address check for a POST with no
  // address (see invalid above), else after it.
  let staffLooked = false;
  const adoptStaff = async (): Promise<NextResponse | null> => {
    if (staffLooked) return null;
    staffLooked = true;
    if (!(leadId && (undoJoin || sinceLock.some((t) => /^(LABEL-FAILED: SERVICE_UNAVAILABLE|HANDOFF-CHOICE: ship \(free label\) — replied by text|BOX-ASK: )/.test(t))) && rateLimit(`golabelscan:${ip}`, 10, 60 * 60_000).ok)) return null;
    const staff = await Promise.race([findFreshLabel(leadId).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 20_000))]);
    // A tracking this thread already knows (a box this lock joined) is not
    // a label the team minted for it.
    if (staff && !notes.some((t) => t.includes(`tracking=${staff.tracking} `))) {
      // /admin rated its label for THIS lead's device alone (2026-09-30,
      // review) — not the box's heaviest. It carries the waiting box only
      // when a join could (go-box): phones, within that label's phone count.
      // Otherwise it isn't handed out: the box gets one label below and the
      // owner is told to void the /admin one — a laptop on a 2 lb phone label
      // is a FedEx weight correction, and its mate would have no marker.
      const staffLbs = labelLbs([deviceLabel]);
      const phonesOnly = box.every((b) => (KIND_RANK[deviceKindFromString(b.device) || ""] || 0) <= 1);
      const fitsStaff = !multi || (phonesOnly && box.length <= boxRoom({ count: 0, heaviest: deviceLabel, lbs: staffLbs }));
      if (fitsStaff) {
        const ts = Date.now();
        const staffLeads = [...new Set([leadId, ...boxLeadIds].filter((x): x is string => !!x))];
        await Promise.all([
          appendChatMsg(sid, "note", `LABEL: tracking=${staff.tracking} url=${staff.url} lead=${leadId}${multi ? ` box=${box.length}` : ""} — minted by the team in /admin`, ts),
          appendChatMsg(sid, "note", `BOX: tracking=${staff.tracking} url=${staff.url} count=${box.length} leads=${staffLeads.join(",")} lbs=${staffLbs} devices=${box.map((b) => b.device).join(" + ")}`, ts + 1),
          // The joined box this lock is leaving already went out.
          ...(undoJoin && !isBoxClosed(noteMsgs, priorTracking) ? [appendChatMsg(sid, "note", `BOX-CLOSED: tracking=${priorTracking} — seller: that box already shipped — the team minted its own label in /admin`, ts)] : []),
        ]);
        // Box-mates get the same no-cost marker mintGoLabel / a join posts
        // (2026-09-30, review): /admin marked only this lead, so the others
        // showed no tracking, fedex-poll never tracked them, reminders kept
        // nudging them, and a cancel read the shared label as void-able.
        if (MC_KEY) {
          for (const id of staffLeads.filter((x) => x !== leadId)) {
            await fetch(`${MC_API}/api/comms`, {
              method: "POST",
              headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
              signal: AbortSignal.timeout(10_000),
              body: JSON.stringify({
                from: "topcash-web", fromName: "Top Cash Cellular", role: "system",
                body: `[LABEL: ${id}] tracking=${staff.tracking} url=${staff.url} service=${staff.service || "FedEx"} source=go box=${leadId} joined=1`,
                tags: ["fedex-label", "auto-generated"], priority: "low",
              }),
            }).catch(() => console.error(`[go/label] box-mate marker failed for ${id} (${sid})`));
          }
        }
        if (multi) {
          await notifyOwnerSms(`📦 GO seller's box rides on the /admin label ${staff.tracking}: ${box.length} devices (${boxLabel}) — it was rated for the ${shortDevice(deviceLabel)} alone (${staffLbs} lb); box-mate markers posted\n${link}`).catch(() => {});
        }
        const sb = { count: box.length, heaviest: kindLabel || deviceLabel, lbs: staffLbs };
        return bound(NextResponse.json({ ok: true, tracking: staff.tracking, url: staff.url, service: staff.service || "FedEx", existing: true, devices: box.map((b) => b.device), count: box.length, room: boxRoom(sb) }));
      }
      staffUnused = { tracking: staff.tracking };
    }
    return null;
  };
  if (!street) { const r = await adoptStaff(); if (r) return r; }
  { const bad = invalid(); if (bad) return bad; }
  { const r = await adoptStaff(); if (r) return r; }

  // Labels cost money: 6 mints per IP per hour. Charged HERE — past the
  // name/phone/ZIP validation and the existing-label shortcut, so a typo'd
  // ZIP or re-opening a label already issued no longer spends a try — and
  // before the delivery comm below, so a 429 leaves nothing half-written.
  if (!rateLimit(`golabel:${ip}`, 6, 60 * 60_000).ok) {
    return NextResponse.json({ ok: false, kind: "SERVICE_UNAVAILABLE", hint: "too many tries — give it a few minutes" }, { status: 429 });
  }

  // The same [DELIVERY OPTION] SHIPPING comm the homepage funnel writes, so
  // the admin lead row and the reminders cron see the choice + address.
  // Posted AFTER the mint (2026-09-27): it used to go out first, so every
  // ADDRESS_INVALID retry added another comm with a slightly different
  // address. A label, or FedEx being down (the team mints from /admin and
  // needs the address), posts it once; a bad-address retry posts nothing.
  const isEmail = EMAIL_RE.test(contact);
  const postDeliveryComm = async () => {
    if (!MC_KEY) return;
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        // Bounded (2026-09-26): a stalled MC used to hold the label mint.
        signal: AbortSignal.timeout(10_000),
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
  };
  if (!sinceLock.some((t) => t.startsWith("HANDOFF-CHOICE:"))) await appendChatMsg(sid, "note", "HANDOFF-CHOICE: ship (free label) — address entered on /go");
  // A new label while a box is open means the seller said "my box already
  // shipped" (or this device can't ride in it): that box is never offered
  // for joining again (2026-09-30).
  const prevBox = openBox(noteMsgs);
  if (undoJoin) {
    if (!isBoxClosed(noteMsgs, priorTracking)) await appendChatMsg(sid, "note", `BOX-CLOSED: tracking=${priorTracking} — seller: that box already shipped — new label for the device added to it`);
  } else if (prevBox) {
    const j = joinable(noteMsgs);
    // "chosen" (an SMS SHIP sent this lock's label to the team) says
    // nothing about the earlier box — it may still be on the table with
    // room, so it stays open (2026-09-30, review).
    if (j.ok || j.reason !== "chosen") {
      const why = j.ok ? "seller chose a new label — first box already shipped"
        : j.reason === "heavier" ? "new label — only phones join a labeled box"
        : j.reason === "full" ? "new label — that label has no room"
        : "new label minted";
      await appendChatMsg(sid, "note", `BOX-CLOSED: tracking=${prevBox.tracking} — ${why}`);
    }
  }

  const result = await mintGoLabel({ leadId, name, phoneDigits, street, unit: unit || undefined, city, state: stateCode, zip, deviceLabel: boxLabel, declaredValueUsd: boxValue, kindLabel, alsoLeadIds: boxLeadIds, deviceCount: box.length, weightLbs: multi ? lbs : undefined });
  const staffLine = staffUnused ? `\n/admin label ${staffUnused.tracking} was rated for the ${shortDevice(deviceLabel)} alone and this box holds ${box.length} devices — not handed out` : "";
  if (!result.ok) {
    // A withheld label (a desktop — shouldBlockAutoShip) fails the same way
    // on every tap: the comm and the owner alert go out once per lock
    // (2026-09-30, review).
    const repeatWithheld = result.withheld === true && sinceLock.some((t) => t.startsWith("LABEL-FAILED: SERVICE_UNAVAILABLE"));
    await appendChatMsg(sid, "note", `LABEL-FAILED: ${result.kind} — ${name}, ${city} ${stateCode} ${zip}`);
    if (result.kind === "SERVICE_UNAVAILABLE" && !repeatWithheld) {
      await postDeliveryComm();
      await notifyOwnerSms(`⚠️ GO label FAILED for ${boxLabel} (${name}, ${phoneDigits}) — ${result.hint}${staffLine}\n${link}`).catch(() => {});
    }
    return NextResponse.json(result, { status: result.kind === "ADDRESS_INVALID" ? 400 : 502 });
  }
  await postDeliveryComm();
  // BOX (2026-09-30): what this label covers, so a device locked later can
  // join it (app/lib/go-box). Written just after the LABEL note (ts + 1).
  // The paying lead first — box-mates' [LABEL:] markers name it as box=.
  const labelTs = Date.now();
  const boxLeads = [...new Set([leadId, ...boxLeadIds].filter((x): x is string => !!x))];
  await Promise.all([
    appendChatMsg(sid, "note", `LABEL: tracking=${result.tracking} url=${result.url}${leadId ? ` lead=${leadId}` : ""}${multi ? ` box=${box.length}` : ""} — ${name}, ${city} ${stateCode} ${zip}`, labelTs),
    appendChatMsg(sid, "note", `BOX: tracking=${result.tracking} url=${result.url} count=${box.length} leads=${boxLeads.join(",")} lbs=${lbs} devices=${box.map((b) => b.device).join(" + ")}`, labelTs + 1),
  ]);

  // Deliver the label to the seller — text (relay) and/or email. The card on
  // the page shows it too, so a failed text is not a dead end.
  // texted / emailed go back to the page: the label card only says "we
  // texted you this link" when a text actually went out (the relay has been
  // down for days at a time).
  // "checked in at our warehouse", not "the moment it lands" (2026-09-26):
  // the FedEx tracking poll is blind (Track API 403), so the text goes out
  // at check-in and the copy says so.
  let texted = false;
  let emailed = false;
  // Several devices are named and one box is spelled out; "more phones?"
  // tells a seller with a third one it rides on this label too (2026-09-30)
  // — only while the label has room for one (go-box boxRoom: a laptop or
  // console label has none, a full phone box neither).
  // The relay cuts at 480 chars — a long list falls back to the count so the
  // STOP line always survives.
  const more = room > 0 ? " More phones? They can go in this same box — lock them in the chat first." : "";
  const boxLine = (list: string) => `${multi ? `Put the ${list} in one box — wrap each one` : `Box the ${list}`}, drop it at any FedEx location, and we'll text you when it's checked in at our warehouse.${more} Reply STOP to opt out.`;
  const smsHead = `Top Cash Cellular: your free FedEx label is ready — ${result.url}\nTracking ${result.tracking}. `;
  const smsBody = (smsHead + boxLine(boxList)).length <= 480 ? smsHead + boxLine(boxList) : smsHead + boxLine(boxNoun);
  if (!notesHaveOptOut(notes) && phoneDigits.length === 10) {
    texted = await sendSellerSms(phoneDigits, smsBody).catch(() => false);
  }
  // The address to email: an email contact, or the EMAIL-FALLBACK a phone
  // seller left when their lock text failed (confirm-email writes it as its
  // own note since 2026-09-26, so the phone stays the newest CONTACT).
  const fallbackEmail = [...notes].reverse().find((t) => t.startsWith("EMAIL-FALLBACK: "))?.slice("EMAIL-FALLBACK: ".length).trim() || "";
  const emailTo = isEmail ? contact : EMAIL_RE.test(fallbackEmail) ? fallbackEmail : "";
  if (emailTo && RESEND_KEY) {
    try {
      const { Resend } = await import("resend");
      const r = await new Resend(RESEND_KEY).emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>", replyTo: "support@topcashcellular.com", to: emailTo,
        subject: `Your free FedEx label for the ${boxNoun}`,
        html: mailShell({
          preheader: `Tracking ${result.tracking}`, eyebrow: "Your label", title: "Your FedEx label is ready",
          introHtml: `<span style="color:${MAIL.body}">Print it, ${multi ? `put the ${esc(boxList)} in one box — wrap each one —` : `box the ${esc(boxNoun)},`} and drop it at any FedEx location. We'll text you when it's checked in at our warehouse and pay within 24 hours of inspection. Tracking <strong style="color:${MAIL.ink}">${esc(result.tracking)}</strong>.${more}</span>`,
          buttonHref: result.url, buttonLabel: "Open my label",
        }),
        text: `Your FedEx label: ${result.url}\nTracking ${result.tracking}. ${multi ? `Put the ${boxList} in one box — wrap each one. ` : ""}Drop it at any FedEx location; we'll text you when it's checked in at our warehouse.${more}`,
      });
      emailed = !r.error;
    } catch { /* the page card still shows the label */ }
  }
  await appendChatMsg(sid, "note", texted || emailed ? `SMS/email sent (label)` : `label delivery FAILED (page card only)`);
  await notifyOwnerSms(`📦 GO seller shipping: ${boxLabel}${boxValue ? ` $${boxValue}` : ""}${multi ? ` (${box.length} devices, one box)` : ""} — label minted, ${result.tracking} · ${name} ${phoneDigits}${staffLine ? `${staffLine}: void it` : ""}\n${link}`).catch(() => {});
  // devices is the list now, count the number, room how many more phones
  // the label carries (2026-09-30).
  return bound(NextResponse.json({ ok: true, tracking: result.tracking, url: result.url, service: result.service, texted, emailed, devices: box.map((b) => b.device), count: box.length, room }));
}
