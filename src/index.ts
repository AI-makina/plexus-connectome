import { app, setAnalyzerRef } from './api/server';
import { initDb } from './db/sqlite';
import { graph } from './core/graph';
import { setContext, setManifest } from './core/context';
import { CodeAnalyzer } from './analyzer';
import { ImpactSimulator } from './core/simulator';
import { PlexusManifest } from './types';
import { initSession, isAuthDisabled } from './core/session';
import { validateCommand, validateAndBuildNode, validateAndBuildSynapse, validateAndBuildAmygdala, validateNodeInput, validateSynapseInput } from './core/validate';
import fs from 'fs';
import path from 'path';
import express from 'express';
import open from 'open';

const targetAppPath = process.argv[2] || process.cwd();
const integrationPath = path.join(targetAppPath, 'plexus-integration');

// 1. Set context (available everywhere via import)
setContext(integrationPath, targetAppPath);

// 2. Load manifest
const manifestPath = path.join(integrationPath, 'plexus-manifest.json');
let manifest: PlexusManifest | null = null;
if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    setManifest(manifest!);
}

// Read ports from manifest first, then env, then defaults
// This allows multiple Plexus instances to run on different ports per project
const PORT = manifest?.server?.api_port || parseInt(process.env.PLEXUS_PORT || '', 10) || 3200;
const UI_PORT_FROM_MANIFEST = manifest?.server?.ws_port || parseInt(process.env.PLEXUS_UI_PORT || '', 10) || 3201;

// 3. Init DB
initDb(integrationPath);

// 4. Load Graph
graph.loadFromDb();

// 5. Load simulation history
const simulator = new ImpactSimulator();
simulator.loadHistory();

// 6. Wire up analyzer for API
const analyzer = new CodeAnalyzer(targetAppPath);
setAnalyzerRef(analyzer);

// 6.5 Session: per-boot capability token (plexus-integration/session-token)
const sessionToken = initSession(integrationPath);
if (isAuthDisabled()) {
    console.warn('[Plexus Engine] ⚠ PLEXUS_NO_AUTH=1 — write authentication is DISABLED');
} else {
    console.log(`[Plexus Engine] Session token written to plexus-integration/session-token (${sessionToken.slice(0, 8)}…)`);
}

// 7. Command Processor — Evidence Protocol 0.1 hardening:
//    · every command is schema-validated + policy-checked BEFORE any mutation
//    · failures are quarantined to plexus-commands-failed.json instead of
//      permanently re-running (a malformed log_amygdala used to become a
//      poison command that crashed state writes until restart)
//    · one bad command never blocks the rest of the batch
const commandsFile = path.join(integrationPath, 'plexus-commands.json');
const failedCommandsFile = path.join(integrationPath, 'plexus-commands-failed.json');
let processingCommands = false;

function applyCommand(action: string, data: any): { ok: boolean; errors?: string[] } {
    switch (action) {
        case 'add_node': {
            const v = validateAndBuildNode(data, 'command');
            if (!v.ok) return { ok: false, errors: v.errors };
            graph.addNode(v.value);
            return { ok: true };
        }
        case 'add_synapse': {
            const v = validateAndBuildSynapse(data);
            if (!v.ok) return { ok: false, errors: v.errors };
            graph.addSynapse(v.value);
            return { ok: true };
        }
        case 'log_amygdala': {
            const v = validateAndBuildAmygdala(data);
            if (!v.ok) return { ok: false, errors: v.errors };
            graph.addAmygdalaEntry(v.value);
            return { ok: true };
        }
        case 'update_node': {
            const existing = graph.nodes.get(data.id);
            if (!existing) return { ok: false, errors: [`node '${data.id}' not found`] };
            const v = validateNodeInput(data, { partial: true, existingRegion: existing.region });
            if (!v.ok) return { ok: false, errors: v.errors };
            return graph.updateNode(data.id, data) ? { ok: true } : { ok: false, errors: [`node '${data.id}' not found`] };
        }
        case 'delete_node':
            return graph.deleteNode(data.id) ? { ok: true } : { ok: false, errors: [`node '${data.id}' not found`] };
        case 'update_synapse': {
            const v = validateSynapseInput(data, { partial: true });
            if (!v.ok) return { ok: false, errors: v.errors };
            return graph.updateSynapse(data.id, data) ? { ok: true } : { ok: false, errors: [`synapse '${data.id}' not found`] };
        }
        case 'delete_synapse':
            return graph.deleteSynapse(data.id) ? { ok: true } : { ok: false, errors: [`synapse '${data.id}' not found`] };
        default:
            return { ok: false, errors: [`unknown action '${action}'`] };
    }
}

function processCommands() {
    if (!fs.existsSync(commandsFile) || processingCommands) return;
    processingCommands = true;
    try {
        const raw = fs.readFileSync(commandsFile, 'utf8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.commands) && data.commands.length > 0) {
            console.log(`Processing ${data.commands.length} commands...`);
            const failures: any[] = [];

            for (const cmd of data.commands) {
                const shape = validateCommand(cmd);
                if (!shape.ok) {
                    failures.push({ command: cmd, errors: shape.errors, failed_at: new Date().toISOString() });
                    continue;
                }
                try {
                    const applied = applyCommand(shape.value.action, shape.value.data);
                    if (!applied.ok) {
                        failures.push({ command: cmd, errors: applied.errors, failed_at: new Date().toISOString() });
                    }
                } catch (err: any) {
                    failures.push({ command: cmd, errors: [err.message], failed_at: new Date().toISOString() });
                }
            }

            // Always clear the queue — failures move to the quarantine file so
            // they can be inspected/fixed without blocking future commands.
            fs.writeFileSync(commandsFile, JSON.stringify({ commands: [] }, null, 2));
            if (failures.length > 0) {
                let existing: any[] = [];
                try {
                    const prev = JSON.parse(fs.readFileSync(failedCommandsFile, 'utf8'));
                    if (Array.isArray(prev)) existing = prev;
                } catch { /* no quarantine file yet */ }
                fs.writeFileSync(failedCommandsFile, JSON.stringify([...existing, ...failures], null, 2));
                console.warn(`[Plexus Engine] ⚠ ${failures.length} command(s) rejected → plexus-commands-failed.json`);
            }
        }
    } catch (err) {
        console.error('Error processing commands:', err);
    } finally {
        processingCommands = false;
    }
}

// Ensure files exist
if (!fs.existsSync(integrationPath)) {
    fs.mkdirSync(integrationPath, { recursive: true });
}
if (!fs.existsSync(commandsFile)) {
    fs.writeFileSync(commandsFile, JSON.stringify({ commands: [] }, null, 2));
}

// Save initial state
graph.flushToDisk();

// Watch the commands file
fs.watch(commandsFile, (eventType) => {
    if (eventType === 'change') {
        setTimeout(processCommands, 50);
    }
});

// 7.5 Drift absorption (Evidence Protocol §4, librarian diff-watcher v0):
// out-of-band edits — human hand-edits, other tools, brand-new files — are
// DETECTED and ABSORBED by re-deriving map facts, never punished. Fingerprint
// sweep instead of fs events: event watchers proved unreliable for newly
// created directories on macOS sandboxes, and a dependable tool prefers a
// slower guarantee over a faster maybe. The sweep uses the same fingerprint
// store /api/verify reads, so reconciliation is automatic and uniform for
// adds, changes, AND deletions.
if (manifest?.analysis?.watch_for_changes !== false) {
    let sweeping = false;
    setInterval(() => {
        if (sweeping) return;
        sweeping = true;
        try {
            analyzer.analyzeIncremental();
        } catch (err: any) {
            console.warn('[Plexus Engine] drift sweep failed:', err.message);
        } finally {
            sweeping = false;
        }
    }, 5000);
    console.log('[Plexus Engine] Drift sweep active (5s fingerprint diff — out-of-band edits are absorbed automatically)');
}

// Bind both servers. Wrapped so a self-restart (POST /api/engine/restart) can pass
// PLEXUS_BOOT_DELAY_MS to the replacement child, which waits before binding so the
// exiting parent releases the ports first — a clean handoff, no EADDRINUSE.
function startServers() {
    // Backend — 127.0.0.1 ONLY. The previous 0.0.0.0 bind exposed an
    // unauthenticated graph-mutation API to the entire LAN.
    app.listen(PORT as number, '127.0.0.1', () => {
        console.log(`[Plexus Engine] API Server running on port ${PORT}`);
        console.log(`[Plexus Engine] Integration Path: ${integrationPath}`);
    });

    // UI Server
    const uiApp = express();
    const uiPath = path.join(__dirname, '../ui/dist');
    const UI_PORT = UI_PORT_FROM_MANIFEST;

    // Force browser to never cache the UI bundle while we debug
    uiApp.use((req, res, next) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        next();
    });

    uiApp.use(express.static(uiPath));
    uiApp.use((_req, res) => res.sendFile(path.join(uiPath, 'index.html')));

    uiApp.listen(UI_PORT as number, '127.0.0.1', () => {
        console.log(`[Plexus Engine] UI Server running on port ${UI_PORT}`);
        // Only auto-open browser if not launched by a parent process (e.g., Areopagus)
        if (!process.env.PLEXUS_NO_OPEN) {
            open(`http://localhost:${UI_PORT}`);
        }
    });
}

const bootDelay = parseInt(process.env.PLEXUS_BOOT_DELAY_MS || '0', 10);
if (bootDelay > 0) {
    console.log(`[Plexus Engine] Restart handoff — waiting ${bootDelay}ms for the previous process to release ports…`);
    setTimeout(startServers, bootDelay);
} else {
    startServers();
}
