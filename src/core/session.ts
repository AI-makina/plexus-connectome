import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db/sqlite';
import { v4 as uuidv4 } from 'uuid';

// ─── Evidence Protocol: session token + consultation ledger (Roadmap 0.1/0.5) ─
// The token is a per-boot local capability: it does not pretend to stop a
// determined local process (the file queue is trust-by-filesystem), but it
// mechanically blocks the real exposure — cross-origin browser writes and
// accidental unauthenticated mutations — and it makes every consultation
// attributable, which is the substrate the git chokepoint stands on.

let sessionToken: string | null = null;
let tokenFilePath: string | null = null;

export function initSession(integrationPath: string): string {
    sessionToken = crypto.randomBytes(24).toString('hex');
    tokenFilePath = path.join(integrationPath, 'session-token');
    fs.writeFileSync(tokenFilePath, sessionToken, { mode: 0o600 });
    return sessionToken;
}

export function getSessionToken(): string | null {
    return sessionToken;
}

export function getTokenFilePath(): string | null {
    return tokenFilePath;
}

export function isAuthDisabled(): boolean {
    return process.env.PLEXUS_NO_AUTH === '1';
}

// Read-only endpoints that are POST purely to carry a body — they mutate
// nothing and are part of the documented tokenless pre-flight contract.
const READ_ONLY_POSTS = new Set(['/api/amygdala/check']);

/** Express middleware: host validation + session token on mutating routes. */
export function authMiddleware(req: any, res: any, next: any) {
    // DNS-rebinding guard (always on, even with PLEXUS_NO_AUTH): a hostile
    // page can rebind its domain to 127.0.0.1 and become "same-origin" with
    // this server — the browser then sends its domain in the Host header.
    // A local caller never has a non-local Host, so reject anything else.
    const rawHost = String(req.headers.host || '').toLowerCase();
    const host = rawHost.startsWith('[')
        ? rawHost.slice(0, rawHost.indexOf(']') + 1)   // [::1]:3200 → [::1]
        : rawHost.split(':')[0];                        // localhost:3200 → localhost
    if (host && !['localhost', '127.0.0.1', '[::1]'].includes(host)) {
        return res.status(403).json({ error: `invalid host '${host}' — Plexus only serves local callers` });
    }

    if (isAuthDisabled()) return next();
    if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') return next();
    if (req.method === 'POST' && READ_ONLY_POSTS.has(req.path)) return next();
    const supplied = req.headers['x-plexus-token'] || req.query.token;
    if (sessionToken && supplied === sessionToken) return next();
    return res.status(401).json({
        error: 'missing or invalid session token',
        hint: `read it from GET /api/session or the '${tokenFilePath ? path.basename(tokenFilePath) : 'session-token'}' file in plexus-integration/, then send header x-plexus-token`,
    });
}

// ─── Consultation ledger ──────────────────────────────────────────────────────

export type ConsultationKind = 'consult' | 'claim_check' | 'simulate';

export function recordConsultation(
    kind: ConsultationKind,
    nodeIds: string[],
    filePaths: string[],
    token?: string | null,
): string {
    const id = uuidv4();
    try {
        const db = getDb();
        db.prepare(`
      INSERT INTO consultations (id, session_token, kind, node_ids, file_paths, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
            id,
            token || sessionToken || null,
            kind,
            JSON.stringify(nodeIds || []),
            JSON.stringify(filePaths || []),
            new Date().toISOString(),
        );
    } catch {
        // Ledger is best-effort: a missing DB (unit contexts) must never break
        // the consultation itself.
    }
    return id;
}

export interface ConsultationRow {
    id: string;
    session_token: string | null;
    kind: ConsultationKind;
    node_ids: string[];
    file_paths: string[];
    timestamp: string;
}

export function getConsultationsSince(sinceIso: string): ConsultationRow[] {
    try {
        const db = getDb();
        const rows = db.prepare(
            'SELECT * FROM consultations WHERE timestamp >= ? ORDER BY timestamp DESC'
        ).all(sinceIso) as any[];
        return rows.map(r => ({
            ...r,
            node_ids: JSON.parse(r.node_ids || '[]'),
            file_paths: JSON.parse(r.file_paths || '[]'),
        }));
    } catch {
        return [];
    }
}
