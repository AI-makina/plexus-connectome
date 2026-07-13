import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { spawn, execFileSync } from 'child_process';
import { LAUNCHER_HTML } from './launcherPage';
import { MANAGER_HTML } from './managerPage';

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
const CLI = path.join(__dirname, 'cli.js');

import { loadRegistry, saveRegistry, patchManifestPorts } from './core/registry';

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

// Pull a JSON endpoint from a running connectome engine (null if down/malformed).
function fetchJson(port: number, apiPath: string): Promise<any> {
    return new Promise(resolve => {
        const req = http.get({ host: '127.0.0.1', port, path: apiPath, timeout: 1500 }, res => {
            let body = '';
            res.on('data', c => { body += c; });
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// Cosmetic display name from the manifest (else null — caller falls back to folder name).
function readDisplayName(projectPath: string): string | null {
    try {
        const m = JSON.parse(fs.readFileSync(path.join(projectPath, 'plexus-integration', 'plexus-manifest.json'), 'utf8'));
        return m?.visualization?.display_name || null;
    } catch { return null; }
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
        res.json({
            projects: out,
            default_base: path.join(os.homedir(), 'Desktop', 'Codes', 'Apps'),
            // The AI-first path: register ONCE (user scope, no project path) —
            // the plug resolves the brain from wherever a session is opened,
            // and init_project lets the AI create brains itself.
            global_mcp: `claude mcp add --scope user plexus -- node "${CLI}" mcp`,
        });
    });

    // ─── Plexus Manager (vendor CRM) ────────────────────────────────────────
    app.get('/manager', (_req, res) => {
        res.set('Content-Type', 'text/html').send(MANAGER_HTML);
    });

    // Customers → their connectomes, with live version + effectiveness pulled from
    // each running engine. Local-first (this machine's registry) — the phone-home
    // layer for remote clients is a separate, later phase.
    app.get('/api/launcher/manager', async (_req, res) => {
        const reg = loadRegistry();
        const customers: Record<string, any[]> = {};
        for (const p of reg.projects) {
            const running = await probe(p.api_port);
            let live: any = null;
            if (running) {
                const [ver, eff] = await Promise.all([
                    fetchJson(p.api_port, '/api/engine/version'),
                    fetchJson(p.api_port, '/api/effectiveness'),
                ]);
                live = {
                    version: ver?.version ?? null,
                    update_available: ver?.update_available ?? false,
                    score: eff?.effectiveness_score ?? null,
                    hallucinations_caught: eff?.claim_check?.missing ?? 0,
                    divergences: eff?.divergences ? Object.values(eff.divergences).reduce((a: number, b: any) => a + b, 0) : 0,
                    planned_ratio: eff?.structure_health?.planned_ratio ?? null,
                };
            }
            const owner = (p.owner && p.owner.trim()) || 'Unassigned';
            (customers[owner] = customers[owner] || []).push({
                name: p.name,
                display_name: readDisplayName(p.path) || p.name,
                path: p.path,
                api_port: p.api_port,
                running,
                live,
            });
        }
        res.json({ customers });
    });

    // Assign a connectome to a customer.
    app.post('/api/launcher/owner', (req, res) => {
        const { path: projectPath, owner } = req.body || {};
        const reg = loadRegistry();
        const proj = reg.projects.find(p => p.path === projectPath);
        if (!proj) return res.status(404).json({ error: 'connectome not in registry' });
        proj.owner = (typeof owner === 'string' && owner.trim()) ? owner.trim() : undefined;
        saveRegistry(reg);
        res.json({ ok: true, owner: proj.owner || null });
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

    // NEW PROJECT: folder + git + init + ports + the GENESIS BRIEF.
    // The user describes the app in their own words; the brief lands in the
    // brain and the AI's first session receives it with the interview as ITS
    // checklist. Categorization/placement is AI + librarian work — the human
    // never files anything into lobes.
    app.post('/api/launcher/create', (req, res) => {
        try {
            const { base_dir, name, description, risks } = req.body || {};
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

            const brief = [
                `# Genesis brief — ${name}`,
                `created: ${new Date().toISOString()}`,
                '',
                '## The app, in the founder\'s words',
                String(description || '(no description given — ask the user what they are imagining)').trim(),
                '',
                '## What must never go wrong (founder\'s risks)',
                String(risks || '(none stated yet — worth asking)').trim(),
                '',
                '## Instructions for the AI (first session)',
                'Run the genesis interview conversationally using your internal checklist',
                '(decide / remember / see / sense-speak / unattended / run-on / feel / bridge / go-wrong).',
                'Ask only what the brief leaves unclear. Then seed the connectome yourself via',
                'update_graph (status planned, origin seed) and declare_invariant for the risks.',
                'You may omit region — the librarian places every element. What matters most is',
                'the RELATIONSHIPS: connect the planned pieces with typed synapses.',
            ].join('\n');
            fs.writeFileSync(path.join(projectPath, 'plexus-integration', 'genesis-brief.md'), brief);

            reg.projects.unshift({
                name, path: projectPath, api_port: apiPort, ws_port: wsPort,
                created_at: new Date().toISOString(), kind: 'genesis',
            });
            saveRegistry(reg);

            res.json({
                success: true, path: projectPath, api_port: apiPort, ws_port: wsPort,
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
