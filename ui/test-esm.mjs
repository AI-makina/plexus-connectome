import { forceSimulation, forceLink } from 'd3-force-3d';
try {
  console.log("Testing with objects...");
  const sim = forceSimulation([{id: 1}, {id: 2}])
    .force("link", forceLink([{source: 1, target: 2}]).id(d => d.id));
  console.log("Success with objects.");
} catch (e) {
  console.error("Crash:", e.message);
  console.error(e.stack);
}
