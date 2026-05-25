"use client";

// Admin slot manager — Skywalker adds specific date+time slots for local
// Austin meetups. Customer-facing slot picker (next phase) reads from
// the same store via lib/slots-store.
//
// Auth: token-input pattern matching /admin/page.tsx so it's consistent
// across the admin surfaces. Stored in localStorage on first entry so
// subsequent visits don't re-prompt.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { listSlots, addSlot, removeSlot, backendLabel, slotBookedCount, type Slot } from "../../lib/slots-store";

const STORED_TOKEN_KEY = "tcc-admin-token-v1";
// Matches TCC_ADMIN_TOKEN default in app/api/admin/leads/route.ts so the
// existing admin token works here too.
const FALLBACK_TOKEN = "topcash-admin-2026";

function todayLocalISO(): string {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  // YYYY-MM-DD → "Sat, May 18"
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(hhmm: string): string {
  // 14:30 → 2:30 PM
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function AdminSlotsPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [date, setDate] = useState(todayLocalISO());
  const [time, setTime] = useState("14:00");
  const [allDay, setAllDay] = useState(false);
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // On mount, try to restore the admin token from localStorage.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORED_TOKEN_KEY);
      if (stored) setToken(stored);
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromDate = todayLocalISO();
      const fresh = await listSlots({ fromDate });
      setSlots(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (token) refresh(); }, [token, refresh]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setToken(tokenInput.trim());
    try { window.localStorage.setItem(STORED_TOKEN_KEY, tokenInput.trim()); } catch {}
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    if (!allDay && !time) return;
    setSubmitting(true);
    setError(null);
    try {
      const slot = await addSlot({
        date,
        time: allDay ? undefined : time,
        allDay,
        label: label.trim() || undefined,
        capacity,
      });
      setJustAddedId(slot.id);
      setTimeout(() => setJustAddedId(null), 1800);
      // Reset only the time so consecutive adds at different times on
      // the same date are quick; keep the date + label fields sticky.
      // Also clear the all-day toggle so a habitual time-slot adder
      // doesn't accidentally repeat an open-day entry.
      setTime("");
      setAllDay(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this slot? If anyone has booked it they'll need to be contacted manually.")) return;
    try {
      await removeSlot(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // -------------- AUTH SCREEN --------------
  if (!token) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
        <form onSubmit={handleAuth} className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Slot manager</h1>
          <p className="text-[#a0a0a0] text-sm">Enter the admin token to manage local-meetup time slots.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Admin token"
            autoFocus
            className="w-full px-4 py-3 bg-white/[0.07] border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-[#00c853]"
          />
          <button
            type="submit"
            className="w-full px-4 py-3 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] font-bold rounded-xl transition cursor-pointer"
          >
            Unlock
          </button>
          <p className="text-[#666] text-xs text-center">Default token: <span className="font-mono">{FALLBACK_TOKEN}</span> (set TCC_ADMIN_TOKEN env to override)</p>
        </form>
      </main>
    );
  }

  // -------------- MAIN MANAGER --------------
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Slot manager</h1>
            <p className="text-[#888] text-xs mt-1">
              Backend: <span className="text-[#00c853] font-semibold">{backendLabel()}</span>
              {backendLabel().includes("localStorage") && (
                <span className="text-[#ff9100] ml-2">⚠️ slots only visible in THIS browser until MC API endpoints land</span>
              )}
            </p>
          </div>
          <Link href="/admin" className="text-xs text-[#00c853] hover:text-[#00e676] underline">Leads →</Link>
        </div>

        {/* ADD SLOT FORM */}
        <form onSubmit={handleAdd} className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 mb-8 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#00c853]">Add a slot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#a0a0a0] mb-1">Date</label>
              <input type="date" value={date} min={todayLocalISO()} onChange={(e) => setDate(e.target.value)} required className="w-full px-3 py-2.5 bg-white/[0.07] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-[#00c853]" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#a0a0a0]">Time</label>
                <label className="text-[10px] text-[#a0a0a0] flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="accent-[#00c853] cursor-pointer"
                  />
                  All day (any time)
                </label>
              </div>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required={!allDay}
                disabled={allDay}
                step={900}
                className="w-full px-3 py-2.5 bg-white/[0.07] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-[#00c853] disabled:opacity-40 disabled:cursor-not-allowed"
              />
              {allDay && (
                <p className="text-[10px] text-[#888] mt-1">Open day — customer picks any time that works.</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#a0a0a0] mb-1">Label (optional)</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. South Austin · Downtown · Mueller HEB" className="w-full px-3 py-2.5 bg-white/[0.07] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-[#00c853]" />
            </div>
            <div>
              <label className="block text-xs text-[#a0a0a0] mb-1">Capacity</label>
              <input type="number" value={capacity} min={1} max={10} onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 1)} className="w-full px-3 py-2.5 bg-white/[0.07] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-[#00c853]" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full px-4 py-3 bg-[#00c853] hover:bg-[#00e676] disabled:opacity-50 text-[#0a0a0a] font-bold rounded-xl transition cursor-pointer">
            {submitting ? "Adding…" : "Add slot"}
          </button>
        </form>

        {error && <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg">{error}</div>}

        {/* SLOT LIST */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#a0a0a0]">Upcoming slots ({slots.length})</h2>
            <button onClick={refresh} disabled={loading} className="text-xs text-[#00c853] hover:text-[#00e676] disabled:opacity-50">↻ Refresh</button>
          </div>
          {slots.length === 0 ? (
            <p className="text-[#888] text-sm italic py-6 text-center">No slots yet. Add one above.</p>
          ) : (
            slots.map((s) => {
              const booked = slotBookedCount(s);
              const isOpen = booked < s.capacity;
              const recently = s.id === justAddedId;
              // MC list endpoint only returns the seat count, not the
              // per-booking detail — so `s.bookings[]` is empty for MC slots
              // even when booked > 0. Only render the "last: NAME (device)"
              // line when we actually have the booking record.
              const lastBooking = s.bookings && s.bookings.length > 0 ? s.bookings[s.bookings.length - 1] : null;
              return (
                <div key={s.id} className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition ${recently ? "bg-[#00c853]/10 border-[#00c853]/50" : "bg-white/[0.04] border-white/10"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold text-sm">
                      {formatDate(s.date)} · <span className="text-[#00c853]">{s.allDay ? "Any time" : formatTime(s.time)}</span>
                      {s.label && <span className="text-[#bdbdbd] font-medium ml-2">· {s.label}</span>}
                    </p>
                    <p className="text-[#888] text-xs mt-1">
                      {booked}/{s.capacity} booked
                      {isOpen ? <span className="text-[#00c853] ml-1">· open</span> : <span className="text-[#ff5566] ml-1">· FULL</span>}
                      {lastBooking && (
                        <span className="ml-2">— last: {lastBooking.sellerName} ({lastBooking.deviceLabel || "device"})</span>
                      )}
                    </p>
                  </div>
                  <button onClick={() => handleRemove(s.id)} className="text-xs text-[#ff5566] hover:text-[#ff8088] border border-[#ff5566]/30 hover:border-[#ff5566]/60 rounded-lg px-3 py-1.5 transition cursor-pointer shrink-0">
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
