import { graph } from '../core/graph';
import { createSynapse } from '../core/factories';
import { PlexusNode, SynapseType } from '../types';
import { ExtractedImport, ExtractedExport, ExtractedCallSite, ExtractedHook } from './parsers';

interface FileAnalysis {
    filePath: string;
    moduleNodeId: string;
    childNodeIds: Map<string, string>; // name → node id
    imports: ExtractedImport[];
    exports: ExtractedExport[];
    calls: ExtractedCallSite[];
    hooks: ExtractedHook[];
    jsxComposition: { parent: string; children: string[] }[];
    renderedComponents: string[];
}

// Map from relative file path to analysis data
type AnalysisMap = Map<string, FileAnalysis>;

export function buildRelationships(analysisMap: AnalysisMap) {
    // Build lookup: exported name → { filePath, nodeId }
    const exportIndex = new Map<string, { filePath: string; nodeId: string }>();
    // Build lookup: module specifier resolution
    const filePathToAnalysis = new Map<string, FileAnalysis>();

    for (const [filePath, analysis] of analysisMap) {
        filePathToAnalysis.set(filePath, analysis);

        for (const exp of analysis.exports) {
            const nodeId = analysis.childNodeIds.get(exp.name) || analysis.moduleNodeId;
            exportIndex.set(`${filePath}::${exp.name}`, { filePath, nodeId });
        }
    }

    for (const [filePath, analysis] of analysisMap) {
        // 1. Import → Export mapping
        buildImportSynapses(filePath, analysis, filePathToAnalysis);

        // 2. Function call graph
        buildCallSynapses(filePath, analysis, exportIndex);

        // 3. JSX render tree
        buildJSXSynapses(filePath, analysis);

        // 4. Hook dependencies
        buildHookSynapses(filePath, analysis);
    }
}

function buildImportSynapses(filePath: string, analysis: FileAnalysis, filePathMap: Map<string, FileAnalysis>) {
    for (const imp of analysis.imports) {
        if (!imp.moduleSpecifier.startsWith('.')) continue; // skip node_modules

        // Resolve the import path
        const resolvedPath = resolveImportPath(filePath, imp.moduleSpecifier, filePathMap);
        if (!resolvedPath) continue;

        const targetAnalysis = filePathMap.get(resolvedPath);
        if (!targetAnalysis) continue;

        // For each named import, try to link to specific exported node
        for (const named of imp.namedImports) {
            const targetNodeId = targetAnalysis.childNodeIds.get(named) || targetAnalysis.moduleNodeId;
            addSynapseIfNew(analysis.moduleNodeId, targetNodeId, 'imports', 1.0, `${filePath} imports ${named} from ${resolvedPath}`);
        }

        // Default import
        if (imp.defaultImport) {
            const defaultExport = targetAnalysis.exports.find(e => e.kind === 'default');
            const targetNodeId = defaultExport
                ? (targetAnalysis.childNodeIds.get(defaultExport.name) || targetAnalysis.moduleNodeId)
                : targetAnalysis.moduleNodeId;
            addSynapseIfNew(analysis.moduleNodeId, targetNodeId, 'imports', 1.0, `${filePath} imports default from ${resolvedPath}`);
        }

        // Namespace import — link to module
        if (imp.namespaceImport) {
            addSynapseIfNew(analysis.moduleNodeId, targetAnalysis.moduleNodeId, 'imports', 0.8, `${filePath} imports * from ${resolvedPath}`);
        }
    }
}

function buildCallSynapses(filePath: string, analysis: FileAnalysis, exportIndex: Map<string, { filePath: string; nodeId: string }>) {
    // Match calls to imported names
    const importedNames = new Map<string, string>(); // local name → module specifier
    for (const imp of analysis.imports) {
        for (const named of imp.namedImports) {
            importedNames.set(named, imp.moduleSpecifier);
        }
        if (imp.defaultImport) {
            importedNames.set(imp.defaultImport, imp.moduleSpecifier);
        }
    }

    for (const call of analysis.calls) {
        const baseName = call.calleeName.split('.')[0]; // handle obj.method()
        // Check if it's a local function
        const localNodeId = analysis.childNodeIds.get(baseName);
        if (localNodeId) {
            // Internal call — link from module to the function
            // (we don't track which function calls which within the same file precisely)
            continue;
        }

        // Check if it's an imported function — we already have import synapses
        // Add a 'calls' synapse for stronger signal
        if (importedNames.has(baseName)) {
            // The import synapse already covers this
        }
    }
}

function buildJSXSynapses(filePath: string, analysis: FileAnalysis) {
    for (const comp of analysis.jsxComposition) {
        const parentNodeId = analysis.childNodeIds.get(comp.parent);
        if (!parentNodeId) continue;

        for (const childName of comp.children) {
            // Look for child component in same file first
            const childNodeId = analysis.childNodeIds.get(childName);
            if (childNodeId) {
                addSynapseIfNew(parentNodeId, childNodeId, 'renders', 0.9, `${comp.parent} renders ${childName}`);
                continue;
            }

            // Look for child as imported component — find it across all nodes
            for (const node of graph.nodes.values()) {
                if (node.name === childName && node.type === 'component') {
                    addSynapseIfNew(parentNodeId, node.id, 'renders', 0.8, `${comp.parent} renders ${childName}`);
                    break;
                }
            }
        }
    }
}

function buildHookSynapses(filePath: string, analysis: FileAnalysis) {
    for (const hook of analysis.hooks) {
        if (hook.type === 'custom') {
            // Find the custom hook definition
            for (const node of graph.nodes.values()) {
                if (node.name === hook.name && node.type === 'hook') {
                    addSynapseIfNew(analysis.moduleNodeId, node.id, 'calls', 0.9, `uses ${hook.name}`);
                    break;
                }
            }
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

const addedSynapses = new Set<string>();

function addSynapseIfNew(sourceId: string, targetId: string, type: SynapseType, strength: number, description: string) {
    if (sourceId === targetId) return;
    const key = `${sourceId}->${targetId}:${type}`;
    if (addedSynapses.has(key)) return;
    addedSynapses.add(key);

    graph.addSynapse(createSynapse({
        source_node_id: sourceId,
        target_node_id: targetId,
        type,
        strength,
        description,
    }));
}

export function resetRelationshipTracking() {
    addedSynapses.clear();
}

function resolveImportPath(fromFile: string, specifier: string, filePathMap: Map<string, FileAnalysis>): string | null {
    // Simple resolution: try exact match and common extensions
    const dir = fromFile.replace(/\/[^/]+$/, '');
    const basePath = specifier.startsWith('.')
        ? normalizePath(`${dir}/${specifier}`)
        : specifier;

    const candidates = [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.js`,
        `${basePath}.jsx`,
        `${basePath}/index.ts`,
        `${basePath}/index.tsx`,
        `${basePath}/index.js`,
        `${basePath}/index.jsx`,
    ];

    for (const candidate of candidates) {
        if (filePathMap.has(candidate)) return candidate;
    }

    return null;
}

function normalizePath(p: string): string {
    const parts = p.split('/');
    const result: string[] = [];
    for (const part of parts) {
        if (part === '..') result.pop();
        else if (part !== '.') result.push(part);
    }
    return result.join('/');
}
