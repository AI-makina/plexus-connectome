import React, { useEffect, useState } from 'react';
import { usePlexus } from './hooks/usePlexus';
import NetworkGraph from './components/NetworkGraph';
import UIOverlay from './components/UIOverlay';
import ResolutionsPanel from './components/ResolutionsPanel';
import EngineUpdateBadge from './components/EngineUpdateBadge';
import ErrorBoundary from './ErrorBoundary';
import { LogoMark } from './components/Brand';

const BOOT_STATUS = ['INDEXING NODES…', 'MAPPING SYNAPSES…', 'RESOLVING REGIONS…'];

function LoadingScreen() {
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStatusIdx(i => (i + 1) % BOOT_STATUS.length), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-ink-1">
      <div className="flex flex-col items-center">
        <LogoMark size={28} className="text-text-hi" />
        <span className="wordmark mt-4">Plexus</span>
        <span className="micro-label mt-1.5">Connectome Engine</span>
        <div className="mt-6 h-[2px] w-[160px] overflow-hidden rounded-full bg-line">
          <div className="loading-sweep h-full w-[48px] bg-text-hi opacity-60" />
        </div>
        <span className="readout mt-4 text-[11px] text-text-lo">{BOOT_STATUS[statusIdx]}</span>
      </div>
    </div>
  );
}

function App() {
  const plexus = usePlexus();

  if (plexus.loading && (!plexus?.data?.nodes || plexus.data.nodes.length === 0)) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <div className="relative h-screen w-screen overflow-hidden bg-ink-1">
        {/* 3D Canvas Layer */}
        <div className="absolute inset-0 z-0">
          <NetworkGraph plexus={plexus} />
        </div>

        {/* Vignette — free depth between canvas and overlay (DESIGN_SPEC §2.4) */}
        <div
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.45) 100%)' }}
        />

        {/* UI Overlay Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <UIOverlay plexus={plexus} />
          <ResolutionsPanel plexus={plexus} />
          <EngineUpdateBadge plexus={plexus} />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
