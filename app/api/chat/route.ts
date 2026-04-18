import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

function smartReply(message: string): string {
  const m = message.toLowerCase();
  if (m.match(/price|worth|how much|value|quote|sell.*for/)) return "Great question! Use our instant quote tool on the homepage to get an exact price. Just select your device, storage, and condition — takes 30 seconds. Prices range from $80 to $580+ depending on the model.";
  if (m.match(/iphone|apple/)) return "We buy all iPhones from iPhone 11 and newer! Use the quote tool on our homepage to see exactly what yours is worth. iPhone 16 Pro Max goes for up to $580.";
  if (m.match(/samsung|galaxy|android/)) return "We buy Samsung Galaxy S21 and newer, plus Z Fold and Z Flip models! Use our quote tool for an instant price — Galaxy S24 Ultra goes for up to $500.";
  if (m.match(/macbook|mac|laptop/)) return "Yes! We buy MacBooks — Air and Pro, M1 chip and newer. MacBook Pro 16\" M4 goes for up to $1,200. Use our quote tool for your exact model!";
  if (m.match(/ps[45]|playstation|xbox|switch|console|game/)) return "We buy PS4, PS5, Xbox One, Xbox Series S/X, and Nintendo Switch! PS5 goes for up to $300. Check our quote tool for exact pricing.";
  if (m.match(/pay|venmo|zelle|paypal|cash|money/)) return "We pay via Cash, Venmo, Zelle, or PayPal — your choice! Payment is same-day for local Austin pickups. We pay on the spot.";
  if (m.match(/broken|crack|damage|screen/)) return "We buy devices in ANY condition — even cracked or water damaged. You'll get a lower offer than a pristine device, but we'll still pay you. Select 'Fair' or 'Poor' in our quote tool.";
  if (m.match(/how|work|process|step/)) return "Super simple: 1) Use our quote tool to get an instant price, 2) We arrange a local meetup in Austin, 3) We inspect and pay you on the spot. Takes about 5 minutes total!";
  if (m.match(/where|location|austin|meet|pickup/)) return "We do local meetups all across Austin, TX. Public locations like coffee shops or parking lots — safe, fast, and convenient. We come to you!";
  if (m.match(/ship|mail|send/)) return "We're currently Austin local pickup only — no shipping needed! We meet you at a convenient location and pay on the spot.";
  if (m.match(/hi|hey|hello|sup|yo|what'?s up/)) return "Hey there! 👋 Welcome to Top Cash Cellular. Got a device you want to sell? I can help with pricing, tell you how the process works, or answer any questions. What's on your mind?";
  if (m.match(/thank|thanks|thx|appreciate/)) return "You're welcome! 😊 Ready to get a quote? Just tap 'Get Your Quote' on our homepage, or ask me anything else!";
  if (m.match(/bye|later|done|gtg/)) return "See you! When you're ready to sell, we're here. Use the quote tool anytime or call us at (512) 960-9256. 💰";
  return "I can help with device pricing, how our buyback process works, payment methods, or what devices we buy. Try asking something like 'How much is my iPhone 15 Pro worth?' or use our instant quote tool on the homepage!";
}

export async function POST(req: NextRequest) {
  const { message, history } = await req.json();

  // Forward lead to Mission Control
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular Chat",
        role: "system",
        body: `[CHAT LEAD] Visitor: "${message}"`,
        tags: ["chat-lead"],
        priority: "high",
      }),
    });
  } catch { /* silent */ }

  // Try Anthropic first, fall back to smart replies
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages = (history || []).map((m: { from: string; text: string }) => ({
      role: m.from === "user" ? "user" as const : "assistant" as const,
      content: m.text,
    }));
    messages.push({ role: "user" as const, content: message });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: "You are the friendly AI assistant for Top Cash Cellular — a phone buyback service in Austin, TX. Keep responses SHORT (2-3 sentences). Help sellers get quotes and understand the process. We buy iPhones 11+, Samsung S21+, MacBooks M1+, game consoles. Payout: Cash, Venmo, Zelle, PayPal. Austin local pickup, same-day payment.",
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : smartReply(message);
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ reply: smartReply(message) });
  }
}
