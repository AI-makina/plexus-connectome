#!/usr/bin/env node
/* ─── Plexus packager (macOS) ──────────────────────────────────────────────────
 * Produces a self-contained, customer-ready macOS artifact from a user-edition
 * build. Everything the customer runs is inside the .app — no Node, no dev
 * checkout required. Pipeline:
 *   1. fresh user-edition compile (tsc + stamp + edition=user)
 *   2. stage app tree; PHYSICALLY replace managerPage with an empty stub
 *      (the operator UI source never enters the customer artifact)
 *   3. production-only node_modules (native better-sqlite3 rebuilt for the
 *      bundled runtime's ABI) + bytenode
 *   4. bytecode-compile every one of OUR dist files → .jsc, replace each .js
 *      with a loader stub (no readable source ships; native .node untouched)
 *   5. bake the integrity salt + expected root into integrity.jsc, write
 *      integrity.json (the boot self-check's manifest)
 *   6. bundle the Node runtime binary
 *   7. assemble Plexus.app (Info.plist + .icns + launcher) and a .pkg installer
 *
 * INVARIANT (data safety): this writes ONLY into build/. The installed app
 * writes ONLY its own location. Nothing here or in the installer ever touches
 * ~/.plexus (registry, license, prefs) or a customer's project folders — so an
 * update can never wipe a connectome or a setting.
 *
 * Signing + notarization are a separate, credential-gated step:
 * scripts/sign-and-notarize.sh (run by the owner with their Developer ID).
 * ---------------------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const APP = path.join(BUILD, 'Plexus.app');
const CONTENTS = path.join(APP, 'Contents');
const MACOS = path.join(CONTENTS, 'MacOS');
const RES = path.join(CONTENTS, 'Resources');
const APPDIR = path.join(RES, 'app'); // Resources/app — the staged program
const BUNDLE_ID = 'io.skyfynd.plexus';

const log = (m) => console.log(`  ${m}`);
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
const rmrf = (p) => fs.rmSync(p, { recursive: true, force: true });

function copyDir(src, dst, skip = () => false) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name), d = path.join(dst, e.name);
        if (skip(s, e)) continue;
        if (e.isDirectory()) copyDir(s, d, skip);
        else if (e.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(s), d);
        else fs.copyFileSync(s, d);
    }
}

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

// ── 1. Fresh user-edition build ──────────────────────────────────────────────
console.log('\n⬡ Plexus packager\n');
log('building user edition (tsc + edition=user)…');
sh('npm run build:user', { stdio: 'pipe' });
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
log(`version ${pkg.version}`);

// ── 2. Stage the app tree ────────────────────────────────────────────────────
log('staging app tree…');
rmrf(BUILD);
fs.mkdirSync(MACOS, { recursive: true });
fs.mkdirSync(APPDIR, { recursive: true });
copyDir(path.join(ROOT, 'dist'), path.join(APPDIR, 'dist'), (_s, e) => e.name.endsWith('.map'));
copyDir(path.join(ROOT, 'assets'), path.join(APPDIR, 'assets'));
copyDir(path.join(ROOT, 'docs'), path.join(APPDIR, 'docs'), (s) => !s.endsWith('PLEXUS_EULA.md'));
fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(APPDIR, 'package.json'));
fs.copyFileSync(path.join(ROOT, 'edition.json'), path.join(APPDIR, 'edition.json'));

// Prune the operator UI: replace managerPage with an empty stub so launcher's
// unconditional import still resolves, but not one byte of the manager ships.
fs.writeFileSync(path.join(APPDIR, 'dist', 'managerPage.js'),
    'module.exports = { MANAGER_HTML: "" };\n');
log('operator UI pruned from artifact');

// ── 3. Production node_modules (native ABI = bundled runtime) ─────────────────
log('installing production dependencies (rebuilds native modules)…');
sh('npm install --omit=dev --no-audit --no-fund --ignore-scripts=false', {
    cwd: APPDIR, stdio: 'pipe',
});
const nmSize = execSync(`du -sh "${path.join(APPDIR, 'node_modules')}" | cut -f1`).toString().trim();
log(`node_modules: ${nmSize}`);

// ── 4. Bytecode-compile our dist ─────────────────────────────────────────────
log('compiling our code to V8 bytecode…');
const bytenode = require(path.join(APPDIR, 'node_modules', 'bytenode'));
const distDir = path.join(APPDIR, 'dist');
const jsFiles = walk(distDir).filter((f) => f.endsWith('.js'));
let compiled = 0;
for (const js of jsFiles) {
    const src = fs.readFileSync(js, 'utf8');
    const hadShebang = src.startsWith('#!');
    const jsc = js + 'c'; // foo.js → foo.jsc
    // compileFile wraps in the CommonJS module wrapper (exports/require/__dirname),
    // which compileCode does not — so a bytecode module can be require()d.
    if (hadShebang) {
        const tmp = js + '.nb.js';
        fs.writeFileSync(tmp, src.replace(/^#![^\n]*\n/, ''));
        bytenode.compileFile({ filename: tmp, output: jsc });
        fs.rmSync(tmp);
    } else {
        bytenode.compileFile({ filename: js, output: jsc });
    }
    const base = path.basename(jsc);
    const stub = (hadShebang ? '#!/usr/bin/env node\n' : '') +
        `require('bytenode');module.exports=require('./${base}');\n`;
    fs.writeFileSync(js, stub);
    if (hadShebang) fs.chmodSync(js, 0o755);
    compiled++;
}
log(`${compiled} modules → bytecode`);

// ── 5. Integrity manifest + baked constants ──────────────────────────────────
log('sealing integrity manifest…');
const salt = crypto.randomBytes(24).toString('hex');
// Files whose contents are verified at boot: all shipped code EXCEPT the
// integrity module itself (it carries the baked root; self-hashing is circular)
// and package-lock noise. Native .node binaries ARE included — tamper-evident.
const codeFiles = walk(APPDIR)
    .filter((f) => /\.(jsc|js|node)$/.test(f))
    .filter((f) => !/integrity\.js/.test(path.basename(f)))
    .map((f) => path.relative(APPDIR, f))
    .sort();
const root = (() => {
    const h = crypto.createHash('sha256');
    h.update(salt);
    for (const rel of codeFiles) {
        h.update(rel);
        h.update(crypto.createHash('sha256').update(fs.readFileSync(path.join(APPDIR, rel))).digest('hex'));
    }
    return h.digest('hex');
})();
fs.writeFileSync(path.join(APPDIR, 'integrity.json'), JSON.stringify({ files: codeFiles, algo: 'sha256' }));
// Re-bake the integrity module: substitute constants into its SOURCE, recompile.
const integritySrcJs = path.join(distDir, 'core', 'integrity.js'); // currently a stub
// Recover original compiled logic is impossible from the stub; instead recompile
// from the freshly-built (pre-stub) source we still have in ROOT/dist.
const freshIntegrity = fs.readFileSync(path.join(ROOT, 'dist', 'core', 'integrity.js'), 'utf8')
    .replace('__PLEXUS_INTEGRITY_ROOT__', root)
    .replace('__PLEXUS_INTEGRITY_SALT__', salt);
const jscOut = path.join(distDir, 'core', 'integrity.jsc');
const bakeTmp = path.join(distDir, 'core', 'integrity.bake.js');
fs.writeFileSync(bakeTmp, freshIntegrity);
bytenode.compileFile({ filename: bakeTmp, output: jscOut });
fs.rmSync(bakeTmp);
fs.writeFileSync(integritySrcJs, `require('bytenode');module.exports=require('./integrity.jsc');\n`);
log(`manifest sealed over ${codeFiles.length} files`);

// ── 6. Bundle the Node runtime ───────────────────────────────────────────────
log('bundling Node runtime…');
const realNode = fs.realpathSync(process.execPath);
fs.copyFileSync(realNode, path.join(RES, 'node'));
fs.chmodSync(path.join(RES, 'node'), 0o755);
log(`node ${process.version} (${(fs.statSync(path.join(RES, 'node')).size / 1e6).toFixed(0)} MB)`);

// ── 7. Assemble the .app ─────────────────────────────────────────────────────
log('assembling Plexus.app…');
// Launcher executable: run the bundled node against our (bytecode) cli entry.
fs.writeFileSync(path.join(MACOS, 'Plexus'),
    `#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
RES="$DIR/../Resources"
exec "$RES/node" "$RES/app/dist/cli.js" start
`);
fs.chmodSync(path.join(MACOS, 'Plexus'), 0o755);

// Icon: PNG → .icns via sips/iconutil.
try {
    const iconSrc = path.join(ROOT, 'assets', 'launcher', 'plexus_icon_1.png');
    const iconset = path.join(BUILD, 'plexus.iconset');
    fs.mkdirSync(iconset, { recursive: true });
    for (const s of [16, 32, 64, 128, 256, 512, 1024]) {
        execFileSync('sips', ['-z', String(s), String(s), iconSrc, '--out', path.join(iconset, `icon_${s}x${s}.png`)], { stdio: 'ignore' });
    }
    // Retina names iconutil expects
    for (const [b, name] of [[32, 'icon_16x16@2x'], [64, 'icon_32x32@2x'], [256, 'icon_128x128@2x'], [512, 'icon_256x256@2x'], [1024, 'icon_512x512@2x']]) {
        fs.copyFileSync(path.join(iconset, `icon_${b}x${b}.png`), path.join(iconset, `${name}.png`));
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(RES, 'plexus.icns')], { stdio: 'ignore' });
    rmrf(iconset);
    log('icon built');
} catch (e) { log('icon skipped (' + e.message + ')'); }

fs.writeFileSync(path.join(CONTENTS, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Plexus</string>
  <key>CFBundleDisplayName</key><string>Plexus</string>
  <key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
  <key>CFBundleVersion</key><string>${pkg.version}</string>
  <key>CFBundleShortVersionString</key><string>${pkg.version}</string>
  <key>CFBundleExecutable</key><string>Plexus</string>
  <key>CFBundleIconFile</key><string>plexus.icns</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
`);
fs.writeFileSync(path.join(CONTENTS, 'PkgInfo'), 'APPL????');

const appSize = execSync(`du -sh "${APP}" | cut -f1`).toString().trim();
console.log(`\n✅ ${path.relative(ROOT, APP)}  (${appSize})`);
console.log('   Unsigned — run scripts/sign-and-notarize.sh with your Developer ID to make it');
console.log('   Gatekeeper-clean and build the .pkg installer.\n');
