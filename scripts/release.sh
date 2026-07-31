#!/bin/bash
# ─── Plexus release — one command, direct channel ─────────────────────────────
# build → sign → notarize → upload to R2 → repoint the download URL → redeploy.
# The one deliberate step it does NOT do is notify existing customers — that's
# an operator decision, made by clicking Publish in the dashboard's
# Apps ▸ Updates tab (the script prints the reminder with the exact version).
#
#   scripts/release.sh
#
# Prereqs (already set up): Developer ID certs + `plexus-notary` keychain profile
# (see docs/PACKAGING.md); the OMI repo checked out with its .env.local
# (Cloudflare token). Override the OMI path with OMI_DIR=... if it moves.
set -euo pipefail

PLEXUS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OMI_DIR="${OMI_DIR:-/Users/carlosmario/Desktop/Codes/Webpages/Skyfynd_dashboard/skyfynd-OMI}"
BUCKET="skyfynd-downloads"
DL_BASE="https://downloads.skyfynd.io/plexus"

[ -d "$OMI_DIR" ] || { echo "✗ OMI repo not found at $OMI_DIR (set OMI_DIR=...)"; exit 1; }
[ -f "$OMI_DIR/.env.local" ] || { echo "✗ $OMI_DIR/.env.local (Cloudflare token) missing"; exit 1; }

echo "══════════════════════════════════════════"
echo " ⬡ Plexus release"
echo "══════════════════════════════════════════"

# 1. Build the customer artifact (bumps the version via stamp).
cd "$PLEXUS_DIR"
echo "▸ building…"
node scripts/package.js
VERSION="$(node -p "require('./package.json').version")"
echo "  version $VERSION"

# 2. Sign + notarize + build the .pkg (needs your Developer ID; may pop a
#    keychain prompt the first time — click Always Allow).
echo "▸ signing + notarizing…"
scripts/sign-and-notarize.sh
BUILD="${PLEXUS_BUILD_DIR:-${TMPDIR:-/tmp}/plexus-build}"; BUILD="${BUILD%/}"
PKG="$BUILD/Plexus-$VERSION.pkg"
[ -f "$PKG" ] || { echo "✗ notarized pkg not found: $PKG"; exit 1; }

# 3. Upload to R2 — --remote is MANDATORY (without it wrangler writes to a local
#    simulator and the real bucket stays empty → public 404).
echo "▸ uploading to R2 (remote)…"
cd "$OMI_DIR"
# Export the Cloudflare token explicitly — process-substitution sourcing
# (source <(grep ...)) didn't survive set -e reliably here, leaving wrangler
# to fall back to an expired OAuth login.
export CLOUDFLARE_API_TOKEN="$(grep -E '^CLOUDFLARE_API_TOKEN=' .env.local | head -1 | cut -d= -f2-)"
export CLOUDFLARE_ACCOUNT_ID="$(grep -E '^CLOUDFLARE_ACCOUNT_ID=' .env.local | head -1 | cut -d= -f2-)"
[ -n "$CLOUDFLARE_API_TOKEN" ] || { echo "✗ CLOUDFLARE_API_TOKEN not found in $OMI_DIR/.env.local"; exit 1; }
npx wrangler r2 object put "$BUCKET/plexus/Plexus-$VERSION.pkg" \
  --file "$PKG" --content-type application/octet-stream --remote
# verify it actually serves before repointing anything
if curl -sfI "$DL_BASE/Plexus-$VERSION.pkg" >/dev/null; then
  echo "  ✓ live at $DL_BASE/Plexus-$VERSION.pkg"
else
  echo "✗ uploaded but $DL_BASE/Plexus-$VERSION.pkg is not serving — aborting before repoint"; exit 1
fi

# 4. Repoint the dashboard's download link at the new version + redeploy.
echo "▸ repointing download URL + redeploying dashboard…"
sed -i '' -E "s#(NEXT_PUBLIC_PLEXUS_DOWNLOAD_URL\": \"$DL_BASE/)Plexus-[0-9.]+\.pkg#\1Plexus-$VERSION.pkg#" wrangler.jsonc
if git diff --quiet wrangler.jsonc; then
  echo "  (download URL already current)"
else
  git add wrangler.jsonc
  git commit -q -m "release: Plexus $VERSION download URL"
  git pull --rebase --quiet origin main || true
  git push -q origin main
fi
npm run deploy >/dev/null 2>&1 && echo "  ✓ dashboard deployed"

echo ""
echo "✅ Plexus $VERSION released to the direct channel."
echo "   Installer:  $DL_BASE/Plexus-$VERSION.pkg"
echo ""
echo "   Existing customers are NOT notified yet — that's your call:"
echo "   open the dashboard ▸ Apps ▸ Updates, publish version $VERSION"
echo "   (add release notes + this URL) to send the in-app 'update available'."
