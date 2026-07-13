import { graph } from './graph';
import { AmygdalaEntry, ImpactNode, SimulationResult, ResolutionConflict } from '../types';
import { findResolutionsTouchingNodes, flagRegressionRisk } from './resolutions';
import { familyOf, reverseTraversesOnModify } from './families';
import { getDb } from '../db/sqlite';
import { v4 as uuidv4 } from 'uuid';

function impactScore(level: string): number {
    switch (level) {
        case 'critical': return 4;
        case 'high': return 3;
        case 'moderate': return 2;
        case 'low': return 1;
        default: return 0;
    }
}

/**
 * Import-time bindings are dangerous: the target caches the source value at module load.
 * Runtime changes to the source won't propagate. This amplifies impact severity.
 */
function bindingTimeMultiplier(bindingTime?: string): number {
    switch (bindingTime) {
        case 'import': return 1.5;   // Highest risk — cached forever
        case 'startup': return 1.3;  // Cached at boot — restart needed
        case 'event': return 1.0;    // Normal — fires when triggered
        case 'runtime': return 1.0;  // Normal — always fresh
        default: return 1.0;
    }
}

export class ImpactSimulator {
    private history: SimulationResult[] = [];

    public simulate(
        sourceNodeIds: string[],
        changeType: string,
        opts: { dryRun?: boolean } = {},
    ): SimulationResult {
        const blastRadius: Map<string, ImpactNode> = new Map();
        // Two traversal modes with distinct semantics (review-corrected):
        //   forward — downstream effects: what the change TRIGGERS/WRITES to.
        //   reverse — dependents: what DEPENDS ON the changed node. Dependents
        //     continue REVERSE (their own dependents are transitively affected)
        //     and descend their composes children (the consuming symbols inside
        //     an importer file) — but they never re-expand forward through
        //     their own dependency edges: an importer's OTHER imports are its
        //     upstream, not this change's blast (verified false-positive class).
        const queue: {
            nodeId: string, distance: number, path: string[], currentStrength: number,
            viaSynId: string, mode: 'forward' | 'reverse', reverseHopType?: string,
        }[] = [];

        for (const sourceId of sourceNodeIds) {
            const startNode = graph.nodes.get(sourceId);
            if (!startNode || startNode.status === 'dormant') continue;

            const adj = graph.adjacency.get(sourceId);
            if (adj) {
                // Follow outgoing edges (source triggers/writes to target)
                for (const outSynId of adj.out) {
                    const syn = graph.synapses.get(outSynId);
                    if (syn && syn.status !== 'dormant') {
                        queue.push({
                            nodeId: syn.target_node_id,
                            distance: 1,
                            path: [sourceId, syn.target_node_id],
                            currentStrength: syn.strength,
                            viaSynId: syn.id,
                            mode: 'forward',
                        });
                    }
                }

                // For "modify" changes: also follow INCOMING edges in reverse.
                if (changeType === 'modify') {
                    for (const inSynId of adj.in) {
                        const syn = graph.synapses.get(inSynId);
                        if (syn && syn.status !== 'dormant') {
                            const originalType = (typeof syn.metadata === 'object' && syn.metadata !== null)
                                ? (syn.metadata as any).original_type
                                : undefined;
                            if (reverseTraversesOnModify(syn.type, originalType)) {
                                queue.push({
                                    nodeId: syn.source_node_id,
                                    distance: 1,
                                    path: [sourceId, syn.source_node_id],
                                    currentStrength: syn.strength,
                                    viaSynId: syn.id,
                                    mode: 'reverse',
                                    reverseHopType: syn.type,
                                });
                            }
                        }
                    }
                }
            }
        }

        const importTimeBindings: { source: string, target: string, synId: string }[] = [];

        while (queue.length > 0) {
            const { nodeId, distance, path, currentStrength, viaSynId, mode, reverseHopType } = queue.shift()!;
            const node = graph.nodes.get(nodeId);
            if (!node || node.status === 'dormant') continue;
            // The sources ARE the change — they are never their own blast.
            if (sourceNodeIds.includes(nodeId)) continue;
            // Planned nodes (Genesis seeds) simulate at half strength and are
            // reported separately — a plan is advisory physics, not risk.
            const plannedMultiplier = node.status === 'planned' ? 0.5 : 1.0;

            // The EXACT synapse that carried the impact rides in the queue —
            // re-deriving it by endpoint pair picked an arbitrary parallel edge
            // and silently misattributed family/binding physics.
            const incomingSyn = graph.synapses.get(viaSynId) || null;
            const btMultiplier = incomingSyn ? bindingTimeMultiplier(incomingSyn.metadata?.binding_time) : 1.0;
            const family = incomingSyn ? familyOf(incomingSyn.type) : 'DEPENDS_ON';

            // Track import-time bindings for warnings
            if (incomingSyn?.metadata?.binding_time === 'import' || incomingSyn?.metadata?.binding_time === 'startup') {
                importTimeBindings.push({
                    source: path[path.length - 2],
                    target: nodeId,
                    synId: viaSynId
                });
            }

            // Family physics (Roadmap 1.2):
            //   CONTRACTS — breaking a shared shape reaches every consumer at
            //     full strength; distance does not soften a broken schema.
            //   CO_FAILED_WITH — incident-learned causality never decays with
            //     distance; it either fires or it doesn't.
            //   Everything else — the standard distance decay.
            const distanceDecay = (family === 'CONTRACTS' || family === 'CO_FAILED_WITH')
                ? 1.0
                : 1 / (distance * 0.5 + 1);
            const effectiveStrength = currentStrength * distanceDecay * btMultiplier * plannedMultiplier;
            if (effectiveStrength <= 0.2) continue;

            let impactLevel: 'critical' | 'high' | 'moderate' | 'low' = 'low';
            if (effectiveStrength > 0.7) impactLevel = 'critical';
            else if (effectiveStrength > 0.4) impactLevel = 'high';
            else if (effectiveStrength > 0.2) impactLevel = 'moderate';

            const existingRecord = blastRadius.get(nodeId);
            if (!existingRecord || impactScore(impactLevel) > impactScore(existingRecord.impact_level)) {
                const warnings = Array.from(graph.amygdala.values()).filter(a => {
                    return a.prevention_rules.some(rule => rule.trigger_nodes.includes(nodeId));
                });

                blastRadius.set(nodeId, {
                    node_id: nodeId,
                    node_name: node.name,
                    region: node.region,
                    impact_level: impactLevel,
                    distance_from_source: distance,
                    connection_path: path,
                    amygdala_warnings: warnings,
                    ...(node.status === 'planned' ? { planned: true } : {}),
                });

                const adj = graph.adjacency.get(nodeId);
                if (adj && mode === 'forward') {
                    // Downstream propagation: everything this node feeds.
                    for (const outSynId of adj.out) {
                        const syn = graph.synapses.get(outSynId);
                        if (syn && syn.status !== 'dormant') {
                            queue.push({
                                nodeId: syn.target_node_id,
                                distance: distance + 1,
                                path: [...path, syn.target_node_id],
                                currentStrength: syn.strength,
                                viaSynId: syn.id,
                                mode: 'forward',
                            });
                        }
                    }
                } else if (adj && mode === 'reverse') {
                    // (a) Transitive dependents: whoever depends on THIS
                    // dependent is also affected (the old depth-1 seeding
                    // missed importers-of-importers entirely).
                    for (const inSynId of adj.in) {
                        const syn = graph.synapses.get(inSynId);
                        if (syn && syn.status !== 'dormant') {
                            const originalType = (syn.metadata as any)?.original_type;
                            if (reverseTraversesOnModify(syn.type, originalType)) {
                                queue.push({
                                    nodeId: syn.source_node_id,
                                    distance: distance + 1,
                                    path: [...path, syn.source_node_id],
                                    currentStrength: syn.strength,
                                    viaSynId: syn.id,
                                    mode: 'reverse',
                                    reverseHopType: syn.type,
                                });
                            }
                        }
                    }
                    // (b) Containment descent: an importer module's own symbols
                    // are the actual consumers — include them. EXCEPT when this
                    // node was reached as the PARENT of the modified symbol
                    // (reverse composes hop): descending there would flag the
                    // modified symbol's unrelated siblings.
                    if (reverseHopType !== 'composes') {
                        for (const outSynId of adj.out) {
                            const syn = graph.synapses.get(outSynId);
                            if (syn && syn.status !== 'dormant' && syn.type === 'composes') {
                                queue.push({
                                    nodeId: syn.target_node_id,
                                    distance: distance + 1,
                                    path: [...path, syn.target_node_id],
                                    currentStrength: syn.strength,
                                    viaSynId: syn.id,
                                    mode: 'reverse',
                                    reverseHopType: 'composes',
                                });
                            }
                        }
                    }
                    // (c) NEVER forward-expand a dependent through its own
                    // dependency edges — those are its upstream, not this
                    // change's blast (the verified sideways-explosion class).
                }
            }
        }

        const blastArray = Array.from(blastRadius.values());
        // Planned reaches never feed the risk score (deliberation-settled)
        const realBlast = blastArray.filter(n => !n.planned);
        const plannedImpact = blastArray.length - realBlast.length;
        const criticalCount = realBlast.filter(n => n.impact_level === 'critical').length;
        const highCount = realBlast.filter(n => n.impact_level === 'high').length;
        const amygdalaAlerts = blastArray.reduce((acc, curr) => acc + curr.amygdala_warnings.length, 0);

        let riskScore = Math.min(1.0, (criticalCount * 0.3 + highCount * 0.15 + amygdalaAlerts * 0.1) / 5);

        let recommendation = '';
        if (riskScore > 0.7) recommendation = "HIGH RISK: Extensive critical-path impact. Break into smaller, testable changes.";
        else if (riskScore > 0.4) recommendation = "MODERATE RISK: Several important connections affected. Ensure test coverage.";
        else if (riskScore > 0.1) recommendation = "LOW RISK: Limited impact. Standard testing should suffice.";
        else recommendation = "MINIMAL RISK: Well-isolated change.";

        if (amygdalaAlerts > 0) {
            recommendation += ` [${amygdalaAlerts}] AMYGDALA WARNING(S): Previous failures detected in impact zone.`;
        }

        if (importTimeBindings.length > 0) {
            recommendation += ` [${importTimeBindings.length}] STALE BINDING(S): ${importTimeBindings.map(b => `${b.source}→${b.target}`).join(', ')} use import-time caching — changes won't propagate without restart/reload.`;
            // Import-time bindings increase the risk score
            riskScore = Math.min(1.0, riskScore + importTimeBindings.length * 0.1);
        }

        if (plannedImpact > 0) {
            recommendation += ` [${plannedImpact}] PLANNED node(s) in reach — check plan conformance (does this change fulfill or contradict the seeded design?).`;
        }

        // ─── Regression gate: which resolved fixes does this change reach? ───
        const affectedIds = [...new Set([...sourceNodeIds, ...blastArray.map((b) => b.node_id)])];
        const touched = findResolutionsTouchingNodes(affectedIds, ['unconditional', 'conditional', 'partial', 'regression_risk']);
        const resolution_conflicts: ResolutionConflict[] = touched.map((r) => ({
            resolution_id: r.id,
            issue: r.issue,
            status: r.status,
            confirmation: r.confirmation,
            nodes: r.target_nodes.filter((n) => affectedIds.includes(n)),
        }));
        const cemented = resolution_conflicts.filter((c) => c.status === 'unconditional');
        if (cemented.length > 0) {
            recommendation += ` [${cemented.length}] CEMENTED FIX(ES) AT RISK: this change reaches ${cemented.map((c) => `"${c.issue}"`).join(', ')} — user-confirmed work. Find a path that preserves them, or plan to re-confirm.`;
        }

        const result: SimulationResult = {
            id: uuidv4(),
            source_nodes: sourceNodeIds,
            change_type: changeType,
            timestamp: new Date().toISOString(),
            total_affected: blastArray.length,
            blast_radius: blastArray,
            amygdala_alerts: amygdalaAlerts,
            risk_score: riskScore,
            recommendation,
            planned_impact: plannedImpact,
            resolution_conflicts,
        };

        // dryRun (consultation briefs): pure computation — no history entry,
        // no simulation_history row, no impact-report file on disk.
        if (!opts.dryRun) {
            // A REAL (recorded) impact sim that reaches a cemented fix demotes it to
            // regression_risk — it now needs re-confirmation. dryRun what-ifs never mutate.
            for (const c of cemented) flagRegressionRisk(c.resolution_id);
            this.history.push(result);
            this.persistResult(result);
            graph.saveSimulationReport(result);
        }

        return result;
    }

    public simulateRemoval(nodeIds: string[]): SimulationResult {
        return this.simulate(nodeIds, 'removal');
    }

    public simulateAddition(nodeIds: string[]): SimulationResult {
        return this.simulate(nodeIds, 'addition');
    }

    public getHistory(): SimulationResult[] {
        return this.history;
    }

    public loadHistory() {
        try {
            const db = getDb();
            const rows = db.prepare('SELECT * FROM simulation_history ORDER BY timestamp DESC').all() as any[];
            this.history = rows.map(r => ({
                ...r,
                source_nodes: JSON.parse(r.source_nodes),
                blast_radius: JSON.parse(r.blast_radius),
            }));
        } catch {
            this.history = [];
        }
    }

    private persistResult(result: SimulationResult) {
        try {
            const db = getDb();
            db.prepare(`
        INSERT INTO simulation_history (id, source_nodes, change_type, timestamp, total_affected, blast_radius, amygdala_alerts, risk_score, recommendation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                result.id,
                JSON.stringify(result.source_nodes),
                result.change_type,
                result.timestamp,
                result.total_affected,
                JSON.stringify(result.blast_radius),
                result.amygdala_alerts,
                result.risk_score,
                result.recommendation
            );
        } catch {
            // DB may not be initialized in all contexts
        }
    }
}
