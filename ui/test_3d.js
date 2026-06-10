import { forceSimulation, forceManyBody, forceCenter, forceLink } from "d3-force-3d";

console.log("Starting debug...");
try {
    let nodes = [{ id: 1, x: 0, y: 0, z: 10 }, { id: 2, x: 0, y: 0, z: -10 }];
    forceSimulation(nodes).numDimensions(3).tick(1);
    console.log("No forces Z:", nodes[0].z);

    nodes = [{ id: 1, x: 0, y: 0, z: 10 }, { id: 2, x: 0, y: 0, z: -10 }];
    forceSimulation(nodes).numDimensions(3).force("center", forceCenter()).tick(1);
    console.log("forceCenter Z:", nodes[0].z);

    nodes = [{ id: 1, x: 0, y: 0, z: 10 }, { id: 2, x: 0, y: 0, z: -10 }];
    forceSimulation(nodes).numDimensions(3).force("charge", forceManyBody()).tick(1);
    console.log("forceManyBody Z:", nodes[0].z);

    nodes = [{ id: 1, x: 0, y: 0, z: 10 }, { id: 2, x: 0, y: 0, z: -10 }];
    forceSimulation(nodes).numDimensions(3).force("link", forceLink([{ source: 1, target: 2 }]).id(d => d.id)).tick(1);
    console.log("forceLink Z:", nodes[0].z);
} catch (e) {
    console.error(e);
}
