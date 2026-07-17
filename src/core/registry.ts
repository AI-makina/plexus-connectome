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

/** Register a project (idempotent by path) and assign it unique ports. */
export function registerProject(projectPath: string, name: string, kind: 'genesis' | 'connected'): ProjectEntry {
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
// A directory that delimits a distinct project. A nested git repo is definitively its OWN
// project, so brain resolution must never escape ACROSS one into an ancestor — that escape
// is exactly what makes a freshly `git init`-ed child silently attach to a parent connectome.
export function isProjectBoundary(dir: string): boolean {
    return fs.existsSync(path.join(dir, '.git'));
}

// Nearest ancestor (incl. startDir) that holds a brain — but STOPS at a project boundary.
// If the enclosing git repo has no brain of its own, a brain that lives above the repo
// belongs to a DIFFERENT project and must not be resolved into. Returns null when there is
// no brain within the current project. (Nearest brain still wins for legit subfolders,
// because the brain check runs before the boundary check at each level.)
export function findProjectRoot(startDir: string): string | null {
    let dir = path.resolve(startDir);
    for (let i = 0; i < 12; i++) {
        if (fs.existsSync(path.join(dir, 'plexus-integration'))) return dir; // nearest brain wins
        if (isProjectBoundary(dir)) return null; // don't cross a repo boundary into a parent's brain
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

// Where a NEW brain should be rooted for a session started in startDir: the enclosing
// project boundary (git repo root) if there is one, else startDir itself. Keeps a new brain
// at the project root instead of whatever deep subfolder the AI happened to launch from.
export function projectBoundary(startDir: string): string {
    let dir = path.resolve(startDir);
    for (let i = 0; i < 12; i++) {
        if (isProjectBoundary(dir)) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return path.resolve(startDir);
}
