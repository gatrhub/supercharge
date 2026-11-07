/**
 * UserPromptSubmit hook: rejection tracker.
 *
 * Tool-call hooks see edits and execs — never the user's words. The
 * single highest-information event in debugging ("it's still broken")
 * therefore had no representation in gate state: an agent could ship
 * fix after fix for the same symptom with nothing recording that the
 * last one failed. This script closes that input gap.
 *
 * When a prompt reports that a shipped fix did not resolve the symptom,
 * append a rejection record to .unlazy/gate-state/<sid>.json. The next
 * source edit then arms the REPRO gate in session-tracker.mjs, and the
 * stop gate requires one `REPRO:` evidence line per rejection round in
 * .unlazy/gate-evidence/<sid>.md — never twice blind
 * (rules/12-verification.mdc).
 *
 * The regex errs tight: a false negative costs a gate, a false positive
 * costs one honest REPRO line. Fail-open on internal errors.
 *
 * Also records user pause/chunk/assent signals (14-stop-integrity):
 * `STOP: ACCEPTED` and `Drive: checkpointed` are claims about what the
 * USER said — this scan makes them verifiable rather than asserted.
 * A signal only *enables* those classes; the excerpt is recorded so the
 * match stays auditable.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { laneOpenRows, NOT_LANE_REASONED_RE, docDriver, phaseStats } from "./deferral-patterns.mjs";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const STATE_DIR = join(ROOT, ".unlazy", "gate-state");

// Tight but covers the observed report classes: unresolved ("not fixed",
// "still happening"), fix-introduced defects ("made it worse",
// "creating another problem", "caused a new issue"), and the
// not-quite-fixed phrasings ("not fixing", "didn't fix").
const REJECTION_RE = /\b(not\s+fix(?:ed|ing)|isn'?t\s+fix(?:ed|ing)|wasn'?t\s+fix(?:ed|ing)|didn'?t\s+(?:fix|work)|did\s+not\s+(?:fix|work)|doesn'?t\s+work|does\s+not\s+work|no\s+longer\s+works?|no\s+change|same\s+(?:issue|problem|bug)|still\s+not\s+(?:fixed|working)|still\s+(?:happening|broken|occurring|there|the\s+same|showing|present|covering|overlapping|failing|crashing|an?\s+issue|a\s+problem)|it'?s\s+still\s+(?:not|broken|happening)|made\s+(?:it|things|this|that)\s+worse|creat(?:ing|ed)\s+another|(?:creat|introduc|caus)(?:ing|ed)\s+(?:a\s+|an\s+|another\s+)?(?:new\s+)?(?:issue|problem|bug|regression))\b/i;

// Pause/chunk/assent signals (14-stop-integrity): the prompt-side record
// that backs STOP: ACCEPTED ("the user agreed to pause") and Drive:
// checkpointed ("the user split the units"). Errs on the side of real
// pause intent — ambient "yes/ok/do it" deliberately do NOT match, so a
// signal is evidence, not noise. False negatives just push the agent to
// a different STOP class or an explicit user word.
const PAUSE_RE = /\b(stop|halt|pause|enough|wrap\s+(?:it|this|things)\s+up|hold\s+(?:on|off)|leave\s+it|skip\s+(?:it|this|that|the)|move\s+on|that'?s\s+(?:all|enough)|for\s+now|next\s+(?:unit|time|session|pass|week)|some\s+other\s+time|later\b|one\s+(?:thing|item)\s+at\s+a\s+time|just\s+(?:the|do|fix|finish|handle)|only\s+(?:the|do|fix|handle)|start\s+with|first\s+(?:do|fix|the)|approved|accept(?:ed)?|lgtm|sounds\s+good|go\s+ahead|proceed|you\s+can\s+stop|stand\s+down|hold\s+that|parking?\s+(?:that|this|it))\b/i;
// Negation/context guard (R16-F17): "not approved", "don't stop",
// "for now it's still broken", "skip it, that's wrong" all carry pause
// vocabulary while meaning the OPPOSITE — a mechanical record gave
// `STOP: ACCEPTED` corroboration the user never gave. A match counts
// only when no negation sits in its preceding ~60 chars and no
// "still wrong/broken"/other-verb continuation follows it. Bounded
// false-negatives are the safe direction: a missed signal just means
// the session needs a different STOP class, and the excerpt stays
// auditable either way.
const PAUSE_NEG_BEFORE = /(?:not|n't|never|hardly|do\s+not|does\s+not|did\s+not|don'?t|doesn'?t|didn'?t|won'?t|cannot|can'?t|isn'?t|aren'?t|shouldn'?t|wasn'?t|weren'?t|no)\s+(?:[\w'-]+\s+){0,3}$/i;
const PAUSE_NEG_AFTER = /^\s*[.,;]?\s*(?:(?:it'?s|that'?s|this\s+is|still)\s+(?:[\w'-]+\s+){0,2}(?:wrong|broken|bad|not\b|n't|un\w+|incorrect|incomplete)|(?:wrong|broken|incorrect|complain\w*|whin\w*)\b)/i;
const pauseSignaled = (text) => {
  const s = String(text || "");
  for (const m of s.matchAll(new RegExp(PAUSE_RE.source, "gi"))) {
    const before = s.slice(Math.max(0, m.index - 60), m.index);
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 40);
    if (PAUSE_NEG_BEFORE.test(before) || PAUSE_NEG_AFTER.test(after)) continue;
    return true;
  }
  return false;
};

// Analysis-ask scan (15-analysis-depth → the analysis project): causal/
// process questions AND subject analyses ("analyze my X", "review the auth
// flow", "find bugs in Y") get a narrative answer unless the examination
// machinery runs first. Two classes arm: (a) postmortem/root-cause asks,
// (b) subject-analysis verbs on a target. Lookup questions ("where is X",
// "what does X do") deliberately do not match — a falsely-armed small ask
// clears cheaply; a missed real ask has no recovery. Recording arms
// ANALYSIS-EVIDENCE (and ANALYSIS-PROJECT when a v1 doc exists) in the gate.
const ANALYSIS_RE = /\b(why\s+(?:did|didn'?t|do|does|is|isn'?t|was|wasn'?t)\s+(?:you|it|this|they|the)|how\s+did\s+(?:you|this|it)\s+(?:miss|happen|not|fail|end\s+up)|how\s+(?:did|does|do)\s+.{0,30}(?:miss|slip|happen|fail|occur)|analy[sz]e\b|diagnos[et]|root\s+cause|what\s+(?:went|is\s+going)\s+wrong|postmortem|why\s+exactly|missed\s+the\s+fact|properly\s+analyze|(?:audit|review|assess|evaluat|examin|inspect|critique)\w*\s+(?:the|my|our|your|this|that|for|on)|deep[- ]?dive|look\s+(?:into|over|closely\s+at)\s+(?:the|my|our|your|this|that)|walk\s+through|find\s+\w*\s*(?:bugs?|issues?|problems?|defects?|ways)|ways?\s+to\s+improv|improv\w*\s+(?:the|my|our|your|this|that|on)|how\s+(?:does|do|can|could|should)\s+.{0,40}\b(?:compare|improve)|comprehensive\s+(?:analysis|review|audit|look))\b/i;

// Quality-rejection scan (M-F3 — the reported failure: "not
// comprehensive", "barely any difference", "15% effort", "too shallow",
// "you only did X%"). A user reporting that completed work was THIN is
// not a defect-report (the thing works, it's under-done) — so it never
// matched REJECTION_RE, recorded no event, and carried no obligation:
// the re-ask read as a fresh prompt. This class records it as a
// quality_rejection — the analysis-analogue of a rejection round — and
// the stop gate then demands a `## Prior-pass gap` block naming what
// the previous pass missed (or a PRIOR-PASS: evidence line when the
// next work isn't doc-shaped). Same tight-but-covers doctrine: a false
// positive costs one honest gap line; a false negative re-teaches the
// user that catches don't count.
const QUALITY_RE = /\b(not\s+(?:comprehensive|thorough|detailed|deep|complete|exhaustive|extensive|good\s+enough|close\s+to\s+done|even\s+close)|(?:too|way\s+too|far\s+too|still\s+too|was\s+too|is\s+too|much\s+too)\s+(?:shallow|thin|surface[- ]?level|basic|simple|sparse|light|short|quick|low)|barely\s+(?:any|a)\s+(?:difference|change|improvement|effort|work)|\b(?:5|10|15|20|25|30|40|50|60|70|80)\s*(?:%|percent)\s+effort|(?:low|half|no)\s*[- ]?effort|half[- ]?(?:assed|baked|done|measure)|surface[- ]?level|phoned?\s+(?:it|this)\s+in|you\s+(?:only|just|barely)\s+(?:did|changed|fixed|touched|read|looked|examined|covered)|only\s+\d+\s*(?:%|percent)\s+of|didn'?t\s+(?:analyze|examine|review|look|read|check)\s+(?:everything|all|enough|deeply|thoroughly|properly)|(?:go|dig|look|go)\s+deeper|be\s+more\s+(?:thorough|detailed|comprehensive|careful|complete|extensive)|do\s+it\s+(?:properly|right|again|over|for\s+real)|try\s+(?:harder|again)|incomplete\s+(?:analysis|review|audit|work|coverage)|missed\s+(?:a\s+lot|most|half|tons?|loads?|so\s+much|too\s+much)|rushed|rush(?:ing)?\s+(?:it|this|through)|low[- ]?quality|not\s+detailed\s+enough|not\s+enough\s+(?:depth|detail|analysis|coverage|thoroughness|work|effort)|lazy\b(?!\s+(?:load|loading|eval|init|import|fetch|suspension|susan|loaders?|loaded))|cutting\s+corner|shortcut|short[- ]?changing|skimmed|skimpy|scant|perfunctory|token\s+(?:effort|analysis|review|pass)|checkbox\s+(?:mentality|compliance|work)|going\s+through\s+the\s+motion|wasn'?t\s+(?:thorough|comprehensive|detailed|careful|exhaustive)|bare[- ]?bones|bare[- ]?minimum|minimum\s+viable\s+effort|phone[- ]?in|mail(?:ed|ing)?\s+(?:it|this)\s+in|lacking\s+(?:depth|detail|thoroughness|coverage|substance)|weak\s+(?:analysis|review|audit|coverage|pass|work)|thin\s+(?:analysis|review|coverage|pass|work))\b/i;

function statePath(sid) { return join(STATE_DIR, `${sid}.json`); }
function readState(sid) {
  try {
    const s = JSON.parse(readFileSync(statePath(sid), "utf-8"));
    // Agent-writable file: a forged scalar/array must not crash the hook
    // (exit 1 fails open) or silently swallow records — the same guard
    // session-tracker's readState carries (R13-F2, sibling drift).
    return s && typeof s === "object" && !Array.isArray(s) ? s : {};
  } catch { return {}; }
}
function saveState(sid, state) {
  // fs failure must not kill the hook — exit 1 reads as error, not the
  // designed fail-open, and silently stops all recording (R14-F4).
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(statePath(sid), JSON.stringify(state, null, 2));
  } catch { /* recording is best-effort */ }
}
function note(line) { process.stdout.write(JSON.stringify({ context: line }) + "\n"); }
// The no-deferral contract injects on EVERY user prompt — the reminder is
// the point: a rule re-read at turn start fades by turn end; a contract
// delivered with the instruction itself does not. Same text as the
// stop-gate block/pass emit — one doctrine, every surface.
const NO_DEFERRAL_CONTRACT =
  "NO-DEFERRAL: deferring work is strictly prohibited — no residuals, parked items, follow-ups, " +
  "'later' labels, or unlisted open work. Every item exits only: done-with-evidence | " +
  "BLOCKED: <real external wall, declared> | ACCEPTED: <the user's own words>. " +
  "Deferral is the expensive option — the work stays owed, the user catches it, it returns multiplied.";

// Constraint-table recording (autopsy U8-5): a verdict's legality lives
// under the constraint set in force when it was written. "No code
// changes" then "fix everything" is a phase boundary — closures carried
// across it unexamined are the silent-inherit costume. Each prompt's
// constraint markers are recorded; a later implement/fix ask marks the
// boundary crossed. The gate joins the two and re-opens stale verdicts.
const CONSTRAINT_RE = /\b(no\s+(?:code\s+changes?|edits?|implementation|changes?|modifications?|fixes?)|don'?t\s+(?:change|edit|modify|implement|touch|write|build|fix|make\s+(?:any\s+)?changes?)\b|analysis\s+only|read[- ]?only|just\s+(?:analyze|analyse|read|look|review|document|examine)|document\s+(?:only|your|the)|analysis[\s,]+(?:don'?t|do\s+not)\s+(?:change|edit|implement)|no\s+(?:work|changes?)\s+(?:please|on|to))\b/i;
const IMPLEMENT_RE = /\b(fix|implement|build|apply|change|edit|write|ship|land|make\s+(?:the\s+)?changes?|patch|wire\s+(?:it|them|these)|begin\s+(?:fixing|implementing))\b/i;
function constraintMarkers(prompt) {
  const hits = [];
  let m; const re = new RegExp(CONSTRAINT_RE.source, "gi");
  while ((m = re.exec(prompt))) hits.push(m[0].toLowerCase().replace(/\s+/g, " ").slice(0, 60));
  return hits.slice(0, 6);
}

function main() {
  let input;
  try { input = JSON.parse(readFileSync(0, "utf-8")); }
  catch { process.exit(0); }
  if (!input || typeof input !== "object" || Array.isArray(input)) process.exit(0);

  const sid = input.session_id || "unknown";
  const prompt = String(input.prompt || input.user_prompt || input.message || "");
  if (!prompt) process.exit(0);
  note(NO_DEFERRAL_CONTRACT);

  // Last-block re-injection: the Stop hook's `decision:block` reason only
  // reaches the agent if the client renders the JSON contract — a client
  // that surfaces "hook blocked" without the body leaves the agent blind
  // (the a prior session "Standing by" loop). The gate persists the
  // reason to <sid>-last-block.txt; re-inject it here — the chat-visible
  // channel — then consume it (a fresh block rewrites the file and rides
  // the next prompt the same way).
  try {
    const lbPath = join(STATE_DIR, `${String(sid).replace(/[^\w-]/g, "")}-last-block.txt`);
    if (existsSync(lbPath)) {
      const lb = readFileSync(lbPath, "utf-8").trim();
      if (lb) {
        const head = lb.split("\n").slice(0, 15).join("\n");
        note(`STOP-GATE BLOCK — your last stop attempt was refused. The reason (also on the JSON channel):\n${head}${lb.length > head.length ? `\n… ${lb.length - head.length} more chars in .unlazy/gate-state/${sid}-last-block.txt` : ""}`);
      }
      try { unlinkSync(lbPath); } catch { /* consume best-effort */ }
    }
  } catch { /* re-injection is best-effort, never a hook failure */ }

  const state = readState(sid);
  // `epoch` marks files born under the temporal-anchor machinery — a file
  // this hook creates fresh is epoch-stamped so session-tracker doesn't
  // mistake it for a pre-machinery (grandfathered) state file.
  if (!existsSync(statePath(sid)) && state.epoch == null) { state.epoch = 2; state.loop_grandfathered = false; }

  // Lane resumption (16-iteration-loop → Lane): a lane is a ledger doc
  // that declared continuing work (`Lane:`/`Drive:`/`Driver:`) and still
  // carries non-terminal rows. Lanes live at workspace level — a fresh
  // session's gate-state sees nothing, so the scan runs here per prompt.
  // RESUME-LANE injects the obligation and records `resume_lanes` so
  // check-cycle-plan can gate the first unplanned source edit.
  // Runs on EVERY prompt while state exists — the reminder is the point:
  // a lane that stops being visible mid-session is how agents forget the
  // machinery exists. The scan is bounded (6 dirs × ≤120 .md files).
  {
    state._lane_scan_rounds = (state._lane_scan_rounds || 0) + 1;
    const lanes = [];
    const undeclared = [];
    const phaseLedgers = [];
    const LANE_DIRS = [
      join(ROOT, ".unlazy", "analysis"),
      join(ROOT, ".unlazy", "audit-ledger"),
      join(ROOT, ".unlazy"),
      join(ROOT, "docs"),
      join(ROOT, "docs", "active-work"),
      join(ROOT, "docs", "plans"),
    ];
    const LANE_RE = /^\s*(?:Lane|Drive|Driver)\s*:/im;
    for (const dir of LANE_DIRS) {
      let files = [];
      try { files = readdirSync(dir); } catch { continue; }
      for (const f of files.slice(0, 120)) {
        if (!/\.md$/i.test(f)) continue;
        let text;
        try { text = readFileSync(join(dir, f), "utf-8"); } catch { continue; }
        // Open rows decide; no declaration pardons them away (B15). A
        // doc declaring non-lane/closed WITH a reason skips the scan —
        // a declared reference doc can legitimately carry open-vocab
        // tables. Bare `Lane: none`/`Ledger: closed` on an open-row doc
        // is a contradiction, not a pardon: it flags as undeclared.
        // Driver-scoped ownership: `Driver: <sid>` claims the lane for
        // that session — it must not arm another session's gate (the
        // events-lane session was being held for the machinery lanes'
        // plans). `Lane:`/`Drive:` with no Driver stays shared.
        const drv = docDriver(text);
        if (drv && drv !== sid) continue;
        const openRows = laneOpenRows(text);
        // Phase ledger: docs carrying ≥2 PHASE rows get a position
        // rollup at every prompt — independent of open-row lanes (a
        // phase doc's own statuses track completion). Driver-foreign
        // and declared-closed docs stay skipped.
        const phases = phaseStats(text);
        if (phases && phases.total >= 2 && phases.remaining > 0 && !NOT_LANE_REASONED_RE.test(text)) {
          phaseLedgers.push({ doc: join(dir, f).replace(/\\/g, "/"), phases });
        }
        if (openRows <= 0) continue;
        if (NOT_LANE_REASONED_RE.test(text)) continue;
        const entry = { doc: join(dir, f).replace(/\\/g, "/"), open: openRows };
        (LANE_RE.test(text) ? lanes : undeclared).push(entry);
      }
    }
    state.resume_lanes = lanes;
    state.undeclared_ledgers = undeclared;
    state.phase_ledgers = phaseLedgers;
    saveState(sid, state);
    if (phaseLedgers.length) {
      note(
        `PHASE-POSITION: ${phaseLedgers.map((p) => {
          const c = p.phases.current;
          return `${basename(p.doc)} is at Phase ${c ? c.n : "?"}/${p.phases.total} — "${c ? c.name : "?"}" (${c ? c.status : "?"}) — ${p.phases.done} done, ${p.phases.remaining} remaining`;
        }).join(" | ")}. ` +
        `Phase rows are the project rollup lanes never had: \`PHASE <n> <name> — exit: <criteria> — ` +
        `status: open|in-progress|blocked|done\` in a lane doc (00-operating §3 → phase ledger).`
      );
    }
    if (undeclared.length) {
      note(
        `UNDECLARED-LEDGER: ${undeclared.length} ledger doc(s) carry open rows but no lane declaration — ` +
        `${undeclared.map((l) => basename(l.doc)).join(", ")}. Absence is not a disposition: each doc gets ` +
        `\`Lane: standing — <instruction>\` (its rows resume as standing work) or \`Ledger: closed — <why>\` ` +
        `(declared non-lane). An undeclared open ledger is invisible to the lane machinery by design — ` +
        `make the choice explicit (16-iteration-loop → Lanes).`
      );
    }
    if (lanes.length) {
      note(
        `RESUME-LANE: ${lanes.length} standing lane(s) carry open work — ` +
        `${lanes.map((l) => `${basename(l.doc)} (${l.open} open row(s))`).join(", ")}. ` +
        `Open lane rows are this session's standing assignment (14-stop-integrity → auto-resume). ` +
        `Cycle protocol, in order (16-iteration-loop → Lanes): ` +
        `(1) RE-FRESH: re-read the rules in force — 00-operating, 10-rule-enforcement, 14-stop-integrity, ` +
        `15-analysis-depth, 16-iteration-loop + file-scoped rules the unit touches — and stamp \`RE-FRESH:\` ` +
        `into the round/batch record. ` +
        `(2) ANALYZE: the batch gets a real analysis pass — what each finding needs, evidence per item, ` +
        `not a grab-and-edit. ` +
        `(3) PLAN: a NEW \`BATCH-PLAN: <findings>\` row + a NEW \`BATCH-ANALYSIS: <item> — <verdict>\` row per planned ` +
        `finding + a NEW \`BATCH-VERIFY: <checks>\` row in the lane doc — what the batch commits to, why each item is ` +
        `feasible/blocked, and how it will be verified, written before code. ` +
        `(4) TODOS: a comprehensive todo list — ≥3 items spanning analyze/plan + implement + verify stages AND ` +
        `covering every finding-id the plan names (a one-line list, or a list beside the plan, is not a plan). ` +
        `(5) Then edit: check-cycle-plan.mjs blocks source edits until (3)+(4) exist — per batch, not per session. ` +
        `(6) Record the batch in the iteration doc (round sections + RE-FRESH stamp; the stop gate checks).`
      );
    }

    // ANALYSIS-MANDATE nag (the user's depth ask): once impl-class writes
    // exist with no analysis doc on record, inject the requirement once —
    // mid-session, before the stop gate would name it. Latched per session.
    if (!state._mandate_nagged && !state.analysis_doc_written) {
      const implSeen = Array.isArray(state.impl_touched) && state.impl_touched.length > 0;
      // ui_touched is a persisted path array — length, never truthiness.
      if (implSeen || (state.ui_touched || []).length > 0) {
        state._mandate_nagged = true;
        saveState(sid, state); // the latch must persist — saveState at :180 already ran
        note(
          `ANALYSIS-MANDATE: implementation work is underway with no analysis doc — substantive work owes ` +
          `\`.unlazy/analysis/<name>.md\` carrying \`<!-- analysis-project v2 -->\` + subject-class/job + ` +
          `Universe (derived enumeration) + ### per-unit examinations + ## Implementation plan (per-item rows ` +
          `with approach/risk/verify) + ## Plan review (each plan part graded on missing / issues / improve / ` +
          `nice-to-add / user-want) + ## Drill (nested units discovered mid-work — a modal's second page gets ` +
          `the same depth) + the schema spine (15-analysis-depth). Extend the newest existing doc in ` +
          `\`.unlazy/analysis/\` when the subject is the same — a genuinely new subject declares ` +
          `\`DECLARED: new-subject — <why>\` (parallel docs for one subject are ledger spam). ` +
          `Genuinely narrow work declares \`DECLARED: fix-scale — <why>\` in gate-evidence. The stop gate enforces.`
        );
      }
    }
  }

  // Pause/chunk/assent scan (14-stop-integrity): the record that makes
  // STOP: ACCEPTED and Drive: checkpointed verifiable claims instead of
  // assertions. Cap the list so a chatty session can't grow it unbounded.
  if (pauseSignaled(prompt)) {
    if (!Array.isArray(state.user_pause_signals)) state.user_pause_signals = [];
    state.user_pause_signals.push({ ts: new Date().toISOString(), excerpt: prompt.slice(0, 140) });
    if (state.user_pause_signals.length > 20) state.user_pause_signals.shift();
    saveState(sid, state);
  }

  // Constraint table: each prompt's no-edit markers go on record, and the
  // first implement-shaped prompt after a marked prompt is the phase
  // boundary — verdicts written under the old table re-open at the gate.
  const cMarks = constraintMarkers(prompt);
  if (cMarks.length) {
    if (!Array.isArray(state.constraint_marks)) state.constraint_marks = [];
    state.constraint_marks.push({ ts: new Date().toISOString(), markers: cMarks, excerpt: prompt.slice(0, 140) });
    if (state.constraint_marks.length > 20) state.constraint_marks.shift();
    saveState(sid, state);
  } else if (!state.constraint_lifted && (state.constraint_marks || []).length && IMPLEMENT_RE.test(prompt)) {
    state.constraint_lifted = { ts: new Date().toISOString(), excerpt: prompt.slice(0, 140) };
    saveState(sid, state);
  }

  // Analysis arm: inject the analysis-PROJECT protocol (not just the
  // evidence-pass fragment) and record the ask so ANALYSIS-EVIDENCE /
  // ANALYSIS-PROJECT can require the coverage at stop.
  if (ANALYSIS_RE.test(prompt)) {
    state.analysis_asked = { ts: new Date().toISOString(), excerpt: prompt.slice(0, 140) };
    saveState(sid, state);
    note(
      `ANALYSIS-PROJECT ARMED (15-analysis-depth): an analysis ask is a worked examination, not a prose pass. ` +
      `1) Constraint ledger — the ask's conditions verbatim with check forms. 2) Derived universe — enumerate ` +
      `the subject's units from a mechanical source (files, routes, tables, renders, DOM), never memory. ` +
      `3) Analysis plan — the ordered work list, posted before walking. 4) Per-unit findings — one ### block ` +
      `per unit: Examined + Found + evidence (file:line / probe / quoted behavior). 5) Hypothesis log + ` +
      `constraint check + synthesis + gap review + independent eyes. Broad/subject asks write ` +
      `.unlazy/analysis/<topic>-analysis.md with <!-- analysis-project v2 --> (subject-job line + committed ` +
      `synthesis) — the stop gate reconciles UNITS: x/y like the audit ledger. Chat-scale answers carry the ` +
      `floor: machinery-plan block + examined-vs-found counts + found:/cleared:/unverifiable: lines + ` +
      `committed synthesis (ranked, mechanism, alternative weighed, falsifier) + ## Evidence. Narrow asks ` +
      `declare scope: DECLARED: chat-scale — <why>. Routing is declared, not assumed. ` +
      `Evidence pass first: file:line cites, mtimes/diffs actually read, INFERENCE: tags; findings before fixes.`
    );
  }

  // Quality-rejection record (M-F3): a "not comprehensive / too shallow /
  // 15% effort" report is a recorded instrument-failure event — the
  // analysis-analogue of a rejection round. The stop gate then demands a
  // `## Prior-pass gap` block naming what the previous pass missed, so
  // the re-ask arrives WITH the remediation obligation attached instead
  // of reading as a fresh prompt.
  if (QUALITY_RE.test(prompt)) {
    if (!Array.isArray(state.quality_rejections)) state.quality_rejections = [];
    state.quality_rejections.push({ ts: new Date().toISOString(), excerpt: prompt.slice(0, 140) });
    saveState(sid, state);
    note(
      `quality-rejection recorded: completed work was reported thin (${prompt.slice(0, 80)}). ` +
      `The re-ask is an instrument-failure event, not a fresh prompt — before the next analysis-shaped ` +
      `answer or stop, name what the previous pass missed: a ## Prior-pass gap block inside the next ` +
      `armed analysis/design doc (or PRIOR-PASS: <what was missed + the mechanism that let it ship> ` +
      `in .unlazy/gate-evidence/${sid}.md when the work isn't doc-shaped). The gap is the contract: ` +
      `vocabulary you can't name is a pass you can't fix (15-analysis-depth, M-F3).`
    );
  }

  // Design-rejection record (UX-F3): a user design critique ("ugly",
  // "looks wrong", "the layout is off", "make it look like X") is grammar
  // material — design-grammar's own contract says feedback lands in the
  // file the same session. Record it so the gate can demand the
  // GRAMMAR:/CALIBRATION: row when design work follows.
  const DESIGN_REJECT_RE = /\b(?:ugly|looks?\s+(?:bad|wrong|off|broken|cheap|dated|flat|cluttered|messy|awful|terrible|horrible)|the\s+(?:layout|design|styling|look|theme|colors?|colours?|spacing|typography|fonts?|icons?|buttons?|cards?|hero|header|nav|sidebar)\s+(?:is|looks?|feels?|seems?|reads?)\s+(?:wrong|off|bad|broken|weird|cluttered|cramped|empty|dated|flat|inconsistent|misaligned|crooked)|make\s+it\s+(?:look|feel|read)\s+(?:more\s+)?(?:like|premium|modern|clean|better|professional)|doesn'?t\s+(?:look|feel|read)\s+(?:right|good|premium|polished|designed)|hate\s+(?:the|how|this)|i\s+don'?t\s+like\s+(?:the|how|this)|worse\s+than|regress(?:ed|ion)?\s+(?:the\s+)?(?:design|look|visual)|misalign|crooked|lopsided|unbalanced|off[-\s]?center|cramped|cluttered|generic[-\s]?looking|bland|amateur|unpolished|unfinished[-\s]?looking|eyeball[-\s]?off)\b/i;
  if (DESIGN_REJECT_RE.test(prompt)) {
    if (!Array.isArray(state.design_rejections)) state.design_rejections = [];
    state.design_rejections.push({ ts: new Date().toISOString(), excerpt: prompt.slice(0, 140) });
    if (state.design_rejections.length > 20) state.design_rejections.shift();
    saveState(sid, state);
    note(
      `design-rejection recorded: a user design critique is grammar material (design-grammar → feedback lands ` +
      `this session). Before stop, the session's design work must carry a GRAMMAR: <what the grammar file ` +
      `gained — new exemplar rule, voice note, defect class> or CALIBRATION: <why no grammar addition applied> ` +
      `line in .unlazy/gate-evidence/${sid}.md — feedback that doesn't land is feedback the next session relearns.`
    );
  }

  if (!REJECTION_RE.test(prompt)) process.exit(0);

  if (!Array.isArray(state.rejections)) state.rejections = [];
  state.rejections.push({ ts: new Date().toISOString(), excerpt: prompt.slice(0, 140) });
  saveState(sid, state);
  note(
    `rejection recorded: a previous fix was reported unresolved. Never twice blind (12-verification.mdc) — ` +
    `reproduce the symptom (live page, headless on the real served page, or ask the user for access/artifacts) ` +
    `before the next code change for it. Each rejection round needs a REPRO: line in .unlazy/gate-evidence/${sid}.md ` +
    `with expected: <correct state + reference> and surfaces: <covered surfaces>, plus a BLIND-DEBT: kept/removed ` +
    `line per file edited while the symptom was unverified.`
  );
  process.exit(0);
}

main();
