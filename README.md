# Supercharge — rules, skills, and a gate that checks the work

An add-on for AI coding agents that makes them work deeper — map the whole problem before touching it, plan before acting, get the plan checked by an independent reviewer, walk every part of it, double-check the findings — and then *prove* it all happened, instead of just saying it did.

## The problem

Left alone, an agent takes the shortest path: it skims a few files, summarizes what it saw, and reports "done." A real analysis and a one-pass skim produce the same confident answer — you can't tell the difference from the outside, so the agent has no reason to do the expensive version.

This package removes the shortcut. Three parts:

- **Rules** define how deep the work must go — as requirements, not suggestions. An analysis has to list everything it's about to cover before it starts, write a plan, get that plan verified by a reviewer who isn't the author, examine every single item with evidence, and re-verify its findings in a second pass. Code changes have to traverse their scope a minimum number of passes with a written record on each — bigger scope, more required passes.
- **Skills** teach the agent how to work at that depth — 26 method guides (systematic debugging, test-driven development, design review, the depth discipline itself) it loads at the start of a session.
- **A gate** runs when the agent tries to finish. It's a script that recounts what actually happened — files touched, documents written, plans verified, numbers added up — and stops the session cold when the record doesn't match the report.

The gate is what makes the depth non-negotiable: you can't fake the paper trail without doing the work, because every artifact has to carry evidence that wouldn't exist otherwise.

## What a session looks like

1. **Start.** The agent reads the rules and loads the skills — including the discipline skill that sets the working contract for the session.
2. **Plan.** Before it touches the problem, it writes down the whole space it's about to cover. For analysis, a second reviewer — independent of the author — has to confirm the plan actually covers everything.
3. **Work.** It walks the whole space: every element examined, every pass the scope requires, findings double-checked. Small scripts record what it actually does — every file touched, every command run.
4. **Finish.** The agent says "done." The gate runs ~75 checks against the record. Anything missing or half-done gets named, and the agent has to fix it — or write down exactly why it can't, with proof. It can't just end and walk away.

## What the agent is made to do

The rules don't just demand effort — they specify the method. Three working modes:

### How it analyzes

An analysis ask becomes a written project, not a chat answer:

- **List the whole space first.** Every unit — every setting, every route, every file in scope — gets enumerated from a real source (the registry, the route table, the directory tree), not described as "the settings, broadly."
- **Plan before walking.** The agent writes down what it intends to examine and what it expects to find — then a second reviewer, independent of the author, has to confirm the plan covers the whole list *before any analysis starts*.
- **Walk every unit.** Each item gets its own section: what was examined, what was found, and the evidence. A heading alone doesn't count.
- **Drill into what's found.** Nested things discovered mid-walk — a setting's modal, a modal's second page — become units of their own, each examined in turn. Undrilled discoveries hold the stop: nothing gets noticed and skipped.
- **Log every hypothesis.** Each suspicion is recorded and closed as `found:`, `cleared:`, or `unverifiable:` — the examined-and-cleared half of the work stays visible, not just the hits.
- **Double-check the findings.** Any findings — or a space bigger than eight items — owes a second pass that re-verifies with fresh evidence, not a re-read of the first.
- **Reconcile before reporting.** The coverage math is checked (`12 examined / 12 listed`), findings get ranked, the mechanism behind them is named, alternatives get weighed — and what was *not* examined is declared in writing. "I didn't look at X" lives in the record instead of disappearing.

### How it plans

- **No edits before a plan exists.** The pre-save checks block code changes that land ahead of a written plan.
- **Bigger changes, written batch plans.** Touching three or more implementation files requires a batch plan with a declared size — fix, surface, page, subsystem, or product — and that size sets how deep the walk must go.
- **Analysis hands off to implementation.** When an analysis finds work, each finding becomes a plan row with a scope class — the analysis result automatically drives how hard the implementation has to traverse.
- **Plans can't be hollow.** A round's plan has to carry real content — the space, the suspicions, the evidence expected — and later rounds must name what changed since the last one. "Walk the axes" is not a plan.

### How it traverses

- **Size sets the floor.** A small fix needs 1 pass through its scope; a surface needs 5, a page 6, a subsystem 10, a whole product 12. The gate counts actual rounds, not the declared budget — ending early doesn't close it.
- **Each pass drills section by section.** A round walks the scope and focuses on each part in turn — every row gets evidence, not a summary impression of the whole.
- **Every finding ends somewhere.** Fixed, filed to the tracker, or ruled not-a-defect — "noted" is not an ending.
- **A review after the last edit.** The final pass re-reads the diff the way a senior reviewer would — bugs, edge cases, anything that would embarrass — and the verdict is written down. "It built" is not done.
- **Deep, but bounded.** A scope can't outgrow roughly double its declared size — the floor has a ceiling, so thorough doesn't mean infinite.

The same spine shapes the report itself: a substantial answer ends with the plan, the coverage count, the evidence, and the ranked synthesis — the reasoning is auditable, not just the result.

## How it works

```
rules/         what must happen      — the contract
skills/        how to do it well     — read at session start
hooks          what actually happened — watched live, not summarized later
stop-gate.mjs  the bouncer            — recounts everything before letting
                                        the session end
```

Everything the agent writes down lands in `.unlazy/` — that's the paper trail the gate checks.

### What gets watched

| When | Who watches | What it catches |
|---|---|---|
| You send a message | `rejection-tracker.mjs` | What kind of ask this is — analysis, verdict, UI work — so the right requirements switch on. Also records when you reject an answer and it gets re-asked |
| Before each file save | 5 `check-*` scripts | A plan exists before code lands; bigger changes need a written batch plan first |
| After each file save | `session-tracker.mjs` + 2 checks | Every file touched and every edit, logged — the facts the gate recounts later |
| When the agent tries to stop | `stop-gate.mjs` | ~75 checks recount the whole session against the record |

### One check, start to finish

Say you ask: *"analyze all my group settings."* The word "all" switches the depth checks on. When the agent tries to stop, the gate looks for the analysis document and verifies:

- **Every setting is listed** — not "the settings, broadly," but each one, with where it was found
- **A plan was written first** — and a second, independent reviewer confirmed the plan covers every setting (that reviewer's file must exist on disk)
- **Each setting was actually examined** — what was looked at, what was found, and the evidence — a heading alone doesn't count
- **A second pass double-checked the findings** — looking once is coverage; looking again is verification
- **The math adds up** — if the doc says `UNITS: 12/12`, the gate recounts 12 sections against 12 rows itself

Code work gets the same treatment: a declared-size walk (a small fix needs 1 pass, a whole product needs 12) with evidence on every row, findings closed out, and a written verdict after the last edit.

### When the agent genuinely can't

Some walls are real — no permission to launch a helper, a service that's down, something only you can decide. The agent doesn't get to quietly skip these. It writes a named exit with proof:

- `DECLARED:` — a claim plus where it came from (your words, a file and line, a command's output)
- `BLOCKED:` — a real external wall
- `ACCEPTED:` — your own words, checked against what you actually wrote
- `IMPOSSIBLE:` — the wall plus what was tried
- `EXEMPT-…:` — an explicit pass with a reason; blanket passes get printed at every later stop so nothing disappears silently

There's no exit that leaves no record — that's the point.

### What's in `.unlazy/` — the paper trail

| Folder | What's there | What it shows |
|---|---|---|
| `analysis/` | Analysis documents | The topic was examined, not just answered |
| `iteration/` | Walk records | The work went through passes, not one shot |
| `eyes/` | Independent reviews | Someone besides the author graded it |
| `gate-evidence/` | The exit ledger | Every skip the session used, with reasons |
| `audit-ledger/` | Audit records | Coverage numbers that add up |
| `gate-state/` | The watchers' notes | What was observed, per session |
| `coverage/` | Mechanical counts | Coverage came from a scan, not a guess |
| `captures/` | Screenshots, page dumps | UI claims trace to pixels, not impressions |

### How it stays honest

- **Files are tied to the session** — last week's work can't satisfy today's check.
- **Claims need receipts** — cited files must exist; `verify:` commands get re-run.
- **Numbers get recounted** — every `x/y` tally is recomputed, never just read.
- **The final report is scanned too** — claiming something that wasn't tried flags like a missing file.
- **Skips stay visible** — every bypass is named at every later stop.

## What's inside

| Path | What it is | Put it in |
|---|---|---|
| `rules/*.mdc` | 22 rule files — the constitution, work contract, verification, analysis-depth, iteration loop, the check map, domain rules | `<repo>/rules/` |
| `.devin/scripts/*.mjs` | 17 scripts — the gate, the watchers, the pre-save checks | `<repo>/.devin/scripts/` |
| `.devin/hooks.v1.json` | Wires the watchers in for Devin CLI | `<repo>/.devin/hooks.v1.json` |
| `.claude/settings.example.json` | Same wiring, for Claude Code | merge into `<repo>/.claude/settings.local.json` |
| `.devin/skills/*` | 26 skills — unlazy, briefing, the design set, tdd, debugging, and more | `<repo>/.devin/skills/` |
| `.agents/skills/*` | security-audit + unlazy, for agent-tool layouts | `<repo>/.agents/skills/` |
| `.claude/skills/unlazy` | unlazy for Claude's loader | `<repo>/.claude/skills/` |
| `AGENTS.md` | The repo map the agent reads first — edit it to your project | `<repo>/AGENTS.md` |
| `extras/devin-desktop/` | A global-rules template + two threejs skills | your Devin Desktop dirs as needed |

## What you need

- **Node.js** ≥18 — the scripts are plain ES modules; nothing to install
- **bash** — some evidence commands run through it (Git Bash works on Windows)
- **A tool with hooks** for the gate to fire (see below). Without hooks the rules and skills still help — you just lose the check.

## Install

```bash
# from this bundle's root, inside your repo:
cp -r rules .devin .agents .claude AGENTS.md /path/to/your-repo/

# sanity check the scripts parse:
node --check /path/to/your-repo/.devin/scripts/stop-gate.mjs
```

**Which tools it works with:**

| Tool | What you get |
|---|---|
| Devin CLI | Everything — `hooks.v1.json` wires all four watch points |
| Claude Code | Merge `.claude/settings.example.json` into `<repo>/.claude/settings.local.json` |
| Cursor | Copy or link `rules/` → `.cursor/rules/` (the scripts read either location) |
| Devin Desktop | Copy `extras/devin-desktop/global-rules.md` to your user-level rules file |
| Anything else | Rules and skills still load as guidance; the gate needs a stop-hook to run — without it, the system is advice, not enforcement |

`.unlazy/` gets created on its own the first time a session runs — nothing to install.

## Setting it up for your project

Edit these first:

1. **`AGENTS.md`** — the map agents read first. Make it yours.
2. **`rules/01-architecture-memory.mdc`** — the project memory template (your stack, your layout).
3. **`rules/00-constitution.mdc`** — which rules switch on for which kinds of work.

**Use as-is:** the `00-*` and `10-*`-`16-*` rules, `11-plain-english`, `12-verification`, `14-stop-integrity`, `15-analysis-depth`, `16-iteration-loop`, `08-code-quality`, `09-design-review`, `13-design-spec`, `02-subagent-ceiling`, `03-periodic-audits`, `06-subagent-gatecheck`, all the scripts, and every skill except the two domain examples.

**Edit to fit:** `04-rewrite-docs` and `07-product-transfer` (they point at your own docs), the app-shaped rules (`modularity-backend`, `performance`, `security-authz`, `ui-modularity`, `running-the-server`, `05-sec-perf-modularity` — written for an async-Python app; keep the rules, change the paths), the two example skills (`engineering-checklists`, `verification-discipline` — swap in your own domain skills), and `design-grammar` (a worked example — run its method on your own surfaces).

Some checks look for your app's file paths. If the paths aren't there, those checks quietly stay off — they only wake up when the thing they watch actually exists.

## One thing adopters miss

Point your agent at `.devin/skills/briefing/SKILL.md` at the start of every session. Its **Step 4** teaches the gate's actual rules of the road — what the stop script expects, what the final report gets scanned for, and how to write the named exits. An agent that only reads the rules will understand the intent and still fail the checks — Step 4 is the difference.

## The honest cost

This is heavy on purpose. Writing analysis docs, walk records, and evidence files spends real tokens — the system exists because "trust the agent" kept failing on a real codebase. A counter prints how much writing each session spent versus how much it produced, so you can see the overhead and decide where it's worth it. For genuinely small work, the named exits exist — and the gate logs each one it sees.
