import { graph } from './graph';
import { AmygdalaEntry, ImpactNode, SimulationResult } from '../types';
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

export class ImpactSimulator {
    private history: SimulationResult[] = [];

    public simulate(sourceNodeIds: string[], changeType: string): SimulationResult {
        const blastRadius: Map<string, ImpactNode> = new Map();
        const queue: { nodeId: string, distance: number, path: string[], currentStrength: number }[] = [];

        for (const sourceId of sourceNodeIds) {
            const startNode = graph.nodes.get(sourceId);
            if (!startNode || startNode.status === 'dormant') continue;

            const adj = graph.adjacency.get(sourceId);
            if (adj) {
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
            }
        }

        while (queue.length > 0) {
            const { nodeId, distance, path, currentStrength } = queue.shift()!;
            const node = graph.nodes.get(nodeId);
            if (!node || node.status === 'dormant') continue;

            const effectiveStrength = currentStrength * (1 / (distance * 0.5 + 1));
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
                            queue.push({
                                nodeId: syn.target_node_id,
                                distance: distance + 1,
                                path: [...path, syn.target_node_id],
                                currentStrength: syn.strength
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

        const riskScore = Math.min(1.0, (criticalCount * 0.3 + highCount * 0.15 + amygdalaAlerts * 0.1) / 5);

        let recommendation = '';
        if (riskScore > 0.7) recommendation = "HIGH RISK: Extensive critical-path impact. Break into smaller, testable changes.";
        else if (riskScore > 0.4) recommendation = "MODERATE RISK: Several important connections affected. Ensure test coverage.";
        else if (riskScore > 0.1) recommendation = "LOW RISK: Limited impact. Standard testing should suffice.";
        else recommendation = "MINIMAL RISK: Well-isolated change.";

        if (amygdalaAlerts > 0) {
            recommendation += ` [${amygdalaAlerts}] AMYGDALA WARNING(S): Previous failures detected in impact zone.`;
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

        this.history.push(result);
        this.persistResult(result);
        graph.saveSimulationReport(result);

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
