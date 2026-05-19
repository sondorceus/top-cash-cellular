"use client";

// Shared Google Identity Services button. Renders the official GSI
// pill button into a container and decodes the returned JWT payload
// to email/name/sub/picture. Used by:
//   - app/page.tsx (homepage checkout returning-customer section)
//   - app/account/page.tsx (account dashboard sign-in form)
//
// Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID in the environment; without
// it the button shows a visible "not configured" notice. The GSI
// loader script (accounts.google.com/gsi/client) is loaded site-wide
// from app/layout.tsx so any page can drop this in without extra
// scaffolding.

import { useEffect, useRef, useState } from "react";

export type GoogleCredentialPayload = { email?: string; name?: string; sub?: string; picture?: string };

// We deliberately don't `declare global { Window }` here — app/page.tsx
// already publishes a richer Window.google declaration (includes the
// maps.places types) and we'd conflict. Cast through unknown inside
// this module instead.
type GsiClient = {
  accounts: {
    id: {
      initialize: (cfg: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
      renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};
function getGsi(): GsiClient | null {
  const w = window as unknown as { google?: GsiClient };
  return w.google?.accounts?.id ? w.google : null;
}

export function decodeJwtPayload(token: string): GoogleCredentialPayload | null {
  try {
    const seg = token.split(".")[1];
    if (!seg) return null;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}

export function GoogleSignInButton({ onCredential, width = 320, text = "continue_with" }: {
  onCredential: (p: GoogleCredentialPayload) => void;
  width?: number;
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const onCredentialRef = useRef(onCredential);
  useEffect(() => { onCredentialRef.current = onCredential; }, [onCredential]);

  useEffect(() => {
    if (!clientId) {
      setError("Google sign-in is not configured (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID).");
      return;
    }
    let cancelled = false;
    let tries = 0;
    const tryInit = () => {
      if (cancelled) return;
      const g = getGsi();
      if (!g) {
        if (++tries > 50) { setError("Google sign-in failed to load. Please refresh."); return; }
        setTimeout(tryInit, 100);
        return;
      }
      try {
        g.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => {
            const payload = decodeJwtPayload(resp.credential);
            if (payload) onCredentialRef.current(payload);
            else setError("Couldn't read Google credential. Try again.");
          },
        });
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          g.accounts.id.renderButton(containerRef.current, {
            theme: "outline", size: "large", text, shape: "pill", width,
          });
        }
      } catch (e) {
        setError(`Google sign-in init failed: ${String(e)}`);
      }
    };
    tryInit();
    return () => { cancelled = true; };
  }, [clientId, text, width]);

  return (
    <div>
      <div ref={containerRef} className="flex justify-center" />
      {error && <p className="text-[#ff5566] text-xs font-semibold mt-2 text-center">{error}</p>}
    </div>
  );
}
