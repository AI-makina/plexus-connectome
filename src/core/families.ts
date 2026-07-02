import { SynapseFamily } from '../types';

// ─── Evidence Protocol: the five synapse families (Roadmap 1.2) ───────────────
// Engine physics reads FAMILIES; the 27 legacy type labels survive as subtype
// metadata the LLM can interpret at consult time. Derived, never stored — a
// pure function of type, so no schema migration and unknown external type
// strings degrade gracefully to the default family.
//
//   DEPENDS_ON     structural/operational dependency (hosts the binding-time
//                  amplifier). Breakage flows downstream; readers are affected
//                  by modifications (reverse traversal).
//   INVOKES        runtime causality — calls, events, scheduling, routing.
//                  Conditional blast radius; no compile-time error surfaces it.
//   EXCHANGES      data movement — reads/writes/transforms/caches. Read/write
//                  asymmetry; writers reach all readers on modify.
//   CONTRACTS      shared shapes and validation — breaking changes propagate
//                  at FULL strength, ignoring distance decay.
//   CO_FAILED_WITH incident-learned causality that exists in no file content.
//                  Always surfaces; never decays with distance.

const FAMILY_MAP: Record<string, SynapseFamily> = {
    // DEPENDS_ON
    imports: 'DEPENDS_ON',
    inherits: 'DEPENDS_ON',
    composes: 'DEPENDS_ON',
    wraps: 'DEPENDS_ON',
    depends_on: 'DEPENDS_ON',
    configures: 'DEPENDS_ON',
    overrides: 'DEPENDS_ON',
    styles: 'DEPENDS_ON',    // no distinct physics — metadata-only subtype
    animates: 'DEPENDS_ON',  // no distinct physics — metadata-only subtype

    // INVOKES
    calls: 'INVOKES',
    triggers: 'INVOKES',
    renders: 'INVOKES',
    emits: 'INVOKES',
    subscribes: 'INVOKES',
    listens: 'INVOKES',
    schedules: 'INVOKES',
    redirects: 'INVOKES',
    routes_to: 'INVOKES',

    // EXCHANGES
    queries: 'EXCHANGES',
    mutates: 'EXCHANGES',
    provides: 'EXCHANGES',
    consumes: 'EXCHANGES',
    transforms: 'EXCHANGES',
    caches: 'EXCHANGES',

    // CONTRACTS
    validates: 'CONTRACTS',
    guards: 'CONTRACTS',

    // CO_FAILED_WITH
    amygdala_warning: 'CO_FAILED_WITH',
};

/** Unknown/external type strings default to DEPENDS_ON (weakest assumptions). */
export function familyOf(type: string): SynapseFamily {
    return FAMILY_MAP[type] || 'DEPENDS_ON';
}

// Read-type original_type values external agents may stamp (spec §4.2) — the
// reverse-traversal whitelist honors them alongside the family rule.
export const READ_ORIGINAL_TYPES = ['reads', 'uses', 'backed_by', 'implements', 'fetches', 'connects'];

/**
 * Should a MODIFY simulation traverse this incoming edge in reverse?
 * When node A is modified, everything that depends on / reads from /
 * invokes A is affected. This replaces the old 4-type whitelist that never
 * fired on real scanned data (the scanner only emits imports/renders/calls/
 * composes — none of which were listed).
 */
export function reverseTraversesOnModify(type: string, originalType?: string): boolean {
    if (originalType && READ_ORIGINAL_TYPES.includes(originalType)) return true;
    const family = familyOf(type);
    return family === 'DEPENDS_ON' || family === 'INVOKES' || family === 'EXCHANGES';
}
