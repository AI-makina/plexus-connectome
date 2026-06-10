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
    frontal_lobe: { hex: '#7AA2F7', label: 'Frontal Lobe' },    // azure (was #0066FF — too dark, vibrated on black)
    temporal_lobe: { hex: '#E3B341', label: 'Temporal Lobe' },   // gold, pulled toward brass (was #FFB800)
    occipital_lobe: { hex: '#E573B7', label: 'Occipital Lobe' },  // magenta-rose, civilized chroma (was #FF00AA)
    parietal_lobe: { hex: '#73C991', label: 'Parietal Lobe' },   // jade — doesn't read "success state" (was #00CC66)
    cerebellum: { hex: '#9D7CD8', label: 'Cerebellum' },      // violet — clearly not magenta or azure (was #8800FF)
    brain_stem: { hex: '#8B98A9', label: 'Brain Stem' },      // slate — near-achromatic: the stem is infrastructure
    limbic_system: { hex: '#E8795B', label: 'Limbic System' },   // coral — hue ~15°, between gold and crimson (was #FF6B4A)
    amygdala: { hex: '#E5484D', label: 'Amygdala' },        // crimson == risk.critical (was #FF0033)
    corpus_callosum: { hex: '#C8CFDA', label: 'Corpus Callosum' }, // ice — cool silver, no longer collides with text (was #FFFFFF)
};

export const REGION_COLORS = Object.fromEntries(
    Object.entries(REGIONS).map(([k, v]) => [k, v.hex])
); // drop-in compatible export for existing call sites
