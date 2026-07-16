import fs from 'fs';
import path from 'path';
import { getIntegrationPath } from './context';

// Consent-based update queue. The vendor "sends" an update by writing this marker into
// the connectome (works whether the engine is running or stopped — no remote start).
// The client sees it when they next open/start their connectome and decides:
//   sent    → vendor queued it, awaiting the client
//   updated → client accepted (applied)
//   pushed  → client chose "later" (deferred, still on file)
// The vendor never force-applies; nothing turns on a client's engine without them.

export type PendingStatus = 'sent' | 'updated' | 'pushed';

export interface PendingUpdate {
    status: PendingStatus;
    target_build: number;
    target_version?: string;
    sent_at: string;
    responded_at?: string;
}

function file(): string { return path.join(getIntegrationPath(), 'pending-update.json'); }

export function readPending(): PendingUpdate | null {
    try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return null; }
}

export function writePending(p: PendingUpdate): void {
    try { fs.writeFileSync(file(), JSON.stringify(p, null, 2)); } catch { /* best-effort */ }
}

/** Client accepted — record it (the actual re-exec is triggered separately). */
export function acceptPending(): PendingUpdate | null {
    const p = readPending();
    if (!p) return null;
    p.status = 'updated';
    p.responded_at = new Date().toISOString();
    writePending(p);
    return p;
}

/** Client chose "later". */
export function deferPending(): PendingUpdate | null {
    const p = readPending();
    if (!p) return null;
    p.status = 'pushed';
    p.responded_at = new Date().toISOString();
    writePending(p);
    return p;
}

/**
 * Self-heal the marker against the build actually running. If the engine is on a build
 * at/beyond what was queued, the update is done — no matter HOW it was applied (modal
 * "Update now", the ☰ "Apply update" button, or a manual restart) — so resolve the marker
 * to 'updated'. Without this, applying via any path other than the modal leaves a stale
 * 'sent'/'pushed' marker that keeps re-triggering the update modal and shows the wrong
 * status in the vendor CRM. Idempotent; safe to call at startup and on every version read.
 */
export function reconcilePending(runningBuild: number): PendingUpdate | null {
    const p = readPending();
    if (!p) return null;
    if ((p.status === 'sent' || p.status === 'pushed') && runningBuild >= (p.target_build || 0)) {
        p.status = 'updated';
        if (!p.responded_at) p.responded_at = new Date().toISOString();
        writePending(p);
    }
    return p;
}
