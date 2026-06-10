import { getDb } from '../db/sqlite';
import { PlexusNode, PlexusSynapse, AmygdalaEntry, Region, RegionStats, SnapshotMeta, SnapshotFull } from '../types';
import { getIntegrationPath } from './context';
import Fuse from 'fuse.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

class ConnectomeGraph {
    public nodes: Map<string, PlexusNode> = new Map();
    public synapses: Map<string, PlexusSynapse> = new Map();
    public amygdala: Map<string, AmygdalaEntry> = new Map();

    // Adjacency list: nodeId -> [outgoing synapse ids], [incoming synapse ids]
    public adjacency: Map<string, { out: string[], in: string[] }> = new Map();

    private nodeSearchIndex: Fuse<PlexusNode>;

    constructor() {
        this.nodeSearchIndex = new Fuse([], {
            keys: ['name', 'description', 'tags', 'file_path', 'type', 'region'],
            threshold: 0.3,
        });
    }

    // ─── Load ────────────────────────────────────────────────────────

    public loadFromDb() {
        const db = getDb();

        this.nodes.clear();
        this.synapses.clear();
        this.amygdala.clear();
        this.adjacency.clear();

        const dbNodes = db.prepare('SELECT * FROM nodes').all() as any[];
        for (const row of dbNodes) {
            const node: PlexusNode = {
                ...row,
                line_range: row.line_range ? JSON.parse(row.line_range) : undefined,
                metadata: JSON.parse(row.metadata),
                tags: JSON.parse(row.tags),
                health: JSON.parse(row.health),
                position_3d: JSON.parse(row.position_3d)
            };
            this.nodes.set(node.id, node);
            this.adjacency.set(node.id, { out: [], in: [] });
        }

        const dbSynapses = db.prepare('SELECT * FROM synapses').all() as any[];
        for (const row of dbSynapses) {
            const syn: PlexusSynapse = {
                ...row,
                metadata: JSON.parse(row.metadata),
                cross_region: row.cross_region === 1,
                regions_bridged: JSON.parse(row.regions_bridged)
            };
            this.synapses.set(syn.id, syn);

            const srcMap = this.adjacency.get(syn.source_node_id);
            if (srcMap) srcMap.out.push(syn.id);

            const tgtMap = this.adjacency.get(syn.target_node_id);
            if (tgtMap) tgtMap.in.push(syn.id);
        }

        // Tolerant parsers: legacy/manual amygdala rows may store null for array/object fields.
        // A null prevention_rules used to crash the simulator and /api/amygdala/check (.some on null).
        const parseArr = (v: any): any[] => {
            try { const p = v != null ? JSON.parse(v) : []; return Array.isArray(p) ? p : []; }
            catch { return []; }
        };
        const parseObj = (v: any): any => {
            try { const p = v != null ? JSON.parse(v) : {}; return (p && typeof p === 'object') ? p : {}; }
            catch { return {}; }
        };
        const dbAmygdala = db.prepare('SELECT * FROM amygdala').all() as any[];
        for (const row of dbAmygdala) {
            const entry: AmygdalaEntry = {
                ...row,
                attempted_change: parseObj(row.attempted_change),
                failure_mode: parseObj(row.failure_mode),
                rollback: parseObj(row.rollback),
                lessons_learned: parseArr(row.lessons_learned),
                prevention_rules: parseArr(row.prevention_rules),
                related_entries: parseArr(row.related_entries)
            };
            this.amygdala.set(entry.id, entry);
        }

        this.rebuildSearchIndex();
    }

    public rebuildSearchIndex() {
        this.nodeSearchIndex.setCollection(Array.from(this.nodes.values()));
    }

    public searchNodes(query: string) {
        return this.nodeSearchIndex.search(query).map(r => r.item);
    }

    // ─── Node CRUD ───────────────────────────────────────────────────

    public addNode(node: PlexusNode) {
        node.code = node.code || `ND-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        node.status = node.status || 'active';

        this.nodes.set(node.id, node);
        if (!this.adjacency.has(node.id)) {
            this.adjacency.set(node.id, { out: [], in: [] });
        }

        const db = getDb();
        db.prepare(`
      INSERT INTO nodes (
        id, name, type, region, file_path, line_range, description, metadata, tags, health, position_3d, status, dormant_reason, dormant_since, was_connected_to, code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, type=excluded.type, region=excluded.region, file_path=excluded.file_path,
        line_range=excluded.line_range, description=excluded.description, metadata=excluded.metadata,
        tags=excluded.tags, health=excluded.health, position_3d=excluded.position_3d, status=excluded.status,
        dormant_reason=excluded.dormant_reason, dormant_since=excluded.dormant_since,
        was_connected_to=excluded.was_connected_to, code=excluded.code, updated_at=excluded.updated_at
    `).run(
            node.id, node.name, node.type, node.region, node.file_path,
            node.line_range ? JSON.stringify(node.line_range) : null,
            node.description, JSON.stringify(node.metadata), JSON.stringify(node.tags),
            JSON.stringify(node.health), JSON.stringify(node.position_3d),
            node.status, node.dormant_reason || null, node.dormant_since || null,
            node.was_connected_to ? JSON.stringify(node.was_connected_to) : null, node.code,
            node.created_at, node.updated_at
        );

        this.nodeSearchIndex.add(node);
        this.autoSave();
    }

    public updateNode(id: string, updates: Partial<PlexusNode>): PlexusNode | null {
        const existing = this.nodes.get(id);
        if (!existing) return null;

        const updated: PlexusNode = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
        updated.code = updated.code || existing.code || `ND-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        updated.status = updated.status || existing.status || 'active';

        this.nodes.set(id, updated);

        const db = getDb();
        db.prepare(`
      INSERT INTO nodes (
        id, name, type, region, file_path, line_range, description, metadata, tags, health, position_3d, status, dormant_reason, dormant_since, was_connected_to, code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, type=excluded.type, region=excluded.region, file_path=excluded.file_path,
        line_range=excluded.line_range, description=excluded.description, metadata=excluded.metadata,
        tags=excluded.tags, health=excluded.health, position_3d=excluded.position_3d, status=excluded.status,
        dormant_reason=excluded.dormant_reason, dormant_since=excluded.dormant_since,
        was_connected_to=excluded.was_connected_to, code=excluded.code, updated_at=excluded.updated_at
    `).run(
            updated.id, updated.name, updated.type, updated.region, updated.file_path,
            updated.line_range ? JSON.stringify(updated.line_range) : null,
            updated.description, JSON.stringify(updated.metadata), JSON.stringify(updated.tags),
            JSON.stringify(updated.health), JSON.stringify(updated.position_3d),
            updated.status, updated.dormant_reason || null, updated.dormant_since || null,
            updated.was_connected_to ? JSON.stringify(updated.was_connected_to) : null, updated.code,
            updated.created_at, updated.updated_at
        );

        this.rebuildSearchIndex();
        this.autoSave();
        return updated;
    }

    public deleteNode(id: string): boolean {
        if (!this.nodes.has(id)) return false;

        // Cascade: remove all synapses connected to this node
        const adj = this.adjacency.get(id);
        if (adj) {
            const allSynapseIds = [...adj.out, ...adj.in];
            for (const synId of allSynapseIds) {
                this.removeSynapseInMemory(synId);
            }
        }

        this.nodes.delete(id);
        this.adjacency.delete(id);

        const db = getDb();
        db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
        // DB cascade handles synapse deletion

        this.rebuildSearchIndex();
        this.autoSave();
        return true;
    }

    // ─── Synapse CRUD ────────────────────────────────────────────────

    public addSynapse(syn: PlexusSynapse) {
        syn.code = syn.code || `SYN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        syn.status = syn.status || 'active';

        this.synapses.set(syn.id, syn);

        const srcMap = this.adjacency.get(syn.source_node_id);
        if (srcMap && !srcMap.out.includes(syn.id)) srcMap.out.push(syn.id);

        const tgtMap = this.adjacency.get(syn.target_node_id);
        if (tgtMap && !tgtMap.in.includes(syn.id)) tgtMap.in.push(syn.id);

        const db = getDb();
        db.prepare(`
      INSERT OR REPLACE INTO synapses (
        id, source_node_id, target_node_id, type, strength, direction, description, metadata, cross_region, regions_bridged, status, dormant_reason, dormant_since, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            syn.id, syn.source_node_id, syn.target_node_id, syn.type, syn.strength, syn.direction,
            syn.description, JSON.stringify(syn.metadata), syn.cross_region ? 1 : 0,
            JSON.stringify(syn.regions_bridged), syn.status, syn.dormant_reason || null,
            syn.dormant_since || null, syn.code, syn.created_at
        );

        this.autoSave();
    }

    public updateSynapse(id: string, updates: Partial<PlexusSynapse>): PlexusSynapse | null {
        const existing = this.synapses.get(id);
        if (!existing) return null;

        const updated: PlexusSynapse = { ...existing, ...updates, id };
        updated.code = updated.code || existing.code || `SYN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        updated.status = updated.status || existing.status || 'active';

        this.synapses.set(id, updated);

        const db = getDb();
        db.prepare(`
      INSERT OR REPLACE INTO synapses (
        id, source_node_id, target_node_id, type, strength, direction, description, metadata, cross_region, regions_bridged, status, dormant_reason, dormant_since, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            updated.id, updated.source_node_id, updated.target_node_id, updated.type,
            updated.strength, updated.direction, updated.description,
            JSON.stringify(updated.metadata), updated.cross_region ? 1 : 0,
            JSON.stringify(updated.regions_bridged), updated.status, updated.dormant_reason || null,
            updated.dormant_since || null, updated.code, updated.created_at
        );

        this.autoSave();
        return updated;
    }

    public deleteSynapse(id: string): boolean {
        if (!this.synapses.has(id)) return false;

        this.removeSynapseInMemory(id);

        const db = getDb();
        db.prepare('DELETE FROM synapses WHERE id = ?').run(id);

        this.autoSave();
        return true;
    }

    private removeSynapseInMemory(synId: string) {
        const syn = this.synapses.get(synId);
        if (!syn) return;

        const srcAdj = this.adjacency.get(syn.source_node_id);
        if (srcAdj) srcAdj.out = srcAdj.out.filter(s => s !== synId);

        const tgtAdj = this.adjacency.get(syn.target_node_id);
        if (tgtAdj) tgtAdj.in = tgtAdj.in.filter(s => s !== synId);

        this.synapses.delete(synId);
    }

    // ─── Amygdala CRUD ───────────────────────────────────────────────

    public addAmygdalaEntry(entry: AmygdalaEntry) {
        // Normalize array fields so consumers (simulator, /amygdala/check) never .some() on null,
        // and so better-sqlite3 never gets an undefined binding.
        entry.prevention_rules = Array.isArray(entry.prevention_rules) ? entry.prevention_rules : [];
        entry.related_entries = Array.isArray(entry.related_entries) ? entry.related_entries : [];
        entry.lessons_learned = Array.isArray(entry.lessons_learned) ? entry.lessons_learned : [];
        this.amygdala.set(entry.id, entry);

        const db = getDb();
        db.prepare(`
      INSERT OR REPLACE INTO amygdala (
        id, title, severity, date_occurred, attempted_change, failure_mode, rollback, lessons_learned, prevention_rules, related_entries, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            entry.id, entry.title, entry.severity, entry.date_occurred,
            JSON.stringify(entry.attempted_change), JSON.stringify(entry.failure_mode),
            JSON.stringify(entry.rollback), JSON.stringify(entry.lessons_learned),
            JSON.stringify(entry.prevention_rules), JSON.stringify(entry.related_entries),
            entry.status
        );

        this.autoSave();
    }

    public updateAmygdalaEntry(id: string, updates: Partial<AmygdalaEntry>): AmygdalaEntry | null {
        const existing = this.amygdala.get(id);
        if (!existing) return null;

        const updated: AmygdalaEntry = { ...existing, ...updates, id };
        this.amygdala.set(id, updated);

        const db = getDb();
        db.prepare(`
      INSERT OR REPLACE INTO amygdala (
        id, title, severity, date_occurred, attempted_change, failure_mode, rollback, lessons_learned, prevention_rules, related_entries, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            updated.id, updated.title, updated.severity, updated.date_occurred,
            JSON.stringify(updated.attempted_change), JSON.stringify(updated.failure_mode),
            JSON.stringify(updated.rollback), JSON.stringify(updated.lessons_learned),
            JSON.stringify(updated.prevention_rules), JSON.stringify(updated.related_entries),
            updated.status
        );

        this.autoSave();
        return updated;
    }

    public deleteAmygdalaEntry(id: string): boolean {
        if (!this.amygdala.has(id)) return false;

        this.amygdala.delete(id);

        const db = getDb();
        db.prepare('DELETE FROM amygdala WHERE id = ?').run(id);

        this.autoSave();
        return true;
    }

    // ─── Queries ─────────────────────────────────────────────────────

    public getNodeConnections(nodeId: string): { incoming: PlexusSynapse[]; outgoing: PlexusSynapse[] } {
        const adj = this.adjacency.get(nodeId);
        if (!adj) return { incoming: [], outgoing: [] };

        return {
            outgoing: adj.out.map(id => this.synapses.get(id)!).filter(Boolean),
            incoming: adj.in.map(id => this.synapses.get(id)!).filter(Boolean),
        };
    }

    public getCrossRegionSynapses(): PlexusSynapse[] {
        return Array.from(this.synapses.values()).filter(s => s.cross_region);
    }

    public getRegionNodes(region: Region): PlexusNode[] {
        return Array.from(this.nodes.values()).filter(n => n.region === region);
    }

    public getRegionStats(): RegionStats[] {
        const regions = new Map<Region, { nodes: PlexusNode[]; synapses: number; crossRegion: number }>();

        for (const node of this.nodes.values()) {
            if (!regions.has(node.region)) {
                regions.set(node.region, { nodes: [], synapses: 0, crossRegion: 0 });
            }
            regions.get(node.region)!.nodes.push(node);
        }

        for (const syn of this.synapses.values()) {
            const srcNode = this.nodes.get(syn.source_node_id);
            if (srcNode && regions.has(srcNode.region)) {
                regions.get(srcNode.region)!.synapses++;
            }
            if (syn.cross_region) {
                const tgtNode = this.nodes.get(syn.target_node_id);
                if (srcNode && regions.has(srcNode.region)) regions.get(srcNode.region)!.crossRegion++;
                if (tgtNode && regions.has(tgtNode.region)) regions.get(tgtNode.region)!.crossRegion++;
            }
        }

        const stats: RegionStats[] = [];
        for (const [region, data] of regions) {
            const nodeTypes: Record<string, number> = {};
            let totalHealth = 0;
            for (const n of data.nodes) {
                nodeTypes[n.type] = (nodeTypes[n.type] || 0) + 1;
                totalHealth += n.health?.stability_score ?? 0;
            }
            stats.push({
                region,
                node_count: data.nodes.length,
                synapse_count: data.synapses,
                cross_region_synapses: data.crossRegion,
                avg_health: data.nodes.length > 0 ? totalHealth / data.nodes.length : 0,
                node_types: nodeTypes,
            });
        }

        return stats;
    }

    // ─── Snapshots ───────────────────────────────────────────────────

    public createSnapshot(description: string): SnapshotMeta {
        const id = uuidv4();
        const timestamp = new Date().toISOString();
        const state = this.getState();
        const meta: SnapshotMeta = {
            id,
            timestamp,
            description,
            node_count: state.nodes.length,
            synapse_count: state.synapses.length,
            amygdala_count: state.amygdala.length,
        };

        const db = getDb();
        db.prepare(`
      INSERT INTO snapshots (id, timestamp, description, node_count, synapse_count, amygdala_count, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, timestamp, description, meta.node_count, meta.synapse_count, meta.amygdala_count, JSON.stringify(state));

        return meta;
    }

    public getSnapshots(): SnapshotMeta[] {
        const db = getDb();
        const rows = db.prepare('SELECT id, timestamp, description, node_count, synapse_count, amygdala_count FROM snapshots ORDER BY timestamp DESC').all() as SnapshotMeta[];
        return rows;
    }

    public getSnapshot(id: string): SnapshotFull | null {
        const db = getDb();
        const row = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            timestamp: row.timestamp,
            description: row.description,
            node_count: row.node_count,
            synapse_count: row.synapse_count,
            amygdala_count: row.amygdala_count,
            data: JSON.parse(row.data),
        };
    }

    public diffSnapshots(aId: string, bId: string): { added_nodes: string[]; removed_nodes: string[]; added_synapses: string[]; removed_synapses: string[] } | null {
        const a = this.getSnapshot(aId);
        const b = this.getSnapshot(bId);
        if (!a || !b) return null;

        const aNodeIds = new Set(a.data.nodes.map(n => n.id));
        const bNodeIds = new Set(b.data.nodes.map(n => n.id));
        const aSynIds = new Set(a.data.synapses.map(s => s.id));
        const bSynIds = new Set(b.data.synapses.map(s => s.id));

        return {
            added_nodes: [...bNodeIds].filter(id => !aNodeIds.has(id)),
            removed_nodes: [...aNodeIds].filter(id => !bNodeIds.has(id)),
            added_synapses: [...bSynIds].filter(id => !aSynIds.has(id)),
            removed_synapses: [...aSynIds].filter(id => !bSynIds.has(id)),
        };
    }

    // ─── State Export ────────────────────────────────────────────────

    public getState() {
        const allNodes = Array.from(this.nodes.values());
        const allSynapses = Array.from(this.synapses.values());

        const activeNodes = allNodes.filter(n => n.status !== 'dormant');
        const dormantNodes = allNodes.filter(n => n.status === 'dormant');
        const activeSynapses = allSynapses.filter(s => s.status !== 'dormant');
        const dormantSynapses = allSynapses.filter(s => s.status === 'dormant');
        const amygdalaEntries = Array.from(this.amygdala.values());

        // Note: For backwards compatibility and UI integration, we return the flattened structures 
        // normally inside `nodes` and `synapses`, but also return the split schema structure exactly 
        // as the prompt requested for the LLM interaction file format.
        return {
            stats: {
                active_nodes: activeNodes.length,
                dormant_nodes: dormantNodes.length,
                active_synapses: activeSynapses.length,
                dormant_synapses: dormantSynapses.length,
                amygdala_entries: amygdalaEntries.length
            },
            nodes: allNodes,          // Raw UI consumed format
            synapses: allSynapses,    // Raw UI consumed format
            amygdala: amygdalaEntries,// Raw UI consumed format
            active: {
                nodes: activeNodes,
                synapses: activeSynapses
            },
            dormant: {
                nodes: dormantNodes,
                synapses: dormantSynapses
            }
        };
    }

    // ─── Auto-save ───────────────────────────────────────────────────

    private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

    private autoSave() {
        // Debounce: coalesce rapid mutations into a single write
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.flushToDisk();
        }, 100);
    }

    public flushToDisk() {
        let integrationDir: string;
        try {
            integrationDir = getIntegrationPath();
        } catch {
            return; // context not set yet (e.g. during analyze CLI)
        }

        // plexus-state.json
        const statePath = path.join(integrationDir, 'plexus-state.json');
        fs.writeFileSync(statePath, JSON.stringify(this.getState(), null, 2));

        // amygdala-log.json — human-readable
        const amygdalaPath = path.join(integrationDir, 'amygdala-log.json');
        const entries = Array.from(this.amygdala.values()).map(e => ({
            id: e.id,
            title: e.title,
            severity: e.severity,
            date: e.date_occurred,
            what_broke: e.failure_mode.what_broke,
            lessons: e.lessons_learned,
            status: e.status,
        }));
        fs.writeFileSync(amygdalaPath, JSON.stringify(entries, null, 2));
    }

    public saveSimulationReport(result: { id: string;[key: string]: any }) {
        let integrationDir: string;
        try {
            integrationDir = getIntegrationPath();
        } catch {
            return;
        }

        const reportsDir = path.join(integrationDir, 'impact-reports');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

        fs.writeFileSync(
            path.join(reportsDir, `${result.id}.json`),
            JSON.stringify(result, null, 2)
        );
    }
}

export const graph = new ConnectomeGraph();
