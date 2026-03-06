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
    | 'env_var' | 'script' | 'class';

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
    status: 'active' | 'dormant';
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

// Simulation types (moved from simulator.ts)
export interface ImpactNode {
    node_id: string;
    node_name: string;
    region: string;
    impact_level: 'critical' | 'high' | 'moderate' | 'low';
    distance_from_source: number;
    connection_path: string[];
    amygdala_warnings: AmygdalaEntry[];
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
