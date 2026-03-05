# Plexus — Nudge App Analysis Prompt

Use this prompt in Gemini to have it operate Plexus against the Nudge app.

---

## Prompt

You are working with **Plexus**, a neural connectome engine that maps codebases into a brain-inspired graph. Plexus is already built and compiled at:

```
/Users/carlosmario/Desktop/Codes/Apps/plexus
```

Your target app is **Nudge v1.0**, located at:

```
/Users/carlosmario/Desktop/Codes/Apps/Nudge v1.0 Gemini
```

### About the Target App (Nudge)

Nudge is a visual HTML editor overlay tool. Key facts:
- **Stack**: Vanilla JavaScript (no framework, no build step)
- **Runtime**: Node.js with built-in `http` module
- **Dependencies**: cheerio, jsdom, puppeteer, ws
- **Entry point**: `server.js` (proxy + static server on port 3333)
- **Main client file**: `nudge-inject.js` (~192KB, editor overlay + client logic)
- **Test files**: 50+ test-*.js files for edge cases
- **Test site**: `test-site/` folder with HTML fixtures
- **Architecture**: Browser (:3333) <-> Nudge Server <-> Dev Server (:3000) or Static Files

### Step 1: Initialize Plexus on Nudge

First, remove the stale integration folder and re-initialize:

```bash
rm -rf "/Users/carlosmario/Desktop/Codes/Apps/Nudge v1.0 Gemini/plexus-integration"

node "/Users/carlosmario/Desktop/Codes/Apps/plexus/dist/cli.js" init \
  -t "/Users/carlosmario/Desktop/Codes/Apps/Nudge v1.0 Gemini" \
  -n "Nudge"
```

After init, open the generated manifest and update it for this vanilla JS project:

**File**: `/Users/carlosmario/Desktop/Codes/Apps/Nudge v1.0 Gemini/plexus-integration/plexus-manifest.json`

Update these fields:
```json
{
  "target_app": {
    "name": "Nudge",
    "languages": ["javascript"],
    "frameworks": ["node", "vanilla"],
    "entry_points": ["server.js", "nudge-inject.js"],
    "ignore_patterns": ["node_modules", ".git", "dist", "plexus-integration", "flyer-mockup", "package-lock.json"]
  },
  "regions": {
    "classification_hints": {
      "server": "parietal_lobe",
      "nudge-inject": "occipital_lobe",
      "test-site": "cerebellum",
      "test-": "cerebellum"
    }
  }
}
```

### Step 2: Analyze the Codebase

```bash
node "/Users/carlosmario/Desktop/Codes/Apps/plexus/dist/cli.js" analyze \
  -p "/Users/carlosmario/Desktop/Codes/Apps/Nudge v1.0 Gemini"
```

This will scan all .js/.ts files, build the connectome (nodes for functions/classes/modules, synapses for imports/calls/renders), and save everything to the SQLite DB and `plexus-state.json`.

### Step 3: Start the Plexus Server

```bash
node "/Users/carlosmario/Desktop/Codes/Apps/plexus/dist/index.js" \
  "/Users/carlosmario/Desktop/Codes/Apps/Nudge v1.0 Gemini"
```

This starts:
- **API** on `http://localhost:3200`
- **3D Visualization UI** on `http://localhost:3201` (auto-opens browser)

### Step 4: Explore via API

Once the server is running, query the connectome:

```bash
# See all nodes (functions, modules, classes, components)
curl http://localhost:3200/api/nodes

# See all connections between nodes
curl http://localhost:3200/api/synapses

# See brain regions and their stats
curl http://localhost:3200/api/regions

# Aggregate visualization stats
curl http://localhost:3200/api/viz/stats

# Search for specific nodes
curl "http://localhost:3200/api/nodes/search?q=server"

# Get cross-region connections (most architecturally significant)
curl http://localhost:3200/api/synapses/cross-region
```

### Step 5: Run Impact Simulations

To understand what happens if you change a specific node:

```bash
# First, find the node ID you want to simulate
curl "http://localhost:3200/api/nodes/search?q=server" | jq '.[0].id'

# Then simulate impact (replace NODE_ID with actual ID)
curl -X POST http://localhost:3200/api/simulate/impact \
  -H 'Content-Type: application/json' \
  -d '{"node_ids": ["NODE_ID"], "change_type": "modify"}'
```

### Step 6: Create Snapshots

Save the current state for later comparison:

```bash
# Create a snapshot
curl -X POST http://localhost:3200/api/snapshots \
  -H 'Content-Type: application/json' \
  -d '{"description": "Initial Nudge analysis"}'

# List all snapshots
curl http://localhost:3200/api/snapshots
```

### Step 7: Log Amygdala Warnings

If you discover failure patterns or risky areas in Nudge, log them:

```bash
curl -X POST http://localhost:3200/api/amygdala \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Large nudge-inject.js is fragile",
    "severity": "high",
    "attempted_change": {
      "description": "Any change to nudge-inject.js DOM manipulation",
      "nodes_touched": [],
      "regions_affected": ["occipital_lobe"]
    },
    "failure_mode": {
      "what_broke": "Editor overlay rendering breaks on edge cases",
      "cascade_path": ["nudge-inject.js"],
      "error_messages": [],
      "time_to_detect": "manual testing",
      "blast_radius": 5
    },
    "rollback": {
      "method": "git revert",
      "time_to_rollback": "immediate",
      "data_loss": false
    },
    "lessons_learned": ["Test all DOM manipulation changes against test-site fixtures"],
    "prevention_rules": [{
      "trigger_nodes": [],
      "warning_message": "nudge-inject.js is 192KB — changes have high blast radius",
      "auto_surface": true
    }],
    "related_entries": [],
    "status": "active"
  }'
```

### Available API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/nodes | List all nodes |
| GET | /api/nodes/search?q= | Search nodes |
| GET | /api/nodes/:id | Get single node |
| GET | /api/nodes/:id/connections | Get node connections |
| POST | /api/nodes | Create node |
| PUT | /api/nodes/:id | Update node |
| DELETE | /api/nodes/:id | Delete node |
| GET | /api/synapses | List all synapses |
| GET | /api/synapses/cross-region | Cross-region synapses |
| GET | /api/synapses/:id | Get single synapse |
| POST | /api/synapses | Create synapse |
| PUT | /api/synapses/:id | Update synapse |
| DELETE | /api/synapses/:id | Delete synapse |
| GET | /api/regions | Region stats |
| GET | /api/regions/:name | Nodes in region |
| GET | /api/regions/:name/health | Region health |
| GET | /api/amygdala | List all warnings |
| GET | /api/amygdala/:id | Get warning |
| GET | /api/amygdala/warnings/:node_id | Warnings for node |
| POST | /api/amygdala/check | Check nodes for warnings |
| POST | /api/amygdala | Log warning |
| POST | /api/analyze | Re-run full analysis |
| POST | /api/analyze/file | Analyze single file |
| GET | /api/analyze/status | Analysis status |
| POST | /api/simulate/impact | Simulate change impact |
| POST | /api/simulate/remove | Simulate removal |
| POST | /api/simulate/add | Simulate addition |
| GET | /api/simulate/history | Simulation history |
| POST | /api/snapshots | Create snapshot |
| GET | /api/snapshots | List snapshots |
| GET | /api/snapshots/:id | Get snapshot |
| GET | /api/snapshots/diff/:a/:b | Diff two snapshots |
| GET | /api/viz/stats | Aggregate stats |

### Your Tasks

1. Run Steps 1-3 to initialize, analyze, and start Plexus on the Nudge app
2. Explore the connectome — identify the most connected nodes, cross-region dependencies, and architectural hotspots
3. Run impact simulations on `server.js` and `nudge-inject.js` to understand their blast radius
4. Create an initial snapshot as baseline
5. Report findings: which regions are heaviest, what are the riskiest change points, and any architectural concerns you notice in the graph
