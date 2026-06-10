/** @type {import('tailwindcss').Config} */
import { REGIONS } from './src/theme/regions.js'; // single source of truth (DESIGN_SPEC §4)

export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                ink: {
                    0: '#08090B', // 3D canvas clear color (deepest layer)
                    1: '#0A0B0D', // app/body background, loading screen
                    2: '#0F1012', // panel base tint
                    3: '#141518', // nested wells, code blocks, inputs
                    4: '#1A1C20', // hover fill on rows
                },
                line: {
                    DEFAULT: 'rgba(255,255,255,0.07)', // default hairline
                    strong: 'rgba(255,255,255,0.12)',  // focus rings, active controls
                    faint: 'rgba(255,255,255,0.04)',   // internal dividers, inset highlight
                },
                text: {
                    hi: '#E7E9EC',    // primary (never pure #FFF)
                    mid: '#9BA1A9',   // secondary, descriptions
                    lo: '#5C626B',    // labels, captions
                    ghost: '#3A3F46', // placeholders, disabled, watermarks
                },
                risk: {
                    critical: '#E5484D',
                    high: '#E08A39',
                    moderate: '#D9B13D',
                    low: '#8B98A9', // achromatic slate — low risk earns no color
                },
                region: {
                    frontal: REGIONS.frontal_lobe.hex,
                    temporal: REGIONS.temporal_lobe.hex,
                    occipital: REGIONS.occipital_lobe.hex,
                    parietal: REGIONS.parietal_lobe.hex,
                    cerebellum: REGIONS.cerebellum.hex,
                    stem: REGIONS.brain_stem.hex,
                    limbic: REGIONS.limbic_system.hex,
                    amygdala: REGIONS.amygdala.hex,
                    callosum: REGIONS.corpus_callosum.hex,
                },
            },
            borderRadius: {
                sm: '4px',      // tags, keycaps, swatches
                DEFAULT: '6px', // inputs, buttons, tooltips
                md: '8px',      // wells, dropdown
                lg: '10px',     // panels
            },
            fontFamily: {
                sans: ["'Inter Variable'", 'Inter', '-apple-system', 'system-ui', 'sans-serif'],
                mono: ["'IBM Plex Mono'", 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            boxShadow: {
                panel: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.5)',
                tooltip: '0 4px 12px rgba(0,0,0,0.5)',
                keycap: 'inset 0 -1px 0 rgba(255,255,255,0.06)',
            },
            transitionTimingFunction: {
                'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',  // entrances
                soft: 'cubic-bezier(0.45, 0, 0.25, 1)',        // movement/size
                'in-quiet': 'cubic-bezier(0.4, 0, 1, 1)',      // exits
            },
            transitionDuration: {
                120: '120ms', // micro: hovers, color shifts, tooltip fade
                160: '160ms', // exits (always faster than entrances)
                200: '200ms', // controls: toggle knob, reticle
                240: '240ms', // panels: slide 8px + fade
                400: '400ms', // data: count-ups
            },
        },
    },
    plugins: [],
}
