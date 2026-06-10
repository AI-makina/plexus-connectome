import { app, setAnalyzerRef } from './api/server';
import { initDb } from './db/sqlite';
import { graph } from './core/graph';
import { setContext, setManifest } from './core/context';
import { CodeAnalyzer } from './analyzer';
import { ImpactSimulator } from './core/simulator';
import { PlexusManifest } from './types';
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

// 7. Command Processor
const commandsFile = path.join(integrationPath, 'plexus-commands.json');
function processCommands() {
    if (!fs.existsSync(commandsFile)) return;
    try {
        const raw = fs.readFileSync(commandsFile, 'utf8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.commands) && data.commands.length > 0) {
            console.log(`Processing ${data.commands.length} commands...`);
            for (const cmd of data.commands) {
                if (cmd.action === 'add_node') graph.addNode(cmd.data);
                if (cmd.action === 'add_synapse') graph.addSynapse(cmd.data);
                if (cmd.action === 'log_amygdala') graph.addAmygdalaEntry(cmd.data);
                if (cmd.action === 'update_node') graph.updateNode(cmd.data.id, cmd.data);
                if (cmd.action === 'delete_node') graph.deleteNode(cmd.data.id);
                if (cmd.action === 'update_synapse') graph.updateSynapse(cmd.data.id, cmd.data);
                if (cmd.action === 'delete_synapse') graph.deleteSynapse(cmd.data.id);
            }
            fs.writeFileSync(commandsFile, JSON.stringify({ commands: [] }, null, 2));
        }
    } catch (err) {
        console.error('Error processing commands:', err);
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

// Start Backend Server
app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`[Plexus Engine] API Server running on port ${PORT}`);
    console.log(`[Plexus Engine] Integration Path: ${integrationPath}`);
});

// Start UI Server
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

uiApp.listen(UI_PORT as number, '0.0.0.0', () => {
    console.log(`[Plexus Engine] UI Server running on port ${UI_PORT}`);
    // Only auto-open browser if not launched by a parent process (e.g., Areopagus)
    if (!process.env.PLEXUS_NO_OPEN) {
        open(`http://localhost:${UI_PORT}`);
    }
});
