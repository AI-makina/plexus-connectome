import { PlexusNode, PlexusSynapse, AmygdalaEntry, Region, Severity } from '../types';
import { createNode, createSynapse, createAmygdalaEntry } from './factories';
import { graph } from './graph';

// ─── Evidence Protocol: write-path validation (Roadmap 0.1) ───────────────────
// Every external write — REST body or command-queue entry — passes through here
// BEFORE any in-memory or DB mutation. Hand-rolled on purpose: zero new runtime
// dependencies, and the rules include SEMANTIC policy that no generic schema
// library expresses (e.g. "nodes may never claim the amygdala region").

export type Validation<T> =
    | { ok: true; value: T; warnings: string[] }
    | { ok: false; errors: string[] };

const REGIONS: Region[] = [
    'frontal_lobe', 'temporal_lobe', 'occipital_lobe', 'parietal_lobe',
    'cerebellum', 'brain_stem', 'limbic_system', 'amygdala', 'corpus_callosum',
];

const NODE_STATUSES = ['active', 'dormant', 'planned'];
const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const AMYGDALA_STATUSES = ['active', 'resolved', 'superseded'];

const isNonEmptyString = (v: any): v is string => typeof v === 'string' && v.trim().length > 0;
const isPlainObject = (v: any): v is Record<string, any> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);

// ─── Nodes ────────────────────────────────────────────────────────────────────

export function validateNodeInput(
    input: any,
    opts: { partial?: boolean; existingRegion?: Region } = {},
): Validation<any> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isPlainObject(input)) return { ok: false, errors: ['node payload must be an object'] };

    const check = (field: string, required: boolean, test: (v: any) => boolean, msg: string) => {
        const present = input[field] !== undefined && input[field] !== null;
        if (!present) {
            if (required && !opts.partial) errors.push(`${field} is required`);
            return;
        }
        if (!test(input[field])) errors.push(msg);
    };

    check('name', true, isNonEmptyString, 'name must be a non-empty string');
    check('type', true, isNonEmptyString, 'type must be a non-empty string');
    check('file_path', true, isNonEmptyString, 'file_path must be a non-empty string');
    check('region', true, (v) => REGIONS.includes(v), `region must be one of: ${REGIONS.join(', ')}`);
    check('status', false, (v) => NODE_STATUSES.includes(v), `status must be one of: ${NODE_STATUSES.join(', ')}`);
    check('description', false, (v) => typeof v === 'string', 'description must be a string');
    check('tags', false, Array.isArray, 'tags must be an array');
    check('metadata', false, isPlainObject, 'metadata must be an object');
    check('line_range', false, (v) => isPlainObject(v) && typeof v.start === 'number' && typeof v.end === 'number',
        'line_range must be { start: number, end: number }');

    // SEMANTIC POLICY: the amygdala holds AmygdalaEntry records, never graph
    // nodes. Incidents arrive via log_amygdala / POST /api/amygdala only.
    // (This exact combination — legal per the TS types — is how a real project
    // ended up with incidents stored as type:'function' nodes.)
    // Read-modify-write escape: updating a LEGACY node that already sits in
    // the amygdala region may echo its region back; only writes that INTRODUCE
    // or MOVE a node into the region are rejected.
    if (input.region === 'amygdala' && opts.existingRegion !== 'amygdala') {
        errors.push(
            "nodes may not claim region 'amygdala' — record incidents as amygdala entries (log_amygdala / POST /api/amygdala)"
        );
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: input, warnings };
}

/** Validate + normalize a full node create. Returns a complete PlexusNode. */
export function validateAndBuildNode(input: any, origin: 'command' | 'llm' = 'command'): Validation<PlexusNode> {
    const v = validateNodeInput(input);
    if (!v.ok) return v;
    // Provenance discipline: external writers may DECLARE seed/llm/incident/
    // command provenance, but may never claim 'scan' — scan is reserved for
    // the analyzer, because re-scans are allowed to replace scan facts.
    const declared = isPlainObject(input.metadata) ? input.metadata.origin : undefined;
    const finalOrigin = ['seed', 'llm', 'incident', 'command'].includes(declared) ? declared : origin;
    const metadata = { ...(isPlainObject(input.metadata) ? input.metadata : {}), origin: finalOrigin };
    const node = createNode({ ...input, metadata });
    return { ok: true, value: node, warnings: v.warnings };
}

// ─── Synapses ─────────────────────────────────────────────────────────────────

export function validateSynapseInput(input: any, opts: { partial?: boolean } = {}): Validation<any> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isPlainObject(input)) return { ok: false, errors: ['synapse payload must be an object'] };

    if (!opts.partial || input.source_node_id !== undefined) {
        if (!isNonEmptyString(input.source_node_id)) errors.push('source_node_id is required');
        else if (!graph.nodes.has(input.source_node_id)) errors.push(`source_node_id '${input.source_node_id}' does not exist — dangling synapses are rejected`);
    }
    if (!opts.partial || input.target_node_id !== undefined) {
        if (!isNonEmptyString(input.target_node_id)) errors.push('target_node_id is required');
        else if (!graph.nodes.has(input.target_node_id)) errors.push(`target_node_id '${input.target_node_id}' does not exist — dangling synapses are rejected`);
    }
    if (!opts.partial || input.type !== undefined) {
        if (!isNonEmptyString(input.type)) errors.push('type is required');
    }

    if (input.strength !== undefined && input.strength !== null) {
        if (typeof input.strength !== 'number' || Number.isNaN(input.strength)) {
            errors.push('strength must be a number');
        } else if (input.strength < 0 || input.strength > 1) {
            // External contract is the 0–1 scale (spec §4.2). The analyzer's
            // internal cascade weighting may exceed it, but external writers
            // may not silently inflate blast radii.
            warnings.push(`strength ${input.strength} clamped to [0, 1]`);
            input.strength = Math.max(0, Math.min(1, input.strength));
        }
    }
    if (input.metadata !== undefined && input.metadata !== null && !isPlainObject(input.metadata)) {
        errors.push('metadata must be an object');
    }
    if (input.direction !== undefined && !['unidirectional', 'bidirectional'].includes(input.direction)) {
        errors.push("direction must be 'unidirectional' or 'bidirectional'");
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: input, warnings };
}

export function validateAndBuildSynapse(input: any): Validation<PlexusSynapse> {
    const v = validateSynapseInput(input);
    if (!v.ok) return v;
    const syn = createSynapse(input);
    return { ok: true, value: syn, warnings: v.warnings };
}

// ─── Amygdala entries ─────────────────────────────────────────────────────────

export function validateAndBuildAmygdala(input: any): Validation<AmygdalaEntry> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isPlainObject(input)) return { ok: false, errors: ['amygdala payload must be an object'] };

    if (!isNonEmptyString(input.title)) errors.push('title is required');
    if (!SEVERITIES.includes(input.severity)) errors.push(`severity must be one of: ${SEVERITIES.join(', ')}`);
    if (input.status !== undefined && !AMYGDALA_STATUSES.includes(input.status)) {
        errors.push(`status must be one of: ${AMYGDALA_STATUSES.join(', ')}`);
    }
    if (input.prevention_rules !== undefined) {
        if (!Array.isArray(input.prevention_rules)) {
            errors.push('prevention_rules must be an array');
        } else {
            for (const rule of input.prevention_rules) {
                if (!isPlainObject(rule) || !Array.isArray(rule.trigger_nodes)) {
                    errors.push('each prevention_rule must be an object with a trigger_nodes array');
                    break;
                }
            }
        }
    }
    for (const arrField of ['lessons_learned', 'related_entries']) {
        if (input[arrField] !== undefined && !Array.isArray(input[arrField])) {
            errors.push(`${arrField} must be an array`);
        }
    }

    if (errors.length > 0) return { ok: false, errors };

    // Normalize through the factory: fills id, date, and every object/array
    // field — the missing-failure_mode crash class becomes impossible.
    const entry = createAmygdalaEntry(input as Parameters<typeof createAmygdalaEntry>[0]);
    return { ok: true, value: entry, warnings };
}

// ─── Command queue ────────────────────────────────────────────────────────────

const KNOWN_ACTIONS = [
    'add_node', 'add_synapse', 'log_amygdala',
    'update_node', 'delete_node', 'update_synapse', 'delete_synapse',
];

export function validateCommand(cmd: any): Validation<{ action: string; data: any }> {
    if (!isPlainObject(cmd)) return { ok: false, errors: ['command must be an object'] };
    if (!KNOWN_ACTIONS.includes(cmd.action)) {
        return { ok: false, errors: [`unknown action '${cmd.action}' — known: ${KNOWN_ACTIONS.join(', ')}`] };
    }
    if (!isPlainObject(cmd.data)) return { ok: false, errors: [`${cmd.action}: data must be an object`] };
    if (['update_node', 'delete_node', 'update_synapse', 'delete_synapse'].includes(cmd.action) && !isNonEmptyString(cmd.data.id)) {
        return { ok: false, errors: [`${cmd.action}: data.id is required`] };
    }
    return { ok: true, value: { action: cmd.action, data: cmd.data }, warnings: [] };
}
