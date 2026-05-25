// Slot storage abstraction for local-handoff calendar.
//
// Live backend: TCC's own /api/slots routes, which proxy server-side to
// the MC slots API using the non-public MC_API_KEY. Prior version
// called MC directly from the browser using NEXT_PUBLIC_MC_API_KEY,
// which baked the MC key into every visitor's JS bundle — anyone with
// DevTools could extract it and call MC. The proxy fix (2026-05-24)
// keeps the MC key server-side and gives us a place to rate-limit and
// validate inputs.
//
// localStorage backend: single-browser stub used ONLY when the TCC API
// fails (e.g. running `next dev` offline). The admin browser sees
// slots it created locally; customers on other browsers won't see
// anything. Auto-engaged on fetch error so dev still works.
//
// Public signatures unchanged — callers in app/page.tsx and
// app/admin/slots/page.tsx don't change.

export type Slot = {
  id: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM (24hr); empty string when allDay
  allDay?: boolean;             // "open day" — any time on this date works
  label?: string; // e.g. "South Austin"
  capacity: number;
  bookings: Booking[];          // local-backend ground truth; MC list returns []
  bookedCount?: number;         // count-only signal from MC list endpoint
                                // (use this when bookings.length is empty but
                                // we know seats are taken). UI helper below
                                // returns max(bookedCount, bookings.length).
};

// Single source of truth for "how many seats are taken on this slot".
// MC's list endpoint returns a `booked` count without per-booking detail;
// the local backend keeps the full Booking[] inline. UI code should call
// this instead of reading `.bookings.length` directly so it works against
// either backend.
export function slotBookedCount(slot: Slot): number {
  return Math.max(slot.bookedCount ?? 0, slot.bookings?.length ?? 0);
}

export type Booking = {
  id: string;
  bookedAt: string; // ISO timestamp
  sellerName: string;
  sellerPhone?: string;
  sellerEmail?: string;
  deviceLabel?: string;
  leadRef?: string;
};

export type SlotInput = {
  date: string;
  time?: string;       // omitted/empty when allDay is true
  allDay?: boolean;    // "open day" — Skywalker sets this when no specific time
  label?: string;
  capacity?: number;
};

const STORAGE_KEY = "tcc-slots-v1";
const ADMIN_TOKEN_KEY = "tcc-admin-token-v1";

// MC list/create endpoint returns a flat record (no per-booking detail);
// shared normalizer keeps the Slot shape consistent for UI code.
type McSlotRecord = {
  id: string;
  date: string;
  time?: string;
  allDay?: boolean;
  label?: string | null;
  capacity: number;
  booked?: number;
};

function normalizeMcSlot(s: McSlotRecord): Slot {
  return {
    id: s.id,
    date: s.date,
    time: s.time || "",
    allDay: s.allDay === true,
    label: s.label ?? undefined,
    capacity: s.capacity,
    bookings: [],
    bookedCount: s.booked ?? 0,
  };
}

function readLocal(): Slot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(slots: Slot[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch {}
}

function readAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function adminHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const t = readAdminToken();
  if (t) h["x-admin-token"] = t;
  return h;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

// PUBLIC API ----------------------------------------------------------

export async function listSlots(opts?: { openOnly?: boolean; fromDate?: string }): Promise<Slot[]> {
  const params = new URLSearchParams();
  if (opts?.openOnly) params.set("open", "true");
  if (opts?.fromDate) params.set("from", opts.fromDate);
  try {
    const r = await fetch(`/api/slots?${params}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const normalized = ((data.slots as McSlotRecord[]) || []).map(normalizeMcSlot);
    return normalized.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  } catch {
    // Offline fallback — let local dev keep working without MC.
    let slots = readLocal();
    if (opts?.fromDate) slots = slots.filter(s => s.date >= opts.fromDate!);
    if (opts?.openOnly) slots = slots.filter(s => slotBookedCount(s) < s.capacity);
    return slots.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }
}

export async function addSlot(input: SlotInput): Promise<Slot> {
  try {
    const r = await fetch(`/api/admin/slots`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(input),
    });
    if (r.status === 401) throw new Error("Unauthorized — admin token missing or wrong, or Google session expired.");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const s = await r.json();
    return normalizeMcSlot(s as McSlotRecord);
  } catch (e) {
    // If we got 401, surface it — don't silently fall through to the
    // local stub, since that would mask the auth problem.
    if (e instanceof Error && /Unauthorized/i.test(e.message)) throw e;
    const slot: Slot = {
      id: genId(),
      date: input.date,
      time: input.allDay ? "" : (input.time || ""),
      allDay: input.allDay === true,
      label: input.label?.trim() || undefined,
      capacity: input.capacity ?? 1,
      bookings: [],
    };
    const slots = readLocal();
    slots.push(slot);
    writeLocal(slots);
    return slot;
  }
}

export async function removeSlot(id: string): Promise<void> {
  try {
    const r = await fetch(`/api/admin/slots/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    if (r.status === 401) throw new Error("Unauthorized — admin token missing or wrong, or Google session expired.");
    if (!r.ok && r.status !== 404) throw new Error(`HTTP ${r.status}`);
    return;
  } catch (e) {
    if (e instanceof Error && /Unauthorized/i.test(e.message)) throw e;
    writeLocal(readLocal().filter(s => s.id !== id));
  }
}

export async function bookSlot(id: string, booking: Omit<Booking, "id" | "bookedAt">): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  try {
    const r = await fetch(`/api/slots/${encodeURIComponent(id)}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
    if (r.status === 409) return { ok: false, error: "already booked" };
    if (r.status === 429) {
      const data = await r.json().catch(() => ({ retryAfterSeconds: 60 }));
      return { ok: false, error: `Slow down — try again in ${data.retryAfterSeconds || 60}s.` };
    }
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const data = await r.json();
    if (!data.ok) return { ok: false, error: data.error || "Booking failed" };
    return { ok: true, booking: data.booking };
  } catch {
    // Offline / fetch-failed fallback — write to local stub so demo
    // and dev keep working.
    const slots = readLocal();
    const slot = slots.find(s => s.id === id);
    if (!slot) return { ok: false, error: "slot not found" };
    if (slotBookedCount(slot) >= slot.capacity) return { ok: false, error: "already booked" };
    const newBooking: Booking = {
      ...booking,
      id: genId(),
      bookedAt: new Date().toISOString(),
    };
    slot.bookings.push(newBooking);
    writeLocal(slots);
    return { ok: true, booking: newBooking };
  }
}

// Backend label for the admin UI to surface which mode it's in. We
// can't actually know whether the live API is up until we call it —
// this is purely informational. The reality on every request is
// "TCC API first, localStorage if the API errors".
export function backendLabel(): string {
  return "TCC API (server-proxied to MC) — localStorage fallback on error";
}
