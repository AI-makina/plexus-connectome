import fs from 'fs';
import path from 'path';

// ─── Edition gate (shipment split) ───────────────────────────────────────────
// OPERATOR is the vendor's own build: local manager (CRM), fleet rollups, update
// pushes. USER is what customers install: dashboard only — no operator surface
// ships in their artifact (the packager also prunes managerPage from dist, so
// the code physically isn't there; this gate covers the dev-tree case). The
// edition is baked by the build (edition.json at app root, scripts/edition.js);
// a missing file means a dev tree → operator, so local dev never changes.
let cached: 'operator' | 'user' | null = null;

export function edition(): 'operator' | 'user' {
    if (cached) return cached;
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'edition.json'), 'utf8'));
        cached = raw?.edition === 'user' ? 'user' : 'operator';
    } catch { cached = 'operator'; }
    return cached;
}

export function isOperator(): boolean { return edition() === 'operator'; }
