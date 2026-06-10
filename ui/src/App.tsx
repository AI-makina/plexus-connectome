import React from 'react';
import { usePlexus } from './hooks/usePlexus';
import NetworkGraph from './components/NetworkGraph';
import UIOverlay from './components/UIOverlay';
import ErrorBoundary from './ErrorBoundary';

function App() {
  const plexus = usePlexus();

  if (plexus.loading && (!plexus?.data?.nodes || plexus.data.nodes.length === 0)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-frontal border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-white/70 tracking-widest text-sm uppercase">Booting Plexus Connectome</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="relative h-screen w-screen overflow-hidden bg-background">
        {/* 3D Canvas Layer */}
        <div className="absolute inset-0 z-0">
          <NetworkGraph plexus={plexus} />
        </div>

        {/* UI Overlay Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <UIOverlay plexus={plexus} />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
