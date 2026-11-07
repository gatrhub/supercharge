/**
 * PreToolUse hook (edit|write|exec|write_to_process): opening-discipline gate.
 *
 * The two failures this kills, both observed live:
 *   1. Sessions diving straight into implementation with no `briefing`
 *      skill invocation — the mandated session-start move (00-operating;
 *      briefing SKILL.md re-reads the installed rules and loads the
 *      domain skills). Advisory nagging never worked; this blocks.
 *   2. Work starting with code before the structured artifacts exist —
 *      no plan/ledger row, no analysis doc while `analysis_asked` is
 *      armed (15-analysis-depth, 16-iteration-loop). The tracker's
 *      `note()` advisory was ignored; a block can't be.
 *
 * Fires on implementation-class writes under app/* (product trees —
 * docs stays exempt) AND the instrument tree (.devin/scripts,
 * .devin/hooks*, rules — a prior session demonstrated
 * the classification dodge: instrument edits ARE implementation).
 * Ledger docs, .unlazy artifacts, .md files and docs are the
 * remediation surface and never block (mirroring check-cycle-plan's
 * EXEMPT_RE). Every impl write is checked until the session satisfies;
 * once the record exists the gate passes silently.
 *
 * Exec/write_to_process payloads are scanned for write targets via
 * execWriteTargets (heredocs, redirects, tee, cp, Set-Content — the
 * shell write channel can't walk around the file-tool gate).
 *
 * Satisfied by (in order):
 *   BRIEFING — `BRIEFED:`/`EXEMPT-BRIEFING:` marker in
 *     .unlazy/gate-evidence/<sid>.md (the attestation contract — the
 *     primary, always-available path), or a tracker-observed
 *     `briefing_engaged` exec signal (skill/rule files read via shell —
 *     the read/skill tools emit no hook events this runtime can see).
 *   OPENING-PLAN — an armed plan artifact: state.plan_docs non-empty,
 *     analysis_doc_written, audit_ledger_written, cycle_plan_satisfied,
 *     or a `BATCH-PLAN:`/`LEDGER:`/`DECLARED: no-plan — <reason>` /
 *     `EXEMPT-PLAN: <scope or *> — <reason>` line in gate-evidence.
 *   ANALYSIS-EVIDENCE — when analysis_asked is armed, the analysis-doc
 *     leg is required specifically (a plan row doesn't substitute for
 *     the asked-for examination — the observed dodge); `DECLARED:
 *     chat-scale — <why>` releases it (also declare the scale in the
 *     reply — the stop-gate reads the message, not this file).
 *
 * Marker parsing: names must start at a word boundary (UNBRIEFED can't
 * satisfy BRIEFED), the separator accepts `:`/`—`/`--`/`::`/` - ` so the
 * DECLARED:-prefixed forms parse, inline-code spans and fenced blocks
 * are stripped first (mention ≠ use), and the scope segment must be
 * non-empty (`BRIEFED: — xxx` carries nothing).
 *
 * Trust note: gate-state is agent-writable JSON — a forged
 * `briefing_engaged`/`plan_docs` is an auditable lie in a tracked file,
 * same doctrine as every marker. Dead-population keys
 * (skills_invoked/briefed_at — no event writes them under this runtime)
 * are NOT satisfy legs: they'd be forgery-only channels.
 *
 * Fail-open on internal errors, matching every sibling hook.
 */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execWriteTargets } from "./write-targets.mjs";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const STATE_DIR = join(ROOT, ".unlazy", "gate-state");

// Implementation-class targets — check-cycle-plan's class UNIONED with
// the tracker's own (session-tracker IMPL_RE): a migration .sql, a
// deploy .sh/.ps1, or a desktop-app .rs is implementation too. The
// extension list is $-anchored so `x.json.lock`/`dir.js/y.txt` can't
// arm on an interior match.
const IMPL_RE = /\.(?:js|mjs|cjs|ts|jsx|tsx|css|scss|less|html|j2|jinja|py|pyi|json|toml|yaml|yml|mdc|sql|sh|ps1|bat|ini|cfg|conf|rs|go|rb|php|java|c|cc|cpp|h|hpp|vue|svelte)$/i;
const HOOKS_RE = /(^|[\\/])hooks\.v1\.json$/i;
// Path arms — the product tree (any app/* except the doc classes
// EXEMPT_RE carves out) and the instrument tree.
const MAIN_RE = /(?:^|[\\/])(?:app|src|lib|pkg)[\\/]/i;
const INSTR_RE = /(?:^|[\\/])\.devin[\\/](?:scripts|skills)[\\/]|(?:^|[\\/])\.devin[\\/]hooks|(?:^|[\\/])(?:\.cursor[\\/])?rules[\\/]/i;
const EXEMPT_RE = /(^|[\\/])\.unlazy[\\/]|\.md$|docs[\\/]|(^|[\\/])(?:GATES|PLAN|AGENTS|README|CHANGELOG)\b/i;

const block = (reason) => {
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
  process.exit(2);
};

// Mention ≠ use — strip fenced blocks and inline-code spans before
// scanning for markers (a `BRIEFED:` inside a quoted block message or a
// backticked `DECLARED:` describing the escape is documentation, not the
// act itself).
const stripFences = (text) =>
  String(text || "").replace(/```[\s\S]*?(?:```|$)/g, " ").replace(/`[^`\n]*`/g, " ");

const EXEMPT_SEP = /\s*(?:—|--|::| - )\s*/;
// Two marker shapes, parsed separately:
//   NAME: <scope> — <reason>   (BRIEFED:, BATCH-PLAN:, EXEMPT-*:)
//   DECLARED: <kind> — <reason> (the kind is part of the name — what
//     follows the dash IS the reason, so no two-part split applies)
// A written escape needs a reason, not a bare marker — same floor the
// gates' exempt() applies elsewhere. Names must sit at a non-word
// boundary (UNBRIEFED/BLOCKED:/AUDIT-LEDGER: can't satisfy
// BRIEFED/LEDGER), spans/fences are stripped first (mention ≠ use), and
// the scope segment must be non-empty (`BRIEFED: — xxx` carries nothing).
const markedLine = (evidence, names) =>
  stripFences(evidence).split(/\r?\n/).some((l) => {
    const m = l.match(new RegExp(`(?:^|[^A-Za-z0-9_-])(?:${names})\\s*:\\s*([\\s\\S]*)$`, "i"));
    if (!m) return false;
    const parts = m[1].split(EXEMPT_SEP);
    return parts.length >= 2 && parts[0].trim().length > 0 && /\S.{9,}/.test(parts.slice(1).join(" "));
  });
const declaredLine = (evidence, kinds) =>
  stripFences(evidence).split(/\r?\n/).some((l) => {
    const m = l.match(new RegExp(`(?:^|[^A-Za-z0-9_-])DECLARED\\s*:\\s*(?:${kinds})\\s*[—–-]{1,2}\\s*([\\s\\S]*)$`, "i"));
    return m && /\S.{9,}/.test(m[1]);
  });

let raw = "";
process.stdin.setEncoding("utf-8");
for await (const chunk of process.stdin) raw += chunk;

try {
  const input = JSON.parse(raw || "{}");
  if (!input || typeof input !== "object" || Array.isArray(input)) process.exit(0);
  const sid = input.session_id || "unknown";
  const tool = String(input.tool_name || "");
  if (tool && !/^(edit|write|exec|write_to_process)$/.test(tool)) process.exit(0);
  const ti = input.tool_input || {};
  const isImplPath = (p) => {
    const fp = String(p || "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    return !!(fp && (MAIN_RE.test(fp) || INSTR_RE.test(fp)) &&
      (IMPL_RE.test(fp) || HOOKS_RE.test(fp)) && !EXEMPT_RE.test(fp));
  };

  // Collect candidate write targets: file_path/path for edit|write,
  // execWriteTargets extraction for shell write channels.
  let targets = [];
  if (typeof ti.file_path === "string" || typeof ti.path === "string") {
    targets = [ti.file_path || ti.path];
  } else {
    const cmd = String(ti.command || ti.text_input || "");
    if (cmd) {
      const ext = execWriteTargets(cmd, ROOT);
      targets = ext && Array.isArray(ext.targets) ? ext.targets : [];
    }
  }
  if (!targets.length || !targets.some(isImplPath)) process.exit(0);

  const statePath = join(STATE_DIR, `${sid}.json`);
  let state = {};
  if (existsSync(statePath)) {
    try {
      const s = JSON.parse(readFileSync(statePath, "utf-8"));
      state = s && typeof s === "object" && !Array.isArray(s) ? s : {};
    } catch { state = {}; }
  }
  const evidencePath = join(ROOT, ".unlazy", "gate-evidence", `${sid}.md`);
  const evidence = existsSync(evidencePath) ? readFileSync(evidencePath, "utf-8") : "";

  // ── leg 1: briefing ─────────────────────────────────────────────
  // skills_invoked/briefed_at are dead-population keys under this
  // runtime (no skill/read hook events arrive) — keeping them as satisfy
  // legs would leave a forgery-only channel. The contract is the marker
  // (attestation) or the tracker-observed exec signal.
  const briefed =
    !!state.briefing_engaged ||
    markedLine(evidence, "BRIEFED|EXEMPT-BRIEFING");
  if (!briefed) {
    block(
      `BRIEFING-GATE: this session's implementation write lands before the opening discipline — ` +
      `invoke the \`briefing\` skill first (it re-reads the installed rules and loads the domain skills — ` +
      `the mandated session-start move; "I'll keep them in mind" is not adherence), then record ` +
      `\`BRIEFED: <what was loaded> — <the load>\` in .unlazy/gate-evidence/${sid}.md (the marker IS the ` +
      `contract — shell reads of skills/rules files also count via the tracker, but the marker is the ` +
      `always-available path). Ledger/plan/artifact writes pass unblocked — the remediation itself is ` +
      `never gated. If briefing genuinely doesn't apply (a one-line typo-class change), write ` +
      `\`EXEMPT-BRIEFING: <scope> — <why>\` there instead. ` +
      `(00-operating §2 — agents start correctly per the rules, not retroactively.)`
    );
  }

  // ── leg 2: opening plan ─────────────────────────────────────────
  const planArmed =
    (Array.isArray(state.plan_docs) && state.plan_docs.length > 0) ||
    !!state.analysis_doc_written ||
    !!state.audit_ledger_written ||
    !!state.cycle_plan_satisfied ||
    markedLine(evidence, "BATCH-PLAN|LEDGER|EXEMPT-PLAN") ||
    declaredLine(evidence, "no-plan|chat-scale|trivial");
  if (!planArmed) {
    block(
      `OPENING-PLAN gate: an implementation write with no structured artifact armed — ` +
      `no plan doc, no analysis doc, no ledger row, no declared scope. The rules' opening order is ` +
      `plan → implement, not probe → retrofit: write the artifact first ` +
      `(a lane-doc row, a \`BATCH-PLAN:\` line, an analysis doc under .unlazy/analysis/, or ` +
      `\`DECLARED: no-plan — <why this is genuinely single-step>\` in .unlazy/gate-evidence/${sid}.md). ` +
      `Artifact writes themselves pass unblocked. (15-analysis-depth / 16-iteration-loop / 00-operating §2)`
    );
  }

  // ── leg 3: analysis asked, doc owed ─────────────────────────────
  // The tracker's advisory nag for this exact shape went unanswered in
  // the observed session — the deliverable is the examination doc, and
  // code written in its place is the dodge this line exists to catch.
  // chat-scale declared HERE releases the pre-write leg; the stop-gate
  // independently wants the scale declared in the reply itself.
  if (state.analysis_asked && !state.analysis_doc_written &&
      !markedLine(evidence, "EXEMPT-ANALYSIS") &&
      !declaredLine(evidence, "chat-scale")) {
    block(
      `ANALYSIS-EVIDENCE gate: the prompt asked for analysis and implementation is landing ` +
      `before the examination doc exists — write the analysis doc under .unlazy/analysis/ ` +
      `(subject-job → universe → per-unit findings → hypothesis log → synthesis) or ` +
      `\`DECLARED: chat-scale — <why>\` in .unlazy/gate-evidence/${sid}.md AND in the reply ` +
      `for a genuinely narrow ask. ` +
      `(15-analysis-depth — the analysis is the deliverable, not a preamble to code.)`
    );
  }

  process.exit(0);
} catch {
  process.exit(0); // fail-open — a hook bug never blocks work
}
