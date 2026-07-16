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
import { familyOf } from '../core/families';
import { issueReceipt } from '../core/receipts';
import { getIntegrationPath, getManifest, getTargetPath, setManifest } from '../core/context';
import {
    createResolution, getResolution, listResolutions, listPendingConfirmation,
    setResolutionStatus, confirmResolution, flagRegressionRisk, linkAmygdala, linkInvariant,
} from '../core/resolutions';
import { ResolutionStatus, ConfirmationVerdict } from '../types';
import { engineVersion } from '../core/engineVersion';
import { record as recordEff, summary as effSummary } from '../core/effectiveness';
import { nextBatch as feedbackBatch, recordAnswer as recordFeedback, summary as feedbackSummary, recentAnswers as feedbackRecent } from '../core/feedback';
import { readPending, acceptPending, deferPending, reconcilePending } from '../core/pendingUpdate';
import { spawn } from 'child_process';

// Re-exec this process onto the current build (shared by /restart and /accept-update).
function reexecEngine(res: any, extra: any = {}) {
    res.json({ restarting: true, ...engineVersion(), ...extra, note: 'Engine re-executing on the current build — reconnect shortly.' });
    setTimeout(() => {
        try {
            const child = spawn(process.execPath, process.argv.slice(1), {
                detached: true, stdio: 'ignore', cwd: process.cwd(),
                env: { ...process.env, PLEXUS_BOOT_DELAY_MS: '1200', PLEXUS_NO_OPEN: '1' },
            });
            child.unref();
        } catch { /* no restart */ }
        process.exit(0);
    }, 400);
}

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

// ─── Project identity ────────────────────────────────────────────
// A brain's STRUCTURAL identity is its path + target_app.name (set at init,
// changed only by deliberately renaming the folder / re-initializing). The
// DISPLAY name is a cosmetic overlay so multiple open connectomes can be told
// apart in the viz — it lives in manifest.visualization and is never used for
// resolution (registry, MCP cwd-walk, receipts), so renaming it breaks nothing.

function projectIdentity() {
    const m = getManifest();
    let rootPath: string | null = null;
    try { rootPath = getTargetPath(); } catch { /* context not initialized */ }
    const appName = m?.target_app?.name || (rootPath ? path.basename(rootPath) : 'Untitled brain');
    const displayName = m?.visualization?.display_name || null;
    return {
        name: displayName || appName,
        app_name: appName,
        display_name: displayName,
        root_path: rootPath,
    };
}

app.get('/api/project', (_req, res) => {
    res.json(projectIdentity());
});

app.put('/api/project/display-name', (req, res) => {
    const raw = req.body?.display_name;
    if (raw !== null && raw !== undefined && typeof raw !== 'string') {
        return res.status(400).json({ error: 'display_name must be a string or null' });
    }
    // Control characters would corrupt the manifest/header; collapse
    // whitespace to keep the chip honest. Empty or null clears the override
    // back to target_app.name.
    const cleaned = (raw || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length > 48) {
        return res.status(400).json({ error: 'display_name too long (max 48 chars)' });
    }
    const manifestPath = path.join(getIntegrationPath(), 'plexus-manifest.json');
    if (!fs.existsSync(manifestPath)) {
        return res.status(404).json({ error: 'no plexus-manifest.json for this brain' });
    }
    try {
        // Patch the FILE fresh (same discipline as patchManifestPorts) so a
        // concurrent out-of-band manifest edit is not clobbered from memory.
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        m.visualization = m.visualization || {};
        if (cleaned) m.visualization.display_name = cleaned;
        else delete m.visualization.display_name;
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
        setManifest(m); // keep this boot's in-memory copy in sync
        res.json(projectIdentity());
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
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
    // family is DERIVED (core/families.ts) — physics reads families, the LLM
    // reads the legacy type label as subtype metadata.
    res.json(Array.from(graph.synapses.values()).map(s => ({ ...s, family: familyOf(s.type) })));
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

// Utilization & maturity (Roadmap 1.3): is the whole brain being used, and
// may it gate — or only advise?
app.get('/api/regions/utilization', (_req, res) => {
    const { computeUtilization } = require('../core/utilization');
    res.json(computeUtilization());
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

// ─── Resolutions (fix lifecycle + confirmation) ──────────────────
// The engine owns the lifecycle; apps render the confirm box and relay verdicts.

app.get('/api/resolutions', (req, res) => {
    const status = req.query.status as ResolutionStatus | undefined;
    const confirmation = req.query.confirmation as ConfirmationVerdict | undefined;
    res.json(listResolutions({ status, confirmation }));
});

// pending MUST precede /:id so it isn't captured as an id
app.get('/api/resolutions/pending', (_req, res) => {
    res.json(listPendingConfirmation());
});

app.post('/api/resolutions', (req, res) => {
    const { issue, target_nodes, status, simulation_ref, source_app } = req.body || {};
    if (!issue || typeof issue !== 'string') return res.status(400).json({ error: 'issue (string) is required' });
    res.json(createResolution({ issue, target_nodes, status, simulation_ref, source_app }));
});

app.get('/api/resolutions/:id', (req, res) => {
    const r = getResolution(req.params.id);
    if (!r) return res.status(404).json({ error: 'Resolution not found' });
    res.json(r);
});

// The confirm box posts here: { verdict: solved|partial|not_solved, comment? }
app.post('/api/resolutions/:id/confirm', (req, res) => {
    const { verdict, comment } = req.body || {};
    const valid: ConfirmationVerdict[] = ['unconfirmed', 'solved', 'partial', 'not_solved'];
    if (!valid.includes(verdict)) return res.status(400).json({ error: `verdict must be one of: ${valid.join(', ')}` });
    const r = confirmResolution(req.params.id, verdict, comment);
    if (!r) return res.status(404).json({ error: 'Resolution not found' });
    res.json(r);
});

// Apps report lifecycle transitions (e.g. applied, conditional after an AI test passes).
app.post('/api/resolutions/:id/status', (req, res) => {
    const { status } = req.body || {};
    const valid: ResolutionStatus[] = ['wip', 'applied', 'conditional', 'unconditional', 'partial', 'failed', 'regression_risk', 'blocked'];
    if (!valid.includes(status)) return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    const r = setResolutionStatus(req.params.id, status);
    if (!r) return res.status(404).json({ error: 'Resolution not found' });
    res.json(r);
});

app.post('/api/resolutions/:id/link', (req, res) => {
    const { amygdala_id, invariant_id } = req.body || {};
    if (!getResolution(req.params.id)) return res.status(404).json({ error: 'Resolution not found' });
    let r = getResolution(req.params.id);
    if (amygdala_id) r = linkAmygdala(req.params.id, amygdala_id);
    if (invariant_id) r = linkInvariant(req.params.id, invariant_id);
    res.json(r);
});

// ─── Engine self-update ──────────────────────────────────────────
// One-click "bring this connectome onto the latest Plexus" — no per-brain terminal
// restart. Rebuild the shared dist once; each viz sees update_available and can apply.

app.get('/api/engine/version', (_req, res) => {
    const ev = engineVersion();
    // Reconcile first: if we're already running the queued build (applied via ☰ "Apply
    // update" or a manual restart, not just the modal), resolve the marker so the modal
    // stops re-firing and the CRM reflects "updated".
    res.json({ ...ev, pending: reconcilePending(ev.running_build) });
});

// ─── Effectiveness telemetry (content-blind "dye") ───────────────
// Where Plexus is / isn't working — counters by category (ai / harness / structure /
// value), claim-check hallucination + coverage-gap rates, per-model trend. No node
// content ever leaves here; it's failure/usage TYPES + counts only.
app.get('/api/effectiveness', (_req, res) => {
    res.json(effSummary());
});

// ─── AI questionnaire (qualitative track) ────────────────────────
// The caller (MCP/app) asks at a session boundary; the engine returns a batch only
// if the ~weekly throttle has elapsed, seeded by this session's metrics.
app.get('/api/feedback/questions', (_req, res) => {
    res.json(feedbackBatch());
});

// { model, answers: [{ question_id?, question?, theme?, seeded_by?, answer }] }
app.post('/api/feedback', (req, res) => {
    const { model, answers } = req.body || {};
    if (!Array.isArray(answers) || answers.length === 0) return res.status(400).json({ error: 'answers[] required' });
    let stored = 0;
    for (const a of answers.slice(0, 10)) { if (a?.answer) { recordFeedback(String(model || ''), a); stored++; } }
    res.json({ stored });
});

app.get('/api/feedback', (_req, res) => {
    res.json({ ...feedbackSummary(), recent: feedbackRecent(20) });
});

// Token-guarded (global authMiddleware). Re-execs this process on the current build:
// migrations re-run (additive), new code + viz load. A boot delay in the child lets
// this process release the port first (clean handoff); the viz auto-reconnects.
app.post('/api/engine/restart', (_req, res) => {
    reexecEngine(res);
});

// Consent-based update queue. The client (in their connectome) decides:
//   accept → record 'updated' then re-exec onto the new build.
//   defer  → record 'pushed' ("later"); the offer stays on file, nothing changes.
app.post('/api/engine/accept-update', (_req, res) => {
    const p = acceptPending();
    reexecEngine(res, { accepted: true, pending: p });
});

app.post('/api/engine/defer-update', (_req, res) => {
    const p = deferPending();
    res.json({ ok: true, pending: p });
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
        // Effectiveness dye — content-blind: record only STATUS + count per identifier,
        // never the identifier itself. missing = hallucination caught (value); out_of_scope
        // = the graph is blind to this symbol category (structure gap); exists = verified.
        const ccModel = typeof req.body?.model === 'string' ? req.body.model : '';
        for (const r of results) {
            const st = (r as any).status || 'unknown';
            recordEff(st === 'out_of_scope' ? 'structure' : 'value', 'claim_check', { metric: st, model: ccModel });
        }
        const matchedNodeIds = results.flatMap(r => r.matches.map(m => m.node_id));
        const matchedFiles = Array.from(new Set(results.flatMap(r => r.matches.map(m => m.file_path))));
        const consultationId = recordConsultation('claim_check', matchedNodeIds, matchedFiles);
        const receipt = issueReceipt(getIntegrationPath(), 'claim_check', matchedFiles);
        res.json({
            consultation_id: consultationId,
            receipt: { id: receipt.id, fingerprint: receipt.nonce.slice(0, 4), covers: receipt.files },
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
        recordEff('ai', 'consult', { model: typeof req.body?.model === 'string' ? req.body.model : '' }); // AI is using the brain (usage)
        const consultationId = recordConsultation('consult', brief.consulted_node_ids, brief.consulted_file_paths);
        // The receipt covers what the brief resolved AND the file_paths the
        // caller declared it's about to touch — so consulting a file you're
        // about to CREATE (no node yet) still earns the right to edit it.
        const covered = Array.from(new Set([
            ...(brief.all_resolved_files || brief.consulted_file_paths || []),
            ...((Array.isArray(file_paths) ? file_paths : []) as string[]),
        ]));
        const receipt = issueReceipt(getIntegrationPath(), 'consult', covered);
        res.json({
            consultation_id: consultationId,
            receipt: { id: receipt.id, fingerprint: receipt.nonce.slice(0, 4), covers: receipt.files },
            ...brief,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Activity pulse (the reassurance surface) ────────────────────
// The user never has to interact with Plexus — but they deserve PROOF the AI
// is leaning on it. Recent ledger activity + memory + growth, dashboard-ready.
app.get('/api/activity', (_req, res) => {
    try {
        const { getConsultationsSince } = require('../core/session');
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const recent = getConsultationsSince(since);
        const stats = graph.getState().stats;
        res.json({
            consultations_24h: recent.length,
            last_consultation: recent[0]?.timestamp || null,
            recent: recent.slice(0, 12).map((c: any) => ({
                kind: c.kind, timestamp: c.timestamp,
                files: c.file_paths.slice(0, 3), nodes: c.node_ids.length,
            })),
            amygdala_entries: stats.amygdala_entries,
            active_nodes: stats.active_nodes,
            dormant_nodes: stats.dormant_nodes,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Invariants (Roadmap 1.6 — fact-keyed) ───────────────────────
app.get('/api/invariants', (_req, res) => {
    const { loadInvariants } = require('../core/invariants');
    res.json(loadInvariants());
});

app.post('/api/invariants', (req, res) => {
    const { declareInvariant } = require('../core/invariants');
    const { statement, node_ids, declared_by } = req.body || {};
    const r = declareInvariant(statement, node_ids, declared_by === 'user' ? 'user' : 'llm');
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json(r.invariant);
});

app.delete('/api/invariants/:id', (req, res) => {
    const { retireInvariant } = require('../core/invariants');
    if (!retireInvariant(req.params.id)) return res.status(404).json({ error: 'invariant not found' });
    res.json({ success: true });
});

// Claim-diff verification (Roadmap 1.5, workflow Step 6): the AI declares
// what it claims to have created/touched; the engine diffs those claims
// against the graph and file fingerprints. Without this, the update step is
// honor-system and the graph rots. verdict: 'pass' only when every claim
// is confirmed and every touched file was re-scanned.
app.post('/api/verify', (req, res) => {
    const { created_symbols, touched_files } = req.body || {};
    try {
        const confirmed: any[] = [];
        const contradicted: any[] = [];
        for (const c of (Array.isArray(created_symbols) ? created_symbols : []).slice(0, 200)) {
            const name = typeof c === 'string' ? c : c?.name;
            if (typeof name !== 'string' || !name) continue;
            const results = checkClaims([typeof c === 'string' ? c : { name, file_hint: c.file_path }]);
            const r = results[0];
            if (r.status === 'exists' || r.status === 'ambiguous') {
                confirmed.push({ name, matches: r.matches.map(m => `${m.file_path} (${m.type})`) });
            } else {
                contradicted.push({ name, status: r.status, note: 'claimed created, but not present in the graph — re-scan the file (POST /api/analyze/file) or the claim is false' });
            }
        }

        // File freshness: a touched file whose current hash differs from the
        // last-scan fingerprint is UNRECONCILED — the graph doesn't know it.
        const crypto = require('crypto');
        const { getTargetPath } = require('../core/context');
        let fingerprints: Record<string, string> = {};
        try {
            fingerprints = JSON.parse(fs.readFileSync(path.join(getIntegrationPath(), 'fingerprints.json'), 'utf8'));
        } catch { /* never scanned */ }
        const unreconciled: string[] = [];
        const reconciled: string[] = [];
        const unknown: string[] = [];
        for (const f of (Array.isArray(touched_files) ? touched_files : []).slice(0, 200)) {
            if (typeof f !== 'string') continue;
            const rel = f.replace(/^\.?\//, '');
            try {
                const abs = path.join(getTargetPath(), rel);
                const hash = crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex');
                if (fingerprints[rel] === hash) reconciled.push(rel);
                else unreconciled.push(rel);
            } catch {
                unknown.push(rel);
            }
        }

        const verdict = contradicted.length === 0 && unreconciled.length === 0 ? 'pass' : 'mismatch';
        // Effectiveness (content-blind): the Step-6 truth check. contradicted = AI claimed
        // a symbol it didn't actually leave in the graph (divergence); unreconciled = files
        // the graph doesn't know yet (drift the harness has to absorb).
        const vModel = typeof req.body?.model === 'string' ? req.body.model : '';
        recordEff('harness', 'verify', { metric: verdict, model: vModel });
        if (contradicted.length > 0) recordEff('structure', 'divergence', { metric: 'claimed_created_but_absent', model: vModel, count: contradicted.length });
        if (unreconciled.length > 0) recordEff('harness', 'unreconciled_file', { model: vModel, count: unreconciled.length });
        recordConsultation('claim_check', [], [...reconciled, ...unreconciled]);
        res.json({
            verdict,
            confirmed,
            contradicted,
            files: { reconciled, unreconciled, unknown },
            hint: unreconciled.length > 0
                ? 'unreconciled files: run POST /api/analyze/file {"file_path": "..."} for each, then verify again'
                : undefined,
        });
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
        // Effectiveness (content-blind): the AI leaned on impact analysis; record the
        // blast band only, model-tagged.
        const band = result.risk_score > 0.7 ? 'critical' : result.risk_score > 0.4 ? 'high' : result.risk_score > 0.1 ? 'moderate' : 'low';
        recordEff('ai', 'simulate', { metric: band, model: typeof req.body?.model === 'string' ? req.body.model : '' });
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
    const synapseFamilies: Record<string, number> = {};
    for (const syn of graph.synapses.values()) {
        synapseTypes[syn.type] = (synapseTypes[syn.type] || 0) + 1;
        const fam = familyOf(syn.type);
        synapseFamilies[fam] = (synapseFamilies[fam] || 0) + 1;
    }

    res.json({
        total_nodes: totalNodes,
        total_synapses: totalSynapses,
        total_amygdala: totalAmygdala,
        cross_region_synapses: crossRegionCount,
        regions: regionStats,
        node_types: nodeTypes,
        synapse_types: synapseTypes,
        synapse_families: synapseFamilies,
    });
});
