# Plexus Region Taxonomy & Plug Protocol (v2)

**Status:** Draft for sign-off · **Phase:** Outlets & Plugs
**Supersedes:** PLEXUS_BUILD_PROMPT_v1.md §3 (region definitions) and §7.4 (auto-classification) where they conflict.

This document is the product's core contract: how the elements of ANY app — new or
existing, web, mobile, backend, AI-agent, or CLI — map onto the nine regions of the
connectome brain, and how apps plug into Plexus in each of the three lifecycles
(new build, existing build, troubleshooting). An LLM following this document and the
classifier following this document must produce the same answer for any element.

---

## 1. The core principle: classify concerns, not files

The dark-brain problem is a **granularity** problem, not a color-coding problem.
Limbic, temporal, cerebellum, and brain-stem concerns live *inside* files — a toast
call inside a component, a `localStorage` read inside a hook, a `setInterval` inside a
service, an env read anywhere — so any file-level classifier starves them, while
frontal/parietal/occipital hoard whole files.

**Evidence (all verified against real data):**

- The demo connectome (174 nodes: frontal 53, parietal 41, CC 39, occipital 23,
  limbic 8, temporal 4, brain_stem 4, cerebellum 2, amygdala 0) is a **self-scan of
  the Plexus engine** run with no manifest. Its entire limbic population (8/8) is a
  false positive of the `console.error|alert` content signal (`/alert/i` matches
  `amygdala_alerts`). Both cerebellum nodes are a BFS `queue` variable misfire.
  CC's 39 are passive type/interface declarations. True limbic: **0**.
- The **real Nudge connectome** (817 nodes) has the opposite pathology: cerebellum
  477 — of which 475 are internals of 95 `test-*.js` files — plus limbic 0, CC 0,
  temporal 2, and 3 genuine incidents stored incorrectly as graph nodes.
- The **hand-authored Areopagus seed** (53 nodes) is naturally balanced
  (parietal 14, frontal 10, brain_stem 7, temporal 6, cerebellum 6, occipital 6,
  limbic 4, CC 0) because its nodes are **roles, not paths** ("Table Engine",
  "Persuasion Protocol"). That is the existence proof for this spec.

**Three element planes.** Every region is populated on up to three granularities:

| Plane | What it is | Example |
|---|---|---|
| **Anchor** | A file/symbol the scanner sees (today's nodes) | `CheckoutForm.tsx`, `POST /api/orders` |
| **Facet** | A sub-file concern extracted from *inside* a foreign-region file. Capped at **one per (file × foreign region)**, AST-detected (never raw regex), linked to its parent via `metadata.parent_node_id` + a `composes` synapse. Facets go dormant (never deleted) when their signal disappears. | the `#ux-feedback` facet of `CheckoutForm.tsx` (its toasts + isLoading branches) |
| **Concept** | A supra-file or non-code element: features, journeys, services, entities, data stores, pipelines, deploy targets, contracts. Created at genesis/enrichment, maintained by the LLM workflow. | "checkout flow", "Stripe", "Postgres on Hetzner", "first-run onboarding" |

Concept home regions: feature/flow → frontal · journey → limbic · service → parietal ·
entity/data_store → temporal · pipeline → cerebellum · deploy_target/environment →
brain_stem · contract → corpus_callosum · token_set/asset → occipital.

---

## 2. The nine-region catalog

Each region: a one-liner, the membership decision test (the same sentence the
classifier scores against and the LLM applies), what belongs (by plane), boundary
rules against neighbors, and how the region gets populated when the app has no
dedicated folder for it.

### 2.1 Frontal Lobe — Decision & Logic
*Every element that chooses WHAT happens next: rules, state transitions, validation verdicts, orchestration.*

**Test:** Does this element decide what happens next based on rules or state — such
that it could run meaningfully in a unit test with storage, UI, and transport all
mocked out? Frontal is the **recorded-confidence fallback, never the silent default**:
a node stays frontal after review only with positive decision evidence.

**Anchors:** state containers (Zustand/Redux slices, reducers, selectors, XState
machines; ViewModels/Bloc on mobile; domain services and workflow state machines on
backend — seed evidence: `table_engine`, `persuasion_protocol`, `evaluator`,
`synthesizer`, `workspace` are all frontal); business rules & validation *logic*
(pricing/eligibility/scoring, Zod refinement *rules*, RBAC guards, feature-flag
*branches*, submit handlers, route-guard decisions); **pure computational utils
reclaimed from cerebellum** (date math, sort/rank/dedupe, meaning-changing formatters
— classified per symbol, never by `/utils` path); orchestrators (checkout/booking
coordinators, sagas, deliberation protocols); agent planners, tool-choice routers,
guardrail policies (AI); command dispatch tables, config-precedence resolution,
dry-run planners (CLI).

**Facets:** decision branches inside foreign files — the policy conditional inside a
parietal route handler, the state-transition case inside an occipital component.

**Concepts:** feature/flow nodes ("checkout flow") composing constituents; business
rules as first-class nodes ("free shipping over $50"); decision tables; feature-flag
*semantics* (storage is brain_stem; the vendor SDK is parietal).

**Non-code:** business-rule registry entries, permission/role matrices, pricing
tables, feature-flag inventory, domain glossary terms that encode decisions.

**Boundaries:** vs temporal — "would a product manager care about the output
difference?" → frontal; only an engineer (shape/format) → temporal · vs parietal —
computes the verdict → frontal; carries it across the process boundary → parietal ·
vs cerebellum — **who-calls-when**: synchronous in a request/render → frontal;
timer/queue/pipeline → cerebellum · vs brain_stem — authZ ("may THIS user do X") →
frontal; authN machinery ("is this token valid") → brain_stem.

**Population fix:** frontal needs *de-bloating*, not feeding — per-symbol content
voting, `classification_confidence` recorded on every node, sub-0.5 confidence nodes
into a review queue, tie-breaks toward the scarcer region.

### 2.2 Temporal Lobe — Memory & Data
*Everything that defines, persists, retrieves, caches, or reshapes data AT REST.*

**Test:** Does this element define, persist, retrieve, cache, or serialize data that
outlives a single request, render, or process run — where the primary risk of
changing it is data corruption, loss, or stale reads?

**Anchors:** schemas/models/migrations/seeds (`schema.prisma` parsed into one node
per model; Drizzle/Mongoose; Realm/CoreData/Room; vector-store collections,
conversation memory, RAG index builders; CLI config-file formats); repositories/DAOs/
query builders (seed: `failure_library`, `score_storage` are temporal while
`redis_client` is brain_stem); cache *policy* layers (react-query/SWR configs,
key-builders, `persist()` config); serializers of *persisted* shapes; static data
files that ARE the app's memory (`src/data/*.ts` catalogs).

**Facets:** `#persistence` — one per file containing storage call sites
(`prisma.*`, `localStorage`, `IndexedDB`, `AsyncStorage`, Redis get/set) inside
frontal/parietal/occipital files, with `queries`/`mutates` synapses toward the entity
or data_store node. This is how client-heavy apps surface their real data layer.

**Concepts:** entity nodes ("User", "Order") anchoring query facets; data_store
nodes derived from env/compose ("Postgres on Hetzner", "Redis", "S3", "Pinecone").

**Non-code:** per-environment store instances, seed datasets/fixtures/CMS spaces,
backup/retention *policy* (the executing cron is cerebellum), data dictionary/PII
classification, migration history.

**Boundaries:** vs frontal — shape change without meaning change → temporal · vs
parietal — data **at rest** → temporal; data **in flight** → parietal · vs
brain_stem — cache/DB *policy* and schema → temporal; client/pool *initialization* →
brain_stem · vs cerebellum — retention policy → temporal; the backup job → cerebellum.

**Population fix:** client-persistence content signals, `.prisma`/`.sql`/migration
parsers, `#persistence` facets, data_store concepts from manifest inventory.

### 2.3 Occipital Lobe — Visual & UI
*What the user literally SEES in steady state: structure, style, motion, assets, typography.*

**Test:** Does this element determine what the user perceives in steady state —
independent of the user's emotional moment? (Loading/error/empty/celebration
presentation belongs to limbic even though it renders.)

**Anchors:** components/pages/layouts (Next.js `page.tsx`/`layout.tsx` **by filename
rule, never a blanket `src/app` hint**; SwiftUI/composables/Flutter; server-rendered
email/PDF/receipt *templates'* visual layer — check before declaring an API-only app
occipital-empty; chat-transcript and markdown/streaming renderers in AI apps; Ink/TUI
components, table formatters, ANSI themes, help-text layout in CLIs); styling systems
(CSS/SCSS files, styled-components, tailwind *theme* parsed as a token_set node);
animations & assets (framer-motion variants, Lottie, SVG/canvas/WebGL, chart specs,
fonts, ARIA/focus structure).

**Facets:** rarely needed — occipital owns files; instead occipital anchors *shed*
facets (toasts → limbic, fetches → parietal, localStorage → temporal).

**Concepts:** design-system node, token_sets, screen/page inventory, brand assets.

**Non-code:** Figma tokens/frames bound to implementing components, `/public` assets,
brand palette and typography specs.

**Boundaries:** vs limbic — steady-state anatomy → occipital; user-state-moment
presentation → limbic (the Skeleton *component definition* is occipital; the
`isLoading` branch that renders it is a limbic facet) · vs parietal — template
visual → occipital; dispatch → parietal; emotional copy → limbic · vs frontal —
props→markup mapping → occipital; branching that changes what *happens* → frontal.
**Honest emptiness:** a pipe-filter CLI or headless API declares occipital
`not_applicable` after the template check — never force-fill.

### 2.4 Parietal Lobe — Integration & Senses
*Everything that moves data across the app's process boundary while a request or interaction is in flight.*

**Test:** Does this element carry data across the application's process boundary —
inbound (endpoints, webhooks, stdin, deep links) or outbound (fetch, SDK calls,
dispatch) — **while a request/interaction is in flight**? Off-request boundary work
is cerebellum; the connection machinery everything rests on is brain_stem.

**Anchors:** inbound — route handlers, controllers, resolvers' transport layer,
webhook receivers, gRPC, WebSocket/SSE (seed: `sessions_api`, `ws_handler`); push
receivers, deep links, platform channels (mobile); stdin contracts, signal handlers,
the CLI's argument surface/`--json` output/exit codes. Outbound — fetch/SDK wrapper
modules (Stripe, Twilio, Resend), OAuth flow choreography, upload/download,
import/export; **LLM provider adapters and their prompt templates, MCP clients/
servers, tool-execution HTTP** (seed: the claude/gpt/gemini adapters + templates +
registry are Areopagus's 14-node parietal population); subprocess spawns, clipboard/
OS hooks (CLI). Dispatchers — email/SMS/push *send* functions (transport only);
in-request queue *producers* (the consumer is cerebellum).

**Facets:** `#integration` — one per file with fetch/SDK call sites inside
components/hooks/services, with `calls`/`consumes` synapses toward the service node.
This is how frontend-only apps surface their sensory layer.

**Concepts:** third-party **service nodes** auto-created from package.json deps and
SDK imports ("Stripe", "OpenAI", "Supabase API"), each linked to its keying env vars;
the app's public API surface ("REST v1") as a node.

**Non-code:** external service accounts/dashboards, webhook registrations, OAuth app
registrations (client IDs; secret *values* are brain_stem), published API docs,
provider rate limits, n8n/Zapier endpoints.

**Boundaries:** vs brain_stem — the in-flight conversation with an external system →
parietal; connection machinery/credentials/token plumbing → brain_stem (OAuth dance →
parietal; JWT sign/verify → brain_stem) · vs cerebellum — in-request producer →
parietal; worker/consumer → cerebellum · vs CC — an adapter talking to the *outside
world* → parietal; a mapper translating between two *internal* regions → CC.
Endpoints are parietal anchors whose inner policy branches are frontal facets and
inner queries are temporal facets.

### 2.5 Cerebellum — Automation & Background
*Everything that runs with no user action in the loop, including tests and CI (rehearsals of the app).*

**Test:** Does this element execute without a user's direct action in flight —
triggered by time, queue backlog, events, watchers, or pipeline — including
everything that runs in CI rather than production? Ask **who calls it and when**: a
util invoked synchronously inside a request/render is NOT cerebellum.

**Anchors:** scheduled/queued work (cron handlers, BullMQ/Celery workers, retry/
backoff, batch sync/ETL — seed: `bullmq_workers`, `adversarial_review`,
`score_decay`, `competency_builder`; service workers, ISR revalidation; WorkManager/
BackgroundTasks; batch embedding pipelines, eval harnesses, unattended agent loops;
watch modes, daemons, git hooks); **tests — ONE anchor node per test file by
default** (the real Nudge drowned at 475 test-internal nodes), with `covers`
synapses feeding `health.test_coverage`; a manifest knob enables full granularity;
build/codegen scripts (package.json scripts, generators).

**Facets:** `#background` — one per file with `setInterval`/recurring-`setTimeout`/
`queue.add`/`requestIdleCallback` call sites, with `schedules` synapses toward the
pipeline/job node. (A debounce `setTimeout` in an interaction handler is UX timing,
NOT a background job — AST call context distinguishes.)

**Concepts:** pipeline nodes ("nightly digest") composing worker+queue+cron; CI
workflows parsed from `.github/workflows/*.yml`; named queues with schedule
semantics (the broker *server* is brain_stem).

**Non-code:** crontab/`vercel.json` cron entries, CI workflow definitions,
n8n/Zapier/GAS trigger workflows (spec §3.5), queue definitions, monitoring probes.

**Boundaries:** **NOT `/utils`, `/helpers`, `/lib`** — those path rules are deleted;
pure helpers classify by their own behavior · vs brain_stem — the pipeline/job →
cerebellum; the runner infrastructure (Docker, broker server, CI account) →
brain_stem · vs parietal — consumer → cerebellum; in-request producer → parietal ·
vs temporal — the aggregation job → cerebellum; what it persists → temporal.

**Population fix:** delete the utils rules; parse CI YAML/`vercel.json`/npm scripts;
remove `*.test.*` from default `ignore_patterns` (contradicts `include_tests: true`)
and actually wire `include_tests` into discovery (currently dead config);
`#background` facets; tests as capped anchors.

### 2.6 Brain Stem — Infrastructure & Core
*Whatever must work for ANYTHING to work: boot, build, deploy, config, secrets, auth machinery, connection clients, observability plumbing.*

**Test:** If this element failed or were misconfigured, would the app fail to boot,
build, deploy, authenticate, or stay secure regardless of any single feature?

**Anchors:** bootstrap/entry (`server.ts`/`main.ts`/bin entries, root provider
wiring, DI containers — seed: `fastify_server`, `config`, `prisma_client`,
`redis_client`, `docker_compose`, `logger`, `id_generator` all brain_stem); config/
env (typed config modules; **env_var nodes as app-wide singletons** — one
`JWT_SECRET` node with `configures` synapses to every reader, replacing per-file
duplicates); auth *core* (JWT sign/verify, session/cookie machinery, hashing — the
login *decision* is frontal; the external OAuth *dance* is parietal); security &
global handling (CORS/CSP/helmet, rate limiters, global exception handlers, error
boundary *mechanism* — its fallback UI is limbic; **logger core and `console.error`
plumbing move here from limbic**); build toolchain (`next.config`/`vite.config`/
`tsconfig`, Dockerfile/compose, package.json as a dependency-manifest node — via new
artifact parsers; spec §7.2 promised these and they were never built).

**Concepts:** environments (dev/staging/prod), deploy_targets ("Vercel project",
"Hetzner VPS"), DNS/SSL/domains, container images, runtime version pins.

**Non-code:** per-environment env vars (`.env.example` as schema of record), secrets
inventory (names/locations/owners, never values), DNS/SSL/hosting/CI accounts,
lockfile + top critical dependencies as nodes so upgrades can be simulated.

**Boundaries:** vs parietal — machinery/credentials → brain_stem; in-flight
conversation → parietal · vs temporal — client/pool instantiation → brain_stem;
schema/queries/policy → temporal · vs limbic — the catching mechanism → brain_stem;
what the user is shown when it catches → limbic · vs frontal — flag storage/plumbing
→ brain_stem; the branch acting on it → frontal.

**Population fix:** was starved purely by discovery (only `.ts/.tsx/.js/.jsx`
admitted): artifact parsers for Dockerfile/package.json/CI YAML/`.env.example`,
entry-point auto-tagging, env singleton dedupe, deploy_target/environment concepts
from the init interview (the scanner cannot see Vercel).

### 2.7 Limbic System — UX & Emotion
*How the user FEELS at moments of transition: waiting, failing, succeeding, arriving, deciding. THE canonical facet region.*

**Test:** Does this element shape how the user feels during a state transition —
waiting, failing, succeeding, arriving for the first time, or being interrupted/asked
to decide? Conditioned-on-user-state presentation → limbic even though it renders;
steady-state presentation → occipital.

**Facets (primary plane — limbic concerns almost never own files):** one
`#ux-feedback` satellite per component that fires `toast()`/snackbar/haptics, renders
`isLoading`/`isError`/empty branches, confirmation dialogs, optimistic-rollback
affordances, celebration triggers, retry prompts — detected via AST call expressions
and JSX conditional branches, **never raw regex** (the `/alert/i` →
`amygdala_alerts` false positive is the cautionary tale). Host component stays
occipital, linked via `composes`/`renders`.

**Anchors:** dedicated UX files — Next.js `error.tsx`/`loading.tsx`/`not-found.tsx`
by filename rule; onboarding flows/first-run wizards, ToastProvider,
NotificationCenter UI, settings/preferences, cookie consent, NPS widgets (seed:
`user_feedback`, `budget_warnings`, `loading_states`, `error_states`); permission
priming, app-rating prompts (mobile); "thinking…" streaming indicators, refusal/
clarification UX, graceful fallbacks (AI); progress bars, spinners, "did you mean",
confirmation prompts, first-run setup (CLI); user-facing error-message catalogs and
helpful 4xx *copy* (the handler stays parietal); inline validation *messaging* (the
rule is frontal).

**Concepts:** journey nodes ("first-run onboarding", "payment failure recovery")
composing members across regions; per-screen state matrix (loading/empty/error/
success coverage) whose gaps are visible; notification strategy (event → channel →
copy → urgency).

**Non-code:** journey maps/funnels, microcopy/i18n catalogs (`locales/*.json` parsed
into message-group nodes), notification matrix + email/push *content* templates,
empty-state/error-copy decks, delight-moment inventory.

**Boundaries:** vs occipital — user-state moment vs steady anatomy · vs parietal —
copy/timing/emotion → limbic; transmission → parietal · vs brain_stem — **NOT
observability**: `logger|console.error` signals and `/logging` move to brain_stem ·
vs frontal — the validation rule → frontal; what the user is told when it fails →
limbic.

**Population fix:** remove the observability false-positive signals; AST-based
`#ux-feedback` facets (`toast(`, `<Skeleton`, `isLoading ?`); filename rules; the
coverage check asks: "you built checkout — where are its loading/error/success
limbic nodes?"

### 2.8 Amygdala — Threat Memory
*Records of what actually FAILED in this codebase; earned by incident, never minted by scanning.*

**Test:** Does this element record something that actually went wrong or was proven
not to work in THIS codebase — such that future changes crossing its trigger nodes
must be warned? Membership is **earned through the Reflex loop**; scanning may only
*recall* existing memories, never create them.

**Elements:** `AmygdalaEntry` records per the existing schema, stored in
`amygdala-log.json`, **not as graph nodes** (the real Nudge stores 3 incidents as
`type:'function'` nodes — migrate them out); **one lightweight entry per FAILED fix
attempt** during debugging (severity low/medium, filled from the preceding
simulation) plus a closing entry with the *observed* cascade path; dormant nodes with
failure-linked `dormant_reason` (never delete); signature tripwires —
`prevention_rules.code_signatures[{pattern, message}]` that the scanner matches to
fire `amygdala_warning` *synapses* to the existing entry (the legalization of the
hardcoded `a98b3c4f` block, refactored to recall-only). Per-stack incident classes:
hydration mismatches, races (web); background-fetch kills (mobile); pool exhaustion
(backend); prompt loops, context overflow (AI); flag renames breaking scripts (CLI).

**Non-code:** postmortems distilled into entries; reverted commits/failed migrations
(`code_diff_ref`); **brownfield backfill via proposal queue** — git-revert/
fix-cluster/bug-label mining *proposes*, LLM/user *confirms* (mining never
auto-creates); performance-regression records; dependency pins with reasons; flaky
test quarantine with root-cause status.

**Rules:** populated ONLY by the troubleshooting loop + confirmed proposals.
Anticipated risks at genesis go into `cascade_paths` and `verification_checks` (the
seed's pattern), never the amygdala. If a trigger later fires and the change succeeds
with new safeguards, the entry moves to `status:'superseded'` — threat memory decays
honestly. Zero at scan time is CORRECT: render "0 entries — no incidents recorded
yet (healthy)", never "dark"; nudge if N debugging sessions pass with zero entries
(that means workflow Step 5 is being skipped).

### 2.9 Corpus Callosum — Cross-Region Bridges
*Primarily the DERIVED cross-region synapse view; node residency only for active translation artifacts that earn it.*

**Test (two conditions, both required):** Is this element consumed from ≥2 distinct
regions AND does its content encode a contract or translation *between* them — such
that if either connected region vanished it would have no reason to exist? For type
promotion, additionally require **data-in-motion** (crosses a serialization/process
boundary, or is an explicitly shared validation/event schema).

**Earns a node:** shared API request/response DTOs and Zod schemas imported by BOTH
the form UI and the API route; tRPC router type exports consumed by the frontend;
WebSocket message-type unions; queue message contracts; protobuf/OpenAPI schema
modules; tool/function-calling JSON schemas shared between planner and executor;
event buses/pub-sub hubs and event-name registries; boundary mappers whose SOLE job
is translation (webhook-payload→entity mappers, IPC bridges, deep-link→navigation
mappers). Expected honest population: **3–10 nodes per app** (the seed has zero).

**Explicit demotions (three-way type disposition):** local/prop types fold into the
owner's `metadata.parameters`/`state_shape` (no node); single-region exported types
inherit their consumers' region; only ≥2-region data-in-motion types promote.
Barrel re-exports → inherit. `/shared`, `/common` utilities → classify by own
concern. `.d.ts` → its subject's region. Widely-reused in-process enums → dominant
consumer's region. **Shared mutable state stays in its home region** (the seed puts
the Areopagus Workspace in frontal; its bridge-ness is the derived synapse view).

**Everything else cross-region is the derived view** — `cross_region` +
`regions_bridged` already exist on every synapse; `GET /api/synapses/cross-region`
is CC's primary product. Spec ground truth agrees: §3.9 "not a region itself",
§4.1's node region enum omits CC, §3.10 defines no CC coordinates. The 3D UI gains a
thin central band for the promoted few.

---

## 3. The LLM classification card

The nine tests (§2) plus these four tie-breakers ship verbatim in the workflow
prompt, so manual node creation uses the same taxonomy as the classifier:

1. **Utils — who-calls-when:** synchronous in a request/render → the concern's
   region (usually frontal); timer/queue/pipeline → cerebellum.
2. **UI — steady state vs user moment:** anatomy → occipital; how waiting/failure/
   success *feels* → limbic.
3. **Auth — three-way split:** external identity conversation → parietal; token/
   session machinery → brain_stem; authorization decisions → frontal. (Reassembled
   by the `security-sensitive` tag lens.)
4. **Transforms — meaning vs shape:** changes what data *means* → frontal; changes
   only shape/format → temporal (at rest) or parietal/CC (in motion).

**Tie-break rule:** on equal classifier scores, prefer the scarcer specific region
(limbic/temporal/cerebellum/brain_stem) over frontal/occipital/parietal.

---

## 4. Ontology decisions (contested calls, resolved)

1. **Utils/helpers/lib → NOT cerebellum.** Path rules deleted; per-symbol behavior
   decides; spec §7.4's own table already listed utilities under frontal.
2. **Types/interfaces → three-way disposition** (metadata / inherit / CC-contract).
   CC is not a dumping ground; the seed has zero CC nodes.
3. **Sub-file concerns → facet nodes**, capped at one per (file × foreign region),
   AST-detected, parent-linked, dormant-not-deleted. (Per-call-site nodes rejected:
   node explosion; tags rejected: invisible to impact simulation.)
4. **Dual-region components:** the anchor keeps its primary region and *sheds
   facets* — a checkout form is occipital with limbic `#ux-feedback`, temporal
   `#persistence`, and parietal `#integration` facets. Simulation traverses facets,
   so blast radius crosses regions honestly.
5. **Observability → brain_stem** (logger, `console.error`, `/logging`). Verified:
   the demo's entire limbic population was this false positive.
6. **Tests → cerebellum, one anchor per test file** (manifest knob for full
   granularity), `covers` synapses feed test_coverage. Decided by data: 475/477.
7. **Frontal default retained but instrumented:** confidence recorded, sub-0.5 into
   review queue, ties break to the scarcer region.
8. **Amygdala: incident-only writes; scanner is recall-only.** Genesis risks go to
   cascade_paths/verification_checks.
9. **Env vars: app-wide singletons** with `configures` synapses (+ migration).
10. **Planned nodes:** `status:'planned'` (the seed's 53 nodes prove the pattern);
    planned synapses simulate at 0.5× strength, reported as separate
    `planned_impact`, excluded from risk-score critical/high tallies.
11. **Origin discipline:** `metadata.origin ∈ scan|seed|llm|incident`; re-scans may
    only replace `origin:'scan'` nodes (fixes the analyzeFile wipe that would erase
    all enrichment on first save); scanner ids become deterministic hashes of
    (file_path, type, name).
12. **Next.js hints:** remove `src/app`→parietal, `src/lib|src/utils`→cerebellum,
    `src/types`→CC from init; replace with filename rules (`route.ts`→parietal;
    `page/layout.tsx`→occipital; `error/loading/not-found.tsx`→limbic). Latent bug
    for every future Next.js onboarding.
13. **Honest emptiness is manifest-durable:** archetype + expected_region_profile +
    `not_applicable` acknowledgments live in the manifest (git-reviewable), so
    dark-region alerts stop firing without graph pollution.
14. **Multi-language contract:** scanner covers TS/JS; other stacks run scanner-less
    with seed/LLM-maintained anchors plus fingerprint drift nudges. Tree-sitter is
    roadmap, not a blocker.

---

## 5. The three plug flows

### 5.1 GENESIS — new app (the brain exists before the code)

1. `plexus init --archetype <web|fullstack|mobile|api|ai_agent|cli>` scaffolds
   `plexus-integration/` with stack-appropriate hints, the archetype's
   expected_region_profile, and an inventory section (services, environments,
   deploy_targets, journeys) materialized as concept nodes.
2. **Genesis Interview** (`plexus interview`; workflow v3 section) — nine questions,
   one per region: what does the app **DECIDE** (frontal)? **REMEMBER** (temporal)?
   what does the user **SEE** (occipital)? what does it **SENSE/SPEAK** (parietal)?
   what runs **UNATTENDED** (cerebellum)? what does it **RUN ON** (brain_stem)? how
   should waiting/failure/success **FEEL** (limbic)? what **BRIDGES** regions (CC)?
   what could go **WRONG**? — answers to the last become cascade_paths and
   verification_checks, never amygdala entries.
3. The LLM converts spec + answers into a seed connectome exactly like the
   Areopagus seed: `status:'planned'` nodes with slug ids, contracts
   (inputs/outputs/depends_on), `origin:'seed'`, intended file_path, cascade paths,
   verification checks. Proven result: healthy 7-region distribution, because
   **roles, not paths, drive placement**.
4. **Per-feature loop:** the 7-step workflow as written — Step 1 consults planned
   nodes; Steps 2–3 simulate on the planned graph (0.5×, separate reporting);
   Step 4 writes code at the planned path.
5. **Activation:** the watcher triggers analyzeFile; the reconciler matches scanned
   symbols to planned nodes by (file_path, name) and merges — planned id survives,
   status→active, line_range fills. Unmatched planned nodes remain visible as
   planning debt.
6. Step 5 additionally creates what the scanner can't see: facets the LLM just
   wrote, journey/feature nodes, service nodes, env singletons.
7. Step 6 gains the **brain-utilization check** (`plexus coverage`): "temporal has 0
   active nodes but the interview said the app remembers preferences — persistence
   was skipped or the plan changed; update code or profile." **The nine regions
   become a build checklist.**

### 5.2 GRAFT — existing app (scan first, enrich what the scanner is blind to)

1. `plexus init` auto-detects archetype/frameworks from package.json/folder shape
   and installs the matching hint pack.
2. **Manifest wizard** before first analyze: the LLM walks the tree, proposes
   per-directory hints and a region profile, user confirms. Hints weigh 3.0 — the
   classifier's strongest signal — making this the highest-leverage ten minutes of
   onboarding.
3. `plexus analyze` runs the fixed pipeline: per-symbol voting, corrected rules,
   scarce-region tie-break, confidence recording; artifact parsers (package.json,
   Dockerfile, compose, `.env.example`, CI YAML, `vercel.json`, `schema.prisma`,
   tailwind theme, `locales/*.json`, CSS); facet extraction; env dedupe; capped test
   anchors; CC contract-promotion pass.
4. **Utilization/imbalance report** (`plexus report`, `GET /api/regions/utilization`,
   persisted to `imbalance-report.json`): per-region counts vs profile,
   utilization_score, the low-confidence review queue, and candidate sources per
   dark region ("temporal at 1% vs expected 12% — candidates: localStorage in 7
   files, schema.prisma unparsed").
5. **LLM enrichment pass** (workflow "Phase 0"): creates missed facets, the concept
   layer, resolves the review queue, and mirrors every correction into manifest
   `custom_overrides` so re-scans agree. All `origin:'llm'`, guaranteed to survive
   re-scans by origin-aware deletion.
6. **Amygdala backfill by proposal queue** (mining proposes, human/LLM confirms);
   migrate malformed legacy amygdala data.
7. Baseline snapshot; thereafter identical to Genesis: watcher + 7-step workflow +
   utilization check.

### 5.3 REFLEX — troubleshooting (the amygdala's only writer, the brain's fastest learner)

1. Bug arrives → locate symptom nodes (`GET /api/nodes/search`), run
   `POST /api/amygdala/check` on them (prevention rules auto-surface: "this broke
   the same way in AMG-014"), review dormant neighbors — "we already tried that" =
   pivot signal.
2. Simulate impact from suspects; the BFS already checks reached nodes against the
   amygdala and feeds risk_score; blast radius ranks hypotheses. The mandatory
   pre-flight header gates any code.
3. **Hypothesis loop — the key population rule:** every FAILED fix attempt gets an
   immediate lightweight amygdala entry; abandoned approach code goes dormant with
   `was_connected_to` preserved. Never modify a high-influence node for a
   low-influence problem — extend instead.
4. Fix lands → closing entry: what_broke, the OBSERVED cascade path (prediction vs
   observation feeds Step 7 engine feedback), rollback method, lessons,
   prevention_rules (+ optional code_signatures).
5. Re-simulate from the fixed node; run stored verification_checks
   (`plexus verify`). Each 3-strike rewind also deposits an entry — even failed
   sessions grow the brain.
6. **Compounding:** entries raise `amygdala_warnings`, drop stability, pulse red in
   the 3D view, and auto-surface in every future pre-flight crossing a trigger node.
   Superseded entries decay honestly.

---

## 6. Full-brain utilization: metrics & honesty

**Archetype profiles** (manifest: `target_app.archetype` +
`regions.expected_region_profile`, qualitative tiers substantial/moderate/minimal/
none, auto-filled and overridable). Indicative shares (v1 hand-authored; recalibrate
from accepted onboardings):

| Archetype | Dominant | Notes |
|---|---|---|
| fullstack web | frontal 20–30 · occipital 20–30 · parietal 10–18 | temporal 8–15, brain_stem 6–12, cerebellum 5–12, limbic 5–12, CC 3–10 nodes |
| api_backend | parietal 20–30 · frontal 20–30 · temporal 12–20 | occipital minimal (templates only — check first), limbic minimal (error-copy) |
| ai_agent | parietal 20–28 (adapters/tools) · frontal 18–25 (planners) | temporal 10–18 (memory/vectors), cerebellum 10–18 (pipelines/evals) |
| mobile | occipital 25–35 · frontal 20–30 | limbic 8–15 |
| cli | frontal + brain_stem dominant | occipital none unless TUI; limbic minimal-but-nonzero |

**Metrics:** `utilization_score = 1 − total-variation distance` between actual and
expected shares over the 8 scan-populable regions. Per-region status ∈
{populated, sparse, dark, not_applicable}. Amygdala special-cased ("0 = healthy" +
staleness nudge). Planned-vs-active ratio reported separately as planning debt.

**Dark-region detection:** dark = below the sparse floor AND candidate sources exist
(unparsed schema.prisma, storage calls in N files, CI YAML present).
`not_applicable` only when acknowledged in the manifest.

**Surfaced at:** `plexus analyze` summary + `plexus report` (imbalance-report.json);
`GET /api/regions/utilization`; 3D legend badges ("dark — N candidates", "N/A for
this app type", amygdala healthy-empty); workflow Step 6 (utilization check) and
Step 7 (create the missing nodes or mark not_applicable with a reason).

---

## 7. Engine change plan (ordered)

1. **Per-symbol content classification** — classifyRegion takes the symbol's own
   text at all 8 call sites; returns {region, confidence}; record
   `metadata.classification_confidence`. (Largest precision win: the analyzer's own
   `CodeAnalyzer` landed occipital because the file contains `className` regex
   strings.)
2. **Classifier rule surgery** — delete utils/lib→cerebellum and types→CC path+type
   rules; move logger/console.error/`/logging` to brain_stem; add TYPE_REGIONS
   defaults for function/module/class/constant; fix the tie-break (strict `>` +
   insertion order currently hands ties to frontal); add /adapters→parietal,
   /repositories→temporal, /screens→occipital; call-shaped word-bounded content
   signals per §2.
3. **cli.ts stack-aware manifest init** — auto-detect archetype; filename rules
   replace blanket hints; fix `*.test.*` vs `include_tests` contradiction; new
   manifest fields (archetype, expected_region_profile, inventory, facet knobs).
4. **discovery.ts artifact parsers** — package.json, Dockerfile/compose,
   `.env.example`, CI YAML, `vercel.json`, `schema.prisma`, tailwind theme,
   CSS/SCSS, `locales/*.json` (implements spec §7.2, promised and never built).
5. **types/index.ts contract extensions** — NodeType += facet|feature|flow|journey|
   service|entity|data_store|deploy_target|pipeline|contract|template|token_set|
   command; status += 'planned'; metadata += origin/confidence/parent_node_id/
   contract; prevention_rules += code_signatures; manifest fields.
6. **Facet extraction pass** — AST call-expression + JSX-branch detection; one per
   (file × foreign region); deterministic ids; dormant on signal disappearance.
7. **Env singleton dedupe** + migration for existing connectomes.
8. **CC contract-promotion pass** after buildRelationships (three-way disposition).
9. **Origin-aware re-scan + planned-node reconciler**; deterministic scanner ids.
10. **Amygdala recall-only** — replace the hardcoded a98b3c4f block with the
    code_signatures engine; migrate legacy incident nodes.
11. **Planned physics in the simulator** (0.5×, separate planned_impact).
12. **New surfaces** — utilization API + `plexus report` / `verify` / `interview` /
    `onboard` / `incident` CLI commands.
13. **3D legend honesty rendering** + thin central CC band.
14. **Workflow prompt v3** — Genesis Interview, Phase 0 onboarding, Step 5
    scanner-blind upkeep checklist, Step 6 utilization check, Reflex rules, and the
    classification card (§3) verbatim.
15. **Migration script** for existing connectomes (Plexus self-scan, Nudge,
    Areopagus) behind a snapshot.

---

## 8. Projections (what the fixes should produce)

**Plexus self-scan** (the current demo dataset, ~174 → ~185–215 nodes):
CC 39 → 5–8 (true wire contracts like PlexusNode/PlexusSynapse promote; ~30 passive
types re-home or demote) · limbic 8 → 2–4 honest (false positives leave; UIOverlay
`#ux-feedback` facets arrive) · cerebellum 2 → 10–14 (test files, npm scripts,
watcher) · temporal 4 → 10–14 (sqlite + persistence facets + connectome.db
data_store) · brain_stem 4 → 16–22 (package.json, tsconfig, Dockerfile, configs,
bootstrap, logger) · parietal 41 → 40–46 (the 37 endpoints are legitimate) ·
occipital 23 → 22–28 · frontal 53 → 36–44 · amygdala 0 = healthy.
Utilization ~0.55 → ~0.85.

**Real Nudge** (817 → ~420–500): cerebellum 477 → ~105–120 (95 test files collapse
to anchors) · frontal 223 → ~150–185 · temporal 2 → ~12–20 · limbic 0 → ~8–15 ·
brain_stem 39 → ~48–60 · parietal 25 → ~32–40 (+ OpenAI/Gemini service nodes) ·
CC 0 → ~2–5 · amygdala: 3 legacy entries migrate out of the node graph and grow
~1–3/week through Reflex.

**The discipline:** the brain lights up not by inflating counts but by
(1) deleting false positives, (2) surfacing sub-file reality as capped facets,
(3) admitting non-code reality via artifact parsers and concept nodes, and
(4) declaring honest emptiness where the archetype warrants it.
