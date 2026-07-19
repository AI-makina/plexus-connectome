export type Region =
    | 'frontal_lobe'
    | 'temporal_lobe'
    | 'occipital_lobe'
    | 'parietal_lobe'
    | 'cerebellum'
    | 'brain_stem'
    | 'limbic_system'
    | 'amygdala'
    | 'corpus_callosum';

export type NodeType =
    | 'function' | 'component' | 'route' | 'schema' | 'config' | 'style'
    | 'hook' | 'event' | 'middleware' | 'migration' | 'test' | 'workflow'
    | 'endpoint' | 'model' | 'util' | 'constant' | 'type' | 'interface'
    | 'module' | 'page' | 'layout' | 'provider' | 'context' | 'store'
    | 'reducer' | 'action' | 'selector' | 'animation' | 'asset'
    | 'env_var' | 'script' | 'class'
    // Evidence Protocol / Taxonomy v2 element planes (facets + concepts +
    // artifact-parsed elements):
    | 'facet' | 'feature' | 'flow' | 'journey' | 'service' | 'entity'
    | 'data_store' | 'deploy_target' | 'pipeline' | 'contract'
    | 'template' | 'token_set' | 'command' | 'dependency_manifest';

// The five synapse families engine physics reads (Roadmap 1.2). Derived from
// the 27 legacy type labels via core/families.ts — never stored.
export type SynapseFamily = 'DEPENDS_ON' | 'INVOKES' | 'EXCHANGES' | 'CONTRACTS' | 'CO_FAILED_WITH';

export interface NodeHealth {
    stability_score: number;
    change_frequency: 'high' | 'medium' | 'low';
    last_modified: string;
    amygdala_warnings: number;
    test_coverage: number;
    connection_count: number;
    cross_region_connections: number;
}

export interface NodePosition {
    x: number;
    y: number;
    z: number;
}

export interface NodeMetadata {
    /**
     * Provenance plane — the governing axis of trust (Evidence Protocol):
     * - 'scan':    map fact, derived by the analyzer; replaceable by re-scans.
     * - 'seed':    genesis-planned; survives re-scans (reconciled by file+name).
     * - 'llm':     belief fact proposed by an AI; decays, seeks confirmation.
     * - 'incident': born from the failure loop; append-only.
     * - 'command': written via the REST API / command queue by an external agent.
     * Absent on legacy nodes — treated as 'scan' by re-scan replacement logic.
     */
    origin?: 'scan' | 'seed' | 'llm' | 'incident' | 'command';
    /** winning-signal share from the classifier; < 0.5 belongs in a review queue */
    classification_confidence?: number;
    language?: string;
    framework?: string;
    exports?: string[];
    imports?: string[];
    parameters?: any[];
    returns?: any;
    side_effects?: string[];
    error_modes?: string[];
    jsx_children?: string[];
    css_classes?: string[];
    env_vars_used?: string[];
    hooks_used?: string[];
    state_shape?: any;
    route_pattern?: string;
    http_method?: string;
    middleware_chain?: string[];
}

export interface PlexusNode {
    id: string;
    name: string;
    type: NodeType;
    region: Region;
    file_path: string;
    line_range?: { start: number; end: number };
    description: string;
    metadata: NodeMetadata;
    tags: string[];
    health: NodeHealth;
    position_3d: NodePosition;
    /** 'planned' = seeded at Genesis before code exists; the scanner
     *  reconciles planned→active by (file_path, name) when code lands. */
    status: 'active' | 'dormant' | 'planned';
    dormant_reason?: string;
    dormant_since?: string;
    was_connected_to?: string[];
    code: string;
    created_at: string;
    updated_at: string;
}

export type SynapseType =
    | 'imports' | 'calls' | 'triggers' | 'renders' | 'queries' | 'mutates'
    | 'listens' | 'provides' | 'consumes' | 'inherits' | 'overrides' | 'routes_to'
    | 'validates' | 'transforms' | 'caches' | 'schedules' | 'wraps' | 'composes'
    | 'depends_on' | 'configures' | 'styles' | 'animates' | 'guards' | 'redirects'
    | 'emits' | 'subscribes'
    | 'amygdala_warning';

export interface SynapseMetadata {
    data_shape_transferred?: any;
    is_async?: boolean;
    can_fail?: boolean;
    failure_impact?: 'critical' | 'high' | 'moderate' | 'low' | 'none';
    fallback_exists?: boolean;
    conditional?: string;
    intrinsic_importance?: number;
    cascade_influence?: number;
    impact_classification?: 'critical' | 'high' | 'moderate' | 'low';
    /**
     * When is this dependency evaluated?
     * - 'import': Evaluated once at module load — target caches the value forever.
     *   Changes to the source node will NOT propagate without a full restart/reload.
     *   HIGH RISK for any source node that can change at runtime (config, env vars, settings).
     * - 'startup': Evaluated once at application boot — similar to import but happens later.
     * - 'runtime': Evaluated on every call — changes propagate immediately. Default.
     * - 'event': Evaluated when a specific event fires (pub/sub, webhook, callback).
     */
    binding_time?: 'import' | 'startup' | 'runtime' | 'event';
}

export interface PlexusSynapse {
    id: string;
    source_node_id: string;
    target_node_id: string;
    type: SynapseType;
    strength: number;
    direction: 'unidirectional' | 'bidirectional';
    description: string;
    metadata: SynapseMetadata;
    cross_region: boolean;
    regions_bridged: Region[];
    status: 'active' | 'dormant';
    dormant_reason?: string;
    dormant_since?: string;
    code: string;
    created_at: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AmygdalaEntry {
    id: string;
    title: string;
    severity: Severity;
    date_occurred: string;
    attempted_change: {
        description: string;
        nodes_touched: string[];
        regions_affected: Region[];
        code_diff_ref?: string;
    };
    failure_mode: {
        what_broke: string;
        cascade_path: string[];
        error_messages: string[];
        time_to_detect: string;
        blast_radius: number;
    };
    rollback: {
        method: string;
        time_to_rollback: string;
        data_loss: boolean;
    };
    lessons_learned: string[];
    prevention_rules: {
        trigger_nodes: string[];
        warning_message: string;
        auto_surface: boolean;
    }[];
    related_entries: string[];
    status: 'active' | 'resolved' | 'superseded';
}

// ─── Resolution lifecycle ────────────────────────────────────────────────
// A first-class record of an ISSUE and its fix-status over time — the layer that
// links nodes (what was touched), amygdala (failed attempts), and invariants
// (cemented truth). App-agnostic: any app that plugs into Plexus reads/writes these.

/** Where a fix sits in its lifecycle.
 *  wip → applied → conditional (AI-tested, a PROXY) → unconditional (user-confirmed).
 *  partial / failed are terminal-ish; regression_risk = was unconditional but a later
 *  change's simulation rippled into it (auto-demoted); blocked = can't fix without
 *  breaking a cemented resolution. */
export type ResolutionStatus =
    | 'wip' | 'applied' | 'conditional' | 'unconditional'
    | 'partial' | 'failed' | 'regression_risk' | 'blocked';

/** The user's verdict from the confirmation prompt ([Solved][Partially][Not solved]). */
export type ConfirmationVerdict = 'unconfirmed' | 'solved' | 'partial' | 'not_solved';

export interface Resolution {
    id: string;
    /** Quick human description of the issue — what the confirm box shows. */
    issue: string;
    /** Node ids the fix touched (the visual targets on the connectome). */
    target_nodes: string[];
    status: ResolutionStatus;
    confirmation: ConfirmationVerdict;
    /** User's note on confirm — a verdict OR a request for info (bidirectional). */
    comment?: string;
    /** Linked amygdala entries — the failed attempts for this issue. */
    amygdala_ids: string[];
    /** Set when cemented: user-confirmed unconditional fixes become an invariant. */
    invariant_id?: string;
    /** The blast-radius simulation captured when the fix was applied. */
    simulation_ref?: string;
    /** How many times this issue has been worked (thrash signal). */
    attempts: number;
    /** Which app created it (areopagus, terminal, …) — provenance, no coupling. */
    source_app?: string;
    created_at: string;
    updated_at: string;
    confirmed_at?: string;
}

// Simulation types (moved from simulator.ts)
export interface ImpactNode {
    node_id: string;
    node_name: string;
    region: string;
    impact_level: 'critical' | 'high' | 'moderate' | 'low';
    distance_from_source: number;
    connection_path: string[];
    amygdala_warnings: AmygdalaEntry[];
    /** reached through a planned (not-yet-built) node — advisory, not risk */
    planned?: boolean;
}

export interface SimulationResult {
    id: string;
    source_nodes: string[];
    change_type: string;
    timestamp: string;
    total_affected: number;
    blast_radius: ImpactNode[];
    amygdala_alerts: number;
    risk_score: number;
    recommendation: string;
    /** planned-node reaches (0.5× strength) — reported separately, never in risk_score */
    planned_impact?: number;
    /** Resolutions whose fixed nodes lie in this change's blast radius — the
     *  regression gate. An 'unconditional' hit means the change threatens a
     *  user-confirmed fix; a real (non-dryRun) sim demotes it to regression_risk. */
    resolution_conflicts?: ResolutionConflict[];
}

export interface ResolutionConflict {
    resolution_id: string;
    issue: string;
    status: ResolutionStatus;
    confirmation: ConfirmationVerdict;
    /** the affected target nodes (intersection with the blast radius) */
    nodes: string[];
}

// Analysis status
export interface AnalysisStatus {
    running: boolean;
    progress: number; // 0-100
    current_file: string;
    files_total: number;
    files_processed: number;
    nodes_created: number;
    synapses_created: number;
    started_at: string | null;
    completed_at: string | null;
    errors: string[];
}

// Manifest types
export interface PlexusManifest {
    plexus_version: string;
    // Integration v2 identity stamps (backfilled on engine boot for older brains):
    // brain_id changes when a brain is deleted+recreated (engine lifecycle guard);
    // project_id is the stable door identity used by `plexus work` and launch auths.
    brain_id?: string;
    project_id?: string;
    target_app: {
        name: string;
        root_path: string;
        languages: string[];
        frameworks: string[];
        entry_points: string[];
        ignore_patterns: string[];
    };
    server: {
        api_port: number;
        ws_port: number;
        host: string;
    };
    analysis: {
        auto_analyze_on_start: boolean;
        watch_for_changes: boolean;
        depth: string;
        include_tests: boolean;
        include_configs: boolean;
    };
    visualization: {
        theme: string;
        background_color: string;
        enable_bloom: boolean;
        enable_fog: boolean;
        enable_audio: boolean;
        default_camera_position: { x: number; y: number; z: number };
        // Cosmetic label for the viz header only — never used to resolve a
        // brain (that is always path + target_app.name), so renaming it can
        // break nothing.
        display_name?: string;
    };
    regions: {
        custom_overrides: Record<string, Region>;
        classification_hints: Record<string, Region>;
    };
}

// Snapshot types
export interface SnapshotMeta {
    id: string;
    timestamp: string;
    description: string;
    node_count: number;
    synapse_count: number;
    amygdala_count: number;
}

export interface SnapshotFull extends SnapshotMeta {
    data: {
        nodes: PlexusNode[];
        synapses: PlexusSynapse[];
        amygdala: AmygdalaEntry[];
    };
}

// Region statistics
export interface RegionStats {
    region: Region;
    node_count: number;
    synapse_count: number;
    cross_region_synapses: number;
    avg_health: number;
    node_types: Record<string, number>;
}
