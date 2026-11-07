# Analysis asks — the examination contract (portable)

Loaded when a prompt asks to analyze, review, audit, assess, examine,
diagnose, critique, find bugs/issues in, walk through, look into, or
improve a subject — or when the user reports a prior analysis missed
obvious things. Canonical source: `rules/15-analysis-depth.mdc`
(this file is the portable copy — keep the two in step).

## There is no lightweight tier

Depth does not scale with the ask's adjectives. "Analyze my X" and
"analyze X" and "give me a quick look at X" bind the same machinery.
The deliverable is a worked examination with an auditable coverage
spine, not a confident narrative.

## The contract — the gradeable shape

1. **Constraint ledger first.** Every condition in the ask quoted
   verbatim, tagged `content`/`method`, each with a check form — the
   mechanical test that proves it held.
2. **Derived universe.** Enumerate the subject's units from a
   mechanical source — file glob, route list, DOM/probe dump, config
   keys — never from memory. Name the derivation (`verify:`/`doc:`/
   `DECLARED:` + why).
3. **Analysis plan.** The ordered work list, posted BEFORE walking.
   "Analyze X" decomposes into a lengthy item list; each item gets
   findings documented as it is worked.
4. **Per-unit findings.** One examination block per universe unit:
   `Examined:` + `Found:` + evidence (`file:line`, probe output,
   computed value, quoted behavior). A unit that yielded nothing
   records what cleared it — cleared space is coverage, not absence.
5. **Per-unit axes** (third-party subjects): contract ·
   actors×capabilities · edge content · lifecycle · error/permission
   paths · consistency · meta (which check should have caught it).
6. **Hypothesis log · constraint check · synthesis · gap review ·
   independent eyes** — suspected mechanisms with verdicts; every
   constraint re-checked; the orthogonal enumerations; a stranger pass
   on self-produced subjects.
7. **Evidence before causes.** Gather the artifacts a claim is about
   before asserting it; causal claims cite `file:line`/timestamp/output
   or carry `INFERENCE:`; findings precede fix proposals; timeline
   claims require the mtime/diff/log actually read.

## The artifact — broad/subject asks

`.unlazy/analysis/<topic>-analysis.md`:

```text
<!-- analysis-project v2 -->
subject-job: <one line — the contract this subject is graded under>
## Constraint ledger      (verbatim, tagged, check forms)
## Universe               | unit | what it is | derived-by |
## Analysis plan          (ordered items — the work list)
## Units                  ### <unit> per row: Examined + Found + evidence
## Hypothesis log         | hypothesis | verdict | evidence |
## Constraint check       every ledger row re-verified
## Synthesis              RANKED findings + mechanism apart from
                          symptoms + ≥1 alternative weighed
## Gap review             the orthogonal enumerations
## Independent eyes       the stranger pass record
UNITS: x/y                (computed — the gate recomputes)
```

(v1 docs still parse — v2 adds the `subject-job:` line and the
committed-synthesis requirement inside `## Synthesis`.)

## The chat floor — the answer-level spine

Chat-scale asks (a specific question, a narrow compare) still carry
the machinery, compressed — each piece present or
`DECLARED: <piece> — <why>`:

1. **Machinery-plan block** — a `## …plan` heading declaring the
   universe + axes + evidence BEFORE the findings.
2. **Examined-vs-found accounting** — a `## Coverage`/`## Universe`/
   `## Examined`/`## Scope` section or countable "N units examined"
   — the count derives from the enumeration.
3. **Hypothesis-log lines** — `found:`/`cleared:`/`unverifiable:` per
   question; cleared space is coverage.
4. **Committed synthesis** — `## Synthesis`/`## Verdict`/`## Conclusion`
   — findings ranked, the causal mechanism named apart from the
   symptom list, ≥1 alternative weighed and killed, the falsifier.
5. **`## Evidence`** — the gathered set, claims cited or `INFERENCE:`.

Routing is declared, not assumed: a subject-shaped ask either
produces the project doc or carries `DECLARED: chat-scale — <why>`
naming why the ask is narrow. The DECLARED line is the cheap honest
escape — silence is the un-routed miss.

## Iteration loop — for self-produced work

Implementation sessions also run `.unlazy/iteration/<sid>.md`:
scope → budget → rounds of (analysis plan → L1–L14 traversal →
findings → applied) → `## Exit review` verdict pass → `ENDED:`.
Rounds are interleaved with implementation — the artifact accrues as
rounds happen, never in one wrap-up burst. Schema:
`rules/16-iteration-loop.mdc`.
