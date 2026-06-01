"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { DeviceCorrection } from "./DeviceCorrection";
import { parseDollarAmount } from "../lib/lead-money";
import { formatOfferNumber, offerNumberMatches } from "../lib/offer-number";
import { ThemeToggle } from "../components/ThemeToggle";

interface Lead {
  id: string;
  timestamp: string;
  name?: string;
  phone?: string;
  email?: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  carrier?: string;
  quote?: string;
  payout?: string;
  imei?: string;
  imeiWarnings?: string[];
  photos?: string[];
  brokenGlass?: "front" | "back" | "both" | null;
  brokenFunctional?: boolean | null;
  processor?: string;
  memory?: string;
  graphics?: string;
  displayResolution?: string;
  displayGlass?: string;
  batteryHealth?: string;
  charger?: string;
  connectivity?: string;
  extras?: string[];
  paidOff?: boolean | null;
  devices?: Array<{
    model: string;
    storage?: string;
    condition?: string;
    quote?: number;
    quantity?: number;
    photos?: string[];
    carrier?: string;
    connectivity?: string;
    processor?: string;
    memory?: string;
    graphics?: string;
    displayResolution?: string;
    displayGlass?: string;
    batteryHealth?: string;
    charger?: string;
    extras?: string[];
    brokenGlass?: "front" | "back" | "both" | null;
    brokenFunctional?: boolean | null;
    paidOff?: boolean | null;
    imei?: string;
  }>;
  deviceCount?: number;
  totalPayout?: number;
  // Populated when the lead is rendered in the Trash view.
  deletedAt?: string;
  hoursToAutoPurge?: number | null;
  status: string;
  statusUpdatedAt?: string;
  latestNote?: string;
  latestNoteAt?: string;
  noteCount?: number;
  duplicateCount?: number;
  duplicateIds?: string[];
  resellEstimate?: number;
  grossMargin?: number;
  marginPercent?: number;
  marginFlag?: string;
  // Set when a customer edited their device(s) post-submission via the
  // offer page — the device/spec/quote fields reflect the edit.
  itemsEditedAt?: string;
  // True when a customer edit set a device broken — needs a hands-on re-quote.
  itemsNeedReview?: boolean;
  // Live Atlas + eBay margin per lead — computed at GET time using the
  // current comp datasets. Skywalker 2026-05-19.
  compMargin?: {
    sku?: string;
    quote?: number;
    atlas?: { resell: number; margin: number; marginPct: number; carrierKey: string };
    ebay?: { netMedian: number; sampleCount: number; margin: number; marginPct: number };
  };
  // Handoff metadata so staff knows shipping vs local + the address /
  // slot the seller picked. Skywalker 2026-05-17.
  handoffMethod?: "ship" | "local";
  shipAddress?: string;
  shipPackaging?: string;
  localArea?: string;
  localSlot?: string;
  handoffAction?: string;
  fedexTracking?: string;
  fedexLabelUrl?: string;
  fedexService?: string;
  fedexLabelError?: { kind: string; reason: string; at: string };
  bestContact?: "text" | "call" | "email";
  customerNote?: string;
  quantity?: number;
  smsOptIn?: boolean;
  source?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string; referrer?: string; landed?: string; raw: string };
  staleHours?: number;
  priorLeads?: number;
  lifetimeSpend?: number;
  commsSent?: { sms: number; email: number; lastAt?: string };
  payoutConfirmation?: { method?: string; reference?: string; note?: string; amount?: number; at: string };
  idCaptured?: { type: string; last4: string; dobYear: string; photoUrl: string; at: string };
  reviewToken?: string;
  review?: { id: string; rating: number; title?: string; body: string; verified?: boolean; createdAt: string };
  couponApplied?: { code: string; value: number };
  // Counter-offer state — set when staff has minted a revised offer for
  // this lead. status reflects customer response (or "pending" if they
  // haven't replied yet). Surfaces on the lead row as a badge + lets
  // staff re-mint after a decline.
  counterOffer?: {
    status: "pending" | "accepted" | "declined";
    originalQuote: number;
    offer: number;
    reason: string;
    sentAt: string;
    respondedAt?: string;
    customerNote?: string;
  };
  // AI verdicts on this lead, sourced from MC markers. Tracked per
  // kind so a photo-check FLAG and Theot's channel-rec SUMMARY can
  // both render side-by-side. AI-NOTE only present when no other
  // kind exists (else it's redundant "all clear" noise).
  ai?: {
    flag?: { body: string; at: string; fromName?: string };
    note?: { body: string; at: string; fromName?: string };
    summary?: { body: string; at: string; fromName?: string };
  };
  // True when the customer opted into free responsible recycling
  // (no payout, no FedEx label) — surfaces as a ♻ chip on the row.
  // Skywalker 2026-05-22.
  recycleOnly?: boolean;
}

const STATUS_OPTIONS = [
  { value: "quote_requested", label: "📥 Quote requested", color: "#888" },
  { value: "shipped", label: "📦 Shipped / drop-off", color: "#4fc3f7" },
  { value: "received", label: "📬 Received", color: "#7c4dff" },
  { value: "tested", label: "🔍 Tested", color: "#ff9100" },
  // "Met & Thanked" terminates a local-meetup lead. Triggers the same
  // SMS+email pipeline as "Paid" but with a thank-you-and-review message
  // tailored to in-person handoffs. Trustpilot invite goes out on both.
  { value: "met", label: "🤝 Met & Thanked", color: "#ffb400" },
  { value: "paid", label: "💵 Paid", color: "#00c853" },
  { value: "rejected", label: "❌ Rejected", color: "#ef5350" },
];

function statusMeta(value: string) {
  return STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0];
}

// Terminal "we got paid / they got cash" statuses. Both count as completed
// revenue events for stats, filters, and conversion. "paid" is the digital
// payout flow; "met" is the in-person meetup handoff.
const PAID_STATUSES = new Set(["paid", "met"]);
function isPaid(status?: string): boolean {
  return !!status && PAID_STATUSES.has(status);
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

// Format-only payout-handle status for the admin chip. The funnel +
// /api/lead already enforce the strict checks at submit time (including
// the BTC checksum via the bitcoin-address-validation package), so by
// the time a lead exists, its BTC + Cash App handle have passed strict
// validation. Keeping THIS check regex-only avoids pulling the BTC
// crypto package into the admin client bundle. Skywalker 2026-05-22.
function payoutChipStatus(payout?: string): "verified" | "invalid" | "no-handle" | "none" {
  if (!payout || typeof payout !== "string") return "none";
  const colonIdx = payout.indexOf(":");
  if (colonIdx < 0) return "none";
  const method = payout.slice(0, colonIdx).trim().toLowerCase();
  const handle = payout.slice(colonIdx + 1).trim();
  if (method === "cash") return "none"; // local cash — no handle needed
  if (!handle) return "no-handle";
  if (method === "bitcoin" || method === "btc") {
    return /^(?:bc1|[13])[A-Za-z0-9]{25,75}$/.test(handle) ? "verified" : "invalid";
  }
  if (method === "cash app" || method === "cashapp") {
    const norm = handle.startsWith("$") ? handle : `$${handle}`;
    return /^\$[A-Za-z][A-Za-z0-9]{0,19}$/.test(norm) ? "verified" : "invalid";
  }
  if (method === "zelle") {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle)) return "verified";
    const digits = handle.replace(/\D/g, "");
    if (digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) return "verified";
    return "invalid";
  }
  return "none";
}

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Resale sidecar — fetched from /api/admin/sales, indexed by leadId
  // so each lead row can show "Sold $X · Profit $Y" without forcing a
  // server-side join. Re-fetched alongside leads (initial + autoRefresh).
  const [salesByLead, setSalesByLead] = useState<Record<string, { id: string; soldPrice: number; cost: number; profit: number; platform: string; saleDate: string }>>({});
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<Record<string, { sms: boolean; email: boolean } | null>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  // Payout-confirmation capture — gated by status flip to paid/met.
  // Skywalker 2026-05-18 "did we actually pay them, and how?".
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payingStatus, setPayingStatus] = useState<"paid" | "met">("paid");
  const [payoutMethod, setPayoutMethod] = useState<string>("");
  const [payoutReference, setPayoutReference] = useState<string>("");
  const [payoutNote, setPayoutNote] = useState<string>("");
  // Actual amount paid out — often differs from the original quote
  // when the device is downgraded at inspection (Rudy: quoted Pro
  // Max, paid 80 on actual iPhone 14). Stored in the same Payout-
  // confirmation MC line so the leads parser can surface it as
  // lead.payoutConfirmation.amount for the row + the profit ledger.
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  // When true, the "Confirm payout" submit ALSO creates a matching
  // row in the sales ledger (cost=amount, device=lead's corrected
  // device, leadId=lead.id) — saves an open-another-tab step.
  const [payoutAlsoLogResale, setPayoutAlsoLogResale] = useState<boolean>(true);
  // ID-capture (Texas Secondhand Dealer Act). When `idCaptureId === lead.id`
  // the lead row renders the inline capture form.
  const [idCaptureId, setIdCaptureId] = useState<string | null>(null);
  const [idType, setIdType] = useState<string>("DL");
  const [idNumber, setIdNumber] = useState<string>("");
  const [idDob, setIdDob] = useState<string>("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idUploadingId, setIdUploadingId] = useState<string | null>(null);
  const [idErrorById, setIdErrorById] = useState<Record<string, string>>({});
  const submitIdCapture = async (lead: Lead) => {
    if (!token) return;
    if (!idType || !idNumber.trim() || !idDob || !idFile) {
      setIdErrorById((s) => ({ ...s, [lead.id]: "Type, ID number, DOB, and photo all required" }));
      return;
    }
    setIdUploadingId(lead.id);
    setIdErrorById((s) => { const c = { ...s }; delete c[lead.id]; return c; });
    try {
      const form = new FormData();
      form.append("leadId", lead.id);
      form.append("idType", idType);
      form.append("idNumber", idNumber.trim());
      form.append("dob", idDob);
      form.append("photo", idFile);
      const r = await fetch(`/api/admin/leads/id-capture?token=${encodeURIComponent(token)}`, {
        method: "POST",
        body: form,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setIdErrorById((s) => ({ ...s, [lead.id]: d.error || `HTTP ${r.status}` }));
      } else {
        setLeads((cur) => cur.map((l) => l.id === lead.id ? {
          ...l,
          idCaptured: { type: d.idType, last4: d.last4, dobYear: d.dobYear, photoUrl: d.photoUrl, at: new Date().toISOString() },
        } : l));
        setIdCaptureId(null);
        setIdNumber(""); setIdDob(""); setIdFile(null);
      }
    } catch (e) {
      setIdErrorById((s) => ({ ...s, [lead.id]: e instanceof Error ? e.message : "Network error" }));
    } finally {
      setIdUploadingId(null);
    }
  };
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [smsOpenId, setSmsOpenId] = useState<string | null>(null);
  const [smsThreads, setSmsThreads] = useState<Record<string, { loading: boolean; messages?: { sid: string; body: string; direction: string; timestamp: string }[]; error?: string }>>({});
  const [recentlyChanged, setRecentlyChanged] = useState<Record<string, number>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  // Active vs Trash view. Trashed leads stay recoverable for 24h then
  // auto-purge. Skywalker 2026-05-17 "save my quotes for 24hr".
  const [view, setView] = useState<"active" | "trash" | "needs-review">("active");

  // ── Stale-refresh guard + optimistic-mutation suppression ─────────────
  // MC lives on Railway with wildly variable latency — a GET /api/comms
  // can take anywhere from <1s to ~10s, and a freshly POSTed marker isn't
  // readable for a beat after the write returns (read-after-write lag).
  // The 5s auto-refresh fires on a fixed interval WITHOUT awaiting the
  // previous fetch, so two problems used to surface (Skywalker: "I delete
  // a lead and it comes back on refresh"):
  //   1. Stale overwrite — a slow GET started before the delete resolves
  //      AFTER a fast later one and clobbers the list with the lead still
  //      present.
  //   2. Propagation lag — the first refresh(es) after a delete read MC
  //      before the [DELETED-LEAD] marker is visible, so the lead is still
  //      "active" server-side and reappears.
  //
  // Fix: (a) tag every fetch with a monotonic sequence; only apply a
  // response if it's the freshest one we've seen (drops stragglers).
  // (b) keep a client-side set of leadIds we've just deleted/restored and
  // suppress them from any incoming list until the server result agrees
  // (or a TTL elapses) — so a lagging GET can't resurrect a deleted lead.
  const fetchSeqRef = useRef(0);        // increments per request started
  const appliedSeqRef = useRef(0);      // highest seq actually applied
  // leadId → expiry (ms epoch). Within window, the lead is force-hidden
  // from Active no matter what MC returns. TTL covers MC's worst-case
  // write+read lag with margin; if a delete genuinely failed the lead
  // reappears after expiry so the operator can retry.
  const pendingDeleteRef = useRef<Map<string, number>>(new Map());
  // leadId → expiry. Force-hidden from Trash after a restore.
  const pendingRestoreRef = useRef<Map<string, number>>(new Map());
  const PENDING_TTL_MS = 30_000;
  const markPending = useCallback((ref: { current: Map<string, number> }, id: string) => {
    ref.current.set(id, Date.now() + PENDING_TTL_MS);
  }, []);
  // Drop expired entries + apply suppression to an incoming list for the
  // CURRENT view. Active hides pending-deletes; Trash hides pending-
  // restores. Returns the filtered list.
  const applyPending = useCallback((list: Lead[], currentView: "active" | "trash" | "needs-review"): Lead[] => {
    const now = Date.now();
    for (const [id, exp] of pendingDeleteRef.current) if (exp <= now) pendingDeleteRef.current.delete(id);
    for (const [id, exp] of pendingRestoreRef.current) if (exp <= now) pendingRestoreRef.current.delete(id);
    if (currentView === "trash") {
      if (pendingRestoreRef.current.size === 0) return list;
      return list.filter((l) => !pendingRestoreRef.current.has(l.id));
    }
    // active / needs-review
    if (pendingDeleteRef.current.size === 0) return list;
    return list.filter((l) => !pendingDeleteRef.current.has(l.id));
  }, []);
  // Hide internal/test leads (Skywalker's own submissions matching
  // INTERNAL_IPS / INTERNAL_EMAILS server-side). Defaults to hidden;
  // toggle persisted in localStorage. 2026-05-19.
  const [showInternal, setShowInternal] = useState<boolean>(false);
  const [internalHidden, setInternalHidden] = useState<number>(0);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tcc-show-internal");
      if (stored === "1") setShowInternal(true);
    } catch {}
  }, []);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  // Customer history modal — opens when staff clicks a lead's email or
  // phone. Shows every lead (paid + pending + rejected) from the same
  // identity so repeat sellers, lifetime value, and prior disputes are
  // visible at a glance. Built client-side off the leads array.
  const [historyKey, setHistoryKey] = useState<{ kind: "email" | "phone"; value: string } | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  // Device-correction modal — opens with the full lead so the panel
  // can seed its fields from devices[0] (multi-device) or the flat
  // top-level model/storage/etc (single-device). Save posts to
  // /api/admin/leads/items and we refetchLeads on success.
  const [correctingLead, setCorrectingLead] = useState<Lead | null>(null);
  // Full-detail modal — clicking a lead's name opens a read-only panel
  // with EVERYTHING: every device + spec, every photo (uncapped, unlike
  // the 3-thumbnail row preview), handoff, notes, source, IMEI warnings.
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  // Header "Menu" dropdown — secondary nav/tools live here instead of all
  // competing in the header bar (kept only the workflow toggle + Live +
  // Refresh visible). Skywalker 2026-05-28 admin-declutter.
  const [moreOpen, setMoreOpen] = useState(false);
  // AI fraud check — Skywalker 2026-05-19. Per-lead in-flight flag and
  // the cached verdict for each lead. Verdict stays visible until the
  // page reloads or staff hits the button again.
  type FraudVerdict = { verdict?: string; score?: number; red_flags?: string[]; green_flags?: string[]; recommendation?: string };
  const [fraudCheckingId, setFraudCheckingId] = useState<string | null>(null);
  const [fraudVerdictById, setFraudVerdictById] = useState<Record<string, FraudVerdict>>({});
  const runFraudCheck = async (lead: Lead) => {
    if (!token) return;
    setFraudCheckingId(lead.id);
    try {
      const r = await fetch(`/api/admin/ai-fraud-check?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          device: lead.device || lead.model,
          condition: lead.condition,
          quote: lead.quote,
          priorLeads: lead.priorLeads,
          lifetimeSpend: lead.lifetimeSpend,
          // Source-IP / UA / Visitor-ID get parsed from lead.body in the
          // admin GET, but they're not exposed as fields yet — pass
          // what we have. AI fraud route is fingerprint-tolerant.
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setFraudVerdictById((p) => ({ ...p, [lead.id]: { verdict: "error", recommendation: d.error || "AI failed" } }));
        return;
      }
      const d = await r.json();
      const v = (d.verdict || {}) as FraudVerdict;
      // Bail on empty / malformed AI responses — without this guard, an
      // invalid-JSON parse renders "🤖 undefined · score ? · undefined"
      // which looks broken. Surface a real error instead.
      if (!v.verdict && v.score === undefined && !(v.red_flags?.length) && !(v.green_flags?.length)) {
        setFraudVerdictById((p) => ({ ...p, [lead.id]: { verdict: "error", recommendation: "AI returned no verdict" } }));
        return;
      }
      setFraudVerdictById((p) => ({ ...p, [lead.id]: v }));
    } catch {
      setFraudVerdictById((p) => ({ ...p, [lead.id]: { verdict: "error", recommendation: "Network failure" } }));
    } finally {
      setFraudCheckingId(null);
    }
  };
  const [adjustQuote, setAdjustQuote] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [adjustSavingId, setAdjustSavingId] = useState<string | null>(null);

  const saveAdjust = async (lead: Lead) => {
    if (!token) return;
    const newQuote = parseInt(adjustQuote.replace(/\D/g, ""), 10);
    if (!newQuote || isNaN(newQuote) || !adjustReason.trim()) return;
    setAdjustSavingId(lead.id);
    try {
      const r = await fetch(`/api/admin/leads/adjust?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          newQuote,
          reason: adjustReason.trim(),
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          device: lead.model || lead.device,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setLeads((cur) => cur.map((l) => (l.id === lead.id ? { ...l, quote: `$${newQuote}` } : l)));
      setAdjustingId(null);
      setAdjustQuote("");
      setAdjustReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adjust failed");
    } finally {
      setAdjustSavingId(null);
    }
  };

  const loadSmsThread = async (lead: Lead) => {
    if (!token || !lead.phone) return;
    setSmsThreads((prev) => ({ ...prev, [lead.id]: { loading: true } }));
    try {
      const r = await fetch(`/api/admin/leads/sms?token=${encodeURIComponent(token)}&phone=${encodeURIComponent(lead.phone)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setSmsThreads((prev) => ({ ...prev, [lead.id]: { loading: false, messages: d.messages || [] } }));
    } catch (e) {
      setSmsThreads((prev) => ({ ...prev, [lead.id]: { loading: false, error: e instanceof Error ? e.message : "Load failed" } }));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runBulkStatus = async (newStatus: string) => {
    if (!token || !newStatus || selectedIds.size === 0) return;
    setBulkSaving(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        const lead = leads.find((l) => l.id === ids[i]);
        if (!lead) { setBulkProgress({ done: i + 1, total: ids.length }); continue; }
        if (lead.status === newStatus) { setBulkProgress({ done: i + 1, total: ids.length }); continue; }
        try {
          await fetch(`/api/admin/leads/status?token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leadId: lead.id,
              status: newStatus,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              device: lead.model || lead.device,
              quote: lead.quote,
              payout: lead.payout,
              rejectionReason: newStatus === "rejected" ? "Bulk update — see operator for details" : undefined,
            }),
          });
          setLeads((cur) => cur.map((l) => (l.id === lead.id ? { ...l, status: newStatus, statusUpdatedAt: new Date().toISOString() } : l)));
        } catch {}
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      setSelectedIds(new Set());
      setBulkStatus("");
    } finally {
      setBulkSaving(false);
      setTimeout(() => setBulkProgress(null), 1500);
    }
  };

  // Bulk soft-delete — moves every selected lead to Trash in one pass,
  // reusing the same per-lead delete endpoint runBulkStatus mirrors. Soft
  // (recoverable from Trash); MC comms history is permanent regardless.
  const runBulkDelete = async () => {
    if (!token || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const ok = confirm(`Move ${ids.length} selected lead${ids.length === 1 ? "" : "s"} to Trash?\n\nThey'll be hidden from the Active feed but recoverable from the Trash view. MC comms history is permanent regardless.`);
    if (!ok) return;
    setBulkSaving(true);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      let failed = 0;
      for (let i = 0; i < ids.length; i++) {
        const lead = leads.find((l) => l.id === ids[i]);
        try {
          const r = await fetch(`/api/admin/leads/delete?token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId: ids[i], reason: `bulk delete via admin UI${lead?.name ? ` for ${lead.name}` : ""}` }),
          });
          // Only treat it as deleted if the server actually accepted it.
          // Previously a 502/503 (MC down / key missing) still ran the
          // optimistic removal below, so the lead vanished then snapped
          // back on the next refresh — looking like "delete doesn't work".
          if (!r.ok) { failed++; continue; }
          markPending(pendingDeleteRef, ids[i]);
          setLeads((cur) => cur.filter((l) => l.id !== ids[i]));
        } catch { failed++; }
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      setSelectedIds(new Set());
      if (failed > 0) setError(`${failed} of ${ids.length} deletes failed — those leads are still active. Try again.`);
    } finally {
      setBulkSaving(false);
      setTimeout(() => setBulkProgress(null), 1500);
    }
  };

  // Custom email composer — Skywalker 2026-05-18 "I should also be
  // able to send custom email there, not just resend. I do like the
  // resend idea though." When `emailComposeId === lead.id`, the row
  // renders an inline composer (subject + body + Send/Cancel).
  const [emailComposeId, setEmailComposeId] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailBody, setEmailBody] = useState<string>("");
  const [emailSendingId, setEmailSendingId] = useState<string | null>(null);
  const [emailErrorById, setEmailErrorById] = useState<Record<string, string>>({});
  const [emailSentById, setEmailSentById] = useState<Record<string, boolean>>({});
  const openEmailComposer = (lead: Lead) => {
    setEmailComposeId(lead.id);
    setEmailSubject("");
    setEmailBody("");
    setEmailErrorById((s) => { const c = { ...s }; delete c[lead.id]; return c; });
  };
  const sendCustomEmail = async (lead: Lead) => {
    if (!token) return;
    if (!lead.email) {
      setEmailErrorById((s) => ({ ...s, [lead.id]: "No customer email on file" }));
      return;
    }
    if (!emailSubject.trim() || emailSubject.trim().length < 2) {
      setEmailErrorById((s) => ({ ...s, [lead.id]: "Subject required" }));
      return;
    }
    if (!emailBody.trim() || emailBody.trim().length < 5) {
      setEmailErrorById((s) => ({ ...s, [lead.id]: "Body too short" }));
      return;
    }
    setEmailSendingId(lead.id);
    setEmailErrorById((s) => { const c = { ...s }; delete c[lead.id]; return c; });
    try {
      const r = await fetch(`/api/admin/leads/email?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          to: lead.email,
          subject: emailSubject.trim(),
          body: emailBody.trim(),
          customerFirstName: lead.name,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setEmailErrorById((s) => ({ ...s, [lead.id]: d.error || `HTTP ${r.status}` }));
      } else {
        setEmailSentById((s) => ({ ...s, [lead.id]: true }));
        setEmailComposeId(null);
        setEmailSubject("");
        setEmailBody("");
        setTimeout(() => setEmailSentById((s) => { const c = { ...s }; delete c[lead.id]; return c; }), 4000);
      }
    } catch (e) {
      setEmailErrorById((s) => ({ ...s, [lead.id]: e instanceof Error ? e.message : "Network error" }));
    } finally {
      setEmailSendingId(null);
    }
  };

  // Counter-offer modal state. Holds the lead being negotiated plus the
  // staff-entered offer + reason. When `counterOfferLead === null` the
  // modal is hidden. After successful POST, `counterOfferSentFor` holds
  // the lead id for ~3s so the row's badge flips immediately (admin GET
  // will reconcile next refresh).
  const [counterOfferLead, setCounterOfferLead] = useState<Lead | null>(null);
  const [counterOfferAmount, setCounterOfferAmount] = useState<string>("");
  const [counterOfferReason, setCounterOfferReason] = useState<string>("");
  const [counterOfferSending, setCounterOfferSending] = useState<boolean>(false);
  const [counterOfferError, setCounterOfferError] = useState<string>("");
  const [counterOfferSentFor, setCounterOfferSentFor] = useState<string | null>(null);

  const openCounterOffer = useCallback((lead: Lead) => {
    setCounterOfferLead(lead);
    // Default amount: last counter (so re-mint after decline is one tap)
    // or empty so staff thinks deliberately. Reason is always blank —
    // we don't reuse the prior reason.
    setCounterOfferAmount(lead.counterOffer ? String(lead.counterOffer.offer) : "");
    setCounterOfferReason("");
    setCounterOfferError("");
  }, []);

  const closeCounterOffer = useCallback(() => {
    setCounterOfferLead(null);
    setCounterOfferAmount("");
    setCounterOfferReason("");
    setCounterOfferError("");
  }, []);

  const submitCounterOffer = useCallback(async () => {
    if (!counterOfferLead || !token) return;
    const offer = parseInt(counterOfferAmount, 10);
    if (!Number.isFinite(offer) || offer < 0) {
      setCounterOfferError("Enter a valid dollar amount.");
      return;
    }
    const reason = counterOfferReason.trim();
    if (reason.length < 10) {
      setCounterOfferError("Reason should be at least a short sentence — the customer reads this verbatim.");
      return;
    }
    // Original quote — comma-aware so "$1,250" parses as 1250, not 1.
    // (The old /\$?(\d+)/ stopped at the comma and recorded $1 as the
    // original, making every counter-offer on a ≥$1k lead look like a
    // massive cut to the customer.)
    const quoteStr = counterOfferLead.quote || "";
    const originalQuote = parseDollarAmount(quoteStr) || counterOfferLead.totalPayout || 0;
    if (!originalQuote) {
      setCounterOfferError("Can't determine the original quote on this lead.");
      return;
    }
    setCounterOfferSending(true);
    setCounterOfferError("");
    try {
      const r = await fetch(`/api/admin/leads/counter-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          leadId: counterOfferLead.id,
          name: counterOfferLead.name,
          phone: counterOfferLead.phone,
          email: counterOfferLead.email,
          device: counterOfferLead.model || counterOfferLead.device,
          originalQuote,
          offer,
          reason,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setCounterOfferError(d.error || `HTTP ${r.status}`);
        return;
      }
      // Optimistic row update — flip the badge to pending immediately.
      const sentAt = new Date().toISOString();
      const leadId = counterOfferLead.id;
      setLeads((cur) => cur.map((l) => l.id === leadId ? {
        ...l,
        counterOffer: { status: "pending" as const, originalQuote, offer, reason, sentAt },
      } : l));
      setCounterOfferSentFor(leadId);
      setTimeout(() => setCounterOfferSentFor((cur) => (cur === leadId ? null : cur)), 3500);
      closeCounterOffer();
    } catch (e) {
      setCounterOfferError(e instanceof Error ? e.message : "Network error");
    } finally {
      setCounterOfferSending(false);
    }
  }, [counterOfferLead, counterOfferAmount, counterOfferReason, token, closeCounterOffer]);

  // Tracks per-lead "Copied!" flash for the review-link button.
  // Skywalker 2026-05-17: "give them to ask for reviews" — admin needs a
  // one-click way to grab a personalized review URL per customer.
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const copyReviewLink = async (lead: Lead) => {
    // Strict gate — review links require a minted single-use token,
    // which only gets created when status flips to paid/met. If no
    // active token exists (lead never marked paid, or token already
    // used, or expired), refuse and explain. Skywalker 2026-05-18.
    if (!lead.reviewToken) {
      alert("No active review link for this lead. Mark the lead as Paid or Met first to generate one. If the customer already used their link, mark Paid again to mint a fresh one.");
      return;
    }
    const params = new URLSearchParams();
    params.set("token", lead.reviewToken);
    if (lead.name) params.set("name", lead.name);
    const dev = lead.model || lead.device;
    if (dev) params.set("device", dev);
    const url = `https://topcashcellular.com/reviews/new?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(lead.id);
      setTimeout(() => setCopiedLinkId((cur) => (cur === lead.id ? null : cur)), 2500);
    } catch {
      // Some browsers block clipboard without user gesture; fall back to
      // window.prompt so the operator can manually copy the URL.
      window.prompt("Copy this review link:", url);
    }
  };

  // FedEx label generation. Parses the address from lead.shipAddress
  // (formatted by /api/lead as "street[, unit], city, ST zip") and POSTs
  // to /api/admin/leads/label. Tracking + label URL stamp onto the lead
  // via MC [LABEL: ...] marker, so the next /api/admin/leads GET picks
  // them up automatically. Skywalker 2026-05-17.
  const [labelGeneratingId, setLabelGeneratingId] = useState<string | null>(null);
  const [labelErrorById, setLabelErrorById] = useState<Record<string, string>>({});
  // Resend tracks separately from generate so the spinner only shows on
  // the resend button.
  const [labelResendingId, setLabelResendingId] = useState<string | null>(null);
  const [labelResendOkById, setLabelResendOkById] = useState<Record<string, boolean>>({});
  // Edit-address-and-retry. When `addressEditId === lead.id`, the lead
  // row renders an inline form with editable fields. Submitting POSTs
  // to /api/admin/leads/label with the new address; on success the
  // form collapses and the lead row gets the new tracking.
  const [addressEditId, setAddressEditId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<{
    street: string; unit: string; city: string; state: string; zip: string;
  }>({ street: "", unit: "", city: "", state: "", zip: "" });
  const parseShipAddress = (raw: string | undefined) => {
    if (!raw) return null;
    // Format: "street[, unit], city, ST zip"
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 3) return null;
    const last = parts[parts.length - 1];
    const stZip = last.match(/^([A-Z]{2})\s+(\d{5})/i);
    if (!stZip) return null;
    const city = parts[parts.length - 2];
    const street = parts[0];
    const unit = parts.length >= 4 ? parts[1] : undefined;
    return { street, unit, city, state: stZip[1].toUpperCase(), zip: stZip[2] };
  };
  const openAddressEdit = (lead: Lead) => {
    const parsed = parseShipAddress(lead.shipAddress);
    setAddressDraft({
      street: parsed?.street || "",
      unit: parsed?.unit || "",
      city: parsed?.city || "",
      state: parsed?.state || "",
      zip: parsed?.zip || "",
    });
    setAddressEditId(lead.id);
    setLabelErrorById((s) => { const c = { ...s }; delete c[lead.id]; return c; });
  };
  // Shared label-generation worker — takes an explicit address (so
  // edit-and-retry can pass the staff-corrected version, while the
  // basic generateLabel keeps using whatever's on the lead).
  const callGenerateLabel = async (lead: Lead, addr: { street: string; unit?: string; city: string; state: string; zip: string }) => {
    if (!token) return;
    if (!lead.name || !lead.phone) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: "Missing customer name or phone" }));
      return;
    }
    setLabelGeneratingId(lead.id);
    setLabelErrorById((s) => { const c = { ...s }; delete c[lead.id]; return c; });
    try {
      const r = await fetch(`/api/admin/leads/label?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          deviceLabel: lead.model || lead.device,
          customerEmail: lead.email,
          customer: {
            customerName: lead.name,
            customerPhone: lead.phone,
            customerStreet: addr.street,
            customerUnit: addr.unit,
            customerCity: addr.city,
            customerState: addr.state,
            customerZip: addr.zip,
          },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLabelErrorById((s) => ({ ...s, [lead.id]: d.error || `HTTP ${r.status}` }));
      } else {
        // Optimistic update + clear any prior fedexLabelError so the
        // failed-state UI collapses immediately. Auto-refresh from MC
        // will reconcile within 30s.
        setLeads((cur) => cur.map((l) => l.id === lead.id ? { ...l, fedexTracking: d.tracking, fedexLabelUrl: d.labelUrl, fedexService: d.serviceType, fedexLabelError: undefined } : l));
        setAddressEditId(null);
      }
    } catch (e) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: e instanceof Error ? e.message : "Network error" }));
    } finally {
      setLabelGeneratingId(null);
    }
  };
  const generateLabel = async (lead: Lead) => {
    const addr = parseShipAddress(lead.shipAddress);
    if (!addr) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: "Couldn't parse shipping address — use Edit address & retry" }));
      return;
    }
    await callGenerateLabel(lead, addr);
  };

  // One-click retry — calls the shared FedEx retry route, which
  // re-pulls the lead body from MC and re-mints without any address
  // re-entry. Useful when the original mint failed transiently
  // (SERVICE_UNAVAILABLE) and the customer's address is fine. The
  // cron will also try this every 30 min; this is the manual-now path.
  // Skywalker 2026-05-19.
  const autoRetryLabel = async (lead: Lead) => {
    if (!token) return;
    setLabelGeneratingId(lead.id);
    setLabelErrorById((s) => { const c = { ...s }; delete c[lead.id]; return c; });
    try {
      const r = await fetch(`/api/admin/fedex/regenerate?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setLabelErrorById((s) => ({ ...s, [lead.id]: d.error || `Retry failed (${d.kind || r.status})` }));
        return;
      }
      // Success path — clear the error pill, set new tracking.
      if (d.label) {
        setLeads((cur) => cur.map((l) => l.id === lead.id ? { ...l, fedexTracking: d.label.tracking, fedexLabelUrl: d.label.url, fedexService: d.label.service, fedexLabelError: undefined } : l));
      }
    } catch (e) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: e instanceof Error ? e.message : "Network error" }));
    } finally {
      setLabelGeneratingId(null);
    }
  };
  const retryWithEditedAddress = async (lead: Lead) => {
    if (!addressDraft.street.trim() || !addressDraft.city.trim() || !addressDraft.state.trim() || !addressDraft.zip.trim()) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: "Street, city, state, ZIP required" }));
      return;
    }
    await callGenerateLabel(lead, {
      street: addressDraft.street.trim(),
      unit: addressDraft.unit.trim() || undefined,
      city: addressDraft.city.trim(),
      state: addressDraft.state.trim().toUpperCase(),
      zip: addressDraft.zip.trim().slice(0, 5),
    });
  };
  const resendLabelEmail = async (lead: Lead) => {
    if (!token) return;
    if (!lead.email) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: "No customer email on file" }));
      return;
    }
    if (!lead.fedexTracking || !lead.fedexLabelUrl) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: "No existing label to resend — generate one first" }));
      return;
    }
    setLabelResendingId(lead.id);
    setLabelErrorById((s) => { const c = { ...s }; delete c[lead.id]; return c; });
    try {
      const r = await fetch(`/api/admin/leads/label-resend?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          to: lead.email,
          customerName: lead.name,
          tracking: lead.fedexTracking,
          labelUrl: lead.fedexLabelUrl,
          serviceType: lead.fedexService,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLabelErrorById((s) => ({ ...s, [lead.id]: d.error || `HTTP ${r.status}` }));
      } else {
        setLabelResendOkById((s) => ({ ...s, [lead.id]: true }));
        // Auto-clear the success badge after 4s.
        setTimeout(() => setLabelResendOkById((s) => { const c = { ...s }; delete c[lead.id]; return c; }), 4000);
      }
    } catch (e) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: e instanceof Error ? e.message : "Network error" }));
    } finally {
      setLabelResendingId(null);
    }
  };

  const saveNote = async (lead: Lead) => {
    if (!token || !noteDraft.trim()) return;
    setNoteSavingId(lead.id);
    try {
      const r = await fetch(`/api/admin/leads/note?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, note: noteDraft }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setLeads((cur) => cur.map((l) => (l.id === lead.id ? { ...l, latestNote: noteDraft.trim(), latestNoteAt: new Date().toISOString(), noteCount: (l.noteCount || 0) + 1 } : l)));
      setNoteDraft("");
      setNoteOpenId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note save failed");
    } finally {
      setNoteSavingId(null);
    }
  };
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Google sign-in info (rendered in the header when present). proxy.ts
  // already gates this page to admin emails, so if we got here at all,
  // /api/auth/me should be authenticated + isAdmin. Falling back to the
  // legacy token paste UI if /api/auth/me is somehow unreachable.
  const [googleUser, setGoogleUser] = useState<{ email: string; name?: string; picture?: string } | null>(null);

  // Hydrate token from URL or localStorage, AND auto-unlock via Google
  // session if present. proxy.ts injects x-admin-token server-side when
  // the session is admin, so any non-empty client token works — we use
  // a "google" sentinel just to satisfy the existing if-token guards.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlToken = new URLSearchParams(window.location.search).get("token");
    const stored = localStorage.getItem("tcc-admin-token");
    if (urlToken) {
      setToken(urlToken);
      localStorage.setItem("tcc-admin-token", urlToken);
    } else if (stored) {
      setToken(stored);
    }
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((me) => {
        if (me?.authenticated && me?.isAdmin) {
          setGoogleUser({ email: me.email, name: me.name, picture: me.picture });
          // If no legacy token already loaded, use the sentinel so the
          // existing fetches fire (proxy injects the real header).
          setToken((t) => t || "google");
        }
      })
      .catch(() => {});
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const seq = ++fetchSeqRef.current;
    try {
      // needs-review is a client-side filter on top of the active list,
      // so coerce to "active" for the backend fetch.
      const wireView = view === "needs-review" ? "active" : view;
      const r = await fetch(`/api/admin/leads?token=${encodeURIComponent(token)}&view=${wireView}&internal=${showInternal ? "show" : "hide"}`, { cache: "no-store" });
      if (r.status === 401) {
        setError("Invalid token");
        setToken("");
        localStorage.removeItem("tcc-admin-token");
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      // Drop this response if a newer fetch already landed — MC's variable
      // latency means an older slow request can resolve last and clobber.
      if (seq <= appliedSeqRef.current) return;
      appliedSeqRef.current = seq;
      setLeads(applyPending(d.leads || [], view));
      setInternalHidden(d.internalHidden || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [token, view, showInternal, applyPending]);

  // Pull the resale ledger alongside leads so each row can show
  // "Sold $X · Profit $Y" without forcing a server-side join. Best-
  // effort: failure here doesn't impact the leads view.
  const fetchSalesSidecar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/sales", {
        headers: { "x-admin-token": token },
        cache: "no-store",
      });
      if (!r.ok) return;
      const d = await r.json();
      const byLead: Record<string, { id: string; soldPrice: number; cost: number; profit: number; platform: string; saleDate: string }> = {};
      for (const s of (d.sales || []) as Array<{ id: string; leadId?: string; soldPrice: number; cost: number; profit: number; platform: string; saleDate: string }>) {
        if (!s.leadId) continue;
        // Latest sale per lead wins. The /sales endpoint already
        // returns newest-first, so the first hit is canonical and we
        // can skip later entries cheaply.
        if (!byLead[s.leadId]) {
          byLead[s.leadId] = { id: s.id, soldPrice: s.soldPrice, cost: s.cost, profit: s.profit, platform: s.platform, saleDate: s.saleDate };
        }
      }
      setSalesByLead(byLead);
    } catch { /* silent — leads view stays functional without resale info */ }
  }, [token]);

  // Soft-trash a lead. Posts a [DELETED-LEAD: <id>] marker comm to MC.
  // The lead disappears from the Active view but stays recoverable in
  // the Trash view. Auto-purge policy (Skywalker 2026-05-19):
  //   - Active in-flight leads: stay in Trash indefinitely (never lose
  //     a customer's data on a misclick).
  //   - Finished leads (paid/met/rejected): auto-purge from Trash after
  //     24h to keep the view clean. MC comms history is permanent.
  const deleteLead = useCallback(async (lead: Lead) => {
    if (!token) return;
    const label = lead.name || lead.email || lead.phone || lead.id;
    const isFinished = lead.status === "paid" || lead.status === "met" || lead.status === "rejected";
    const ttlNote = isFinished
      ? "Stays in Trash for 24 hours, then auto-purges."
      : "Active lead — stays in Trash indefinitely (never auto-purges). MC comms history is permanent regardless.";
    const ok = confirm(`Move "${label}" to Trash?\n\n${ttlNote}\n\nIt will be hidden from the Active feed but recoverable from the Trash view.`);
    if (!ok) return;
    setDeletingId(lead.id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/leads/delete?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, reason: `deleted via admin UI for ${label}` }),
      });
      if (!r.ok) {
        // Surface the server's error body (e.g. "MC API key not
        // configured on Vercel...") rather than a generic HTTP code so
        // the operator can act on it without grep'ing through logs.
        let detail = `HTTP ${r.status}`;
        try {
          const errBody = await r.json();
          if (errBody?.error) detail = errBody.error;
        } catch {}
        throw new Error(detail);
      }
      // Optimistic — remove from current list AND register a pending-
      // delete so the next few auto-refreshes (which may read MC before
      // the [DELETED-LEAD] marker propagates, or resolve out of order)
      // can't resurrect the lead.
      markPending(pendingDeleteRef, lead.id);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (e) {
      setError(e instanceof Error ? `Delete failed: ${e.message}` : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }, [token, markPending]);

  // Restore a trashed lead. Posts a [RESTORED-LEAD: <id>] marker that
  // the admin GET treats as un-trashing when newer than the matching
  // [DELETED-LEAD: <id>] marker. Skywalker 2026-05-17.
  const restoreLead = useCallback(async (lead: Lead) => {
    if (!token) return;
    setRestoringId(lead.id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/leads/restore?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (!r.ok) {
        let detail = `HTTP ${r.status}`;
        try { const errBody = await r.json(); if (errBody?.error) detail = errBody.error; } catch {}
        throw new Error(detail);
      }
      // Optimistic — remove from current Trash view AND register a
      // pending-restore so a lagging read can't pull it back into Trash.
      // Next auto-refresh will surface it back in Active.
      markPending(pendingRestoreRef, lead.id);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (e) {
      setError(e instanceof Error ? `Restore failed: ${e.message}` : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }, [token, markPending]);

  useEffect(() => {
    if (token) {
      fetchLeads();
      fetchSalesSidecar();
    }
  }, [token, fetchLeads, fetchSalesSidecar]);

  // Auto-refresh every 5s while tab is visible. Diff against the previous
  // snapshot and pulse-highlight any row whose status changed.
  //
  // CRITICAL: this fetch MUST pass the same `internal` param as the
  // initial fetchLeads. The server defaults missing `internal` to
  // "hide", so a tick without the param strips internal leads from
  // the list — which on a screen showing Skywalker's own test
  // submissions (his IP is in INTERNAL_IPS) makes the active list
  // appear to "load then disappear" 5 seconds after page open.
  // Skywalker reported 2026-05-24.
  useEffect(() => {
    if (!token || !autoRefresh) return;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const seq = ++fetchSeqRef.current;
      try {
        const wireView = view === "needs-review" ? "active" : view;
        const r = await fetch(
          `/api/admin/leads?token=${encodeURIComponent(token)}&view=${wireView}&internal=${showInternal ? "show" : "hide"}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const d = await r.json();
        // Ignore stale stragglers — only the freshest started fetch wins.
        if (seq <= appliedSeqRef.current) return;
        appliedSeqRef.current = seq;
        // Suppress leads we've optimistically deleted (and trashed leads
        // we've restored) until MC catches up, so a lagging read can't
        // resurrect them.
        const next: Lead[] = applyPending(d.leads || [], view);
        setLeads((prev) => {
          const prevById = new Map(prev.map((l) => [l.id, l.status]));
          const changedIds: string[] = [];
          for (const lead of next) {
            const prevStatus = prevById.get(lead.id);
            if (prevStatus && prevStatus !== lead.status) changedIds.push(lead.id);
          }
          if (changedIds.length > 0) {
            const now = Date.now();
            setRecentlyChanged((rc) => {
              const updated = { ...rc };
              for (const id of changedIds) updated[id] = now;
              return updated;
            });
          }
          return next;
        });
      } catch {}
    };
    // Tightened from 15s to 5s 2026-05-17 — Skywalker reported staleness.
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
    // showInternal in deps so toggling the chip restarts the interval
    // with the right param, not just the next-fired tick.
  }, [token, autoRefresh, view, showInternal]);

  // Clean up the "recently changed" highlights after 4s.
  useEffect(() => {
    if (Object.keys(recentlyChanged).length === 0) return;
    const t = setTimeout(() => {
      const cutoff = Date.now() - 4000;
      setRecentlyChanged((rc) => {
        const next: Record<string, number> = {};
        for (const [id, ts] of Object.entries(rc)) if (ts > cutoff) next[id] = ts;
        return next;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [recentlyChanged]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setToken(tokenInput.trim());
    localStorage.setItem("tcc-admin-token", tokenInput.trim());
  };

  const handleLogout = () => {
    setToken("");
    setLeads([]);
    localStorage.removeItem("tcc-admin-token");
  };

  const matchesSearch = (lead: Lead, q: string): boolean => {
    if (!q) return true;
    const needle = q.toLowerCase().trim();
    const hay = [
      lead.name,
      lead.phone,
      lead.email,
      lead.device,
      lead.model,
      lead.storage,
      lead.condition,
      lead.imei,
      lead.payout,
      lead.id, // so pasting a customer's offer number finds the lead
    ].filter(Boolean).join(" ").toLowerCase();
    if (hay.includes(needle)) return true;
    // Offer-number search: a pasted "#MPP…-…" / "Offer #MPP…" reference
    // resolves to the lead even with the "#"/spaces/case stripped.
    return offerNumberMatches(lead.id, q);
  };

  // Client-side de-dupe: collapse near-identical lead submissions from the same
  // contact within 24h into a single row, with a count of earlier duplicates
  // attached to the canonical (newest) lead.
  //
  // Custom-quote flows (quote = "TBD (custom)") use device-category only since
  // the "model" field is free-text from the customer and varies between submits.
  // Regular instant-quote flows use the full model name.
  const dedupeLeads = (list: Lead[]): Lead[] => {
    const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const dayMs = 24 * 3600 * 1000;
    const groups = new Map<string, Lead & { duplicateCount?: number; duplicateIds?: string[] }>();
    const normalizeContact = (lead: Lead): string => {
      // Prefer email (full lowercased), fall back to digits-only phone.
      // Previous version did .replace(/\D/g, "") on the email which collapsed
      // distinct customers whose emails happened to share digits.
      const email = (lead.email || "").toLowerCase().trim();
      if (email) return email;
      const phone = (lead.phone || "").replace(/\D/g, "");
      return phone || "—";
    };
    for (const lead of sorted) {
      const contact = normalizeContact(lead);
      const isCustom = !lead.quote || /custom|tbd/i.test(lead.quote);
      const productKey = isCustom
        ? (lead.device || "").toLowerCase()
        : `${(lead.device || "").toLowerCase()}|${(lead.model || "").toLowerCase()}`;
      const key = `${contact}|${productKey}|${isCustom ? "custom" : "regular"}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { ...lead });
        continue;
      }
      const existingTs = new Date(existing.timestamp).getTime();
      const leadTs = new Date(lead.timestamp).getTime();
      if (Math.abs(existingTs - leadTs) < dayMs) {
        existing.duplicateCount = (existing.duplicateCount || 0) + 1;
        existing.duplicateIds = [...(existing.duplicateIds || []), lead.id];
      } else {
        // Outside dedup window — treat as separate
        groups.set(`${key}|${lead.id}`, { ...lead });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  };

  const dedupedLeads = dedupeLeads(leads);
  const filteredLeads = dedupedLeads.filter((l) => matchesSearch(l, searchQuery));

  // "Needs review" filter — leads that staff should look at right now.
  // Three triggers:
  //   1. AI flagged it (photo mismatch, fraud risk, channel-rec "pass").
  //   2. Stuck for >24h without a status change AND not already finished.
  //   3. Missing or sparse photos on a single-device lead — can't QA without them.
  // Lives entirely client-side over the already-fetched active list,
  // so toggling the tab is instant. Skywalker 2026-05-19.
  const FINISHED = new Set(["paid", "met", "rejected"]);
  function leadNeedsReview(l: Lead): boolean {
    if (l.ai?.flag) return true;
    if (l.ai?.summary && /\bpass\b/i.test(l.ai.summary.body)) return true;
    if (l.staleHours && l.staleHours >= 24 && !FINISHED.has(l.status)) return true;
    const isMulti = !!(l.deviceCount && l.deviceCount > 1);
    if (!isMulti && (!l.photos || l.photos.length < 2)) return true;
    // A device with no system price (quote <= 0) needs a manual quote —
    // surface the lead so staff don't miss it.
    if ((l.devices ?? []).some(d => (d.quote ?? 0) <= 0)) return true;
    return false;
  }
  const needsReviewLeads = filteredLeads.filter(leadNeedsReview);
  const displayedLeads = view === "needs-review" ? needsReviewLeads : filteredLeads;

  const computeStats = (list: Lead[]) => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    const monthAgo = now - 30 * 24 * 3600 * 1000;
    let thisWeek = 0;
    let thisMonth = 0;
    let paidCount = 0;
    let nonRejectedCount = 0;
    let quoteSum = 0;
    let quoteN = 0;
    let revenue = 0;
    let revenueMonth = 0;
    let revenueWeek = 0;
    let pendingCount = 0;   // open leads (not paid/met/rejected) = the work queue
    let shippedCount = 0;   // awaiting receipt — device in transit / dropping off
    let payoutLatencySum = 0;
    let payoutLatencyN = 0;
    const payoutTally: Record<string, number> = {};
    for (const l of list) {
      const ts = new Date(l.timestamp).getTime();
      if (ts >= weekAgo) thisWeek++;
      if (ts >= monthAgo) thisMonth++;
      if (isPaid(l.status)) paidCount++;
      if (l.status !== "rejected") nonRejectedCount++;
      if (l.status !== "paid" && l.status !== "met" && l.status !== "rejected") pendingCount++;
      if (l.status === "shipped") shippedCount++;
      // Quote-value parsing — three sources, cascading:
      //  1) payoutConfirmation.amount  — actual amount paid out at mark-paid
      //     (most accurate; captures Rudy-style "quoted Pro Max, paid $80
      //     for actual 14" cases)
      //  2) totalPayout                — multi-device lead total (these
      //     leads have NO Quote: field, so the regex below would miss them
      //     entirely — was the source of the /customers + /admin total
      //     mismatch Skywalker fixed in a58cc17)
      //  3) Quote field, comma-aware   — single-device fallback. Old code
      //     used /\d+/ which collapsed "$1,250" to "$1"; the [\d,]+
      //     pattern + strip-commas is the same fix /customers uses.
      const quoteMatch = l.quote?.match(/[\d,]+/)?.[0]?.replace(/,/g, "");
      const parsedQuote = quoteMatch ? parseInt(quoteMatch, 10) : 0;
      const dollarValue =
        (typeof l.payoutConfirmation?.amount === "number" && l.payoutConfirmation.amount > 0 ? l.payoutConfirmation.amount : 0)
        || (typeof l.totalPayout === "number" && l.totalPayout > 0 ? l.totalPayout : 0)
        || parsedQuote;
      if (dollarValue > 0) { quoteSum += dollarValue; quoteN++; }
      // "Paid out" rollup = sum of $$$ TCC sent to customers for phones it
      // bought (all-time + this-month). This is COGS / cash-out, NOT
      // revenue — the realised-sale revenue lives on /admin/profit and is
      // what TCC's eBay/Atlas resells brought in. Header label says
      // "Paid out (this month)" to match.
      if (isPaid(l.status) && dollarValue > 0) {
        revenue += dollarValue;
        if (l.statusUpdatedAt && new Date(l.statusUpdatedAt).getTime() >= monthAgo) revenueMonth += dollarValue;
        if (l.statusUpdatedAt && new Date(l.statusUpdatedAt).getTime() >= weekAgo) revenueWeek += dollarValue;
      }
      // Payout latency = lead created → terminal-status timestamp, in hours
      if (isPaid(l.status) && l.statusUpdatedAt) {
        const hours = (new Date(l.statusUpdatedAt).getTime() - ts) / 3600000;
        if (hours > 0 && hours < 24 * 90) { payoutLatencySum += hours; payoutLatencyN++; }
      }
      if (l.payout && l.payout !== "TBD") {
        payoutTally[l.payout] = (payoutTally[l.payout] || 0) + 1;
      }
    }
    const avgQuote = quoteN > 0 ? Math.round(quoteSum / quoteN) : 0;
    const conversionRate = nonRejectedCount > 0 ? Math.round((paidCount / nonRejectedCount) * 100) : 0;
    const topPayouts = Object.entries(payoutTally).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const avgPayoutHours = payoutLatencyN > 0 ? payoutLatencySum / payoutLatencyN : 0;
    return { total: list.length, thisWeek, thisMonth, conversionRate, avgQuote, topPayouts, revenue, revenueMonth, revenueWeek, pendingCount, shippedCount, avgPayoutHours, paidCount };
  };
  const stats = computeStats(dedupedLeads);

  // Stale-lead detection. Each status has a target SLA + a louder alert
  // threshold. Active leads past either get badged. Tested → paid is the
  // legal/promised window so we keep that one tight.
  const SLA_HOURS: Record<string, { target: number; alert: number }> = {
    quote_requested: { target: 1, alert: 4 },
    shipped: { target: 72, alert: 168 }, // 3d / 7d
    received: { target: 24, alert: 48 },
    tested: { target: 24, alert: 72 },
  };
  const stalenessFor = (lead: Lead): "ok" | "yellow" | "red" => {
    const sla = SLA_HOURS[lead.status];
    if (!sla) return "ok";
    const lastChange = new Date(lead.statusUpdatedAt || lead.timestamp).getTime();
    const hoursElapsed = (Date.now() - lastChange) / 3600000;
    if (hoursElapsed >= sla.alert) return "red";
    if (hoursElapsed >= sla.target) return "yellow";
    return "ok";
  };
  const isStale = (lead: Lead) => stalenessFor(lead) !== "ok";
  const staleCount = dedupedLeads.filter(isStale).length;

  // CSV export — dumps the current filtered view (after search + filter)
  // as a CSV file the user can drop into Sheets / Excel / QuickBooks.
  const exportFilteredCsv = (filteredView: Lead[]) => {
    const cols = [
      ["timestamp", (l: Lead) => l.timestamp],
      ["status", (l: Lead) => l.status],
      ["name", (l: Lead) => l.name || ""],
      ["phone", (l: Lead) => l.phone || ""],
      ["email", (l: Lead) => l.email || ""],
      ["device", (l: Lead) => l.device || ""],
      ["model", (l: Lead) => l.model || ""],
      ["storage", (l: Lead) => l.storage || ""],
      ["condition", (l: Lead) => l.condition || ""],
      ["carrier", (l: Lead) => l.carrier || ""],
      ["quote", (l: Lead) => l.quote || ""],
      ["payout", (l: Lead) => l.payout || ""],
      ["imei", (l: Lead) => l.imei || ""],
      ["processor", (l: Lead) => l.processor || ""],
      ["memory", (l: Lead) => l.memory || ""],
      ["graphics", (l: Lead) => l.graphics || ""],
      ["batteryHealth", (l: Lead) => l.batteryHealth || ""],
      ["brokenGlass", (l: Lead) => l.brokenGlass || ""],
      ["brokenFunctional", (l: Lead) => (l.brokenFunctional === false ? "no" : l.brokenFunctional === true ? "yes" : "")],
      ["paidOff", (l: Lead) => (l.paidOff === false ? "no" : l.paidOff === true ? "yes" : "")],
      ["resellEstimate", (l: Lead) => l.resellEstimate?.toString() || ""],
      ["marginPercent", (l: Lead) => l.marginPercent?.toString() || ""],
      ["marginFlag", (l: Lead) => l.marginFlag || ""],
      ["statusUpdatedAt", (l: Lead) => l.statusUpdatedAt || ""],
      ["latestNote", (l: Lead) => l.latestNote || ""],
      ["photoCount", (l: Lead) => (l.photos?.length || 0).toString()],
    ] as [string, (l: Lead) => string][];
    const esc = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const header = cols.map(([k]) => esc(k)).join(",");
    const rows = filteredView.map((l) => cols.map(([, fn]) => esc(fn(l))).join(","));
    const csv = [header, ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.download = `tcc-leads-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Customer history — every lead that matches the given email or phone
  // (normalized). Used by the history modal opened from a lead row.
  const historyLeads = ((): Lead[] => {
    if (!historyKey) return [];
    const target = historyKey.value.toLowerCase().trim();
    return dedupedLeads.filter((l) => {
      const v = historyKey.kind === "email" ? (l.email || "").toLowerCase().trim()
        : (l.phone || "").replace(/\D/g, "");
      const t = historyKey.kind === "email" ? target : target.replace(/\D/g, "");
      return v && v === t;
    });
  })();
  // Customer history modal "Total paid" — use the same 3-tier cascade
  // the page header uses so it doesn't undercount multi-device leads
  // (no Quote: field, only totalPayout) and doesn't collapse $1,250
  // quotes to $1 the way the old /\d+/ regex did.
  const historyTotalPaid = historyLeads
    .filter((l) => isPaid(l.status))
    .reduce((s, l) => {
      const v =
        (typeof l.payoutConfirmation?.amount === "number" && l.payoutConfirmation.amount > 0 ? l.payoutConfirmation.amount : 0)
        || (typeof l.totalPayout === "number" && l.totalPayout > 0 ? l.totalPayout : 0)
        || parseDollarAmount(l.quote);
      return s + v;
    }, 0);

  const saveStatus = async (lead: Lead, newStatus: string, reason?: string, payoutConfirmation?: { method: string; reference: string; note: string; amount?: number }) => {
    if (!token || newStatus === lead.status) return;
    setSavingId(lead.id);
    // Only pass shipAddress when the lead is a SHIPPING handoff AND
    // we're flipping it to "shipped". Local meetups never get a
    // FedEx label generated on status change. Skywalker 2026-05-17.
    let shipAddressPayload: { street: string; unit?: string; city: string; state: string; zip: string } | undefined;
    if (newStatus === "shipped" && lead.handoffMethod === "ship") {
      const parsed = parseShipAddress(lead.shipAddress);
      if (parsed) shipAddressPayload = parsed;
    }
    try {
      const r = await fetch(`/api/admin/leads/status?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          status: newStatus,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          device: lead.model || lead.device,
          quote: lead.quote,
          payout: lead.payout,
          rejectionReason: newStatus === "rejected" ? reason : undefined,
          shipAddress: shipAddressPayload,
          payoutConfirmation,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setLeads((cur) => cur.map((l) => (l.id === lead.id ? { ...l, status: newStatus, statusUpdatedAt: new Date().toISOString() } : l)));
      setPendingStatus((p) => { const c = { ...p }; delete c[lead.id]; return c; });
      setSavedFlash((s) => ({ ...s, [lead.id]: { sms: !!d.smsSent, email: !!d.emailSent } }));
      setTimeout(() => setSavedFlash((s) => ({ ...s, [lead.id]: null })), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  // Token gate. proxy.ts now bounces unauthorized users to Google sign-in
  // before this page even renders. The form below stays as a fallback for
  // direct-token entry (env-disaster recovery): if Google OAuth is broken
  // or the email isn't allowlisted, the operator can still get in with
  // the legacy ADMIN_TOKEN by appending ?token=... to the URL.
  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white px-4">
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6">
          <h1 className="text-xl font-bold mb-1">TCC Staff Ops</h1>
          <p className="text-[#dcdcdc] text-sm mb-5">Sign in with your Google account to continue.</p>
          <a
            href={`/api/auth/google?returnTo=${encodeURIComponent("/admin")}`}
            className="w-full inline-flex items-center justify-center gap-2 bg-white text-[#1a1a1a] py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#f0f0f0] transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </a>
          {error && <p className="text-[#ef5350] text-xs mt-3 text-center">{error}</p>}
          <details className="mt-5 text-[11px] text-[#888]">
            <summary className="cursor-pointer hover:text-[#bbb]">Admin recovery (token)</summary>
            <form onSubmit={handleLogin} className="mt-3">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="admin token"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white placeholder:text-[#666] focus:outline-none focus:border-[#00c853] transition mb-2"
              />
              <button type="submit" className="w-full bg-white/10 text-white py-2 rounded text-xs font-semibold cursor-pointer hover:bg-white/20 transition">
                Use legacy token
              </button>
            </form>
          </details>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Extra bottom padding when the fixed bulk-action bar is on screen,
          otherwise the last lead in the list gets hidden under it and can't
          be scrolled into view. Bar wraps onto 2 rows on narrow screens,
          so mobile needs a deeper buffer than desktop. */}
      <div className={`max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 ${selectedIds.size > 0 ? "pb-40 sm:pb-28" : ""}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 sm:mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">TCC Staff Ops</h1>
            <p className="text-[#dcdcdc] text-sm">
              {(() => {
                const statusFiltered = filteredLeads.filter((l) => {
                  if (statusFilter === "all") return true;
                  if (statusFilter === "active") return !isPaid(l.status) && l.status !== "rejected";
                  if (statusFilter === "completed") return isPaid(l.status) || l.status === "rejected";
                  if (statusFilter === "stale") return isStale(l);
                  return l.status === statusFilter;
                });
                if (statusFilter === "all" && !searchQuery) {
                  const dupeNote = leads.length !== dedupedLeads.length ? ` (${leads.length - dedupedLeads.length} dupes merged)` : "";
                  return `${dedupedLeads.length} unique lead${dedupedLeads.length === 1 ? "" : "s"}${dupeNote}`;
                }
                const labels: Record<string, string> = { active: "active", completed: "completed", all: "all" };
                const label = labels[statusFilter] || statusFilter.replace("_", " ");
                return `${statusFiltered.length} of ${dedupedLeads.length} · ${label}${searchQuery ? ` · matching "${searchQuery}"` : ""}`;
              })()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            {/* Secondary nav + tools moved into the Menu ▾ dropdown below to
                declutter the header — only the workflow toggle, Live, and
                Refresh stay visible. Skywalker 2026-05-28. */}
            {/* Google user chip — only renders when /api/auth/me returned
                an authenticated admin. Click signs out + redirects to
                Google login on next nav. */}
            {googleUser && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-1 pr-3 py-1">
                {googleUser.picture ? (
                  <img src={googleUser.picture} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-[#00c853]/20 text-[#00c853] flex items-center justify-center text-xs font-bold">{(googleUser.name || googleUser.email).charAt(0).toUpperCase()}</span>
                )}
                <span className="text-xs text-white font-semibold max-w-[140px] truncate" title={googleUser.email}>{googleUser.name?.split(" ")[0] || googleUser.email}</span>
                <button
                  onClick={async () => {
                    await fetch("/api/auth/signout", { method: "POST" });
                    localStorage.removeItem("tcc-admin-token");
                    window.location.href = "/admin";
                  }}
                  title="Sign out"
                  className="text-[#888] hover:text-[#ff5566] text-xs font-semibold cursor-pointer transition ml-1"
                >Sign out</button>
              </div>
            )}
            {/* Site theme switch. Indigo glass is now the LIVE default for
                everyone (set pre-paint in layout.tsx). This control stays
                backend-only — it flips data-theme + localStorage for THIS
                browser, so staff can flip to the full-dark fallback to
                compare. Public visitors don't see this switch; they just
                land on indigo. Skywalker 2026-05-29: indigo went live. */}
            <div
              className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full pl-3 pr-0.5 py-0.5"
              title="Switch this browser between indigo glass (live default) and full dark"
            >
              <span className="text-[11px] text-[#9aa0a6] font-semibold whitespace-nowrap">
                Indigo <span className="text-[#00c853]">live</span>
              </span>
              <ThemeToggle />
            </div>
            {/* Active / Needs review / Trash toggle. Needs review is a
                client-side filter on the active list — surfaces leads
                with AI flags, "pass" recommendations, stale status,
                or missing photos. Skywalker 2026-05-17 / 2026-05-19. */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden text-xs font-semibold">
              <button
                onClick={() => { if (view !== "active") { setLeads([]); setView("active"); } }}
                className={`px-3 py-2 transition cursor-pointer ${view === "active" ? "bg-[#00c853]/15 text-[#00c853]" : "text-[#dcdcdc] hover:bg-white/10"}`}
                title="Show active leads"
              >Active</button>
              <button
                onClick={() => { if (view !== "needs-review") { setLeads([]); setView("needs-review"); } }}
                className={`px-3 py-2 transition cursor-pointer border-l border-white/10 flex items-center gap-1.5 ${view === "needs-review" ? "bg-red-500/15 text-red-300" : "text-[#dcdcdc] hover:bg-white/10"}`}
                title="Leads needing staff review — AI flagged, stale, missing photos, or Theot recommended pass"
              >
                🚨 Needs review
                {view !== "needs-review" && needsReviewLeads.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500/30 text-red-100 text-[10px] font-bold">{needsReviewLeads.length}</span>
                )}
              </button>
              <button
                onClick={() => { if (view !== "trash") { setLeads([]); setView("trash"); } }}
                className={`px-3 py-2 transition cursor-pointer border-l border-white/10 ${view === "trash" ? "bg-amber-500/15 text-amber-300" : "text-[#dcdcdc] hover:bg-white/10"}`}
                title="Show trashed leads — active leads stay indefinitely; finished leads (paid/met/rejected) auto-purge after 24h"
              >🗑 Trash</button>
            </div>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              title={autoRefresh ? "Auto-refresh ON (every 5s)" : "Auto-refresh OFF"}
              className={`px-2.5 sm:px-3 py-2 border rounded-lg text-xs font-semibold transition cursor-pointer ${autoRefresh ? "bg-[#00c853]/15 border-[#00c853]/40 text-[#00c853]" : "bg-white/5 border-white/10 text-[#dcdcdc] hover:bg-white/10"}`}
            >
              {autoRefresh ? "🟢" : "⏸"}<span className="hidden sm:inline ml-1">{autoRefresh ? "Live" : "Paused"}</span>
            </button>
            <button onClick={fetchLeads} disabled={loading} className="px-2.5 sm:px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs sm:text-sm hover:bg-white/10 transition disabled:opacity-50 cursor-pointer">
              {loading ? "…" : <>↻<span className="hidden sm:inline ml-1">Refresh</span></>}
            </button>
            {/* Menu ▾ — all secondary nav + tools live here so the header
                stays calm. Pages / Tools / Account, click-away to close. */}
            <div className="relative">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                className="px-2.5 sm:px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs sm:text-sm hover:bg-white/10 transition cursor-pointer"
              >
                ☰<span className="hidden sm:inline ml-1">Menu</span>
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  {/* Mobile: a viewport-anchored sheet (left-3/right-3) so it
                      can't overflow off-screen when the button wraps to the
                      left of a narrow row — that was the "menu doesn't work on
                      mobile" bug. Desktop: an attached right-aligned dropdown. */}
                  <div className="fixed top-16 left-3 right-3 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-2 sm:w-60 bg-[#0f0f0f] border border-white/15 rounded-xl shadow-2xl shadow-black/60 z-50 py-2 text-sm" role="menu">
                    <p className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-[#666] font-bold">Pages</p>
                    <a href="/admin/prices" className="block px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer">💲 Prices</a>
                    <a href="/admin/analytics" className="block px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer">📊 Analytics</a>
                    <a href="/admin/profit" className="block px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer">💰 Profit</a>
                    <a href="/admin/customers" className="block px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer">👥 Customers</a>
                    <a href="/admin/saved-quotes" className="block px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer">💾 Saved Quotes</a>
                    <a href="/admin/referrals" className="block px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer">🎁 Referrals</a>
                    <a href="/admin/newsletter" className="block px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer">📬 Newsletter</a>
                    <a href="/admin/slots" className="block px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer">🗓️ Slots</a>
                    <div className="border-t border-white/10 my-1.5" />
                    <p className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-[#666] font-bold">Tools</p>
                    <button
                      onClick={() => {
                        const exportView = displayedLeads.filter((l) => {
                          if (statusFilter === "all") return true;
                          if (statusFilter === "active") return !isPaid(l.status) && l.status !== "rejected";
                          if (statusFilter === "completed") return isPaid(l.status) || l.status === "rejected";
                          if (statusFilter === "stale") return isStale(l);
                          return l.status === statusFilter;
                        });
                        exportFilteredCsv(exportView);
                        setMoreOpen(false);
                      }}
                      disabled={displayedLeads.length === 0}
                      className="block w-full text-left px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer disabled:opacity-40"
                    >
                      📥 Export CSV (current view)
                    </button>
                    <button
                      onClick={() => {
                        const next = !showInternal;
                        setShowInternal(next);
                        try { localStorage.setItem("tcc-show-internal", next ? "1" : "0"); } catch {}
                        setMoreOpen(false);
                      }}
                      className="block w-full text-left px-3 py-1.5 text-[#dcdcdc] hover:bg-white/10 hover:text-white transition cursor-pointer"
                    >
                      {showInternal ? "🔓 Internal leads: ON" : `🔒 Internal leads: hidden${internalHidden ? ` (${internalHidden})` : ""}`}
                    </button>
                    <div className="border-t border-white/10 my-1.5" />
                    <button onClick={handleLogout} className="block w-full text-left px-3 py-1.5 text-red-300 hover:bg-red-500/10 transition cursor-pointer">
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* NEEDS-ATTENTION BANNER — surfaces the top stale leads at the
            top of the page so they don't get lost in the feed. Renders
            only when at least one lead is over its SLA target. Each row
            is clickable: clicking the banner header filters the list to
            stale only; clicking a row jumps to that lead. */}
        {staleCount > 0 && view === "active" && (() => {
          // Compact priority strip (was a 5-row gradient box that dominated
          // the page). One thin line: count + the top 3 names with hours,
          // click to filter the list to stale only. Calmer, still urgent.
          const top = dedupedLeads
            .filter(isStale)
            .sort((a, b) => {
              const sa = stalenessFor(a) === "red" ? 0 : 1;
              const sb = stalenessFor(b) === "red" ? 0 : 1;
              if (sa !== sb) return sa - sb;
              const la = new Date(a.statusUpdatedAt || a.timestamp).getTime();
              const lb = new Date(b.statusUpdatedAt || b.timestamp).getTime();
              return la - lb;
            })
            .slice(0, 3);
          const redCount = dedupedLeads.filter((l) => stalenessFor(l) === "red").length;
          return (
            <button
              type="button"
              onClick={() => setStatusFilter("stale")}
              title="Filter the list to stale leads only"
              className="w-full mb-3 px-4 py-2.5 flex items-center gap-3 text-left bg-white/[0.03] hover:bg-white/[0.05] border-l-2 border-red-500/60 rounded-lg transition cursor-pointer"
            >
              <span className="text-sm shrink-0">{redCount > 0 ? "🔴" : "🟡"}</span>
              <span className="font-bold text-white text-sm shrink-0">{staleCount} need{staleCount === 1 ? "s" : ""} attention</span>
              <span className="text-xs text-[#bdbdbd] truncate min-w-0">
                {top.map((l) => {
                  const hrs = Math.floor((Date.now() - new Date(l.statusUpdatedAt || l.timestamp).getTime()) / 3600000);
                  return `${(l.name || l.email || l.phone || "—").split(" ")[0]} ${hrs}h`;
                }).join(" · ")}
                {staleCount > 3 ? ` +${staleCount - 3} more` : ""}
              </span>
              <span className="ml-auto text-xs text-[#00c853] font-semibold shrink-0 hidden sm:inline">View queue →</span>
            </button>
          );
        })()}

        {leads.length > 0 && (
          // Command-center KPI row — money + live work queue. The three
          // queue tiles (Open / Awaiting receipt / Needs attention) are
          // buttons that filter the list, so a metric leads straight to
          // the action. Glow is reserved for money + a non-zero alert.
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3 mb-4">
            <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl p-3 col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-[#00c853] font-bold" title="Cash TCC paid customers for devices (COGS / cash-out), not resale revenue — that's on /admin/profit.">💸 Paid out · this week</p>
              <p className="text-xl sm:text-2xl font-extrabold text-[#00c853] mt-0.5">${stats.revenueWeek.toLocaleString()}</p>
              <p className="text-[10px] text-[#dcdcdc] mt-0.5">${stats.revenueMonth.toLocaleString()} this month · ${stats.revenue.toLocaleString()} all-time · <a href="/admin/profit" className="underline hover:text-white">sales →</a></p>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              title="Open leads not yet paid/met/rejected — your work queue. Click to filter."
              className="text-left bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition cursor-pointer"
            >
              <p className="text-[10px] uppercase tracking-wider text-[#c5c5c5] font-bold">Open leads</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">{stats.pendingCount}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("shipped")}
              title="Devices shipped / dropping off — awaiting receipt. Click to filter."
              className="text-left bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition cursor-pointer"
            >
              <p className="text-[10px] uppercase tracking-wider text-[#c5c5c5] font-bold">Awaiting receipt</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">{stats.shippedCount}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("stale")}
              title="Leads past their SLA — needs attention. Click to filter."
              className={`text-left rounded-xl p-3 transition cursor-pointer border ${staleCount > 0 ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
            >
              <p className={`text-[10px] uppercase tracking-wider font-bold ${staleCount > 0 ? "text-amber-300" : "text-[#c5c5c5]"}`}>Needs attention</p>
              <p className={`text-2xl font-extrabold mt-0.5 ${staleCount > 0 ? "text-amber-300" : "text-white"}`}>{staleCount}</p>
            </button>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#c5c5c5] font-bold">Conversion</p>
              <p className="text-2xl font-extrabold text-[#00c853] mt-0.5">{stats.conversionRate}%</p>
              <p className="text-[10px] text-[#c5c5c5] mt-0.5">avg payout {stats.avgPayoutHours > 0 ? (stats.avgPayoutHours < 48 ? `${Math.round(stats.avgPayoutHours)}h` : `${(stats.avgPayoutHours / 24).toFixed(1)}d`) : "—"} · avg ${stats.avgQuote}</p>
            </div>
          </div>
        )}

        {leads.length > 0 && (
          <div className="relative mb-3">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#c5c5c5]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" /></svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, email, device, IMEI…"
              className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853] focus:ring-2 focus:ring-[#00c853]/20 transition"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 text-[#d4d4d4] text-xs hover:bg-white/20 cursor-pointer">×</button>
            )}
          </div>
        )}

        {error && <div className="bg-[#ef5350]/10 border border-[#ef5350]/30 rounded-xl p-4 mb-4 text-sm text-[#ef5350]">{error}</div>}

        {leads.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {(() => {
              // Bug fix 2026-05-19: previous version omitted "met" so
              // local-meetup customers vanished from both the Active
              // and Completed counts after their status flipped.
              const isCompleted = (s: string) => s === "paid" || s === "met" || s === "rejected";
              const counts: Record<string, number> = {
                all: filteredLeads.length,
                active: filteredLeads.filter((l) => !isCompleted(l.status)).length,
                completed: filteredLeads.filter((l) => isCompleted(l.status)).length,
                stale: filteredLeads.filter(isStale).length,
              };
              for (const l of filteredLeads) counts[l.status] = (counts[l.status] || 0) + 1;
              const chip = (value: string, label: string, color?: string) => {
                const active = statusFilter === value;
                const count = counts[value] || 0;
                // Always keep the navigation pillars visible so staff
                // can find paid/shipped/completed leads even when the
                // count is currently 0. Skywalker 2026-05-19: after
                // marking a lead paid he couldn't find it because the
                // chips for those filters disappear when empty.
                const ALWAYS_SHOW = new Set(["all", "active", "completed", "paid", "shipped"]);
                if (!ALWAYS_SHOW.has(value) && count === 0) return null;
                return (
                  <button
                    key={value}
                    onClick={() => setStatusFilter(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? "bg-[#00c853] text-[#0a0a0a] border-[#00c853]"
                        : "bg-white/5 text-[#d4d4d4] border-white/10 hover:bg-white/10"
                    }`}
                    style={active && value !== "all" && value !== "active" && color ? { backgroundColor: color, borderColor: color } : undefined}
                  >
                    <span>{label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-white/20" : "bg-white/10"}`}>{count}</span>
                  </button>
                );
              };
              return (
                <>
                  {chip("active", "🟢 Active")}
                  {staleCount > 0 && chip("stale", "⚠️ Needs attention")}
                  {STATUS_OPTIONS.filter((o) => o.value !== "paid" && o.value !== "rejected").map((opt) => chip(opt.value, opt.label, opt.color))}
                  <span className="w-px bg-white/10 self-stretch mx-1" aria-hidden />
                  {chip("completed", "✅ Completed")}
                  {chip("paid", "💵 Paid", "#00c853")}
                  {chip("rejected", "❌ Rejected", "#ef5350")}
                  <span className="w-px bg-white/10 self-stretch mx-1" aria-hidden />
                  {chip("all", "All")}
                </>
              );
            })()}
          </div>
        )}

        {leads.length === 0 && loading && !error && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-[#00c853]/80 rounded-full animate-spin" aria-hidden></div>
            <p className="text-[#dcdcdc] mt-3 text-sm">Loading {view} leads…</p>
          </div>
        )}

        {leads.length === 0 && !loading && !error && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-[#dcdcdc]">{view === "trash" ? "Trash is empty." : "No leads yet."}</p>
          </div>
        )}
        {leads.length > 0 && view === "needs-review" && needsReviewLeads.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-2xl mb-2">✨</p>
            <p className="text-[#00c853] font-bold mb-1">All caught up</p>
            <p className="text-[#bdbdbd] text-sm">No leads currently need staff review — every active lead has photos, fresh status, and a clean AI verdict.</p>
          </div>
        )}

        {leads.length > 0 && !(view === "needs-review" && needsReviewLeads.length === 0) && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[auto_1fr_1.4fr_1.6fr_1.4fr_auto] gap-4 px-5 py-3 bg-white/5 text-xs font-semibold text-[#dcdcdc] uppercase tracking-wider border-b border-white/10 items-center">
              <div className="w-4">
                <input
                  type="checkbox"
                  aria-label="Select all visible"
                  checked={(() => {
                    const visible = displayedLeads.filter((l) => {
                      if (statusFilter === "all") return true;
                      if (statusFilter === "active") return !isPaid(l.status) && l.status !== "rejected";
                      if (statusFilter === "completed") return isPaid(l.status) || l.status === "rejected";
                      if (statusFilter === "stale") return isStale(l);
                      return l.status === statusFilter;
                    });
                    return visible.length > 0 && visible.every((l) => selectedIds.has(l.id));
                  })()}
                  onChange={(e) => {
                    const visible = displayedLeads.filter((l) => {
                      if (statusFilter === "all") return true;
                      if (statusFilter === "active") return !isPaid(l.status) && l.status !== "rejected";
                      if (statusFilter === "completed") return isPaid(l.status) || l.status === "rejected";
                      if (statusFilter === "stale") return isStale(l);
                      return l.status === statusFilter;
                    });
                    if (e.target.checked) setSelectedIds(new Set(visible.map((l) => l.id)));
                    else setSelectedIds(new Set());
                  }}
                  className="cursor-pointer accent-[#00c853]"
                />
              </div>
              <div>Customer</div>
              <div>Contact</div>
              <div>Device</div>
              <div>Quote · Payout</div>
              <div>Status</div>
            </div>
            <ul className="divide-y divide-white/5">
              {displayedLeads.filter((l) => {
                if (statusFilter === "all") return true;
                if (statusFilter === "active") return !isPaid(l.status) && l.status !== "rejected";
                if (statusFilter === "completed") return isPaid(l.status) || l.status === "rejected";
                if (statusFilter === "stale") return isStale(l);
                return l.status === statusFilter;
              }).map((lead) => {
                const current = pendingStatus[lead.id] ?? lead.status;
                const meta = statusMeta(current);
                return (
                  <li
                    key={lead.id}
                    data-lead-id={lead.id}
                    /* Color-code the row's left edge by handoff method so
                       the operator can scan ship-pending vs local-pending
                       at a glance without reading each row. Sky-blue for
                       shipping, emerald for local; no border for unknown.
                       Skywalker 2026-05-23. */
                    style={
                      lead.handoffMethod === "ship"
                        ? { borderLeft: "3px solid rgba(56, 189, 248, 0.7)" }
                        : lead.handoffMethod === "local"
                          ? { borderLeft: "3px solid rgba(16, 185, 129, 0.7)" }
                          : undefined
                    }
                    className={`pl-5 pr-5 py-4 grid md:grid-cols-[auto_1fr_1.4fr_1.6fr_1.4fr_auto] gap-4 items-center hover:bg-white/[0.02] transition ${selectedIds.has(lead.id) ? "bg-[#00c853]/5" : ""} ${recentlyChanged[lead.id] ? "animate-[pulse_2s_ease-out_2] ring-1 ring-[#00c853]/40" : ""}`}
                  >
                    <div className="w-4">
                      <input type="checkbox" aria-label={`Select ${lead.name || lead.id}`} checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="cursor-pointer accent-[#00c853]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setDetailLead(lead)}
                          title="Open full detail"
                          className="text-left hover:text-[#00c853] hover:underline cursor-pointer"
                        >
                          {lead.name || "—"}
                        </button>
                        {(() => {
                          const stale = stalenessFor(lead);
                          if (stale === "ok") return null;
                          const isRed = stale === "red";
                          const sla = SLA_HOURS[lead.status];
                          const last = new Date(lead.statusUpdatedAt || lead.timestamp).getTime();
                          const hrs = Math.floor((Date.now() - last) / 3600000);
                          return (
                            <span
                              title={`In "${lead.status}" for ${hrs}h — target ${sla.target}h, alert ${sla.alert}h`}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-help border ${isRed ? "bg-red-500/15 text-red-300 border-red-500/40" : "bg-yellow-500/15 text-yellow-300 border-yellow-500/40"}`}
                            >{isRed ? "🔴" : "🟡"} {hrs}h</span>
                          );
                        })()}
                        {lead.duplicateCount && lead.duplicateCount > 0 && (
                          <span title={`${lead.duplicateCount} earlier submission${lead.duplicateCount === 1 ? "" : "s"} merged into this row`} className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-[#dcdcdc] border border-white/10 font-bold cursor-help">+{lead.duplicateCount} dupe{lead.duplicateCount === 1 ? "" : "s"}</span>
                        )}
                      </p>
                      <p className="text-[#c5c5c5] text-xs">{timeAgo(lead.timestamp)}</p>
                    </div>
                    <div className="text-xs text-[#d4d4d4] space-y-0.5">
                      {lead.phone && (
                        <p className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setHistoryKey({ kind: "phone", value: lead.phone! })}
                            title="See all leads from this phone"
                            className="hover:text-[#00c853] hover:underline cursor-pointer"
                          >
                            {lead.phone}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (smsOpenId === lead.id) {
                                setSmsOpenId(null);
                              } else {
                                setSmsOpenId(lead.id);
                                if (!smsThreads[lead.id]) loadSmsThread(lead);
                              }
                            }}
                            className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[#d4d4d4] hover:bg-white/10 cursor-pointer transition"
                          >
                            💬 {smsOpenId === lead.id ? "Hide" : "SMS"}
                          </button>
                        </p>
                      )}
                      {lead.email && (
                        <button
                          type="button"
                          onClick={() => setHistoryKey({ kind: "email", value: lead.email! })}
                          title="See all leads from this email"
                          className="block text-[#dcdcdc] truncate hover:text-[#00c853] hover:underline cursor-pointer text-left"
                        >
                          {lead.email}
                        </button>
                      )}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium flex items-center gap-2 flex-wrap">
                        {lead.model || lead.device || "—"}
                        {lead.imeiWarnings && lead.imeiWarnings.length > 0 && (
                          <span title={lead.imeiWarnings.join(" · ")} className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 font-bold cursor-help">⚠️ IMEI</span>
                        )}
                      </p>
                      <p className="text-[#c5c5c5] text-xs">
                        {[lead.storage, lead.condition, lead.carrier].filter(Boolean).join(" · ")}
                        {lead.imei && <span className="ml-1 text-[#d4d4d4] font-mono">· {lead.imei.slice(-6)}</span>}
                      </p>
                      {/* Multi-device breakdown — when one lead bundles
                          N items, show each unit so staff can quote
                          per device. Skywalker 2026-05-17: was just
                          seeing "Multi-device (3)" with no detail. */}
                      {lead.devices && lead.devices.length > 0 && (
                        <div className="mt-1.5 bg-[#00c853]/[0.06] border border-[#00c853]/25 rounded-md p-2 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#00c853]">
                            {lead.deviceCount || lead.devices.length} devices{lead.totalPayout ? ` · total $${lead.totalPayout}` : ""}
                          </p>
                          {lead.devices.map((d, i) => {
                            const hasSpecs = d.processor || d.memory || d.graphics || d.displayResolution || d.displayGlass || d.batteryHealth || d.charger || d.carrier || d.connectivity || d.imei || (d.extras && d.extras.length > 0);
                            return (
                              <div key={i} className="border-t border-[#00c853]/15 first:border-t-0 pt-1.5 first:pt-0">
                                <div className="text-[11px] text-[#e5e5e5] flex flex-wrap items-center gap-x-2">
                                  <span className="text-[#8a8a8a] font-mono">{i + 1}.</span>
                                  <span className="font-semibold text-white">{d.model}</span>
                                  {d.storage && <span className="text-[#c5c5c5]">· {d.storage}</span>}
                                  {d.condition && <span className="text-[#c5c5c5]">· {d.condition}</span>}
                                  {d.quote != null && (d.quote > 0
                                    ? <span className="text-[#00c853] font-bold">· ${d.quote}</span>
                                    : <span className="text-amber-300 font-bold">· Manual review</span>)}
                                  {d.quantity && d.quantity > 1 && <span className="text-[#c5c5c5]">×{d.quantity}</span>}
                                  {d.photos && d.photos.length > 0 && (
                                    <span className="ml-1 flex gap-1">
                                      {d.photos.slice(0, 3).map((url, j) => (
                                        <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="block w-5 h-5 rounded overflow-hidden border border-white/10 hover:border-[#00c853] transition" title={`Device ${i + 1} photo ${j + 1}`}>
                                          <img src={url} alt="" className="w-full h-full object-cover" />
                                        </a>
                                      ))}
                                    </span>
                                  )}
                                </div>
                                {hasSpecs && (
                                  <div className="mt-1 ml-4 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px]">
                                    {d.processor         && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Chip:</span> <span className="text-white font-medium">{d.processor}</span></p>}
                                    {d.memory            && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">RAM:</span> <span className="text-white font-medium">{d.memory}</span></p>}
                                    {d.graphics          && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">GPU:</span> <span className="text-white font-medium">{d.graphics}</span></p>}
                                    {d.displayResolution && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Display:</span> <span className="text-white font-medium">{d.displayResolution}</span></p>}
                                    {d.displayGlass      && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Glass:</span> <span className="text-white font-medium">{d.displayGlass}</span></p>}
                                    {d.batteryHealth     && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Battery:</span> <span className={`font-medium ${/poor/i.test(d.batteryHealth) ? "text-yellow-300" : "text-white"}`}>{d.batteryHealth}</span></p>}
                                    {d.charger           && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Charger:</span> <span className="text-white font-medium">{d.charger}</span></p>}
                                    {d.carrier           && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Carrier:</span> <span className="text-white font-medium">{d.carrier}</span></p>}
                                    {d.connectivity      && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Connectivity:</span> <span className="text-white font-medium">{d.connectivity}</span></p>}
                                    {d.imei              && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">IMEI:</span> <span className="text-white font-medium font-mono">…{d.imei.slice(-6)}</span></p>}
                                    {d.extras && d.extras.length > 0 && <p className="text-[#c5c5c5] sm:col-span-2"><span className="text-[#8a8a8a]">Extras:</span> <span className="text-white font-medium">{d.extras.join(", ")}</span></p>}
                                  </div>
                                )}
                                {(d.brokenGlass || d.brokenFunctional === false || d.paidOff === false) && (
                                  <div className="ml-4 mt-1 flex flex-wrap gap-1">
                                    {d.brokenGlass === "front" && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/15 text-orange-200 border border-orange-500/30">FRONT GLASS</span>}
                                    {d.brokenGlass === "back" && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-500/15 text-yellow-200 border border-yellow-500/30">BACK GLASS</span>}
                                    {d.brokenGlass === "both" && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-200 border border-red-500/30">BOTH GLASS</span>}
                                    {d.brokenFunctional === false && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-100 border border-red-500/40">⚠️ NOT FUNCTIONAL</span>}
                                    {d.paidOff === false && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-100 border border-amber-500/40">⚠️ BALANCE OWED</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Best-contact badge + customer note — Skywalker
                          2026-05-18 "make sure im getting every detail …
                          best contact". Badge sits above the spec block so
                          staff sees how to reach the seller before the
                          deep-dive specs. */}
                      {(lead.bestContact || lead.customerNote || (lead.quantity && lead.quantity > 1) || lead.smsOptIn === false || lead.staleHours || lead.source || lead.priorLeads || lead.commsSent || lead.payoutConfirmation || lead.couponApplied || lead.ai || lead.itemsEditedAt || lead.recycleOnly) && (
                        <div className="mt-1.5 flex flex-wrap items-start gap-1.5">
                          {/* Recycle-only chip — Skywalker 2026-05-22.
                              Surfaces when the customer opted into free
                              responsible recycling on the quote step
                              (no payout, no FedEx label). Green so it
                              reads as a positive opt-in, not a problem. */}
                          {lead.recycleOnly && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#00c853]/15 text-[#00c853] border border-[#00c853]/40"
                              title="Customer opted into free responsible recycling — no payout, e-waste certificate emailed at submit"
                            >
                              ♻ Recycle-only
                            </span>
                          )}
                          {/* AI verdict pills — photo-check (FLAG) and
                              Theot's channel-rec (SUMMARY) now render
                              side-by-side instead of one hiding the
                              other. Red for FLAG (alert), indigo for
                              SUMMARY (actionable rec), gray for NOTE
                              (only when nothing better surfaced).
                              Skywalker 2026-05-19. */}
                          {lead.ai?.flag && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-200 border border-red-500/45"
                              title={`${lead.ai.flag.body}\n\n${new Date(lead.ai.flag.at).toLocaleString()}${lead.ai.flag.fromName ? `\n— ${lead.ai.flag.fromName}` : ""}`}
                            >
                              🚩 AI Flag · {lead.ai.flag.body.slice(0, 50)}{lead.ai.flag.body.length > 50 ? "…" : ""}
                            </span>
                          )}
                          {lead.ai?.summary && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-200 border border-indigo-500/40"
                              title={`${lead.ai.summary.body}\n\n${new Date(lead.ai.summary.at).toLocaleString()}${lead.ai.summary.fromName ? `\n— ${lead.ai.summary.fromName}` : ""}`}
                            >
                              🤖 {lead.ai.summary.fromName === "Theot" ? "Theot" : "AI"} · {lead.ai.summary.body.slice(0, 60)}{lead.ai.summary.body.length > 60 ? "…" : ""}
                            </span>
                          )}
                          {lead.ai?.note && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/[0.06] text-[#dcdcdc] border border-white/15"
                              title={`${lead.ai.note.body}\n\n${new Date(lead.ai.note.at).toLocaleString()}${lead.ai.note.fromName ? `\n— ${lead.ai.note.fromName}` : ""}`}
                            >
                              🤖 AI · {lead.ai.note.body.slice(0, 50)}{lead.ai.note.body.length > 50 ? "…" : ""}
                            </span>
                          )}
                          {/* Returning-customer pill — Skywalker 2026-05-18.
                              Surfaces priorLeads + lifetime $ so staff knows
                              they're talking to a repeat seller. */}
                          {lead.priorLeads && lead.priorLeads > 0 && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/40 uppercase tracking-wider"
                              title={`${lead.priorLeads} prior trade${lead.priorLeads === 1 ? "" : "s"} from this customer${lead.lifetimeSpend ? `, $${lead.lifetimeSpend.toLocaleString()} paid out previously` : ""}`}
                            >
                              🔁 Returning · {lead.priorLeads} prior{lead.lifetimeSpend ? ` · $${lead.lifetimeSpend.toLocaleString()}` : ""}
                            </span>
                          )}
                          {/* Coupon-applied pill — customer redeemed a
                              review-reward code on this trade. Quote
                              has been auto-bumped by the bonus value. */}
                          {lead.couponApplied && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ffb400]/15 text-[#ffd54f] border border-[#ffb400]/45 uppercase tracking-wider"
                              title={`Customer redeemed ${lead.couponApplied.code} for a $${lead.couponApplied.value} thank-you bonus on this trade`}
                            >
                              🎁 Coupon · {lead.couponApplied.code} · +${lead.couponApplied.value}
                            </span>
                          )}
                          {/* Payout confirmation pill — set when status is
                              paid/met and staff captured the method+ref+amount. */}
                          {lead.payoutConfirmation && (lead.payoutConfirmation.method || lead.payoutConfirmation.reference || typeof lead.payoutConfirmation.amount === "number") && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-200 border border-emerald-500/40 uppercase tracking-wider"
                              title={`Paid${typeof lead.payoutConfirmation.amount === "number" ? ` $${lead.payoutConfirmation.amount}` : ""} via ${lead.payoutConfirmation.method || "?"}${lead.payoutConfirmation.reference ? ` · ${lead.payoutConfirmation.reference}` : ""}${lead.payoutConfirmation.note ? ` · ${lead.payoutConfirmation.note}` : ""} · ${new Date(lead.payoutConfirmation.at).toLocaleString()}`}
                            >
                              ✓ Paid{typeof lead.payoutConfirmation.amount === "number" ? ` $${lead.payoutConfirmation.amount}` : ""} · {lead.payoutConfirmation.method || "?"}{lead.payoutConfirmation.reference ? ` · ${lead.payoutConfirmation.reference.slice(0, 18)}` : ""}
                            </span>
                          )}
                          {/* Resale pill — pulled from /api/admin/sales,
                              joined by leadId. Shows the actual sold-price
                              + profit when a sales-ledger row exists for
                              this lead. Cyan tone so it's distinct from
                              the green ✓ Paid (which is the cost side). */}
                          {salesByLead[lead.id] && (
                            <a
                              href="/admin/profit"
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 uppercase tracking-wider hover:bg-cyan-500/25 cursor-pointer no-underline"
                              title={`Sold $${salesByLead[lead.id].soldPrice} on ${salesByLead[lead.id].platform} on ${salesByLead[lead.id].saleDate} · cost $${salesByLead[lead.id].cost} · profit $${salesByLead[lead.id].profit}. Click to open the profit ledger.`}
                            >
                              {salesByLead[lead.id].soldPrice > 0
                                ? <>💸 Sold ${salesByLead[lead.id].soldPrice} · {salesByLead[lead.id].profit >= 0 ? "+" : ""}${salesByLead[lead.id].profit}</>
                                : <>📥 Buy logged · waiting on sale</>}
                            </a>
                          )}
                          {/* Comms-sent count — Skywalker 2026-05-18 audit
                              trail. Shows how many touches we've already had
                              with the customer + when the most recent one
                              went out. */}
                          {lead.commsSent && (lead.commsSent.sms + lead.commsSent.email > 0) && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/[0.06] text-[#dcdcdc] border border-white/15 uppercase tracking-wider"
                              title={`${lead.commsSent.sms} SMS · ${lead.commsSent.email} emails sent${lead.commsSent.lastAt ? ` · last ${new Date(lead.commsSent.lastAt).toLocaleString()}` : ""}`}
                            >
                              {lead.commsSent.sms > 0 && `💬 ${lead.commsSent.sms}`}
                              {lead.commsSent.sms > 0 && lead.commsSent.email > 0 && " · "}
                              {lead.commsSent.email > 0 && `✉️ ${lead.commsSent.email}`}
                            </span>
                          )}
                          {lead.bestContact && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00c853]/15 text-[#7be8a8] border border-[#00c853]/35 uppercase tracking-wider">
                              {lead.bestContact === "text" ? "💬 Prefers TEXT" : lead.bestContact === "call" ? "📞 Prefers CALL" : "✉️ Prefers EMAIL"}
                            </span>
                          )}
                          {lead.quantity && lead.quantity > 1 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-200 border border-sky-500/35 uppercase tracking-wider">
                              ×{lead.quantity} units
                            </span>
                          )}
                          {/* SMS opt-in NO is the actionable case — staff
                              should NOT text this customer. Don't render a
                              badge for YES (it's the default + happy path). */}
                          {lead.smsOptIn === false && lead.phone && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-200 border border-red-500/40 uppercase tracking-wider" title="Customer did not opt in to SMS — do NOT text them">
                              🚫 NO SMS
                            </span>
                          )}
                          {/* Stale-lead alert — non-terminal lead older than
                              7 days since last status update. Skywalker
                              2026-05-18 — pings forgotten leads. */}
                          {lead.staleHours && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-100 border border-amber-500/45 uppercase tracking-wider" title={`No status update in ${lead.staleHours} hours`}>
                              ⏰ Stale · {lead.staleHours >= 24 ? `${Math.floor(lead.staleHours / 24)}d` : `${lead.staleHours}h`}
                            </span>
                          )}
                          {/* Customer edited their device(s) post-submission
                              via the offer page. Specs/quote/total shown
                              reflect the edit. Skywalker 2026-05-20. */}
                          {lead.itemsEditedAt && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                lead.itemsNeedReview
                                  ? "bg-amber-500/15 text-amber-100 border border-amber-500/45"
                                  : "bg-[#00c853]/15 text-[#7be8a8] border border-[#00c853]/40"
                              }`}
                              title={lead.itemsNeedReview
                                ? `Customer edited a device to BROKEN on ${new Date(lead.itemsEditedAt).toLocaleString()} — broken devices can't be auto-quoted. Re-quote this lead by hand.`
                                : `Customer edited their device(s) on ${new Date(lead.itemsEditedAt).toLocaleString()} — the specs, quote, and total shown reflect the edit. Verify at inspection.`}
                            >
                              {lead.itemsNeedReview ? "⚠️ Edited — needs re-quote" : "Customer edited"}
                            </span>
                          )}
                          {/* Source attribution — show the top channel
                              compactly. Full breakdown lives in title hover. */}
                          {lead.source && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/15 text-violet-200 border border-violet-500/35 uppercase tracking-wider"
                              title={lead.source.raw}
                            >
                              📍 {lead.source.source || lead.source.referrer || "direct"}
                              {lead.source.campaign ? ` · ${lead.source.campaign}` : ""}
                            </span>
                          )}
                          {lead.customerNote && (
                            <div className="w-full mt-0.5 rounded-md bg-amber-500/8 border border-amber-500/30 px-2 py-1.5">
                              <p className="text-[9px] uppercase tracking-[0.15em] text-amber-300 font-bold mb-0.5">📝 Customer note</p>
                              <p className="text-[11.5px] text-amber-100 leading-snug break-words">{lead.customerNote}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Full spec answers — chip, RAM, GPU, display,
                          battery, charger, connectivity, extras. Skywalker
                          2026-05-17 — staff was making offers blind without
                          these. Shown as a dense key:value list right under
                          the basic device line so it's all visible at glance. */}
                      {(lead.processor || lead.memory || lead.graphics || lead.displayResolution || lead.displayGlass || lead.batteryHealth || lead.charger || lead.connectivity || (lead.extras && lead.extras.length > 0)) && (
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                          {lead.processor         && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Chip:</span> <span className="text-white font-medium">{lead.processor}</span></p>}
                          {lead.memory            && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">RAM:</span> <span className="text-white font-medium">{lead.memory}</span></p>}
                          {lead.graphics          && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">GPU:</span> <span className="text-white font-medium">{lead.graphics}</span></p>}
                          {lead.displayResolution && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Display:</span> <span className="text-white font-medium">{lead.displayResolution}</span></p>}
                          {lead.displayGlass      && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Glass:</span> <span className="text-white font-medium">{lead.displayGlass}</span></p>}
                          {lead.batteryHealth     && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Battery:</span> <span className={`font-medium ${/poor/i.test(lead.batteryHealth) ? "text-yellow-300" : "text-white"}`}>{lead.batteryHealth}</span></p>}
                          {lead.charger           && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Charger:</span> <span className="text-white font-medium">{lead.charger}</span></p>}
                          {lead.connectivity      && <p className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">Connectivity:</span> <span className="text-white font-medium">{lead.connectivity}</span></p>}
                          {lead.extras && lead.extras.length > 0 && <p className="text-[#c5c5c5] sm:col-span-2"><span className="text-[#8a8a8a]">Extras:</span> <span className="text-white font-medium">{lead.extras.join(", ")}</span></p>}
                        </div>
                      )}
                      {/* Carrier-balance badge — surfaces the paid-off
                          status front-and-center so staff can adjust the
                          offer for blacklist risk. Skywalker 2026-05-17. */}
                      {lead.paidOff === false && (
                        <div className="mt-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-100 border border-amber-500/40">⚠️ BALANCE OWED · blacklist risk</span>
                        </div>
                      )}
                      {/* Damage badges — surface front/back-glass + functional
                          status so the tech doesn't have to dig into the body.
                          Skywalker 2026-05-17. */}
                      {(lead.brokenGlass || lead.brokenFunctional === false) && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {lead.brokenGlass === "front" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-200 border border-orange-500/30">FRONT GLASS</span>
                          )}
                          {lead.brokenGlass === "back" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-200 border border-yellow-500/30">BACK GLASS</span>
                          )}
                          {lead.brokenGlass === "both" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-200 border border-red-500/30">BOTH GLASS</span>
                          )}
                          {lead.brokenFunctional === false && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-100 border border-red-500/40">⚠️ NOT FUNCTIONAL</span>
                          )}
                          {lead.brokenFunctional === true && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">Still powers on</span>
                          )}
                        </div>
                      )}
                      {lead.photos && lead.photos.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {lead.photos.slice(0, 3).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-10 h-10 rounded overflow-hidden border border-white/10 hover:border-[#00c853] transition">
                              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                          {lead.photos.length > 3 && (
                            <button type="button" onClick={() => setDetailLead(lead)} title="View all photos in full detail" className="w-10 h-10 rounded bg-white/5 border border-white/10 hover:border-[#00c853] hover:bg-white/10 flex items-center justify-center text-[10px] text-[#dcdcdc] cursor-pointer transition">+{lead.photos.length - 3}</button>
                          )}
                        </div>
                      )}
                      {/* Handoff block — surfaces shipping address +
                          packaging or local meetup area + slot + the
                          action staff needs to take. Skywalker 2026-05-17. */}
                      {lead.handoffMethod && (
                        <div className={`mt-1.5 rounded-md p-2 border ${lead.handoffMethod === "ship" ? "bg-sky-500/[0.06] border-sky-500/30" : "bg-emerald-500/[0.06] border-emerald-500/30"}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${lead.handoffMethod === "ship" ? "text-sky-300" : "text-emerald-300"}`}>
                            {lead.handoffMethod === "ship" ? "📦 Shipping" : "🤝 Local Meetup"}
                          </p>
                          {lead.handoffMethod === "ship" && (
                            <>
                              {lead.shipAddress && (
                                <p className="text-[11px] text-[#e5e5e5]"><span className="text-[#8a8a8a]">Address:</span> <a href={`https://maps.google.com/?q=${encodeURIComponent(lead.shipAddress)}`} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00c853] hover:underline">{lead.shipAddress}</a></p>
                              )}
                              {lead.shipPackaging && (
                                <p className="text-[11px] text-[#c5c5c5]"><span className="text-[#8a8a8a]">Packaging:</span> <span className="text-white">{lead.shipPackaging}</span></p>
                              )}
                            </>
                          )}
                          {lead.handoffMethod === "local" && (
                            <>
                              {lead.localArea && (
                                <p className="text-[11px] text-[#e5e5e5]"><span className="text-[#8a8a8a]">Area:</span> <span className="text-white">{lead.localArea}</span></p>
                              )}
                              {lead.localSlot && (
                                <p className="text-[11px] text-[#e5e5e5]"><span className="text-[#8a8a8a]">Slot:</span> <span className="text-white font-bold">{lead.localSlot}</span></p>
                              )}
                            </>
                          )}
                          {lead.handoffAction && (
                            <p className="text-[11px] text-[#c5c5c5] mt-0.5 italic"><span className="text-[#8a8a8a] not-italic">Next:</span> {lead.handoffAction}</p>
                          )}
                          {/* FedEx label section — only for ship leads.
                              Shows either the existing tracking+PDF link
                              or a Generate button. Skywalker 2026-05-17. */}
                          {lead.handoffMethod === "ship" && (
                            <div className="mt-2 pt-2 border-t border-sky-500/15">
                              {lead.fedexTracking && lead.fedexLabelUrl ? (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300">📄 FedEx label</p>
                                  <p className="text-[11px] text-[#e5e5e5]">
                                    <span className="text-[#8a8a8a]">Tracking:</span>{" "}
                                    <a
                                      href={`https://www.fedex.com/fedextrack/?trknbr=${lead.fedexTracking}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-white font-mono font-bold hover:text-[#00c853] hover:underline"
                                    >
                                      {lead.fedexTracking}
                                    </a>
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    <a
                                      href={lead.fedexLabelUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-sky-500/15 border border-sky-500/40 text-sky-200 hover:bg-sky-500/25 transition cursor-pointer"
                                    >
                                      Open label PDF ↗
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => resendLabelEmail(lead)}
                                      disabled={labelResendingId === lead.id || !lead.email}
                                      className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={!lead.email ? "No customer email on file" : "Email the existing label PDF to the customer again — no new FedEx mint"}
                                    >
                                      {labelResendingId === lead.id ? "Sending…" : labelResendOkById[lead.id] ? "✓ Sent" : "📧 Resend email"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openAddressEdit(lead)}
                                      disabled={labelGeneratingId === lead.id}
                                      className="text-[10px] font-bold px-2 py-1 rounded bg-white/5 border border-white/10 text-[#dcdcdc] hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
                                      title="Correct the shipping address and mint a new label"
                                    >
                                      ✏️ Edit address
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => generateLabel(lead)}
                                      disabled={labelGeneratingId === lead.id}
                                      className="text-[10px] font-bold px-2 py-1 rounded bg-white/5 border border-white/10 text-[#dcdcdc] hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
                                      title="Generate a new label using the same address (replaces the current one)"
                                    >
                                      {labelGeneratingId === lead.id ? "Regenerating…" : "↻ Regenerate"}
                                    </button>
                                  </div>
                                  {labelErrorById[lead.id] && (
                                    <p className="text-[10px] text-red-300 mt-1">⚠️ {labelErrorById[lead.id]}</p>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  {lead.fedexLabelError && (
                                    <div className="mb-2 rounded bg-red-500/15 border border-red-500/40 px-2 py-1.5">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-300">⚠️ Label failed: {lead.fedexLabelError.kind}</p>
                                      {lead.fedexLabelError.reason && (
                                        <p className="text-[10px] text-red-200/80 mt-0.5 break-words" title={lead.fedexLabelError.reason}>{lead.fedexLabelError.reason.length > 140 ? lead.fedexLabelError.reason.slice(0, 140) + "…" : lead.fedexLabelError.reason}</p>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-1.5">
                                    {lead.fedexLabelError && lead.fedexLabelError.kind === "SERVICE_UNAVAILABLE" && (
                                      <button
                                        type="button"
                                        onClick={() => autoRetryLabel(lead)}
                                        disabled={labelGeneratingId === lead.id}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Re-mint the label now — uses the address already on file, no re-entry needed"
                                      >
                                        {labelGeneratingId === lead.id ? "Retrying…" : "🔄 Retry now"}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => generateLabel(lead)}
                                      disabled={labelGeneratingId === lead.id || !lead.shipAddress || !lead.phone}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded bg-sky-500/15 border border-sky-500/40 text-sky-200 hover:bg-sky-500/25 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={!lead.shipAddress ? "No shipping address on file — use Edit address" : !lead.phone ? "Customer phone required" : "Generate FedEx prepaid drop-off label"}
                                    >
                                      {labelGeneratingId === lead.id ? "Generating FedEx label…" : "📄 Generate FedEx label"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openAddressEdit(lead)}
                                      disabled={labelGeneratingId === lead.id || !lead.phone}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[#dcdcdc] hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
                                      title="Type or paste a corrected address before generating"
                                    >
                                      ✏️ Edit address & retry
                                    </button>
                                  </div>
                                  {labelErrorById[lead.id] && (
                                    <p className="text-[10px] text-red-300 mt-1">⚠️ {labelErrorById[lead.id]}</p>
                                  )}
                                </div>
                              )}
                              {/* Inline address editor — collapses any
                                  generate/regenerate state so staff sees
                                  exactly the form they're submitting. */}
                              {addressEditId === lead.id && (
                                <div className="mt-2 rounded-lg bg-white/[0.04] border border-white/10 p-2 space-y-1.5">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">✏️ Edit shipping address</p>
                                  <input
                                    type="text"
                                    value={addressDraft.street}
                                    onChange={(e) => setAddressDraft((s) => ({ ...s, street: e.target.value }))}
                                    placeholder="Street address"
                                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853]"
                                  />
                                  <input
                                    type="text"
                                    value={addressDraft.unit}
                                    onChange={(e) => setAddressDraft((s) => ({ ...s, unit: e.target.value }))}
                                    placeholder="Apt / Unit (optional)"
                                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853]"
                                  />
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <input
                                      type="text"
                                      value={addressDraft.city}
                                      onChange={(e) => setAddressDraft((s) => ({ ...s, city: e.target.value }))}
                                      placeholder="City"
                                      className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853]"
                                    />
                                    <input
                                      type="text"
                                      value={addressDraft.state}
                                      onChange={(e) => setAddressDraft((s) => ({ ...s, state: e.target.value.toUpperCase() }))}
                                      placeholder="ST"
                                      maxLength={2}
                                      className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853] uppercase"
                                    />
                                    <input
                                      type="text"
                                      value={addressDraft.zip}
                                      onChange={(e) => setAddressDraft((s) => ({ ...s, zip: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                                      placeholder="ZIP"
                                      inputMode="numeric"
                                      maxLength={5}
                                      className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853]"
                                    />
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => retryWithEditedAddress(lead)}
                                      disabled={labelGeneratingId === lead.id}
                                      className="text-[11px] font-bold px-2.5 py-1 rounded bg-[#00c853] text-[#0a0a0a] hover:bg-[#00e676] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      {labelGeneratingId === lead.id ? "Generating…" : "Generate with this address"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAddressEditId(null)}
                                      className="text-[11px] px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[#d4d4d4] hover:bg-white/10 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {/* ID-capture UI intentionally hidden — Skywalker
                          2026-05-18 "we are small, can't store private
                          info safely yet". Backend route + parser stay
                          intact for when signed-URL storage lands. Flip
                          NEXT_PUBLIC_TCC_ID_CAPTURE_ENABLED=true to
                          surface this section again. */}
                      {false && (
                      <div className="mt-2">
                        {lead.idCaptured ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-200 border border-emerald-500/45 uppercase tracking-wider">
                              ✓ ID · {lead.idCaptured?.type} · ****{lead.idCaptured?.last4} · DOB {lead.idCaptured?.dobYear}
                            </span>
                            <a
                              href={lead.idCaptured?.photoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/[0.06] text-[#dcdcdc] border border-white/15 hover:bg-white/[0.1] transition cursor-pointer"
                            >
                              View ID photo ↗
                            </a>
                            <button
                              type="button"
                              onClick={() => { setIdCaptureId(lead.id); setIdType(lead.idCaptured!.type || "DL"); setIdNumber(""); setIdDob(""); setIdFile(null); }}
                              className="text-[10px] text-[#888] hover:text-[#dcdcdc] underline cursor-pointer"
                              title="Re-capture (e.g. wrong photo, expired ID)"
                            >
                              re-capture
                            </button>
                          </div>
                        ) : idCaptureId === lead.id ? (
                          <div className="rounded-lg bg-white/[0.04] border border-amber-500/30 p-2.5 space-y-1.5 max-w-[360px]">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">🪪 Capture seller ID</p>
                            <p className="text-[10px] text-[#bdbdbd] leading-snug">Texas Secondhand Dealer Act — required for resale. Photo + DOB + ID# stored 2 years. Never displayed to customer.</p>
                            <select
                              value={idType}
                              onChange={(e) => setIdType(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00c853] cursor-pointer"
                            >
                              <option value="DL">Driver&apos;s License</option>
                              <option value="STATE_ID">State ID</option>
                              <option value="PASSPORT">Passport</option>
                              <option value="MILITARY">Military ID</option>
                              <option value="OTHER">Other government ID</option>
                            </select>
                            <input
                              type="text"
                              value={idNumber}
                              onChange={(e) => setIdNumber(e.target.value)}
                              placeholder="ID number (full — only last 4 shown later)"
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00c853]"
                            />
                            <input
                              type="date"
                              value={idDob}
                              onChange={(e) => setIdDob(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00c853]"
                            />
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                              className="w-full text-[11px] text-[#dcdcdc] file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-[#00c853]/20 file:text-[#7be8a8] file:cursor-pointer cursor-pointer"
                            />
                            {idErrorById[lead.id] && (
                              <p className="text-[10px] text-red-300">⚠️ {idErrorById[lead.id]}</p>
                            )}
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => submitIdCapture(lead)}
                                disabled={idUploadingId === lead.id}
                                className="flex-1 px-2 py-1.5 bg-[#00c853] text-[#0a0a0a] rounded text-[11px] font-bold hover:bg-[#00e676] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                {idUploadingId === lead.id ? "Uploading…" : "Save ID"}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setIdCaptureId(null); setIdNumber(""); setIdDob(""); setIdFile(null); setIdErrorById((s) => { const c = { ...s }; delete c[lead.id]; return c; }); }}
                                className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-[11px] text-[#d4d4d4] hover:bg-white/10 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          (() => {
                            const quoteN = parseInt((lead.quote || lead.totalPayout?.toString() || "").replace(/[^\d]/g, "")) || 0;
                            const required = quoteN >= 500;
                            return (
                              <button
                                type="button"
                                onClick={() => { setIdCaptureId(lead.id); setIdType("DL"); setIdNumber(""); setIdDob(""); setIdFile(null); }}
                                className={`text-[10px] font-bold px-2 py-1 rounded border transition cursor-pointer ${required ? "bg-amber-500/15 text-amber-200 border-amber-500/40 hover:bg-amber-500/25" : "bg-white/5 text-[#bdbdbd] border-white/10 hover:bg-white/10"}`}
                                title={required ? "Quote ≥ $500 — Texas Secondhand Dealer Act requires ID capture before payout" : "Optional ID capture for compliance records"}
                              >
                                🪪 {required ? "ID REQUIRED" : "Capture ID"}{required ? " (≥$500)" : ""}
                              </button>
                            );
                          })()
                        )}
                      </div>
                      )}
                      {/* Customer review attached to this lead. Surfaces
                          inline so staff sees exactly what the customer
                          said + the rating without leaving the row. */}
                      {lead.review && (
                        <div className="mt-2 rounded-lg bg-[#ffb400]/8 border border-[#ffb400]/30 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[#ffb400] text-sm font-bold leading-none">{"★".repeat(lead.review.rating)}<span className="text-white/15">{"★".repeat(5 - lead.review.rating)}</span></span>
                              {lead.review.verified && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-[#00c853]/15 text-[#7be8a8] border border-[#00c853]/40">✓ Verified</span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#888]">{new Date(lead.review.createdAt).toLocaleDateString()}</span>
                          </div>
                          {lead.review.title && (
                            <p className="text-[12px] font-bold text-white leading-tight mb-1 break-words">{lead.review.title}</p>
                          )}
                          <p className="text-[11.5px] text-[#e6e6e6] leading-snug break-words italic">&ldquo;{lead.review.body}&rdquo;</p>
                        </div>
                      )}
                      {/* Notes */}
                      <div className="mt-1.5">
                        {lead.latestNote && (
                          <div className="text-[11px] text-[#d4d4d4] bg-white/[0.03] border-l-2 border-[#00c853]/40 pl-2 py-1 rounded-sm" title={lead.latestNote}>
                            <span className="text-[9px] uppercase tracking-wider text-[#c5c5c5] font-bold">Note{lead.noteCount && lead.noteCount > 1 ? ` (${lead.noteCount})` : ""}: </span>
                            <span className="break-words">{lead.latestNote.length > 80 ? lead.latestNote.slice(0, 80) + "…" : lead.latestNote}</span>
                          </div>
                        )}
                        {noteOpenId === lead.id ? (
                          <div className="mt-1.5 space-y-1.5">
                            <textarea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Internal note…"
                              rows={2}
                              maxLength={500}
                              autoFocus
                              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white placeholder:text-[#c5c5c5] focus:outline-none focus:border-[#00c853] resize-none"
                            />
                            <div className="flex gap-1.5">
                              <button type="button" disabled={!noteDraft.trim() || noteSavingId === lead.id} onClick={() => saveNote(lead)} className="px-2.5 py-1 bg-[#00c853] text-[#0a0a0a] rounded text-[11px] font-bold hover:bg-[#00e676] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{noteSavingId === lead.id ? "Saving…" : "Save"}</button>
                              <button type="button" onClick={() => { setNoteOpenId(null); setNoteDraft(""); }} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-[#d4d4d4] hover:bg-white/10 cursor-pointer">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setNoteOpenId(lead.id); setNoteDraft(""); }} className="text-[10px] text-[#c5c5c5] hover:text-[#d4d4d4] transition mt-1 cursor-pointer">+ {lead.latestNote ? "Add another note" : "Add internal note"}</button>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {/* Review-link grab — one click puts the per-customer
                            review URL on the clipboard so Skywalker can text
                            or hand it to them after the meetup. */}
                        <button
                          type="button"
                          onClick={() => copyReviewLink(lead)}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold transition cursor-pointer px-2 py-1 rounded border ${copiedLinkId === lead.id ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-[#ffb400]/10 border-[#ffb400]/30 text-[#ffd54f] hover:bg-[#ffb400]/20"}`}
                          title="Copy a review link prefilled with this customer's name + device"
                        >
                          {copiedLinkId === lead.id ? "✓ Copied! Paste in SMS or print/QR" : "★ Copy review link"}
                        </button>
                        {/* Custom email composer — send a one-off message
                            using Resend with the TCC brand wrapper. */}
                        <button
                          type="button"
                          onClick={() => openEmailComposer(lead)}
                          disabled={!lead.email}
                          className="inline-flex items-center gap-1 text-[10px] font-bold transition cursor-pointer px-2 py-1 rounded border bg-sky-500/10 border-sky-500/35 text-sky-200 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={lead.email ? "Send a one-off custom email to this customer" : "No customer email on file"}
                        >
                          {emailSentById[lead.id] ? "✓ Sent" : "✉️ Email"}
                        </button>
                        {/* Counter-offer — third path between accept-as-
                            quoted and full reject. Opens a modal asking
                            for the revised dollar amount + a customer-
                            facing reason. Disabled once an offer is
                            pending (re-mint after a decline is fine). */}
                        <button
                          type="button"
                          onClick={() => openCounterOffer(lead)}
                          disabled={!lead.phone && !lead.email}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold transition cursor-pointer px-2 py-1 rounded border ${
                            lead.counterOffer?.status === "pending"
                              ? "bg-amber-500/15 border-amber-500/45 text-amber-200 hover:bg-amber-500/25"
                              : lead.counterOffer?.status === "accepted"
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25"
                                : lead.counterOffer?.status === "declined"
                                  ? "bg-red-500/15 border-red-500/40 text-red-200 hover:bg-red-500/25"
                                  : "bg-purple-500/10 border-purple-500/35 text-purple-200 hover:bg-purple-500/20"
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={!lead.phone && !lead.email ? "Need phone or email to send the offer" : lead.counterOffer ? `Last offer: $${lead.counterOffer.offer} (${lead.counterOffer.status})` : "Send the customer a revised offer with the reason"}
                        >
                          {lead.counterOffer?.status === "pending"
                            ? `⏳ Counter $${lead.counterOffer.offer} pending`
                            : lead.counterOffer?.status === "accepted"
                              ? `✓ Counter $${lead.counterOffer.offer} accepted`
                              : lead.counterOffer?.status === "declined"
                                ? `✗ Counter $${lead.counterOffer.offer} declined — re-mint?`
                                : "💬 Counter-offer"}
                        </button>
                      </div>
                      {/* Customer note from counter-response, if present. */}
                      {lead.counterOffer?.customerNote && (
                        <div className="mt-1.5 text-[11px] text-[#dcdcdc] bg-purple-500/10 border border-purple-500/30 border-l-2 border-l-purple-400 pl-2 py-1 rounded-sm">
                          <span className="text-[9px] uppercase tracking-wider text-purple-300 font-bold">Customer note: </span>
                          <span className="break-words">{lead.counterOffer.customerNote}</span>
                        </div>
                      )}
                      {/* Inline custom-email composer — toggles open when
                          ✉️ Email is clicked. Subject + body + Send/Cancel.
                          Uses Resend behind the scenes with the TCC HTML
                          template; staff doesn't have to think about HTML. */}
                      {emailComposeId === lead.id && (
                        <div className="mt-2 rounded-lg bg-white/[0.04] border border-sky-500/30 p-2.5 space-y-1.5 max-w-[420px]">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300">✉️ Email {lead.email}</p>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            placeholder="Subject (shows in the inbox preview)"
                            maxLength={200}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                          />
                          <textarea
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            placeholder="Write your message… blank lines = paragraph breaks. The TCC header + signature + footer wrap automatically."
                            rows={6}
                            maxLength={5000}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white leading-relaxed focus:outline-none focus:border-sky-400 resize-none"
                          />
                          <div className="flex items-center justify-between text-[10px] text-[#888]">
                            <span>{emailBody.length}/5000 · Hi {(lead.name || "there").split(" ")[0]}, … — Skywalker &amp; team</span>
                          </div>
                          {emailErrorById[lead.id] && (
                            <p className="text-[10px] text-red-300">⚠️ {emailErrorById[lead.id]}</p>
                          )}
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => sendCustomEmail(lead)}
                              disabled={emailSendingId === lead.id || !emailSubject.trim() || emailBody.trim().length < 5}
                              className="flex-1 px-2 py-1.5 bg-sky-500 text-white rounded text-[11px] font-bold hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {emailSendingId === lead.id ? "Sending…" : "Send email"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEmailComposeId(null); setEmailSubject(""); setEmailBody(""); }}
                              className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-[11px] text-[#d4d4d4] hover:bg-white/10 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-[#00c853]">{lead.quote || "—"}</p>
                      {(() => {
                        // Headline margin = NET after fees + shipping, matching what
                        // /admin/profit records as actual realized profit. Use the
                        // best of compMargin.atlas / compMargin.ebay (server-computed
                        // via comp-economics — same FVF + ship math as the sales
                        // ledger). Falls back to the submit-time gross with a clear
                        // "(before fees+ship)" caveat only when compMargin is missing
                        // (older leads, or no SKU match for the resell comps).
                        const cm = lead.compMargin;
                        const atlas = cm?.atlas;
                        const ebay = cm?.ebay;
                        const best = atlas && ebay
                          ? (atlas.margin >= ebay.margin ? { src: "Atlas", margin: atlas.margin, pct: atlas.marginPct, exit: atlas.resell }
                            : { src: "eBay net", margin: ebay.margin, pct: ebay.marginPct, exit: ebay.netMedian })
                          : atlas ? { src: "Atlas", margin: atlas.margin, pct: atlas.marginPct, exit: atlas.resell }
                          : ebay  ? { src: "eBay net", margin: ebay.margin, pct: ebay.marginPct, exit: ebay.netMedian }
                          : null;
                        if (best) {
                          const flag = best.pct >= 25 ? "good" : best.pct >= 10 ? "thin" : "low";
                          return (
                            <div className={`mt-1 px-2 py-1 rounded-md text-[11px] font-bold ${flag === "low" ? "bg-red-500/15 border border-red-500/30" : flag === "thin" ? "bg-yellow-500/15 border border-yellow-500/30" : "bg-emerald-500/15 border border-emerald-500/30"}`} title="Net after eBay 13% FVF + $0.40 fixed + outbound shipping (or Atlas wholesale − outbound shipping). Matches what /admin/profit records as actual realized profit.">
                              <span className={flag === "low" ? "text-red-400" : flag === "thin" ? "text-yellow-400" : "text-emerald-400"}>
                                {flag === "low" ? "⚠️ LOW" : flag === "thin" ? "⚡ THIN" : "✅ GOOD"}
                              </span>
                              <span className="text-white ml-1">You net ${best.margin}</span>
                              <span className="text-[#999] ml-1">({best.pct}%)</span>
                              <br />
                              <span className="text-[#888]">via {best.src} @ ${best.exit} (after fees + ship)</span>
                            </div>
                          );
                        }
                        if (lead.marginPercent != null && lead.grossMargin != null) {
                          return (
                            <div className={`mt-1 px-2 py-1 rounded-md text-[11px] font-bold ${lead.marginFlag === "low" ? "bg-red-500/15 border border-red-500/30" : lead.marginFlag === "thin" ? "bg-yellow-500/15 border border-yellow-500/30" : "bg-emerald-500/15 border border-emerald-500/30"}`} title="Gross margin = resell − payout. Does NOT include eBay fees or shipping — actual profit will be lower. No live comp data for this SKU yet.">
                              <span className={lead.marginFlag === "low" ? "text-red-400" : lead.marginFlag === "thin" ? "text-yellow-400" : "text-emerald-400"}>
                                {lead.marginFlag === "low" ? "⚠️ LOW" : lead.marginFlag === "thin" ? "⚡ THIN" : "✅ GOOD"}
                              </span>
                              <span className="text-white ml-1">Gross ${lead.grossMargin}</span>
                              <span className="text-[#999] ml-1">({lead.marginPercent}%)</span>
                              <span className="text-amber-300 ml-1">· before fees+ship</span>
                              <br />
                              <span className="text-[#888]">Resell ~${lead.resellEstimate} · no live comp data</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {lead.marginFlag === "manual" && (
                        <div className="mt-1 px-2 py-1 rounded-md text-[11px] font-bold bg-orange-500/15 border border-orange-500/30">
                          <span className="text-orange-400">📋 Manual quote needed</span>
                          <span className="text-[#888] ml-1">— check Swappa/eBay before offering</span>
                        </div>
                      )}
                      {/* Live Atlas + eBay margin — shows the lead's exact
                          variant against the current comp datasets so staff
                          can see "if we sell to Atlas we net $X" /
                          "if we sell on eBay we net $Y" without leaving
                          the lead row. Skywalker 2026-05-19. */}
                      {lead.compMargin && (lead.compMargin.atlas || lead.compMargin.ebay) && (
                        <div className="mt-1.5 space-y-0.5 text-[11px] font-mono">
                          {lead.compMargin.atlas && (() => {
                            const a = lead.compMargin!.atlas!;
                            const tone = a.marginPct >= 25 ? "text-emerald-400" : a.marginPct >= 10 ? "text-yellow-400" : "text-red-400";
                            const carrierTag = a.carrierKey === "unlocked" ? "" : ` · ${a.carrierKey.toUpperCase()}`;
                            return (
                              <div className="px-2 py-1 rounded-md bg-white/[0.03] border border-white/10" title={`Atlas wholesale ($${a.resell}) − outbound ship − customer quote ($${lead.compMargin!.quote ?? "?"}) = $${a.margin} margin (${a.marginPct}%)${carrierTag}`}>
                                <span className="text-[#888]">Atlas{carrierTag}: </span>
                                <span className="text-white">${a.resell}</span>
                                <span className={`ml-1 ${tone}`}>{a.margin >= 0 ? "+" : ""}${a.margin} ({a.marginPct}%)</span>
                              </div>
                            );
                          })()}
                          {lead.compMargin.ebay && (() => {
                            const e = lead.compMargin!.ebay!;
                            const tone = e.marginPct >= 25 ? "text-emerald-400" : e.marginPct >= 10 ? "text-yellow-400" : "text-red-400";
                            return (
                              <div className="px-2 py-1 rounded-md bg-white/[0.03] border border-white/10" title={`eBay net after 13% FVF + $0.40 + outbound ship ($${e.netMedian}, n=${e.sampleCount}) − customer quote ($${lead.compMargin!.quote ?? "?"}) = $${e.margin} margin (${e.marginPct}%)`}>
                                <span className="text-[#888]">eBay net ({e.sampleCount}): </span>
                                <span className="text-white">${e.netMedian}</span>
                                <span className={`ml-1 ${tone}`}>{e.margin >= 0 ? "+" : ""}${e.margin} ({e.marginPct}%)</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      <p className="text-[#c5c5c5] text-xs flex items-center gap-1.5 flex-wrap">
                        <span>{lead.payout}</span>
                        {(() => {
                          const s = payoutChipStatus(lead.payout);
                          const base = "inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border";
                          if (s === "verified") return <span title="Payout handle format checks out — submitted handles pass the same strict validation /api/lead does, so this is a positive signal" className={`${base} bg-[#00c853]/15 border-[#00c853]/40 text-[#00c853]`}>✓ verified</span>;
                          if (s === "invalid") return <span title="Payout handle failed its format check — confirm with the customer before paying" className={`${base} bg-amber-500/15 border-amber-500/40 text-amber-300`}>⚠ check handle</span>;
                          if (s === "no-handle") return <span title="No payout handle entered — needs follow-up" className={`${base} bg-amber-500/15 border-amber-500/40 text-amber-300`}>⚠ no handle</span>;
                          return null;
                        })()}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {adjustingId !== lead.id && (
                          <button type="button" onClick={() => { setAdjustingId(lead.id); setAdjustQuote(""); setAdjustReason(""); }} className="text-[10px] text-[#c5c5c5] hover:text-[#d4d4d4] cursor-pointer">✏️ Adjust quote</button>
                        )}
                        <button
                          type="button"
                          onClick={() => setCorrectingLead(lead)}
                          className="text-[10px] text-[#00c853] hover:text-[#27e672] cursor-pointer"
                          title="Inspecting the device — enter the IMEI, pull the real model from Sickw, save the corrected specs to this lead"
                        >
                          🔧 Correct device (IMEI)
                        </button>
                        <button
                          type="button"
                          onClick={() => runFraudCheck(lead)}
                          disabled={fraudCheckingId === lead.id}
                          className="text-[10px] text-[#8a8aff] hover:text-[#a8a8ff] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Ask Claude to assess this lead's fraud risk based on IP, UA, contact, prior leads, and device claim"
                        >
                          {fraudCheckingId === lead.id ? "🤖 Analyzing…" : "🤖 AI fraud check"}
                        </button>
                      </div>
                      {fraudVerdictById[lead.id] && (
                        <div className={`mt-2 p-2 rounded-md text-[11px] leading-relaxed border ${
                          fraudVerdictById[lead.id].verdict === "error"
                            ? "bg-white/[0.04] border-white/15 text-[#bdbdbd]"
                            : fraudVerdictById[lead.id].verdict === "suspect_fraud" || fraudVerdictById[lead.id].verdict === "high_risk"
                            ? "bg-red-500/10 border-red-500/30 text-red-200"
                            : fraudVerdictById[lead.id].verdict === "medium_risk"
                            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                        }`}>
                          <p className="font-bold uppercase tracking-wider text-[10px] mb-1">
                            🤖 {fraudVerdictById[lead.id].verdict?.replace(/_/g, " ") || "verdict"}
                            {fraudVerdictById[lead.id].score !== undefined ? ` · score ${fraudVerdictById[lead.id].score}` : ""}
                            {fraudVerdictById[lead.id].recommendation ? ` · ${fraudVerdictById[lead.id].recommendation}` : ""}
                          </p>
                          {(fraudVerdictById[lead.id].red_flags || []).length > 0 && (
                            <p className="mt-1"><span className="font-bold">🚩 Red:</span> {(fraudVerdictById[lead.id].red_flags || []).join("; ")}</p>
                          )}
                          {(fraudVerdictById[lead.id].green_flags || []).length > 0 && (
                            <p className="mt-1 opacity-80"><span className="font-bold">✓ Green:</span> {(fraudVerdictById[lead.id].green_flags || []).join("; ")}</p>
                          )}
                        </div>
                      )}
                      {adjustingId === lead.id && (
                        <div className="mt-2 p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-2 max-w-[240px]">
                          <p className="text-[10px] text-yellow-300 font-bold uppercase tracking-wider">Adjust offer</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#d4d4d4] text-sm font-bold">$</span>
                            <input type="text" inputMode="numeric" value={adjustQuote} onChange={(e) => setAdjustQuote(e.target.value.replace(/\D/g, ""))} placeholder="New $" className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400" autoFocus />
                          </div>
                          <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400 cursor-pointer">
                            <option value="">— pick a reason —</option>
                            <option>damage worse than disclosed</option>
                            <option>screen previously replaced</option>
                            <option>battery health below threshold</option>
                            <option>missing accessories</option>
                            <option>condition better than expected — bonus added</option>
                            <option>Other</option>
                          </select>
                          {adjustReason === "Other" && (
                            <input type="text" placeholder="Custom reason…" onChange={(e) => setAdjustReason(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400" />
                          )}
                          <div className="flex gap-1.5">
                            <button type="button" disabled={!adjustQuote || !adjustReason.trim() || adjustReason === "Other" || adjustSavingId === lead.id} onClick={() => saveAdjust(lead)} className="flex-1 px-2 py-1.5 bg-yellow-500 text-black rounded text-[11px] font-bold hover:bg-yellow-400 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{adjustSavingId === lead.id ? "Sending…" : "Send to customer"}</button>
                            <button type="button" onClick={() => { setAdjustingId(null); setAdjustQuote(""); setAdjustReason(""); }} className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-[11px] text-[#d4d4d4] hover:bg-white/10 transition cursor-pointer">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <select
                        value={current}
                        disabled={savingId === lead.id || rejectingId === lead.id}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "rejected" && lead.status !== "rejected") {
                            setRejectingId(lead.id);
                            setRejectionReason("");
                            setPendingStatus((p) => ({ ...p, [lead.id]: v }));
                            return;
                          }
                          // Paid / met — capture the payout confirmation
                          // BEFORE persisting the status. Skywalker
                          // 2026-05-18 audit trail.
                          if ((v === "paid" || v === "met") && lead.status !== v) {
                            setPayingId(lead.id);
                            setPayingStatus(v);
                            // Sensible defaults: cash for in-person met,
                            // pre-fill method from the customer's payout
                            // choice for paid (e.g. "Cash App", "Zelle").
                            const defaultMethod = v === "met" ? "cash"
                              : (lead.payout || "").toLowerCase().includes("zelle") ? "zelle"
                              : (lead.payout || "").toLowerCase().includes("venmo") ? "venmo"
                              : (lead.payout || "").toLowerCase().includes("cash app") ? "cashapp"
                              : (lead.payout || "").toLowerCase().includes("paypal") ? "paypal"
                              : (lead.payout || "").toLowerCase().includes("bitcoin") || (lead.payout || "").toLowerCase().includes("btc") ? "btc"
                              : "";
                            setPayoutMethod(defaultMethod);
                            setPayoutReference("");
                            setPayoutNote("");
                            // Default amount to the latest agreed quote —
                            // operator overrides if the in-person
                            // inspection lowered it. Empty when no quote
                            // on the lead. parseDollarAmount handles
                            // comma-grouped quotes ($1,250) that the old
                            // /\d+/ regex collapsed to $1 — that was
                            // why Nick's $570 mark-paid ended up logged
                            // as $1 cash.
                            const seedAmount =
                              (lead.totalPayout && lead.totalPayout > 0)
                                ? String(lead.totalPayout)
                                : (() => {
                                    const n = parseDollarAmount(lead.quote);
                                    return n > 0 ? String(n) : "";
                                  })();
                            setPayoutAmount(seedAmount);
                            setPayoutAlsoLogResale(true);
                            setPendingStatus((p) => ({ ...p, [lead.id]: v }));
                            return;
                          }
                          setPendingStatus((p) => ({ ...p, [lead.id]: v }));
                          saveStatus(lead, v);
                        }}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00c853] cursor-pointer disabled:opacity-60"
                        style={{ borderColor: meta.color + "55" }}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-black">{opt.label}</option>
                        ))}
                      </select>
                      {savingId === lead.id && (
                        <p className="text-[10px] text-[#dcdcdc] mt-1">Saving…</p>
                      )}
                      {/* Quick-action one-click status flips — Skywalker
                          2026-05-19. Faster than the dropdown when the
                          handoff state is unambiguous. The fedex-poll
                          cron auto-flips these in the background, but
                          staff often hears from the customer first so
                          we expose a manual override. */}
                      {savingId !== lead.id && lead.status !== "paid" && lead.status !== "met" && lead.status !== "rejected" && (() => {
                        const isShip = lead.handoffMethod === "ship";
                        const isLocal = lead.handoffMethod === "local";
                        const showDroppedOff = isShip && lead.status === "quote_requested";
                        const showReceived = isShip && lead.status === "shipped";
                        const showMet = isLocal && (lead.status === "quote_requested" || lead.status === "shipped");
                        if (!showDroppedOff && !showReceived && !showMet) return null;
                        return (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {showDroppedOff && (
                              <button
                                type="button"
                                onClick={() => saveStatus(lead, "shipped")}
                                className="text-[10px] font-bold text-sky-300 hover:text-sky-100 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 rounded px-2 py-1 cursor-pointer transition"
                                title="Customer texted they dropped at FedEx (or you saw it on tracking)"
                              >
                                📦 Dropped off
                              </button>
                            )}
                            {showReceived && (
                              <button
                                type="button"
                                onClick={() => saveStatus(lead, "received")}
                                className="text-[10px] font-bold text-purple-300 hover:text-purple-100 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 rounded px-2 py-1 cursor-pointer transition"
                                title="Package arrived — mark Received and inspect"
                              >
                                📬 Received
                              </button>
                            )}
                            {showMet && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => saveStatus(lead, "met")}
                                  className="text-[10px] font-bold text-amber-300 hover:text-amber-100 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded px-2 py-1 cursor-pointer transition"
                                  title="Met them at the slot, completed handoff"
                                >
                                  🤝 Met them
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveStatus(lead, "rejected", "no-show at scheduled meetup")}
                                  className="text-[10px] font-bold text-red-300 hover:text-red-100 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 rounded px-2 py-1 cursor-pointer transition"
                                  title="Customer didn't show — reject lead"
                                >
                                  🚫 No-show
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })()}
                      {/* Trash / Restore — in Active view this moves the
                          lead to Trash (recoverable for 24h). In Trash
                          view this restores it. Skywalker 2026-05-17
                          "save my quotes for 24hr". */}
                      {view === "trash" ? (
                        <div className="mt-1.5 space-y-1">
                          {typeof lead.hoursToAutoPurge === "number" ? (
                            <p className="text-[10px] text-amber-300">⏳ Auto-purge in {lead.hoursToAutoPurge}h</p>
                          ) : lead.deletedAt ? (
                            <p className="text-[10px] text-[#888]">🔒 Kept indefinitely — active lead won&apos;t auto-purge</p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => restoreLead(lead)}
                            disabled={restoringId === lead.id}
                            className="text-[10px] text-[#00c853] hover:text-[#00e676] border border-[#00c853]/40 hover:border-[#00c853]/70 rounded px-2 py-1 transition cursor-pointer disabled:opacity-50"
                            title="Move this lead back to the Active feed"
                          >
                            {restoringId === lead.id ? "Restoring…" : "↻ Restore"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => deleteLead(lead)}
                          disabled={deletingId === lead.id}
                          className="mt-1.5 text-[10px] text-[#ff8088] hover:text-[#ff5566] border border-[#ff5566]/30 hover:border-[#ff5566]/60 rounded px-2 py-1 transition cursor-pointer disabled:opacity-50"
                          title="Move to Trash — recoverable for 24h"
                        >
                          {deletingId === lead.id ? "Trashing…" : "🗑 Trash"}
                        </button>
                      )}
                      {savedFlash[lead.id] && (
                        <p className="text-[10px] text-[#00c853] mt-1">
                          ✓ Saved{savedFlash[lead.id]!.sms ? " · SMS sent" : ""}{savedFlash[lead.id]!.email ? " · email sent" : ""}
                          {isPaid(lead.status) && statusFilter === "active" && (
                            <>
                              {" — "}
                              <button
                                onClick={() => { setStatusFilter("completed"); }}
                                className="underline hover:text-white cursor-pointer"
                              >
                                View in Completed →
                              </button>
                            </>
                          )}
                        </p>
                      )}
                      {rejectingId === lead.id && (
                        <div className="mt-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2 max-w-[260px]">
                          <p className="text-[10px] text-red-300 font-bold uppercase tracking-wider">Reason for rejection</p>
                          <select
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-red-400 cursor-pointer"
                          >
                            <option value="">— pick a reason —</option>
                            <option>iCloud / Find My is locked</option>
                            <option>Device is blacklisted / reported</option>
                            <option>Damage worse than disclosed</option>
                            <option>Screen previously replaced (non-OEM)</option>
                            <option>Battery health below threshold</option>
                            <option>Device not paid off / financed</option>
                            <option>Different model than quoted</option>
                            <option>Other</option>
                          </select>
                          {rejectionReason === "Other" && (
                            <input
                              type="text"
                              autoFocus
                              placeholder="Type the reason…"
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-red-400"
                            />
                          )}
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={!rejectionReason.trim() || rejectionReason === "Other"}
                              onClick={() => {
                                saveStatus(lead, "rejected", rejectionReason);
                                setRejectingId(null);
                              }}
                              className="flex-1 px-2 py-1.5 bg-red-500 text-white rounded text-[11px] font-bold hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRejectingId(null); setRejectionReason(""); setPendingStatus((p) => { const c = { ...p }; delete c[lead.id]; return c; }); }}
                              className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-[11px] text-[#d4d4d4] hover:bg-white/10 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {payingId === lead.id && (
                        <div className="mt-2 p-2.5 bg-[#00c853]/8 border border-[#00c853]/30 rounded-lg space-y-2 max-w-[320px]">
                          <p className="text-[10px] text-[#7be8a8] font-bold uppercase tracking-wider">💰 Confirm payout · {payingStatus === "met" ? "in person" : "digital"}</p>
                          {/* Actual amount paid — defaults to the latest
                              agreed quote; operator overrides when the
                              in-person inspection lowered it (Rudy:
                              quoted Pro Max, paid 80 on actual 14). */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#c5c5c5] text-xs font-bold">$</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="1"
                              min="0"
                              value={payoutAmount}
                              onChange={(e) => setPayoutAmount(e.target.value)}
                              placeholder="Amount paid"
                              className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00c853]"
                              autoFocus
                            />
                            <span className="text-[9px] text-[#666] uppercase tracking-wider">paid</span>
                          </div>
                          <select
                            value={payoutMethod}
                            onChange={(e) => setPayoutMethod(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00c853] cursor-pointer"
                          >
                            <option value="">— how did you pay them? —</option>
                            <option value="cash">Cash (in person)</option>
                            <option value="zelle">Zelle</option>
                            <option value="venmo">Venmo</option>
                            <option value="cashapp">Cash App</option>
                            <option value="paypal">PayPal</option>
                            <option value="btc">Bitcoin / crypto</option>
                            <option value="check">Check</option>
                            <option value="other">Other</option>
                          </select>
                          {payoutMethod && payoutMethod !== "cash" && (
                            <input
                              type="text"
                              value={payoutReference}
                              onChange={(e) => setPayoutReference(e.target.value)}
                              placeholder={
                                payoutMethod === "zelle" ? "Zelle confirmation # / ref"
                                : payoutMethod === "venmo" ? "Venmo handle or txn ID"
                                : payoutMethod === "cashapp" ? "$cashtag or txn ID"
                                : payoutMethod === "paypal" ? "PayPal txn ID"
                                : payoutMethod === "btc" ? "Tx hash"
                                : payoutMethod === "check" ? "Check #"
                                : "Reference / ID"
                              }
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00c853]"
                            />
                          )}
                          <input
                            type="text"
                            value={payoutNote}
                            onChange={(e) => setPayoutNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00c853]"
                          />
                          {/* Auto-log to the resale ledger so the
                              cost side of the profit row is filled in
                              the moment the buy is recorded — staff
                              just adds the sold-price later. */}
                          <label className="flex items-center gap-2 text-[11px] text-[#c5c5c5] cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={payoutAlsoLogResale}
                              onChange={(e) => setPayoutAlsoLogResale(e.target.checked)}
                              className="accent-[#00c853] cursor-pointer"
                            />
                            <span>Also create a profit-ledger row (cost = ${payoutAmount || "0"})</span>
                          </label>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={!payoutMethod || (payoutMethod !== "cash" && !payoutReference.trim()) || !payoutAmount.trim() || Number(payoutAmount) <= 0}
                              onClick={async () => {
                                const amt = Number(payoutAmount) || 0;
                                await saveStatus(lead, payingStatus, undefined, {
                                  method: payoutMethod,
                                  reference: payoutReference.trim(),
                                  note: payoutNote.trim(),
                                  amount: amt,
                                });
                                // Best-effort: also create the profit
                                // ledger entry. Failure here doesn't
                                // un-mark the lead as paid — staff can
                                // still add it manually on /admin/profit.
                                if (payoutAlsoLogResale && amt > 0) {
                                  try {
                                    const dev = lead.model || lead.device || "device";
                                    const storage = lead.storage ? ` ${lead.storage}` : "";
                                    const carrier = lead.carrier ? ` ${lead.carrier}` : "";
                                    await fetch("/api/admin/sales", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
                                      body: JSON.stringify({
                                        device: `${dev}${storage}${carrier}`.trim(),
                                        platform: "eBay",  // most-common channel; editable later
                                        soldPrice: 0,      // staff fills in once resold
                                        cost: amt,
                                        fees: 0,
                                        shipping: 0,
                                        saleDate: new Date().toISOString().slice(0, 10),
                                        leadId: lead.id,
                                        note: payoutNote.trim() || "auto-created at payout",
                                      }),
                                    });
                                  } catch { /* surfaced if it matters via /admin/profit */ }
                                }
                                setPayingId(null);
                                setPayoutAmount("");
                              }}
                              className="flex-1 px-2 py-1.5 bg-[#00c853] text-[#0a0a0a] rounded text-[11px] font-bold hover:bg-[#00e676] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {payingStatus === "met" ? "Mark Met & Thanked" : "Mark Paid"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setPayingId(null); setPayoutMethod(""); setPayoutReference(""); setPayoutNote(""); setPayoutAmount(""); setPendingStatus((p) => { const c = { ...p }; delete c[lead.id]; return c; }); }}
                              className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-[11px] text-[#d4d4d4] hover:bg-white/10 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {smsOpenId === lead.id && (
                      <div className="md:col-span-6 mt-3 mx-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] uppercase tracking-wider text-[#dcdcdc] font-bold">💬 SMS thread · {lead.phone}</p>
                          <button onClick={() => loadSmsThread(lead)} className="text-[10px] text-[#c5c5c5] hover:text-[#d4d4d4] cursor-pointer">↻ Refresh</button>
                        </div>
                        {smsThreads[lead.id]?.loading && <p className="text-xs text-[#c5c5c5] py-2">Loading…</p>}
                        {smsThreads[lead.id]?.error && <p className="text-xs text-red-400 py-2">{smsThreads[lead.id]!.error}</p>}
                        {smsThreads[lead.id]?.messages && smsThreads[lead.id]!.messages!.length === 0 && (
                          <p className="text-xs text-[#c5c5c5] py-2 italic">No SMS history yet for this number.</p>
                        )}
                        {smsThreads[lead.id]?.messages && smsThreads[lead.id]!.messages!.length > 0 && (
                          <div className="space-y-1.5 max-h-72 overflow-y-auto">
                            {smsThreads[lead.id]!.messages!.map((m) => (
                              <div key={m.sid} className={`flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
                                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${m.direction === "in" ? "bg-white/10 text-white rounded-bl-sm" : "bg-[#00c853]/20 text-[#0a0a0a] rounded-br-sm"}`}>
                                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                  <p className="text-[9px] text-[#dcdcdc] mt-1 font-mono">{new Date(m.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Bulk-action sticky bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-white">{selectedIds.size} selected</p>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#dcdcdc] hover:text-white cursor-pointer">Clear</button>
              {bulkProgress && (
                <p className="text-xs text-[#00c853]">{bulkProgress.done}/{bulkProgress.total} done</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={bulkStatus}
                disabled={bulkSaving}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00c853] cursor-pointer disabled:opacity-50"
              >
                <option value="">Mark selected as…</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-black">{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => bulkStatus && runBulkStatus(bulkStatus)}
                disabled={!bulkStatus || bulkSaving}
                className="px-4 py-2 bg-[#00c853] text-[#0a0a0a] rounded-lg text-sm font-semibold hover:bg-[#00e676] cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bulkSaving ? "Updating…" : "Apply"}
              </button>
              <span className="w-px h-6 bg-white/15" aria-hidden />
              <button
                onClick={runBulkDelete}
                disabled={bulkSaving}
                title={view === "trash" ? "Selected leads are already in Trash" : "Move selected leads to Trash"}
                className="px-4 py-2 bg-red-500/15 text-red-300 border border-red-500/40 rounded-lg text-sm font-semibold hover:bg-red-500/25 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bulkSaving ? "Working…" : "🗑 Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL LEAD DETAIL MODAL — clicking a lead's name (or the "+N"
          photo badge) opens this read-only panel showing the complete
          lead: every device + spec, every photo uncapped (the row only
          previews 3), handoff, notes, source, IMEI warnings, margins,
          AI verdicts. Closes on backdrop click. */}
      {detailLead && (() => {
        const L = detailLead;
        const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
          <div className="border-t border-white/10 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a8a] mb-1.5">{title}</p>
            {children}
          </div>
        );
        const specPairs = (d: { processor?: string; memory?: string; graphics?: string; displayResolution?: string; displayGlass?: string; batteryHealth?: string; charger?: string; carrier?: string; connectivity?: string; imei?: string; extras?: string[] }): [string, string][] => {
          const out: [string, string][] = [];
          if (d.processor) out.push(["Chip", d.processor]);
          if (d.memory) out.push(["RAM", d.memory]);
          if (d.graphics) out.push(["GPU", d.graphics]);
          if (d.displayResolution) out.push(["Display", d.displayResolution]);
          if (d.displayGlass) out.push(["Glass", d.displayGlass]);
          if (d.batteryHealth) out.push(["Battery", d.batteryHealth]);
          if (d.charger) out.push(["Charger", d.charger]);
          if (d.carrier) out.push(["Carrier", d.carrier]);
          if (d.connectivity) out.push(["Connectivity", d.connectivity]);
          if (d.imei) out.push(["IMEI", d.imei]);
          if (d.extras && d.extras.length > 0) out.push(["Extras", d.extras.join(", ")]);
          return out;
        };
        const photoGrid = (urls: string[]) => (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {urls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-[#00c853] transition" title={`Photo ${i + 1}`}>
                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        );
        return (
          <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-[fadeIn_0.135s_ease-out]"
            onClick={() => setDetailLead(null)}
          >
            <div
              className="bg-[#0a0a0a] border border-white/15 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3 z-10">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold flex items-center gap-2 flex-wrap">
                    {L.name || "—"}
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold border" style={{ color: statusMeta(L.status).color, borderColor: statusMeta(L.status).color + "66" }}>{statusMeta(L.status).label}</span>
                    {L.recycleOnly && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">♻ Recycle</span>}
                  </h2>
                  <p className="text-xs text-[#c5c5c5] mt-0.5">{new Date(L.timestamp).toLocaleString()} · Offer <span className="font-mono">#{formatOfferNumber(L.id)}</span></p>
                </div>
                <button onClick={() => setDetailLead(null)} aria-label="Close" className="shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 text-[#dcdcdc] hover:bg-white/10 hover:text-white cursor-pointer transition">✕</button>
              </div>

              <div className="p-5 space-y-4 text-sm">
                {/* Money */}
                <div className="flex flex-wrap gap-2">
                  {L.quote && <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"><span className="text-[#8a8a8a] text-xs">Quote</span> <span className="font-extrabold">{L.quote}</span></span>}
                  {typeof L.totalPayout === "number" && <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"><span className="text-[#8a8a8a] text-xs">Bundle total</span> <span className="font-extrabold">${L.totalPayout}</span></span>}
                  {L.payout && <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"><span className="text-[#8a8a8a] text-xs">Payout</span> <span className="font-semibold">{L.payout}</span></span>}
                  {typeof L.resellEstimate === "number" && <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"><span className="text-[#8a8a8a] text-xs">Resell est.</span> <span className="font-semibold">${L.resellEstimate}</span></span>}
                </div>

                {/* Contact */}
                <Section title="Contact">
                  <div className="space-y-0.5 text-[#d4d4d4]">
                    {L.phone && <p><span className="text-[#8a8a8a]">Phone:</span> <span className="text-white">{L.phone}</span></p>}
                    {L.email && <p className="break-all"><span className="text-[#8a8a8a]">Email:</span> <span className="text-white">{L.email}</span></p>}
                    {L.bestContact && <p><span className="text-[#8a8a8a]">Best contact:</span> <span className="text-white uppercase">{L.bestContact}</span></p>}
                    {L.phone && <p><span className="text-[#8a8a8a]">SMS opt-in:</span> <span className="text-white">{L.smsOptIn ? "yes" : "no"}</span></p>}
                    {(L.priorLeads ?? 0) > 0 && <p><span className="text-[#8a8a8a]">Prior leads:</span> <span className="text-white">{L.priorLeads}{typeof L.lifetimeSpend === "number" ? ` · lifetime $${L.lifetimeSpend}` : ""}</span></p>}
                  </div>
                </Section>

                {/* Devices */}
                <Section title={L.devices && L.devices.length > 0 ? `Devices (${L.deviceCount || L.devices.length})` : "Device"}>
                  {L.devices && L.devices.length > 0 ? (
                    <div className="space-y-3">
                      {L.devices.map((d, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                          <p className="font-semibold text-white flex flex-wrap items-center gap-x-2">
                            <span className="text-[#8a8a8a] font-mono">{i + 1}.</span>
                            {d.model}
                            {d.storage && <span className="text-[#c5c5c5] font-normal">· {d.storage}</span>}
                            {d.condition && <span className="text-[#c5c5c5] font-normal">· {d.condition}</span>}
                            {d.quote != null && (d.quote > 0 ? <span className="text-[#00c853] font-bold">· ${d.quote}</span> : <span className="text-amber-300 font-bold">· Manual review</span>)}
                            {d.quantity && d.quantity > 1 ? <span className="text-[#c5c5c5] font-normal">×{d.quantity}</span> : null}
                          </p>
                          {specPairs(d).length > 0 && (
                            <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                              {specPairs(d).map(([k, v]) => <p key={k} className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">{k}:</span> <span className="text-white">{v}</span></p>)}
                            </div>
                          )}
                          {(d.brokenGlass || d.brokenFunctional === false || d.paidOff === false) && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {d.brokenGlass && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/15 text-orange-200 border border-orange-500/30">{d.brokenGlass.toUpperCase()} GLASS</span>}
                              {d.brokenFunctional === false && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-100 border border-red-500/40">NOT FUNCTIONAL</span>}
                              {d.paidOff === false && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-100 border border-amber-500/40">BALANCE OWED</span>}
                            </div>
                          )}
                          {d.photos && d.photos.length > 0 && <div className="mt-2">{photoGrid(d.photos)}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="text-white font-medium">{[L.model || L.device, L.storage, L.condition, L.carrier].filter(Boolean).join(" · ") || "—"}</p>
                      {specPairs(L).length > 0 && (
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                          {specPairs(L).map(([k, v]) => <p key={k} className="text-[#c5c5c5]"><span className="text-[#8a8a8a]">{k}:</span> <span className="text-white">{v}</span></p>)}
                        </div>
                      )}
                      {(L.brokenGlass || L.brokenFunctional === false || L.paidOff === false) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {L.brokenGlass && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/15 text-orange-200 border border-orange-500/30">{L.brokenGlass.toUpperCase()} GLASS</span>}
                          {L.brokenFunctional === false && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-100 border border-red-500/40">NOT FUNCTIONAL</span>}
                          {L.paidOff === false && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-100 border border-amber-500/40">BALANCE OWED</span>}
                        </div>
                      )}
                    </div>
                  )}
                </Section>

                {/* IMEI warnings */}
                {L.imeiWarnings && L.imeiWarnings.length > 0 && (
                  <Section title="IMEI warnings">
                    <ul className="list-disc list-inside text-yellow-300 space-y-0.5">
                      {L.imeiWarnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </Section>
                )}

                {/* All photos (uncapped) */}
                {L.photos && L.photos.length > 0 && (
                  <Section title={`Photos (${L.photos.length})`}>
                    {photoGrid(L.photos)}
                  </Section>
                )}

                {/* Handoff */}
                {(L.handoffMethod || L.shipAddress || L.localSlot || L.fedexTracking) && (
                  <Section title="Handoff">
                    <div className="space-y-0.5 text-[#d4d4d4]">
                      {L.handoffMethod && <p><span className="text-[#8a8a8a]">Method:</span> <span className="text-white">{L.handoffMethod === "ship" ? "📦 Ship" : "🤝 Local meetup"}</span></p>}
                      {L.shipAddress && <p><span className="text-[#8a8a8a]">Address:</span> <span className="text-white">{L.shipAddress}</span></p>}
                      {L.localArea && <p><span className="text-[#8a8a8a]">Area:</span> <span className="text-white">{L.localArea}</span></p>}
                      {L.localSlot && <p><span className="text-[#8a8a8a]">Slot:</span> <span className="text-white">{L.localSlot}</span></p>}
                      {L.fedexTracking && <p><span className="text-[#8a8a8a]">FedEx:</span> <span className="text-white font-mono">{L.fedexTracking}</span>{L.fedexLabelUrl && <a href={L.fedexLabelUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#00c853] hover:underline">label →</a>}</p>}
                    </div>
                  </Section>
                )}

                {/* Notes */}
                {(L.customerNote || L.latestNote) && (
                  <Section title="Notes">
                    {L.customerNote && <p className="text-[#d4d4d4]"><span className="text-[#8a8a8a]">Customer:</span> <span className="text-white">{L.customerNote}</span></p>}
                    {L.latestNote && <p className="text-[#d4d4d4]"><span className="text-[#8a8a8a]">Staff note:</span> <span className="text-white">{L.latestNote}</span>{L.noteCount ? <span className="text-[#8a8a8a]"> ({L.noteCount})</span> : null}</p>}
                  </Section>
                )}

                {/* AI */}
                {L.ai && (L.ai.flag || L.ai.summary || L.ai.note) && (
                  <Section title="AI">
                    {L.ai.flag && <p className="text-red-300">🚩 {L.ai.flag.body}</p>}
                    {L.ai.summary && <p className="text-[#d4d4d4]">🤖 {L.ai.summary.fromName === "Theot" ? "Theot" : "AI"}: {L.ai.summary.body}</p>}
                    {L.ai.note && !L.ai.flag && !L.ai.summary && <p className="text-[#d4d4d4]">🤖 {L.ai.note.body}</p>}
                  </Section>
                )}

                {/* Source / attribution */}
                {L.source && (L.source.raw || L.source.source) && (
                  <Section title="Source">
                    <p className="text-[#d4d4d4] break-all text-xs font-mono">{L.source.raw || [L.source.source, L.source.medium, L.source.campaign].filter(Boolean).join(" · ")}</p>
                  </Section>
                )}

                {/* Payout confirmation / ID */}
                {(L.payoutConfirmation || L.idCaptured) && (
                  <Section title="Settlement">
                    {L.payoutConfirmation && <p className="text-[#d4d4d4]"><span className="text-[#8a8a8a]">Paid:</span> <span className="text-white">{typeof L.payoutConfirmation.amount === "number" ? `$${L.payoutConfirmation.amount} ` : ""}{L.payoutConfirmation.method || ""}{L.payoutConfirmation.reference ? ` · ${L.payoutConfirmation.reference}` : ""}</span></p>}
                    {L.idCaptured && <p className="text-[#d4d4d4]"><span className="text-[#8a8a8a]">ID:</span> <span className="text-white">{L.idCaptured.type} ···{L.idCaptured.last4} ({L.idCaptured.dobYear})</span>{L.idCaptured.photoUrl && <a href={L.idCaptured.photoUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#00c853] hover:underline">photo →</a>}</p>}
                  </Section>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* CUSTOMER HISTORY MODAL — clicking an email or phone on a lead
          row opens this drawer with every previous lead that matches.
          Repeat-seller intel: lifetime value, prior disputes, currently
          open trades. Closes on backdrop click or Esc. */}
      {historyKey && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-[fadeIn_0.135s_ease-out]"
          onClick={() => setHistoryKey(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-white/15 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#0a0a0a] border-b border-white/10 px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-1">Customer history</p>
                <h2 className="text-xl font-bold text-white truncate">{historyKey.value}</h2>
                <p className="text-xs text-[#a0a0a0] mt-1">
                  {historyLeads.length} {historyLeads.length === 1 ? "lead" : "leads"}
                  {historyTotalPaid > 0 && <span className="text-[#00c853]"> · ${historyTotalPaid} lifetime paid</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryKey(null)}
                aria-label="Close"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {historyLeads.length === 0 ? (
                <p className="text-[#888] text-sm italic">No leads found.</p>
              ) : (
                historyLeads.map((h) => {
                  const m = statusMeta(h.status);
                  return (
                    <div key={h.id} className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-bold truncate">{h.model || h.device || "—"}</p>
                          <p className="text-[#bdbdbd] text-xs mt-0.5">
                            {[h.storage, h.condition, h.carrier].filter(Boolean).join(" · ")}
                          </p>
                          <p className="text-[#888] text-[11px] mt-1">{timeAgo(h.timestamp)} · {new Date(h.timestamp).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {h.quote && <p className="text-[#00c853] font-bold text-base">{h.quote}</p>}
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: m.color + "22", color: m.color, border: `1px solid ${m.color}55` }}>{m.label}</span>
                        </div>
                      </div>
                      {h.latestNote && (
                        <p className="text-[11px] text-[#d4d4d4] mt-2 bg-white/[0.03] border-l-2 border-[#00c853]/40 pl-2 py-1">
                          <span className="text-[#888] uppercase tracking-wider text-[9px] font-bold">Note: </span>
                          {h.latestNote.slice(0, 200)}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {/* Counter-offer modal. Opens when staff clicks "Counter-offer" on
          any lead row. POSTs to /api/admin/leads/counter-offer which
          mints a tokenized accept-or-decline link and sends the
          customer SMS + email. */}
      {counterOfferLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !counterOfferSending) closeCounterOffer(); }}
        >
          <div className="w-full max-w-lg bg-[#0f0f0f] border border-purple-500/30 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-purple-300 font-bold">💬 Counter-offer</p>
                <h2 className="text-lg font-bold text-white mt-0.5">{counterOfferLead.name || counterOfferLead.id}</h2>
                <p className="text-[11px] text-[#888] mt-0.5">{counterOfferLead.model || counterOfferLead.device}{counterOfferLead.storage ? ` · ${counterOfferLead.storage}` : ""}{counterOfferLead.condition ? ` · ${counterOfferLead.condition}` : ""}</p>
              </div>
              <button
                type="button"
                onClick={closeCounterOffer}
                disabled={counterOfferSending}
                className="text-[#888] hover:text-white text-lg leading-none px-1 cursor-pointer disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3 flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#888] font-bold">Original quote</span>
              <span className="text-2xl font-bold text-[#00c853]">{counterOfferLead.quote || "—"}</span>
            </div>

            <label className="block text-[10px] uppercase tracking-wider text-[#dcdcdc] font-bold mb-1">Revised offer ($)</label>
            <input
              type="number"
              min="0"
              value={counterOfferAmount}
              onChange={(e) => setCounterOfferAmount(e.target.value)}
              disabled={counterOfferSending}
              autoFocus
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-base text-white focus:outline-none focus:border-purple-400 transition mb-3 disabled:opacity-50"
              placeholder="e.g. 320"
            />

            <label className="block text-[10px] uppercase tracking-wider text-[#dcdcdc] font-bold mb-1">Reason (customer sees this verbatim)</label>
            <textarea
              value={counterOfferReason}
              onChange={(e) => setCounterOfferReason(e.target.value)}
              disabled={counterOfferSending}
              rows={4}
              maxLength={500}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white leading-relaxed focus:outline-none focus:border-purple-400 transition resize-none disabled:opacity-50"
              placeholder="Be honest and specific. e.g. 'Back glass has a hairline crack we couldn't see in your photos. Otherwise everything functions perfectly.'"
            />
            <p className="text-[10px] text-[#888] mt-1">{counterOfferReason.length}/500 · Goes verbatim in their SMS + email.</p>

            {counterOfferError && (
              <p className="text-[11px] text-red-300 mt-2">⚠️ {counterOfferError}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={submitCounterOffer}
                disabled={counterOfferSending || !counterOfferAmount.trim() || counterOfferReason.trim().length < 10}
                className="flex-1 px-4 py-2.5 bg-gradient-to-b from-purple-500 to-purple-600 text-white font-bold text-sm rounded-full hover:from-purple-400 hover:to-purple-500 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {counterOfferSending ? "Sending…" : `Send revised offer${counterOfferAmount ? ` ($${counterOfferAmount})` : ""}`}
              </button>
              <button
                type="button"
                onClick={closeCounterOffer}
                disabled={counterOfferSending}
                className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm text-[#dcdcdc] hover:bg-white/10 cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
            <p className="text-[10px] text-[#666] mt-3 leading-relaxed">
              Customer gets a SMS{counterOfferLead.email ? " + email" : ""} with an accept/decline link. Accept → we pay {counterOfferLead.payout || "via their chosen method"}. Decline → we ship back free.
            </p>
          </div>
        </div>
      )}
      {counterOfferSentFor && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 px-4 py-2 rounded-lg shadow-lg text-sm font-bold">
          ✓ Counter-offer sent
        </div>
      )}
      <DeviceCorrection
        lead={correctingLead}
        token={token}
        onClose={() => setCorrectingLead(null)}
        onSaved={() => { fetchLeads(); }}
      />
    </main>
  );
}
