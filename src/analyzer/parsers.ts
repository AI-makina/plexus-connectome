import { SourceFile, SyntaxKind, Node } from 'ts-morph';

// ─── Extracted data structures ───────────────────────────────────

export interface ExtractedComponent {
    name: string;
    startLine: number;
    endLine: number;
    props: string[];
    renderedChildren: string[]; // component names rendered in JSX
    isDefault: boolean;
}

export interface ExtractedHook {
    name: string;
    type: 'useState' | 'useEffect' | 'useCallback' | 'useMemo' | 'useRef' | 'useContext' | 'custom';
    line: number;
    dependencies: string[];
}

export interface ExtractedRouteHandler {
    method: string; // GET, POST, PUT, DELETE, PATCH
    pattern: string;
    line: number;
    handlerName: string;
}

export interface ExtractedTypeOrInterface {
    name: string;
    kind: 'interface' | 'type';
    startLine: number;
    endLine: number;
    exported: boolean;
}

export interface ExtractedCallSite {
    calleeName: string;
    line: number;
    isAsync: boolean;
}

export interface ExtractedImport {
    moduleSpecifier: string;
    namedImports: string[];
    defaultImport: string | null;
    namespaceImport: string | null;
    line: number;
}

export interface ExtractedExport {
    name: string;
    kind: 'named' | 'default' | 're-export';
    line: number;
}

export interface ExtractedEnvVar {
    name: string;
    line: number;
}

export interface ExtractedEventPattern {
    type: 'on' | 'emit' | 'addEventListener' | 'removeEventListener';
    eventName: string;
    line: number;
}

// ─── React Components ────────────────────────────────────────────

export function extractReactComponents(sf: SourceFile): ExtractedComponent[] {
    const components: ExtractedComponent[] = [];

    // Check function declarations returning JSX
    for (const fn of sf.getFunctions()) {
        const name = fn.getName();
        if (!name || !isComponentName(name)) continue;
        const body = fn.getBody()?.getText() || '';
        if (containsJSX(body)) {
            components.push({
                name,
                startLine: fn.getStartLineNumber(),
                endLine: fn.getEndLineNumber(),
                props: extractParams(fn),
                renderedChildren: extractJSXChildComponents(body),
                isDefault: fn.isDefaultExport(),
            });
        }
    }

    // Check variable declarations (arrow functions returning JSX)
    for (const vd of sf.getVariableDeclarations()) {
        const name = vd.getName();
        if (!isComponentName(name)) continue;
        const init = vd.getInitializer();
        if (!init) continue;
        if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
            const body = init.getText();
            if (containsJSX(body)) {
                components.push({
                    name,
                    startLine: vd.getStartLineNumber(),
                    endLine: vd.getEndLineNumber(),
                    props: extractArrowParams(init),
                    renderedChildren: extractJSXChildComponents(body),
                    isDefault: false,
                });
            }
        }
    }

    return components;
}

function isComponentName(name: string): boolean {
    return /^[A-Z]/.test(name);
}

function containsJSX(text: string): boolean {
    return /<[A-Z]/.test(text) || /return\s*\(?\s*</.test(text) || /=>\s*\(?\s*</.test(text);
}

function extractJSXChildComponents(body: string): string[] {
    const matches = body.match(/<([A-Z][a-zA-Z0-9.]*)/g);
    if (!matches) return [];
    const names = new Set(matches.map(m => m.slice(1)));
    return [...names];
}

function extractParams(fn: any): string[] {
    try {
        return fn.getParameters().map((p: any) => p.getName());
    } catch {
        return [];
    }
}

function extractArrowParams(node: any): string[] {
    try {
        return node.getParameters().map((p: any) => p.getName());
    } catch {
        return [];
    }
}

// ─── Hooks ───────────────────────────────────────────────────────

const KNOWN_HOOKS = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext'];

export function extractHooks(sf: SourceFile): ExtractedHook[] {
    const hooks: ExtractedHook[] = [];
    const text = sf.getFullText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match use* calls
        const hookMatch = line.match(/(use[A-Z]\w*)\s*\(/);
        if (!hookMatch) continue;

        const hookName = hookMatch[1];
        const isKnown = KNOWN_HOOKS.includes(hookName);
        const type = isKnown ? hookName as ExtractedHook['type'] : 'custom';

        // Try to extract dependency array for useEffect/useCallback/useMemo
        const deps: string[] = [];
        if (['useEffect', 'useCallback', 'useMemo'].includes(hookName)) {
            // Look for dependency array in surrounding lines
            const chunk = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
            const depMatch = chunk.match(/\],\s*\[([^\]]*)\]/);
            if (depMatch) {
                deps.push(...depMatch[1].split(',').map(d => d.trim()).filter(Boolean));
            }
        }

        hooks.push({ name: hookName, type, line: i + 1, dependencies: deps });
    }

    return hooks;
}

// ─── Route Handlers ──────────────────────────────────────────────

export function extractRouteHandlers(sf: SourceFile): ExtractedRouteHandler[] {
    const handlers: ExtractedRouteHandler[] = [];
    const filePath = sf.getFilePath();

    // Next.js App Router: export async function GET/POST/PUT/DELETE/PATCH
    const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    for (const fn of sf.getFunctions()) {
        const name = fn.getName();
        if (name && httpMethods.includes(name) && fn.isExported()) {
            const routePattern = extractRoutePatternFromPath(filePath);
            handlers.push({
                method: name,
                pattern: routePattern,
                line: fn.getStartLineNumber(),
                handlerName: name,
            });
        }
    }

    // Also check exported variable declarations (export const GET = ...)
    for (const vd of sf.getVariableDeclarations()) {
        const name = vd.getName();
        if (httpMethods.includes(name)) {
            const stmt = vd.getVariableStatement();
            if (stmt && stmt.isExported()) {
                const routePattern = extractRoutePatternFromPath(filePath);
                handlers.push({
                    method: name,
                    pattern: routePattern,
                    line: vd.getStartLineNumber(),
                    handlerName: name,
                });
            }
        }
    }

    // Express-style: app.get('/path', handler) or router.post(...)
    const text = sf.getFullText();
    const expressRegex = /(?:app|router)\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = expressRegex.exec(text)) !== null) {
        const lineNum = text.substring(0, match.index).split('\n').length;
        handlers.push({
            method: match[1].toUpperCase(),
            pattern: match[2],
            line: lineNum,
            handlerName: `${match[1]}:${match[2]}`,
        });
    }

    return handlers;
}

function extractRoutePatternFromPath(filePath: string): string {
    // Convert Next.js file path to route pattern
    // e.g., /src/app/api/users/[id]/route.ts -> /api/users/[id]
    const match = filePath.match(/\/app\/(.*?)\/route\.[tj]sx?$/);
    if (match) return '/' + match[1].replace(/\\/g, '/');
    const pageMatch = filePath.match(/\/app\/(.*?)\/page\.[tj]sx?$/);
    if (pageMatch) return '/' + pageMatch[1].replace(/\\/g, '/');
    return filePath;
}

// ─── Types and Interfaces ────────────────────────────────────────

export function extractTypesAndInterfaces(sf: SourceFile): ExtractedTypeOrInterface[] {
    const results: ExtractedTypeOrInterface[] = [];

    for (const iface of sf.getInterfaces()) {
        results.push({
            name: iface.getName(),
            kind: 'interface',
            startLine: iface.getStartLineNumber(),
            endLine: iface.getEndLineNumber(),
            exported: iface.isExported(),
        });
    }

    for (const ta of sf.getTypeAliases()) {
        results.push({
            name: ta.getName(),
            kind: 'type',
            startLine: ta.getStartLineNumber(),
            endLine: ta.getEndLineNumber(),
            exported: ta.isExported(),
        });
    }

    return results;
}

// ─── Call Graph ──────────────────────────────────────────────────

export function extractCallGraph(sf: SourceFile): ExtractedCallSite[] {
    const calls: ExtractedCallSite[] = [];
    const seen = new Set<string>();

    sf.forEachDescendant(node => {
        if (node.getKind() === SyntaxKind.CallExpression) {
            const callExpr = node.asKind(SyntaxKind.CallExpression);
            if (!callExpr) return;

            const expr = callExpr.getExpression();
            const calleeName = expr.getText();
            const line = callExpr.getStartLineNumber();
            const key = `${calleeName}:${line}`;
            if (seen.has(key)) return;
            seen.add(key);

            // Check if parent is await
            const parent = callExpr.getParent();
            const isAsync = parent?.getKind() === SyntaxKind.AwaitExpression;

            calls.push({ calleeName, line, isAsync });
        }
    });

    return calls;
}

// ─── JSX Composition ─────────────────────────────────────────────

export function extractJSXComposition(sf: SourceFile): { parent: string; children: string[] }[] {
    const components = extractReactComponents(sf);
    return components.map(c => ({
        parent: c.name,
        children: c.renderedChildren,
    }));
}

// ─── Environment Variables ───────────────────────────────────────

export function extractEnvVars(sf: SourceFile): ExtractedEnvVar[] {
    const vars: ExtractedEnvVar[] = [];
    const text = sf.getFullText();
    const regex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const line = text.substring(0, match.index).split('\n').length;
        vars.push({ name: match[1], line });
    }
    return vars;
}

// ─── Event Patterns ──────────────────────────────────────────────

export function extractEventPatterns(sf: SourceFile): ExtractedEventPattern[] {
    const events: ExtractedEventPattern[] = [];
    const text = sf.getFullText();

    const patterns: { regex: RegExp; type: ExtractedEventPattern['type'] }[] = [
        { regex: /\.on\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'on' },
        { regex: /\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'emit' },
        { regex: /addEventListener\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'addEventListener' },
        { regex: /removeEventListener\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'removeEventListener' },
    ];

    for (const { regex, type } of patterns) {
        let match;
        while ((match = regex.exec(text)) !== null) {
            const line = text.substring(0, match.index).split('\n').length;
            events.push({ type, eventName: match[1], line });
        }
    }

    return events;
}

// ─── Detailed Imports ────────────────────────────────────────────

export function extractImportsDetailed(sf: SourceFile): ExtractedImport[] {
    return sf.getImportDeclarations().map(imp => {
        const namedImports = imp.getNamedImports().map(n => n.getName());
        const defaultImport = imp.getDefaultImport()?.getText() || null;
        const namespaceImport = imp.getNamespaceImport()?.getText() || null;

        return {
            moduleSpecifier: imp.getModuleSpecifierValue(),
            namedImports,
            defaultImport,
            namespaceImport,
            line: imp.getStartLineNumber(),
        };
    });
}

// ─── Exports ─────────────────────────────────────────────────────

export function extractExports(sf: SourceFile): ExtractedExport[] {
    const exports: ExtractedExport[] = [];

    // Named exports from export declarations
    for (const ed of sf.getExportDeclarations()) {
        for (const ns of ed.getNamedExports()) {
            exports.push({ name: ns.getName(), kind: 're-export', line: ed.getStartLineNumber() });
        }
    }

    // Functions
    for (const fn of sf.getFunctions()) {
        if (fn.isExported()) {
            const name = fn.getName() || 'default';
            exports.push({ name, kind: fn.isDefaultExport() ? 'default' : 'named', line: fn.getStartLineNumber() });
        }
    }

    // Classes
    for (const cls of sf.getClasses()) {
        if (cls.isExported()) {
            const name = cls.getName() || 'default';
            exports.push({ name, kind: cls.isDefaultExport() ? 'default' : 'named', line: cls.getStartLineNumber() });
        }
    }

    // Variable statements
    for (const vs of sf.getVariableStatements()) {
        if (vs.isExported()) {
            for (const decl of vs.getDeclarations()) {
                exports.push({ name: decl.getName(), kind: 'named', line: vs.getStartLineNumber() });
            }
        }
    }

    // Interfaces & type aliases
    for (const iface of sf.getInterfaces()) {
        if (iface.isExported()) {
            exports.push({ name: iface.getName(), kind: 'named', line: iface.getStartLineNumber() });
        }
    }

    for (const ta of sf.getTypeAliases()) {
        if (ta.isExported()) {
            exports.push({ name: ta.getName(), kind: 'named', line: ta.getStartLineNumber() });
        }
    }

    // Default export assignment
    const defaultExport = sf.getDefaultExportSymbol();
    if (defaultExport && !exports.some(e => e.kind === 'default')) {
        exports.push({ name: defaultExport.getName(), kind: 'default', line: 1 });
    }

    return exports;
}

// ─── CSS & DOM Render Vulnerabilities ──────────────────────────────

export interface ExtractedCSSPosition {
    line: number;
    property: 'absolute' | 'fixed';
}

export interface ExtractedDOMMath {
    line: number;
    method: 'getBoundingClientRect';
}

export function extractCSSPositioning(sf: SourceFile): ExtractedCSSPosition[] {
    const findings: ExtractedCSSPosition[] = [];
    const text = sf.getFullText();
    const regex = /position\s*:\s*(absolute|fixed)/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        const line = text.substring(0, match.index).split('\n').length;
        findings.push({ line, property: match[1] as 'absolute' | 'fixed' });
    }
    return findings;
}

export function extractDOMMeasurements(sf: SourceFile): ExtractedDOMMath[] {
    const findings: ExtractedDOMMath[] = [];
    const text = sf.getFullText();
    const regex = /\.getBoundingClientRect\s*\(/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        const line = text.substring(0, match.index).split('\n').length;
        findings.push({ line, method: 'getBoundingClientRect' });
    }
    return findings;
}
