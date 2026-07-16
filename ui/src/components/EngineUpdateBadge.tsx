import React, { useState } from 'react';

// Top-right hamburger menu + update surfaces.
//   · ☰ menu (furthest corner): holds the "Updates" control (self-detected checks / apply)
//     so it no longer overlaps the top bar.
//   · VENDOR-PUSHED update (v.pending 'sent'/'pushed'): a centered MODAL pop-up asking the
//     client to update — "Update now" (accept) / "Later" (defer). Nothing installs without them.

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
    const [menuOpen, setMenuOpen] = useState(false);
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
    const apply = async () => { setApplying(true); try { await plexus.restartEngine?.(); } catch { /* reconnects */ } };
    const toggleMenu = async () => {
        const next = !menuOpen;
        setMenuOpen(next);
        if (next && !checking) { setChecking(true); await plexus.checkForUpdates?.(); setChecking(false); }
    };

    const panel: React.CSSProperties = { background: 'rgba(14,15,17,0.96)', backdropFilter: 'blur(8px)' };

    return (
        <>
            {/* ── Hamburger menu — furthest top-right corner ── */}
            <div className="pointer-events-auto absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
                <button
                    onClick={toggleMenu}
                    aria-label="Menu"
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-120"
                    style={{ ...panel, borderColor: 'var(--line1, rgba(255,255,255,0.10))' }}
                >
                    <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
                        <path d="M1 1h13M1 6h13M1 11h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-text-hi" />
                    </svg>
                    {(update || vendorPending) && (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: '#3D9A67', boxShadow: '0 0 6px #3D9A67' }} />
                    )}
                </button>

                {menuOpen && (
                    <div className="w-[300px] rounded-lg border border-line p-3.5" style={panel}>
                        <div className="micro-label mb-2" style={{ letterSpacing: '0.14em' }}>Updates</div>
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

            {/* ── Vendor-pushed update → centered modal pop-up ── */}
            {vendorPending && (
                <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.62)' }}>
                    <div className="w-[400px] rounded-xl border p-6" style={{ ...panel, borderColor: 'rgba(61,154,103,0.5)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                        <div className="flex items-center gap-2.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#3D9A67', boxShadow: '0 0 8px #3D9A67' }} />
                            <span className="text-[15px] font-semibold text-text-hi">An update is available for your connectome</span>
                        </div>
                        <div className="mt-2 text-[12px] leading-relaxed text-text-mid">
                            Your Plexus provider sent {pending?.target_version ? `v${pending.target_version}` : 'a new version'}. It won't install until you choose. Update now, or later.
                        </div>
                        {latest?.notes?.length ? (
                            <ul className="mt-3 space-y-1 border-t border-line pt-3">
                                {latest.notes.slice(0, 6).map((n, i) => (
                                    <li key={i} className="flex gap-2 text-[11px] leading-5 text-text-mid"><span className="text-text-ghost">•</span><span>{n}</span></li>
                                ))}
                            </ul>
                        ) : null}
                        <div className="mt-5 flex gap-2.5">
                            <button onClick={accept} disabled={applying}
                                className="flex-1 rounded-lg py-2 text-[12px] font-semibold disabled:opacity-60"
                                style={{ background: '#3D9A67', color: '#08090B' }}>
                                {applying ? 'Installing…' : 'Update now'}
                            </button>
                            <button onClick={later} disabled={applying}
                                className="rounded-lg border border-line px-4 py-2 text-[12px] text-text-mid transition-colors hover:text-text-hi">
                                Later
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
