// FedEx Ship API integration. Generates a return label (customer →
// TCC Austin) when a lead's status is marked "Shipped". Account-billed
// to TCC, dropped off at any FedEx location by the customer.
//
// Auth: OAuth 2.0 client credentials. Token cached in-process for ~50min
// (FedEx tokens last 1h). Sandbox vs production controlled by
// FEDEX_API_URL env — defaults to sandbox so we can never accidentally
// print a billable label before Skywalker flips it to prod.

const DEFAULT_BASE = "https://apis-sandbox.fedex.com";
const TCC_RETURN_PHONE = process.env.TCC_RETURN_PHONE || "5129609256";

function getBase(): string {
  return (process.env.FEDEX_API_URL || DEFAULT_BASE).replace(/\/$/, "");
}

function getClientId(): string {
  return process.env.FEDEX_CLIENT_ID || "";
}
function getClientSecret(): string {
  return process.env.FEDEX_CLIENT_SECRET || "";
}
function getAccountNumber(): string {
  return process.env.FEDEX_ACCOUNT_NUMBER || "";
}

// Where customers ship devices TO. Pulled from envs so Skywalker can
// update address without a redeploy. Defaults safe-but-bogus so a
// misconfigured env produces a clear sandbox error rather than mailing
// to whatever I happened to hardcode.
function getReturnAddress() {
  return {
    streetLines: [process.env.TCC_RETURN_STREET || "TBD — set TCC_RETURN_STREET"],
    city: process.env.TCC_RETURN_CITY || "Austin",
    stateOrProvinceCode: process.env.TCC_RETURN_STATE || "TX",
    postalCode: process.env.TCC_RETURN_ZIP || "78701",
    countryCode: "US",
  };
}

function getReturnContact() {
  return {
    personName: process.env.TCC_RETURN_NAME || "Top Cash Cellular",
    phoneNumber: TCC_RETURN_PHONE,
    companyName: "Top Cash Cellular",
  };
}

// Token cache. Module-scoped so it survives across API requests inside
// the same serverless instance. Worst case (cold start) we fetch a new
// token — cheap and rate-limited well within FedEx's limits.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("FedEx not configured — set FEDEX_CLIENT_ID + FEDEX_CLIENT_SECRET on Vercel.");
  }
  const res = await fetch(`${getBase()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FedEx OAuth failed: ${res.status}${body ? " — " + body.slice(0, 300) : ""}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("FedEx OAuth returned no access_token");
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.token;
}

export type LabelInputs = {
  // Customer (shipper) info — they're the one dropping the package
  // at FedEx. FedEx requires a real phone + name on every shipper.
  customerName: string;
  customerPhone: string;
  customerStreet: string;
  customerUnit?: string;
  customerCity: string;
  customerState: string;
  customerZip: string;
  // Device hint for the package weight default. "phone"/"tablet" =
  // small mailer; "laptop"/"console"/"desktop" = bigger box. The
  // operator can override weightLbs per-call if needed.
  deviceKind?: "phone" | "tablet" | "laptop" | "console" | "desktop" | "other";
  weightLbs?: number;
  // Optional customer-reference text that prints on the label stub.
  // Useful for "3 devices · TCC-leadId" so the recipient (us) can match
  // a package to its lead without scanning the tracking number first.
  customerReference?: string;
  // Second customer-reference slot (PO number). FedEx allows up to 2.
  poNumber?: string;
};

export type LabelResult = {
  trackingNumber: string;
  // Base64-encoded PDF of the label. Caller persists to Vercel Blob.
  labelPdfBase64: string;
  serviceType: string;
};

// Per-device weight defaults calibrated against real device weights
// (PS5 ~10 lb, Mac Pro 40 lb, gaming PCs 30+ lb). These get OVER-stated
// slightly to cover box + packaging + small accessories. FedEx bills
// based on ACTUAL scanned weight regardless, so over-estimating here
// just sets the right rate-class for the initial label; it doesn't add
// cost. Under-estimating risks "weight correction" surcharges of
// $5-15 per package. Skywalker 2026-05-18.
function defaultWeight(kind?: LabelInputs["deviceKind"]): number {
  switch (kind) {
    case "phone":
    case "tablet":
      return 2;  // device + padded mailer
    case "laptop":
      return 6;  // 4 lb device + 2 lb box/padding
    case "console":
      return 12; // PS5/Xbox ~10 lb + box overhead
    case "desktop":
      return 35; // Mac Pro tower 40 lb / iMac 22 + huge box / gaming 30+
    default:
      return 3;
  }
}

// Aggregate weight across multiple devices in a single package. Used
// when /api/lead receives a multi-device cart with a ship handoff —
// FedEx sees ONE package with everything inside, billed by total
// weight + dimensions. Plus a 2 lb floor for the box itself.
export function aggregateWeight(devices: Array<{ deviceKind?: LabelInputs["deviceKind"] }>): number {
  if (!devices.length) return 3;
  const sum = devices.reduce((s, d) => s + defaultWeight(d.deviceKind), 0);
  return Math.max(3, sum + 2); // +2 lb packaging overhead
}

// Devices we should NOT auto-ship — too heavy or fragile. Customer
// should be steered to local pickup OR staff manually quotes the
// label cost before mint. Returns a friendly reason string for the
// admin / customer messaging.
export function shouldBlockAutoShip(kind?: LabelInputs["deviceKind"]): string | null {
  if (kind === "desktop") {
    return "Desktops are heavy enough that FedEx ground can cost $40-80 in shipping. Staff will quote you a label or arrange local pickup before printing.";
  }
  return null;
}

function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

// Creates a FedEx Ground prepaid drop-off label for the customer to ship
// to Top Cash. Billed to the TCC FedEx account. Returns tracking + PDF.
export async function createReturnLabel(input: LabelInputs): Promise<LabelResult> {
  const accountNumber = getAccountNumber();
  if (!accountNumber) {
    throw new Error("FedEx not configured — set FEDEX_ACCOUNT_NUMBER on Vercel.");
  }
  const token = await getAccessToken();
  const shipDate = new Date().toISOString().slice(0, 10);
  const weight = input.weightLbs ?? defaultWeight(input.deviceKind);
  const phone = digitsOnly(input.customerPhone);
  if (phone.length < 10) {
    throw new Error("Customer phone required (10 digits min) — FedEx rejects shipments without one.");
  }
  const customerStreetLines = [
    input.customerStreet,
    ...(input.customerUnit ? [input.customerUnit] : []),
  ];

  const body = {
    labelResponseOptions: "LABEL",
    accountNumber: { value: accountNumber },
    requestedShipment: {
      shipper: {
        contact: {
          personName: input.customerName,
          phoneNumber: phone,
        },
        address: {
          streetLines: customerStreetLines,
          city: input.customerCity,
          stateOrProvinceCode: input.customerState,
          postalCode: digitsOnly(input.customerZip).slice(0, 5),
          countryCode: "US",
        },
      },
      recipients: [
        {
          contact: getReturnContact(),
          address: getReturnAddress(),
        },
      ],
      shipDatestamp: shipDate,
      serviceType: "FEDEX_GROUND",
      packagingType: "YOUR_PACKAGING",
      pickupType: "DROPOFF_AT_FEDEX_LOCATION",
      shippingChargesPayment: {
        paymentType: "SENDER",
        payor: { responsibleParty: { accountNumber: { value: accountNumber } } },
      },
      labelSpecification: {
        imageType: "PDF",
        labelStockType: "PAPER_LETTER",
      },
      requestedPackageLineItems: [
        {
          weight: { units: "LB", value: weight },
          // customerReferences prints on the label stub. CUSTOMER_REFERENCE
          // gets the most prominent slot; P_O_NUMBER is the secondary.
          // We use CUSTOMER_REFERENCE for the device count so the recipient
          // immediately sees "3 devices" without scanning, and P_O_NUMBER
          // for the lead ID so the lead lookup is trivial.
          customerReferences: [
            ...(input.customerReference ? [{
              customerReferenceType: "CUSTOMER_REFERENCE",
              value: input.customerReference.slice(0, 30),
            }] : []),
            ...(input.poNumber ? [{
              customerReferenceType: "P_O_NUMBER",
              value: input.poNumber.slice(0, 30),
            }] : []),
          ],
        },
      ],
    },
  };

  const res = await fetch(`${getBase()}/ship/v1/shipments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-locale": "en_US",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`FedEx Ship API ${res.status}${errBody ? " — " + errBody.slice(0, 500) : ""}`);
  }
  const data = (await res.json()) as {
    output?: {
      transactionShipments?: Array<{
        masterTrackingNumber?: string;
        serviceType?: string;
        pieceResponses?: Array<{
          trackingNumber?: string;
          packageDocuments?: Array<{ contentType?: string; encodedLabel?: string; url?: string }>;
        }>;
      }>;
    };
  };
  const ship = data.output?.transactionShipments?.[0];
  const tracking = ship?.masterTrackingNumber || ship?.pieceResponses?.[0]?.trackingNumber || "";
  const docs = ship?.pieceResponses?.[0]?.packageDocuments || [];
  const label = docs.find((d) => d.encodedLabel) || docs[0];
  if (!tracking || !label?.encodedLabel) {
    throw new Error("FedEx response missing tracking or label PDF.");
  }
  return {
    trackingNumber: tracking,
    labelPdfBase64: label.encodedLabel,
    serviceType: ship?.serviceType || "FEDEX_GROUND",
  };
}

// Convenience for the admin lead-status hook. Maps a Lead's parsed
// device-type string to the LabelInputs deviceKind enum.
export function deviceKindFromString(s?: string): LabelInputs["deviceKind"] {
  const k = (s || "").toLowerCase();
  if (k.includes("phone") || k.includes("iphone") || k.includes("galaxy") || k.includes("pixel")) return "phone";
  if (k.includes("tablet") || k.includes("ipad")) return "tablet";
  if (k.includes("laptop") || k.includes("macbook") || k.includes("book")) return "laptop";
  if (k.includes("console") || k.includes("ps5") || k.includes("xbox") || k.includes("switch")) return "console";
  if (k.includes("desktop") || k.includes("imac") || k.includes("mac mini") || k.includes("alienware")) return "desktop";
  return "other";
}

// Track API — Skywalker 2026-05-19. Polls a tracking number's current
// state so the fedex-poll cron can auto-flip lead statuses without
// staff babysitting. Reuses the same OAuth token as createReturnLabel.
//
// FedEx event type codes we care about (full list in their docs):
//   OC = Order Created (label minted, not yet picked up)
//   PU = Picked Up (FedEx physically has it)
//   IT = In Transit (intermediate sorting)
//   OD = Out for Delivery (last-mile, will be delivered today)
//   DL = Delivered (final state)
//   CA / DE = Cancelled / Delivery Exception (problem state)
//
// Returns a normalized state for the cron's decision tree:
//   - "label_created" → customer hasn't dropped off yet
//   - "picked_up" → on its way
//   - "out_for_delivery" → arriving today
//   - "delivered" → mark received
//   - "exception" → flag for staff review
//   - "unknown" → FedEx couldn't find the number (typo?, too new)
export type TrackingState = "label_created" | "picked_up" | "out_for_delivery" | "delivered" | "exception" | "unknown";
export type TrackingResult = {
  trackingNumber: string;
  state: TrackingState;
  lastEventCode?: string;
  lastEventDescription?: string;
  lastEventDate?: string;
  deliveredAt?: string;
};

export async function getTracking(trackingNumber: string): Promise<TrackingResult> {
  if (!trackingNumber || !/^\d{8,30}$/.test(trackingNumber)) {
    return { trackingNumber, state: "unknown" };
  }
  const token = await getAccessToken();
  const res = await fetch(`${getBase()}/track/v1/trackingnumbers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-locale": "en_US",
    },
    body: JSON.stringify({
      includeDetailedScans: true,
      trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    // 404 = unknown tracking number, 401 = expired token (refresh next call)
    // Either way return "unknown" so the cron skips this lead.
    return { trackingNumber, state: "unknown" };
  }
  type TrackEvent = { eventType?: string; eventDescription?: string; date?: string };
  type TrackResult = {
    trackResults?: Array<{
      latestStatusDetail?: { code?: string; description?: string };
      dateAndTimes?: Array<{ type?: string; dateTime?: string }>;
      scanEvents?: TrackEvent[];
      error?: { code?: string };
    }>;
  };
  const data = (await res.json().catch(() => ({}))) as { output?: { completeTrackResults?: Array<TrackResult> } };
  const tr = data.output?.completeTrackResults?.[0]?.trackResults?.[0];
  if (!tr || tr.error) return { trackingNumber, state: "unknown" };
  const latest = tr.scanEvents?.[0]; // FedEx returns newest-first
  const code = (tr.latestStatusDetail?.code || latest?.eventType || "").toUpperCase();
  const desc = tr.latestStatusDetail?.description || latest?.eventDescription;
  const deliveredAt = tr.dateAndTimes?.find((d) => (d.type || "").toUpperCase() === "ACTUAL_DELIVERY")?.dateTime;
  const state: TrackingState =
    code === "DL" ? "delivered" :
    code === "OD" ? "out_for_delivery" :
    code === "PU" || code === "IT" || code === "AR" ? "picked_up" :
    code === "OC" ? "label_created" :
    code === "CA" || code === "DE" || code === "SE" ? "exception" :
    "unknown";
  return {
    trackingNumber,
    state,
    lastEventCode: code || undefined,
    lastEventDescription: desc || undefined,
    lastEventDate: latest?.date || undefined,
    deliveredAt: deliveredAt || undefined,
  };
}
