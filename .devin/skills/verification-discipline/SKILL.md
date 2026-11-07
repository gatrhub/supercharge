---
name: verification-discipline
description: >-
  Evidence-before-claim, SAST/SCA reachability, and scan-hit verification. Use
  when analyzing bugs, reviewing security findings, claiming a fix, triaging
  Semgrep/CodeQL/Trivy/OSV output, or writing cross-tenant/authz tests.
---

# Verification discipline

Process: `rules/00-operating.mdc` (evidence rules) and
`rules/06-subagent-gatecheck.mdc` (subagent distrust) — do not weaken them here.
Slice checklists: `engineering-checklists`. No exploit PoCs, payloads, or
attacker tooling.

## When to use

Bug analysis, "is this fixed?", security review of your own code, or a
scanner/SCA dump that someone wants treated as findings.

## Evidence before claims

A finding or "fixed" claim needs at least one **opened** source of truth:
`file:function`, test name, or the exact command that ran.

- Findings without an evidence pointer are candidates, not validated.
- Unlinked observations (you opened a file but never cited it) do not support
  the conclusion.
- After you change code, **re-run** the check that failed (that test file,
  lint, the same grep that found the bug — never the full suite). Do not mark
  the review complete on the old output.
- "I read the checklist" is not "I executed the check."

## Scanner output is not a finding

Threat-model the slice first (authz plane, tenant scoping, uploads, SSRF
egress, session handling). Then scan. Then **human-verify** each hit:

| Hit | Ask before filing |
|-----|-------------------|
| SAST (Semgrep/CodeQL/Bandit) | Reachable from an entrypoint? False positive? Already denied by validation / unknown-key=deny? |
| SCA / CVE on a dependency | Called on your path? Dev-only? Already pinned/unexposed? |
| IDOR / authz suspicion | Cross-tenant access denied in source (or by a test)? Privileged-view write 403? Correct permission plane? |

Do not paste scanner JSON into a report as the result. Do not write a PoC
exploit. Support a finding with the source path (`file:line`) and, optionally,
a **regression test** (allow, deny, cross-tenant, privileged-view write).

## Dependencies and CI

SCA alert ≠ production risk. Prefer reachability over CVSS sort. For CI
actions: pin to commit SHA, not a moving tag. Do not `curl | bash` unsigned
bootstrap into the repo.

## A mutation you touched

If you added a permission or an ID-scoped query: confirm allow, deny,
cross-tenant, and privileged-view write in source and cite `file:line`. If you
write or change a test file, run it; never claim a test ran when it did not.
