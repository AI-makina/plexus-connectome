#!/usr/bin/env node
// ─── Plexus MCP server (Roadmap 1.1) ──────────────────────────────────────────
// The plug: exposes the Evidence Protocol as MCP tools over stdio, so any MCP
// client (Claude Code, Cursor, …) mediates its coding session through the
// brain from the FIRST response. Hand-rolled JSON-RPC 2.0 (newline-delimited)
// — zero new dependencies. Proxies the running `plexus serve` REST API and
// authenticates with the per-boot session token from plexus-integration/.
//
// Usage:  plexus mcp -p /path/to/target-app
// Client config (Claude Code):
//   claude mcp add plexus -- node <plexus>/dist/cli.js mcp -p /path/to/app

import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { findProjectRoot, projectBoundary, registerProject, patchManifestPorts } from './core/registry';

// Project resolution — AI-FIRST workflow (no -p needed): register this MCP
// server ONCE globally (`claude mcp add --scope user plexus -- plexus mcp`)
// and it resolves the brain from wherever the session was opened. If no brain
// exists yet, the init_project tool creates one from the user's own words.
const argv = process.argv.slice(2);
const pIdx = Math.max(argv.indexOf('-p'), argv.indexOf('--path'));
const CWD = path.resolve(process.cwd());
const explicitPath = pIdx >= 0 ? path.resolve(argv[pIdx + 1]) : null;
// Boundary-aware: findProjectRoot won't escape across a git repo into a parent's brain.
// If no brain is found within this project, a NEW one is rooted at the project boundary
// (git root) — never a deep subfolder, and never a parent connectome.
const foundBrain = explicitPath ? null : findProjectRoot(CWD);
let targetPath = explicitPath || foundBrain || projectBoundary(CWD);
let integrationPath = path.join(targetPath, 'plexus-integration');

const hasBrain = () => fs.existsSync(integrationPath);

// Did we attach to a brain that lives ABOVE where we launched? Cross-repo escapes are
// already blocked; this only flags the residual ambiguous case (a manifest-bearing folder
// with no git of its own nested under a parent brain) so the AI can surface it, not seed
// the wrong connectome silently.
const resolvedFromParent = !explicitPath && !!foundBrain && foundBrain !== CWD;
function looksLikeOwnProject(dir: string): boolean {
    return ['package.json', 'pyproject.toml', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml',
        'build.gradle', 'Gemfile', 'composer.json', 'requirements.txt']
        .some((m) => fs.existsSync(path.join(dir, m)));
}
// Warn only when the brain we attached to sits ABOVE our own project root — i.e. it is NOT
// the shared root of this project/monorepo. That suppresses the legit monorepo-package case
// (git or gitless: our project root IS the brain root) and fires only on genuine cross-project
// nesting (a manifest folder resolving up past its own project into a foreign brain).
const parentMisresolveRisk = resolvedFromParent && looksLikeOwnProject(CWD) && projectBoundary(CWD) !== foundBrain;

// Auto-start (zero-touch): if the brain exists but its engine isn't running,
// boot it — the user should never have to remember `plexus serve`.
let engineStarting = false;
async function ensureEngine(): Promise<boolean> {
    if (!hasBrain()) return false;
    const alive = () => new Promise<boolean>(resolve => {
        const req = http.get({ host: '127.0.0.1', port: apiPort(), path: '/api/session', timeout: 400 },
            res => { res.resume(); resolve(true); });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
    if (await alive()) return true;
    if (!engineStarting) {
        engineStarting = true;
        const child = spawn(process.execPath, [path.join(__dirname, 'index.js'), targetPath], {
            detached: true, stdio: 'ignore',
            env: { ...process.env, PLEXUS_NO_OPEN: '1' },
        });
        child.unref();
    }
    for (let i = 0; i < 24; i++) {
        await new Promise(r => setTimeout(r, 250));
        if (await alive()) { engineStarting = false; return true; }
    }
    engineStarting = false;
    return false;
}

function apiPort(): number {
    try {
        const manifest = JSON.parse(fs.readFileSync(path.join(integrationPath, 'plexus-manifest.json'), 'utf8'));
        return manifest?.server?.api_port || 3200;
    } catch { return 3200; }
}

function sessionToken(): string | null {
    try { return fs.readFileSync(path.join(integrationPath, 'session-token'), 'utf8').trim(); }
    catch { return null; }
}

function apiRequest(method: string, apiPath: string, body?: any): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const req = http.request({
            host: '127.0.0.1',
            port: apiPort(),
            path: apiPath,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...(sessionToken() ? { 'x-plexus-token': sessionToken()! } : {}),
            },
            timeout: 15000,
        }, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode || 0, data: raw ? JSON.parse(raw) : null }); }
                catch { resolve({ status: res.statusCode || 0, data: raw }); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('engine timeout')); });
        if (payload) req.write(payload);
        req.end();
    });
}

const ENGINE_DOWN_HINT =
    `Plexus engine is not reachable on 127.0.0.1:${apiPort()}. Start it with: plexus serve -p "${targetPath}" — then retry.`;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
    {
        name: 'session_open',
        description: 'Open a Plexus session: graph stats, freshness, and the working protocol. Call this FIRST, before reading or writing any code. Auto-starts the engine if needed.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'init_project',
        description: 'Give this project a brain. Call when the user asks to BUILD something and no Plexus brain exists here yet: pass the app description in the user\'s own words (their prompt IS the genesis brief). Creates + boots the brain; then run the genesis interview conversationally and seed the plan.',
        inputSchema: {
            type: 'object', required: ['description'],
            properties: {
                description: { type: 'string', description: 'the app, in the user\'s words — copy their intent faithfully' },
                risks: { type: 'string', description: 'anything the user said must never go wrong' },
                name: { type: 'string', description: 'project name (defaults to the folder name)' },
            },
        },
    },
    {
        name: 'consult',
        description: 'MANDATORY before changing code: get the ranked consultation brief for the nodes/files/symbol you are about to touch — what exists, what breaks (blast radius), what failed before (amygdala), what was already tried (dormant). Cheaper and more reliable than grep.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'symbol or node name' },
                file_paths: { type: 'array', items: { type: 'string' }, description: 'target-relative file paths' },
                node_ids: { type: 'array', items: { type: 'string' } },
                mode: { type: 'string', enum: ['planning', 'building', 'debugging'] },
            },
        },
    },
    {
        name: 'claim_check',
        description: 'Existence oracle: BEFORE writing code, declare every identifier you intend to rely on (functions, components, endpoints, env vars). Returns exists / missing / dormant-with-reason / ambiguous / out_of_scope. Prevents invented APIs.',
        inputSchema: {
            type: 'object',
            required: ['identifiers'],
            properties: {
                identifiers: {
                    type: 'array',
                    items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { name: { type: 'string' }, kind: { type: 'string' }, file_hint: { type: 'string' } }, required: ['name'] }] },
                },
            },
        },
    },
    {
        name: 'simulate_impact',
        description: 'Blast-radius simulation for a planned change. Returns affected nodes with impact levels, amygdala warnings, and a risk verdict. Required at pre-flight for any non-trivial change.',
        inputSchema: {
            type: 'object',
            required: ['node_ids'],
            properties: {
                node_ids: { type: 'array', items: { type: 'string' } },
                change_type: { type: 'string', enum: ['modify', 'removal', 'addition'] },
            },
        },
    },
    {
        name: 'search_nodes',
        description: 'Fuzzy-search graph nodes by name/path/description. Use to find node ids for consult/simulate.',
        inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } },
    },
    {
        name: 'deposit_amygdala',
        description: 'Record a failure in threat memory. Call after EVERY failed fix attempt (lightweight) and when closing an incident (full). This is how the brain learns; skipping it repeats mistakes.',
        inputSchema: {
            type: 'object',
            required: ['title', 'severity'],
            properties: {
                title: { type: 'string' },
                severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                what_broke: { type: 'string' },
                nodes_touched: { type: 'array', items: { type: 'string' }, description: 'node ids involved' },
                lessons: { type: 'array', items: { type: 'string' } },
                trigger_nodes: { type: 'array', items: { type: 'string' }, description: 'node ids that should warn on future changes' },
                warning_message: { type: 'string' },
            },
        },
    },
    {
        name: 'mark_dormant',
        description: 'Retire an approach without deleting it: marks a node dormant with the reason (e.g. "tried X, failed because Y"). Dormant neighbors surface as "we already tried that" in future consultations.',
        inputSchema: {
            type: 'object', required: ['node_id', 'reason'],
            properties: { node_id: { type: 'string' }, reason: { type: 'string' } },
        },
    },
    {
        name: 'declare_invariant',
        description: 'Declare a truth the code must never violate ("totals are computed server-side only"), bound to the node ids it protects. Future consultations touching those nodes will surface it. Use sparingly (≤12).',
        inputSchema: {
            type: 'object', required: ['statement', 'node_ids'],
            properties: {
                statement: { type: 'string' },
                node_ids: { type: 'array', items: { type: 'string' } },
            },
        },
    },
    {
        name: 'update_graph',
        description: 'Deposit new map facts after executing a change: add nodes (with declared origin llm/seed) and synapses for what you created. Part of the mandatory post-change update step.',
        inputSchema: {
            type: 'object',
            properties: {
                nodes: { type: 'array', items: { type: 'object' }, description: 'PlexusNode partials: {name, type, region, file_path, description, metadata?}' },
                synapses: { type: 'array', items: { type: 'object' }, description: '{source_node_id, target_node_id, type, strength?, description?}' },
            },
        },
    },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function callTool(name: string, args: any): Promise<string> {
    // Zero-touch engine: every tool call transparently boots the engine when
    // the brain exists but isn't being served.
    if (name !== 'init_project' && hasBrain()) await ensureEngine();

    switch (name) {
        case 'init_project': {
            if (hasBrain()) {
                if (resolvedFromParent) {
                    return [
                        `A brain already exists at ${targetPath} — but that is a PARENT of where you're working (${CWD}).`,
                        `It belongs to an enclosing project. Do NOT seed it with this project's work.`,
                        `To start a SEPARATE brain here, either run \`git init\` in ${CWD} (or make it a top-level`,
                        `folder) and relaunch, or register a pinned server for it:`,
                        `  claude mcp add plexus -- node "${path.join(__dirname, 'cli.js')}" mcp -p "${CWD}"`,
                    ].join('\n');
                }
                return `A brain already exists at ${targetPath} — call session_open instead.`;
            }
            const { execFileSync } = require('child_process');
            let projName = String(args?.name || '').trim();
            // A brain must NEVER root at a broad folder (home, Desktop, Documents,
            // Downloads, PlexusProjects): a parent-level brain would capture every future
            // non-git subfolder under it. This is exactly the terminal-first path — the
            // user pastes the MCP command, opens the AI at home, and says "build my app" —
            // so root the project in its own subfolder instead.
            const HOME = require('os').homedir();
            const broadDirs = [HOME, path.join(HOME, 'Desktop'), path.join(HOME, 'Documents'), path.join(HOME, 'Downloads'), path.join(HOME, 'PlexusProjects')];
            let relocated = false;
            if (broadDirs.includes(targetPath)) {
                const slug = (projName || 'plexus-project').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'plexus-project';
                const base = targetPath === HOME ? path.join(HOME, 'PlexusProjects') : targetPath;
                targetPath = path.join(base, slug);
                integrationPath = path.join(targetPath, 'plexus-integration');
                if (fs.existsSync(integrationPath)) {
                    return `A brain already exists at ${targetPath} — open your sessions from that folder and call session_open.`;
                }
                fs.mkdirSync(targetPath, { recursive: true });
                try { execFileSync('git', ['init', '-q'], { cwd: targetPath }); } catch { /* git optional */ }
                relocated = true;
            }
            if (!projName) projName = path.basename(targetPath);
            try {
                execFileSync(process.execPath, [path.join(__dirname, 'cli.js'), 'init', '-t', targetPath, '-n', projName],
                    { encoding: 'utf8', timeout: 60000 });
            } catch (err: any) {
                return `init failed: ${err.message}`;
            }
            integrationPath = path.join(targetPath, 'plexus-integration');

            // Registry + collision-free ports (shows up in the launcher dashboard)
            const entry = registerProject(targetPath, projName, 'genesis');
            try { patchManifestPorts(targetPath, entry.api_port, entry.ws_port); } catch { /* defaults stand */ }

            // The user's prompt IS the genesis brief
            const brief = [
                `# Genesis brief — ${projName}`,
                `created: ${new Date().toISOString()} (captured from the user's own words by the AI)`,
                '',
                '## The app, in the founder\'s words',
                String(args?.description || '').trim() || '(ask the user what they are imagining)',
                '',
                '## What must never go wrong (founder\'s risks)',
                String(args?.risks || '').trim() || '(none stated yet — worth asking)',
            ].join('\n');
            fs.writeFileSync(path.join(integrationPath, 'genesis-brief.md'), brief);

            // Install the enforcement cage BY DEFAULT — "register once, the AI
            // does everything" must include "…and is caged from commit zero".
            let caged = false;
            try {
                const { execFileSync } = require('child_process');
                execFileSync(process.execPath, [path.join(__dirname, 'cli.js'), 'harden', '-p', targetPath],
                    { encoding: 'utf8', timeout: 30000 });
                caged = true;
            } catch { /* cage is best-effort; consult incentives still apply */ }

            const booted = await ensureEngine();
            return [
                `⬡ ${projName} now has a brain (engine ${booted ? 'running' : 'created — will boot on first use'} · api :${entry.api_port} · 3D brain http://localhost:${entry.ws_port}).`,
                relocated
                    ? `NOTE — this session started in a broad folder, so the project was rooted at ${targetPath}. Do ALL work inside that folder (use absolute paths), and tell the user plainly: their project lives at ${targetPath}, and future AI sessions should be opened FROM that folder.`
                    : '',
                caged
                    ? 'The enforcement cage is installed: consult-before-edit is now MECHANICAL here — a PreToolUse hook blocks unconsulted source edits (it re-arms this session on your next SessionStart). Consult files before you edit them.'
                    : '',
                '',
                'NEXT, IN THIS CONVERSATION — no forms, no ceremony:',
                '1. Interview the user conversationally about whatever their description leaves',
                '   unclear (your checklist: decide / remember / see / sense / unattended /',
                '   run-on / feel / bridge / go-wrong). Ask only what is genuinely unclear.',
                '2. Seed the plan via update_graph: planned nodes (status "planned",',
                '   metadata.origin "seed", intended file_path). Region is OPTIONAL — the',
                '   librarian places every element. Connect the pieces with typed synapses:',
                '   the relationships ARE the meaning.',
                '3. declare_invariant for each stated risk.',
                '4. Then build. Begin your replies with "⬡ plexus active" so the human can',
                '   see the brain is engaged.',
            ].join('\n');
        }
        case 'session_open': {
            if (!hasBrain()) {
                return [
                    `No Plexus brain at ${targetPath} yet.`,
                    'If the user asks you to BUILD something here, call init_project with their',
                    'description (their prompt is the genesis brief) — the brain and engine come',
                    'up automatically and you seed the plan yourself. If they are just chatting,',
                    'no action needed.',
                ].join('\n');
            }
            const stats = await apiRequest('GET', '/api/viz/stats');
            const s = stats.data;
            let freshness = 'unknown';
            try {
                const fp = fs.statSync(path.join(integrationPath, 'fingerprints.json'));
                freshness = `last scan ${Math.round((Date.now() - fp.mtimeMs) / 3600000)}h ago`;
            } catch { freshness = 'never scanned'; }

            const lines = [
                `⬡ PLEXUS ACTIVE — ${path.basename(targetPath)}`,
                `graph: ${s.total_nodes} nodes · ${s.total_synapses} synapses · ${s.total_amygdala === 0 ? 'amygdala empty (no incidents yet — healthy)' : s.total_amygdala + ' amygdala entries'} · ${freshness}`,
                `families: ${Object.entries(s.synapse_families || {}).map(([k, v]) => `${k}:${v}`).join(' ')}`,
            ];

            // Mis-resolution guard: you launched from a folder that looks like its own project
            // (${CWD}) yet the brain lives in a PARENT (${targetPath}). Don't silently pollute a
            // parent connectome with a child's work — surface it and let the user decide.
            if (parentMisresolveRisk) {
                lines.push(
                    '',
                    `⚠ RESOLVED FROM A PARENT — this brain is at ${targetPath}, but you started in ${CWD},`,
                    `which looks like its own project. If this work belongs to a SEPARATE project, STOP and tell`,
                    `the user: give ${CWD} its own brain (\`git init\` there + relaunch, or a pinned \`-p "${CWD}"\``,
                    `server) instead of adding it here. Only continue on this brain if ${path.basename(CWD)} is`,
                    `genuinely part of ${path.basename(targetPath)}.`);
            }

            // GENESIS HANDOFF: a fresh brain carrying a founder's brief means
            // the interview is THIS session's first job — the AI runs it
            // conversationally (its own checklist, not the user's form) and
            // seeds the connectome itself; the librarian places every element.
            try {
                const briefPath = path.join(integrationPath, 'genesis-brief.md');
                if (fs.existsSync(briefPath) && (s.total_nodes || 0) < 3) {
                    const brief = fs.readFileSync(briefPath, 'utf8');
                    lines.push(
                        '',
                        '━━ GENESIS — this brain is newborn and carries the founder\'s brief ━━',
                        brief.trim(),
                        '',
                        'YOUR FIRST JOB (before any code): digest the brief; ask the user',
                        'conversationally about whatever your checklist finds unclear (decide /',
                        'remember / see / sense / unattended / run-on / feel / bridge / go-wrong),');
                    lines.push(
                        'then seed the plan: update_graph with planned nodes (status "planned",',
                        'metadata.origin "seed", intended file_path) — region is OPTIONAL, the',
                        'librarian places elements — connect them with typed synapses (the',
                        'relationships ARE the meaning), and declare_invariant for each risk.');
                }
            } catch { /* brief optional */ }

            // Maturity + catch-up: a provisional brain says so, and ASKS the AI
            // the questions that fill in what no scanner can see.
            try {
                const u = await apiRequest('GET', '/api/regions/utilization');
                if (u.status === 200 && u.data) {
                    lines.push(`map: ${String(u.data.maturity).toUpperCase()} (utilization ${u.data.utilization_score})${u.data.maturity === 'provisional' ? ' — advisory only until enriched' : ''}`);
                    const planned = Object.entries(u.data.origin_mix || {}).find(([k]) => k === 'seed');
                    if (planned) lines.push(`seed/planned elements present — check plan conformance as you build`);
                    const qs = (u.data.enrichment_questions || []).slice(0, 4);
                    if (qs.length > 0) {
                        lines.push('', 'CATCH-UP — Plexus needs you to fill in what scanning cannot see:');
                        for (const q of qs) lines.push(`· ${q}`);
                        if ((u.data.enrichment_questions || []).length > 4) {
                            lines.push(`· (+${u.data.enrichment_questions.length - 4} more — GET /api/regions/utilization)`);
                        }
                    }
                }
            } catch { /* utilization optional */ }

            lines.push(
                '',
                'WORKING PROTOCOL (non-negotiable):',
                '1. claim_check every identifier you intend to rely on BEFORE writing code that uses it.',
                '2. consult the nodes/files you are about to change; read the amygdala and dormant sections.',
                '3. simulate_impact before non-trivial changes; respect the risk verdict.',
                '4. After changing code: update_graph with what you created; after any FAILED attempt: deposit_amygdala.',
                '5. Retire abandoned approaches with mark_dormant — never silently delete.',
            );
            return lines.join('\n');
        }
        case 'consult': {
            const r = await apiRequest('POST', '/api/consult', {
                query: args?.query, file_paths: args?.file_paths, node_ids: args?.node_ids, mode: args?.mode,
            });
            if (r.status !== 200) return `consult failed (${r.status}): ${JSON.stringify(r.data)}`;
            return r.data.markdown + `\n\n[consultation_id: ${r.data.consultation_id}]`;
        }
        case 'claim_check': {
            const r = await apiRequest('POST', '/api/claim-check', { identifiers: args?.identifiers || [] });
            if (r.status !== 200) return `claim-check failed (${r.status}): ${JSON.stringify(r.data)}`;
            const lines = r.data.results.map((x: any) => {
                const m = x.matches?.[0];
                const loc = m ? ` — ${m.file_path}${m.line_range ? ':' + m.line_range.start : ''}` : '';
                const extra = x.suggestion ? ` (suggestion: ${x.suggestion} — NOT a confirmation)` : x.note ? ` (${x.note})` : '';
                return `${x.status === 'exists' ? '✓' : x.status === 'missing' ? '✗' : '⚠'} ${x.identifier}: ${x.status}${loc}${extra}`;
            });
            return `CLAIM CHECK (${r.data.scope})\n` + lines.join('\n');
        }
        case 'simulate_impact': {
            const r = await apiRequest('POST', '/api/simulate/impact', {
                node_ids: args?.node_ids || [], change_type: args?.change_type || 'modify',
            });
            if (r.status !== 200) return `simulate failed (${r.status}): ${JSON.stringify(r.data)}`;
            const d = r.data;
            const top = d.blast_radius.slice(0, 15).map((b: any) =>
                `- [${b.impact_level}] ${b.node_name} (${b.region}, d${b.distance_from_source})`).join('\n');
            return `RISK ${d.risk_score.toFixed(2)} — ${d.recommendation}\naffected: ${d.total_affected}\n${top}${d.blast_radius.length > 15 ? `\n(+${d.blast_radius.length - 15} more)` : ''}`;
        }
        case 'search_nodes': {
            const r = await apiRequest('GET', `/api/nodes/search?q=${encodeURIComponent(args?.query || '')}`);
            if (r.status !== 200) return `search failed (${r.status})`;
            return (r.data as any[]).slice(0, 12)
                .map(n => `- ${n.name} [${n.type}, ${n.region}] ${n.file_path} (id: ${n.id})`)
                .join('\n') || 'no matches';
        }
        case 'deposit_amygdala': {
            const entry = {
                title: args?.title,
                severity: args?.severity,
                attempted_change: { description: args?.what_broke || '', nodes_touched: args?.nodes_touched || [], regions_affected: [] },
                failure_mode: { what_broke: args?.what_broke || '', cascade_path: [], error_messages: [], time_to_detect: '', blast_radius: 0 },
                lessons_learned: args?.lessons || [],
                prevention_rules: (args?.trigger_nodes?.length)
                    ? [{ trigger_nodes: args.trigger_nodes, warning_message: args?.warning_message || args?.title, auto_surface: true }]
                    : [],
            };
            const r = await apiRequest('POST', '/api/amygdala', entry);
            return r.status === 200
                ? `threat memory recorded: ${r.data.id} — future changes crossing the trigger nodes will be warned`
                : `deposit failed (${r.status}): ${JSON.stringify(r.data)}`;
        }
        case 'mark_dormant': {
            const r = await apiRequest('POST', `/api/nodes/${encodeURIComponent(args?.node_id || '')}/dormant`, { dormant_reason: args?.reason });
            return r.status === 200
                ? `node dormant (${r.data.deactivated_synapses} synapses ride along) — it will surface as "already tried" in future consultations`
                : `mark_dormant failed (${r.status}): ${JSON.stringify(r.data)}`;
        }
        case 'declare_invariant': {
            const r = await apiRequest('POST', '/api/invariants', {
                statement: args?.statement, node_ids: args?.node_ids, declared_by: 'llm',
            });
            return r.status === 200
                ? `invariant declared (${r.data.id}) — consultations touching its nodes will surface it`
                : `declare failed (${r.status}): ${JSON.stringify(r.data)}`;
        }
        case 'update_graph': {
            const out: string[] = [];
            for (const n of args?.nodes || []) {
                const withOrigin = { ...n, metadata: { origin: 'llm', ...(n.metadata || {}) } };
                const r = await apiRequest('POST', '/api/nodes', withOrigin);
                out.push(r.status === 200 ? `node ✓ ${r.data.name} (${r.data.id})` : `node ✗ ${n.name}: ${JSON.stringify(r.data?.details || r.data)}`);
            }
            for (const s of args?.synapses || []) {
                const r = await apiRequest('POST', '/api/synapses', s);
                out.push(r.status === 200 ? `synapse ✓ ${s.type} ${s.source_node_id}→${s.target_node_id}` : `synapse ✗: ${JSON.stringify(r.data?.details || r.data)}`);
            }
            return out.join('\n') || 'nothing to update';
        }
        default:
            return `unknown tool: ${name}`;
    }
}

// ─── JSON-RPC 2.0 over stdio (newline-delimited) ──────────────────────────────

function send(msg: any) {
    process.stdout.write(JSON.stringify(msg) + '\n');
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) handleMessage(line);
    }
});

async function handleMessage(line: string) {
    let msg: any;
    try { msg = JSON.parse(line); } catch { return; }
    const { id, method, params } = msg;
    if (method === 'initialize') {
        // Version negotiation: echo the client's version only if we actually
        // support it; otherwise answer with our latest supported version
        // (per spec — blindly echoing asserts support for anything).
        const SUPPORTED = ['2024-11-05', '2025-03-26', '2025-06-18'];
        const requested = params?.protocolVersion;
        send({
            jsonrpc: '2.0', id,
            result: {
                protocolVersion: SUPPORTED.includes(requested) ? requested : '2025-06-18',
                capabilities: { tools: {} },
                serverInfo: { name: 'plexus', version: '1.0.0' },
                instructions:
                    'Plexus is the project\'s connectome brain — the evidence layer that prevents hallucinated APIs and repeated failures. Call session_open FIRST in every session. If the user asks to build something and no brain exists, call init_project with their own description — the brain and engine come up automatically. Before ANY code change: claim_check the identifiers you rely on, consult the targets, simulate_impact. After changes: update_graph; after failures: deposit_amygdala. REASSURANCE CONVENTION: begin replies with "⬡ plexus active" while the brain is engaged, so the human can see it without ever touching Plexus.',
            },
        });
    } else if (method === 'notifications/initialized' || (method || '').startsWith('notifications/')) {
        // notifications require no response
    } else if (method === 'ping') {
        send({ jsonrpc: '2.0', id, result: {} });
    } else if (method === 'tools/list') {
        send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
        pending++;
        try {
            const text = await callTool(params?.name, params?.arguments || {});
            send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
        } catch (err: any) {
            const text = /ECONNREFUSED|timeout/i.test(String(err?.message)) ? ENGINE_DOWN_HINT : `error: ${err?.message}`;
            send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: true } });
        } finally {
            pending--;
            maybeExit();
        }
    } else if (id !== undefined) {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
    }
}

// Graceful drain: stdin closing must not kill in-flight tool calls.
let pending = 0;
let stdinClosed = false;
function maybeExit() {
    if (stdinClosed && pending === 0) process.exit(0);
}
process.stdin.on('end', () => {
    stdinClosed = true;
    maybeExit();
});
