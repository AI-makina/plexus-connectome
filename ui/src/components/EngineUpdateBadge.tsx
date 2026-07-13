import React, { useState } from 'react';

// "Updates" control on the connectome page. Click to SEARCH for updates → shows the
// most recent update + its date; the "?" reveals a brief bullet description of what's
// in it; "Apply update" re-execs the engine onto the new build (viz reconnects itself).

function fmtDate(d?: string, iso?: string): string {
    const raw = d || iso;
    if (!raw) return '';
    try {
        // append midday so a bare YYYY-MM-DD isn't shifted a day by the timezone
        const dt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
        return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return raw; }
}

export default function EngineUpdateBadge({ plexus }: { plexus: any }) {
    const v = plexus?.engineVersion;
    const [open, setOpen] = useState(false);
    const [checking, setChecking] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [applying, setApplying] = useState(false);

    if (!v) return null; // engine without the version endpoint (old build)

    const update = !!v.update_available;
    const latest = v.latest_update as { date?: string; title?: string; notes?: string[] } | null;
    const dateStr = fmtDate(latest?.date, v.on_disk_build_at);

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (next) { setChecking(true); await plexus.checkForUpdates?.(); setChecking(false); }
    };
    const apply = async () => { setApplying(true); try { await plexus.restartEngine?.(); } catch { /* reconnects */ } };

    return (
        <div className="pointer-events-auto absolute right-4 top-4 flex flex-col items-end gap-2">
            <button
                onClick={toggle}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] transition-colors duration-120"
                style={{ background: 'rgba(14,15,17,0.92)', backdropFilter: 'blur(8px)', borderColor: update ? 'rgba(61,154,103,0.45)' : 'var(--line1, rgba(255,255,255,0.08))' }}
            >
                {update && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#3D9A67' }} />}
                <span className="text-text-hi">Updates</span>
                <span className="text-text-ghost">{open ? '▴' : '▾'}</span>
            </button>

            {open && (
                <div
                    className="w-[300px] rounded-lg border border-line p-3.5"
                    style={{ background: 'rgba(14,15,17,0.95)', backdropFilter: 'blur(8px)' }}
                >
                    {checking ? (
                        <div className="text-[11px] text-text-lo">Checking for updates…</div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <span className="text-[12px]" style={{ color: update ? '#7BD6A0' : 'var(--text-mid)' }}>
                                    {update ? 'Update available' : '✓ On the latest'}
                                </span>
                                {latest?.notes?.length ? (
                                    <button
                                        onClick={() => setShowNotes((s) => !s)}
                                        title="What's in this update?"
                                        className="flex h-4 w-4 items-center justify-center rounded-full border border-line text-[9px] text-text-lo transition-colors hover:text-text-hi"
                                    >?</button>
                                ) : null}
                            </div>

                            <div className="readout mt-1 text-[10px] text-text-lo">
                                {latest?.title ? `${latest.title} · ` : 'Most recent build · '}{dateStr}
                            </div>

                            {showNotes && latest?.notes?.length ? (
                                <ul className="mt-2 space-y-1 border-t border-line pt-2">
                                    {latest.notes.map((n, i) => (
                                        <li key={i} className="flex gap-1.5 text-[10px] leading-4 text-text-mid">
                                            <span className="text-text-ghost">•</span><span>{n}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}

                            {update && (
                                <button
                                    onClick={apply}
                                    disabled={applying}
                                    className="mt-3 w-full rounded py-1.5 text-[11px] font-medium transition-colors duration-120 disabled:opacity-60"
                                    style={{ background: 'rgba(61,154,103,0.20)', color: '#7BD6A0' }}
                                >
                                    {applying ? 'Applying — reconnecting…' : 'Apply update'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
