import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REGIONS } from '../theme/regions';
import { buildRegionFiller } from '../theme/brainAnatomy';

// Decorative tissue: tiny additive particles + faint filaments that fill each
// region's invisible cavity so the brain silhouette reads from every angle,
// even when the real connectome is sparse. Pure background — never raycast,
// never interactive, dimmed while a circuit is being traced, hidden with its
// region filter.

const BASE_PARTICLE_OPACITY = 0.74;
const BASE_FILAMENT_OPACITY = 0.26;

// Same reduced-motion gate NetworkGraph uses — no tissue shimmer under it
const REDUCED_MOTION =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Deterministic per-region shimmer phase, spread over 0..2π
const hashPhase = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return ((hash >>> 0) % 6283) / 1000;
};

function RegionFiller({ regionKey, hex, hidden, dimmed }: any) {
    const data = useMemo(() => buildRegionFiller(regionKey), [regionKey]);
    const meshRef = useRef<any>(null);
    const particleMatRef = useRef<any>(null);
    const filamentMatRef = useRef<any>(null);
    const groupRef = useRef<any>(null);

    // Static instance transforms + per-particle color (region hex × variance)
    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        mesh.raycast = () => null;
        const m = new THREE.Matrix4();
        const color = new THREE.Color();
        const base = new THREE.Color(hex);
        for (let i = 0; i < data.count; i++) {
            const s = data.scales[i];
            m.makeScale(s, s, s);
            m.setPosition(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]);
            mesh.setMatrixAt(i, m);
            color.copy(base).multiplyScalar(data.brightness[i]);
            mesh.setColorAt(i, color);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }, [data, hex]);

    const filamentGeometry = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(data.segments, 3));
        return g;
    }, [data]);

    const regionPhase = useMemo(() => hashPhase(regionKey), [regionKey]);

    useFrame((state) => {
        let pTarget = hidden ? 0 : BASE_PARTICLE_OPACITY * (dimmed ? 0.3 : 1);
        let fTarget = hidden ? 0 : BASE_FILAMENT_OPACITY * (dimmed ? 0.3 : 1);

        // Living tissue: slow shimmer composed onto the target BEFORE the lerp
        // so hidden/dimmed transitions stay intact. Filaments run the same
        // rhythm slightly behind the particles.
        if (!REDUCED_MOTION && !hidden) {
            const e = state.clock.elapsedTime;
            pTarget *= 1 + 0.15 * Math.sin(e * 0.35 + regionPhase);
            fTarget *= 1 + 0.20 * Math.sin(e * 0.35 + regionPhase - 0.7);
        }

        if (particleMatRef.current) {
            particleMatRef.current.opacity = THREE.MathUtils.lerp(particleMatRef.current.opacity, pTarget, 0.1);
        }
        if (filamentMatRef.current) {
            filamentMatRef.current.opacity = THREE.MathUtils.lerp(filamentMatRef.current.opacity, fTarget, 0.1);
        }
        if (groupRef.current) {
            groupRef.current.visible = (particleMatRef.current?.opacity ?? 0) > 0.015;
        }
    });

    return (
        <group ref={groupRef}>
            <instancedMesh ref={meshRef} args={[undefined, undefined, data.count]}>
                <sphereGeometry args={[1, 6, 6]} />
                <meshBasicMaterial
                    ref={particleMatRef}
                    transparent
                    opacity={BASE_PARTICLE_OPACITY}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                />
            </instancedMesh>
            <lineSegments geometry={filamentGeometry} raycast={() => null}>
                <lineBasicMaterial
                    ref={filamentMatRef}
                    color={hex}
                    transparent
                    opacity={BASE_FILAMENT_OPACITY}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                />
            </lineSegments>
        </group>
    );
}

export default function Fillers({ hiddenRegions, dimmed }: any) {
    return (
        <group>
            {Object.entries(REGIONS).map(([key, def]: any) => (
                <RegionFiller
                    key={key}
                    regionKey={key}
                    hex={def.hex}
                    hidden={hiddenRegions?.has(key)}
                    dimmed={dimmed}
                />
            ))}
        </group>
    );
}
