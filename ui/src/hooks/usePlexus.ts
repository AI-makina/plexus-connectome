import { useState, useEffect } from 'react';
import axios from 'axios';

export interface PlexusData {
    nodes: any[];
    synapses: any[];
    amygdala: any[];
}

export function usePlexus() {
    const [data, setData] = useState<PlexusData>({ nodes: [], synapses: [], amygdala: [] });
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState<any | null>(null);
    const [selectedSynapse, setSelectedSynapse] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDormant, setShowDormant] = useState(false);
    const [simulationResult, setSimulationResult] = useState<any | null>(null);
    const [simulationTimestamp, setSimulationTimestamp] = useState<number | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [nodes, synapses, amygdala] = await Promise.all([
                axios.get('http://localhost:3200/api/nodes'),
                axios.get('http://localhost:3200/api/synapses'),
                axios.get('http://localhost:3200/api/amygdala')
            ]);
            setData({
                nodes: Array.isArray(nodes.data) ? nodes.data : [],
                synapses: Array.isArray(synapses.data) ? synapses.data : [],
                amygdala: Array.isArray(amygdala.data) ? amygdala.data : []
            });
        } catch (e) {
            console.error("Failed to fetch Plexus data", e);
        } finally {
            setLoading(false);
        }
    };

    const runSimulation = async (nodeId: string) => {
        try {
            const res = await axios.post('http://localhost:3200/api/simulate/impact', {
                node_ids: [nodeId],
                change_type: 'modify'
            });
            setSimulationResult(res.data);
            setSimulationTimestamp(Date.now());
        } catch (e) {
            console.error("Simulation failed", e);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return {
        data,
        loading,
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
        refresh: fetchData
    };
}
