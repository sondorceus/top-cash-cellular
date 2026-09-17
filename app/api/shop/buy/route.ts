import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { mutateListings, ListingsUnavailableError, type ShopListing } from "../../../lib/shop-listings";
import { validateEmail } from "../../../lib/email-validate";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { mailShell, esc } from "../../../lib/email-shell";
import { GRADE_LABEL } from "../../../lib/shop-grades";
import { BRAND, EMAIL, LOCATION_DISPLAY } from "../../../lib/constants";
import { SHOP_ENABLED } from "../../../lib/shop-flag";

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

type ClaimFailure = "gone" | "sold" | "on_hold" | "unavailable";
// maybeHeld: the store failed AFTER our hold write may have landed (lost
// put response + unreadable read-back) — see ListingsUnavailableError.
type Claim = { kind: "held"; listing: ShopListing; holdAt: string } | { kind: ClaimFailure; maybeHeld?: boolean };

const CLAIM_FAILED: Record<ClaimFailure, [number, string]> = {
  gone: [404, "That listing is gone."],
  sold: [409, "Sorry — this one just sold."],
  on_hold: [409, "Someone beat you to it — this device is on hold. If their deal falls through it comes right back."],
  // A store we can't read is NOT "that listing is gone" — nothing was
  // written, so the honest answer is try again.
  unavailable: [503, "We couldn't reach our inventory just now — give it a moment and try again."],
};

// Claim the unit. Two same-second buyers used to BOTH get 200 and a "nobody
// else can claim it" email (plain read-modify-write), and their overlapping
// writes could wipe the store. mutateListings() is a compare-and-swap now:
// of two buyers who both saw `listed`, exactly one write lands; the other
// re-reads, sees on_hold, and gets the 409. Postgres claim_unit() takes over
// when checkout goes live.
async function claimUnit(listingId: string): Promise<Claim> {
  const holdAt = new Date().toISOString();
  try {
    return await mutateListings<Claim>((ls) => {
      const l = ls.find((x) => x.id === listingId);
      if (!l || l.status === "removed") return { write: false, result: { kind: "gone" } };
      if (l.status !== "listed") return { write: false, result: { kind: l.status } };
      l.status = "on_hold";
      l.updatedAt = holdAt;
      return { write: true, result: { kind: "held", listing: { ...l }, holdAt } };
    });
  } catch (e) {
    if (e instanceof ListingsUnavailableError) return { kind: "unavailable", maybeHeld: e.maybeWritten };
    throw e;
  }
}

export async function POST(req: NextRequest) {
  // Storefront hidden (see lib/shop-flag) — no public feed, no reservations.
  if (!SHOP_ENABLED) return NextResponse.json({ error: "not found" }, { status: 404 });
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

  const claim = await claimUnit(listingId);
  if (claim.kind !== "held") {
    // Our hold may have landed even though we can't confirm it: the buyer's
    // retry would then get "on hold" and the unit would sit claimed with no
    // inquiry anywhere. Keep the lead — a person settles it from /admin/shop.
    // The buyer still gets the honest "try again".
    if (claim.maybeHeld) {
      try {
        await fetch(`${MC_API}/api/comms`, {
          method: "POST",
          headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "topcash-web",
            fromName: "Top Cash Cellular",
            role: "system",
            body: [
              `[SHOP-INQUIRY: ${listingId}]`,
              `Hold outcome unconfirmed — check /admin/shop (the buyer was told to try again; release the unit if it shows on hold with no other inquiry)`,
              `Buyer: ${name}`,
              `Email: ${emailRaw || "—"}`,
              `Phone: ${phone || "—"}`,
              `Fulfilment: ${fulfilment}`,
              message ? `Message: ${message}` : "",
            ].filter(Boolean).join("\n"),
            tags: ["shop", "inquiry"],
            priority: "urgent",
          }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {}
    }
    const [status, error] = CLAIM_FAILED[claim.kind];
    return NextResponse.json({ ok: false, error }, { status });
  }
  const { listing, holdAt } = claim;

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
      // Bounded: a hung MC (it restarts on every deploy) must fall through to
      // the SMS fallback, not hold the unit while the request times out.
      signal: AbortSignal.timeout(15_000),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      mcId = d?.message?.id || null;
    }
  } catch {}

  let smsSent = false;
  try {
    smsSent = await notifyOwnerSms(
      `SHOP SALE PENDING: ${name} wants the ${deviceLine} (${GRADE_LABEL[listing.grade]}) for $${price} — ${fulfilment}. ` +
        `Phone: ${phone || "N/A"} Email: ${emailRaw || "N/A"}. Listing is now ON HOLD.`,
    );
  } catch {}

  // NEITHER channel took it. Mission Control is the system of record and it is
  // unreachable (it restarts on every MC deploy), and the SMS fallback failed
  // too — so nobody will ever learn this person wanted this phone. Returning
  // ok:true here is the worst outcome available: the buyer gets a "we're
  // holding it for you" email, the unit stays locked out of inventory, and the
  // sale evaporates in silence. Put the listing back and tell them to call.
  // (/api/slots/[id]/book already does the honest thing and 502s — match it.)
  if (!mcId && !smsSent) {
    // Undo only OUR hold (updatedAt still the one we wrote) — if the owner
    // touched it since, it's his call now.
    const releasedAt = new Date().toISOString();
    try {
      await mutateListings((ls) => {
        const l = ls.find((x) => x.id === listingId);
        if (!l || l.status !== "on_hold" || l.updatedAt !== holdAt) return { write: false, result: undefined };
        l.status = "listed";
        l.updatedAt = releasedAt;
        return { write: true, result: undefined };
      });
    } catch {}
    return NextResponse.json(
      {
        ok: false,
        // No public phone number exists on purpose (see lib/constants.ts) —
        // email is the only channel we can honestly point them at.
        error: `We couldn't get your request through just now. Email us at ${EMAIL} and we'll hold it for you.`,
      },
      { status: 502 },
    );
  }

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
