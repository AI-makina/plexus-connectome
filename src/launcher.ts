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

// POST to a connectome engine with its own session token (read from the brain folder),
// so the manager can trigger token-guarded actions like self-update.
function postEngine(projectPath: string, port: number, apiPath: string): Promise<boolean> {
    let token = '';
    try { token = fs.readFileSync(path.join(projectPath, 'plexus-integration', 'session-token'), 'utf8').trim(); } catch { /* auth-disabled or no token */ }
    return new Promise(resolve => {
        const body = '{}';
        const req = http.request({
            host: '127.0.0.1', port, path: apiPath, method: 'POST', timeout: 4000,
            headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), 'x-plexus-token': token },
        }, res => { res.resume(); resolve(!!res.statusCode && res.statusCode < 400); });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.write(body); req.end();
    });
}

// Cosmetic display name from the manifest (else null — caller falls back to folder name).
function readDisplayName(projectPath: string): string | null {
    try {
        const m = JSON.parse(fs.readFileSync(path.join(projectPath, 'plexus-integration', 'plexus-manifest.json'), 'utf8'));
        return m?.visualization?.display_name || null;
    } catch { return null; }
}

// The vendor's current build/version (what "Send update" queues) — read from dist.
function vendorBuild(): { build: number; version: string } {
    let build = 0, version = '?';
    try { build = parseInt(fs.readFileSync(path.join(__dirname, 'BUILD_ID'), 'utf8').trim(), 10) || 0; } catch { /* no stamp */ }
    try { version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version || '?'; } catch { /* */ }
    return { build, version };
}

// The pending-update marker a connectome carries (read from its folder; works stopped too).
function readConnectomePending(projectPath: string): any | null {
    try { return JSON.parse(fs.readFileSync(path.join(projectPath, 'plexus-integration', 'pending-update.json'), 'utf8')); } catch { return null; }
}

// ── User prefs (~/.plexus/prefs.json): first-run onboarding state, last-used dir ──
const PREFS_FILE = path.join(os.homedir(), '.plexus', 'prefs.json');
function loadPrefs(): any { try { return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8')); } catch { return {}; } }
function savePrefs(p: any): void {
    try { fs.mkdirSync(path.dirname(PREFS_FILE), { recursive: true }); fs.writeFileSync(PREFS_FILE, JSON.stringify(p, null, 2)); } catch { /* best-effort */ }
}

// Is a command on PATH? (detect installed AI clients / editors)
function onPath(cmd: string): boolean {
    try { return !!execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' }).split('\n')[0].trim(); }
    catch { return false; }
}

// AI clients Plexus can help connect / open a project in. openBin = its CLI to open a
// folder (null = terminal tool, no folder CLI). Only Claude Code is introspectable for
// whether Plexus is already registered.
const AI_CLIENTS = [
    { id: 'claude', label: 'Claude Code', bin: 'claude', openBin: null as string | null },
    { id: 'code', label: 'VS Code', bin: 'code', openBin: 'code' as string | null },
    { id: 'cursor', label: 'Cursor', bin: 'cursor', openBin: 'cursor' as string | null },
];

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

    // Brand assets (app icon, wordmark, presentation video, SkyFynd mark) for the
    // onboarding wizard + footer. Lives at repo-root assets/ (dist is one level down).
    app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

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
            default_base: loadPrefs().lastBase || path.join(os.homedir(), 'PlexusProjects'),
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
        // Fleet-wide accumulators — the vendor rollup across every connectome that's up.
        const agg = {
            connectomes: 0, running: 0, scoreSum: 0, scoreN: 0,
            checks: 0, hallucinations_caught: 0, coverage_gaps: 0, divergences: 0,
            by_category: {} as Record<string, number>,
            by_model: {} as Record<string, { events: number; claim_missing: number; claim_out_of_scope: number }>,
            feedback_total: 0, by_theme: {} as Record<string, number>,
            recent_feedback: [] as any[],
        };
        for (const p of reg.projects) {
            agg.connectomes++;
            const running = await probe(p.api_port);
            let live: any = null;
            if (running) {
                agg.running++;
                // Pull BOTH tracks: the quantitative dye (effectiveness) AND the qualitative
                // questionnaire (feedback). This is the client→vendor half of the loop.
                const [ver, eff, fb] = await Promise.all([
                    fetchJson(p.api_port, '/api/engine/version'),
                    fetchJson(p.api_port, '/api/effectiveness'),
                    fetchJson(p.api_port, '/api/feedback'),
                ]);
                const cc = eff?.claim_check || {};
                const divTotal = eff?.divergences ? Object.values(eff.divergences).reduce((a: number, b: any) => a + b, 0) : 0;
                live = {
                    version: ver?.version ?? null,
                    update_available: ver?.update_available ?? false,
                    score: eff?.effectiveness_score ?? null,
                    hallucinations_caught: cc.missing ?? 0,
                    coverage_gaps: cc.out_of_scope ?? 0,
                    checks: cc.checked ?? 0,
                    hallucination_rate: cc.hallucination_rate ?? 0,
                    coverage_gap_rate: cc.coverage_gap_rate ?? 0,
                    divergences: divTotal,
                    planned_ratio: eff?.structure_health?.planned_ratio ?? null,
                    orphan_ratio: eff?.structure_health?.orphan_ratio ?? null,
                    deductions: eff?.deductions ?? null,       // what's pulling the score down
                    by_category: eff?.by_category ?? null,     // ai / harness / structure / value
                    by_model: eff?.by_model ?? null,           // per-model hallucination trend
                    recent_days: eff?.recent_days ?? null,     // 14-day activity
                    feedback: fb ? { total: fb.total ?? 0, by_theme: fb.by_theme ?? {}, recent: (fb.recent || []).slice(0, 5) } : null,
                };
                // Fold this connectome into the fleet aggregate.
                if (typeof live.score === 'number') { agg.scoreSum += live.score; agg.scoreN++; }
                agg.checks += live.checks || 0;
                agg.hallucinations_caught += live.hallucinations_caught || 0;
                agg.coverage_gaps += live.coverage_gaps || 0;
                agg.divergences += live.divergences || 0;
                for (const k of Object.keys(eff?.by_category || {})) agg.by_category[k] = (agg.by_category[k] || 0) + (eff.by_category[k] || 0);
                for (const m of Object.keys(eff?.by_model || {})) {
                    const src = eff.by_model[m] || {};
                    const a = agg.by_model[m] = agg.by_model[m] || { events: 0, claim_missing: 0, claim_out_of_scope: 0 };
                    a.events += src.events || 0; a.claim_missing += src.claim_missing || 0; a.claim_out_of_scope += src.claim_out_of_scope || 0;
                }
                if (fb) {
                    agg.feedback_total += fb.total || 0;
                    for (const t of Object.keys(fb.by_theme || {})) agg.by_theme[t] = (agg.by_theme[t] || 0) + (fb.by_theme[t] || 0);
                    for (const r of (fb.recent || [])) agg.recent_feedback.push({ ...r, connectome: readDisplayName(p.path) || p.name });
                }
            }
            const owner = (p.owner && p.owner.trim()) || 'Unassigned';
            (customers[owner] = customers[owner] || []).push({
                name: p.name,
                display_name: readDisplayName(p.path) || p.name,
                path: p.path,
                api_port: p.api_port,
                running,
                live,
                pending: readConnectomePending(p.path), // { status, target_build, … } or null
            });
        }
        agg.recent_feedback.sort((a: any, b: any) => (a.ts < b.ts ? 1 : -1));
        const aggregate = {
            connectomes: agg.connectomes, running: agg.running,
            avg_score: agg.scoreN ? Math.round(agg.scoreSum / agg.scoreN) : null,
            checks: agg.checks, hallucinations_caught: agg.hallucinations_caught,
            coverage_gaps: agg.coverage_gaps, divergences: agg.divergences,
            by_category: agg.by_category, by_model: agg.by_model,
            feedback_total: agg.feedback_total, by_theme: agg.by_theme,
            recent_feedback: agg.recent_feedback.slice(0, 8),
        };
        res.json({ customers, latest: vendorBuild(), aggregate });
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

    // Rename a customer — moves ALL their connectomes to the new name. `from` = 'Unassigned'
    // targets connectomes with no owner (the sweep-everything-under-my-name path). If `to`
    // already exists, the groups merge.
    app.post('/api/launcher/rename-owner', (req, res) => {
        const { from, to } = req.body || {};
        const target = (typeof to === 'string') ? to.trim() : '';
        if (!target) return res.status(400).json({ error: 'a non-empty new name is required' });
        const reg = loadRegistry();
        let moved = 0;
        for (const p of reg.projects) {
            const cur = (p.owner && p.owner.trim()) || 'Unassigned';
            if (cur === from) { p.owner = target; moved++; }
        }
        saveRegistry(reg);
        res.json({ ok: true, moved, to: target });
    });

    // Send the update to a connectome — QUEUES it (writes a pending marker into the
    // connectome), whether the engine is running or stopped. Never force-applies and never
    // remotely starts a client's engine: the client sees the offer when they open/start
    // their connectome and chooses accept (→updated) or later (→pushed).
    app.post('/api/launcher/update', (req, res) => {
        const { path: projectPath } = req.body || {};
        const reg = loadRegistry();
        const proj = reg.projects.find(p => p.path === projectPath);
        if (!proj) return res.status(404).json({ error: 'connectome not registered' });
        const meta = vendorBuild();
        const pending = { status: 'sent', target_build: meta.build, target_version: meta.version, sent_at: new Date().toISOString() };
        try {
            const dir = path.join(proj.path, 'plexus-integration');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'pending-update.json'), JSON.stringify(pending, null, 2));
            res.json({ ok: true, name: proj.name, pending });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
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
            const base = path.resolve(base_dir || path.join(os.homedir(), 'PlexusProjects'));
            const projectPath = path.join(base, name.trim().replace(/\s+/g, '-'));
            savePrefs({ ...loadPrefs(), lastBase: base }); // remember for the next project
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

    // ── Onboarding (first-run wizard) ──
    app.get('/api/launcher/onboarding', (_req, res) => {
        res.json({ onboarded: !!loadPrefs().onboarded });
    });
    app.post('/api/launcher/onboarding/complete', (_req, res) => {
        const p = loadPrefs(); p.onboarded = true; savePrefs(p);
        res.json({ ok: true });
    });

    // ── AI clients: which are installed + (Claude Code only) is Plexus already connected ──
    app.get('/api/launcher/clients', (_req, res) => {
        let claudeConnected: boolean | undefined;
        if (onPath('claude')) {
            try { claudeConnected = /plexus/i.test(execFileSync('claude', ['mcp', 'list'], { encoding: 'utf8', timeout: 8000 })); }
            catch { claudeConnected = undefined; }
        }
        const clients = AI_CLIENTS.map(c => ({
            id: c.id, label: c.label,
            installed: onPath(c.bin),
            can_open_folder: !!c.openBin,
            connected: c.id === 'claude' ? claudeConnected : undefined,
        }));
        res.json({ clients, global_mcp: `claude mcp add --scope user plexus -- node "${CLI}" mcp` });
    });

    // ── Connect Plexus to an AI client (one-time). Claude Code = run it for the user;
    // other clients = hand back the config/command to paste. User-initiated only. ──
    app.post('/api/launcher/connect-mcp', (req, res) => {
        const client = String(req.body?.client || 'claude');
        const globalCmd = `claude mcp add --scope user plexus -- node "${CLI}" mcp`;
        if (client === 'claude') {
            try {
                const out = execFileSync('claude', ['mcp', 'add', '--scope', 'user', 'plexus', '--', process.execPath, CLI, 'mcp'], { encoding: 'utf8', timeout: 15000 });
                return res.json({ ok: true, ran: true, output: String(out).trim(), command: globalCmd });
            } catch (err: any) {
                const msg = String(err?.stderr || err?.message || err);
                const already = /already (exists|configured|added)/i.test(msg);
                return res.json({ ok: already, ran: false, already, error: already ? undefined : msg, command: globalCmd });
            }
        }
        // VS Code / Cursor / other MCP client: give them the server config to paste.
        res.json({
            ok: false, ran: false, manual: true, command: globalCmd,
            config_json: JSON.stringify({ mcpServers: { plexus: { command: process.execPath, args: [CLI, 'mcp'] } } }, null, 2),
            note: `Add Plexus to ${client}'s MCP config, then reopen it.`,
        });
    });

    // ── Resume: open a project folder in an editor, or hand back a `cd` command ──
    app.post('/api/launcher/open-editor', (req, res) => {
        const projectPath = path.resolve(String(req.body?.path || ''));
        const client = String(req.body?.client || '');
        if (!fs.existsSync(projectPath)) return res.status(404).json({ error: 'folder not found' });
        const resumeCmd = `cd "${projectPath}"`;
        const spec = AI_CLIENTS.find(c => c.id === client);
        try {
            if (spec?.openBin && onPath(spec.openBin)) { // VS Code / Cursor — open the folder
                spawn(spec.openBin, [projectPath], { detached: true, stdio: 'ignore' }).unref();
                return res.json({ ok: true, opened: spec.label });
            }
            if (client === 'folder') { // reveal in Finder / Explorer
                const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
                spawn(opener, [projectPath], { detached: true, stdio: 'ignore' }).unref();
                return res.json({ ok: true, opened: 'folder' });
            }
            if (client === 'claude' && process.platform === 'darwin') { // open Terminal at the folder
                spawn('open', ['-a', 'Terminal', projectPath], { detached: true, stdio: 'ignore' }).unref();
                return res.json({ ok: true, opened: 'Terminal', command: `${resumeCmd} && claude`, note: 'Terminal opened here — run `claude` to resume.' });
            }
        } catch (err: any) {
            return res.json({ ok: false, error: err.message, command: resumeCmd });
        }
        res.json({ ok: false, terminal: true, command: resumeCmd, note: 'Open a terminal here, then start your AI.' });
    });

    app.listen(LAUNCHER_PORT, '127.0.0.1', () => {
        console.log(`⬡ Plexus Launcher → http://localhost:${LAUNCHER_PORT}`);
        if (open && !process.env.PLEXUS_NO_OPEN) {
            try { require('open')(`http://localhost:${LAUNCHER_PORT}`); } catch { /* headless */ }
        }
    });
}
