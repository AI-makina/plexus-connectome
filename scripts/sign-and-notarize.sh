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
# Auto-detect the installed Developer ID identities (override via env if needed).
APP_ID="${APP_ID:-$(security find-identity -v -p codesigning | grep -o 'Developer ID Application: [^"]*' | head -1)}"
INSTALLER_ID="${INSTALLER_ID:-$(security find-identity -v | grep -o 'Developer ID Installer: [^"]*' | head -1)}"
NOTARY_PROFILE="${NOTARY_PROFILE:-plexus-notary}"
[ -n "$APP_ID" ] || { echo "✗ no Developer ID Application identity in keychain"; exit 1; }
[ -n "$INSTALLER_ID" ] || { echo "✗ no Developer ID Installer identity in keychain"; exit 1; }
echo "  app identity:       $APP_ID"
echo "  installer identity: $INSTALLER_ID"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Must match package.js: build/sign OUTSIDE any iCloud-synced folder, or sync
# re-stamps FinderInfo mid-sign and breaks verification/notarization.
BUILD="${PLEXUS_BUILD_DIR:-${TMPDIR:-/tmp}/plexus-build}"
BUILD="${BUILD%/}"
APP="$BUILD/Plexus.app"
ENT="$ROOT/packaging/entitlements.plist"
VERSION="$(node -p "require('$ROOT/package.json').version")"
PKG="$BUILD/Plexus-$VERSION.pkg"
COMPONENT="$BUILD/Plexus-component.pkg"

[ -d "$APP" ] || { echo "✗ $APP not found — run: node scripts/package.js"; exit 1; }
case "$APP" in
  "$HOME"/Desktop/*|"$HOME"/Documents/*)
    echo "✗ $APP is under an iCloud-synced folder — sign from a temp dir (unset PLEXUS_BUILD_DIR)."; exit 1;;
esac
echo "⬡ Signing Plexus $VERSION"

# 0. Strip Finder metadata / extended attributes / resource forks — codesign
#    refuses to seal a bundle that carries any ("resource fork … not allowed").
echo "  · cleaning bundle metadata…"
xattr -cr "$APP"
find "$APP" \( -name '.DS_Store' -o -name '._*' \) -delete 2>/dev/null || true

# 1. Sign inside-out: every Mach-O (native .node addons, dylibs, the bundled node),
#    then the app itself, all under the hardened runtime with Node's entitlements.
#    Candidates are filtered through `file` so a stray non-binary named "node"
#    (e.g. pdf-parse/dist/node/) is skipped, not fed to codesign.
echo "  · signing nested binaries…"
{
  echo "$APP/Contents/Resources/node"
  find "$APP/Contents/Resources/app" -type f \( -name '*.node' -o -name '*.dylib' -o -name '*.so' \)
} | while IFS= read -r f; do
  [ -f "$f" ] || continue
  file "$f" | grep -q 'Mach-O' || continue
  codesign --force --timestamp --options runtime --entitlements "$ENT" --sign "$APP_ID" "$f"
done

echo "  · signing Plexus.app…"
codesign --force --timestamp --options runtime --entitlements "$ENT" --sign "$APP_ID" "$APP"
# codesign on Sequoia can leave a FinderInfo xattr on the bundle root; it is not
# part of the seal, so strip it before --strict verification.
xattr -d com.apple.FinderInfo "$APP" 2>/dev/null || true
codesign --verify --deep --strict --verbose=2 "$APP"
echo "  ✓ app signature valid"

# 2. Build the installer and sign it with the Installer identity.
echo "  · building installer…"
rm -f "$COMPONENT" "$PKG"
pkgbuild --root "$APP" --scripts "$ROOT/packaging/pkg-scripts" \
  --install-location "/Applications/Plexus.app" \
  --identifier io.skyfynd.plexus --version "$VERSION" "$COMPONENT"
# Present a click-through License Agreement (Agree / Disagree) during install,
# straight from the canonical EULA. This is the upfront legal gate in the
# installer itself; the binding, per-customer acceptance is still recorded
# in-app at activation (step 1), tied to the customer + terms version.
PKGRES="$BUILD/pkg-resources"
DIST="$BUILD/distribution.xml"
rm -rf "$PKGRES"; mkdir -p "$PKGRES"
cp "$ROOT/docs/PLEXUS_EULA.md" "$PKGRES/license.txt"
cat > "$DIST" <<XML
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="1">
    <title>Plexus</title>
    <license file="license.txt" mime-type="text/plain"/>
    <options customize="never" require-scripts="false"/>
    <choices-outline><line choice="default"><line choice="io.skyfynd.plexus"/></line></choices-outline>
    <choice id="default"/>
    <choice id="io.skyfynd.plexus" visible="false"><pkg-ref id="io.skyfynd.plexus"/></choice>
    <pkg-ref id="io.skyfynd.plexus" version="$VERSION" onConclusion="none">Plexus-component.pkg</pkg-ref>
</installer-gui-script>
XML
productbuild --distribution "$DIST" --resources "$PKGRES" --package-path "$BUILD" \
  --sign "$INSTALLER_ID" "$PKG"
rm -f "$COMPONENT" "$DIST"; rm -rf "$PKGRES"
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
