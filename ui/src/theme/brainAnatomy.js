// ui/src/theme/brainAnatomy.js — the invisible brain.
//
// Each region is a union of ellipsoid primitives ({ c: center, r: radii })
// assembled so the WHOLE union reads as a lateral-view human brain from any
// angle: +Z = anterior (front), +Y = up, X = left/right width. Nodes and
// filler particles are sampled uniformly inside these volumes; the force
// layout's per-node anchor gravity keeps real nodes inside their cavity.
//
// Overall envelope: Z −68…+68, Y −58…+50, X ±39. If this scale changes,
// retune fog [160, 420], the grid y, and the camera distances with it.

export const REGION_VOLUMES = {
    frontal_lobe: [
        { c: [0, 22, 36], r: [32, 27, 29] },   // superior frontal
        { c: [0, 8, 50], r: [25, 21, 18] },    // anterior pole — rounded forehead bulge
    ],
    parietal_lobe: [
        { c: [0, 34, -10], r: [31, 23, 29] },  // crown — overlaps frontal & occipital
    ],
    occipital_lobe: [
        { c: [0, 5, -48], r: [27, 23, 21] },   // posterior pole, curves down over cerebellum
    ],
    temporal_lobe: [
        { c: [26, -15, 11], r: [15, 13, 30] },  // right lobe — pole points anterior
        { c: [-26, -15, 11], r: [15, 13, 30] }, // left lobe
    ],
    cerebellum: [
        { c: [0, -27, -39], r: [25, 16, 20] }, // tucked UNDER the occipital, meets temporal back
    ],
    brain_stem: [
        { c: [0, -39, -20], r: [8, 18, 9] },   // descends from limbic core to cerebellum
    ],
    limbic_system: [
        { c: [0, 3, 0], r: [17, 11, 17] },
    ],
    amygdala: [
        { c: [14, -10, 16], r: [5, 4, 5] },    // right
        { c: [-14, -10, 16], r: [5, 4, 5] },   // left
    ],
    corpus_callosum: [
        { c: [0, 17, -3], r: [6, 8, 21] },     // medial arc
    ],
};

const FALLBACK_VOLUME = [{ c: [0, 4, 0], r: [15, 9, 15] }];

// Filler particle budget per region — proportional to cavity volume so the
// silhouette reads even when the real connectome is sparse.
export const FILLER_COUNTS = {
    frontal_lobe: 700,
    parietal_lobe: 540,
    occipital_lobe: 420,
    temporal_lobe: 600,
    cerebellum: 330,
    brain_stem: 125,
    limbic_system: 180,
    amygdala: 60,
    corpus_callosum: 140,
};

function volumeOf(p) {
    return p.r[0] * p.r[1] * p.r[2];
}

// Uniform point inside one ellipsoid from three uniform randoms.
function pointInEllipsoid(p, r1, r2, r3) {
    const theta = r1 * Math.PI * 2;
    const phi = Math.acos(2 * r2 - 1);
    const rad = Math.cbrt(r3);
    return [
        p.c[0] + p.r[0] * rad * Math.sin(phi) * Math.cos(theta),
        p.c[1] + p.r[1] * rad * Math.sin(phi) * Math.sin(theta),
        p.c[2] + p.r[2] * rad * Math.cos(phi),
    ];
}

// Uniform point inside a region's union: pick a primitive weighted by its
// volume (r4), then sample inside it. (Overlap double-density is negligible
// at these tolerances and keeps sampling rejection-free/deterministic.)
export function samplePointInRegion(regionKey, r1, r2, r3, r4) {
    const prims = REGION_VOLUMES[regionKey] || FALLBACK_VOLUME;
    if (prims.length === 1) return pointInEllipsoid(prims[0], r1, r2, r3);
    const total = prims.reduce((s, p) => s + volumeOf(p), 0);
    let pick = r4 * total;
    for (const p of prims) {
        pick -= volumeOf(p);
        if (pick <= 0) return pointInEllipsoid(p, r1, r2, r3);
    }
    return pointInEllipsoid(prims[prims.length - 1], r1, r2, r3);
}

// Deterministic RNG (mulberry32) seeded from the region key — filler layouts
// are stable across reloads and never consume Math.random.
function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return h >>> 0;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Build one region's filler layer: particle positions (+ per-particle scale
// and brightness) and short filaments connecting near neighbors — the faint
// web that makes the cavity read as tissue.
export function buildRegionFiller(regionKey, count = FILLER_COUNTS[regionKey] || 60) {
    const rng = mulberry32(hashString('filler:' + regionKey));
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const brightness = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const [x, y, z] = samplePointInRegion(regionKey, rng(), rng(), rng(), rng());
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        scales[i] = 0.10 + rng() * 0.16;          // tiny: clearly background tissue
        brightness[i] = 0.50 + rng() * 0.50;      // per-particle luminance variance
    }

    // Filaments: each particle connects to up to 3 nearest neighbors within
    // reach. O(n²) once per region at ≤700 particles — negligible, memoized.
    const REACH = 15;
    const segments = [];
    for (let i = 0; i < count; i++) {
        const candidates = [];
        const ix = positions[i * 3], iy = positions[i * 3 + 1], iz = positions[i * 3 + 2];
        for (let j = i + 1; j < count; j++) {
            const dx = positions[j * 3] - ix;
            const dy = positions[j * 3 + 1] - iy;
            const dz = positions[j * 3 + 2] - iz;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < REACH * REACH) candidates.push([d2, j]);
        }
        candidates.sort((a, b) => a[0] - b[0]);
        for (let k = 0; k < Math.min(3, candidates.length); k++) {
            const j = candidates[k][1];
            segments.push(ix, iy, iz, positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
        }
    }

    return { positions, scales, brightness, segments: new Float32Array(segments), count };
}
