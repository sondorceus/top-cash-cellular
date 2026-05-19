#!/usr/bin/env bash
# One-shot secret rotator for Vercel env vars.
# Skywalker 2026-05-19. Easier than the 3-step CLI dance.
#
# USAGE:
#   ./scripts/rotate-secret.sh CRON_SECRET            # auto-generates new random hex
#   ./scripts/rotate-secret.sh FEDEX_CLIENT_SECRET    # prompts for the new value
#   ./scripts/rotate-secret.sh TWILIO_AUTH_TOKEN      # same — works for any var
#
# Steps it does for you:
#   1. Generates (CRON_SECRET) OR prompts for the new value
#   2. Removes the old Vercel env var
#   3. Adds the new value (production env)
#   4. Confirms it landed
#   5. Reminds you Vercel auto-redeploys
#
# Requires: vercel CLI signed in (run `vercel login` first if not).
set -euo pipefail

VAR="${1:-}"
if [ -z "$VAR" ]; then
  echo "usage: $0 <ENV_VAR_NAME>"
  echo "examples:"
  echo "  $0 CRON_SECRET              (auto-generates)"
  echo "  $0 FEDEX_CLIENT_SECRET      (prompts paste)"
  exit 1
fi

# Some env vars can be auto-generated safely — they're internal random
# tokens, not tied to a third-party portal.
AUTO_GEN=(CRON_SECRET TCC_ADMIN_TOKEN NEXTAUTH_SECRET)
is_auto_gen() {
  local v="$1"
  for x in "${AUTO_GEN[@]}"; do
    [ "$x" = "$v" ] && return 0
  done
  return 1
}

if is_auto_gen "$VAR"; then
  echo "ℹ️  $VAR is internal-only — auto-generating a fresh 64-char hex secret..."
  NEW_VALUE=$(openssl rand -hex 32)
  echo "    new value preview: ${NEW_VALUE:0:8}*** (length ${#NEW_VALUE})"
else
  echo "ℹ️  $VAR comes from an external portal (FedEx, Twilio, etc.)."
  echo "    Go to that portal, regenerate, then paste the new value below."
  echo
  read -rsp "Paste new value (input hidden, press Enter when done): " NEW_VALUE
  echo
  if [ -z "$NEW_VALUE" ]; then
    echo "✗ Empty value, aborting."
    exit 1
  fi
  echo "    captured: ${NEW_VALUE:0:6}*** (length ${#NEW_VALUE})"
fi

echo
echo "→ Removing old $VAR from Vercel production..."
vercel env rm "$VAR" production --yes 2>&1 | grep -E "Removed|Error|not found" || true

echo "→ Pushing new value..."
printf "%s" "$NEW_VALUE" | vercel env add "$VAR" production 2>&1 | grep -E "Added|Error|already" || true

echo "→ Verifying..."
TMP=$(mktemp)
vercel env pull "$TMP" --environment=production --yes > /dev/null 2>&1
STORED=$(grep "^$VAR=" "$TMP" | sed 's/^[^=]*=//' | sed 's/^"\(.*\)"$/\1/')
rm -f "$TMP"
if [ "$STORED" = "$NEW_VALUE" ]; then
  echo "✓ Confirmed — Vercel now has the new $VAR (${#STORED} chars)."
else
  echo "✗ Mismatch! Vercel returned ${#STORED}-char value, expected ${#NEW_VALUE}."
  echo "  Run 'vercel env ls | grep $VAR' to check, may need to retry."
  exit 1
fi

echo
echo "Vercel will auto-redeploy in ~45s. Once Ready, the new $VAR is live."
echo "Verify with: vercel ls --prod | head -3"
