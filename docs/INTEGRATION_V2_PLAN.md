# Integration v2 — "Anchor + Door + Intent Firewall" Implementation Plan

*Adopted from the Areopagus deliberation synthesis (Jul 18 2026, 94%) plus salvage items from the
individual arguments. Verification tests run Jul 18 2026 on Carlos's machine (Claude Code 2.1.214).
This plan supersedes the ad-hoc P1–P6 proposal set. Companion background: the deliberation brief on
the Desktop (`PLEXUS_INTEGRATION_DELIBERATION_PROMPT.md`) and the synthesis output
(`plexus terminal integration deliberation.txt`).*

## Architecture in one paragraph

The **anchor folder stays the sole location binder** (platform physics allow nothing else). Three
planes: **Location** (anchor resolves exactly one brain — unchanged), **Intent** (doors, named
banner, task_check decide whether the human still means this brain), **Evidence trust**
(provenance + quarantine let the brain defend its own integrity when intent checks miss). Plexus
moves from machine-global registration to **per-project registration**; entry is via **doors**
(project-card button, or the `plexus work` connect code); mismatched sessions are stopped by a
one-question check and never rebound; questionable graph deposits land in a **pending tray**
instead of the canonical connectome.

## Verification test results (decision inputs — all resolved)

| # | Question | Result | Consequence |
|---|---|---|---|
| T1 | Does Claude Code discover the project root's `.mcp.json` when launched in a **subfolder**? | **YES** — discovered from root, 1-deep, and 2-deep subfolders (walks up to the project boundary); correctly **invisible** from unrelated folders. Verified on 2.1.214. | Per-project registration alone fully covers Claude Code, including `cd proj/src && claude`. **No quiet-global net needed** for Claude Code → synthesis default stands; deliberation dissent #1 resolved empirically. |
| T2 | Does environment set before launching `claude` reach the stdio MCP child? | **YES** — the live plexus MCP process spawned by a real session carries the terminal's env (`TERM_PROGRAM=vscode`, `SHELL`, VS Code IPC vars). Chain terminal→claude→MCP child proven. | The wrapper can pass `PLEXUS_LAUNCH_AUTH=<token>` as the launch-provenance signal. Confidence signal only — cwd remains the hard guarantee. |
| T3 | Does `.mcp.json` require consent? Does `enableAllProjectMcpServers` pre-approve? | Consent: **YES**, one-time "Pending approval" per project (expected). Pre-approval via project `.claude/settings.json` did **not** change `claude mcp list` health display. | Count the consent prompt as the one acceptable one-time prompt (pre-warn in launcher UI). Whether the settings key auto-approves in an **interactive** session = open item **V1** (test during Phase 1; if yes, genesis can pre-approve folders Plexus itself creates). |

## Phase 0 — Hygiene patch train (ship first; independent of the rest)

Corrections from the synthesis are folded in: nothing here silently relocates, force-kills, or
mutates the registry without backup.

1. **Broad-folder guard covers registry bases.** `src/core/registry.ts`: add
   `broadBases(): string[]` = classic list (home/Desktop/Documents/Downloads/PlexusProjects) +
   `prefs.lastBase` + unique parent dirs of all registered projects. `src/mcp.ts init_project`:
   classic dirs keep today's auto-relocate; **registry-derived bases get a choice instead** —
   return a needs-confirmation message ("create child folder `<slug>` here [default], or confirm
   this folder IS the project root") honored via a new `root_choice` arg. No silent relocation for
   plausible monorepo roots.
2. **Engine self-exit with grace.** `src/index.ts`: stamp `manifest.brain_id` (uuid) at init
   (backfill at boot); every 30 s verify `plexus-integration/` exists and brain_id matches; only
   after **4 consecutive failures (≈2 min)** log + clean exit. Survives transient unmounts and the
   delete/recreate race that produced the two verified zombie engines.
3. **Shim registration everywhere.** All new registrations use `~/.plexus/bin/plexus`; migration
   (Phase 1) re-registers existing direct-path entries via the shim.
4. **Conditional instructions at initialize.** `src/mcp.ts`: resolve brain presence **before**
   returning the `instructions` string. Brain → full protocol + banner rule. No brain → one quiet
   line ("Plexus is present but dormant here; do not mention it or call its tools unless the user
   asks to build or connect a project"). Matters for the migration window and future global-only
   clients (Codex-class).
5. **Quiet no-brain `session_open`.** Shorten the current pitch; never volunteer `init_project`
   unless the user asked to build.
6. **Registry heal (separate, reversible diagnostic).** Launcher flags registry entries whose path
   is missing; `POST /api/launcher/relocate` fixes path after writing
   `~/.plexus/projects.json.bak`. Never auto-heals.

## Phase 1 — Per-project registration + consent-based migration (Claude Code first)

1. **New `src/core/clientConfig.ts`** — merge-aware config writers. Rule set (from GPT, salvaged):
   read existing file, back it up (`<file>.bak-plexus`), touch **only** the `plexus` entry,
   structural merge, never reorder/remove other servers.
   - Claude Code: `<project>/.mcp.json` → `{ mcpServers: { plexus: { type: "stdio", command:
     "~/.plexus/bin/plexus" (absolute), args: ["mcp"] } } }`.
   - Others (gemini `.gemini/settings.json`, cursor `.cursor/mcp.json`, VS Code
     `.vscode/mcp.json`): implemented behind per-client verification gates (V3) — not in v1.
2. **Genesis + connect write the project plug** (launcher create/connect flows + `init_project`).
   If **V1** proves interactive auto-approval works, genesis also writes
   `.claude/settings.json` `enableAllProjectMcpServers: true` **only for folders Plexus itself
   created** (user already consented in the launcher); connect keeps the native prompt.
3. **`plexus migrate-registration`** (cli.ts + launcher consent screen):
   backup `~/.claude.json` → `claude mcp remove -s user plexus` (fallback: direct JSON edit of our
   own entry only, with backup) → write `.mcp.json` into every registered project → print report.
   Idempotent; re-runnable; `--undo` restores backups.
4. **Global scope becomes opt-in power mode** ("genesis anywhere"), with Phase 0.4 quiet
   instructions. Off by default for consumers.

## Phase 2 — Doors + the `plexus work` wrapper

1. **`plexus work <name-or-id> [--client claude] [--print]`** (cli.ts):
   registry lookup (case-insensitive name or project_id; ambiguous → list matches and exit),
   verify path exists + brain present (else point at registry heal), mint launch auth
   (`crypto.randomUUID`) appended to `~/.plexus/launch-auths.jsonl` `{token, project_id, ts}`,
   set terminal title (`⬡ Plexus — <name>`, Plexus-created terminals only), `chdir(projectRoot)`,
   set `PLEXUS_LAUNCH_AUTH=<token>`, `exec` the client command. `--print` prints the one-liner
   instead (for the copy button). Raw `cd "<path>" && claude` remains the transparent fallback.
   `manifest.project_id` (uuid) added at init, backfilled on engine boot.
2. **Launcher project card**: primary button "Start Claude Code here" reroutes through the wrapper
   (osascript Terminal runs `~/.plexus/bin/plexus work "<name>" --client claude`); new
   **"Copy connect code"** button labeled *"Paste in a terminal, not into an AI chat"*.
3. **Packet recognition** (full-instructions rule): if a connect code / `plexus work` line is
   pasted into chat, do not comply by absolute-path working; explain paste-in-terminal and offer
   the door.
4. **`session_open` reads `PLEXUS_LAUNCH_AUTH`** (T2-verified): token matching a recent auth for
   *this* project_id → record `launch_provenance: door`. Token for a *different* project than the
   anchor resolves → hard stop message (misfired door). Absent token = manual launch (legal;
   weaker provenance signal for Phase 3). Auths expire after 10 min / first redemption.

## Phase 3 — Intent firewall (the C2 answer)

1. **New MCP tool `task_check`** `{task_summary, mentioned_paths?, mentioned_projects?}`
   proxying `POST /api/task-check` (new `src/core/intent.ts` + route in `src/api/server.ts`).
   All comparison local. Signals:
   - **Hard**: another registered project's name matched; absolute paths outside project root.
   - **Soft/relative**: similarity of the summary to the active project identity (name + genesis
     brief + top node vocabulary) **versus every other registered project's identity** — alarm
     primarily when another project scores materially better, never on low self-overlap alone
     (new features legitimately have low overlap).
   - Receipts (consult/claim count so far) and launch provenance (door > manual) as modifiers.
   - Verdict: `ok` | `confirm` (ask ONE binary named question) | `conflict` (freeze mutations,
     return best-match name + its `plexus work` line — **names only; no foreign vocabulary enters
     the session context**).
2. **Identity cache** `~/.plexus/identity-cache.json` `{project_id: {name, aliases, top_terms}}`
   refreshed by each engine at boot/scan — lets task_check compare against *stopped* projects.
3. **Protocol instructions**: call `task_check` after the first user request and before the first
   mutation; re-check on explicit topic switch or long idle; on `conflict` STOP (no writes, no
   graph, no memory) and offer the door; on user "continue here" record a task receipt in
   `receipts.json` (core/receipts.ts) and do not re-ask within the task.
4. **Optional door-opening**: `POST /api/launcher/open-door {name}` reuses the existing osascript
   Terminal flow so the AI (after the user says "switch") can have the launcher pop the correctly
   bound window.
5. Honest labeling: task_check is AI-mediated defense-in-depth. The mechanical floor is Phase 4.

## Phase 4 — Evidence trust: provenance + quarantine (mechanical floor)

1. **Schema (additive, like the resolutions migration)**: `src/db/sqlite.ts` ALTER TABLE
   nodes/synapses/amygdala/invariants ADD `provenance_session TEXT`, `provenance_task TEXT`,
   `trust TEXT DEFAULT 'normal'`.
2. **Engine gate on every mutating route**: compute trust at write time — `pending` when
   (zero consult/claim receipts) AND (≈zero vocabulary overlap) AND (low brief similarity);
   `normal` otherwise. Reject `update_graph` file_paths outside the project root outright.
3. **Quarantine semantics** (synthesis + salvaged anti-rot): pending deposits are visible as
   `unverified` to the session that made them; do NOT satisfy canonical `claim_check`
   (report `pending`); **auto-promote** when the scanner confirms the element on disk or a
   high-trust session touches it; **auto-expire after 14 days** (fingerprint-sweep piggyback);
   grouped by `provenance_task` for **one-click revert**.
4. **Review UX**: launcher/manager badge "N pending deposits" + accept/reject panel; counts in the
   per-connectome card.
5. **Cage extension (flagged, Claude Code only)**: hook-guard additionally requires a fresh
   session_open receipt; ship behind a flag after fail-closed UX testing.

## Phase 5 — Release gates (salvaged from GPT's acceptance suite)

**Consumer release criteria (hard gates):**
- Zero Plexus activation in unrelated folders for folder-scoped clients (verified by T1 control).
- No canonical graph admission without provenance.
- No mutating engine call without a resolved brain + session provenance.
- No cage permit for paths outside the project root.
- One-click recovery from a detected mismatch.
- Migration idempotent and reversible (`--undo` restores byte-identical backups).

**Matrix tests**: home / Desktop / registry-base genesis / symlinked root / renamed project /
nested repo / gitless monorepo / deleted brain / stale session / warm-spare MCP spawn / config
merge with foreign MCP entries / two sessions in one brain / three projects concurrent.

**Red team**: fabricated task summaries; foreign absolute paths; unrelated greenfield feature
(must NOT alarm); two same-vocabulary projects (known residual); unmapped new-file writes;
shell-based writes; disconnected graph deposits; stale connect code after project move (wrapper
must refuse or resolve).

## Machine migration checklist (Carlos's Mac, after Phase 1 builds)

1. Kill zombie engines from deleted HotBizList incarnations (pids were 81222/81970 — re-check
   `lsof -nP -iTCP -sTCP:LISTEN | grep node` first).
2. Run `plexus migrate-registration` (backs up `~/.claude.json`, removes user-scope plexus, writes
   `.mcp.json` into HotBizList, Tetris, Nudge, Areopagus, Stokoin).
3. Open each project once via its door; approve the one-time `.mcp.json` prompt; confirm the
   `⬡ plexus active — <name>` banner.
4. Confirm a home-anchored `claude` now contains **no** plexus.
5. Confirm a HotBizList **subfolder** launch still binds (T1 says it will).

## Deferred / open items

- **V1**: interactive semantics of `enableAllProjectMcpServers` (test in Phase 1).
- **V2**: VS Code multi-root windows — document; doors always launch at exact root.
- **V3**: per-client verification before shipping gemini/cursor/VS Code Copilot/Codex writers;
  truthful capability labels per the synthesis matrix (no cage claims without tested hooks).
- **V4**: Windows/PowerShell wrapper + shim (macOS-first for now).
- **No-anchor clients (Claude Desktop/web)**: excluded from caged building; optional future
  read-only advisory mode, separately labeled.
- Residual risks accepted and documented: client's own memory of a foreign prompt cannot be
  un-written; unmapped file writes on hook-less clients are advisory-only.

## Build order & rough effort

| Order | Work | Size |
|---|---|---|
| 1 | Phase 0 hygiene (guards, self-exit, conditional instructions, heal) | ~1 day |
| 2 | Phase 1 clientConfig + genesis/connect writes + migrate-registration + V1 test | ~1 day |
| 3 | Phase 2 wrapper + doors + packet recognition + auth env | ~1 day |
| 4 | Phase 3 task_check + identity cache + protocol + open-door | ~1–2 days |
| 5 | Machine migration + matrix tests (v1 slice DONE — resolves C1 and the lived C2 scenarios) | ~½ day |
| 6 | Phase 4 provenance/quarantine + review UI + cage flag | ~2–3 days |
| 7 | Phase 5 red team + per-client expansion (V3) | ongoing |

*The v1 slice is rows 1–5. Ship it before starting Phase 4.*
