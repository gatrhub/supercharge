# Slice checklists

Adapt the vocabulary to your stack — the *discipline* is the point: every item
is verified in source, not from memory.

## Authz

- [ ] Key in the **correct** permission catalog (staff/admin plane vs tenant plane)
- [ ] Use-case registered; entrypoints call the authorize helper
- [ ] IDOR: tenant id (`group_id`/equivalent) on the loaded resource
- [ ] Hierarchy for member-affecting actions
- [ ] Privileged path does not skip tenant evaluation unless break-glass
- [ ] Staff-in-tenant overlay: member-only; no kick/roles/settings unless granted
- [ ] Allow, deny, cross-tenant and privileged-view write confirmed in source with `file:line` (tests optional; if you write one, run it)

## UI feature

- [ ] Opened the design target (the look) and the legacy/feature list — every feature present or filed open, never a stub tile
- [ ] Feature descriptor (`features/<id>/index.js` or equivalent: routes, permissions, deferred `load`)
- [ ] Scoped CSS prefix (`.<app>-<id>-*`) in the feature stylesheet
- [ ] `data-action="<id>.*"` only in that feature
- [ ] Primitives/patterns for modal/focus/empty/skeleton states
- [ ] `canDo`/permission checks only via the shared permissions helper
- [ ] Not imported by another feature
- [ ] Heavy deps deferred (editor, realtime SDKs)

## Performance

- [ ] No blocking I/O on the request path
- [ ] Tenant-scoped queries filter on the tenant key
- [ ] Cursor pagination; no unbounded lists
- [ ] Outbox/queue for events; entitlement fan-out
- [ ] Lean DTO; timeout on egress

## Backend module

- [ ] Adapter thin; domain has no framework types
- [ ] Context boundary respected (identity / platform / domain contexts)
- [ ] Migration tool for schema; no boot DDL
- [ ] Queue worker for background work, not threads
