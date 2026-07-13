import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlite';
import { Resolution, ResolutionStatus, ConfirmationVerdict } from '../types';

// ─── Resolution store ────────────────────────────────────────────────────
// The lifecycle layer: an issue and its fix-status over time. Write-through to
// SQLite (INSERT OR REPLACE), mirroring the node/synapse/amygdala convention.
// App-agnostic — the engine owns the lifecycle; apps render + relay verdicts.

function rowToResolution(r: any): Resolution {
    return {
        id: r.id,
        issue: r.issue,
        target_nodes: JSON.parse(r.target_nodes || '[]'),
        status: r.status,
        confirmation: r.confirmation,
        comment: r.comment ?? undefined,
        amygdala_ids: JSON.parse(r.amygdala_ids || '[]'),
        invariant_id: r.invariant_id ?? undefined,
        simulation_ref: r.simulation_ref ?? undefined,
        attempts: r.attempts,
        source_app: r.source_app ?? undefined,
        created_at: r.created_at,
        updated_at: r.updated_at,
        confirmed_at: r.confirmed_at ?? undefined,
    };
}

function persist(res: Resolution): Resolution {
    getDb().prepare(`
        INSERT OR REPLACE INTO resolutions
          (id, issue, target_nodes, status, confirmation, comment, amygdala_ids,
           invariant_id, simulation_ref, attempts, source_app, created_at, updated_at, confirmed_at)
        VALUES (@id, @issue, @target_nodes, @status, @confirmation, @comment, @amygdala_ids,
                @invariant_id, @simulation_ref, @attempts, @source_app, @created_at, @updated_at, @confirmed_at)
    `).run({
        id: res.id,
        issue: res.issue,
        target_nodes: JSON.stringify(res.target_nodes),
        status: res.status,
        confirmation: res.confirmation,
        comment: res.comment ?? null,
        amygdala_ids: JSON.stringify(res.amygdala_ids),
        invariant_id: res.invariant_id ?? null,
        simulation_ref: res.simulation_ref ?? null,
        attempts: res.attempts,
        source_app: res.source_app ?? null,
        created_at: res.created_at,
        updated_at: res.updated_at,
        confirmed_at: res.confirmed_at ?? null,
    });
    return res;
}

/** Open a new resolution for an issue (starts unconfirmed, status 'wip'). If an
 *  OPEN resolution already covers the same issue text, bump its attempts instead
 *  of duplicating (thrash tracking). */
export function createResolution(partial: {
    issue: string;
    target_nodes?: string[];
    status?: ResolutionStatus;
    simulation_ref?: string;
    source_app?: string;
}): Resolution {
    const now = new Date().toISOString();
    const existing = getDb().prepare(
        `SELECT * FROM resolutions WHERE issue = ? AND status NOT IN ('unconditional') ORDER BY created_at DESC LIMIT 1`,
    ).get(partial.issue) as any;
    if (existing) {
        const res = rowToResolution(existing);
        res.attempts += 1;
        res.updated_at = now;
        if (partial.target_nodes?.length) res.target_nodes = [...new Set([...res.target_nodes, ...partial.target_nodes])];
        if (partial.simulation_ref) res.simulation_ref = partial.simulation_ref;
        if (partial.status) res.status = partial.status;
        return persist(res);
    }
    return persist({
        id: 'res-' + uuidv4().replace(/-/g, '').slice(0, 20),
        issue: partial.issue,
        target_nodes: partial.target_nodes ?? [],
        status: partial.status ?? 'wip',
        confirmation: 'unconfirmed',
        amygdala_ids: [],
        simulation_ref: partial.simulation_ref,
        attempts: 1,
        source_app: partial.source_app,
        created_at: now,
        updated_at: now,
    });
}

export function getResolution(id: string): Resolution | null {
    const r = getDb().prepare('SELECT * FROM resolutions WHERE id = ?').get(id) as any;
    return r ? rowToResolution(r) : null;
}

/** List resolutions, optionally filtered by status / confirmation. */
export function listResolutions(filter?: { status?: ResolutionStatus; confirmation?: ConfirmationVerdict }): Resolution[] {
    const clauses: string[] = [];
    const params: any = {};
    if (filter?.status) { clauses.push('status = @status'); params.status = filter.status; }
    if (filter?.confirmation) { clauses.push('confirmation = @confirmation'); params.confirmation = filter.confirmation; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = getDb().prepare(`SELECT * FROM resolutions ${where} ORDER BY updated_at DESC`).all(params) as any[];
    return rows.map(rowToResolution);
}

/** The confirmation queue: applied/conditional fixes the user hasn't ruled on yet. */
export function listPendingConfirmation(): Resolution[] {
    const rows = getDb().prepare(
        `SELECT * FROM resolutions WHERE confirmation = 'unconfirmed'
         AND status IN ('applied', 'conditional', 'regression_risk') ORDER BY updated_at DESC`,
    ).all() as any[];
    return rows.map(rowToResolution);
}

function mutate(id: string, fn: (r: Resolution) => void): Resolution | null {
    const res = getResolution(id);
    if (!res) return null;
    fn(res);
    res.updated_at = new Date().toISOString();
    return persist(res);
}

/** Set the lifecycle status directly (e.g. applied, conditional after AI test green). */
export function setResolutionStatus(id: string, status: ResolutionStatus): Resolution | null {
    return mutate(id, (r) => { r.status = status; });
}

/** Apply the user's verdict from the confirm box. 'solved' cements to unconditional
 *  (invariant linking is a caller step); 'partial'/'not_solved' set the matching state. */
export function confirmResolution(id: string, verdict: ConfirmationVerdict, comment?: string): Resolution | null {
    return mutate(id, (r) => {
        r.confirmation = verdict;
        if (comment !== undefined) r.comment = comment;
        if (verdict === 'solved') { r.status = 'unconditional'; r.confirmed_at = new Date().toISOString(); }
        else if (verdict === 'partial') r.status = 'partial';
        else if (verdict === 'not_solved') r.status = 'failed';
    });
}

/** Demote a previously-cemented fix that a later change rippled into (the regression radar). */
export function flagRegressionRisk(id: string): Resolution | null {
    return mutate(id, (r) => {
        if (r.status === 'unconditional') r.status = 'regression_risk';
        r.confirmation = 'unconfirmed'; // needs re-confirmation now that it's at risk
    });
}

export function linkAmygdala(id: string, amygdalaId: string): Resolution | null {
    return mutate(id, (r) => { if (!r.amygdala_ids.includes(amygdalaId)) r.amygdala_ids.push(amygdalaId); });
}

export function linkInvariant(id: string, invariantId: string): Resolution | null {
    return mutate(id, (r) => { r.invariant_id = invariantId; });
}

/** Resolutions whose target nodes intersect `nodeIds` — the regression-gate lookup.
 *  Optionally restrict to certain statuses (e.g. only cemented 'unconditional'). */
export function findResolutionsTouchingNodes(nodeIds: string[], statuses?: ResolutionStatus[]): Resolution[] {
    if (nodeIds.length === 0) return [];
    const set = new Set(nodeIds);
    return listResolutions().filter((r) =>
        (!statuses || statuses.includes(r.status)) && r.target_nodes.some((n) => set.has(n)),
    );
}
