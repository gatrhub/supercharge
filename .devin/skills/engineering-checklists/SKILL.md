---
name: engineering-checklists
description: >-
  Implementation checklists for security, performance, modularity, and code
  quality. Use when writing or reviewing application code, adapters, domain
  logic, UI features, or authorization.
---

# Engineering checklists

This skill is **checklists**, not a plan. Pair it with your project's
architecture doc and the always-on rules (`rules/00-operating.mdc`,
`rules/08-code-quality.mdc`).

**Product posture:** the design target/mockups are the look; the legacy or
feature checklist defines coverage — keep every feature (relocate rather than
drop). A user-reported example is a **class** of bugs, not an instance. Do not
invent pages or "not wired yet" tiles; hide what isn't built.

Running the dev server is allowed — use it to check UI changes on the real
surface rather than reasoning from code alone.

## Every change

1. Open the slice's task/ledger doc if this work qualifies.
2. Search the project's helper reference before adding a helper.
3. One domain entrypoint per mutation (HTTP/WS/internal/jobs call it).
4. Correct authz plane; register the action. Unknown key = deny.
5. UI: feature descriptor/`index.js`; no god-file; no cross-feature imports.
6. Match the fix process to its risk tier (`rules/08-code-quality.mdc`).
7. Do not mark a checklist item done after only reading it. "all/every file"
   asks get a path-opened ledger — titles are not coverage.
8. UI/design work → invoke `design-taste` plus the relevant `taste-*` skills
   (under `.devin/skills/` — **read each `SKILL.md` by path if the skill tool
   does not list them**); verify on screenshots of the running surface at each
   viewport/theme, not code inspection alone. Done = the result would meet —
   ideally exceed — the user's bar, never the cheapest defensible reading of it.

Slice checklists: [checklists.md](checklists.md). Scan-hit / SCA reachability:
`verification-discipline`.
