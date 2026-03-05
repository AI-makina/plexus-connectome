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
                classification_hints: {
                    'src/app': 'parietal_lobe',
                    'src/components': 'occipital_lobe',
                    'src/hooks': 'frontal_lobe',
                    'src/store': 'frontal_lobe',
                    'src/lib': 'cerebellum',
                    'src/utils': 'cerebellum',
                    'src/api': 'parietal_lobe',
                    'src/middleware': 'brain_stem',
                    'src/auth': 'brain_stem',
                    'src/config': 'brain_stem',
                    'src/db': 'temporal_lobe',
                    'src/models': 'temporal_lobe',
                    'src/styles': 'occipital_lobe',
                    'src/types': 'corpus_callosum',
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

program
    .command('serve')
    .description('Start the Plexus API and Visualization servers')
    .option('-p, --path <path>', 'Path to target app', process.cwd())
    .action((options: any) => {
        const targetPath = path.resolve(options.path);
        console.log(`Booting server for ${targetPath}...`);
        execSync(`node "${path.join(__dirname, 'index.js')}" "${targetPath}"`, { stdio: 'inherit' });
    });

program.parse(process.argv);
