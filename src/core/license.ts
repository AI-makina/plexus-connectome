import fs from 'fs';
import os from 'os';
import path from 'path';
import { isOperator } from './edition';
import { fleetPost } from './fleet';

// ─── License store + heartbeat (user edition) ────────────────────────────────
// The entitlement abstraction: the app asks "is this install entitled?" and the
// verifier behind the fleet API answers — invite code today, App Store receipt
// later, same gate. Grace covers NETWORK failure only (14 days from the last
// successful check); an explicit inactive/expired from the server takes effect
// immediately. Deactivation degrades, never destroys: engines and brains keep
// working locally — only the launcher's doors close. Data is never hostage.

const FILE = path.join(os.homedir(), '.plexus', 'license.json');
const GRACE_DAYS = 14;

export interface License {
    token: string;
    email: string;
    name: string;
    status: 'active' | 'inactive' | 'expired';
    kind: 'trial' | 'paid' | 'promo' | 'beta';
    plan?: string;
    trial_ends?: string;
    share_ai_ok?: boolean;
    marketing_ok?: boolean;
    terms_accepted_at?: string;
    activated_at?: string;
    last_ok?: string;       // last successful heartbeat
    last_msg?: string;      // operator-facing message from the fleet (e.g. why inactive)
    ai_forwarded_until?: string; // AI-feedback forwarding high-water mark
}

export function readLicense(): License | null {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; }
}

export function saveLicense(lic: License): void {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(lic, null, 2));
}

export type LicenseState =
    | { state: 'operator' }
    | { state: 'unactivated' }
    | { state: 'active'; lic: License }
    | { state: 'grace'; lic: License; days_left: number }
    | { state: 'inactive'; lic: License; reason: 'denied' | 'expired' | 'unreachable' };

export function licenseState(): LicenseState {
    if (isOperator()) return { state: 'operator' };
    const lic = readLicense();
    if (!lic?.token) return { state: 'unactivated' };
    if (lic.status === 'inactive') return { state: 'inactive', lic, reason: 'denied' };
    if (lic.status === 'expired') return { state: 'inactive', lic, reason: 'expired' };
    // status says active — how stale is our proof?
    const lastOk = lic.last_ok ? new Date(lic.last_ok).getTime() : 0;
    const staleDays = (Date.now() - lastOk) / 86_400_000;
    if (!lastOk || staleDays < 1) return { state: 'active', lic };
    if (staleDays < GRACE_DAYS) return { state: 'grace', lic, days_left: Math.max(1, Math.ceil(GRACE_DAYS - staleDays)) };
    return { state: 'inactive', lic, reason: 'unreachable' };
}

function appVersion(): string {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')).version || '0'; }
    catch { return '0'; }
}

export async function activate(input: {
    code: string; name: string; email: string;
    heard_from?: string; marketing_ok?: boolean; share_ai_ok?: boolean;
}): Promise<{ ok: boolean; error?: string; lic?: License }> {
    const r = await fleetPost('/api/plexus/activate', {
        ...input,
        platform: process.platform,
        app_version: appVersion(),
    }, 12_000);
    if (r?.error || !r?.token) return { ok: false, error: r?.error || 'activation failed' };
    const now = new Date().toISOString();
    const lic: License = {
        token: r.token,
        email: input.email, name: input.name,
        status: r.license?.status || 'active',
        kind: r.license?.kind || 'trial',
        plan: r.license?.plan,
        trial_ends: r.license?.trial_ends,
        share_ai_ok: !!input.share_ai_ok,
        marketing_ok: !!input.marketing_ok,
        terms_accepted_at: now,
        activated_at: now,
        last_ok: now,
    };
    saveLicense(lic);
    return { ok: true, lic };
}

/** One heartbeat. Counts are handed in by the caller (launcher) so this module
 *  stays free of registry imports. Fire-and-forget safe. */
export async function heartbeat(counts: { connectomes: number; engines: string[] }): Promise<LicenseState> {
    if (isOperator()) return { state: 'operator' };
    const lic = readLicense();
    if (!lic?.token) return { state: 'unactivated' };
    const r = await fleetPost('/api/plexus/heartbeat', {
        token: lic.token,
        app_version: appVersion(),
        platform: process.platform,
        connectomes: counts.connectomes,
        engines: counts.engines.slice(0, 12),
    });
    if (r?.offline) return licenseState(); // network failure → grace math decides
    if (r?.status) {
        lic.status = r.status === 'active' ? 'active' : (r.status === 'expired' ? 'expired' : 'inactive');
        lic.kind = r.kind || lic.kind;
        lic.trial_ends = r.trial_ends ?? lic.trial_ends;
        lic.last_msg = r.message || undefined;
        if (lic.status === 'active') lic.last_ok = new Date().toISOString();
        saveLicense(lic);
    }
    return licenseState();
}
