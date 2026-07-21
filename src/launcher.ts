import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { spawn, execFile, execFileSync } from 'child_process';
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

import { loadRegistry, saveRegistry, patchManifestPorts, backupRegistry } from './core/registry';
import { writeProjectMcpJson, writeProjectPlugs, writeProjectTask, writeProjectEditorSettings, workCommand } from './core/clientConfig';

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

// ── Stable MCP address (~/.plexus/bin/plexus) ──
// AI-client configs must never point INSIDE an install location: app updates rewrite
// bundle contents, macOS translocation randomizes run paths, and users may have no
// global node. So registrations reference this SHIM, and the launcher rewrites the
// shim at startup to exec the current runtime + engine — configs survive every move,
// including the eventual jump from a dev repo to /Applications/Plexus.app.
const SHIM_DIR = path.join(os.homedir(), '.plexus', 'bin');
const SHIM_PATH = path.join(SHIM_DIR, 'plexus');
function ensureShim(): string {
    if (process.platform === 'win32') return ''; // windows shim comes with the packaged app
    try {
        fs.mkdirSync(SHIM_DIR, { recursive: true });
        const body = `#!/bin/sh\n# Plexus shim — the stable address AI-client MCP configs point at.\n# Rewritten by the Plexus launcher at startup; do not edit.\nexec "${process.execPath}" "${CLI}" "$@"\n`;
        let cur = '';
        try { cur = fs.readFileSync(SHIM_PATH, 'utf8'); } catch { /* first run */ }
        if (cur !== body) fs.writeFileSync(SHIM_PATH, body, { mode: 0o755 });
        else fs.chmodSync(SHIM_PATH, 0o755);
        return SHIM_PATH;
    } catch { return ''; }
}
// What an MCP config should launch. Prefer the shim; raw runtime+cli only as fallback.
function mcpServerSpec(): { command: string; args: string[] } {
    if (process.platform !== 'win32' && fs.existsSync(SHIM_PATH)) return { command: SHIM_PATH, args: ['mcp'] };
    return { command: process.execPath, args: [CLI, 'mcp'] };
}
// (Integration v2) globalMcpCmd() was removed with every global-registration
// surface: Plexus connects per project via .mcp.json written at create/connect,
// and no AI is ever permanently connected. The -p CLI flag remains for dev use.

// Codex CLI reads MCP servers ONLY from its global ~/.codex/config.toml (no
// per-project surface exists) — so "wired" for Codex means the user ran the
// explicit one-time enable, verifiable in its own config file.
function codexEnabled(): boolean {
    return mcpConfigHasPlexus(CODEX_MCP_CONFIG) === true;
}

// Is a command on PATH? (detect installed AI clients / editors)
function onPath(cmd: string): boolean {
    try { return !!execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' }).split('\n')[0].trim(); }
    catch { return false; }
}

// AI clients Plexus can help connect / open a project in. openBin = its CLI to open a
// folder (null = no folder CLI); app = macOS bundle (found even when the user never
// installed the shell command); mcpConfig = the JSON file the client reads MCP servers
// from (lets us introspect "already connected" AND tell the user exactly where to paste).
// kind: 'editor' (opens project windows) | 'ai' (CLI agent, runs in ANY terminal —
// never "linked" to an editor) | 'chat' (no folder concept; excluded from pickers).
// mcp = speaks the Model Context Protocol; project_wired = actually loads THIS
// project's plug today (.mcp.json). Only mcp && project_wired AIs are selectable
// for Plexus work — anything else engages the project blind, defeating Plexus.
interface AiClient { id: string; label: string; kind: 'editor' | 'ai' | 'chat'; mcp?: boolean; project_wired?: boolean; builtin_agent?: boolean; bin: string | null; openBin: string | null; app: string | null; bundleId?: string; mcpConfig?: string; hint?: string }
const ANTIGRAVITY_MCP_CONFIG = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
const CLAUDE_DESKTOP_CONFIG = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
const VSCODE_MCP_CONFIG = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
const CURSOR_MCP_CONFIG = path.join(os.homedir(), '.cursor', 'mcp.json');
const CODEX_MCP_CONFIG = path.join(os.homedir(), '.codex', 'config.toml');
const GEMINI_MCP_CONFIG = path.join(os.homedir(), '.gemini', 'settings.json');
// hint = who this plug actually serves. The rule users trip on: you connect the AI AGENT,
// not the window it runs in — a CLI carries its own plug into any IDE's terminal.
const AI_CLIENTS: AiClient[] = [
    { id: 'claude', label: 'Claude Code', kind: 'ai', mcp: true, project_wired: true, bin: 'claude', openBin: null, app: null,
        hint: 'MCP-capable and Plexus-ready — auto-connects to any Plexus project it opens in.' },
    { id: 'antigravity', label: 'Antigravity', kind: 'editor', builtin_agent: true, bin: 'antigravity', openBin: 'antigravity', app: '/Applications/Antigravity.app', bundleId: 'com.google.antigravity', mcpConfig: ANTIGRAVITY_MCP_CONFIG,
        hint: 'Editor with a built-in agent. Any AI CLI also runs in its terminal.' },
    { id: 'code', label: 'VS Code', kind: 'editor', builtin_agent: true, bin: 'code', openBin: 'code', app: '/Applications/Visual Studio Code.app', bundleId: 'com.microsoft.VSCode', mcpConfig: VSCODE_MCP_CONFIG,
        hint: 'Editor (built-in Copilot agent). Any AI CLI also runs in its terminal.' },
    { id: 'cursor', label: 'Cursor', kind: 'editor', builtin_agent: true, bin: 'cursor', openBin: 'cursor', app: '/Applications/Cursor.app', bundleId: 'com.todesktop.230313mzl4w4u92', mcpConfig: CURSOR_MCP_CONFIG,
        hint: 'Editor with a built-in agent. Any AI CLI also runs in its terminal.' },
    { id: 'codex', label: 'Codex CLI', kind: 'ai', mcp: true, project_wired: false, bin: 'codex', openBin: null, app: null, mcpConfig: CODEX_MCP_CONFIG,
        hint: 'MCP-capable, but global-only by OpenAI’s design — Plexus never connects any AI globally, so Codex becomes selectable only if you connect it yourself in Codex’s own settings (Plexus honors that), or when OpenAI ships a per-project option.' },
    { id: 'gemini', label: 'Gemini CLI', kind: 'ai', mcp: true, project_wired: true, bin: 'gemini', openBin: null, app: null, mcpConfig: GEMINI_MCP_CONFIG,
        hint: 'MCP-capable and Plexus-ready — connects per project (.gemini/settings.json); the ⬡ badge confirms on first use.' },
    { id: 'claude-desktop', label: 'Claude Desktop', kind: 'chat', bin: null, openBin: null, app: '/Applications/Claude.app', bundleId: 'com.anthropic.claudefordesktop', mcpConfig: CLAUDE_DESKTOP_CONFIG,
        hint: 'Chat app — no project folders, so it cannot do Plexus project work.' },
    // ── Extended catalog: recognized on sight when installed; Plexus wiring is
    // verification-gated per client (truthful labels — never claim untested). ──
    { id: 'copilot', label: 'GitHub Copilot CLI', kind: 'ai', mcp: true, project_wired: false, bin: 'copilot', openBin: null, app: null,
        hint: 'MCP-capable — Plexus wiring for this AI is pending verification.' },
    { id: 'qwen', label: 'Qwen Code', kind: 'ai', mcp: true, project_wired: false, bin: 'qwen', openBin: null, app: null,
        hint: 'MCP-capable (Gemini-CLI family) — Plexus wiring pending verification.' },
    { id: 'opencode', label: 'OpenCode', kind: 'ai', mcp: true, project_wired: false, bin: 'opencode', openBin: null, app: null,
        hint: 'MCP-capable — Plexus wiring for this AI is pending verification.' },
    { id: 'goose', label: 'Goose', kind: 'ai', mcp: true, project_wired: false, bin: 'goose', openBin: null, app: null,
        hint: 'MCP-native — Plexus wiring for this AI is pending verification.' },
    { id: 'aider', label: 'Aider', kind: 'ai', mcp: false, project_wired: false, bin: 'aider', openBin: null, app: null,
        hint: 'Not MCP-capable — it can run in a project folder but cannot use the Plexus brain.' },
];

// Where the client's app actually lives: the conventional /Applications path, else a
// Spotlight lookup by bundle id — which finds it ANYWHERE on disk (e.g. an app the user
// runs straight out of ~/Downloads and never moved). ~50ms, and detection is cached.
function mdfindApp(bundleId: string): string | null {
    try {
        const out = execFileSync('mdfind', [`kMDItemCFBundleIdentifier == '${bundleId}'`], { encoding: 'utf8', timeout: 4000 });
        return out.split('\n').map(s => s.trim()).find(s => s.endsWith('.app')) || null;
    } catch { return null; }
}
function findAppPath(c: AiClient): string | null {
    if (c.app && fs.existsSync(c.app)) return c.app;
    if (c.bundleId && process.platform === 'darwin') return mdfindApp(c.bundleId);
    return null;
}
function clientInstalled(c: AiClient): boolean {
    return (!!c.bin && onPath(c.bin)) || !!findAppPath(c);
}

// Is plexus registered in a client's mcpServers config? false = file absent or no entry
// (honestly not connected); undefined = file unreadable (unknown).
// Handles every roster format: JSON with "mcpServers" (Claude Desktop / Cursor / Gemini /
// Antigravity), JSON with "servers" (VS Code's mcp.json), TOML tables (Codex config.toml).
function mcpConfigHasPlexus(file: string): boolean | undefined {
    if (!fs.existsSync(file)) return false;
    try {
        const raw = fs.readFileSync(file, 'utf8').trim();
        if (!raw) return false; // created-but-empty config = definitively not registered
        if (file.endsWith('.toml')) return /^\s*\[mcp_servers\.plexus\]/m.test(raw);
        const j = JSON.parse(raw);
        return !!(j?.mcpServers?.plexus || j?.servers?.plexus);
    } catch { return undefined; } // unreadable/nonstandard — unknown, don't claim either way
}

// REAL detection, never a canned list: `which <bin>` / app-bundle existence per client,
// plus — Claude Code only — `claude mcp list` grepped for plexus (is it registered?).
// Async so the slow CLI never blocks the launcher, cached 60s, prewarmed at startup so
// the wizard's connect step renders instantly.
let clientsCache: { at: number; clients: any[] } | null = null;
async function detectClients(force = false): Promise<any[]> {
    if (!force && clientsCache && Date.now() - clientsCache.at < 60000) return clientsCache.clients;
    const clients = [];
    for (const c of AI_CLIENTS) {
        const installed = clientInstalled(c);
        let connected: boolean | undefined;
        if (installed && c.id === 'claude') {
            connected = await new Promise<boolean | undefined>(resolve => {
                execFile('claude', ['mcp', 'list'], { encoding: 'utf8', timeout: 10000 }, (err, stdout) => {
                    resolve(err ? undefined : /plexus/i.test(String(stdout)));
                });
            });
        } else if (installed && c.mcpConfig) {
            connected = mcpConfigHasPlexus(c.mcpConfig); // Antigravity / Claude Desktop
        }
        // Codex is global-only by ITS design. Plexus NEVER writes global config —
        // it only HONORS a connection the user made themselves (read-only check),
        // surfaces the command for them to run, and may REMOVE its own footprint
        // on their click (Disengage) — reach only ever shrinks by button.
        const effectiveWired = c.id === 'codex' ? codexEnabled() : !!c.project_wired;
        const spec = mcpServerSpec();
        clients.push({
            id: c.id, label: c.label, kind: c.kind, mcp: !!c.mcp, project_wired: effectiveWired,
            global_connection: c.id === 'codex' && effectiveWired,
            connect_command: c.id === 'codex' && installed && !effectiveWired
                ? `codex mcp add plexus -- "${spec.command}" ${spec.args.join(' ')}` : undefined,
            builtin_agent: !!c.builtin_agent, installed, can_open_folder: !!c.openBin, connected, hint: c.hint,
        });
    }
    // User-added AI CLIs (Manage connections → "Add an AI"): any command on PATH.
    // mcp flag = the user attests it reads the project's .mcp.json — only then is
    // it selectable for Plexus work; otherwise it is detected but non-selectable.
    for (const c of (loadPrefs().custom_ais || [])) {
        clients.push({
            id: 'custom:' + c.bin, label: c.label || c.bin, kind: 'ai', custom: true,
            mcp: !!c.mcp, project_wired: !!c.mcp, installed: onPath(c.bin), can_open_folder: false,
            hint: c.mcp
                ? 'Custom AI — marked MCP-capable (reads the project .mcp.json), so it can use the Plexus brain.'
                : 'Custom AI — not MCP-capable: it can run in a project folder but cannot use the Plexus brain.',
        });
    }
    clientsCache = { at: Date.now(), clients };
    return clients;
}

// ─── Server ───────────────────────────────────────────────────────────────────

export function startLauncher(open = true) {
    ensureShim(); // stable MCP address before anything reads or registers it
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

    // What did Claude Code record about this project's .mcp.json question?
    // Read-only mirror of ~/.claude.json (Claude's own bookkeeping, never edited
    // by us): approved | approved_all (option 2 — blanket) | declined | unasked.
    function readMcpStatus(projectPath: string): string {
        // TRUE STORE (verified live, CC 2.1.215): project-server choices are written
        // to <project>/.claude/settings.local.json (decline → disabledMcpjsonServers
        // there; reset-project-choices clears it there). The ~/.claude.json record is
        // legacy scaffolding — kept only as a fallback for older clients. LIVE
        // engagement is shown separately from running processes + engine activity.
        try {
            const read = (f: string) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch { return {}; } };
            const local = read(path.join(projectPath, '.claude', 'settings.local.json'));
            const home = (read(path.join(os.homedir(), '.claude.json')).projects || {})[path.resolve(projectPath)] || {};
            for (const rec of [local, home]) {
                if ((rec.disabledMcpjsonServers || []).includes('plexus')) return 'declined';
                if (rec.enableAllProjectMcpServers === true) return 'approved_all';
                if ((rec.enabledMcpjsonServers || []).includes('plexus')) return 'approved';
            }
            return 'unasked';
        } catch { return 'unknown'; }
    }

    // GROUND TRUTH for "is an AI session connected to this project right now":
    // live plexus MCP processes and their anchor folders (cwd). Beats every
    // record: a process either exists or it doesn't. Cached 10s.
    let anchorsCache: { at: number; set: Set<string> } | null = null;
    function liveMcpAnchors(): Set<string> {
        if (anchorsCache && Date.now() - anchorsCache.at < 10000) return anchorsCache.set;
        const set = new Set<string>();
        try {
            const pids = execFileSync('pgrep', ['-f', 'dist/cli.js mcp'], { encoding: 'utf8' })
                .split('\n').map(s => s.trim()).filter(Boolean);
            for (const pid of pids) {
                try {
                    const out2 = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' });
                    const m = out2.split('\n').find(l => l.startsWith('n'));
                    if (m) set.add(path.resolve(m.slice(1)));
                } catch { /* pid exited mid-scan */ }
            }
        } catch { /* pgrep: no live sessions */ }
        anchorsCache = { at: Date.now(), set };
        return set;
    }

    // Projects + live status
    app.get('/api/launcher/projects', async (_req, res) => {
        const reg = loadRegistry();
        const anchors = liveMcpAnchors();
        const out = [];
        for (const p of reg.projects) {
            out.push({
                ...p,
                exists: fs.existsSync(p.path),
                running: await probe(p.api_port),
                // Integration v2 door: paste in a terminal (NOT into an AI chat) —
                // moves that terminal into the project and starts the AI there.
                // (Pin-style `-p` commands were removed from every consumer surface:
                // they re-point Plexus without moving the session's anchor = split-brain.
                // The -p flag itself remains a CLI/dev capability.)
                connect_code: workCommand(p.name),
                mcp_status: readMcpStatus(p.path),
                // a live plexus MCP process anchored in this project (or a subfolder)
                live_session: [...anchors].some(a => a === path.resolve(p.path) || a.startsWith(path.resolve(p.path) + path.sep)),
            });
        }
        res.json({
            projects: out,
            default_base: loadPrefs().lastBase || path.join(os.homedir(), 'PlexusProjects'),
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
                const [ver, eff, fb, pend] = await Promise.all([
                    fetchJson(p.api_port, '/api/engine/version'),
                    fetchJson(p.api_port, '/api/effectiveness'),
                    fetchJson(p.api_port, '/api/feedback'),
                    fetchJson(p.api_port, '/api/pending'), // quarantine tray (older engines 404 → null → 0)
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
                    pending_deposits: pend?.count ?? 0, // evidence-trust: deposits awaiting review
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
                home: os.homedir(),
                dirs: entries.slice(0, 200),
                has_git: fs.existsSync(path.join(target, '.git')),
                has_plexus: fs.existsSync(path.join(target, 'plexus-integration')),
            });
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    });

    // Native folder picker (macOS): the same system dialog every Mac app uses —
    // attached to the frontmost app so it appears over the browser. Async so the
    // launcher stays responsive while the dialog is open. Non-mac / failure →
    // client falls back to the in-page picker modal.
    app.post('/api/launcher/pick-folder', (req, res) => {
        if (process.platform !== 'darwin') return res.json({ unsupported: true });
        const startRaw = String(req.body?.start || '');
        const start = (startRaw && fs.existsSync(startRaw)) ? startRaw : os.homedir();
        const prompt = String(req.body?.prompt || 'Choose a folder').replace(/[\r\n"\\]/g, '').slice(0, 80);
        const script = [
            'tell application (path to frontmost application as text)',
            '\tactivate',
            `\tset _f to choose folder with prompt "${prompt}" default location POSIX file "${start.replace(/["\\]/g, '')}"`,
            'end tell',
            'POSIX path of _f',
        ].join('\n');
        execFile('osascript', ['-e', script], { encoding: 'utf8', timeout: 180000 }, (err, stdout, stderr) => {
            if (!err) return res.json({ path: String(stdout).trim().replace(/\/$/, '') });
            const msg = String(stderr || err.message || '');
            if ((err as any).killed || /-128|cancel/i.test(msg)) return res.json({ cancelled: true });
            res.json({ unsupported: true, error: msg.slice(0, 200) });
        });
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
                connect_code: workCommand(name),
                plug: 'per-project (.mcp.json written by init — sessions in this folder auto-load Plexus)',
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

            // Integration v2: the plug travels WITH the project. Fresh inits already
            // wrote it; connecting an ALREADY-brained project must write it too.
            const plugResult = writeProjectPlugs(projectPath).claude;
            if (plugResult.error) console.warn(`[Plexus Launcher] project plug: ${plugResult.error}`);

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
                connect_code: workCommand(entry.name),
                plug: plugResult.error ? `plug NOT written: ${plugResult.error}` : 'per-project (.mcp.json — sessions in this folder auto-load Plexus)',
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
        // Return the removed entry so the UI's Undo toast can restore it EXACTLY
        // (same ports/kind/owner) — better than a re-connect, which mints new ports.
        const removed = reg.projects.find(p => path.resolve(p.path) === projectPath) || null;
        reg.projects = reg.projects.filter(p => path.resolve(p.path) !== projectPath);
        saveRegistry(reg);
        res.json({ success: true, removed, note: 'removed from the launcher registry only — nothing on disk was touched' });
    });

    // Undo for ✕: put the forgotten entry back verbatim.
    app.post('/api/launcher/restore', (req, res) => {
        const entry = req.body?.entry;
        if (!entry || typeof entry.path !== 'string' || typeof entry.name !== 'string'
            || typeof entry.api_port !== 'number' || typeof entry.ws_port !== 'number') {
            return res.status(400).json({ error: 'entry {name, path, api_port, ws_port, …} required' });
        }
        const reg = loadRegistry();
        if (reg.projects.some(p => path.resolve(p.path) === path.resolve(entry.path))) {
            return res.json({ success: true, already: true });
        }
        reg.projects.unshift({
            name: entry.name, path: entry.path,
            api_port: entry.api_port, ws_port: entry.ws_port,
            created_at: entry.created_at || new Date().toISOString(),
            kind: entry.kind === 'genesis' ? 'genesis' : 'connected',
            ...(entry.owner ? { owner: String(entry.owner) } : {}),
        });
        saveRegistry(reg);
        res.json({ success: true });
    });

    // ── Registry heal (Integration v2, P0): a separate, REVERSIBLE diagnostic ──
    // Flags entries whose folder is gone (moved/deleted); repair rewrites the path
    // only after a registry backup, and only to a folder that actually holds a brain.
    app.get('/api/launcher/registry-health', (_req, res) => {
        const reg = loadRegistry();
        res.json({
            entries: reg.projects.map(p => ({
                name: p.name, path: p.path,
                exists: fs.existsSync(p.path),
                has_brain: fs.existsSync(path.join(p.path, 'plexus-integration')),
            })),
        });
    });
    app.post('/api/launcher/relocate', (req, res) => {
        const { name, new_path } = req.body || {};
        const target = path.resolve(String(new_path || ''));
        if (!fs.existsSync(path.join(target, 'plexus-integration'))) {
            return res.status(400).json({ error: 'no plexus-integration/ at the new path — that folder is not a brain' });
        }
        const reg = loadRegistry();
        const proj = reg.projects.find(p => p.name === name);
        if (!proj) return res.status(404).json({ error: 'project not in registry' });
        backupRegistry(); // ~/.plexus/projects.json.bak — undo by hand if a repair was wrong
        proj.path = target;
        saveRegistry(reg);
        writeProjectPlugs(target); // the plugs follow the project
        res.json({ ok: true, name, path: target, note: 'registry backed up to projects.json.bak before the change' });
    });

    // ── Open a project DOOR (Integration v2): the project's editor window with
    // its preferred AI auto-engaged. Used by task_check mismatch recovery ("open
    // the right project"). Falls back to the connect code when no editor exists. ──
    app.post('/api/launcher/open-door', (req, res) => {
        const { name } = req.body || {};
        const reg = loadRegistry();
        const proj = reg.projects.find(p => p.name === name);
        if (!proj) return res.status(404).json({ error: 'project not in registry' });
        if (!fs.existsSync(proj.path)) return res.status(400).json({ error: `folder missing (${proj.path}) — repair via /api/launcher/relocate` });
        const editor = proj.preferred_editor
            || AI_CLIENTS.find(c => c.kind === 'editor' && clientInstalled(c))?.id;
        if (!editor) {
            return res.json({ ok: false, error: 'no code editor detected on this Mac', connect_code: workCommand(proj.name), note: 'Paste the connect code in a terminal (before engaging the AI) instead.' });
        }
        const ai = proj.preferred_ai || (onPath('claude') ? 'claude' : 'none');
        const r = openProject(path.resolve(proj.path), editor, ai);
        res.status(r.status).json({ ...r.body, project: proj.name });
    });

    // ── Onboarding (first-run wizard) ──
    app.get('/api/launcher/onboarding', (_req, res) => {
        const p = loadPrefs();
        // always_intro: dev/demo pref — replay the full wizard on every launch.
        // Real users never have it; their wizard shows once.
        res.json({ onboarded: !!p.onboarded, always_intro: !!p.always_intro });
    });
    app.post('/api/launcher/onboarding/complete', (_req, res) => {
        const p = loadPrefs(); p.onboarded = true; savePrefs(p);
        res.json({ ok: true });
    });

    // ── AI clients: which are installed + (Claude Code only) is Plexus already connected ──
    app.get('/api/launcher/clients', async (_req, res) => {
        res.json({ clients: await detectClients(String((_req as any).query?.force || '') === '1') });
    });

    // ── Custom AI CLIs (Manage connections → "Add an AI") ──────────────────────
    // Any agent CLI on PATH can be registered by command name — covering newly
    // installed / open-source AIs without touching any editor's settings. The
    // mcp flag is the user's attestation that it reads the project's .mcp.json.
    app.post('/api/launcher/custom-ai', (req, res) => {
        const bin = String(req.body?.bin || '').trim();
        const label = String(req.body?.label || '').trim();
        const mcp = !!req.body?.mcp;
        if (!/^[A-Za-z0-9._\/-]+$/.test(bin)) {
            return res.status(400).json({ error: 'command may only contain letters, digits, dot, dash, underscore, slash' });
        }
        if (!onPath(bin)) {
            return res.status(400).json({ error: `"${bin}" is not on PATH — install it first, then add it here` });
        }
        const p = loadPrefs();
        p.custom_ais = (p.custom_ais || []).filter((c: any) => c.bin !== bin);
        p.custom_ais.push({ bin, label: label || bin, mcp });
        savePrefs(p);
        clientsCache = null;
        res.json({ ok: true, bin, mcp });
    });
    // Re-arm the first-open permission question for a project — from ANY state
    // (approved / approved_all / declined). Runs Claude Code's own documented
    // command; approves NOTHING by itself. Running sessions are unaffected; the
    // NEXT session in the project shows the three-option question again.
    app.post('/api/launcher/rearm-mcp', (req, res) => {
        const projectPath = path.resolve(String(req.body?.path || ''));
        const reg = loadRegistry();
        const proj = reg.projects.find(p => path.resolve(p.path) === projectPath);
        if (!proj) return res.status(404).json({ error: 'project not in registry' });
        if (!fs.existsSync(projectPath)) return res.status(400).json({ error: 'project folder missing' });
        try {
            execFileSync('claude', ['mcp', 'reset-project-choices'], { cwd: projectPath, encoding: 'utf8', timeout: 15000 });
            res.json({ ok: true, note: 'Re-armed — the permission question will appear on the next AI session in this project.' });
        } catch (err: any) {
            res.status(500).json({ error: String(err?.stderr || err?.message || err).slice(0, 200) });
        }
    });

    // (Removed) enable-codex: Plexus never writes global config for ANY client —
    // that is the core v2 principle. Codex is honored read-only if the user
    // connected it themselves. Stub keeps stale UIs honest.
    app.post('/api/launcher/enable-codex', (_req, res) => {
        res.json({ ok: false, removed: true, note: 'Plexus never connects an AI globally. Codex is global-only by design — connect it yourself in Codex settings if you want it, and Plexus will honor it.' });
    });

    // Disengage Codex: remove PLEXUS'S OWN entry from Codex's config via Codex's
    // own CLI, on the user's click. Allowed by the asymmetry rule: adding reach
    // requires the user's hands; shrinking reach only requires their click
    // (same footing as re-arm). Re-connecting later = the same paste ceremony.
    // Open a PLAIN terminal window — no AI, no cd, nothing loaded. Exists for
    // one-time paste ceremonies (the Codex connect command) so a dashboard-first
    // user is never stranded hunting for "any terminal".
    app.post('/api/launcher/open-terminal', (_req, res) => {
        if (process.platform !== 'darwin') return res.json({ ok: false, error: 'automatic terminal opening is macOS-only for now — open your terminal app manually' });
        const scpt = ['tell application "Terminal"', '\tactivate', '\tdo script ""', 'end tell'].join('\n');
        execFile('osascript', ['-e', scpt], { encoding: 'utf8', timeout: 15000 }, () => { /* fire-and-forget */ });
        res.json({ ok: true });
    });

    app.post('/api/launcher/disengage-codex', (_req, res) => {
        try {
            execFileSync('codex', ['mcp', 'remove', 'plexus'], { encoding: 'utf8', timeout: 20000 });
            clientsCache = null;
            res.json({ ok: true, note: 'Plexus removed from Codex. To use Codex with Plexus again, run the connect command yourself — same one-time paste.' });
        } catch (err: any) {
            res.status(500).json({ error: String(err?.stderr || err?.message || err).slice(0, 200) });
        }
    });

    app.post('/api/launcher/custom-ai/remove', (req, res) => {
        const bin = String(req.body?.bin || '').trim();
        const p = loadPrefs();
        p.custom_ais = (p.custom_ais || []).filter((c: any) => c.bin !== bin);
        savePrefs(p);
        clientsCache = null;
        res.json({ ok: true });
    });

    // ── (Integration v2) Global registration REMOVED. Plexus connects per
    // project (.mcp.json written at create/connect); no AI is ever permanently
    // connected. Stub kept so any stale UI gets an honest answer, not a 404.
    app.post('/api/launcher/connect-mcp', (_req, res) => {
        res.json({
            ok: false, removed: true,
            note: 'Global registration was removed — every Plexus project carries its own connection (.mcp.json in its folder). There is nothing to install; open your AI inside a project and it connects automatically.',
        });
    });

    // ── Open project (Integration v2): editor window + auto-engaged AI ─────────
    // Editors only — the Terminal.app path is gone (TUI color artifacts, a window
    // orphaned from the files, an extra automation prompt). The chosen AI starts
    // automatically inside the editor via a "runOn: folderOpen" task, so one
    // click yields window + terminal + engaged AI.

    function launchEditor(projectPath: string, clientId: string): { ok: boolean; opened?: string; note?: string; error?: string } {
        const spec = AI_CLIENTS.find(c => c.id === clientId && c.kind === 'editor');
        if (!spec) return { ok: false, error: `unknown editor "${clientId}"` };
        if (spec.openBin && onPath(spec.openBin)) {
            spawn(spec.openBin, [projectPath], { detached: true, stdio: 'ignore' }).unref();
            return { ok: true, opened: spec.label };
        }
        const appPath = spec.openBin && process.platform === 'darwin' ? findAppPath(spec) : null;
        if (appPath) {
            // editor installed but its shell command isn't — open the bundle directly
            // (wherever it lives, incl. ~/Downloads via the Spotlight lookup)
            spawn('open', ['-a', appPath, projectPath], { detached: true, stdio: 'ignore' }).unref();
            // macOS won't launch a second instance of the same app: if another COPY is
            // already running (e.g. an old translocated Downloads build), the folder is
            // delivered to THAT instance — often invisibly. Say so instead of lying "ok".
            let note: string | undefined;
            try {
                const base = path.basename(appPath);
                const psOut = execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
                const line = psOut.split('\n').find(l => l.includes(`/${base}/Contents/MacOS/`));
                if (line) {
                    const m = line.match(new RegExp(`(/.*?/${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})/Contents/MacOS/`));
                    const runningApp = m ? m[1] : null;
                    if (runningApp && path.resolve(runningApp) !== path.resolve(appPath)) {
                        note = `${spec.label} is already running from a different copy — the folder was sent to that instance (its window may be behind others). Quit ${spec.label} and reopen to switch to the ${appPath} install.`;
                    }
                }
            } catch { /* diagnostics only */ }
            return { ok: true, opened: spec.label, note };
        }
        return { ok: false, error: `${spec.label} is installed but its open-folder command is unavailable` };
    }

    // Resolve an AI-picker choice into a launchable, Plexus-capable CLI.
    // Only mcp && project_wired AIs pass — anything else would open the project
    // blind (no brain), which defeats the purpose of a Plexus project.
    function resolveAi(ai: string): { bin: string; label: string } | { error: string } | null {
        if (!ai || ai === 'none' || ai === 'builtin') return null;
        const roster = AI_CLIENTS.find(c => c.id === ai && c.kind === 'ai');
        if (roster) {
            const wired = roster.id === 'codex' ? codexEnabled() : !!roster.project_wired;
            if (!roster.mcp || !wired) return { error: `${roster.label} cannot use the Plexus brain yet — pick a Plexus-ready AI or "none"` };
            if (!roster.bin || !onPath(roster.bin)) return { error: `${roster.label} is not installed on PATH` };
            return { bin: roster.bin, label: roster.label };
        }
        if (ai.startsWith('custom:')) {
            const c = (loadPrefs().custom_ais || []).find((x: any) => 'custom:' + x.bin === ai);
            if (!c) return { error: 'unknown custom AI — add it under Manage connections first' };
            if (!c.mcp) return { error: `${c.label || c.bin} is not marked MCP-capable — it cannot use the Plexus brain` };
            if (!onPath(c.bin)) return { error: `"${c.bin}" is not on PATH` };
            return { bin: c.bin, label: c.label || c.bin };
        }
        return { error: `unknown AI "${ai}"` };
    }

    function openProject(projectPath: string, client: string, ai: string): { status: number; body: any } {
        const resumeCmd = `cd "${projectPath}"`;
        if (!fs.existsSync(projectPath)) return { status: 404, body: { error: 'folder not found' } };
        if (client === 'folder') { // reveal in Finder / Explorer
            const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
            spawn(opener, [projectPath], { detached: true, stdio: 'ignore' }).unref();
            return { status: 200, body: { ok: true, opened: 'folder' } };
        }
        const resolved = resolveAi(ai);
        if (resolved && 'error' in resolved) return { status: 400, body: { error: resolved.error } };
        const task = writeProjectTask(projectPath, resolved ? resolved.bin : null, resolved ? resolved.label : undefined);
        writeProjectEditorSettings(projectPath); // terminal panel on the RIGHT by default (user's own setting always wins)
        try { // remember the choice → the card is one-click next time
            const reg = loadRegistry();
            const entry = reg.projects.find(p => path.resolve(p.path) === path.resolve(projectPath));
            if (entry) { entry.preferred_editor = client; entry.preferred_ai = resolved ? ai : 'none'; saveRegistry(reg); }
        } catch { /* preference is a nicety */ }
        try {
            const r = launchEditor(projectPath, client);
            if (!r.ok) return { status: 200, body: { ok: false, error: r.error, command: resumeCmd, note: 'Open a terminal here, then start your AI.' } };
            const taskNote = task.error
                ? `Auto-start not set: ${task.error}`
                : resolved
                    ? `${resolved.label} starts automatically in the window's terminal — if the editor asks its one-time trust / automatic-tasks question, approve it.`
                    : (task.removed ? 'Auto-start removed — the window opens plain.' : '');
            return { status: 200, body: { ok: true, opened: r.opened, note: [r.note, taskNote].filter(Boolean).join(' ') || undefined } };
        } catch (err: any) {
            return { status: 200, body: { ok: false, error: err.message, command: resumeCmd } };
        }
    }

    app.post('/api/launcher/open-editor', (req, res) => {
        const r = openProject(
            path.resolve(String(req.body?.path || '')),
            String(req.body?.client || ''),
            String(req.body?.ai || 'none'),
        );
        res.status(r.status).json(r.body);
    });

    app.listen(LAUNCHER_PORT, '127.0.0.1', () => {
        console.log(`⬡ Plexus Launcher → http://localhost:${LAUNCHER_PORT}`);
        // First-launch home for new projects: make the default base REAL from minute one
        // (visible in Finder), like any app-store app on first run. Skipped once the user
        // has chosen their own base — deleting it then stays deleted.
        try {
            const defBase = path.join(os.homedir(), 'PlexusProjects');
            const lastBase = loadPrefs().lastBase;
            if (!lastBase || lastBase === defBase) fs.mkdirSync(defBase, { recursive: true });
        } catch { /* best-effort */ }
        setTimeout(() => { detectClients().catch(() => { /* prewarm only */ }); }, 300);
        if (open && !process.env.PLEXUS_NO_OPEN) {
            try { require('open')(`http://localhost:${LAUNCHER_PORT}`); } catch { /* headless */ }
        }
    });
}
