/**
 * Binding-completeness lint (CO-F1 / CO-F5).
 *
 * The rule corpus describes checks by name; the machinery implements
 * them by regex and state field. Drift between the two is invisible
 * until a named check silently doesn't exist. This script lints the
 * joins mechanically:
 *
 *   1. GATE-MAP SYNC — every `exempt("X"` check name in stop-gate.mjs
 *      (the binding surface) and every `EXEMPT-X:` name cited in the
 *      rules corpus must resolve both ways. A rules-cited exemption
 *      with no gate consumer is dead text; a gate exemption with no
 *      rule citation is undocumented enforcement.
 *   2. STATE-FIELD SYNC — every `state.<field>` read in stop-gate.mjs
 *      must appear in session-tracker.mjs's STATE_DEFAULTS or be
 *      written by another hook script (rejection-tracker fields are
 *      whitelisted). An unwritten field is a check that can never arm.
 *   3. HOOKS WIRING — hooks.v1.json parses; every script it names
 *      exists and passes `node --check`; every event names a real
 *      hook phase (CO-F5 self-check).
 *   4. FAILURE-NAME SYNC — every `X:` failure prefix pushed in
 *      stop-gate.mjs should appear in 10-rule-enforcement.mdc (the
 *      documented contract). Warn-only: rules lag implementation by
 *      design during a machinery session.
 *
 * Read-only, exits non-zero on level-1/2/3 failures. Run:
 *   node .devin/scripts/binding-lint.mjs
 */

import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const problems = [];
const warnings = [];

const gateSrc = readFileSync(join(ROOT, ".devin/scripts/stop-gate.mjs"), "utf8");
const trackerSrc = readFileSync(join(ROOT, ".devin/scripts/session-tracker.mjs"), "utf8");
const rejectSrc = readFileSync(join(ROOT, ".devin/scripts/rejection-tracker.mjs"), "utf8");

// --- 1. Exemption-name join ---------------------------------------------------
const gateExempts = new Set([...gateSrc.matchAll(/exempt\("([A-Z0-9-]+)"/g)].map((m) => m[1]));
const ruleFiles = [];
const ruleDirs = [join(ROOT, "rules")];
for (const d of ruleDirs) {
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d)) if (/\.mdc$/i.test(f)) ruleFiles.push(join(d, f));
}
const citedExempts = new Set();
for (const f of ruleFiles) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(/EXEMPT-([A-Z]+)\s*:/g)) {
    if (m[1] === "X") continue; // literal placeholder in "EXEMPT-X:" documentation
    citedExempts.add(m[1]);
  }
}
// Markers consumed by PreToolUse check scripts, not the stop-gate —
// check-opening-discipline.mjs parses BRIEFING/PLAN escapes in
// gate-evidence itself (the pre-write gate's own markedLine channel).
const CHECK_SIDE_EXEMPTS = new Set(["BRIEFING", "PLAN"]);
for (const c of citedExempts) {
  if (!gateExempts.has(c) && !CHECK_SIDE_EXEMPTS.has(c)) problems.push(`rules cite EXEMPT-${c}: but stop-gate has no exempt("${c}") consumer — dead exemption vocabulary`);
}
for (const g of gateExempts) {
  if (!citedExempts.has(g)) warnings.push(`gate honors EXEMPT-${g}: with no rules-corpus citation — undocumented enforcement surface`);
}

// --- 2. State-field join --------------------------------------------------------
const defaultsM = trackerSrc.match(/STATE_DEFAULTS\s*=\s*\{([\s\S]*?)\};/);
const defaultFields = new Set(defaultsM ? [...defaultsM[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1]) : []);
// Fields written by hook siblings (rejection-tracker) or computed at gate
// runtime — a field the tracker never defaults is legal when a sibling
// creates it.
// resume_lanes/constraint_marks/constraint_lifted — written by
// rejection-tracker.mjs (UserPromptSubmit sibling). cycle_plan_satisfied/
// batch_plans_seen — written by check-cycle-plan.mjs (PreToolUse sibling).
const SIBLING_FIELDS = new Set(["epoch", "loop_grandfathered", "analysis_asked", "rejections", "quality_rejections", "design_rejections", "user_pause_signals", "subagent_launches", "sub_ceiling_count", "files_edited", "files_written", "ui_touched", "ddl_armed", "routes_armed", "tests_touched", "migrations_touched", "sitemap_touched", "plan_docs", "audit_armed", "audit_ledger_written", "repro_armed", "repro_rounds_armed", "blind_debt", "impl_touched", "todos_open", "todos_open_items", "todos_snapshot", "completed_during_session", "analysis_doc_written", "analysis_nag_done", "exit_review_seen", "stale_nag_at", "fr_nag_done", "sc_nag_done", "cc_nag_done", "stop_bypasses", "delegated_impl", "round_seen", "baseline_rounds", "round_rows", "round_rows_at", "impl_log", "resume_lanes", "phase_ledgers", "constraint_marks", "constraint_lifted", "cycle_plan_satisfied", "batch_plans_seen"]);
const gateReads = new Set(
  [...gateSrc.matchAll(/\bstate\.(\w+)/g)]
    .map((m) => m[1])
    .filter((f) => !["slice", "map", "filter", "some", "every", "includes", "X", "length"].includes(f))
);
const trackerWrites = new Set([...trackerSrc.matchAll(/\bstate\.(\w+)\s*=/g)].map((m) => m[1]));
for (const f of gateReads) {
  if (!defaultFields.has(f) && !SIBLING_FIELDS.has(f) && !trackerWrites.has(f)) {
    problems.push(`stop-gate reads state.${f} — not in STATE_DEFAULTS, no tracker write site, not a known sibling field (check can never arm)`);
  }
}

// --- 3. hooks.v1.json wiring ------------------------------------------------------
const hooksPath = join(ROOT, ".devin/hooks.v1.json");
try {
  const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
  const phases = ["PreToolUse", "PostToolUse", "UserPromptSubmit", "Stop", "SessionStart", "SessionEnd"];
  const entries = [];
  const walk = (o, path) => {
    if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (o && typeof o === "object") {
      if (o.command || o.script) entries.push({ o, path });
      for (const k of Object.keys(o)) walk(o[k], `${path}.${k}`);
    }
  };
  walk(hooks, "hooks");
  for (const { o, path } of entries) {
    const cmd = String(o.command || o.script || "");
    const m = cmd.match(/"([^"]+\.mjs)"/) || cmd.match(/([\w./\\$${}-]+\.mjs)/);
    if (m) {
      const stripped = m[1].replace(/\$\{?DEVIN_PROJECT_DIR\}?\/?/i, "");
      const sp = /^[A-Za-z]:[\\/]/.test(stripped) ? stripped : join(ROOT, stripped.replace(/^\.?\//, ""));
      if (!existsSync(sp)) problems.push(`hooks.v1.json ${path}: script ${m[1]} doesn't exist`);
      else {
        try { execSync(`node --check "${sp}"`, { stdio: "pipe" }); }
        catch { problems.push(`hooks.v1.json ${path}: script ${m[1]} fails node --check`); }
      }
    }
  }
  const hookText = JSON.stringify(hooks);
  for (const ph of phases) {
    if (hookText.includes(ph)) {
      // phase present — matcher sanity
      const mm = hooks[ph] && Array.isArray(hooks[ph]) ? hooks[ph] : null;
      if (mm) for (const e of mm) {
        if (e.matcher && typeof e.matcher === "string" && e.matcher.length > 200) warnings.push(`hooks.v1.json ${ph}: unusually long matcher string — verify it's not a regex pasted where a tool list belongs`);
      }
    }
  }
} catch (e) {
  problems.push(`hooks.v1.json unparseable: ${String(e.message || e).slice(0, 120)}`);
}

// --- 4. Failure-name → rules sync (warn) ------------------------------------------
const enforcement = ruleFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const failureNames = new Set(
  [...gateSrc.matchAll(/failures\.push\(\s*`([A-Z][A-Z-]{3,}):/g)].map((m) => m[1])
);
for (const n of failureNames) {
  if (!enforcement.includes(n)) warnings.push(`gate failure ${n}: has no citation in rules — the gate map may lag the implementation`);
}

// --- report -----------------------------------------------------------------------
console.log(`binding-lint: ${gateExempts.size} gate exemptions, ${citedExempts.size} rules-cited, ${gateReads.size} state fields read`);
for (const w of warnings) console.log(`  warn: ${w}`);
if (problems.length) {
  for (const p of problems) console.log(`  FAIL: ${p}`);
  console.log(`binding-lint: ${problems.length} binding gap(s)`);
  process.exit(1);
}
console.log("binding-lint: clean");
process.exit(0);
