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
};

export type LabelResult = {
  trackingNumber: string;
  // Base64-encoded PDF of the label. Caller persists to Vercel Blob.
  labelPdfBase64: string;
  serviceType: string;
};

function defaultWeight(kind?: LabelInputs["deviceKind"]): number {
  switch (kind) {
    case "phone":
    case "tablet":
      return 1;
    case "laptop":
      return 5;
    case "console":
      return 8;
    case "desktop":
      return 25;
    default:
      return 2;
  }
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
