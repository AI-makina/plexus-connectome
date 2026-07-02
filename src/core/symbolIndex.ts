import { graph } from './graph';
import { PlexusNode } from '../types';

// ─── Evidence Protocol: claim-check — the existence oracle (Roadmap 0.3) ──────
// Before writing code, the AI declares every identifier it intends to rely on;
// the engine answers from the graph. Two iron rules:
//   1. Existence is confirmed ONLY by exact matching. The fuzzy index
//      (Fuse @ 0.3) may suggest, never confirm — otherwise a near-miss
//      hallucinated identifier gets stamped "exists", which is worse than no
//      check at all.
//   2. Categories the graph does not hold answer "out_of_scope — cannot
//      verify", never "missing" — an honest oracle keeps its trust.

export type ClaimStatus =
    | 'exists'          // exact match, active
    | 'ambiguous'       // exact matches in multiple files — candidates listed
    | 'dormant'         // exists but dormant: "we already tried that"
    | 'case_mismatch'   // exact match only when case-folded
    | 'missing'         // in-scope, no match; suggestion (if any) is labeled
    | 'out_of_scope'    // the graph cannot verify this category yet
    | 'invalid';        // malformed claim item — one bad item never 500s the batch

export interface ClaimMatch {
    node_id: string;
    name: string;
    type: string;
    region: string;
    file_path: string;
    line_range?: { start: number; end: number };
    status: string;
    dormant_reason?: string;
}

export interface ClaimResult {
    identifier: string;
    kind?: string;
    status: ClaimStatus;
    matches: ClaimMatch[];
    suggestion?: string; // fuzzy near-miss — NEVER a confirmation
    note?: string;
}

export interface ClaimInput {
    name: string;
    kind?: string;      // symbol | endpoint | env_var | file | db_table | external_api | css_class | package
    file_hint?: string; // narrows ambiguity to a file path substring
}

// What the shipped TS/JS scanner can actually verify. Everything else must be
// answered honestly as unverifiable until artifact parsers (Phase 1.4) land.
const OUT_OF_SCOPE_KINDS: Record<string, string> = {
    db_table: 'database tables are not scanned yet (schema parsers land in Phase 1.4)',
    sql: 'SQL objects are not scanned yet (schema parsers land in Phase 1.4)',
    external_api: 'external SDK/API surfaces are not scanned (OpenAPI/typings parsers land in Phase 1.4)',
    css_class: 'CSS classes are not scanned yet (stylesheet parsers land in Phase 1.4)',
    package: 'package dependencies are not graph nodes yet (package.json parser lands in Phase 1.4)',
};

const toMatch = (n: PlexusNode): ClaimMatch => ({
    node_id: n.id,
    name: n.name,
    type: n.type,
    region: n.region,
    file_path: n.file_path,
    line_range: n.line_range,
    status: n.status,
    dormant_reason: n.dormant_reason,
});

export function checkClaims(inputs: Array<string | ClaimInput>): ClaimResult[] {
    // Exact indexes built per call — the graph is in-memory and small (10²–10³
    // nodes); rebuilding beats cache invalidation across mutations.
    const exact = new Map<string, PlexusNode[]>();
    const folded = new Map<string, PlexusNode[]>();
    for (const node of graph.nodes.values()) {
        const key = node.name;
        (exact.get(key) ?? exact.set(key, []).get(key)!).push(node);
        const fkey = key.toLowerCase();
        (folded.get(fkey) ?? folded.set(fkey, []).get(fkey)!).push(node);
    }

    const normPath = (p: string) => p.replace(/^\.?\//, '');

    return inputs.map((raw): ClaimResult => {
        // Per-item shape guard: a malformed item answers 'invalid' — it must
        // never throw and 500 the whole batch.
        if (typeof raw !== 'string' && (raw === null || typeof raw !== 'object' || typeof (raw as any).name !== 'string' || (raw as any).name.length === 0)) {
            return {
                identifier: typeof raw === 'object' ? JSON.stringify(raw)?.slice(0, 60) : String(raw),
                status: 'invalid', matches: [],
                note: 'each identifier must be a string or {name: string, kind?, file_hint?}',
            };
        }
        const input: ClaimInput = typeof raw === 'string' ? { name: raw } : (raw as ClaimInput);
        const { name, kind, file_hint } = input;

        if (kind && OUT_OF_SCOPE_KINDS[kind]) {
            return { identifier: name, kind, status: 'out_of_scope', matches: [], note: OUT_OF_SCOPE_KINDS[kind] };
        }

        let candidates = exact.get(name) || [];

        // File claims: match nodes by path instead of symbol name — normalize
        // BOTH sides (legacy connectomes carry '/'-prefixed file_path values)
        if (candidates.length === 0 && (kind === 'file' || name.includes('/'))) {
            const wanted = normPath(name);
            candidates = Array.from(graph.nodes.values()).filter(n => normPath(n.file_path) === wanted);
        }

        if (candidates.length > 0) {
            let narrowed = candidates;
            if (file_hint) {
                const byHint = candidates.filter(n => n.file_path.includes(file_hint));
                if (byHint.length > 0) narrowed = byHint;
            }
            const active = narrowed.filter(n => n.status !== 'dormant');
            const dormant = narrowed.filter(n => n.status === 'dormant');

            if (active.length === 0 && dormant.length > 0) {
                return {
                    identifier: name, kind, status: 'dormant',
                    matches: dormant.map(toMatch),
                    note: `dormant — ${dormant[0].dormant_reason || 'previously deactivated'} (this often means "we already tried that")`,
                };
            }

            const distinctFiles = new Set(active.map(n => n.file_path));
            if (distinctFiles.size > 1) {
                return {
                    identifier: name, kind, status: 'ambiguous',
                    matches: active.map(toMatch),
                    note: `${active.length} definitions across ${distinctFiles.size} files — disambiguate with file_hint`,
                };
            }

            return { identifier: name, kind, status: 'exists', matches: active.concat(dormant).map(toMatch) };
        }

        const foldHit = folded.get(name.toLowerCase());
        if (foldHit && foldHit.length > 0) {
            return {
                identifier: name, kind, status: 'case_mismatch',
                matches: foldHit.slice(0, 3).map(toMatch),
                note: `no exact match, but '${foldHit[0].name}' exists — check capitalization`,
            };
        }

        // Missing — offer the fuzzy top hit strictly as a labeled suggestion
        const fuzzy = graph.searchNodes(name)[0];
        return {
            identifier: name, kind, status: 'missing',
            matches: [],
            suggestion: fuzzy ? `${fuzzy.name} (${fuzzy.type} in ${fuzzy.file_path})` : undefined,
            note: fuzzy
                ? 'not in the graph — the suggestion is a fuzzy near-miss, NOT a confirmation'
                : 'not in the graph',
        };
    });
}
