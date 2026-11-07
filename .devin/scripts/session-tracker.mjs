/**
 * PostToolUse hook: session gate tracker.
 *
 * Records, per session_id, which enforceable rule-triggers fired, so the
 * Stop gate can check their paired obligations before the turn closes.
 * Arm/satisfy pairs (see rules/10-rule-enforcement.mdc):
 *
 *   arm on UI source edit (ui/, ui_admin/ .js/.css/.html/.j2)
 *     → satisfy: enumerated design-review artifact
 *       (.unlazy/design-review/<sid>.md)
 *   arm on edit whose new content contains DDL (CREATE/ALTER TABLE,
 *     ADD/DROP COLUMN, CREATE INDEX, sa.Column)
 *     → satisfy: a migration file written under migrations/versions/g*,
 *       or EXEMPT-MIGRATION in .unlazy/gate-evidence/<sid>.md
 *   arm on adapters/http/ edit whose new content registers a route
 *     (@bp.route / add_route / .route()
 *     → satisfy: docs/sitemap.md touched, or EXEMPT-SITEMAP
 *   arm on tests/*.py edit
 *     → satisfy: a successful pytest/vitest exec this session,
 *       or EXEMPT-TESTS
 *   arm on ledger-doc edit (docs/active-work/*.md,
 *     .unlazy/ plan + gate docs outside the gate dirs)
 *     → satisfy: every deferral-labeled line in the doc carries
 *       ACCEPTED: or BLOCKED:, or EXEMPT-LEDGER
 *   arm on analysis-doc edit (findings/analysis/audit/periodic-*
 *     tracker docs, GATES-*analysis/audit/perf*) or a write into
 *     .unlazy/audit-ledger/
 *     → satisfy: the session's enumeration+coverage ledger at
 *       .unlazy/audit-ledger/<sid>.md passing the stop-gate schema
 *       (03-periodic-audits → audit-ledger), or EXEMPT-AUDIT
 *   arm on UI source edit (same trigger as design-review)
 *     → satisfy: .unlazy/design-spec/<sid>.md written BEFORE the
 *       first UI edit this session (timestamps recorded here —
 *       spec-before-generation is the mechanism, 13-design-spec.mdc):
 *       exemplar → chrome → concept → registration → surfaces →
 *       grammar → inventory → open calls — or EXEMPT-SPEC per file
 *   arm on todo_write (the call carries the live task list)
 *     → satisfy: if items are still open at turn end, a declared
 *       STOP: <class> line in gate-evidence (14-stop-integrity.mdc),
 *       or EXEMPT-STOP
 *
 * Also: first UI edit prints the design-review artifact path so the
 * obligation is visible mid-work; writes into the artifact/evidence
 * files get early format feedback.
 *
 * PostToolUse cannot block — stop-gate.mjs does that. Fail-open on any
 * internal error.
 */

import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execWriteTargets } from "./write-targets.mjs";
import { captureInstrumentBaseline } from "./instrument-manifest.mjs";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const STATE_DIR = join(ROOT, ".unlazy", "gate-state");

const UI_RE = /app\/(ui|ui_admin)\//i;
// Standalone renders — mockups, prototypes, one-off HTML — arm the same
// design gates as ui/ source. A rendered surface is a rendered surface
// regardless of directory; the spec/review doctrine binds everywhere.
const RENDER_RE = /\.(html|j2)$/i;
const SRC_RE = /\.(js|jsx|ts|tsx|css|scss|less|html|j2|vue|svelte)$/i;
// The .unlazy mockup pipeline: RENDER_RE only arms on .html written through
// edit/write — a generated mockup's edits land on its builder scripts and
// fragments (.mjs builders, .css slices, .html partials) instead, which used
// to route the whole review machinery around them. This arm closes that:
// composing files under .unlazy/ arm the gate; verification scripts don't.
const UNLAZY_RENDER_RE = /\.unlazy\/.+\.(?:css|html|j2)$|\.unlazy\/.+(?:build|render|compose|matrix|inject)[^/]*\.mjs$/i;
const GENERATED_RE = /\.min\.|\.bundle\.js$|\.map$|\.br$|\.gz$|\.zst$|sri-manifest|feature-manifest\.js$|preload-manifest|\/chunk-/i;
const DDL_RE = /\b(CREATE\s+TABLE|ALTER\s+TABLE|ADD\s+COLUMN|DROP\s+COLUMN|CREATE\s+INDEX|sa\.Column)\b/i;
const ROUTE_RE = /(@\w+\.route|add_route|\.route)\s*\(/;
const ADAPTERS_RE = /app\/[^\\/]+\/.*\/adapters\/http\/.*\.py$/i;
const MIGRATION_RE = /app\/migrations\/versions\/.*\.py$/i;
const SITEMAP_RE = /app\/sitemap\.md$/i;
// Test-file shapes mirror the gate's reconstruction scan — a `.test.js`
// under ui/ or `test_*.py` outside tests/ must arm TESTS-RUN the same in
// live and reconstructed sessions (R14-F10: the two copies had drifted).
const TEST_RE = /app\/tests\/.*\.py$|\.test\.[jt]sx?$|\btest_[^\\/]*\.py$|.*_test\.py$/i;
// The runner must HEAD a pipeline segment — `echo "pytest green"` or
// `cat pytest.log` mentions the name without running it. Env-prefix,
// pm/npx/python -m, and shell `-c`/`/c` wrappers still count as the
// segment head (R15-F6: `bash -c "pytest x"` never armed test_ran).
const TEST_RUN_RE = /(?:^|[;&|]+\s*)(?:[\w.-]+=\S+\s+)*(?:(?:(?:ba|da|z|fi)?sh|fish|pwsh|powershell(?:\.exe)?|cmd(?:\.exe)?)\s+(?:(?:-|\/)\S+\s+){0,5}?(?:-\w*[cC]\w*|\/[cC])\s+["']?)*(?:(?:python3?\s+-m\s+|(?:uv|poetry)\s+run\s+(?:python3?\s+-m\s+)?|(?:npx|bunx)\s+(?:-\S+\s+)*|pnpm\s+(?:exec|x)\s+|yarn\s+(?:dlx|x)\s+|npm\s+(?:run|test)\s+)?(?:pytest|vitest|jest)\b|(?:npm|pnpm|yarn|bun)\s+(?:(?:run\s+)?test\b|(?:pytest|vitest|jest)\b)|node\s+--test\b|make\s+test\b|tox\b|deno\s+test\b)/;
// Metadata invocations print info and run zero tests — `pytest --version`
// used to mark edited tests "ran". A run-arm requires an actual run:
// version/help/collect/list flags disqualify the command.
const TEST_META_RE = /\b(?:pytest|vitest|jest)\b[^&|;]*?(?:--version|--help|-h\b|--collect-only|--fixtures|--markers|--list)\b/i;
// Ledger docs: live task/plan files where deferral labels park open work.
// Scoped to Active Work (not all of docs) — reference docs like
// docs/helpers-reference.md legitimately discuss "deferred" loading patterns.
const LEDGER_DOC_RE = /(docs\/(Active Work|Plans)\/[^/]+\.md|docs\/[^/]+\.md|\.unlazy\/.*\.md)$/i;
const LEDGER_EXCL_RE = /\.unlazy\/(design-review|design-spec|gate-evidence|gate-state|audit-ledger|iteration|eyes)\//i;
// Implementation writes — the iteration-loop arm (16-iteration-loop.mdc).
// Code-ish extensions under any path count; .md and the living-doc dirs do
// not, so ledger-only sessions never arm the loop. .unlazy/ composing
// sources (.js/.css/.html/.mjs) are implementation even though they sit
// under .unlazy — mockup builds are iterations. gate-state JSON is
// excluded: the hooks write it themselves.
const IMPL_RE = /\.(?:js|mjs|cjs|jsx|ts|tsx|css|html|j2|py|pyi|sql|sh|ps1|bat|ya?ml|toml|ini|cfg|conf|json|mdc|rs|go|rb|php|java|cs|c|cc|cpp|h|hpp|vue|svelte)$/i;
const IMPL_EXCL_RE = /\.unlazy\/(gate-state|coverage)\/|docs\//i;
// Deliverable-shaped ledger docs: basenames presenting as a finished
// plan / proposal / analysis / review / findings / audit — the docs
// where completeness is claimed and the author→reviewer pass must have
// run before stop (00-operating §2a → produced-deliverables reviewer
// pass). Task trackers (*-tasks.md) and working ledgers deliberately
// do NOT match — the check targets docs that present as done thinking.
const GAP_DOC_RE = /(^|[-_])(plans?|proposals?|analysis|reviews?|findings|audits?)([-_.])/i;
// Analysis-intent signals: files whose writes mean "an audit/analysis
// pass is producing output" — findings trackers, analysis docs, audit
// docs, and gate docs for analysis/perf passes. Impl task trackers
// (<topic>-tasks.md) deliberately do NOT match (impl sessions update
// them constantly); periodic-* and findings/analysis/audit names do.
const ANALYSIS_DOC_RE = /(periodic[-_][^/]*|[^/]*(?:^|[-_/])(findings|analysis|audit|deep[-_]?dive|review|notes)[^/]*|GATES-[^/]*(analysis|audit|perf|findings)[^/]*)\.md$/i;
const AUDIT_LEDGER_RE = /\.unlazy\/audit-ledger\/[^/]+\.md$/i;
// Iteration-loop temporal observation: the artifact's growth is timestamped
// as the tracker sees it — `## Round N` / `## Exit review` first-seen times
// plus the impl-write log are what let the Stop gate verify rounds really
// were interleaved with implementation rather than burst-authored at the
// end (16-iteration-loop → the interleave rule).
const ITERATION_ART_RE = /\.unlazy\/iteration\/[^/]+\.md$/i;
const ROUND_HEAD_RE = /^##\s*Round\s+(\d+)(?!\.\d)/gim;
const EXIT_REVIEW_RE = /^##\s*Exit\s+review\b/im;

function relPath(p) { return String(p || "").replace(/\\/g, "/"); }
function repoRel(p) {
  const s = relPath(p);
  const i = s.indexOf("app/");
  return i >= 0 ? s.slice(i) : s;
}
function statePath(sid) { return join(STATE_DIR, `${sid}.json`); }
const STATE_DEFAULTS = { ui_touched: [], impl_touched: [], ddl_armed: [], routes_armed: [], tests_touched: [],
                         migrations_touched: [], sitemap_touched: false, test_ran: false,
                         plan_docs: [], audit_armed: [], audit_ledger_written: false,
                         rejections: [], repro_armed: [], repro_rounds_armed: 0, blind_debt: [],
                         ui_first_edit_at: null, design_spec_at: null,
                         critique_agent_launched: false, critique_agents: [], subagent_launches: [],
                         ui_edit_count: 0, artifact_writes: 0, artifact_first_write_at: null,
                         todos_open: 0, todos_open_items: [], files_edited: 0,
                         impl_log: [], round_seen: {}, baseline_rounds: [], round_rows: {}, round_rows_at: {},
                         exit_review_seen: null, stale_nag_at: null, fr_nag_done: false, sc_nag_done: false, cc_nag_done: false,
                         analysis_doc_written: false, analysis_nag_done: false,
                         plan_checklist: {}, plan_items_done: [], closure_write_at: null, cl_nag_done: false,
                         plan_delta_needed: [], compression_nag_done: false, analysis_method_hist: {},
                         exec_count: 0, sub_ceiling_noted: false, hook_self_ms: 0,
                         spec_depth: null, loop_depth: null,
                         marker_docs: [], plan_sig_docs: [],
                         probe_runs: [], instrument_output_writes: [], instrument_manifest: null };
function readState(sid) {
  // Merge over defaults: other hook scripts (rejection-tracker) write the
  // same state file with only their own keys, so a parsed file can still be
  // missing the fields this script indexes.
  let raw = null;
  try { raw = JSON.parse(readFileSync(statePath(sid), "utf-8")); } catch { raw = null; }
  const state = { ...STATE_DEFAULTS, ...(raw || {}) };
  // Wrong-typed truthy fields survive the defaults merge and crash every
  // call site — `push` → list.includes on a non-array, `round_seen["1"]=…`
  // on a string primitive (strict-mode TypeError inside observeIteration
  // Artifact, which runs before EVERY dispatch). One crafted key silenced
  // the whole session's recording (R12-F9). Coerce to the declared shape:
  // a forged field becomes the empty value, and the gate's stateAnomalies
  // scan still sees (and flags) the type it finds in the file next firing.
  for (const [k, d] of Object.entries(STATE_DEFAULTS)) {
    const v = state[k];
    if (Array.isArray(d)) {
      if (!Array.isArray(v)) { state[k] = []; continue; }
      // Element types: lists hold strings; baseline_rounds holds round
      // integers. A crafted element survives to a later .includes/read.
      // `rejections` holds {ts,excerpt} objects from rejection-tracker —
      // the generic string filter would drop every record on the next
      // firing (R13-F1's keep-list below ran AFTER this filter and never
      // saw the objects — dead code until this exclusion, R14 own-walk).
      state[k] = k === "baseline_rounds"
        ? v.filter((e) => Number.isInteger(e))
        : k === "rejections"
          ? v.filter((e) => e && typeof e === "object" && !Array.isArray(e))
          : v.filter((e) => e != null && typeof e !== "object").map((e) => String(e));
    } else if (d !== null && typeof d === "object") {
      if (typeof v !== "object" || v === null || Array.isArray(v)) state[k] = {};
    } else if (typeof d === "number" && typeof v !== "number") state[k] = 0;
    else if (typeof d === "boolean" && typeof v !== "boolean") state[k] = d;
    else if (d === null && !(v == null || typeof v === "string")) state[k] = null;
  }
  // Object-element lists (pause signals, bypasses, rejection records) —
  // a `[null]`/`[1]` survives to a `.excerpt` read. `rejections` holds
  // {ts,excerpt} objects from rejection-tracker — it sat in the string
  // filter above before and lost every record on the next firing
  // (R13-F1, the baseline_rounds sibling class).
  for (const k of ["user_pause_signals", "stop_bypasses", "delegated_impl", "rejections"]) {
    if (Array.isArray(state[k])) {
      state[k] = k === "delegated_impl"
        ? state[k].filter((e) => e != null && typeof e !== "object").map((e) => String(e))
        : state[k].filter((e) => e && typeof e === "object" && !Array.isArray(e));
    }
  }
  // Object fields' VALUES matter too: the container check above passes
  // `round_seen: {"6": {}}`, and a garbage value then reaches consumers
  // that string-compare stamps (R13-F3). seen/at hold ISO strings,
  // rows hold counts — drop wrong-shaped entries.
  for (const k of ["round_seen", "round_rows_at"]) {
    const o = state[k];
    if (o && typeof o === "object" && !Array.isArray(o)) {
      for (const kk of Object.keys(o)) {
        const v = o[kk];
        // Non-parseable strings are as forged as non-strings — `"z"`
        // persisted truthy would block every future re-stamp (R14-F24;
        // the gate already drops+flags these, this is the write side).
        const s = v == null || typeof v === "object" ? "" : String(v);
        if (!s || !Number.isFinite(Date.parse(s))) delete o[kk]; else o[kk] = s;
      }
    }
  }
  {
    const o = state.round_rows;
    if (o && typeof o === "object" && !Array.isArray(o)) {
      for (const kk of Object.keys(o)) {
        const n = Number(o[kk]);
        if (!Number.isFinite(n)) delete o[kk]; else o[kk] = n;
      }
    }
  }
  // `epoch` marks state files born under the temporal-anchor machinery.
  // A pre-existing file without it is a grandfathered session — its
  // already-written rounds legitimately predate the interleave/eyes-file
  // contracts. A brand-new file gets epoch:2; first-observed round bursts
  // in an epoch session are the backfill signature, not legacy.
  if (raw == null) { state.epoch = 2; state.loop_grandfathered = false; }
  else if (raw.epoch == null) { state.epoch = 2; state.loop_grandfathered = true; }
  return state;
}
function writeState(sid, state) {
  // fs failure (locked file, read-only dir, disk-full) must not kill the
  // hook — an uncaught throw exits 1, which reads as an error not the
  // designed fail-open, and silently stops ALL recording (R14-F4).
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    state.updated = new Date().toISOString();
    state.hook_self_ms = Date.now() - HOOK_T0; // O-F4: hook self-telemetry — the gate surfaces it
    writeFileSync(statePath(sid), JSON.stringify(state, null, 2));
  } catch { /* recording is best-effort instrumentation */ }
}
const HOOK_T0 = Date.now();
function note(line) { process.stdout.write(JSON.stringify({ context: line }) + "\n"); }
function push(list, item) { if (!list.includes(item)) { list.push(item); list.sort(); } }

// --- event durability: write-ahead queue + serialized drain ------------------
// Two failure classes shared one root cause — the hook process was the only
// carrier of an event. (a) An RPC timeout killed the process before it
// recorded: the file write landed on disk but left zero trace in state.
// (b) Two hooks fired close together ran readState→mutate→writeState
// concurrently: the slower one clobbered the faster one's arms (lost-update).
// The queue fixes both: the raw event is appended to _queue.jsonl as the
// FIRST act — durable before any work that can be killed — and all state
// mutation is serialized through a lockfile, so concurrent invocations
// append-and-exit while exactly one drainer applies events in order.
// The drain also runs at the top of stop-gate so a turn can't end with
// queued-but-unapplied events.
const QUEUE_PATH = join(STATE_DIR, "_queue.jsonl");
const DRAIN_LOCK = join(STATE_DIR, "_drain.lock");
const DRAIN_STALE_MS = 90000; // a lock older than this had its owner killed mid-drain
const DRAIN_MAX_PASSES = 40;  // appended-during-drain events get passes, not a lease
const UID_RING = 2000;        // processed_uids ring — replay dedupe without unbounded growth

function enqueueHookEvent(input) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    const uid = `${Date.now()}.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
    appendFileSync(QUEUE_PATH, `${JSON.stringify({ uid, input })}\n`);
  } catch {
    // Append failed (locked dir, disk full) — degrade to the pre-queue path:
    // apply now, unlocked. The old race class returns for this one event,
    // which still beats dropping it.
    try { applyEvent(input); } catch { /* recording is best-effort */ }
  }
}

let _drainToken = null;
function acquireDrainLock() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      _drainToken = `${process.pid}.${Date.now()}`;
      const fd = openSync(DRAIN_LOCK, "wx");
      try { writeSync(fd, _drainToken); } catch { /* token is best-effort */ }
      closeSync(fd);
      return true;
    } catch (err) {
      if (err && err.code === "EEXIST") {
        try {
          if (Date.now() - statSync(DRAIN_LOCK).mtimeMs > DRAIN_STALE_MS) {
            unlinkSync(DRAIN_LOCK); // owner was killed mid-drain — steal the lock
            continue;
          }
        } catch { /* unreadable lock — treat as held */ }
      }
      return false;
    }
  }
  return false;
}

function releaseDrainLock() {
  // Only the owner's token unlinks — a stale-steal that landed while we
  // worked must not lose its own lock to our release.
  try {
    if (_drainToken != null && readFileSync(DRAIN_LOCK, "utf-8").trim() === _drainToken) unlinkSync(DRAIN_LOCK);
  } catch { /* release is best-effort */ }
  _drainToken = null;
}

/** Drain queued hook events under the drain lock. Exported so the Stop gate
 *  can flush the queue before it reads state — a PostToolUse killed outright
 *  leaves its event queued for the next invocation, and the gate is the last
 *  invocation of a turn. Non-lockholders return immediately. */
export function drainHookEvents() {
  if (!acquireDrainLock()) return;
  try {
    for (let pass = 0; pass < DRAIN_MAX_PASSES; pass++) {
      // Orphaned drain files = a drainer killed mid-batch — they hold the
      // oldest unapplied events, so they always drain before the queue.
      let pending = [];
      try {
        pending = readdirSync(STATE_DIR)
          .filter((f) => /^_drain\..*\.jsonl$/.test(f))
          .sort();
      } catch { /* missing state dir — nothing queued */ }
      try {
        const own = `_drain.${Date.now()}.${process.pid}.jsonl`;
        renameSync(QUEUE_PATH, join(STATE_DIR, own));
        pending.push(own);
      } catch { /* queue absent or raced away — orphans still drain */ }
      if (!pending.length) break;
      for (const name of pending) {
        const fp = join(STATE_DIR, name);
        let lines = [];
        try { lines = readFileSync(fp, "utf-8").split("\n"); } catch { /* unreadable drain file — skip */ }
        for (const line of lines) {
          if (!line) continue;
          let evt = null;
          try { evt = JSON.parse(line); } catch { evt = null; }
          // A torn append produces one unparseable line — that event is
          // lost (the pre-queue behaviour for every event); every other
          // line still applies.
          const ev = evt && evt.input;
          if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
          const sid = ev.session_id || "unknown";
          const uid = evt.uid != null ? String(evt.uid) : null;
          if (uid) {
            const seen = readState(sid).processed_uids;
            if (Array.isArray(seen) && seen.includes(uid)) continue;
          }
          try { applyEvent(ev); } catch { /* one bad event can't stall the queue */ }
          if (uid) {
            // Mark AFTER apply, on a fresh read — applyEvent already wrote
            // state mid-flight, so merging over a stale snapshot would
            // clobber its own recording (the race this file exists to kill).
            const st = readState(sid);
            if (!Array.isArray(st.processed_uids)) st.processed_uids = [];
            st.processed_uids.push(uid);
            if (st.processed_uids.length > UID_RING) st.processed_uids = st.processed_uids.slice(-UID_RING);
            writeState(sid, st);
          }
        }
        try { unlinkSync(fp); } catch { /* a lingering drain file replays next drain — uid dedupe makes that safe */ }
      }
    }
  } catch { /* drain failures leave events queued for the next invocation */ }
  releaseDrainLock();
}

// Watch the session's iteration artifact grow: every observed `## Round N`
// / `## Exit review` gets a first-seen timestamp; impl writes get an
// `impl_log` entry. The Stop gate compares the two timelines — rounds that
// appear only in one late burst (no impl between consecutive first-seen
// times) are the backfill signature (16-iteration-loop → interleave).
// `baseline_rounds` = rounds already present at first observation; their
// timing predates observation and is exempt by declaration, not by guess.
function observeIterationArtifact(state, sid) {
  const p = join(ROOT, ".unlazy", "iteration", `${sid}.md`);
  if (!existsSync(p)) return;
  let text = "";
  try { text = readFileSync(p, "utf-8"); } catch { return; }
  // Same 8MB bound the gate reads under — a planted giant artifact would
  // otherwise be hashed/scanned on every PostToolUse call (a silent-stamp
  // DoS against the hook's own timeout).
  if (text.length > 8_000_000) text = text.slice(0, 8_000_000);
  const now = new Date().toISOString();
  if (!state.round_seen) state.round_seen = {};
  const wasEmpty = Object.keys(state.round_seen).length === 0;
  const seen = [];
  // Fence-strip before stamping — a `## Round N` or `## Exit review` inside a
  // schema example is illustration, not observation (gate strips the same
  // way or the timelines disagree). Line-anchored fences only — inline
  // mentions can't pair up and eat content — and an unclosed fence cuts
  // its tail, matching the gate.
  const text_nf = (() => {
    const stripped = text.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\r?\n[\s\S]*?^[ \t]*\1[ \t]*\r?$/gm, "");
    const openM = stripped.match(/^[ \t]*(`{3,}|~{3,})/m);
    return openM ? stripped.slice(0, openM.index) : stripped;
  })();
  // D1: record the artifact's recursion depth — `## Depth` → `depth: N`
  // is the additive state key the gate corroborates against.
  const ldM = text_nf.match(/##\s*depth\b[\s\S]*?\bdepth\s*:\s*(\d+)/i);
  if (ldM) state.loop_depth = parseInt(ldM[1], 10);
  const heads = [...text_nf.matchAll(ROUND_HEAD_RE)];
  for (let i = 0; i < heads.length; i++) {
    const n = parseInt(heads[i][1], 10);
    // A round exists for timing purposes when its WALK lands, not when a
    // stub `## Round N` heading appears — a heading-only stub stamped
    // early would make the interleave interval unverifiable. Substance =
    // the round body reaching `### Traversal`.
    const body = text_nf.slice(heads[i].index, i + 1 < heads.length ? heads[i + 1].index : undefined);
    // Substance = the walk actually landing — a bare `### Traversal`
    // heading alone isn't a walked round; require a heading plus at
    // least one table row (a scaffold of empty headings can't anchor
    // the interleave timeline).
    const hasSubstance =
      (/^#{2,6}\s*Traversal\b/im.test(body) && /^\s*\|\s*L\d{1,2}\b/im.test(body)) ||
      (/^#{2,6}\s*Findings\b/im.test(body) && /^\s*\|\s*(?:[A-Z]{1,3}\d*-?)?F\d+\b/im.test(body));
    if (hasSubstance) {
      if (!state.round_seen[n]) { state.round_seen[n] = now; seen.push(n); }
      // Row-count signature: a skeleton round (one token row) stamped
      // early then bulked at wrap-up is backfill in slow motion. Track
      // when the traversal's L-row count last changed — the gate flags
      // a round still growing after the next round 'walked' it.
      const rowCount = (body.match(/^\s*\|\s*L\d{1,2}\b/gim) || []).length;
      state.round_rows = state.round_rows || {};
      state.round_rows_at = state.round_rows_at || {};
      if (state.round_rows[n] !== rowCount) {
        // First sight of a round's row count records the count but NOT a
        // timestamp — the field's birth instant isn't a bulk-up event.
        if (n in state.round_rows) state.round_rows_at[n] = now;
        state.round_rows[n] = rowCount;
      }
    } else if (state.round_seen[n]) {
      delete state.round_seen[n]; // earlier stub stamp — retract; re-stamps when the walk lands
    }
  }
  if (wasEmpty && seen.length) state.baseline_rounds = [...seen];
  // Exit review + ENDED stamp on CONTENT change, not just first sight —
  // "rewrite the review post-impl" must be able to move the timestamp, and
  // a whitespace touch must NOT move it. The signature is the section body.
  // Signatures hash the whitespace-normalized body — an internal spacing
  // edit can't re-stamp the clock without changing content.
  const sigOf = (s) => { const t = s.replace(/\s+/g, ""); let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; };
  const exitM = text_nf.match(/^##\s*Exit\s+review\b/im);
  if (exitM) {
    const rest = text_nf.slice(exitM.index);
    const nextH = rest.slice(1).search(/^##\s/m);
    const body = (nextH < 0 ? rest : rest.slice(0, nextH + 1)).trim();
    const sig = sigOf(body);
    if (sig !== state.exit_review_sig) { state.exit_review_sig = sig; state.exit_review_seen = now; }
  }
  // ENDED stamps the LAST occurrence — the gate reads the last too, so an
  // earlier stale ENDED can't shadow the real terminator's timestamp.
  const endedAll = [...text_nf.matchAll(/^\s*ENDED\s*:\s*\S[^\n]*/gim)];
  if (endedAll.length) {
    const sig = sigOf(endedAll[endedAll.length - 1][0].trim());
    if (sig !== state.ended_sig) { state.ended_sig = sig; state.ended_seen = now; }
  }
}

function validateArtifact(filePath) {
  try {
    const text = readFileSync(filePath, "utf-8");
    const missing = [];
    if (!text.includes("<!-- design-review v1 -->")) missing.push("the `<!-- design-review v1 -->` marker");
    if (!/\|\s*surface\s*\|/i.test(text)) missing.push("a Coverage table (`| surface | ...`)");
    if (/\|\s*surface\s*\|/i.test(text) && !/\|\s*persona\s*\|/i.test(text)) missing.push("a `persona` column in the Coverage table");
    if (!/\|\s*(id|finding)\s*\|/i.test(text) && !/no findings/i.test(text)) {
      missing.push("a Findings table or an explicit 'No findings' statement");
    }
    if (!/##\s*predictions\b/i.test(text)) missing.push("a `## Predictions` section (or 'none')");
    if (!/##\s*options\b/i.test(text)) missing.push("an `## Options` section (or 'none')");
    if (!/##\s*unverified\b/i.test(text)) missing.push("an `## Unverified` section (the named remainder, or 'none')");
    if (!/##\s*constraint\s*check\b/i.test(text)) missing.push("a `## Constraint check` section (the ask re-read verbatim — carried or dropped)");
    if (!/##\s*lenses\b/i.test(text)) missing.push("a `## Lenses` section (each pass's verdict or DECLARED)");
    if (!/##\s*emphasis\s*audit\b/i.test(text)) missing.push("an `## Emphasis audit` section (painted top-3 vs intended top-3)");
    if (!/##\s*question\s*verdicts\b/i.test(text)) missing.push("a `## Question verdicts` section (one row per spec member question)");
    if (!/##\s*revisions\b/i.test(text)) missing.push("a `## Revisions` section (v1 → v2 per authored element, or 'none — <why>')");
    if (!/##\s*cold\s*read\b/i.test(text)) missing.push("a `## Cold read` section (first-glance pass, before the fix list is opened)");
    if (!/##\s*stranger\b/i.test(text)) missing.push("a `## Stranger` section (the stranger-read pass — what a fresh member sees first, or 'none')");
    if (!/##\s*liveness\b/i.test(text)) missing.push("a `## Liveness` section (the behavior ledger — every interactive element exercised or DECLARED)");
    if (!/##\s*provenance\b/i.test(text)) missing.push("a `## Provenance` section (where each element's value came from — real data, exemplar, or invented + defense)");
    if (!/##\s*pre-flight\b/i.test(text)) missing.push("a `## Pre-flight` section (the run-before-ship checks verified on the live surface)");
    if (!/##\s*interrogation\b/i.test(text)) missing.push("an `## Interrogation` section (the expandable question per component — or `sole — <why>`)");
    if (!/^\s*holistic\s*:/im.test(text)) missing.push("a `holistic:` verdict line (composition read)");
    if (!/^\s*micro\s*:/im.test(text)) missing.push("a `micro:` verdict line (element read)");
    if (!/^\s*state\s*pass\s*:/im.test(text)) missing.push("a `state pass:` line (element-states sweep, or n/a — <why>)");
    if (!/^\s*balance\s*pass\s*:/im.test(text)) missing.push("a `balance pass:` line (visual weight/alignment sweep, or n/a — <why>)");
    const refLine = (text.match(/\breferent\s*:\s*(.*)/i) || [])[1] || "";
    if (refLine && !/\bnone\b/i.test(refLine)) {
      if (!/##\s*anatomy\s*diff\b/i.test(text)) missing.push("an `## Anatomy diff` section (referent named — unit-level anatomy vs the exemplar)");
      if (!/##\s*defense\b/i.test(text)) missing.push("a `## Defense` section (why each unit is designed — citing the referent, or no-referent:)");
    }
    const sidGuess = basename(filePath, ".md");
    if (existsSync(join(STATE_DIR, "..", "design-spec", `${sidGuess}.md`)) && !/##\s*budgets\b/i.test(text)) {
      missing.push("a `## Budgets` section (a spec governs this session — countable divergence vs the exemplar is required)");
    }
    if (missing.length) {
      note(`design-review artifact written but missing: ${missing.join("; ")}. The Stop gate will reject it — fix the format now. See rules/09-design-review.mdc.`);
    }
  } catch { /* let the stop gate report it */ }
}

function validateDesignSpec(filePath) {
  try {
    const text = readFileSync(filePath, "utf-8");
    const missing = [];
    if (!text.includes("<!-- design-spec v2 -->")) missing.push("the `<!-- design-spec v2 -->` marker (v2 = captures: + observation-token cites + ## Quality contract; v1 parses but emits the upgrade note at the gate)");
    if (!/##\s*exemplar\b/i.test(text)) missing.push("a `## Exemplar` section (anchor + class + external)");
    if (!/##\s*chrome\b/i.test(text)) missing.push("a `## Chrome` section (exemplar chrome class + chosen + alternatives + budget)");
    if (!/##\s*registration\b/i.test(text)) missing.push("a `## Registration` section (search-derived type-ledger, or 'none')");
    if (!/##\s*surfaces\b/i.test(text)) missing.push("a `## Surfaces` section (search-derived reach-ledger, or 'none')");
    if (!/##\s*concept\b/i.test(text)) missing.push("a `## Concept` section (the one governing sentence)");
    if (!/##\s*constraint ledger\b/i.test(text)) missing.push("a `## Constraint ledger` section (verbatim ask constraints, content/method tags, check forms)");
    if (!/##\s*member questions\b/i.test(text)) missing.push("a `## Member questions` section (the contract the surface answers)");
    if (!/##\s*domain checklist\b/i.test(text)) missing.push("a `## Domain checklist` section (canonical features from real exemplars)");
    if (!/##\s*embedded surfaces\b/i.test(text)) missing.push("an `## Embedded surfaces` section (each interactive container re-run as its own design unit — or 'none')");
    if (!/##\s*layout budget\b/i.test(text)) missing.push("a `## Layout budget` section (declared allocation arithmetic per breakpoint — or 'none')");
    if (!/##\s*emphasis ladder\b/i.test(text)) missing.push("an `## Emphasis ladder` section (every element ranked 1–5 before inventory)");
    if (!/##\s*grammar\b/i.test(text)) missing.push("a `## Grammar` section (concrete values — load the `design-grammar` skill)");
    if (!/##\s*inventory\b/i.test(text)) missing.push("a `## Inventory` table (every element with its decisions — zero decisions left in generation)");
    if (!/##\s*open calls\b/i.test(text)) missing.push("an `## Open calls` section (or 'none')");
    if (!/##\s*directions\b/i.test(text)) missing.push("a `## Directions` section (region jobs + payload allocation)");
    if (!/##\s*state space\b/i.test(text)) missing.push("a `## State space` section (surface-level state/chrome states)");
    if (!/##\s*authored vs inherited\b/i.test(text)) missing.push("an `## Authored vs inherited` section (what's new vs what the exemplar carries)");
    if (!/##\s*revision\b/i.test(text)) missing.push("a `## Revision` section (the second-pass commitment, or 'none')");
    if (!/##\s*lazy signals\b/i.test(text)) missing.push("a `## Lazy signals` section (the tells this spec must not exhibit)");
    try {
      const body = (() => { const m = text.match(/##\s*constraint ledger\b([\s\S]*?)(?=\n##\s|\s*$)/i); return m ? m[1] : ""; })();
      const rows = body.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\bclass\b[\s\S]*\bcheck/i.test(l));
      const bad = rows.filter((l) => !/^\s*\|\s*(content|method|decision|approval)\s*\|/i.test(l) || l.split("|").slice(1, -1).filter((c) => c.trim()).length < 3);
      if (rows.length && bad.length) missing.push(`${bad.length} ## Constraint ledger row(s) not in 'class | quoted constraint | check:' form — every row carries its own falsifiable check or DECLARED:`);
    } catch { /* format check is best-effort */ }
    try {
      const invBody = (() => { const m = text.match(/##\s*inventory\b([\s\S]*?)(?=\n##\s|\s*$)/i); return m ? m[1] : ""; })();
      if (invBody && !/^\s*none\b/im.test(invBody)) {
        const irows = invBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/^\s*\|\s*element\s*\|/i.test(l) && !/\bdata role\b/i.test(l));
        if (irows.length && !/^\s*sole\s*(?:—|--|::| - )\s*\S/im.test(invBody)) {
          if (irows.some((l) => !/\bjob\s*:/i.test(l) || !/\bearns\s*:/i.test(l))) missing.push("## Inventory row(s) missing `job:`/`earns:` (each element names its job + what earns its place)");
          if (irows.some((l) => !/\bexpandable\s*:\s*\S/i.test(l) && !/\bsole\s*(?:—|--|::| - )\s*\S.{29}/i.test(l))) missing.push("## Inventory row(s) missing the expansion verdict (`expandable: <named sub-unit>` or `sole — <why ≥30>`)");
        }
      }
      const depBody = (() => { const m = text.match(/##\s*depth\b([\s\S]*?)(?=\n##\s|\s*$)/i); return m ? m[1] : ""; })();
      const depN = depBody ? parseInt(((depBody.match(/\bdepth\s*:\s*(\d+)/i) || [])[1] || "0"), 10) : 0;
      if (depBody && depN > 1) {
        const drows = depBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\|\s*level\s*\|/i.test(l));
        if (drows.length < depN) missing.push(`## Depth shows ${depN} but only ${drows.length} ledger row(s) (one row per level traversed)`);
      }
    } catch { /* inventory/depth nags are best-effort */ }
    if (missing.length) {
      note(`design-spec written but missing: ${missing.join("; ")}. The Stop gate will reject it — fix the format now. Spec: rules/13-design-spec.mdc.`);
    }
  } catch { /* let the stop gate report it */ }
}

// Analysis-doc write-time validator (pipeline-improvement Phase A): the
// mid-write layer for the extended ANALYSIS-PROJECT schema — parity and
// conduct nags land while the doc grows, not at stop.
function validateAnalysisDoc(filePath) {
  try {
    const text = readFileSync(filePath, "utf-8");
    if (!text.includes("<!-- analysis-project v2 -->")) return;
    const missing = [];
    if (!/^\s*subject-class\s*:/im.test(text)) missing.push("a `subject-class:` line (project|process|unit)");
    const cls = (text.match(/^\s*subject-class\s*:\s*([A-Za-z]+)/im) || [])[1] || "";
    if (cls === "project" || cls === "process") {
      const planBody = (() => { const m = text.match(/##\s*Analysis plan\b([\s\S]*?)(?=\n##\s|\s*$)/i); return m ? m[1] : ""; })();
      if (!/\|\s*question\s*\|[^|\n]*\bunit\b/i.test(planBody)) missing.push("a question-table in `## Analysis plan` (`| question | unit | settles-by | settled-by |`)");
      if (!/##\s*Model\b/i.test(text)) missing.push("a `## Model` section (rows carry `derived:`/`inferred:`)");
      if (!/##\s*Dependencies\b/i.test(text)) missing.push("a `## Dependencies` section (or 'none — <why>')");
      if (!/##\s*Failure modes\b/i.test(text)) missing.push("a `## Failure modes` section (≥2 lines)");
      if (!/##\s*Prior art\b/i.test(text)) missing.push("a `## Prior art` section (or 'none — <why>')");
      const STEPS = ["universe", "question-space", "unit-selection", "unit-walk", "widening", "drill", "rank", "synthesis", "falsification", "eyes"];
      const miss = STEPS.filter((s) => !new RegExp(`method\\s*:\\s*${s.replace(/-/g, "[-\\s]?")}\\s*(?:—|–|-|:)\\s*(?:ran\\b|AXIS-NA\\s*:)`, "i").test(text));
      if (miss.length) missing.push(`method: rows for ${miss.join(", ")} (conduct record — rows accrue during the walk, not at wrap-up)`);
      // Parity nag: ### units not yet mapped to a plan row.
      const units = [...text.matchAll(/^###\s+([A-Za-z]{0,3}\d+)/gm)].map((m) => m[1].toUpperCase());
      const covered = new Set();
      for (const rm of planBody.matchAll(/([A-Za-z]{0,3})(\d+)\s*[–—-]\s*([A-Za-z]{0,3})(\d+)/g)) {
        const pre = (rm[1] || rm[3]).toUpperCase();
        for (let n = +rm[2]; n <= +rm[4]; n++) covered.add(pre + n);
      }
      for (const tm of planBody.matchAll(/\b([A-Za-z]{1,3}\d+)\b/g)) covered.add(tm[1].toUpperCase());
      const unmapped = units.filter((u) => !covered.has(u));
      if (unmapped.length && !/sole\s*(?:—|--|::| - )\s*\S/i.test(planBody)) missing.push(`### units ${unmapped.slice(0, 4).join(", ")} not yet mapped to an ## Analysis plan row`);
    }
    if (missing.length) {
      note(`analysis-project doc written but missing: ${missing.join("; ")}. The Stop gate will reject it — fix the format now. Spec: rules/15-analysis-depth.mdc → extended project schema.`);
    }
  } catch { /* let the stop gate report it */ }
}

const TRACKER_PLAN_BN_RE = /(^|[-_.])plans?([-_.]|$)/i;
const TRACKER_PLAN_EXCL_RE = /(^|[-_.])(proposals?|analysis|reviews?|findings?|audits?)([-_.]|$)/i;

function validatePlanDoc(filePath) {
  try {
    const text = readFileSync(filePath, "utf-8");
    const missing = [];
    const sole = /\bsole\s*(?:—|--|::| - )\s*\S/i.test(text);
    const tblHdr = text.match(/\|\s*unit\s*\|[^\n]*\bacceptance\b[^\n]*\b(?:evidence|verify)\b[^\n]*\|/i);
    let rows = 0;
    if (tblHdr) {
      for (const l of text.slice(tblHdr.index + tblHdr[0].length).replace(/^\r?\n/, "").split(/\r?\n/)) {
        if (!/^\s*\|/.test(l)) break;
        if (!/^\s*\|[\s:\-|]+\|\s*$/.test(l)) rows++;
      }
    }
    const fileToks = new Set((text.match(/[\w.\\/-]+\.(?:mjs|js|ts|py|css|html|j2|md|mdc|json|ya?ml|txt|png)\b/gi) || []).map((s) => s.toLowerCase()));
    if (fileToks.size < 3 && rows < 2) return; // below the arm floor — core fields only
    const sec = (name) => {
      const m = text.match(new RegExp(`^##\\s*${name.replace(/\s+/g, "\\s+")}\\b[^\\n]*$`, "im"));
      if (!m) return "";
      const rest = text.slice(m.index + m[0].length);
      const next = rest.search(/^##\s/m);
      return (next < 0 ? rest : rest.slice(0, next)).trim();
    };
    if (!tblHdr && !sole) missing.push("a unit-table (`| unit | acceptance | evidence |`, ≥2 rows — or `sole — <why>`)");
    else if (tblHdr && rows < 2 && !sole) missing.push("the unit-table needs ≥2 rows (or `sole — <why>`)");
    for (const s of ["Task-comprehension record", "Invariants", "Blast radius", "Ordering"]) {
      const body = sec(s);
      if (body.length < 10 && !/\bn\/?a\s*(?:—|--|::| - )\s*\S/i.test(body)) {
        missing.push(`\`## ${s}\` — or \`n/a — <why>\``);
      }
    }
    if (!/##\s*Considerations\b/i.test(text)) missing.push("a `## Considerations` matrix (8 dimensions, `checked:`/`AXIS-NA:` rows)");
    if (!/##\s*Quality\s*bar\b/i.test(text)) missing.push("a `## Quality bar` section (judgment shape, not just measurable success)");
    if (!/(?:plan-wrong|change-fails)\s*:/i.test(text)) missing.push("the wrongness split — `plan-wrong:` or `change-fails:` (a `risk:` bullet counts as neither)");
    if (!/##\s*Build\b/i.test(text) && !/^\s*inline\s*(?:—|--|::| - )\s*\S/im.test(text)) missing.push("a `## Build` construction record — or `inline — <why>`");
    if (!/##\s*Sub[-\s]?plans\b/i.test(text)) missing.push("a `## Sub-plans` ledger (`inline`/`spawned` rows — or `none — <why>`)");
    if (!/carried\s*:[^\n]*\.mdc?\b/i.test(text)) missing.push("a `carried:` line — the analysis/spec this plan carries (doc + section name)");
    if (missing.length) {
      note(`plan doc written above the extended-schema floor but missing: ${missing.join("; ")}. The Stop gate's PLAN-SCHEMA will reject it — fix the format now. Spec: rules/00-operating.mdc §2c + rules/10-rule-enforcement.mdc gate map.`);
    }
  } catch { /* let the stop gate report it */ }
}

function validateAuditLedger(filePath) {
  try {
    const text = readFileSync(filePath, "utf-8");
    const missing = [];
    if (!text.includes("<!-- audit-ledger v1 -->")) missing.push("the `<!-- audit-ledger v1 -->` marker");
    if (!/##\s*Enumeration\b/i.test(text)) missing.push("a `## Enumeration` section (`| unit | count | derived-by |`)");
    if (!/##\s*Coverage\b/i.test(text)) missing.push("a `## Coverage` table (`| unit | universe | evidence | state |`)");
    if (!/##\s*Denial\b/i.test(text)) missing.push("a `## Denial` section (the written red-team pass before reporting)");
    if (missing.length) {
      note(`audit-ledger written but missing: ${missing.join("; ")}. The Stop gate will reject it — fix the format now. Spec: rules/03-periodic-audits.mdc → audit-ledger.`);
    }
  } catch { /* let the stop gate report it */ }
}

// Path-class arming shared by the edit/write flow and the exec-write
// scan: a file is a file regardless of the mechanism that wrote it.
// `via` labels the mechanism in the arming notes so the record shows
// whether the write came through a file tool or a shell command.
// Content-derived arms (DDL inside new content, route decorators) stay
// in the edit/write path — the exec scan sees paths, not content.
// GATEST_RE: the synthetic gate matrix (.unlazy/_gate-test.mjs) writes
// fixtures into REAL artifact dirs and cleans them up after — its SID
// is `gatest-synthetic` plus a handful of named fixture basenames. Those
// writes are not session work: without the skip they arm plan_docs,
// marker_docs and friends against the LIVE session, and the gate then
// bills missing/deleted synthetic docs as forged state.
const GATEST_RE = /gatest|(?:^|[\/\\])(?:widget-analysis|counterfeit-analysis|hidden-findings)\.md$/i;
function armClassifiedPath(state, sid, filePath, via) {
  const rel = repoRel(filePath);
  if (GATEST_RE.test(rel)) return;
  if (!filePath.includes(".unlazy/")) state.files_edited = (state.files_edited || 0) + 1;

  const firstUi = state.ui_touched.length === 0;
  if (((UI_RE.test(filePath) && SRC_RE.test(filePath)) || RENDER_RE.test(filePath) || UNLAZY_RENDER_RE.test(filePath)) && !GENERATED_RE.test(filePath)) {
    push(state.ui_touched, rel);
    state.ui_edit_count = (state.ui_edit_count || 0) + 1;
    // Heal the stamp on any later write too — sessions migrated across
    // the field's introduction (ui_touched non-empty, stamp null) would
    // otherwise keep it null forever and the gate's coverage-ordering
    // check (probe must postdate the first UI edit) stays vacuous.
    if (!state.ui_first_edit_at) state.ui_first_edit_at = new Date().toISOString();
    if (!firstUi && state.ui_edit_count % 8 === 0) {
      note(`CHECKPOINT: ${state.ui_edit_count} UI edits this session — interrogation accrues in the artifact as you work, it is never backfilled at the end. Refresh .unlazy/design-review/${sid}.md now: what did you just place, what alternatives were weighed, what did you question? A one-pass artifact flags BACKFILL at the gate.`);
    }
    if (firstUi) {
      state.ui_first_edit_at = new Date().toISOString();
      const specNote = state.design_spec_at
        ? "design-spec already on file (precedes this edit — gate satisfied)."
        : `DESIGN-SPEC gate: this write preceded the spec. The spec must exist BEFORE the first UI write — write .unlazy/design-spec/${sid}.md now (exemplar → chrome → concept → registration → surfaces → grammar → inventory → open calls; the write will need EXEMPT-SPEC or an honest spec-after fact) — rules/13-design-spec.mdc.`;
      note(`design-review gate armed: UI source written via ${via} (${rel}). Before stopping, write the element-enumerated critique to .unlazy/design-review/${sid}.md — spec: rules/09-design-review.mdc. ${specNote}`);
    }
    // First-render eyes nag (09-design-review → the first render gets
    // its own pass): the second rendered-file write is the last cheap
    // moment — after it, the first surface's pattern is already
    // propagating to siblings. Advisory once; the gate does the check.
    if (!state.fr_nag_done && RENDER_RE.test(filePath)) {
      const rendered = state.ui_touched.filter((p) => RENDER_RE.test(p));
      if (rendered.length >= 2) {
        state.fr_nag_done = true;
        const frPath = join(ROOT, ".unlazy", "eyes", `${sid}-first-render.md`);
        const specPath = join(ROOT, ".unlazy", "design-spec", `${sid}.md`);
        let generative = false;
        try { generative = /##\s*directions\b/i.test(readFileSync(specPath, "utf-8")); } catch { }
        if (generative && !existsSync(frPath)) {
          note(`first-render eyes: 2 rendered files written and no .unlazy/eyes/${sid}-first-render.md — a spec with ## Directions owes a stranger cold-read on the FIRST surface's first captures (eyes v2, briefed against ## Quality contract) BEFORE the pattern propagates further. Now is the last cheap moment — 09-design-review → first-render pass.`);
        }
      }
    }
    // Spec-critique nag — generative spec + first render landing but no
    // -spec.md pass: the stranger critiques the spec's DECISIONS
    // (ceiling, payload, bar match) BEFORE the pattern hardens. Fires
    // once, on the first rendered write — the last cheap moment.
    if (!state.sc_nag_done && RENDER_RE.test(filePath)) {
      try {
        const specPath2 = join(ROOT, ".unlazy", "design-spec", `${sid}.md`);
        const specText2 = existsSync(specPath2) ? readFileSync(specPath2, "utf-8") : "";
        const scPath = join(ROOT, ".unlazy", "eyes", `${sid}-spec.md`);
        if (/##\s*directions\b/i.test(specText2) && !existsSync(scPath) && !/DECLARED\s*:\s*spec[-\s]?critique/i.test(specText2)) {
          state.sc_nag_done = true;
          note(`spec-critique eyes: a spec with ## Directions is rendering with no .unlazy/eyes/${sid}-spec.md — a stranger critiques the spec's DECISIONS (ceiling, payload, bar match) BEFORE first render hardens the pattern. Now is the last cheap moment — 13-design-spec → ## Spec critique.`);
        }
      } catch { }
    }
  }
  if (TEST_RE.test(filePath)) push(state.tests_touched, rel);
  if (MIGRATION_RE.test(filePath)) push(state.migrations_touched, rel);
  if (SITEMAP_RE.test(filePath)) state.sitemap_touched = true;

  const firstImpl = !(state.impl_touched || []).length;
  if (IMPL_RE.test(filePath) && !IMPL_EXCL_RE.test(filePath)) {
    if (!state.impl_touched) state.impl_touched = [];
    push(state.impl_touched, rel);
    const nowIso = new Date().toISOString();
    state.last_impl_at = nowIso;
    if (!state.impl_log) state.impl_log = [];
    state.impl_log.push(nowIso);
    // DD-F3: a CLOSURE: line predating this impl write is stale — the
    // source it covered changed underneath it. Advisory once per session;
    // the gate-side re-verification demand is the binding layer.
    if (!state.cl_nag_done && state.closure_write_at && new Date(state.closure_write_at).getTime() < Date.parse(nowIso)) {
      state.cl_nag_done = true;
      note(`closure staleness: an impl write landed after a CLOSURE: line was written — the closure now covers a changed source. Re-verify the closure's claim against the new diff or rewrite the line (DD-F3: closure-write vs impl-write ordering).`);
    }
    // 2000, not 300: the interleave check needs impl entries NEAR early
    // rounds' first-seen times — a short cap evicts exactly the evidence
    // old rounds need in a long session.
    if (state.impl_log.length > 2000) state.impl_log = state.impl_log.slice(-2000);
    if (firstImpl) {
      note(`iteration-loop gate armed: implementation written via ${via} (${rel}). Before stopping, .unlazy/iteration/${sid}.md must hold the loop record — <!-- iteration-loop v2 --> + Scope + Scope basis + Budget + one ## Round N per walk (analysis plan → L1–L14 traversal incl. L13 delta (r≥2) + L14 embarrassment → class-tagged findings → applied) + an ENDED terminator + a ## Exit review (the quality verdict pass — no terminator is legal without it; rendered subjects need ≥1 verdict row citing external evidence) — spec: rules/16-iteration-loop.mdc. Scope 'fix' (budget 0) still owes the declaration + Exit review + ENDED: fix-scope. Or EXEMPT-LOOP: * — <reason> in .unlazy/gate-evidence/${sid}.md.`);
    } else {
      // Pacing nags: (a) an ENDED artifact this write just made stale —
      // the terminator predates new impl, so the loop owes round N+1 and
      // a FRESH Exit review; (b) every 3rd impl write with no artifact
      // at all. Advisory — the Stop gate does the blocking.
      const artPath = join(ROOT, ".unlazy", "iteration", `${sid}.md`);
      if (existsSync(artPath)) {
        try {
          const art = readFileSync(artPath, "utf-8");
          if (/ENDED:\s*(clean-walk|budget-met|fix-scope|redirected)\b/.test(art)) {
            const mt = statSync(artPath).mtimeMs;
            const stale = !state.stale_nag_at || new Date(state.stale_nag_at).getTime() < mt || (state.impl_log.length % 3 === 0);
            if (stale) {
              state.stale_nag_at = nowIso;
              note(`iteration-loop: this impl write post-dates the ENDED artifact — the terminator is now stale. Round N+1 (traversal of this change) + a FRESH ## Exit review are owed before stop; the old ENDED cannot satisfy the gate.`);
            }
          }
        } catch { /* artifact unreadable — the gate reports it */ }
      } else if ((state.impl_log.length || 0) % 3 === 0) {
        note(`iteration-loop: ${state.impl_log.length} impl writes and no .unlazy/iteration/${sid}.md yet — the loop record accrues as rounds happen; a burst-written artifact fails the interleave check.`);
      }
    }
  }

  // I4: `_`-prefixed basenames are scratch/fixtures by convention — they
  // never arm deliverable obligations (synthetic test docs armed real
  // MISSING-DOC/PLAN-DELTA/corroboration obligations three times).
  const fixtureDoc = /^_/.test(basename(String(filePath)));
  // I1: writes to instrument-owned output dirs are recorded (visibility,
  // not arming) so the gate can bind artifacts to their producers.
  // F1/F6: was coverage|eyes only — the gate's dark-corpus and
  // arm-by-write scans read this field, so narrowing it here made 5 of
  // the 7 dark dirs invisible. Record every .unlazy write; consumers
  // filter by dir/ext themselves.
  if (/^\.unlazy[\/\\]/i.test(String(rel))) {
    if (!Array.isArray(state.instrument_output_writes)) state.instrument_output_writes = [];
    state.instrument_output_writes.push({ p: rel, at: new Date().toISOString(), via });
    if (state.instrument_output_writes.length > 200) state.instrument_output_writes.splice(0, state.instrument_output_writes.length - 200);
  }

  // Analysis-arm pacing: an armed analysis ask + impl writes but no
  // analysis doc — the ask is being answered with code, not examination.
  if (!fixtureDoc && filePath.includes(".unlazy/analysis/") && /\.md$/i.test(filePath)) state.analysis_doc_written = true;
  if (state.analysis_asked && !state.analysis_doc_written && !state.analysis_nag_done && state.impl_log && state.impl_log.length >= 1 && IMPL_RE.test(filePath) && !IMPL_EXCL_RE.test(filePath)) {
    state.analysis_nag_done = true;
    note(`analysis ask armed with no .unlazy/analysis/ doc while implementation lands — for subject analyses the deliverable is the examination doc (<!-- analysis-project v2 -->: subject-job → universe → per-unit findings → hypothesis log → constraint check → committed synthesis). Chat-scale answers carry the floor: machinery-plan + examined-vs-found counts + hypothesis lines + committed synthesis + ## Evidence — or DECLARED: chat-scale — <why> for a genuinely narrow ask.`);
  }

  const firstAudit = !(state.audit_armed || []).length;
  if (!fixtureDoc && ANALYSIS_DOC_RE.test(filePath) && !AUDIT_LEDGER_RE.test(filePath)) {
    if (!state.audit_armed) state.audit_armed = [];
    push(state.audit_armed, rel);
    // Method-row timing (A8's timing tooth): per-write method-row counts —
    // rows appearing only in the final write are the attestation signature.
    try {
      const t = readFileSync(filePath, "utf-8");
      if (t.includes("<!-- analysis-project v2 -->")) {
        if (!state.analysis_method_hist || typeof state.analysis_method_hist !== "object") state.analysis_method_hist = {};
        const h = state.analysis_method_hist[rel] || (state.analysis_method_hist[rel] = []);
        h.push({ w: h.length + 1, c: (t.match(/^\s*method\s*:/gim) || []).length });
        if (h.length > 60) h.splice(0, h.length - 60);
      }
    } catch { /* unreadable mid-write — timing record is best-effort */ }
    validateAnalysisDoc(filePath);
    // Compression tell (autopsy U8-3): a doc that carries proposal/routing
    // vocabulary AND an impossibility verdict in the same file is the
    // `proposed fix + judgment call` → `unmitigated` compression. The nag
    // is advisory; the gate's VERDICT-CLOSER is the binding half.
    if (!state.compression_nag_done) {
      try {
        const docText = readFileSync(filePath, "utf-8")
          .replace(/`[^`\n]*`/g, "").replace(/"[^"\n]*"/g, ""); // mention ≠ use
        const hasProposal = /\bImprovement:|judgment call|routed? to the user|decision for the user/i.test(docText);
        const hasVerdict = /\bunmitigat\w+|impossible to (?:fix|mitigate)|cannot be (?:fixed|mitigated|un-\w+)\b/i.test(docText);
        if (hasProposal && hasVerdict) {
          state.compression_nag_done = true;
          note(`verdict-compression tell in ${rel}: proposal/routing vocabulary and an impossibility verdict coexist — the O-F11 shape is a finding that proposes AND routes, later closed by verdict. Each impossibility verdict needs found:/cleared:/tried: falsification record or ROUTED:/BLOCKED:/ACCEPTED: disposition, or VERDICT-CLOSER flags it (autopsy U8-1).`);
        }
      } catch { /* unreadable mid-write — advisory only */ }
    }
    if (firstAudit) {
      note(`audit-ledger gate armed: analysis output written via ${via} (${rel}). Before stopping, write the enumeration+coverage ledger to .unlazy/audit-ledger/${sid}.md — every universe counted by command (verify:) or justified (DECLARED:), every unit covered or dispositioned. Spec: rules/03-periodic-audits.mdc → audit-ledger. Or EXEMPT-AUDIT: * — <reason> in .unlazy/gate-evidence/${sid}.md.`);
    }
  }

  const firstLedger = (state.plan_docs || []).length === 0;
  if (!fixtureDoc && LEDGER_DOC_RE.test(filePath) && !LEDGER_EXCL_RE.test(filePath)) {
    if (!state.plan_docs) state.plan_docs = [];
    // PP-F2: a plan doc RE-written after implementation writes began is a
    // plan that changed under the plan — stamp plan_delta_needed so the
    // gate demands a ## Delta record of what it learned from contact
    // with the code.
    if ((state.plan_docs || []).includes(rel) && (state.impl_log || []).length) {
      if (!Array.isArray(state.plan_delta_needed)) state.plan_delta_needed = [];
      if (!state.plan_delta_needed.includes(rel)) state.plan_delta_needed.push(rel);
    }
    const firstGapDoc =
      GAP_DOC_RE.test(filePath) && !state.plan_docs.some((p) => GAP_DOC_RE.test(p));
    push(state.plan_docs, rel);
    if (firstLedger) {
      note(`open-ledger gate armed: ledger doc written via ${via} (${rel}). Before stopping, every deferral-labeled or undisposed-coverage line ("not covered/read this pass", "boundary" sections) in it must carry BLOCKED: (named external blocker) or ACCEPTED: (user agreed this session) — QUEUED:/SKIPPED: are not states and flag as deferral. Or the file needs EXEMPT-LEDGER in .unlazy/gate-evidence/${sid}.md. See 00-operating §2e, 03-periodic-audits 4b, rules/10-rule-enforcement.mdc.`);
    }
    if (firstGapDoc) {
      note(`gap-review gate armed: deliverable-shaped doc written (${rel}). Before stopping, the doc needs a non-empty ## Gap review section recording the author→reviewer pass — the orthogonal enumerations (audiences × asks, lifecycle states, user journeys, concept demands, ask re-read) and what each found or "nothing found" — or EXEMPT-GAPREVIEW: <file> — <reason> in .unlazy/gate-evidence/${sid}.md. See 00-operating §2a → produced-deliverables reviewer pass.`);
      note(`independent-eyes gate armed: deliverable doc written (${rel}). Before stopping, the doc needs a non-empty ## Independent eyes section — the fresh-eyes pass (agent seeing only the artifact + its question, never the spec/intent/diff): who ran it, findings, what was incorporated — or a DECLARED: <why none> line inside it, or EXEMPT-EYES: <file> — <reason>. See 15-analysis-depth item 7.`);
    }
    // Phase B: mid-write mirror of the plan extended-schema arm —
    // basename-shaped plan docs get the nag before the stop gate bills them.
    const bn = String(filePath).split(/[\\/]/).pop() || "";
    if (TRACKER_PLAN_BN_RE.test(bn) && !TRACKER_PLAN_EXCL_RE.test(bn)) {
      validatePlanDoc(filePath);
    }
  }

  // DD-F1: plan-doc checklist flips — a `- [ ]` → `- [x]` transition
  // inside an armed ledger doc is a completed work item that never
  // entered todo_write, so ITEM-CLOSURE's per-item scrutiny never
  // armed. The diff is mechanical: snapshot each doc's checked stems,
  // and every newly-checked stem lands in plan_items_done — the gate
  // demands the same CLOSURE for each.
  try {
    const docText = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
    const checkedNow = [...docText.matchAll(/^\s*[-*]\s*\[(x|X|✓|✔)\]\s+([^\n|]{4,80})/gm)]
      .map((m) => m[2].trim().toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).slice(0, 6).join(" "))
      .filter(Boolean);
    if (!state.plan_checklist || typeof state.plan_checklist !== "object") state.plan_checklist = {};
    const seenBefore = new Set(state.plan_checklist[rel] || []);
    if (!Array.isArray(state.plan_items_done)) state.plan_items_done = [];
    for (const s of checkedNow) {
      if (!seenBefore.has(s) && !state.plan_items_done.includes(s)) state.plan_items_done.push(s);
    }
    state.plan_checklist[rel] = checkedNow;
  } catch { /* checklist diff is best-effort */ }

  // DD-F3: closure staleness — a CLOSURE: line written into an armed doc
  // stamps its write time; an impl write landing after it gets a nag
  // (the source the closure covered changed underneath it).
  try {
    const docText2 = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
    if (/CLOSURE\s*:/.test(docText2)) state.closure_write_at = new Date().toISOString();
  } catch { }

  // E6: marker + plan-signature detection on .md writes — a doc carrying
  // the analysis-project marker under a basename outside the armed REs
  // (analysis-doc / ledger-doc) still owes its schema; and `## Goal` +
  // `## Success` under a non-*plan* basename is a plan in costume.
  if (!fixtureDoc && /\.md$/i.test(filePath)) {
    try {
      const md = readFileSync(filePath, "utf-8");
      if (/^\s*<!--\s*analysis-project\s+v[12]\s*-->/im.test(md)) {
        if (!state.marker_docs) state.marker_docs = [];
        push(state.marker_docs, rel);
      }
      const mbn = String(filePath).split(/[\\/]/).pop() || "";
      if (!/plan/i.test(mbn) && /^##\s*goal\b/im.test(md) && /^##\s*success\b/im.test(md)) {
        if (!state.plan_sig_docs) state.plan_sig_docs = [];
        if (!state.plan_sig_docs.includes(rel)) {
          state.plan_sig_docs.push(rel);
          note(`plan-shaped doc under a non-plan basename (${rel}) — \`## Goal\` + \`## Success\` headings; if this is a plan it owes the PLAN-SCHEMA fields (00-operating §2c) — recorded for the gate's advisory`);
        }
      }
      // E3: escape counting — the escape layer (DECLARED: / EXEMPT-*/
      // review-credit:) is legal machinery; what was never recorded is
      // how much a session leans on it. Recount per file (a rewrite
      // replaces, never accumulates) so state.escapes stays honest.
      if (!state.escapes || typeof state.escapes !== "object" || Array.isArray(state.escapes)) state.escapes = {};
      state.escapes[rel] = (md.match(/^\s*(?:DECLARED\s*:|EXEMPT-[A-Z0-9-]+\s*:|review-credit\s*:)/gim) || []).length;
    } catch { /* marker/signature detection is best-effort */ }
  }

  // E3: checks-armed tally — DERIVED from arm state at write time, not
  // stamped per arm site (a derived tally cannot drift the way
  // per-site pushes do when a new arm lands).
  {
    const arm = new Set(Array.isArray(state.checks_armed) ? state.checks_armed : []);
    const on = (c) => arm.add(c);
    if ((state.ui_touched || []).length) { on("DESIGN-REVIEW"); on("DESIGN-SPEC"); on("ELEMENT-SCRUTINY"); on("COVERAGE-EXTERNAL"); on("ARTIFACT-BACKFILL"); }
    if (state.design_spec_at) on("DESIGN-SPEC");
    if ((state.tests_touched || []).length) on("TESTS-RUN");
    if ((state.migrations_touched || []).length || (state.ddl_armed || []).length) on("MIGRATION");
    if (state.sitemap_touched) on("SITEMAP");
    if ((state.impl_touched || []).length || (state.impl_log || []).length) { on("ITERATION-LOOP"); on("REVIEW-BLOCK"); on("COMPLETION-MATRIX"); }
    if ((state.audit_armed || []).length) { on("AUDIT-LEDGER"); on("OPEN-FINDINGS"); }
    if ((state.plan_docs || []).length) { on("OPEN-LEDGER"); on("PLAN-SCHEMA"); on("CITE-FRESHNESS"); }
    if ((state.plan_docs || []).some((p) => GAP_DOC_RE.test(p))) { on("GAP-REVIEW"); on("INDEPENDENT-EYES"); }
    if ((state.marker_docs || []).length) on("ANALYSIS-PROJECT");
    if (state.analysis_asked) on("ANALYSIS-EVIDENCE");
    if ((state.repro_armed || []).length) on("REPRO");
    if ((state.blind_debt || []).length) on("BLIND-DEBT");
    if ((state.plan_items_done || []).length) on("PLAN-CLOSURE");
    if ((state.plan_delta_needed || []).length) on("PLAN-DELTA");
    if ((state.rejections || []).length) on("CALIBRATION");
    state.checks_armed = [...arm];
  }
}

// Shared arm for extracted write targets — the exec-command branch and
// the write_to_process branch (interactive-session stdin) feed identical
// extraction output through this; keeping one body stops the two call
// sites from drifting the way the old duplicated scans did.
function armWriteTargets(state, sid, { targets, markers }, via) {
  // `git-write:`/`patch:`/`extract:` markers name writes no path token
  // can describe — they arm impl_touched verbatim so the gate can
  // corroborate string-for-string.
  for (const mk of markers) push(state.impl_touched, mk);
  for (const t of targets) {
    const p = String(t).replace(/^["']|["']$/g, "");
    // Null-device skip covered `dev/null` but not `/dev/null` (the actual
    // device), `NUL`, or `/dev/zero` — every throwaway write counted as a
    // file edit (R15-F24).
    if (!p || /^-/.test(p) || p === "null" || /^(?:\/?dev\/(?:null|zero)|nul)$/i.test(p) || /^\d+$/.test(p)) continue;
    const fp = /^([a-zA-Z]:[\\/]|\/|~[\\/])/.test(p) ? relPath(p) : relPath(join(ROOT, p));
    // A spec written via `cat >`/exec exists on disk but the stamp only
    // lived in the edit/write branch — the gate then flagged "no
    // design-spec" anyway (R15-F23). Stamp before the skip.
    if (fp.includes("/design-spec/") && !state.design_spec_at) state.design_spec_at = new Date().toISOString();
    if (fp.includes("/design-review/") || fp.includes("/design-spec/") || fp.includes("/gate-evidence/") || fp.includes("/gate-state/")) continue;
    // `.sql` targets arm MIGRATION by path — the DDL arm is content-only
    // for edit/write, but an exec redirect into a .sql file carries its
    // schema signature in the name (`cat > schema.sql`).
    if (/\.sql$/i.test(fp) || /migrations\/versions\//i.test(fp)) push(state.ddl_armed, fp);
    armClassifiedPath(state, sid, fp, via);
  }
}

function main() {
  let input = null;
  try { input = JSON.parse(readFileSync(0, "utf-8")); } catch { input = null; }
  // Write-ahead: queue the event before any killable work, then drain.
  // A parse failure can't enqueue — but a prior queued event can still
  // drain, so the drain call is unconditional.
  if (input && typeof input === "object" && !Array.isArray(input)) enqueueHookEvent(input);
  drainHookEvents();
  process.exit(0);
}

/** Apply one queued hook event to its session state. Called by the drainer
 *  (never directly by a hook) — every state mutation is serialized through
 *  the drain lock, so concurrent hooks can't clobber each other. Returns
 *  instead of exiting: the drain loop must outlive each event. */
function applyEvent(input) {
  const sid = input.session_id || "unknown";
  if (!input.session_id) {
    // R15-F17: every no-sid session shares `unknown.json` — arms leak
    // across distinct sessions and inherit each other's obligations.
    // The arm still records (fail-closed), but the leak is flagged loudly
    // so a runtime that withholds session_id can't do it silently.
    console.error(`[session-tracker] WARNING: hook input carried no session_id — state lands in shared gate-state/unknown.json and cross-session arms will contaminate each other (tool=${input.tool_name || "?"})`);
  }
  const toolName = input.tool_name || "";
  // A truthy non-object tool_input (string/number/array) used to reach
  // `.file_path`/`.command` and silently yield "" — every arm was missed
  // while files_edited still counted (R15-F5).
  const toolInput = input.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input) ? input.tool_input : {};
  const state = readState(sid);

  // I3: session-start instrument baseline — the last manifest the gate
  // accepted (shared file), else a fresh hash of the tree. Between-session
  // edits diff against the stale baseline at the next stop.
  if (!state.instrument_manifest) {
    try { state.instrument_manifest = captureInstrumentBaseline(ROOT); writeState(sid, state); } catch { /* baseline best-effort */ }
  }

  // PostToolUse fires after the tool ran — the iteration artifact (if any)
  // already reflects this write, so one observation pass here covers every
  // write mechanism below (edit/write tools AND exec-write scans).
  observeIterationArtifact(state, sid);

  if (toolName === "exec") {
    state.exec_count = (state.exec_count || 0) + 1; // EF-F1: work-telemetry — surfaced in the gate's stop report
    const cmd = String(toolInput.command || "");
    // A non-object tool_response can't prove success — only a real
    // object without success:false counts (a string/number response
    // scoring the run as ok is a format-dependent mis-arm).
    // Missing response is optimistic (runtimes that send none), but a
    // present object with a falsy success field is a failure signal —
    // `{success: 0}`/`null`/`"false"` scored as ok before (R12-F14).
    const tr = input.tool_response;
    // Any explicit falsy success shape counts as failure — `"0"`, `"no"`,
    // `[]`, `{}` all used to score as ok (R13-F14); absent/undefined and
    // truthy shapes stay optimistic (runtimes that send no field).
    const FAIL_SUCCESS = new Set([false, null, 0, "", "false", "0", "no", "off"]);
    // `!tr` covered BOTH absent responses AND falsy non-object ones —
    // `tool_response:false`/`0`/`""` is itself a failure signal but scored
    // ok (R15-F32). Only truly-absent (null/undefined) stays optimistic.
    // Truthy non-object responses (`"ok"`, `1`, a stdout string) carry no
    // failure signal — rejecting them deadlocks honest runs on runtimes
    // that send primitives (R16-F9). Falsy primitives stay failures via
    // FAIL_SUCCESS (R15-F32); object success stays checked.
    const ok = tr == null ||
      (typeof tr === "object"
        ? !FAIL_SUCCESS.has(tr.success) && !(tr.success != null && typeof tr.success === "object")
        : !FAIL_SUCCESS.has(tr));
    if (TEST_RUN_RE.test(cmd) && !TEST_META_RE.test(cmd) && ok) { state.test_ran = true; writeState(sid, state); }
    // Skill-tool events never reach the harness (verified — no PostToolUse
    // event lands for `skill` or `read`), so briefing engagement is also
    // detected from the shell path agents actually use: listing the skill
    // dir or printing rules/skill files counts as opening-discipline
    // engagement (the observed agent ran `ls .devin/skills/` verbatim).
    // The BRIEFING-GATE's primary leg stays the written BRIEFED: marker —
    // this is the bonus signal, not the contract.
    if (ok &&
        (/\b(?:ls|dir|cat|type|Get-Content|more|less|head|tail|find|tree)\b[^\n|;&]*(?:skills|SKILL\.md|rules[\\/]|\.mdc\b|global_rules)/i.test(cmd) ||
        /\b(?:skills|SKILL\.md|(?:\.cursor[\\/])?rules|global_rules)\b[^\n|;&]*\b(?:ls|cat|type|Get-Content)\b/i.test(cmd))) {
      state.briefing_engaged = state.briefing_engaged || new Date().toISOString();
    }
    // I1: a recorded probe run is the timestamp the coverage check binds
    // the artifact to — a coverage file predating every recorded run is
    // hand-authored, not produced.
    if (/ui-coverage-probe\.mjs/i.test(cmd) && ok) {
      if (!Array.isArray(state.probe_runs)) state.probe_runs = [];
      state.probe_runs.push(new Date().toISOString());
      if (state.probe_runs.length > 100) state.probe_runs = state.probe_runs.slice(-100);
    }
    // File writes via shell bypassed every arm below — a heredoc, tee,
    // or cp could land an entire feature with zero gate coverage. Write
    // targets are extracted from the command and run through the same
    // classifier the edit/write path uses. The extraction catalog lives
    // in write-targets.mjs — the stop-gate's transcript consumers share
    // it (R12-F7: the two copies already diverged once).
    armWriteTargets(state, sid, execWriteTargets(cmd, ROOT), "exec");
    // Indirect renders — `node .unlazy/x-build.mjs` carries no write
    // primitive in its command text, so generated pages bypass the
    // write-target catalog entirely (lake-alto: 7 sibling pages landed
    // via writeFileSync inside the script with zero rendered-write
    // count). After an exec that runs an .unlazy/ script, re-check the
    // spec's ## Surfaces table on disk — files that now EXIST count
    // toward the first-render nag's trigger.
    if (/\.unlazy\/[^\s"'`]+\.mjs/i.test(cmd) && !state.fr_nag_done) {
      try {
        const specPath = join(ROOT, ".unlazy", "design-spec", `${sid}.md`);
        const specText = existsSync(specPath) ? readFileSync(specPath, "utf-8") : "";
        if (/##\s*directions\b/i.test(specText)) {
          const surfM = specText.match(/##\s*surfaces\b([\s\S]*?)(?=\n##|$)/i);
          const surfFiles = surfM ? [...surfM[1].matchAll(/[\w./\\-]+\.(?:html?|j2)\b/g)].map((m) => m[0]) : [];
          const existing = surfFiles.filter((f) => existsSync(join(ROOT, f)) || existsSync(f));
          const frPath = join(ROOT, ".unlazy", "eyes", `${sid}-first-render.md`);
          if (existing.length >= 2 && !existsSync(frPath) && !/first[-\s]?render/i.test(specText)) {
            state.fr_nag_done = true;
            note(`first-render eyes: ${existing.length} spec-surface files exist on disk (rendered via script — exec writes bypass the write-target catalog) and no .unlazy/eyes/${sid}-first-render.md — the stranger cold-read must land BEFORE the pattern finishes propagating. 09-design-review → first-render pass.`);
          }
        }
      } catch { }
    }
    // Completion-check nag — an exec running verification-shaped commands
    // (test/check/build/status/diff) while items sit open is the survey-
    // before-summary tell: the agent is validating for a report it has
    // not finished. Open items are implemented NOW or dispositioned —
    // the matrix maps every ask to evidence before the turn may end.
    if (!state.cc_nag_done && (state.todos_open || 0) > 0 && (state.files_edited || 0) > 0 &&
        /\b(pytest|vitest|jest|npm\s+(test|run)|node\s+--check|alembic|lint|typecheck|mypy|ruff|git\s+(status|diff)|--check\b|\btest(s)?\b|\bbuild\b|\bverify\b|\bvalidate\b)/i.test(cmd)) {
      state.cc_nag_done = true;
      const items = (state.todos_open_items || []).slice(0, 3).join("; ");
      note(`completion check before the end summary — ${state.todos_open} open item(s)${items ? ` (${items})` : ""}. Deferred items, residuals, and remaining tasks get implemented NOW — no deferral exit exists: each row in .unlazy/gate-evidence/${sid}.md ## Completion matrix ends DONE+evidence, BLOCKED: <external wall>, or ACCEPTED: <user verb> (00-operating §2e, 14-stop-integrity).`);
    }
    writeState(sid, state);
    return;
  }

  // write_to_process feeds stdin to an already-running interactive
  // process — a second command channel the exec scan never sees
  // (`python -i` armed nothing at exec time; the `open('x.py','w')`
  // arrives here). text_input is literal typed content; bytes_input
  // carries the same content with control codes in <> notation — the
  // write catalog is primitive-shaped, so both feed execWriteTargets
  // unchanged (R13-F1).
  if (toolName === "write_to_process") {
    const stdin = [toolInput.text_input, toolInput.bytes_input]
      .filter((v) => typeof v === "string" && v)
      .join("\n");
    if (stdin) armWriteTargets(state, sid, execWriteTargets(stdin, ROOT), "pty");
    writeState(sid, state);
    return;
  }

  // todo_write calls carry the live task list — the last write's open
  // count arms STOP-DECLARED at turn end (14-stop-integrity): an open
  // list is a legal backlog, but the stop itself must be declared and
  // classified in gate-evidence, not narrated.
  // The snapshot diff also records which items COMPLETED during this
  // session — the ITEM-CLOSURE gate (10-rule-enforcement) requires a
  // written closure line per item before the next begins, and only
  // session-completed items are fair to demand closures for.
  if (toolName === "todo_write") {
    const todos = Array.isArray(toolInput.todos) ? toolInput.todos : [];
    const open = todos.filter((t) => t && t.status !== "completed");
    state.todos_open = open.length;
    // 50, not 5 — a capped open list is an invisible-todo channel: items
    // past the cap never reached the completion-matrix check at all.
    state.todos_open_items = open.map((t) => String(t.content || "").slice(0, 400)).slice(0, 50);
    const prev = Array.isArray(state.todos_snapshot) ? state.todos_snapshot : [];
    const normStem = (s) => String(s || "").slice(0, 60).toLowerCase().replace(/\s+/g, " ").trim();
    const prevOpen = new Set(
      prev.filter((t) => t && t.s !== "completed").map((t) => String(t.c || "").slice(0, 60))
    );
    const prevOpenN = new Set([...prevOpen].map(normStem));
    const curAll = new Set(todos.map((t) => normStem(t && t.content)));
    // Vanished-item join (boundary-study B3): an item open in the last
    // snapshot and absent from this one — deleted or reworded — left
    // every check's sight. prevOpen − currentAll is exactly the set no
    // scanner could see. A re-added item un-vanishes; a completed item
    // was never open here. The gate owes each vanished stem a matrix row.
    if (!Array.isArray(state.todos_vanished)) state.todos_vanished = [];
    state.todos_vanished = state.todos_vanished.filter((c) => !curAll.has(c));
    for (const c of [...prevOpenN].filter((x) => x && !curAll.has(x))) {
      if (!state.todos_vanished.includes(c)) state.todos_vanished.push(c);
      if (state.todos_vanished.length > 50) state.todos_vanished.splice(0, state.todos_vanished.length - 50);
    }
    if (!Array.isArray(state.completed_during_session)) state.completed_during_session = [];
    for (const t of todos) {
      const c = String(t && t.content || "").slice(0, 60);
      if (t && t.status === "completed" && prevOpen.has(c) && !state.completed_during_session.includes(c)) {
        state.completed_during_session.push(c);
      }
    }
    state.todos_snapshot = todos.map((t) => ({ s: t && t.status, c: String(t && t.content || "").slice(0, 400) }));
    writeState(sid, state);
    return;
  }

  // Blind-review launches — the chef's set-aside portion made structural:
  // a critique subagent sees only the renders, never the author's diff or
  // intent (09-design-review → composition verdict; 10-rule-enforcement →
  // FRESH-EYES). Any subagent counts toward the flag only when its brief
  // is critique-shaped — a coding agent is not an independent looker.
  // Skill invocations — the session-start discipline record. `briefing`
  // is the mandated opening move (00-operating + briefing SKILL.md: it
  // re-reads the installed rules and loads the domain skills); the
  // BRIEFING-GATE (check-briefing.mjs) blocks the first app
  // impl edit until this record exists.
  if (toolName === "skill") {
    const skillName = String(toolInput.skill || toolInput.name || "").toLowerCase().trim();
    if (skillName) {
      if (!Array.isArray(state.skills_invoked)) state.skills_invoked = [];
      if (!state.skills_invoked.includes(skillName)) state.skills_invoked.push(skillName);
      if (skillName === "briefing" && !state.briefed_at) state.briefed_at = new Date().toISOString();
    }
    writeState(sid, state);
    return;
  }

  if (toolName === "run_subagent") {
    const brief = `${toolInput.title || ""} ${toolInput.task || ""}`;
    // Every launch records (not just critique-classified ones) — this is
    // the channel-existence signal the gate's eyes-provenance check needs:
    // a session where run_subagent PostToolUse provably delivers must show
    // launches here; empty = the channel can't deliver (R14-F13). On
    // runtimes that route the hook, a self-attested eyes artifact with
    // zero launches in this list is fabrication, not degradation.
    {
      if (!Array.isArray(state.subagent_launches)) state.subagent_launches = [];
      push(state.subagent_launches, String(toolInput.title || "run_subagent").slice(0, 80));
      const resp0 = input.tool_response;
      const resp0Id = resp0 && typeof resp0 === "object" && (resp0.agent_id || resp0.agentId || resp0.id);
      if (resp0Id) push(state.subagent_launches, String(resp0Id).slice(0, 80));
      // O-F11: the ceiling was pure text — record the breach. Soft
      // ceiling 15 (02-subagent-ceiling): past it, the session gets a
      // recorded note + the gate surfaces the count at stop. Launches
      // are the count — completions have no tool event to join on.
      if (state.subagent_launches.length > 15 && !state.sub_ceiling_noted) {
        state.sub_ceiling_noted = true;
        state.sub_ceiling_count = state.subagent_launches.length;
        note(`subagent ceiling: ${state.subagent_launches.length} launches — the soft ceiling is 15 (02-subagent-ceiling). Every launch past it needs a written justification the user can audit, and a GATECHECK: <what you re-read> line in .unlazy/gate-evidence/${sid}.md for each "success" you relayed (06-subagent-gatecheck).`);
      }
    }
    // Critique-shaped: primary terms always count — 'stranger' is the
    // loop's canonical eyes-pass vocabulary ("stranger pass" classified
    // as nothing before, R12-F8); 'review'/'design' still need a
    // co-signal (independent/blind/stranger/pass) — a 'design overhaul'
    // coding agent is not an independent looker. The cold/independent
    // branches also exclude code-intent briefs — "independent check of
    // auth + fix" classifies as critique without it and disarms
    // FRESH-LOOK while a stranger was never launched (R13-F6).
    const CODE_INTENT_RE = /\b(?:fix|implement|build|patch|refactor|migrate|port)\b/i;
    // Branch 1 needs the same code-intent exclusion — `screenshot the
    // page and fix it`/`fresh implementation of auth`/`audit and fix`
    // are implementation briefs wearing critique vocabulary (R14-F11:
    // the R13-F6 exclusion covered branches 2-3 only).
    if ((/critiqu|verdict|judg|fresh|eyes|screenshot|taste|audit|stranger/i.test(brief) && !CODE_INTENT_RE.test(brief)) ||
        (/review|design/i.test(brief) && /independent|blind|stranger|fresh|cold|\bpass\b/i.test(brief) && !CODE_INTENT_RE.test(brief)) ||
        (/independent|blind|cold/i.test(brief) && /walk|look|check|read|verdict/i.test(brief) && !CODE_INTENT_RE.test(brief))) {
      state.critique_agent_launched = true;
      push(state.critique_agents, String(toolInput.title || "run_subagent").slice(0, 80));
      // The Agent: line in an eyes artifact carries the returned id
      // (ca1740fc), not the launch title — record both so provenance can
      // match either (R12-F8).
      const resp = input.tool_response;
      const respId = resp && typeof resp === "object" && (resp.agent_id || resp.agentId || resp.id);
      if (respId) push(state.critique_agents, String(respId).slice(0, 80));
    }
    // A write-capable profile delegates implementation whose file writes
    // may attribute to the subagent's own session — invisible to this
    // session's arms. The launch itself arms the loop so delegated work
    // can't vanish from the ledger.
    if (!/explore/i.test(String(toolInput.profile || ""))) {
      const now = new Date().toISOString();
      const title = String(toolInput.title || "run_subagent").slice(0, 80);
      push(state.impl_log, now);
      if (state.impl_log.length > 2000) state.impl_log = state.impl_log.slice(-2000);
      if (!Array.isArray(state.delegated_impl)) state.delegated_impl = [];
      push(state.delegated_impl, title);
      // Delegated writes may attribute to the subagent's own session —
      // a synthetic marker keeps the coordinator's loop armed on them.
      push(state.impl_touched, `delegated:${title}`);
      state.last_impl_at = now;
    }
    writeState(sid, state);
    return;
  }

  if (toolName !== "edit" && toolName !== "write") return;
  const filePath = relPath(toolInput.file_path || "");

  // Artifact writes are timed + counted: a live ledger accrues rows as
  // the critique happens; a one-burst artifact written at wrap-up is the
  // backfill signature (10-rule-enforcement → BACKFILL).
  if (filePath.includes(".unlazy/design-review/")) {
    state.artifact_writes = (state.artifact_writes || 0) + 1;
    if (!state.artifact_first_write_at) state.artifact_first_write_at = new Date().toISOString();
    writeState(sid, state);
    validateArtifact(filePath); return;
  }
  if (filePath.includes(".unlazy/audit-ledger/")) {
    state.audit_ledger_written = true;
    if (!state.audit_armed) state.audit_armed = [];
    writeState(sid, state);
    validateAuditLedger(filePath);
    return;
  }
  // Design-spec writes record the spec's existence time — the stop gate
  // compares it against ui_first_edit_at (spec must precede generation,
  // 13-design-spec.mdc). First write only: the timestamp is when a spec
  // first existed this session, later edits don't move it.
  if (filePath.includes(".unlazy/design-spec/")) {
    if (!state.design_spec_at) state.design_spec_at = new Date().toISOString();
    // D1: the spec's recursion depth is state too — a `depth: N` line in
    // ## Depth records the level the artifact sits at (additive key).
    try {
      const dM = readFileSync(filePath, "utf-8").match(/##\s*depth\b[\s\S]*?\bdepth\s*:\s*(\d+)/i);
      if (dM) state.spec_depth = parseInt(dM[1], 10);
    } catch { /* unreadable spec leaves the key null */ }
    writeState(sid, state);
    validateDesignSpec(filePath);
    return;
  }
  if (filePath.includes(".unlazy/gate-evidence/") || filePath.includes(".unlazy/gate-state/")) return;

  const rel = repoRel(filePath);
  const newContent = toolName === "edit" ? String(toolInput.new_string || "") : String(toolInput.content || "");

  // Content-derived arms stay here (the exec-write scan sees paths, not
  // content): DDL inside the new text arms MIGRATION; a route decorator
  // in an adapters file arms SITEMAP.
  if (filePath.startsWith(`${relPath(ROOT)}/`.replace(/\\/g, "/")) || filePath.includes("app/")) {
    if (DDL_RE.test(newContent) && !MIGRATION_RE.test(filePath) && !/.mdc?$/i.test(filePath)) push(state.ddl_armed, rel);
  }
  const oldContent = toolName === "edit" ? String(toolInput.old_string || "") : "";
  if (ADAPTERS_RE.test(filePath) && (ROUTE_RE.test(newContent) || ROUTE_RE.test(oldContent))) push(state.routes_armed, rel);

  // Path-class arms — shared with the exec-write scan above: a file is a
  // file regardless of the mechanism that wrote it (files_edited, UI,
  // tests/migrations/sitemap, audit docs, ledger docs).
  armClassifiedPath(state, sid, filePath, toolName);

  // --- repro gate ----------------------------------------------------------
  // rejection-tracker.mjs (UserPromptSubmit) recorded the user reporting a
  // shipped fix didn't resolve the symptom. The next source edit arms REPRO:
  // never twice blind — reproduce first, then name the evidence per rejection
  // round in the session's gate-evidence file before the turn can end
  // (12-verification.mdc). All pending rounds are consumed by one arming.
  // Every source edit while any rejection is unresolved is also recorded as
  // blind debt: it was written without observed state, so once REPRO evidence
  // lands each file needs an explicit kept/removed disposition — not a
  // grandfather pass (12-verification.mdc → mechanism discipline).
  // R15-F16: `.ts/.tsx/.mjs/.vue/.svelte` are source too — the hook
  // scripts themselves are `.mjs` and never armed REPRO after a rejection.
  const REPRO_SRC_RE = /\.(js|mjs|cjs|ts|tsx|jsx|css|scss|html|j2|py|vue|svelte)$/i;
  const isReproSource = REPRO_SRC_RE.test(filePath) && !filePath.includes(".unlazy/");
  const freshRejections = (state.rejections || []).length - (state.repro_rounds_armed || 0);
  if (freshRejections > 0 && isReproSource) {
    if (!state.repro_armed) state.repro_armed = [];
    push(state.repro_armed, rel);
    state.repro_rounds_armed = (state.rejections || []).length;
    note(`repro gate armed: the user reported a previous fix didn't resolve the symptom, and this edit (${rel}) is the next source change. Never twice blind — reproduce the symptom first (live page, headless on the real served page, or ask the user for access/artifacts). Before this turn can end, .unlazy/gate-evidence/${sid}.md needs one REPRO: line per rejection round — with expected: <correct state + reference> and surfaces: <covered surfaces>, or CANNOT-REPRO: <what you asked for> — plus a BLIND-DEBT: kept/removed line per file edited while the symptom was unverified. Or EXEMPT-REPRO: * — <reason>. See rules/12-verification.mdc.`);
  }
  if ((state.rejections || []).length > 0 && isReproSource) {
    if (!state.blind_debt) state.blind_debt = [];
    push(state.blind_debt, rel);
  }

  // impl_* fields belong in the persistence condition too — a pure-impl
  // session on a fresh .unlazy/ used to persist nothing, which meant the
  // loop never armed at stop (state file missing → gate exits 0).
  if (existsSync(STATE_DIR) || state.ui_touched.length || state.ddl_armed.length || state.routes_armed.length || state.tests_touched.length || state.migrations_touched.length || state.sitemap_touched || (state.plan_docs || []).length || (state.audit_armed || []).length || (state.repro_armed || []).length || (state.blind_debt || []).length || (state.impl_touched || []).length || (state.impl_log || []).length || state.analysis_asked) {
    writeState(sid, state);
  }
  return;
}

// Importable without running main() — stop-gate.mjs imports
// `drainHookEvents` to flush the queue before it reads state; a bare
// `main()` here would double-fire the hook under that import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
