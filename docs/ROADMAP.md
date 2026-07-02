# Plexus Roadmap — The Evidence Protocol

**Sources:** the Areopagus deliberation (2026-07-02, three-model synthesis), the four-agent
engine verification of its claims, and the Region Taxonomy & Plug Protocol v2
(docs/REGION_TAXONOMY.md). This document supersedes scheduling in both earlier docs;
the taxonomy remains the classification contract.

**North star:** reduce AI hallucination in app-building to near zero. The AI never asserts
an identifier the connectome can't confirm, never repeats a recorded failure, never changes
code blind to its blast radius. Plexus must be the AI's *cheapest path to a correct answer*
(incentive) with mechanical backstops (gates) — never just a prompt instruction.

**Governing principles (from the deliberation, verified against the engine):**
1. **Fact-keyed policy binding** — interrupts and gates key to facts (contract edges,
   incident trigger nodes, parsed declarations), never region membership. Regions are the
   human window, routing lenses, and honesty mechanics.
2. **Provenance planes** — map facts (scan-origin, rescan-replaceable), memory facts
   (incident-origin, append-only), belief facts (LLM/mined-origin, decaying,
   confirmation-seeking). `metadata.origin` is the governing axis of trust.
3. **Maturity-gated authority** — provisional brains advise and ask; only multi-source-
   confirmed subgraphs may block. A wrong brain must never gate.
4. **Formation over vocabulary** — the 27-type synapse schema stays as metadata; engine
   physics reads 5 families. The real work is assigning rich edges (parsers, LLM proposals,
   learned evidence), not inventing types.
5. **Honest scope** — claim-check answers "out of scope — cannot verify" rather than
   "missing" for categories the graph doesn't hold; empty regions render as honest, not dark.

---

## PHASE 0 — Protocol foundations [NOW, days]

The five moves everything else assumes. All verified implementable on the current engine.

| # | Item | Key details | Proof metric |
|---|------|-------------|--------------|
| 0.1 | **Write-path hardening** | Hand-rolled validators (no new deps) on REST writes + command queue, applied BEFORE any in-memory mutation. Semantic policy: nodes may never claim region `amygdala` (incidents go through amygdala entries only); synapse endpoints must exist; strength clamped to [0,1]. Boot-generated session token (file + `GET /api/session`), required on mutating routes; `PLEXUS_NO_AUTH=1` escape hatch. Bind API+UI to `127.0.0.1` (kills LAN/webpage exposure); CORS allowlist to the UI origin. Command queue: per-command try/catch, id backfill, quarantine of failed commands to `plexus-commands-failed.json` (fixes the verified poison-command retry loop). Fix `/api/feedback` hardcoded path. | Zero malformed writes accepted; the §1.4.1 corruption class mechanically impossible; a poison command quarantines instead of blocking the queue. |
| 0.2 | **Deterministic node identity + origin** | Scanner node ids become stable hashes of (file_path, type, name); every analyzer node stamped `metadata.origin='scan'`. `analyzeFile` wipe becomes origin-aware (only replaces scan-origin nodes; enrichment survives). Keystone: snapshot diffs across rescans, per-node confidence ledgers, and amygdala trigger_nodes all break without it. | Re-scan of an unchanged file produces zero node-id churn; seeded/LLM nodes survive rescans. |
| 0.3 | **Claim-check (existence oracle)** | `POST /api/claim-check`: exact case-sensitive match first (fuzzy may NEVER confirm existence — the shipped Fuse index would stamp near-miss hallucinations "exists"), case-mismatch detection, file-path-disambiguated candidates for duplicate names, dormant-with-reason ("we already tried that"), out-of-scope honesty for unverifiable categories, fuzzy top-1 only as a labeled suggestion. | Invented-identifier rate per feature trends to zero; telemetry yields the hallucination class-distribution baseline. |
| 0.4 | **Consultation brief ≤1,500 tokens** | `POST /api/consult` replaces raw JSON as the primary product: target cards, dry-run blast top-K with carrying edge, amygdala prevention-rule hits, dormant neighbors, risk verdict, pull handles. Requires a `dryRun` simulate flag (today every simulate pollutes history + disk). Progressive truncation to the cap. | Consult cost below grep-equivalent; skip-rate falls; fewer references to nonexistent symbols. |
| 0.5 | **Consultation ledger + git hook (warn-only)** | New `consultations` table written by consult/claim-check/simulate. `plexus hook-install` / `hook-check`: staged files vs recent consultations, warn-only. The substrate for Phase 1's chokepoint. | % of file edits covered by a consultation; warn output visible in real commits. |

## PHASE 1 — The dependable loop [NEXT, weeks]

| # | Item | Key details |
|---|------|-------------|
| 1.1 | **MCP server** | `session_open` (300-token project brief — the first response of a session is already mediated), `consult`, `simulate`, `claim_check`, token-gated `write_file`/`apply_patch`, `deposit_amygdala`, `reconcile`. Thin proxy over the REST API (avoid double-owning the SQLite WAL). Rules-file generator (CLAUDE.md / .cursorrules) as degraded mode for non-MCP assistants. |
| 1.2 | **5-family physics** | `family` derived from type (DEPENDS_ON / INVOKES / EXCHANGES / CONTRACTS / CO_FAILED_WITH); 27 labels stay as subtype metadata. Exactly one behavioral site reads types today. Fix verified bugs: reverse-traversed hops always get binding multiplier 1.0; the hardcoded amygdala_warning edge ships strength 3.0 on a 0–1 scale; reverse traversal only reaches depth 1. CONTRACTS propagate at full strength; unknown type strings map to a default family. |
| 1.3 | **Provenance planes + maturity score** | Trust physics on `origin` (0.2 ships the substrate): rescans replace only map facts; memory facts append-only; belief facts decay. Maturity = fingerprint freshness × multi-source confirmation × utilization; below threshold briefs are advisory, above they may gate. Store `last_verified` inside the health JSON blob (no schema migration). |
| 1.4 | **Artifact parsers (T2)** | package.json (dependency-manifest node, SDK deps → parietal service nodes, scripts → cerebellum), Dockerfile/compose, `.env.example` (env schema; singletons per taxonomy), CI YAML + vercel.json crons, schema.prisma (one temporal node per model), tailwind theme (token_set), CSS/SCSS, locales. Unlocks Parietal/Brain-Stem pre-flight lenses AND widens claim-check scope. Shared item with taxonomy engine plan #4. |
| 1.5 | **Claim-diff verification (Step 6)** | The AI's claims (created/touched nodes, files) diffed against fingerprints + actual graph writes; mismatch blocks "done". Reflex: every failed fix auto-drafts an amygdala entry from the failing diff + error, one-line confirm. |
| 1.6 | **Region policy packs (fact-keyed)** | Amygdala interrupt cards in any brief whose blast touches a trigger node; Frontal invariant registry (≤10 declared invariants); Temporal schema-truth cards (from 1.4 parsers); Parietal/Brain-Stem external-surface + env existence checks (also from 1.4). Limbic one-liner in briefs. |
| 1.7 | **Graft ritual + demo** | `plexus onboard`: manifest wizard → scan → imbalance report → demo ritual (the user's actual next task, consulted vs unconsulted, side by side). Git mining v1: reverts + fix-clusters on the 20 most-changed files → proposal queue (belief facts, non-interrupting, auto-dormant ~30 days unconfirmed). |
| 1.8 | **Taxonomy classifier v2** | The remaining taxonomy engine plan: per-symbol content voting, rule surgery (utils/types/observability), stack-aware manifest init, facet extraction (AST), env singletons, CC contract-promotion pass, planned-node physics (0.5×), workflow prompt v3 with the classification card. |

## PHASE 2 — Learning & the librarian [DEEP]

| # | Item | Key details |
|---|------|-------------|
| 2.1 | **Evidence-learned strength** | Git co-change matrix + incident co-failure create/strengthen CO_FAILED_WITH; Step-7 simulation-accuracy feedback adjusts path strengths (bounded ±0.05, floors/ceilings, 90-day half-life on learned components, full audit log). Confidence tracked separately from strength. |
| 2.2 | **Deterministic librarian** | Embedding-based brief relevance ranking; diff-watcher producing update *proposals*; batched cheap-API enrichment. Hard bounds: never writes code, never auto-confirms belief facts, never blocks on its own judgment. A small local model only when brief-quality metrics justify it. |
| 2.3 | **Evidence-protocol spec** | Formalize the protocol (facts in → compact context out → guarded writes → claim verification → failure learning) as a document other engines could implement. The anatomy stays as the human window. |

## Killed (decided, do not resurrect)
Unvalidated/unauthenticated writes · raw JSON as the primary consult surface · 27-type
propagation physics · region-membership-keyed enforcement · regex facet detection ·
genesis-time amygdala writes · prompt-level 3-strike/re-read theatrics once mechanical
layers land · further 3D investment (keep what ships, freeze the line).
