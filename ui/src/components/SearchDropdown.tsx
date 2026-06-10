import React from 'react';
import { middleTruncate } from '../lib/format';

// DESIGN_SPEC §5.4 — search results dropdown. Pure presentation: the open
// state, active index, and keyboard handling live in UIOverlay.

function highlightMatch(name: string, query: string) {
    const text = String(name || '');
    const q = String(query || '').trim().toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (!q || idx === -1) return text;
    return (
        <>
            {text.slice(0, idx)}
            <span className="font-semibold">{text.slice(idx, idx + q.length)}</span>
            {text.slice(idx + q.length)}
        </>
    );
}

export default function SearchDropdown({ results, totalCount, query, activeIndex, onActiveIndex, onSelect }: any) {
    return (
        <div
            className="instrument-panel overflow-hidden rounded-md"
            // Never fight OrbitControls (§5.4).
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
        >
            <div className="max-h-[288px] overflow-y-auto">
                {results.length === 0 ? (
                    <div className="flex h-9 items-center px-3 text-xs text-text-lo">No matches in connectome</div>
                ) : (
                    results.map((r: any, i: number) => {
                        const active = i === activeIndex;
                        return (
                            <button
                                key={`${r.kind}-${r.item?.id ?? i}`}
                                type="button"
                                onClick={() => onSelect(r)}
                                onMouseEnter={() => onActiveIndex(i)}
                                className="flex h-9 w-full items-center gap-2.5 px-3 text-left"
                                style={active ? { backgroundColor: 'rgba(255,255,255,0.06)' } : undefined}
                            >
                                {/* region tick — 2px wide, 3px when active */}
                                <span
                                    className="shrink-0"
                                    style={{
                                        width: active ? 3 : 2,
                                        height: 16,
                                        backgroundColor: r.hex,
                                        transition: 'width 120ms var(--ease-soft)',
                                    }}
                                />
                                <span className="min-w-0 shrink truncate text-[13px] text-text-hi">
                                    {highlightMatch(r.name, query)}
                                </span>
                                {r.path ? (
                                    <span className="min-w-0 shrink-[2] truncate font-mono text-[11px] text-text-lo">
                                        {middleTruncate(r.path, 32)}
                                    </span>
                                ) : null}
                                <span
                                    className="ml-auto shrink-0 rounded-sm px-[6px] py-[2px] font-mono text-[10px] uppercase leading-[14px] tracking-[0.06em] text-text-mid"
                                    style={{ backgroundColor: 'var(--surface-well)' }}
                                >
                                    {r.type}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
            {/* footer */}
            <div className="flex h-7 items-center justify-between border-t border-line px-3 font-mono text-[10px] text-text-ghost">
                <span>{totalCount} RESULTS</span>
                <span>↑↓ NAVIGATE · ↵ SELECT · ⎋ CLOSE</span>
            </div>
        </div>
    );
}
