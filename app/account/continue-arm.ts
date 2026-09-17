import { useEffect, useRef, useState } from "react";

// Arming for the "Sign in as …?" Continue button on /account (R9).
//
// DoubleClickjacking (Paulos Yibelo, evil.blog 2024-12): a hostile page opens
// a "double-click here" window and points ITSELF at our confirm link; the
// lure closes on the first press and the second press lands on Continue.
// The page is really top-level and the fetch really same-origin, so neither
// X-Frame-Options, SameSite nor the Sec-Fetch-Site check stops it. A press
// on Continue therefore only counts when it starts
//   - ARM_MS after this page became visible AND focused (the lure's second
//     press comes sooner — OS double-click windows top out under 1 s),
//   - ARM_MS after any earlier press here (a burst of clicks never lands),
//   - and, for a mouse, after the person moved it / scrolled / pressed a key
//     here (the published fix). Moves the OS fakes when a covering window
//     closes come at once, so ones inside GESTURE_MIN_MS don't count.
// Keyboard / screen-reader activation (no pointer press) needs only the
// first rule: an outside page can't focus our button for them.

export const ARM_MS = 1000;
export const GESTURE_MIN_MS = 250;

export type Arm = {
  liveSince: number; // visible + focused since (0 = not now)
  gestureAt: number; // first counted move / scroll / key since then (0 = none)
  lastPress: number; // latest pointer press since then (0 = none)
};
export const ARM_OFF: Arm = { liveSince: 0, gestureAt: 0, lastPress: 0 };

export type ArmEvent =
  | { type: "live"; at: number }
  | { type: "dead" }
  | { type: "gesture"; at: number }
  | { type: "press"; at: number };

export function armStep(s: Arm, e: ArmEvent): Arm {
  switch (e.type) {
    case "dead":
      return ARM_OFF;
    case "live":
      return s.liveSince ? s : { ...ARM_OFF, liveSince: e.at };
    case "gesture":
      if (!s.liveSince || s.gestureAt || e.at < s.liveSince + GESTURE_MIN_MS) return s;
      return { ...s, gestureAt: e.at };
    case "press":
      return s.liveSince ? { ...s, lastPress: e.at } : s;
  }
}

// May a press that starts at `at` sign in? Judge it BEFORE its own "press"
// step. `mouse` = a mouse press, which also needs a gesture first.
export function pressAllowed(s: Arm, at: number, mouse: boolean): boolean {
  if (!s.liveSince || at < s.liveSince + ARM_MS) return false;
  if (s.lastPress && at < s.lastPress + ARM_MS) return false;
  return !mouse || (s.gestureAt > 0 && s.gestureAt <= at);
}

// `lit`: what Continue should look like (a press now would count).
// `accept(event.detail)`: call from Continue's onClick; false = ignore it.
export function useContinueArm(active: boolean): { lit: boolean; accept: (detail: number) => boolean } {
  const arm = useRef<Arm>(ARM_OFF);
  // Verdict on the latest pointer press — a click always follows its own
  // pointerdown in this document.
  const press = useRef<boolean | null>(null);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    if (!active) return;
    arm.current = ARM_OFF;
    press.current = null;
    // Touch-only screens have no pointer to move: they light up on time.
    const mouseFirst = !window.matchMedia?.("(hover: none)")?.matches;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const step = (e: ArmEvent) => { arm.current = armStep(arm.current, e); };
    const relight = () => {
      const now = Date.now();
      const s = arm.current;
      setLit(pressAllowed(s, now, mouseFirst));
      clearTimeout(timer);
      const wake = s.liveSince ? Math.max(s.liveSince, s.lastPress) + ARM_MS : 0;
      if (wake > now) timer = setTimeout(relight, wake - now + 1);
    };
    // `input`: a press / key reached this page, so it has focus even where
    // hasFocus() lags (a press is what focuses a window).
    const sync = (input = false) => {
      const live = document.visibilityState === "visible" && (input || document.hasFocus());
      step(live ? { type: "live", at: Date.now() } : { type: "dead" });
    };
    const onFocusChange = () => { sync(); relight(); };
    const onPress = (e: PointerEvent) => {
      const at = Date.now();
      sync(true);
      press.current = pressAllowed(arm.current, at, e.pointerType === "mouse");
      step({ type: "press", at });
      relight();
    };
    const onKey = () => { sync(true); step({ type: "gesture", at: Date.now() }); relight(); };
    // A move doesn't imply focus (it reaches a window behind a popup too).
    const onMove = () => { step({ type: "gesture", at: Date.now() }); relight(); };

    sync();
    relight();
    const opts = { capture: true, passive: true };
    window.addEventListener("focus", onFocusChange);
    window.addEventListener("blur", onFocusChange);
    document.addEventListener("visibilitychange", onFocusChange);
    window.addEventListener("pointerdown", onPress, opts);
    window.addEventListener("keydown", onKey, opts);
    window.addEventListener("pointermove", onMove, opts);
    window.addEventListener("wheel", onMove, opts);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocusChange);
      window.removeEventListener("blur", onFocusChange);
      document.removeEventListener("visibilitychange", onFocusChange);
      window.removeEventListener("pointerdown", onPress, opts);
      window.removeEventListener("keydown", onKey, opts);
      window.removeEventListener("pointermove", onMove, opts);
      window.removeEventListener("wheel", onMove, opts);
      arm.current = ARM_OFF;
      setLit(false);
    };
  }, [active]);

  const accept = (detail: number): boolean => {
    // detail 0 = keyboard / screen reader: no pointer press to judge.
    if (detail === 0) return pressAllowed(arm.current, Date.now(), false);
    const ok = press.current === true;
    press.current = null;
    return ok;
  };
  return { lit, accept };
}
