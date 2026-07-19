import fs from 'fs';
import os from 'os';
import path from 'path';
import { graph } from './graph';
import { getIntegrationPath, getTargetPath, getManifest } from './context';
import { loadRegistry } from './registry';
import { readReceipts } from './receipts';
import { workCommand } from './clientConfig';

// ─── Intent firewall (Integration v2, task_check) ─────────────────────────────
// The C2 defense: a session can be CORRECTLY anchored while the human's request
// belongs to a different project — invisible to every binding scheme, catchable
// only at the content layer. All comparison is LOCAL; the response never carries
// another project's vocabulary into the session context — only a matched project
// NAME and its door.
//
// Trigger design (from the deliberation): relative matching beats absolute —
// low overlap with the active project alone must never alarm (legitimate new
// features always look novel); alarm when another KNOWN project explains the
// request materially better, or when several weak signals compound.

const CACHE_FILE = path.join(os.homedir(), '.plexus', 'identity-cache.json');

const STOP = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'with', 'from', 'this', 'that', 'these', 'those', 'into', 'onto',
    'when', 'then', 'than', 'have', 'has', 'had', 'are', 'is', 'was', 'were', 'be', 'been', 'being',
    'to', 'of', 'in', 'on', 'it', 'as', 'at', 'by', 'we', 'you', 'i', 'my', 'our', 'your', 'their',
    'app', 'application', 'project', 'code', 'file', 'files', 'make', 'build', 'add', 'fix', 'change',
    'update', 'create', 'new', 'user', 'users', 'page', 'component', 'function', 'work', 'working',
    'want', 'need', 'please', 'help', 'can', 'will', 'should', 'would', 'let', 'lets', 'use', 'using',
]);

function tokens(s: string): string[] {
    return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
}

function overlap(needles: Set<string>, hay: Set<string>): number {
    let n = 0;
    for (const t of needles) if (hay.has(t)) n++;
    return n;
}

/** The active project's identity: name + a term set from name, genesis brief, and node vocabulary. */
export function activeIdentity(): { name: string; terms: Set<string> } {
    const manifest: any = getManifest();
    const name = manifest?.visualization?.display_name || manifest?.target_app?.name || path.basename(getTargetPath());
    const terms = new Set<string>(tokens(name));
    try {
        for (const t of tokens(fs.readFileSync(path.join(getIntegrationPath(), 'genesis-brief.md'), 'utf8'))) terms.add(t);
    } catch { /* graft projects have no brief */ }
    let i = 0;
    for (const n of graph.nodes.values()) {
        if (i++ > 5000) break;
        for (const t of tokens(n.name + ' ' + (n.description || ''))) terms.add(t);
    }
    return { name, terms };
}

/** Publish this project's content-light identity (name + top terms) so OTHER engines'
 *  task_check can compare against it even while this project is stopped. Local file only. */
export function publishIdentity(projectId: string | null): void {
    try {
        const ident = activeIdentity();
        const freq = new Map<string, number>();
        const bump = (t: string, w: number) => freq.set(t, (freq.get(t) || 0) + w);
        for (const t of tokens(ident.name)) bump(t, 10);
        try { for (const t of tokens(fs.readFileSync(path.join(getIntegrationPath(), 'genesis-brief.md'), 'utf8'))) bump(t, 3); } catch { /* optional */ }
        let i = 0;
        for (const n of graph.nodes.values()) { if (i++ > 5000) break; for (const t of tokens(n.name)) bump(t, 1); }
        const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([t]) => t);
        let cache: any = {};
        try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) || {}; } catch { /* first write */ }
        const key = projectId || path.resolve(getTargetPath());
        cache[key] = { name: ident.name, path: path.resolve(getTargetPath()), terms: top, updated_at: new Date().toISOString() };
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch { /* identity publishing is best-effort */ }
}

export interface TaskCheckInput {
    task_summary: string;
    mentioned_paths?: string[];
    mentioned_projects?: string[];
    provenance?: string; // 'door' | 'manual' | 'misfired'
}
export interface TaskCheckResult {
    verdict: 'ok' | 'confirm' | 'conflict';
    reason: string;
    active_project: string;
    best_match?: { name: string; work_command: string };
}

export function taskCheck(input: TaskCheckInput): TaskCheckResult {
    const active = activeIdentity();
    const root = path.resolve(getTargetPath());
    const reg = loadRegistry();
    const others = reg.projects.filter(p => path.resolve(p.path) !== root);
    const door = (name: string) => ({ name, work_command: workCommand(name) });

    // ── Hard signal 1: absolute paths outside this project ──
    for (const raw of input.mentioned_paths || []) {
        if (!raw || !path.isAbsolute(raw)) continue;
        const p = path.resolve(raw);
        if (p === root || p.startsWith(root + path.sep)) continue;
        const owner = others.find(o => p === path.resolve(o.path) || p.startsWith(path.resolve(o.path) + path.sep));
        if (owner) {
            return { verdict: 'conflict', reason: `the request references a path inside ${owner.name} (${raw})`, active_project: active.name, best_match: door(owner.name) };
        }
        return { verdict: 'confirm', reason: `the request references a path outside this project (${raw})`, active_project: active.name };
    }

    const sumToks = new Set(tokens(input.task_summary));
    const activeNameToks = new Set(tokens(active.name));

    // ── Hard signal 2: another registered project named explicitly ──
    const namedMatch = (needle: string) => {
        const nToks = tokens(needle);
        return others.find(o => {
            const oToks = tokens(o.name);
            return oToks.length > 0 && (o.name.toLowerCase() === String(needle || '').toLowerCase() || (nToks.length > 0 && oToks.every(t => nToks.includes(t))));
        });
    };
    for (const mp of input.mentioned_projects || []) {
        const hit = namedMatch(mp);
        if (hit) return { verdict: 'conflict', reason: `the user named ${hit.name}, a different registered project`, active_project: active.name, best_match: door(hit.name) };
    }
    for (const o of others) {
        const oToks = tokens(o.name);
        if (oToks.length === 0) continue;
        const allPresent = oToks.every(t => sumToks.has(t));
        const distinct = oToks.some(t => !activeNameToks.has(t));
        if (allPresent && distinct) {
            return { verdict: 'conflict', reason: `the request mentions ${o.name}, a different registered project`, active_project: active.name, best_match: door(o.name) };
        }
    }

    // ── Soft relative: does another KNOWN project explain this request materially better? ──
    let cache: Record<string, any> = {};
    try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) || {}; } catch { /* no cache yet */ }
    const selfScore = overlap(sumToks, active.terms);
    let best: { name: string; score: number } | null = null;
    for (const ident of Object.values(cache)) {
        if (!ident || path.resolve(ident.path || '') === root) continue;
        if (!others.some(o => path.resolve(o.path) === path.resolve(ident.path || ''))) continue; // registry is the roster of record
        const score = overlap(sumToks, new Set(ident.terms || []));
        if (!best || score > best.score) best = { name: ident.name, score };
    }
    if (best && best.score >= 3 && best.score >= 2 * Math.max(selfScore, 1)) {
        return { verdict: 'confirm', reason: `this sounds more like ${best.name} (vocabulary match ${best.score} vs ${selfScore} here)`, active_project: active.name, best_match: door(best.name) };
    }

    // ── Compound weak signals: novel topic + no evidence receipts + manual launch ──
    const now = Date.now();
    let liveReceipts = 0;
    try {
        liveReceipts = readReceipts(getIntegrationPath())
            .filter((r: any) => now - new Date(r.issued_at).getTime() < (r.ttl_ms || 0)).length;
    } catch { /* none */ }
    if (selfScore === 0 && liveReceipts === 0 && input.provenance !== 'door' && sumToks.size >= 4) {
        return { verdict: 'confirm', reason: 'the request shares no vocabulary with this project, the session was not opened through a project door, and nothing has been consulted yet', active_project: active.name };
    }

    return {
        verdict: 'ok',
        reason: selfScore > 0 ? `vocabulary overlap ${selfScore} with ${active.name}` : 'no counter-signal — proceeding under this project',
        active_project: active.name,
    };
}
