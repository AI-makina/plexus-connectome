import { PlexusManifest } from '../types';

let integrationPath: string | null = null;
let targetPath: string | null = null;
let manifest: PlexusManifest | null = null;

export function setContext(integration: string, target: string) {
    integrationPath = integration;
    targetPath = target;
}

export function getIntegrationPath(): string {
    if (!integrationPath) throw new Error('Context not initialized. Call setContext() first.');
    return integrationPath;
}

export function getTargetPath(): string {
    if (!targetPath) throw new Error('Context not initialized. Call setContext() first.');
    return targetPath;
}

export function setManifest(m: PlexusManifest) {
    manifest = m;
}

export function getManifest(): PlexusManifest | null {
    return manifest;
}
