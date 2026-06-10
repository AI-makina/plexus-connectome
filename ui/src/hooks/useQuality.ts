import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Render quality state machine (DESIGN_SPEC §6.8) ────────────────────────
// 'high' → bloom composer on, antialias false, dpr [1, 1.75]
// 'low'  → no composer, antialias true, dpr [1, 1.5], halo sprite on selection
//
// Latch: localStorage['plexus.quality'] — written ONLY by the context-loss
// path (demoteForStability), so a machine that ever lost its WebGL context
// stays in low quality permanently.
// Proactive demote (before/without any failure): node count > 800 or
// navigator.hardwareConcurrency <= 4.

export type Quality = 'high' | 'low';

const STORAGE_KEY = 'plexus.quality';
const TOAST_MS = 4000;

function readLatch(): Quality | null {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === 'low' || v === 'high' ? v : null;
    } catch {
        return null;
    }
}

export function useQuality(nodeCount: number) {
    const [quality, setQualityState] = useState<Quality>(() => {
        const latched = readLatch();
        if (latched) return latched;
        if (nodeCount > 800) return 'low';
        if ((navigator.hardwareConcurrency ?? 8) <= 4) return 'low';
        return 'high';
    });

    // Canvas remount key — bumped on webglcontextrestored so the renderer
    // comes back clean in (persisted) low quality.
    const [canvasKey, setCanvasKey] = useState(0);

    // 'RENDER QUALITY REDUCED FOR STABILITY' toast visibility (4s).
    const [toast, setToast] = useState(false);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Proactive demote if a later data load crosses the node budget.
    useEffect(() => {
        if (nodeCount > 800) setQualityState('low');
    }, [nodeCount]);

    const setQuality = useCallback((q: Quality) => {
        setQualityState(q);
    }, []);

    const showToast = useCallback(() => {
        setToast(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(false), TOAST_MS);
    }, []);

    // Context-loss path: demote, latch permanently for this machine, toast.
    const demoteForStability = useCallback(() => {
        setQualityState('low');
        try {
            localStorage.setItem(STORAGE_KEY, 'low');
        } catch {
            /* storage unavailable — stay demoted for this session only */
        }
        showToast();
    }, [showToast]);

    const bumpCanvasKey = useCallback(() => setCanvasKey(k => k + 1), []);

    useEffect(() => {
        return () => {
            if (toastTimer.current) clearTimeout(toastTimer.current);
        };
    }, []);

    return { quality, setQuality, demoteForStability, canvasKey, bumpCanvasKey, toast };
}
