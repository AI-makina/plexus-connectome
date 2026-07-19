import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

// ─── Launch authorizations (Integration v2 doors) ─────────────────────────────
// A door (`plexus work`, launcher button) mints a short-lived token bound to a
// project_id and passes it to the AI process via PLEXUS_LAUNCH_AUTH (environment
// inheritance terminal→client→MCP child is verified). session_open treats a
// match as door provenance — a stronger human-intent signal for task_check.
// NEVER a router: a token for a different project than the anchor resolves is a
// hard mismatch, and the absence of a token is always legal (manual launch).
// One redemption per token; 10-minute TTL.

const AUTH_FILE = path.join(os.homedir(), '.plexus', 'launch-auths.jsonl');
const TTL_MS = 10 * 60 * 1000;

export function mintLaunchAuth(projectId: string): string {
    const token = crypto.randomUUID();
    try {
        fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
        fs.appendFileSync(AUTH_FILE, JSON.stringify({ token, project_id: projectId, ts: Date.now() }) + '\n');
    } catch { /* token still travels via env even if the ledger write failed */ }
    return token;
}

/** 'match' | 'mismatch' | 'unknown' (absent/expired/never minted). Redemption consumes the token. */
export function redeemLaunchAuth(token: string | undefined, projectId: string | null | undefined): 'match' | 'mismatch' | 'unknown' {
    if (!token) return 'unknown';
    let rows: any[] = [];
    try {
        rows = fs.readFileSync(AUTH_FILE, 'utf8').split('\n').filter(Boolean)
            .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return 'unknown'; }
    const now = Date.now();
    const live = rows.filter(r => r && typeof r.ts === 'number' && now - r.ts < TTL_MS);
    const hit = live.find(r => r.token === token);
    const keep = live.filter(r => r !== hit);
    try { fs.writeFileSync(AUTH_FILE, keep.length ? keep.map(r => JSON.stringify(r)).join('\n') + '\n' : ''); } catch { /* prune best-effort */ }
    if (!hit) return 'unknown';
    return (projectId && hit.project_id === projectId) ? 'match' : 'mismatch';
}
