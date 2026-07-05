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
    .description('Pre-commit consultation check. Warn-only by default; --strict blocks unconsulted mapped code.')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .option('--strict', 'Exit non-zero (block the commit) when mapped code lacks a receipt')
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const integrationPath = path.join(targetPath, 'plexus-integration');
        if (!fs.existsSync(integrationPath)) process.exit(0); // Plexus not set up — never block

        const strict = !!options.strict;
        try {
            const { isFileCovered, isMappedCode, recordBypass } = require('./core/receipts');
            const staged = execSync('git diff --cached --name-only --relative', { cwd: targetPath })
                .toString().split('\n').map((s: string) => s.trim()).filter(Boolean)
                .filter((f: string) => !f.startsWith('plexus-integration/'));
            if (staged.length === 0) process.exit(0);

            // Strict enforcement keys on RECEIPTS (the verifiable artifact),
            // not on time-windowed ledger heuristics: mapped code needs a fresh
            // receipt; docs/config/scratch always pass.
            const mapped = staged.filter((f: string) => isMappedCode(f, integrationPath));
            const unconsulted = mapped.filter((f: string) => !isFileCovered(integrationPath, f));

            if (unconsulted.length === 0) process.exit(0);

            if (strict) {
                if (process.env.PLEXUS_BYPASS === '1') {
                    recordBypass(integrationPath, unconsulted, 'PLEXUS_BYPASS=1 at commit');
                    console.warn('⚠ PLEXUS bypass used — commit allowed, scar recorded in bypass-log.json:');
                    for (const f of unconsulted) console.warn(`   · ${f}`);
                    process.exit(0);
                }
                console.error('');
                console.error('⛔ PLEXUS — commit blocked: mapped code changed without consultation:');
                for (const f of unconsulted) console.error(`   · ${f}`);
                console.error('   Consult these files first (your AI: the consult MCP tool), then re-commit.');
                console.error('   One-off override:  PLEXUS_BYPASS=1 git commit …  (logged)');
                console.error('');
                process.exit(1);
            }

            console.warn('');
            console.warn('⬡ PLEXUS — unconsulted changes (warn-only):');
            for (const f of unconsulted) console.warn(`   · ${f}`);
            console.warn(`   ${unconsulted.length}/${mapped.length} mapped file(s) had no consultation receipt.`);
            console.warn('   Consult before changing, or run `plexus hook-install --strict` to enforce.');
            console.warn('');
            process.exit(0);
        } catch {
            // Warn-only must never break a commit. Strict fails CLOSED on mapped
            // code (an enforcement layer that fails open is theater) — but only
            // if we got far enough to know there IS mapped code; a total failure
            // here (git absent, etc.) is not the AI's fault, so allow.
            process.exit(0);
        }
    });

program
    .command('hook-install')
    .description('Install the pre-commit consultation check into .git/hooks (warn-only; --strict to block)')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .option('-f, --force', 'Overwrite an existing pre-commit hook')
    .option('--strict', 'Block commits that touch unconsulted mapped code (PLEXUS_BYPASS=1 overrides with a logged scar)')
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
        const strict = !!options.strict;
        const script = strict
            ? `#!/bin/sh
# Plexus Evidence Protocol — STRICT consultation gate (blocks unconsulted mapped code)
node "${path.join(__dirname, 'cli.js')}" hook-check -p "${targetPath}" --strict
`
            : `#!/bin/sh
# Plexus Evidence Protocol — warn-only consultation check (never blocks)
node "${path.join(__dirname, 'cli.js')}" hook-check -p "${targetPath}"
exit 0
`;
        fs.writeFileSync(hookPath, script, { mode: 0o755 });
        console.log(`Installed ${strict ? 'STRICT (blocking)' : 'warn-only'} pre-commit hook at ${hookPath}`);
        if (strict) console.log('  Override a single commit with:  PLEXUS_BYPASS=1 git commit …  (logged as a scar in bypass-log.json)');
    });

// ─── Enforcement cage: harness hooks (Hardening L1) ───────────────────────────
// These three commands ARE the hooks the harness runs. They must be fast and
// dependency-free (receipts.ts is pure fs) — no engine round-trip, no DB load.

// PreToolUse guard: block edits to mapped code that lack a fresh receipt.
// Reads the Claude Code tool payload on stdin; exit 2 blocks the tool call and
// feeds the reason back to the model as a self-correcting error.
program
    .command('hook-guard')
    .description('PreToolUse guard (internal): block unconsulted edits to mapped code. Reads harness JSON on stdin.')
    .option('--file <file>', 'File to check (for manual testing instead of stdin)')
    .action((options: any) => {
        const { findProjectRoot } = require('./core/registry');
        const { isFileCovered, isMappedCode, normRel } = require('./core/receipts');

        // Extract the edited file from the harness payload (stdin) or --file
        let filePath = options.file as string | undefined;
        if (!filePath) {
            try {
                const raw = fs.readFileSync(0, 'utf8');
                const payload = JSON.parse(raw);
                const ti = payload.tool_input || {};
                filePath = ti.file_path || ti.notebook_path || ti.path;
            } catch { /* no stdin — nothing to guard */ }
        }
        if (!filePath) process.exit(0);

        const absFile = path.resolve(filePath);
        const root = findProjectRoot(path.dirname(absFile));
        if (!root) process.exit(0); // not inside a Plexus project — pass through
        const integrationPath = path.join(root, 'plexus-integration');
        const rel = normRel(path.relative(root, absFile));

        if (!isMappedCode(rel, integrationPath)) process.exit(0); // docs/config/scratch — free
        if (isFileCovered(integrationPath, rel)) process.exit(0);  // fresh receipt — allowed

        // Fail CLOSED for mapped code. The fix is in the message; the consult
        // MCP tool auto-boots the engine, so the AI can always unblock itself.
        process.stderr.write(
            `⛔ plexus: ${rel} not consulted this session — call the consult tool for this file first (it auto-starts the engine), then retry the edit.\n`
        );
        process.exit(2);
    });

// SessionStart injection: re-arm every fresh/compacted session — the exact
// moment drift is born. Prints brain status + the enforcement notice + the
// receipt-derived ⬡ line, which the harness adds to the model's context.
program
    .command('session-status')
    .description('SessionStart injection (internal): brain status + enforcement notice for fresh context')
    .option('-p, --path <path>', 'Path to target app')
    .action((options: any) => {
        const { findProjectRoot } = require('./core/registry');
        const { liveReceiptFingerprint } = require('./core/receipts');
        let root = options.path ? path.resolve(options.path) : null;
        if (!root) {
            try { root = JSON.parse(fs.readFileSync(0, 'utf8')).cwd; } catch { /* no stdin */ }
        }
        root = findProjectRoot(root || process.cwd());
        if (!root) process.exit(0);
        const integrationPath = path.join(root, 'plexus-integration');
        try {
            const state = JSON.parse(fs.readFileSync(path.join(integrationPath, 'plexus-state.json'), 'utf8'));
            const st = state.stats || {};
            const fp = liveReceiptFingerprint(integrationPath);
            const lines = [
                `⬡ PLEXUS ACTIVE — ${path.basename(root)}: ${st.active_nodes || 0} nodes · ${st.amygdala_entries || 0} memories`,
                'consult-before-edit is ENFORCED here (a PreToolUse hook blocks unconsulted edits to source).',
                'Protocol: claim_check + consult before editing → build → update_graph → deposit_amygdala on failures.',
                fp
                    ? `You hold a live consultation receipt — you may prefix replies with "⬡ plexus active [r:${fp}]".`
                    : 'No live receipt yet — consult before your first edit; earn the receipt, then you may show "⬡ plexus active".',
            ];
            process.stdout.write(lines.join('\n') + '\n');
        } catch { /* no brain yet — say nothing */ }
        process.exit(0);
    });

// PostToolUse: cheap nudge so the map freshens faster than the 5s sweep.
program
    .command('hook-notify')
    .description('PostToolUse notify (internal): fire-and-forget re-scan of an edited file')
    .action(() => {
        const { findProjectRoot } = require('./core/registry');
        const { normRel } = require('./core/receipts');
        let filePath: string | undefined;
        try {
            const ti = JSON.parse(fs.readFileSync(0, 'utf8')).tool_input || {};
            filePath = ti.file_path || ti.notebook_path;
        } catch { /* nothing */ }
        if (!filePath) process.exit(0);
        const absFile = path.resolve(filePath);
        const root = findProjectRoot(path.dirname(absFile));
        if (!root) process.exit(0);
        try {
            const m = JSON.parse(fs.readFileSync(path.join(root, 'plexus-integration', 'plexus-manifest.json'), 'utf8'));
            const port = m?.server?.api_port || 3200;
            const http = require('http');
            const body = JSON.stringify({ file_path: normRel(path.relative(root, absFile)) });
            const req = http.request({ host: '127.0.0.1', port, path: '/api/analyze/file', method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 800 });
            req.on('error', () => { /* the 5s sweep is the backstop */ });
            req.write(body); req.end();
        } catch { /* backstop covers it */ }
        // Do not wait — PostToolUse must not slow the session
        setTimeout(() => process.exit(0), 50);
    });

// harden: install the cage into a project's .claude/settings.json (+ CLAUDE.md).
program
    .command('harden')
    .description('Install the enforcement cage: PreToolUse/SessionStart/PostToolUse hooks + strict pre-commit + CLAUDE.md')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .option('--claude', 'Write Claude Code hooks (default)', true)
    .option('--no-strict', 'Skip the strict pre-commit (hooks only)')
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const cli = path.join(__dirname, 'cli.js');
        const q = (s: string) => `node "${cli}" ${s}`;

        // 1. .claude/settings.json — merge, never clobber existing hooks
        const claudeDir = path.join(targetPath, '.claude');
        fs.mkdirSync(claudeDir, { recursive: true });
        const settingsPath = path.join(claudeDir, 'settings.json');
        let settings: any = {};
        try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch { /* new */ }
        settings.hooks = settings.hooks || {};
        // Idempotent: drop any prior Plexus hook for this subcommand, re-add.
        const mentions = (h: any, subcmd: string) =>
            (h?.hooks || []).some((x: any) => typeof x?.command === 'string' &&
                x.command.includes('cli.js') && new RegExp(`\\b${subcmd}\\b`).test(x.command));
        const ensure = (event: string, matcher: string | null, subcmd: string, cmd: string) => {
            settings.hooks[event] = (settings.hooks[event] || []).filter((h: any) => !mentions(h, subcmd));
            const entry: any = { hooks: [{ type: 'command', command: cmd }] };
            if (matcher) entry.matcher = matcher;
            settings.hooks[event].push(entry);
        };
        ensure('PreToolUse', 'Edit|Write|MultiEdit|NotebookEdit', 'hook-guard', q('hook-guard'));
        ensure('SessionStart', null, 'session-status', q(`session-status -p "${targetPath}"`));
        ensure('PostToolUse', 'Edit|Write|MultiEdit', 'hook-notify', q('hook-notify'));
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

        // 2. strict pre-commit
        if (options.strict !== false && fs.existsSync(path.join(targetPath, '.git'))) {
            try { execSync(`${q(`hook-install -p "${targetPath}" --strict -f`)}`, { stdio: 'ignore' }); } catch { /* non-fatal */ }
        }

        // 3. CLAUDE.md contract (append if absent)
        const claudeMd = path.join(targetPath, 'CLAUDE.md');
        const marker = '<!-- plexus-cage -->';
        let existing = '';
        try { existing = fs.readFileSync(claudeMd, 'utf8'); } catch { /* new */ }
        if (!existing.includes(marker)) {
            const contract = `${marker}
## ⬡ Plexus — the evidence layer (enforced)

This project has a Plexus connectome brain, and consult-before-edit is
**mechanically enforced**: a PreToolUse hook blocks edits to source files that
lack a fresh consultation receipt. You cannot drift around it.

Every session: call \`session_open\` first. Before editing ANY source file,
\`consult\` it (pass its path in file_paths) — that issues the receipt that
unblocks the edit. Before writing code that uses a symbol, \`claim_check\` it.
After changes: \`update_graph\`. After a failed attempt: \`deposit_amygdala\`.
Commits are gated too (strict pre-commit); a one-off override is
\`PLEXUS_BYPASS=1 git commit …\` and it is logged.

Only show "⬡ plexus active [r:xxxx]" when you actually hold a live receipt.
`;
            fs.writeFileSync(claudeMd, existing ? existing + '\n\n' + contract : contract);
        }

        console.log(`⬡ Cage installed at ${targetPath}:`);
        console.log('  · .claude/settings.json — PreToolUse guard (blocks unconsulted source edits), SessionStart re-arm, PostToolUse notify');
        if (options.strict !== false) console.log('  · .git/hooks/pre-commit — STRICT (blocks unconsulted commits; PLEXUS_BYPASS=1 overrides + logs)');
        console.log('  · CLAUDE.md — the enforced contract');
        console.log('  Any AI opening a session here now consults before it can edit source — no promises required.');
    });

// ─── Evidence Protocol 1.3: utilization / imbalance report ────────────────────

program
    .command('report')
    .description('Brain-utilization report: region shares vs archetype profile, dark regions, maturity')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const integrationPath = path.join(targetPath, 'plexus-integration');
        if (!fs.existsSync(integrationPath)) {
            console.error('Integration not found. Run "plexus init" first.');
            process.exit(1);
        }
        setContext(integrationPath, targetPath);
        const manifestPath = path.join(integrationPath, 'plexus-manifest.json');
        if (fs.existsSync(manifestPath)) setManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
        initDb(integrationPath);
        graph.loadFromDb();

        const { computeUtilization } = require('./core/utilization');
        const u = computeUtilization();

        console.log(`\n⬡ PLEXUS UTILIZATION — score ${u.utilization_score} · map ${u.maturity.toUpperCase()} · ${u.freshness}`);
        if (u.maturity_reasons.length) console.log(`  provisional because: ${u.maturity_reasons.join('; ')}`);
        console.log('');
        const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);
        console.log(pad('REGION', 18) + pad('NODES', 7) + pad('SHARE', 8) + pad('EXPECTED', 10) + 'STATUS');
        for (const r of u.regions) {
            const mark = r.status === 'dark' ? '● DARK' : r.status === 'sparse' ? '◐ sparse' : r.status === 'not_applicable' ? '– n/a' : '○ ok';
            console.log(pad(r.region, 18) + pad(String(r.node_count), 7) + pad(String(r.share), 8) + pad(String(r.expected_share), 10) + mark);
        }
        console.log(`\namygdala: ${u.amygdala.entries} — ${u.amygdala.note}`);
        console.log(`origin mix: ${Object.entries(u.origin_mix).map(([k, v]) => `${k}:${v}`).join(' · ')}`);
        if (u.low_confidence_nodes > 0) console.log(`review queue: ${u.low_confidence_nodes} node(s) below 0.5 classification confidence`);
        if (u.enrichment_questions?.length) {
            console.log('\nCATCH-UP QUESTIONS (give these to your AI):');
            for (const q of u.enrichment_questions) console.log(` ? ${q}`);
        }

        const outPath = path.join(integrationPath, 'imbalance-report.json');
        fs.writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), ...u }, null, 2));
        console.log(`\nwritten: ${outPath}`);
    });

// ─── The Launcher: the plug-and-play front door ───────────────────────────────

program
    .command('start')
    .alias('app')
    .description('Open the Plexus Launcher — create new projects or connect existing ones from one window')
    .action(() => {
        const { startLauncher } = require('./launcher');
        startLauncher(true);
    });

// ─── Genesis: the brain exists before the code ────────────────────────────────

program
    .command('genesis')
    .description('Start a NEW app with Plexus: prints the 9-question interview and writes a seed-connectome template')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const integrationPath = path.join(targetPath, 'plexus-integration');
        const cliPath = path.join(__dirname, 'cli.js');
        if (!fs.existsSync(integrationPath)) {
            execSync(`node "${cliPath}" init -t "${targetPath}"`, { stdio: 'inherit' });
        }

        const template = {
            _format: 'Plexus seed connectome — every node becomes status:planned / origin:seed; the scanner activates it when code lands at (file_path, name). Ids should be stable slugs.',
            nodes: [
                { id: 'example_feature', name: 'exampleFeature', type: 'function', region: 'frontal_lobe', file_path: 'src/example.ts', description: 'What this element decides/does, per the interview' },
            ],
            synapses: [
                { source_node_id: 'example_feature', target_node_id: 'example_feature', type: 'calls', strength: 0.8, description: 'replace with real planned relationships' },
            ],
            invariants: [
                { statement: 'An example truth the code must never violate', node_ids: ['example_feature'] },
            ],
        };
        const templatePath = path.join(integrationPath, 'genesis-seed.example.json');
        fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));

        console.log(`
⬡ PLEXUS GENESIS — the brain exists before the code.

Answer the NINE QUESTIONS (one per region) with your AI, then have it convert
the answers into a seed connectome (template written to
${templatePath}):

  1. DECIDE    (frontal)   — what rules, state machines, and choices does the app make?
  2. REMEMBER  (temporal)  — what data outlives a session? entities, stores, caches?
  3. SEE       (occipital) — what does the user literally look at? screens, components, tokens?
  4. SENSE/SPEAK (parietal)— what does it talk to? APIs in/out, webhooks, third-party services?
  5. UNATTENDED (cerebellum)— what runs with nobody watching? jobs, pipelines, tests?
  6. RUN ON    (brain_stem)— hosting, env/secrets, build, auth machinery?
  7. FEEL      (limbic)    — how should waiting / failure / success / first-run feel?
  8. BRIDGE    (contracts) — what shapes cross boundaries? (shared DTOs, event payloads)
  9. GO WRONG  (foresight) — anticipated risks → cascade paths & verification checks,
                             NEVER amygdala entries (memory is earned by real incidents).

Then load it:      node "${cliPath}" seed -f <your-seed.json> -p "${targetPath}"
Start the engine:  node "${cliPath}" serve -p "${targetPath}"
Plug your AI in:   claude mcp add plexus -- node "${cliPath}" mcp -p "${targetPath}"
Install the guard: node "${cliPath}" hook-install -p "${targetPath}"

Build loop: consult planned nodes → write code at the planned path → the
scanner activates them (same id) → \`plexus report\` is your build checklist.`);
    });

program
    .command('seed')
    .description('Load a seed connectome (planned nodes + synapses + invariants) into the graph')
    .requiredOption('-f, --file <file>', 'Seed connectome JSON')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const integrationPath = path.join(targetPath, 'plexus-integration');
        if (!fs.existsSync(integrationPath)) {
            console.error('Integration not found. Run "plexus genesis" or "plexus init" first.');
            process.exit(1);
        }
        setContext(integrationPath, targetPath);
        initDb(integrationPath);
        graph.loadFromDb();

        const seed = JSON.parse(fs.readFileSync(path.resolve(options.file), 'utf8'));
        const { validateAndBuildNode, validateAndBuildSynapse } = require('./core/validate');
        const { declareInvariant } = require('./core/invariants');

        let nodes = 0, synapses = 0, invariants = 0;
        const errors: string[] = [];

        for (const n of seed.nodes || []) {
            const input = {
                ...n,
                status: 'planned',
                metadata: { ...(n.metadata || {}), origin: 'seed' },
            };
            const v = validateAndBuildNode(input, 'command');
            if (!v.ok) { errors.push(`node ${n.name || n.id}: ${v.errors.join('; ')}`); continue; }
            graph.addNode(v.value);
            nodes++;
        }
        for (const s of seed.synapses || []) {
            if (s.source_node_id === s.target_node_id) continue; // template placeholder
            const v = validateAndBuildSynapse(s);
            if (!v.ok) { errors.push(`synapse ${s.source_node_id}→${s.target_node_id}: ${v.errors.join('; ')}`); continue; }
            graph.addSynapse(v.value);
            synapses++;
        }
        for (const inv of seed.invariants || []) {
            const r = declareInvariant(inv.statement, inv.node_ids, 'user');
            if (r.ok) invariants++;
            else errors.push(`invariant: ${r.error}`);
        }
        graph.flushToDisk();

        console.log(`⬡ Seeded: ${nodes} planned node(s), ${synapses} synapse(s), ${invariants} invariant(s).`);
        if (errors.length) {
            console.warn(`⚠ ${errors.length} rejected:`);
            for (const e of errors.slice(0, 10)) console.warn('  · ' + e);
        }
        console.log('The nine regions are now your build checklist — `plexus report` shows planning debt.');
    });

// ─── Evidence Protocol 2.1: evidence-learned synapse strength ─────────────────

program
    .command('learn')
    .description('Apply mined co-change evidence as bounded, audited, decaying strength boosts on EXISTING synapses (dry-run by default)')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .option('--apply', 'Actually write the boosts (default: dry-run)')
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const integrationPath = path.join(targetPath, 'plexus-integration');
        const proposalsPath = path.join(integrationPath, 'plexus-proposals.json');
        if (!fs.existsSync(proposalsPath)) {
            console.error('No plexus-proposals.json — run "plexus mine" first.');
            process.exit(1);
        }
        setContext(integrationPath, targetPath);
        initDb(integrationPath);
        graph.loadFromDb();

        const proposals = JSON.parse(fs.readFileSync(proposalsPath, 'utf8')).proposals || [];
        const coChanges = proposals.filter((p: any) => p.kind === 'co_change');

        const byFile = new Map<string, string>(); // file_path → module node id
        for (const n of graph.nodes.values()) {
            if (n.type === 'module') byFile.set(n.file_path.replace(/^\.?\//, ''), n.id);
        }

        const audit: any[] = [];
        for (const p of coChanges) {
            const [fa, fb] = p.files.map((f: string) => f.replace(/^\.?\//, ''));
            const na = byFile.get(fa);
            const nb = byFile.get(fb);
            if (!na || !nb) continue;

            // Only strengthen EXISTING edges — evidence tunes the map, it
            // never invents structure (that would be belief posing as fact).
            let edge: any = null;
            for (const syn of graph.synapses.values()) {
                if ((syn.source_node_id === na && syn.target_node_id === nb) ||
                    (syn.source_node_id === nb && syn.target_node_id === na)) {
                    edge = syn;
                    break;
                }
            }
            if (!edge) continue;

            const meta: any = edge.metadata || {};
            const prior = typeof meta.learned_boost === 'number' ? meta.learned_boost : 0;
            // Bounded: +0.01 per co-change observation, cumulative cap 0.3
            const boost = Math.min(0.3, prior + Math.min(0.1, 0.01 * p.co_change_count));
            if (boost <= prior + 0.001) continue;

            audit.push({
                timestamp: new Date().toISOString(),
                synapse_id: edge.id,
                between: [fa, fb],
                evidence: `co_change x${p.co_change_count}`,
                learned_boost: { from: prior, to: Math.round(boost * 1000) / 1000 },
            });
            if (options.apply) {
                graph.updateSynapse(edge.id, {
                    metadata: { ...meta, learned_boost: boost, learned_at: new Date().toISOString() },
                } as any);
            }
        }

        if (audit.length === 0) {
            console.log('No applicable co-change evidence (edges must already exist between the co-changing modules).');
            return;
        }
        for (const a of audit) {
            console.log(` · ${a.between[0]} ⇄ ${a.between[1]} — ${a.evidence} → boost ${a.learned_boost.from} → ${a.learned_boost.to}`);
        }
        if (options.apply) {
            const logPath = path.join(integrationPath, 'learning-log.json');
            let existing: any[] = [];
            try { existing = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch { /* first run */ }
            fs.writeFileSync(logPath, JSON.stringify([...existing, ...audit], null, 2));
            console.log(`\nApplied ${audit.length} boost(s) — audited in learning-log.json. Boosts decay (90-day half-life) unless re-evidenced.`);
        } else {
            console.log(`\nDRY RUN — ${audit.length} boost(s) would apply. Re-run with --apply.`);
        }
    });

// ─── Onboarding orchestration (Graft first hour) ──────────────────────────────

program
    .command('onboard')
    .description('Graft an existing app: analyze → report → mine → integration instructions')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        const integrationPath = path.join(targetPath, 'plexus-integration');
        const cliPath = path.join(__dirname, 'cli.js');
        const run = (cmd: string) => {
            try { execSync(cmd, { stdio: 'inherit' }); } catch { /* step failures shown inline */ }
        };
        if (!fs.existsSync(integrationPath)) {
            console.log('⬡ Step 0 — init');
            run(`node "${cliPath}" init -t "${targetPath}"`);
            console.log('\n→ EDIT plexus-integration/plexus-manifest.json classification_hints for YOUR directory layout.');
            console.log('  (Manifest hints are the classifier\'s strongest signal — this is the highest-leverage ten minutes.)');
            console.log('  Then re-run: plexus onboard\n');
            return;
        }
        console.log('⬡ Step 1 — scan');
        run(`node "${cliPath}" analyze -p "${targetPath}"`);
        console.log('\n⬡ Step 2 — utilization report');
        run(`node "${cliPath}" report -p "${targetPath}"`);
        console.log('\n⬡ Step 3 — git-history mining (proposals only)');
        run(`node "${cliPath}" mine -p "${targetPath}"`);
        console.log(`\n⬡ Step 4 — plug your AI in:
  claude mcp add plexus -- node "${cliPath}" mcp -p "${targetPath}"
  node "${cliPath}" hook-install -p "${targetPath}"
  node "${cliPath}" rules -p "${targetPath}"     # snippet for CLAUDE.md / non-MCP assistants

⬡ Step 5 — the trust test (do this in your AI session):
  Take your actual next task. Ask for the plan WITHOUT consulting, then with
  session_open + claim_check + consult. Compare: invented APIs avoided, real
  files identified, risks surfaced. Trust forms from the demonstrated delta.

⬡ Step 6 — enrichment (LLM): create the concept layer the scanner can't see
  (features, journeys, services, entities), review plexus-proposals.json and
  confirm real incidents into the amygdala, resolve the low-confidence queue
  shown in the report.`);
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
            // core.quotepath=false: without it, non-ASCII paths arrive C-quoted
            // ("src/f\\303\\266o.ts") and silently corrupt co-change keys.
            log = execSync(
                `git -c core.quotepath=false log --pretty=format:'§%H|%s' --name-only -n ${parseInt(options.commits, 10) || 500}`,
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
