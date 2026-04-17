import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = "9b4dce8e03c1d2aaf86d272a2afda99a0157f49abd66450f";

const RESPONSES: Record<string, string> = {
  price: "I can help with pricing! Just use our quote tool on the homepage — select your device, storage, and condition to get an instant offer. Or tell me what device you have and I'll give you a ballpark.",
  iphone: "We buy all iPhones from iPhone 11 and newer. Use the quote tool to get an exact price based on your model, storage, and condition. Prices range from $100–$580 depending on the model.",
  samsung: "We buy Samsung Galaxy S21 and newer, plus Z Fold and Z Flip models. Use our quote tool for an instant price!",
  macbook: "Yes, we buy MacBooks! MacBook Air and Pro, M1 chip and newer. Prices range from $350–$1,200 depending on the model and condition.",
  console: "We buy PS4, PS5, Xbox One, Xbox Series S/X, and Nintendo Switch. Use the quote tool for pricing!",
  pay: "We pay via Cash, Venmo, Zelle, or PayPal — your choice. Payment is same-day for local Austin pickups.",
  ship: "We're currently Austin local pickup only. We meet you at a convenient location and pay on the spot.",
  broken: "We buy devices in any condition — even broken or cracked. You'll get a lower offer, but we'll still make you an offer. Select 'Fair' or 'Poor' condition in our quote tool.",
  how: "It's simple: 1) Get an instant quote on our site, 2) We arrange a local meetup in Austin, 3) We inspect the device and pay you on the spot. Takes about 5 minutes!",
  meet: "We do local meetups in Austin, TX. Public locations like coffee shops or parking lots. Safe, fast, and convenient.",
};

function getResponse(message: string): string {
  const lower = message.toLowerCase();
  for (const [key, response] of Object.entries(RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return "Thanks for reaching out! I can help with device quotes, pricing, payment methods, or how our buyback process works. What would you like to know? You can also use our instant quote tool on the homepage for a quick price.";
}

export async function POST(req: NextRequest) {
  const { message, name } = await req.json();

  const reply = getResponse(message);

  // Forward lead to Mission Control
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular Chat",
        role: "system",
        body: `[CHAT LEAD] ${name || "Visitor"}: "${message}"`,
        tags: ["chat-lead"],
        priority: "high",
      }),
    });
  } catch {
    // MC notification failed silently
  }

  return NextResponse.json({ reply });
}
