// Admin endpoint that returns the current newsletter subscriber list.
// Source of truth is MC comms — we scan for [NEWSLETTER SIGNUP] markers
// and exclude any email that's later marked with [NEWSLETTER UNSUB].
// Dedupes by lowercased email so a customer who signs up twice only
// appears once. Most-recent name wins (handles "Susan → Susan Davis").

import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

export type Subscriber = {
  email: string;
  name?: string;
  signedUpAt: string;
  source?: "signup" | "lead" | "imported";
};

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!MC_KEY) {
    return NextResponse.json({ error: "MC_API_KEY not configured" }, { status: 503 });
  }

  // Pull a generous window — covers ~years of signups at our volume.
  const r = await fetch(`${MC_API}/api/comms?limit=2000`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) {
    return NextResponse.json({ error: "MC unavailable" }, { status: 502 });
  }
  const data = await r.json();
  const messages: { body?: string; timestamp: string }[] = data.messages || [];

  // Pass 1: collect signups by lowercased email. Keep the most-recent
  // signup record so re-signups update the stored name.
  const signups = new Map<string, Subscriber>();
  // Pass 2: collect unsub timestamps so a re-signup AFTER unsub
  // (customer changed their mind) wins, and an unsub AFTER signup
  // properly excludes.
  const unsubAt = new Map<string, string>();

  for (const m of messages) {
    if (!m.body) continue;

    // Signup: "[NEWSLETTER SIGNUP] email=X name=Y welcome=..."
    if (m.body.startsWith("[NEWSLETTER SIGNUP]")) {
      const emailM = m.body.match(/email=([^\s]+)/);
      const nameM = m.body.match(/name=([^=]+?)(?=\s+welcome=|\s*$)/);
      const email = emailM ? emailM[1].toLowerCase().trim() : null;
      if (!email) continue;
      const name = nameM ? nameM[1].trim() : "";
      const prev = signups.get(email);
      if (!prev || m.timestamp > prev.signedUpAt) {
        signups.set(email, {
          email,
          name: name || prev?.name,
          signedUpAt: m.timestamp,
          source: "signup",
        });
      }
      continue;
    }

    // Unsub: "[NEWSLETTER UNSUB] email=X"
    if (m.body.startsWith("[NEWSLETTER UNSUB]")) {
      const emailM = m.body.match(/email=([^\s]+)/);
      const email = emailM ? emailM[1].toLowerCase().trim() : null;
      if (!email) continue;
      const prev = unsubAt.get(email);
      if (!prev || m.timestamp > prev) unsubAt.set(email, m.timestamp);
      continue;
    }

    // Bonus: customers who provided email + name on a buyback lead are
    // implicit subscribers (they're a paying customer; we can email
    // them about price moves). Pull from [NEW BUYBACK LEAD] bodies too.
    // Per CAN-SPAM this is permissible for existing-business-relationship
    // emails. UI flags these separately so Skywalker can decide.
    if (/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body)) {
      const emailM = m.body.match(/(?:^|\n)Email:[ \t]*([^\s\n]+)/i);
      const nameM = m.body.match(/(?:^|\n)Name:[ \t]*([^\n]+)/i);
      const email = emailM ? emailM[1].toLowerCase().trim() : null;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      const name = nameM ? nameM[1].trim() : "";
      const prev = signups.get(email);
      // Don't override an explicit signup with a lead row.
      if (!prev || prev.source === "lead") {
        if (!prev || m.timestamp > prev.signedUpAt) {
          signups.set(email, {
            email,
            name: name || prev?.name,
            signedUpAt: m.timestamp,
            source: "lead",
          });
        }
      } else if (name && !prev.name) {
        // Backfill the name on an explicit signup row if the customer
        // later filled it in via a lead form.
        signups.set(email, { ...prev, name });
      }
    }
  }

  // Apply unsubs: an unsub at time T removes any signup whose most-recent
  // timestamp is <= T. A re-signup AFTER unsub overrides (handled by the
  // most-recent timestamp wins in pass 1).
  const subscribers: Subscriber[] = [];
  for (const [email, sub] of signups) {
    const unsub = unsubAt.get(email);
    if (unsub && unsub > sub.signedUpAt) continue;
    subscribers.push(sub);
  }

  // Newest first so admin sees recent signups at the top.
  subscribers.sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt));

  return NextResponse.json({
    ok: true,
    count: subscribers.length,
    explicitCount: subscribers.filter((s) => s.source === "signup").length,
    fromLeadsCount: subscribers.filter((s) => s.source === "lead").length,
    subscribers,
  });
}
