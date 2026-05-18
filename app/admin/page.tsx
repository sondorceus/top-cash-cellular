"use client";

import { useEffect, useState, useCallback } from "react";

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
  hoursToAutoPurge?: number;
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

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<Record<string, { sms: boolean; email: boolean } | null>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
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
  const [view, setView] = useState<"active" | "trash">("active");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  // Customer history modal — opens when staff clicks a lead's email or
  // phone. Shows every lead (paid + pending + rejected) from the same
  // identity so repeat sellers, lifetime value, and prior disputes are
  // visible at a glance. Built client-side off the leads array.
  const [historyKey, setHistoryKey] = useState<{ kind: "email" | "phone"; value: string } | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
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

  // Tracks per-lead "Copied!" flash for the review-link button.
  // Skywalker 2026-05-17: "give them to ask for reviews" — admin needs a
  // one-click way to grab a personalized review URL per customer.
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const copyReviewLink = async (lead: Lead) => {
    const params = new URLSearchParams();
    if (lead.name) params.set("name", lead.name);
    const dev = lead.model || lead.device;
    if (dev) params.set("device", dev);
    const qs = params.toString();
    const url = `https://topcashcellular.com/reviews/new${qs ? `?${qs}` : ""}`;
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
  const generateLabel = async (lead: Lead) => {
    if (!token) return;
    const addr = parseShipAddress(lead.shipAddress);
    if (!addr) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: "Couldn't parse shipping address" }));
      return;
    }
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
        // Optimistic update — admin auto-refresh will overwrite from MC.
        setLeads((cur) => cur.map((l) => l.id === lead.id ? { ...l, fedexTracking: d.tracking, fedexLabelUrl: d.labelUrl, fedexService: d.serviceType } : l));
      }
    } catch (e) {
      setLabelErrorById((s) => ({ ...s, [lead.id]: e instanceof Error ? e.message : "Network error" }));
    } finally {
      setLabelGeneratingId(null);
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
    try {
      const r = await fetch(`/api/admin/leads?token=${encodeURIComponent(token)}&view=${view}`, { cache: "no-store" });
      if (r.status === 401) {
        setError("Invalid token");
        setToken("");
        localStorage.removeItem("tcc-admin-token");
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setLeads(d.leads || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [token, view]);

  // Soft-trash a lead. Posts a [DELETED-LEAD: <id>] marker comm to MC.
  // The lead disappears from the Active view but stays recoverable in
  // the Trash view for 24h before auto-purge. Skywalker 2026-05-17
  // "save my quotes for 24hr".
  const deleteLead = useCallback(async (lead: Lead) => {
    if (!token) return;
    const label = lead.name || lead.email || lead.phone || lead.id;
    const ok = confirm(`Move "${label}" to Trash?\n\nThe lead will be hidden from the Active feed but stays recoverable in Trash for 24 hours. After 24h it auto-purges.`);
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
      // Optimistic — remove from current list. Next auto-refresh will
      // re-confirm via the deleted-marker filter.
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (e) {
      setError(e instanceof Error ? `Delete failed: ${e.message}` : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }, [token]);

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
      // Optimistic — remove from current Trash view. Next auto-refresh
      // will surface it back in Active.
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (e) {
      setError(e instanceof Error ? `Restore failed: ${e.message}` : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchLeads();
  }, [token, fetchLeads]);

  // Auto-refresh every 15s while tab is visible. Diff against the previous
  // snapshot and pulse-highlight any row whose status changed.
  useEffect(() => {
    if (!token || !autoRefresh) return;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const r = await fetch(`/api/admin/leads?token=${encodeURIComponent(token)}&view=${view}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        const next: Lead[] = d.leads || [];
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
  }, [token, autoRefresh, view]);

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
    const needle = q.toLowerCase();
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
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(needle);
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
    let payoutLatencySum = 0;
    let payoutLatencyN = 0;
    const payoutTally: Record<string, number> = {};
    for (const l of list) {
      const ts = new Date(l.timestamp).getTime();
      if (ts >= weekAgo) thisWeek++;
      if (ts >= monthAgo) thisMonth++;
      if (isPaid(l.status)) paidCount++;
      if (l.status !== "rejected") nonRejectedCount++;
      const dollars = l.quote?.match(/\d+/)?.[0];
      const dollarValue = dollars ? parseInt(dollars, 10) : 0;
      if (dollarValue > 0) { quoteSum += dollarValue; quoteN++; }
      // Revenue = sum of paid quotes (all-time and this-month)
      if (isPaid(l.status) && dollarValue > 0) {
        revenue += dollarValue;
        if (l.statusUpdatedAt && new Date(l.statusUpdatedAt).getTime() >= monthAgo) revenueMonth += dollarValue;
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
    return { total: list.length, thisWeek, thisMonth, conversionRate, avgQuote, topPayouts, revenue, revenueMonth, avgPayoutHours, paidCount };
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
  const historyTotalPaid = historyLeads
    .filter((l) => isPaid(l.status))
    .reduce((s, l) => s + (parseInt(l.quote?.match(/\d+/)?.[0] || "0", 10) || 0), 0);

  const saveStatus = async (lead: Lead, newStatus: string, reason?: string) => {
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
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">TCC Staff Ops</h1>
            <p className="text-[#dcdcdc] text-sm">
              {(() => {
                const statusFiltered = filteredLeads.filter((l) => {
                  if (statusFilter === "all") return true;
                  if (statusFilter === "active") return !isPaid(l.status) && l.status !== "rejected";
                  if (statusFilter === "completed") return isPaid(l.status) || l.status === "rejected";
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
          <div className="flex items-center gap-2">
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
            {/* Active / Trash toggle. Trashed leads stay recoverable for
                24h before auto-purge. Skywalker 2026-05-17. */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setView("active")}
                className={`px-3 py-2 transition cursor-pointer ${view === "active" ? "bg-[#00c853]/15 text-[#00c853]" : "text-[#dcdcdc] hover:bg-white/10"}`}
                title="Show active leads"
              >Active</button>
              <button
                onClick={() => setView("trash")}
                className={`px-3 py-2 transition cursor-pointer border-l border-white/10 ${view === "trash" ? "bg-amber-500/15 text-amber-300" : "text-[#dcdcdc] hover:bg-white/10"}`}
                title="Show trashed leads (auto-purge after 24h)"
              >🗑 Trash</button>
            </div>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              title={autoRefresh ? "Auto-refresh ON (every 5s)" : "Auto-refresh OFF"}
              className={`px-3 py-2 border rounded-lg text-xs font-semibold transition cursor-pointer ${autoRefresh ? "bg-[#00c853]/15 border-[#00c853]/40 text-[#00c853]" : "bg-white/5 border-white/10 text-[#dcdcdc] hover:bg-white/10"}`}
            >
              {autoRefresh ? "🟢 Live" : "⏸ Paused"}
            </button>
            <button onClick={fetchLeads} disabled={loading} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition disabled:opacity-50 cursor-pointer">
              {loading ? "Loading…" : "Refresh"}
            </button>
            {/* CSV export — dumps the current filtered view (after
                search + status filter) as a CSV file. Includes status,
                payout, margin, contact, spec fields, photo count. */}
            <button
              onClick={() => {
                const view = filteredLeads.filter((l) => {
                  if (statusFilter === "all") return true;
                  if (statusFilter === "active") return !isPaid(l.status) && l.status !== "rejected";
                  if (statusFilter === "completed") return isPaid(l.status) || l.status === "rejected";
                  return l.status === statusFilter;
                });
                exportFilteredCsv(view);
              }}
              disabled={filteredLeads.length === 0}
              title="Download the current filtered view as CSV (Sheets/Excel/QuickBooks)"
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition disabled:opacity-40 cursor-pointer"
            >
              📥 Export CSV
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition cursor-pointer">
              Sign out
            </button>
          </div>
        </div>

        {leads.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-4">
            <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl p-3 col-span-2 md:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-[#00c853] font-bold">💵 Revenue (this month)</p>
              <p className="text-2xl font-extrabold text-[#00c853] mt-0.5">${stats.revenueMonth.toLocaleString()}</p>
              <p className="text-[10px] text-[#dcdcdc] mt-0.5">${stats.revenue.toLocaleString()} all-time · {stats.paidCount} paid</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#c5c5c5] font-bold">This week</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">{stats.thisWeek}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#c5c5c5] font-bold">This month</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">{stats.thisMonth}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#c5c5c5] font-bold">Conversion</p>
              <p className="text-2xl font-extrabold text-[#00c853] mt-0.5">{stats.conversionRate}%</p>
              <p className="text-[10px] text-[#c5c5c5] mt-0.5">paid / non-rejected</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#c5c5c5] font-bold">Avg payout</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">{stats.avgPayoutHours > 0 ? (stats.avgPayoutHours < 48 ? `${Math.round(stats.avgPayoutHours)}h` : `${(stats.avgPayoutHours / 24).toFixed(1)}d`) : "—"}</p>
              <p className="text-[10px] text-[#c5c5c5] mt-0.5">created → paid</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 col-span-2 md:col-span-1">
              <p className="text-[10px] uppercase tracking-wider text-[#c5c5c5] font-bold">Avg quote</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">${stats.avgQuote}</p>
              {stats.topPayouts.length > 0 && (
                <p className="text-[10px] text-[#dcdcdc] mt-0.5 truncate" title={stats.topPayouts.map(([p, n]) => `${p} (${n})`).join(", ")}>
                  Top payout: {stats.topPayouts[0][0]}
                </p>
              )}
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
              const isCompleted = (s: string) => s === "paid" || s === "rejected";
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
                if (value !== "all" && value !== "active" && count === 0) return null;
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

        {leads.length === 0 && !loading && !error && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-[#dcdcdc]">No leads yet.</p>
          </div>
        )}

        {leads.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[auto_1fr_1.4fr_1.6fr_1.4fr_auto] gap-4 px-5 py-3 bg-white/5 text-xs font-semibold text-[#dcdcdc] uppercase tracking-wider border-b border-white/10 items-center">
              <div className="w-4">
                <input
                  type="checkbox"
                  aria-label="Select all visible"
                  checked={(() => {
                    const visible = filteredLeads.filter((l) => {
                      if (statusFilter === "all") return true;
                      if (statusFilter === "active") return !isPaid(l.status) && l.status !== "rejected";
                      if (statusFilter === "completed") return isPaid(l.status) || l.status === "rejected";
                      if (statusFilter === "stale") return isStale(l);
                      return l.status === statusFilter;
                    });
                    return visible.length > 0 && visible.every((l) => selectedIds.has(l.id));
                  })()}
                  onChange={(e) => {
                    const visible = filteredLeads.filter((l) => {
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
              {filteredLeads.filter((l) => {
                if (statusFilter === "all") return true;
                if (statusFilter === "active") return !isPaid(l.status) && l.status !== "rejected";
                if (statusFilter === "completed") return isPaid(l.status) || l.status === "rejected";
                if (statusFilter === "stale") return isStale(l);
                return l.status === statusFilter;
              }).map((lead) => {
                const current = pendingStatus[lead.id] ?? lead.status;
                const meta = statusMeta(current);
                return (
                  <li key={lead.id} className={`px-5 py-4 grid md:grid-cols-[auto_1fr_1.4fr_1.6fr_1.4fr_auto] gap-4 items-center hover:bg-white/[0.02] transition ${selectedIds.has(lead.id) ? "bg-[#00c853]/5" : ""} ${recentlyChanged[lead.id] ? "animate-[pulse_2s_ease-out_2] ring-1 ring-[#00c853]/40" : ""}`}>
                    <div className="w-4">
                      <input type="checkbox" aria-label={`Select ${lead.name || lead.id}`} checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="cursor-pointer accent-[#00c853]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                        {lead.name || "—"}
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
                        {[lead.storage, lead.condition].filter(Boolean).join(" · ")}
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
                                  {d.quote != null && <span className="text-[#00c853] font-bold">· ${d.quote}</span>}
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
                            <span className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-[#dcdcdc]">+{lead.photos.length - 3}</span>
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
                                      onClick={() => generateLabel(lead)}
                                      disabled={labelGeneratingId === lead.id}
                                      className="text-[10px] font-bold px-2 py-1 rounded bg-white/5 border border-white/10 text-[#dcdcdc] hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
                                      title="Generate a new label (replaces the current one)"
                                    >
                                      {labelGeneratingId === lead.id ? "Regenerating…" : "↻ Regenerate"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => generateLabel(lead)}
                                    disabled={labelGeneratingId === lead.id || !lead.shipAddress || !lead.phone}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded bg-sky-500/15 border border-sky-500/40 text-sky-200 hover:bg-sky-500/25 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={!lead.shipAddress ? "No shipping address on file" : !lead.phone ? "Customer phone required" : "Generate FedEx prepaid drop-off label"}
                                  >
                                    {labelGeneratingId === lead.id ? "Generating FedEx label…" : "📄 Generate FedEx label"}
                                  </button>
                                  {labelErrorById[lead.id] && (
                                    <p className="text-[10px] text-red-300 mt-1">⚠️ {labelErrorById[lead.id]}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
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
                      {/* Review-link grab — one click puts the per-customer
                          review URL on the clipboard so Skywalker can text
                          or hand it to them after the meetup. */}
                      <button
                        type="button"
                        onClick={() => copyReviewLink(lead)}
                        className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold transition cursor-pointer px-2 py-1 rounded border ${copiedLinkId === lead.id ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-[#ffb400]/10 border-[#ffb400]/30 text-[#ffd54f] hover:bg-[#ffb400]/20"}`}
                        title="Copy a review link prefilled with this customer's name + device"
                      >
                        {copiedLinkId === lead.id ? "✓ Copied! Paste in SMS or print/QR" : "★ Copy review link"}
                      </button>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-[#00c853]">{lead.quote || "—"}</p>
                      {lead.marginPercent != null && lead.grossMargin != null && (
                        <div className={`mt-1 px-2 py-1 rounded-md text-[11px] font-bold ${lead.marginFlag === "low" ? "bg-red-500/15 border border-red-500/30" : lead.marginFlag === "thin" ? "bg-yellow-500/15 border border-yellow-500/30" : "bg-emerald-500/15 border border-emerald-500/30"}`}>
                          <span className={lead.marginFlag === "low" ? "text-red-400" : lead.marginFlag === "thin" ? "text-yellow-400" : "text-emerald-400"}>
                            {lead.marginFlag === "low" ? "⚠️ LOW" : lead.marginFlag === "thin" ? "⚡ THIN" : "✅ GOOD"}
                          </span>
                          <span className="text-white ml-1">You make ${lead.grossMargin}</span>
                          <span className="text-[#999] ml-1">({lead.marginPercent}%)</span>
                          <br />
                          <span className="text-[#888]">Sells for ~${lead.resellEstimate} on Swappa/eBay</span>
                        </div>
                      )}
                      {lead.marginFlag === "manual" && (
                        <div className="mt-1 px-2 py-1 rounded-md text-[11px] font-bold bg-orange-500/15 border border-orange-500/30">
                          <span className="text-orange-400">📋 Manual quote needed</span>
                          <span className="text-[#888] ml-1">— check Swappa/eBay before offering</span>
                        </div>
                      )}
                      <p className="text-[#c5c5c5] text-xs">{lead.payout}</p>
                      {adjustingId !== lead.id && (
                        <button type="button" onClick={() => { setAdjustingId(lead.id); setAdjustQuote(""); setAdjustReason(""); }} className="text-[10px] text-[#c5c5c5] hover:text-[#d4d4d4] mt-1 cursor-pointer">✏️ Adjust quote</button>
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
                      {/* Trash / Restore — in Active view this moves the
                          lead to Trash (recoverable for 24h). In Trash
                          view this restores it. Skywalker 2026-05-17
                          "save my quotes for 24hr". */}
                      {view === "trash" ? (
                        <div className="mt-1.5 space-y-1">
                          {typeof lead.hoursToAutoPurge === "number" && (
                            <p className="text-[10px] text-amber-300">⏳ Auto-purge in {lead.hoursToAutoPurge}h</p>
                          )}
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
                <p className="text-xs text-[#00c853]">{bulkProgress.done}/{bulkProgress.total} updated</p>
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
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER HISTORY MODAL — clicking an email or phone on a lead
          row opens this drawer with every previous lead that matches.
          Repeat-seller intel: lifetime value, prior disputes, currently
          open trades. Closes on backdrop click or Esc. */}
      {historyKey && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-[fadeIn_0.15s_ease-out]"
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
    </main>
  );
}
