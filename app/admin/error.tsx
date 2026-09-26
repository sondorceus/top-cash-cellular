"use client";
// Error boundary for the owner console. Without one a render throw blanked
// the whole page with nothing to tap; this keeps the owner one tap from a
// retry and shows the message so it can be reported.

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
        <h1 className="text-lg font-bold mb-1">The console hit an error</h1>
        <p className="text-[#dcdcdc] text-xs mb-4 break-words">{error?.message || "Unknown error"}{error?.digest ? ` · ${error.digest}` : ""}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="w-full bg-[#00c853] text-[#0a0a0a] py-2.5 rounded-xl text-sm font-bold hover:bg-[#00e676] transition cursor-pointer"
        >
          Try again
        </button>
        <a href="/admin" className="block mt-3 text-xs text-[#aab0c2] underline">Reload the leads page</a>
      </div>
    </main>
  );
}
