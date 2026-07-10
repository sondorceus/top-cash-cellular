import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { readListingsDoc, writeListingsDoc } from "../../../lib/shop-listings";
import { validateEmail } from "../../../lib/email-validate";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { mailShell, esc } from "../../../lib/email-shell";
import { GRADE_LABEL } from "../../../lib/shop-grades";
import { BRAND, EMAIL, LOCATION_DISPLAY } from "../../../lib/constants";

// Shop v1 sells by RESERVATION, not checkout. There is no Stripe yet, and no
// card is ever taken here: the buyer claims a unit, Skywalker confirms and
// closes in person (cash — the store is local-pickup-first) or by Zelle /
// Cash App before shipping. Exactly how buyback handoffs already work, with
// the money flowing the other way.
//
// Reserving flips the listing to on_hold so the storefront immediately shows
// it as claimed — a one-of-one store must never let a second buyer fall in
// love with a phone that's spoken for. The hold is human-mediated: no expiry
// timer, Skywalker releases or completes it from /admin/shop.
//
// Buyer contact details go to Mission Control comms and owner email ONLY —
// never into the listings blob. Blob URLs are public; MC is the system of
// record for customer PII on the buyback side already, so the sell side uses
// the same drawer.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

const INQUIRY_LIMIT = 5; // per IP per 10 min — same shape as /api/lead
const INQUIRY_WINDOW_MS = 10 * 60 * 1000;

// Strip the two characters that could forge a downstream [TAG:] marker in the
// MC body, same defense as the sales route's clean().
function clean(v: unknown, maxLen = 200): string {
  return String(v ?? "").replace(/[\[\]]/g, "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`shop-buy:${ip}`, INQUIRY_LIMIT, INQUIRY_WINDOW_MS);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs, "Too many requests — give it a minute and try again.");

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const listingId = clean(payload.listingId, 40);
  const name = clean(payload.name, 80);
  const emailRaw = clean(payload.email, 120);
  const phone = clean(payload.phone, 30);
  const fulfilment = payload.fulfilment === "ship" ? "ship" : "pickup";
  const message = clean(payload.message, 400);

  if (!listingId || !name) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }
  if (!emailRaw && !phone) {
    return NextResponse.json({ ok: false, error: "Give us an email or a phone number so we can reach you." }, { status: 400 });
  }
  if (emailRaw) {
    const check = await validateEmail(emailRaw);
    if (!check.ok) {
      return NextResponse.json(
        { ok: false, error: check.suggestion ? `Did you mean ${check.suggestion}?` : "That email doesn't look right." },
        { status: 400 },
      );
    }
  }

  // Claim the unit. Read-modify-write on the blob is racy in theory, but the
  // loser of a same-second race is caught by the owner (two inquiry emails,
  // one phone) — a human mediates every sale in v1, so the race is annoying,
  // not costly. Postgres claim_unit() takes over when checkout goes live.
  const doc = await readListingsDoc();
  const listing = doc.listings.find((l) => l.id === listingId);
  if (!listing || listing.status === "removed") {
    return NextResponse.json({ ok: false, error: "That listing is gone." }, { status: 404 });
  }
  if (listing.status === "sold") {
    return NextResponse.json({ ok: false, error: "Sorry — this one just sold." }, { status: 409 });
  }
  if (listing.status === "on_hold") {
    return NextResponse.json(
      { ok: false, error: "Someone beat you to it — this device is on hold. If their deal falls through it comes right back." },
      { status: 409 },
    );
  }

  listing.status = "on_hold";
  listing.updatedAt = new Date().toISOString();
  await writeListingsDoc(doc.listings);

  const price = (listing.priceCents / 100).toFixed(2);
  const deviceLine = [listing.modelLabel, listing.storage, listing.color, listing.carrier]
    .filter(Boolean)
    .join(" · ");

  // System of record first: the MC message is the one write that must stick.
  let mcId: string | null = null;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: [
          `[SHOP-INQUIRY: ${listing.id}]`,
          `Device: ${deviceLine}`,
          `Grade: ${GRADE_LABEL[listing.grade]}`,
          `Price: $${price}`,
          `Buyer: ${name}`,
          `Email: ${emailRaw || "—"}`,
          `Phone: ${phone || "—"}`,
          `Fulfilment: ${fulfilment}`,
          message ? `Message: ${message}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        tags: ["shop", "inquiry"],
        priority: "urgent",
      }),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      mcId = d?.message?.id || null;
    }
  } catch {}

  try {
    await notifyOwnerSms(
      `SHOP SALE PENDING: ${name} wants the ${deviceLine} (${GRADE_LABEL[listing.grade]}) for $${price} — ${fulfilment}. ` +
        `Phone: ${phone || "N/A"} Email: ${emailRaw || "N/A"}. Listing is now ON HOLD.`,
    );
  } catch {}

  // Buyer confirmation. Best-effort — the reservation stands even if Resend
  // hiccups; the owner has the contact info either way.
  if (emailRaw && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: `${BRAND} <noreply@topcashcellular.com>`,
        replyTo: EMAIL,
        to: emailRaw,
        subject: `Your ${listing.modelLabel} is on hold — we'll text you to arrange ${fulfilment === "pickup" ? "pickup" : "delivery"}`,
        html: mailShell({
          preheader: `We're holding the ${deviceLine} for you.`,
          eyebrow: "Reserved",
          title: `The ${esc(listing.modelLabel)} is yours to claim`,
          introHtml:
            `<p>Hey ${esc(name.split(" ")[0])},</p>` +
            `<p>We've put a hold on the <strong>${esc(deviceLine)}</strong> — ` +
            `${esc(GRADE_LABEL[listing.grade])} condition, <strong>$${esc(price)}</strong>. Nobody else can claim it while we talk.</p>` +
            `<p>${
              fulfilment === "pickup"
                ? `We'll reach out shortly to set a pickup time here in ${esc(LOCATION_DISPLAY)}. Pay when you have it in hand — cash, Zelle, or Cash App.`
                : `We'll reach out shortly to confirm payment (Zelle or Cash App) and get it shipped to you.`
            }</p>`,
          afterButtonHtml: `<p style="font-size:13px;">Every device is tested by us before it's listed, and you get <strong>30 days</strong> to return it. Questions? Just reply to this email.</p>`,
        }),
        text:
          `We're holding the ${deviceLine} (${GRADE_LABEL[listing.grade]}) for you at $${price}. ` +
          (fulfilment === "pickup"
            ? `We'll text you to set a pickup time in ${LOCATION_DISPLAY} — pay in person by cash, Zelle, or Cash App.`
            : `We'll text you to confirm payment (Zelle or Cash App) and shipping.`) +
          ` 30-day returns on everything. — ${BRAND}`,
      });
    } catch {}
  }

  return NextResponse.json({ ok: true, mcId });
}
