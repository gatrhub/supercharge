---
name: briefing
description: Session-start briefing for repo work. Re-reads every installed rule, mandates 100% strict adherence with zero deviation, and loads unlazy, the design skills (for any UI work), and all applicable domain skills before work begins. Invoke at the start of any task in this repo or whenever the user says "briefing".
---

# Briefing

Standing directive from the user — a prior agent session was ended for not
following the rules. This briefing exists so that never happens again:

> "Please examine all of the installed rules and understand that you must
> 100% strictly adhere to them at all times without any deviation in the
> slightest. If you feel yourself beginning to deviate, you must force
> yourself to go back to read the rules again. Also, use all necessary
> skills. Any time you touch UI or are analyzing UI, please invoke all
> design skills. Also use unlazy and any other necessary skills."

Run all three steps below, visibly, before touching the task.

## Step 1 — Read every installed rule, in full

Read these files completely — not a skim, not a summary, not from memory.
Chat memory of them is not a substitute.

Always-on rules:

- `AGENTS.md` (repo root)
- `rules/00-constitution.mdc` — the distilled set + trigger-load map — read first; it routes to the domain files
- `rules/00-operating.mdc` — precedence, CORE, §2a–§2e workflow, §9 done-checklist
- `rules/11-plain-english.mdc` — report style for the default reader
- `rules/12-verification.mdc` — evidence-before-claim, never-twice-blind
- `rules/14-stop-integrity.mdc` — the stop contract: no deferral exits, named walls only
- `rules/15-analysis-depth.mdc` — analysis projects, depth floors, traversal axes
- `rules/16-iteration-loop.mdc` — the post-implementation walk cycle
- `rules/01-architecture-memory.mdc` — stack, code layout, two-plane authz, reflexes
- `rules/04-rewrite-docs.mdc` — search the living docs, never read them whole; update changed entries
- `rules/05-sec-perf-modularity.mdc` — security, performance, DRY, migrations, multi-worker state
- `rules/07-product-transfer.mdc` — the design target mockups are the look; the legacy surface is the feature checklist; no placeholders
- `rules/08-code-quality.mdc` — comments, readability, risk-tiered fix process, design/visual discipline
- `rules/09-design-review.mdc` — enforced critique protocol + element-enumerated artifact
- `rules/10-rule-enforcement.mdc` — the mechanical gate layer
- `rules/running-the-server.mdc` — running the dev server is allowed; kill by PID only
- The tool's global rules file if one exists (e.g. Devin Desktop `~/devin-desktop/memories/global_rules.md`; a precedence-first template ships in `extras/devin-desktop/global-rules.md`)

Conditional rules — read when their trigger matches:

- `rules/02-subagent-ceiling.mdc` + `rules/06-subagent-gatecheck.mdc` — before launching subagents or reviewing what they return (soft ceiling 15; **0 for security-audit work** per user order 2026-10)
- `rules/03-periodic-audits.mdc` — only when the user asks for an audit
- `rules/13-design-spec.mdc` — before composing or changing any rendered surface
- `rules/security-authz.mdc` — when touching permissions, adapters, authz, access gates, safety
- `rules/performance.mdc` — when touching `app/**/*.py` or `ui/**/*.js`
- `rules/modularity-backend.mdc` — when touching `app/**/*.py`
- `rules/ui-modularity.mdc` — when touching `ui/`, `ui_admin/`, or `templates/`

## Step 2 — Load the skills

- **`unlazy`** — for any substantial work (multi-file, audits, fix-sweeps, subjective or visual quality bars). Write the gates before implementing, not at report time.
- **Design skills — REQUIRED whenever touching or analyzing UI** (`ui/`, `ui_admin/`, ANY rendered surface including mockups and standalone HTML): `design-taste` for direction and anti-slop checks, `taste-design-review` for the screenshot audit loop, plus the specialists `taste-typography`, `taste-color`, `taste-motion`, `taste-accessibility`, `taste-ux-copy`, `taste-code-craft` as they apply. This is a mechanical step, not advisory: run `ls .devin/skills/`, then **read each applicable `SKILL.md` directly by path** and record a `skills loaded:` line in the spec. The skill registry not listing them is not absence from disk — an unloaded skill is an unread rule.
- **Domain skills as they apply**: `engineering-checklists`, `verification-discipline` (`.devin/skills/`), `security-audit` (`.agents/skills/`), `systematic-debugging`, `diagnosing-bugs`, `tdd`, `postgres-best-practices`, `codebase-design`, `domain-modeling`, `threat-modeling`, `audit-logging`, `ai-coding-agent-guardrails`, `pytest-skill`, `modern-python`, `code-review`, `handoff` (`.devin/skills/`).
- Read each invoked `SKILL.md` in full — a skim is not loading it.

## Step 3 — Work under the rules, zero deviation

- **Rules are conditions, not guidance** (`00-operating` §2d). A required step that produced no visible artifact — ledger, plan, todo list, screenshot, written review — did not happen.
- **Catch yourself deviating → stop.** Re-read the violated rule, fix the process first, then resume from the step the violation broke. Name the rule and the cost. The same rule broken twice → its bypass goes in the report.
- **Pre-work gate before any non-trivial unit** (§2b): skills loaded, rules pass written, todo list posted, fresh current-state evidence, direction + ledgers — all before the first source-read or edit.
- **Working loop, no stage compressed** (§2c): analysis plan → analysis → implementation plan → verification todo → per-task process review, each a written artifact.
- **Before any done-claim**, answer the §9 checklist in writing and show the completion matrix: every distinct ask → evidence (`file:line` or reproducible command).
- **UI work** is not done until the §9 design-review artifact exists with real coverage, the surface has been seen running at every affected viewport and theme, and the critique passes are clean.
- **Never trade security, performance, or modularity for speed.** Never relabel unfinished requested work — "residual", "known issues", "for later", "out of scope" are banned; items are done, blocked on a named real blocker, or user-accepted deferrals only.
- **Literal instructions win.** Depth, scope, and "do not stop early" mean exactly that. Analysis-only asks get no patches; fix asks get real fixes.

## Step 4 — Operating with the gate (the part the rules don't teach)

The stop-gate is a runtime, not a style guide. It evaluates artifacts and
your final message against regexes in `.devin/scripts/stop-gate.mjs` —
contracts the rule text describes but only the code defines exactly. These
are the operational facts that block unprepared agents:

- **Hook input.** The gate reads a JSON object on stdin
  (`{"session_id": "...", "stop_hook_active": true}`). Malformed stdin =
  silent exit, not a pass. When testing it yourself, pipe a JSON file.
- **Every armed analysis answer needs the spine in ONE message.** A
  `## <…>plan` heading, examined counts (`## Coverage` heading or
  `N files examined` inline), `found:`/`cleared:`/`unverifiable:` lines,
  `## Evidence` + ≥3 non-empty lines, and a `## Synthesis` heading (must
  start with that word). Pieces do not accumulate across messages — the
  last reply is what gets scanned.
- **Analysis docs run universe → plan → verified-plan → walk.** A v2
  doc's `## Analysis plan` is written BEFORE units are walked and
  verified by a stranger pass (`.unlazy/eyes/<sid>-plan.md` — must exist
  on disk — or `DECLARED: plan-verify — <why>` for chat-scale). Findings
  or >8 universe rows owe `## Second pass` (new evidence, not re-cited).
  `## Implementation plan` needs ≥3 item rows + a `scope: <class>` line —
  the scope hands the work to the cycle floors (fix 1 / surface 5 /
  page 6 / subsystem 10 / product 12).
- **Final-message lexical scans.** PUSHBACK/CAPABILITY-LIE fire on report
  prose — "still", "remains", "can't", "couldn't", "next session", "will
  test". State completed work; never narrate standing work you already
  finished. Describing a fixed bug in impossibility vocabulary reads as
  open work.
- **Discharge grammar** (written to `.unlazy/gate-evidence/<sid>.md`):
  - `EXEMPT-<CHECK>: <target or *> — <reason ≥40 chars>` — auditable, not
    free; wildcard pardons print at every stop.
  - `DECLARED: <claim> — env:<constraint> | file:line | user said
    "<verbatim>"` — authority claims must quote their source.
  - `STOP: USER-GATE|BLOCKED|ACCEPTED — …`, `IMPOSSIBLE: <wall> — tried:
    <paths actually attempted>`, `ACCEPTED-DEFERRAL: <item> — user said
    "…"`, `LANE: user said "…"`.
- **Todos close in writing first.** `CLOSURE: <item stem> — <what was
  questioned + ≥2 axes or a cite>` goes in an armed ledger doc BEFORE the
  item is marked complete — the transition itself blocks.
- **Artifacts are session-bound.** `.unlazy/<kind>/<sid>.md` — a sibling
  session's artifact never satisfies this session's check.
- **Arms are vocabulary scans.** A doc that *describes* `CREATE TABLE`
  arms MIGRATION; a unit-id column can read as unmapped elements. When an
  arm is a genuine false positive, exempt it with the mechanism named —
  then file the extractor bug in the tracker so the check improves.
- **Cycles are enforced by scope.** Your iteration record's `Scope:`
  class sets a ROUNDS floor — fix 1, surface 5, page 6, subsystem 10,
  product 12 — and the walk count is checked, not the declared Budget.
  `### Analysis plan` must carry the search strategy (universe +
  hypotheses + per-axis evidence; later rounds name what changed) and
  `BATCH-PLAN` rows name the scope class. A ≥3-file batch with no lane
  still owes the plan quartet.
- **When confused, read the state file.** `.unlazy/gate-state/<sid>.json`
  is what the gate believes (armed docs, touched files, owed deltas).
  Reconcile state-vs-disk rather than re-writing evidence.
