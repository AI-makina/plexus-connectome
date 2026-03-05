import React, { useMemo, useState, useRef, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, QuadraticBezierLine, Html, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';
import * as THREE from 'three';

// ─── Region Colors (§3) ─────────────────────────────────────────────────────
const REGION_COLORS: Record<string, string> = {
    frontal_lobe: '#0066FF',
    temporal_lobe: '#FFB800',
    occipital_lobe: '#FF00AA',
    parietal_lobe: '#00CC66',
    cerebellum: '#8800FF',
    brain_stem: '#8899AA',
    limbic_system: '#FF6B4A',
    amygdala: '#FF0033',
    corpus_callosum: '#FFFFFF'
};

// ─── Region Spatial Positions & Radii (§3.10) ────────────────────────────────
// Real anatomical coordinates forming a lateral-view human brain shape
// Coordinate system: X=left/right, Y=up/down, Z=front/back
const REGION_BOUNDS: Record<string, { x: number; y: number; z: number; rx: number; ry: number; rz: number }> = {
    frontal_lobe: { x: 0, y: 30, z: 50, rx: 35, ry: 40, rz: 40 }, // Front-top
    parietal_lobe: { x: 0, y: 50, z: 0, rx: 35, ry: 30, rz: 35 }, // Top-center/back
    occipital_lobe: { x: 0, y: 10, z: -50, rx: 30, ry: 35, rz: 30 }, // Back
    temporal_lobe: { x: 0, y: -10, z: 0, rx: 45, ry: 25, rz: 35 }, // Sides
    cerebellum: { x: 0, y: -40, z: -40, rx: 25, ry: 20, rz: 20 }, // Bottom-back
    brain_stem: { x: 0, y: -60, z: -10, rx: 10, ry: 20, rz: 10 }, // Bottom-center
    limbic_system: { x: 0, y: 0, z: 0, rx: 20, ry: 15, rz: 20 }, // Center
    amygdala: { x: 0, y: -15, z: 10, rx: 10, ry: 10, rz: 10 }, // Center-forward
    corpus_callosum: { x: 0, y: 20, z: 10, rx: 15, ry: 10, rz: 25 }  // Center-top
};

// ─── Node Mesh (§10.2) ──────────────────────────────────────────────────────
// Glowing sphere. Size scales with connection count. Color = region color.
function NodeMesh({ node, isSelected, isSimulated, onClick, connectionCount, _tick, simStartTime }: any) {
    const color = REGION_COLORS[node.region] || '#FFFFFF';
    const materialRef = useRef<any>(null);

    // §10.2: size = baseSize + (connectionCount * 0.3) + (stabilityScore * 0.5)
    const stability = node.health?.stability_score ?? 0.8;
    const baseSize = 0.6;
    const size = Math.min(3.5, Math.max(0.4, baseSize + (connectionCount * 0.15) + (stability * 0.3)));

    const clamp = (val: number) => Math.max(-200, Math.min(200, val || 0));

    useFrame(() => {
        if (!materialRef.current) return;

        let targetEmissive = isSimulated ? 0.8 : 0.8;
        let currentEmissiveColor = new THREE.Color(color);

        if (isSimulated) {
            if (isSimulated.impact_level === 'critical') currentEmissiveColor.set('#ff0000');
            else if (isSimulated.impact_level === 'high') currentEmissiveColor.set('#ff8800');
            else if (isSimulated.impact_level === 'moderate') currentEmissiveColor.set('#ffff00');
            else if (isSimulated.impact_level === 'low') currentEmissiveColor.set('#ffffff');

            targetEmissive = isSimulated.impact_level === 'critical' ? 2.5 :
                isSimulated.impact_level === 'high' ? 2.0 :
                    isSimulated.impact_level === 'moderate' ? 1.5 : 1.0;

            if (simStartTime) {
                const delayMs = isSimulated.distance_from_source * 150;
                if (Date.now() - simStartTime < delayMs) {
                    targetEmissive = 0.8; // Wait for the wave
                    currentEmissiveColor.set(color);
                }
            }
        }

        if (node.status === 'dormant') {
            targetEmissive = 0.4;
            currentEmissiveColor.set(color);
        }

        materialRef.current.emissive.lerp(currentEmissiveColor, 0.1);
        materialRef.current.emissiveIntensity = THREE.MathUtils.lerp(materialRef.current.emissiveIntensity, targetEmissive, 0.1);
    });

    return (
        <group position={[clamp(node.x), clamp(node.y), clamp(node.z)]}>
            <Sphere args={[isSelected ? size * 1.5 : size, 16, 16]} onClick={() => onClick(node)}>
                <meshStandardMaterial
                    ref={materialRef}
                    color={color}
                    emissive={color}
                    emissiveIntensity={0}
                    roughness={0.2}
                    metalness={0.6}
                    toneMapped={false}
                    transparent={true}
                    opacity={node.status === 'dormant' ? 0.3 : 1.0}
                />
            </Sphere>
            {isSelected && (
                <Html distanceFactor={15}>
                    <div className="bg-black/80 text-white text-xs px-2 py-1 rounded border border-white/20 whitespace-nowrap pointer-events-none">
                        {node.name}
                    </div>
                </Html>
            )}
        </group>
    );
}

// ─── Synapse Line (§10.3) ────────────────────────────────────────────────────
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [255, 255, 255];
};

const blendColors = (c1: string, c2: string) => {
    const [r1, g1, b1] = hexToRgb(c1);
    const [r2, g2, b2] = hexToRgb(c2);
    return `#${Math.round((r1 + r2) / 2).toString(16).padStart(2, '0')}${Math.round((g1 + g2) / 2).toString(16).padStart(2, '0')}${Math.round((b1 + b2) / 2).toString(16).padStart(2, '0')}`;
};

// Curved bezier line. Color = blended region colors. Thickness = strength.
function SynapseLine({ source, target, strength, status, classification }: any) {
    const [sourcePos, setSourcePos] = useState<[number, number, number]>([-50, -50, -50]);
    const [targetPos, setTargetPos] = useState<[number, number, number]>([50, 50, 50]);
    const [ready, setReady] = useState(false);

    // Color: Blend source and target region colors for cross-region synapses
    const sourceColor = (typeof source === 'object' && source.region) ? (REGION_COLORS[source.region] || '#FFFFFF') : '#0066FF';
    const targetColor = (typeof target === 'object' && target.region) ? (REGION_COLORS[target.region] || '#FFFFFF') : sourceColor;
    const color = sourceColor === targetColor ? sourceColor : blendColors(sourceColor, targetColor);

    // Static random offset for the bezier curve midpoint to prevent vibration
    const curveOffset = useMemo(() => [
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
    ], []);

    // 3 Discrete Tiers for Synapse Strength: thin, medium, thick
    let tierWidth = 0.15; // thin
    if (classification === 'critical' || strength > 2.0) tierWidth = 0.6; // thick
    else if (classification === 'high' || classification === 'moderate' || strength > 1.2) tierWidth = 0.3; // medium
    const lineWidth = tierWidth;

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
    });

    if (!ready) return null;

    // §10.3: Bezier midpoint — use the static curve offset
    const mid: [number, number, number] = [
        (sourcePos[0] + targetPos[0]) / 2 + curveOffset[0],
        (sourcePos[1] + targetPos[1]) / 2 + curveOffset[1],
        (sourcePos[2] + targetPos[2]) / 2 + curveOffset[2],
    ];

    const isDormant = status === 'dormant' ||
        (typeof source === 'object' && source.status === 'dormant') ||
        (typeof target === 'object' && target.status === 'dormant');

    return (
        <QuadraticBezierLine
            start={sourcePos}
            end={targetPos}
            mid={mid}
            color={color}
            lineWidth={lineWidth}
            transparent
            dashed={isDormant}
            dashScale={isDormant ? 20 : 0}
            dashSize={isDormant ? 2 : 0}
            gapSize={isDormant ? 1 : 0}
            opacity={isDormant ? 0.4 : Math.max(0.15, Math.min(0.8, strength || 0.4))}
        />
    );
}

// ─── Graph Simulation (§9) ───────────────────────────────────────────────────
function GraphSimulation({ plexus }: any) {
    const [ticks, setTicks] = useState(0);

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
            // Seed initial positions inside their designated anatomical ellipsoid volume
            const bounds = REGION_BOUNDS[n.region] || { x: 0, y: 0, z: 0, rx: 20, ry: 20, rz: 20 };

            // Deterministic random using node ID, preventing nodes diving to new random anchors on every React state switch
            const seed = getHash(n.id);
            const r1 = getSeededRandom(seed);
            const r2 = getSeededRandom(seed + 1);
            const r3 = getSeededRandom(seed + 2);

            // Uniform point-in-ellipsoid distribution math
            const theta = r1 * Math.PI * 2;
            const phi = Math.acos(2 * r2 - 1);
            const r = Math.cbrt(r3);

            // Lock the node to an unbreakable personal 3D anchor so the gravity doesn't collapse the X/Y/Z width
            const targetX = bounds.x + bounds.rx * r * Math.sin(phi) * Math.cos(theta);
            const targetY = bounds.y + bounds.ry * r * Math.sin(phi) * Math.sin(theta);
            const targetZ = bounds.z + bounds.rz * r * Math.cos(phi);

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

        // §9.2: Force-directed layout tuned for strict boundary preservation
        const simulation = forceSimulation(nodes || [], 3)
            .velocityDecay(0.65) // Higher friction (0.65) to lock nodes quickly
            .force("link", forceLink(links || []).id((d: any) => d.id).distance(15).strength((link: any) => {
                // Prevent cross-region links from dragging nodes into other lobes
                return link.source.region === link.target.region ? 0.3 : 0.005;
            }))
            .force("charge", forceManyBody().strength(-15)) // Reduced repulsion

        // §9.1: Personal anchor gravity — pull nodes toward their assigned boundaries
        simulation.force("regionGravity", () => {
            const alpha = simulation.alpha();
            nodes.forEach((d: any) => {
                if (d.targetX !== undefined) {
                    // Stronger pull to anchor coordinates to prevent boundary invasion
                    const pullStrength = d.region === 'amygdala' ? 0.8 : 0.4;
                    d.vx += (d.targetX - d.x) * alpha * pullStrength;
                    d.vy += (d.targetY - d.y) * alpha * pullStrength;
                    d.vz += (d.targetZ - d.z) * alpha * pullStrength;
                }
            });
        });

        return { nodes, links, simulation };
    }, [plexus.data, plexus.searchQuery, plexus.showDormant]);

    // Force React to re-render as D3 calculates physics
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
            {(graph?.links || []).map((link: any, i: number) => (
                <SynapseLine key={i} source={link.source} target={link.target} strength={link.strength} status={link.status} classification={link.classification} />
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
                    _tick={ticks}
                />
            ))}
        </group>
    );
}

// ─── Camera Controller ───────────────────────────────────────────────────────
function CameraController({ plexus }: any) {
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
            // @ts-ignore
            controls.target.lerp(vTarget, 0.05);
        }
    });
    return null;
}

// ─── Main Export (§10.1) ─────────────────────────────────────────────────────
export default function NetworkGraph({ plexus }: any) {
    return (
        <Suspense fallback={<div className="text-white w-full h-full flex items-center justify-center">Loading Engine...</div>}>
            <Canvas
                camera={{ position: [80, 40, 120], fov: 55 }}
                style={{ width: '100%', height: '100%' }}
                gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
            >
                <color attach="background" args={['#0A0A0F']} />

                {/* §10.1: Star-field background (TEMPORARILY DISABLED due to WebGL Context Loss check) */}
                {/* <Stars radius={300} depth={80} count={3000} factor={4} saturation={0} fade speed={1} /> */}

                {/* Lighting */}
                <ambientLight intensity={0.3} />
                <pointLight position={[100, 100, 100]} intensity={1.5} color="#ffffff" />
                <pointLight position={[-100, -50, -100]} intensity={0.8} color="#4444ff" />

                {/* Graph */}
                <GraphSimulation plexus={plexus} />

                {/* Camera controls for manual 3D depth showcase */}
                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
                <CameraController plexus={plexus} />

                {/* §10.1: Bloom post-processing for glow effects (TEMPORARILY DISABLED due to WebGL Context Loss) */}
                {/* 
                <EffectComposer>
                    <Bloom
                        luminanceThreshold={0.2}
                        luminanceSmoothing={0.9}
                        intensity={1.5}
                        mipmapBlur
                    />
                </EffectComposer> 
                */}
            </Canvas>
        </Suspense>
    );
}
