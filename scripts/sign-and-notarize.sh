#!/bin/bash
# ─── Plexus · sign, package, notarize (macOS) ─────────────────────────────────
# Turns build/Plexus.app (from `node scripts/package.js`) into a Gatekeeper-clean,
# notarized Plexus.pkg installer. Run by the OWNER with a Skyfynd Apple Developer
# account — it needs signing identities Claude never handles.
#
# ONE-TIME SETUP (Apple Developer Program, $99/yr — already active for Skyfynd):
#   1. In Xcode ▸ Settings ▸ Accounts, or developer.apple.com ▸ Certificates,
#      create BOTH:
#        · "Developer ID Application"   (signs the .app)
#        · "Developer ID Installer"     (signs the .pkg)
#      Download and double-click each to install into your login keychain.
#   2. Store notarization credentials as a keychain profile (once):
#        xcrun notarytool store-credentials plexus-notary \
#          --apple-id "you@skyfynd.io" --team-id "YOURTEAMID" \
#          --password "app-specific-password"   # from appleid.apple.com ▸ Sign-In & Security
#
# THEN, each release:
#        node scripts/package.js
#        scripts/sign-and-notarize.sh
#
# Configure identities here or via env (APP_ID / INSTALLER_ID / NOTARY_PROFILE):
set -euo pipefail
APP_ID="${APP_ID:-Developer ID Application: Skyfynd}"
INSTALLER_ID="${INSTALLER_ID:-Developer ID Installer: Skyfynd}"
NOTARY_PROFILE="${NOTARY_PROFILE:-plexus-notary}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/build/Plexus.app"
ENT="$ROOT/packaging/entitlements.plist"
VERSION="$(node -p "require('$ROOT/package.json').version")"
PKG="$ROOT/build/Plexus-$VERSION.pkg"
COMPONENT="$ROOT/build/Plexus-component.pkg"

[ -d "$APP" ] || { echo "✗ $APP not found — run: node scripts/package.js"; exit 1; }
echo "⬡ Signing Plexus $VERSION"

# 1. Sign inside-out: every Mach-O (native .node addons, dylibs, the bundled node),
#    then the app itself, all under the hardened runtime with Node's entitlements.
echo "  · signing nested binaries…"
while IFS= read -r -d '' f; do
  codesign --force --timestamp --options runtime --entitlements "$ENT" --sign "$APP_ID" "$f"
done < <(find "$APP/Contents/Resources" \( -name '*.node' -o -name '*.dylib' -o -name 'node' \) -print0)

echo "  · signing Plexus.app…"
codesign --force --timestamp --options runtime --entitlements "$ENT" --sign "$APP_ID" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
echo "  ✓ app signature valid"

# 2. Build the installer and sign it with the Installer identity.
echo "  · building installer…"
rm -f "$COMPONENT" "$PKG"
pkgbuild --root "$APP" --install-location "/Applications/Plexus.app" \
  --identifier io.skyfynd.plexus --version "$VERSION" "$COMPONENT"
productbuild --sign "$INSTALLER_ID" --package "$COMPONENT" "$PKG"
rm -f "$COMPONENT"
echo "  ✓ $PKG"

# 3. Notarize (Apple scans + returns a ticket) and staple it into the installer,
#    so it opens cleanly even offline / first-launch.
echo "  · notarizing (Apple scan; a few minutes)…"
xcrun notarytool submit "$PKG" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$PKG"
xcrun stapler validate "$PKG"

echo ""
echo "✅ $PKG"
echo "   Notarized + stapled — opens on any Mac with no Gatekeeper warning."
echo "   Upload it and set its URL as NEXT_PUBLIC_PLEXUS_DOWNLOAD_URL (invite email)"
echo "   and in the update feed (Apps ▸ Updates ▸ download url)."
