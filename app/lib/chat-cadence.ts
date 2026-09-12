// Server-side cadence backstop for the site chat (see app/api/chat/route.ts
// "CADENCE BACKSTOP"). Lives here because a route module may only export
// route handlers.
// A sentence that asks the seller for their number / contact, in the bot's
// own idioms ("drop your number and we'll text it", "can I get your name and
// phone number"). "your number" alone is NOT matched — this bot also says
// "your number" for the price.
const NUMBER_ASK_SENTENCE = /\b(phone number|drop (me |us )?your number|send (me |us )?your number|leave (me |us )?your number|share your number|give (me|us) your number|what'?s your number|your number (so|and) (we|our team|the team)|name and (a |your )?(phone |contact )?number|number (or|\/) email|best (phone )?number|way to reach you)\b/i;
export function stripNumberAsk(reply: string): string {
  const parts = reply.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const kept = parts.filter((p) => !NUMBER_ASK_SENTENCE.test(p));
  if (!kept.length || kept.length === parts.length) return reply;
  return kept.join(" ").replace(/\s+—\s*$/, "").trim();
}


// Same idea for the IMEI: asked last turn, no 15-digit number came back →
// don't ask again this turn (the dead-phone thread asked three times in a
// row, 2026-09-12). Sentences that merely explain WHERE the IMEI is stay
// only if they don't also ask for it.
const IMEI_ASK_SENTENCE = /\b(imei|\*#06#)\b/i;
export function stripImeiAsk(reply: string): string {
  const parts = reply.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const kept = parts.filter((p) => !(IMEI_ASK_SENTENCE.test(p) && /\?|\b(send|grab|give|drop|share|get|dial|check|find|text)\b/i.test(p)));
  if (!kept.length || kept.length === parts.length) return reply;
  return kept.join(" ").trim();
}
