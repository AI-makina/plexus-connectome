import { getDb } from '../db/sqlite';

// The effectiveness ledger — content-blind operational telemetry (the "MRI dye").
// Every signal is a COUNTER keyed to a fixed taxonomy, never customer content:
//   category: where a weakness lives — 'ai' (is the model using Plexus well?),
//             'harness' (is enforcement catching things?), 'structure' (is the
//             connectome model adequate?), 'value' (proof Plexus caught something).
//   event:    the operation ('claim_check', 'consult', 'simulate', 'divergence', …)
//   metric:   a fixed sub-outcome ('missing' | 'out_of_scope' | 'exists' | …)
//   bucket:   coarse structural band (language / size / symbol-category) — never a name
//   model:    self-reported model id (soft label) for per-model / per-vendor trends
// Rows are aggregated by (…|day) so the table stays bounded and gives daily trends.

export type EffCategory = 'ai' | 'harness' | 'structure' | 'value';

export function record(
    category: EffCategory,
    event: string,
    opts: { metric?: string; bucket?: string; model?: string; count?: number } = {},
): void {
    try {
        const day = new Date().toISOString().slice(0, 10);
        const metric = opts.metric || '';
        const bucket = opts.bucket || '';
        const model = (opts.model || '').slice(0, 60);
        const key = [category, event, metric, bucket, model, day].join('|');
        getDb().prepare(`
            INSERT INTO effectiveness (key, category, event, metric, bucket, model, day, count, updated_at)
            VALUES (@key, @category, @event, @metric, @bucket, @model, @day, @count, @updated_at)
            ON CONFLICT(key) DO UPDATE SET count = count + excluded.count, updated_at = excluded.updated_at
        `).run({ key, category, event, metric, bucket, model, day, count: opts.count ?? 1, updated_at: new Date().toISOString() });
    } catch { /* telemetry must never break the operation it measures */ }
}

interface Row { category: string; event: string; metric: string; bucket: string; model: string; day: string; count: number; }

export function summary(): any {
    let rows: Row[] = [];
    try { rows = getDb().prepare('SELECT category, event, metric, bucket, model, day, count FROM effectiveness').all() as Row[]; }
    catch { return { available: false }; }

    const sum = (pred: (r: Row) => boolean) => rows.filter(pred).reduce((n, r) => n + r.count, 0);

    // Totals by category — where weakness concentrates.
    const by_category: Record<string, number> = {};
    for (const r of rows) by_category[r.category] = (by_category[r.category] || 0) + r.count;

    // Claim-check: the anti-hallucination + structure-coverage signal.
    const cc = (m: string) => sum((r) => r.event === 'claim_check' && r.metric === m);
    const checked = cc('exists') + cc('missing') + cc('out_of_scope');
    const claim_check = {
        checked,
        exists: cc('exists'),
        missing: cc('missing'),          // hallucinations caught (value)
        out_of_scope: cc('out_of_scope'), // graph blind to this symbol category (structure)
        hallucination_rate: checked ? +(cc('missing') / checked).toFixed(4) : 0,
        coverage_gap_rate: checked ? +(cc('out_of_scope') / checked).toFixed(4) : 0,
    };

    // Per-model — the cross-model / cross-vendor trend seed.
    const by_model: Record<string, { events: number; claim_missing: number; claim_out_of_scope: number }> = {};
    for (const r of rows) {
        const m = r.model || '(unreported)';
        by_model[m] = by_model[m] || { events: 0, claim_missing: 0, claim_out_of_scope: 0 };
        by_model[m].events += r.count;
        if (r.event === 'claim_check' && r.metric === 'missing') by_model[m].claim_missing += r.count;
        if (r.event === 'claim_check' && r.metric === 'out_of_scope') by_model[m].claim_out_of_scope += r.count;
    }

    // Divergences — the highest-value dye: where Plexus's prediction met a different reality.
    const divergences: Record<string, number> = {};
    for (const r of rows) if (r.event === 'divergence') divergences[r.metric || 'unspecified'] = (divergences[r.metric || 'unspecified'] || 0) + r.count;

    // Daily trend (last 14 days) of total signal volume.
    const by_day: Record<string, number> = {};
    for (const r of rows) by_day[r.day] = (by_day[r.day] || 0) + r.count;
    const recent_days = Object.entries(by_day).sort().slice(-14).map(([day, count]) => ({ day, count }));

    return { available: true, by_category, claim_check, divergences, by_model, recent_days };
}
