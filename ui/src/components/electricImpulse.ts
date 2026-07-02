import * as THREE from 'three';

// ─── Electric impulses — GPU machinery ────────────────────────────────────────
// Two layers share one clock:
//   A. Discharge ribbon — one instanced strip (≤80) whose vertex shader rides
//      the exact synapse bezier over a trailing t-window; the fragment draws a
//      white-hot re-striking filament inside a region-colored corona.
//   B. Energized conductor — each synapse's LineMaterial is patched (anchor-
//      guarded onBeforeCompile, one shared program) with a traveling
//      energization window and a GPU transverse vibration wave, pinned at both
//      endpoints so the wire never detaches from its neurons.
// The Impulses hot loop writes plain floats; everything else is shader-side.

// One clock object shared BY REFERENCE across the ribbon material and every
// patched line material — Impulses writes it once per frame. Freeze for
// deterministic CI captures.
export const SHARED_TIME = { value: 0 };

// linkIndex → pulse-slot record for that synapse's material (two concurrent
// impulses per line; a third steals slot A). SynapseLine registers on mount;
// Impulses claims/writes/releases. owners are pool indices, -1 = free.
export type PulseRec = {
    a: THREE.Vector4; // (headT, amp = env*sMod, seed, -); amp 0 = inert
    b: THREE.Vector4;
    ownerA: number;
    ownerB: number;
};
export const PULSE_REG: (PulseRec | null)[] = [];

export const SEGMENTS = 20; // drei QuadraticBezierLine default — 21 samples

// ─── A. Discharge ribbon ─────────────────────────────────────────────────────

export const RIBBON_STRIDE = 18; // aP0(3) aP1(3) aP2(3) aHead(2) aColor(3) aMisc(4)

const RIBBON_VERT = /* glsl */ `
attribute vec3 aP0;      // bezier start (clampCoord'ed world)
attribute vec3 aP1;      // control point = midpoint + link.curveOffset (drei's mid)
attribute vec3 aP2;      // bezier end
attribute vec2 aHead;    // x = head t, y = trail length in t units
attribute vec3 aColor;   // raw region blend (NOT boosted — shaping is in-shader)
attribute vec4 aMisc;    // x = env*sMod, y = seed 0..1, z = halfWidth (wu), w = lenApprox

varying vec2  vUV;
varying vec3  vColor;
varying vec3  vMisc;     // amp, seed, trail world length
varying float vFog;

uniform float uFogNear;  // 160 — mirrors scene fog
uniform float uFogFar;   // 420

void main() {
    float u = position.x;                       // -1..1 across
    float v = position.y;                       //  0..1 tail -> head
    float tHead = aHead.x;
    float tTail = max(tHead - aHead.y, 0.0);
    float t = mix(tTail, tHead, v);
    float m = 1.0 - t;

    vec3 P = m*m*aP0 + 2.0*m*t*aP1 + t*t*aP2;   // EXACT curve the synapse draws
    vec3 T = normalize(2.0*(m*(aP1 - aP0) + t*(aP2 - aP1)) + vec3(1e-5));
    vec3 V = normalize(cameraPosition - P);
    vec3 side = cross(T, V);
    float sl = length(side);
    side = (sl > 1e-4) ? side / sl : normalize(cross(T, vec3(0.0, 1.0, 0.001)));

    float amp = aMisc.x;                        // env * sMod; 0 = hidden slot
    float w = aMisc.z * clamp(amp, 0.0, 1.4);   // envelope collapses width
    P += side * (u * w);

    vUV = vec2(u, v);
    vColor = aColor;
    vMisc = vec3(amp, aMisc.y, aMisc.w * aHead.y);

    vec4 mv = modelViewMatrix * vec4(P, 1.0);
    vFog = clamp((uFogFar + mv.z) / (uFogFar - uFogNear), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
}
`;

const RIBBON_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUV;
varying vec3 vColor;
varying vec3 vMisc;
varying float vFog;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; return fract(p * (p + p)); }
float vnoise(float x) {
    float i = floor(x), f = fract(x);
    float s = f * f * (3.0 - 2.0 * f);
    return mix(hash11(i), hash11(i + 1.0), s);
}

void main() {
    float amp = vMisc.x, seed = vMisc.y, trailLen = vMisc.z;
    float v = vUV.y;

    // 32 Hz re-strike clock, phase-offset per bolt — channels re-strike at
    // independent moments, never in lockstep across the pool
    float stepT = floor(uTime * 32.0 + seed * 61.0);
    float tq = stepT * 0.03125;
    float strike = hash11(stepT + seed * 57.0);

    // arc-length-ish coordinate: crackle density uniform in WORLD units
    float s = v * trailLen * 0.9 + seed * 91.7;

    // jagged filament: straight at the leader tip, chaotic behind
    float taper = (1.0 - 0.75 * smoothstep(0.7, 1.0, v)) * smoothstep(0.0, 0.12, v);
    float n = vnoise(s * 0.9 + tq * 53.0) * 0.65
            + vnoise(s * 2.3 - tq * 31.0) * 0.35;
    float c = (n * 2.0 - 1.0) * 0.42 * taper;

    float d = abs(vUV.x - c);
    float core   = exp(-d * d * 220.0);          // white-hot filament (~0.1 wu)
    float corona = exp(-d * 5.5);                // region-colored ion sheath

    float comet = pow(v, 1.6);                   // dim tail -> bright head
    float tip   = exp(-(1.0 - v) * 9.0) * 1.6;   // hot leader tip
    float flick = 0.72 + 0.28 * strike;          // per-strike brightness stutter

    // faint intermittent side tendril, seed-desynced gate (~38% duty)
    float b = (vnoise(s * 1.7 + tq * 71.0 + 40.0) * 2.0 - 1.0) * 0.8 * taper;
    float tendril = exp(-abs(vUV.x - b) * 14.0)
                  * step(0.62, hash11(floor(uTime * 16.0 + seed * 23.0) + seed * 13.0))
                  * 0.25 * comet;

    float I = amp * flick * (comet + tip);
    vec3 col = vColor * (corona * 0.85 + tendril) + vec3(1.0) * core * 1.35;
    col *= I * vFog;                             // additive: fade to BLACK with distance
    gl_FragColor = vec4(col, 1.0);               // alpha 1 under AdditiveBlending = pure add
}
`;

// Base strip: 17 rows × 2 cols, position = (u ∈ {-1,1}, v ∈ 0..1, 0). The
// jaggedness is per-pixel — vertices only follow the smooth bezier curvature.
export function createRibbonGeometry(poolSize: number) {
    const ROWS = 17;
    const pos = new Float32Array(ROWS * 2 * 3);
    for (let r = 0; r < ROWS; r++) {
        const v = r / (ROWS - 1);
        pos[r * 6 + 0] = -1; pos[r * 6 + 1] = v;
        pos[r * 6 + 3] = 1; pos[r * 6 + 4] = v;
    }
    const idx: number[] = [];
    for (let r = 0; r < ROWS - 1; r++) {
        const a = r * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);

    const data = new THREE.InstancedInterleavedBuffer(
        new Float32Array(poolSize * RIBBON_STRIDE), RIBBON_STRIDE, 1
    );
    data.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP0', new THREE.InterleavedBufferAttribute(data, 3, 0));
    g.setAttribute('aP1', new THREE.InterleavedBufferAttribute(data, 3, 3));
    g.setAttribute('aP2', new THREE.InterleavedBufferAttribute(data, 3, 6));
    g.setAttribute('aHead', new THREE.InterleavedBufferAttribute(data, 2, 9));
    g.setAttribute('aColor', new THREE.InterleavedBufferAttribute(data, 3, 11));
    g.setAttribute('aMisc', new THREE.InterleavedBufferAttribute(data, 4, 14));
    g.instanceCount = poolSize;
    // culling is disabled on the mesh; keep a generous static bound anyway
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
    return { geometry: g, data };
}

export function createRibbonMaterial() {
    return new THREE.ShaderMaterial({
        vertexShader: RIBBON_VERT,
        fragmentShader: RIBBON_FRAG,
        // ShaderMaterial skips the tonemapping chunk → untonemapped output, same
        // semantics as toneMapped:false. Core values >1 cross the 0.85 bloom
        // threshold in high quality; clamp to pure white in low.
        uniforms: {
            uTime: SHARED_TIME,
            uFogNear: { value: 160 },
            uFogFar: { value: 420 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
    });
}

// ─── B. Energized conductor — LineMaterial patch ─────────────────────────────
// All replacements are includes()-guarded against three-stdlib 2.36.1 anchors;
// on a future lib bump they no-op and lines render exactly as today.

const VERT_DECL_ANCHOR = 'attribute vec3 instanceEnd;';
const VERT_START_ANCHOR = 'vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );';
const VERT_END_ANCHOR = 'vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );';
const FRAG_DECL_ANCHOR = 'uniform float linewidth;';
const FRAG_OUT_ANCHOR = 'gl_FragColor = diffuseColor;';

const LINE_VERT_DECLS = /* glsl */ `
attribute vec2 instanceT;   // STATIC per-segment (i/20, (i+1)/20), added once
uniform vec4  uPulseA;      // (headT, amp = env*sMod, seed, -); (-1,0,0,0) = inert
uniform vec4  uPulseB;      // second concurrent impulse slot
uniform vec3  uVibA;        // orthonormal pair perpendicular to the chord
uniform vec3  uVibB;
uniform float uVibAmp;      // world units by tier: 0.12 / 0.18 / 0.26
uniform float uVibFreq;     // rad/s by tier: 30 / 24 / 18 — heavy cables sway slower
uniform float uTimeE;
varying float vT;

// traveling transverse wave: sharp attack at the head, exponential ringing
// wake behind, pinned to zero at both endpoints (never detaches from nodes)
vec3 plexusVib( float t, vec4 p ) {
    float d    = t - p.x;
    float wake = ( d > 0.0 ) ? exp( - d * 40.0 ) : exp( d * 7.0 );
    float pin  = smoothstep( 0.0, 0.07, t ) * ( 1.0 - smoothstep( 0.93, 1.0, t ) );
    float ph   = t * 42.0 - uTimeE * uVibFreq + p.z * 6.2831853;
    float wa   = sin( ph ) + 0.45 * sin( ph * 2.17 + 1.3 );
    float wb   = cos( ph * 0.83 + p.z * 9.0 );
    return ( uVibA * wa + uVibB * ( 0.6 * wb ) ) * ( p.y * wake * pin * uVibAmp );
}
`;

// Displacement precedes the NDC direction + screen-space width extrusion, so
// the extruded ribbon and its caps follow the shaken axis with no seams.
// Shared endpoints + shared instanceT values guarantee C0 continuity.
const LINE_VERT_START = /* glsl */ `
vT = ( position.y < 0.5 ) ? instanceT.x : instanceT.y;
vec3 dStart = instanceStart + plexusVib( instanceT.x, uPulseA ) + plexusVib( instanceT.x, uPulseB );
vec3 dEnd   = instanceEnd   + plexusVib( instanceT.y, uPulseA ) + plexusVib( instanceT.y, uPulseB );
vec4 start = modelViewMatrix * vec4( dStart, 1.0 );
`;
const LINE_VERT_END = /* glsl */ `vec4 end = modelViewMatrix * vec4( dEnd, 1.0 );`;

const LINE_FRAG_DECLS = /* glsl */ `
uniform vec4  uPulseA;
uniform vec4  uPulseB;
uniform vec3  uPulseColor;  // the line's exact source/target region blend, unscaled
uniform float uTimeE;
varying float vT;
float pxh11( float p ) { p = fract( p * 0.1031 ); p *= p + 33.33; return fract( p * ( p + p ) ); }
float pxvn( float x ) { float i = floor( x ); float f = fract( x ); f = f * f * ( 3.0 - 2.0 * f ); return mix( pxh11( i ), pxh11( i + 1.0 ), f ); }
float plexusWin( float d ) { return ( d > 0.0 ) ? exp( - d * 90.0 ) : exp( d * 9.0 ); }  // razor front, ion tail
`;

// Injected BEFORE the stock tonemapping/colorspace/fog includes: the window is
// ACES-mapped and fogged inside the instrument's own pipeline. At amp = 0 the
// resting web is pixel-identical to today.
const LINE_FRAG_WINDOW = /* glsl */ `
float eA = plexusWin( vT - uPulseA.x ) * uPulseA.y;
float eB = plexusWin( vT - uPulseB.x ) * uPulseB.y;
float energy = eA + eB;
if ( energy > 0.003 ) {
    // inactive slot pushed far away so it never whitens the head region
    float dNear = min( abs( vT - uPulseA.x ) + step( uPulseA.y, 0.001 ) * 10.0,
                       abs( vT - uPulseB.x ) + step( uPulseB.y, 0.001 ) * 10.0 );
    // conductor sputter: one cheap scrolling noise term (the ribbon carries
    // the heavy crackle; keep the line patch minimal)
    float crackle = 0.7 + 0.6 * pxvn( vT * 70.0 - uTimeE * 40.0 + ( uPulseA.z + uPulseB.z ) * 17.0 );
    float wWin    = clamp( energy * crackle, 0.0, 1.0 );
    float coreX   = 1.0 - smoothstep( 0.0, 0.55, abs( vUv.x ) );  // vUv.x = ±1 across width
    float headHot = exp( - dNear * 28.0 );
    // 5.0 pre-ACES ≈ 0.93 post-map → crosses the 0.85 bloom threshold in high
    // quality; clamps to pure white over the region corona in low
    diffuseColor.rgb += ( uPulseColor * 2.2 + vec3( 5.0 ) * coreX * ( 0.3 + 0.7 * headHot ) ) * wWin;
    diffuseColor.a    = max( diffuseColor.a, min( 0.95, wWin ) );
}
gl_FragColor = diffuseColor;
`;

function patchLineShader(this: any, shader: any) {
    // Replicate the stock three-stdlib constructor onBeforeCompile we overwrite
    if (this.transparent) {
        this.defines.USE_LINE_COLOR_ALPHA = '1';
    } else {
        delete this.defines.USE_LINE_COLOR_ALPHA;
    }
    const v = shader.vertexShader;
    const f = shader.fragmentShader;
    if (
        v.includes(VERT_DECL_ANCHOR) && v.includes(VERT_START_ANCHOR) && v.includes(VERT_END_ANCHOR) &&
        f.includes(FRAG_DECL_ANCHOR) && f.includes(FRAG_OUT_ANCHOR)
    ) {
        shader.vertexShader = v
            .replace(VERT_DECL_ANCHOR, VERT_DECL_ANCHOR + LINE_VERT_DECLS)
            .replace(VERT_START_ANCHOR, LINE_VERT_START)
            .replace(VERT_END_ANCHOR, LINE_VERT_END);
        shader.fragmentShader = f
            .replace(FRAG_DECL_ANCHOR, FRAG_DECL_ANCHOR + LINE_FRAG_DECLS)
            .replace(FRAG_OUT_ANCHOR, LINE_FRAG_WINDOW);
    } else if ((import.meta as any).env?.DEV) {
        console.warn('[plexus] LineMaterial anchors missing — electric layer inert on lines');
    }
}

// Static per-segment parametrization: segment i spans t = [i/20, (i+1)/20].
// Valid forever because the line geometry is frozen at 20 segments.
export function ensureInstanceT(geom: any) {
    if (!geom || geom.attributes.instanceT) return;
    const arr = new Float32Array(SEGMENTS * 2);
    for (let i = 0; i < SEGMENTS; i++) {
        arr[i * 2] = i / SEGMENTS;
        arr[i * 2 + 1] = (i + 1) / SEGMENTS;
    }
    geom.setAttribute('instanceT', new THREE.InstancedBufferAttribute(arr, 2));
}

// Module scratch for the vibration frame — mount-time only, never per frame
const _chord = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _vibA = new THREE.Vector3();
const _vibB = new THREE.Vector3();

// Patch a line's material (idempotent) and (re)write its per-line uniform
// values. Returns the pulse record the Impulses pool claims slots on.
export function electrifyLine(
    mat: any,
    tierWidth: number,
    blendColor: THREE.Color,
    sx: number, sy: number, sz: number,
    ex: number, ey: number, ez: number,
    co: number[],
): PulseRec {
    let rec: PulseRec = mat.userData.plexusPulse;
    if (!rec) {
        rec = {
            a: new THREE.Vector4(-1, 0, 0, 0),
            b: new THREE.Vector4(-1, 0, 0, 0),
            ownerA: -1,
            ownerB: -1,
        };
        mat.uniforms.uPulseA = { value: rec.a };
        mat.uniforms.uPulseB = { value: rec.b };
        mat.uniforms.uPulseColor = { value: new THREE.Color() };
        mat.uniforms.uVibA = { value: new THREE.Vector3(0, 1, 0) };
        mat.uniforms.uVibB = { value: new THREE.Vector3(1, 0, 0) };
        mat.uniforms.uVibAmp = { value: 0.12 };
        mat.uniforms.uVibFreq = { value: 30 };
        mat.uniforms.uTimeE = SHARED_TIME; // shared object — one write per frame
        mat.onBeforeCompile = patchLineShader;
        mat.customProgramCacheKey = () => 'plexus-electric-line-v1';
        mat.needsUpdate = true;
        mat.userData.plexusPulse = rec;
    }

    // (Re)write values — safe on graph rebuilds that reuse the material
    mat.uniforms.uPulseColor.value.copy(blendColor);
    const tier = tierWidth >= 0.6 ? 2 : tierWidth >= 0.3 ? 1 : 0;
    mat.uniforms.uVibAmp.value = [0.12, 0.18, 0.26][tier];
    mat.uniforms.uVibFreq.value = [30, 24, 18][tier];

    updateVibFrame(mat, sx, sy, sz, ex, ey, ez, co);

    return rec;
}

// Elliptical 3D vibration frame: orthonormal pair ⊥ chord, seeded by the
// curve offset so the shake plane differs per line; degeneracy fallbacks.
// Allocation-free (module scratch) — also called from SynapseLine's useFrame
// whenever endpoints actually move (settle, graph rebuilds), so the frame
// stays perpendicular to the LIVE chord, never a frozen one.
export function updateVibFrame(
    mat: any,
    sx: number, sy: number, sz: number,
    ex: number, ey: number, ez: number,
    co: number[],
) {
    if (!mat || !mat.userData.plexusPulse) return;
    _chord.set(ex - sx, ey - sy, ez - sz);
    _axis.set(co[0], co[1], co[2]);
    if (_axis.lengthSq() < 1e-6) _axis.set(0, 1, 0);
    _vibA.crossVectors(_chord, _axis);
    if (_vibA.lengthSq() < 1e-6) {
        _axis.set(1, 0, 0);
        _vibA.crossVectors(_chord, _axis);
    }
    if (_vibA.lengthSq() < 1e-6) _vibA.set(0, 1, 0);
    _vibA.normalize();
    _vibB.crossVectors(_chord, _vibA);
    if (_vibB.lengthSq() < 1e-6) _vibB.set(1, 0, 0);
    _vibB.normalize();
    mat.uniforms.uVibA.value.copy(_vibA);
    mat.uniforms.uVibB.value.copy(_vibB);
}

// Allocation-free 21-sample bezier writer straight into the Line2 geometry's
// interleaved buffer (segment k: floats [k*6..k*6+2] = P(k), [k*6+3..k*6+5] =
// P(k+1); interior points written into both slots → C0-continuous polyline).
export function writeBezierIntoLine(
    geom: any,
    sx: number, sy: number, sz: number,
    mx: number, my: number, mz: number,
    ex: number, ey: number, ez: number,
) {
    const attr = geom?.attributes?.instanceStart;
    if (!attr) return;
    const arr = attr.data.array;
    for (let k = 0; k <= SEGMENTS; k++) {
        const t = k / SEGMENTS;
        const u = 1 - t;
        const a = u * u, b = 2 * u * t, c = t * t;
        const px = a * sx + b * mx + c * ex;
        const py = a * sy + b * my + c * ey;
        const pz = a * sz + b * mz + c * ez;
        if (k < SEGMENTS) {
            const o = k * 6;
            arr[o] = px; arr[o + 1] = py; arr[o + 2] = pz;
        }
        if (k > 0) {
            const o = (k - 1) * 6 + 3;
            arr[o] = px; arr[o + 1] = py; arr[o + 2] = pz;
        }
    }
    attr.data.needsUpdate = true;
}
