"use client";
import { useEffect, useState } from "react";

// Staff-side device correction panel. Used when the customer's
// self-reported device doesn't match the unit on the bench (Rudy
// said iPhone 14 Pro Max, it's an iPhone 14). The operator types
// the device's IMEI, we hit the existing /api/imei/check (Sickw
// passthrough) for the model + Find-My + blacklist signals, and
// then the operator confirms / edits the remaining fields and
// saves — server posts an [ITEM-UPDATE] marker that the admin +
// offer GET routes already know how to apply.
//
// This is a modal, not an inline expander, because the IMEI lookup
// shows enough context (model, FMI, blacklist, warnings) that we
// want the focus + full viewport, not a 240px-wide squeeze under a
// table row.

interface MinimalLead {
  id: string;
  name?: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  carrier?: string;
  quote?: string;
  imei?: string;
  devices?: Array<{
    model?: string;
    storage?: string;
    condition?: string;
    carrier?: string;
    quote?: number;
    quantity?: number;
    imei?: string;
  }>;
}

interface ImeiResult {
  ok?: boolean;
  stage?: string;
  imei?: string;
  model?: string | null;
  fmiOn?: boolean;
  blacklisted?: boolean;
  warnings?: string[];
  error?: string;
  sickwError?: string;
}

function parseInitialQuote(raw?: string): string {
  if (!raw) return "";
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
}

export function DeviceCorrection({
  lead,
  token,
  onClose,
  onSaved,
}: {
  lead: MinimalLead | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Seed values from the first device if the lead is multi-device,
  // otherwise from the flat top-level fields. We only correct one
  // device at a time — staff typically inspect them sequentially.
  const seed = lead?.devices?.[0];
  const [imei, setImei] = useState(seed?.imei || lead?.imei || "");
  const [model, setModel] = useState(seed?.model || lead?.model || lead?.device || "");
  const [storage, setStorage] = useState(seed?.storage || lead?.storage || "");
  const [condition, setCondition] = useState(seed?.condition || lead?.condition || "");
  const [carrier, setCarrier] = useState(seed?.carrier || lead?.carrier || "");
  const [quote, setQuote] = useState(seed?.quote ? String(seed.quote) : parseInitialQuote(lead?.quote));
  const [note, setNote] = useState("");

  const [lookup, setLookup] = useState<ImeiResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset all state when the modal opens with a different lead.
  useEffect(() => {
    if (!lead) return;
    const seed = lead.devices?.[0];
    setImei(seed?.imei || lead.imei || "");
    setModel(seed?.model || lead.model || lead.device || "");
    setStorage(seed?.storage || lead.storage || "");
    setCondition(seed?.condition || lead.condition || "");
    setCarrier(seed?.carrier || lead.carrier || "");
    setQuote(seed?.quote ? String(seed.quote) : parseInitialQuote(lead.quote));
    setNote("");
    setLookup(null);
    setError(null);
  }, [lead]);

  if (!lead) return null;

  const handleLookup = async () => {
    setError(null);
    const clean = imei.replace(/\D/g, "");
    if (clean.length !== 15) {
      setError("IMEI must be 15 digits. Tap *#06# on the device to display it.");
      return;
    }
    setLookingUp(true);
    setLookup(null);
    try {
      const r = await fetch("/api/imei/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: clean, deviceCategory: /iphone/i.test(model) ? "iphone" : "" }),
      });
      const j: ImeiResult = await r.json();
      if (!r.ok && j.error) {
        setError(j.error);
        return;
      }
      setLookup(j);
      // Auto-populate the model field if Sickw returned something —
      // we keep what the operator typed if Sickw came up empty.
      if (j.model && j.model.trim()) setModel(j.model.trim());
      setImei(clean);
    } catch (e) {
      setError(e instanceof Error ? e.message : "IMEI lookup failed");
    } finally {
      setLookingUp(false);
    }
  };

  const handleSave = async () => {
    if (!model.trim()) { setError("Model required"); return; }
    setSaving(true);
    setError(null);
    try {
      // Carry through any sibling devices unchanged — we only correct
      // the first one. Without this a multi-device lead would lose its
      // other rows on save.
      const others = (lead.devices || []).slice(1).map((d) => ({
        model: d.model, storage: d.storage, condition: d.condition,
        carrier: d.carrier, quote: d.quote, quantity: d.quantity,
        imei: d.imei,
      }));
      const corrected = {
        model: model.trim(),
        storage: storage.trim(),
        condition: condition.trim(),
        carrier: carrier.trim(),
        quote: Number(quote) || 0,
        quantity: seed?.quantity || 1,
        imei: imei.replace(/\D/g, ""),
      };
      const r = await fetch("/api/admin/leads/items", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({
          leadId: lead.id,
          devices: [corrected, ...others],
          note: note.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#101010] border border-white/15 rounded-2xl max-w-xl w-full p-5 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-extrabold">Correct device</h2>
            <p className="text-[11px] text-[#888] mt-0.5">
              {lead.name ? <><span className="text-[#c5c5c5]">{lead.name}</span> · </> : null}
              <span className="font-mono">{lead.id}</span>
            </p>
            {(lead.device || lead.model) && (
              <p className="text-[11px] text-[#888] mt-0.5">
                Customer reported: <span className="text-[#c5c5c5]">{lead.device || lead.model}{lead.storage ? ` · ${lead.storage}` : ""}{lead.carrier ? ` · ${lead.carrier}` : ""}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-white text-xl leading-none px-2 cursor-pointer" aria-label="Close">×</button>
        </div>

        {/* IMEI block — typed input + Look-up button. Sickw result
            renders below, including FMI / blacklist warnings that
            staff need to act on before payout. */}
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 space-y-2 mb-3">
          <label className="text-[10px] uppercase tracking-wider text-[#888] font-bold">IMEI</label>
          <div className="flex gap-2">
            <input
              value={imei}
              onChange={(e) => setImei(e.target.value)}
              placeholder="15-digit IMEI (tap *#06#)"
              className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono tracking-wider"
              inputMode="numeric"
              maxLength={20}
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookingUp || imei.replace(/\D/g, "").length !== 15}
              className="px-3 py-2 bg-[#00c853] hover:bg-[#00b34a] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-lg text-xs cursor-pointer transition whitespace-nowrap"
              title="Hit Sickw for the IMEI's model + lock status"
            >
              {lookingUp ? "Looking…" : "🔎 Look up"}
            </button>
          </div>
          {lookup && (
            <div className="text-[11px] space-y-1 mt-1">
              {lookup.model && (
                <div className="text-[#00c853]">
                  ✓ Model from IMEI: <b>{lookup.model}</b>
                </div>
              )}
              {lookup.stage === "format-only" && (
                <div className="text-[#888]">IMEI format valid; Sickw lookup not configured.</div>
              )}
              {lookup.fmiOn && (
                <div className="text-red-300">⚠️ Find My iPhone is ON — must be off before payout.</div>
              )}
              {lookup.blacklisted && (
                <div className="text-red-300">⚠️ Device is blacklisted (reported lost/stolen).</div>
              )}
              {(lookup.warnings || []).map((w, i) => (
                <div key={i} className="text-amber-300">⚠️ {w}</div>
              ))}
              {lookup.sickwError && (
                <div className="text-[#888]">Sickw: {lookup.sickwError}</div>
              )}
            </div>
          )}
        </div>

        {/* Corrected device fields. Pre-filled with what the customer
            said + whatever Sickw returned; operator tweaks before save. */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Labeled label="Model" full>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="iPhone 14"
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
              required
            />
          </Labeled>
          <Labeled label="Storage">
            <input
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
              placeholder="128GB"
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
            />
          </Labeled>
          <Labeled label="Carrier">
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Unlocked"
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
            />
          </Labeled>
          <Labeled label="Condition">
            <input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="Good"
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
            />
          </Labeled>
          <Labeled label="Corrected quote ($)">
            <input
              type="number" inputMode="decimal" step="1" min="0"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="120"
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
            />
          </Labeled>
        </div>

        <Labeled label="Note (optional)" full>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="customer said 14 Pro Max, actually 14"
            maxLength={200}
            className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
          />
        </Labeled>

        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/40 text-red-200 text-xs rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-[#d4d4d4] hover:bg-white/10 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !model.trim()}
            className="flex-1 px-4 py-2 bg-[#00c853] hover:bg-[#00b34a] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-lg text-sm cursor-pointer transition"
          >
            {saving ? "Saving…" : "Save corrected device"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="block text-[10px] uppercase tracking-wider text-[#888] font-bold mb-1">{label}</span>
      {children}
    </label>
  );
}
