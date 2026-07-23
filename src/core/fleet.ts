import fs from 'fs';
import os from 'os';
import path from 'path';

// ─── Fleet client (operator API on the Skyfynd side) ─────────────────────────
// Activation, heartbeat, feedback, support, update feed. Transmits ONLY the
// lawful minimum: license token, app version, platform, connectome COUNT and
// engine versions. Never project names, paths, or content — that promise is
// enforced here, at the only place bytes leave the machine. The base URL is
// configurable (~/.plexus/fleet.json → { "base": "..." }) so beta and dev can
// point anywhere; the packaged default is the production dashboard.
const CFG = path.join(os.homedir(), '.plexus', 'fleet.json');
const DEFAULT_BASE = 'https://skyfynd-omi.skyfynd.workers.dev';

export function fleetBase(): string {
    try {
        const j = JSON.parse(fs.readFileSync(CFG, 'utf8'));
        if (j?.base) return String(j.base).replace(/\/+$/, '');
    } catch { /* default */ }
    return DEFAULT_BASE;
}

async function request(method: 'GET' | 'POST', pathname: string, body?: any, timeoutMs = 8000): Promise<any> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(fleetBase() + pathname, {
            method,
            headers: { 'content-type': 'application/json' },
            body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
            signal: ctrl.signal,
        });
        const j: any = await r.json().catch(() => ({}));
        if (!r.ok) return { error: j?.error || `fleet responded ${r.status}` };
        return j;
    } catch (e: any) {
        return { error: e?.name === 'AbortError' ? 'fleet timeout' : (e?.message || 'network unreachable'), offline: true };
    } finally { clearTimeout(t); }
}

export function fleetPost(pathname: string, body: any, timeoutMs?: number): Promise<any> {
    return request('POST', pathname, body, timeoutMs);
}
export function fleetGet(pathname: string, timeoutMs?: number): Promise<any> {
    return request('GET', pathname, undefined, timeoutMs);
}
