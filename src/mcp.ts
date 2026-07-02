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

const argv = process.argv.slice(2);
const pIdx = Math.max(argv.indexOf('-p'), argv.indexOf('--path'));
const targetPath = path.resolve(pIdx >= 0 ? argv[pIdx + 1] : process.cwd());
const integrationPath = path.join(targetPath, 'plexus-integration');

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
        description: 'Open a Plexus session: graph stats, freshness, and the working protocol. Call this FIRST, before reading or writing any code.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
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
    switch (name) {
        case 'session_open': {
            const stats = await apiRequest('GET', '/api/viz/stats');
            const s = stats.data;
            let freshness = 'unknown';
            try {
                const fp = fs.statSync(path.join(integrationPath, 'fingerprints.json'));
                freshness = `last scan ${Math.round((Date.now() - fp.mtimeMs) / 3600000)}h ago`;
            } catch { freshness = 'never scanned'; }
            return [
                `⬡ PLEXUS ACTIVE — ${path.basename(targetPath)}`,
                `graph: ${s.total_nodes} nodes · ${s.total_synapses} synapses · ${s.total_amygdala === 0 ? 'amygdala empty (no incidents yet — healthy)' : s.total_amygdala + ' amygdala entries'} · ${freshness}`,
                `families: ${Object.entries(s.synapse_families || {}).map(([k, v]) => `${k}:${v}`).join(' ')}`,
                '',
                'WORKING PROTOCOL (non-negotiable):',
                '1. claim_check every identifier you intend to rely on BEFORE writing code that uses it.',
                '2. consult the nodes/files you are about to change; read the amygdala and dormant sections.',
                '3. simulate_impact before non-trivial changes; respect the risk verdict.',
                '4. After changing code: update_graph with what you created; after any FAILED attempt: deposit_amygdala.',
                '5. Retire abandoned approaches with mark_dormant — never silently delete.',
            ].join('\n');
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
        send({
            jsonrpc: '2.0', id,
            result: {
                protocolVersion: params?.protocolVersion || '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'plexus', version: '1.0.0' },
                instructions:
                    'Plexus is this project\'s connectome brain — the evidence layer that prevents hallucinated APIs and repeated failures. Call session_open first. Before ANY code change: claim_check the identifiers you rely on, consult the targets, simulate_impact. After changes: update_graph; after failures: deposit_amygdala.',
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
