import { graph } from './graph';
import { ImpactSimulator } from './simulator';
import { PlexusNode, ImpactNode, SimulationResult } from '../types';

// ─── Evidence Protocol: the consultation brief (Roadmap 0.4) ──────────────────
// The primary product surface. Replaces raw unranked JSON — which costs more to
// read than the code itself and thereby ENCOURAGES workflow-skipping — with a
// ranked, hard-capped markdown brief: what exists, what breaks, what failed
// before, and where to pull more. Deterministic ranker + template; no LLM.

const TOKEN_CAP = 1500;
const estimateTokens = (s: string) => Math.ceil(s.length / 4);

export interface BriefRequest {
    node_ids?: string[];
    query?: string;
    file_paths?: string[];
    mode?: 'planning' | 'building' | 'debugging';
}

export interface BriefResult {
    markdown: string;
    token_estimate: number;
    mode: string;
    consulted_node_ids: string[];
    consulted_file_paths: string[];
    unresolved: string[];
    truncation_notes: string[];
    all_resolved_files: string[]; // uncapped — receipt coverage, not display
}

interface ResolvedTargets {
    targets: PlexusNode[];
    unresolved: string[];
    overflow: number;
    all_files: string[]; // every resolved file, uncapped — for receipt coverage
}

const MAX_TARGETS = 5;

function resolveTargets(req: BriefRequest): ResolvedTargets {
    const found = new Map<string, PlexusNode>();
    const unresolved: string[] = [];

    for (const id of req.node_ids || []) {
        const node = graph.nodes.get(id);
        if (node) found.set(node.id, node);
        else unresolved.push(id);
    }

    const normPath = (p: string) => p.replace(/^\.?\//, '');
    for (const fp of req.file_paths || []) {
        const wanted = normPath(fp);
        // Normalize BOTH sides — legacy connectomes carry '/'-prefixed paths
        const inFile = [...graph.nodes.values()].filter(n => normPath(n.file_path) === wanted);
        if (inFile.length === 0) {
            unresolved.push(fp);
            continue;
        }
        // Prefer the module anchor; otherwise the first symbol in the file
        const anchor = inFile.find(n => n.type === 'module') || inFile[0];
        found.set(anchor.id, anchor);
    }

    if (req.query) {
        // Exact name match first; fuzzy only widens, never replaces
        let matched = false;
        for (const node of graph.nodes.values()) {
            if (node.name === req.query) { found.set(node.id, node); matched = true; }
        }
        if (!matched) {
            const fuzzy = graph.searchNodes(req.query).slice(0, 3);
            for (const node of fuzzy) found.set(node.id, node);
            if (fuzzy.length === 0) unresolved.push(req.query);
        }
    }

    const all = Array.from(found.values());
    // Hubs first: connection_count is the one health signal that is real today
    all.sort((a, b) => (b.health?.connection_count ?? 0) - (a.health?.connection_count ?? 0));
    // Receipt coverage is the FULL resolved set, not the 5 displayed — else a
    // query consult that resolves 20 files would false-block edits to the 15
    // the AI genuinely consulted (a false block is how an AI learns to distrust
    // and abandon Plexus).
    const all_files = Array.from(new Set(all.map(n => normPath(n.file_path))));
    return { targets: all.slice(0, MAX_TARGETS), unresolved, overflow: Math.max(0, all.length - MAX_TARGETS), all_files };
}

/** The synapse that carried the impact to this blast node (last path hop). */
function carryingEdge(impact: ImpactNode): string {
    const path = impact.connection_path;
    if (!path || path.length < 2) return '?';
    const prev = path[path.length - 2];
    const curr = impact.node_id;
    const adjPrev = graph.adjacency.get(prev);
    if (adjPrev) {
        for (const synId of adjPrev.out) {
            const syn = graph.synapses.get(synId);
            if (syn && syn.target_node_id === curr) return syn.type;
        }
    }
    // Reverse-traversed reader (modify simulations): the real edge points curr→prev
    const adjCurr = graph.adjacency.get(curr);
    if (adjCurr) {
        for (const synId of adjCurr.out) {
            const syn = graph.synapses.get(synId);
            if (syn && syn.target_node_id === prev) return `${syn.type} (reader)`;
        }
    }
    return '?';
}

const trunc = (s: string, n: number) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

export function buildBrief(req: BriefRequest, simulator: ImpactSimulator): BriefResult {
    const mode = req.mode || 'building';
    const { targets, unresolved, overflow, all_files } = resolveTargets(req);
    const truncationNotes: string[] = [];
    if (overflow > 0) truncationNotes.push(`${overflow} additional matched nodes beyond the ${MAX_TARGETS}-target cap`);

    const targetIds = targets.map(t => t.id);
    const filePaths = Array.from(new Set(targets.map(t => t.file_path)));

    // Blast radius — dry-run, never pollutes history/reports
    let sim: SimulationResult | null = null;
    if (targets.length > 0) {
        try {
            sim = simulator.simulate(targetIds, 'modify', { dryRun: true });
        } catch { /* brief must still render without a simulation */ }
    }

    // Amygdala: prevention rules triggered by targets or anything in the blast
    const riskIds = new Set<string>(targetIds);
    for (const b of sim?.blast_radius || []) riskIds.add(b.node_id);
    const amygdalaHits: { title: string; severity: string; message: string; lesson?: string }[] = [];
    for (const entry of graph.amygdala.values()) {
        if (entry.status === 'superseded') continue;
        for (const rule of entry.prevention_rules) {
            if (rule.trigger_nodes.some(t => riskIds.has(t))) {
                amygdalaHits.push({
                    title: entry.title,
                    severity: entry.severity,
                    message: rule.warning_message,
                    lesson: entry.lessons_learned[0],
                });
                break;
            }
        }
    }

    // Invariants bound to anything in the risk set (fact-keyed, Roadmap 1.6)
    let invariantHits: { statement: string }[] = [];
    try {
        const { invariantsTouching } = require('./invariants');
        invariantHits = invariantsTouching(riskIds);
    } catch { /* registry unavailable — brief still renders */ }

    // Dormant neighbors: "we already tried that"
    const dormantNeighbors: PlexusNode[] = [];
    for (const node of graph.nodes.values()) {
        if (node.status !== 'dormant') continue;
        const touchesTarget =
            (node.was_connected_to || []).some(id => riskIds.has(id)) ||
            filePaths.includes(node.file_path);
        if (touchesTarget) dormantNeighbors.push(node);
    }

    // ── Compose, then trim to the cap ────────────────────────────────────────
    const stats = graph.getState().stats;
    let blastLimit = 10;
    let dormantLimit = 5;
    let amygdalaLimit = 3;

    // Bounded rendering of caller-controlled lists — the 1,500-token cap must
    // hold even against a request with hundreds of unresolvable paths.
    const unresolvedLine = () => {
        const shown = unresolved.slice(0, 15).map(u => trunc(u, 60));
        const more = unresolved.length > 15 ? ` (+${unresolved.length - 15} more)` : '';
        return shown.join(', ') + more;
    };

    // Maturity header (Roadmap 1.3): a provisional brain must SAY it is
    // provisional — mandatory consultation of a wrong/stale brain amplifies
    // error, so the wording itself is the first gate.
    let maturityLine = '';
    try {
        const { computeUtilization } = require('./utilization');
        const u = computeUtilization();
        maturityLine = `map: ${u.maturity.toUpperCase()} (${u.freshness}` +
            (u.maturity === 'provisional' ? ` — advisory only: ${u.maturity_reasons[0]}` : '') + ')';
    } catch { /* utilization must never break a brief */ }

    const render = (): string => {
        const lines: string[] = [];
        lines.push(`# PLEXUS CONSULTATION — mode: ${mode}`);
        lines.push(
            `graph: ${stats.active_nodes} active nodes · ${stats.active_synapses} synapses · ` +
            `${stats.amygdala_entries} amygdala ${stats.amygdala_entries === 0 ? '(no incidents recorded yet — healthy)' : 'entries'} · ` +
            `${stats.dormant_nodes} dormant`
        );
        if (maturityLine) lines.push(maturityLine);

        if (targets.length === 0) {
            lines.push('', '## NO TARGETS RESOLVED');
            if (unresolved.length) lines.push(`unresolved: ${unresolvedLine()}`);
            lines.push('Pull: GET /api/nodes/search?q=<term> · POST /api/claim-check {identifiers:[...]}');
            return lines.join('\n');
        }

        lines.push('', '## TARGETS');
        for (const t of targets) {
            const health = t.health?.connection_count != null ? ` · ${t.health.connection_count} connections` : '';
            const dormant = t.status === 'dormant' ? ` · DORMANT: ${t.dormant_reason || 'deactivated'}` : '';
            const range = t.line_range ? `:${t.line_range.start}-${t.line_range.end}` : '';
            lines.push(`- **${t.name}** (${t.type}, ${t.region}) — ${t.file_path}${range}${health}${dormant}`);
            if (t.description) lines.push(`  ${trunc(t.description, 140)}`);
        }
        if (unresolved.length) lines.push(`- ⚠ unresolved (NOT in the graph — do not assume these exist): ${unresolvedLine()}`);

        if (invariantHits.length > 0) {
            lines.push('', '## ⛨ INVARIANTS — must not break');
            for (const inv of invariantHits.slice(0, 6)) {
                lines.push(`- ${trunc(inv.statement, 160)}`);
            }
        }

        if (amygdalaHits.length > 0) {
            lines.push('', '## ⚠ AMYGDALA — this has failed before');
            for (const hit of amygdalaHits.slice(0, amygdalaLimit)) {
                lines.push(`- [${hit.severity}] ${trunc(hit.title, 90)} — ${trunc(hit.message, 140)}`);
                if (hit.lesson) lines.push(`  lesson: ${trunc(hit.lesson, 120)}`);
            }
            if (amygdalaHits.length > amygdalaLimit) lines.push(`  (+${amygdalaHits.length - amygdalaLimit} more — GET /api/amygdala)`);
        }

        if (sim) {
            lines.push('', `## RISK VERDICT — score ${sim.risk_score.toFixed(2)}`);
            lines.push(trunc(sim.recommendation, 300));

            const blast = sim.blast_radius
                .slice()
                .sort((a, b) => {
                    const order = { critical: 4, high: 3, moderate: 2, low: 1 } as Record<string, number>;
                    return (order[b.impact_level] || 0) - (order[a.impact_level] || 0) || a.distance_from_source - b.distance_from_source;
                });
            if (blast.length > 0) {
                lines.push('', `## BLAST RADIUS — ${sim.total_affected} nodes reached`);
                for (const b of blast.slice(0, blastLimit)) {
                    lines.push(`- [${b.impact_level}] ${b.node_name} (${b.region}, d${b.distance_from_source}, via ${carryingEdge(b)})`);
                }
                if (blast.length > blastLimit) lines.push(`  (+${blast.length - blastLimit} more — POST /api/simulate/impact)`);
            }
        }

        if (dormantNeighbors.length > 0) {
            lines.push('', '## DORMANT NEIGHBORS — already tried');
            for (const d of dormantNeighbors.slice(0, dormantLimit)) {
                lines.push(`- ${d.name} (${d.type}) — ${trunc(d.dormant_reason || 'deactivated', 110)}`);
            }
            if (dormantNeighbors.length > dormantLimit) lines.push(`  (+${dormantNeighbors.length - dormantLimit} more)`);
        }

        lines.push('', '## PULL (on demand, not pushed)');
        lines.push('node detail GET /api/nodes/:id · connections GET /api/nodes/:id/connections · claim-check POST /api/claim-check · full simulation POST /api/simulate/impact');

        return lines.join('\n');
    };

    // Progressive truncation: shrink the cheapest sections first
    let markdown = render();
    while (estimateTokens(markdown) > TOKEN_CAP && (blastLimit > 3 || dormantLimit > 2 || amygdalaLimit > 1)) {
        if (blastLimit > 3) blastLimit -= 2;
        else if (dormantLimit > 2) dormantLimit -= 1;
        else if (amygdalaLimit > 1) amygdalaLimit -= 1;
        truncationNotes.push('sections trimmed to honor the 1,500-token cap');
        markdown = render();
    }

    return {
        markdown,
        token_estimate: estimateTokens(markdown),
        mode,
        consulted_node_ids: targetIds,
        consulted_file_paths: filePaths,
        unresolved,
        truncation_notes: Array.from(new Set(truncationNotes)),
        all_resolved_files: all_files,
    };
}
