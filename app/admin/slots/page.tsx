"use client";

// Admin slot manager — Skywalker adds specific date+time slots for local
// Austin meetups. Customer-facing slot picker (next phase) reads from
// the same store via lib/slots-store.
//
// Auth: token-input pattern matching /admin/page.tsx so it's consistent
// across the admin surfaces. Stored in localStorage on first entry so
// subsequent visits don't re-prompt.

import { useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { listSlots, addSlot, removeSlot, backendLabel, slotBookedCount, type Slot } from "../../lib/slots-store";

const STORED_TOKEN_KEY = "tcc-admin-token-v1";
// No FALLBACK_TOKEN here — the prior default ("topcash-admin-2026") was
// shipped in the client bundle and printed in the UI, effectively
// publishing the admin password. Admin must enter their TCC_ADMIN_TOKEN
// explicitly on first visit; it's then stored in localStorage. 2026-05-24.

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

// Shared field-label style for the add-slot form (design-system vars only).
const fieldLbl: CSSProperties = {
  display: "block",
  font: "600 10.5px var(--tadm-mono)",
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  color: "var(--tadm-faint)",
  marginBottom: 5,
};

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
      <div className="tadm-wrap" style={{ maxWidth: 440 }}>
        <div className="tadm-page-head">
          <h1>Meetup slots</h1>
          <p>Enter the admin token to manage local-meetup time slots.</p>
        </div>
        <form onSubmit={handleAuth} className="tadm-card">
          <h3>Unlock</h3>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Admin token"
            autoFocus
            className="tadm-input"
            style={{ width: "100%" }}
          />
          <button type="submit" className="tadm-btn primary" style={{ width: "100%", marginTop: 10 }}>
            Unlock
          </button>
          <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 11, color: "var(--tadm-faint)" }}>
            Use the value of <span style={{ fontFamily: "var(--tadm-mono)" }}>TCC_ADMIN_TOKEN</span> from Vercel env.
          </p>
        </form>
      </div>
    );
  }

  // -------------- MAIN MANAGER --------------
  return (
    <div className="tadm-wrap">
      <div className="tadm-page-head">
        <h1>Meetup slots</h1>
        <p>
          Local Austin meetup times customers can book — backend:{" "}
          <span style={{ color: "var(--tadm-green)", fontWeight: 700 }}>{backendLabel()}</span>
        </p>
      </div>

      {/* ADD SLOT FORM */}
      <form onSubmit={handleAdd} className="tadm-card">
        <h3>Add a slot</h3>
        <div className="tadm-cols2" style={{ marginTop: 0 }}>
          <div>
            <label style={fieldLbl}>Date</label>
            <input
              type="date"
              value={date}
              min={todayLocalISO()}
              onChange={(e) => setDate(e.target.value)}
              required
              className="tadm-input"
              style={{ width: "100%", colorScheme: "dark" }}
            />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <label style={{ ...fieldLbl, marginBottom: 0 }}>Time</label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: "var(--tadm-dim)", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  style={{ accentColor: "var(--tadm-green)", cursor: "pointer" }}
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
              className="tadm-input"
              style={{ width: "100%", colorScheme: "dark", opacity: allDay ? 0.4 : 1 }}
            />
            {allDay && (
              <p style={{ margin: "5px 0 0", fontSize: 10.5, fontWeight: 500, color: "var(--tadm-faint)" }}>
                Open day — customer picks any time that works.
              </p>
            )}
          </div>
        </div>
        <div className="tadm-cols2">
          <div>
            <label style={fieldLbl}>Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. South Austin · Downtown · Mueller HEB"
              className="tadm-input"
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={fieldLbl}>Capacity</label>
            <input
              type="number"
              value={capacity}
              min={1}
              max={10}
              onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 1)}
              className="tadm-input"
              style={{ width: "100%" }}
            />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="tadm-btn primary" style={{ marginTop: 12 }}>
          {submitting ? "Adding…" : "Add slot"}
        </button>
      </form>

      {error && (
        <div className="tadm-card" style={{ borderColor: "var(--tadm-bad)" }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: "var(--tadm-bad)" }}>{error}</p>
        </div>
      )}

      {/* SLOT LIST */}
      <div className="tadm-card">
        <h3>
          Upcoming slots ({slots.length})
          <button onClick={refresh} disabled={loading} className="tadm-btn sm right">
            ↻ Refresh
          </button>
        </h3>
        {slots.length === 0 ? (
          <div className={loading ? "tadm-empty pulse" : "tadm-empty"}>
            {loading ? "Loading slots…" : "No slots yet. Add one above."}
          </div>
        ) : (
          <div className="tadm-rows">
            {slots.map((s) => {
              const booked = slotBookedCount(s);
              const isOpen = booked < s.capacity;
              const recently = s.id === justAddedId;
              const isPast = !s.allDay && !!s.time && new Date(`${s.date}T${s.time}`) < new Date();
              // MC list endpoint only returns the seat count, not the
              // per-booking detail — so `s.bookings[]` is empty for MC slots
              // even when booked > 0. Only render the "last: NAME (device)"
              // line when we actually have the booking record.
              const lastBooking = s.bookings && s.bookings.length > 0 ? s.bookings[s.bookings.length - 1] : null;
              return (
                <div
                  key={s.id}
                  className="tadm-row"
                  style={recently ? { background: "var(--tadm-green-soft)", borderRadius: 8 } : undefined}
                >
                  <div className="main">
                    {formatDate(s.date)} · <span style={{ color: "var(--tadm-green)" }}>{s.allDay ? "Any time" : formatTime(s.time)}</span>
                    {s.label && <span className="dim"> · {s.label}</span>}
                    {lastBooking && (
                      <span className="dim"> — last: {lastBooking.sellerName} ({lastBooking.deviceLabel || "device"})</span>
                    )}
                  </div>
                  <span className="meta">{booked}/{s.capacity} booked</span>
                  <span className={`tadm-pill ${isPast ? "off" : isOpen ? "on" : "warn"}`}>
                    {isPast ? "past" : isOpen ? "open" : "full"}
                  </span>
                  <button onClick={() => handleRemove(s.id)} className="tadm-btn sm danger">
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
