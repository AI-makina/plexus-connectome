import fs from 'fs';
import path from 'path';
import { graph } from './graph';
import { Region } from '../types';
import { getManifest, getIntegrationPath } from './context';

// ─── Utilization & maturity (Roadmap 1.3 / taxonomy §6) ──────────────────────
// "Is the whole brain being used?" — actual region shares vs an archetype
// profile, dark-region detection, provenance mix, and a maturity label that
// downstream surfaces (brief wording, future gating) key off. A provisional
// brain ADVISES; only an enriched, fresh brain should ever gate.

export type Tier = 'substantial' | 'moderate' | 'minimal' | 'none';
const TIER_SHARE: Record<Tier, number> = { substantial: 0.22, moderate: 0.10, minimal: 0.03, none: 0 };

// Default archetype profile (fullstack web). Overridable via manifest
// regions.expected_region_profile once archetype detection lands.
const DEFAULT_PROFILE: Record<Exclude<Region, 'amygdala'>, Tier> = {
    frontal_lobe: 'substantial',
    occipital_lobe: 'substantial',
    parietal_lobe: 'moderate',
    temporal_lobe: 'moderate',
    brain_stem: 'moderate',
    cerebellum: 'moderate',
    limbic_system: 'minimal',
    corpus_callosum: 'minimal',
};

export interface RegionUtilization {
    region: Region;
    node_count: number;
    share: number;
    expected_share: number;
    status: 'populated' | 'sparse' | 'dark' | 'not_applicable';
}

export interface UtilizationReport {
    utilization_score: number;
    maturity: 'provisional' | 'enriched';
    maturity_reasons: string[];
    freshness: string;
    regions: RegionUtilization[];
    amygdala: { entries: number; note: string };
    origin_mix: Record<string, number>;
    low_confidence_nodes: number;
}

export function computeUtilization(): UtilizationReport {
    const manifest = getManifest();
    const profile: Record<string, Tier> = {
        ...DEFAULT_PROFILE,
        ...(((manifest as any)?.regions?.expected_region_profile) || {}),
    };

    // Shares over active, non-amygdala nodes
    const counts = new Map<Region, number>();
    const originMix: Record<string, number> = {};
    let lowConfidence = 0;
    let total = 0;
    for (const node of graph.nodes.values()) {
        if (node.status === 'dormant') continue;
        const origin = (node.metadata as any)?.origin || 'legacy';
        originMix[origin] = (originMix[origin] || 0) + 1;
        const conf = (node.metadata as any)?.classification_confidence;
        if (typeof conf === 'number' && conf < 0.5) lowConfidence++;
        if (node.region === 'amygdala') continue;
        counts.set(node.region, (counts.get(node.region) || 0) + 1);
        total++;
    }

    // Normalize expected shares over the 8 scan-populable regions
    const regions = Object.keys(profile) as Region[];
    const expectedRaw = regions.map(r => TIER_SHARE[profile[r] || 'minimal']);
    const expectedSum = expectedRaw.reduce((a, b) => a + b, 0) || 1;

    const out: RegionUtilization[] = [];
    let tv = 0; // total-variation distance
    regions.forEach((r, i) => {
        const count = counts.get(r) || 0;
        const share = total > 0 ? count / total : 0;
        const expected = expectedRaw[i] / expectedSum;
        tv += Math.abs(share - expected);
        let status: RegionUtilization['status'];
        if (profile[r] === 'none') status = 'not_applicable';
        else if (count === 0) status = 'dark';
        else if (share < 0.4 * expected) status = 'sparse';
        else status = 'populated';
        out.push({
            region: r, node_count: count,
            share: Math.round(share * 1000) / 1000,
            expected_share: Math.round(expected * 1000) / 1000,
            status,
        });
    });

    // Freshness from the fingerprint file (per-node last_verified lands later)
    let freshness = 'never scanned';
    try {
        const st = fs.statSync(path.join(getIntegrationPath(), 'fingerprints.json'));
        const hours = (Date.now() - st.mtimeMs) / 3600000;
        freshness = hours < 1 ? 'scanned <1h ago' : hours < 48 ? `scanned ${Math.round(hours)}h ago` : `scanned ${Math.round(hours / 24)}d ago`;
    } catch { /* no fingerprints */ }

    // Maturity: a scan-only brain with an empty amygdala is PROVISIONAL —
    // it advises, it must not gate.
    const enrichmentNodes = (originMix['llm'] || 0) + (originMix['seed'] || 0) + (originMix['command'] || 0) + (originMix['incident'] || 0);
    const amygdalaCount = graph.amygdala.size;
    const reasons: string[] = [];
    if (enrichmentNodes === 0) reasons.push('no enrichment beyond the scanner (no seed/llm/command nodes)');
    if (amygdalaCount === 0) reasons.push('no incident memory yet');
    if (freshness === 'never scanned') reasons.push('never scanned');
    const maturity = reasons.length === 0 ? 'enriched' : 'provisional';

    return {
        utilization_score: Math.round((1 - tv / 2) * 100) / 100,
        maturity,
        maturity_reasons: reasons,
        freshness,
        regions: out,
        amygdala: {
            entries: amygdalaCount,
            note: amygdalaCount === 0
                ? 'no incidents recorded yet (healthy) — but if debugging sessions happen without deposits, the Reflex loop is being skipped'
                : `${amygdalaCount} incident(s) in threat memory`,
        },
        origin_mix: originMix,
        low_confidence_nodes: lowConfidence,
    };
}
