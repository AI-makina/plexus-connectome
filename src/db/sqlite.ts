import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export function initDb(integrationPath: string): Database.Database {
  if (!fs.existsSync(integrationPath)) {
    fs.mkdirSync(integrationPath, { recursive: true });
  }

  const dbPath = path.join(integrationPath, 'connectome.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Nodes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      region TEXT NOT NULL,
      file_path TEXT NOT NULL,
      line_range TEXT,
      description TEXT,
      metadata TEXT,
      tags TEXT,
      health TEXT,
      position_3d TEXT,
      status TEXT DEFAULT 'active',
      dormant_reason TEXT,
      dormant_since TEXT,
      was_connected_to TEXT,
      code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Safe auto-migration for existing development databases
  try { db.exec("ALTER TABLE nodes ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) { }
  try { db.exec("ALTER TABLE nodes ADD COLUMN dormant_reason TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE nodes ADD COLUMN dormant_since TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE nodes ADD COLUMN was_connected_to TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE nodes ADD COLUMN code TEXT"); } catch (e) { }

  // Synapses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS synapses (
      id TEXT PRIMARY KEY,
      source_node_id TEXT NOT NULL,
      target_node_id TEXT NOT NULL,
      type TEXT NOT NULL,
      strength REAL NOT NULL,
      direction TEXT NOT NULL,
      description TEXT,
      metadata TEXT,
      cross_region INTEGER NOT NULL,
      regions_bridged TEXT,
      status TEXT DEFAULT 'active',
      dormant_reason TEXT,
      dormant_since TEXT,
      code TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_node_id) REFERENCES nodes(id) ON DELETE CASCADE
    );
  `);

  // Safe auto-migration for existing development databases
  try { db.exec("ALTER TABLE synapses ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) { }
  try { db.exec("ALTER TABLE synapses ADD COLUMN dormant_reason TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE synapses ADD COLUMN dormant_since TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE synapses ADD COLUMN code TEXT"); } catch (e) { }

  // Amygdala table
  db.exec(`
    CREATE TABLE IF NOT EXISTS amygdala (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      date_occurred TEXT NOT NULL,
      attempted_change TEXT,
      failure_mode TEXT,
      rollback TEXT,
      lessons_learned TEXT,
      prevention_rules TEXT,
      related_entries TEXT,
      status TEXT NOT NULL
    );
  `);

  // Snapshots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      description TEXT,
      node_count INTEGER NOT NULL,
      synapse_count INTEGER NOT NULL,
      amygdala_count INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);

  // Simulation history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS simulation_history (
      id TEXT PRIMARY KEY,
      source_nodes TEXT NOT NULL,
      change_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      total_affected INTEGER NOT NULL,
      blast_radius TEXT NOT NULL,
      amygdala_alerts INTEGER NOT NULL,
      risk_score REAL NOT NULL,
      recommendation TEXT NOT NULL
    );
  `);

  // Consultation ledger — the substrate for the git chokepoint (Roadmap 0.5):
  // every consult / claim-check / simulation records which nodes and files the
  // AI actually looked at, so unconsulted edits become detectable.
  db.exec(`
    CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY,
      session_token TEXT,
      kind TEXT NOT NULL,
      node_ids TEXT NOT NULL,
      file_paths TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);

  // Resolution lifecycle — issues and their fix-status over time. Links nodes
  // (targets), amygdala (failed attempts), and invariants (cemented truth).
  db.exec(`
    CREATE TABLE IF NOT EXISTS resolutions (
      id TEXT PRIMARY KEY,
      issue TEXT NOT NULL,
      target_nodes TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'wip',
      confirmation TEXT NOT NULL DEFAULT 'unconfirmed',
      comment TEXT,
      amygdala_ids TEXT,
      invariant_id TEXT,
      simulation_ref TEXT,
      attempts INTEGER NOT NULL DEFAULT 1,
      source_app TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      confirmed_at TEXT
    );
  `);

  // Effectiveness ledger — the content-blind "dye". Aggregated counters keyed by
  // (category, event, metric, coarse bucket, self-reported model, day). NEVER stores
  // node names, paths, or code — only failure/usage TYPES + counts. This is the raw
  // material for the operational-improvement telemetry.
  db.exec(`
    CREATE TABLE IF NOT EXISTS effectiveness (
      key TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      event TEXT NOT NULL,
      metric TEXT,
      bucket TEXT,
      model TEXT,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  // AI feedback — the qualitative track. Model-tagged answers to the throttled,
  // metric-seeded questionnaire. Content is about the TOOL, not customer code.
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      model TEXT,
      theme TEXT,
      question_id TEXT,
      question TEXT,
      answer TEXT,
      seeded_by TEXT
    );
  `);

  // Generic key/value (throttle state etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
  `);

  // Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_consultations_ts ON consultations(timestamp);
    CREATE INDEX IF NOT EXISTS idx_ai_feedback_ts ON ai_feedback(ts);
    CREATE INDEX IF NOT EXISTS idx_resolutions_status ON resolutions(status);
    CREATE INDEX IF NOT EXISTS idx_resolutions_confirmation ON resolutions(confirmation);
    CREATE INDEX IF NOT EXISTS idx_effectiveness_cat ON effectiveness(category);
    CREATE INDEX IF NOT EXISTS idx_effectiveness_day ON effectiveness(day);
    CREATE INDEX IF NOT EXISTS idx_nodes_region ON nodes(region);
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
    CREATE INDEX IF NOT EXISTS idx_synapses_source ON synapses(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_synapses_target ON synapses(target_node_id);
    CREATE INDEX IF NOT EXISTS idx_synapses_cross_region ON synapses(cross_region);
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error("Database not initialized");
  return db;
}
