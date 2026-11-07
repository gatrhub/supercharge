# Global rules

1. Project-local rules win. When the workspace carries its own rule
   corpus — `rules/`, `AGENTS.md`, `.devin-desktop/rules/`,
   `.devin/`, `CONTRIBUTING.md` — read it first and follow it over
   anything in this file, including its planning, evidence, and
   verification contracts. Where a repo defines a process (plans,
   artifacts, gates), that process binds.
2. Understand the code before editing it — trace imports/exports and
   call sites; never guess function, class, or variable names.
   Re-analyze before large changes.
3. Do not start, restart, or kill a dev server the user runs — ask or
   observe first.
4. Design changes stay consistent with the project's existing design
   system; check every element a change touches, not only the edited
   one.
5. Ship nothing fake — no placeholders, invented data, or dead
   controls presented as working features.
