const { forceSimulation, forceLink } = require('d3-force-3d');
try {
  console.log("Testing empty array...");
  const sim = forceSimulation([])
    .force("link", forceLink([]).id(d => d.id));
  console.log("Success with empty array.");
} catch (e) {
  console.error("Crash:", e.message);
}
