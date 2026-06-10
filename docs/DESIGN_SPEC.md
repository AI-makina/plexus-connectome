# Plexus Design Language — "The Scientific Instrument"

**Status:** Definitive, implementation-ready. Consolidated from the judged design review (winner: "The Scientific Instrument", score 9/9/9) with grafted improvements from the runner-up directions.

---

## 1. Direction summary

**Name:** Plexus — The Scientific Instrument
**Tagline:** A connectome under museum glass: near-monochrome graphite chrome, hairline precision, and region color as the only — therefore precious — pigment.

**Principles:**

1. **All chrome is achromatic graphite.** The ONLY hue in the interface comes from the 9 region colors (plus a 3-step risk scale that borrows the amygdala crimson). Color appears in tiny doses: 2px ticks, 8px swatches, tag text. Never as panel fills.
2. **No brand accent color.** The "primary" affordance is inversion: exactly ONE light button (bg `#E7E9EC`, text `#0B0C0E`) per viewport. Everything else is hairline + text-weight hierarchy.
3. **Mono is the instrument voice.** Every number, code, file path, ID, and keycap is IBM Plex Mono with tabular figures and slashed zero. ("Plex" Mono in Plexus is a quiet brand rhyme.)
4. **Rectangles, not pills.** 4px-radius tags, hairline borders (1px, never 2px+ except accent hairlines), max font-weight 600, no italic, nothing bounces.
5. **The resting 3D scene is matte and cheap.** Glow is earned (selection, simulation) and threshold-gated; depth comes from fog, a specimen-stage grid, and a CSS vignette — never from a starfield.
6. **Crimson means danger, and only danger.** Amygdala == risk.critical by deliberate, documented design. Dormant is neutral (asleep, not dangerous): slate + moon icon.
7. **Specimen-plate voice.** INCIDENTS (not Warnings), DORMANT TISSUE, CIRCUIT, IMPACT SIMULATION. Mono uppercase 10px everywhere a machine would stamp text.

---

## 2. Design tokens

### 2.1 `tailwind.config.js` — ready to paste

```js
/** @type {import('tailwindcss').Config} */
import { REGIONS } from './src/theme/regions.js'; // single source of truth (see §4)

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
          frontal: REGIONS.frontal_lobe.hex,     // #7AA2F7
          temporal: REGIONS.temporal_lobe.hex,   // #E3B341
          occipital: REGIONS.occipital_lobe.hex, // #E573B7
          parietal: REGIONS.parietal_lobe.hex,   // #73C991
          cerebellum: REGIONS.cerebellum.hex,    // #9D7CD8
          stem: REGIONS.brain_stem.hex,          // #8B98A9
          limbic: REGIONS.limbic_system.hex,     // #E8795B
          amygdala: REGIONS.amygdala.hex,        // #E5484D
          callosum: REGIONS.corpus_callosum.hex, // #C8CFDA
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
        'in-quiet': 'cubic-bezier(0.4, 0, 1, 1)',      // exits (160ms, faster than entrances)
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
```

Note: nested `text` color key generates utilities `text-text-hi`, `text-text-mid`, `text-text-lo`, `text-text-ghost`. Accept this — it is unambiguous and greppable.

### 2.2 `:root` CSS custom properties — ready to paste into `index.css`

```css
:root {
  /* ink ladder */
  --ink-0: #08090B;
  --ink-1: #0A0B0D;
  --ink-2: #0F1012;
  --ink-3: #141518;
  --ink-4: #1A1C20;

  /* surfaces */
  --surface-panel: rgba(13, 14, 16, 0.82);
  --surface-well: rgba(255, 255, 255, 0.03);
  --surface-keycap: rgba(255, 255, 255, 0.05);
  --surface-hover: rgba(255, 255, 255, 0.04);
  --surface-active-row: rgba(255, 255, 255, 0.06);

  /* hairlines */
  --line: rgba(255, 255, 255, 0.07);
  --line-strong: rgba(255, 255, 255, 0.12);
  --line-faint: rgba(255, 255, 255, 0.04);

  /* text */
  --text-hi: #E7E9EC;
  --text-mid: #9BA1A9;
  --text-lo: #5C626B;
  --text-ghost: #3A3F46;

  /* risk */
  --risk-critical: #E5484D;
  --risk-high: #E08A39;
  --risk-moderate: #D9B13D;
  --risk-low: #8B98A9;

  /* radii */
  --radius-sm: 4px;
  --radius: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;

  /* blur */
  --blur-panel: 16px;

  /* shadows */
  --shadow-panel: inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.5);
  --shadow-tooltip: 0 4px 12px rgba(0,0,0,0.5);

  /* motion */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-soft: cubic-bezier(0.45, 0, 0.25, 1);
  --ease-in-quiet: cubic-bezier(0.4, 0, 1, 1);
  --dur-micro: 120ms;
  --dur-exit: 160ms;
  --dur-control: 200ms;
  --dur-panel: 240ms;
  --dur-data: 400ms;

  /* fonts */
  --font-sans: 'Inter Variable', Inter, -apple-system, system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', SFMono-Regular, Menlo, monospace;
}
```

### 2.3 Component classes — replace `.glass-panel` in `index.css`

```css
@layer components {
  /* Replaces .glass-panel everywhere. Graphite glass, not milky glass. */
  .instrument-panel {
    background: var(--surface-panel);
    backdrop-filter: blur(var(--blur-panel)) saturate(1.2);
    -webkit-backdrop-filter: blur(var(--blur-panel)) saturate(1.2);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-panel); /* inset top highlight = the machined edge */
    border-radius: var(--radius-lg);
  }

  .micro-label {
    font: 500 10px/14px var(--font-sans);
    text-transform: uppercase;
    letter-spacing: 0.10em;
    color: var(--text-lo);
  }

  .readout {
    font-family: var(--font-mono);
    font-weight: 500;
    font-feature-settings: 'tnum' 1, 'zero' 1; /* tabular figures + slashed zero */
  }

  .keycap {
    font: 500 10px/1 var(--font-mono);
    background: var(--surface-keycap);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 1px 5px;
    box-shadow: inset 0 -1px 0 rgba(255,255,255,0.06);
    color: var(--text-lo);
  }
}

body {
  background: var(--ink-1);
  color: var(--text-hi);
  font-family: var(--font-sans);
  font-feature-settings: 'cv05' 1, 'cv11' 1;
  -webkit-font-smoothing: antialiased;
  margin: 0; padding: 0; overflow: hidden;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); }
```

### 2.4 Layout constants

- **Padding grid:** 4px base unit. Panel padding **16px**; panel header **12px 16px**; rows **8px 12px**; tags **2px 6px**. No other paddings — delete mixed `p-2/p-3/p-4`.
- **Dividers:** 1px `rgba(255,255,255,0.06)`, full-bleed edge-to-edge inside panels (negative margin to panel edge). Section headers sit ABOVE their divider: micro-label + 12px gap + hairline.
- **Accent hairlines:** Region/risk identity enters panels ONLY as a **2px top hairline** (kills the current chunky 4px `borderTop`).
- **Concentric-corner rule (stolen from Apple-Native):** child radius = parent radius − padding/2. A 10px panel with 16px padding gives inner wells ~8px? No — clamp to the radius scale: wells inside panels use `--radius-md` (8px), tags inside wells use `--radius-sm` (4px). Never let a child's radius equal or exceed its parent's.
- **Vignette (free depth):** a `pointer-events-none` div between canvas and overlay:
  `background: radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.45) 100%)`.

---

## 3. Typography

### 3.1 Packages (offline-bundled, NO CDN)

```bash
npm install @fontsource-variable/inter @fontsource/ibm-plex-mono
```

In `src/main.tsx`, before `index.css`:

```ts
import '@fontsource-variable/inter';        // latin subset, variable weight
import '@fontsource/ibm-plex-mono/400.css'; // latin only — never the full unicode range
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
```

(~350KB woff2 total — fine for a desktop bundle.)

### 3.2 Stacks

- **Display & body:** `'Inter Variable', Inter, -apple-system, system-ui, sans-serif`
- **Mono:** `'IBM Plex Mono', SFMono-Regular, Menlo, monospace`

### 3.3 Features

- `body { font-feature-settings: 'cv05' 1, 'cv11' 1; -webkit-font-smoothing: antialiased; }`
- `.readout { font-feature-settings: 'tnum' 1, 'zero' 1; }` on EVERY numeric readout so digits never jitter during count-ups.

### 3.4 Type scale

| Token | Spec | Usage |
|---|---|---|
| `micro-label` | 10px/14px, Inter 500, UPPERCASE, tracking 0.10em, text-lo | all panel section headers, stat labels |
| `caption` | 11px/16px, Plex Mono 400 | file paths, footnotes, shortcut hints |
| `body-sm` | 12px/18px, Inter 400 | legend rows, metric labels |
| `body` | 13px/20px, Inter 400 | default UI text, descriptions |
| `title-sm` | 14px/20px, Inter 600, tracking −0.005em | row titles |
| `title` | 16px/22px, Inter 600, tracking −0.01em | inspector node name |
| `display` | 20px/28px, Inter 600, tracking −0.02em | empty state, error headline |
| `readout` | 14px, Plex Mono 500, tnum+zero | stat cluster values |
| `readout-lg` | 24px, Plex Mono 500, tnum+zero | simulation panel numbers |
| `wordmark` | 12px, Inter 600, UPPERCASE, tracking 0.28em | PLEXUS |

### 3.5 Rules

- **No `font-bold` (700) anywhere** — max weight 600. Replace every current `font-bold` class with `font-semibold` or a mono treatment.
- No italic.
- Uppercase only at ≤11px with ≥0.08em tracking.
- **File paths middle-truncate** (stolen from Apple-Native): JS-side `'src/…/NetworkGraph.tsx'` (keep first segment + ellipsis + filename) — NOT CSS `direction: rtl` (locale bug). Helper: `middleTruncate(path, max)` keeps the tail (filename) always visible.

---

## 4. The 9 region colors — single source of truth

**Create `ui/src/theme/regions.js`** (ESM; the tailwind config, `UIOverlay.tsx`, and `NetworkGraph.tsx` ALL import from it; **delete both hard-coded `REGION_COLORS` maps**). Land this dedup as its own isolated first commit so any 3D color regression is bisectable.

```js
// ui/src/theme/regions.js — SINGLE SOURCE OF TRUTH for region identity.
// All 9 sit in a 60–80% lightness band with moderated chroma; separability comes
// from hue spacing ≥20° between chromatic neighbors plus two achromatic poles
// (slate = low lightness pole, ice = high lightness pole). Verified on #08090B.
//
// DELIBERATE: amygdala === risk.critical (#E5484D). Incidents ARE danger — the
// only place region semantics and risk semantics share a hex. Do not "fix" it.
// DELIBERATE: brain_stem === risk.low (#8B98A9). They never co-occur in the
// same component (region tags vs risk tags). Do not "fix" it either.
export const REGIONS = {
  frontal_lobe:    { hex: '#7AA2F7', label: 'Frontal Lobe' },    // azure (was #0066FF — too dark, vibrated on black)
  temporal_lobe:   { hex: '#E3B341', label: 'Temporal Lobe' },   // gold, pulled toward brass (was #FFB800)
  occipital_lobe:  { hex: '#E573B7', label: 'Occipital Lobe' },  // magenta-rose, civilized chroma (was #FF00AA)
  parietal_lobe:   { hex: '#73C991', label: 'Parietal Lobe' },   // jade — doesn't read "success state" (was #00CC66)
  cerebellum:      { hex: '#9D7CD8', label: 'Cerebellum' },      // violet — clearly not magenta or azure (was #8800FF)
  brain_stem:      { hex: '#8B98A9', label: 'Brain Stem' },      // slate — near-achromatic: the stem is infrastructure
  limbic_system:   { hex: '#E8795B', label: 'Limbic System' },   // coral — hue ~15°, between gold and crimson (was #FF6B4A)
  amygdala:        { hex: '#E5484D', label: 'Amygdala' },        // crimson == risk.critical (was #FF0033)
  corpus_callosum: { hex: '#C8CFDA', label: 'Corpus Callosum' }, // ice — cool silver, no longer collides with text (was #FFFFFF)
};

export const REGION_COLORS = Object.fromEntries(
  Object.entries(REGIONS).map(([k, v]) => [k, v.hex])
); // drop-in compatible export for existing call sites
```

**Color-blind note:** gold/coral/crimson compress under deuteranopia. Mitigation is structural: every color use is paired with text (tags, legend labels, tooltip region line) and the legend-filter lets users isolate regions. **Never add a color-only encoding.**

---

## 5. Component-by-component spec

> Overlay architecture stays: `pointer-events-none` container with `pointer-events-auto` islands.

### 5.1 Loading screen — `App.tsx`

Delete the spinning `border-frontal` ring and `animate-pulse`. Replace with:

- Full screen `bg-[--ink-1]`, centered column.
- Logo mark 28px in `--text-hi` (SVG in §8.3), 16px gap below.
- Wordmark `PLEXUS` (12px Inter 600, tracking 0.28em, `--text-hi`); beneath it `CONNECTOME ENGINE` (micro-label, `--text-lo`).
- Below: a **160×2px track** (`--line`) containing an indeterminate **48px sweep bar** (`#E7E9EC` at 60% opacity), animating left→right, `1.4s ease-in-out infinite`.
- Under it, a Plex Mono 11px `--text-lo` status line cycling every 900ms: `INDEXING NODES…` → `MAPPING SYNAPSES…` → `RESOLVING REGIONS…`.
- Zero color, zero spinner.

### 5.2 `index.html` — metadata + native error box

```html
<title>Plexus — Codebase Connectome</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#0A0B0D">
<meta name="description" content="Neural connectome engine: explore your codebase as a living brain.">
<style>html { background-color: #0A0B0D; }</style> <!-- prevents white flash before CSS loads -->
```

**Native error box** (inline styles — Tailwind isn't loaded yet; remove the 💥 emoji and the `#b91c1c` red flood):

- Full-screen `#0A0B0D`; centered card max-width 640px: bg `#0F1012`, 1px `rgba(255,255,255,0.07)` border, 10px radius, **2px `#E5484D` top hairline**.
- `SYSTEM FAULT` — 10px uppercase tracking 0.10em, color `#E5484D`.
- Message — 14px `#E7E9EC` (Inter fallback stack OK here: `-apple-system, system-ui, sans-serif`).
- Stack — scrollable well: bg `#141518`, 1px border, 8px radius, monospace 11px `#9BA1A9`, max-height 320px, padding 12px.
- Button row: **Reload** (light button: bg `#E7E9EC`, text `#0B0C0E`, 6px radius, 36px tall, `location.reload()`) + **Copy report** (ghost: transparent, 1px border `rgba(255,255,255,0.07)`, text `#9BA1A9`; `navigator.clipboard.writeText(msg + stack)`).

`ErrorBoundary.tsx` mirrors this exact layout in JSX with Tailwind tokens.

### 5.3 Top bar — brand + search island (left), `UIOverlay.tsx`

One **40px-tall** `.instrument-panel` island, contents left→right:

1. Logo mark 16px (`currentColor` = text-hi) + `PLEXUS` wordmark (12px/0.28em) + `v0.1` (Plex Mono 10px, `--text-ghost`).
2. 1px vertical divider (`--line`).
3. Search field, 320px: transparent bg over the panel; `Search` icon 14px `--text-lo`; input 13px `--text-hi`, placeholder `--text-ghost` `"Search nodes, files, synapses…"`; right-aligned **⌘K keycap** (`.keycap`).

**Focus state:** island border `--line-strong` + `box-shadow: 0 0 0 1px rgba(255,255,255,0.12)` — a white ring, never colored.

**Keyboard handler (implement — the hint is currently a lie):** `window` keydown: `⌘K`/`Ctrl+K` → `preventDefault()` + focus input. `Escape` follows the ladder in §5.12.

### 5.4 Search results dropdown (new component)

Replaces the current **silent auto-select hijack** in the input's `onChange` (UIOverlay.tsx lines 30–52) — never steal selection while typing. (Agents relying on exact-code auto-select still work via Enter-on-first-result; the matcher keeps exact `code` matches ranked first.)

- Anchored 6px below the search island, same width; `.instrument-panel` but **8px radius**; opens at ≥2 chars; max 8 rows × 36px.
- **Row anatomy:** `2×16px region tick` (region hex) | name 13px `--text-hi` with match substring at Inter 600 | file_path Plex Mono 11px `--text-lo`, middle-truncated | right: type tag (mono 10px uppercase, 4px rect, well bg).
- **Active row** (↑/↓): bg `rgba(255,255,255,0.06)`, tick widens 2→3px.
- **Enter** selects node/synapse (sets `selectedNode`/`selectedSynapse`, clears the other) + closes.
- **Footer** above a hairline: `N RESULTS` left; `↑↓ NAVIGATE · ↵ SELECT · ⎋ CLOSE` right; both mono 10px `--text-ghost`.
- No matches: single row `No matches in connectome`, 12px `--text-lo`.
- **Exclude hidden regions** (see §5.7) from results.
- Stop propagation of wheel/pointer events so the dropdown never fights OrbitControls.

### 5.5 Stat cluster (replaces the three stat chips)

Single `.instrument-panel` island — an odometer strip:

- Three cells separated by 1px vertical hairlines (`--line`), each padding 8px 16px.
- Cell: micro-label on top (`NODES` / `SYNAPSES` / `INCIDENTS` — **rename Warnings→INCIDENTS**), value below in `.readout` 14px `--text-hi`.
- `INCIDENTS` value turns `--risk-critical` with a preceding 4px dot **only when count > 0**; at 0 it stays achromatic.
- No per-cell backgrounds, no icons.
- Numbers **count up 400ms** on data load. **Guard: fire on value-change only (ref-compare previous value)** so polling/refresh never makes the strip perpetually tick.

### 5.6 Dormant toggle

36px control in the top-right island group (replaces the Eye/EyeOff button):

- `DORMANT` (mono 10px uppercase tracking 0.08em) + dormant count (mono 10px `--text-ghost`) + a real **28×16px switch**: track 1px `--line` border, radius 8px; OFF knob 12px `#5C626B`; ON knob `#E7E9EC` with track `rgba(255,255,255,0.18)`.
- Knob slides 120ms ease-out. Whole control: OFF text-lo, ON text-hi.
- Keyboard shortcut **`D`** (ignore when an input is focused); `title="Show dormant tissue (D)"`.

### 5.7 Region legend → functional filter (left panel, 240px)

The legend finally earns its `cursor-pointer`.

- **Header:** `REGIONS` micro-label + right-aligned total count (mono); hairline below; `RESET` text-button (text-lo→text-hi) appears in header only when any filter is active.
- **Rows 28px:** 8×8px 2px-radius swatch (region hex, 90% opacity, **no glow shadow**) | label 12px `--text-mid` capitalize | right node-count Plex Mono 11px `--text-lo`. Beneath the label: a **2px proportional bar** (region hex at 35% opacity, width = count/maxCount) — the panel becomes a readout, not decoration.
- **Interactions** (new state in `usePlexus`: `hiddenRegions: Set<string>` — **independent of `showDormant`** to avoid combinatorial filter bugs):
  - Click toggles region visibility. Hidden region: 3D nodes/synapses fade to 8% opacity over 250ms (material mutation — see §6.8, NEVER a graph rebuild); row goes `--text-ghost`, swatch 25% opacity, count struck-through.
  - **⌥-click solos** a region (hides all others).
  - Hidden regions are excluded from search results.
- Hover: row bg `rgba(255,255,255,0.04)`.

### 5.8 Node inspector (right panel, 320px)

- **Top:** 2px region-hex hairline (replaces the 4px `borderTop`).
- **Header (16px padding):** tag row — `TYPE` tag (well bg, mono 10px uppercase), `REGION` tag (region hex at 12% bg, region hex text at 90%), `CODE` tag (mono, well bg); **`DORMANT` tag when applicable: NEUTRAL well bg + 12px moon icon + `--text-mid` text** (stolen from Apple-Native — dormant means asleep, not dangerous; crimson stays reserved for amygdala/critical).
- Name: 16px Inter 600 tracking −0.01em, truncate with `title`. File path: Plex Mono 11px `--text-lo`, **middle-truncated**.
- Ghost **X** close button 24px (text-lo → text-hi) top-right; closes via the Escape ladder too.
- **Body sections** under micro-label headers + full-bleed hairlines:
  - `DESCRIPTION` — 13px/20px `--text-mid`.
  - `METRICS` — 2-col table rows: label 12px `--text-mid` left; value Plex Mono 12px `--text-hi` right (`Connections in/out`, `Stability`, `Degree`).
  - `DORMANT` notice (when dormant): a well (`--surface-well`, 8px radius) with **2px left slate (`#8B98A9`) border**, 12px `--text-mid` text, moon icon. (No crimson.)
- **Footer:** `Run Impact Simulation` — **THE one light button per viewport**: full-width, 36px, bg `#E7E9EC`, text `#0B0C0E`, Inter 600 13px, `Play` icon 12px, radius 6px; hover `#FFFFFF`; active `scale(0.99)`.
- **Entrance:** `translateX(8px)` + fade, 240ms `--ease-out-expo`. **Exit:** 160ms `--ease-in-quiet`.

### 5.9 Synapse inspector (same 320px anatomy)

- **Top:** 2px hairline `linear-gradient(90deg, sourceRegionHex, targetRegionHex)` — the panel's only color moment.
- Tags: `SYNAPSE` + `CODE` (+ neutral `DORMANT` w/ moon when applicable).
- Title: `'Connection'` becomes **`{source.name} → {target.name}`**, 14px Inter 600, truncate.
- **New `CIRCUIT` block:** two endpoint rows (8px region dot + node name 12px `--text-hi` + code mono 10px `--text-lo`) joined by a 12px vertical 1px **dashed** line (`--line-strong`) with a 3px arrowhead — reads like a wiring diagram. **Endpoint rows are clickable chips that select that node** (stolen from Apple-Native — synapse → endpoint → its synapses is a core traversal workflow). Hover: row bg `--surface-hover`, cursor pointer.
- **`IMPACT ANALYSIS` table** in a well (`--ink-3`, 8px radius):
  - `Classification` → 4px rect tag in risk color (12% bg + 30% border, full-hex mono text).
  - `Final Strength` → mono value + **64×2px meter** (track `--line-faint`, fill `rgba(255,255,255,0.6)` proportional — region-agnostic).
  - `Intrinsic Weight`, `Cascade Influence` → mono values `--text-mid`.

### 5.10 Simulation results panel (bottom-center, max-w-3xl)

- `.instrument-panel`; **top 2px hairline in risk-tier color** — thresholds: `risk_score > 0.7` → `--risk-critical`, `> 0.4` → `--risk-high`; otherwise **achromatic `--line-strong`** (replaces the blue low state).
- **Header row:** `IMPACT SIMULATION` micro-label + source node name (13px `--text-hi`) left; right: ghost X + `ESC` keycap (**wire Esc** — see ladder §5.12).
- **Readout strip** — hairline-separated cells, NO card backgrounds:
  - `RISK` — `.readout` 24px in tier color, formatted `7.2` with ` / 10` at 12px `--text-lo`.
  - `AFFECTED` — 24px `--text-hi`.
  - `CRITICAL PATHS` — 24px, crimson only when > 0.
  - `AMYGDALA ALERTS` — 24px, `--risk-high` only when > 0; the triangle icon moves OUT of the number to a 12px icon next to the label.
- Numbers count up 400ms, staggered 60ms, synced to the 3D wave; ref-compare guard so re-renders never re-trigger.
- Below a hairline: recommendation, 12px `--text-mid`, 2-line clamp.
- **Entrance:** `translateY(12px)` + fade, 240ms `cubic-bezier(0.32, 0.72, 0, 1)`. **Exit:** 160ms ease-in.

### 5.11 Empty / onboarding state (new)

When nothing is selected AND `!localStorage['plexus.onboarded']`:

- Right-side **ghost panel**, same width as inspector (320px): **1px DASHED `--line` border, transparent bg, NO blur** — it's an outline, not glass.
- Content centered, 24px padding: crosshair icon 20px `--text-ghost`; `No selection` 13px `--text-mid`; `Click a neuron to inspect it.` 12px `--text-lo`; then three shortcut rows: keycap `⌘K` + "Search the connectome", keycap `D` + "Toggle dormant tissue", keycap `⎋` + "Deselect".
- Dismisses forever after the first node selection (`localStorage['plexus.onboarded'] = '1'`). Fades out 240ms.

### 5.12 Keyboard layer + Escape precedence ladder (stolen from Abyssal)

One `window` keydown handler in `UIOverlay` (or a `useKeyboard` hook). **Escape resolves in strict order, one action per press:**

1. Search dropdown open → close dropdown (keep query).
2. Search input focused → clear query + blur.
3. `selectedNode`/`selectedSynapse` → deselect (closes inspector).
4. `simulationResult` → clear simulation panel.

`⌘K`/`Ctrl+K` → focus search. `D` → toggle dormant. All shortcuts no-op while a text input is focused (except Escape and ⌘K).

### 5.13 API-unreachable states (new — stolen from Apple-Native + Flight Deck)

`usePlexus.ts` currently swallows fetch errors (`catch → console.error`), leaving a silent empty brain. Add `error: string | null` and `retrying` state:

- **Initial load fails (no data yet):** full-screen card on `--ink-1`, instrument-panel, 2px `--risk-high` top hairline: `ENGINE UNREACHABLE` micro-label in `--risk-high`; `"Can't reach the Plexus engine."` 14px `--text-hi`; the checked URL (`http://localhost:{port}`) in Plex Mono 12px `--text-mid`; **Retry** light button.
- **Lost after data loaded (refresh/simulation fails):** slim top-center banner, instrument-panel, mono 11px uppercase: `ENGINE LINK LOST — RETRYING IN {n}s` + `Retry now` text-button. Auto-retry with backoff (2s → 5s → 10s → 30s cap). Banner clears itself on success.

### 5.14 3D node tooltip — `NetworkGraph.tsx` (drei `<Html>`)

Replace the `bg-black/80` box:

- bg `rgba(13,14,16,0.92)`, 1px `--line-strong` border, 6px radius, padding 6px 10px, **2px left bar in region hex**, shadow `--shadow-tooltip`.
- Line 1: name 12px Inter 500 `--text-hi`. Line 2: `{REGION} · {CODE}` Plex Mono 10px `--text-lo` uppercase.
- Keep `distanceFactor={15}`, `pointer-events-none`, `whitespace-nowrap`. Fades in 120ms.
- **Add `zIndexRange={[10, 0]}`** so the tooltip never paints over UI panels (overlay is z-10).

### 5.15 Shared primitives — buttons, tags, keycaps

**Three buttons only** (encode as a `<Button variant>` component so the one-light-button rule is lint-able, not a convention):

| Variant | Spec |
|---|---|
| `light` | bg `#E7E9EC`, text `#0B0C0E`, hover `#FFFFFF`, active scale 0.99 — **max one per viewport** |
| `ghost` | transparent, 1px `--line` border, text `--text-mid`; hover: text `--text-hi` + border `--line-strong` |
| `text` | no border, `--text-lo` hover `--text-hi` — Reset/Clear/Retry-now |

All radius 6px; heights 36px (primary) / 28px (compact).

**Tag primitive:** 4px rect, padding 2px 6px, Plex Mono 10px uppercase tracking 0.06em. Variants: `neutral` (well bg / `--text-mid`), `region` (hex 12% bg / hex 90% text), `risk` (risk hex 12% bg + 30% border / full hex text). **Kill all `rounded-full` pills and `rounded-xl`.**

**Keycap:** see `.keycap` class (§2.3).

---

## 6. 3D scene spec — `NetworkGraph.tsx`

### 6.0 Load-bearing bug fix FIRST (stolen from Apple-Native)

**Remove `plexus.searchQuery` from the `GraphSimulation` `useMemo` dependency array (line 348).** Today every keystroke rebuilds the d3-force simulation and re-explodes the brain. New deps: `[plexus.data, plexus.showDormant]`. Region filtering, circuit tracing, and search focus are implemented as **material opacity/emissive ref mutations only — never graph rebuilds**.

### 6.1 Background & depth

- Canvas clear color **`#08090B`** (`--ink-0`, one step below UI ink-1 so panels float above the void).
- **NO Stars** — delete the commented `<Stars>` permanently; a starfield reads sci-fi toy, not instrument.
- **Specimen stage** — drei `<Grid>`:
  ```jsx
  <Grid position={[0, -95, 0]} args={[400, 400]} cellSize={10} cellColor="#101114"
        sectionSize={50} sectionColor="#16181C" fadeDistance={320} fadeStrength={2} infiniteGrid />
  ```
  A faint polar bench the brain hovers over — museum-pedestal feel at near-zero cost.
- **CSS vignette div** above the canvas (§2.4).

### 6.2 Fog

```jsx
<fog attach="fog" args={['#08090B', 160, 420]} />
```
Graph spans roughly ±90 units (REGION_BOUNDS); near plane starts past the specimen, far nodes recede into graphite. **If REGION_BOUNDS scale ever changes, retune both distances and the grid `y=-95` proportionally** or far regions fade out entirely.

### 6.3 Lighting rig — strictly monochrome

**Delete the `#4444ff` point light** (it tints every region hex).

```jsx
<ambientLight intensity={0.25} color="#FFFFFF" />
<directionalLight position={[80, 120, 80]} intensity={1.1} color="#F2F4F8" />  {/* key */}
<pointLight position={[-120, -40, -120]} intensity={0.5} color="#AEB6C2" />   {/* rim */}
<pointLight position={[0, -80, 40]} intensity={0.25} color="#FFFFFF" />       {/* low fill */}
```
Keep `ACESFilmicToneMapping`; drop `toneMappingExposure` 1.2 → **1.1**. Color now comes ONLY from emissive region hexes.

### 6.4 Node material

`meshStandardMaterial`, `toneMapped={false}`:

- `color` = region hex darkened 40%: `new THREE.Color(hex).multiplyScalar(0.6)`.
- `emissive` = region hex.
- `roughness: 0.35`, `metalness: 0.1` (current 0.6 metalness = dark plastic ball bearings).
- **Emissive intensity states** (keep the 0.1/frame lerp): rest **0.55**, hover **0.9**, selected **1.3**, dormant **0.18** with `opacity 0.35` (preserved tissue, not warning).
- **Simulation impact recolor** keeps the 150ms-per-hop wave but uses the risk scale (replaces raw `#ff0000`/`#ffff00`): critical `#E5484D` @ 2.2, high `#E08A39` @ 1.8, moderate `#D9B13D` @ 1.4, low `#C8CFDA` @ 1.0.
- Sphere segments stay 16; selected node may use 24.
- **Region-filtered nodes:** opacity lerps to 0.08 over ~250ms AND **`raycast = () => null`** (stolen from Abyssal) so ghost nodes never intercept clicks meant for visible tissue behind them. Restore raycast when unhidden.

### 6.5 Selection indicator — the reticle

**Kill the 1.5× scale jump** (it lies about the size=connections encoding). Instead:

- Selected node scales **1.15×** (lerped, ~200ms feel).
- Camera-facing reticle via drei `<Billboard>`:
  - Inner ring: `<ringGeometry args={[size*1.5, size*1.55, 48]}>` + `meshBasicMaterial` `#E7E9EC`, opacity 0.9, `transparent`, `depthTest={false}`.
  - Outer ring: `args={[size*1.9, size*1.92, 48]}` in region hex, opacity 0.5, rotating 0.15 rad/s around Z.
- Reticle scales in from 1.3×→1× over 200ms. A precision crosshair, not a glow.
- Hover (`onPointerOver`): `cursor: pointer` + emissive 0.9; no ring.

### 6.6 Synapse lines

Restraint: the web reads as graphite circuitry with hue hints; neurons carry the color.

- Line color = current source/target region blend, then **mixed 35% toward `#8B98A9`** (`THREE.Color.lerp`).
- Base opacity = `clamp(strength * 0.25, 0.10, 0.35)` (down from 0.15–0.8).
- Width tiers: **0.10 / 0.22 / 0.45** (same tier logic, thinner).
- Dormant: keep dashed params, opacity 0.15.
- **CIRCUIT TRACING on selection:** synapses touching the selected node jump to **0.8 opacity with UNMIXED blend color**; all others dim to **0.05** (lerp ~250ms) — selecting a neuron lights its circuit like probing a board. (Tuning note: if sparse graphs feel dead, floor the dim at 0.10.)
- Region-filtered (hidden) synapses: 0.03.

### 6.7 Bloom — re-enabled, threshold-gated

```jsx
<EffectComposer multisampling={0} disableNormalPass>
  <Bloom mipmapBlur intensity={0.6} luminanceThreshold={1.0} luminanceSmoothing={0.2} />
</EffectComposer>
```

With `toneMapped: false` emissives, only materials with `emissiveIntensity > 1.0` cross threshold — i.e. the selected node (1.3) and the simulation wave (1.4–2.2). **The resting scene stays matte** (restraint AND fewer bright pixels to blur). Gating is arithmetic, not hopeful.

- When the composer is active: Canvas `gl={{ antialias: false }}` (MSAA is wasted under a composer and its framebuffers were the likely context-loss source) and **`dpr={[1, 1.75]}`**.
- **Defer composer mount** (stolen from Flight Deck): mount only after **~60 rendered frames** AND only when **node count < 800** — never stack bloom framebuffer allocation on top of d3-force settling (the heaviest moment; `GraphSimulation` forces re-renders every frame while `alpha > 0.01`).

### 6.8 WebGL context-loss safeguard — three layers + proactive demote

1. **Quality state machine** — `useQuality` hook: `'high'` (bloom on, antialias false, dpr [1,1.75]) | `'low'` (no composer, antialias true, dpr [1,1.5]). Persisted to `localStorage['plexus.quality']`. Default `'high'`, **EXCEPT proactive auto-demote before first render** (stolen from Apple-Native): start in `'low'` when node count > 800 OR `navigator.hardwareConcurrency <= 4`.
2. **Context-loss latch:**
   ```jsx
   onCreated={({ gl }) => {
     gl.domElement.addEventListener('webglcontextlost', (e) => {
       e.preventDefault();
       setQuality('low');
       localStorage.setItem('plexus.quality', 'low'); // permanent for this machine
     });
     gl.domElement.addEventListener('webglcontextrestored', () => bumpCanvasKey());
   }}
   ```
   After a loss, bloom stays off permanently for that machine; remount Canvas via key bump; show a one-line toast: `RENDER QUALITY REDUCED FOR STABILITY` (mono 11px, instrument-panel, bottom-left, 4s).
3. **Proactive degradation:** drei `<PerformanceMonitor onDecline={() => setQuality('low')}>` wraps the effects.

**Low mode is designed, not degraded** (stolen from Abyssal/Flight Deck): one shared pre-baked **128px radial-gradient CanvasTexture** halo sprite, tinted via material color to the region hex, additive blending — attached **only to the selected node** in low mode, so selection still glows without any postprocessing. One texture total, near-zero cost. The resting scene never depended on bloom by design.

**Test mandate:** force a context loss via the `WEBGL_lose_context` extension to verify the latch + toast + sprite fallback before App Store submission; ship the `webglcontextlost` handler **in the same commit** that re-enables Bloom. Test on a non-Apple-Silicon (Intel GPU) Mac.

### 6.9 Camera

- `fov: 55 → 50` (slightly telephoto = specimen under glass); keep position `[80, 40, 120]`.
- `OrbitControls enableDamping dampingFactor={0.08} minDistance={40} maxDistance={380}` (stops users escaping the fog envelope). Keep CameraController target lerp 0.05.
- **One-time arrival shot** (stolen from Flight Deck): on first data load, ease camera from `[120, 60, 180]` to `[80, 40, 120]` over ~1.2s (ease-out); skipped under `prefers-reduced-motion`.
- **Double-click empty space** → reset `controls.target` to origin over ~600ms (recover-from-lost gesture).

### 6.10 Render-loop hygiene

- Throttle the `setTicks` re-invalidation: only while `simulation.alpha() > 0.01` (already present — keep it; do not add new per-frame setState).
- Canvas Suspense fallback: centered `INITIALIZING RENDERER…` Plex Mono 11px uppercase `--text-lo` on `--ink-0` (replaces "Loading Engine...").

---

## 7. Motion spec

**Easings (CSS vars + Tailwind, §2):**

| Token | Value | Use |
|---|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | entrances |
| `--ease-soft` | `cubic-bezier(0.45, 0, 0.25, 1)` | movement / size |
| `--ease-in-quiet` | `cubic-bezier(0.4, 0, 1, 1)` | exits |
| `linear` | — | opacity-only micro-fades |

**Durations:**

| Duration | What |
|---|---|
| **120ms** | micro: hovers, color shifts, tooltip fade, toggle knob color |
| **160ms** | ALL exits (panels, dropdown, tooltips) — exits always faster than entrances |
| **200ms** | controls: toggle knob slide, reticle scale-in 1.3×→1× |
| **240ms** | panels: slide 8px + fade (replaces the 300ms full slide-in-from-right — panels settle like a needle, not swing like a door) |
| **400ms** | data: readout count-ups via rAF with tabular figures; staggered 60ms across simulation cells; ref-compare guard against re-trigger |
| **250ms** | 3D opacity lerps (region filter, circuit tracing) — per-frame lerp in useFrame, not CSS |
| **150ms/hop** | simulation blast emissive wave (existing), synced with panel count-ups |
| **1.4s** | loading sweep, ease-in-out infinite |
| **~1.2s** | one-time camera arrival shot |
| **~600ms** | double-click recenter of orbit target |

**Rules:** Nothing bounces, nothing springs past 1.0, no DOM scale above 1.02 — overshoot is for toys, instruments damp. `prefers-reduced-motion`: disable count-ups, slides, ring rotation, and the arrival shot; keep opacity fades.

---

## 8. Brand

### 8.1 Titles

- **App display title:** `Plexus`
- **HTML title:** `Plexus — Codebase Connectome`

### 8.2 Wordmark

`PLEXUS` set in Inter 600, all caps, `letter-spacing: 0.28em`, color `--text-hi` (`#E7E9EC`). In chrome at 12px, paired with `CONNECTOME ENGINE` / version in Plex Mono 10px `--text-ghost`. **Never gradiented, never colored** — the wordmark is graphite like the chassis.

```css
.wordmark { font: 600 12px/1 var(--font-sans); text-transform: uppercase; letter-spacing: 0.28em; color: var(--text-hi); }
```

### 8.3 Logo mark — "The Synapse"

One filled node, one open node, one arc between them: the entire product (neuron + neuron + dependency) in three strokes. Reads at 16px, plots like an engraving. `currentColor` so it inherits text-hi in chrome and ink-1 on light marketing surfaces.

```html
<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="3.5" cy="12.5" r="2.1" fill="currentColor"/>
  <circle cx="12.5" cy="3.5" r="2.1" stroke="currentColor" stroke-width="1.4"/>
  <path d="M5 11 Q 9 9.5 11 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>
```

### 8.4 Favicon — `public/favicon.svg`

The mark in `#E7E9EC` centered at ~60% scale on a `#0A0B0D` rounded-rect (radius 20%):

```html
<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="6.4" fill="#0A0B0D"/>
  <g transform="translate(6.4, 6.4) scale(1.2)" fill="none">
    <circle cx="3.5" cy="12.5" r="2.1" fill="#E7E9EC"/>
    <circle cx="12.5" cy="3.5" r="2.1" stroke="#E7E9EC" stroke-width="1.4"/>
    <path d="M5 11 Q 9 9.5 11 5" stroke="#E7E9EC" stroke-width="1.4" stroke-linecap="round"/>
  </g>
</svg>
```

`<link rel="icon" type="image/svg+xml" href="/favicon.svg">`. For the later Mac App Store shell: the same mark embossed on a graphite rounded-square at macOS icon sizes; the open-circle stroke may take region azure `#7AA2F7` at large sizes only (the one sanctioned color moment).

### 8.5 Voice

Specimen-plate language: `INCIDENTS` not Warnings, `DORMANT TISSUE`, `CIRCUIT`, `IMPACT SIMULATION`, `ENGINE LINK LOST`, `SYSTEM FAULT`. Mono uppercase 10px everywhere a machine would stamp text.

---

## 9. Implementation order

**New npm deps (the only ones):**

```bash
npm install @fontsource-variable/inter @fontsource/ibm-plex-mono
```

Everything else uses packages already in `package.json` (drei `Grid`/`Billboard`/`PerformanceMonitor`, @react-three/postprocessing `EffectComposer`/`Bloom`).

**Commit-by-commit order (each step leaves the app coherent):**

1. **`regions.js` single source of truth** — create `ui/src/theme/regions.js` with the 9 final hexes; import in `UIOverlay.tsx`, `NetworkGraph.tsx`, `tailwind.config.js`; delete both hard-coded maps. Isolated commit → any 3D color regression is bisectable.
2. **Bug fix: searchQuery out of GraphSimulation deps** (NetworkGraph.tsx line 348) — isolated commit.
3. **Tokens** — tailwind `theme.extend`, `:root` vars, `.instrument-panel`/`.micro-label`/`.readout`/`.keycap`, fonts installed + imported in `main.tsx`, body styles, scrollbar.
4. **`index.html`** — title, favicon.svg, theme-color, description, html bg, restyled native error box. Brand assets (logo SVG component, wordmark).
5. **Chrome pass on UIOverlay** — top bar (brand + search island), stat cluster (INCIDENTS rename + count-up w/ guard), dormant toggle switch, all pills→4px tags, font-bold→600, padding grid, panel surfaces.
6. **Keyboard layer** — ⌘K handler, `D` shortcut, Escape precedence ladder.
7. **Search dropdown** — remove the auto-select hijack, build the dropdown (rows, ↑↓/↵, footer, middle-truncated paths).
8. **Inspectors** — node inspector (2px hairline, tags incl. neutral dormant+moon, metrics table, light button), synapse inspector (gradient hairline, clickable CIRCUIT block, impact table), simulation panel (tier hairline, readout strip, Esc), empty/onboarding state, panel entrance/exit motion.
9. **3D scene pass** — clear color, fog, grid stage, vignette div, monochrome lighting rig, node material params + risk-scale wave colors, reticle selection (kill 1.5× jump), synapse line restraint + circuit tracing, restyled tooltip (`zIndexRange=[10,0]`), camera fov 50 + clamps + arrival shot + double-click recenter, Suspense fallback text.
10. **Legend-as-filter** — `hiddenRegions` Set in `usePlexus` (independent of `showDormant`), material-mutation fades, `raycast = () => null` on hidden nodes, ⌥-click solo, RESET, proportional bars, search exclusion.
11. **Bloom + quality system** — `useQuality` hook (high/low, localStorage latch, proactive demote on node count/hardwareConcurrency), deferred composer mount (60 frames + node cap), context-lost/restored handlers + toast, PerformanceMonitor, halo-sprite fallback for selected node in low mode. **Same commit ships handler + Bloom.** Force `WEBGL_lose_context` to test.
12. **Error/link states** — `error` state in `usePlexus`, full-screen ENGINE UNREACHABLE card, ENGINE LINK LOST banner w/ backoff, ErrorBoundary JSX restyle.
13. **QA pass** — Intel-Mac context-loss test, deuteranopia check (text pairing everywhere), reduced-motion audit, screenshot set for App Store.

**Documented intentional collisions (do not "fix"):** `amygdala === risk.critical` (#E5484D) and `brain_stem === risk.low` (#8B98A9) — see comments in `regions.js`.
