import fs from 'fs';
import path from 'path';

// Self-update detection. `npm run build` stamps dist/BUILD_ID with a fresh
// timestamp, so a BUILD_ID newer than the one we loaded at startup means a newer
// engine build is on disk — and a restart would pick it up. This is what powers
// the viz "Update available" badge, so a connectome can be brought onto the latest
// Plexus (design + logic + migrations) with one click instead of a manual restart.

const BUILD_ID_FILE = path.join(__dirname, '..', 'BUILD_ID'); // dist/BUILD_ID (from dist/core)
const SELF = __filename; // dist/core/engineVersion.js — rewritten every build (mtime fallback)
const NOTES_FILE = path.join(__dirname, '..', '..', 'UPDATE_NOTES.json'); // repo root, developer-maintained

export interface UpdateNote {
    date: string;
    title: string;
    notes: string[];
}

// Newest entry from the release-notes file (read fresh so it reflects the on-disk build).
function latestNote(): UpdateNote | null {
    try {
        const arr = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
        if (Array.isArray(arr) && arr.length > 0) return arr[0];
    } catch { /* no notes file — fine */ }
    return null;
}

function readBuildStamp(): number {
    try {
        const raw = fs.readFileSync(BUILD_ID_FILE, 'utf8').trim();
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n > 0) return n;
    } catch { /* no stamp yet — fall through */ }
    try { return Math.round(fs.statSync(SELF).mtimeMs); } catch { return 0; }
}

// Captured once, at startup — the build THIS process is running.
const RUNNING_BUILD = readBuildStamp();

let pkgVersion = '?';
try {
    pkgVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')).version || '?';
} catch { /* best-effort */ }

export function engineVersion() {
    const onDisk = readBuildStamp();
    return {
        version: pkgVersion,
        running_build: RUNNING_BUILD,
        on_disk_build: onDisk,
        running_build_at: RUNNING_BUILD ? new Date(RUNNING_BUILD).toISOString() : null,
        on_disk_build_at: onDisk ? new Date(onDisk).toISOString() : null,
        update_available: onDisk > RUNNING_BUILD + 1000, // >1s newer = a rebuild happened
        uptime_seconds: Math.round(process.uptime()),
        latest_update: latestNote(), // { date, title, notes[] } for the "what's new" panel
    };
}
