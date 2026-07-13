import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Play, X, Moon, Crosshair, AlertTriangle, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { REGIONS, REGION_COLORS } from '../theme/regions';
import { LogoMark } from './Brand';
import SearchDropdown from './SearchDropdown';
import { Button, Tag, RISK_HEX, useCountUp, usePresence, prefersReducedMotion } from './primitives';
import { middleTruncate } from '../lib/format';
import { API_BASE } from '../hooks/usePlexus';

const FALLBACK_HEX = '#8B98A9';
// Internal panel dividers (DESIGN_SPEC §2.4): 1px rgba(255,255,255,0.06), full-bleed.
const DIVIDER = 'rgba(255,255,255,0.06)';

function regionHex(region: string): string {
    return (REGION_COLORS as any)[region] || FALLBACK_HEX;
}

function regionLabel(region: string): string {
    return (REGIONS as any)[region]?.label || String(region || '').replace(/_/g, ' ');
}

// ── Project identity chip (top bar): which brain is this tab looking at? ──
// The name shown is visualization.display_name (if set) else target_app.name.
// Editing here is DISPLAY-ONLY: it writes manifest.visualization.display_name
// through the engine and never touches structural identity (folder path,
// target_app.name, registry, receipts) — renaming can break no pathway.
// Enter saves · Esc/blur cancels · empty resets to the project's real name.
function ProjectNameChip({ project, onRename }: any) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (project?.name) document.title = `${project.name} — Plexus`;
    }, [project?.name]);

    if (!project) return null;

    const startEdit = () => {
        setDraft(project.display_name || project.app_name || '');
        setEditing(true);
        requestAnimationFrame(() => inputRef.current?.select());
    };

    const commit = async () => {
        if (busy) return;
        const next = draft.trim();
        setBusy(true);
        try {
            // Typing the real name back (or clearing) removes the override.
            await onRename(next && next !== project.app_name ? next : null);
            setEditing(false);
        } catch (e) {
            console.error('Display rename failed', e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className="h-3 w-px bg-line" />
            {editing ? (
                <input
                    ref={inputRef}
                    value={draft}
                    disabled={busy}
                    maxLength={48}
                    placeholder={project.app_name}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    onBlur={() => setEditing(false)}
                    className="w-36 bg-transparent text-[13px] text-text-hi outline-none placeholder:text-text-ghost"
                />
            ) : (
                <button
                    type="button"
                    onClick={startEdit}
                    title={`${project.name} — display name for this connectome. Click to rename (visual only; folder and pathway structure are untouched).`}
                    className="group flex min-w-0 max-w-44 items-center gap-1.5"
                >
                    <span className="truncate text-[13px] text-text-hi">{project.name}</span>
                    <Pencil size={11} className="shrink-0 text-text-ghost opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
            )}
        </>
    );
}

// ── Shared section anatomy (§5.8): micro-label + 12px gap + full-bleed hairline ──
function Section({ label, children }: any) {
    return (
        <div>
            <div className="micro-label">{label}</div>
            <div className="-mx-4 mt-3 h-px" style={{ backgroundColor: DIVIDER }} />
            <div className="mt-3">{children}</div>
        </div>
    );
}

function MetricRow({ label, value }: any) {
    return (
        <div className="flex items-center justify-between py-1">
            <span className="text-xs text-text-mid">{label}</span>
            <span className="readout text-xs text-text-hi">{value}</span>
        </div>
    );
}

function GhostCloseButton({ onClick }: any) {
    return (
        <button
            type="button"
            aria-label="Close"
            onClick={onClick}
            className="flex h-6 w-6 items-center justify-center rounded text-text-lo transition-colors duration-120 hover:text-text-hi"
        >
            <X size={14} />
        </button>
    );
}

// ── Stat cluster (§5.5) — odometer strip ────────────────────────────────────
function StatCell({ label, value, critical = false }: any) {
    const display = useCountUp(value);
    const v = Math.round(display);
    return (
        <div className="flex flex-col justify-center px-4 py-2">
            <span className="micro-label">{label}</span>
            <span
                className="readout flex items-center gap-1.5 text-sm leading-5 text-text-hi"
                style={critical ? { color: 'var(--risk-critical)' } : undefined}
            >
                {critical && <span className="h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--risk-critical)' }} />}
                {v}
            </span>
        </div>
    );
}

function StatCluster({ data }: any) {
    const incidents = data?.amygdala?.length || 0;
    return (
        <div className="instrument-panel flex items-stretch divide-x divide-line overflow-hidden">
            <StatCell label="Nodes" value={data?.nodes?.length || 0} />
            <StatCell label="Synapses" value={data?.synapses?.length || 0} />
            <StatCell label="Incidents" value={incidents} critical={incidents > 0} />
        </div>
    );
}

// ── Dormant toggle (§5.6) — 36px control with a real 28×16 switch ───────────
function DormantToggle({ on, count, onToggle }: any) {
    return (
        <button
            type="button"
            title="Show dormant tissue (D)"
            onClick={onToggle}
            className={clsx(
                'instrument-panel flex h-9 items-center gap-2 px-3 transition-colors duration-120',
                on ? 'text-text-hi' : 'text-text-lo'
            )}
        >
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]">Dormant</span>
            <span className="font-mono text-[10px] text-text-ghost">{count}</span>
            <span
                className="relative h-4 w-7 rounded-md border transition-colors duration-120"
                style={{
                    borderColor: 'var(--line)',
                    backgroundColor: on ? 'rgba(255,255,255,0.18)' : 'transparent',
                }}
            >
                <span
                    className="absolute top-1/2 h-3 w-3 rounded-full"
                    style={{
                        left: 1,
                        transform: on ? 'translate(12px, -50%)' : 'translate(0px, -50%)',
                        backgroundColor: on ? '#E7E9EC' : '#5C626B',
                        transition: 'transform 120ms var(--ease-out-expo), background-color 120ms linear',
                    }}
                />
            </span>
        </button>
    );
}

// ── Region legend → functional filter (§5.7) ─────────────────────────────────
function LegendPanel({ plexus }: any) {
    const nodes = plexus.data?.nodes || [];
    const counts: Record<string, number> = {};
    for (const n of nodes) counts[n.region] = (counts[n.region] || 0) + 1;
    const maxCount = Math.max(1, ...Object.keys(REGIONS).map((k) => counts[k] || 0));
    const anyHidden = (plexus.hiddenRegions?.size || 0) > 0;

    return (
        <div className="instrument-panel pointer-events-auto flex max-h-[70vh] w-60 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
                <span className="micro-label">Regions</span>
                <div className="flex items-center gap-3">
                    {anyHidden && (
                        <button
                            type="button"
                            onClick={() => plexus.resetRegions()}
                            className="font-sans text-[10px] font-medium uppercase tracking-[0.10em] text-text-lo transition-colors duration-120 hover:text-text-hi"
                        >
                            Reset
                        </button>
                    )}
                    <span className="readout text-[11px] text-text-lo">{nodes.length}</span>
                </div>
            </div>
            <div className="h-px shrink-0" style={{ backgroundColor: DIVIDER }} />
            <div className="overflow-y-auto py-2">
                {Object.entries(REGIONS).map(([key, def]: any) => {
                    const hidden = plexus.hiddenRegions?.has(key);
                    const count = counts[key] || 0;
                    return (
                        <button
                            key={key}
                            type="button"
                            title={`${def.label} — click to ${hidden ? 'show' : 'hide'}, ⌥-click to solo`}
                            onClick={(e) => (e.altKey ? plexus.soloRegion(key) : plexus.toggleRegion(key))}
                            className="flex h-7 w-full items-center gap-2.5 px-3 text-left transition-colors duration-120 hover:bg-[rgba(255,255,255,0.04)]"
                        >
                            <span
                                className="h-2 w-2 shrink-0 rounded-[2px]"
                                style={{ backgroundColor: def.hex, opacity: hidden ? 0.25 : 0.9 }}
                            />
                            <span className="min-w-0 flex-1">
                                <span className={clsx('block truncate text-xs capitalize leading-4', hidden ? 'text-text-ghost' : 'text-text-mid')}>
                                    {def.label}
                                </span>
                                <span
                                    className="mt-px block h-[2px] rounded-[1px]"
                                    style={{
                                        width: `${(count / maxCount) * 100}%`,
                                        backgroundColor: def.hex,
                                        opacity: hidden ? 0.12 : 0.35,
                                        transition: 'width 240ms var(--ease-soft), opacity 120ms linear',
                                    }}
                                />
                            </span>
                            <span className={clsx('readout text-[11px]', hidden ? 'text-text-ghost line-through' : 'text-text-lo')}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Node inspector (§5.8) ────────────────────────────────────────────────────
function NodeInspector({ node, plexus, onRun }: any) {
    const hex = regionHex(node.region);
    const synapses = plexus.data?.synapses || [];
    const id = String(node.id);
    const inbound = synapses.filter((s: any) => String(s.target_node_id) === id).length;
    const outbound = synapses.filter((s: any) => String(s.source_node_id) === id).length;
    const stability = node.health?.stability_score ?? 0.8;
    const dormant = node.status === 'dormant';

    const close = () => {
        plexus.setSelectedNode(null);
        plexus.setSelectedSynapse(null);
    };

    return (
        <div className="instrument-panel flex max-h-[70vh] w-80 flex-col overflow-hidden">
            {/* 2px region hairline — region identity enters ONLY here */}
            <div className="h-[2px] shrink-0" style={{ backgroundColor: hex }} />

            {/* Header */}
            <div className="relative shrink-0 p-4">
                <div className="absolute right-3 top-3">
                    <GhostCloseButton onClick={close} />
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-7">
                    <Tag>{node.type}</Tag>
                    <Tag variant="region" hex={hex}>{regionLabel(node.region)}</Tag>
                    {node.code && <Tag>{node.code}</Tag>}
                    {dormant && <Tag icon={<Moon size={12} />}>Dormant</Tag>}
                </div>
                <h2 className="truncate text-base font-semibold tracking-[-0.01em] text-text-hi" title={node.name}>
                    {node.name}
                </h2>
                {node.file_path && (
                    <p className="mt-1 truncate font-mono text-[11px] text-text-lo" title={node.file_path}>
                        {middleTruncate(node.file_path, 42)}
                    </p>
                )}
            </div>
            <div className="h-px shrink-0" style={{ backgroundColor: DIVIDER }} />

            {/* Body */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                {node.description && (
                    <Section label="Description">
                        <p className="text-[13px] leading-5 text-text-mid">{node.description}</p>
                    </Section>
                )}
                <Section label="Metrics">
                    <div className="flex flex-col">
                        <MetricRow label="Connections in/out" value={`${inbound} / ${outbound}`} />
                        <MetricRow label="Stability" value={Number(stability).toFixed(2)} />
                        <MetricRow label="Degree" value={String(inbound + outbound)} />
                    </div>
                </Section>
                {dormant && (
                    <Section label="Dormant">
                        {/* Neutral well — dormant means asleep, not dangerous (§5.8) */}
                        <div
                            className="flex items-start gap-2 rounded-md p-3"
                            style={{ background: 'var(--surface-well)', borderLeft: '2px solid #8B98A9' }}
                        >
                            <Moon size={12} className="mt-0.5 shrink-0 text-text-mid" />
                            <p className="text-xs leading-4 text-text-mid">
                                {node.dormant_reason || 'This tissue is dormant — no recent activity recorded.'}
                            </p>
                        </div>
                    </Section>
                )}
            </div>

            {/* Footer — THE one light button per viewport */}
            <div className="h-px shrink-0" style={{ backgroundColor: DIVIDER }} />
            <div className="shrink-0 p-4">
                <Button variant="light" className="w-full" onClick={() => onRun(node)}>
                    <Play size={12} /> Run Impact Simulation
                </Button>
            </div>
        </div>
    );
}

// ── Synapse inspector (§5.9) ─────────────────────────────────────────────────
function EndpointRow({ node, hex, fallbackId, onSelect }: any) {
    return (
        <button
            type="button"
            disabled={!node}
            onClick={() => node && onSelect(node)}
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left transition-colors duration-120 enabled:cursor-pointer enabled:hover:bg-[var(--surface-hover)]"
        >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
            <span className="min-w-0 flex-1 truncate text-xs text-text-hi">
                {node?.name || `Node ${fallbackId ?? '—'}`}
            </span>
            <span className="shrink-0 font-mono text-[10px] uppercase text-text-lo">{node?.code || ''}</span>
        </button>
    );
}

function SynapseInspector({ synapse, plexus }: any) {
    const nodes = plexus.data?.nodes || [];
    // Look up endpoints; handle missing gracefully.
    const src = nodes.find((n: any) => String(n.id) === String(synapse.source_node_id)) || null;
    const tgt = nodes.find((n: any) => String(n.id) === String(synapse.target_node_id)) || null;
    const srcHex = src ? regionHex(src.region) : FALLBACK_HEX;
    const tgtHex = tgt ? regionHex(tgt.region) : FALLBACK_HEX;
    const srcName = src?.name || 'Unknown';
    const tgtName = tgt?.name || 'Unknown';
    const dormant = synapse.status === 'dormant';
    const classification = String(synapse.metadata?.impact_classification || 'low').toLowerCase();
    const riskHex = RISK_HEX[classification] || RISK_HEX.low;
    const strength = Math.min(1, Math.max(0, Number(synapse.strength) || 0));

    const close = () => {
        plexus.setSelectedNode(null);
        plexus.setSelectedSynapse(null);
    };
    const selectEndpoint = (n: any) => {
        plexus.setSelectedNode(n);
        plexus.setSelectedSynapse(null);
    };

    return (
        <div className="instrument-panel flex max-h-[70vh] w-80 flex-col overflow-hidden">
            {/* The panel's only color moment: source→target gradient hairline */}
            <div className="h-[2px] shrink-0" style={{ background: `linear-gradient(90deg, ${srcHex}, ${tgtHex})` }} />

            {/* Header */}
            <div className="relative shrink-0 p-4">
                <div className="absolute right-3 top-3">
                    <GhostCloseButton onClick={close} />
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-7">
                    <Tag>Synapse</Tag>
                    {synapse.code && <Tag>{synapse.code}</Tag>}
                    {dormant && <Tag icon={<Moon size={12} />}>Dormant</Tag>}
                </div>
                <h2 className="truncate text-sm font-semibold tracking-[-0.005em] text-text-hi" title={`${srcName} → ${tgtName}`}>
                    {srcName} → {tgtName}
                </h2>
            </div>
            <div className="h-px shrink-0" style={{ backgroundColor: DIVIDER }} />

            {/* Body */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                {synapse.description && (
                    <Section label="Description">
                        <p className="text-[13px] leading-5 text-text-mid">{synapse.description}</p>
                    </Section>
                )}

                {/* CIRCUIT — wiring diagram; endpoint rows select that node */}
                <Section label="Circuit">
                    <div className="flex flex-col">
                        <EndpointRow node={src} hex={srcHex} fallbackId={synapse.source_node_id} onSelect={selectEndpoint} />
                        {/* dashed connector + 3px arrowhead, aligned to the dot column */}
                        <div style={{ paddingLeft: 9 }}>
                            <div className="flex w-[6px] flex-col items-center">
                                <span style={{ width: 0, height: 12, borderLeft: '1px dashed rgba(255,255,255,0.12)' }} />
                                <span
                                    style={{
                                        width: 0,
                                        height: 0,
                                        borderLeft: '3px solid transparent',
                                        borderRight: '3px solid transparent',
                                        borderTop: '3px solid rgba(255,255,255,0.12)',
                                    }}
                                />
                            </div>
                        </div>
                        <EndpointRow node={tgt} hex={tgtHex} fallbackId={synapse.target_node_id} onSelect={selectEndpoint} />
                    </div>
                </Section>

                <Section label="Impact Analysis">
                    <div className="flex flex-col gap-2.5 rounded-md border border-line-faint bg-ink-3 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-text-mid">Classification</span>
                            <Tag variant="risk" hex={riskHex}>{classification}</Tag>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-text-mid">Final Strength</span>
                            <span className="flex items-center gap-2">
                                <span className="readout text-xs text-text-hi">{(Number(synapse.strength) || 0).toFixed(2)}</span>
                                <span className="h-[2px] w-16 overflow-hidden rounded-[1px]" style={{ backgroundColor: 'var(--line-faint)' }}>
                                    <span
                                        className="block h-full"
                                        style={{ width: `${strength * 100}%`, backgroundColor: 'rgba(255,255,255,0.6)' }}
                                    />
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-text-mid">Intrinsic Weight</span>
                            <span className="readout text-xs text-text-mid">
                                {(Number(synapse.metadata?.intrinsic_importance) || 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-text-mid">Cascade Influence</span>
                            <span className="readout text-xs text-text-mid">{synapse.metadata?.cascade_influence || 0} deps</span>
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
}

// ── Simulation results panel (§5.10) ─────────────────────────────────────────
function SimCell({ label, value, color, icon, suffix, decimals = 0, delay = 0 }: any) {
    const v = useCountUp(value, delay);
    return (
        <div className="flex flex-col px-4 py-3">
            <span className="micro-label flex items-center gap-1.5">
                {icon}
                {label}
            </span>
            <span className="readout mt-1 text-2xl leading-7" style={{ color }}>
                {decimals ? v.toFixed(decimals) : Math.round(v)}
                {suffix ? <span className="text-xs text-text-lo">{suffix}</span> : null}
            </span>
        </div>
    );
}

function SimulationPanel({ result, sourceName, onClose }: any) {
    const riskScore = Number(result.risk_score) || 0;
    const riskVal = riskScore * 10;
    const affected = Number(result.total_affected) || 0;
    const criticalPaths = (result.blast_radius || []).filter((b: any) => b.impact_level === 'critical').length;
    const alerts = Number(result.amygdala_alerts) || 0;

    // Risk-tier hairline (§5.10): >0.7 critical, >0.4 high, otherwise ACHROMATIC.
    const hairline = riskScore > 0.7 ? 'var(--risk-critical)' : riskScore > 0.4 ? 'var(--risk-high)' : 'var(--line-strong)';
    const riskColor = riskScore > 0.7 ? 'var(--risk-critical)' : riskScore > 0.4 ? 'var(--risk-high)' : 'var(--text-hi)';

    return (
        <div className="instrument-panel overflow-hidden">
            <div className="h-[2px]" style={{ backgroundColor: hairline }} />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex min-w-0 items-baseline gap-3">
                    <span className="micro-label shrink-0">Impact Simulation</span>
                    {sourceName ? <span className="truncate text-[13px] text-text-hi">{sourceName}</span> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <GhostCloseButton onClick={onClose} />
                    <kbd className="keycap">ESC</kbd>
                </div>
            </div>
            <div className="h-px" style={{ backgroundColor: DIVIDER }} />

            {/* Readout strip — hairline-separated cells, NO card backgrounds */}
            <div className="grid grid-cols-4 divide-x divide-line">
                <SimCell label="Risk" value={riskVal} decimals={1} suffix=" / 10" color={riskColor} delay={0} />
                <SimCell label="Affected" value={affected} color="var(--text-hi)" delay={60} />
                <SimCell
                    label="Critical Paths"
                    value={criticalPaths}
                    color={criticalPaths > 0 ? 'var(--risk-critical)' : 'var(--text-hi)'}
                    delay={120}
                />
                <SimCell
                    label="Amygdala Alerts"
                    value={alerts}
                    color={alerts > 0 ? 'var(--risk-high)' : 'var(--text-hi)'}
                    icon={<AlertTriangle size={12} style={{ color: alerts > 0 ? 'var(--risk-high)' : 'var(--text-lo)' }} />}
                    delay={180}
                />
            </div>

            {result.recommendation ? (
                <>
                    <div className="h-px" style={{ backgroundColor: DIVIDER }} />
                    <p className="line-clamp-2 px-4 py-3 text-xs leading-4 text-text-mid">{result.recommendation}</p>
                </>
            ) : null}
        </div>
    );
}

// ── Empty / onboarding ghost panel (§5.11) ───────────────────────────────────
function ShortcutRow({ keycap, label }: any) {
    return (
        <div className="flex items-center gap-2">
            <kbd className="keycap">{keycap}</kbd>
            <span className="text-xs text-text-lo">{label}</span>
        </div>
    );
}

function GhostPanel() {
    return (
        <div className="w-80 rounded-lg border border-dashed border-line bg-transparent p-6">
            <div className="flex flex-col items-center text-center">
                <Crosshair size={20} className="text-text-ghost" />
                <div className="mt-3 text-[13px] text-text-mid">No selection</div>
                <div className="mt-1 text-xs text-text-lo">Click a neuron to inspect it.</div>
                <div className="mx-auto mt-5 flex w-max flex-col items-start gap-2">
                    <ShortcutRow keycap="⌘K" label="Search the connectome" />
                    <ShortcutRow keycap="D" label="Toggle dormant tissue" />
                    <ShortcutRow keycap="⎋" label="Deselect" />
                </div>
            </div>
        </div>
    );
}

// ── API-unreachable states (§5.13) ───────────────────────────────────────────
function EngineUnreachableCard({ onRetry }: any) {
    return (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-ink-1">
            <div className="instrument-panel w-full max-w-md overflow-hidden">
                <div className="h-[2px]" style={{ backgroundColor: 'var(--risk-high)' }} />
                <div className="p-6">
                    <div className="micro-label" style={{ color: 'var(--risk-high)' }}>Engine Unreachable</div>
                    <div className="mt-3 text-sm text-text-hi">Can't reach the Plexus engine.</div>
                    <div className="mt-1 font-mono text-xs text-text-mid">{API_BASE}</div>
                    <Button variant="light" className="mt-5" onClick={onRetry}>Retry</Button>
                </div>
            </div>
        </div>
    );
}

function LinkLostBanner({ retryIn, onRetryNow }: any) {
    return (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-40 -translate-x-1/2">
            <div className="instrument-panel flex items-center gap-3 px-4 py-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-mid">
                    {retryIn != null ? `Engine link lost — retrying in ${retryIn}s` : 'Engine link lost — retrying…'}
                </span>
                <button
                    type="button"
                    onClick={onRetryNow}
                    className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo transition-colors duration-120 hover:text-text-hi"
                >
                    Retry now
                </button>
            </div>
        </div>
    );
}

// ── Presence styles (§7: entrances 240ms, exits 160ms, reduced-motion keeps fades) ──
function presenceStyle(visible: boolean, hiddenTransform: string, enterEase: string, reduced: boolean): React.CSSProperties {
    return {
        opacity: visible ? 1 : 0,
        transform: reduced ? 'none' : visible ? 'none' : hiddenTransform,
        transition: visible
            ? `opacity 240ms ${enterEase}, transform 240ms ${enterEase}`
            : 'opacity 160ms var(--ease-in-quiet), transform 160ms var(--ease-in-quiet)',
    };
}

// ── Main overlay ─────────────────────────────────────────────────────────────
export default function UIOverlay({ plexus }: any) {
    const { selectedNode, selectedSynapse, simulationResult } = plexus;
    const searchQuery: string = plexus.searchQuery || '';

    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchBoxRef = useRef<HTMLDivElement>(null);
    const [searchFocused, setSearchFocused] = useState(false);
    const [dropdownDismissed, setDropdownDismissed] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [simSourceName, setSimSourceName] = useState('');
    const [onboarded, setOnboarded] = useState<boolean>(() => {
        try { return !!localStorage.getItem('plexus.onboarded'); } catch { return true; }
    });

    const reduced = prefersReducedMotion();

    // Node index for synapse endpoint lookups in search results.
    const nodeIndex = useMemo(() => {
        const m = new Map<string, any>();
        for (const n of plexus.data?.nodes || []) m.set(String(n.id), n);
        return m;
    }, [plexus.data]);

    // §5.4 matcher — exact `code` matches ranked first; hidden regions excluded.
    const { searchResults, totalMatches } = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (q.length < 2) return { searchResults: [] as any[], totalMatches: 0 };
        const out: any[] = [];
        for (const n of plexus.data?.nodes || []) {
            if (plexus.hiddenRegions?.has(n.region)) continue;
            const name = String(n.name || '').toLowerCase();
            const code = String(n.code || '').toLowerCase();
            const path = String(n.file_path || '').toLowerCase();
            if (!(name.includes(q) || code.includes(q) || path.includes(q))) continue;
            out.push({
                kind: 'node',
                item: n,
                name: n.name,
                path: n.file_path || '',
                hex: regionHex(n.region),
                type: n.type || 'node',
                rank: code === q ? 0 : name === q ? 1 : name.startsWith(q) ? 2 : 3,
            });
        }
        for (const s of plexus.data?.synapses || []) {
            const code = String(s.code || '').toLowerCase();
            if (!code || !code.includes(q)) continue;
            const src = nodeIndex.get(String(s.source_node_id));
            const tgt = nodeIndex.get(String(s.target_node_id));
            if (src && plexus.hiddenRegions?.has(src.region)) continue;
            if (tgt && plexus.hiddenRegions?.has(tgt.region)) continue;
            out.push({
                kind: 'synapse',
                item: s,
                name: src && tgt ? `${src.name} → ${tgt.name}` : s.code || 'Synapse',
                path: s.code || '',
                hex: src ? regionHex(src.region) : FALLBACK_HEX,
                type: 'synapse',
                rank: code === q ? 0 : 3,
            });
        }
        out.sort((a, b) => a.rank - b.rank);
        return { searchResults: out.slice(0, 8), totalMatches: out.length };
    }, [searchQuery, plexus.data, plexus.hiddenRegions, nodeIndex]);

    const dropdownOpen = searchQuery.length >= 2 && !dropdownDismissed;
    const effActiveIndex = Math.min(activeIndex, Math.max(0, searchResults.length - 1));

    const selectResult = (r: any) => {
        if (r.kind === 'node') {
            plexus.setSelectedNode(r.item);
            plexus.setSelectedSynapse(null);
        } else {
            plexus.setSelectedSynapse(r.item);
            plexus.setSelectedNode(null);
        }
        setDropdownDismissed(true);
        searchInputRef.current?.blur();
    };

    // Onboarding dismisses forever after the first node selection (§5.11).
    useEffect(() => {
        if (!onboarded && selectedNode) {
            try { localStorage.setItem('plexus.onboarded', '1'); } catch { /* noop */ }
            setOnboarded(true);
        }
    }, [selectedNode, onboarded]);

    // ── Keyboard layer (§5.12): ONE window keydown handler ──────────────────
    const keyCtx = useRef<any>({});
    keyCtx.current = { plexus, dropdownOpen, setDropdownDismissed };
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const c = keyCtx.current;
            // ⌘K / Ctrl+K → focus search (works while typing too)
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
                return;
            }
            if (e.key === 'Escape') {
                // Escape precedence ladder — strict order, one action per press.
                if (c.dropdownOpen) {
                    c.setDropdownDismissed(true); // 1. close dropdown (keep query)
                    return;
                }
                if (searchInputRef.current && document.activeElement === searchInputRef.current) {
                    c.plexus.setSearchQuery(''); // 2. clear query + blur
                    searchInputRef.current.blur();
                    return;
                }
                if (c.plexus.selectedNode || c.plexus.selectedSynapse) {
                    c.plexus.setSelectedNode(null); // 3. deselect (closes inspector)
                    c.plexus.setSelectedSynapse(null);
                    return;
                }
                if (c.plexus.simulationResult) {
                    c.plexus.setSimulationResult(null); // 4. clear simulation panel
                }
                return;
            }
            // All remaining shortcuts no-op while a text input is focused.
            const t = e.target as HTMLElement;
            const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable);
            if (typing) return;
            if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'd') {
                c.plexus.setShowDormant(!c.plexus.showDormant); // D → toggle dormant
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Outside click closes the dropdown.
    useEffect(() => {
        const onPointer = (e: PointerEvent) => {
            if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
                setDropdownDismissed(true);
            }
        };
        window.addEventListener('pointerdown', onPointer);
        return () => window.removeEventListener('pointerdown', onPointer);
    }, []);

    // ── Presence: inspector (right), simulation (bottom), ghost (right) ─────
    const inspectorShow = !!(selectedNode || selectedSynapse);
    const inspector = usePresence(inspectorShow, 160);
    const lastInspectedRef = useRef<any>(null);
    if (selectedNode) lastInspectedRef.current = { kind: 'node', item: selectedNode };
    else if (selectedSynapse) lastInspectedRef.current = { kind: 'synapse', item: selectedSynapse };
    const inspected = inspectorShow
        ? selectedNode
            ? { kind: 'node', item: selectedNode }
            : { kind: 'synapse', item: selectedSynapse }
        : lastInspectedRef.current;

    const sim = usePresence(!!simulationResult, 160);
    const lastSimRef = useRef<any>(null);
    if (simulationResult) lastSimRef.current = simulationResult;
    const simData = simulationResult || lastSimRef.current;

    const ghostShow = !onboarded && !inspectorShow;
    const ghost = usePresence(ghostShow, 240);

    const handleRunSimulation = (node: any) => {
        setSimSourceName(node?.name || '');
        plexus.runSimulation(node.id);
    };

    const dormantCount = (plexus.data?.nodes || []).filter((n: any) => n.status === 'dormant').length;

    // ── ENGINE UNREACHABLE (§5.13): initial load failed, no data yet ────────
    if (plexus.error && !(plexus.data?.nodes?.length > 0)) {
        return (
            <div className="pointer-events-none absolute inset-0">
                <EngineUnreachableCard onRetry={plexus.retryNow} />
            </div>
        );
    }

    return (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {/* ENGINE LINK LOST banner (§5.13) */}
            {plexus.linkLost && <LinkLostBanner retryIn={plexus.retryIn} onRetryNow={plexus.retryNow} />}

            {/* ── Top bar ───────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between p-4">
                {/* Brand + search island (§5.3) */}
                <div ref={searchBoxRef} className="pointer-events-auto relative">
                    <div
                        className="instrument-panel flex h-10 items-center transition-[border-color,box-shadow] duration-120"
                        style={
                            searchFocused
                                ? {
                                      borderColor: 'rgba(255,255,255,0.12)',
                                      boxShadow: 'var(--shadow-panel), 0 0 0 1px rgba(255,255,255,0.12)',
                                  }
                                : undefined
                        }
                    >
                        <div className="flex items-center gap-2.5 pl-4 pr-3">
                            <LogoMark size={16} className="text-text-hi" />
                            <span className="wordmark">Plexus</span>
                            <span className="font-mono text-[10px] text-text-ghost">v0.1</span>
                            <ProjectNameChip project={plexus.project} onRename={plexus.renameProject} />
                        </div>
                        <div className="my-2 w-px self-stretch bg-line" />
                        <div className="flex w-80 items-center gap-2 px-3">
                            <Search size={14} className="shrink-0 text-text-lo" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search nodes, files, synapses…"
                                value={searchQuery}
                                onChange={(e) => {
                                    plexus.setSearchQuery(e.target.value);
                                    setDropdownDismissed(false);
                                    setActiveIndex(0);
                                }}
                                onFocus={() => {
                                    setSearchFocused(true);
                                    setDropdownDismissed(false);
                                }}
                                onBlur={() => setSearchFocused(false)}
                                onKeyDown={(e) => {
                                    if (!dropdownOpen) return;
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setActiveIndex((i) => Math.min(i + 1, Math.max(0, searchResults.length - 1)));
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setActiveIndex((i) => Math.max(i - 1, 0));
                                    } else if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const r = searchResults[effActiveIndex];
                                        if (r) selectResult(r);
                                    }
                                }}
                                className="w-full bg-transparent text-[13px] text-text-hi placeholder:text-text-ghost focus:outline-none"
                            />
                            <kbd className="keycap shrink-0">⌘K</kbd>
                        </div>
                    </div>

                    {/* Search results dropdown (§5.4) — anchored 6px below, same width */}
                    {dropdownOpen && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-1.5">
                            <SearchDropdown
                                results={searchResults}
                                totalCount={totalMatches}
                                query={searchQuery}
                                activeIndex={effActiveIndex}
                                onActiveIndex={setActiveIndex}
                                onSelect={selectResult}
                            />
                        </div>
                    )}
                </div>

                {/* Top-right island group: dormant toggle + stat cluster */}
                <div className="pointer-events-auto flex items-start gap-3">
                    <DormantToggle
                        on={plexus.showDormant}
                        count={dormantCount}
                        onToggle={() => plexus.setShowDormant(!plexus.showDormant)}
                    />
                    <StatCluster data={plexus.data} />
                </div>
            </div>

            {/* ── Middle: legend (left) + inspector / ghost (right) ─────────── */}
            <div className="flex flex-1 items-start justify-between overflow-hidden px-4">
                <LegendPanel plexus={plexus} />

                <div className="relative w-80">
                    {/* Onboarding ghost panel (§5.11) */}
                    {ghost.mounted && (
                        <div
                            className="pointer-events-auto absolute right-0 top-0 w-80"
                            style={{ opacity: ghost.visible ? 1 : 0, transition: 'opacity 240ms linear' }}
                        >
                            <GhostPanel />
                        </div>
                    )}

                    {/* Inspector with entrance/exit motion (§5.8 / §5.9) */}
                    {inspector.mounted && inspected && (
                        <div
                            className="pointer-events-auto"
                            style={presenceStyle(inspector.visible, 'translateX(8px)', 'var(--ease-out-expo)', reduced)}
                        >
                            {inspected.kind === 'node' ? (
                                <NodeInspector node={inspected.item} plexus={plexus} onRun={handleRunSimulation} />
                            ) : (
                                <SynapseInspector synapse={inspected.item} plexus={plexus} />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom: simulation results (§5.10) ────────────────────────── */}
            <div className="flex justify-center p-4">
                {sim.mounted && simData && (
                    <div
                        className="pointer-events-auto w-full max-w-3xl"
                        style={presenceStyle(sim.visible, 'translateY(12px)', 'cubic-bezier(0.32, 0.72, 0, 1)', reduced)}
                    >
                        <SimulationPanel
                            result={simData}
                            sourceName={simSourceName}
                            onClose={() => plexus.setSimulationResult(null)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
