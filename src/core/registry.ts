import fs from 'fs';
import os from 'os';
import path from 'path';

// ─── The project registry (~/.plexus/projects.json) ──────────────────────────
// Shared by the launcher AND the MCP plug: whichever surface a brain is born
// through, it appears in the dashboard and gets collision-free ports.

export interface ProjectEntry {
    name: string;
    path: string;
    api_port: number;
    ws_port: number;
    created_at: string;
    kind: 'genesis' | 'connected';
    owner?: string; // customer this connectome belongs to (Plexus Manager / CRM)
    preferred_editor?: string; // last editor chosen in "Open project" (one-click next time)
    preferred_ai?: string;     // last AI chosen to auto-engage ('none' = plain editor open)
}
export interface Registry { projects: ProjectEntry[]; next_port: number }

const REGISTRY_DIR = path.join(os.homedir(), '.plexus');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'projects.json');

export function loadRegistry(): Registry {
    try {
        const r = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        if (r && Array.isArray(r.projects)) return r;
    } catch { /* first run */ }
    return { projects: [], next_port: 3300 };
}

export function saveRegistry(r: Registry) {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(r, null, 2));
}

/** Timestamp-free single backup before registry mutations that aren't plain appends. */
export function backupRegistry(): void {
    try { if (fs.existsSync(REGISTRY_FILE)) fs.copyFileSync(REGISTRY_FILE, REGISTRY_FILE + '.bak'); } catch { /* best-effort */ }
}

// ── Broad-base guards (init_project) ──────────────────────────────────────────
// Classic broad dirs are NEVER a legitimate project root — auto-relocate.
// Registry-derived bases (the user's chosen projects folder, parents of known
// projects) MIGHT be a legit monorepo root — those get an explicit choice
// instead of silent relocation.
export function classicBroadDirs(): string[] {
    const HOME = os.homedir();
    return [HOME, path.join(HOME, 'Desktop'), path.join(HOME, 'Documents'), path.join(HOME, 'Downloads'), path.join(HOME, 'PlexusProjects')];
}
export function registryBases(): string[] {
    const bases = new Set<string>();
    try {
        const prefs = JSON.parse(fs.readFileSync(path.join(REGISTRY_DIR, 'prefs.json'), 'utf8'));
        if (prefs?.lastBase) bases.add(path.resolve(prefs.lastBase));
    } catch { /* no prefs yet */ }
    for (const p of loadRegistry().projects) bases.add(path.dirname(path.resolve(p.path)));
    for (const d of classicBroadDirs()) bases.delete(d);
    return [...bases];
}

/** Register a project (idempotent by path) and assign it unique ports. */
export function registerProject(projectPath: string, name: string, kind: 'genesis' | 'connected'): ProjectEntry {
    // Protection invariant: Plexus never registers its own install location (or
    // anything inside it) as a project. A registered project gets AI plugs wired
    // into its folder — our own product must never invite an AI into its code.
    const appRoot = path.resolve(__dirname, '..', '..');
    const target = path.resolve(projectPath);
    if (target === appRoot || target.startsWith(appRoot + path.sep) || appRoot.startsWith(target + path.sep)) {
        throw new Error('This folder is part of the Plexus app itself — it can\'t be a Plexus project. Pick a folder outside the app.');
    }
    const reg = loadRegistry();
    const existing = reg.projects.find(p => p.path === projectPath);
    if (existing) return existing;
    const entry: ProjectEntry = {
        name, path: projectPath,
        api_port: reg.next_port, ws_port: reg.next_port + 1,
        created_at: new Date().toISOString(), kind,
    };
    reg.next_port += 10;
    reg.projects.unshift(entry);
    saveRegistry(reg);
    return entry;
}

export function patchManifestPorts(projectPath: string, apiPort: number, wsPort: number) {
    const manifestPath = path.join(projectPath, 'plexus-integration', 'plexus-manifest.json');
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    m.server = { ...(m.server || {}), api_port: apiPort, ws_port: wsPort };
    fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
}

/** Walk up from cwd to the nearest folder that has a Plexus brain. */
// A nested git repo is definitively its OWN project — resolution must never escape ACROSS
// one into an ancestor's brain (that escape is what makes a freshly `git init`-ed child
// silently attach to a parent connectome).
export function isProjectBoundary(dir: string): boolean {
    return fs.existsSync(path.join(dir, '.git'));
}

// A monorepo/workspace ROOT even without git (zip downloads, not-yet-inited repos). These
// markers only ever sit at the workspace root, never in a package, so treating them as a
// project root cannot re-fragment a monorepo into per-package brains.
export function isWorkspaceRoot(dir: string): boolean {
    for (const f of ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json', 'rush.json', 'go.work']) {
        if (fs.existsSync(path.join(dir, f))) return true;
    }
    try { // npm / yarn workspaces — a "workspaces" field lives only at the root package.json
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        if (pkg && pkg.workspaces) return true;
    } catch { /* no / invalid package.json */ }
    try { // Rust workspaces — a [workspace] table in the root Cargo.toml
        if (/^\s*\[workspace\]/m.test(fs.readFileSync(path.join(dir, 'Cargo.toml'), 'utf8'))) return true;
    } catch { /* no Cargo.toml */ }
    return false;
}

// The boundary of a distinct project: a git repo root OR a workspace root. Resolution stops
// here and a new brain roots here.
export function isProjectRoot(dir: string): boolean {
    return isProjectBoundary(dir) || isWorkspaceRoot(dir);
}

// Nearest ancestor (incl. startDir) that holds a brain — but STOPS at a project root. If the
// enclosing project has no brain of its own, a brain that lives above it belongs to a
// DIFFERENT project and must not be resolved into. Returns null when there is no brain within
// the current project. (Nearest brain still wins for legit subfolders, because the brain
// check runs before the boundary check at each level.)
export function findProjectRoot(startDir: string): string | null {
    let dir = path.resolve(startDir);
    for (let i = 0; i < 12; i++) {
        if (fs.existsSync(path.join(dir, 'plexus-integration'))) return dir; // nearest brain wins
        if (isProjectRoot(dir)) return null; // don't cross a project boundary into a parent's brain
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

// Where a NEW brain should be rooted for a session started in startDir: the enclosing project
// root (git repo root or monorepo/workspace root) if there is one, else startDir itself. This
// is what keeps every package of a monorepo — even a gitless one — on ONE shared brain at the
// root, instead of fragmenting a brain into whatever subfolder the AI launched from.
export function projectBoundary(startDir: string): string {
    let dir = path.resolve(startDir);
    for (let i = 0; i < 12; i++) {
        if (isProjectRoot(dir)) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return path.resolve(startDir);
}
