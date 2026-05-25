// Slot storage abstraction for local-handoff calendar.
//
// Two backends pick automatically:
//   - 'mc-api' when NEXT_PUBLIC_MC_SLOTS_ENABLED === '1' AND MC slot
//     endpoints are confirmed live (Theot/Powerhouse implementing).
//   - 'localStorage' as the default development / pre-MC stub.
//
// localStorage backend = single-browser only. The admin browser sees
// slots it created; customers on other browsers won't see anything
// until the MC backend lands. Use ONLY for demo / spec validation.
// The MC swap is a one-flag flip — the public function signatures
// stay identical so callers don't change.

export type Slot = {
  id: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM (24hr)
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
  time: string;
  label?: string;
  capacity?: number;
};

const STORAGE_KEY = "tcc-slots-v1";
const MC_BASE = "https://missioncontrolsdjg-production.up.railway.app";

function useMcBackend(): boolean {
  return typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MC_SLOTS_ENABLED === "1";
}

function mcKey(): string {
  return process.env.NEXT_PUBLIC_MC_API_KEY || "";
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

function genId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

// PUBLIC API ----------------------------------------------------------

export async function listSlots(opts?: { openOnly?: boolean; fromDate?: string }): Promise<Slot[]> {
  if (useMcBackend()) {
    const params = new URLSearchParams();
    if (opts?.openOnly) params.set("open", "true");
    if (opts?.fromDate) params.set("from", opts.fromDate);
    const r = await fetch(`${MC_BASE}/api/slots?${params}`, { headers: { "x-api-key": mcKey() } });
    if (!r.ok) return [];
    const data = await r.json();
    // MC list returns { id, date, time, label, capacity, booked, owner, isOpen }
    // — no per-booking detail. Normalize to the Slot shape so UI code that
    // reads `bookings` (length, .map, etc.) doesn't crash on `undefined`.
    // The `bookedCount` field carries the MC seat count for slotBookedCount().
    type McSlot = { id: string; date: string; time: string; label?: string | null; capacity: number; booked?: number };
    return ((data.slots as McSlot[]) || []).map((s) => ({
      id: s.id,
      date: s.date,
      time: s.time,
      label: s.label ?? undefined,
      capacity: s.capacity,
      bookings: [],
      bookedCount: s.booked ?? 0,
    }));
  }
  let slots = readLocal();
  if (opts?.fromDate) slots = slots.filter(s => s.date >= opts.fromDate!);
  if (opts?.openOnly) slots = slots.filter(s => slotBookedCount(s) < s.capacity);
  return slots.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export async function addSlot(input: SlotInput): Promise<Slot> {
  if (useMcBackend()) {
    const r = await fetch(`${MC_BASE}/api/slots`, {
      method: "POST",
      headers: { "x-api-key": mcKey(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) throw new Error("Failed to add slot");
    const s = await r.json();
    // Normalize to Slot shape — MC returns a flat record without `bookings`.
    return {
      id: s.id,
      date: s.date,
      time: s.time,
      label: s.label ?? undefined,
      capacity: s.capacity,
      bookings: [],
      bookedCount: s.booked ?? 0,
    };
  }
  const slot: Slot = {
    id: genId(),
    date: input.date,
    time: input.time,
    label: input.label?.trim() || undefined,
    capacity: input.capacity ?? 1,
    bookings: [],
  };
  const slots = readLocal();
  slots.push(slot);
  writeLocal(slots);
  return slot;
}

export async function removeSlot(id: string): Promise<void> {
  if (useMcBackend()) {
    await fetch(`${MC_BASE}/api/slots/${id}`, {
      method: "DELETE",
      headers: { "x-api-key": mcKey() },
    });
    return;
  }
  writeLocal(readLocal().filter(s => s.id !== id));
}

export async function bookSlot(id: string, booking: Omit<Booking, "id" | "bookedAt">): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  if (useMcBackend()) {
    const r = await fetch(`${MC_BASE}/api/slots/${id}/book`, {
      method: "POST",
      headers: { "x-api-key": mcKey(), "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
    if (r.status === 409) return { ok: false, error: "already booked" };
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const data = await r.json();
    return { ok: true, booking: data.booking };
  }
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

// Backend label for the admin UI to surface which mode it's in.
export function backendLabel(): string {
  return useMcBackend() ? "MC API (live)" : "localStorage (single-browser stub)";
}
