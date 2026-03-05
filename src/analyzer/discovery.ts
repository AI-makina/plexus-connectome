import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getManifest } from '../core/context';

interface FileEntry {
    path: string;       // relative to target root
    absolutePath: string;
    fingerprint: string;
    size: number;
}

type FingerprintMap = Record<string, string>; // relative path → md5 hash

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

export function discoverFiles(targetPath: string): FileEntry[] {
    const manifest = getManifest();
    const ignorePatterns = manifest?.target_app.ignore_patterns || [
        'node_modules', '.next', '.git', 'dist', 'coverage', 'plexus-integration'
    ];

    // Load .gitignore patterns
    const gitignorePatterns = loadIgnoreFile(path.join(targetPath, '.gitignore'));
    // Load .plexusignore patterns
    const plexusIgnorePatterns = loadIgnoreFile(path.join(targetPath, '.plexusignore'));

    const allIgnore = [...ignorePatterns, ...gitignorePatterns, ...plexusIgnorePatterns];
    const files: FileEntry[] = [];

    walkDir(targetPath, targetPath, allIgnore, files);
    return files;
}

function walkDir(dir: string, rootPath: string, ignorePatterns: string[], results: FileEntry[]) {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        if (shouldIgnore(entry.name, relativePath, ignorePatterns)) continue;

        if (entry.isDirectory()) {
            walkDir(fullPath, rootPath, ignorePatterns, results);
        } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
            const content = fs.readFileSync(fullPath);
            const fingerprint = crypto.createHash('md5').update(content).digest('hex');
            results.push({
                path: relativePath,
                absolutePath: fullPath,
                fingerprint,
                size: content.length,
            });
        }
    }
}

function shouldIgnore(name: string, relativePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
        if (!pattern || pattern.startsWith('#')) continue;
        // Direct name match
        if (name === pattern) return true;
        // Glob wildcard match (simple)
        if (pattern.startsWith('*.') && name.endsWith(pattern.slice(1))) return true;
        // Path contains pattern
        if (relativePath.includes(pattern)) return true;
    }
    return false;
}

function loadIgnoreFile(filePath: string): string[] {
    try {
        if (!fs.existsSync(filePath)) return [];
        return fs.readFileSync(filePath, 'utf8')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#'));
    } catch {
        return [];
    }
}

// ─── Fingerprint persistence ─────────────────────────────────────

export function saveFingerprints(integrationPath: string, files: FileEntry[]) {
    const map: FingerprintMap = {};
    for (const f of files) {
        map[f.path] = f.fingerprint;
    }
    fs.writeFileSync(
        path.join(integrationPath, 'fingerprints.json'),
        JSON.stringify(map, null, 2)
    );
}

export function loadFingerprints(integrationPath: string): FingerprintMap {
    const fp = path.join(integrationPath, 'fingerprints.json');
    if (!fs.existsSync(fp)) return {};
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch {
        return {};
    }
}

export function getChangedFiles(files: FileEntry[], oldFingerprints: FingerprintMap): { added: FileEntry[]; modified: FileEntry[]; removed: string[] } {
    const currentPaths = new Set(files.map(f => f.path));
    const oldPaths = new Set(Object.keys(oldFingerprints));

    const added: FileEntry[] = [];
    const modified: FileEntry[] = [];
    const removed: string[] = [];

    for (const f of files) {
        if (!oldPaths.has(f.path)) {
            added.push(f);
        } else if (oldFingerprints[f.path] !== f.fingerprint) {
            modified.push(f);
        }
    }

    for (const p of oldPaths) {
        if (!currentPaths.has(p)) {
            removed.push(p);
        }
    }

    return { added, modified, removed };
}
