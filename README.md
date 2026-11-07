# Supercharge — agent rules + skills + enforcement machinery

A rules-and-skills system for AI coding agents, built and battle-tested on a real codebase.

Most agent-rule setups are prompts with good intentions: text the agent *should* follow, with no way to tell whether it did. This system adds the missing half — a **mechanical gate** that intercepts the session's stop, recomputes what the session actually did (files touched, artifacts written, claims made), and blocks with named obligations when the evidence doesn't match the claims.

The rules are the contract. The skills are the method. The gate is the proof.

## What a session looks like under this system

1. **Briefing** — the agent runs the `briefing` skill: reads every rule, loads the skills the task needs, and learns the gate's operational contract (Step 4) before touching anything.
2. **Work** — analysis asks produce `.unlazy/analysis/` project docs (enumerated universe → verified plan → per-unit walk → second pass → ranked synthesis). Implementation produces `.unlazy/iteration/` walk cycles (scope-declared, floor-bounded rounds of traversal → findings → applied fixes → exit review).
3. **Stop** — `stop-gate.mjs` fires and runs ~75 checks: no-deferral, evidence-before-claim, analysis-depth floors, completion matrix, audit ledger, iteration records. Failures block with named obligations and legal discharge forms (`DECLARED:`, `BLOCKED:`, `EXEMPT-<CHECK>:`, `IMPOSSIBLE:` — each corroborated, not asserted). The agent cannot end a session on an unmet obligation or an unexplained exemption.

## What's in the box

| Path | Contents | Install to |
|---|---|---|
| `rules/*.mdc` | 22 rule files — constitution, operating contract, verification, analysis-depth, iteration-loop, enforcement map, domain rules | `<repo>/rules/` |
| `.devin/scripts/*.mjs` | 17 enforcement scripts — stop-gate, session/rejection trackers, render/design/cycle-plan checks, deferral detector | `<repo>/.devin/scripts/` |
| `.devin/hooks.v1.json` | Devin CLI hook wiring (PreToolUse / PostToolUse / UserPromptSubmit / Stop) | `<repo>/.devin/hooks.v1.json` |
| `.claude/settings.example.json` | Same hooks ported for Claude Code — uses `$CLAUDE_PROJECT_DIR` | merge into `<repo>/.claude/settings.local.json` |
| `.devin/skills/*` | 26 skills — unlazy, briefing, design-grammar + the taste-* set, tdd, debugging, domain-modeling, threat-modeling, engineering-checklists, verification-discipline, etc. | `<repo>/.devin/skills/` |
| `.agents/skills/*` | security-audit, unlazy (agents-tool layout copies) | `<repo>/.agents/skills/` |
| `.claude/skills/unlazy` | unlazy for Claude's skill loader | `<repo>/.claude/skills/` |
| `AGENTS.md` | Repo map + skill/rules registry (edit to your project) | `<repo>/AGENTS.md` |
| `extras/devin-desktop/` | Precedence-first global-rules template + threejs/threejs-webgpu skills for Devin Desktop's global dirs | `~/devin-desktop/` as needed |

## Requirements

- **Node.js** ≥18 on PATH — all gate scripts are dependency-free ES modules (`node --check` is enough to verify them; nothing to `npm install`)
- **bash** — some `verify:` evidence commands run through a bash shell (Git Bash works on Windows)
- A **hook-capable harness** for enforcement (see compat table). The rules/skills alone still improve behavior on hookless tools — you just lose the mechanical guarantee.

## Install

```bash
# from this bundle's root, inside your repo:
cp -r rules .devin .agents .claude AGENTS.md /path/to/your-repo/

# verify the scripts parse:
node --check /path/to/your-repo/.devin/scripts/stop-gate.mjs
```

**Harness compat:**

| Tool | What works |
|---|---|
| Devin CLI | Full — `.devin/hooks.v1.json` wires all four hook events |
| Claude Code | Merge `.claude/settings.example.json` into `<repo>/.claude/settings.local.json` |
| Cursor | Copy/symlink `rules/` → `.cursor/rules/` (the scripts accept either layout — regexes match `(?:\.cursor/)?rules/`) |
| Devin Desktop | Copy `extras/devin-desktop/global-rules.md` to your Devin Desktop user-level rules/memories file |
| Other agents | Rules + skills still load as context; the gate needs a Stop-hook event to fire — without hooks the system degrades to advice |

**Runtime artifacts** land under `.unlazy/` in the adopting repo — gate state, evidence, ledgers, iteration records, eyes passes, telemetry (`META-COST` ratio in `_telemetry.jsonl`). Nothing to install; the machinery creates it.

## Make it yours — what to edit first

1. **`AGENTS.md`** — the repo map agents read first. Rewrite it for your project.
2. **`rules/01-architecture-memory.mdc`** — the project memory template (stack, layout, reflexes).
3. **`rules/00-constitution.mdc`** — the trigger-load map: which domain rules activate on which signals.

**Generic (adopt as-is):** `00-*`, `10-*` through `16-*`, `11-plain-english`, `12-verification`, `14-stop-integrity`, `15-analysis-depth`, `16-iteration-loop`, `08-code-quality`, `09-design-review`, `13-design-spec`, `02-subagent-ceiling`, `03-periodic-audits`, `06-subagent-gatecheck`, all of `.devin/scripts/`, and all skills except the two `.devin/skills/` domain examples (`engineering-checklists`, `verification-discipline`) which are worked examples of domain skills.

**Customize for your project:** `04-rewrite-docs` and `07-product-transfer` (cite your living docs — the `docs/*`, `docs/sitemap.md`, `docs/architecture-plan.md` conventions), `modularity-backend` / `performance` / `security-authz` / `ui-modularity` / `running-the-server` / `05-sec-perf-modularity` (written for an async-Python+Postgres-shaped app — keep the invariants, adapt the paths), `.devin/skills/engineering-checklists` + `.devin/skills/verification-discipline` (worked examples — replace with your domain skills), and `.devin/skills/design-grammar` (a worked extraction — run its protocol on your own validated surfaces).

**Graceful degradation:** product-shaped checks inside the scripts (`app/` paths, `docs/sitemap.md`, `--app-*` token scans) are `existsSync`-guarded — they simply don't arm on repos without those paths.

## Agent onboarding — the part most adopters miss

Point agents at `.devin/skills/briefing/SKILL.md` and have them run it at session start. Its **Step 4 ("Operating with the gate")** carries the operational contract the rule text doesn't teach: the stop-gate's stdin shape, the single-message analysis spine, the final-message lexical scans, and the discharge grammar (`EXEMPT-*`/`DECLARED:`/`STOP:`/`IMPOSSIBLE:` forms). Agents that read only the rules will pass the intent and fail the vocabulary — Step 4 is the difference.

## An honest note on cost

This system is deliberately heavy. Analysis docs, iteration records, evidence ledgers, and gate passes consume real tokens — the machinery exists because "trust the agent" kept failing on a real codebase. `META-COST` telemetry prints the artifact-to-deliverable byte ratio at every stop so you can see the overhead and decide where it earns its keep. Calibrate by scope: `DECLARED:`/`EXEMPT-*:` escape hatches exist for genuinely narrow work, and the gate audits each one it consumes.
