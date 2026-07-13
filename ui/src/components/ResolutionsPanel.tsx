import React, { useMemo, useState } from 'react';

// The troubleshooting radar: every tracked issue and its fix-status, grouped so
// the "look here" items (regression-risk, failed) float to the top. Clicking an
// item selects its target node — the 3D view focuses it and the detail panel
// shows its id, closing the visual → terminal targeting loop.

const STATUS_META: Record<string, { label: string; color: string; order: number }> = {
    regression_risk: { label: 'Regression risk', color: '#C043E0', order: 0 }, // loudest — was solved, now at risk
    failed: { label: 'Unsolved', color: '#E5484D', order: 1 },
    blocked: { label: 'Blocked', color: '#8B5CF6', order: 2 },
    partial: { label: 'Partial', color: '#E08A39', order: 3 },
    conditional: { label: 'Conditional', color: '#D9B13D', order: 4 }, // AI-tested, unconfirmed
    wip: { label: 'In progress', color: '#8B98A9', order: 5 },
    applied: { label: 'In progress', color: '#8B98A9', order: 5 },
    unconditional: { label: 'Solved', color: '#3D9A67', order: 6 }, // user-confirmed, cemented
};

const metaFor = (s: string) => STATUS_META[s] || { label: s, color: '#8B98A9', order: 9 };

export default function ResolutionsPanel({ plexus }: { plexus: any }) {
    const resolutions: any[] = plexus?.data?.resolutions || [];
    const nodes: any[] = plexus?.data?.nodes || [];
    const [open, setOpen] = useState(true);

    const sorted = useMemo(
        () => [...resolutions].sort((a, b) => metaFor(a.status).order - metaFor(b.status).order),
        [resolutions],
    );

    // header counts, most-urgent buckets first
    const counts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const r of resolutions) c[r.status] = (c[r.status] || 0) + 1;
        return c;
    }, [resolutions]);

    if (resolutions.length === 0) return null;

    const selectTarget = (r: any) => {
        const targetId = (r.target_nodes || [])[0];
        if (!targetId) return;
        const node = nodes.find((n) => n.id === targetId);
        if (node && plexus.setSelectedNode) plexus.setSelectedNode(node);
    };

    return (
        <div
            className="pointer-events-auto absolute bottom-4 left-4 w-[300px] rounded-lg border border-line"
            style={{ background: 'rgba(14,15,17,0.92)', backdropFilter: 'blur(8px)', maxHeight: '52vh' }}
        >
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3.5 py-2.5"
            >
                <span className="micro-label" style={{ letterSpacing: '0.14em' }}>
                    Resolutions · {resolutions.length}
                </span>
                <div className="flex items-center gap-1.5">
                    {Object.entries(counts)
                        .sort((a, b) => metaFor(a[0]).order - metaFor(b[0]).order)
                        .map(([status, n]) => (
                            <span key={status} className="flex items-center gap-1 text-[10px] text-text-mid">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: metaFor(status).color }} />
                                {n}
                            </span>
                        ))}
                    <span className="ml-1 text-[10px] text-text-ghost">{open ? '▾' : '▸'}</span>
                </div>
            </button>

            {open && (
                <div className="-mt-0.5 max-h-[44vh] overflow-y-auto px-2 pb-2">
                    {sorted.map((r) => {
                        const m = metaFor(r.status);
                        const targetId = (r.target_nodes || [])[0];
                        return (
                            <button
                                key={r.id}
                                onClick={() => selectTarget(r)}
                                title={targetId ? `Target ${targetId} — click to focus` : 'No target node'}
                                className="mb-0.5 flex w-full items-start gap-2 rounded px-1.5 py-1.5 text-left transition-colors duration-120 hover:bg-white/[0.04]"
                            >
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[12px] leading-4 text-text-hi">{r.issue}</span>
                                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-text-lo">
                                        <span style={{ color: m.color }}>{m.label}</span>
                                        {r.confirmation === 'unconfirmed' && r.status !== 'unconditional' && (
                                            <span className="text-text-ghost">· unconfirmed</span>
                                        )}
                                        {r.attempts > 1 && <span className="text-text-ghost">· {r.attempts}×</span>}
                                        {targetId && <span className="readout truncate text-text-ghost">· {targetId}</span>}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
