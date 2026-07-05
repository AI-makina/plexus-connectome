import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ─── Consultation receipts — the enforcement keystone (Hardening L3) ──────────
// A receipt is a VERIFIABLE artifact the engine issues when a consultation
// actually happens. The harness hook-guard and the strict pre-commit read
// receipts (never the AI's claims), so enforcement binds ANY foreign AI or
// human in ANY harness — the engine, not the client, is the authority.
//
// This module is deliberately dependency-free (fs + crypto only): hook-guard
// must run in <300ms with no engine round-trip and no graph/DB load. The
// engine (which HAS the graph) resolves consulted regions/queries into the
// concrete file list at issue time, so the guard stays dumb and fast.

const RECEIPTS_FILE = 'receipts.json';
const MAX_RECEIPTS = 400;
export const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4h — "consulted this working session"

export interface Receipt {
    id: string;
    files: string[];       // project-relative, normalized (no leading ./ or /)
    regions: string[];
    issued_at: string;     // ISO
    ttl_ms: number;
    nonce: string;         // for the un-forgeable ⬡ fingerprint
    kind: string;          // consult | claim_check | simulate
}

export function normRel(p: string): string {
    return String(p || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
}

function receiptsPath(integrationDir: string): string {
    return path.join(integrationDir, RECEIPTS_FILE);
}

export function readReceipts(integrationDir: string): Receipt[] {
    try {
        const arr = JSON.parse(fs.readFileSync(receiptsPath(integrationDir), 'utf8'));
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

/** Engine-side: append a receipt (offline file the hooks read). */
export function issueReceipt(
    integrationDir: string,
    kind: string,
    files: string[],
    regions: string[] = [],
    ttlMs: number = DEFAULT_TTL_MS,
): Receipt {
    const receipt: Receipt = {
        id: crypto.randomBytes(6).toString('hex'),
        files: Array.from(new Set((files || []).map(normRel).filter(Boolean))),
        regions: Array.from(new Set(regions || [])),
        issued_at: new Date().toISOString(),
        ttl_ms: ttlMs,
        nonce: crypto.randomBytes(8).toString('hex'),
        kind,
    };
    const all = readReceipts(integrationDir);
    all.push(receipt);
    const trimmed = all.slice(-MAX_RECEIPTS);
    try {
        fs.writeFileSync(receiptsPath(integrationDir), JSON.stringify(trimmed, null, 2));
    } catch { /* best-effort — a missing receipts file just means the guard blocks */ }
    return receipt;
}

const isFresh = (r: Receipt, now: number) =>
    new Date(r.issued_at).getTime() + (r.ttl_ms || DEFAULT_TTL_MS) > now;

/** hook-guard / pre-commit: is this file covered by a fresh receipt? */
export function isFileCovered(integrationDir: string, relPath: string, now = Date.now()): boolean {
    const wanted = normRel(relPath);
    for (const r of readReceipts(integrationDir)) {
        if (!isFresh(r, now)) continue;
        if (r.files.includes(wanted)) return true;
    }
    return false;
}

/** The freshest live receipt's short fingerprint, for the derived ⬡ line. */
export function liveReceiptFingerprint(integrationDir: string, now = Date.now()): string | null {
    let best: Receipt | null = null;
    for (const r of readReceipts(integrationDir)) {
        if (!isFresh(r, now)) continue;
        if (!best || new Date(r.issued_at) > new Date(best.issued_at)) best = r;
    }
    return best ? best.nonce.slice(0, 4) : null;
}

export function hasAnyLiveReceipt(integrationDir: string, now = Date.now()): boolean {
    return readReceipts(integrationDir).some(r => isFresh(r, now));
}

// ─── Mapped-code decision (offline, manifest-aware) ───────────────────────────
// Friction lands ONLY where hallucination costs something: real source files.
// Docs, config, dotfiles, scratch, and the integration dir pass through freely
// so humans and AIs are never blocked on a README.

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|swift|kt|c|cc|cpp|h|hpp|cs|vue|svelte)$/i;
const ALWAYS_PASS = /(^|\/)(\.git|\.claude|node_modules|dist|build|\.next|coverage|plexus-integration|\.merge-backup)(\/|$)/;
const PASS_EXT = /\.(md|mdx|txt|json|ya?ml|toml|lock|env|env\.\w+|css|scss|less|svg|png|jpe?g|gif|ico|woff2?|ttf)$/i;

export function isMappedCode(relPath: string, integrationDir?: string): boolean {
    const p = normRel(relPath);
    if (!p) return false;
    if (ALWAYS_PASS.test('/' + p)) return false;
    // Honor manifest ignore_patterns when available
    if (integrationDir) {
        try {
            const m = JSON.parse(fs.readFileSync(path.join(integrationDir, 'plexus-manifest.json'), 'utf8'));
            for (const pat of m?.target_app?.ignore_patterns || []) {
                const rx = String(pat).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                if (new RegExp(rx).test(p)) return false;
            }
        } catch { /* no manifest — fall through to extension heuristic */ }
    }
    if (PASS_EXT.test(p)) return false;
    return CODE_EXT.test(p);
}

// ─── Bypass ledger (Hardening L2) ─────────────────────────────────────────────
// A commit may be forced with PLEXUS_BYPASS=1, but it leaves a scar, not a hole.
export function recordBypass(integrationDir: string, files: string[], reason: string) {
    const logPath = path.join(integrationDir, 'bypass-log.json');
    let log: any[] = [];
    try { log = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch { /* first bypass */ }
    log.push({ at: new Date().toISOString(), files, reason, user: process.env.USER || 'unknown' });
    try { fs.writeFileSync(logPath, JSON.stringify(log, null, 2)); } catch { /* best-effort */ }
}
