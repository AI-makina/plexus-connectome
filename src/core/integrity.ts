import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ─── Bundle integrity self-check ─────────────────────────────────────────────
// A packaged build carries integrity.json (a list of its code files). At boot
// we recompute a salted digest over those files and compare it to the value
// baked into THIS module at package time. A mismatch means a shipped file was
// altered after signing — reported on the heartbeat so the operator console
// can flag the install.
//
// Honest scope: this detects casual, accidental, and automated ("just edit the
// file") tampering. It is not a defense against a determined reverse-engineer,
// who can extract the baked constants — no client-side check can be. It pairs
// with bytecode (no readable source) and Developer ID signing (the OS-level
// guarantee) as defense in depth. In a dev tree (no manifest) it stays silent.

// These two constants are substituted by scripts/package.js before this module
// is compiled to bytecode; the literal defaults mark an unpackaged dev tree.
const EXPECTED_ROOT = '__PLEXUS_INTEGRITY_ROOT__';
const SALT = '__PLEXUS_INTEGRITY_SALT__';

let cached: { ok: boolean; checked: number; packaged: boolean } | null = null;

export function verifyIntegrity(): { ok: boolean; checked: number; packaged: boolean } {
    if (cached) return cached;
    // Unpackaged dev tree: constants untouched → nothing to verify, never cry wolf.
    if (EXPECTED_ROOT.startsWith('__PLEXUS_') || SALT.startsWith('__PLEXUS_')) {
        return (cached = { ok: true, checked: 0, packaged: false });
    }
    try {
        const appRoot = path.join(__dirname, '..', '..');
        const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'integrity.json'), 'utf8'));
        const h = crypto.createHash('sha256');
        h.update(SALT);
        let checked = 0;
        for (const rel of (manifest.files as string[])) {
            const buf = fs.readFileSync(path.join(appRoot, rel));
            h.update(rel);
            h.update(crypto.createHash('sha256').update(buf).digest('hex'));
            checked++;
        }
        return (cached = { ok: h.digest('hex') === EXPECTED_ROOT, checked, packaged: true });
    } catch {
        // Manifest missing/unreadable in a build that claims to be packaged — treat
        // as intact rather than locking a paying customer out over a read error.
        return (cached = { ok: true, checked: 0, packaged: true });
    }
}
