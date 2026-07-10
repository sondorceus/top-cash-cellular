"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEVICES } from "../../data/sell-catalog";
import { DEVICE_IMAGES } from "../../lib/device-images";
import { LISTING_GRADES, GRADE_LABEL, type ListingGrade } from "../../lib/shop-grades";
import { suggestListing, toCents, fromCents } from "../../lib/shop-pricing";
import type { ShopListing } from "../../lib/shop-listings";

// Posting cockpit. Flow: type the model (datalist from the sell catalog —
// category, stock image and shipping family auto-fill), pick grade, punch in
// what you paid, and the price suggests itself from RESELL_ESTIMATES with the
// margin math shown. Photos are optional but they're the store's whole edge.
//
// Client-side suggestListing note: comp-economics reads TCC_* env vars at
// module scope; in the client bundle those are undefined, so the defaults
// (13% / $0.40 / per-family shipping) apply. Same numbers the server uses in
// prod today — the env overrides are unset there too.

const TOKEN_KEY = "tcc-admin-token";

// sell-catalog category → familyForSku() prefix, for shipping cost in the
// margin math. Desktop rides the laptop rate — closest of the seven families.
const CAT_TO_SKU: Record<string, string> = {
  iPhone: "ip",
  Samsung: "gs",
  Pixel: "px",
  iPad: "ipad",
  MacBook: "mbp",
  Watch: "aw",
  Console: "ps",
  Desktop: "mbp",
  Dell: "mbp",
};

const CARRIERS = ["Unlocked", "AT&T", "T-Mobile", "Verizon"];
const STORAGE_OPTS = ["64GB", "128GB", "256GB", "512GB", "1TB", "2TB"];

const money = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

// Vercel rejects request bodies over ~4.5MB BEFORE the upload route runs, so
// a raw iPhone photo (often 5-8MB) died silently at the platform door — that
// is how "I uploaded 3, only 1 showed" happened: the one under the limit
// survived. Downscale in the browser first: 1800px long edge, JPEG q0.85,
// which lands listing photos at ~300-700KB. As a bonus, Safari decodes HEIC
// natively here, so iPhone captures convert to universally-viewable JPEG.
const MAX_EDGE = 1800;
const VERCEL_BODY_LIMIT = 4.4 * 1024 * 1024;

async function compressPhoto(f: File): Promise<{ blob: Blob; name: string } | null> {
  try {
    const bmp = await createImageBitmap(f);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size === 0) return null;
    return { blob, name: (f.name.replace(/\.\w+$/, "") || "photo") + ".jpg" };
  } catch {
    // Browser couldn't decode this format (e.g. HEIC outside Safari) —
    // caller falls back to the original bytes.
    return null;
  }
}

type Draft = {
  modelLabel: string;
  storage: string;
  color: string;
  carrier: string;
  grade: ListingGrade;
  batteryPct: string;
  costUsd: string;
  priceUsd: string;
  notes: string;
  photos: string[];
};

const EMPTY_DRAFT: Draft = {
  modelLabel: "",
  storage: "",
  color: "",
  carrier: "Unlocked",
  grade: "excellent",
  batteryPct: "",
  costUsd: "",
  priceUsd: "",
  notes: "",
  photos: [],
};

export default function AdminShopPage() {
  const [token, setToken] = useState("");
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [flash, setFlash] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // Photo editor for an already-posted listing — the fix path when a photo
  // failed at post time and the listing is live with fewer than intended.
  const [photoEdit, setPhotoEdit] = useState<{ id: string; photos: string[] } | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const getToken = useCallback((): string | null => {
    let t = token || localStorage.getItem(TOKEN_KEY) || "";
    if (!t) {
      const prompted = window.prompt("Admin token? (will remember in this browser)");
      if (!prompted) return null;
      t = prompted;
      localStorage.setItem(TOKEN_KEY, t);
    }
    setToken(t);
    return t;
  }, [token]);

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    try {
      const r = await fetch("/api/admin/shop", { headers: { "x-admin-token": t }, cache: "no-store" });
      if (r.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setFlash("Bad token — reload to re-enter.");
        return;
      }
      const d = await r.json();
      setListings(Array.isArray(d.listings) ? d.listings : []);
    } catch {
      setFlash("Couldn't load listings.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- catalog assists -------------------------------------------------
  const catalogMatch = useMemo(
    () => DEVICES.find((d) => d.name.toLowerCase() === draft.modelLabel.trim().toLowerCase()) ?? null,
    [draft.modelLabel],
  );
  const category = catalogMatch?.category ?? "Other";
  const familySku = CAT_TO_SKU[category] ?? "ip";
  const stockImage = DEVICE_IMAGES[draft.modelLabel.trim()] ?? undefined;

  // ----- live price suggestion -------------------------------------------
  const suggestion = useMemo(() => {
    if (!draft.modelLabel.trim() || !draft.costUsd) return null;
    const cost = parseFloat(draft.costUsd);
    if (!Number.isFinite(cost) || cost < 0) return null;
    return suggestListing({
      modelLabel: draft.modelLabel.trim(),
      sku: familySku,
      grade: draft.grade,
      costPaid: cost,
    });
  }, [draft.modelLabel, draft.costUsd, draft.grade, familySku]);

  // ----- photo upload -----------------------------------------------------
  // Compress → upload each file, narrating progress and reporting every
  // failure BY NAME at the end. The old version let a later success wipe an
  // earlier failure's flash message, which is why dropped photos went
  // unnoticed.
  const uploadFiles = async (files: FileList, room: number): Promise<string[]> => {
    const t = getToken();
    if (!t) return [];
    setUploading(true);
    const urls: string[] = [];
    const failed: string[] = [];
    const batch = Array.from(files).slice(0, room);
    for (let i = 0; i < batch.length; i++) {
      const f = batch[i];
      setFlash(`Uploading photo ${i + 1} of ${batch.length}…`);
      const small = await compressPhoto(f);
      const body = small?.blob ?? f;
      const name = small?.name ?? f.name;
      if (body.size > VERCEL_BODY_LIMIT) {
        failed.push(`${f.name} (too large — couldn't shrink it in this browser)`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", new File([body], name, { type: small ? "image/jpeg" : f.type }));
      try {
        const r = await fetch("/api/upload", { method: "POST", headers: { "x-admin-token": t }, body: fd });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.url) urls.push(d.url);
        else failed.push(`${f.name} (${d.error || `server said ${r.status}`})`);
      } catch {
        failed.push(`${f.name} (network)`);
      }
    }
    setUploading(false);
    if (files.length > room) failed.push(`${files.length - room} skipped — 8-photo cap`);
    setFlash(
      failed.length
        ? `${urls.length} of ${batch.length} uploaded. FAILED: ${failed.join("; ")}`
        : `${urls.length} photo${urls.length === 1 ? "" : "s"} uploaded.`,
    );
    return urls;
  };

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const urls = await uploadFiles(files, 8 - draft.photos.length);
    if (urls.length) setDraft((dr) => ({ ...dr, photos: [...dr.photos, ...urls].slice(0, 8) }));
    if (fileRef.current) fileRef.current.value = "";
  };

  // ----- actions -----------------------------------------------------------
  const post = async () => {
    const t = getToken();
    if (!t) return;
    const price = parseFloat(draft.priceUsd);
    if (!draft.modelLabel.trim()) return setFlash("Model is required.");
    if (!Number.isFinite(price) || price < 1) return setFlash("Set a price.");
    setPosting(true);
    setFlash("");
    try {
      const r = await fetch("/api/admin/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": t },
        body: JSON.stringify({
          modelLabel: draft.modelLabel.trim(),
          category,
          familySku,
          storage: draft.storage || undefined,
          color: draft.color || undefined,
          carrier: draft.carrier,
          grade: draft.grade,
          batteryPct: draft.batteryPct ? Number(draft.batteryPct) : undefined,
          priceCents: toCents(price),
          costCents: draft.costUsd ? toCents(parseFloat(draft.costUsd)) : undefined,
          photos: draft.photos,
          stockImage,
          notes: draft.notes || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setFlash(d.error || "Post failed.");
      } else {
        setFlash(`Live: ${draft.modelLabel} at ${money(d.listing.priceCents)} → /shop/${d.listing.id}`);
        setDraft(EMPTY_DRAFT);
        await load();
      }
    } catch {
      setFlash("Post failed — network.");
    } finally {
      setPosting(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const t = getToken();
    if (!t) return;
    try {
      const r = await fetch("/api/admin/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": t },
        body: JSON.stringify({ id, ...body }),
      });
      if (!r.ok) setFlash((await r.json()).error || "Update failed.");
      await load();
    } catch {
      setFlash("Update failed — network.");
    }
  };

  const markSold = (l: ShopListing) => {
    const v = window.prompt(`Final sale price for the ${l.modelLabel}?`, (l.priceCents / 100).toFixed(0));
    if (v == null) return;
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n < 0) return setFlash("Bad price.");
    patch(l.id, { status: "sold", soldPriceCents: toCents(n) });
  };

  const addEditPhotos = async (files: FileList | null) => {
    if (!files?.length || !photoEdit) return;
    const urls = await uploadFiles(files, 8 - photoEdit.photos.length);
    if (urls.length) setPhotoEdit((pe) => (pe ? { ...pe, photos: [...pe.photos, ...urls].slice(0, 8) } : pe));
    if (editFileRef.current) editFileRef.current.value = "";
  };

  const savePhotoEdit = async () => {
    if (!photoEdit) return;
    await patch(photoEdit.id, { photos: photoEdit.photos });
    setPhotoEdit(null);
    setFlash("Photos saved — live now.");
  };

  const editPrice = (l: ShopListing) => {
    const v = window.prompt(`New list price for the ${l.modelLabel}?`, (l.priceCents / 100).toFixed(0));
    if (v == null) return;
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n < 1) return setFlash("Bad price.");
    patch(l.id, { priceCents: toCents(n) });
  };

  // ----- stats --------------------------------------------------------------
  const active = listings.filter((l) => l.status === "listed");
  const held = listings.filter((l) => l.status === "on_hold");
  const sold = listings.filter((l) => l.status === "sold");
  const invValue = active.reduce((s, l) => s + l.priceCents, 0);

  const inputCls =
    "w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#00c853]/60";
  const lblCls = "block text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#63636e] mb-1.5";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <h1 className="text-2xl font-bold mb-1">Shop</h1>
        <p className="text-sm text-[#9aa3b2] mb-6">
          Post a device and it&apos;s live at <span className="text-[#00c853] font-semibold">/shop</span> instantly.
          Claims land in your inbox and put the listing on hold.
        </p>

        {/* stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            ["For sale", String(active.length)],
            ["On hold", String(held.length)],
            ["Sold", String(sold.length)],
            ["Inventory value", money(invValue)],
          ].map(([t, v]) => (
            <div key={t} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#63636e]">{t}</div>
              <div className="text-xl font-extrabold mt-1">{v}</div>
            </div>
          ))}
        </div>

        {/* post form */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-8">
          <div className="text-sm font-bold mb-4">Post a device</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <label className={lblCls}>Model</label>
              <input
                className={inputCls}
                list="tcc-models"
                placeholder="iPhone 14 Pro"
                value={draft.modelLabel}
                onChange={(e) => setDraft({ ...draft, modelLabel: e.target.value })}
              />
              <datalist id="tcc-models">
                {DEVICES.map((d) => (
                  <option key={d.slug} value={d.name} />
                ))}
              </datalist>
              <div className="text-[11px] text-[#63636e] mt-1">
                {catalogMatch ? `${category} · ships as ${familySku}` : draft.modelLabel ? "Not in catalog — manual price" : ""}
                {stockImage ? " · stock photo found" : ""}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lblCls}>Storage</label>
                <input className={inputCls} list="tcc-storage" placeholder="256GB" value={draft.storage} onChange={(e) => setDraft({ ...draft, storage: e.target.value })} />
                <datalist id="tcc-storage">
                  {STORAGE_OPTS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={lblCls}>Color</label>
                <input className={inputCls} placeholder="Space Black" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lblCls}>Carrier</label>
                <select className={inputCls} value={draft.carrier} onChange={(e) => setDraft({ ...draft, carrier: e.target.value })}>
                  {CARRIERS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lblCls}>Battery %</label>
                <input className={inputCls} type="number" min={1} max={100} placeholder="92" value={draft.batteryPct} onChange={(e) => setDraft({ ...draft, batteryPct: e.target.value })} />
              </div>
            </div>

            <div>
              <label className={lblCls}>Grade</label>
              <div className="flex gap-2">
                {LISTING_GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setDraft({ ...draft, grade: g })}
                    className={`flex-1 rounded-xl border px-2 py-2 text-sm font-bold transition ${
                      draft.grade === g ? "border-[#00c853] bg-[#00c853]/10 text-[#00c853]" : "border-white/15 bg-white/5 text-[#9aa3b2] hover:border-white/30"
                    }`}
                  >
                    {GRADE_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lblCls}>Paid (cost $)</label>
                <input className={inputCls} type="number" min={0} placeholder="180" value={draft.costUsd} onChange={(e) => setDraft({ ...draft, costUsd: e.target.value })} />
              </div>
              <div>
                <label className={lblCls}>List price $</label>
                <input className={inputCls} type="number" min={1} placeholder="285" value={draft.priceUsd} onChange={(e) => setDraft({ ...draft, priceUsd: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={lblCls}>Notes (public)</label>
              <input className={inputCls} placeholder="Includes original box" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={400} />
            </div>
          </div>

          {/* suggestion panel */}
          {suggestion && (
            <div
              className={`mt-4 rounded-xl border p-3.5 text-sm ${
                suggestion.needsManualPrice
                  ? "border-white/15 bg-white/5 text-[#9aa3b2]"
                  : suggestion.belowTargetMargin
                    ? "border-[#ffb400]/40 bg-[#ffb400]/10"
                    : "border-[#00c853]/40 bg-[#00c853]/10"
              }`}
            >
              {suggestion.needsManualPrice ? (
                <span>{suggestion.reason}</span>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span>
                    Market ≈ <strong>${suggestion.marketPrice!.toFixed(0)}</strong>
                  </span>
                  <span>
                    Suggested <strong>${suggestion.suggestedPrice!.toFixed(2)}</strong>
                  </span>
                  <span>
                    Net after fees+ship <strong>${suggestion.netAtSuggested!.toFixed(0)}</strong>
                  </span>
                  <span className={suggestion.belowTargetMargin ? "text-[#ffb400] font-bold" : "text-[#00c853] font-bold"}>
                    {Math.round(suggestion.marginAtSuggested! * 100)}% margin
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, priceUsd: suggestion.suggestedPrice!.toFixed(2) })}
                    className="ml-auto bg-[#00c853] text-[#0a0a0a] px-4 py-1.5 rounded-full text-xs font-bold hover:bg-[#00e676] transition"
                  >
                    Use ${suggestion.suggestedPrice!.toFixed(2)}
                  </button>
                </div>
              )}
              {suggestion.belowTargetMargin && !suggestion.needsManualPrice && (
                <div className="text-xs text-[#ffb400] mt-2">{suggestion.reason}</div>
              )}
            </div>
          )}

          {/* photos */}
          <div className="mt-4">
            <label className={lblCls}>Photos of this unit (up to 8 — they sell the phone)</label>
            <div className="flex flex-wrap gap-2 items-center">
              {draft.photos.map((u) => (
                <div key={u} className="relative w-16 h-16 rounded-xl bg-white/5 border border-white/15 p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, photos: draft.photos.filter((p) => p !== u) })}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#ff6b6b] text-black text-xs font-bold leading-none"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || draft.photos.length >= 8}
                className="w-16 h-16 rounded-xl border border-dashed border-white/25 text-[#9aa3b2] text-2xl hover:border-[#00c853]/60 hover:text-[#00c853] transition disabled:opacity-40"
              >
                {uploading ? "…" : "+"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => uploadPhotos(e.target.files)} />
              {stockImage && draft.photos.length === 0 && (
                <span className="text-[11px] text-[#63636e]">No photos → stock image is used.</span>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <button
              onClick={post}
              disabled={posting}
              className="bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-full font-bold hover:bg-[#00e676] transition disabled:opacity-60"
            >
              {posting ? "Posting…" : "Post it live"}
            </button>
            {flash && <span className="text-sm text-[#9aa3b2]">{flash}</span>}
          </div>
        </div>

        {/* listings */}
        <div className="text-sm font-bold mb-3">
          Listings {loading ? "…" : `(${listings.length})`}
        </div>
        <div className="space-y-2">
          {listings.map((l) => {
            const margin =
              l.costCents != null && l.priceCents > 0
                ? Math.round(((l.priceCents - l.costCents) / l.priceCents) * 100)
                : null;
            const img = l.photos[0] || l.stockImage;
            const pill =
              l.status === "listed"
                ? "text-[#00c853] border-[#00c853]/40 bg-[#00c853]/10"
                : l.status === "on_hold"
                  ? "text-[#ffb400] border-[#ffb400]/40 bg-[#ffb400]/10"
                  : l.status === "sold"
                    ? "text-[#9aa3b2] border-white/15 bg-white/5"
                    : "text-[#ff6b6b] border-[#ff6b6b]/40 bg-[#ff6b6b]/10";
            return (
              <div key={l.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 flex items-center gap-3 flex-wrap">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 p-1 flex-shrink-0">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="w-full h-full object-contain" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate">
                    {[l.modelLabel, l.storage, l.color].filter(Boolean).join(" ")}
                  </div>
                  <div className="text-[11px] text-[#63636e]">
                    {GRADE_LABEL[l.grade]} · {l.carrier}
                    {l.batteryPct ? ` · ${l.batteryPct}%` : ""} ·{" "}
                    <a href={`/shop/${l.id}`} target="_blank" className="underline hover:text-white">
                      view
                    </a>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold">{money(l.priceCents)}</div>
                  <div className="text-[11px] text-[#63636e]">
                    {l.costCents != null ? `paid ${money(l.costCents)}` : "no cost"}
                    {margin != null ? ` · ${margin}%` : ""}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border uppercase tracking-wide ${pill}`}>
                  {l.status.replace("_", " ")}
                </span>
                <div className="flex gap-1.5">
                  {l.status !== "sold" && (
                    <button onClick={() => markSold(l)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 border border-white/15 hover:border-[#00c853]/60 transition">
                      Sold
                    </button>
                  )}
                  {l.status === "listed" && (
                    <button onClick={() => patch(l.id, { status: "on_hold" })} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 border border-white/15 hover:border-[#ffb400]/60 transition">
                      Hold
                    </button>
                  )}
                  {(l.status === "on_hold" || l.status === "sold") && (
                    <button onClick={() => patch(l.id, { status: "listed" })} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 border border-white/15 hover:border-[#00c853]/60 transition">
                      Relist
                    </button>
                  )}
                  {l.status !== "removed" && (
                    <button onClick={() => editPrice(l)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 border border-white/15 hover:border-white/40 transition">
                      Price
                    </button>
                  )}
                  {l.status !== "removed" && l.status !== "sold" && (
                    <button
                      onClick={() => setPhotoEdit(photoEdit?.id === l.id ? null : { id: l.id, photos: l.photos })}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        photoEdit?.id === l.id
                          ? "bg-[#00c853]/10 border-[#00c853]/60 text-[#00c853]"
                          : "bg-white/5 border-white/15 hover:border-[#00c853]/60"
                      }`}
                    >
                      Photos ({l.photos.length})
                    </button>
                  )}
                  {l.status !== "sold" && (
                    <button
                      onClick={() => window.confirm(`Remove the ${l.modelLabel}? It disappears from the shop.`) && patch(l.id, { status: "removed" })}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 border border-white/15 hover:border-[#ff6b6b]/60 transition"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {photoEdit?.id === l.id && (
                  <div className="basis-full mt-2 pt-3 border-t border-white/10">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#63636e] mb-2">
                      Edit photos — changes go live on save
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {photoEdit.photos.map((u) => (
                        <div key={u} className="relative w-16 h-16 rounded-xl bg-white/5 border border-white/15 p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="" className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => setPhotoEdit((pe) => (pe ? { ...pe, photos: pe.photos.filter((p) => p !== u) } : pe))}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#ff6b6b] text-black text-xs font-bold leading-none"
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => editFileRef.current?.click()}
                        disabled={uploading || photoEdit.photos.length >= 8}
                        className="w-16 h-16 rounded-xl border border-dashed border-white/25 text-[#9aa3b2] text-2xl hover:border-[#00c853]/60 hover:text-[#00c853] transition disabled:opacity-40"
                      >
                        {uploading ? "…" : "+"}
                      </button>
                      <input ref={editFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addEditPhotos(e.target.files)} />
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={savePhotoEdit}
                          disabled={uploading}
                          className="bg-[#00c853] text-[#0a0a0a] px-5 py-2 rounded-full text-xs font-bold hover:bg-[#00e676] transition disabled:opacity-60"
                        >
                          Save photos
                        </button>
                        <button
                          onClick={() => setPhotoEdit(null)}
                          className="px-4 py-2 rounded-full text-xs font-bold bg-white/5 border border-white/15 hover:border-white/40 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!loading && listings.length === 0 && (
            <div className="text-sm text-[#63636e] py-6">Nothing posted yet — the form above puts your first device live.</div>
          )}
        </div>
      </div>
    </div>
  );
}
