import express from 'express';
import cors from 'cors';
import { graph } from '../core/graph';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { ImpactSimulator } from '../core/simulator';
import { Region } from '../types';
import {
    validateNodeInput, validateAndBuildNode,
    validateSynapseInput, validateAndBuildSynapse,
    validateAndBuildAmygdala,
} from '../core/validate';
import {
    authMiddleware, getSessionToken, getTokenFilePath, isAuthDisabled, recordConsultation,
} from '../core/session';
import { checkClaims } from '../core/symbolIndex';
import { buildBrief } from '../core/brief';
import { getIntegrationPath } from '../core/context';

export const app = express();

// Evidence Protocol 0.1: the API is local-only (bound to 127.0.0.1 in
// index.ts). CORS additionally restricts browser callers to local origins so
// an arbitrary web page in the user's browser can neither read nor (via
// preflighted requests) mutate the graph.
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
        return cb(null, false);
    },
}));
app.use(express.json());

// Mutating routes require the per-boot session token (see core/session.ts).
app.use(authMiddleware);

const simulator = new ImpactSimulator();

// ─── Session ─────────────────────────────────────────────────────
// Local-only by construction: the server binds 127.0.0.1 and CORS blocks
// cross-origin browser reads, so handing the token to local callers is safe.

app.get('/api/session', (_req, res) => {
    res.json({
        token: getSessionToken(),
        auth_disabled: isAuthDisabled(),
        token_file: getTokenFilePath(),
        usage: 'send header x-plexus-token on every POST/PUT/DELETE',
    });
});

// ─── Nodes ───────────────────────────────────────────────────────

app.get('/api/nodes', (_req, res) => {
    res.json(Array.from(graph.nodes.values()));
});

app.get('/api/nodes/search', (req, res) => {
    const q = req.query.q as string;
    if (!q) return res.json(Array.from(graph.nodes.values()));
    res.json(graph.searchNodes(q));
});

app.get('/api/nodes/:id/connections', (req, res) => {
    const connections = graph.getNodeConnections(req.params.id);
    if (!graph.nodes.has(req.params.id)) return res.status(404).json({ error: 'Node not found' });
    res.json(connections);
});

app.get('/api/nodes/:id', (req, res) => {
    const node = graph.nodes.get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(node);
});

app.post('/api/nodes', (req, res) => {
    // Validate BEFORE any in-memory mutation — a rejected write must never
    // poison the graph maps (they used to mutate before the DB write threw).
    const v = validateAndBuildNode(req.body, 'command');
    if (!v.ok) return res.status(400).json({ error: 'invalid node', details: v.errors });
    try {
        graph.addNode(v.value);
        res.json({ ...v.value, warnings: v.warnings.length ? v.warnings : undefined });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/nodes/:id', (req, res) => {
    const existing = graph.nodes.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Node not found' });
    // existingRegion lets legacy amygdala-region nodes be updated in place
    // (read-modify-write echoes their region) without opening the door to
    // MOVING nodes into the amygdala.
    const v = validateNodeInput(req.body, { partial: true, existingRegion: existing.region });
    if (!v.ok) return res.status(400).json({ error: 'invalid node update', details: v.errors });
    const updated = graph.updateNode(req.params.id, req.body);
    res.json(updated);
});

app.post('/api/nodes/:id/dormant', (req, res) => {
    const { dormant_reason } = req.body;
    const node = graph.nodes.get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const connections = graph.getNodeConnections(node.id);
    const connectedIds = [
        ...connections.incoming.map(s => s.source_node_id),
        ...connections.outgoing.map(s => s.target_node_id)
    ];

    graph.updateNode(node.id, {
        status: 'dormant',
        dormant_reason: dormant_reason || 'Manually deactivated',
        dormant_since: new Date().toISOString(),
        was_connected_to: Array.from(new Set(connectedIds))
    });

    const allSynapses = [...connections.incoming, ...connections.outgoing];
    for (const syn of allSynapses) {
        if (syn.status !== 'dormant') {
            graph.updateSynapse(syn.id, {
                status: 'dormant',
                dormant_reason: `Source node deactivated: ${node.id}`,
                dormant_since: new Date().toISOString()
            });
        }
    }

    res.json({ success: true, deactivated_synapses: allSynapses.length });
});

app.delete('/api/nodes/:id', (req, res) => {
    const deleted = graph.deleteNode(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Node not found' });
    res.json({ success: true });
});

// ─── Synapses ────────────────────────────────────────────────────

app.get('/api/synapses', (_req, res) => {
    res.json(Array.from(graph.synapses.values()));
});

app.get('/api/synapses/cross-region', (_req, res) => {
    res.json(graph.getCrossRegionSynapses());
});

app.get('/api/synapses/:id', (req, res) => {
    const syn = graph.synapses.get(req.params.id);
    if (!syn) return res.status(404).json({ error: 'Synapse not found' });
    res.json(syn);
});

app.post('/api/synapses', (req, res) => {
    const v = validateAndBuildSynapse(req.body);
    if (!v.ok) return res.status(400).json({ error: 'invalid synapse', details: v.errors });
    try {
        graph.addSynapse(v.value);
        res.json({ ...v.value, warnings: v.warnings.length ? v.warnings : undefined });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/synapses/:id', (req, res) => {
    const v = validateSynapseInput(req.body, { partial: true });
    if (!v.ok) return res.status(400).json({ error: 'invalid synapse update', details: v.errors });
    const updated = graph.updateSynapse(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Synapse not found' });
    res.json(updated);
});

app.delete('/api/synapses/:id', (req, res) => {
    const deleted = graph.deleteSynapse(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Synapse not found' });
    res.json({ success: true });
});

// ─── Regions ─────────────────────────────────────────────────────

app.get('/api/regions', (_req, res) => {
    res.json(graph.getRegionStats());
});

app.get('/api/regions/:name', (req, res) => {
    const region = req.params.name as Region;
    const nodes = graph.getRegionNodes(region);
    res.json(nodes);
});

app.get('/api/regions/:name/health', (req, res) => {
    const region = req.params.name as Region;
    const stats = graph.getRegionStats().find(s => s.region === region);
    if (!stats) return res.status(404).json({ error: 'Region not found or empty' });
    res.json(stats);
});

// ─── Amygdala ────────────────────────────────────────────────────

app.get('/api/amygdala', (_req, res) => {
    res.json(Array.from(graph.amygdala.values()));
});

app.get('/api/amygdala/warnings/:node_id', (req, res) => {
    const nodeId = req.params.node_id;
    const warnings = Array.from(graph.amygdala.values()).filter(a =>
        a.prevention_rules.some(rule => rule.trigger_nodes.includes(nodeId))
    );
    res.json(warnings);
});

app.get('/api/amygdala/check', (req, res) => {
    const nodeIds = (req.query.nodes as string || '').split(',').filter(Boolean);
    const warnings: { node_id: string; entries: any[] }[] = [];
    for (const nodeId of nodeIds) {
        const entries = Array.from(graph.amygdala.values()).filter(a =>
            a.prevention_rules.some(rule => rule.trigger_nodes.includes(nodeId))
        );
        if (entries.length > 0) warnings.push({ node_id: nodeId, entries });
    }
    res.json(warnings);
});

app.post('/api/amygdala/check', (req, res) => {
    const nodeIds: string[] = req.body.node_ids || [];
    const warnings: { node_id: string; entries: any[] }[] = [];
    for (const nodeId of nodeIds) {
        const entries = Array.from(graph.amygdala.values()).filter(a =>
            a.prevention_rules.some(rule => rule.trigger_nodes.includes(nodeId))
        );
        if (entries.length > 0) warnings.push({ node_id: nodeId, entries });
    }
    res.json(warnings);
});

app.get('/api/amygdala/:id', (req, res) => {
    const entry = graph.amygdala.get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Amygdala entry not found' });
    res.json(entry);
});

app.post('/api/amygdala', (req, res) => {
    // The factory normalization makes the malformed-entry crash class
    // (missing failure_mode breaking every flushToDisk) impossible.
    const v = validateAndBuildAmygdala(req.body);
    if (!v.ok) return res.status(400).json({ error: 'invalid amygdala entry', details: v.errors });
    try {
        graph.addAmygdalaEntry(v.value);
        res.json(v.value);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Feedback System ─────────────────────────────────────────────

app.post('/api/feedback', (req, res) => {
    try {
        const feedback = {
            id: `FB-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            timestamp: new Date().toISOString(),
            status: 'pending',
            ...req.body
        };

        const dateSlug = feedback.timestamp.split('T')[0];
        const titleSlug = (feedback.title || 'feedback').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
        const fileName = `${dateSlug}_${titleSlug}.json`;

        // Feedback lives with the project's own integration data — never a
        // hardcoded absolute path on one developer's machine.
        const feedbackDir = path.join(getIntegrationPath(), 'feedback');
        if (!fs.existsSync(feedbackDir)) fs.mkdirSync(feedbackDir, { recursive: true });

        fs.writeFileSync(path.join(feedbackDir, fileName), JSON.stringify(feedback, null, 2));
        res.json({ success: true, file: fileName, id: feedback.id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Analysis ────────────────────────────────────────────────────

let analyzerRef: any = null;

export function setAnalyzerRef(analyzer: any) {
    analyzerRef = analyzer;
}

app.post('/api/analyze', async (_req, res) => {
    if (!analyzerRef) return res.status(500).json({ error: 'Analyzer not initialized' });
    try {
        analyzerRef.analyze();
        res.json({ success: true, nodes: graph.nodes.size, synapses: graph.synapses.size });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/analyze/file', (req, res) => {
    if (!analyzerRef) return res.status(500).json({ error: 'Analyzer not initialized' });
    const { file_path } = req.body;
    if (!file_path) return res.status(400).json({ error: 'file_path required' });
    try {
        analyzerRef.analyzeFile(file_path);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analyze/status', (_req, res) => {
    if (!analyzerRef || !analyzerRef.getStatus) {
        return res.json({ running: false, progress: 0, current_file: '', files_total: 0, files_processed: 0, nodes_created: 0, synapses_created: 0, started_at: null, completed_at: null, errors: [] });
    }
    res.json(analyzerRef.getStatus());
});

// ─── Evidence Protocol: claim-check + consultation brief ─────────

// The existence oracle (Roadmap 0.3). Before writing code, declare every
// identifier you intend to rely on; the graph answers exists / missing /
// dormant-with-reason / ambiguous / out_of_scope. Exact matching only —
// fuzzy hits are labeled suggestions, never confirmations.
app.post('/api/claim-check', (req, res) => {
    const identifiers = req.body?.identifiers;
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
        return res.status(400).json({ error: 'identifiers array required — strings or {name, kind?, file_hint?}' });
    }
    if (identifiers.length > 200) {
        return res.status(400).json({ error: 'at most 200 identifiers per check' });
    }
    try {
        const results = checkClaims(identifiers);
        const matchedNodeIds = results.flatMap(r => r.matches.map(m => m.node_id));
        const matchedFiles = Array.from(new Set(results.flatMap(r => r.matches.map(m => m.file_path))));
        const consultationId = recordConsultation('claim_check', matchedNodeIds, matchedFiles);
        res.json({
            consultation_id: consultationId,
            scope: 'TS/JS symbols, components, hooks, endpoints, env vars, types, modules — categories outside the scanned graph answer out_of_scope',
            results,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// The consultation brief (Roadmap 0.4) — the primary consult surface. Ranked,
// hard-capped ~1,500 tokens; raw JSON endpoints remain as the pull layer.
app.post('/api/consult', (req, res) => {
    const { node_ids, query, file_paths, mode } = req.body || {};
    if (!node_ids && !query && !file_paths) {
        return res.status(400).json({ error: 'provide node_ids[], query, or file_paths[]' });
    }
    if ((Array.isArray(node_ids) ? node_ids.length : 0) + (Array.isArray(file_paths) ? file_paths.length : 0) > 200) {
        return res.status(400).json({ error: 'at most 200 targets per consultation' });
    }
    try {
        const brief = buildBrief({ node_ids, query, file_paths, mode }, simulator);
        const consultationId = recordConsultation('consult', brief.consulted_node_ids, brief.consulted_file_paths);
        res.json({ consultation_id: consultationId, ...brief });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Simulation ──────────────────────────────────────────────────

app.post('/api/simulate/impact', (req, res) => {
    const { node_ids, change_type } = req.body;
    if (!node_ids || !Array.isArray(node_ids)) {
        return res.status(400).json({ error: "node_ids array required" });
    }
    try {
        const result = simulator.simulate(node_ids, change_type || 'modify');
        const files = Array.from(new Set(
            node_ids.map((id: string) => graph.nodes.get(id)?.file_path).filter(Boolean)
        )) as string[];
        recordConsultation('simulate', node_ids, files);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/simulate/remove', (req, res) => {
    const { node_ids } = req.body;
    if (!node_ids || !Array.isArray(node_ids)) {
        return res.status(400).json({ error: "node_ids array required" });
    }
    try {
        const result = simulator.simulateRemoval(node_ids);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/simulate/add', (req, res) => {
    const { node_ids } = req.body;
    if (!node_ids || !Array.isArray(node_ids)) {
        return res.status(400).json({ error: "node_ids array required" });
    }
    try {
        const result = simulator.simulateAddition(node_ids);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/simulate/history', (_req, res) => {
    res.json(simulator.getHistory());
});

// ─── Snapshots ───────────────────────────────────────────────────

app.post('/api/snapshots', (req, res) => {
    const { description } = req.body;
    try {
        const meta = graph.createSnapshot(description || 'Manual snapshot');
        res.json(meta);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/snapshots', (_req, res) => {
    res.json(graph.getSnapshots());
});

app.get('/api/snapshots/diff/:a/:b', (req, res) => {
    const diff = graph.diffSnapshots(req.params.a, req.params.b);
    if (!diff) return res.status(404).json({ error: 'One or both snapshots not found' });
    res.json(diff);
});

app.get('/api/snapshots/:id', (req, res) => {
    const snap = graph.getSnapshot(req.params.id);
    if (!snap) return res.status(404).json({ error: 'Snapshot not found' });
    res.json(snap);
});

// ─── Visualization Stats ─────────────────────────────────────────

app.get('/api/viz/stats', (_req, res) => {
    const regionStats = graph.getRegionStats();
    const totalNodes = graph.nodes.size;
    const totalSynapses = graph.synapses.size;
    const totalAmygdala = graph.amygdala.size;
    const crossRegionCount = graph.getCrossRegionSynapses().length;

    const nodeTypes: Record<string, number> = {};
    for (const node of graph.nodes.values()) {
        nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }

    const synapseTypes: Record<string, number> = {};
    for (const syn of graph.synapses.values()) {
        synapseTypes[syn.type] = (synapseTypes[syn.type] || 0) + 1;
    }

    res.json({
        total_nodes: totalNodes,
        total_synapses: totalSynapses,
        total_amygdala: totalAmygdala,
        cross_region_synapses: crossRegionCount,
        regions: regionStats,
        node_types: nodeTypes,
        synapse_types: synapseTypes,
    });
});
