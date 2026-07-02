import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';
import { graph } from '../core/graph';
import { createNode, createSynapse, deterministicNodeId, deterministicSynapseId } from '../core/factories';
import { PlexusNode, Region, NodeType, AnalysisStatus } from '../types';
import { classifyRegionScored, ScoredClassification } from './classifier';
import { discoverFiles, saveFingerprints, loadFingerprints, getChangedFiles } from './discovery';
import {
    extractReactComponents, extractHooks, extractRouteHandlers,
    extractTypesAndInterfaces, extractCallGraph, extractJSXComposition,
    extractEnvVars, extractEventPatterns, extractImportsDetailed, extractExports,
    extractCSSPositioning, extractDOMMeasurements
} from './parsers';
import { buildRelationships, resetRelationshipTracking } from './relationships';
import { analyzeArtifacts } from './artifacts';
import { getIntegrationPath } from '../core/context';
import path from 'path';

interface FileAnalysisData {
    filePath: string;
    moduleNodeId: string;
    childNodeIds: Map<string, string>;
    imports: ReturnType<typeof extractImportsDetailed>;
    exports: ReturnType<typeof extractExports>;
    calls: ReturnType<typeof extractCallGraph>;
    hooks: ReturnType<typeof extractHooks>;
    jsxComposition: ReturnType<typeof extractJSXComposition>;
    renderedComponents: string[];
}

export class CodeAnalyzer {
    private project: Project;
    private targetPath: string;
    private status: AnalysisStatus = {
        running: false,
        progress: 0,
        current_file: '',
        files_total: 0,
        files_processed: 0,
        nodes_created: 0,
        synapses_created: 0,
        started_at: null,
        completed_at: null,
        errors: [],
    };

    constructor(targetPath: string) {
        this.targetPath = targetPath;
        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
            compilerOptions: { allowJs: true, jsx: 2 /* React */ },
        });
    }

    public getStatus(): AnalysisStatus {
        return { ...this.status };
    }

    public analyze() {
        this.status = {
            running: true, progress: 0, current_file: '', files_total: 0,
            files_processed: 0, nodes_created: 0, synapses_created: 0,
            started_at: new Date().toISOString(), completed_at: null, errors: [],
        };

        console.log(`[Analyzer] Scanning ${this.targetPath}...`);

        // Phase 0: one-time migration — collapse (source, type, target) twin
        // synapses left by earlier preserve/restore passes on legacy graphs.
        this.dedupeSynapseTwins();

        // Phase 1: Discovery
        const files = discoverFiles(this.targetPath);
        this.status.files_total = files.length;
        console.log(`[Analyzer] Found ${files.length} source files. Processing...`);

        // Add files to ts-morph project
        for (const f of files) {
            try {
                this.project.addSourceFileAtPath(f.absolutePath);
            } catch (err: any) {
                this.status.errors.push(`Failed to add ${f.path}: ${err.message}`);
            }
        }

        const sourceFiles = this.project.getSourceFiles();
        const analysisMap = new Map<string, FileAnalysisData>();
        const initialNodeCount = graph.nodes.size;
        const initialSynapseCount = graph.synapses.size;

        // Phase 2: Parse each file → wipe stale scan facts, then create nodes.
        // The per-file wipe uses the SAME origin rule as analyzeFile (undefined
        // counts as scan) — without it, a legacy UUID connectome would keep its
        // old scan nodes alongside the new deterministic-id ones, permanently
        // doubling every symbol on first analyze. Synapses attached to wiped
        // nodes are preserved and restored after the rebuild (see helper docs).
        const preservedSynapses: any[] = [];
        for (let i = 0; i < sourceFiles.length; i++) {
            const sf = sourceFiles[i];
            const absolutePath = sf.getFilePath();
            const relativePath = path.relative(this.targetPath, absolutePath);

            this.status.current_file = relativePath;
            this.status.files_processed = i + 1;
            this.status.progress = Math.round(((i + 1) / sourceFiles.length) * 80); // 0-80%

            try {
                preservedSynapses.push(...this.wipeScanNodesForFile(relativePath));
                const data = this.processFile(sf, relativePath);
                analysisMap.set(relativePath, data);
            } catch (err: any) {
                this.status.errors.push(`Error processing ${relativePath}: ${err.message}`);
            }
        }

        // Phase 2.4: Artifact parsers (Roadmap 1.4) — package.json, Docker,
        // .env schema, CI pipelines, prisma models, design tokens, styles,
        // locales. This is where brain_stem/temporal/cerebellum stop starving.
        // Pre-wipe (review-caught): artifact files are never in the ts-morph
        // set, so without wiping their previous scan nodes first, removed
        // services/scripts/models/env-vars would live forever (their file
        // still exists, so stale cleanup never fires).
        console.log('[Analyzer] Parsing artifacts (manifests, schemas, pipelines)...');
        const priorArtifactPaths = new Set<string>();
        for (const node of graph.nodes.values()) {
            if ((node.metadata as any)?.origin === 'scan' && (node.tags || []).includes('artifact')) {
                priorArtifactPaths.add(node.file_path);
            }
        }
        for (const p of priorArtifactPaths) {
            preservedSynapses.push(...this.wipeScanNodesForFile(p));
        }
        const artifacts = analyzeArtifacts(this.targetPath);
        if (artifacts.nodesCreated > 0) {
            console.log(`[Analyzer] ${artifacts.nodesCreated} artifact nodes from ${artifacts.paths.length} files.`);
        }

        // Phase 2.5: Stale-scan cleanup — scan-origin nodes whose file no longer
        // exists in the discovered set are map facts of a dead map. Explicitly
        // scan-origin ONLY: legacy nodes without origin and all seed/llm/
        // incident/command nodes are enrichment and must survive re-scans.
        // GUARD: if discovery returned nothing (wrong path, fs error), skip —
        // an empty scan must never mass-delete the map.
        if (files.length > 0) {
            const discovered = new Set<string>();
            for (const f of files) {
                discovered.add(f.path);
                discovered.add('/' + f.path);
            }
            for (const p of artifacts.paths) discovered.add(p);
            const staleIds: string[] = [];
            for (const node of graph.nodes.values()) {
                if ((node.metadata as any)?.origin === 'scan' && !discovered.has(node.file_path)) {
                    staleIds.push(node.id);
                }
            }
            // Targeted legacy migration: the old build fabricated this amygdala
            // placeholder during scans (removed behavior) — clean it up here so
            // existing connectomes shed it on their first re-analyze.
            if (graph.nodes.has('AMYGDALA-a98b3c4f')) staleIds.push('AMYGDALA-a98b3c4f');
            for (const id of staleIds) graph.deleteNode(id);
            if (staleIds.length > 0) console.log(`[Analyzer] Removed ${staleIds.length} stale scan nodes (files gone).`);
        }

        // Phase 3: Build cross-file relationships
        this.status.progress = 85;
        console.log('[Analyzer] Building cross-file relationships...');
        resetRelationshipTracking();
        buildRelationships(analysisMap);

        // Phase 3.2: Restore preserved synapses (agent-written edges + incoming
        // scan edges from unprocessed files) — only where both endpoints exist.
        this.restorePreservedSynapses(preservedSynapses);

        // Phase 3.5: Calculate Cascade Influence
        console.log('[Analyzer] Calculating Synapse Cascade Influence...');
        this.calculateCascadeInfluence();

        // Phase 4: Update health metrics
        this.status.progress = 95;
        this.updateHealthMetrics();

        // Phase 5: Save fingerprints
        try {
            const integrationDir = getIntegrationPath();
            saveFingerprints(integrationDir, files);
        } catch {
            // context may not be set
        }

        this.status.nodes_created = graph.nodes.size - initialNodeCount;
        this.status.synapses_created = graph.synapses.size - initialSynapseCount;
        this.status.running = false;
        this.status.progress = 100;
        this.status.completed_at = new Date().toISOString();

        console.log(`[Analyzer] Analysis complete. ${this.status.nodes_created} nodes, ${this.status.synapses_created} synapses created.`);
    }

    public analyzeFile(filePath: string) {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.targetPath, filePath);
        const relativePath = path.relative(this.targetPath, absolutePath);

        // Remove old SCAN nodes for this file — origin-aware (Roadmap 0.2):
        // re-scans may only replace map facts; synapses touching them are
        // preserved and restored after the rebuild.
        const preservedSynapses = this.wipeScanNodesForFile(relativePath);

        // Re-analyze the single file
        let sf: SourceFile;
        try {
            const existing = this.project.getSourceFile(absolutePath);
            if (existing) {
                existing.refreshFromFileSystemSync();
                sf = existing;
            } else {
                sf = this.project.addSourceFileAtPath(absolutePath);
            }
        } catch (err: any) {
            throw new Error(`Cannot load file ${filePath}: ${err.message}`);
        }

        const analysisMap = new Map<string, FileAnalysisData>();
        const data = this.processFile(sf, relativePath);
        analysisMap.set(relativePath, data);

        resetRelationshipTracking();
        buildRelationships(analysisMap);
        this.restorePreservedSynapses(preservedSynapses);
        this.calculateCascadeInfluence();
        this.updateHealthMetrics();

        // Reconcile the file's fingerprint (review-caught): /api/verify hints
        // "re-scan then verify again" — without this update, its own
        // remediation could never clear 'unreconciled'.
        try {
            const integrationDir = getIntegrationPath();
            const crypto = require('crypto');
            const fs = require('fs');
            const fpPath = path.join(integrationDir, 'fingerprints.json');
            let fingerprints: Record<string, string> = {};
            try { fingerprints = JSON.parse(fs.readFileSync(fpPath, 'utf8')); } catch { /* first scan */ }
            fingerprints[relativePath] = crypto.createHash('md5').update(fs.readFileSync(absolutePath)).digest('hex');
            fs.writeFileSync(fpPath, JSON.stringify(fingerprints, null, 2));
        } catch { /* context not set (unit contexts) — verify will report unknown */ }
    }

    // ─── Wipe & preserve (Roadmap 0.2, reviewed) ─────────────────────
    // Deleting a node cascades ALL its synapses regardless of who wrote them.
    // Since scan nodes are recreated under the SAME deterministic ids, we
    // preserve every attached synapse before the wipe and re-add each one
    // whose endpoints exist after the rebuild:
    //   · agent/command/LLM edges (uuid ids) survive re-scans — the origin
    //     contract ("enrichment survives") holds for edges, not just nodes
    //   · incoming scan edges from OTHER files ('sy-' ids) survive per-file
    //     re-scans (they are not rebuilt by a single-file analysis)
    //   · edges to symbols that genuinely disappeared are dropped (endpoints
    //     missing), which is the correct fate for dead map facts
    // idRemap accumulates oldId → deterministic id for every wiped node, so a
    // preserved edge whose endpoint was a LEGACY UUID scan node can be re-keyed
    // to the node's deterministic successor instead of being dropped.
    private idRemap = new Map<string, string>();

    private wipeScanNodesForFile(relativePath: string): any[] {
        const oldNodeIds: string[] = [];
        for (const node of graph.nodes.values()) {
            if (node.file_path === relativePath || node.file_path === '/' + relativePath) {
                const origin = (node.metadata as any)?.origin;
                if (origin === undefined || origin === 'scan') {
                    oldNodeIds.push(node.id);
                    this.idRemap.set(node.id, deterministicNodeId(relativePath, node.type, node.name));
                }
            }
        }
        const preserved: any[] = [];
        const seen = new Set<string>();
        for (const id of oldNodeIds) {
            const conns = graph.getNodeConnections(id);
            for (const syn of [...conns.incoming, ...conns.outgoing]) {
                if (!seen.has(syn.id)) {
                    seen.add(syn.id);
                    preserved.push({ ...syn });
                }
            }
        }
        for (const id of oldNodeIds) {
            graph.deleteNode(id); // cascades synapses (preserved above)
        }
        return preserved;
    }

    private restorePreservedSynapses(preserved: any[]) {
        let restored = 0;
        let dropped = 0;
        let twins = 0;
        for (const syn of preserved) {
            const src = graph.nodes.has(syn.source_node_id)
                ? syn.source_node_id
                : this.idRemap.get(syn.source_node_id);
            const tgt = graph.nodes.has(syn.target_node_id)
                ? syn.target_node_id
                : this.idRemap.get(syn.target_node_id);
            if (src && tgt && graph.nodes.has(src) && graph.nodes.has(tgt)) {
                // Legacy-twin guard (review-caught): pre-deterministic scan
                // edges carry UUID ids and look like enrichment. If the fresh
                // scan already rebuilt the same (source, target, type) under a
                // deterministic id, the preserved UUID copy is a twin — drop it
                // instead of doubling every legacy edge on each re-scan.
                if (!String(syn.id).startsWith('sy-') && graph.synapses.has(deterministicSynapseId(src, tgt, syn.type))) {
                    twins++;
                    continue;
                }
                graph.addSynapse({ ...syn, source_node_id: src, target_node_id: tgt }); // upsert by id
                restored++;
            } else {
                dropped++;
            }
        }
        if (dropped + twins > 0) console.log(`[Analyzer] restore: ${restored} preserved, ${twins} legacy twins skipped, ${dropped} dropped (endpoints gone).`);
    }

    // One-time migration: collapse (source, target, type) duplicate edges that
    // earlier restore passes may have created — keep the deterministic copy.
    private dedupeSynapseTwins() {
        const byKey = new Map<string, string[]>();
        for (const syn of graph.synapses.values()) {
            const key = `${syn.source_node_id}|${syn.type}|${syn.target_node_id}`;
            (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(syn.id);
        }
        let removed = 0;
        for (const ids of byKey.values()) {
            if (ids.length < 2) continue;
            const keep = ids.find(id => id.startsWith('sy-')) || ids[0];
            for (const id of ids) {
                if (id !== keep) {
                    graph.deleteSynapse(id);
                    removed++;
                }
            }
        }
        if (removed > 0) console.log(`[Analyzer] Deduped ${removed} twin synapse(s).`);
    }

    public analyzeIncremental() {
        let integrationDir: string;
        try {
            integrationDir = getIntegrationPath();
        } catch {
            console.log('[Analyzer] No context set, running full analysis.');
            return this.analyze();
        }

        const files = discoverFiles(this.targetPath);
        const oldFingerprints = loadFingerprints(integrationDir);
        const { added, modified, removed } = getChangedFiles(files, oldFingerprints);

        if (added.length === 0 && modified.length === 0 && removed.length === 0) {
            console.log('[Analyzer] No changes detected.');
            return;
        }

        console.log(`[Analyzer] Incremental: +${added.length} added, ~${modified.length} modified, -${removed.length} removed`);

        // Remove nodes for deleted files
        for (const removedPath of removed) {
            const nodeIds: string[] = [];
            for (const node of graph.nodes.values()) {
                if (node.file_path === removedPath) nodeIds.push(node.id);
            }
            for (const id of nodeIds) graph.deleteNode(id);
        }

        // Re-analyze added and modified files
        for (const f of [...added, ...modified]) {
            try {
                this.analyzeFile(f.path);
            } catch (err: any) {
                console.error(`[Analyzer] Error analyzing ${f.path}: ${err.message}`);
            }
        }

        saveFingerprints(integrationDir, files);
        console.log('[Analyzer] Incremental analysis complete.');
    }

    // ─── Private ─────────────────────────────────────────────────────

    private calculateCascadeInfluence() {
        const outTreeSize = new Map<string, number>();

        // 1. Calculate downstream reachability for every node
        for (const [nodeId, node] of graph.nodes.entries()) {
            if (node.status === 'dormant') continue;

            const visited = new Set<string>();
            const queue = [nodeId];
            visited.add(nodeId);

            while (queue.length > 0) {
                const curr = queue.shift()!;
                const adj = graph.adjacency.get(curr);
                if (adj) {
                    for (const outSynId of adj.out) {
                        const syn = graph.synapses.get(outSynId);
                        if (syn && syn.status !== 'dormant' && !visited.has(syn.target_node_id)) {
                            visited.add(syn.target_node_id);
                            queue.push(syn.target_node_id);
                        }
                    }
                }
            }

            outTreeSize.set(nodeId, visited.size - 1);
        }

        // 2. Apply cascade weight to synapses — IDEMPOTENT (review-caught):
        // read the true intrinsic strength from metadata if a previous pass
        // already recorded it; otherwise the preserved-synapse restore would
        // feed each pass's boosted output back in as input and ratchet every
        // edge to the 3.0 cap across re-scans.
        for (const syn of graph.synapses.values()) {
            if (syn.status === 'dormant') continue;

            const downstreamCount = outTreeSize.get(syn.target_node_id) || 0;
            syn.metadata = syn.metadata || {};
            const intrinsic = (typeof syn.metadata.intrinsic_importance === 'number')
                ? syn.metadata.intrinsic_importance
                : (syn.strength || 0.5);

            syn.metadata.intrinsic_importance = intrinsic;
            syn.metadata.cascade_influence = downstreamCount;

            let impactClassification: 'critical' | 'high' | 'moderate' | 'low' = 'low';
            const finalStrength = Math.min(3.0, intrinsic + (downstreamCount * 0.05));

            if (finalStrength > 2.0) impactClassification = 'critical';
            else if (finalStrength > 1.2) impactClassification = 'high';
            else if (finalStrength > 0.7) impactClassification = 'moderate';

            syn.metadata.impact_classification = impactClassification;
            syn.strength = finalStrength;
        }
    }

    private processFile(sf: SourceFile, relativePath: string): FileAnalysisData {
        const content = sf.getFullText();

        // Scanner-origin creation helpers: deterministic ids (stable across
        // re-scans) + provenance stamping (origin: 'scan') on every element.
        const scanNode = (partial: Parameters<typeof createNode>[0] & { cls?: ScoredClassification }) => {
            const { cls, ...rest } = partial;
            return createNode({
                ...rest,
                id: rest.id || deterministicNodeId(relativePath, rest.type, rest.name),
                metadata: {
                    origin: 'scan',
                    ...(cls ? { classification_confidence: Math.round(cls.confidence * 100) / 100 } : {}),
                    ...(rest.metadata || {}),
                },
            });
        };

        // Per-SYMBOL classification (v2): each symbol votes with its OWN text.
        // Whole-file voting cross-contaminated regions (a 'className' inside a
        // backend file's regex made it occipital). The module node still uses
        // the whole file — that is its actual body.
        const lines = content.split('\n');
        const sliceLines = (start: number, end: number) =>
            lines.slice(Math.max(0, start - 1), Math.min(lines.length, end)).join('\n');
        const classify = (nodeType: NodeType, symbolText: string): ScoredClassification =>
            classifyRegionScored(relativePath, nodeType, symbolText);
        const scanSynapse: typeof createSynapse = (partial) => createSynapse({
            ...partial,
            id: partial.id || deterministicSynapseId(partial.source_node_id, partial.target_node_id, partial.type),
        });

        // Create module node
        const moduleCls = classify('module', content);
        const moduleNode = scanNode({
            name: path.basename(relativePath),
            type: 'module',
            region: moduleCls.region,
            cls: moduleCls,
            file_path: relativePath,
            description: `Module ${relativePath}`,
            metadata: {
                language: relativePath.match(/\.tsx?$/) ? 'typescript' : 'javascript',
                imports: sf.getImportDeclarations().map(i => i.getModuleSpecifierValue()),
            },
            tags: ['file'],
        });
        graph.addNode(moduleNode);

        const childNodeIds = new Map<string, string>();

        // Extract React components
        const components = extractReactComponents(sf);
        for (const comp of components) {
            const compCls = classify('component', sliceLines(comp.startLine, comp.endLine));
            const node = scanNode({
                name: comp.name,
                type: 'component',
                region: compCls.region,
                cls: compCls,
                file_path: relativePath,
                line_range: { start: comp.startLine, end: comp.endLine },
                description: `React component ${comp.name}`,
                metadata: { jsx_children: comp.renderedChildren },
                tags: comp.isDefault ? ['default-export', 'component'] : ['component'],
            });
            graph.addNode(node);
            childNodeIds.set(comp.name, node.id);
            graph.addSynapse(scanSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes', description: `${moduleNode.name} contains ${comp.name}` }));
        }

        // Extract hooks
        const hooks = extractHooks(sf);
        const seenHookDefs = new Set<string>();
        for (const hook of hooks) {
            if (hook.type === 'custom' && !seenHookDefs.has(hook.name)) {
                // Check if this file defines the custom hook
                const fnDef = sf.getFunction(hook.name);
                if (fnDef) {
                    seenHookDefs.add(hook.name);
                    const hookCls = classify('hook', fnDef.getText());
                    const node = scanNode({
                        name: hook.name,
                        type: 'hook',
                        region: hookCls.region,
                        cls: hookCls,
                        file_path: relativePath,
                        line_range: { start: fnDef.getStartLineNumber(), end: fnDef.getEndLineNumber() },
                        description: `Custom hook ${hook.name}`,
                        metadata: { hooks_used: hook.dependencies },
                    });
                    graph.addNode(node);
                    childNodeIds.set(hook.name, node.id);
                    graph.addSynapse(scanSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes', description: `${moduleNode.name} defines ${hook.name}` }));
                }
            }
        }

        // Extract route handlers
        const routes = extractRouteHandlers(sf);
        for (const route of routes) {
            const routeCls = classify('endpoint', sliceLines(route.line, route.line + 30));
            const node = scanNode({
                name: `${route.method} ${route.pattern}`,
                type: 'endpoint',
                region: routeCls.region,
                cls: routeCls,
                file_path: relativePath,
                line_range: { start: route.line, end: route.line },
                description: `${route.method} handler for ${route.pattern}`,
                metadata: { http_method: route.method, route_pattern: route.pattern },
                tags: ['route', route.method.toLowerCase()],
            });
            graph.addNode(node);
            childNodeIds.set(route.handlerName, node.id);
            graph.addSynapse(scanSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes', description: `${moduleNode.name} defines ${route.method} ${route.pattern}` }));
        }

        // Extract types and interfaces
        const types = extractTypesAndInterfaces(sf);
        for (const t of types) {
            const typeCls = classify(t.kind, sliceLines(t.startLine, t.endLine));
            const node = scanNode({
                name: t.name,
                type: t.kind,
                region: typeCls.region,
                cls: typeCls,
                file_path: relativePath,
                line_range: { start: t.startLine, end: t.endLine },
                description: `${t.kind} ${t.name}`,
                tags: t.exported ? ['exported', t.kind] : [t.kind],
            });
            graph.addNode(node);
            childNodeIds.set(t.name, node.id);
            graph.addSynapse(scanSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes', description: `${moduleNode.name} defines ${t.name}` }));
        }



        // NOTE (Evidence Protocol): the scanner is RECALL-ONLY for the amygdala.
        // The previous hardcoded a98b3c4f detector fabricated an amygdala node
        // during scan — violating both the incident-only rule and the region
        // policy (nodes may never claim region 'amygdala'), and its strength-3.0
        // warning edge silently inflated blast radii. Removed. Phase 1.6 brings
        // the generalized replacement: code_signatures declared on EXISTING
        // amygdala entries fire amygdala_warning synapses that point at the
        // entry's trigger nodes — the scanner recalls memory, never mints it.
        const cssPos = extractCSSPositioning(sf);
        const domMath = extractDOMMeasurements(sf);
        if (cssPos.length > 0 && domMath.length > 0) {
            console.log(`[Analyzer] Signature note: ${moduleNode.name} mixes getBoundingClientRect() with position:${cssPos[0].property} — candidate for an amygdala code_signature (Phase 1.6).`);
        }

        // Extract env vars
        const envVars = extractEnvVars(sf);
        for (const ev of envVars) {
            if (!childNodeIds.has(`env:${ev.name}`)) {
                const node = scanNode({
                    name: ev.name,
                    type: 'env_var',
                    region: 'brain_stem',
                    file_path: relativePath,
                    line_range: { start: ev.line, end: ev.line },
                    description: `Environment variable ${ev.name}`,
                    tags: ['env'],
                });
                graph.addNode(node);
                childNodeIds.set(`env:${ev.name}`, node.id);
            }
        }

        // Extract remaining functions/classes not already captured
        for (const fn of sf.getFunctions()) {
            const name = fn.getName();
            if (!name || childNodeIds.has(name)) continue;
            const isHook = name.startsWith('use') && /^use[A-Z]/.test(name);
            const nodeType: NodeType = isHook ? 'hook' : 'function';
            const fnCls = classify(nodeType, fn.getText());
            const node = scanNode({
                name,
                type: nodeType,
                region: fnCls.region,
                cls: fnCls,
                file_path: relativePath,
                line_range: { start: fn.getStartLineNumber(), end: fn.getEndLineNumber() },
                description: `${nodeType} ${name} in ${path.basename(relativePath)}`,
            });
            graph.addNode(node);
            childNodeIds.set(name, node.id);
            graph.addSynapse(scanSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes' }));
        }

        for (const cls of sf.getClasses()) {
            const name = cls.getName();
            if (!name || childNodeIds.has(name)) continue;
            const classCls = classify('class', cls.getText());
            const node = scanNode({
                name,
                type: 'class',
                region: classCls.region,
                cls: classCls,
                file_path: relativePath,
                line_range: { start: cls.getStartLineNumber(), end: cls.getEndLineNumber() },
                description: `class ${name} in ${path.basename(relativePath)}`,
            });
            graph.addNode(node);
            childNodeIds.set(name, node.id);
            graph.addSynapse(scanSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes' }));
        }

        // Arrow function variable declarations (configs, arrow functions)
        for (const vd of sf.getVariableDeclarations()) {
            const name = vd.getName();
            if (childNodeIds.has(name)) continue;
            const init = vd.getInitializer();
            if (!init) continue;

            if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
                const isHook = name.startsWith('use') && /^use[A-Z]/.test(name);
                const isComp = /^[A-Z]/.test(name) && containsJSXText(init.getText());
                const nodeType: NodeType = isHook ? 'hook' : isComp ? 'component' : 'function';
                const vdCls = classify(nodeType, vd.getText());
                const node = scanNode({
                    name,
                    type: nodeType,
                    region: vdCls.region,
                    cls: vdCls,
                    file_path: relativePath,
                    line_range: { start: vd.getStartLineNumber(), end: vd.getEndLineNumber() },
                    description: `${nodeType} ${name}`,
                });
                graph.addNode(node);
                childNodeIds.set(name, node.id);
                graph.addSynapse(scanSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes' }));
            } else if (Node.isObjectLiteralExpression(init)) {
                const cfgCls = classify('config', vd.getText());
                const node = scanNode({
                    name,
                    type: 'config',
                    region: cfgCls.region,
                    cls: cfgCls,
                    file_path: relativePath,
                    line_range: { start: vd.getStartLineNumber(), end: vd.getEndLineNumber() },
                    description: `config ${name}`,
                });
                graph.addNode(node);
                childNodeIds.set(name, node.id);
                graph.addSynapse(scanSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes' }));
            }
        }

        // ── Facet extraction (taxonomy v2 §1, engine plan #6) ────────────────
        // Sub-file concerns living INSIDE this file: a component's toast calls
        // are a limbic fact, its fetch calls parietal, its localStorage
        // temporal, its setInterval cerebellum. AST call-expressions ONLY —
        // never raw regex (the /alert/i → 'amygdala_alerts' lesson). Capped at
        // ONE facet per (file × FOREIGN region); the anchor keeps its region
        // and sheds facets, linked via composes so simulation traverses them.
        const FACETS: { concern: string; region: Region; match: (expr: string) => boolean }[] = [
            {
                concern: 'ux-feedback', region: 'limbic_system',
                match: e => /^toast[.(]|^snackbar[.(]|^notify\(|\.showNotification\(|^confetti\(/.test(e),
            },
            {
                concern: 'persistence', region: 'temporal_lobe',
                match: e => /^(localStorage|sessionStorage|indexedDB|AsyncStorage)\./.test(e) ||
                    /^(prisma|redis|db)\.\w+/.test(e) || /^queryClient\./.test(e),
            },
            {
                concern: 'integration', region: 'parietal_lobe',
                match: e => /^fetch\(/.test(e) || /^axios[.(]/.test(e) || /^new WebSocket\(/.test(e),
            },
            {
                concern: 'background', region: 'cerebellum',
                match: e => /^setInterval\(/.test(e) || /^new Worker\(/.test(e) ||
                    /\.schedule\(/.test(e) || /^requestIdleCallback\(/.test(e) || /^queue\.(add|process)\(/.test(e),
            },
        ];
        const facetHits = new Map<string, number[]>(); // concern → lines
        try {
            for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
                const exprText = call.getExpression().getText();
                const full = exprText + '(';
                for (const fdef of FACETS) {
                    if (fdef.match(full)) {
                        const lines = facetHits.get(fdef.concern) || [];
                        if (lines.length < 50) lines.push(call.getStartLineNumber());
                        facetHits.set(fdef.concern, lines);
                    }
                }
            }
            for (const newExpr of sf.getDescendantsOfKind(SyntaxKind.NewExpression)) {
                const t = 'new ' + newExpr.getExpression().getText() + '(';
                for (const fdef of FACETS) {
                    if (fdef.match(t)) {
                        const lines = facetHits.get(fdef.concern) || [];
                        if (lines.length < 50) lines.push(newExpr.getStartLineNumber());
                        facetHits.set(fdef.concern, lines);
                    }
                }
            }
        } catch { /* facet detection must never fail a scan */ }

        for (const fdef of FACETS) {
            const lines = facetHits.get(fdef.concern);
            if (!lines || lines.length === 0) continue;
            if (fdef.region === moduleNode.region) continue; // only FOREIGN-region concerns
            const facetName = `${path.basename(relativePath)}#${fdef.concern}`;
            const facet = scanNode({
                name: facetName,
                type: 'facet',
                region: fdef.region,
                file_path: relativePath,
                line_range: { start: Math.min(...lines), end: Math.max(...lines) },
                description: `${fdef.concern} concern inside ${path.basename(relativePath)} (${lines.length} call site${lines.length > 1 ? 's' : ''})`,
                metadata: { parent_node_id: moduleNode.id, concern: fdef.concern, occurrences: lines.slice(0, 20) } as any,
                tags: ['facet', fdef.concern],
            });
            graph.addNode(facet);
            graph.addSynapse(scanSynapse({
                source_node_id: moduleNode.id,
                target_node_id: facet.id,
                type: 'composes',
                description: `${moduleNode.name} carries a ${fdef.concern} concern`,
            }));
        }

        // Gather parser outputs for relationship building
        const imports = extractImportsDetailed(sf);
        const exports = extractExports(sf);
        const calls = extractCallGraph(sf);
        const jsxComp = extractJSXComposition(sf);

        return {
            filePath: relativePath,
            moduleNodeId: moduleNode.id,
            childNodeIds,
            imports,
            exports,
            calls,
            hooks,
            jsxComposition: jsxComp,
            renderedComponents: components.flatMap(c => c.renderedChildren),
        };
    }

    private updateHealthMetrics() {
        for (const node of graph.nodes.values()) {
            const conns = graph.getNodeConnections(node.id);
            const connectionCount = conns.incoming.length + conns.outgoing.length;
            const crossRegion = [...conns.incoming, ...conns.outgoing].filter(s => s.cross_region).length;

            // Self-heal: a node may have been persisted with null health (legacy/manual inserts)
            if (!node.health) {
                node.health = {
                    stability_score: 1.0,
                    change_frequency: 'low',
                    last_modified: node.updated_at || node.created_at || new Date().toISOString(),
                    amygdala_warnings: 0,
                    test_coverage: 0,
                    connection_count: 0,
                    cross_region_connections: 0,
                };
            }
            if (node.health.connection_count !== connectionCount || node.health.cross_region_connections !== crossRegion) {
                node.health.connection_count = connectionCount;
                node.health.cross_region_connections = crossRegion;
                // Direct update without triggering autoSave for each
                graph.nodes.set(node.id, node);
            }
        }
        // Single batch rebuild
        graph.rebuildSearchIndex();
    }
}

function containsJSXText(text: string): boolean {
    return /<[A-Z]/.test(text) || /return\s*\(?\s*</.test(text) || /=>\s*\(?\s*</.test(text);
}
