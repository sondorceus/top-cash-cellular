import Link from "next/link";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "../../lib/auth";
import { SignOutSwitch } from "./SignOutSwitch";

// Shown when a Google-authed user lands on /admin but isn't in the
// allowlist. Stops the infinite Google-bounce loop and gives them a
// clear next step. Skywalker 2026-05-17.
export default async function ForbiddenPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get(COOKIE_NAME)?.value);
  const email = session?.email || "";
  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-7 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Not authorized</h1>
        <p className="text-[#d4d4d4] text-sm mb-1">
          {email
            ? <>You&apos;re signed in as <span className="text-white font-semibold">{email}</span>, but that account isn&apos;t on the staff allowlist.</>
            : "Your account isn't on the staff allowlist."}
        </p>
        <p className="text-[#888] text-xs mb-6">If you should have access, ask Sky to add your Gmail to <code className="text-[#bbb]">ADMIN_GOOGLE_EMAILS</code>.</p>
        <div className="flex flex-col gap-2">
          <SignOutSwitch />
          <Link
            href="/"
            className="w-full inline-block bg-white/5 border border-white/10 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-white/10 transition"
          >
            Back to Top Cash
          </Link>
        </div>
      </div>
    </main>
  );
}
