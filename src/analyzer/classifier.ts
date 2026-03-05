import { Region, NodeType } from '../types';
import { getManifest } from '../core/context';

interface ClassificationSignal {
    region: Region;
    weight: number;
    source: string;
}

// Weight constants
const MANIFEST_HINT_WEIGHT = 3.0;
const PATH_PATTERN_WEIGHT = 2.0;
const NODE_TYPE_WEIGHT = 1.5;
const CONTENT_WEIGHT = 1.0;

// Path pattern → region mapping
const PATH_PATTERNS: [RegExp, Region][] = [
    [/\/auth\//i, 'brain_stem'],
    [/\/middleware\//i, 'brain_stem'],
    [/\/config\//i, 'brain_stem'],
    [/\/security\//i, 'brain_stem'],
    [/\/guards?\//i, 'brain_stem'],
    [/\/components?\//i, 'occipital_lobe'],
    [/\/ui\//i, 'occipital_lobe'],
    [/\/views?\//i, 'occipital_lobe'],
    [/\/pages?\//i, 'occipital_lobe'],
    [/\/layouts?\//i, 'occipital_lobe'],
    [/\/styles?\//i, 'occipital_lobe'],
    [/\.css$/i, 'occipital_lobe'],
    [/\/api\//i, 'parietal_lobe'],
    [/\/routes?\//i, 'parietal_lobe'],
    [/\/controllers?\//i, 'parietal_lobe'],
    [/\/endpoints?\//i, 'parietal_lobe'],
    [/\/db\//i, 'temporal_lobe'],
    [/\/database\//i, 'temporal_lobe'],
    [/\/models?\//i, 'temporal_lobe'],
    [/\/schemas?\//i, 'temporal_lobe'],
    [/\/prisma\//i, 'temporal_lobe'],
    [/\/migrations?\//i, 'temporal_lobe'],
    [/\/hooks?\//i, 'frontal_lobe'],
    [/\/stores?\//i, 'frontal_lobe'],
    [/\/state\//i, 'frontal_lobe'],
    [/\/reducers?\//i, 'frontal_lobe'],
    [/\/context\//i, 'frontal_lobe'],
    [/\/providers?\//i, 'frontal_lobe'],
    [/\/cron\//i, 'cerebellum'],
    [/\/workers?\//i, 'cerebellum'],
    [/\/jobs?\//i, 'cerebellum'],
    [/\/utils?\//i, 'cerebellum'],
    [/\/helpers?\//i, 'cerebellum'],
    [/\/lib\//i, 'cerebellum'],
    [/\/toast/i, 'limbic_system'],
    [/\/notifications?\//i, 'limbic_system'],
    [/\/alerts?\//i, 'limbic_system'],
    [/\/errors?\//i, 'limbic_system'],
    [/\/logging\//i, 'limbic_system'],
    [/\/types?\//i, 'corpus_callosum'],
    [/\/interfaces?\//i, 'corpus_callosum'],
    [/\/shared\//i, 'corpus_callosum'],
    [/\/common\//i, 'corpus_callosum'],
    [/\.d\.ts$/i, 'corpus_callosum'],
];

// Node type → region mapping
const TYPE_REGIONS: Partial<Record<NodeType, Region>> = {
    component: 'occipital_lobe',
    page: 'occipital_lobe',
    layout: 'occipital_lobe',
    style: 'occipital_lobe',
    animation: 'occipital_lobe',
    asset: 'occipital_lobe',
    route: 'parietal_lobe',
    endpoint: 'parietal_lobe',
    middleware: 'brain_stem',
    config: 'brain_stem',
    schema: 'temporal_lobe',
    model: 'temporal_lobe',
    migration: 'temporal_lobe',
    hook: 'frontal_lobe',
    store: 'frontal_lobe',
    reducer: 'frontal_lobe',
    action: 'frontal_lobe',
    selector: 'frontal_lobe',
    context: 'frontal_lobe',
    provider: 'frontal_lobe',
    type: 'corpus_callosum',
    interface: 'corpus_callosum',
    event: 'limbic_system',
    test: 'cerebellum',
    util: 'cerebellum',
    workflow: 'cerebellum',
    script: 'cerebellum',
    env_var: 'brain_stem',
};

// Content signals (keywords found in code)
const CONTENT_SIGNALS: [RegExp, Region][] = [
    [/useState|useEffect|useCallback|useMemo|useReducer|createContext/i, 'frontal_lobe'],
    [/prisma|sequelize|mongoose|typeorm|knex|\.query\(|\.execute\(/i, 'temporal_lobe'],
    [/jwt|bcrypt|passport|session|cookie|oauth|token/i, 'brain_stem'],
    [/className|style=|css|tailwind|styled-components/i, 'occipital_lobe'],
    [/res\.json|res\.send|req\.body|req\.params|req\.query|NextResponse/i, 'parietal_lobe'],
    [/toast|notification|alert|logger|console\.error/i, 'limbic_system'],
    [/cron|schedule|worker|queue|job|setTimeout|setInterval/i, 'cerebellum'],
];

export function classifyRegion(filePath: string, nodeType: NodeType, content?: string): Region {
    const signals: ClassificationSignal[] = [];

    // 1. Manifest hints (highest priority)
    const manifest = getManifest();
    if (manifest?.regions.classification_hints) {
        for (const [pathPrefix, region] of Object.entries(manifest.regions.classification_hints)) {
            if (filePath.includes(pathPrefix)) {
                signals.push({ region: region as Region, weight: MANIFEST_HINT_WEIGHT, source: `manifest:${pathPrefix}` });
            }
        }
    }

    // Check custom overrides (exact match)
    if (manifest?.regions.custom_overrides) {
        for (const [pathPattern, region] of Object.entries(manifest.regions.custom_overrides)) {
            if (filePath.includes(pathPattern)) {
                // Custom overrides are definitive — return immediately
                return region as Region;
            }
        }
    }

    // 2. Path patterns
    for (const [pattern, region] of PATH_PATTERNS) {
        if (pattern.test(filePath)) {
            signals.push({ region, weight: PATH_PATTERN_WEIGHT, source: `path:${pattern.source}` });
        }
    }

    // 3. Node type
    const typeRegion = TYPE_REGIONS[nodeType];
    if (typeRegion) {
        signals.push({ region: typeRegion, weight: NODE_TYPE_WEIGHT, source: `type:${nodeType}` });
    }

    // 4. Content analysis
    if (content) {
        for (const [pattern, region] of CONTENT_SIGNALS) {
            if (pattern.test(content)) {
                signals.push({ region, weight: CONTENT_WEIGHT, source: `content:${pattern.source}` });
            }
        }
    }

    // Score aggregation — highest total weight wins
    if (signals.length === 0) return 'frontal_lobe'; // default

    const scores = new Map<Region, number>();
    for (const signal of signals) {
        scores.set(signal.region, (scores.get(signal.region) || 0) + signal.weight);
    }

    let bestRegion: Region = 'frontal_lobe';
    let bestScore = 0;
    for (const [region, score] of scores) {
        if (score > bestScore) {
            bestScore = score;
            bestRegion = region;
        }
    }

    return bestRegion;
}
