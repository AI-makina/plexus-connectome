import React from 'react';
import { Search, Info, Activity, AlertTriangle, Play, Eye, EyeOff } from 'lucide-react';

const REGION_COLORS: Record<string, string> = {
    frontal_lobe: '#0066FF',
    temporal_lobe: '#FFB800',
    occipital_lobe: '#FF00AA',
    parietal_lobe: '#00CC66',
    cerebellum: '#8800FF',
    brain_stem: '#8899AA',
    limbic_system: '#FF6B4A',
    amygdala: '#FF0033',
    corpus_callosum: '#FFFFFF'
};

export default function UIOverlay({ plexus }: any) {
    const { selectedNode, simulationResult, runSimulation } = plexus;

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between">

            {/* Top Bar: Search & Status */}
            <div className="p-4 flex justify-between items-start pointer-events-auto">
                <div className="glass-panel rounded-lg p-2 flex items-center w-80">
                    <Search size={18} className="text-white/50 mx-2" />
                    <input
                        type="text"
                        placeholder="Search nodes or code (Cmd+K)"
                        value={plexus.searchQuery || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            plexus.setSearchQuery(val);
                            if (val.length > 2) {
                                const matchNode = plexus.data?.nodes?.find((n: any) =>
                                    n.code?.toLowerCase() === val.toLowerCase() ||
                                    n.name.toLowerCase().includes(val.toLowerCase())
                                );
                                if (matchNode) {
                                    plexus.setSelectedNode(matchNode);
                                    plexus.setSelectedSynapse(null);
                                    return;
                                }
                                const matchSynapse = plexus.data?.synapses?.find((s: any) =>
                                    s.code?.toLowerCase() === val.toLowerCase()
                                );
                                if (matchSynapse) {
                                    plexus.setSelectedSynapse(matchSynapse);
                                    plexus.setSelectedNode(null);
                                    return;
                                }
                            }
                        }}
                        className="bg-transparent border-none text-white focus:outline-none flex-1 text-sm placeholder:text-white/30"
                    />
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => plexus.setShowDormant(!plexus.showDormant)}
                        className={`glass-panel px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors ${plexus.showDormant ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
                    >
                        {plexus.showDormant ? <Eye size={16} /> : <EyeOff size={16} />}
                        DORMANT
                    </button>

                    <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-white/50 uppercase tracking-wider">Nodes</span>
                            <span className="font-mono text-sm">{plexus?.data?.nodes?.length || 0}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-white/50 uppercase tracking-wider">Synapses</span>
                            <span className="font-mono text-sm">{plexus?.data?.synapses?.length || 0}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-white/50 uppercase tracking-wider">Warnings</span>
                            <span className="font-mono text-sm text-red-500">{plexus?.data?.amygdala?.length || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex justify-between items-start p-4 overflow-hidden">

                {/* Left Bar: Regions Legend */}
                <div className="glass-panel w-64 rounded-xl p-4 flex flex-col gap-2 pointer-events-auto max-h-[80vh] overflow-y-auto">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2">
                        <Activity size={14} /> Brain Regions
                    </h3>
                    {Object.entries(REGION_COLORS).map(([r, color]) => (
                        <div key={r} className="flex items-center gap-3 py-1.5 hover:bg-white/5 px-2 rounded cursor-pointer transition-colors">
                            <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: color, boxShadow: "0 0 8px " + color }} />
                            <span className="text-xs font-medium capitalize flex-1">{r.replace('_', ' ')}</span>
                        </div>
                    ))}
                </div>

                {/* Right Bar: Node Inspector */}
                {selectedNode ? (
                    <div className="glass-panel w-80 rounded-xl flex flex-col pointer-events-auto shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto animate-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="p-4 border-b border-white/10" style={{ borderTop: "4px solid " + REGION_COLORS[selectedNode.region] }}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 uppercase font-bold tracking-wider">{selectedNode.type}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full text-white/70 capitalize" style={{ backgroundColor: REGION_COLORS[selectedNode.region] + "33" }}>{selectedNode.region.replace('_', ' ')}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 uppercase font-mono tracking-wider">{selectedNode.code}</span>
                                {selectedNode.status === 'dormant' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 uppercase font-bold tracking-wider border border-red-500/30">DORMANT</span>
                                )}
                            </div>
                            <h2 className="text-lg font-bold truncate" title={selectedNode.name}>{selectedNode.name}</h2>
                            <p className="text-xs text-white/50 font-mono mt-1 truncate" title={selectedNode.file_path}>{selectedNode.file_path}</p>
                        </div>

                        {/* Body */}
                        <div className="p-4 flex-1 flex flex-col gap-4">
                            {selectedNode.status === 'dormant' && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-200">
                                    <strong className="block mb-1 text-red-400">Dormant Reason:</strong>
                                    {selectedNode.dormant_reason}
                                </div>
                            )}
                            <div className="text-sm text-white/80 leading-relaxed">
                                {selectedNode.description}
                            </div>

                            {/* Simulation Action */}
                            <button
                                onClick={() => runSimulation(selectedNode.id)}
                                className="w-full py-2 bg-white/10 hover:bg-white/20 rounded border border-white/20 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                                <Play size={14} /> Simulate Impact
                            </button>
                        </div>
                    </div>
                ) : plexus.selectedSynapse ? (
                    <div className="glass-panel w-80 rounded-xl flex flex-col pointer-events-auto shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto animate-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="p-4 border-b border-white/10" style={{ borderTop: "4px solid #888" }}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 uppercase font-bold tracking-wider">SYNAPSE</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 uppercase font-mono tracking-wider">{plexus.selectedSynapse.code}</span>
                                {plexus.selectedSynapse.status === 'dormant' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 uppercase font-bold tracking-wider border border-red-500/30">DORMANT</span>
                                )}
                            </div>
                            <h2 className="text-lg font-bold truncate">Connection</h2>
                        </div>
                        {/* Body */}
                        <div className="p-4 flex-1 flex flex-col gap-4">
                            <div className="text-sm text-white/80 leading-relaxed">
                                {plexus.selectedSynapse.description}
                            </div>

                            <div className="bg-white/5 p-3 rounded text-sm mt-2">
                                <strong className="block mb-2 text-white/50 uppercase tracking-widest text-[10px]">Impact Analysis</strong>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-white/70">Classification</span>
                                    <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded ${plexus.selectedSynapse.metadata?.impact_classification === 'critical' ? 'bg-red-500/20 text-red-500' :
                                        plexus.selectedSynapse.metadata?.impact_classification === 'high' ? 'bg-orange-500/20 text-orange-500' :
                                            plexus.selectedSynapse.metadata?.impact_classification === 'moderate' ? 'bg-yellow-500/20 text-yellow-500' :
                                                'bg-white/10 text-white/70'
                                        }`}>
                                        {plexus.selectedSynapse.metadata?.impact_classification || 'low'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-white/70">Final Strength</span>
                                    <span className="font-mono text-white">{(plexus.selectedSynapse.strength || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-white/70">Intrinsic Weight</span>
                                    <span className="font-mono text-white/70">{(plexus.selectedSynapse.metadata?.intrinsic_importance || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white/70">Cascade Influence</span>
                                    <span className="font-mono text-white/70">{(plexus.selectedSynapse.metadata?.cascade_influence || 0)} deps</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

            </div>

            {/* Bottom Bar: Simulation Results */}
            {simulationResult && (
                <div className="pointer-events-auto p-4 flex justify-center w-full">
                    <div className="glass-panel rounded-xl p-4 w-full max-w-4xl border-t-2" style={{ borderColor: simulationResult.risk_score > 0.7 ? '#ef4444' : simulationResult.risk_score > 0.4 ? '#eab308' : '#3b82f6' }}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Activity size={20} /> Impact Simulation Analysis
                                </h3>
                                <p className="text-sm text-white/60 mt-1">{simulationResult.recommendation}</p>
                            </div>
                            <button
                                onClick={() => plexus.setSimulationResult(null)}
                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded">
                                Clear
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="bg-white/5 p-3 rounded">
                                <div className="text-xs text-white/50 mb-1">Risk Score</div>
                                <div className="text-2xl font-mono">{(simulationResult.risk_score * 10).toFixed(1)}/10</div>
                            </div>
                            <div className="bg-white/5 p-3 rounded">
                                <div className="text-xs text-white/50 mb-1">Affected Nodes</div>
                                <div className="text-2xl font-mono">{simulationResult.total_affected}</div>
                            </div>
                            <div className="bg-white/5 p-3 rounded">
                                <div className="text-xs text-white/50 mb-1">Critical Impact</div>
                                <div className="text-2xl font-mono text-red-500">{(simulationResult?.blast_radius || []).filter((b: any) => b.impact_level === 'critical').length}</div>
                            </div>
                            <div className="bg-white/5 p-3 rounded">
                                <div className="text-xs text-white/50 mb-1">Amygdala Alerts</div>
                                <div className="text-2xl font-mono text-orange-500 flex items-center gap-2">
                                    <AlertTriangle size={18} /> {simulationResult.amygdala_alerts}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
