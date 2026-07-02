#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { CodeAnalyzer } from './analyzer';
import { initDb } from './db/sqlite';
import { graph } from './core/graph';
import { setContext, setManifest } from './core/context';
import { PlexusManifest } from './types';

const program = new Command();
program.name('plexus').description('Plexus Neural Connectome CLI').version('1.0.0');

program
    .command('init')
    .description('Initialize Plexus for a target application')
    .requiredOption('-t, --target <path>', 'Target application directory path')
    .option('-n, --name <name>', 'Application name')
    .action((options: any) => {
        const targetPath = path.resolve(options.target);
        const integrationPath = path.join(targetPath, 'plexus-integration');

        if (!fs.existsSync(targetPath)) {
            console.error(`Target path ${targetPath} does not exist.`);
            process.exit(1);
        }

        fs.mkdirSync(integrationPath, { recursive: true });
        fs.mkdirSync(path.join(integrationPath, 'impact-reports'), { recursive: true });
        fs.mkdirSync(path.join(integrationPath, 'snapshots'), { recursive: true });

        const manifest: PlexusManifest = {
            plexus_version: "1.0.0",
            target_app: {
                name: options.name || path.basename(targetPath),
                root_path: targetPath,
                languages: ["typescript", "javascript", "css", "json"],
                frameworks: ["next.js", "react", "tailwind"],
                entry_points: ["src/app/layout.tsx", "src/app/page.tsx"],
                ignore_patterns: ["node_modules", ".next", ".git", "dist", "coverage", "*.test.*", "plexus-integration"]
            },
            server: { api_port: 3200, ws_port: 3201, host: "localhost" },
            analysis: { auto_analyze_on_start: true, watch_for_changes: true, depth: "maximum", include_tests: true, include_configs: true },
            visualization: { theme: "dark", background_color: "#0A0A0F", enable_bloom: true, enable_fog: true, enable_audio: false, default_camera_position: { x: 0, y: 50, z: 100 } },
            regions: {
                custom_overrides: {},
                // Taxonomy v2 (REGION_TAXONOMY.md §4.12): no blanket src/app →
                // parietal (route.ts vs page.tsx differ per FILE, handled by
                // path patterns); no utils/lib → cerebellum (helpers classify
                // by their own behavior); no types → corpus_callosum (CC is
                // earned by contract promotion, never assigned by path).
                classification_hints: {
                    'src/components': 'occipital_lobe',
                    'src/hooks': 'frontal_lobe',
                    'src/store': 'frontal_lobe',
                    'src/api': 'parietal_lobe',
                    'src/middleware': 'brain_stem',
                    'src/auth': 'brain_stem',
                    'src/config': 'brain_stem',
                    'src/db': 'temporal_lobe',
                    'src/models': 'temporal_lobe',
                    'src/styles': 'occipital_lobe',
                    'prisma': 'temporal_lobe',
                    'public': 'occipital_lobe',
                }
            }
        };

        fs.writeFileSync(path.join(integrationPath, 'plexus-manifest.json'), JSON.stringify(manifest, null, 2));
        fs.writeFileSync(path.join(integrationPath, 'plexus-commands.json'), JSON.stringify({ commands: [] }, null, 2));
        fs.writeFileSync(path.join(integrationPath, 'amygdala-log.json'), JSON.stringify([], null, 2));

        console.log(`Plexus Integration created at ${integrationPath}`);
    });

program
    .command('analyze')
    .description('Run full codebase analysis and populate connectome')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const integrationPath = path.join(targetPath, 'plexus-integration');

        if (!fs.existsSync(integrationPath)) {
            console.error('Integration not found. Run "plexus init" first.');
            process.exit(1);
        }

        setContext(integrationPath, targetPath);

        // Load manifest
        const manifestPath = path.join(integrationPath, 'plexus-manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            setManifest(manifest);
        }

        initDb(integrationPath);
        graph.loadFromDb();

        console.log(`Starting analysis on ${targetPath}...`);
        const analyzer = new CodeAnalyzer(targetPath);
        analyzer.analyze();
        graph.flushToDisk();

        console.log(`Analysis complete. Connectome populated.`);
    });

// ─── Evidence Protocol 0.5: git chokepoint (warn-only) ────────────────────────

program
    .command('hook-check')
    .description('Warn about staged files that were never consulted (pre-commit; always exits 0)')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .option('-w, --window <hours>', 'Consultation freshness window in hours', '8')
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const integrationPath = path.join(targetPath, 'plexus-integration');
        if (!fs.existsSync(integrationPath)) return; // Plexus not set up — never block

        try {
            setContext(integrationPath, targetPath);
            initDb(integrationPath);
            graph.loadFromDb();

            // --relative: emit paths relative to targetPath, not the repo root —
            // without it every monorepo staged path permanently mismatches the
            // target-relative consultation paths.
            const staged = execSync('git diff --cached --name-only --relative', { cwd: targetPath })
                .toString().split('\n').map(s => s.trim()).filter(Boolean)
                .filter(f => !f.startsWith('plexus-integration/'));
            if (staged.length === 0) return;

            const windowHours = parseFloat(options.window) || 8;
            const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
            // Late import keeps CLI startup cheap for other commands
            const { getConsultationsSince } = require('./core/session');
            const consultations = getConsultationsSince(since);

            // Everything consulted recently: explicit file paths + the files of
            // every consulted node id.
            const consultedFiles = new Set<string>();
            for (const c of consultations) {
                for (const fp of c.file_paths) consultedFiles.add(fp.replace(/^\.?\//, ''));
                for (const id of c.node_ids) {
                    const node = graph.nodes.get(id);
                    if (node) consultedFiles.add(node.file_path.replace(/^\.?\//, ''));
                }
            }

            const unconsulted = staged.filter(f => !consultedFiles.has(f.replace(/^\.?\//, '')));
            if (unconsulted.length > 0) {
                console.warn('');
                console.warn('⬡ PLEXUS — unconsulted changes (warn-only):');
                for (const f of unconsulted) console.warn(`   · ${f}`);
                console.warn(`   ${unconsulted.length}/${staged.length} staged file(s) had no consultation in the last ${windowHours}h.`);
                console.warn('   Consult before changing: POST /api/consult {"file_paths":[...]} — or claim-check the symbols you rely on.');
                console.warn('');
            }
        } catch {
            // The hook must never break a commit — warn-only by design.
        }
        process.exit(0);
    });

program
    .command('hook-install')
    .description('Install the warn-only pre-commit consultation check into .git/hooks')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .option('-f, --force', 'Overwrite an existing pre-commit hook')
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const hooksDir = path.join(targetPath, '.git', 'hooks');
        if (!fs.existsSync(hooksDir)) {
            console.error('No .git/hooks directory — is this a git repository?');
            process.exit(1);
        }
        const hookPath = path.join(hooksDir, 'pre-commit');
        if (fs.existsSync(hookPath) && !options.force) {
            console.error('A pre-commit hook already exists. Re-run with --force to overwrite, or add this line to it:');
            console.error(`  node "${path.join(__dirname, 'cli.js')}" hook-check -p "${targetPath}"`);
            process.exit(1);
        }
        const script = `#!/bin/sh
# Plexus Evidence Protocol — warn-only consultation check (never blocks)
node "${path.join(__dirname, 'cli.js')}" hook-check -p "${targetPath}"
exit 0
`;
        fs.writeFileSync(hookPath, script, { mode: 0o755 });
        console.log(`Installed warn-only pre-commit hook at ${hookPath}`);
    });

// ─── Evidence Protocol 1.1: the MCP plug ──────────────────────────────────────

program
    .command('mcp')
    .description('Run the Plexus MCP server over stdio (the plug for Claude Code / Cursor / any MCP client)')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .action((options: any) => {
        process.argv = [process.argv[0], process.argv[1], '-p', path.resolve(options.path)];
        require('./mcp');
    });

program
    .command('rules')
    .description('Print the session-start rules snippet (CLAUDE.md / .cursorrules) and MCP registration command')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const cliPath = path.join(__dirname, 'cli.js');
        console.log(`# ⬡ Plexus — Evidence Protocol (add to CLAUDE.md / .cursorrules)

This project has a Plexus connectome brain. It exists to keep you grounded:
never assert an identifier the graph can't confirm, never repeat a recorded
failure, never change code blind to its blast radius.

MANDATORY WORKFLOW — every session, before any code:
1. Call the \`session_open\` MCP tool (or GET /api/session + /api/viz/stats).
2. Before writing code that uses ANY function/component/endpoint/env var:
   \`claim_check\` it. "missing" means it does not exist — do not invent it.
3. Before changing a file: \`consult\` it. Read the AMYGDALA (this failed
   before) and DORMANT (we already tried that) sections and respect them.
4. Before non-trivial changes: \`simulate_impact\`; respect the risk verdict.
5. After changing code: \`update_graph\` with what you created.
6. After every FAILED fix attempt: \`deposit_amygdala\` (title, severity,
   what broke, trigger nodes). Abandoned approaches: \`mark_dormant\`.

Register the MCP server (Claude Code):
  claude mcp add plexus -- node "${cliPath}" mcp -p "${targetPath}"

Engine not running? Start it:  plexus serve -p "${targetPath}"
Install the commit guard:      plexus hook-install -p "${targetPath}"
`);
    });

// ─── Evidence Protocol 1.7: git-history mining (proposals ONLY) ───────────────

program
    .command('mine')
    .description('Mine git history for failure signals → plexus-proposals.json (proposals only; never auto-creates memory)')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .option('-n, --commits <n>', 'How many commits to scan', '500')
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const integrationPath = path.join(targetPath, 'plexus-integration');
        if (!fs.existsSync(integrationPath)) {
            console.error('Integration not found. Run "plexus init" first.');
            process.exit(1);
        }
        let log = '';
        try {
            log = execSync(
                `git log --pretty=format:'§%H|%s' --name-only -n ${parseInt(options.commits, 10) || 500}`,
                { cwd: targetPath, maxBuffer: 32 * 1024 * 1024 }
            ).toString();
        } catch (e: any) {
            console.error('git log failed:', e.message);
            process.exit(1);
        }

        interface Commit { hash: string; subject: string; files: string[] }
        const commits: Commit[] = [];
        let current: Commit | null = null;
        for (const line of log.split('\n')) {
            if (line.startsWith('§')) {
                const [hash, ...rest] = line.slice(1).split('|');
                current = { hash, subject: rest.join('|'), files: [] };
                commits.push(current);
            } else if (line.trim() && current) {
                current.files.push(line.trim());
            }
        }

        const proposals: any[] = [];

        // Tier 1 (highest precision): reverts — something was tried and undone
        for (const c of commits) {
            if (/^revert\b|\brevert(s|ed|ing)?\b/i.test(c.subject)) {
                proposals.push({
                    kind: 'revert', confidence: 'medium', origin: 'mined',
                    title: c.subject.slice(0, 120), commit: c.hash.slice(0, 10),
                    files: c.files.slice(0, 10),
                    suggested_action: 'confirm into an amygdala entry: what was reverted and why',
                });
            }
        }

        // Tier 2: fix clusters — files that keep needing fixes
        const fixCounts = new Map<string, { count: number; subjects: string[] }>();
        for (const c of commits) {
            if (/\b(fix|bug|hotfix|patch)\b/i.test(c.subject)) {
                for (const f of c.files) {
                    const e = fixCounts.get(f) || { count: 0, subjects: [] };
                    e.count++;
                    if (e.subjects.length < 3) e.subjects.push(c.subject.slice(0, 80));
                    fixCounts.set(f, e);
                }
            }
        }
        for (const [file, e] of [...fixCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 20)) {
            if (e.count >= 3) {
                proposals.push({
                    kind: 'fix_cluster', confidence: 'low', origin: 'mined',
                    file, fix_commits: e.count, sample_subjects: e.subjects,
                    suggested_action: 'repeated fixes suggest an unstable node — consider an amygdala entry or lowered stability',
                });
            }
        }

        // Tier 3 (Phase 2.1 substrate): co-change pairs — evidence for learned
        // CO_FAILED_WITH / strength updates. Proposals only.
        const pairCounts = new Map<string, number>();
        for (const c of commits) {
            const fs_ = c.files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f)).slice(0, 12);
            for (let i = 0; i < fs_.length; i++) {
                for (let j = i + 1; j < fs_.length; j++) {
                    const key = [fs_[i], fs_[j]].sort().join(' ⇄ ');
                    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
                }
            }
        }
        for (const [pair, count] of [...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
            if (count >= 5) {
                proposals.push({
                    kind: 'co_change', confidence: 'low', origin: 'mined',
                    files: pair.split(' ⇄ '), co_change_count: count,
                    suggested_action: 'strong co-change evidence — candidate for a learned synapse / strength boost between their nodes',
                });
            }
        }

        const outPath = path.join(integrationPath, 'plexus-proposals.json');
        fs.writeFileSync(outPath, JSON.stringify({
            generated_at: new Date().toISOString(),
            commits_scanned: commits.length,
            note: 'PROPOSALS ONLY — mined signals are belief facts. Confirm explicitly (LLM or human) before anything enters the amygdala or the graph. Mining never auto-creates memory.',
            proposals,
        }, null, 2));
        console.log(`Mined ${commits.length} commits → ${proposals.length} proposals (${outPath})`);
        for (const p of proposals.slice(0, 8)) {
            console.log(` · [${p.kind}] ${p.title || p.file || (p.files || []).join(' ⇄ ')}`);
        }
    });

program
    .command('serve')
    .description('Start the Plexus API and Visualization servers')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        console.log(`Booting server for ${targetPath}...`);
        // Use spawn (not execSync) so the server process isn't killed when the parent exits
        const child = require('child_process').spawn(
            process.execPath,
            [path.join(__dirname, 'index.js'), targetPath],
            { stdio: 'inherit' }
        );
        child.on('exit', (code: number | null) => process.exit(code ?? 1));
        // Forward signals to the child so graceful shutdown works
        for (const sig of ['SIGTERM', 'SIGINT'] as const) {
            process.on(sig, () => child.kill(sig));
        }
    });

program.parse(process.argv);
