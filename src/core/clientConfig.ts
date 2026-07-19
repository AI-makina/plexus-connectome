import fs from 'fs';
import os from 'os';
import path from 'path';

// ─── Per-project AI-client plug writers (Integration v2) ──────────────────────
// The plug travels WITH the project: genesis/connect writes the client's own
// per-project MCP config into the project folder, so any session anchored there
// (root or subfolder — verified on Claude Code 2.1.214) loads Plexus, and
// sessions anywhere else contain none of it. Rules, non-negotiable:
//   · structural merge — only the `plexus` entry is ever touched
//   · a backup is written before every modification
//   · registrations point at the stable shim, never inside an install location

const SHIM = path.join(os.homedir(), '.plexus', 'bin', 'plexus');

export function plexusServerSpec(): { command: string; args: string[] } {
    // Shim preferred (survives app moves/updates). Fallback: current runtime + cli
    // for machines where the launcher (which writes the shim) never ran.
    if (process.platform !== 'win32' && fs.existsSync(SHIM)) return { command: SHIM, args: ['mcp'] };
    return { command: process.execPath, args: [path.join(__dirname, '..', 'cli.js'), 'mcp'] };
}

/** The copyable door line for a project (paste in a terminal, not into an AI chat). */
export function workCommand(projectName: string): string {
    const bin = (process.platform !== 'win32' && fs.existsSync(SHIM)) ? SHIM : 'plexus';
    return `"${bin}" work "${projectName}"`;
}

function backupFile(file: string): void {
    try { if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak-plexus`); } catch { /* best-effort */ }
}

/** Write/refresh the Claude Code project plug (<project>/.mcp.json). Merge-aware, backed up, idempotent. */
export function writeProjectMcpJson(projectPath: string): { wrote: boolean; file: string; error?: string } {
    const file = path.join(projectPath, '.mcp.json');
    try {
        let config: any = {};
        if (fs.existsSync(file)) {
            try { config = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; }
            catch { return { wrote: false, file, error: '.mcp.json exists but is not valid JSON — refusing to touch it' }; }
        }
        const spec = plexusServerSpec();
        const desired = { type: 'stdio', command: spec.command, args: spec.args };
        const current = config?.mcpServers?.plexus;
        if (current && JSON.stringify(current) === JSON.stringify(desired)) return { wrote: false, file };
        backupFile(file);
        config.mcpServers = { ...(config.mcpServers || {}), plexus: desired };
        fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
        return { wrote: true, file };
    } catch (e: any) {
        return { wrote: false, file, error: e.message };
    }
}
