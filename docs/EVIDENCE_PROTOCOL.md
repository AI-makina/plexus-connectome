# The Evidence Protocol — Specification (v0.9 draft)

*The durable architecture beneath Plexus. The brain anatomy is the human window; THIS is
the contract. Written so another engine could implement it (Roadmap 2.3).*

## Purpose

Ground an AI coding assistant in verifiable project truth so that it
(1) never asserts an identifier the evidence store cannot confirm,
(2) never repeats a recorded failure,
(3) never changes code blind to its dependency blast radius,
(4) deposits what it learns, so the store compounds.

## The five obligations

An Evidence Protocol implementation provides five capabilities; a compliant AI session
exercises all five:

### 1. FACTS IN — multi-source, provenance-typed ingestion
Every fact carries `origin`, and origin determines its physics:

| Plane | origin | Lifecycle |
|---|---|---|
| **Map** | `scan` | Derived from code/artifacts by deterministic pipelines. Replaceable by re-derivation. Deterministic identity: same (file, type, name) → same id, forever. |
| **Memory** | `incident` | Born only from the failure loop. Append-only; re-scans may never erase it. Supersession is explicit, never silent. |
| **Belief** | `llm`, `seed`, `mined`, `command` | Proposed by an intelligence. Decays; seeks confirmation; may never claim `scan`; never amplifies risk scoring until confirmed. |

Ingestion sources, in trust order: deterministic scanners (AST, artifact parsers) →
user-confirmed configuration (manifest hints/overrides) → declared agent deposits →
mined proposals (which PROPOSE, never create).

### 2. COMPACT CONTEXT OUT — the consultation brief
The primary read surface is a ranked, hard-capped brief (~1,500 tokens): what the target
IS, what BREAKS (blast radius with the carrying relationship), what FAILED before
(memory hits), what was ALREADY TRIED (dormant neighbors), and where to PULL more.
Raw dumps are the pull layer, never the default. The brief states the store's own
**maturity** (provisional maps advise; enriched maps are authoritative) — mandatory
consultation of a wrong store amplifies error, so the store must disclose its trust level.

An **existence oracle** answers identifier claims: exists / missing / dormant-with-reason /
ambiguous / out-of-scope. Existence is confirmed by exact matching only; fuzzy matching
may suggest, never confirm. Categories the store does not hold answer "cannot verify",
never "missing".

### 3. GUARDED WRITES
Every mutation is schema-validated and policy-checked BEFORE any state changes; failures
quarantine rather than block the pipeline. Writes are attributable (session capability
tokens; local-only transport). Semantic policies are enforceable facts, not conventions
(e.g. incident memory cannot be written as map nodes). Provenance is immutable after
creation.

### 4. CLAIM VERIFICATION
After execution, the AI's claims are diffed against reality: claimed-created symbols
against the store, touched files against content fingerprints. Mismatch blocks "done".
Consultations, checks, and simulations land in a **ledger**; a chokepoint (pre-commit →
CI) flags changes to files nothing consulted. Drift from out-of-band edits is detected
by fingerprints and absorbed by re-derivation — never punished.

### 5. FAILURE LEARNING
Every failed attempt deposits a memory record: what was attempted, what broke, the
observed cascade, prevention rules with trigger nodes that auto-surface in every future
consultation crossing them. Abandoned paths go dormant with their reason (retrieval:
"we already tried that"). Prediction-vs-observation feedback tunes the impact model
(learned strengths: bounded, audited, decaying — evidence only, never raw opinion).

## The impact model

Relationships carry a small closed set of **families** with distinct propagation physics
(dependency, invocation, data exchange, contracts, learned co-failure) — rich labels are
metadata for the AI to read, not physics for the engine to honor. Contract edges
propagate breaking changes at full strength regardless of distance; learned co-failure
edges always surface. Binding-time metadata amplifies risk for cached-at-load
dependencies. Simulation is BFS over weighted edges with per-family decay; dry-run
simulation is side-effect-free.

## Enforcement doctrine

Incentive-first, gates for the tail: the brief + oracle must be the AI's cheapest path
to a correct answer, so consultation happens by preference. Mechanical layers catch the
rest — session-start injection (MCP), token-gated writes, the ledger, the git chokepoint,
claim verification. No layer can hard-stop an agent with raw filesystem access; every
layer's failure mode hands off to the next. **A provisional store never blocks; blocking
authority is earned per-subgraph through multi-source confirmation.**

## Honesty requirements

Region/category emptiness is reported with candidates or acknowledged as
not-applicable — never silently rendered as coverage. Zero incidents at scan time is
healthy; debugging sessions that deposit nothing are a protocol violation the reporting
surface must call out. Every bounded list discloses its truncation.
