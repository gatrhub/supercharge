/**
 * PreToolUse hook (edit|write): cycle-plan gate.
 *
 * RESUME-LANE (rejection-tracker.mjs) arms when a standing lane — a
 * ledger doc carrying `Lane:`/`Drive:`/`Driver:` plus non-terminal rows —
 * is found at prompt time. The observed failure this gate kills: a
 * resumed lane session diving into the next finding with no fresh plan —
 * the stale todo list sits completed while batches run unplanned
 * (16-iteration-loop → batch protocol).
 *
 * When resume_lanes is armed and the session has no todo list AND no
 * `BATCH-PLAN:` row in a lane doc, the FIRST implementation-class edit
 * is blocked with the remediation. Ledger/analysis paths are exempt —
 * writing the plan is the remediation and cannot itself be blocked.
 * Once satisfied (`cycle_plan_satisfied` recorded), later edits pass.
 * Fail-open on internal errors, matching every sibling hook.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LANE_TERM_RE, LANE_PARKED_RE, docDriver } from "./deferral-patterns.mjs";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const STATE_DIR = join(ROOT, ".unlazy", "gate-state");

// Implementation-class paths — mirrors the arm classes in
// session-tracker.mjs: source code, styles, templates, hooks machinery.
// Ledger/artifact paths (.unlazy docs, .md) are the remediation surface
// and never block.
const IMPL_RE = /(?:\.(?:js|mjs|cjs|ts|jsx|tsx|css|scss|less|html|j2|jinja|py|json|toml|yaml|yml|mdc)|(^|[\\/])hooks\.v1\.json$)/i;
const EXEMPT_RE = /(^|[\\/])\.unlazy[\\/]|\.md$|docs[\\/]|(^|[\\/])(?:GATES|PLAN|AGENTS|README|CHANGELOG)\b/i;

function statePath(sid) { return join(STATE_DIR, `${sid}.json`); }
function readState(sid) {
  try {
    const s = JSON.parse(readFileSync(statePath(sid), "utf-8"));
    return s && typeof s === "object" && !Array.isArray(s) ? s : {};
  } catch { return {}; }
}
function saveState(sid, state) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(statePath(sid), JSON.stringify(state, null, 2));
  } catch { /* best-effort */ }
}
function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
  process.exit(2);
}

// F7: terminal set comes from the shared vocabulary — FILED/CARRIED/
// DECLARED are parked (still open work), not terminal.
const TERM_RE = LANE_TERM_RE;
const PARKED_RE = LANE_PARKED_RE;
const PLAN_LINE_RE = /\bBATCH-PLAN\s*:/i;
const PLAN_CONTENT_RE = /\b(?:U\d+-F\d+|F\d{2,}|B\d{1,2}|R\d{1,2}-F\d+)\b|BATCH-PLAN\s*:\s*\S+(?:\s+\S+){3,}/i;
// The plan names its size so the iteration record's scope floor can be
// cross-checked — a plan that can't say its class can't be held to one.
const PLAN_SCOPE_RE = /\b(fix|surface|page|subsystem|product)\b/i;
const VERIFY_LINE_RE = /\bBATCH-VERIFY\s*:/i;
const VERIFY_CONTENT_RE = /\b(?:node\s|--check|build|probe|leak|lint|test|verify|shot|capture|gate|render|live)\b/i;
const ANALYSIS_LINE_RE = /\bBATCH-ANALYSIS\s*:/i;
// Evidence floor: a verdict must cite something concrete — a file:line,
// a backticked code object (field/route/function), or a named code
// object class. "Looks feasible" with nothing behind it is not analysis.
const ANALYSIS_EVIDENCE_RE = /\w[\w./-]*\.(?:js|mjs|cjs|ts|tsx|py|css|html|j2|json|md|mdc):\d+|`[^`]{2,}`|\b(?:route|endpoint|field|column|serializer|schema|payload|param|key|function|helper|component|view|table|migration|adapter|selector|prop|store|api)\b/i;
function analysisLineOk(l) {
  return ANALYSIS_LINE_RE.test(l) &&
    /BATCH-ANALYSIS\s*:\s*\S+(?:\s+\S+){3,}/i.test(l) &&
    ANALYSIS_EVIDENCE_RE.test(l);
}
const ID_RE = /\b(?:U\d+-F\d+|F\d{2,}|R\d{1,2}-F\d+)\b/g;

function laneStats(docPath) {
  let text;
  try { text = readFileSync(docPath, "utf-8"); } catch { return { open: 0, plans: 0, verifies: 0, analyses: 0, planLines: [], analysisLines: [] }; }
  let open = 0, plans = 0, verifies = 0, analyses = 0;
  const planLines = [], analysisLines = [];
  for (const l of text.split("\n")) {
    // Open = explicit OPEN not terminated, or a parked status row
    // (FILED:/CARRIED:/DECLARED: is open work by the shared vocabulary).
    if ((/\bOPEN\b/i.test(l) && !TERM_RE.test(l)) || PARKED_RE.test(l)) open += 1;
    if (PLAN_LINE_RE.test(l) && PLAN_CONTENT_RE.test(l)) { plans += 1; planLines.push(l); }
    if (VERIFY_LINE_RE.test(l) && VERIFY_CONTENT_RE.test(l)) verifies += 1;
    if (analysisLineOk(l)) { analyses += 1; analysisLines.push(l); }
  }
  return { open, plans, verifies, analyses, planLines, analysisLines };
}

// Todo comprehensiveness (user ask 2): a plan-scaffolding list is ≥3 items
// spanning ≥2 stage classes — analyze/plan + implement + verify/record —
// not a one-line token. Item text is checked against stage vocab.
const STAGE_RES = {
  analyze: /\b(analy|examin|investigat|plan|travers|feasib|survey|map\b|read)\w*/i,
  implement: /\b(implement|fix|build|ship|land|wire|write|edit|patch|add|port)\w*/i,
  verify: /\b(verif|check|test|probe|review|record|ledger|evidence|gate|capture|render|live|leak|lint|audit)\w*/i,
};
function todoComprehensive(snapshot) {
  if (!Array.isArray(snapshot) || snapshot.length < 3) return { ok: false, why: `${(snapshot || []).length} item(s) — the floor is 3` };
  const classes = new Set();
  for (const t of snapshot) {
    const text = String((t && (t.content || t.c || t.task || t.text)) || t || "");
    for (const [k, re] of Object.entries(STAGE_RES)) if (re.test(text)) classes.add(k);
  }
  if (classes.size < 2) return { ok: false, why: `spans ${classes.size} stage class(es) (${[...classes].join(",") || "none"}) — needs ≥2 of analyze/plan, implement, verify` };
  return { ok: true };
}

function main() {
  let input;
  try { input = JSON.parse(readFileSync(0, "utf-8")); }
  catch { process.exit(0); }
  if (!input || typeof input !== "object") process.exit(0);

  const tool = String(input.tool_name || "");
  if (!/^(edit|write)$/i.test(tool)) process.exit(0);

  const sid = input.session_id || "unknown";
  const filePath = String(input.tool_input?.file_path || input.tool_input?.path || "");
  if (!filePath || !IMPL_RE.test(filePath) || EXEMPT_RE.test(filePath)) process.exit(0);

  const state = readState(sid);
  const lanes = Array.isArray(state.resume_lanes) ? state.resume_lanes : [];
  // Fresh-batch arm: a standing lane is the old arm; a session shipping a
  // real batch (≥3 impl files) with no lane still owes the plan set —
  // plan-then-implement binds the batch, not just lane resumes. Single
  // edits and doc work stay free.
  const implCount = Array.isArray(state.impl_touched) ? state.impl_touched.length : 0;
  if (!lanes.length && implCount < 3) process.exit(0);

  // Lane state now: open rows + BATCH-PLAN/VERIFY/ANALYSIS rows + the
  // raw line lists the parity checks need (new rows = beyond last seen).
  let openNow = 0, plansNow = 0, verifiesNow = 0, analysesNow = 0;
  const planLines = [], analysisLines = [];
  // Scan set: lane docs, plus this session's armed ledger/plan docs — the
  // fresh-batch path needs somewhere the plan set can live (any armed
  // ledger counts; the plan rows, not the doc class, are the contract).
  const seenDocs = new Set();
  const scanDocs = [];
  for (const l of lanes) { if (l && l.doc && !seenDocs.has(l.doc)) { seenDocs.add(l.doc); scanDocs.push(l.doc); } }
  for (const extra of [...(state.plan_docs || []), ...(state.audit_armed || [])]) {
    if (extra && !seenDocs.has(extra)) { seenDocs.add(extra); scanDocs.push(extra); }
  }
  for (const doc of scanDocs) {
    // Driver-scoped ownership (defense in depth — arms recorded before
    // the rejection-tracker scoping fix still carry foreign docs): a
    // lane doc declaring `Driver: <other-sid>` is not this session's
    // work and does not feed stats or parity.
    try {
      const drv = docDriver(readFileSync(doc, "utf-8").slice(0, 4000));
      if (drv && drv !== sid) continue;
    } catch { /* unreadable doc — keep it, fail toward visible */ }
    const s = laneStats(doc);
    openNow += s.open;
    plansNow += s.plans;
    verifiesNow += s.verifies;
    analysesNow += s.analyses;
    planLines.push(...s.planLines);
    analysisLines.push(...s.analysisLines);
  }

  // Per-batch re-arm (eyes pass: a once-satisfied plan covers every later
  // batch — batches 11-13 ran planless mid-session). When the lane's open
  // count drops below the count at last satisfaction, a NEW batch has
  // started: the plan halves must be re-earned with NEW artifacts — a
  // BATCH-PLAN line count higher than last satisfaction AND a todo
  // snapshot that differs from the one last seen (a stale list from the
  // previous batch is not a plan for this one).
  const todosNow = JSON.stringify(state.todos_snapshot || []);
  const todoCheck = todoComprehensive(state.todos_snapshot);
  const todosFresh = todoCheck.ok && todosNow !== state.todos_at_satisfaction;
  if (state.cycle_plan_satisfied) {
    if (openNow >= (state.lane_open_at_satisfaction ?? Infinity)) process.exit(0);
    // batch boundary crossed — re-arm.
    state.cycle_plan_satisfied = false;
  }
  // First-sight baseline (cross-lane defect): every BATCH-*/ANALYSIS
  // row already inside the armed docs when this session's gate first
  // armed is a previous batch's artifact — usually a DIFFERENT lane's
  // (resume_lanes is armed repo-wide, so a session inherits other
  // lanes' docs). Without the baseline those foreign plan ids count as
  // "new" and demand coverage in THIS session's todos — an obligation
  // nothing can satisfy. Baseline once so only rows this session adds
  // bind for parity.
  // Rebaseline when the counted pool shrinks too: seen counters recorded
  // against a larger doc set (pre-scoping arms, dropped lanes) can never
  // be exceeded again — clamp them to the pool that exists now.
  if (state.batch_plans_seen == null || state.batch_plans_seen > plansNow) {
    state.batch_plans_seen = plansNow;
    state.batch_verifies_seen = verifiesNow;
    state.batch_analyses_seen = analysesNow;
    saveState(sid, state);
  }

  // Cross-artifact parity (user's third ask — analysis + plans more
  // comprehensive): the NEW plan rows' finding ids must each appear in a
  // NEW BATCH-ANALYSIS line (you analyzed what you committed to) and in
  // ≥1 todo item (the list covers the plan, not just exists beside it).
  // Plans naming no ids (prose batches) skip parity but not the floors.
  const newPlanLines = planLines.slice(state.batch_plans_seen || 0);
  const newAnalysisText = analysisLines.slice(state.batch_analyses_seen || 0).join("\n");
  const newPlanIds = [...new Set(newPlanLines.join("\n").match(ID_RE) || [])];
  const todoText = (state.todos_snapshot || [])
    .map((t) => String((t && (t.content || t.c || t.task || t.text)) || t || "")).join("\n");
  const idsMissingFromAnalysis = newPlanIds.filter((id) => !newAnalysisText.includes(id));
  const idsMissingFromTodos = newPlanIds.filter((id) => !todoText.includes(id));

  const hasTodos = todosFresh && !idsMissingFromTodos.length;
  // New plan rows must name the batch's scope class — the plan declares
  // its size so the iteration record's scope floor is cross-checkable.
  const newPlansScoped = newPlanLines.length > 0 && newPlanLines.every((l) => PLAN_SCOPE_RE.test(l));
  const hasPlan = plansNow > (state.batch_plans_seen || 0) && newPlansScoped;
  const hasVerify = verifiesNow > (state.batch_verifies_seen || 0);
  const hasAnalysis = analysesNow > (state.batch_analyses_seen || 0) && !idsMissingFromAnalysis.length;
  if (hasTodos && hasPlan && hasVerify && hasAnalysis) {
    state.cycle_plan_satisfied = true;
    state.lane_open_at_satisfaction = openNow;
    state.batch_plans_seen = plansNow;
    state.batch_verifies_seen = verifiesNow;
    state.batch_analyses_seen = analysesNow;
    state.todos_at_satisfaction = todosNow;
    saveState(sid, state);
    process.exit(0);
  }

  // EXEMPT-CYCLEPLAN: the block message has always advertised it (and
  // stop-gate's sibling check honors it) but this script never parsed
  // it — an escape that existed only in prose. Wildcard-only, reasoned,
  // same shape as every sibling exemption.
  const evidencePath = join(ROOT, ".unlazy", "gate-evidence", `${sid}.md`);
  let evidence = "";
  try { evidence = readFileSync(evidencePath, "utf-8"); } catch { /* no evidence file yet */ }
  const exempted = evidence.split(/\r?\n/).some((l) => {
    const m = l.match(/(?:^|[^A-Za-z0-9_-])EXEMPT-CYCLEPLAN\s*:\s*([\s\S]*)$/i);
    if (!m) return false;
    const parts = m[1].split(/\s*(?:—|--|::| - )\s*/);
    return parts.length >= 2 && parts[0].trim() === "*" && /\S.{9,}/.test(parts.slice(1).join(" "));
  });
  if (exempted) process.exit(0);

  const resumed = state.lane_open_at_satisfaction != null;
  block(
    `CYCLE-PLAN: ${lanes.length ? `a standing lane armed this session (${lanes.map((l) => `${(l.doc || "").split(/[\\/]/).pop()} — ${l.open} open`).join(", ")})` : `a fresh batch armed at ${implCount} implementation files`}` +
    `${resumed ? " and a new batch boundary was crossed" : ""}, and a source edit landed without the full plan set. ` +
    `Plan the batch first — all four are required per batch, not per session: ` +
    `(1) a NEW comprehensive todo list via todo_write — ≥3 items spanning analyze/plan + implement + verify stages ` +
    `AND covering every finding the plan names ` +
    `(${todoCheck.ok ? (idsMissingFromTodos.length ? `uncovered in todos: ${idsMissingFromTodos.join(", ")}` : "list fresh + covers plan") : `list fails: ${todoCheck.why}`}); ` +
    `(2) a NEW \`BATCH-PLAN: <scope-class>: <items>\` row naming the findings AND the batch's size class ` +
    `(fix|surface|page|subsystem|product — the scope floor your iteration record will be held to) — e.g. ` +
    `\`BATCH-PLAN: surface: U05-F1, U05-F2, U24-F4 — discipline timeline + overlay batch\`; ` +
    `(3) a NEW \`BATCH-VERIFY: <checks>\` row naming how the batch is verified — e.g. ` +
    `\`BATCH-VERIFY: node --check ×N, build_js bundles grep'd, staff-leak scan, live probe on :5000\`; ` +
    `(4) a NEW \`BATCH-ANALYSIS: <item> — <verdict>\` row per planned finding — the analysis artifact ` +
    `(feasible/blocked/approach per item) citing evidence — a \`file:line\`, a backticked code object, or a named ` +
    `route/field/serializer — e.g. \`BATCH-ANALYSIS: U05-F1 — feasible client-side, _users_detail.py:212 serializes locks\` ` +
    `${idsMissingFromAnalysis.length ? `— missing analysis for: ${idsMissingFromAnalysis.join(", ")}` : ""}. ` +
    `(16-iteration-loop → batch protocol; check-cycle-plan.mjs). ` +
    `If the lane is genuinely exited, close it in the doc (ACCEPTED:/BLOCKED: per row) or file EXEMPT-CYCLEPLAN: * — <reason> in gate-evidence.`
  );
}

try { main(); } catch { process.exit(0); }
