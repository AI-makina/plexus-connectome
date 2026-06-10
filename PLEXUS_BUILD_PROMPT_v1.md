# PLEXUS — Neural Connectome Engine for Application Architecture

## Master Build Specification v1.0

**Purpose:** This document is the complete build prompt for Plexus. It contains every specification, data structure, UI behavior, and architectural decision needed to build the entire application from scratch. Execute this document sequentially — Phase 1 through Phase 5.

**Target execution environment:** Build this application at `/Users/carlosmario/Desktop/Codes/Apps/plexus`

**First integration target:** Create a `plexus-integration` folder inside `/Users/carlosmario/Desktop/Codes/Apps/Nudge v1.0 Gemini` — this is where Plexus will render the architectural map of Nudge because the neural structure pertains to Nudge specifically.

**After building the engine:** Analyze the entire Nudge v1.0 Gemini codebase and populate the Plexus connectome with every function, component, route, schema, config, hook, interaction, dependency, and connection found in the code. From this point forward, as we continue troubleshooting and building Nudge, you will build and fix code while consulting Plexus to understand what is connected to what, and simultaneously update Plexus connections as we modify the codebase.

---

## 1. WHAT IS PLEXUS

Plexus is a real-time, 3D neural connectome engine that maps every functional element, dependency, and interaction within an application's architecture. It operates as both an LLM-consumable API and a human-navigable 3D visualization. Its purpose is to give AI systems and developers a living, breathing map of how an application works — so that every change, addition, or removal can be traced through its full cascade of impact before it happens.

Plexus is modeled after the human brain. The application's architecture is divided into **regions** (analogous to brain lobes), each governing a domain of concern. **Nodes** within those regions represent individual functional elements (functions, components, routes, schemas, configs, etc.). **Synapses** (connections) between nodes represent dependencies, data flows, event triggers, and any form of coupling. The connectome grows in complexity as the application evolves, and critically, it learns from failure through its **Amygdala** (threat memory) system.

Plexus is its own standalone application, but it is designed to be connected to any target application during inception, development, or troubleshooting. When connected, it generates a `plexus-integration` folder inside the target app's directory, containing the neural map specific to that application.

---

## 2. CORE PHILOSOPHY

- **Every connection must be explicit.** Even if one trigger affects 10,000 elements, every single connection is individually noted and traceable.
- **The brain grows with the app.** As features are added, bugs are fixed, and architecture evolves, Plexus grows more complex yet more robust.
- **Failure is memory.** Every failed approach, broken path, and rolled-back change is stored in the Amygdala, preventing repeated mistakes.
- **LLM-first, visual-essential.** The primary consumer is the AI building the app, but the human must have a clear, navigable, visually rich understanding of the connectome at all times.
- **Granularity matters.** Nodes go as deep as is helpful — from entire modules down to individual function parameters, event handlers, and CSS properties if they have dependencies.
- **No manual interaction for population.** Plexus auto-populates by analyzing the codebase. The LLM reads and writes to Plexus programmatically. The human navigates visually.

---

## 3. BRAIN REGION ARCHITECTURE

The connectome is divided into 8 functional regions plus a cross-region connector system. Each region has a designated color for visual distinction in the 3D view.

### 3.1 Frontal Lobe — Decision & Logic Layer
**Color: Electric Blue (#0066FF)**
**Governs:** Core business logic, conditional flows, state management (stores, context, reducers), decision trees, routing logic, permission/authorization logic, validation rules, business constraints, form submission handlers, workflow orchestration.

### 3.2 Temporal Lobe — Memory & Data Layer
**Color: Amber Gold (#FFB800)**
**Governs:** Database schemas and models, ORM definitions and migrations, caching layers (Redis, local cache, session), local storage and IndexedDB usage, data transformation and serialization, query builders and data access patterns, backup and recovery configurations, seed data.

### 3.3 Occipital Lobe — Visual & UI Layer
**Color: Vivid Magenta (#FF00AA)**
**Governs:** UI components (atomic through page-level), layouts, grids, responsive breakpoints, CSS/styling systems and theme tokens, animations and transitions, accessibility attributes (ARIA, tabindex), media queries and viewport handling, SVG, canvas, visual assets, font loading and typography systems.

### 3.4 Parietal Lobe — Integration & Sensory Input Layer
**Color: Emerald Green (#00CC66)**
**Governs:** REST/GraphQL API endpoints (inbound and outbound), webhook receivers and dispatchers, third-party service integrations (Stripe, Twilio, Retell, etc.), OAuth flows and external authentication, file upload/download handlers, real-time connections (WebSocket, SSE, polling), email/SMS/notification dispatchers, import/export functionality.

### 3.5 Cerebellum — Automation & Background Processes
**Color: Deep Purple (#8800FF)**
**Governs:** Cron jobs and scheduled tasks, n8n workflows and automation chains, AI agent pipelines and LLM calls, background job queues (Bull, Celery, etc.), data sync operations, automated testing suites, CI/CD pipeline definitions, log aggregation and monitoring hooks.

### 3.6 Brain Stem — Infrastructure & Core Systems
**Color: Steel Silver (#8899AA)**
**Governs:** Hosting and deployment configuration, environment variables and secrets management, DNS, SSL, and domain configuration, Docker/containerization configs, package management (package.json, requirements.txt), build toolchain (Vite, Webpack, etc.), authentication core (JWT, sessions, cookies), CORS, CSP, and security headers, error boundaries and global exception handlers.

### 3.7 Limbic System — User Experience & Emotion Layer
**Color: Warm Coral (#FF6B4A)**
**Governs:** Onboarding flows and first-time user experience, notification systems (toast, modal, push), loading states and skeleton screens, error messages and recovery prompts, micro-interactions and feedback animations, haptic feedback configurations, empty states and placeholder content, success/celebration moments, user preference and settings flows.

### 3.8 Amygdala — Threat Memory / Failure Registry
**Color: Crimson Red (#FF0033)**
**Governs:** Failed implementation attempts, rolled-back changes and their cascading effects, known anti-patterns specific to this codebase, performance regression records, breaking change history, dependency conflict records, security vulnerability patches and their contexts, "dead paths" — approaches proven not to work.

### 3.9 Corpus Callosum — Cross-Region Connectors
**Color: White/Bright Silver (#FFFFFF with glow)**
**Not a region itself** but the explicit mapping of inter-region connections. Tracks how a change in one region cascades to others. Maintains a weighted graph of cross-region dependencies. Identifies architectural bottlenecks and single points of failure. Surfaces the most critical cross-cutting concerns.

### 3.10 Region Spatial Positions in 3D Space
Each region occupies a general zone in the 3D visualization, mimicking actual brain anatomy:
- Frontal Lobe: Front-top (x:0, y:40, z:50)
- Temporal Lobe: Sides (x:-50, y:0, z:0)
- Occipital Lobe: Back (x:0, y:20, z:-50)
- Parietal Lobe: Top (x:0, y:60, z:0)
- Cerebellum: Bottom-back (x:0, y:-30, z:-40)
- Brain Stem: Bottom-center (x:0, y:-50, z:0)
- Limbic System: Center/deep interior (x:0, y:0, z:0)
- Amygdala: Center-bottom, nestled in limbic system (x:0, y:-15, z:10)

---

## 4. DATA STRUCTURES

### 4.1 Node Schema
Every element in the connectome is a Node:

```json
{
  "id": "uuid-v4",
  "name": "handleUserLogin",
  "type": "function | component | route | schema | config | style | hook | event | middleware | migration | test | workflow | endpoint | model | util | constant | type | interface | module | page | layout | provider | context | store | reducer | action | selector | animation | asset | env_var | script | class",
  "region": "frontal_lobe | temporal_lobe | occipital_lobe | parietal_lobe | cerebellum | brain_stem | limbic_system | amygdala",
  "file_path": "src/auth/handlers/login.ts",
  "line_range": { "start": 45, "end": 112 },
  "description": "Handles user login via email/password, validates credentials, generates JWT, sets session cookie",
  "metadata": {
    "language": "typescript",
    "framework": "next.js",
    "exports": ["handleUserLogin"],
    "imports": ["bcrypt.compare", "jwt.sign", "UserModel.findByEmail"],
    "parameters": [
      { "name": "email", "type": "string", "required": true },
      { "name": "password", "type": "string", "required": true }
    ],
    "returns": { "type": "Promise<AuthResponse>", "shape": { "token": "string", "user": "UserProfile" } },
    "side_effects": ["sets httpOnly cookie", "updates last_login in DB", "emits 'user.login' event"],
    "error_modes": ["InvalidCredentials", "AccountLocked", "RateLimited", "DatabaseError"],
    "jsx_children": [],
    "css_classes": [],
    "env_vars_used": ["JWT_SECRET", "SESSION_DURATION"],
    "hooks_used": [],
    "state_shape": {},
    "route_pattern": "",
    "http_method": "",
    "middleware_chain": []
  },
  "tags": ["auth", "critical-path", "security-sensitive"],
  "health": {
    "stability_score": 0.92,
    "change_frequency": "low",
    "last_modified": "2025-02-28T14:30:00Z",
    "amygdala_warnings": 1,
    "test_coverage": 0.85,
    "connection_count": 12,
    "cross_region_connections": 4
  },
  "position_3d": { "x": 0.0, "y": 0.0, "z": 0.0 },
  "created_at": "2025-02-15T10:00:00Z",
  "updated_at": "2025-03-01T09:00:00Z"
}
```

### 4.2 Synapse (Connection) Schema
Every connection between nodes is a Synapse:

```json
{
  "id": "uuid-v4",
  "source_node_id": "uuid-of-source",
  "target_node_id": "uuid-of-target",
  "type": "imports | calls | triggers | renders | queries | mutates | listens | provides | consumes | inherits | overrides | routes_to | validates | transforms | caches | schedules | wraps | composes | depends_on | configures | styles | animates | guards | redirects | emits | subscribes",
  "strength": 0.95,
  "direction": "unidirectional | bidirectional",
  "description": "handleUserLogin calls UserModel.findByEmail to retrieve user record",
  "metadata": {
    "data_shape_transferred": { "type": "UserRecord", "fields": ["id", "email", "password_hash"] },
    "is_async": true,
    "can_fail": true,
    "failure_impact": "critical | high | moderate | low | none",
    "fallback_exists": false,
    "conditional": ""
  },
  "cross_region": true,
  "regions_bridged": ["frontal_lobe", "temporal_lobe"],
  "created_at": "2025-02-15T10:00:00Z"
}
```

**Synapse Strength Scale:**
- **1.0** — Hard dependency. Removing the target WILL break the source.
- **0.7-0.99** — Strong coupling. Changes to target will likely require source updates.
- **0.4-0.69** — Moderate coupling. Target changes may affect source behavior.
- **0.1-0.39** — Loose coupling. Target changes unlikely to break source but worth noting.
- **0.01-0.09** — Trace connection. Exists for completeness.

### 4.3 Amygdala Entry Schema
Every failure, dead path, or threat:

```json
{
  "id": "uuid-v4",
  "title": "Attempted Redis session migration — cascading auth failures",
  "severity": "critical | high | medium | low",
  "date_occurred": "2025-02-20T16:45:00Z",
  "attempted_change": {
    "description": "Tried migrating session storage from cookie-based to Redis-backed sessions",
    "nodes_touched": ["session-manager-uuid", "auth-middleware-uuid", "redis-config-uuid"],
    "regions_affected": ["frontal_lobe", "brain_stem", "parietal_lobe"],
    "code_diff_ref": "git commit hash or diff summary"
  },
  "failure_mode": {
    "what_broke": "All authenticated API calls returned 401 because Redis connection pool exhausted under load",
    "cascade_path": ["redis-config-uuid", "session-manager-uuid", "auth-middleware-uuid", "ALL_PROTECTED_ROUTES"],
    "error_messages": ["ECONNREFUSED", "Session not found", "401 Unauthorized"],
    "time_to_detect": "4 minutes",
    "blast_radius": 47
  },
  "rollback": {
    "method": "Reverted to cookie-based sessions via git revert",
    "time_to_rollback": "12 minutes",
    "data_loss": false
  },
  "lessons_learned": [
    "Redis connection pool must be sized for peak concurrent sessions before migration",
    "Need fallback session mechanism during Redis outages",
    "Must load-test session infrastructure independently before swapping"
  ],
  "prevention_rules": [
    {
      "trigger_nodes": ["redis-config-uuid", "session-manager-uuid"],
      "warning_message": "Previous Redis session migration failed under load. Ensure connection pool sizing and fallback mechanism before reattempting.",
      "auto_surface": true
    }
  ],
  "related_entries": [],
  "status": "active | resolved | superseded"
}
```

### 4.4 Impact Simulation Schema

```json
{
  "id": "uuid-v4",
  "source_nodes": ["uuid1", "uuid2"],
  "change_type": "modify | remove | add | refactor",
  "timestamp": "ISO-date",
  "total_affected": 23,
  "blast_radius": [
    {
      "node_id": "uuid",
      "node_name": "ComponentName",
      "region": "occipital_lobe",
      "impact_level": "critical | high | moderate | low",
      "distance_from_source": 2,
      "connection_path": ["source-uuid", "intermediate-uuid", "this-uuid"],
      "amygdala_warnings": []
    }
  ],
  "amygdala_alerts": 3,
  "risk_score": 0.72,
  "recommendation": "HIGH RISK: This change has extensive critical-path impact..."
}
```

### 4.5 Connectome Snapshot Schema (for Time Travel)

```json
{
  "id": "uuid-v4",
  "timestamp": "ISO-date",
  "description": "Pre-auth-refactor snapshot",
  "node_count": 342,
  "synapse_count": 1847,
  "amygdala_count": 12,
  "data": {
    "nodes": [],
    "synapses": [],
    "amygdala": []
  }
}
```

---

## 5. ENGINE ARCHITECTURE

### 5.1 Technology Stack
- **Runtime:** Node.js (v20+)
- **Language:** TypeScript
- **API Framework:** Express.js with REST endpoints
- **Database:** SQLite (via better-sqlite3) for portability — the entire connectome lives in a single `.db` file inside the integration folder
- **3D Visualization:** Three.js + @react-three/fiber + @react-three/drei (served as a separate frontend on its own port)
- **Graph Physics:** Custom Fruchterman-Reingold force-directed layout engine adapted for 3D with region gravity
- **Search:** Fuse.js for fuzzy node/synapse search
- **File Watcher:** chokidar for watching target app file changes and triggering re-analysis
- **Code Analyzer:** Custom AST parsers (TypeScript: ts-morph, JavaScript: acorn)
- **WebSocket:** ws or socket.io for real-time synapse building visualization and multi-user cursors
- **Process:** Runs as a local server (default API port 3200, visualization port 3201)

### 5.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    PLEXUS ENGINE                         │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Code        │  │  Region      │  │  Impact      │  │
│  │  Analyzer    │  │  Classifier  │  │  Simulator   │  │
│  │  (AST Parse) │  │  (Auto-tag)  │  │  (Cascade)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│  ┌──────▼─────────────────▼──────────────────▼───────┐  │
│  │              CONNECTOME CORE                       │  │
│  │   Nodes ←→ Synapses ←→ Regions ←→ Amygdala       │  │
│  │   In-memory graph + Fuse.js search index          │  │
│  └──────────────────┬────────────────────────────────┘  │
│                     │                                   │
│  ┌──────────────────▼────────────────────────────────┐  │
│  │              STORAGE LAYER (SQLite)                │  │
│  │   plexus-integration/connectome.db                │  │
│  └──────────────────┬────────────────────────────────┘  │
│                     │                                   │
│  ┌─────────┬────────▼────────┬───────────────────────┐  │
│  │ REST API│  WebSocket Feed │  LLM Interface (JSON) │  │
│  │ :3200   │  :3201          │  (file-based + API)   │  │
│  └────┬────┘  └──────┬───────┘  └──────┬─────────────┘  │
│       │              │                 │                │
└───────┼──────────────┼─────────────────┼────────────────┘
        │              │                 │
   ┌────▼────┐   ┌─────▼──────┐   ┌─────▼──────┐
   │  3D UI  │   │  Real-time │   │ Gemini /   │
   │ (Three) │   │  Synapse   │   │ Claude /   │
   │ Browser │   │  Builder   │   │ Any LLM    │
   └─────────┘   └────────────┘   └────────────┘
```

### 5.3 File-Based LLM Interface

In addition to the REST API, Plexus maintains JSON files in the integration folder that any LLM can read and write to:

```
target-app/
├── plexus-integration/
│   ├── connectome.db              # SQLite database (source of truth)
│   ├── plexus-state.json          # Full connectome snapshot for LLM consumption (auto-updated)
│   ├── plexus-commands.json       # LLM writes commands here, engine processes them
│   ├── plexus-manifest.json       # Config: target app info, region mappings, settings
│   ├── amygdala-log.json          # Human-readable failure registry
│   ├── impact-reports/            # Generated impact simulation reports
│   │   └── sim-2025-03-01.json
│   └── snapshots/                 # Historical connectome snapshots (time travel)
│       └── snap-2025-03-01T14-30.json
```

**plexus-state.json** is a complete snapshot of the connectome, updated after every change. The LLM reads this to understand the full architectural map before making any changes.

**plexus-commands.json** is where the LLM writes operations (add node, add synapse, log amygdala entry, run simulation). The engine polls this file and processes commands:

```json
{
  "commands": [
    {
      "action": "add_node",
      "data": { "name": "newFeatureHandler", "type": "function", "region": "frontal_lobe", "file_path": "src/features/new.ts", "description": "..." }
    },
    {
      "action": "add_synapse",
      "data": { "source": "node-id", "target": "node-id", "type": "calls", "strength": 0.8 }
    },
    {
      "action": "log_amygdala",
      "data": { "title": "Failed approach...", "severity": "high", "..." : "..." }
    },
    {
      "action": "simulate_impact",
      "data": { "node_ids": ["uuid1", "uuid2"], "change_type": "modify" }
    }
  ]
}
```

---

## 6. API ENDPOINTS

### 6.1 Node Operations
```
POST   /api/nodes                    — Create a new node
GET    /api/nodes                    — List all nodes (filters: region, type, tags)
GET    /api/nodes/:id                — Get single node with all connections
PUT    /api/nodes/:id                — Update a node
DELETE /api/nodes/:id                — Delete a node (cascades to synapses)
GET    /api/nodes/:id/connections    — Get all synapses for a node
GET    /api/nodes/:id/impact         — Simulate impact of changing this node
GET    /api/nodes/search?q=          — Fuzzy search across all nodes
```

### 6.2 Synapse Operations
```
POST   /api/synapses                 — Create a new synapse
GET    /api/synapses                 — List all synapses (with filters)
GET    /api/synapses/:id             — Get single synapse
PUT    /api/synapses/:id             — Update a synapse
DELETE /api/synapses/:id             — Delete a synapse
GET    /api/synapses/cross-region    — Get all cross-region connections (Corpus Callosum view)
```

### 6.3 Region Operations
```
GET    /api/regions                  — List all regions with stats
GET    /api/regions/:name            — Get region detail with all its nodes
GET    /api/regions/:name/health     — Get region health metrics
GET    /api/regions/:name/heatmap    — Get activity heatmap data for the region
```

### 6.4 Amygdala Operations
```
POST   /api/amygdala                 — Log a new failure/dead path
GET    /api/amygdala                 — List all entries (with severity filter)
GET    /api/amygdala/:id             — Get single entry
GET    /api/amygdala/warnings/:node_id — Get all warnings for a specific node
POST   /api/amygdala/check           — Pre-flight check: pass list of node IDs, get all relevant warnings
```

### 6.5 Analysis Operations
```
POST   /api/analyze                  — Trigger full codebase analysis
POST   /api/analyze/file             — Analyze a single file and update connectome
POST   /api/analyze/diff             — Analyze a git diff and update connectome
GET    /api/analyze/status           — Get analysis progress
```

### 6.6 Simulation Operations
```
POST   /api/simulate/impact          — Simulate change impact (pass node IDs and change type)
POST   /api/simulate/remove          — Simulate removing a node
POST   /api/simulate/add             — Simulate adding a node with connections
GET    /api/simulate/history         — Get past simulation results
```

### 6.7 Visualization Operations
```
GET    /api/viz/layout               — Get 3D positions for all nodes (force-directed)
GET    /api/viz/layout/:region       — Get layout for specific region
POST   /api/viz/recalculate          — Force recalculate all layout positions
GET    /api/viz/stats                — Get connectome statistics for dashboard overlays
```

### 6.8 Time Travel Operations
```
POST   /api/snapshots                — Create a snapshot of current state
GET    /api/snapshots                — List all snapshots (metadata only)
GET    /api/snapshots/:id            — Load a specific snapshot with full data
GET    /api/snapshots/diff/:a/:b     — Compare two snapshots (show what changed)
```

---

## 7. CODE ANALYZER SPECIFICATION

The code analyzer is the heart of Plexus's automated population. It scans the target app's codebase and converts it into nodes and synapses with zero manual input.

### 7.1 File Discovery
- Recursively scan the target app directory.
- Respect `.gitignore` and a custom `.plexusignore` file.
- Identify file types and map to appropriate parsers.
- Track file fingerprints (content hash) for change detection — only re-analyze files that actually changed.

### 7.2 AST Parsing (per language)

**TypeScript/JavaScript (ts-morph or acorn):**
- Extract all function declarations, arrow functions, class methods
- Extract all import/export statements and map dependencies (resolve relative paths to absolute)
- Extract React component definitions (functional and class-based)
- Extract hook usage (useState, useEffect, useCallback, useMemo, custom hooks)
- Extract API route handlers (Express, Next.js App Router, Fastify patterns)
- Extract event emitters and listeners (EventEmitter.on/emit, addEventListener, custom pub/sub)
- Extract database model definitions (Prisma, Mongoose, Sequelize, Drizzle patterns)
- Extract environment variable usage (process.env.*)
- Extract type/interface definitions and their relationships
- Extract JSX component composition trees (what renders what)
- Extract middleware chains
- Extract error handling patterns (try/catch, error boundaries)

**CSS/SCSS/Tailwind:**
- Extract class definitions and map them to the components that consume them
- Extract CSS variable definitions and where they're consumed
- Extract media query breakpoints
- Extract animation keyframe definitions and which elements use them

**Configuration Files:**
- Parse package.json for dependencies and scripts
- Parse docker-compose for service definitions
- Parse environment variable definitions (.env, .env.local, etc.)
- Parse CI/CD pipeline stages
- Parse database migration files chronologically
- Parse next.config.js, vite.config.ts, tailwind.config.js, etc.

### 7.3 Relationship Extraction
For every discovered element, the analyzer must trace:
- **Import chains:** What does this file import? Follow the chain across files.
- **Function calls:** What functions does this function call? Trace across file boundaries.
- **Data flow:** What data enters a function, what comes out, where does the output go next?
- **Event patterns:** What events are emitted? Where are they listened to? Map the full pub/sub graph.
- **Render trees:** What components render which children? Trace the full JSX composition tree.
- **Route mapping:** What URL routes map to what handlers, and what middleware sits in between?
- **Schema-to-query:** What database models are queried by which functions?
- **Config consumption:** What config values are read by which modules?
- **Type dependencies:** What types/interfaces are used by which functions and components?
- **State flow:** What state is created where, passed through which providers, consumed by which components?

### 7.4 Region Auto-Classification
Based on the node's type, file path, content analysis, and framework patterns, auto-classify into a region using weighted scoring:

| Signal | Region |
|--------|--------|
| State management hooks, business rules, validators, services, utilities | Frontal Lobe |
| Database models, queries, cache operations, migrations, seeds | Temporal Lobe |
| React components, CSS files, layouts, animations, SVG, themes | Occipital Lobe |
| API route handlers, webhook receivers, SDK clients, fetch calls | Parietal Lobe |
| Cron jobs, background workers, automation configs, n8n workflows, CI/CD | Cerebellum |
| Docker, build configs, env vars, auth core, middleware, package.json | Brain Stem |
| Onboarding flows, notifications, toasts, loading/error/empty states | Limbic System |
| (Manually tagged or auto-detected from Amygdala failure logs) | Amygdala |

**Path-based classification hints** (from plexus-manifest.json) take highest priority. Then type-based mapping. Then path pattern matching. Then content signal analysis. Default fallback is Frontal Lobe.

---

## 8. IMPACT SIMULATION ENGINE

### 8.1 Algorithm
When simulating the impact of a change to one or more source nodes:

1. Start a BFS (Breadth-First Search) from each source node.
2. Traverse all connected synapses outward.
3. For each reached node, calculate impact level based on:
   - **Distance from source** (closer = higher impact)
   - **Synapse strength** along the path (stronger = higher impact)
   - **Combined formula:** `effectiveStrength = synapseStrength * (1 / (distance * 0.5 + 1))`
4. Impact level thresholds:
   - effectiveStrength > 0.7 → **Critical**
   - effectiveStrength > 0.4 → **High**
   - effectiveStrength > 0.2 → **Moderate**
   - effectiveStrength ≤ 0.2 → **Low**
5. Stop traversing through synapses weaker than 0.2 (trace connections don't propagate).
6. Check every reached node against the Amygdala for warnings.
7. Calculate aggregate risk score and generate recommendation text.

### 8.2 Risk Score Calculation
```
riskScore = min(1.0, (criticalCount * 0.3 + highCount * 0.15 + amygdalaAlerts * 0.1) / 5)
```

### 8.3 Recommendations
- riskScore > 0.7: "HIGH RISK: Extensive critical-path impact. Break into smaller, testable changes."
- riskScore > 0.4: "MODERATE RISK: Several important connections affected. Ensure test coverage."
- riskScore > 0.1: "LOW RISK: Limited impact. Standard testing should suffice."
- riskScore ≤ 0.1: "MINIMAL RISK: Well-isolated change."
- If amygdalaAlerts > 0: Append "⚠️ [N] AMYGDALA WARNING(S): Previous failures detected in impact zone."

---

## 9. 3D FRUCHTERMAN-REINGOLD LAYOUT ENGINE

The layout engine positions all nodes in 3D space using a force-directed algorithm adapted with region gravity.

### 9.1 Forces
- **Repulsive force** between all node pairs: `F_repulsion = repulsion_strength / distance²` — prevents overlap.
- **Attractive force** along synapses: `F_attraction = attraction_strength * distance * synapse_strength` — connected nodes pull closer based on connection strength.
- **Region gravity:** Each node is gently pulled toward its region's center position (see Section 3.10): `F_gravity = region_gravity * (regionCenter - nodePosition)`.

### 9.2 Parameters
- iterations: 300 (full calculation), 50 (incremental update)
- initial_temperature: 50 (limits maximum displacement per iteration)
- cooling_factor: 0.95 (temperature decreases each iteration for convergence)
- repulsion_strength: 500
- attraction_strength: 0.01
- region_gravity: 0.03
- min_distance: 2 (prevents division by zero)
- bounds: ±150 on each axis

### 9.3 Incremental Updates
When only a few nodes change, don't recalculate everything. Only move the changed nodes and their immediate neighbors (1-hop), using 50 iterations with a lower initial temperature (20).

---

## 10. 3D VISUALIZATION SPECIFICATION

The visualization runs as a separate frontend served on its own port (3201). It connects to the API (3200) and WebSocket for real-time updates.

### 10.1 Core Rendering
- **Engine:** Three.js with React Three Fiber and @react-three/drei helpers.
- **Space:** Infinite 3D canvas with a subtle star-field or particle background (dark, not distracting — background color #0A0A0F).
- **Camera:** Perspective camera with full orbit controls — rotate, pan, zoom on all 3 axes. Smooth easing on all camera movements.
- **Post-processing:** Bloom shader for glow effects on nodes and synapses. Subtle ambient occlusion for depth perception.
- **Style:** Ultra-modern, floating-in-space aesthetic. Nodes appear as luminous spheres suspended in a void. Synapses are curved glowing filaments. The overall feel should be like looking at a living neural network in deep space.

### 10.2 Node Rendering
- Each node is a **glowing sphere**.
- Sphere **size** scales with importance: `baseSize + (connectionCount * 0.3) + (stabilityScore * 0.5)`. Minimum size ensures visibility. Maximum size prevents one node from dominating.
- Sphere **color** = its region's designated color (see Section 3).
- Sphere **glow intensity** = recent activity. Nodes modified recently glow brighter, fading over time.
- **Hover behavior:** Node expands slightly (1.2x), a tooltip appears showing the node name, type, and region.
- **Click behavior:** Opens the Node Inspector drawer (Section 10.13). The node pulses once and its immediate connections flash to highlight the neighborhood.

### 10.3 Synapse Rendering
- Each synapse is a **curved line** (quadratic bezier) between two nodes.
- Line **thickness** = connection strength (0.01 = hairline thin, 1.0 = thick beam).
- Line **color** = gradient between the two nodes' region colors for cross-region synapses, or solid region color for same-region synapses.
- Line **opacity** = confidence/establishment level (well-established = solid, inferred = translucent).
- **Directional pulse:** An animated light particle travels along the synapse to indicate data flow direction. Speed is constant; brightness varies with strength.
- **Cross-region synapses** (Corpus Callosum) have brighter glow and slightly thicker rendering to stand out.

### 10.4 Region Clustering
- Nodes within the same region gravitate toward each other via the layout engine.
- Each region occupies its designated spatial zone (Section 3.10).
- When zoomed into a region, nodes within it spread apart for readability while maintaining relative positions.

### 10.5 Amygdala Pulse Effect
- Nodes with active Amygdala warnings emit a **rhythmic red pulse** — like a heartbeat warning.
- Pulse **intensity** scales with the number and severity of warnings: 1 low warning = subtle glow, 3+ critical warnings = intense strobing.
- The pulse **radiates outward** along connected synapses, showing the historical blast radius in fading red light.
- Optional (off by default): subtle audio cue when approaching a heavily-warned node.

### 10.6 Impact Simulation Mode
- User (or LLM via API) selects one or more nodes and activates "Simulate Change."
- A **wave of light propagates outward** through all connected synapses from the source nodes.
- Each reached node **lights up** with color intensity based on impact severity:
  - Critical: Bright red flash
  - High: Orange glow
  - Moderate: Yellow shimmer
  - Low: Faint white ripple
- The wave animation travels at a visible speed so the user can watch the cascade propagate.
- After the wave completes, the **full illumination holds** for 3 seconds showing the total blast radius.
- A side panel shows the ordered list of affected nodes with impact level, distance, and any Amygdala warnings.

### 10.7 Time Travel Slider
- A horizontal **timeline scrubber** at the bottom of the viewport.
- Dragging the slider shows the connectome at any historical snapshot point.
- Nodes **fade in/out** with smooth transitions as they were added/removed over time.
- Synapses **appear/disappear** with animated transitions.
- Amygdala entries flash as **red markers** on the timeline at their date_occurred.
- The current state is always the rightmost position on the slider.

### 10.8 Region Fog / Depth Layering
- When zoomed into a specific region, other regions **fade to 10% opacity** with gaussian blur effect.
- The focused region nodes come to full brightness and increase spacing for readability.
- Zooming out gradually brings all regions back to full visibility.
- Transitions between focus states are smooth (300ms easing).

### 10.9 Cluster Gravity (Visual Effect)
- Heavily interconnected nodes visually pull closer together, forming **dense bright clusters**.
- Isolated or loosely connected nodes drift toward the periphery of their region.
- This emergent behavior means architectural hotspots (critical, highly-connected areas) are visually identifiable as dense, bright masses — you can spot them at a glance when zoomed out.

### 10.10 Search with Spatial Navigation
- **Search bar** at the top of the viewport (Cmd+K / Ctrl+K shortcut to focus).
- Fuzzy search (powered by Fuse.js) across node names, descriptions, tags, file paths, and types.
- Results appear in a **dropdown** with region color indicators (colored dot next to each result).
- Selecting a result: the camera **smoothly flies through 3D space** directly to the target node (cinematic path, not instant teleport).
- The target node glows brighter on arrival, and connected nodes pulse once to reveal the neighborhood.
- A "Show all connections" button highlights the entire dependency web for that node.

### 10.11 Minimap / Orbital View
- Small **circular widget** in the bottom-right corner of the viewport.
- Shows the entire brain from a fixed overhead perspective.
- Region clusters are visible as colored blobs.
- A **white dot** indicates the current camera position and viewing direction.
- **Click anywhere on the minimap** to warp the camera to that area.
- The minimap subtly pulses in areas with recent activity.

### 10.12 Region Legend Panel
- **Collapsible left sidebar** panel.
- Lists all 8 regions plus Corpus Callosum with:
  - Color swatch
  - Region name
  - Node count
  - Health score (0-100, derived from average stability minus Amygdala deductions)
  - Last activity timestamp
  - Mini sparkline showing modification activity over the last 30 days
- **Click a region** to zoom the 3D camera to that region.
- **Toggle individual regions** on/off (checkbox) to hide/show them for focused viewing.

### 10.13 Node Inspector Drawer
- **Slides in from the right** when any node is clicked in the 3D view.
- Content:
  - Node name, type badge, region badge (with color)
  - File path (displayed as a clickable link — opens in IDE if configured)
  - Full description text
  - **Connections section:** All synapses grouped by type (Imports, Calls, Renders, Provides, etc.) — each showing the connected node name, region, and synapse strength
  - **Amygdala warnings** (if any): Prominently displayed in red cards at the top — showing title, severity, lessons learned, and warning message
  - **Health metrics:** Stability score gauge, change frequency indicator, test coverage bar, total connection count, cross-region count
  - **Mini dependency tree:** Expandable tree view showing 2-3 levels of connections outward
  - **History log:** When this node was created, last modified, modification count
- **"Simulate Impact" button** directly in the drawer — runs simulation from this node and shows results in the simulation panel

### 10.14 Heat Map Overlay Toggle
- **Toggle button** in the top toolbar.
- When activated, shifts the entire color scheme from region-based to activity-based:
  - **Hot (orange → red):** Frequently modified nodes (volatile areas)
  - **Cool (blue → purple):** Stable, rarely touched nodes
  - **Neutral (grey):** No recent activity data
- Reveals volatility hotspots instantly — the areas that change most (and might need more tests or architectural attention).
- When toggled off, returns to region-based coloring.

### 10.15 Multi-User Cursors
- When multiple users are connected to the same Plexus instance via WebSocket:
  - Each user's camera position is broadcast to others.
  - Other users appear as **small labeled orbs** floating in the 3D space at their camera position.
  - The label shows the user's name.
  - **Click another user's cursor** to warp your camera to their exact viewpoint.
  - Optional: Shared selection highlighting — when User A clicks a node, User B sees it flash.

### 10.16 Synapse Thickness = Dependency Weight (Visual Rule)
- **Thin hairline** (strength 0.01-0.09): Trace connection, barely visible unless zoomed in.
- **Thin line** (strength 0.1-0.39): Loose coupling, visible but subtle.
- **Medium line** (strength 0.4-0.69): Moderate coupling, clearly visible.
- **Thick line** (strength 0.7-0.99): Strong coupling, prominent and bright.
- **Thick beam with glow** (strength 1.0): Hard dependency, impossible to miss — this is a critical structural connection.

---

## 11. PLEXUS MANIFEST CONFIGURATION

The `plexus-manifest.json` file configures Plexus for a specific target app. It lives inside the `plexus-integration` folder:

```json
{
  "plexus_version": "1.0.0",
  "target_app": {
    "name": "Nudge v1.0",
    "root_path": "/Users/carlosmario/Desktop/Codes/Apps/Nudge v1.0 Gemini",
    "languages": ["typescript", "javascript", "css", "json"],
    "frameworks": ["next.js", "react", "tailwind"],
    "entry_points": ["src/app/layout.tsx", "src/app/page.tsx"],
    "ignore_patterns": ["node_modules", ".next", ".git", "dist", "coverage", "*.test.*", "plexus-integration"]
  },
  "server": {
    "api_port": 3200,
    "ws_port": 3201,
    "host": "localhost"
  },
  "analysis": {
    "auto_analyze_on_start": true,
    "watch_for_changes": true,
    "depth": "maximum",
    "include_tests": true,
    "include_configs": true
  },
  "visualization": {
    "theme": "dark",
    "background_color": "#0A0A0F",
    "enable_bloom": true,
    "enable_fog": true,
    "enable_audio": false,
    "default_camera_position": { "x": 0, "y": 50, "z": 100 }
  },
  "regions": {
    "custom_overrides": {},
    "classification_hints": {
      "src/auth/*": "brain_stem",
      "src/components/*": "occipital_lobe",
      "src/app/api/*": "parietal_lobe",
      "src/lib/db/*": "temporal_lobe",
      "src/hooks/*": "frontal_lobe",
      "src/store/*": "frontal_lobe"
    }
  }
}
```

---

## 12. BUILD PHASES

Execute these phases in order. Each phase should be fully functional before moving to the next.

### Phase 1: Core Engine
1. Project scaffolding at `/Users/carlosmario/Desktop/Codes/Apps/plexus` — TypeScript + Express + SQLite
2. Implement all data structures from Section 4 as TypeScript types
3. SQLite database schema with tables for nodes, synapses, amygdala entries, and snapshots
4. Database layer with full CRUD operations, bulk insert, and indexed queries
5. Connectome core — in-memory graph manager that syncs with SQLite, maintains adjacency maps, and provides graph traversal
6. Fuse.js search index that rebuilds on every node change
7. Plexus state file writer — auto-generates `plexus-state.json` after every mutation
8. Plexus command file reader — polls `plexus-commands.json` and processes queued commands
9. Helper factory functions for creating nodes, synapses, and amygdala entries with sane defaults

### Phase 2: Code Analyzer
1. File discovery engine with `.gitignore` and `.plexusignore` respect, file fingerprinting
2. TypeScript/JavaScript AST parser using ts-morph — extract all functions, classes, components, hooks, imports, exports
3. Import chain resolver — trace relative and absolute imports across the entire codebase to build the dependency graph
4. Function call graph builder — for every function, determine what other functions it calls (cross-file)
5. React component tree builder — trace JSX composition (what renders what)
6. Route mapping extractor — map URL patterns to handler functions and middleware chains
7. Region auto-classifier using weighted scoring across path patterns, node types, and content signals
8. Full codebase analysis orchestrator — runs all parsers, deduplicates, and builds the complete connectome in one pass

### Phase 3: Impact & Simulation
1. BFS-based graph traversal engine with depth control and strength thresholds
2. Impact cascade calculator using the algorithm from Section 8
3. Blast radius scorer with risk score formula
4. Amygdala warning integration — check every impacted node against the failure registry
5. Simulation history storage — persist past simulations for reference
6. Pre-flight amygdala check endpoint — given a list of node IDs, return all relevant warnings

### Phase 4: 3D Visualization
1. Separate React app with Three.js + @react-three/fiber + @react-three/drei
2. Node sphere renderer with region colors, size scaling, glow effects
3. Synapse line renderer with bezier curves, thickness scaling, directional pulse animation
4. 3D Fruchterman-Reingold layout engine with region gravity (Section 9)
5. Camera controls — full orbit (rotate, pan, zoom on all 3 axes), smooth fly-to animation
6. Region fog and depth layering — fade non-focused regions when zoomed in
7. Search bar (Cmd+K) with Fuse.js powered dropdown and camera fly-to on selection
8. Node Inspector drawer — slides from right, shows all node data, connections, amygdala warnings
9. Region Legend panel — collapsible left sidebar with stats, health, and toggle visibility
10. Minimap — bottom-right orbital overview with click-to-warp
11. Heat map overlay toggle — switch between region colors and activity-based hot/cool colors
12. Impact simulation visualization — animated wave propagation with severity-colored illumination
13. Time travel slider — timeline scrubber that loads historical snapshots and transitions nodes in/out
14. Amygdala pulse effects — red heartbeat glow on warned nodes with cascade radiation
15. Multi-user cursors via WebSocket — see other viewers' positions, click to warp to their view
16. Star-field background with subtle depth particles
17. Post-processing: bloom, ambient occlusion

### Phase 5: Integration Layer
1. chokidar file watcher on the target app directory
2. On file change: fingerprint comparison → incremental re-analysis of changed files only → update connectome
3. Git diff analyzer — parse git diffs to understand what changed and update nodes/synapses accordingly
4. Auto-snapshot on significant changes (more than N nodes affected)
5. LLM interface refinement — ensure plexus-state.json is always current, plexus-commands.json processing is robust with error handling
6. Plexus CLI: `npx plexus init --target <path>`, `npx plexus analyze`, `npx plexus serve`

---

## 13. RUNNING PLEXUS

### First Time Setup
```bash
cd /Users/carlosmario/Desktop/Codes/Apps/plexus
npm install
npm run build
```

### Connecting to Nudge
```bash
npx plexus init --target "/Users/carlosmario/Desktop/Codes/Apps/Nudge v1.0 Gemini" --name "Nudge v1.0"
# Creates plexus-integration/ folder in the Nudge directory
# Generates plexus-manifest.json with auto-detected settings

npx plexus analyze
# Runs full codebase analysis of Nudge
# Populates the connectome with all discovered nodes and synapses
# Generates initial plexus-state.json

npx plexus serve
# Starts API server on port 3200
# Starts 3D visualization on port 3201
# Opens browser to the connectome view
# Begins watching for file changes
```

---

## 14. POST-BUILD: ANALYZE NUDGE

After the engine is built, immediately:

1. Run `npx plexus init` targeting the Nudge v1.0 Gemini directory.
2. Run `npx plexus analyze` to scan the entire Nudge codebase.
3. This should produce a fully populated connectome with every function, component, route, schema, hook, utility, config, and their connections mapped.
4. Verify the plexus-state.json is comprehensive by checking node counts per region.
5. Start the visualization server and verify the 3D rendering looks correct — nodes should cluster by region, synapses should be visible, cross-region connections should stand out.

From this point forward:
- **Before making any code change to Nudge,** consult Plexus to understand the impact.
- **After making any code change,** the file watcher should auto-update the connectome.
- **When something breaks,** log it in the Amygdala with full detail so it's never repeated.
- **As we troubleshoot,** Plexus grows smarter, more connected, and more protective.

---

## 15. SUCCESS CRITERIA

Plexus is successfully built when:
1. An LLM can read plexus-state.json and understand every dependency in the target app before making a change.
2. Running an impact simulation on any node shows the complete cascade of affected elements.
3. Previously failed approaches are automatically surfaced as Amygdala warnings when touching related nodes.
4. The 3D visualization gives a human an instant, intuitive understanding of the app's architecture — regions are distinct, connections are visible, hotspots are identifiable.
5. The connectome auto-updates when files in the target app change.
6. The system grows more valuable over time, becoming institutional knowledge that prevents repeated mistakes.
7. Adding Plexus to any new app is a single `npx plexus init` command that produces immediate value.

---

*This document is the canonical build specification for Plexus v1.0. All implementation decisions should reference this document as the source of truth.*
