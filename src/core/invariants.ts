import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getIntegrationPath } from './context';

// ─── Frontal invariants registry (Roadmap 1.6, fact-keyed) ───────────────────
// Up to ~10 declared truths the code must never violate ("totals are always
// computed server-side", "session tokens never leave localhost"). Each binds
// to node ids — a FACT key, not a region key — and is injected into any
// consultation whose targets or blast radius cross a bound node. User- or
// LLM-authored; never derived by scanning.

export interface Invariant {
    id: string;
    statement: string;
    node_ids: string[];
    declared_by: 'user' | 'llm';
    created_at: string;
}

const MAX_INVARIANTS = 12;

function invariantsPath(): string {
    return path.join(getIntegrationPath(), 'invariants.json');
}

export function loadInvariants(): Invariant[] {
    try {
        const raw = JSON.parse(fs.readFileSync(invariantsPath(), 'utf8'));
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

export function saveInvariants(list: Invariant[]) {
    fs.writeFileSync(invariantsPath(), JSON.stringify(list, null, 2));
}

export function declareInvariant(
    statement: string,
    nodeIds: string[],
    declaredBy: 'user' | 'llm' = 'llm',
): { ok: true; invariant: Invariant } | { ok: false; error: string } {
    if (!statement || typeof statement !== 'string' || statement.trim().length < 8) {
        return { ok: false, error: 'statement must be a meaningful sentence' };
    }
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return { ok: false, error: 'node_ids must bind the invariant to at least one node — invariants are fact-keyed' };
    }
    const list = loadInvariants();
    if (list.length >= MAX_INVARIANTS) {
        return { ok: false, error: `at most ${MAX_INVARIANTS} invariants — retire one first (a wall of invariants is noise, not protection)` };
    }
    const invariant: Invariant = {
        id: uuidv4(),
        statement: statement.trim(),
        node_ids: nodeIds,
        declared_by: declaredBy,
        created_at: new Date().toISOString(),
    };
    list.push(invariant);
    saveInvariants(list);
    return { ok: true, invariant };
}

export function retireInvariant(id: string): boolean {
    const list = loadInvariants();
    const next = list.filter(i => i.id !== id);
    if (next.length === list.length) return false;
    saveInvariants(next);
    return true;
}

/** Invariants whose bound nodes intersect the given id set. */
export function invariantsTouching(nodeIds: Set<string>): Invariant[] {
    return loadInvariants().filter(inv => inv.node_ids.some(id => nodeIds.has(id)));
}
