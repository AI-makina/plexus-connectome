import fs from 'fs';
import path from 'path';
import { graph } from '../core/graph';
import { createNode, createSynapse, deterministicNodeId, deterministicSynapseId } from '../core/factories';
import { NodeType, Region } from '../types';

// ─── Artifact parsers (Roadmap 1.4 / taxonomy engine plan #4) ─────────────────
// The TS/JS scanner alone starves brain_stem, temporal, and cerebellum: their
// concerns live in files discovery never admitted (spec §7.2 promised these
// parsers and they were never built). Everything here is a map fact:
// deterministic ids, origin 'scan', idempotent upserts, and the returned path
// list joins the stale-cleanup discovered set so dead artifacts get cleaned.

// External SaaS/API SDKs that earn a parietal service node. Generic libraries
// (react, axios, express…) are NOT services.
const SERVICE_DEPS: Record<string, string> = {
    'stripe': 'Stripe',
    'twilio': 'Twilio',
    'openai': 'OpenAI',
    '@anthropic-ai/sdk': 'Anthropic',
    '@google/generative-ai': 'Google Gemini',
    'resend': 'Resend',
    '@sendgrid/mail': 'SendGrid',
    '@supabase/supabase-js': 'Supabase',
    'firebase': 'Firebase',
    'firebase-admin': 'Firebase',
    '@aws-sdk/client-s3': 'AWS S3',
    'aws-sdk': 'AWS',
    'googleapis': 'Google APIs',
    'pusher': 'Pusher',
    'ably': 'Ably',
    '@octokit/rest': 'GitHub API',
    'algoliasearch': 'Algolia',
    '@pinecone-database/pinecone': 'Pinecone',
    'chromadb': 'ChromaDB',
    'replicate': 'Replicate',
};

// docker-compose images that are data stores (temporal), not services
const DATA_STORE_IMAGES: [RegExp, string][] = [
    [/postgres/i, 'PostgreSQL'],
    [/mysql|mariadb/i, 'MySQL'],
    [/redis/i, 'Redis'],
    [/mongo/i, 'MongoDB'],
    [/elasticsearch|opensearch/i, 'Elasticsearch'],
    [/minio/i, 'MinIO'],
    [/rabbitmq/i, 'RabbitMQ'],
    [/qdrant|weaviate|milvus/i, 'Vector store'],
];

interface ArtifactResult {
    paths: string[];       // relative paths that produced nodes (join discovered set)
    nodesCreated: number;
}

export function analyzeArtifacts(targetPath: string): ArtifactResult {
    const result: ArtifactResult = { paths: [], nodesCreated: 0 };

    const addNode = (rel: string, type: NodeType, region: Region, name: string, description: string, extraMeta: any = {}, tags: string[] = []) => {
        const node = createNode({
            id: deterministicNodeId(rel, type, name),
            name, type, region,
            file_path: rel,
            description,
            metadata: { origin: 'scan', classification_confidence: 1, ...extraMeta },
            tags: ['artifact', ...tags],
        });
        graph.addNode(node);
        result.nodesCreated++;
        if (!result.paths.includes(rel)) result.paths.push(rel);
        return node;
    };
    const link = (sourceId: string, targetId: string, type: any, description: string) => {
        graph.addSynapse(createSynapse({
            id: deterministicSynapseId(sourceId, targetId, type),
            source_node_id: sourceId, target_node_id: targetId, type, description,
        }));
    };
    const read = (rel: string): string | null => {
        try { return fs.readFileSync(path.join(targetPath, rel), 'utf8'); } catch { return null; }
    };
    const exists = (rel: string) => fs.existsSync(path.join(targetPath, rel));

    // ── package.json: dependency manifest + service nodes + npm scripts ──────
    const pkgRaw = read('package.json');
    if (pkgRaw) {
        try {
            const pkg = JSON.parse(pkgRaw);
            const manifest = addNode('package.json', 'dependency_manifest', 'brain_stem', 'package.json',
                `Dependency manifest — ${Object.keys(pkg.dependencies || {}).length} deps, ${Object.keys(pkg.devDependencies || {}).length} dev deps`,
                { framework: pkg.dependencies?.next ? 'next.js' : pkg.dependencies?.react ? 'react' : undefined });

            const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            for (const [dep, service] of Object.entries(SERVICE_DEPS)) {
                if (allDeps[dep]) {
                    const svc = addNode('package.json', 'service', 'parietal_lobe', service,
                        `Third-party service (SDK: ${dep}@${allDeps[dep]})`, { sdk: dep }, ['service', 'external']);
                    link(manifest.id, svc.id, 'depends_on', `package.json depends on ${service} SDK`);
                }
            }

            const scripts = Object.keys(pkg.scripts || {});
            for (const s of scripts.slice(0, 15)) {
                const scriptNode = addNode('package.json', 'script', 'cerebellum', `npm:${s}`,
                    `npm script — ${String(pkg.scripts[s]).slice(0, 100)}`);
                link(manifest.id, scriptNode.id, 'composes', `package.json defines script ${s}`);
            }
        } catch { /* malformed package.json — skip, never fail the scan */ }
    }

    // ── Docker: containerization + data stores from compose ──────────────────
    if (exists('Dockerfile')) {
        addNode('Dockerfile', 'config', 'brain_stem', 'Dockerfile', 'Container build definition');
    }
    for (const composeFile of ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
        const compose = read(composeFile);
        if (!compose) continue;
        const composeNode = addNode(composeFile, 'config', 'brain_stem', composeFile, 'Service orchestration definition');
        for (const m of compose.matchAll(/image:\s*['"]?([^\s'"]+)/g)) {
            for (const [pattern, storeName] of DATA_STORE_IMAGES) {
                if (pattern.test(m[1])) {
                    const store = addNode(composeFile, 'data_store', 'temporal_lobe', storeName,
                        `Data store (${m[1]}) declared in ${composeFile}`, { image: m[1] });
                    link(composeNode.id, store.id, 'provides', `${composeFile} provisions ${storeName}`);
                    break;
                }
            }
        }
        break; // one compose file is enough
    }

    // ── .env.example: the env schema of record ────────────────────────────────
    for (const envFile of ['.env.example', '.env.sample', '.env.template']) {
        const env = read(envFile);
        if (!env) continue;
        // The file joins the discovered set even when every var dedupes —
        // otherwise its own nodes get stale-cleaned on the next scan.
        if (!result.paths.includes(envFile)) result.paths.push(envFile);
        let count = 0;
        for (const line of env.split('\n')) {
            const m = line.match(/^\s*([A-Z][A-Z0-9_]{2,})\s*=/);
            if (!m || count >= 40) continue;
            // App-wide singleton id — shared with the code scanner's env nodes
            const envId = deterministicNodeId('__env__', 'env_var', m[1]);
            if (!graph.nodes.has(envId)) {
                const node = createNode({
                    id: envId, name: m[1], type: 'env_var', region: 'brain_stem',
                    file_path: envFile,
                    description: `Environment variable declared in ${envFile}`,
                    metadata: { origin: 'scan', classification_confidence: 1 },
                    tags: ['artifact', 'env'],
                });
                graph.addNode(node);
                result.nodesCreated++;
                count++;
            }
        }
        break;
    }

    // ── CI pipelines + platform crons ─────────────────────────────────────────
    const workflowsDir = path.join(targetPath, '.github', 'workflows');
    if (fs.existsSync(workflowsDir)) {
        try {
            for (const f of fs.readdirSync(workflowsDir).filter(f => /\.ya?ml$/.test(f)).slice(0, 15)) {
                const rel = `.github/workflows/${f}`;
                const yml = read(rel) || '';
                const nameMatch = yml.match(/^name:\s*(.+)$/m);
                addNode(rel, 'pipeline', 'cerebellum', nameMatch ? nameMatch[1].trim().replace(/['"]/g, '') : f,
                    `CI workflow (${f}) — triggers: ${(yml.match(/^on:\s*(.+)$/m)?.[1] || 'see file').slice(0, 60)}`);
            }
        } catch { /* unreadable dir */ }
    }
    const vercel = read('vercel.json');
    if (vercel) {
        try {
            const v = JSON.parse(vercel);
            for (const cron of (v.crons || []).slice(0, 10)) {
                addNode('vercel.json', 'pipeline', 'cerebellum', `cron ${cron.path}`,
                    `Vercel cron — ${cron.schedule} → ${cron.path}`, { schedule: cron.schedule });
            }
        } catch { /* malformed */ }
    }

    // ── Prisma schema: one entity per model ───────────────────────────────────
    for (const prismaFile of ['prisma/schema.prisma', 'schema.prisma']) {
        const prisma = read(prismaFile);
        if (!prisma) continue;
        const schemaNode = addNode(prismaFile, 'schema', 'temporal_lobe', path.basename(prismaFile), 'Prisma database schema');
        for (const m of prisma.matchAll(/^model\s+(\w+)\s*\{/gm)) {
            const entity = addNode(prismaFile, 'entity', 'temporal_lobe', m[1], `Database model ${m[1]}`);
            link(schemaNode.id, entity.id, 'composes', `schema defines model ${m[1]}`);
        }
        break;
    }

    // ── Tailwind theme as the design token_set ────────────────────────────────
    for (const tw of ['tailwind.config.js', 'tailwind.config.ts', 'ui/tailwind.config.js']) {
        const cfg = read(tw);
        if (cfg && /theme\s*:/.test(cfg)) {
            addNode(tw, 'token_set', 'occipital_lobe', 'design tokens',
                `Tailwind theme — the design token source (${tw})`);
            break;
        }
    }

    // ── Stylesheets (capped) ──────────────────────────────────────────────────
    const cssFiles: string[] = [];
    const walkCss = (dir: string, depth: number) => {
        if (depth > 4 || cssFiles.length >= 20) return;
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(path.join(targetPath, dir), { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (cssFiles.length >= 20) break;
            const rel = dir ? `${dir}/${e.name}` : e.name;
            if (e.isDirectory() && !/node_modules|\.git|dist|\.next|plexus-integration/.test(e.name)) walkCss(rel, depth + 1);
            else if (/\.(css|scss)$/.test(e.name)) cssFiles.push(rel);
        }
    };
    walkCss('', 0);
    for (const css of cssFiles) {
        addNode(css, 'style', 'occipital_lobe', path.basename(css), `Stylesheet ${css}`);
    }

    // ── Locale catalogs: the microcopy layer (limbic) ─────────────────────────
    for (const localesDir of ['locales', 'public/locales', 'src/locales']) {
        const abs = path.join(targetPath, localesDir);
        if (!fs.existsSync(abs)) continue;
        try {
            const locales = fs.readdirSync(abs).slice(0, 10);
            for (const loc of locales) {
                const rel = `${localesDir}/${loc}`;
                addNode(rel, 'asset', 'limbic_system', `messages:${loc.replace(/\.json$/, '')}`,
                    `Locale/microcopy catalog ${rel}`, {}, ['i18n']);
            }
        } catch { /* unreadable */ }
        break;
    }

    return result;
}
