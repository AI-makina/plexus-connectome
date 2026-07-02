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

// Path pattern → region mapping (Taxonomy v2 rule surgery, REGION_TAXONOMY.md
// §7.2): utils/helpers/lib are NOT cerebellum (pure helpers classify by their
// own behavior); types/interfaces/shared are NOT corpus_callosum (CC nodes are
// EARNED by the contract-promotion pass, never assigned by path); observability
// (/logging) is brain_stem, not limbic.
const PATH_PATTERNS: [RegExp, Region][] = [
    [/\/auth\//i, 'brain_stem'],
    [/\/middleware\//i, 'brain_stem'],
    [/\/config\//i, 'brain_stem'],
    [/\/security\//i, 'brain_stem'],
    [/\/guards?\//i, 'brain_stem'],
    [/\/logging\//i, 'brain_stem'],
    [/\/components?\//i, 'occipital_lobe'],
    [/\/ui\//i, 'occipital_lobe'],
    [/\/views?\//i, 'occipital_lobe'],
    [/\/pages?\//i, 'occipital_lobe'],
    [/\/screens?\//i, 'occipital_lobe'],
    [/\/layouts?\//i, 'occipital_lobe'],
    [/\/styles?\//i, 'occipital_lobe'],
    [/\.css$/i, 'occipital_lobe'],
    [/\/api\//i, 'parietal_lobe'],
    [/\/routes?\//i, 'parietal_lobe'],
    [/\/controllers?\//i, 'parietal_lobe'],
    [/\/endpoints?\//i, 'parietal_lobe'],
    [/\/adapters?\//i, 'parietal_lobe'],
    [/\/db\//i, 'temporal_lobe'],
    [/\/database\//i, 'temporal_lobe'],
    [/\/models?\//i, 'temporal_lobe'],
    [/\/schemas?\//i, 'temporal_lobe'],
    [/\/repositor(y|ies)\//i, 'temporal_lobe'],
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
    [/\/queues?\//i, 'cerebellum'],
    [/\/toast/i, 'limbic_system'],
    [/\/notifications?\//i, 'limbic_system'],
    [/\/onboarding\//i, 'limbic_system'],
];

// Node type → region mapping (v2: types/interfaces no longer dumped in CC —
// they get a weak frontal default until the contract-promotion pass decides;
// utils are logic by default; function/module/class/constant get explicit
// defaults instead of riding content signals alone)
const TYPE_REGIONS: Partial<Record<NodeType, Region>> = {
    component: 'occipital_lobe',
    page: 'occipital_lobe',
    layout: 'occipital_lobe',
    style: 'occipital_lobe',
    animation: 'occipital_lobe',
    asset: 'occipital_lobe',
    token_set: 'occipital_lobe',
    template: 'occipital_lobe',
    route: 'parietal_lobe',
    endpoint: 'parietal_lobe',
    service: 'parietal_lobe',
    middleware: 'brain_stem',
    config: 'brain_stem',
    env_var: 'brain_stem',
    deploy_target: 'brain_stem',
    dependency_manifest: 'brain_stem',
    schema: 'temporal_lobe',
    model: 'temporal_lobe',
    migration: 'temporal_lobe',
    entity: 'temporal_lobe',
    data_store: 'temporal_lobe',
    hook: 'frontal_lobe',
    store: 'frontal_lobe',
    reducer: 'frontal_lobe',
    action: 'frontal_lobe',
    selector: 'frontal_lobe',
    context: 'frontal_lobe',
    provider: 'frontal_lobe',
    feature: 'frontal_lobe',
    flow: 'frontal_lobe',
    util: 'frontal_lobe',
    function: 'frontal_lobe',
    module: 'frontal_lobe',
    class: 'frontal_lobe',
    constant: 'frontal_lobe',
    type: 'frontal_lobe',
    interface: 'frontal_lobe',
    event: 'limbic_system',
    journey: 'limbic_system',
    test: 'cerebellum',
    workflow: 'cerebellum',
    script: 'cerebellum',
    pipeline: 'cerebellum',
    command: 'frontal_lobe',
    contract: 'corpus_callosum',
};

// Content signals — call-shaped and word-bounded (v2). The old loose patterns
// produced verified fake populations: /alert/i matched 'amygdala_alerts' and
// filled the entire limbic region with false positives; a BFS variable named
// 'queue' made the engine's own graph code cerebellum; 'className' inside a
// regex STRING made the analyzer occipital. logger/console.error are
// OBSERVABILITY → brain_stem, not limbic.
const CONTENT_SIGNALS: [RegExp, Region][] = [
    [/\buse(State|Effect|Callback|Memo|Reducer)\s*\(|\bcreateContext\s*\(/, 'frontal_lobe'],
    [/\bprisma\.|sequelize\.|mongoose\.|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|AsyncStorage|\buseQuery\s*\(|\buseSWR\s*\(|\.query\s*\(|\.execute\s*\(/, 'temporal_lobe'],
    [/\bjwt\.|bcrypt\.|passport\.|\bcookie[s]?\.|\blogger\.|console\.(error|warn)\s*\(/, 'brain_stem'],
    [/className=|styled\.|styled-components|@keyframes|<svg/i, 'occipital_lobe'],
    [/res\.(json|send|status)\s*\(|req\.(body|params|query)\b|NextResponse|\bfetch\s*\(|axios\.|new WebSocket/, 'parietal_lobe'],
    [/\btoast\s*[.(]|<Skeleton|<Spinner|isLoading\s*\?|showNotification\s*\(/, 'limbic_system'],
    [/\bcron\b|\.schedule\s*\(|new Worker\s*\(|queue\.(add|process)\s*\(|\bsetInterval\s*\(/, 'cerebellum'],
];

// Tie-break preference (v2): on equal scores prefer the scarcer specific
// region over the populous defaults — the old strict-`>` + Map-insertion-order
// tie-break silently handed every tie to frontal.
const TIE_BREAK_ORDER: Region[] = [
    'limbic_system', 'temporal_lobe', 'cerebellum', 'brain_stem',
    'parietal_lobe', 'occipital_lobe', 'corpus_callosum', 'amygdala', 'frontal_lobe',
];
const tieRank = (r: Region) => {
    const i = TIE_BREAK_ORDER.indexOf(r);
    return i === -1 ? TIE_BREAK_ORDER.length : i;
};

export interface ScoredClassification {
    region: Region;
    /** winning score / total score — sub-0.5 nodes belong in a review queue */
    confidence: number;
}

export function classifyRegionScored(filePath: string, nodeType: NodeType, content?: string): ScoredClassification {
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

    // Check custom overrides (exact match) — definitive, confidence 1.0
    if (manifest?.regions.custom_overrides) {
        for (const [pathPattern, region] of Object.entries(manifest.regions.custom_overrides)) {
            if (filePath.includes(pathPattern)) {
                return { region: region as Region, confidence: 1.0 };
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

    // 4. Content analysis — callers pass the SYMBOL's own text, not the whole
    // file (whole-file voting is how the analyzer's own CodeAnalyzer class
    // landed occipital: the file contains 'className' inside regex strings).
    if (content) {
        for (const [pattern, region] of CONTENT_SIGNALS) {
            if (pattern.test(content)) {
                signals.push({ region, weight: CONTENT_WEIGHT, source: `content:${pattern.source}` });
            }
        }
    }

    // Score aggregation — highest total wins; ties break to the scarcer region.
    // The frontal fallback survives (spec §7.4) but is INSTRUMENTED: zero
    // signals → confidence 0, so review queues can find it.
    if (signals.length === 0) return { region: 'frontal_lobe', confidence: 0 };

    const scores = new Map<Region, number>();
    let total = 0;
    for (const signal of signals) {
        scores.set(signal.region, (scores.get(signal.region) || 0) + signal.weight);
        total += signal.weight;
    }

    let bestRegion: Region | null = null;
    let bestScore = -1;
    for (const [region, score] of scores) {
        if (score > bestScore || (score === bestScore && bestRegion !== null && tieRank(region) < tieRank(bestRegion))) {
            bestScore = score;
            bestRegion = region;
        }
    }

    return { region: bestRegion || 'frontal_lobe', confidence: total > 0 ? bestScore / total : 0 };
}

/** Back-compat wrapper — prefer classifyRegionScored to keep the confidence. */
export function classifyRegion(filePath: string, nodeType: NodeType, content?: string): Region {
    return classifyRegionScored(filePath, nodeType, content).region;
}
