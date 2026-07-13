import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '../db/sqlite';
import { summary as effSummary } from './effectiveness';
import { record as recordEff } from './effectiveness';

// AI questionnaire — the QUALITATIVE track of the telemetry. The bank ships with the
// engine (updates via self-update); responses + throttle live in the connectome; a
// batch is seeded by THIS session's divergence metrics so answers are grounded, not
// confabulated. The engine enforces the ~weekly throttle; the CALLER (MCP/app) decides
// WHEN to ask (a long, unbroken session) so we don't derail mid-task.

const BANK_FILE = path.join(__dirname, '..', '..', 'FEEDBACK_QUESTIONS.json');
const THROTTLE_DAYS = 7;

function loadBank(): { themes: Record<string, { id: string; q: string }[]> } | null {
    try { return JSON.parse(fs.readFileSync(BANK_FILE, 'utf8')); } catch { return null; }
}

function getKv(key: string): string | null {
    try { return (getDb().prepare('SELECT value FROM kv WHERE key = ?').get(key) as any)?.value ?? null; } catch { return null; }
}
function setKv(key: string, value: string): void {
    try {
        getDb().prepare(`INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
            .run(key, value, new Date().toISOString());
    } catch { /* ignore */ }
}

export function dueForSurvey(): boolean {
    const last = getKv('feedback_last_surveyed');
    if (!last) return true;
    const days = (Date.now() - new Date(last).getTime()) / 86_400_000;
    return days >= THROTTLE_DAYS;
}

// Which theme does this session's data point at? (grounds the batch)
function seededTheme(eff: any): { theme: string; context: string } | null {
    const cc = eff?.claim_check || {};
    if ((cc.hallucination_rate || 0) > 0.3 || (cc.coverage_gap_rate || 0) > 0.15)
        return { theme: 'claim_check', context: `This session's claim-checks ran ${Math.round((cc.hallucination_rate || 0) * 100)}% missing / ${Math.round((cc.coverage_gap_rate || 0) * 100)}% out-of-scope.` };
    if ((eff?.structure_health?.planned_ratio || 0) > 0.2 || Object.keys(eff?.divergences || {}).length > 0)
        return { theme: 'structure', context: `The connectome shows structural gaps (planned ${Math.round((eff?.structure_health?.planned_ratio || 0) * 100)}%, ${Object.keys(eff?.divergences || {}).length} divergence type(s)).` };
    if ((eff?.by_category?.harness || 0) > 0)
        return { theme: 'harness', context: `There was enforcement/verify activity this session.` };
    return null;
}

function sample<T>(arr: T[], n: number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
}

export function nextBatch(): { due: boolean; questions: any[] } {
    if (!dueForSurvey()) return { due: false, questions: [] };
    const bank = loadBank();
    if (!bank?.themes) return { due: false, questions: [] };

    const eff = effSummary();
    const seed = seededTheme(eff);
    const out: any[] = [];

    if (seed && bank.themes[seed.theme]) {
        for (const q of sample(bank.themes[seed.theme], 2)) out.push({ ...q, theme: seed.theme, context: seed.context, seeded_by: `metric:${seed.theme}` });
    }
    // fill from general + one other theme
    for (const q of sample(bank.themes.general || [], 2)) out.push({ ...q, theme: 'general', seeded_by: 'rotation' });
    const others = Object.keys(bank.themes).filter((t) => t !== 'general' && t !== seed?.theme);
    const extra = others.length ? bank.themes[others[Math.floor(Math.random() * others.length)]] : [];
    for (const q of sample(extra, 1)) out.push({ ...q, theme: 'other', seeded_by: 'rotation' });

    // Dispatch consumes the weekly slot (asking counts, even if unanswered — no spam).
    setKv('feedback_last_surveyed', new Date().toISOString());
    return { due: true, questions: out.slice(0, 5) };
}

export function recordAnswer(model: string, a: { question_id?: string; question?: string; answer: string; theme?: string; seeded_by?: string }): void {
    if (!a?.answer?.trim()) return;
    try {
        getDb().prepare(`INSERT INTO ai_feedback (id, ts, model, theme, question_id, question, answer, seeded_by)
            VALUES (@id, @ts, @model, @theme, @qid, @q, @answer, @seeded)`).run({
            id: 'fb-' + crypto.randomBytes(8).toString('hex'),
            ts: new Date().toISOString(),
            model: (model || '').slice(0, 60),
            theme: a.theme || '',
            qid: a.question_id || '',
            q: (a.question || '').slice(0, 500),
            answer: a.answer.slice(0, 4000),
            seeded: a.seeded_by || '',
        });
        recordEff('ai', 'feedback_given', { model });
    } catch { /* ignore */ }
}

export function summary(): any {
    try {
        const rows = getDb().prepare('SELECT model, theme, seeded_by, ts FROM ai_feedback ORDER BY ts DESC').all() as any[];
        const by_model: Record<string, number> = {};
        const by_theme: Record<string, number> = {};
        for (const r of rows) {
            by_model[r.model || '(unreported)'] = (by_model[r.model || '(unreported)'] || 0) + 1;
            by_theme[r.theme || 'other'] = (by_theme[r.theme || 'other'] || 0) + 1;
        }
        return { total: rows.length, last_surveyed: getKv('feedback_last_surveyed'), by_model, by_theme };
    } catch { return { total: 0 }; }
}

export function recentAnswers(limit = 20): any[] {
    try {
        return getDb().prepare('SELECT ts, model, theme, question, answer, seeded_by FROM ai_feedback ORDER BY ts DESC LIMIT ?').all(limit) as any[];
    } catch { return []; }
}
