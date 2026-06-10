// DESIGN_SPEC §3.5 — file paths middle-truncate JS-side (NOT CSS direction:rtl,
// which has a locale bug). Keeps the first segment + ellipsis + filename; the
// tail (filename) stays visible at every width.
export function middleTruncate(path: string, max: number = 36): string {
    if (!path) return '';
    if (path.length <= max) return path;
    const parts = path.split('/');
    const file = parts[parts.length - 1];
    if (parts.length > 2) {
        const candidate = `${parts[0]}/…/${file}`;
        if (candidate.length <= max) return candidate;
    }
    const short = `…/${file}`;
    if (short.length <= max) return short;
    return '…' + file.slice(-Math.max(1, max - 1));
}
