import React, { useMemo, useState, useRef, Suspense, useEffect, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, QuadraticBezierLine, Html, Grid, Billboard, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';
import * as THREE from 'three';

// ─── Region colors — single source of truth in theme/regions.js (§4) ────────
import { REGIONS, REGION_COLORS } from '../theme/regions';

// ─── Render quality state machine (§6.8) ────────────────────────────────────
import { useQuality } from '../hooks/useQuality';

// §7: reduced motion disables count-ups, slides, ring rotation, arrival shot.
const REDUCED_MOTION =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EMPTY_SET = new Set<string>();
const ORIGIN = new THREE.Vector3(0, 0, 0);

// ─── The invisible brain (anatomy in theme/brainAnatomy.js) ──────────────────
// Nodes are sampled inside per-region 3D cavity volumes whose union forms a
// lateral-view brain; filler tissue (Fillers.tsx) completes the silhouette.
// §6.2: if the anatomy scale ever changes, retune fog [160, 420] and grid y.
import { samplePointInRegion } from '../theme/brainAnatomy';
import Fillers from './Fillers';

// ─── Low-mode selection halo (§6.8) ──────────────────────────────────────────
// One shared pre-baked 128px radial-gradient CanvasTexture; tinted via the
// sprite material color to the region hex, additive blending. Attached only
// to the selected node when quality === 'low' so selection still glows
// without postprocessing. One texture total.
let _haloTexture: THREE.CanvasTexture | null = null;
function getHaloTexture() {
    if (_haloTexture) return _haloTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,0.85)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.25)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
    }
    _haloTexture = new THREE.CanvasTexture(canvas);
    return _haloTexture;
}

// ─── Simulation wave — risk scale (§6.4) ────────────────────────────────────
const SIM_WAVE: Record<string, { color: string; intensity: number }> = {
    critical: { color: '#E5484D', intensity: 2.2 },
    high: { color: '#E08A39', intensity: 1.8 },
    moderate: { color: '#D9B13D', intensity: 1.4 },
    low: { color: '#C8CFDA', intensity: 1.0 },
};

// ─── Selection reticle (§6.5) ────────────────────────────────────────────────
// Camera-facing precision crosshair, not a glow. Inner ring #E7E9EC, outer
// ring in region hex rotating 0.15 rad/s. Scales in 1.3×→1× over 200ms.
function SelectionReticle({ size, hex }: any) {
    const groupRef = useRef<any>(null);
    const outerRef = useRef<any>(null);
    const startRef = useRef<number>(-1);

    useFrame((state, delta) => {
        if (REDUCED_MOTION) return;
        if (startRef.current < 0) startRef.current = state.clock.elapsedTime;
        const t = Math.min(1, (state.clock.elapsedTime - startRef.current) / 0.2);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out
        if (groupRef.current) groupRef.current.scale.setScalar(1.3 + (1.0 - 1.3) * eased);
        if (outerRef.current) outerRef.current.rotation.z += 0.15 * delta;
    });

    return (
        <Billboard>
            <group ref={groupRef} scale={REDUCED_MOTION ? 1 : 1.3}>
                <mesh>
                    <ringGeometry args={[size * 1.5, size * 1.55, 48]} />
                    <meshBasicMaterial color="#E7E9EC" transparent opacity={0.9} depthTest={false} side={THREE.DoubleSide} />
                </mesh>
                <mesh ref={outerRef}>
                    <ringGeometry args={[size * 1.9, size * 1.92, 48]} />
                    <meshBasicMaterial color={hex} transparent opacity={0.5} side={THREE.DoubleSide} />
                </mesh>
            </group>
        </Billboard>
    );
}

// ─── 3D node tooltip (§5.14) ─────────────────────────────────────────────────
function NodeTooltip({ node, hex }: any) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const regionLabel = (REGIONS as any)[node.region]?.label || node.region || '';
    const line2 = [regionLabel, node.code].filter(Boolean).join(' · ');

    return (
        <Html distanceFactor={15} zIndexRange={[10, 0]}>
            <div
                className="pointer-events-none whitespace-nowrap"
                style={{
                    background: 'rgba(13,14,16,0.92)',
                    border: '1px solid var(--line-strong)',
                    borderLeft: `2px solid ${hex}`,
                    borderRadius: 'var(--radius)',
                    padding: '6px 10px',
                    boxShadow: 'var(--shadow-tooltip)',
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 120ms linear',
                }}
            >
                <div style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--text-hi)' }}>{node.name}</div>
                <div style={{ font: '400 10px/14px var(--font-mono)', color: 'var(--text-lo)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {line2}
                </div>
            </div>
        </Html>
    );
}

// ─── Node Mesh (§6.4) ────────────────────────────────────────────────────────
// Matte instrument sphere. Size scales with connection count. Color = region
// hex darkened 40%; emissive = region hex. Glow is earned (selection 1.3,
// simulation wave 1.4–2.2) — the resting scene stays under bloom threshold.
function NodeMesh({ node, isSelected, isSimulated, onClick, connectionCount, maxDegree, _tick, simStartTime, hidden, quality }: any) {
    const hex = REGION_COLORS[node.region] || '#FFFFFF';
    const materialRef = useRef<any>(null);
    const meshRef = useRef<any>(null);
    const [hovered, setHovered] = useState(false);

    // Degree ramp: the more synapses, the bigger AND brighter the neuron.
    // Log-normalized so hubs don't flatten everything else to zero.
    const degree = Math.log(1 + (connectionCount || 0)) / Math.log(1 + Math.max(1, maxDegree || 1));

    // Color luminance rises with degree: dim periphery → bright hubs
    const baseColor = useMemo(() => new THREE.Color(hex).multiplyScalar(0.45 + 0.4 * degree), [hex, degree]);
    const targetEmissiveColor = useMemo(() => new THREE.Color(hex), [hex]);

    // Size: degree-dominant (0.55 leaf → 4.0 hub)
    const size = Math.min(4.0, 0.55 + 3.4 * Math.pow(degree, 1.25));

    const clamp = (val: number) => Math.max(-200, Math.min(200, val || 0));

    // §6.4: hidden (region-filtered) nodes never intercept clicks meant for
    // visible tissue behind them. Restore the prototype raycast when unhidden.
    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        if (hidden) {
            mesh.raycast = () => null;
            setHovered(false);
            document.body.style.cursor = 'auto';
        } else {
            delete mesh.raycast;
        }
    }, [hidden]);

    // Reset cursor if this node unmounts while hovered
    useEffect(() => {
        return () => {
            if (hovered) document.body.style.cursor = 'auto';
        };
    }, [hovered]);

    useFrame(() => {
        const mat = materialRef.current;
        const mesh = meshRef.current;

        if (mat) {
            // Degree-luminous emissive: leaf 0.35 → hub 1.8 (hubs cross the bloom
            // threshold at rest and glow — the reference-image look). Selection
            // outshines everything; dormant stays preserved tissue, not warning.
            let targetIntensity = 0.5 + 1.35 * degree;
            targetEmissiveColor.set(hex);
            if (hovered) targetIntensity = Math.max(1.0, targetIntensity + 0.35);
            if (isSelected) targetIntensity = 2.2;
            if (node.status === 'dormant') targetIntensity = 0.18; // preserved tissue, not warning

            // §6.4 simulation impact recolor — risk scale, 150ms-per-hop wave
            if (isSimulated && node.status !== 'dormant') {
                const delayMs = (isSimulated.distance_from_source || 0) * 150;
                const arrived = !simStartTime || (Date.now() - simStartTime >= delayMs);
                if (arrived) {
                    const wave = SIM_WAVE[isSimulated.impact_level] || SIM_WAVE.low;
                    targetEmissiveColor.set(wave.color);
                    targetIntensity = wave.intensity;
                }
            }

            mat.emissive.lerp(targetEmissiveColor, 0.1);
            mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetIntensity, 0.1);

            // §6.4 opacity: dormant 0.35; hidden region fades to 0.08 (~250ms lerp)
            const targetOpacity = hidden ? 0.08 : node.status === 'dormant' ? 0.35 : 1.0;
            mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
        }

        if (mesh) {
            // §6.5: selected node scales 1.15× (lerped) — never the 1.5× jump
            const targetScale = isSelected ? 1.15 : 1.0;
            mesh.scale.setScalar(THREE.MathUtils.lerp(mesh.scale.x, targetScale, 0.15));
        }
    });

    return (
        <group position={[clamp(node.x), clamp(node.y), clamp(node.z)]}>
            <Sphere
                ref={meshRef}
                args={[size, isSelected ? 24 : 16, isSelected ? 24 : 16]}
                onClick={() => onClick(node)}
                onPointerOver={(e: any) => {
                    e.stopPropagation();
                    setHovered(true);
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    setHovered(false);
                    document.body.style.cursor = 'auto';
                }}
            >
                <meshStandardMaterial
                    ref={materialRef}
                    color={baseColor}
                    emissive={hex}
                    emissiveIntensity={0}
                    roughness={0.35}
                    metalness={0.1}
                    toneMapped={false}
                    transparent={true}
                    opacity={node.status === 'dormant' ? 0.35 : 1.0}
                />
            </Sphere>

            {isSelected && !hidden && <SelectionReticle size={size} hex={hex} />}

            {/* §6.8 low mode: selection glows via the shared halo sprite */}
            {isSelected && !hidden && quality === 'low' && (
                <sprite scale={[size * 4, size * 4, 1]} raycast={() => null}>
                    <spriteMaterial
                        map={getHaloTexture()}
                        color={hex}
                        blending={THREE.AdditiveBlending}
                        transparent
                        depthWrite={false}
                        toneMapped={false}
                    />
                </sprite>
            )}

            {isSelected && !hidden && <NodeTooltip node={node} hex={hex} />}
        </group>
    );
}

// ─── Synapse Line (§6.6) ─────────────────────────────────────────────────────
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [255, 255, 255];
};

const blendColors = (c1: string, c2: string) => {
    const [r1, g1, b1] = hexToRgb(c1);
    const [r2, g2, b2] = hexToRgb(c2);
    return `#${Math.round((r1 + r2) / 2).toString(16).padStart(2, '0')}${Math.round((g1 + g2) / 2).toString(16).padStart(2, '0')}${Math.round((b1 + b2) / 2).toString(16).padStart(2, '0')}`;
};

const SLATE = new THREE.Color('#8B98A9');

// Curved bezier line. Graphite circuitry with hue hints: resting color is the
// source/target region blend mixed 35% toward slate; selecting a node lights
// its circuit (unmixed blend @ 0.8) and dims everything else to 0.05.
function SynapseLine({ source, target, strength, status, classification, hiddenRegions, selectedNodeId }: any) {
    const [sourcePos, setSourcePos] = useState<[number, number, number]>([-50, -50, -50]);
    const [targetPos, setTargetPos] = useState<[number, number, number]>([50, 50, 50]);
    const [ready, setReady] = useState(false);
    const lineRef = useRef<any>(null);

    // Color: blend source and target region colors for cross-region synapses
    const sourceColor = (typeof source === 'object' && source.region) ? (REGION_COLORS[source.region] || '#FFFFFF') : '#8B98A9';
    const targetColor = (typeof target === 'object' && target.region) ? (REGION_COLORS[target.region] || '#FFFFFF') : sourceColor;
    const blendHex = sourceColor === targetColor ? sourceColor : blendColors(sourceColor, targetColor);

    // Reference-luminous web: resting lines keep nearly full region color (only
    // 12% slate); circuit tracing pushes color past 1.0 so probed paths bloom.
    const colors = useMemo(() => {
        const unmixed = new THREE.Color(blendHex);
        const mixed = unmixed.clone().lerp(SLATE, 0.08);
        const circuit = unmixed.clone().multiplyScalar(1.6);
        return { unmixed, mixed, circuit, mixedHex: `#${mixed.getHexString()}` };
    }, [blendHex]);

    // Static random offset for the bezier curve midpoint to prevent vibration
    const curveOffset = useMemo(() => [
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
    ], []);

    // 3 discrete width tiers — 0.12 / 0.30 / 0.60
    let tierWidth = 0.12; // thin
    if (classification === 'critical' || strength > 2.0) tierWidth = 0.60; // thick
    else if (classification === 'high' || classification === 'moderate' || strength > 1.2) tierWidth = 0.30; // medium
    const lineWidth = tierWidth;

    const isDormant = status === 'dormant' ||
        (typeof source === 'object' && source.status === 'dormant') ||
        (typeof target === 'object' && target.status === 'dormant');

    // Luminous web: base opacity = clamp(0.18 + strength * 0.22, 0.18, 0.55); dormant 0.15
    const baseOpacity = isDormant ? 0.15 : Math.max(0.18, Math.min(0.55, 0.18 + (strength || 0) * 0.22));

    const clamp = (val: number) => Math.max(-200, Math.min(200, val || 0));

    useFrame(() => {
        if (typeof source === 'object' && typeof target === 'object') {
            if (
                typeof source.x === 'number' && !Number.isNaN(source.x) &&
                typeof target.x === 'number' && !Number.isNaN(target.x) &&
                Number.isFinite(source.x) && Number.isFinite(target.x)
            ) {
                setSourcePos([clamp(source.x), clamp(source.y), clamp(source.z)]);
                setTargetPos([clamp(target.x), clamp(target.y), clamp(target.z)]);
                if (!ready) setReady(true);
            }
        }

        // §6.6 material mutation only — opacity/color lerp ~250ms, never a rebuild
        const mat = lineRef.current?.material;
        if (mat) {
            const sObj = typeof source === 'object' ? source : null;
            const tObj = typeof target === 'object' ? target : null;
            const hidden =
                !!(sObj && hiddenRegions.has(sObj.region)) ||
                !!(tObj && hiddenRegions.has(tObj.region));
            const touchesSelected = !!selectedNodeId &&
                ((sObj && sObj.id === selectedNodeId) || (tObj && tObj.id === selectedNodeId));

            let targetOpacity = baseOpacity;
            let targetColor = colors.mixed;
            if (selectedNodeId) {
                // CIRCUIT TRACING: light the probe path (bloom-hot), dim the rest
                if (touchesSelected) {
                    targetOpacity = 0.85;
                    targetColor = colors.circuit;
                } else {
                    targetOpacity = 0.05;
                }
            }
            if (hidden) targetOpacity = 0.03; // region-filtered synapses

            mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
            mat.color.lerp(targetColor, 0.1);
        }
    });

    if (!ready) return null;

    // §10.3: Bezier midpoint — use the static curve offset
    const mid: [number, number, number] = [
        (sourcePos[0] + targetPos[0]) / 2 + curveOffset[0],
        (sourcePos[1] + targetPos[1]) / 2 + curveOffset[1],
        (sourcePos[2] + targetPos[2]) / 2 + curveOffset[2],
    ];

    return (
        <QuadraticBezierLine
            ref={lineRef}
            start={sourcePos}
            end={targetPos}
            mid={mid}
            color={colors.mixedHex}
            lineWidth={lineWidth}
            transparent
            dashed={isDormant}
            dashScale={isDormant ? 20 : 0}
            dashSize={isDormant ? 2 : 0}
            gapSize={isDormant ? 1 : 0}
            opacity={baseOpacity}
        />
    );
}

// ─── Graph Simulation (§9) ───────────────────────────────────────────────────
function GraphSimulation({ plexus, quality }: any) {
    const [ticks, setTicks] = useState(0);

    // §5.7/§6.4: hiddenRegions consumed defensively — material mutations only,
    // NEVER a graph rebuild (deliberately NOT a dep of the layout memo below).
    const hiddenRegions: Set<string> = plexus.hiddenRegions ?? EMPTY_SET;
    const selectedNodeId = plexus.selectedNode?.id ?? null;

    // Build connection count lookup
    const connectionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        if (!plexus?.data?.synapses || !Array.isArray(plexus.data.synapses)) return counts;

        for (const s of plexus.data.synapses) {
            counts[s.source_node_id] = (counts[s.source_node_id] || 0) + 1;
            counts[s.target_node_id] = (counts[s.target_node_id] || 0) + 1;
        }
        return counts;
    }, [plexus.data.synapses]);

    // Degree ceiling for the size/brightness ramps
    const maxDegree = useMemo(() => {
        let max = 1;
        for (const k in connectionCounts) if (connectionCounts[k] > max) max = connectionCounts[k];
        return max;
    }, [connectionCounts]);

    // Compute 3D physics structure
    const graph = useMemo(() => {
        if (!plexus?.data?.nodes || !Array.isArray(plexus.data.nodes)) {
            return { nodes: [], links: [], simulation: null };
        }

        const filteredNodes = plexus.data.nodes.filter((n: any) => plexus.showDormant ? true : n.status !== 'dormant');

        let allNodes = [...filteredNodes];
        if (plexus.showDormant && plexus?.data?.amygdala) {
            const amygdalaNodes = plexus.data.amygdala.map((a: any) => ({
                id: a.id,
                code: `AMY-${a.id.substring(0, 4).toUpperCase()}`,
                name: a.title,
                type: 'incident',
                region: 'amygdala',
                status: 'dormant',
                file_path: 'amygdala-log.json',
                description: a.what_broke || a.title
            }));
            allNodes = [...allNodes, ...amygdalaNodes];
        }

        const getHash = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
            }
            return hash;
        };

        const getSeededRandom = (seed: number) => {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };

        const nodes = allNodes.map((n: any, i: number) => {
            // Seed initial positions inside the region's anatomical cavity volume.
            // Deterministic random using node ID, preventing nodes diving to new
            // random anchors on every React state switch.
            const seed = getHash(n.id);
            const r1 = getSeededRandom(seed);
            const r2 = getSeededRandom(seed + 1);
            const r3 = getSeededRandom(seed + 2);
            const r4 = getSeededRandom(seed + 3);

            // Lock the node to an unbreakable personal 3D anchor so the gravity doesn't collapse the X/Y/Z width
            const [targetX, targetY, targetZ] = samplePointInRegion(n.region, r1, r2, r3, r4);

            return {
                ...n,
                x: targetX,
                y: targetY,
                z: targetZ,
                targetX: targetX,
                targetY: targetY,
                targetZ: targetZ
            };
        });

        const links = (plexus?.data?.synapses || []).reduce((acc: any[], s: any) => {
            if (!s || typeof s !== 'object') return acc;

            const sourceExists = nodes.some((n: any) => n && n.id === s.source_node_id);
            const targetExists = nodes.some((n: any) => n && n.id === s.target_node_id);
            if (sourceExists && targetExists) {
                acc.push({
                    source: Number.isInteger(s.source_node_id) ? String(s.source_node_id) : s.source_node_id,
                    target: Number.isInteger(s.target_node_id) ? String(s.target_node_id) : s.target_node_id,
                    strength: s.strength || 0,
                    status: s.status,
                    classification: s.metadata?.impact_classification || 'low'
                });
            }
            return acc;
        }, []);

        if (plexus.showDormant && plexus?.data?.amygdala) {
            for (const a of plexus.data.amygdala) {
                const text = `${a.title} ${a.what_broke} ${(a.lessons || []).join(' ')}`.toLowerCase();

                // Heuristic: Front-end DOM vs Back-end Node
                const isFrontend = text.includes('dom') || text.includes('body') || text.includes('boundingbox') || text.includes('viewport');
                const isBackend = text.includes('server') || text.includes('hierarchy') || text.includes('selector') || !isFrontend;

                const targetNodes = [];
                if (isFrontend) {
                    const fn = nodes.find((n: any) => n.name === 'nudge-inject.js' && n.region !== 'amygdala');
                    if (fn) targetNodes.push(fn);
                }
                if (isBackend) {
                    const bn = nodes.find((n: any) => n.name === 'server.js' && n.region !== 'amygdala');
                    if (bn) targetNodes.push(bn);
                }

                for (const target of targetNodes) {
                    links.push({
                        source: a.id,
                        target: target.id,
                        strength: a.severity === 'critical' ? 3.0 : a.severity === 'high' ? 2.0 : 1.0,
                        status: 'dormant',
                        classification: a.severity || 'high',
                        code: `SYN-${a.id.substring(0, 4).toUpperCase()}-${target.id.substring(0, 4).toUpperCase()}`
                    });
                }
            }
        }

        // §9.2: Force-directed layout tuned for strict cavity containment —
        // repulsion must never shove tissue outside the invisible brain.
        const simulation = forceSimulation(nodes || [], 3)
            .velocityDecay(0.7) // High friction to lock nodes quickly
            .force("link", forceLink(links || []).id((d: any) => d.id).distance(12).strength((link: any) => {
                // Prevent cross-region links from dragging nodes into other lobes
                return link.source.region === link.target.region ? 0.25 : 0.004;
            }))
            .force("charge", forceManyBody().strength(-5).distanceMax(18)) // local spacing only

        // §9.1: Personal anchor gravity — the anchor IS the anatomy; it wins.
        simulation.force("regionGravity", () => {
            const alpha = simulation.alpha();
            nodes.forEach((d: any) => {
                if (d.targetX !== undefined) {
                    const pullStrength = d.region === 'amygdala' ? 0.9 : 0.65;
                    d.vx += (d.targetX - d.x) * alpha * pullStrength;
                    d.vy += (d.targetY - d.y) * alpha * pullStrength;
                    d.vz += (d.targetZ - d.z) * alpha * pullStrength;
                }
            });
        });

        return { nodes, links, simulation };
        // searchQuery deliberately NOT a dep: typing must never rebuild the force layout
    }, [plexus.data, plexus.showDormant]);

    // Force React to re-render as D3 calculates physics — only while settling (§6.10)
    useFrame(() => {
        if (graph.simulation && graph.simulation.alpha() > 0.01) {
            setTicks(t => t + 1);
        }
    });

    // Cleanup old physics simulations on unmount or deps change to prevent GPU memory leak & flying nodes
    useEffect(() => {
        return () => {
            if (graph.simulation) {
                graph.simulation.stop();
            }
        };
    }, [graph.simulation]);

    const simLookup = useMemo(() => {
        if (!plexus.simulationResult) return {};
        const map: any = {};
        for (const b of plexus.simulationResult.blast_radius) {
            map[b.node_id] = b;
        }
        return map;
    }, [plexus.simulationResult]);

    return (
        <group>
            {/* Decorative tissue filling the invisible brain cavities */}
            <Fillers hiddenRegions={hiddenRegions} dimmed={!!selectedNodeId} />

            {(graph?.links || []).map((link: any, i: number) => (
                <SynapseLine
                    key={i}
                    source={link.source}
                    target={link.target}
                    strength={link.strength}
                    status={link.status}
                    classification={link.classification}
                    hiddenRegions={hiddenRegions}
                    selectedNodeId={selectedNodeId}
                />
            ))}
            {(graph?.nodes || []).map((node: any) => (
                <NodeMesh
                    key={node.id}
                    node={node}
                    isSelected={plexus.selectedNode?.id === node.id}
                    isSimulated={simLookup[node.id]}
                    simStartTime={plexus.simulationTimestamp}
                    onClick={(n: any) => plexus.setSelectedNode(n)}
                    connectionCount={connectionCounts[node.id] || 0}
                    maxDegree={maxDegree}
                    hidden={hiddenRegions.has(node.region)}
                    quality={quality}
                    _tick={ticks}
                />
            ))}
        </group>
    );
}

// ─── Camera Controller ───────────────────────────────────────────────────────
function CameraController({ plexus, recenterRef }: any) {
    const { controls } = useThree();

    useFrame(() => {
        if (!controls) return;
        // @ts-ignore
        if (!controls.target) return;

        let targetX, targetY, targetZ;
        let hasTarget = false;

        if (plexus.selectedNode && plexus.selectedNode.x !== undefined) {
            targetX = plexus.selectedNode.x;
            targetY = plexus.selectedNode.y;
            targetZ = plexus.selectedNode.z;
            hasTarget = true;
        } else if (plexus.selectedSynapse) {
            const srcNode = plexus.data.nodes.find((n: any) => n.id === plexus.selectedSynapse.source_node_id);
            const tgtNode = plexus.data.nodes.find((n: any) => n.id === plexus.selectedSynapse.target_node_id);
            if (srcNode && tgtNode && srcNode.x !== undefined && tgtNode.x !== undefined) {
                targetX = (srcNode.x + tgtNode.x) / 2;
                targetY = (srcNode.y + tgtNode.y) / 2;
                targetZ = (srcNode.z + tgtNode.z) / 2;
                hasTarget = true;
            } else if (srcNode && srcNode.x !== undefined) {
                targetX = srcNode.x;
                targetY = srcNode.y;
                targetZ = srcNode.z;
                hasTarget = true;
            }
        }

        if (hasTarget) {
            const vTarget = new THREE.Vector3(targetX, targetY, targetZ);
            // @ts-ignore — keep the 0.05 target lerp (§6.9)
            controls.target.lerp(vTarget, 0.05);
            if (recenterRef?.current) recenterRef.current.active = false;
        } else if (recenterRef?.current?.active) {
            // §6.9: double-click empty space → ease target back to origin (~600ms)
            const rc = recenterRef.current;
            // @ts-ignore
            if (!rc.from) rc.from = controls.target.clone();
            if (REDUCED_MOTION) {
                // @ts-ignore
                controls.target.copy(ORIGIN);
                rc.active = false;
                return;
            }
            const t = Math.min(1, (performance.now() - rc.start) / 600);
            const eased = 1 - Math.pow(1 - t, 3); // ease-out
            // @ts-ignore
            controls.target.lerpVectors(rc.from, ORIGIN, eased);
            if (t >= 1) rc.active = false;
        }
    });
    return null;
}

// ─── One-time arrival shot (§6.9) ────────────────────────────────────────────
// Settles on the LATERAL view so the brain silhouette (anterior pointing
// right) is the first thing the user reads, like the reference plate.
// Skipped under prefers-reduced-motion; never replays on Canvas remounts.
let arrivalPlayed = false;
const ARRIVAL_FROM = new THREE.Vector3(-222, 52, 44);
const ARRIVAL_TO = new THREE.Vector3(-160, 12, 6);

function ArrivalShot() {
    const { camera } = useThree();
    const stateRef = useRef<{ start: number; done: boolean } | null>(null);

    useLayoutEffect(() => {
        if (arrivalPlayed || REDUCED_MOTION) {
            arrivalPlayed = true;
            return;
        }
        arrivalPlayed = true;
        camera.position.copy(ARRIVAL_FROM);
        stateRef.current = { start: performance.now(), done: false };
    }, [camera]);

    useFrame(() => {
        const s = stateRef.current;
        if (!s || s.done) return;
        const t = Math.min(1, (performance.now() - s.start) / 1200);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out
        camera.position.lerpVectors(ARRIVAL_FROM, ARRIVAL_TO, eased);
        if (t >= 1) s.done = true;
    });

    return null;
}

// ─── Deferred bloom (§6.7) ───────────────────────────────────────────────────
// Threshold-gated: with toneMapped:false emissives, only emissiveIntensity
// > 1.0 crosses — the selected node (1.3) and the simulation wave (1.4–2.2).
// Mounted only after ~60 rendered frames AND when node count < 800, so bloom
// framebuffer allocation never stacks on top of d3-force settling.
function DeferredBloom({ nodeCount }: any) {
    const [armed, setArmed] = useState(false);
    const frames = useRef(0);

    useFrame(() => {
        if (!armed) {
            frames.current += 1;
            if (frames.current >= 60) setArmed(true);
        }
    });

    if (!armed || nodeCount >= 800) return null;

    return (
        <EffectComposer multisampling={0} disableNormalPass>
            <Bloom mipmapBlur intensity={1.05} luminanceThreshold={0.85} luminanceSmoothing={0.3} />
        </EffectComposer>
    );
}

// ─── Main Export (§6) ────────────────────────────────────────────────────────
export default function NetworkGraph({ plexus }: any) {
    const nodeCount = plexus?.data?.nodes?.length || 0;
    const { quality, setQuality, demoteForStability, canvasKey, bumpCanvasKey, toast } = useQuality(nodeCount);

    // Double-click-empty-space recenter request, consumed by CameraController
    const recenterRef = useRef<{ active: boolean; start: number; from: THREE.Vector3 | null }>({
        active: false,
        start: 0,
        from: null,
    });

    return (
        <div className="relative h-full w-full">
            <Suspense
                fallback={
                    <div className="flex h-full w-full items-center justify-center bg-ink-0">
                        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-lo">
                            INITIALIZING RENDERER…
                        </span>
                    </div>
                }
            >
                <Canvas
                    key={canvasKey}
                    camera={{ position: [-160, 12, 6], fov: 50 }}
                    style={{ width: '100%', height: '100%' }}
                    dpr={quality === 'high' ? [1, 1.75] : [1, 1.5]}
                    gl={{
                        // §6.7: MSAA is wasted under a composer (high mode); low mode keeps it
                        antialias: quality === 'low',
                        toneMapping: THREE.ACESFilmicToneMapping,
                        toneMappingExposure: 1.1,
                    }}
                    onCreated={({ gl }: any) => {
                        // §6.8: context-loss latch — demote + persist + toast; remount on restore
                        gl.domElement.addEventListener('webglcontextlost', (e: Event) => {
                            e.preventDefault();
                            demoteForStability();
                        });
                        gl.domElement.addEventListener('webglcontextrestored', () => {
                            bumpCanvasKey();
                        });
                    }}
                    onPointerMissed={(e: any) => {
                        // §6.9: double-click empty space → recenter orbit target on origin
                        if (e.detail === 2) {
                            recenterRef.current = { active: true, start: performance.now(), from: null };
                        }
                    }}
                >
                    {/* §6.1: one step below UI ink-1 so panels float above the void */}
                    <color attach="background" args={['#08090B']} />
                    {/* §6.2: near plane past the specimen; far nodes recede into graphite */}
                    <fog attach="fog" args={['#08090B', 160, 420]} />

                    {/* §6.1: specimen stage — a faint polar bench the brain hovers over */}
                    <Grid
                        position={[0, -95, 0]}
                        args={[400, 400]}
                        cellSize={10}
                        cellColor="#101114"
                        sectionSize={50}
                        sectionColor="#16181C"
                        fadeDistance={320}
                        fadeStrength={2}
                        infiniteGrid
                    />

                    {/* §6.3: strictly monochrome rig — color comes ONLY from emissive region hexes */}
                    <ambientLight intensity={0.25} color="#FFFFFF" />
                    <directionalLight position={[80, 120, 80]} intensity={1.1} color="#F2F4F8" /> {/* key */}
                    <pointLight position={[-120, -40, -120]} intensity={0.5} color="#AEB6C2" /> {/* rim */}
                    <pointLight position={[0, -80, 40]} intensity={0.25} color="#FFFFFF" /> {/* low fill */}

                    {/* Graph */}
                    <GraphSimulation plexus={plexus} quality={quality} />

                    {/* §6.9: damped orbit clamped inside the fog envelope */}
                    <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={40} maxDistance={380} />
                    <CameraController plexus={plexus} recenterRef={recenterRef} />
                    <ArrivalShot />

                    {/* §6.7/§6.8: bloom only in high quality, deferred; demote on decline */}
                    <PerformanceMonitor onDecline={() => setQuality('low')}>
                        {quality === 'high' && <DeferredBloom nodeCount={nodeCount} />}
                    </PerformanceMonitor>
                </Canvas>
            </Suspense>

            {/* §6.8: stability toast — bottom-left, 4s */}
            {toast && (
                <div className="instrument-panel pointer-events-none absolute bottom-4 left-4 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-mid">
                    RENDER QUALITY REDUCED FOR STABILITY
                </div>
            )}
        </div>
    );
}
