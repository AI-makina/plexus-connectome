import { Project, SourceFile, Node } from 'ts-morph';
import { graph } from '../core/graph';
import { createNode, createSynapse } from '../core/factories';
import { PlexusNode, Region, NodeType, AnalysisStatus } from '../types';
import { classifyRegion } from './classifier';
import { discoverFiles, saveFingerprints, loadFingerprints, getChangedFiles } from './discovery';
import {
    extractReactComponents, extractHooks, extractRouteHandlers,
    extractTypesAndInterfaces, extractCallGraph, extractJSXComposition,
    extractEnvVars, extractEventPatterns, extractImportsDetailed, extractExports,
    extractCSSPositioning, extractDOMMeasurements
} from './parsers';
import { buildRelationships, resetRelationshipTracking } from './relationships';
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

        // Phase 2: Parse each file → create nodes
        for (let i = 0; i < sourceFiles.length; i++) {
            const sf = sourceFiles[i];
            const absolutePath = sf.getFilePath();
            const relativePath = path.relative(this.targetPath, absolutePath);

            this.status.current_file = relativePath;
            this.status.files_processed = i + 1;
            this.status.progress = Math.round(((i + 1) / sourceFiles.length) * 80); // 0-80%

            try {
                const data = this.processFile(sf, relativePath);
                analysisMap.set(relativePath, data);
            } catch (err: any) {
                this.status.errors.push(`Error processing ${relativePath}: ${err.message}`);
            }
        }

        // Phase 3: Build cross-file relationships
        this.status.progress = 85;
        console.log('[Analyzer] Building cross-file relationships...');
        resetRelationshipTracking();
        buildRelationships(analysisMap);

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

        // Remove old nodes for this file
        const oldNodeIds: string[] = [];
        for (const node of graph.nodes.values()) {
            if (node.file_path === relativePath || node.file_path === '/' + relativePath) {
                oldNodeIds.push(node.id);
            }
        }
        for (const id of oldNodeIds) {
            graph.deleteNode(id); // cascades synapses
        }

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
        this.calculateCascadeInfluence();
        this.updateHealthMetrics();
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

        // 2. Apply cascade weight to synapses
        for (const syn of graph.synapses.values()) {
            if (syn.status === 'dormant') continue;

            const downstreamCount = outTreeSize.get(syn.target_node_id) || 0;
            const intrinsic = syn.strength || 0.5;

            syn.metadata = syn.metadata || {};
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

        // Create module node
        const moduleRegion = classifyRegion(relativePath, 'module', content);
        const moduleNode = createNode({
            name: path.basename(relativePath),
            type: 'module',
            region: moduleRegion,
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
            const node = createNode({
                name: comp.name,
                type: 'component',
                region: classifyRegion(relativePath, 'component', content),
                file_path: relativePath,
                line_range: { start: comp.startLine, end: comp.endLine },
                description: `React component ${comp.name}`,
                metadata: { jsx_children: comp.renderedChildren },
                tags: comp.isDefault ? ['default-export', 'component'] : ['component'],
            });
            graph.addNode(node);
            childNodeIds.set(comp.name, node.id);
            graph.addSynapse(createSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes', description: `${moduleNode.name} contains ${comp.name}` }));
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
                    const node = createNode({
                        name: hook.name,
                        type: 'hook',
                        region: classifyRegion(relativePath, 'hook', content),
                        file_path: relativePath,
                        line_range: { start: fnDef.getStartLineNumber(), end: fnDef.getEndLineNumber() },
                        description: `Custom hook ${hook.name}`,
                        metadata: { hooks_used: hook.dependencies },
                    });
                    graph.addNode(node);
                    childNodeIds.set(hook.name, node.id);
                    graph.addSynapse(createSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes', description: `${moduleNode.name} defines ${hook.name}` }));
                }
            }
        }

        // Extract route handlers
        const routes = extractRouteHandlers(sf);
        for (const route of routes) {
            const node = createNode({
                name: `${route.method} ${route.pattern}`,
                type: 'endpoint',
                region: classifyRegion(relativePath, 'endpoint', content),
                file_path: relativePath,
                line_range: { start: route.line, end: route.line },
                description: `${route.method} handler for ${route.pattern}`,
                metadata: { http_method: route.method, route_pattern: route.pattern },
                tags: ['route', route.method.toLowerCase()],
            });
            graph.addNode(node);
            childNodeIds.set(route.handlerName, node.id);
            graph.addSynapse(createSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes', description: `${moduleNode.name} defines ${route.method} ${route.pattern}` }));
        }

        // Extract types and interfaces
        const types = extractTypesAndInterfaces(sf);
        for (const t of types) {
            const node = createNode({
                name: t.name,
                type: t.kind,
                region: classifyRegion(relativePath, t.kind, content),
                file_path: relativePath,
                line_range: { start: t.startLine, end: t.endLine },
                description: `${t.kind} ${t.name}`,
                tags: t.exported ? ['exported', t.kind] : [t.kind],
            });
            graph.addNode(node);
            childNodeIds.set(t.name, node.id);
            graph.addSynapse(createSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes', description: `${moduleNode.name} defines ${t.name}` }));
        }



        // --- CSS/JS Rendering Simulator (Active Static Analysis) ---
        // Scan for Viewport vs Absolute Rendering Desync Vulnerabilities
        const cssPos = extractCSSPositioning(sf);
        const domMath = extractDOMMeasurements(sf);

        if (cssPos.length > 0 && domMath.length > 0) {
            // Document contains both absolute/fixed positioning AND viewport math.
            // This is the identical signature to Amygdala bug a98b3c4f.
            const warningNodeId = 'AMYGDALA-a98b3c4f';

            // Check if the warning node exists (it won't on first run, so create a placeholder)
            if (!graph.nodes.has(warningNodeId)) {
                const amygdalaNode = createNode({
                    id: warningNodeId,
                    name: 'Viewport Coordinates vs. Absolute Positioning Rendering Desync',
                    type: 'config',
                    region: 'amygdala',
                    file_path: 'amygdala-log.json',
                    description: 'Amygdala Entry a98b3c4f: The math uses getBoundingClientRect() which is strictly viewport-relative, but it applies to a position: absolute/fixed element.',
                    tags: ['critical', 'amygdala'],
                    metadata: {}
                });
                graph.addNode(amygdalaNode);
            }

            // Create a warning synapse alerting the developer to the risk
            graph.addSynapse(createSynapse({
                source_node_id: moduleNode.id,
                target_node_id: warningNodeId,
                type: 'amygdala_warning',
                description: `CRITICAL RISK: ${moduleNode.name} mixes getBoundingClientRect() and position:${cssPos[0].property}. Prevent rendering desyncs by using position:fixed or injecting window.scrollY.`,
                strength: 3.0 // Max strength for critical warning
            }));

            console.log(`[Plexus Simulator] ⚠️ WARNING INJECTED: Detected CSS/JS Render Desync signature in ${moduleNode.name}`);
        }

        // Extract env vars
        const envVars = extractEnvVars(sf);
        for (const ev of envVars) {
            if (!childNodeIds.has(`env:${ev.name}`)) {
                const node = createNode({
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
            const node = createNode({
                name,
                type: nodeType,
                region: classifyRegion(relativePath, nodeType, content),
                file_path: relativePath,
                line_range: { start: fn.getStartLineNumber(), end: fn.getEndLineNumber() },
                description: `${nodeType} ${name} in ${path.basename(relativePath)}`,
            });
            graph.addNode(node);
            childNodeIds.set(name, node.id);
            graph.addSynapse(createSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes' }));
        }

        for (const cls of sf.getClasses()) {
            const name = cls.getName();
            if (!name || childNodeIds.has(name)) continue;
            const node = createNode({
                name,
                type: 'class',
                region: classifyRegion(relativePath, 'class', content),
                file_path: relativePath,
                line_range: { start: cls.getStartLineNumber(), end: cls.getEndLineNumber() },
                description: `class ${name} in ${path.basename(relativePath)}`,
            });
            graph.addNode(node);
            childNodeIds.set(name, node.id);
            graph.addSynapse(createSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes' }));
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
                const node = createNode({
                    name,
                    type: nodeType,
                    region: classifyRegion(relativePath, nodeType, content),
                    file_path: relativePath,
                    line_range: { start: vd.getStartLineNumber(), end: vd.getEndLineNumber() },
                    description: `${nodeType} ${name}`,
                });
                graph.addNode(node);
                childNodeIds.set(name, node.id);
                graph.addSynapse(createSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes' }));
            } else if (Node.isObjectLiteralExpression(init)) {
                const node = createNode({
                    name,
                    type: 'config',
                    region: classifyRegion(relativePath, 'config', content),
                    file_path: relativePath,
                    line_range: { start: vd.getStartLineNumber(), end: vd.getEndLineNumber() },
                    description: `config ${name}`,
                });
                graph.addNode(node);
                childNodeIds.set(name, node.id);
                graph.addSynapse(createSynapse({ source_node_id: moduleNode.id, target_node_id: node.id, type: 'composes' }));
            }
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
