# Packaging Plexus for customers (macOS)

Two commands turn the repo into a customer-ready installer:

```bash
node scripts/package.js         # build the app (Claude can run this)
scripts/sign-and-notarize.sh    # sign + notarize (YOU run this — needs Apple ID)
```

## What `package.js` produces

A **self-contained** `build/Plexus.app` — the customer needs no Node, no
checkout, nothing preinstalled. Inside:

- **Bytecode, not source.** Every one of our modules is compiled to V8 bytecode
  (`.jsc`); each `.js` is a one-line loader stub. There is no readable source in
  the artifact. (Native `.node` addons like better-sqlite3 ship as-is — they are
  already compiled binaries, not source.)
- **Operator UI removed.** `managerPage` is physically replaced by an empty stub
  — the manager/CRM code is not present, on top of the runtime edition gate.
- **User edition baked.** `edition.json = user`; `/manager` and every operator
  endpoint 404.
- **Integrity seal.** `integrity.json` lists every code file; a salted expected
  digest is baked (in bytecode) into the integrity module. At boot the app
  recomputes and, on mismatch, reports `integrity_ok:false` on its heartbeat →
  the operator console shows a red **tamper detected** badge.
- **Bundled Node runtime** + production `node_modules` only.

Size is ~400 MB (the Node runtime is ~260 MB of it); the `.pkg` compresses to
~135 MB.

### Data-safety invariant

Packaging writes only into `build/`. The installed app writes only its own
location. Neither ever touches `~/.plexus` (registry, license, preferences) or a
customer's project folders — **so installing an update can never wipe a
connectome or a setting.** Updates replace the app; data lives elsewhere and
engine migrations are additive.

## What `sign-and-notarize.sh` does (your step)

Signs the app (Developer ID Application, hardened runtime + Node entitlements
from `packaging/entitlements.plist`), builds and signs the `.pkg` (Developer ID
Installer), submits it to Apple for **notarization**, and staples the ticket —
so it opens on any Mac with no "unidentified developer" warning.

**One-time setup** (Skyfynd's Apple Developer account, already active):

1. Create + install two certificates (Xcode ▸ Settings ▸ Accounts, or
   developer.apple.com): **Developer ID Application** and **Developer ID
   Installer**.
2. Store notarization credentials once:
   ```bash
   xcrun notarytool store-credentials plexus-notary \
     --apple-id "you@skyfynd.io" --team-id "YOURTEAMID" \
     --password "app-specific-password"   # appleid.apple.com ▸ Sign-In & Security
   ```
3. Set `APP_ID` / `INSTALLER_ID` at the top of the script to your exact identity
   names (`security find-identity -v` lists them).

Output: `build/Plexus-<version>.pkg`. Upload it, then set its URL as
`NEXT_PUBLIC_PLEXUS_DOWNLOAD_URL` (invite email) and in **Apps ▸ Updates ▸
download url** (update feed).

## Honest limits

- **Bytecode hides logic, not string constants.** A determined reverse-engineer
  can still read embedded strings and, with effort, defeat any client-side
  integrity check by extracting the baked constants. This raises the bar to
  "serious effort," which is all client-side protection can ever do — the
  durable moat is the server side (licensing, the fleet) and Developer ID
  signing, which the OS enforces.
- **Node version.** The bundle ships the build machine's Node (currently v25).
  For a shipping product, pin an even-numbered **LTS** (build on that Node so the
  bytecode matches) before public release.
- **Not yet App-Sandbox-compatible.** This artifact is the **Developer-ID
  direct-distribution** build (the JetBrains/Sublime model) — correct for the VPS
  channel and the beta. The Mac App Store track (App Sandbox + StoreKit) is a
  later phase.
