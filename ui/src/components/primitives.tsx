import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

// Risk scale (DESIGN_SPEC §2) — low is achromatic slate by design.
export const RISK_HEX: Record<string, string> = {
    critical: '#E5484D',
    high: '#E08A39',
    moderate: '#D9B13D',
    low: '#8B98A9',
};

export function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

// ── Button (DESIGN_SPEC §5.15) ────────────────────────────────────────────────
// Three buttons only. `light` is THE one light button per viewport — encoding
// it as a variant makes the rule lint-able, not a convention.
export function Button({ variant = 'ghost', compact = false, className = '', children, ...rest }: any) {
    const variants: Record<string, string> = {
        light: 'bg-[#E7E9EC] text-[#0B0C0E] font-semibold hover:bg-white active:scale-[0.99]',
        ghost: 'bg-transparent border border-line text-text-mid hover:text-text-hi hover:border-line-strong',
        text: 'bg-transparent text-text-lo hover:text-text-hi',
    };
    return (
        <button
            type="button"
            className={clsx(
                'inline-flex select-none items-center justify-center gap-2 rounded font-sans transition duration-120 ease-soft',
                compact ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-[13px]',
                variants[variant] || variants.ghost,
                className
            )}
            {...rest}
        >
            {children}
        </button>
    );
}

// ── Tag (DESIGN_SPEC §5.15) ───────────────────────────────────────────────────
// 4px rect, padding 2px 6px, Plex Mono 10px uppercase tracking 0.06em.
// Variants: neutral (well bg / text-mid), region (hex 12% bg / hex 90% text),
// risk (hex 12% bg + 30% border / full hex text). No pills.
export function Tag({ variant = 'neutral', hex, icon, title, className = '', children }: any) {
    let style: React.CSSProperties;
    if (variant === 'region' && hex) {
        style = { backgroundColor: `${hex}1F`, color: `${hex}E6` };
    } else if (variant === 'risk' && hex) {
        style = { backgroundColor: `${hex}1F`, border: `1px solid ${hex}4D`, color: hex };
    } else {
        style = { backgroundColor: 'var(--surface-well)', color: 'var(--text-mid)' };
    }
    return (
        <span
            title={title}
            style={style}
            className={clsx(
                'inline-flex items-center gap-1 rounded-sm px-[6px] py-[2px] font-mono text-[10px] uppercase leading-[14px] tracking-[0.06em]',
                className
            )}
        >
            {icon}
            {children}
        </span>
    );
}

// ── Count-up (DESIGN_SPEC §5.5 / §5.10 / §7) ─────────────────────────────────
// 400ms rAF count-up with a ref-compare guard: fires on value-change ONLY, so
// polling/refresh re-renders never make readouts perpetually tick. Optional
// delay implements the 60ms stagger across simulation cells. Disabled under
// prefers-reduced-motion.
export function useCountUp(value: number, delay: number = 0): number {
    const [display, setDisplay] = useState<number>(() => (prefersReducedMotion() ? value : 0));
    const prevRef = useRef<number | null>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        if (prevRef.current === value) return; // ref-compare guard
        const from = prevRef.current ?? 0;
        prevRef.current = value;
        if (prefersReducedMotion()) {
            setDisplay(value);
            return;
        }
        const start = performance.now() + delay;
        cancelAnimationFrame(rafRef.current);
        const tick = (now: number) => {
            const t = Math.min(1, Math.max(0, (now - start) / 400));
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(from + (value - from) * eased);
            if (t < 1) rafRef.current = requestAnimationFrame(tick);
            else setDisplay(value);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [value, delay]);

    return display;
}

// ── Presence (DESIGN_SPEC §7) ────────────────────────────────────────────────
// Keeps a panel mounted through its exit transition. `visible` flips a frame
// after mount so entrance transitions run; on hide it flips immediately and
// the node unmounts after `exitMs` (exits always faster than entrances).
export function usePresence(show: boolean, exitMs: number = 160) {
    const [mounted, setMounted] = useState(show);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let raf = 0;
        if (show) {
            setMounted(true);
            raf = requestAnimationFrame(() => {
                raf = requestAnimationFrame(() => setVisible(true));
            });
        } else {
            setVisible(false);
            timer = setTimeout(() => setMounted(false), exitMs);
        }
        return () => {
            if (timer) clearTimeout(timer);
            cancelAnimationFrame(raf);
        };
    }, [show, exitMs]);

    return { mounted, visible };
}
