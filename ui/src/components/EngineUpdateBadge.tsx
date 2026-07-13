import React, { useState } from 'react';

// One-click "bring this connectome onto the latest Plexus." Appears only when the
// engine reports a newer build is on disk than the one it's running. Clicking it
// re-execs the engine on the new build (design + logic + migrations) and the viz
// reconnects on its own — no per-brain terminal restart.

export default function EngineUpdateBadge({ plexus }: { plexus: any }) {
    const v = plexus?.engineVersion;
    const [applying, setApplying] = useState(false);

    if (!v?.update_available) return null;

    const apply = async () => {
        setApplying(true);
        try { await plexus.restartEngine?.(); } catch { /* reconnect loop handles it */ }
        // stays "applying" until the reconnect refetches a version without update_available
    };

    return (
        <div
            className="pointer-events-auto absolute right-4 top-4 flex items-center gap-3 rounded-lg border px-3.5 py-2.5"
            style={{
                background: 'rgba(14,15,17,0.92)',
                backdropFilter: 'blur(8px)',
                borderColor: 'rgba(61,154,103,0.45)',
            }}
        >
            <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#3D9A67' }} />
                <span className="text-[12px] text-text-hi">Plexus update available</span>
            </span>
            <button
                onClick={apply}
                disabled={applying}
                className="rounded px-2.5 py-1 text-[11px] font-medium transition-colors duration-120 disabled:opacity-60"
                style={{ background: 'rgba(61,154,103,0.20)', color: '#7BD6A0' }}
            >
                {applying ? 'Applying…' : 'Apply update'}
            </button>
        </div>
    );
}
