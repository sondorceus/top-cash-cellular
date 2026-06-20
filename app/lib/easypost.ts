// EasyPost tracker registration — the push source that turns our /api/webhook/
// fedex receiver into real-time. When a FedEx label mints, we register its
// tracking number with EasyPost; EasyPost then monitors the package and POSTs
// a tracker.updated webhook on every scan (pickup → in transit → delivered),
// which our webhook confirms with FedEx and reacts to instantly.
//
// No-op (returns false, never throws) when EASYPOST_API_KEY is unset, so the
// 30-min poll keeps working unchanged until EasyPost is wired up. Configure
// the webhook URL + secret once in the EasyPost dashboard:
//   https://topcashcellular.com/api/webhook/fedex?secret=<FEDEX_WEBHOOK_SECRET>

const EASYPOST_API_KEY = process.env.EASYPOST_API_KEY || "";

export async function registerEasyPostTracker(trackingCode: string): Promise<boolean> {
  if (!EASYPOST_API_KEY || !trackingCode) return false;
  try {
    const r = await fetch("https://api.easypost.com/v2/trackers", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${EASYPOST_API_KEY}:`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tracker: { tracking_code: trackingCode, carrier: "FedEx" } }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
