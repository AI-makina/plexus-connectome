import { graph } from './graph';
import { AmygdalaEntry, ImpactNode, SimulationResult } from '../types';
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
        const queue: { nodeId: string, distance: number, path: string[], currentStrength: number, viaReverse?: boolean }[] = [];

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
                            currentStrength: syn.strength
                        });
                    }
                }

                // For "modify" changes: also follow INCOMING edges in reverse.
                // When node A is modified, every node B that depends on /
                // invokes / reads from A is affected. Family-based (Roadmap
                // 1.2): the old 4-type whitelist never fired on real scanned
                // graphs — the scanner emits imports/renders/calls/composes,
                // none of which were listed, so the physics was latent.
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
                                    viaReverse: true
                                });
                            }
                        }
                    }
                }
            }
        }

        const importTimeBindings: { source: string, target: string, synId: string }[] = [];

        while (queue.length > 0) {
            const { nodeId, distance, path, currentStrength, viaReverse } = queue.shift()!;
            const node = graph.nodes.get(nodeId);
            if (!node || node.status === 'dormant') continue;
            // The sources ARE the change — they are never their own blast.
            if (sourceNodeIds.includes(nodeId)) continue;

            // Check the synapse that carried the impact here (searches BOTH
            // directions — reverse-traversed hops used to always miss and get
            // multiplier 1.0, so stale-binding physics never applied to them)
            const incomingSynId = path.length >= 2 ? this.findSynapse(path[path.length - 2], nodeId) : null;
            const incomingSyn = incomingSynId ? graph.synapses.get(incomingSynId) : null;
            const btMultiplier = incomingSyn ? bindingTimeMultiplier(incomingSyn.metadata?.binding_time) : 1.0;
            const family = incomingSyn ? familyOf(incomingSyn.type) : 'DEPENDS_ON';

            // Track import-time bindings for warnings
            if (incomingSyn?.metadata?.binding_time === 'import' || incomingSyn?.metadata?.binding_time === 'startup') {
                importTimeBindings.push({
                    source: path[path.length - 2],
                    target: nodeId,
                    synId: incomingSynId!
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
            const effectiveStrength = currentStrength * distanceDecay * btMultiplier;
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
                    amygdala_warnings: warnings
                });

                const adj = graph.adjacency.get(nodeId);
                if (adj) {
                    for (const outSynId of adj.out) {
                        const syn = graph.synapses.get(outSynId);
                        if (syn && syn.status !== 'dormant') {
                            // Containment echo guard: a node reached in REVERSE
                            // (a reader/container of the modified node) must not
                            // re-expand DOWN through its other composes edges —
                            // the modified symbol's siblings are not its blast.
                            if (viaReverse && syn.type === 'composes') continue;
                            queue.push({
                                nodeId: syn.target_node_id,
                                distance: distance + 1,
                                path: [...path, syn.target_node_id],
                                currentStrength: syn.strength,
                                viaReverse
                            });
                        }
                    }
                }
            }
        }

        const blastArray = Array.from(blastRadius.values());
        const criticalCount = blastArray.filter(n => n.impact_level === 'critical').length;
        const highCount = blastArray.filter(n => n.impact_level === 'high').length;
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

        const result: SimulationResult = {
            id: uuidv4(),
            source_nodes: sourceNodeIds,
            change_type: changeType,
            timestamp: new Date().toISOString(),
            total_affected: blastArray.length,
            blast_radius: blastArray,
            amygdala_alerts: amygdalaAlerts,
            risk_score: riskScore,
            recommendation
        };

        // dryRun (consultation briefs): pure computation — no history entry,
        // no simulation_history row, no impact-report file on disk.
        if (!opts.dryRun) {
            this.history.push(result);
            this.persistResult(result);
            graph.saveSimulationReport(result);
        }

        return result;
    }

    private findSynapse(sourceId: string, targetId: string): string | null {
        // Forward edge first (source → target)…
        const adj = graph.adjacency.get(sourceId);
        if (adj) {
            for (const synId of adj.out) {
                const syn = graph.synapses.get(synId);
                if (syn && syn.target_node_id === targetId) return synId;
            }
        }
        // …then the reverse edge (target → source): reverse-traversed modify
        // hops ride the real edge pointing the other way. Without this branch
        // the binding-time amplifier and family physics never saw them.
        const tAdj = graph.adjacency.get(targetId);
        if (tAdj) {
            for (const synId of tAdj.out) {
                const syn = graph.synapses.get(synId);
                if (syn && syn.target_node_id === sourceId) return synId;
            }
        }
        return null;
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
