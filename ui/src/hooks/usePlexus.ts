import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { REGIONS } from '../theme/regions';

// Derive API URL from current window location
// UI runs on ws_port, API runs on ws_port - 1
const currentPort = parseInt(window.location.port, 10) || 3201;
export const API_BASE = `http://localhost:${currentPort - 1}`;

// Evidence Protocol 0.1: mutating calls (simulate, dormant, …) require the
// per-boot session token. The UI is a local same-machine origin, so it may
// read GET /api/session; fetched once, then attached to every axios request.
let sessionTokenPromise: Promise<void> | null = null;
function ensureSessionToken(): Promise<void> {
    if (!sessionTokenPromise) {
        sessionTokenPromise = axios
            .get(`${API_BASE}/api/session`)
            .then(res => {
                if (res.data?.token) {
                    axios.defaults.headers.common['x-plexus-token'] = res.data.token;
                }
            })
            .catch(() => {
                sessionTokenPromise = null; // engine down — retry on next fetch
            });
    }
    return sessionTokenPromise;
}

// The token is per-BOOT: after an engine restart the cached one 401s forever
// while GET polling keeps succeeding (reads are tokenless), silently masking
// the breakage. On any 401 from the API: drop the cached token, refetch it,
// and replay the failed request exactly once.
axios.interceptors.response.use(undefined, async (error) => {
    const cfg = error?.config;
    if (
        error?.response?.status === 401 &&
        cfg && !cfg._plexusRetried &&
        typeof cfg.url === 'string' && cfg.url.startsWith(API_BASE)
    ) {
        sessionTokenPromise = null;
        delete axios.defaults.headers.common['x-plexus-token'];
        await ensureSessionToken();
        cfg._plexusRetried = true;
        cfg.headers = { ...cfg.headers, 'x-plexus-token': axios.defaults.headers.common['x-plexus-token'] };
        return axios.request(cfg);
    }
    return Promise.reject(error);
});

// Auto-retry backoff ladder (DESIGN_SPEC §5.13): 2s → 5s → 10s → 30s cap.
const BACKOFF_STEPS = [2, 5, 10, 30];

export interface PlexusData {
    nodes: any[];
    synapses: any[];
    amygdala: any[];
    resolutions: any[];
}

// Which brain is this tab looking at? `name` is the resolved display label
// (visualization.display_name override, else target_app.name). Renaming is
// display-only — structural identity (path, registry, receipts) never moves.
export interface ProjectIdentity {
    name: string;
    app_name: string;
    display_name: string | null;
    root_path: string | null;
}

export function usePlexus() {
    const [data, setData] = useState<PlexusData>({ nodes: [], synapses: [], amygdala: [], resolutions: [] });
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState<any | null>(null);
    const [selectedSynapse, setSelectedSynapse] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDormant, setShowDormant] = useState(false);
    const [simulationResult, setSimulationResult] = useState<any | null>(null);
    const [simulationTimestamp, setSimulationTimestamp] = useState<number | null>(null);
    const [project, setProject] = useState<ProjectIdentity | null>(null);
    const [engineVersion, setEngineVersion] = useState<any | null>(null);

    // Region filter (DESIGN_SPEC §5.7) — independent of showDormant to avoid
    // combinatorial filter bugs. Empty Set = all regions visible.
    const [hiddenRegions, setHiddenRegions] = useState<Set<string>>(new Set());

    // Engine reachability (DESIGN_SPEC §5.13).
    const [error, setError] = useState<string | null>(null);   // initial-load failure (no data yet)
    const [linkLost, setLinkLost] = useState(false);           // failure after data had loaded
    const [retryIn, setRetryIn] = useState<number | null>(null); // seconds until next auto-retry

    const hasDataRef = useRef(false);
    const failCountRef = useRef(0);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fetchRef = useRef<() => void>(() => { });

    const clearCountdown = () => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
    };

    // Backoff 2s → 5s → 10s → 30s cap, ticking a 1s countdown for the banner.
    const scheduleRetry = () => {
        failCountRef.current += 1;
        const delay = BACKOFF_STEPS[Math.min(failCountRef.current - 1, BACKOFF_STEPS.length - 1)];
        clearCountdown();
        let remaining = delay;
        setRetryIn(remaining);
        countdownRef.current = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearCountdown();
                setRetryIn(null);
                fetchRef.current();
            } else {
                setRetryIn(remaining);
            }
        }, 1000);
    };

    const handleFetchFailure = (e: any) => {
        if (hasDataRef.current) {
            setLinkLost(true); // had data → slim ENGINE LINK LOST banner
        } else {
            setError(e?.message || 'Connection failed'); // no data yet → full-screen card
        }
        scheduleRetry();
    };

    const fetchData = async () => {
        clearCountdown();
        setRetryIn(null);
        try {
            // Don't flip the boot screen / unreachable card during background auto-retries.
            if (failCountRef.current === 0) setLoading(true);
            await ensureSessionToken();
            const [nodes, synapses, amygdala, resolutions] = await Promise.all([
                axios.get(`${API_BASE}/api/nodes`),
                axios.get(`${API_BASE}/api/synapses`),
                axios.get(`${API_BASE}/api/amygdala`),
                // non-fatal: an older engine without /api/resolutions just shows none
                axios.get(`${API_BASE}/api/resolutions`).catch(() => ({ data: [] })),
            ]);
            setData({
                nodes: Array.isArray(nodes.data) ? nodes.data : [],
                synapses: Array.isArray(synapses.data) ? synapses.data : [],
                amygdala: Array.isArray(amygdala.data) ? amygdala.data : [],
                resolutions: Array.isArray(resolutions.data) ? resolutions.data : []
            });
            hasDataRef.current = true;
            failCountRef.current = 0;
            setError(null);
            setLinkLost(false);
            // Identity chip is non-fatal: an older engine without /api/project
            // must not trip the ENGINE LINK LOST banner — the chip just hides.
            try {
                const p = await axios.get(`${API_BASE}/api/project`);
                if (p.data?.name) setProject(p.data);
            } catch { /* chip hidden */ }
            // Engine self-update signal (non-fatal: old engines lack the route)
            try {
                const ev = await axios.get(`${API_BASE}/api/engine/version`);
                setEngineVersion(ev.data);
            } catch { setEngineVersion(null); }
        } catch (e) {
            console.error("Failed to fetch Plexus data", e);
            handleFetchFailure(e);
        } finally {
            setLoading(false);
        }
    };
    fetchRef.current = fetchData;

    const retryNow = () => {
        fetchData(); // clears any pending countdown itself
    };

    // Bring this connectome onto the latest build. The engine re-execs; the link
    // drops briefly, then the normal retry loop reconnects on the new code.
    const restartEngine = async () => {
        await ensureSessionToken();
        try { await axios.post(`${API_BASE}/api/engine/restart`, {}); } catch { /* engine exits mid-response */ }
        setLinkLost(true);
        setTimeout(() => fetchData(), 2500); // give the child time to bind, then reconnect
    };

    const runSimulation = async (nodeId: string) => {
        try {
            await ensureSessionToken();
            const res = await axios.post(`${API_BASE}/api/simulate/impact`, {
                node_ids: [nodeId],
                change_type: 'modify'
            });
            setSimulationResult(res.data);
            setSimulationTimestamp(Date.now());
        } catch (e) {
            console.error("Simulation failed", e);
            if (hasDataRef.current) {
                setLinkLost(true);
                scheduleRetry();
            }
        }
    };

    // Display-only rename (PUT is token-guarded; interceptor replays on 401).
    // null / empty clears the override back to target_app.name.
    const renameProject = async (displayName: string | null) => {
        await ensureSessionToken();
        const res = await axios.put(`${API_BASE}/api/project/display-name`, { display_name: displayName });
        if (res.data?.name) setProject(res.data);
        return res.data as ProjectIdentity;
    };

    // §5.7 — click toggles region visibility.
    const toggleRegion = (region: string) => {
        setHiddenRegions(prev => {
            const next = new Set(prev);
            if (next.has(region)) next.delete(region);
            else next.add(region);
            return next;
        });
    };

    // §5.7 — ⌥-click solos a region (hides all others); soloing the lone
    // visible region resets to all visible.
    const soloRegion = (region: string) => {
        setHiddenRegions(prev => {
            const all = Object.keys(REGIONS);
            const visible = all.filter(r => !prev.has(r));
            if (visible.length === 1 && visible[0] === region) return new Set<string>();
            return new Set(all.filter(r => r !== region));
        });
    };

    const resetRegions = () => setHiddenRegions(new Set<string>());

    useEffect(() => {
        fetchRef.current();
        return clearCountdown;
    }, []);

    return {
        data,
        loading,
        engineVersion,
        restartEngine,
        selectedNode,
        setSelectedNode,
        searchQuery,
        setSearchQuery,
        showDormant,
        setShowDormant,
        simulationResult,
        setSimulationResult,
        simulationTimestamp,
        setSimulationTimestamp,
        selectedSynapse,
        setSelectedSynapse,
        runSimulation,
        refresh: fetchData,
        project,
        renameProject,
        // §5.7 region filter
        hiddenRegions,
        toggleRegion,
        soloRegion,
        resetRegions,
        // §5.13 engine reachability
        error,
        linkLost,
        retryIn,
        retryNow
    };
}
