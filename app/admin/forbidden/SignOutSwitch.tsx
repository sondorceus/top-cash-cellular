"use client";

// Small client island for the forbidden page: clears the session via
// /api/auth/signout, then bounces straight to /api/auth/google so Google
// shows the account-picker (prompt=select_account) and the user can sign
// in with a different Gmail.
export function SignOutSwitch() {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await fetch("/api/auth/signout", { method: "POST" });
        } catch {}
        window.location.href = "/api/auth/google?returnTo=%2Fadmin";
      }}
      className="w-full bg-white text-[#1a1a1a] py-2.5 rounded-xl text-sm font-bold hover:bg-[#f0f0f0] transition cursor-pointer"
    >
      Sign out &amp; switch account
    </button>
  );
}
