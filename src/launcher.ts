import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { spawn, execFileSync } from 'child_process';
import { LAUNCHER_HTML } from './launcherPage';

// ─── The Plexus Launcher — the plug-and-play front door ───────────────────────
// `plexus start` opens ONE window where everything begins:
//   · NEW PROJECT — the 9-question genesis interview as a form; answers become
//     a planned connectome immediately (no CLI, no JSON authoring). The AI
//     refines it later; the human gets a living brain from a form.
//   · CONNECT EXISTING — point at a folder; onboard runs with progress; the
//     report + catch-up questions + the copy-paste MCP command come back.
//   · PROJECT REGISTRY — every brain ever created/connected, with unique
//     auto-assigned ports, one-click engine start, and live status dots.
// Local-only by construction (127.0.0.1 + host guard + local CORS), same
// posture as the engine. This launcher is the seed of the native-app shell.

const LAUNCHER_PORT = parseInt(process.env.PLEXUS_LAUNCHER_PORT || '', 10) || 3199;
const REGISTRY_DIR = path.join(os.homedir(), '.plexus');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'projects.json');
const CLI = path.join(__dirname, 'cli.js');

interface ProjectEntry {
    name: string;
    path: string;
    api_port: number;
    ws_port: number;
    created_at: string;
    kind: 'genesis' | 'connected';
}
interface Registry { projects: ProjectEntry[]; next_port: number }

function loadRegistry(): Registry {
    try {
        const r = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        if (r && Array.isArray(r.projects)) return r;
    } catch { /* first run */ }
    return { projects: [], next_port: 3300 };
}
function saveRegistry(r: Registry) {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(r, null, 2));
}

function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'item';
}

function runCli(args: string[], cwd?: string): string {
    return execFileSync(process.execPath, [CLI, ...args], {
        cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 180000,
    });
}

function probe(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const req = http.get({ host: '127.0.0.1', port, path: '/api/session', timeout: 500 }, res => {
            res.resume();
            resolve(true);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

function patchManifestPorts(projectPath: string, apiPort: number, wsPort: number) {
    const manifestPath = path.join(projectPath, 'plexus-integration', 'plexus-manifest.json');
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    m.server = { ...(m.server || {}), api_port: apiPort, ws_port: wsPort };
    fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
}

// The 9 interview answers → a planned connectome, deterministically. Each
// answer line becomes a concept node in its region (status planned, origin
// seed); GO-WRONG lines become invariants bound to the feature nodes. The AI
// refines all of this later — but the brain is ALIVE from the first click.
const QUESTION_MAP: { key: string; type: string; region: string; label: string }[] = [
    { key: 'decide', type: 'feature', region: 'frontal_lobe', label: 'decision/feature' },
    { key: 'remember', type: 'entity', region: 'temporal_lobe', label: 'persistent data' },
    { key: 'see', type: 'page', region: 'occipital_lobe', label: 'screen/visual' },
    { key: 'sense', type: 'service', region: 'parietal_lobe', label: 'integration' },
    { key: 'unattended', type: 'pipeline', region: 'cerebellum', label: 'background work' },
    { key: 'run_on', type: 'deploy_target', region: 'brain_stem', label: 'infrastructure' },
    { key: 'feel', type: 'journey', region: 'limbic_system', label: 'experience journey' },
    { key: 'bridge', type: 'contract', region: 'corpus_callosum', label: 'shared contract' },
];

function buildSeedFromAnswers(answers: Record<string, string[]>): any {
    const nodes: any[] = [];
    const invariants: any[] = [];
    const featureIds: string[] = [];

    for (const q of QUESTION_MAP) {
        for (const item of answers[q.key] || []) {
            const text = String(item).trim();
            if (!text) continue;
            const id = `seed_${q.key}_${slugify(text)}`;
            if (nodes.some(n => n.id === id)) continue;
            nodes.push({
                id,
                name: text.length > 60 ? text.slice(0, 57) + '…' : text,
                type: q.type,
                region: q.region,
                file_path: `concepts/${q.key}.md`,
                description: `${q.label} (genesis interview): ${text}`,
            });
            if (q.key === 'decide') featureIds.push(id);
        }
    }
    for (const risk of answers['go_wrong'] || []) {
        const text = String(risk).trim();
        if (!text || featureIds.length === 0) continue;
        invariants.push({
            statement: `Guard against: ${text}`,
            node_ids: featureIds,
        });
    }
    return { nodes, synapses: [], invariants };
}

// ─── Server ───────────────────────────────────────────────────────────────────

export function startLauncher(open = true) {
    const app = express();
    app.use(express.json({ limit: '1mb' }));

    // Same local-only posture as the engine
    app.use((req: any, res: any, next: any) => {
        const rawHost = String(req.headers.host || '').toLowerCase();
        const host = rawHost.startsWith('[') ? rawHost.slice(0, rawHost.indexOf(']') + 1) : rawHost.split(':')[0];
        if (host && !['localhost', '127.0.0.1', '[::1]'].includes(host)) {
            return res.status(403).json({ error: 'launcher serves local callers only' });
        }
        const origin = req.headers.origin;
        if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return res.status(403).json({ error: 'cross-origin calls rejected' });
        }
        next();
    });

    app.get('/', (_req, res) => {
        res.set('Content-Type', 'text/html').send(LAUNCHER_HTML);
    });

    // Projects + live status
    app.get('/api/launcher/projects', async (_req, res) => {
        const reg = loadRegistry();
        const out = [];
        for (const p of reg.projects) {
            out.push({
                ...p,
                exists: fs.existsSync(p.path),
                running: await probe(p.api_port),
                mcp_command: `claude mcp add plexus -- node "${CLI}" mcp -p "${p.path}"`,
            });
        }
        res.json({ projects: out, default_base: path.join(os.homedir(), 'Desktop', 'Codes', 'Apps') });
    });

    // Minimal directory browser for "connect existing"
    app.get('/api/launcher/fs', (req, res) => {
        const target = path.resolve(String(req.query.path || os.homedir()));
        try {
            const entries = fs.readdirSync(target, { withFileTypes: true })
                .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
                .map(e => e.name)
                .sort();
            res.json({
                path: target,
                parent: path.dirname(target),
                dirs: entries.slice(0, 200),
                has_git: fs.existsSync(path.join(target, '.git')),
                has_plexus: fs.existsSync(path.join(target, 'plexus-integration')),
            });
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    });

    // NEW PROJECT: folder + git + init + ports + seed-from-answers
    app.post('/api/launcher/create', (req, res) => {
        try {
            const { base_dir, name, answers } = req.body || {};
            if (!name || !/^[a-zA-Z0-9][a-zA-Z0-9-_ ]*$/.test(name)) {
                return res.status(400).json({ error: 'project name must start alphanumeric' });
            }
            const base = path.resolve(base_dir || path.join(os.homedir(), 'Desktop', 'Codes', 'Apps'));
            const projectPath = path.join(base, name.trim().replace(/\s+/g, '-'));
            if (fs.existsSync(projectPath)) {
                return res.status(400).json({ error: `${projectPath} already exists — use Connect Existing instead` });
            }

            fs.mkdirSync(projectPath, { recursive: true });
            try { execFileSync('git', ['init', '-q'], { cwd: projectPath }); } catch { /* git optional */ }
            runCli(['init', '-t', projectPath, '-n', name]);

            const reg = loadRegistry();
            const apiPort = reg.next_port;
            const wsPort = reg.next_port + 1;
            reg.next_port += 10;
            patchManifestPorts(projectPath, apiPort, wsPort);

            let seeded = { nodes: 0, invariants: 0 };
            if (answers && typeof answers === 'object') {
                const seed = buildSeedFromAnswers(answers);
                if (seed.nodes.length > 0) {
                    const seedPath = path.join(projectPath, 'plexus-integration', 'genesis-seed.json');
                    fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));
                    runCli(['seed', '-f', seedPath, '-p', projectPath]);
                    seeded = { nodes: seed.nodes.length, invariants: seed.invariants.length };
                }
            }

            reg.projects.unshift({
                name, path: projectPath, api_port: apiPort, ws_port: wsPort,
                created_at: new Date().toISOString(), kind: 'genesis',
            });
            saveRegistry(reg);

            res.json({
                success: true, path: projectPath, api_port: apiPort, ws_port: wsPort,
                seeded,
                mcp_command: `claude mcp add plexus -- node "${CLI}" mcp -p "${projectPath}"`,
            });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // CONNECT EXISTING: init-if-needed + analyze + mine + report
    app.post('/api/launcher/connect', (req, res) => {
        try {
            const projectPath = path.resolve(String(req.body?.path || ''));
            if (!fs.existsSync(projectPath)) return res.status(400).json({ error: 'folder does not exist' });

            const hadPlexus = fs.existsSync(path.join(projectPath, 'plexus-integration'));
            if (!hadPlexus) runCli(['init', '-t', projectPath, '-n', path.basename(projectPath)]);

            const reg = loadRegistry();
            let entry = reg.projects.find(p => p.path === projectPath);
            if (!entry) {
                entry = {
                    name: path.basename(projectPath), path: projectPath,
                    api_port: reg.next_port, ws_port: reg.next_port + 1,
                    created_at: new Date().toISOString(), kind: 'connected',
                };
                reg.next_port += 10;
                reg.projects.unshift(entry);
                patchManifestPorts(projectPath, entry.api_port, entry.ws_port);
                saveRegistry(reg);
            }

            runCli(['analyze', '-p', projectPath]);
            runCli(['report', '-p', projectPath]);
            try { runCli(['mine', '-p', projectPath]); } catch { /* no git history is fine */ }

            let report: any = null;
            try {
                report = JSON.parse(fs.readFileSync(path.join(projectPath, 'plexus-integration', 'imbalance-report.json'), 'utf8'));
            } catch { /* report optional */ }
            let proposals = 0;
            try {
                proposals = (JSON.parse(fs.readFileSync(path.join(projectPath, 'plexus-integration', 'plexus-proposals.json'), 'utf8')).proposals || []).length;
            } catch { /* not mined */ }

            res.json({
                success: true, path: projectPath, api_port: entry.api_port, ws_port: entry.ws_port,
                first_time: !hadPlexus,
                report: report && {
                    utilization_score: report.utilization_score,
                    maturity: report.maturity,
                    regions: report.regions,
                    enrichment_questions: report.enrichment_questions || [],
                    origin_mix: report.origin_mix,
                },
                mined_proposals: proposals,
                mcp_command: `claude mcp add plexus -- node "${CLI}" mcp -p "${projectPath}"`,
            });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // Engine lifecycle
    app.post('/api/launcher/serve', async (req, res) => {
        const projectPath = path.resolve(String(req.body?.path || ''));
        const reg = loadRegistry();
        const entry = reg.projects.find(p => p.path === projectPath);
        if (!entry) return res.status(404).json({ error: 'project not in registry' });
        if (await probe(entry.api_port)) {
            return res.json({ success: true, already_running: true, ui: `http://localhost:${entry.ws_port}` });
        }
        const child = spawn(process.execPath, [path.join(__dirname, 'index.js'), projectPath], {
            detached: true, stdio: 'ignore',
            env: { ...process.env, PLEXUS_NO_OPEN: '1' },
        });
        child.unref();
        // wait briefly for boot
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 250));
            if (await probe(entry.api_port)) break;
        }
        res.json({ success: true, ui: `http://localhost:${entry.ws_port}`, running: await probe(entry.api_port) });
    });

    app.post('/api/launcher/forget', (req, res) => {
        const projectPath = path.resolve(String(req.body?.path || ''));
        const reg = loadRegistry();
        reg.projects = reg.projects.filter(p => p.path !== projectPath);
        saveRegistry(reg);
        res.json({ success: true, note: 'removed from the launcher registry only — nothing on disk was touched' });
    });

    app.listen(LAUNCHER_PORT, '127.0.0.1', () => {
        console.log(`⬡ Plexus Launcher → http://localhost:${LAUNCHER_PORT}`);
        if (open && !process.env.PLEXUS_NO_OPEN) {
            try { require('open')(`http://localhost:${LAUNCHER_PORT}`); } catch { /* headless */ }
        }
    });
}
