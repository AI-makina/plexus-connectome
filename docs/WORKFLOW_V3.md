# Plexus Workflow v3 — The Evidence Protocol Contract for Coding AIs

**Supersedes** the per-project workflow prompts (e.g. Plexus_Workflow_Areopagus_v2) with a
generalized, tool-backed contract. v2's seven prompt-level enforcement mechanisms were
necessary but insufficient — v3 pairs the prompt contract with **mechanical surfaces**:
the MCP tools, the validated write path, the consultation ledger, the git chokepoint, and
claim-diff verification. Copy the SESSION CONTRACT section into CLAUDE.md / .cursorrules
(or run `plexus rules`), and register the MCP server so the tools are first-class.

---

## 0. Surfaces

| Surface | MCP tool | REST |
|---|---|---|
| Session opener | `session_open` | `GET /api/session` + `GET /api/viz/stats` |
| Existence oracle | `claim_check` | `POST /api/claim-check` |
| Consultation brief | `consult` | `POST /api/consult` |
| Blast radius | `simulate_impact` | `POST /api/simulate/impact` |
| Post-change verification | — | `POST /api/verify` |
| Graph deposit | `update_graph` | `POST /api/nodes`, `POST /api/synapses` (token required) |
| Threat memory | `deposit_amygdala` | `POST /api/amygdala` (token required) |
| Retire an approach | `mark_dormant` | `POST /api/nodes/:id/dormant` |
| Utilization/maturity | — | `GET /api/regions/utilization`, `plexus report` |

Register: `claude mcp add plexus -- node <plexus>/dist/cli.js mcp -p <app>`
Commit guard: `plexus hook-install -p <app>` (warn-only).

## 1. SESSION CONTRACT (the part the AI must follow)

**⬡ PLEXUS ACTIVE.** This project has a connectome brain. Its purpose: you never assert
an identifier the graph can't confirm, never repeat a recorded failure, never change code
blind to its blast radius.

1. **Open** — call `session_open` before anything else. Note the maturity label:
   a PROVISIONAL map advises (verify surprising claims against the code);
   an enriched map is authoritative.
2. **Claim-check before you rely.** Before writing code that calls/imports/reads ANY
   function, component, endpoint, or env var: `claim_check` it.
   - `missing` = it does not exist. Do not invent it — create it explicitly or pick a real one.
   - `dormant` = we already tried that; read the reason before resurrecting it.
   - `out_of_scope` = the graph cannot verify this category; verify manually and say so.
3. **Consult before you change.** `consult` the files/nodes you are about to touch.
   The AMYGDALA section is non-negotiable history; the DORMANT section is "already tried".
4. **Simulate before non-trivial changes.** `simulate_impact` on the target nodes;
   respect the risk verdict. CONTRACTS-family edges propagate at full strength —
   a shared shape change reaches every consumer no matter the distance.
5. **Execute** the change.
6. **Update** — `update_graph` with the nodes/synapses for what you created (declare
   `origin: 'llm'`; you may never claim `scan`). Re-scan touched files
   (`POST /api/analyze/file`) so the map matches reality.
7. **Verify** — `POST /api/verify` with your claims (created symbols, touched files).
   `mismatch` blocks "done": reconcile unverified files, or your claim was false.
8. **Reflex (debugging)** — every FAILED fix attempt deposits a lightweight
   `deposit_amygdala` entry (title, severity, what broke, trigger nodes). Closing a bug
   deposits the full entry with the OBSERVED cascade. Abandoned approaches:
   `mark_dormant`, never silent deletion.

**Classification card:** when you create nodes manually, classify by the nine decision
tests and four tie-breakers in `docs/REGION_TAXONOMY.md` §2–3 (concerns, not files;
utils = who-calls-when; UI = steady-state vs user-moment; auth three-way split;
transforms = meaning vs shape). Region `amygdala` is not assignable to nodes — the write
path will reject it.

## 2. GENESIS — starting a new app (brain before code)

Run the nine-question interview and seed the connectome as `planned` nodes (slug ids,
`origin: 'seed'`, intended file_path, contracts, cascade paths, verification checks —
the Areopagus seed is the reference shape):

1. What does the app **DECIDE**? (frontal) 2. **REMEMBER**? (temporal)
3. What does the user **SEE**? (occipital) 4. What does it **SENSE/SPEAK** to? (parietal)
5. What runs **UNATTENDED**? (cerebellum) 6. What does it **RUN ON**? (brain_stem)
7. How should waiting/failure/success **FEEL**? (limbic)
8. What **BRIDGES** regions? (contracts) 9. What could go **WRONG**?
   → answers become cascade paths + verification checks, **never** amygdala entries.

Per feature: consult planned nodes → build at the planned path → the scanner reconciles
planned→active on landing. The nine regions are the build checklist (`plexus report`).

## 3. GRAFT — onboarding an existing app

1. `plexus init` → edit the manifest hints (strongest classifier signal — ten minutes
   here is the highest-leverage onboarding act).
2. `plexus analyze` → `plexus report` — read the dark/sparse regions and the
   low-confidence review queue.
3. Enrichment pass (LLM): create the concept layer (features, journeys, services,
   entities, data stores) the scanner can't see; resolve the review queue; mirror
   corrections into manifest `custom_overrides`.
4. `plexus mine` → review `plexus-proposals.json`; confirm real incidents into the
   amygdala (mining proposes, never creates).
5. `plexus hook-install`; thereafter the standard session contract applies.
6. First-hour trust test: take the user's actual next task; produce the plan
   unconsulted, then consulted; show the delta (invented APIs avoided, risks surfaced).

## 4. Honest-emptiness rule

If a region is legitimately empty for this app archetype (a CLI has no occipital),
record it in the manifest `expected_region_profile` as `none` — do not force-fill.
Amygdala at zero is healthy until debugging happens; debugging without deposits means
step 8 is being skipped, and the report will say so.
