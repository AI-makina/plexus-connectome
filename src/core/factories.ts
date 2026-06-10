import { v4 as uuidv4 } from 'uuid';
import { PlexusNode, PlexusSynapse, AmygdalaEntry, Region } from '../types';
import { graph } from './graph';

export function createNode(partial: Partial<PlexusNode> & { name: string; type: PlexusNode['type']; region: Region; file_path: string }): PlexusNode {
    const now = new Date().toISOString();
    return {
        id: partial.id || uuidv4(),
        name: partial.name,
        type: partial.type,
        region: partial.region,
        file_path: partial.file_path,
        line_range: partial.line_range,
        description: partial.description || `${partial.type} ${partial.name}`,
        metadata: partial.metadata || {},
        tags: partial.tags || [],
        health: partial.health || {
            stability_score: 1.0,
            change_frequency: 'low',
            last_modified: now,
            amygdala_warnings: 0,
            test_coverage: 0,
            connection_count: 0,
            cross_region_connections: 0,
        },
        position_3d: partial.position_3d || { x: 0, y: 0, z: 0 },
        status: partial.status || 'active',
        code: partial.code || `ND-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        created_at: partial.created_at || now,
        updated_at: partial.updated_at || now,
    };
}

export function createSynapse(partial: Partial<PlexusSynapse> & { source_node_id: string; target_node_id: string; type: PlexusSynapse['type'] }): PlexusSynapse {
    const srcNode = graph.nodes.get(partial.source_node_id);
    const tgtNode = graph.nodes.get(partial.target_node_id);
    const crossRegion = srcNode && tgtNode ? srcNode.region !== tgtNode.region : partial.cross_region ?? false;
    const bridged: Region[] = crossRegion && srcNode && tgtNode ? [srcNode.region, tgtNode.region] : partial.regions_bridged || [];

    return {
        id: partial.id || uuidv4(),
        source_node_id: partial.source_node_id,
        target_node_id: partial.target_node_id,
        type: partial.type,
        strength: partial.strength ?? 1.0,
        direction: partial.direction || 'unidirectional',
        description: partial.description || `${partial.type} connection`,
        metadata: partial.metadata || {},
        cross_region: crossRegion,
        regions_bridged: bridged,
        status: partial.status || 'active',
        code: partial.code || `SYN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        created_at: partial.created_at || new Date().toISOString(),
    };
}

export function createAmygdalaEntry(partial: Partial<AmygdalaEntry> & { title: string; severity: AmygdalaEntry['severity'] }): AmygdalaEntry {
    return {
        id: partial.id || uuidv4(),
        title: partial.title,
        severity: partial.severity,
        date_occurred: partial.date_occurred || new Date().toISOString(),
        attempted_change: partial.attempted_change || {
            description: '',
            nodes_touched: [],
            regions_affected: [],
        },
        failure_mode: partial.failure_mode || {
            what_broke: '',
            cascade_path: [],
            error_messages: [],
            time_to_detect: '',
            blast_radius: 0,
        },
        rollback: partial.rollback || {
            method: '',
            time_to_rollback: '',
            data_loss: false,
        },
        lessons_learned: partial.lessons_learned || [],
        prevention_rules: partial.prevention_rules || [],
        related_entries: partial.related_entries || [],
        status: partial.status || 'active',
    };
}
