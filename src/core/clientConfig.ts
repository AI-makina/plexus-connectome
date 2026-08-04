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

/** Write/refresh the auto-start task (<project>/.vscode/tasks.json): an automatic
 *  ("runOn": "folderOpen") task that starts the chosen AI CLI in the editor's own
 *  terminal the moment the project window opens — window + terminal + engaged AI
 *  in one click. Merge-aware (only "Plexus — " tasks are ever touched), backed up.
 *  aiBin=null removes the Plexus task (user chose "none"/built-in agent). */
export function writeProjectTask(projectPath: string, aiBin: string | null, aiLabel?: string): { wrote: boolean; removed?: boolean; file: string; error?: string } {
    const dir = path.join(projectPath, '.vscode');
    const file = path.join(dir, 'tasks.json');
    try {
        let config: any = { version: '2.0.0', tasks: [] };
        if (fs.existsSync(file)) {
            try { config = JSON.parse(fs.readFileSync(file, 'utf8')) || config; }
            catch { return { wrote: false, file, error: 'tasks.json exists but is not valid JSON — refusing to touch it' }; }
        }
        if (!Array.isArray(config.tasks)) config.tasks = [];
        const before = config.tasks.length;
        config.tasks = config.tasks.filter((t: any) => !(typeof t?.label === 'string' && t.label.startsWith('Plexus — ')));
        const hadPlexusTask = config.tasks.length !== before;
        if (!aiBin) {
            if (!hadPlexusTask) return { wrote: false, file };
            backupFile(file);
            fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
            return { wrote: true, removed: true, file };
        }
        fs.mkdirSync(dir, { recursive: true });
        backupFile(file);
        config.version = config.version || '2.0.0';
        config.tasks.push({
            label: `Plexus — start ${aiLabel || aiBin}`,
            type: 'shell',
            command: aiBin,
            runOptions: { runOn: 'folderOpen' },
            presentation: { echo: false, reveal: 'always', focus: true, panel: 'dedicated', showReuseMessage: false },
            problemMatcher: [],
        });
        fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
        return { wrote: true, file };
    } catch (e: any) {
        return { wrote: false, file, error: e.message };
    }
}

/** Per-project editor defaults (<project>/.vscode/settings.json): terminal panel
 *  on the RIGHT — the AI session sits beside the code instead of under it.
 *  Merge-aware and deferential: only sets the key when the user hasn't; an
 *  existing value (theirs) is never overridden. Applies to VS Code + forks. */
export function writeProjectEditorSettings(projectPath: string): { wrote: boolean; file: string; error?: string } {
    const dir = path.join(projectPath, '.vscode');
    const file = path.join(dir, 'settings.json');
    try {
        let config: any = {};
        if (fs.existsSync(file)) {
            try { config = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; }
            catch { return { wrote: false, file, error: 'settings.json exists but is not valid JSON — refusing to touch it' }; }
        }
        if (Object.prototype.hasOwnProperty.call(config, 'workbench.panel.defaultLocation')) {
            return { wrote: false, file }; // the user's choice stands
        }
        fs.mkdirSync(dir, { recursive: true });
        backupFile(file);
        config['workbench.panel.defaultLocation'] = 'right';
        fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
        return { wrote: true, file };
    } catch (e: any) {
        return { wrote: false, file, error: e.message };
    }
}

/** Write/refresh the Gemini CLI project plug (<project>/.gemini/settings.json).
 *  Same rules as .mcp.json: structural merge, only the plexus entry, backup,
 *  idempotent. Wired per Google's documented project-settings support — the
 *  ⬡ badge on a Gemini user's first session is the live confirmation. */
export function writeProjectGeminiSettings(projectPath: string): { wrote: boolean; file: string; error?: string } {
    const dir = path.join(projectPath, '.gemini');
    const file = path.join(dir, 'settings.json');
    try {
        let config: any = {};
        if (fs.existsSync(file)) {
            try { config = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; }
            catch { return { wrote: false, file, error: '.gemini/settings.json exists but is not valid JSON — refusing to touch it' }; }
        }
        const spec = plexusServerSpec();
        const desired = { command: spec.command, args: spec.args };
        const current = config?.mcpServers?.plexus;
        if (current && JSON.stringify(current) === JSON.stringify(desired)) return { wrote: false, file };
        fs.mkdirSync(dir, { recursive: true });
        backupFile(file);
        config.mcpServers = { ...(config.mcpServers || {}), plexus: desired };
        fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
        return { wrote: true, file };
    } catch (e: any) {
        return { wrote: false, file, error: e.message };
    }
}

/** All per-project plugs in one call — every client with a project surface. */
export function writeProjectPlugs(projectPath: string): { claude: ReturnType<typeof writeProjectMcpJson>; gemini: ReturnType<typeof writeProjectGeminiSettings>; settings_heal: ReturnType<typeof preflightClaudeSettings> } {
    return { claude: writeProjectMcpJson(projectPath), gemini: writeProjectGeminiSettings(projectPath), settings_heal: preflightClaudeSettings(projectPath) };
}

// ─── Claude settings self-heal ────────────────────────────────────────────────
// Claude Code hard-rejects legacy permission rules written as "Tool(prefix *)"
// (space-star; current syntax is "Tool(prefix:*)"), and one bad rule makes it
// skip the ENTIRE settings file — dropping that file's saved permission allows
// and MCP approvals — then die on an interactive error prompt when auto-started
// (observed on the first outside beta machine). The transform below is exactly
// the migration Claude's own error message prescribes, and the rules it touches
// are dead weight today (the whole file is being skipped), so applying it
// mechanically can only improve things. This is repair of the user's OWN rules,
// never registration: no Plexus config is ever added here. Files that fail to
// parse are reported, never guessed at.

const LEGACY_PERMISSION_RULE = /^([A-Za-z][\w-]*)\((.*\S)\s+\*\)$/;

function repairPermissionRules(config: any): number {
    const perms = config?.permissions;
    if (!perms || typeof perms !== 'object') return 0;
    let fixed = 0;
    for (const key of ['allow', 'deny', 'ask']) {
        const rules = perms[key];
        if (!Array.isArray(rules)) continue;
        for (let i = 0; i < rules.length; i++) {
            if (typeof rules[i] !== 'string') continue;
            const m = rules[i].match(LEGACY_PERMISSION_RULE);
            if (m) { rules[i] = `${m[1]}(${m[2]}:*)`; fixed++; }
        }
    }
    return fixed;
}

/** Repair one Claude settings file in place (backup kept beside it). Returns
 *  null when there is nothing to do (absent, empty, or already clean). */
export function repairClaudeSettingsFile(file: string): { file: string; fixed?: number; broken?: string } | null {
    let raw: string;
    try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
    let config: any;
    try { config = JSON.parse(raw); } catch { return { file, broken: 'not valid JSON — Claude will ignore this file until it is fixed' }; }
    if (!config || typeof config !== 'object') return null;
    const fixed = repairPermissionRules(config);
    if (!fixed) return null;
    try {
        fs.copyFileSync(file, `${file}.bak-plexus-repair`);
        fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
        return { file, fixed };
    } catch (e: any) {
        return { file, broken: e.message };
    }
}

/** Sweep every Claude settings file a launch would load (user + project scope)
 *  and repair the legacy-rule class. Called at action moments only — project
 *  open, the door, plug planting — never on passive dashboard refreshes. */
export function preflightClaudeSettings(projectPath?: string): { repaired: { file: string; fixed: number }[]; broken: { file: string; error: string }[] } {
    const candidates = [
        path.join(os.homedir(), '.claude', 'settings.json'),
        ...(projectPath ? [
            path.join(projectPath, '.claude', 'settings.json'),
            path.join(projectPath, '.claude', 'settings.local.json'),
        ] : []),
    ];
    const repaired: { file: string; fixed: number }[] = [];
    const broken: { file: string; error: string }[] = [];
    for (const f of candidates) {
        const r = repairClaudeSettingsFile(f);
        if (!r) continue;
        if (r.broken) broken.push({ file: r.file, error: r.broken });
        else repaired.push({ file: r.file, fixed: r.fixed! });
    }
    return { repaired, broken };
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
