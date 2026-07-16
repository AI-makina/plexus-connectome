import React, { useState } from 'react';

// Update surface on the connectome page. Two modes:
//   · VENDOR-QUEUED (v.pending 'sent'/'pushed'): a prominent consent prompt — "your
//     provider sent an update" → Update now (accept) / Later (defer). Nothing installs
//     without the client choosing.
//   · SELF-DETECTED (v.update_available, no vendor push): the passive "Updates" pill.

function fmtDate(d?: string, iso?: string): string {
    const raw = d || iso;
    if (!raw) return '';
    try {
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
    const [deferred, setDeferred] = useState(false);

    if (!v) return null; // engine without the version endpoint (old build)

    const pending = v.pending as { status?: string; target_version?: string } | null;
    const vendorPending = !!pending && (pending.status === 'sent' || pending.status === 'pushed') && !deferred;
    const update = !!v.update_available;
    const latest = v.latest_update as { date?: string; title?: string; notes?: string[] } | null;
    const dateStr = fmtDate(latest?.date, v.on_disk_build_at);

    const accept = async () => { setApplying(true); try { await plexus.acceptUpdate?.(); } catch { /* reconnects */ } };
    const later = async () => { setDeferred(true); try { await plexus.deferUpdate?.(); } catch { /* */ } };

    // ── Vendor-queued update: prominent consent prompt ──
    if (vendorPending) {
        return (
            <div
                className="pointer-events-auto absolute right-4 top-4 w-[320px] rounded-lg border p-4"
                style={{ background: 'rgba(14,15,17,0.96)', backdropFilter: 'blur(8px)', borderColor: 'rgba(61,154,103,0.5)' }}
            >
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#3D9A67' }} />
                    <span className="text-[13px] font-medium text-text-hi">An update is available for your connectome</span>
                </div>
                <div className="mt-1 text-[11px] text-text-lo">
                    Your Plexus provider sent {pending?.target_version ? `v${pending.target_version}` : 'a new version'}. Install now, or later.
                </div>
                {latest?.notes?.length ? (
                    <ul className="mt-2.5 space-y-1 border-t border-line pt-2">
                        {latest.notes.slice(0, 5).map((n, i) => (
                            <li key={i} className="flex gap-1.5 text-[10px] leading-4 text-text-mid">
                                <span className="text-text-ghost">•</span><span>{n}</span>
                            </li>
                        ))}
                    </ul>
                ) : null}
                <div className="mt-3 flex gap-2">
                    <button
                        onClick={accept}
                        disabled={applying}
                        className="flex-1 rounded py-1.5 text-[11px] font-semibold disabled:opacity-60"
                        style={{ background: '#3D9A67', color: '#08090B' }}
                    >
                        {applying ? 'Installing…' : 'Update now'}
                    </button>
                    <button
                        onClick={later}
                        disabled={applying}
                        className="rounded border border-line px-3 py-1.5 text-[11px] text-text-mid transition-colors hover:text-text-hi"
                    >
                        Later
                    </button>
                </div>
            </div>
        );
    }

    // ── Self-detected update: passive pill ──
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
                <div className="w-[300px] rounded-lg border border-line p-3.5" style={{ background: 'rgba(14,15,17,0.95)', backdropFilter: 'blur(8px)' }}>
                    {checking ? (
                        <div className="text-[11px] text-text-lo">Checking for updates…</div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <span className="text-[12px]" style={{ color: update ? '#7BD6A0' : 'var(--text-mid)' }}>
                                    {update ? 'Update available' : '✓ On the latest'}
                                </span>
                                {latest?.notes?.length ? (
                                    <button onClick={() => setShowNotes((s) => !s)} title="What's in this update?"
                                        className="flex h-4 w-4 items-center justify-center rounded-full border border-line text-[9px] text-text-lo transition-colors hover:text-text-hi">?</button>
                                ) : null}
                            </div>
                            <div className="readout mt-1 text-[10px] text-text-lo">
                                {latest?.title ? `${latest.title} · ` : 'Most recent build · '}{dateStr}
                            </div>
                            {showNotes && latest?.notes?.length ? (
                                <ul className="mt-2 space-y-1 border-t border-line pt-2">
                                    {latest.notes.map((n, i) => (
                                        <li key={i} className="flex gap-1.5 text-[10px] leading-4 text-text-mid"><span className="text-text-ghost">•</span><span>{n}</span></li>
                                    ))}
                                </ul>
                            ) : null}
                            {update && (
                                <button onClick={apply} disabled={applying}
                                    className="mt-3 w-full rounded py-1.5 text-[11px] font-medium transition-colors duration-120 disabled:opacity-60"
                                    style={{ background: 'rgba(61,154,103,0.20)', color: '#7BD6A0' }}>
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
