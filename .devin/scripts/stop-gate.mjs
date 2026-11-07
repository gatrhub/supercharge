/**
 * Stop hook: refuse to close a session whose armable rule-triggers fired
 * without their paired obligations being met.
 *
 * Checks (all armed by session-tracker.mjs state):
 *   - design-review: any UI source edit → enumerated critique artifact
 *     (.unlazy/design-review/<sid>.md) covering every touched file, plus
 *     an Interpretation block (ask + outcome + referent + exemplar +
 *     verdict basis) so the goal and referent are written before edits —
 *     09-design-review.mdc → the outcome → exemplar → kind protocol.
 *     Coverage requires a persona column (surface × viewport × actor);
 *     ## Predictions (expectation-first), ## Options, ## Budgets (spec'd
 *     changes), ## Deltas (spec'd changes), and ## Unverified (the named
 *     remainder) are required sections — 'none' is the honest entry, a
 *     bare heading is not. Findings rows are checked by scanning every
 *     findings-shaped table in the artifact (any header carrying a
 *     finding/severity/disposition column), not by ID shape or section
 *     name. Spec sections are content-checked too: ## Chrome must name a
 *     chrome class, ## Registration/## Surfaces must cite the search
 *     derivation or say 'none'. Appearance-class artifacts (a real
 *     referent or exemplar named in Interpretation) also need
 *     ## Verdicts — one row per repainted surface: a structural
 *     stranger-description (≥15 words, never adjective-only), a named
 *     weakest area (or 'none — <defense>'), and a verdict token
 *     (AT-BAR | BELOW-BAR: <lack>). An all-AT-BAR sheet with zero
 *     defended weakest areas is flagged as the never-judged signature —
 *     "the fix is on camera" is not a design verdict (09-design-review
 *     → composition verdict).
 *   - undefined-token: touched .css files may not reference var(--app-x)
 *     where --app-x is declared in no stylesheet and set by no script
 *     under app/ui|ui_admin — a dead token resolves to its
 *     fallback or nothing (the invisible-pressed-state class,
 *     13-design-spec.mdc banned basins).
 *   - verdict-scope: UI-touching sessions — the reported assistant
 *     output may not self-issue quality verdicts ("at the bar",
 *     "matches the board", "polished"); negated lines exempt
 *     (09-design-review.mdc → Report scoping).
 *   - migration: DDL content introduced outside migrations/ → a
 *     migrations/versions/g*.py file written, or EXEMPT-MIGRATION.
 *   - sitemap: route registration added in adapters/http/ → docs/sitemap.md
 *     touched, or EXEMPT-SITEMAP.
 *   - tests-run: tests/*.py edited → a successful pytest/vitest/jest exec
 *     this session, or EXEMPT-TESTS.
 *   - audit-ledger: findings/analysis-doc writes (or a ledger write)
 *     → .unlazy/audit-ledger/<sid>.md with mechanically-reconciled
 *     coverage: every enumerated universe carries a count derived by a
 *     pasted command (`verify: <read-only cmd>` — re-executed here and
 *     compared), `doc:` (a committed file), or `DECLARED:` (justified
 *     judgment); Coverage rows must equal the total count, name a
 *     declared universe, carry terminal states (DONE | VERIFIED |
 *     MEASURED | BLOCKED: <external wall> | ACCEPTED: <user re-scoped;
 *     user verb required>) and evidence; COVERED: X/Y must match the
 *     computed arithmetic; a ## Denial section must exist.
 *     03-periodic-audits → audit-ledger.
 *   - open-ledger: session-touched ledger docs (Active Work task/plan MDs,
 *     .unlazy/ plan+gate docs) carry no undeclared deferral labels —
 *     "not built", "not this pass", "later pass", "won't fix", QUEUED:,
 *     SKIPPED:, "circle back", "remaining items", etc. There is no
 *     self-scheduled deferral: a line exits only as BLOCKED: (external
 *     wall — a credential, service, or person; never effort or "later")
 *     or ACCEPTED: (the user re-scoped — the line must carry a user
 *     verb: agreed/approved/asked/assigned/decided/...), else the file
 *     needs EXEMPT-LEDGER.
 *     Unchecked `- [ ]` task rows are the normal ledger state and are
 *     NOT flagged — this check targets relabeled incompleteness, the
 *     deferral-by-label stop (00-operating §2e; user's no-deferral
 *     directive 2026-11-03).
 *     It also refuses UNDISPOSED-COVERAGE rows — "boundary" sections,
 *     "not read/covered/verified this pass", "unexamined" units — the
 *     document-as-epilogue failure where naming what was skipped stood
 *     in for finishing — same two legal exits (03-periodic-audits 4b,
 *     00-operating §2a documented-gap-is-work).
 *
 * Exemptions live in .unlazy/gate-evidence/<sid>.md as
 * `EXEMPT-<CHECK>: <target or *> — <reason>` lines — auditable
 * assertions, never silent skips. All unmet gates are reported together.
 *
 *   - drive-declared: open work at turn end (todos / Driver: <sid> docs)
 *     → the drive mode must be written — Drive: continuous|checkpointed
 *     on the doc or a DRIVE: line in gate-evidence — not defaulted
 *     (14-stop-integrity.mdc).
 *   - stop-declared: open todos at last todo_write, or open rows in a
 *     Driver: <sid> doc outside Drive: continuous → a declared,
 *     classified stop in gate-evidence — STOP: USER-GATE|BLOCKED|ACCEPTED.
 *     Substance-checked: USER-GATE needs ≥4 words after the class (a
 *     question, not a label) — and the reported assistant output
 *     (last_assistant_message / transcript) must actually contain a
 *     question; a BLOCKED line citing a path is verified against the
 *     filesystem, a backticked command against the transcript; ACCEPTED
 *     needs a recorded user signal. Capacity is not a class: the runtime
 *     owns halting (14-stop-integrity.mdc).
 *   - done-cite: DONE/LANDED rows in a Driver: <sid> doc must carry an
 *     anchored path that exists — a done-claim names where it landed
 *     (14-stop-integrity.mdc).
 *
 * `stop_hook_active` → allow (documented loop guard) — but the
 * step-over is recorded: the failures it bypassed are appended to
 * `stop_bypasses` in the session gate-state file, so a bypass is a
 * durable artifact, not a transcript line. Exception: OPEN-TODOS /
 * TODOS-VANISHED hard-block under the flag — still-open tracker work
 * is exempt from the release and cycles the session until each item
 * exits legally.
 * Fail-open on internal errors.
 */

import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join, resolve, sep } from "node:path";
import { execWriteTargets } from "./write-targets.mjs";
import { drainHookEvents } from "./session-tracker.mjs";
import { USER_VERB_RE, disposedOf, DEFERRAL_RE, DEFERRAL_MARK_RE, SCOPE_WORD, GAP_RE, SELFDEFER_RE, MARKER_HEAD_RE, laneOpenRows, NOT_LANE_REASONED_RE, docDriver } from "./deferral-patterns.mjs";
import { fileURLToPath } from "node:url";
import { buildInstrumentManifest, writeSharedManifest, diffInstrumentManifests } from "./instrument-manifest.mjs";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
// Repo-relative forward-slash form of a path — recorded state paths are
// absolute on non-`app/` touches while artifact citations are
// relative; compare normalized (R16-F1: this was called at the coverage
// check but never defined — a ReferenceError failed the whole gate open).
const relPath = (p) => {
  const n = String(p || "").replace(/\\/g, "/");
  const rootN = String(ROOT).replace(/\\/g, "/").replace(/\/+$/, "") + "/";
  return n.startsWith(rootN) ? n.slice(rootN.length) : n.replace(/^\/+/, "");
};
// Shared schema-marker test (E6): every marker site previously used its
// own `includes`/`regex` — substring matches meant a marker quoted in
// prose or inside a code fence could ARM a schema (false-arm) or
// SATISFY a required marker (vacuous-satisfy). A marker counts only at
// line start: optional leading whitespace, `<!--` with optional inner
// spaces, the tag (whitespace-flexible), `-->`. Case-insensitive.
const hasMarker = (text, tag) => {
  const esc = String(tag).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`^\\s*<!--\\s*${esc}\\s*-->`, "im").test(String(text || ""));
};
const STATE_DIR = join(ROOT, ".unlazy", "gate-state");
const EVIDENCE_DIR = join(ROOT, ".unlazy", "gate-evidence");
const ARTIFACT_DIR = join(ROOT, ".unlazy", "design-review");
const SPEC_DIR = join(ROOT, ".unlazy", "design-spec");
const AUDIT_DIR = join(ROOT, ".unlazy", "audit-ledger");

// The only legal dispositions, anywhere the gate checks: BLOCKED: (an
// external wall — a credential, service, or person, never effort, time,
// or "later") and ACCEPTED: (the user re-scoped — the line must carry a
// user verb, not a bare label). QUEUED:/SKIPPED: are not states: an item
// is done or it is open. (User's no-deferral directive, 2026-11-03.)
// USER_VERB_RE + disposedOf + the deferral/coverage patterns moved to
// deferral-patterns.mjs (I2) — one home, corpus-tested; the completion-
// context arm inside disposedOf is the shipped-work false-positive fix.
// `ok` stays the caller's ACCEPTED corroborator (acceptedOk).

// Shared `verify:` re-execution — the audit-ledger and iteration-loop
// checks both re-run whitelisted commands; the whitelist lived in two
// copies once and diverged (FORBID additions landed in one). One home:
// one SAFE list, one flag-ban, one quote-aware splitter, one budget.
// Whitelisted ≠ read-only by itself: find -delete/-exec(dir)/-fls/-fprint,
// sort -o/--output/--compress-program/-T, rg --pre all write or exec.
const VERIFY_SAFE = /^(grep|rg|find|ls|wc|cat|head|tail|sort|uniq|git\s+ls-files|git\s+grep)\b/i;
const VERIFY_FORBID =
  /[;&`$<>]|\|\||\b(rm|del|erase|mv|cp|mkdir|touch|rmdir|curl|wget|python|perl|node|deno|eval|exec|ssh|scp|dd|truncate|sh|dash|zsh|bash|env|xargs|awk|sed|tee|base64|openssl|xxd|install|chmod|chown|ln|mkfifo|mktemp|patch|tar|zip|unzip|gzip|nc|rsync|printf|make)\b/i;
// Per-command write/exec flags — `-o` is legit on grep/ls/git-ls-files
// (over-blocking there forced DECLARED), so flags ban inside the command
// that owns them: find's -delete/-exec*/-fls/-fprint*/-ok*/-printf,
// sort's -o/-T (attached forms included: `-oout` parses as -o out) and
// --output/--compress-program/-T*, rg's --pre/--pre-glob.
const VERIFY_FLAGBAN =
  /\bfind\b[^\n|]*?-(?:delete|exec|execdir|fls|fprint|fprint0|fprintf|ok|okdir|printf)\b|\brg\b[^\n|]*?--pre(?:-glob)?\b/i;
// sort's own ban is case-sensitive — `-t` (field sep) is legit, `-T`
// (tempdir/exec-adjacent) and `-o` (write) are not; shared /i would blur them.
const VERIFY_SORTBAN =
  /\bsort\b[^\n|]*?(?:-\S*[oT]\S*|--(?:output|compress-program|temporary-directory)\S*)/;
// git grep's own ban is case-sensitive too — `-o` (only-matching) is legit,
// `-O<pager>`/`--open-files-in-pager` runs the pager on every match: a
// planted file makes the Stop hook execute `sh <file>` — real code exec
// inside a read-only-looking verify. `-Osh` has no word boundary, so the
// FORBID wordlist can't see it; the flag itself is the ban target.
const VERIFY_GITBAN =
  /\bgit\s+grep\b[^\n|]*?(?:\s-\S*O\S*|--open-files-in-pager)/;
// Negation vocabulary — a clean-word inside a negated claim is not clean
// ("not a pass", "can't ship", "nowhere near clean"). Shared by the
// report-verdict scan and the eyes-verdict consumption check.
// Every stem gets a trailing boundary — the old bare `not`/`misses?`
// stems prefix-matched `nothing`, `notable`, `mission`, `missing` into
// negations (R15-F11: a clean verdict phrased "pass — nothing found"
// read as negated).
const NEG_RE = /\b(not\b|never\b|no\b|isn'?t|aren'?t|wasn'?t|weren'?t|don'?t|didn'?t|can'?t|won'?t|unverified|unreviewed|fails?\s+to|falls?\s+short|short\s+of|lacks?\b|lacking|without|nowhere\s+near|far\s+from|miss(?:es|ed)?\b|does\s+not|do\s+not)/i;
// Verdict/raises tables: a row is a header only when EVERY cell is a
// known column word — the old `\|.*-` test dropped any first row that
// contained a hyphen, and every verdict row ends `AT-BAR`/`BELOW-BAR:`
// so a headerless table silently lost its only data (R15-F2). A row
// carrying a disposition/verdict token can never be a header.
const HEADER_CELL_RE = /^(surface|file|viewport|elements?|persona|verdict|weakest(?:\s+area)?|description|what\s+a?\s*stranger\s+sees|unit|objection|strongest\s+objection|lever|biggest\s+lever|outcome|area|notes?|status|disposition|severity|finding|id|fix|evidence|axis|row|ask|screenshots?|checked|reviewed|scope|result|state|item|token|changes?|reason|defense|confidence|rank|effort|impact|priority|likelihood|estimate|owner|date|when|who|risk|score|count|total|coverage|cost|weight|round|what\s+the\s+best\s+version\s+does\s+that\s+this\s+doesn'?t)$/i;
const isHeaderishRow = (l) => {
  const cs = String(l || "").split("|").map((c) => c.trim()).filter(Boolean);
  return cs.length > 0 && cs.every((c) => HEADER_CELL_RE.test(c));
};
// Flag/Forbid tests run on a DEQUOTED copy: quoted spans are one argument to
// the shell, so `'a|b'` must not hide an exec flag AND `'python'` as a quoted
// search term must not trip the word ban. Pipe-splitting still uses the
// quote-aware original (a quoted | is not a pipeline).
const dequote = (s) => s.replace(/'[^']*'|"[^"]*"/g, '""');
const VERIFY_BUDGET = { left: 12 }; // across BOTH paths — the Stop hook's own ~30s is the real bound
const VERIFY_TIMEOUT = 1500; // a hanging read-only command is a failed verify anyway
let verifyBashOk = true;
function verifySplit(cmd) {
  // Split pipeline segments only on pipes OUTSIDE quotes — a
  // `grep -E "a|b"` pattern is one command, not two segments.
  const segs = [];
  let cur = "", q = null;
  for (const ch of cmd) {
    if (q) { if (ch === q) q = null; cur += ch; }
    else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
    else if (ch === "|") { segs.push(cur); cur = ""; }
    else cur += ch;
  }
  segs.push(cur);
  return segs.map((s) => s.trim()).filter(Boolean);
}
function verifyWhitelisted(cmd) {
  const parts = verifySplit(cmd);
  const dq = dequote(cmd);
  return parts.length > 0 && parts.every((s) => VERIFY_SAFE.test(s)) &&
    !VERIFY_FORBID.test(dq) && !VERIFY_FLAGBAN.test(dq) && !VERIFY_SORTBAN.test(dq) && !VERIFY_GITBAN.test(dq);
}
function runVerify(cmd) {
  if (!verifyBashOk) return { ran: false, err: "bash not on PATH — convert to doc:/DECLARED:" };
  if (VERIFY_BUDGET.left <= 0) return { ran: false, err: "verify exec budget spent (>30s hook bound)" };
  VERIFY_BUDGET.left--;
  const _vt = Date.now();
  try {
    const out = execFileSync("bash", ["-c", cmd], { cwd: ROOT, timeout: VERIFY_TIMEOUT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return { ran: true, out };
  } catch (e) {
    if (/ENOENT/i.test(String(e.message))) { verifyBashOk = false; return { ran: false, err: "bash not on PATH — convert to doc:/DECLARED:" }; }
    // A whitelisted read-only command that exits non-zero but PRINTED is
    // still a ran verify: `grep -c` exits 1 on zero matches with "0" on
    // stdout, and `|| true` is FORBID — without this, honest count cells
    // report as refusals. No stdout = genuine failure.
    if (e.stdout && String(e.stdout).trim()) return { ran: true, out: e.stdout };
    return { ran: false, err: String(e.message).slice(0, 80) };
  } finally {
    TIMING.verify.calls++;
    TIMING.verify.ms += Date.now() - _vt;
  }
}

function readJson(p) {
  try {
    const v = JSON.parse(readFileSync(p, "utf-8"));
    // Only a plain object is usable — `"x"`, `[]`, `5`, `true` are truthy
    // JSON that would slip past missing-state reconstruction and silently
    // disarm every `state.X` read as `undefined`.
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch { return null; }
}
// Write-target extraction over a raw transcript: every file path a tool
// call wrote, from edit/write/notebook_edit `file_path`/`notebook_path`
// AND exec `command` write-targets (redirection, tee, dd of=, curl -o,
// wget -O, in-place editors, PS writers). One home for both consumers —
// missing-state reconstruction and the impl corroboration — because the
// tracker-side copy of these shapes already diverged once.
// Command text carried by exec/write_to_process transcript lines only —
// the evidence-file write that RECORDS a `STOP: BLOCKED — `cmd`` embeds
// the cited command verbatim in its `content`, so a whole-transcript
// substring search self-corroborates a command that never ran (R14-F2).
const _tcCache = new Map(); // F23: memoize — callers pass the same transcriptRaw up to 7× a run
function transcriptCommands(raw) {
  if (_tcCache.has(raw)) return _tcCache.get(raw);
  if (_tcCache.size > 4) _tcCache.clear();
  const cmds = [];
  const s = String(raw || "");
  for (const l of s.split(/\r?\n/)) {
    const tn = l.match(/"(?:name|tool_name)"\s*:\s*"(exec|write_to_process)"/i);
    if (!tn) continue;
    const inputKeys = tn[1].toLowerCase() === "exec" ? "command" : "text_input|bytes_input";
    for (const m of l.matchAll(new RegExp(`"(?:${inputKeys})"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g"))) {
      try { cmds.push(JSON.parse(`"${m[1]}"`)); } catch { /* unparseable fragment */ }
    }
  }
  // ATIF transcripts are one JSON doc — the line walk above finds no
  // `name`/`tool_name` keys. The same fields live at
  // steps[].tool_calls[].function_name + arguments.<key>; without this
  // every ran-corroboration check (STOP: BLOCKED commands, IMPOSSIBLE
  // tried-sets) is blind on ATIF runtimes.
  if (cmds.length === 0 && s.trim()) {
    try {
      const doc = JSON.parse(s);
      for (const st of doc?.steps || []) {
        for (const tc of st?.tool_calls || []) {
          const fn = String(tc?.function_name || tc?.name || "").toLowerCase();
          if (fn !== "exec" && fn !== "write_to_process") continue;
          const args = tc?.arguments || {};
          for (const k of ["command", "text_input", "bytes_input"]) {
            if (typeof args[k] === "string") cmds.push(args[k]);
          }
        }
      }
    } catch { /* not a JSON doc — JSONL corpus stands */ }
  }
  const out = cmds.join("\n");
  _tcCache.set(raw, out);
  return out;
}

// edit/write transcript lines carry their full strings — content-derived
// arms (DDL inside new text, route decorators inside adapters) are
// reconstructible, so a deleted-state session can't shed them (R15
// own-walk: the reconstruction was path-derived only, mirroring the
// tracker's :534 arm but not its :729/:732 content arms).
function* transcriptEditContents(raw) {
  for (const l of String(raw || "").split(/\r?\n/)) {
    const tn = l.match(/"(?:name|tool_name)"\s*:\s*"(edit|write)"/i);
    if (!tn) continue;
    const grab = (key) => {
      const m = l.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      if (!m) return "";
      try { return JSON.parse(`"${m[1]}"`); } catch { return ""; }
    };
    yield {
      filePath: grab("file_path"),
      newContent: tn[1].toLowerCase() === "edit" ? grab("new_string") : grab("content"),
      oldContent: tn[1].toLowerCase() === "edit" ? grab("old_string") : "",
      // The line's own timestamp — reconstruction derives round_seen/
      // impl_log ordering from it (R16-F18); absent on runtimes that
      // don't stamp lines, where callers must tolerate "".
      ts: grab("timestamp") || grab("ts") || grab("created_at") || "",
    };
  }
}

// run_subagent transcript lines carry the launch (title/profile in
// input, agent_id in the response) — a deleted-state session that
// launched a stranger still owes the provenance cross-check the
// recorded launches enable (R15 own-walk: reconstruction skipped the
// launch fields, so state-deletion always degraded eyes provenance to
// self-attestation). Mirrors the tracker's :631 classification.
function* transcriptSubagentLaunches(raw) {
  for (const l of String(raw || "").split(/\r?\n/)) {
    if (!/"(?:name|tool_name)"\s*:\s*"run_subagent"/i.test(l)) continue;
    const grab = (key) => {
      const m = l.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      if (!m) return "";
      try { return JSON.parse(`"${m[1]}"`); } catch { return ""; }
    };
    const title = (grab("title") || "run_subagent").slice(0, 80);
    const profile = grab("profile");
    const task = grab("task");
    const idm = l.match(/"(?:agent_id|agentId|id)"\s*:\s*"([A-Za-z0-9_-]+)"/);
    yield { title, profile, task, id: idm ? idm[1].slice(0, 80) : null };
  }
}

function transcriptWritePaths(raw) {
  const paths = new Set();
  const addPath = (p) => { if (p) paths.add(String(p).replace(/^["']+|["']+$/g, "").replace(/\\\\/g, "/").replace(/\\/g, "/")); };
  for (const l of String(raw || "").split(/\r?\n/)) {
    const tn = l.match(/"(?:name|tool_name)"\s*:\s*"(edit|write|exec|notebook_edit|run_subagent|write_to_process)"/i);
    if (!tn) continue;
    const tname = tn[1].toLowerCase();
    // Scans are scoped by tool — a write's `content` (or a subagent
    // brief's `task`) can carry `"command": "rm x"` text that fabricated
    // exec-write hits when every scan ran on every line (R13-F13).
    if (tname === "edit" || tname === "write" || tname === "notebook_edit") {
      for (const m of l.matchAll(/"(?:file_path|notebook_path)"\s*:\s*"([^"]+)"/g)) addPath(m[1]);
      continue;
    }
    if (tname === "run_subagent") continue;
    const inputKeys = tname === "exec" ? "command" : "text_input|bytes_input";
    // `command` carries exec input; `text_input`/`bytes_input` carry
    // write_to_process stdin — a second write channel (R13-F1: REPL-fed
    // `open('x.py','w')` was invisible to transcript corroboration).
    for (const m of l.matchAll(new RegExp(`"(?:${inputKeys})"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g"))) {
      let cmd = ""; try { cmd = JSON.parse(`"${m[1]}"`); } catch { continue; }
      // The full write-shape catalog lives in write-targets.mjs — shared
      // with the tracker's arm scan (R12-F7: this copy had drifted to a
      // third of the shapes, so cp/git-merge/patch writes reconstructed
      // to nothing and the state-deleted escape stayed open).
      const { targets, markers } = execWriteTargets(cmd, ROOT);
      for (const t of targets) addPath(t);
      for (const mk of markers) paths.add(mk);
    }
  }
  return paths;
}
// Fenced code blocks (``` and ~~~) are stripped before matching: a
// schema example containing `ENDED: clean-walk` or `## Round 1`
// inside fences would otherwise satisfy (or counterfeit) the real
// declarations — and the tracker stamps on the same stripped text
// so the timelines agree. An unclosed fence swallows the tail —
// strip it to EOF on both sides, never let it hide declarations.
function fenceStrip(s) {
  // Line-anchored fences only — inline ```` ``` ````/`~~~` mentions
  // inside a table cell can't pair up and eat real content. Any
  // surviving line-start fence after pair-stripping is unclosed:
  // its tail is hidden content, so cut it there.
  const stripped = String(s || "").replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\r?\n[\s\S]*?^[ \t]*\1[ \t]*\r?$/gm, "");
  const openM = stripped.match(/^[ \t]*(`{3,}|~{3,})/m);
  return openM ? stripped.slice(0, openM.index) : stripped;
}
// A throw on an agent-shaped path (EISDIR on a planted directory, unreadable
// file, multi-GB artifact) must not escape as exit(1)=allow — unreadable is
// missing-content, which the relevant check already flags (fail-closed).
// The 8MB cap also turns a disk bomb into a truncation, not a crash.
function readText(p) {
  try {
    const s = readFileSync(p, "utf-8");
    return s.length > 8_000_000 ? s.slice(0, 8_000_000) : s;
  } catch { return null; }
}
// Impl-path classification, shared by the transcript corroboration and the
// missing-state reconstruction — one list, one home (they diverged once).
const IMPL_RE_G = /\.(?:js|mjs|cjs|jsx|ts|tsx|css|html|j2|py|pyi|sql|sh|ps1|bat|ya?ml|toml|ini|cfg|conf|json|mdc|rs|go|rb|php|java|cs|c|cc|cpp|h|hpp|vue|svelte)$/i;
const IMPL_EXCL_G = /\.unlazy\/(gate-state|coverage)\/|docs\//i;
// execWriteTargets markers name writes no path token can describe — the
// tracker pushes the same strings into impl_touched, so transcript and
// state corroborate verbatim (R12-F7).
const WRITE_MARKER_RE = /^(?:git-write|patch|extract|delegated|delete|dir-op):/i;
// Per-arm timing ledger — dumped to `.unlazy/gate-state/<sid>-timing.json`
// on every exit path so a slow firing names its own hot check instead of
// leaving a bare timeout (M2: the >30s hollow-cadet firing left no
// evidence of WHERE the time went; this instrument is the answer to that).
const GATE_T0 = Date.now();
const TIMING = { marks: [], verify: { calls: 0, ms: 0 } };
let GATE_SID = "unknown";
// Rolling per-run telemetry for the gate-telemetry audit (03-periodic-
// audits): which checks armed, which failed, escapes/bypasses per run —
// the record a sunset/recalibration review consumes. main() populates
// TELEMETRY_CTX once failures are final; dumpTiming appends one line per
// exit to _telemetry.jsonl.
const TELEMETRY_CTX = {};
// tick(name) stamps "reached <name>" — an arm's cost is the delta between
// its own mark and the next mark; the consumer diffs consecutive stamps.
function tick(name) {
  TIMING.marks.push([name, Date.now()]);
}
function dumpTiming(exitKind) {
  try {
    TIMING.total_ms = Date.now() - GATE_T0;
    TIMING.exit = exitKind;
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(join(STATE_DIR, `${GATE_SID}-timing.json`), JSON.stringify(TIMING, null, 1));
    const tPath = join(STATE_DIR, "_telemetry.jsonl");
    const rec = {
      ts: new Date().toISOString(), sid: GATE_SID, exit: exitKind,
      total_ms: TIMING.total_ms,
      armed: TELEMETRY_CTX.armed || [], failed: TELEMETRY_CTX.failed || [],
      bypasses_total: TELEMETRY_CTX.bypasses || 0, escapes_total: TELEMETRY_CTX.escapes || 0,
      meta_cost: TELEMETRY_CTX.meta_cost || null,
    };
    let prior = "";
    try { prior = readFileSync(tPath, "utf-8"); } catch { /* new file */ }
    // Bound the rollup: past ~1MB keep the newest 500 lines.
    if (prior.length > 1_000_000) prior = prior.split(/\r?\n/).filter(Boolean).slice(-500).join("\n") + "\n";
    writeFileSync(tPath, prior + JSON.stringify(rec) + "\n");
    // Cross-session bypass visibility (gs-v2 autopsy): a session that
    // exits pass-bypass with failed checks leaves obligations nobody
    // saw — sedate-fine shipped v2 with 17 flags and the user learned
    // of them only by asking. Surface the most recent prior-session
    // bypass on this session's first gate run.
    const seenPath = join(STATE_DIR, `_cross-noticed-${GATE_SID}`);
    if (!existsSync(seenPath)) {
      const recs = prior.split(/\r?\n/).filter(Boolean).slice(-60)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const prev = [...recs].reverse().find((r) => r.sid !== GATE_SID && r.exit === "pass-bypass" && (r.failed || []).length);
      if (prev) {
        writeFileSync(seenPath, `${prev.sid}@${prev.ts}\n`);
        console.error(`[stop-gate] note: prior session ${prev.sid} ended via stop-bypass with ${prev.failed.length} failed check(s) (${prev.failed.slice(0, 6).join(", ")}${prev.failed.length > 6 ? ` +${prev.failed.length - 6} more` : ""}) — the obligations were bypassed, not discharged; record is in .unlazy/gate-state/_telemetry.jsonl and they remain that session's open ledger.`);
      }
    }
  } catch { /* timing/telemetry is best-effort, never a gate failure */ }
}
// The no-deferral contract rides every block reason and every pass — the
// reminder lands at the exact moment a stop is attempted, not in a rules
// file the turn may not have re-read. (00-operating §2e — the economics
// are settled: the work stays owed, the user catches it, it returns
// multiplied.)
const NO_DEFERRAL_CONTRACT =
  "NO-DEFERRAL: deferring work is strictly prohibited — no residuals, parked items, follow-ups, " +
  "'later' labels, or unlisted open work. Every item exits only: done-with-evidence | " +
  "BLOCKED: <real external wall, declared> | ACCEPTED: <the user's own words>. " +
  "Deferral is the expensive option — the work stays owed, the user catches it, it returns multiplied.";
function block(reason) {
  dumpTiming("block");
  const full = reason + " — " + NO_DEFERRAL_CONTRACT;
  process.stdout.write(JSON.stringify({ decision: "block", reason: full }));
  // Stderr mirror: the `decision:block` reason reaches the agent only if
  // the client renders the JSON contract — a prior session's
  // "Standing by" loop showed a client surfacing "hook blocked" without
  // the body. Stderr notes provably display (the `[stop-gate] note:`
  // channel), so the obligation list rides the visible channel too —
  // capped, and pointed at the state copy for the full text.
  try {
    const lbPath = join(STATE_DIR, `${GATE_SID}-last-block.txt`);
    writeFileSync(lbPath, `[${new Date().toISOString()}] ${full}\n`);
    const head = full.split("\n").slice(0, 30).join("\n");
    console.error(`[stop-gate] BLOCKED — reason (also on the JSON channel):\n${head}${full.length > head.length ? `\n… ${full.length - head.length} more chars in ${lbPath}` : ""}`);
  } catch { /* the JSON channel already carries the reason */ }
  process.exit(2);
}

function main() {
  let input;
  try { input = JSON.parse(readFileSync(0, "utf-8")); }
  catch { process.exit(0); }
  if (!input || typeof input !== "object" || Array.isArray(input)) process.exit(0);

  // Flush queued hook events before any state read — a PostToolUse killed
  // by the RPC timeout (or a drainer deferred by lock contention) leaves
  // its event in _queue.jsonl, and the gate is the last invocation of the
  // turn. Draining here is what makes the queue a durability guarantee
  // instead of a buffer that drains next turn.
  try { drainHookEvents(); } catch { /* a drain failure must not block the gate */ }

  // `stop_hook_active` no longer short-circuits the computation: the loop
  // guard still lets the second attempt through (safety valve), but the
  // failures it stepped over are recorded into session state as
  // `stop_bypasses` — a bypass is a file artifact now, not a transcript
  // line. (14-stop-integrity; the pass-through itself stays deliberate.)
  const sid = input.session_id || "unknown";
  GATE_SID = String(sid).replace(/[^\w-]/g, "");
  // `state` may be absent (deleted/first run) — don't exit yet: the
  // transcript can still corroborate work the state file can't un-say.
  let state = readJson(join(STATE_DIR, `${sid}.json`));
  // A state record carrying ONLY this gate's own bootstrap keys is the
  // artifact of a prior firing — no tracker arms — and must be treated as
  // missing so transcript reconstruction fires again (the bootstrap write
  // used to make reconstruction a one-shot: second pass saw `state` exist
  // and every arm silently disarmed).
  const BOOTSTRAP_ONLY = new Set(["hook_input_keys", "epoch", "loop_grandfathered"]);
  if (state && Object.keys(state).every((k) => BOOTSTRAP_ONLY.has(k))) state = null;
  // A `Driver: <other>` corroboration — the named session must have a
  // real tracker-shaped record (≥1 KNOWN arm field), not a planted
  // `{"x":1}` — the old "any non-bootstrap key" test accepted any
  // arbitrary object (R15-F15: `Driver: ghost` + planted ghost.json
  // disarmed the drive checks entirely).
  // The whitelist mirrors the tracker's STATE_DEFAULTS + gate-stamped
  // fields — duplicated by necessity (the two scripts don't share a
  // module), so drift here means a planted key could corroborate.
  const KNOWN_STATE_KEYS = new Set([
    "ui_touched", "impl_touched", "ddl_armed", "routes_armed", "tests_touched",
    "migrations_touched", "sitemap_touched", "test_ran",
    "plan_docs", "audit_armed", "audit_ledger_written",
    "rejections", "repro_armed", "repro_rounds_armed", "blind_debt",
    "ui_first_edit_at", "design_spec_at",
    "critique_agent_launched", "critique_agents", "subagent_launches",
    "ui_edit_count", "artifact_writes", "artifact_first_write_at",
    "todos_open", "todos_open_items", "files_edited",
    "impl_log", "round_seen", "baseline_rounds", "round_rows", "round_rows_at",
    "exit_review_seen", "stale_nag_at", "fr_nag_done",
    "constraint_marks", "constraint_lifted", "compression_nag_done",
    "analysis_doc_written", "analysis_nag_done", "analysis_asked",
    "analysis_method_hist", "checks_armed", "escapes", "spec_depth", "loop_depth",
    "marker_docs", "plan_sig_docs",
    "completed_during_session", "delegated_impl", "ended_seen", "ended_sig",
    "exit_review_sig", "last_impl_at",
    "user_pause_signals", "todos_snapshot", "updated",
  ]);
  // Keys every firing stamps regardless of work — `updated`/`epoch`/
  // `hook_input_keys`/`loop_grandfathered` carry no provenance. One
  // non-universal key is still one cheap plant (R16-F13: `{"updated":
  // "x"}` corroborated any `Driver: ghost`); a real driven session has
  // several tracker-written fields, so corroboration needs ≥2.
  const UNIVERSAL_KEYS = new Set([...BOOTSTRAP_ONLY, "updated"]);
  const foreignDriverState = (name) => {
    const f = readJson(join(STATE_DIR, `${String(name).replace(/[^\w-]/g, "")}.json`));
    if (!f || typeof f !== "object") return false;
    const provKeys = Object.keys(f).filter((k) => KNOWN_STATE_KEYS.has(k) && !UNIVERSAL_KEYS.has(k));
    return provKeys.length >= 2;
  };
  // Record the hook's real input surface every firing — which fields the
  // runtime actually sends decides what the gate can verify (transcript_path
  // unlocks USER-GATE/BLOCKED transcript checks; instrumented rather than
  // assumed). Persists even when no prior state exists.
  const inputKeys = Object.keys(input).sort();
  try {
    const rec = state || {};
    rec.hook_input_keys = inputKeys;
    // A file this write creates is born under the machinery — stamp `epoch`
    // so session-tracker doesn't read it as pre-machinery (grandfathered).
    // An existing file keeps whatever epoch it has (pre-machinery files
    // stay epoch-less so the tracker can detect them as grandfathered).
    if (state == null) { rec.epoch = 2; rec.loop_grandfathered = false; }
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(join(STATE_DIR, `${sid}.json`), JSON.stringify(rec, null, 2));
  } catch { /* instrumentation is best-effort */ }
  tick("state-ready");
  // Assistant-output access — the runtime supplies last_assistant_message
  // (verified in hook_input_keys), which makes USER-GATE's "I asked the
  // question" claim checkable: the message the turn ends on must actually
  // contain it. A transcript_path variant is kept for runtimes that send it.
  let transcriptRaw = null;
  let transcriptTruncNote = "";
  if (typeof input.transcript_path === "string") {
    // Bounded TAIL read — an unbounded readFileSync on a giant artifact
    // (the 43GB sessions.db class) hangs or OOMs the hook inside its own
    // timeout, and an unreadable file silently switched every
    // transcript corroboration off (R14-F1). The tail holds the recent
    // calls — the part STOP's checks actually inspect. A truncated read
    // is flagged loud, never silent.
    try {
      const tsize = statSync(input.transcript_path).size;
      if (tsize <= 8_000_000) {
        transcriptRaw = readFileSync(input.transcript_path, "utf-8");
      } else {
        const fd = openSync(input.transcript_path, "r");
        try {
          const buf = Buffer.alloc(8_000_000);
          const n = readSync(fd, buf, 0, 8_000_000, tsize - 8_000_000);
          transcriptRaw = buf.slice(0, n).toString("utf-8");
        } finally { closeSync(fd); }
        transcriptTruncNote = `transcript truncated to last 8MB of ${(tsize / 1e6).toFixed(0)}MB — corroboration reads the recent calls only`;
      }
    } catch { transcriptRaw = null; }
  }
  tick("transcript-read");
  if (state && !transcriptRaw) {
    // B21: a transcript-less runtime skips every corroborated check —
    // silently before this note. Degradation is legal; silence isn't.
    console.error(
      `[stop-gate] note: TRANSCRIPT-ABSENT: state file exists but no transcript loaded — ` +
      `corroboration checks (ran-commands, user-verb signals, reconstruction) run degraded this stop; ` +
      `their outcomes are asserted, not proven.`
    );
  }
  if (!state) {
    // A missing state file normally means nothing armed — but tool calls
    // visible in the transcript mean the file was lost or removed
    // mid-flight; proceed on the transcript record rather than exit clean.
    // Reconstruct the ARMS too, not just the impl flag — a deleted state
    // must not silently disarm the ui/ddl/plan-doc checks (fail-closed
    // reconstruction; what the transcript can't show stays disarmed).
    if (!transcriptRaw) { dumpTiming("pass-no-state"); process.exit(0); }
    const paths = transcriptWritePaths(transcriptRaw);
    const implish = [...paths].filter((p) => (IMPL_RE_G.test(p) && !IMPL_EXCL_G.test(p)) || WRITE_MARKER_RE.test(p));
    // Ledger-doc classification mirrors the tracker's LEDGER_DOC_RE minus
    // LEDGER_EXCL_RE — gate-internal .unlazy docs (eyes artifacts, this
    // artifact, audit ledger, design docs) are machinery, not plan docs,
    // or every session would arm OPEN-LEDGER on its own process files.
    const docish = [...paths].filter((p) =>
      /(docs\/(Active Work|Plans)\/[^/]+\.md|docs\/[^/]+\.md|\.unlazy\/.*\.md)$/i.test(p) &&
      !/\.unlazy\/(design-review|design-spec|gate-evidence|gate-state|audit-ledger|iteration|eyes)\//i.test(p));
    // Write-capable subagent launches delegate implementation that may
    // attribute to the subagent's own session — the tracker arms the
    // coordinator's loop on them; the reconstruction must too, or a
    // deleted state sheds the delegation arm (same mirror, :675).
    const launches = [...transcriptSubagentLaunches(transcriptRaw)];
    const delegated = launches
      .filter((x) => !/explore/i.test(x.profile))
      .map((x) => `delegated:${x.title}`);
    if (!implish.length && !docish.length && !delegated.length) { dumpTiming("pass-nothing-armed"); process.exit(0); }
    const launchList = launches.flatMap((x) => (x.id ? [x.title, x.id] : [x.title]));
    const CODE_INTENT_R = /\b(?:fix|implement|build|patch|refactor|migrate|port)\b/i;
    const critique = launches.filter((x) => {
      const brief = `${x.title} ${x.task}`;
      return (/critiqu|verdict|judg|fresh|eyes|screenshot|taste|audit|stranger/i.test(brief) && !CODE_INTENT_R.test(brief)) ||
        (/review|design/i.test(brief) && /independent|blind|stranger|fresh|cold|\bpass\b/i.test(brief) && !CODE_INTENT_R.test(brief)) ||
        (/independent|blind|cold/i.test(brief) && /walk|look|check|read|verdict/i.test(brief) && !CODE_INTENT_R.test(brief));
    });
    // Round/impl timeline reconstruction (R16-F18): a deleted state
    // deadlocked every round as "never observed" while the artifact
    // writes that stamped it sat visible in the transcript. Mirror
    // observeIterationArtifact's substance test on each artifact-write
    // delta — first-seen = the delta that first lands the round's
    // substantive content; a headless delta with traversal rows
    // continues the round still being written. impl_log = impl-path
    // write timestamps; ended/exit-review stamps come from markers in
    // deltas. Lines without timestamps stamp "" — falsy, so a round
    // provably written but unprovably timed stays 'unstamped' (the
    // transcript can't show what it doesn't carry — bounded, fail-
    // closed on the same side the live tracker fails on).
    const roundTimeline = (() => {
      const tl = { round_seen: {}, round_rows: {}, round_rows_at: {}, impl_log: [], last_impl_at: null, ended_seen: null, exit_review_seen: null };
      const rootN = String(ROOT).replace(/\\/g, "/").replace(/\/+$/, "") + "/";
      let lastRound = null;
      for (const e of transcriptEditContents(transcriptRaw)) {
        const fp = String(e.filePath || "").replace(/\\/g, "/");
        const stamp = e.ts || "";
        const isArtifact = /(^|\/)\.unlazy\/iteration\/[^/]+\.md$/i.test(fp);
        if (isArtifact) {
          const nf = fenceStrip(e.newContent || "");
          const heads = [...nf.matchAll(/^##\s*Round\s+(\d+)(?!\.\d)/gim)];
          for (let i = 0; i < heads.length; i++) {
            const n = heads[i][1];
            lastRound = n;
            const body = nf.slice(heads[i].index, i + 1 < heads.length ? heads[i + 1].index : undefined);
            const substance = (/^#{2,6}\s*Traversal\b/im.test(body) && /^\s*\|\s*L\d{1,2}\b/im.test(body)) ||
              (/^#{2,6}\s*Findings\b/im.test(body) && /^\s*\|\s*(?:[A-Z]{1,3}\d*-?)?F\d+\b/im.test(body));
            if (substance && !tl.round_seen[n]) tl.round_seen[n] = stamp;
            const lrows = (body.match(/^\s*\|\s*L\d{1,2}\b/gim) || []).length;
            if (lrows) { tl.round_rows[n] = (tl.round_rows[n] || 0) + lrows; if (stamp) tl.round_rows_at[n] = stamp; }
          }
          if (!heads.length && lastRound && /^\s*\|\s*L\d{1,2}\b/im.test(nf)) {
            const lrows = (nf.match(/^\s*\|\s*L\d{1,2}\b/gim) || []).length;
            tl.round_rows[lastRound] = (tl.round_rows[lastRound] || 0) + lrows;
            if (!tl.round_seen[lastRound]) tl.round_seen[lastRound] = stamp;
            if (stamp) tl.round_rows_at[lastRound] = stamp;
          }
          if (/^##\s*Exit\s+review\b/im.test(nf) && !tl.exit_review_seen) tl.exit_review_seen = stamp;
          if (/\bENDED\s*:/.test(nf) && !tl.ended_seen) tl.ended_seen = stamp;
          continue;
        }
        const fpAbs = /^([a-zA-Z]:[\\/]|\/|~[\\/])/.test(fp) ? fp : (rootN + fp.replace(/^\/+/, ""));
        const rel = fpAbs.startsWith(rootN) ? fpAbs.slice(rootN.length) : fp;
        if ((IMPL_RE_G.test(rel) && !IMPL_EXCL_G.test(rel)) || WRITE_MARKER_RE.test(rel)) {
          if (stamp) { tl.impl_log.push(stamp); tl.last_impl_at = stamp; }
        }
      }
      return tl;
    })();
    state = {
      reconstructed_from_transcript: true,
      impl_touched: [...implish, ...delegated],
      // Mirrors the tracker's render arms ((UI_RE && SRC_RE) | RENDER_RE |
      // UNLAZY_RENDER_RE) minus GENERATED_RE — a session whose UI work was
      // entirely .unlazy mockups reconstructed to ui_touched:[] and the
      // design gates silently disarmed (R12-F17).
      ui_touched: implish.filter((p) =>
        (/app\/(ui|ui_admin)\/.*\.(js|jsx|css|html|j2|ts|tsx|scss|less|vue|svelte)$/i.test(p) ||
         /\.(html|j2)$/i.test(p) ||
         /(\.unlazy\/.+\.(?:css|html|j2)$|\.unlazy\/.+(?:build|render|compose|matrix|inject)[^/]*\.mjs$)/i.test(p)) &&
        !/\.min\.|\.bundle\.js$|\.map$|\.br$|\.gz$|\.zst$|sri-manifest|feature-manifest\.js$|preload-manifest|\/chunk-/i.test(p)),
      plan_docs: docish,
      // Path-derived arms the transcript CAN show — plus the
      // content-derived ones: the tracker arms ddl from DDL_RE inside
      // the new text (:729) and routes from a route decorator inside an
      // adapters file (:732); both contents are in the transcript, so a
      // deleted state can't shed them (R15 own-walk).
      ddl_armed: [...new Set([
        ...implish.filter((p) => /\.sql$/i.test(p) || /migrations\/versions\//i.test(p)),
        ...[...transcriptEditContents(transcriptRaw)]
          .filter((e) => (e.filePath.includes("app/") || /^(?:[A-Za-z]:)?[\\/]/.test(e.filePath)) &&
            /\b(CREATE\s+TABLE|ALTER\s+TABLE|ADD\s+COLUMN|DROP\s+COLUMN|CREATE\s+INDEX|sa\.Column)\b/i.test(e.newContent) &&
            !/app\/migrations\/versions\/.*\.py$/i.test(e.filePath) && !/\.mdc?$/i.test(e.filePath))
          .map((e) => e.filePath),
      ])],
      routes_armed: [...new Set([
        ...implish.filter((p) => /app\/[^\\/]+\/.*\/adapters\/http\/.*\.py$/i.test(p)),
        ...[...transcriptEditContents(transcriptRaw)]
          .filter((e) => /app\/[^\\/]+\/.*\/adapters\/http\/.*\.py$/i.test(e.filePath) &&
            (/(@\w+\.route|add_route|\.route)\s*\(/.test(e.newContent) || /(@\w+\.route|add_route|\.route)\s*\(/.test(e.oldContent)))
          .map((e) => e.filePath),
      ])],
      tests_touched: implish.filter((p) => /app\/tests\/.*\.py$|\.test\.[jt]sx?$|\btest_[^\\/]*\.py$|.*_test\.py$/i.test(p)),
      migrations_touched: implish.filter((p) => /app\/migrations\/versions\/.*\.py$/i.test(p)),
      // Analysis-doc shapes mirror the tracker's ANALYSIS_DOC_RE — a
      // reconstructed session that wrote findings/analysis docs owes the
      // ledger the same as a live one (R14-F12: only audit-ledger/ armed).
      // The tracker excludes the ledger file itself (AUDIT_LEDGER_RE —
      // writing the ledger can't arm its own requirement); mirror that
      // exactly — an analysis-named file inside audit-ledger/ must not
      // over-arm the reconstruction (R15 own-walk parity).
      audit_armed: [...paths].filter((p) =>
        /(periodic[-_][^/]*|[^/]*(?:^|[-_/])(?:findings|analysis|audit|deep[-_]?dive|review|notes)[^/]*|GATES-[^/]*(?:analysis|audit|perf|findings)[^/]*)\.md$/i.test(p) &&
        !/\.unlazy\/audit-ledger\/[^/]+\.md$/i.test(p)),
      hook_input_keys: inputKeys,
      subagent_launches: launchList,
      delegated_impl: delegated.map((d) => d.slice(10)),
      critique_agent_launched: critique.length > 0,
      critique_agents: critique.flatMap((x) => (x.id ? [x.title, x.id] : [x.title])),
      // R16-F18 timeline fields — reconstructed from transcript-visible
      // artifact writes; the interleave/staleness checks read the same
      // fields the tracker stamps live.
      round_seen: roundTimeline.round_seen,
      round_rows: roundTimeline.round_rows,
      round_rows_at: roundTimeline.round_rows_at,
      impl_log: roundTimeline.impl_log,
      last_impl_at: roundTimeline.last_impl_at,
      ended_seen: roundTimeline.ended_seen,
      exit_review_seen: roundTimeline.exit_review_seen,
      epoch: 2,
      loop_grandfathered: false,
    };
    // Persist it — the next firing must see the reconstructed arms, not a
    // keys-only bootstrap record that skips reconstruction entirely.
    try {
      mkdirSync(STATE_DIR, { recursive: true });
      writeFileSync(join(STATE_DIR, `${sid}.json`), JSON.stringify(state, null, 2));
    } catch { /* persistence best-effort; this firing is still reconstructed */ }
    tick("state-recon");
  }
  const assistantTexts = [];
  const userTexts = [];
  if (transcriptRaw) {
    for (const l of transcriptRaw.split(/\r?\n/)) {
      if (!l.trim()) continue;
      let m; try { m = JSON.parse(l); } catch { continue; }
      const role = m?.role || m?.message?.role || m?.type;
      const content = m?.content ?? m?.message?.content;
      const texts = [];
      for (const c of Array.isArray(content) ? content : [content]) {
        // tool_result items are agent output wearing a user role — a
        // mixed [text + tool_result] message fed the assistant's own exec
        // output into userTexts, corroborating a self-invented redirect
        // target (R12-F15). Filter the item, not just the message.
        if (c && typeof c === "object" && c.type === "tool_result") continue;
        if (typeof c === "string") texts.push(c);
        else if (c && typeof c.text === "string") texts.push(c.text);
      }
      if (role === "assistant") assistantTexts.push(...texts);
      // user-role messages wrap tool RESULTS in common formats — a
      // tool_result block is agent output wearing a user role, not a
      // user's words (redirect/STOP corroboration must not read it).
      else if (role === "user" && m?.type !== "tool_result") userTexts.push(...texts);
    }
  }
  if (typeof input.last_assistant_message === "string" && input.last_assistant_message.trim()) {
    assistantTexts.push(input.last_assistant_message);
  }
  tick("transcript-msgs");

  const evidencePath = join(EVIDENCE_DIR, `${sid}.md`);
  // I4: `_`-prefixed basenames are scratch/fixtures by convention — strip
  // them from the doc-arming arrays so synthetic docs can't arm real
  // MISSING-DOC / PLAN-DELTA / corroboration obligations (or survive as
  // armed paths after deletion). The tracker guards at write-time; this
  // is the consumer-side floor for states that already recorded them.
  for (const k of ["plan_docs", "marker_docs", "audit_armed"]) {
    if (Array.isArray(state[k])) state[k] = state[k].filter((p) => !/^_/.test(String(p).split(/[\\/]/).pop() || ""));
  }

  const evidenceRel = `.unlazy/gate-evidence/${sid}.md`;
  const evidence = (existsSync(evidencePath) && readText(evidencePath)) || "";
  tick("evidence-read");

  // Work-slug alias (gs-v2 autopsy): artifacts naturally get authored
  // under a work-unit name — `.unlazy/design-spec/gamersocial-v2.md`
  // rather than `sedate-fine.md` — and the sid-slugged path then
  // reports a real file as absent. A same-dir file declaring
  // `OWNS: <sid>` or `session: <sid>` in its head satisfies the
  // sid path. Returns the rel path to use (the sid default when
  // nothing resolves, so failure messages stay actionable).
  const sidReEsc = sid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const artifactFor = (rel) => {
    if (existsSync(join(ROOT, rel))) return rel;
    try {
      const dir = dirname(join(ROOT, rel));
      for (const f of readdirSync(dir)) {
        if (f.startsWith(`${sid}`) || !/\.(md|json)$/i.test(f)) continue;
        const head = readFileSync(join(dir, f), "utf-8").slice(0, 2048);
        if (new RegExp(`(?:OWNS|session)\\s*:\\s*[^\\n]*\\b${sidReEsc}\\b`, "i").test(head))
          return `${dirname(rel)}/${f}`;
      }
    } catch { /* no alias */ }
    return rel;
  };

  // State-field type discipline (F18): the tracker writes arrays/objects —
  // anything else is corruption or tampering. `impl_touched: {}` crashing
  // a spread or `impl_log: "x"` silently mis-arming are both worse than a
  // loud flag: coerce to the empty value AND record the anomaly so the
  // malformed field is visible rather than silently excused.
  const stateAnomalies = [];
  // A truncated transcript is a capability statement, not corruption —
  // routing it through stateAnomalies would hard-block every session
  // whose transcript crossed 8MB with no remedy (the transcript only
  // grows). stderr makes it visible on block AND pass paths alike.
  if (transcriptTruncNote) console.error(`stop-gate note: ${transcriptTruncNote}`);
  for (const [k, want] of [
    ["impl_touched", "array"], ["ui_touched", "array"], ["plan_docs", "array"],
    ["audit_armed", "array"], ["impl_log", "array"], ["baseline_rounds", "array"],
    ["critique_agents", "array"], ["subagent_launches", "array"], ["user_pause_signals", "array"],
    ["todos_open_items", "array"], ["blind_debt", "array"], ["ddl_armed", "array"],
    ["routes_armed", "array"], ["tests_touched", "array"], ["migrations_touched", "array"],
    ["repro_armed", "array"], ["stop_bypasses", "array"], ["delegated_impl", "array"],
    ["rejections", "array"], ["completed_during_session", "array"],
    ["todos_vanished", "array"], ["instrument_output_writes", "array"],
    ["round_seen", "object"], ["round_rows_at", "object"], ["round_rows", "object"],
    // Scalars too — a truthy STRING forges a gate boolean (`test_ran:"x"`
    // passed TESTS-RUN silently, R13-F2) and a stringy number NaN-disarms
    // its count check with no anomaly. Fail closed AND keep it loud.
    ["sitemap_touched", "boolean"], ["test_ran", "boolean"], ["audit_ledger_written", "boolean"],
    ["critique_agent_launched", "boolean"], ["analysis_doc_written", "boolean"],
    ["analysis_nag_done", "boolean"], ["loop_grandfathered", "boolean"],
    ["todos_open", "number"], ["files_edited", "number"], ["ui_edit_count", "number"],
    ["artifact_writes", "number"], ["repro_rounds_armed", "number"],
    // `analysis_asked` is a flag-record, not a collection: a truthy wrong
    // type forges the arm, and deleting it would DISARM the check it
    // feeds (if-arm at :2558) — fail-closed means the forged ask is
    // treated as asked (R15 own-walk: delete-coerce re-opened the hole).
    ["analysis_asked", "flag-object"],
  ]) {
    const v = state[k];
    // `false` is the legitimate empty value for a flag-object field — the
    // tracker writes analysis_asked only when an ask fires, so `false` is
    // "not asked", not a forged record. Coercing it into a truthy
    // {excerpt:"<forged:boolean>"} both flags noise AND arms the check it
    // guards — a false-positive double failure. Truthy wrong types still
    // flag closed.
    if (v == null || (want === "flag-object" && v === false)) continue;
    const ok = want === "array" ? Array.isArray(v)
      : want === "object" || want === "flag-object" ? (typeof v === "object" && !Array.isArray(v))
      : want === "boolean" ? typeof v === "boolean"
      : want === "number" ? (typeof v === "number" && Number.isFinite(v))
      : true;
    if (!ok) {
      stateAnomalies.push(`${k}=${JSON.stringify(v).slice(0, 30)}`);
      state[k] = want === "array" ? [] : want === "object" ? {}
        : want === "flag-object" ? { ts: null, excerpt: `<forged:${Array.isArray(v) ? "array" : typeof v}>` }
        : want === "boolean" ? false : 0;
    }
  }
  // Object fields' VALUES — `round_seen: {"6":"0"}` survives the
  // container check and beats the lexical interleave compare (every ISO
  // stamp is > "0" and < "z", so the gap test passes with no impl at
  // all, R13-F3). Timestamps must parse; row counts must be numbers.
  for (const k of ["round_seen", "round_rows_at"]) {
    const o = state[k];
    if (!o || typeof o !== "object" || Array.isArray(o)) continue;
    const bad = Object.entries(o).filter(([, v]) => typeof v !== "string" || !Number.isFinite(Date.parse(v)));
    if (bad.length) {
      stateAnomalies.push(`${k} non-timestamp ×${bad.length}`);
      for (const [kk] of bad) delete o[kk];
    }
  }
  {
    const o = state.round_rows;
    if (o && typeof o === "object" && !Array.isArray(o)) {
      const bad = Object.entries(o).filter(([, v]) => typeof v !== "number" || !Number.isFinite(v));
      if (bad.length) {
        stateAnomalies.push(`round_rows non-number ×${bad.length}`);
        for (const [kk] of bad) delete o[kk];
      }
    }
  }
  // Nullable timestamp scalars — non-string/non-null shapes get the
  // same coerce-and-flag (NaN-sorted strings otherwise silently beat
  // ordering checks at their use sites).
  for (const k of ["ui_first_edit_at", "design_spec_at", "ended_seen", "exit_review_seen",
    "stale_nag_at", "artifact_first_write_at", "last_impl_at"]) {
    const v = state[k];
    if (v != null && typeof v !== "string") {
      stateAnomalies.push(`${k} non-string-timestamp`);
      state[k] = null;
    }
  }
  // Element types too — a state file is agent-writable, and a non-string
  // element inside a nominally-array field crashes string-method call
  // sites (agents.map(a=>a.slice(0,30)) was the concrete instance) or
  // mis-compares (impl_log timestamps). Coerce silently-wrong elements
  // out and flag — tampering stays visible, it doesn't also crash us.
  for (const k of ["critique_agents", "subagent_launches", "impl_log", "impl_touched", "ui_touched", "plan_docs", "delegated_impl",
    "audit_armed", "todos_open_items", "blind_debt", "ddl_armed",
    "routes_armed", "tests_touched", "migrations_touched", "repro_armed",
    "todos_vanished"]) {
    if (!Array.isArray(state[k])) continue;
    const bad = state[k].filter((e) => typeof e !== "string");
    if (bad.length) {
      stateAnomalies.push(`${k}[] non-string ×${bad.length}`);
      state[k] = state[k].filter((e) => typeof e === "string");
    }
  }
  // baseline_rounds is the one numeric array — round numbers, not
  // strings; string elements would silently break `.has(n)` checks the
  // same way, so it gets the same coerce-and-flag treatment.
  if (Array.isArray(state.baseline_rounds)) {
    const bad = state.baseline_rounds.filter((e) => !Number.isInteger(e));
    if (bad.length) {
      stateAnomalies.push(`baseline_rounds[] non-integer ×${bad.length}`);
      state.baseline_rounds = state.baseline_rounds.filter((e) => Number.isInteger(e));
    }
  }
  // Object-element fields — `[null]`/`[1]` inside signals/bypasses crashes
  // `.excerpt`/`.failures` reads at use sites (exit 1 = allow). Same rule:
  // drop the malformed element, keep the anomaly loud.
  for (const k of ["user_pause_signals", "stop_bypasses", "rejections"]) {
    if (!Array.isArray(state[k])) continue;
    const bad = state[k].filter((e) => !e || typeof e !== "object" || Array.isArray(e));
    if (bad.length) {
      stateAnomalies.push(`${k}[] non-object ×${bad.length}`);
      state[k] = state[k].filter((e) => e && typeof e === "object" && !Array.isArray(e));
    }
  }

  // ACCEPTED: corroboration — every consumer routes through one helper.
  // A row claiming the user re-scoped must share ≥1 content word with a
  // pause/assent signal the rejection-tracker actually recorded this
  // session (PAUSE_RE covers "approved"/"go ahead"/"later" — real
  // acceptances are captured). Inline "user agreed" prose is assertion,
  // not evidence.
  const pauseSignals = state.user_pause_signals || [];
  const STOPWORDS = new Set("stop user gate this that with what when have does want your their them they will would could should been were asked asking question which about into from some paused pause accepted blocked defer work item items need make done".split(" "));
  // Coerce the input — a forged `{excerpt: 5}` passes the object-element
  // filter, and (5).toLowerCase doesn't exist → TypeError → fail-open.
  const contentWords = (s) => new Set(String(s == null ? "" : s).toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOPWORDS.has(w)));
  const acceptedOk = (line) => {
    const words = contentWords(line);
    return pauseSignals.length > 0 && words.size > 0 &&
      pauseSignals.some((p) => [...contentWords(p.excerpt || "")].some((w) => words.has(w)));
  };
  // Bare/annotated open-status last cell — shared by the artifact findings
  // backstop and the ledger-doc backstop so the two scans can't drift
  // (they did: R12-F6 — the widened form landed on only one sibling).
  // `open → confirmed` (arrow, not dash) and `Open call 10` (space, no
  // dash) stay legal; `OPEN — later` and a bare `QUEUED` do not.
  // The annotation tail requires whitespace before the dash — `OPEN-`
  // glued compounds are check NAMES (OPEN-LEDGER, OPEN-SOURCE), not
  // open statuses (R13-F9).
  const BARE_OPEN_CELL_RE = /^(?:open|pending|todo|wip|unresolved|unfixed|queued|skipped|deferred|later|wontfix|won'?t\s*fix)(?:\s+[—-]\s*\S.*|\s*)$/i;

  // Anchored path citations: `app/…`, `legacy/…`, `.devin/…`, `.unlazy/…` or
  // absolute `X:\…`. The tail charset admits spaces ("docs/x.md"),
  // which means prose after a real path gets absorbed into the candidate —
  // so candidates are checked by longest-existing-prefix: absorbed prose
  // falls away token by token until a real path resolves; a candidate that
  // resolves to nothing is a fabricated citation. An anchor alone
  // ("app/") is not a citation — a name must follow a separator.
  const ANCHOR_RE = /(?:[A-Za-z]:[\\/]|(?:app|src|docs|legacy|rules|skills|\.devin|\.unlazy|\.claude|\.agents)[\\/])[\w\-./\\ ]*/g;
  const citedPaths = (line) =>
    (line.match(ANCHOR_RE) || []).map((s) => s.trim()).filter((s) => /[\\/][\w\-.]/.test(s));
  // A citation is a repo artifact — `C:\Windows\System32` exists but
  // cites nothing about the work; `../` escapes do the same through
  // join(). Candidates resolve under ROOT or they don't count.
  const underRoot = (abs) => { const r = resolve(abs); return r === resolve(ROOT) || r.startsWith(resolve(ROOT) + sep); };
  const anchoredPathExists = (cand) => {
    let p = cand.trim();
    while (/[\\/][\w\-.]/.test(p)) {
      // `.`/`..` segments satisfy existsSync vacuously — `app/.` cites
      // nothing; a cited path's last segment must carry an alnum.
      const clean = !p.split(/[\\/]/).some((s) => /^\.{1,2}$/.test(s)) && /[\w][\w\-.]*$/.test(p);
      if (clean && ((existsSync(p) && underRoot(p)) || (existsSync(join(ROOT, p)) && underRoot(join(ROOT, p))))) return true;
      const cut = p.lastIndexOf(" ");
      if (cut < 0) return false;
      p = p.slice(0, cut).trim();
    }
    return false;
  };
  const wildEscapes = [];
  const exempt = (check, target) => {
    // EXEMPT-<CHECK>: <target or *> — <reason>. Two failures closed here:
    // a bare marker (`EXEMPT-LEDGER:` with no target) matched every doc
    // via includes(""), and substring matching let `EXEMPT-SPEC: ui`
    // exempt every path containing "ui". The marker now requires a
    // non-empty target AND a reason (≥4 chars) — an exemption is an
    // auditable assertion, and an assertion with nothing to audit is
    // the old failure wearing a marker. Matching is exact, path-suffix,
    // or basename — never arbitrary substring.
    const re = new RegExp(`EXEMPT-${check}:\\s*(.+?)\\s*(?:—|--|::| - )\\s*(\\S.{3,})`, "i");
    const lines = evidence.split(/\r?\n/);
    const today = new Date().toISOString().slice(0, 10);
    return lines.some((l) => {
      const m = l.match(re);
      if (!m) return false;
      // O-F1: an exemption can carry `until:YYYY-MM-DD` — a time-boxed
      // escape for genuinely temporary states. An expired until: marker
      // no longer exempts: the exemption lapsed and the work is live
      // again. Lines without until: are session-scoped already (the
      // evidence file is per-session), so they stand unchanged.
      const um = m[2].match(/until:\s*(\d{4}-\d{2}-\d{2})/i);
      if (um && um[1] < today) return false;
      // `*` is not in the strip's allowlist — `m[1].replace(...)` turns it
      // into "" and the wildcard check below is unreachable. Keep the `*`
      // literal before stripping or `EXEMPT-X: *` markers are dead code.
      // `:` and space stay in the allowlist — Windows absolute paths
      // (`C:/…/the project/…`) are the failure messages' own suggested
      // target form; stripping them made those exemptions unmatchable.
      const t = m[1] === "*" ? "*" : m[1].replace(/[^\w\-./\\: ]/g, "");
      if (t === "*") {
        // Wildcard bound (B14): `*` pardons the check for every target —
        // the broadest self-pardon in the system. It stays legal (the
        // audits need it) but earns its reach: the reason must carry
        // substance in prose (≥40 chars — why EVERY target), and the
        // consumption is recorded so the escape telemetry can name the
        // wildcarded checks, not just count them.
        if (m[2].length < 40) return false;
        wildEscapes.push(check);
        return true;
      }
      if (!target) return false;
      const norm = target.replace(/\\/g, "/");
      const tn = t.replace(/\\/g, "/");
      return norm === tn || norm.endsWith("/" + tn) || norm.split("/").pop() === tn;
    });
  };

  // Body text between "## <name>" and the next "## " heading or EOF —
  // `## Chrome` with nothing under it is the avoided-the-question shape,
  // not a section. Sliced by position, not a single regex: a lazy-group
  // boundary lets an empty heading swallow the next section's body.
  const sectionBody = (text, name) => {
    // `#{2,6}` — a nested section (### Provenance inside ## Downloads)
    // is a section; the old `##`-only slice read real h3 content as a
    // bare heading while the unanchored presence check matched it.
    // U9-3: LAST match wins — a doc that carries a superseded same-named
    // section earlier (v1 table left above its v3 rewrite) must be graded
    // on the freshest authored section, not silently shadowed by the first.
    const ms = [...text.matchAll(new RegExp(`^#{2,6}\\s*${String(name).replace(/\s+/g, "\\s+")}\\b[^\\n]*$`, "gim"))];
    const m = ms[ms.length - 1];
    if (!m) return "";
    const rest = text.slice(m.index + m[0].length);
    const next = rest.search(/^#{1,6}\s/m);
    return (next < 0 ? rest : rest.slice(0, next)).trim();
  };
  // h2-only variant — sections whose CONTENT is ### blocks (## Units
  // holding ### U1…U15 examination records) can't use sectionBody: its
  // `#{1,6}` boundary eats the content. Sibling h2Body lives inside the
  // iteration block's scope; this one serves the analysis-project check.
  const h2SectionBody = (text, name) => {
    // U9-3: LAST match wins, same shadowing rationale as sectionBody.
    const ms = [...text.matchAll(new RegExp(`^##\\s*${String(name).replace(/\s+/g, "\\s+")}\\b[^\\n]*$`, "gim"))];
    const m = ms[ms.length - 1];
    if (!m) return "";
    const rest = text.slice(m.index + m[0].length);
    const next = rest.search(/^##\s/m);
    return (next < 0 ? rest : rest.slice(0, next)).trim();
  };
  // Derivation evidence for the spec's search-driven ledgers: a backticked
  // command/path, a search-tool name, or a repo path token — anything that
  // shows the rows came from enumeration rather than memory.
  const DERIVED_RE = /`[^`]+`|\b(?:grep|rg|search(?:ed|ing)?|glob|find(?:str)?)\b|(?:app|src|docs|legacy|rules|skills|\.devin|\.unlazy|\.claude|\.agents)[\\/]/i;

  const failures = [];
  if (stateAnomalies.length) {
    failures.push(
      `GATE-STATE: ${stateAnomalies.length} state field(s) had unexpected types (${stateAnomalies.slice(0, 3).join("; ")}) — coerced to empty; a malformed state record is tampering or corruption, and the fields it carried can't vouch for anything`
    );
  }
  // BLOCKED: is legal to write (it names the wall) but it is open work,
  // never covered work. Every BLOCKED: item in a session artifact lands
  // here; ending the turn with any requires the matching STOP: class
  // declared in gate-evidence (14-stop-integrity) — announced, not filed.
  const blockedOpen = [];

  // --- design-spec -------------------------------------------------------
  tick("design-spec");
  // Decisions before generation (13-design-spec.mdc): a rendered-surface
  // edit may not begin before the spec artifact exists — the spec is where
  // the calls get made (exemplar → concept → grammar → inventory → open
  // calls); generation transcribes it. The mechanical check is ordering:
  // the tracker's timestamps prove the spec preceded the first UI edit.
  // A spec written after is a spec that didn't condition the first pass —
  // the honest entries then are "wrote it after" as the spec's own line or
  // EXEMPT-SPEC for genuinely non-visual edits.
  const touched = state.ui_touched || [];
  if (touched.length) {
    const specPath = join(ROOT, artifactFor(`.unlazy/design-spec/${sid}.md`));
    const specRel = `.unlazy/design-spec/${sid}.md`;
    const unexempted = touched.filter((p) => !exempt("SPEC", p));
    if (unexempted.length) {
      if (!existsSync(specPath) || !state.design_spec_at) {
        failures.push(
          `DESIGN-SPEC: UI source edited (${unexempted.join(", ")}) with no design-spec at ${specRel}. ` +
          `Decisions live in the spec, not in generation — write it BEFORE the first UI edit: ` +
          `<!-- design-spec v2 --> + ## Exemplar (house anchor or external class + captures:) + ## Concept + ## Grammar (concrete values — load the design-grammar skill) + ## Inventory (every element's decisions) + ## Open calls — ` +
          `or EXEMPT-SPEC: <file or *> — <reason> in ${evidenceRel} for genuinely non-visual edits (13-design-spec.mdc).`
        );
      } else {
        if (state.design_spec_at && Number.isNaN(Date.parse(state.design_spec_at))) {
          failures.push(`DESIGN-SPEC: state.design_spec_at (${JSON.stringify(state.design_spec_at)}) isn't a parseable timestamp — the spec-before-edit ordering check can't run on a corrupted field`);
        } else if (state.ui_first_edit_at && Number.isNaN(Date.parse(state.ui_first_edit_at))) {
          failures.push(`DESIGN-SPEC: state.ui_first_edit_at (${JSON.stringify(state.ui_first_edit_at)}) isn't a parseable timestamp — the spec-before-edit ordering check can't run on a corrupted field`);
        } else if (state.ui_first_edit_at && state.design_spec_at > state.ui_first_edit_at) {
          failures.push(
            `DESIGN-SPEC: ${specRel} was written at ${state.design_spec_at} but the first UI edit (${unexempted[0]}) landed at ${state.ui_first_edit_at} — ` +
            `the spec must precede generation or it conditioned nothing (13-design-spec.mdc). ` +
            `If the edit was genuinely non-visual, add EXEMPT-SPEC: <file> — <reason> to ${evidenceRel}.`
          );
        }
        const text = fenceStrip(readText(specPath) || "");
        const missing = [];
        // Schema is versioned like the loop: v1 specs keep the v1-era
        // section checks (retro-binding finished generative artifacts
        // with instruments that didn't exist would demand fabricated
        // history); v2 adds captures/anatomy/quality-contract. The
        // upgrade path is the marker + the new pieces — the note says so.
        const specV3 = hasMarker(text, "design-spec v3");
        const specV2 = hasMarker(text, "design-spec v2") || specV3;
        const specV1 = hasMarker(text, "design-spec v1");
        if (!specV1 && !specV2) missing.push("the v3 marker (<!-- design-spec v3 --> — v1/v2 still parse; v3 adds the register axis, tonal budget, bar-floor, audience row, center-of-gravity, risk register)");
        if (specV2 && !specV3) {
          // gs-v2 autopsy: v3 was opt-in, so a fresh generative session
          // authored a v2 spec and opted out of every v3 arm. A spec
          // file CREATED this session (birthtime ≈ design_spec_at) must
          // carry v3; a pre-existing spec merely edited keeps the note —
          // retro-binding finished artifacts would demand fabrication.
          let authoredNow = false;
          try {
            const bt = statSync(specPath).birthtimeMs;
            authoredNow = !!state.design_spec_at && bt > Date.parse(state.design_spec_at) - 120_000;
          } catch { /* birthtime unavailable → note only */ }
          if (authoredNow) {
            missing.push("the v3 marker (<!-- design-spec v3 --> — this spec was authored this session; authored specs are v3: Directions register axis, ## Tonal budget + bar read-axis + bar-floor, payload media-register, audience row, surface center-of-gravity, live ## Risk register)");
          } else {
            console.error(`[stop-gate] note: ${specRel} is design-spec v2 — new generative specs use <!-- design-spec v3 --> (v2 machinery plus: Directions register axis, ## Tonal budget, bar read-axis + bar-floor, payload media-register, audience row, surface center-of-gravity, live ## Risk register). v2 still parses; switching the marker without the pieces fails the new checks.`);
          }
        }
        if (specV1 && !specV2) {
          console.error(`[stop-gate] note: ${specRel} is design-spec v1 — new generative specs use <!-- design-spec v3 --> (captures that resolve, observation-token anatomy cites, ## Quality contract under ## Directions, first-render eyes + lazy-signals reconciliation, plus the v3 register/tonal/risk machinery). v1 still parses; switching the marker without the pieces fails the new checks.`);
        }
        if (!/##\s*exemplar\b/i.test(text)) missing.push("## Exemplar");
        if (!/##\s*chrome\b/i.test(text)) missing.push("## Chrome (exemplar chrome class + chosen + alternatives + budget)");
        if (!/##\s*concept\b/i.test(text)) missing.push("## Concept");
        if (!/##\s*constraint ledger\b/i.test(text)) missing.push("## Constraint ledger (verbatim ask constraints, content/method tags, check forms)");
        if (!/##\s*member questions\b/i.test(text)) missing.push("## Member questions (the contract the surface answers)");
        if (!/##\s*domain checklist\b/i.test(text)) missing.push("## Domain checklist (canonical features from real exemplars)");
        if (!/##\s*embedded surfaces\b/i.test(text)) missing.push("## Embedded surfaces (each interactive container re-run as its own design unit — or 'none')");
        if (!/##\s*layout budget\b/i.test(text)) missing.push("## Layout budget (declared allocation arithmetic per breakpoint — or 'none')");
        if (!/##\s*emphasis ladder\b/i.test(text)) missing.push("## Emphasis ladder (every element ranked 1–5 before inventory)");
        if (!/##\s*registration\b/i.test(text)) missing.push("## Registration (search-derived type-ledger, or 'none')");
        if (!/##\s*surfaces\b/i.test(text)) missing.push("## Surfaces (search-derived reach-ledger, or 'none')");
        if (!/##\s*grammar\b/i.test(text)) missing.push("## Grammar");
        if (!/##\s*inventory\b/i.test(text)) missing.push("## Inventory");
        if (!/##\s*open calls\b/i.test(text)) missing.push("## Open calls");
        // Presence-enforced template sections that were label-not-control:
        // each exists to force a declared decision, so the section plus
        // non-empty content is required (13-design-spec.mdc).
        for (const sec of ["directions", "state space", "authored vs inherited", "revision", "lazy signals", "embedded surfaces", "layout budget"]) {
          const re = new RegExp(`##\\s*${sec}\\b`, "i");
          if (!re.test(text)) missing.push(`## ${sec[0].toUpperCase() + sec.slice(1)}`);
          else if (!sectionBody(text, sec)) missing.push(`content inside ## ${sec[0].toUpperCase() + sec.slice(1)} (a bare heading is not the section — real rows or 'none — <why>')`);
        }
        // Constraint-ledger row format: 'class | quoted constraint | check:' —
        // every constraint carries its own falsifiable verification (or an
        // explicit DECLARED:), so a dropped check is a missing row, not prose.
        {
          const ledBody = sectionBody(text, "constraint ledger");
          if (ledBody && !/^\s*none\b/im.test(ledBody)) {
            const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
            const ledRows = ledBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/\bclass\b[\s\S]*\bcheck/i.test(l));
            // `audience` is a v3-required non-constraint row (the matrix
            // derives from it, :1464) — excluding it from the class-tag
            // scan, not the ledger (U9-1: the honest `| audience |` row
            // could not satisfy both checks).
            const bad = ledRows.filter((l) => !/^\s*\|\s*(content|method|decision|approval|audience)\s*\|/i.test(l) || l.split("|").slice(1, -1).filter((c) => c.trim()).length < 3);
            if (bad.length) missing.push(`${bad.length} ## Constraint ledger row(s) not in 'class | quoted constraint | check:' form — every row carries its own falsifiable check or DECLARED:`);
          }
        }
        // Embedded-surfaces extraction: each declared embedded surface must
        // have a canonical-features checklist heading (### <surface> …) —
        // a referent named without extracted features counts as no referent.
        {
          const embBody = sectionBody(text, "embedded surfaces");
          if (embBody && !/^\s*none\b/im.test(embBody)) {
            const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
            // Only the surface TABLE is scanned — rows inside a
            // ### canonical-features checklist are features, not
            // surface declarations (they get their own cite check).
            const tablePart = embBody.split(/^###\s+/m)[0];
            const embRows = tablePart.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/\bsurface\b[\s\S]*\bkind\b/i.test(l));
            const heads = [...text.matchAll(/^#{3,4}\s+(.+)$/gim)].map((m) => m[1].toLowerCase());
            const uncovered = embRows
              .map((l) => (l.split("|")[1] || "").trim().replace(/[`'"]/g, ""))
              .filter((name) => name && !heads.some((h) => h.includes(name.toLowerCase().slice(0, 24))));
            if (uncovered.length) {
              missing.push(`embedded surface(s) ${uncovered.map((u) => `"${u}"`).join(", ")} with no canonical-features checklist heading (### <surface> … — a referent named without extracted features counts as no referent)`);
            }
          }
        }
        // Page-surface derivation blocks (v3 plan-completeness arm):
        // a ## Surfaces row naming a page is a surface OUTPUT — it
        // declares the page exists, never what it contains. Each page
        // row owes a `### <surface>` block that re-runs derivation in
        // miniature: ≥2 member questions, each answered by `→ named
        // element(s)` or `omitted — <why>`. Without it the page's
        // contents come from recall — the sort/filter/save-shaped
        // affordance gap (gs3 B7). DECLARED: <surface> derives at
        // parent level — <why> is the escape.
        {
          const surfBody = sectionBody(text, "surfaces");
          if (surfBody && !/^\s*none\b/im.test(surfBody)) {
            const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
            const heads = [...text.matchAll(/^#{3,4}\s+(.+)$/gim)].map((m) => ({ name: m[1].toLowerCase(), at: m.index }));
            const surfRows = surfBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/^\s*\|\s*surface\b/i.test(l));
            const pageRows = surfRows.filter((l) => {
              const cells = l.split("|").slice(1, -1).map((c) => c.trim());
              const file = cells[1] || "";
              const disp = cells[4] || "";
              return /\.html?\b/i.test(file) && !/\b(n\/a|none|external|existing only)\b/i.test(disp);
            });
            const underived = [];
            for (const l of pageRows) {
              const name = (l.split("|")[1] || "").trim().replace(/[`'"]/g, "");
              if (!name || name.length < 2) continue;
              const head = heads.find((h) => h.name.includes(name.toLowerCase().slice(0, 24)));
              const declared = new RegExp(`DECLARED\\s*:\\s*${name.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*derives\\s+at\\s+parent`, "i").test(text);
              if (!head) { underived.push(`"${name}" (no ### block)`); continue; }
              if (declared) continue;
              const hIdx = heads.indexOf(head);
              const next = heads.slice(hIdx + 1).find((h) => h.at > head.at);
              const h2 = text.indexOf("\n## ", head.at);
              const end = next ? next.at : (h2 > head.at ? h2 : text.length);
              const block = text.slice(head.at, end);
              const questions = (block.match(/\?(?=\s|$|[)\]→]|\()/gm) || []).length;
              const arrows = (block.match(/→|(?:answered\s+by\s*[:→])/gi) || []).length;
              const omitted = /omitted\s*(?:—|--|::| - )/i.test(block);
              if (questions < 2 || (arrows + (omitted ? 1 : 0)) < 2) {
                underived.push(`"${name}" (### block has ${questions} questions/${arrows} answers — needs ≥2 of each)`);
              }
            }
            if (underived.length) {
              missing.push(`page surface(s) ${underived.slice(0, 5).join(", ")} with no derivation block — each ## Surfaces page row owes ### <surface>: ≥2 member questions each answered by → named elements or omitted — <why> (a page is a design unit; contents from recall ship the generic prior — DECLARED: <surface> derives at parent level — <why> releases)`);
            }
          }
        }
        // Inventory arity: a spec that declares an ## Inventory heading but
        // enumerates no element rows — or rows thinner than the decision
        // columns — is a container, not a design. Each data row needs ≥8
        // non-empty cells (element + the 10 decision columns; 8 is the
        // arity floor for "decisions were made", not a column recount).
        {
          const invBody = sectionBody(text, "inventory");
          if (invBody && !/^\s*none\b/im.test(invBody)) {
            const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
            // Header rows: first cell `element` is canonical; a `#`/`surface`/
            // `unit`/`id`-led header stays a header only when a second bare
            // column-label cell is present (U9-2: `| # | surface | element |`
            // was parsed as data — a numbered data row's other cells aren't
            // bare labels, so it still counts).
            const invHdr2 = /\|\s*(?:element|surface|job|earns|expansion|viewport|states?|role)\s*\|/i;
            const invRows = invBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/\bdata role\b/i.test(l) && !/^\s*\|\s*element\s*\|/i.test(l) && !(/^\s*\|\s*(?:#|surface|unit|id)\s*\|/i.test(l) && invHdr2.test(l)));
            if (!invRows.length) {
              missing.push("element rows inside ## Inventory (the heading exists but enumerates nothing — a spec whose inventory is empty was not designed)");
            } else {
              const thin = invRows.filter((l) => l.split("|").slice(1, -1).filter((c) => c.trim()).length < 8);
              if (thin.length) missing.push(`${thin.length} ## Inventory row(s) with <8 non-empty cells (arity floor — thin rows are breadth, not unpacking)`);
              // C5: each element carries its job and what earns it a
              // place — a row without either is a part-list, not a design.
              const noJobEarns = invRows.filter((l) => !/\bjob\s*:/i.test(l) || !/\bearns\s*:/i.test(l)).length;
              // The whole-table `sole —` escape is a standalone line —
              // the D2 per-row `sole —` verdicts must not satisfy it.
              if (noJobEarns && !/^\s*sole\s*(?:—|--|::| - )\s*\S/im.test(invBody)) {
                missing.push(`${noJobEarns} ## Inventory row(s) without \`job:\`/\`earns:\` — each element names its job and what earns its place (or \`sole — <why>\` inside ## Inventory)`);
              }
              // D2: the expansion question is answered per row, uniformly —
              // `expandable: <named sub-unit>` makes the element a subject of
              // its own spec/round; `sole — <why ≥30 chars>` closes it. No
              // component/leaf judgment is left to the writer.
              const noExpand = invRows.filter((l) => !/\bexpandable\s*:\s*\S/i.test(l) && !/\bsole\s*(?:—|--|::| - )\s*\S.{29}/i.test(l)).length;
              if (noExpand) {
                missing.push(`${noExpand} ## Inventory row(s) without an expansion verdict — every row carries \`expandable: <named sub-unit>\` or \`sole — <why ≥30 chars>\` (the expansion question is uniform, not a writer judgment call)`);
              }
            }
          }
        }
        // D1: recursion depth ledger. `## Depth` carries `depth: N`
        // (parent+1); a spec deeper than level 1 ledgers the chain —
        // one `level | surface/component | spec-doc | loop-artifact | state`
        // row per level traversed. No ## Depth means depth 1 by default.
        {
          const depBody = sectionBody(text, "depth");
          if (depBody) {
            const dm = depBody.match(/\bdepth\s*:\s*(\d+)/i);
            const depthN = dm ? parseInt(dm[1], 10) : 0;
            if (!dm || depthN < 1) {
              missing.push("a `depth: N` line inside ## Depth (the recursion level this spec sits at — parent+1)");
            } else if (depthN > 1) {
              const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
              const depRows = depBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/\|\s*level\s*\|/i.test(l));
              if (depRows.length < depthN) {
                missing.push(`## Depth shows ${depthN} but only ${depRows.length} ledger row(s) — a level-${depthN} spec ledgers every level traversed (level | surface/component | spec-doc | loop-artifact | state)`);
              }
            }
          }
        }
        // Content-shape checks — the sections exist to force a declared
        // decision, so a bare heading or an undecorated paragraph is the
        // requirement wearing its own name.
        if (/##\s*chrome\b/i.test(text)) {
          const body = sectionBody(text, "chrome");
          const hasClass = /\b(full[-\s]?page|page|reader|rail|sheet|modal|dialog|drawer|panel|inline|overlay|popover|tab|screen|view|card|standalone)\b/i.test(body);
          if (!body || (!/\bnone\b|n\/a/i.test(body) && !hasClass)) {
            missing.push("a chrome class inside ## Chrome (page|reader|modal|sheet|popover|rail|inline — the declared container decision, or 'none')");
          }
        }
        for (const sec of ["registration", "surfaces"]) {
          if (new RegExp(`##\\s*${sec}\\b`, "i").test(text)) {
            const body = sectionBody(text, sec);
            if (!body || (!/\bnone\b/i.test(body) && !DERIVED_RE.test(body))) {
              missing.push(`search-derived evidence inside ## ${sec[0].toUpperCase() + sec.slice(1)} (the command run or the ledger rows it produced — or 'none — <why>')`);
            }
          }
        }
        // Captures — 13-design-spec's hard line: grammar comes from
        // source + shots or it is adjectives. The `captures:` line must
        // exist inside ## Exemplar and every path it cites must resolve;
        // the only legal absence is `DECLARED: no captures — <why>` —
        // `captures: none` variants are the banned self-exemption, and
        // "no house referent" is no why (public exemplars are
        // capturable). v2-scope only — v1 specs get the note above.
        if (specV2) {
          const exBody = sectionBody(text, "exemplar");
          if (exBody) {
            const capDeclM = exBody.match(/DECLARED\s*:\s*no\s+captures\s*(?:—|--|::| - )\s*(.{10,})/i);
            const capDecl = !!capDeclM;
            // D6/A7: the DECLARED why must assert genuine inability — "no
            // real surface of this class can be captured." A referent ban
            // (`anchor: none`, house-referent-forbidden) is a direction
            // choice, not an inability — under it the comparative bar
            // stays assertion-shaped (gamersocial's exact failure). Ban
            // vocabulary voids the declaration even beside inability words:
            // "the house referent can't be captured" is false when the
            // agent runs the app that draws it.
            if (capDeclM) {
              const why = capDeclM[1];
              const inability = /\buncapturab|cannot be captur|can'?t be captur|cannot captur|can'?t captur|no real surface|no public surface|no surface (?:of this class )?(?:exists|to capture)|nothing (?:exists )?to capture|impossible to capture|not capturable|no class of surface/i.test(why);
              const referentBan = /\banchor\s*:\s*none|\breferent\b|self[-\s]?forbidden|forbid|ban(?:ned|s)?\b|not allowed|off[-\s]?limits|excluded by (?:rule|policy|choice|decision)/i.test(why);
              if (!inability || referentBan) {
                missing.push("`DECLARED: no captures` whose why is a referent ban, not an inability — 'no real surface of this class can be captured' is the only legal why; banning referents leaves the comparative bar unevidenced (13-design-spec)");
              }
            }
            const capM = exBody.match(/^\s*captures\s*:\s*(.+)$/im);
            const hasPaths = capM && !/^\s*(none|n\/a)\b/i.test(capM[1].trim());
            if (!capDecl && !hasPaths) {
              missing.push("a `captures:` line inside ## Exemplar citing real shot paths (or `DECLARED: no captures — <why>`; `captures: none` variants are the self-exemption the rule bans)");
            } else if (hasPaths) {
              const caps = [...capM[1].matchAll(/[`'"]([^`'"]+\.(?:png|jpe?g|webp|gif))[`'"]/gi)].map((m) => m[1])
                .concat((capM[1].match(/[\w./\\-]+\.(?:png|jpe?g|webp|gif)/gi) || []));
              const unres = [...new Set(caps.map((c) => c.trim()).filter((c) => c && !/^https?:/i.test(c)))]
                .filter((c) => !existsSync(c) && !existsSync(join(ROOT, c)));
              if (unres.length) {
                missing.push(`${unres.length} captures: path(s) that don't resolve (${unres.slice(0, 2).join(", ")}${unres.length > 2 ? "…" : ""}) — a captures line naming files that don't exist is memory wearing a citation`);
              }
            }
          }
        }
        // Observed-anatomy tokens — checklist rows cite WHERE the feature
        // was observed (a capture file, a DOM detail, file:line, a URL),
        // not only an exemplar's name (13-design-spec → the anatomy
        // cite). "FB post header row" alone is a guess wearing a
        // citation; authored/invented rows escape by declaration. v2-scope.
        if (specV2) {
          const OBS = /\.(?:png|jpe?g|webp|gif|html?|js|css|py|json)\b|\bfile:\S+:\d+|:\d+\b|\bdom\b|\bselector|\bcapture|\bscreenshot|\bshot\b|https?:\/\/|\bobserved\b|\bprobe\b|\brender\b/i;
          const ESC = /\b(authored|invented|no exemplar|n\/a\b|none\b|omitted|declared)/i;
          const HDR1 = /^\s*\|\s*(canonical feature|feature|surface|#|element)\b/i;
          let nameOnly = 0;
          for (const sec of ["domain checklist", "embedded surfaces"]) {
            const b = sectionBody(text, sec);
            if (!b || /^\s*none\b/im.test(b)) continue;
            for (const l of b.split(/\r?\n/)) {
              if (!/^\s*\|/.test(l) || /^\s*\|[\s:\-|]+\|\s*$/.test(l) || HDR1.test(l)) continue;
              if (!OBS.test(l) && !ESC.test(l)) nameOnly++;
            }
          }
          if (nameOnly) {
            missing.push(`${nameOnly} checklist row(s) citing anatomy with no observation token (capture file / DOM detail / file:line / URL — or 'authored' declared; an exemplar NAME alone is memory, not observation)`);
          }
        }
        // ## Quality contract — required whenever ## Directions exists
        // (the generative-ask marker): the bar, ≥2 distinctive moves
        // with mechanisms, ≥3 class-generic failure modes each designed
        // out. Directions chose what to build; the contract defines
        // what good means for it. v2-scope.
        if (specV2 && /##\s*directions\b/i.test(text)) {
          const qcBody = sectionBody(text, "quality contract");
          if (!qcBody || !/^\s*bar\s*:/im.test(qcBody)) {
            missing.push("## Quality contract with a `bar:` line (generative asks carry the quality bar in writing before code — 13-design-spec)");
          } else {
            const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
            const qRows = (sub) => {
              const m = qcBody.match(new RegExp(`${sub}[ \\t]*:[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*\\w[^\\n:]*:[ \\t]*\\n|\\n##|$)`, "i"));
              return m ? m[1].split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/\|[^|]*(move|mode|mechanism|designed|mitigation)[^|]*\|/i.test(l.split("|").slice(0, 3).join("|"))).length : 0;
            };
            const moves = qRows("distinctive\\s+moves?");
            const modes = qRows("generic\\s+failure\\s+modes?");
            if (moves < 2) missing.push("≥2 distinctive-move rows inside ## Quality contract (the authored moves that break the template read, each with its mechanism)");
            if (modes < 3) missing.push("≥3 generic-failure-mode rows inside ## Quality contract (each class-generic way this artifact reads template-like, paired with its designed-out mechanism)");
            // The altitude fields — the contract names what makes it
            // EXCELLENT or it sets a floor and calls it a bar.
            const barL = qcBody.match(/^\s*bar\s*:\s*(.+)$/im);
            if (barL && !/(\/\s*10|9\/10|top|best|screenshot|squint|payload|score|over the exemplar|surpass|premier|signature)/i.test(barL[1])) {
              missing.push("`bar:` as a rank clause inside ## Quality contract (≥3 checkable properties of the 9/10 version + a scoring clause — 'reads as an app like X' is a membership test, not a bar)");
            }
            if (!/^\s*ceiling\s*:/im.test(qcBody) && !/DECLARED\s*:\s*ceiling/i.test(qcBody)) {
              missing.push("a `ceiling:` line inside ## Quality contract (the direction's best-possible score defended before build — a ceiling below the bar sends the spec back)");
            }
            if (!/^\s*payload\s*:/im.test(qcBody) && !/DECLARED\s*:\s*no\s+media/i.test(qcBody)) {
              missing.push("`payload:` rows inside ## Quality contract (per media-bearing surface: what the media IS + why it reads as content — or DECLARED: no media — <why>; decoration-in-the-content-slot is the ceiling-killer)");
            }
          }
        }
        // craft: — per-exemplar WHY-it-reads-premium traits (v2).
        if (specV2) {
          const exB = sectionBody(text, "exemplar");
          if (exB && !/^\s*craft\s*:/im.test(exB) && !/DECLARED\s*:\s*no\s+craft/i.test(exB)) {
            missing.push("a `craft:` line inside ## Exemplar (≥2 craft-level traits per exemplar — WHY it reads premium, each mapped into the product; anatomy transfer without craft transfer is the motif-band failure)");
          }
          // role column — every canonical feature names its exemplar role.
          const dcB = sectionBody(text, "domain checklist");
          if (dcB) {
            const hdr = dcB.split(/\r?\n/).find((l) => l.includes("|") && /canonical feature|feature/i.test(l));
            if (hdr && !/\brole\b/i.test(hdr) && !/DECLARED\s*:\s*role/i.test(dcB)) {
              missing.push("a `role` column in ## Domain checklist (each canonical feature names its exemplar role — payload/structural/chrome/decoration; a feature adopted without its role is the motif-band failure)");
            }
            // LG-F1: role→payload join — a feature the checklist tags
            // `payload` that never appears in the payload: rows or the
            // Directions body is a decision that binds nothing downstream.
            if (hdr && /\brole\b/i.test(hdr)) {
              const cells = hdr.split("|").map((c) => c.trim().toLowerCase());
              const roleIdx = cells.findIndex((c) => /role/.test(c));
              const featIdx = cells.findIndex((c) => /feature|element|surface/.test(c));
              if (roleIdx >= 0 && featIdx >= 0) {
                const payRows = dcB.split(/\r?\n/).filter((l) => {
                  if (!/^\s*\|/.test(l) || /^\s*\|[\s:\-|]+\|\s*$/.test(l)) return false;
                  const cc = l.split("|").map((x) => x.trim());
                  return /payload/i.test(cc[roleIdx] || "");
                });
                const qcB2 = sectionBody(text, "quality contract") || "";
                const dirB = sectionBody(text, "directions") || "";
                const joinBody = (qcB2 + "\n" + dirB).toLowerCase();
                const unjoined = payRows.filter((l) => {
                  const feat = (l.split("|").map((x) => x.trim())[featIdx] || "").toLowerCase();
                  const fw = feat.replace(/[^\w\s]/g, "").split(/\s+/).filter((w) => w.length > 3);
                  return fw.length && !fw.some((w) => joinBody.includes(w));
                });
                if (unjoined.length) {
                  missing.push(`${unjoined.length} payload-role feature(s) named in ## Domain checklist never appear in payload:/Directions — a role decision that binds nothing downstream (LG-F1)`);
                }
              }
            }
          }
        }
        // ## Spec critique (v2 generative) — the spec records that a
        // stranger passed on its DECISIONS (ceiling/payload/bar match)
        // before first render, and what it changed. The artifact-side
        // check (design-review) demands the deposited pass file; this
        // side demands the spec say what it did with it.
        if (specV2 && /##\s*directions\b/i.test(text)) {
          const scB = sectionBody(text, "spec critique");
          if (!/##\s*spec\s*critique\b/i.test(text)) {
            missing.push("a ## Spec critique section (the pre-render stranger critique of this spec's decisions — outcome + what changed, or DECLARED: spec-critique n/a — <why>)");
          } else if (!scB || scB.replace(/[\s|—\-:`]/g, "").length < 40) {
            missing.push("content inside ## Spec critique (the pass outcome + what changed in response — or DECLARED: spec-critique n/a — <why>)");
          }
        }
        // ─── v3 additions (generative asks only — Directions present) ───
        // The schema sections that make taste auditable: register axis on
        // the directions table, tonal budget as declared arithmetic, a
        // numeric bar-floor, the audience-derived matrix, per-page center
        // of gravity, and the live risk register. Shape checks only —
        // honesty is reviewed, not gated (D1/D4/D10/D11/D13/D14/D15/D16).
        if (specV3 && /##\s*directions\b/i.test(text)) {
          const dirBody = sectionBody(text, "directions") || "";
          const sepReV3 = /^\s*\|[\s:\-|]+\|\s*$/;
          const dirRows = dirBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepReV3.test(l) && !/\|\s*direction\s*\|/i.test(l) && !/\|\s*shared scaffold/i.test(l));
          // Register column present + non-empty on ≥1 direction row — the
          // register axis is how the spec decides where taste lands, and
          // an all-mean set is the one-sample failure wearing columns.
          const dirHdr = dirBody.split(/\r?\n/).find((l) => /^\s*\|/.test(l) && /\|\s*direction\s*\|/i.test(l));
          if (!dirHdr || !/\bregister\b/i.test(dirHdr)) {
            missing.push("a `register` column in ## Directions (v3 — muted↔vivid / flat↔layered / sparse↔dense / photo↔illustration; a set that never varies register is one sample re-boxed)");
          } else {
            const regIdx = dirHdr.split("|").findIndex((c) => /\bregister\b/i.test(c));
            if (regIdx >= 0 && !dirRows.some((l) => (l.split("|")[regIdx] || "").trim().length >= 4)) {
              missing.push("no direction row carries a register cell — the axis exists to be varied, not left blank (≥1 row names its register with evidence-of-fit)");
            }
          }
          // ## Tonal budget — declared chrome luminance stack.
          if (!/##\s*tonal\s+budget\b/i.test(text)) {
            missing.push("## Tonal budget (v3 — the chrome-stack luminance inequality the arithmetic probe verifies; washed-out is arithmetic, declare the floors)");
          }
          // ## Risk register — the live risk table promoted from the
          // ceiling clause + failure modes; ≥2 rows (or rows AXIS-NA'd).
          const riskB = sectionBody(text, "risk register") || "";
          if (!riskB) {
            missing.push("## Risk register (v3 — the ceiling clause + generic failure modes as a live table: risk | trigger evidence | status)");
          } else {
            const riskRows = riskB.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepReV3.test(l) && !/\|\s*risk\s*\|/i.test(l) && !/\|\s*<from/i.test(l));
            const live = riskRows.filter((l) => !/AXIS-NA\s*:/i.test(l));
            if (live.length < 2) {
              missing.push(`≥2 rows inside ## Risk register (has ${live.length}) — the register the review re-grades; risks written as prose are graves, not guards`);
            }
          }
          // Audience row — the constraint ledger declares who looks at
          // this surface; the coverage matrix derives from it, not
          // convention (D4 — the 3840 monitor outside every 1440 matrix).
          const ledB3 = sectionBody(text, "constraint ledger") || "";
          if (!/\|\s*audience\s*\|/i.test(ledB3)) {
            missing.push("an `audience` row inside ## Constraint ledger (v3 — who looks at this + display/environment; the matrix derives from it, not from 1440/768/390 convention)");
          }
          // Center-of-gravity — surfaces rows name the eye-anchor.
          const surfB = sectionBody(text, "surfaces") || "";
          if (surfB && !/^\s*none\b/im.test(surfB)) {
            const sHdr = surfB.split(/\r?\n/).find((l) => /^\s*\|/.test(l) && /\|\s*surface\s*\|/i.test(l));
            if (sHdr && !/center\s*of\s*gravity/i.test(sHdr)) {
              missing.push("a `center of gravity` column in ## Surfaces (v3 — each page names its eye-anchor; the template-sameness failure is invisible without it)");
            }
          }
          // ceiling ≥ bar-floor — the computable inequality. Parse both;
          // ceiling below floor = spec sent back, per the contract.
          const qcB3 = sectionBody(text, "quality contract") || "";
          // First score in the line — real ceilings write the number
          // mid-sentence ("lands ~8.5–9", "caps only if"), not right
          // after the colon. A `~N–M` range takes the low end: a spec
          // admitting a sub-bar low end admits a sub-bar landing.
          const ceilM = qcB3.match(/ceiling\s*:[^\n]*?(\d{1,2}(?:\.\d+)?)/i);
          const floorM = qcB3.match(/bar-floor\s*:[^\n]*?(\d{1,2}(?:\.\d+)?)/i);
          if (!floorM) {
            missing.push("a `bar-floor:` line inside ## Quality contract (v3 — the numeric minimum the direction may land; it makes ceiling<bar-floor computable and the verdict floor honest)");
          } else if (ceilM && parseFloat(ceilM[1]) < parseFloat(floorM[1])) {
            failures.push(
              `SPEC-CEILING: ${specRel} declares ceiling ~${ceilM[1]} below its bar-floor ${floorM[1]} — the direction caps under the bar before a line is written. ` +
              `Pick a different direction or re-derive the ceiling; a spec whose own arithmetic says sub-bar is sent back, not built (13-design-spec → Quality contract).`
            );
          }
          // bar read-axis — the stranger's read named, not only
          // compositional proxies. `reads as <X>, never <tell>` shape.
          const barL3 = qcB3.match(/^\s*bar\s*:\s*(.+)$/im);
          if (barL3 && !/reads?\s+as\b|stranger\s+reads|never\b/i.test(barL3[1])) {
            missing.push("a read-axis clause in the `bar:` line (v3 — the stranger's read with the banned tell named: 'reads as illustration-craft, never clip-art'; composition-only bars are satisfiable at the register they exist to prevent)");
          }
          // Payload register — media rows state their register +
          // thumbnail-scale read (D12/D16 divergence flag). Rows come
          // from the `payload:` sub-block only — "media"/"tile" words
          // inside the failure-modes table are not payload rows, and a
          // `payload: DECLARED: no media` exemption is the v2 arm's legal
          // absence, not a media row (both found by gatest cases).
          const payBlock = (qcB3.match(/^\s*payload\s*:[^\n]*\n?([\s\S]*?)(?=^\s*\w[\w -]*\s*:|\s*$)/im) || [])[1] || "";
          const payRows3 = payBlock.split(/\r?\n/)
            .filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\|\s*surface\s*\|/i.test(l))
            .filter((l) => !/DECLARED\s*:/i.test(l));
          if (payRows3.length && !payRows3.some((l) => /photo|illustration|data[-\s]?scene|abstract|register/i.test(l))) {
            missing.push("media-register vocabulary in the `payload:` rows (v3 — each media row states photo|illustration|data-scene|abstract + the thumbnail-scale read; a register diverging from the exemplar's is a flagged Open call)");
          }
          // Referent geometry (gs-v2): the named exemplar's structure is
          // extracted as borrowable numbers — nav width, column ratios,
          // gutter, type scale, avatar size — not vibes. A spec that names
          // the referent/Steam and measures nothing borrowed references.
          // Escapes: `referent-geometry: none — <why>` / an Exemplar
          // `DECLARED: no captures` — a user-banned referent class makes
          // measurement impossible by construction (gs3 dogfood hit this).
          const noCapDecl = /captures\s*:\s*DECLARED\s*:\s*no\s+captures\b/i.test(text);
          if (!/referent[-\s]?geometry\s*:[^\n]*\d/i.test(text) && !/referent[-\s]?geometry\s*:\s*(?:none|n\/a)\b[^\n]*(?:—|--|::| - )\s*\S{4,}/i.test(text) && !noCapDecl) {
            missing.push("a `referent-geometry:` row carrying numbers (v3 — the exemplar's measured structure: nav width, column ratios, gutter, type scale, avatar size — borrowed geometry beats self-authored grammar); or `referent-geometry: none — <why>` when the referent class is banned");
          }
          // Divergent directions — fires on multiplication AND on
          // restyle (secdoc B10: the ≥3-pages-only arm let a single-file
          // "improve the design" session execute its first idea, keep
          // the whole chassis, and ship a re-skin the user couldn't tell
          // from the before). Any pre-existing rendered file touched =
          // a redesign ask → ≥2 divergent rows, or a declared defense
          // when the design space is genuinely one-dimensional.
          {
            const firstEditTs = Date.parse(state.ui_first_edit_at || state.design_spec_at || 0) || 0;
            // ui_touched misses css outside app/ui (secdoc-shaped
            // restyles); the union keeps restyleN honest while the
            // extension filter keeps it rendered-files-only.
            const touchedUI = [...new Set([
              ...(Array.isArray(state.ui_touched) ? state.ui_touched : []),
              ...(Array.isArray(state.impl_touched) ? state.impl_touched : []),
            ])];
            const birth = (p) => { try { return statSync(join(ROOT, String(p))).birthtimeMs; } catch { return null; } };
            const createdN = firstEditTs ? touchedUI.filter((p) => {
              if (!/\.(html|j2)$/i.test(String(p))) return false;
              const b = birth(p); return b != null && b > firstEditTs - 120_000;
            }).length : 0;
            const restyleN = firstEditTs ? touchedUI.filter((p) => {
              if (!/\.(html|j2|css)$/i.test(String(p))) return false;
              const b = birth(p); return b != null && b <= firstEditTs - 120_000;
            }).length : 0;
            const dirEscape = /DECLARED\s*:\s*directions?\b[^\n]*(?:—|--|::| - )\s*\S{4,}|(?:one-direction|single direction)\b[^\n]*(?:—|--|::| - )\s*\S{4,}/i.test(dirBody);
            if (dirRows.length < 2 && !dirEscape && (createdN >= 3 || restyleN >= 1)) {
              missing.push(restyleN >= 1 && createdN < 3
                ? `≥2 divergent direction rows inside ## Directions for a restyle ask (${restyleN} pre-existing rendered file(s) touched, ${dirRows.length} direction(s) declared) — one direction on an existing chassis is a re-skin plan: divergence is how a redesign finds its structure instead of silently inheriting it. DECLARED: directions — <why> releases only when the design space is genuinely one-dimensional`
                : `≥2 direction rows inside ## Directions for a multi-page build (${createdN} pages created this session, ${dirRows.length} direction(s) declared) — divergent sketches cost minutes; one concept executed once is how a bad frame multiplies`);
            }
            // ## Delta (secdoc B10): what VISIBLY changes — the chassis
            // decision in writing. On a restyle ask an all-[surface]
            // delta is a re-skin plan wearing a spec — needs ≥1
            // [structure] row or a defended escape.
            const dB = sectionBody(text, "delta");
            if (!/##\s*delta\b/i.test(text)) {
              missing.push("## Delta (v3 — what visibly changes vs what exists: per-surface rows classed [structure]/[surface]/[content] + a keeps: chassis list + before: capture cites on a restyle; 'new-build — all surfaces new' when nothing pre-exists)");
            } else if (!dB || dB.replace(/[\s|—\-:`]/g, "").length < 20) {
              missing.push("content inside ## Delta (classed rows — a bare heading is not the section)");
            } else if (restyleN >= 1) {
              const dEsc = /DECLARED\s*:\s*delta\b[^\n]*(?:—|--|::| - )\s*\S{4,}|(?:surface-only|new-build)\b[^\n]*(?:—|--|::| - )\s*\S{4,}/i.test(dB);
              if (!/\[\s*structure\s*\]/i.test(dB) && !dEsc) {
                missing.push(`a [structure] row inside ## Delta (${restyleN} pre-existing rendered file(s) touched but every row is [surface]/[content] — an all-token delta on an existing chassis is the re-skin this section exists to catch; name the structural move or defend: surface-only — <why>)`);
              }
            }
          }
        }
        // REFERENT-VIEWED (gs-v2): captures: are only honored if the
        // generator actually looked — the transcript must contain a read
        // of a declared referent image. A referent never seen was
        // decoration, not direction.
        if (specV3 && transcriptRaw && !exempt("REFVIEW", "*")) {
          const capStems = [...new Set(
            (text.match(/[\w.\\/-]+\.(?:png|jpe?g|webp|gif)\b/gi) || [])
              .map((c) => c.replace(/\\/g, "/").split("/").pop().replace(/\.[^.]+$/, "").toLowerCase())
              .filter((s) => s.length > 2))];
          const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const viewed = capStems.some((st) =>
            new RegExp(`file_path["']?\\s*[:=]\\s*["'][^"']*${esc(st)}`, "i").test(transcriptRaw));
          if (capStems.length && !viewed) {
            failures.push(
              `REFERENT-VIEWED: ${specRel} names referent captures (${capStems.slice(0, 3).join(", ")}${capStems.length > 3 ? "…" : ""}) but the transcript holds no read of any referent image — ` +
              `the exemplar was referenced, not looked at. Read the capture while composing, or EXEMPT-REFVIEW: * — <reason> in ${evidenceRel}.`
            );
          }
        }
        if (missing.length) {
          failures.push(
            `DESIGN-SPEC: ${specRel} incomplete — missing ${missing.join(", ")} (13-design-spec.mdc).`
          );
        }
      }
    }
  }

  // --- design-review -----------------------------------------------------
  tick("design-review");
  if (touched.length) {
    const artifactPath = join(ARTIFACT_DIR, `${sid}.md`);
    const artifactRel = artifactFor(`.unlazy/design-review/${sid}.md`);
    if (!existsSync(artifactPath)) {
      failures.push(
        `DESIGN-REVIEW: UI source edited (${touched.join(", ")}) but no critique artifact at ${artifactRel}. ` +
        `Format: <!-- design-review v1 --> marker + Coverage table + Findings table (or explicit "No findings") — rules/09-design-review.mdc.`
      );
    } else {
      const text = fenceStrip(readText(artifactPath) || "");
      const missing = [];
      if (!hasMarker(text, "design-review v1")) missing.push("the v1 marker");
      if (!/##\s*interpretation\b/i.test(text) || !/\bask\s*:/i.test(text) || !/\breferent\s*:/i.test(text) || !/\boutcome\s*:/i.test(text))
        missing.push("an Interpretation section (ask + outcome + referent + verdict basis — 09-design-review.mdc)");
      const referentLine = (text.match(/\breferent\s*:\s*(.*)/i) || [])[1] || "";
      // referent: none is an author-declared kill switch — it lawfully
      // disarms Anatomy diff / Defense / Verdicts / Absences / Raises /
      // Fresh-look / Read-back below. On an appearance-vocabulary ask
      // the author cannot disarm the instruments that grade the work by
      // naming one word — declare why no real artifact class applies.
      const askLine = (text.match(/\bask\s*:\s*(.*)/i) || [])[1] || "";
      const REFERENT_ASK_RE = /redesign|design|style|visual|page|channel|mockup|surface|\bui\b|layout|theme|colou?r|spacing|typography|font|icon|button|modal|card|grid|nav|header|footer|responsive|mobile|desktop|look|palette|banner|table|tile|hero|menu|sidebar|panel/i;
      if (/\bnone\b/i.test(referentLine) && REFERENT_ASK_RE.test(askLine) && !/\breferent-defense\s*:/i.test(text) && !exempt("REFERENT", artifactRel)) {
        failures.push(
          `REFERENT-ARM: the ask carries appearance vocabulary ("${askLine.trim().slice(0, 80)}") but referent: none — declaring 'none' on a visual ask disarms the entire deep-review layer by author fiat. ` +
          `Name a referent, or add a \`referent-defense: <why no real artifact class applies>\` line inside Interpretation (09-design-review.mdc).`
        );
      }
      if (referentLine && !/\bnone\b/i.test(referentLine) && !/\bexemplar\s*:/i.test(text))
        missing.push("an exemplar line (required when the referent isn't 'none' — the exemplar-conditioning step, 09-design-review.mdc)");
      if (!/\|\s*surface\s*\|/i.test(text)) missing.push("a Coverage table");
      if (/\|\s*surface\s*\|/i.test(text) && !/\|\s*persona\s*\|/i.test(text))
        missing.push("a persona column in the Coverage table (surface × viewport × actor — founder-only rows are founder-verified only)");
      if (!/\|\s*(id|finding)\s*\|/i.test(text) && !/no findings/i.test(text)) missing.push("a Findings table or explicit 'No findings'");
      // Expectation-first + calibrated remainder + options + budgets
      // (09-design-review.mdc): the passes that make coverage falsifiable
      // and confidence boundable. All accept an honest 'none' line.
      if (!/##\s*predictions\b/i.test(text)) missing.push("a ## Predictions section (predicted state per rendered cell, or 'none')");
      if (!/##\s*options\b/i.test(text)) missing.push("an ## Options section (rendered alternatives where latitude exists, or 'none')");
      if (!/##\s*unverified\b/i.test(text)) missing.push("an ## Unverified section (personas/surfaces/states not exercised — the calibrated remainder, or 'none')");
      if (!/##\s*hypotheses\b/i.test(text)) missing.push("a ## Hypotheses section (questions asked + found/cleared/unverifiable — the examined-and-cleared space, 15-analysis-depth)");
      if (!/##\s*constraint\s*check\b/i.test(text)) missing.push("a ## Constraint check section (the ask re-read verbatim — every constraint carried or dropped, 09-design-review/15-analysis-depth)");
      if (!/##\s*lenses\b/i.test(text)) missing.push("a ## Lenses section (the passes that ran — mechanics/emphasis/domain-completeness/stranger/taxonomy-regression, each verdict or DECLARED, 09-design-review)");
      if (!/##\s*emphasis\s*audit\b/i.test(text)) missing.push("an ## Emphasis audit section (painted top-3 vs intended top-3 per surface — rank-order vs rank-order, 09-design-review)");
      if (!/##\s*question\s*verdicts\b/i.test(text)) missing.push("a ## Question verdicts section (one row per spec member question — answered by <element> or unanswered — finding, 09-design-review)");
      if (!/##\s*revisions\b/i.test(text)) missing.push("a ## Revisions section (v1 → what v2 changed per authored element, or 'none — <why>', 09-design-review)");
      // Template-required sections that were label-not-control — presence
      // now, substance via the bare-heading loop below (09-design-review).
      if (!/##\s*stranger\b/i.test(text)) missing.push("a ## Stranger section (the stranger-read pass — what a fresh member sees first, or 'none', 09-design-review)");
      if (!/##\s*liveness\b/i.test(text)) missing.push("a ## Liveness section (the behavior ledger — every interactive element's declared behavior exercised or DECLARED, 09-design-review)");
      if (!/##\s*provenance\b/i.test(text)) missing.push("a ## Provenance section (where each element's value came from — real data, exemplar, or invented + defense, 09-design-review)");
      if (!/##\s*pre-flight\b/i.test(text)) missing.push("a ## Pre-flight section (the run-before-ship checks — what was verified on the live surface, 09-design-review)");
      // C5: the interrogation table (09's grammar protocol made bound) —
      // one row per component carrying the expandable/sole verdict; the
      // two altitude verdicts keep the review honest at both zooms.
      {
        const intB = sectionBody(text, "interrogation") || "";
        const intRows = intB.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\|\s*(component|element|unit)\s*\|/i.test(l)).length;
        if (!intRows && !/\bsole\s*(?:—|--|::| - )\s*\S/i.test(intB) && !/^\s*sole\s*(?:—|--|::| - )\s*\S/im.test(text)) {
          missing.push("an ## Interrogation table (one row per component — the expandable question asked and answered, or `sole — <why>` on the surface)");
        }
        if (!/^\s*holistic\s*:/im.test(text)) missing.push("a `holistic:` verdict line (the whole read at one zoom — composition, not the row list)");
        if (!/^\s*micro\s*:/im.test(text)) missing.push("a `micro:` verdict line (the close read — per-element execution, not the overview)");
        // D4: the two analysis-side passes the spine lacked — `state pass:`
        // (element states exercised: hover/focus/disabled/empty/loading/
        // error) and `balance pass:` (visual weight + alignment across the
        // surface). `n/a — <why>` is the honest opt-out per pass.
        for (const pn of ["state pass", "balance pass"]) {
          const pnM = text.match(new RegExp(`^\\s*${pn.replace(/\s/g, "[-\\s]")}\\s*:\\s*([^\\n]*)`, "im"));
          if (!pnM) missing.push(`a \`${pn}:\` line (the ${pn === "state pass" ? "element-states" : "visual weight/alignment"} sweep the spine lacked — or \`${pn}: n/a — <why>\`)`);
          else if (/^n\/a\s*(?:—|--|::| - )\s*/i.test((pnM[1] || "").trim()) && (pnM[1] || "").trim().replace(/^n\/a\s*(?:—|--|::| - )\s*/i, "").length < 20) missing.push(`\`${pn}: n/a —\` without a real why (the opt-out needs ≥20 chars of reason)`);
          else if ((pnM[1] || "").trim().length < 10) missing.push(`a \`${pn}:\` line with content (the pass result, not a bare heading)`);
        }
      }
      if (existsSync(join(ROOT, artifactFor(`.unlazy/design-spec/${sid}.md`))) && !/##\s*budgets\b/i.test(text)) {
        missing.push("a ## Budgets section (spec'd change — countable divergence vs the exemplar: sections, controls, accents)");
      }
      // Spec'd changes carry the convergence half too: the ## Deltas
      // section enumerates every remaining difference vs. the spec's
      // exemplar — bidirectionally, each defended or an open finding
      // (13-design-spec.mdc → relationship to the design-review gate).
      if (existsSync(join(ROOT, artifactFor(`.unlazy/design-spec/${sid}.md`))) && !/##\s*deltas\b/i.test(text)) {
        missing.push("a ## Deltas section (spec'd change — every remaining difference vs. the exemplar, defended or open)");
      }
      // The composition instruments (09-design-review.mdc — assembled-
      // not-designed fixes): the unprimed read always; the referent
      // instruments when the Interpretation names one.
      if (!/##\s*cold\s*read\b/i.test(text)) missing.push("a ## Cold read section (the first-glance pass — run BEFORE the fix list is opened, 09-design-review)");
      if (referentLine && !/\bnone\b/i.test(referentLine)) {
        if (!/##\s*anatomy\s*diff\b/i.test(text)) missing.push("an ## Anatomy diff section (referent named — unit-level anatomy comparison vs the exemplar: lines per unit, payload allocation, region structure)");
        if (!/##\s*defense\b/i.test(text)) missing.push("a ## Defense section (one sentence per unit — designed because it shares <property> with <referent>; un-defendable units can't pass)");
      }
      // A required section with no body is not a section — the heading
      // alone is the avoided-the-question shape. 'none — <why>' is the
      // honest empty entry, so any non-empty body passes.
      for (const sec of ["predictions", "options", "unverified", "hypotheses", "constraint check", "lenses", "emphasis audit", "question verdicts", "revisions", "budgets", "deltas", "cold read", "anatomy diff", "defense", "stranger", "liveness", "provenance", "pre-flight"]) {
        if (new RegExp(`##\\s*${sec}\\b`, "i").test(text) && !sectionBody(text, sec)) {
          missing.push(`content inside ## ${sec[0].toUpperCase() + sec.slice(1)} (a bare heading is not the section — write the real rows or 'none — <why>')`);
        }
      }
      // Probe geometry + environment coverage (09-design-review →
      // ## Geometry + the defect-class enumeration): when a coverage probe
      // ran for this session, its flags need reconciliation rows and its
      // declared viewport matrix needs to cover the user's real
      // environment — presence ≠ reachability, verified-elsewhere ≠
      // verified.
      const covPath = join(ROOT, ".unlazy", "coverage", `${sid}.json`);
      if (existsSync(covPath)) {
        try {
          const cov = readJson(covPath);
          // A hand-written {"surfaces":[{…}]} or a file predating this
          // session's UI work is not a probe run — the probe's own
          // signature is what makes it an external instrument, not a
          // self-assertion: sid-bound, ISO timestamped, carrying the
          // matrixCheck block and surfaces with probe-shaped stateCounts.
          let covMtime = 0;
          try { covMtime = statSync(covPath).mtimeMs; } catch { /* unreadable */ }
          // A missing/forged-null stamp used to collapse to 0 and make
          // `covMtime >= 0` vacuous — stale dumps passed recency
          // (R15-F22). No stamp means no proof of recency → not real.
          const firstUi = state.ui_first_edit_at ? Date.parse(state.ui_first_edit_at) : null;
          if (state.ui_first_edit_at && Number.isNaN(firstUi)) missing.push(`state.ui_first_edit_at (${JSON.stringify(state.ui_first_edit_at)}) isn't a parseable timestamp — the coverage-probe ordering check can't run on a corrupted field`);
          // matrixCheck must be probe-shaped: all three keys as arrays
          // (the probe emits required/probed/missing unconditionally) and
          // probed non-empty — a real run always probes ≥1 viewport. A
          // self-declared {} or all-empty block skipped the matrix check
          // entirely while still counting as "probe-produced" (R12-F12).
          const probeShaped = cov && cov.sid === sid &&
            typeof cov.generatedAt === "string" && !Number.isNaN(Date.parse(cov.generatedAt)) &&
            cov.matrixCheck && typeof cov.matrixCheck === "object" &&
            Array.isArray(cov.matrixCheck.required) &&
            Array.isArray(cov.matrixCheck.probed) && cov.matrixCheck.probed.length > 0 &&
            Array.isArray(cov.matrixCheck.missing) &&
            Array.isArray(cov.surfaces) && cov.surfaces.length > 0 &&
            // `offsets:[]` is a legit surface shape — error pages and
            // zero-scroll surfaces produce none (R15-F21: requiring >0
            // rejected the whole dump with no remedy but EXEMPT). Empty
            // offsets make the per-offset stateCounts check vacuously
            // true, which is correct: nothing was scrollable.
            cov.surfaces.every((s) => s && typeof s === "object" &&
              Array.isArray(s.offsets) &&
              s.offsets.every((o) => o && typeof o === "object" && o.stateCounts && typeof o.stateCounts === "object"));
          // Recency needs BOTH stamps: mtime alone passes a stale dump
          // copied to a fresh path (copy refreshes mtime, not content),
          // and generatedAt alone is fully author-controlled (R16
          // own-walk). generatedAt is already validated parseable above.
          const covReal = probeShaped && firstUi != null && covMtime >= firstUi && Date.parse(cov.generatedAt) >= firstUi;
          if (!covReal) {
            missing.push(`a probe-produced coverage file (.unlazy/coverage/${sid}.json has empty surfaces or predates this session's UI work — rerun .devin/scripts/ui-coverage-probe.mjs)`);
          }
          // I1 provenance: shape recreates nothing about the producer — a
          // hand-authored file satisfies probeShaped trivially. The real
          // artifact lands within seconds BEFORE its run's completion
          // record (the tracker stamps probe_runs at PostToolUse), so a
          // ±30s window around a recorded run is the producer-binding;
          // a file outside every window was written, not produced.
          const probeRuns = (state.probe_runs || []).map((t) => Date.parse(t)).filter((n) => !Number.isNaN(n));
          const producedByRun = probeRuns.some((t) => covMtime >= t - 30000 && covMtime <= t + 30000);
          if (probeShaped && !producedByRun &&
              !/DECLARED\s*:\s*hand[-\s]?produced\s+coverage\s*[—–-]{1,2}\s*\S.{8,}/i.test(evidence || "") &&
              !exempt("COVERAGEPROVENANCE", "*")) {
            missing.push(`a probe-run provenance record — .unlazy/coverage/${sid}.json ${probeRuns.length ? "doesn't match any recorded probe run (mtime outside every run window)" : "exists but no ui-coverage-probe.mjs run was recorded this session"}. Rerun .devin/scripts/ui-coverage-probe.mjs so the artifact binds to the instrument, or DECLARED: hand-produced coverage — <why it was authored> in ${evidenceRel}`);
          }
          if (covReal && !/##\s*geometry\b/i.test(text)) {
            missing.push("a ## Geometry section (the probe ran — every clippedCandidates/occludedCandidates flag reconciled, 09-design-review)");
          }
          if (/##\s*geometry\b/i.test(text) && !sectionBody(text, "geometry")) {
            missing.push("content inside ## Geometry (the flags reconciled, or 'none — 0 flags across <N> surfaces')");
          }
          if (covReal && cov.matrixCheck && Array.isArray(cov.matrixCheck.missing) && cov.matrixCheck.missing.length &&
            !cov.matrixCheck.missing.every((vp) => exempt("VIEWPORT", String(vp))) && !exempt("VIEWPORT", "*")) {
            failures.push(
              `COVERAGE-MATRIX: the coverage probe declares required viewport(s) ${(cov.matrixCheck.required || []).join(", ") || "?"} ` +
              `but probed ${(cov.matrixCheck.probed || []).join(", ")} — missing ${cov.matrixCheck.missing.join(", ")}. The user's real ` +
              `environment was never rendered. Add it to the probe matrix and re-run, or EXEMPT-VIEWPORT: <vp> — <reason> in ${evidenceRel} (09-design-review → environment lens).`
            );
          }
        } catch { /* coverage JSON is best-effort */ }
      }
      // The recorded path is absolute for non-`app/` touches —
      // the artifact cites the repo-relative form, so compare both
      // (R15-F3: `.unlazy/` files armed by UNLAZY_RENDER_RE were
      // uncoverable by any honest citation). A ≥2-segment suffix also
      // names the file (`ui/x.js` for `app/ui/x.js`); a bare
      // basename is too weak to count. Compare the RAW text too — a
      // fenced `files touched:` listing is honest enumeration, while the
      // other section checks still read the fence-stripped `text`
      // (R16-F1: the call crashed on undefined relPath; the citation
      // forms were never actually compared).
      const covRaw = (readText(artifactPath) || "").replace(/\\/g, "/");
      const covText = text.replace(/\\/g, "/") + "\n" + covRaw;
      const uncovered = touched.filter((p) => {
        if (covText.includes(String(p).replace(/\\/g, "/"))) return false;
        const rel = relPath(p);
        if (covText.includes(rel)) return false;
        const segs = rel.split("/").filter(Boolean);
        return !(segs.length >= 2 && covText.includes(segs.slice(-2).join("/")));
      });
      // Reconciliations vs the spec (09-design-review → artifact
      // requirements): every spec lazy-signals row's "designed out by"
      // is a claim until this review's text verifies it, and generative
      // work carries the first-render eyes pass plus a cite here.
      {
        const specPath = join(ROOT, artifactFor(`.unlazy/design-spec/${sid}.md`));
        if (existsSync(specPath)) {
          const specText = fenceStrip(readText(specPath) || "");
          // Reconciliations bind on v2-era specs — a v1 spec's review
          // keeps v1 obligations (the instruments didn't exist for it).
          // v3 counts as v2+: without the ||, upgrading the marker opted
          // out of every arm below (lazy/state-space/affordance/first-
          // render/drill-down) — the version-opt-out bypass the authored-
          // now v3 rule exists to close (gs-v2 autopsy, found by the
          // gatest fixture upgrade).
          const specV2 = hasMarker(specText, "design-spec v2") || hasMarker(specText, "design-spec v3");
          const lazyBody = specV2 ? sectionBody(specText, "lazy signals") : null;
          if (lazyBody && !/^\s*none\b/im.test(lazyBody)) {
            const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
            const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            const rvNorm = norm(covText);
            const unrecon = lazyBody.split(/\r?\n/)
              .filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/^\s*\|\s*(where|signal|#|spot)\b/i.test(l))
              .filter((l) =>
                // A row reconciles when ANY ≥15-char normalized chunk of
                // its own text — the spot it names or the mitigation it
                // claims — appears verbatim in the review text.
                !l.split("|").slice(1, -1)
                  .map((c) => norm(c))
                  .filter((c) => c.length >= 15)
                  .some((c) => rvNorm.includes(c))).length;
            if (unrecon) {
              missing.push(`${unrecon} spec lazy-signals row(s) with no reconciliation here (each "designed out by" must appear in this artifact's evidence/findings text — self-attestation doesn't close the risk it names)`);
            }
          }
          // State-space drill (gs3 B6): the spec declares interactive
          // states — modals, sheets, expanded rows, the surfaces BEHIND
          // surfaces — and the user's drill-down complaint is exactly
          // that these never get designed, only the surface that opens
          // them. Each declared state name must appear in this review's
          // corpus: a verdict, a finding, a DECLARED — anything that
          // proves the state was rendered and judged, not just opened.
          {
            const ssBody = specV2 ? sectionBody(specText, "state space") : null;
            if (ssBody && !/^\s*none\b/im.test(ssBody)) {
              const sepReS = /^\s*\|[\s:\-|]+\|\s*$/;
              const normS = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
              const covNorm = normS(covText);
              const undisp = ssBody.split(/\r?\n/)
                .filter((l) => /^\s*\|/.test(l) && !sepReS.test(l) && !/^\s*\|\s*(state|surface|element|#|kind)\b/i.test(l))
                .map((l) => (l.split("|")[1] || "").trim().replace(/[`'"]/g, ""))
                .filter((name) => name.length >= 3 && !covNorm.includes(normS(name)));
              if (undisp.length) {
                missing.push(`state-space state(s) ${undisp.slice(0, 4).map((u) => `"${u}"`).join(", ")} with no disposition in this artifact — each declared interactive state needs rendered evidence or a written verdict naming it (the drill-down contract: a modal that opens a second surface gets the same design scrutiny as the surface that opened it; DECLARED: state <name> n/a — <why> releases)`);
              }
            }
          }
          // Per-surface affordance closure (gs3 B7): the spec's ###
          // <surface> derivation blocks name each page's declared
          // affordance set via `→` arrows — those names must appear in
          // this review's corpus, or the promised element was never
          // reviewed (declared-but-unseen is the recall-prior failure
          // with a spec attached).
          if (specV2) {
            const heads = [...specText.matchAll(/^#{3,4}\s+(.+)$/gim)].map((m) => ({ name: m[1].toLowerCase(), at: m.index }));
            const normA = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            const covNormA = normA(covText);
            const undispA = [];
            for (let i = 0; i < heads.length; i++) {
              const next = heads.slice(i + 1).find((h) => h.at > heads[i].at);
              const h2 = specText.indexOf("\n## ", heads[i].at);
              const block = specText.slice(heads[i].at, next ? next.at : (h2 > heads[i].at ? h2 : specText.length));
              if (!(block.match(/\?/g) || []).length) continue; // not a derivation block
              const toks = [...block.matchAll(/→\s*([^\n|]+)/g)]
                .flatMap((m) => m[1].split(/[,·+/]| and /i))
                .map((s) => s.trim().replace(/[`'"\[\]()]/g, ""))
                .filter((s) => s.length >= 8);
              for (const tk of toks) {
                const words = normA(tk).split(" ").filter((w) => w.length >= 4);
                if (words.length && !words.some((w) => covNormA.includes(w))) undispA.push(`"${tk.slice(0, 36)}"`);
                if (undispA.length >= 4) break;
              }
              if (undispA.length >= 4) break;
            }
            if (undispA.length) {
              missing.push(`declared affordance(s) ${undispA.join(", ")} never named in this review — elements the spec's derivation blocks promised must appear in coverage/findings text (a promise nobody reviewed is recall with a spec attached; DECLARED: affordance <name> n/a — <why> releases)`);
            }
          }
          if (specV2 && /##\s*directions\b/i.test(specText)) {
            const frRel = artifactFor(`.unlazy/eyes/${sid}-first-render.md`);
            const frPath = join(ROOT, ".unlazy", "eyes", `${sid}-first-render.md`);
            const frDecl = /DECLARED\s*:\s*first[-\s]?render\s+n\/a\s*(?:—|--|::| - )\s*.{10,}/i.test(covText + "\n" + specText);
            if (!frDecl) {
              // Credit-by-cite: a first-render pass deposited under a
              // different name (lake-alto's landed as -r1) still counts
              // — the contract is the pass + the cite, not the filename.
              let frFile = null, frLabel = frRel, frCited = false;
              if (existsSync(frPath)) frFile = frPath;
              else {
                const cited = [...new Set([...covText.matchAll(/\.unlazy\/eyes\/[\w.-]+\.md/gi)].map((m) => m[0]))]
                  .find((c) => existsSync(join(ROOT, c)) && hasMarker(readText(join(ROOT, c)) || "", "eyes v2"));
                if (cited) { frFile = join(ROOT, cited); frLabel = cited; frCited = true; }
              }
              if (!frFile) {
                missing.push(`the first-render eyes pass at ${frRel} (generative work — a stranger cold-read on the FIRST surface's first captures before the pattern propagates, eyes v2, briefed against ## Quality contract — or DECLARED: first-render n/a — <why>; a differently-named pass cited here also credits)`);
              } else {
                const frText = fenceStrip(readText(frFile) || "");
                if (!hasMarker(frText, "eyes v2")) missing.push(`the <!-- eyes v2 --> marker inside ${frLabel} (the first-render pass is a comprehensive critique, not a spot-check)`);
                if (!/^\s*agent\s*:/im.test(frText)) missing.push(`an \`Agent:\` line inside ${frLabel} (independence is attributed, not assumed)`);
                if (!/\bVERDICT\s*:\s*\S/i.test(frText)) missing.push(`a VERDICT: inside ${frLabel}`);
                if (!/^\s*brief\s*:/im.test(frText)) missing.push(`a Brief: inside ${frLabel} (the pass is briefed against ## Quality contract — the deposited brief is what makes it a quality verdict, not a bug sweep)`);
                if (!/##\s*(coverage|verdicts)\b/i.test(frText)) missing.push(`## Coverage + ## Verdicts inside ${frLabel} (per-surface verdict against the contract)`);
                if (!/##\s*scores\b/i.test(frText)) missing.push(`a ## Scores section inside ${frLabel} (per-surface 1–10 + named distance-to-bar — 'adequate' covers a 5 and an 8)`);
                else if (!/\b\d{1,2}\s*\/\s*10\b/.test(sectionBody(frText, "scores") || "")) missing.push(`a score row (N/10) inside ${frLabel} ## Scores (the number is what makes 'fine' visible)`);
                // Element enumeration (gs3 B5): a surface-level score
                // can sit beside broken elements — the squads-avatar
                // failure scored attention while its avatars were
                // unfinished. The stranger now grades per element, not
                // per vibe: ≥4 verdict rows inside ## Element
                // enumeration (or the pass DECLARED: why elements were
                // not individually gradeable).
                const elB = sectionBody(frText, "element enumeration") || "";
                if (!elB && !/DECLARED\s*:\s*elements?\s+n\/a/i.test(frText)) {
                  missing.push(`a ## Element enumeration section inside ${frLabel} (eyes-brief v2 — every element in the shot gets a verdict row: fine/defect/under-executed/unfinished; page-level scores sit beside broken elements, per-element rows can't)`);
                } else if (elB) {
                  const elRows = elB.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\belement\b[\s\S]*\bverdict\b/i.test(l));
                  const elVerdicted = elRows.filter((l) => /\b(fine|defect|under[-\s]?executed|unfinished|absence|broken)\b/i.test(l));
                  if (elVerdicted.length < 4) missing.push(`≥4 element-verdict rows inside ${frLabel} ## Element enumeration (has ${elVerdicted.length}) — a thin enumeration is a vibe grade wearing a table`);
                }
                // Paint-anchor (gs3 B9): when session coverage carries
                // paint-broken element names, the stranger's corpus must
                // name each — a probe-flagged element absent from the
                // pass is a region the enumeration skipped.
                try {
                  const covDir = join(ROOT, ".unlazy", "coverage");
                  const frNorm = frText.toLowerCase();
                  const unanch = [];
                  for (const cf of readdirSync(covDir)) {
                    if (!/\.json$/i.test(cf)) continue;
                    const cj = JSON.parse(readFileSync(join(covDir, cf), "utf-8"));
                    const brk = [...new Set((cj.surfaces || []).flatMap((s) => (s.offsets || []).flatMap((o) => (o.paint && o.paint.broken) || [])))];
                    for (const b of brk) {
                      const words = b.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/unpainted|painted|payload/.test(w));
                      if (words.length && !words.some((w) => frNorm.includes(w))) unanch.push(`"${b.slice(0, 42)}"`);
                      if (unanch.length >= 3) break;
                    }
                    if (unanch.length >= 3) break;
                  }
                  if (unanch.length) missing.push(`paint-flagged element(s) ${unanch.join(", ")} absent from ${frLabel} — the probe named them unpainted; an enumeration that skips a DOM-verified defect is the squads-avatar failure at eyes level`);
                } catch { /* no coverage dir — anchor best-effort */ }
                // Delta verdict (secdoc B10): on a restyle ask the
                // stranger must grade the DISTANCE from the baseline,
                // not just the destination — a "same chassis, new
                // tokens" ship reads identical to its own before-shot
                // and the verdict word makes that nameable.
                // cosmetic|invisible on a redesign ask is a finding the
                // review must disposition, not a pass.
                if (/##\s*delta\b/i.test(specText)) {
                  const dltB = sectionBody(frText, "delta") || "";
                  if (!dltB) {
                    missing.push(`a ## Delta verdict section inside ${frLabel} (restyle ask — the stranger grades before→after distance per region: transformative/meaningful/cosmetic/invisible; a pass that never saw the before cannot call the re-skin)`);
                  } else {
                    if (!/transformative|meaningful|cosmetic|invisible/i.test(dltB)) {
                      missing.push(`a delta verdict word inside ${frLabel} ## Delta (transformative / meaningful / cosmetic / invisible — the word is what makes "same chassis, new tokens" nameable)`);
                    }
                    if (/\b(?:cosmetic|invisible)\b/i.test(dltB) && !/delta\b[^\n]*(?:—|--|::|iterate|re-?shot|fixed|stands|accepted)/i.test(covText)) {
                      missing.push(`the ## Delta verdict (${(dltB.match(/cosmetic|invisible/i) || ["?"])[0]}) dispositioned in this review — a below-meaningful delta on a restyle ask is a finding, not a pass: iterate and re-shoot, or write 'delta: <verdict> — <why it stands>'`);
                    }
                  }
                }
              }
              if (!/first[-\s]?render/i.test(covText) && !frCited) {
                missing.push(`a first-render cite in this artifact (the review names the pass — the cite is what proves it fed the verdicts)`);
              }
            }
            // Spec-critique — a stranger critiques the spec's DECISIONS
            // before first render (the cheapest catch point for a
            // low-ceiling direction). Deposits at <sid>-spec.md; the
            // spec's ## Spec critique section or this review cites it.
            const spRel = artifactFor(`.unlazy/eyes/${sid}-spec.md`);
            const spPath = join(ROOT, ".unlazy", "eyes", `${sid}-spec.md`);
            const spDecl = /DECLARED\s*:\s*spec[-\s]?critique\s+n\/a\s*(?:—|--|::| - )\s*.{10,}/i.test(specText + "\n" + covText);
            if (!spDecl && !existsSync(spPath)) {
              missing.push(`the spec-critique eyes pass at ${spRel} (a stranger critiques the spec's decisions — ceiling, payload, bar/direction match — before first render, eyes v2 — or DECLARED: spec-critique n/a — <why>)`);
            } else if (existsSync(spPath)) {
              const spText = fenceStrip(readText(spPath) || "");
              if (!hasMarker(spText, "eyes v2")) missing.push(`the <!-- eyes v2 --> marker inside ${spRel}`);
              if (!/^\s*agent\s*:/im.test(spText)) missing.push(`an \`Agent:\` line inside ${spRel}`);
              if (!/\bVERDICT\s*:\s*\S/i.test(spText)) missing.push(`a VERDICT: inside ${spRel}`);
              if (!/##\s*(findings|critique|verdicts)\b/i.test(spText) || !((sectionBody(spText, "findings") || "") + (sectionBody(spText, "critique") || "") + (sectionBody(spText, "verdicts") || "")).replace(/[\s|—\-:]/g, "").length) {
                missing.push(`a non-empty critique/findings section inside ${spRel} (a spec-critique with no content never happened)`);
              }
            }
            // Coverage-union — the deposited eyes passes plus this
            // review must span every surface ## Surfaces declares. A
            // first-page-only read propagates the pattern un-reviewed.
            const surfBody = sectionBody(specText, "surfaces");
            if (surfBody) {
              const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
              const surfNames = surfBody.split(/\r?\n/)
                .filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/\|\s*surface\b/i.test(l))
                .map((l) => (l.split("|")[1] || "").trim())
                .filter((s) => s.length >= 3 && !/^surface$/i.test(s));
              if (surfNames.length) {
                const eyesDir = join(ROOT, ".unlazy", "eyes");
                let eyesAll = "";
                try {
                  eyesAll = readdirSync(eyesDir)
                    .filter((f) => f.startsWith(`${sid}-`) && f.endsWith(".md"))
                    .map((f) => fenceStrip(readText(join(eyesDir, f)) || ""))
                    .join("\n");
                } catch { /* no eyes dir */ }
                const covPool = (covText + "\n" + eyesAll).toLowerCase();
                const uncoveredSurf = surfNames.filter((s) => {
                  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  return !covPool.includes(s.toLowerCase()) && !new RegExp(`DECLARED[^\\n|]*${esc}`, "i").test(covText);
                });
                if (uncoveredSurf.length) {
                  missing.push(`eyes/review coverage never names ${uncoveredSurf.slice(0, 3).join(", ")} — every ## Surfaces row must be covered by a deposited eyes pass or this review's own coverage (per-row DECLARED releases)`);
                }
              }
            }
          }
          // Hollow-review floor — the critique sections need substance,
          // not a heading + a table skeleton (the lake-alto review's
          // Cold read/Verdicts/Findings were empty while a closure
          // claimed coverage). A finding-free artifact uses the
          // explicit 'No findings' line.
          if (specV2) {
            const substance = (sec) => (sectionBody(text, sec) || "").replace(/[\s|—\-:`]/g, "").length;
            if (substance("cold read") < 80) missing.push("a substantive ## Cold read (≥80 chars of actual critique — the uninstructed first-glance read, before the fix list opens)");
            if (referentLine && !/\bnone\b/i.test(referentLine) && substance("verdicts") < 60) missing.push("a substantive ## Verdicts section (per-surface verdict rows, not a bare skeleton)");
            if (!/no findings/i.test(text) && substance("findings") < 60) missing.push("a substantive ## Findings section (rows with evidence, or an explicit 'No findings')");
            // Element drill-down — every Inventory element graded for
            // EXECUTION, not presence; under-executed elements are the
            // findings a presence-check never writes. The floor scales
            // with the spec's ## Inventory row count (C4): ≥ceil(rows/3)
            // drill rows — a 20-element spec owes 7; ≤9 stays at the
            // fixed floor of 3; no ## Inventory → floor unchanged.
            if (/##\s*inventory\b/i.test(specText)) {
              const invB = sectionBody(specText, "inventory") || "";
              const invDataRows = invB.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\|\s*(element|data role)\s*\|/i.test(l)).length;
              const edFloor = Math.max(3, Math.ceil(invDataRows / 3));
              const edB = sectionBody(text, "element drill-down") || "";
              const edRows = edB.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\|\s*element\s*\|/i.test(l)).length;
              if (edRows < edFloor && !/DECLARED\s*:\s*(drill|element)[-\s]?down\s+n\/a/i.test(text)) {
                missing.push(`an ## Element drill-down section (≥${edFloor} rows — ceil(${invDataRows} inventory rows / 3): every inventory element graded for execution — under-executed elements become findings; presence-checks alone let flat media pass)`);
              }
            }
          }
        }
      }
      // ─── v3 review-side checks ───
      // The spec halves of these checks read this session's spec doc —
      // re-loaded here because the reconciliation block above scopes
      // its own copy.
      const specPathR = join(ROOT, artifactFor(`.unlazy/design-spec/${sid}.md`));
      const specTextR = existsSync(specPathR) ? fenceStrip(readText(specPathR) || "") : "";
      // Distance-to-referent: a named referent earns the graded region
      // comparison — verdicts without distance measurement are how a
      // 4/10 surfaces as "matches spec" (D5). Scoped to referent-named
      // reviews; referent:none + defense stays disarmed lawfully.
      if (referentLine && !/\bnone\b/i.test(referentLine)) {
        const distB = sectionBody(text, "distance-to-referent") || sectionBody(text, "distance to referent") || "";
        if (!distB) {
          missing.push("a ## Distance-to-referent section (v3 — the graded region-by-region comparison vs the named referent/exemplar: region | shipped | referent | Δ; verdicts without measured distance are conformance-graded, not quality-graded)");
        } else {
          const distRows = distB.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\|\s*region\s*\|/i.test(l));
          if (distRows.length < 1 && !/DECLARED\s*:\s*distance[-\s]?to[-\s]?referent\s+n\/a/i.test(text)) {
            missing.push("≥1 region row inside ## Distance-to-referent (each region of the surface graded against its referent counterpart — the comparison that turns 'meets spec' into 'how far from the bar')");
          }
        }
      }
      // Risk re-check parity: the v3 spec's ## Risk register is live —
      // every risk row gets a status re-grade in the review. A register
      // written and never re-fired is a grave, not a guard (D10). Rows
      // marked `triggered` need a disposition, not just the observation.
      if (specTextR && /##\s*risk\s+register\b/i.test(specTextR)) {
        const specRiskB = sectionBody(specTextR, "risk register") || "";
        const specRiskRows = specRiskB.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\|\s*risk\s*\|/i.test(l) && !/\|\s*<from/i.test(l) && !/AXIS-NA\s*:/i.test(l));
        if (specRiskRows.length) {
          const rrB = sectionBody(text, "risk re-check") || "";
          if (!rrB) {
            missing.push(`a ## Risk re-check section (v3 — the spec's ${specRiskRows.length} risk-register row(s) re-graded against the shipped surface: risk | status | disposition; registers written and never re-fired catch nothing)`);
          } else {
            const rrRows = rrB.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\|\s*risk\s*\|/i.test(l));
            if (rrRows.length < specRiskRows.length) {
              missing.push(`## Risk re-check to carry ≥${specRiskRows.length} row(s) — one per spec risk-register row (has ${rrRows.length}); each risk gets a status, not a skim`);
            }
            // Status-cell-anchored: a risk counts as fired only when the
            // status cell positively marks it — "not triggered", "re-fired:
            // not triggered" and "never fired" are clean outcomes, not
            // confirmations (luminous-munchkin FP: `re-fired: not triggered`
            // matched `fired` and `triggered` inside the negation).
            const trigNoDispo = rrRows.filter((l) => {
              const status = (l.split("|")[2] || "").trim();
              const fired = /^(?:triggered|fired|confirmed|hit|realized)\b/i.test(status);
              return fired && !/fix|filed|disposition|accepted|bounded|mitigat|downgrad|monitor/i.test(l);
            });
            if (trigNoDispo.length) {
              missing.push(`${trigNoDispo.length} risk re-check row(s) marked triggered with no disposition — a confirmed risk needs a fix, a filing, or an accepted-residual; the observation alone is the v3-spec failure the register exists to prevent`);
            }
          }
        }
      }
      // Audience-width coverage: the spec's audience row derives the
      // viewport matrix — a consumer-desktop audience owes ≥2560 (the
      // 3840-monitor failure at D4); an explicit declared width overrides.
      if (specTextR) {
        const ledB = sectionBody(specTextR, "constraint ledger") || "";
        const audRow = (ledB.match(/^\s*\|\s*audience\s*\|.*$/im) || [""])[0];
        if (audRow) {
          const declaredW = (audRow.match(/(\d{3,5})\s*px/i) || audRow.match(/[≥>]\s*(\d{3,5})/) || [])[1];
          const needW = declaredW ? parseInt(declaredW, 10) : (/desktop|monitor|living[-\s]?room|tv\b|4k|uhd|consumer/i.test(audRow) ? 2560 : 0);
          if (needW > 0) {
            const covB = sectionBody(text, "coverage") || "";
            const widths = (covB.match(/\b(\d{3,5})\b/g) || []).map((w) => parseInt(w, 10));
            const shotW = (text.match(/\b(\d{3,5})\s*(?:px|w|wide)?\b/gi) || []).map((w) => parseInt(w, 10));
            const allW = widths.concat(shotW);
            if (!allW.some((w) => w >= needW) && !/DECLARED\s*:\s*matrix[-\s]?width\s+n\/a/i.test(text)) {
              missing.push(`a coverage row at ≥${needW}px (the spec's audience row declares ${declaredW ? declaredW + "px" : "a desktop-class audience"} — the matrix derives from it, not the 1440/768/390 convention; a 3840 monitor is outside every 1440 matrix)`);
            }
          }
        }
      }
      if (missing.length || uncovered.length) {
        failures.push(
          `DESIGN-REVIEW: ${artifactRel} incomplete — ` +
          (missing.length ? `missing ${missing.join(", ")}; ` : "") +
          (uncovered.length ? `uncovered files: ${uncovered.join(", ")}` : "")
        );
      }

      // --- closure-language ban -------------------------------------------
      tick("closure-language ban");
      // "Residual" and its synonyms are unfinished work wearing a closed
      // label. Any occurrence blocks unless the line is an explicit
      // ACCEPTED: or BLOCKED: ledger entry the user agreed to.
      const banned = /\b(residual|known issue|nice[- ]to[- ]have|for later|future work|not this pass|out of scope|leftover|deferred)\b/i;
      // Strip path/file tokens before scanning: the coverage check above
      // requires literal touched paths in the artifact, and a filename may
      // legitimately contain a banned word (e.g. chat-deferred.css). The ban
      // targets prose labels, not identifiers.
      const stripPaths = (l) =>
        l
          .replace(/\S+[\\/]\S*/g, " ")
          .replace(/\S+\.(?:js|mjs|cjs|ts|tsx|css|html|j2|py|md|mdc|json)\b/gi, " ");
      // Relocation laundering: "work moved to later-pass/x.md" strips to
      // "work moved to" and reads clean — a deferral whose label lives
      // inside the path token. Relocation verb + pathish target without
      // a disposition is still unfinished work.
      // Deferral-shaped verbs (parked/carried/punted/shunted/deposited)
      // flag on any object — "moved the fix to lib/x.js" is a completed
      // refactor, not deferral, so neutral verbs additionally require an
      // open-work noun (items/findings/tasks/rest/leftover…).
      // Deferral destinations: path-ish (`to ui/x.js`), ledger docs
      // (`to .unlazy/`), or deferral vocabulary (`to the backlog`,
      // `into next-pass`, `under later`) — "moved the work to the
      // backlog" relocated open work without naming a file.
      const RELOC_DEST = String.raw`(?:the\s+|a\s+|an\s+)?(?:\S*[\\/.][\w.-]|\S*(?:backlog|icebox|later|next\b|future)\S*)`;
      const RELOCATE_RE = new RegExp(
        String.raw`\b(?:parked|punted|carried|shunted|deposited|deferred)\s+\S+(?:\s+\S+){0,2}\s+(?:to|into|under)\s+${RELOC_DEST}` +
        String.raw`|\b(?:moved?|deferred)\s+(?:the\s+)?(?:work|items?|findings?|tasks?|units?|rest|remainder|remaining|open|leftover|unfinished|residual)s?\s+(?:to|into|under)\s+${RELOC_DEST}` +
        String.raw`|\b(?:work|items?|findings?|tasks?|units?|rest|remainder|remaining|open|leftover|unfinished|residual)s?\s+(?:was\s+|were\s+|gets?\s+)?(?:moved?|parked|carried|punted|deposited|shunted|deferred)\s+(?:to|into|under)\s+${RELOC_DEST}`, "i");
      const badLines = text.split(/\r?\n/).filter(
        (l) => (banned.test(stripPaths(l)) || RELOCATE_RE.test(l)) && !disposedOf(l.trim(), acceptedOk)
      );
      if (badLines.length) {
        failures.push(
          `CLOSURE-LANGUAGE: ${artifactRel} uses banned unfinished-work labels — ` +
          `"${badLines[0].trim().slice(0, 120)}"${badLines.length > 1 ? ` (+${badLines.length - 1} more)` : ""}. ` +
          `Unfinished items are OPEN findings that keep the work going, "BLOCKED: <blocker>" rows, or "ACCEPTED: <deferral the user agreed to this session>" rows. There is no residual state.`
        );
      }

      // --- findings terminal-state check -----------------------------------
      tick("findings terminal-state check");
      // Every findings-table row must end in a terminal status:
      // FIXED | VERIFIED | FILED: <tracker> | CARRIED: <carried where> |
      // BLOCKED: <what> | ACCEPTED: <user deferral> |
      // NOT-A-DEFECT: <why it was never broken>. A row left OPEN at stop
      // means work was abandoned mid-ledger — "open — needs X" is a
      // non-terminal marker, not a disposition.
      // Detection is structural, not section-name- or ID-shape-based:
      // any table whose header carries a finding/severity/disposition
      // column is a findings table — wherever it sits (a `## Findings —
      // slice N` addendum and audit-appendix tables escaped both the old
      // ID-prefix filter and a first-section-only parse). The header row
      // is identified by the separator row that follows it, so `| # |`
      // headers can't masquerade as findings.
      const lastCell = (l) => {
        const cs = l.split("|").map((c) => c.trim()).filter(Boolean);
        return cs[cs.length - 1] || "";
      };
      // The disposition lives in the LAST cell — `| OPEN | fixed in F3 |`
      // is not terminal just because a later cell carries the keyword.
      const terminal = (l) =>
        /^(fixed|verified|filed\s*:|carried\s*:|blocked\s*:|not-a-defect\s*:)/i.test(lastCell(l)) ||
        (/^accepted\s*:/i.test(lastCell(l)) && USER_VERB_RE.test(l) && acceptedOk(l));
      const FINDINGS_HDR_RE = /\b(finding|severity|disposition)\b/i;
      // …but the word must be a column LABEL (`| finding |`, `| sev |`),
      // not a word inside a data cell's prose — a coverage row that says
      // "4 findings VERIFIED" is not a findings-table header, and treating
      // it as one scans hundreds of inventory rows as findings.
      // `disposition` is NOT a label — R14-F15 removed it from the
      // ledger sibling but this copy kept it, so a `| decision |
      // disposition |` verdict/decision table mis-scans as a findings
      // table (R15-F1).
      const FINDINGS_LABEL_RE = /^(?:findings?|severity|sev)$/i;
      const isFindingsHeader = (l) =>
        /^\s*\|/.test(l) && FINDINGS_HDR_RE.test(l) &&
        l.split("|").some((c) => FINDINGS_LABEL_RE.test(c.trim()));
      const SEP_RE = /^\s*\|[\s:\-|]+\|\s*$/;
      const artLines = text.split(/\r?\n/);
      const openRows = [];
      for (let i = 0; i < artLines.length - 1; i++) {
        if (!isFindingsHeader(artLines[i])) continue;
        // A `|---|` separator is the textbook shape — but dropping it
        // must not escape the scan; header+data is still a table.
        if (SEP_RE.test(artLines[i + 1])) i++;
        else if (!/^\s*\|/.test(artLines[i + 1])) continue;
        for (let j = i + 1; j < artLines.length && /^\s*\|/.test(artLines[j]); j++) {
          if (!terminal(artLines[j])) openRows.push(artLines[j]);
          else if (/^blocked\s*:/i.test(lastCell(artLines[j]))) blockedOpen.push(artLines[j].trim().slice(0, 80));
        }
      }
      // Backstop independent of header vocabulary: a row ENDING in a bare
      // open-status cell is an undispositioned finding under any header —
      // `| issue | impact | state |` tables rename their way out of the
      // header scan but can't rename `| OPEN |`.
      for (const l of artLines) {
        if (!/^\s*\|/.test(l) || openRows.includes(l)) continue;
        // BARE status token only — `open → confirmed` is a lifecycle
        // description and `Open call 10` is a pointer to the open-calls
        // section; neither is a status cell. A finding's undispositioned
        // state is the token alone, optionally dash-tailed.
        if (BARE_OPEN_CELL_RE.test(lastCell(l))) openRows.push(l);
      }
      if (openRows.length) {
        failures.push(
          `OPEN-FINDINGS: ${openRows.length} findings row(s) in ${artifactRel} have no terminal status ` +
          `(first: "${openRows[0].trim().slice(0, 120)}"). ` +
          `End each row with | FIXED | VERIFIED | FILED: <tracker> | CARRIED: <where it went> | BLOCKED: <blocker> | ACCEPTED: <user-agreed deferral> | NOT-A-DEFECT: <why never broken>. An open row at stop means the work is not done — keep going or name the blocker.`
        );
      }

      // --- artifact-backfill ------------------------------------------------
      tick("artifact-backfill");
      // The artifact is a live ledger — critique rows land as surfaces are
      // reviewed, throughout the session. A single-burst write after many
      // UI edits means the paperwork was filled to pass the gate, not
      // worked — the breeze signature made visible. (Exec-appends don't
      // count as writes — the tracker only sees edit/write calls; a
      // genuinely incremental artifact touched that way needs the
      // exemption line, which stays auditable.)
      if ((state.ui_edit_count || 0) >= 8 && (state.artifact_writes || 0) <= 1 && !exempt("BACKFILL", "*")) {
        failures.push(
          `ARTIFACT-BACKFILL: ${artifactRel} was written ${state.artifact_writes || 0} time(s) across ${state.ui_edit_count} UI edits — ` +
          `the ledger accrues rows as surfaces are reviewed, during the work. Rebuild it as a live record (append rows per pass through the session), ` +
          `or EXEMPT-BACKFILL: * — <reason> in ${evidenceRel} (09-design-review.mdc — the artifact is the work, not its epilogue).`
        );
      }

      // --- element-scrutiny -------------------------------------------------
      tick("element-scrutiny");
      // The element-level second look (09-design-review → element
      // scrutiny): verdicts judge surfaces whole, they can't catch "put
      // down an input box and moved on." Every touched surface needs ≥1
      // scrutiny row questioning an element's placement / size / finish —
      // each row ends APPLIED: <improvement made> or DEFENDED: <why it
      // holds>. An element never questioned was passed, not finished.
      // Armed on all UI work — the input-box failure class is not
      // appearance-class-only.
      const exemplarLine = (text.match(/\bexemplar\s*:\s*(.*)/i) || [])[1] || "";
      const appearanceClass =
        (referentLine && !/\bnone\b/i.test(referentLine)) ||
        (exemplarLine && !/\bnone\b/i.test(exemplarLine));
      if (!exempt("SCRUTINY", "*")) {
        const sBody = sectionBody(text, "scrutiny");
        if (!sBody) {
          failures.push(
            `ELEMENT-SCRUTINY: ${artifactRel} has no ## Scrutiny section — ` +
            `the element-level second look is required on all UI work. ` +
            `| element (surface context) | axis | what I questioned (a real doubt) | evidence (type-checked per axis) | APPLIED: | DEFENDED: | RAISED: | ` +
            `— ≥1 visual row per covered surface + one row per axis (functional/security/performance/quality) or AXIS-NA: <axis> — <reason>, ` +
            `or EXEMPT-SCRUTINY: * — <reason> in ${evidenceRel} (09-design-review.mdc → element scrutiny).`
          );
        } else {
          const sLines = sBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l.trim()));
          const sRows = sLines.filter(
            (l, i) => !(i === 0 && /\belement\b|\baxis\b/i.test(l)) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l)
          );
          const AXIS_RE = /^(visual|functional|security|performance|quality)$/i;
          const EVIDENCE_RE = {
            visual: /shot|screenshot|render|probe|paint|looks|appears|reads|shows|\b\d{3,4}px\b/i,
            functional: /probe|click|submit|render|state|observ|empty|error|load|hover|focus|open|close|typed|enter/i,
            security: /[\w./-]+\.(js|mjs|cjs|ts|py|css|html|j2)\s*:\s*\d+|n\/a\s*:/i,
            performance: /\d|n\/a\s*:/i,
            quality: /./,
          };
          const sBad = [];
          const axesSeen = new Set();
          for (const l of sRows) {
            const cells = l.split("|").map((c) => c.trim()).filter(Boolean);
            const last = cells[cells.length - 1] || "";
            if (!/^(APPLIED\s*:|DEFENDED\s*:|RAISED\s*:)/i.test(last)) {
              sBad.push(`scrutiny row missing outcome: "${l.trim().slice(0, 100)}"`);
              continue;
            }
            if (/^DEFENDED\s*:/i.test(last) && last.replace(/^DEFENDED\s*:\s*/i, "").split(/\s+/).filter(Boolean).length < 5) {
              sBad.push(`DEFENDED without a written reason: "${last.slice(0, 80)}"`);
            }
            // Axis + evidence columns: cells[1] names the axis, cells[3]
            // cites the proof type that axis runs on — a security row with
            // no file:line citation and a functional row with no exercised
            // state are verification claims that never happened.
            const axis = (cells[1] || "").toLowerCase();
            if (!AXIS_RE.test(axis)) {
              sBad.push(`row has no axis cell (visual|functional|security|performance|quality): "${l.trim().slice(0, 90)}"`);
              continue;
            }
            axesSeen.add(axis);
            // A visual DEFENDED on appearance-class work is an aesthetic
            // claim — it cites the anchor (ref:) or owns the absence
            // (no-referent:), the way a security n/a cites its reason.
            // "Looks right" unanchored is the self-grade this exists to kill.
            if (appearanceClass && axis === "visual" && /^DEFENDED\s*:/i.test(last) && !/\bref\s*:|no-referent\s*:/i.test(last)) {
              sBad.push(`visual DEFENDED cites no referent (needs 'ref: <anchor>' or 'no-referent: <honest absence>'): "${last.slice(0, 80)}"`);
            }
            const questioned = cells[2] || "";
            if (questioned.split(/\s+/).filter(Boolean).length < 8) {
              sBad.push(`'what I questioned' names no real doubt (${questioned.split(/\s+/).filter(Boolean).length}w): "${questioned.slice(0, 80)}"`);
            }
            const ev = cells[3] || "";
            const evRe = EVIDENCE_RE[axis];
            if (evRe && !(evRe.test(ev) && ev.split(/\s+/).filter(Boolean).length >= (axis === "security" ? 1 : 4))) {
              sBad.push(`${axis} row's evidence is the wrong type or empty: "${ev.slice(0, 80)}"`);
            }
            if (axis === "security" && /^n\/a\s*:/i.test(ev) && ev.replace(/^n\/a\s*:\s*/i, "").split(/\s+/).filter(Boolean).length < 5) {
              sBad.push(`security n/a without a written reason: "${ev.slice(0, 80)}"`);
            }
            if (axis === "performance" && /^n\/a\s*:/i.test(ev) && ev.replace(/^n\/a\s*:\s*/i, "").split(/\s+/).filter(Boolean).length < 5) {
              sBad.push(`performance n/a without a written reason: "${ev.slice(0, 80)}"`);
            }
            // D2: the expansion question lands on the row too — the
            // element is either `expandable: <named sub-unit>` (it becomes
            // a subject) or `sole — <why ≥30 chars>` (closed honestly).
            // Uniform: no granularity judgment is left to the writer.
            if (!/\bexpandable\s*:\s*\S/i.test(l) && !/\bsole\s*(?:—|--|::| - )\s*\S.{29}/i.test(l)) {
              sBad.push(`scrutiny row without an expansion verdict (needs \`expandable: <named sub-unit>\` or \`sole — <why ≥30 chars>\`): "${l.trim().slice(0, 90)}"`);
            }
          }
          // Axis completeness — design is one axis of five. A session that
          // never wrote a security/performance/quality row on touched code
          // checked the look and skipped the substance. AXIS-NA: <axis> —
          // <reason> lines inside the section are the honest opt-out.
          for (const ax of ["functional", "security", "performance", "quality"]) {
            if (!axesSeen.has(ax) && !new RegExp(`AXIS-NA\\s*:\\s*${ax}\\b`, "i").test(sBody)) {
              sBad.push(`no ${ax}-axis scrutiny row and no AXIS-NA: ${ax} — <reason> line`);
            }
          }
          // Coverage: ≥1 scrutiny row per repainted surface — verdict
          // surfaces when the artifact has them (those are the repaints),
          // else the non-file rows of the first coverage table (file rows
          // are plumbing — there is no element to place or size). A
          // surface whose elements were never questioned was painted,
          // not finished.
          const stemOf = (s, n) =>
            s.toLowerCase().replace(/[^\w\s·@]/g, "").split(/\s+/).slice(0, n).join(" ");
          const needed = [];
          const vvBody = sectionBody(text, "verdicts");
          if (vvBody) {
            for (const l of vvBody.split(/\r?\n/)) {
              if (!/^\s*\|/.test(l.trim()) || /^\s*\|[\s:\-|]+\|\s*$/.test(l) || /\bsurface\b/i.test(l.split("|")[1] || "")) continue;
              const s = stemOf((l.split("|").map((c) => c.trim()).filter(Boolean)[0] || ""), 4);
              if (s && !needed.includes(s)) needed.push(s);
            }
          } else {
            for (let i = 0; i < artLines.length - 1; i++) {
              if (!/^\s*\|\s*surface\b/i.test(artLines[i]) || !SEP_RE.test(artLines[i + 1])) continue;
              for (let j = i + 2; j < artLines.length && /^\s*\|/.test(artLines[j]); j++) {
                const cell = artLines[j].split("|").map((c) => c.trim()).filter(Boolean)[0] || "";
                if (/[\\/]|\.(js|css|py|md|j2|html)\b/i.test(cell)) continue;
                const s = stemOf(cell, 3);
                if (s && !needed.includes(s)) needed.push(s);
              }
              break;
            }
          }
          const sText = sRows.join("\n").toLowerCase();
          const noScrutiny = needed.filter((s) => !sText.includes(s));
          if (noScrutiny.length) {
            sBad.push(`${noScrutiny.length} covered surface(s) have no scrutiny row: ${noScrutiny.slice(0, 3).join("; ")}`);
          }
          if (sBad.length) {
            failures.push(
              `ELEMENT-SCRUTINY: ${artifactRel} ## Scrutiny has ${sBad.length} invalid row(s) — ` +
              `first: "${sBad[0]}". Each row questions a real element (placement/size/finish) and ends APPLIED: <change> | DEFENDED: <reason>.`
            );
          }
        }
      }

      // --- taste-verdict ---------------------------------------------------
      tick("taste-verdict");
      // Appearance-class work (Interpretation names a real referent or
      // exemplar) must close each repainted surface with a written
      // composition verdict — the chef tastes the food (09-design-review
      // → composition verdict). The failure it kills: a full polish pass
      // reported "verified" where verified meant "the fix is on camera" —
      // flat, undesigned surfaces passed because no step forced a judgment
      // to be *written*. The gate verifies a verdict exists per surface,
      // that the description is structural (≥15 words, not adjective-only),
      // that the weakest area is named or defended, and that the row ends
      // in a verdict token — not whether the judgment is good (audit, not
      // gate, same doctrine as findings).
      if (appearanceClass && !exempt("VERDICT", "*")) {
        const vBody = sectionBody(text, "verdicts");
        if (!vBody) {
          failures.push(
            `TASTE-VERDICT: ${artifactRel} names a referent/exemplar (appearance-class work) but has no ## Verdicts section. ` +
            `Mechanical verification ("the fix is on camera") is not a design judgment — write one row per repainted surface: ` +
            `| surface | what a stranger sees (structural, ≥15 words) | weakest area (or none — <defense>) | AT-BAR or BELOW-BAR: <what it lacks> | ` +
            `— or EXEMPT-VERDICT: * — <reason> in ${evidenceRel} (09-design-review.mdc → composition verdict).`
          );
        } else {
          const vLines = vBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l.trim()));
          // Drop header + separator rows; what remains are verdict rows.
          // Header detection is cell-vocabulary, not "any hyphen" — a
          // headerless first row (…| AT-BAR |) was dropped wholesale
          // and TASTE-VERDICT passed vacuously (R15-F2).
          const vRows = vLines.filter(
            (l, i) => !(i === 0 && isHeaderishRow(l)) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l)
          );
          const ADJ_ONLY_RE = /^[\s]*(clean|fine|good|nice|ok(?:ay)?|polished|sleek|premium|modern|crisp|beautiful|stylish|minimal|solid)([.,!\s]|$)/i;
          const badVerdicts = [];
          let sawAtBar = 0;
          let sawNamedWeakest = 0;
          let sawFiledObjection = 0;
          for (const l of vRows) {
            const cells = l.split("|").map((c) => c.trim()).filter((c) => c.length);
            const last = cells[cells.length - 1] || "";
            if (!/^(AT-BAR|BELOW-BAR\s*:)/i.test(last)) {
              badVerdicts.push(`row missing verdict token: "${l.trim().slice(0, 100)}"`);
              continue;
            }
            if (/^AT-BAR/i.test(last)) sawAtBar++;
            // Claim-vs-counter: the third-from-last cell holds the
            // STRONGEST OBJECTION — the best argument the surface is not
            // good enough, rebutted or raised. A verdict that never
            // steelmanned the no-side wasn't tested. Then the lever
            // (penultimate) and the verdict token (last). <6 cells means
            // the adversarial column is absent entirely.
            if (cells.length < 6) {
              badVerdicts.push(`row missing the strongest-objection/lever columns (${cells.length} cells): "${l.trim().slice(0, 90)}"`);
              continue;
            }
            const objection = cells[cells.length - 3] || "";
            if (/^none\b/i.test(objection)) {
              const defense = objection.replace(/^none\b\s*[—:\-]?\s*/i, "");
              if (defense.split(/\s+/).filter(Boolean).length < 5) {
                badVerdicts.push(`objection 'none' without a written defense: "${objection.slice(0, 80)}"`);
              }
            } else if (objection.split(/\s+/).filter(Boolean).length < 10) {
              badVerdicts.push(`strongest objection not argued (${objection.split(/\s+/).filter(Boolean).length}w): "${objection.slice(0, 80)}"`);
            } else sawFiledObjection++;
            const lever = cells[cells.length - 2] || "";
            if (/^none\b/i.test(lever)) {
              const defense = lever.replace(/^none\b\s*[—:\-]?\s*/i, "");
              if (defense.split(/\s+/).filter(Boolean).length < 5) {
                badVerdicts.push(`lever 'none' without a written defense: "${lever.slice(0, 80)}"`);
              }
            } else if (lever.split(/\s+/).filter(Boolean).length < 4) {
              badVerdicts.push(`biggest lever not named (${lever.split(/\s+/).filter(Boolean).length}w): "${lever.slice(0, 80)}"`);
            }
            const desc = cells[1] || "";
            const words = desc.split(/\s+/).filter(Boolean).length;
            if (words < 15 || (ADJ_ONLY_RE.test(desc) && words < 15)) {
              badVerdicts.push(`non-structural description (${words}w): "${desc.slice(0, 80)}"`);
            }
            const weakest = cells[2] || "";
            if (/^none\b/i.test(weakest)) {
              const defense = weakest.replace(/^none\b\s*[—:\-]?\s*/i, "");
              if (defense.split(/\s+/).filter(Boolean).length < 5) {
                badVerdicts.push(`weakest 'none' without a written defense: "${weakest.slice(0, 80)}"`);
              } else sawNamedWeakest++;
            } else if (weakest.length) sawNamedWeakest++;
          }
          // An all-clear across every repainted surface is the non-judgment
          // signature: a pass that finds nothing weak judged nothing.
          if (vRows.length >= 2 && sawAtBar === vRows.length && sawNamedWeakest === 0) {
            badVerdicts.push(
              `all ${vRows.length} verdicts AT-BAR with no weakest area defended — an all-clear across repainted surfaces is a pass where the judging never happened (09-design-review.mdc)`
            );
          }
          // And an all-clear where no objection was ever argued is the
          // adversarial step skipped: the no-side was never steelmanned.
          if (vRows.length >= 3 && sawAtBar === vRows.length && sawFiledObjection === 0) {
            badVerdicts.push(
              `all ${vRows.length} verdicts AT-BAR with zero argued objections — the strongest-case-against was never written (claim-vs-counter, 09-design-review.mdc)`
            );
          }
          if (badVerdicts.length) {
            failures.push(
              `TASTE-VERDICT: ${artifactRel} ## Verdicts has ${badVerdicts.length} invalid row(s) — ` +
              `first: "${badVerdicts[0]}". Each row: | surface | what a stranger sees (structural, ≥15 words, no adjective-only) | weakest area or none — <defense> | strongest objection (argued, ≥10 words — or none — <defense>) | biggest lever (or none — <defense>) | AT-BAR | BELOW-BAR: <finding/lack> |.`
            );
          }

          // --- excellence enumeration (## Raises) --------------------------
          // "What would make this an extremely good product" must be a
          // written enumeration, not a vibe: per repainted surface, name
          // what the best version of it does that this one doesn't — each
          // entry either raised to a finding (RAISED: <id>) or defended
          // (DEFENDED: <why the bar doesn't require it>). Zero raises on a
          // repainted surface = the excellence question was never asked.
          const rBody = sectionBody(text, "raises");
          if (!rBody || rBody.length === 0) {
            failures.push(
              `TASTE-VERDICT: ${artifactRel} has verdicts but no ## Raises section — ` +
              `the excellence enumeration is the second half of the verdict: | surface | what the best version does that this doesn't | RAISED: <finding id> or DEFENDED: <why> |.`
            );
          } else {
            const rLines = rBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l.trim()));
            const rRows = rLines.filter(
              (l, i) => !(i === 0 && isHeaderishRow(l)) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l)
            );
            const rBad = [];
            for (const l of rRows) {
              const cells = l.split("|").map((c) => c.trim()).filter(Boolean);
              const last = cells[cells.length - 1] || "";
              if (!/^(RAISED\s*:|DEFENDED\s*:)/i.test(last)) {
                rBad.push(`raise row missing disposition: "${l.trim().slice(0, 100)}"`);
              } else if (/^DEFENDED\s*:/i.test(last)) {
                const defense = last.replace(/^DEFENDED\s*:\s*/i, "");
                if (defense.split(/\s+/).filter(Boolean).length < 5) {
                  rBad.push(`DEFENDED without a written reason: "${last.slice(0, 80)}"`);
                }
              }
            }
            // Coverage: each verdict surface's first words must appear in
            // some raises row — otherwise that surface's excellence
            // question was skipped.
            const surfaces = vRows.map((l) =>
              (l.split("|").map((c) => c.trim()).filter(Boolean)[0] || "")
                .toLowerCase().replace(/[^\w\s·@]/g, "").split(/\s+/).slice(0, 4).join(" ")
            ).filter(Boolean);
            const rText = rRows.join("\n").toLowerCase();
            const uncovered = surfaces.filter((s) => !rText.includes(s));
            if (uncovered.length) {
              rBad.push(`${uncovered.length} verdict surface(s) have no raises row: ${uncovered.slice(0, 3).join("; ")}`);
            }
            if (rBad.length) {
              failures.push(
                `TASTE-VERDICT: ${artifactRel} ## Raises has ${rBad.length} invalid row(s) — ` +
                `first: "${rBad[0]}". Each repainted surface gets ≥1 raise: | surface | what the best version does that this doesn't | RAISED: <finding id> | DEFENDED: <reason> |.`
              );
            }
          }

          // --- absences walk (## Absences) ---------------------------------
          // Enumeration finds wrong-things-present; right-things-absent
          // need their own question — and the question is unfakeable only
          // when it's comparative: each row must name the real-world
          // comparator it was held against (vs the referent thread, vs
          // Ticketmaster roster). An absence answer with no named
          // referent is a vibe, not a comparison.
          const aBody = sectionBody(text, "absences");
          if (!aBody) {
            failures.push(
              `TASTE-VERDICT: ${artifactRel} has verdicts but no ## Absences section — ` +
              `the missing-things walk is required: | surface | referent it was held against | what should exist that doesn't | RAISED: <finding id> | NOT-NEEDED: <defense> |.`
            );
          } else {
            const aLines = aBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l.trim()));
            const aRows = aLines.filter(
              (l, i) => !(i === 0 && /\bsurface\b/i.test(l)) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l)
            );
            const aBad = [];
            for (const l of aRows) {
              const cells = l.split("|").map((c) => c.trim()).filter(Boolean);
              const last = cells[cells.length - 1] || "";
              if (!/^(RAISED\s*:|NOT-NEEDED\s*:)/i.test(last)) {
                aBad.push(`absence row missing outcome: "${l.trim().slice(0, 100)}"`);
                continue;
              }
              if (/^NOT-NEEDED\s*:/i.test(last) && last.replace(/^NOT-NEEDED\s*:\s*/i, "").split(/\s+/).filter(Boolean).length < 5) {
                aBad.push(`NOT-NEEDED without a written defense: "${last.slice(0, 80)}"`);
              }
              // Referent column — cells[1] names the comparator. "vs
              // <product/class>" is required; "none — <defense>" is the
              // honest entry when a surface genuinely has no referent.
              const ref = cells[1] || "";
              if (/^none\b/i.test(ref)) {
                const defense = ref.replace(/^none\b\s*[—:\-]?\s*/i, "");
                if (defense.split(/\s+/).filter(Boolean).length < 5) {
                  aBad.push(`absence referent 'none' without a written defense: "${ref.slice(0, 80)}"`);
                }
              } else if (!/^vs\b/i.test(ref) || ref.split(/\s+/).filter(Boolean).length < 2) {
                aBad.push(`absence row names no comparator (needs "vs <exemplar>"): "${ref.slice(0, 80)}"`);
              }
            }
            const aText = aRows.join("\n").toLowerCase();
            const aSurfaces = vRows.map((l) =>
              (l.split("|").map((c) => c.trim()).filter(Boolean)[0] || "")
                .toLowerCase().replace(/[^\w\s·@]/g, "").split(/\s+/).slice(0, 4).join(" ")
            ).filter(Boolean);
            const aUncovered = aSurfaces.filter((s) => !aText.includes(s));
            if (aUncovered.length) {
              aBad.push(`${aUncovered.length} verdict surface(s) have no absences row: ${aUncovered.slice(0, 3).join("; ")}`);
            }
            if (aBad.length) {
              failures.push(
                `TASTE-VERDICT: ${artifactRel} ## Absences has ${aBad.length} invalid row(s) — ` +
                `first: "${aBad[0]}". Each repainted surface answers what should exist that doesn't: RAISED: <finding id> | NOT-NEEDED: <reason>.`
              );
            }
          }
        }
      }

      // --- fresh-look ------------------------------------------------------
      tick("fresh-look");
      // The author's own verdict on their own work is the cook tasting his
      // intention — structurally compromised. Independence without a
      // subagent is procedural: write the prediction BEFORE the repaint
      // exists, then observe the shot, then record the delta. A prediction
      // written after the shots is memory wearing a blindfold — the table
      // exists so the two passes stay separated in the artifact. A
      // critique-briefed subagent (critique_agent_launched) still
      // satisfies the check — the strongest looker when one can be
      // afforded — and the user's own render review is the honest
      // exemption (EXEMPT-FRESH-EYES: * — <reason>).
      if (appearanceClass && !state.critique_agent_launched && !exempt("FRESH-EYES", "*")) {
        const fBody = sectionBody(text, "fresh-look");
        if (!fBody) {
          failures.push(
            `FRESH-LOOK: appearance-class UI work closed with no independent look. ` +
            `Either launch a critique-briefed subagent (screenshots only — no diff/intent in its brief), ` +
            `or write the procedural blind pass: ## Fresh-look with a delta table — ` +
            `| surface | predicted (written BEFORE the repaint) | observed (≥10 words, from the actual shot) | MATCH|MISS: <what differed> | — ≥3 rows. ` +
            `or EXEMPT-FRESH-EYES: * — <reason> in ${evidenceRel} (09-design-review.mdc → fresh-look).`
          );
        } else {
          const fLines = fBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l.trim()));
          const fRows = fLines.filter(
            (l, i) => !(i === 0 && /\bsurface\b|\bpredicted\b/i.test(l)) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l)
          );
          const fBad = [];
          let fMisses = 0;
          for (const l of fRows) {
            const cells = l.split("|").map((c) => c.trim()).filter(Boolean);
            const last = cells[cells.length - 1] || "";
            if (!/^(MATCH|MISS\s*:)/i.test(last)) {
              fBad.push(`fresh-look row missing MATCH|MISS token: "${l.trim().slice(0, 90)}"`);
              continue;
            }
            if (/^MISS\s*:/i.test(last)) fMisses++;
            const observed = cells.length >= 3 ? cells[cells.length - 2] : "";
            if (observed.split(/\s+/).filter(Boolean).length < 10) {
              fBad.push(`fresh-look 'observed' under-described (${observed.split(/\s+/).filter(Boolean).length}w): "${observed.slice(0, 80)}"`);
            }
          }
          if (fRows.length < 3) {
            fBad.push(`fresh-look delta table has ${fRows.length} row(s) — ≥3 surfaces required for the pass to mean anything`);
          }
          // All-match on a wide table is the never-diverged signature:
          // predictions that perfectly anticipate 8+ repaints were
          // written after them.
          if (fRows.length >= 8 && fMisses === 0) {
            fBad.push(`all ${fRows.length} fresh-look rows MATCH — a prediction table that never diverged was written after the shots, not before`);
          }
          if (fBad.length) {
            failures.push(
              `FRESH-LOOK: ${artifactRel} ## Fresh-look has ${fBad.length} invalid row(s) — first: "${fBad[0]}". ` +
              `Each row: | surface | predicted (before repaint) | observed (≥10 words) | MATCH | MISS: <what differed> |.`
            );
          }
        }
      }

      // --- read-back (Pass 0) ------------------------------------------------
      tick("read-back (Pass 0)");
      // The re-read precedes the render — write-time defects have
      // readable signatures (unstyled states, undecided wraps, native
      // defaults, placeholders, orphans) and the read-back pass is where
      // they get caught cheapest. Appearance work without the section
      // rendered first and reviewed after — the order the pass exists
      // to prevent. Findings or an honest "nothing found — what I
      // checked" row are both valid; absence of the section is not.
      if (appearanceClass && !exempt("READBACK", "*")) {
        const rbBody = sectionBody(text, "read-back");
        const rbRows = rbBody.split(/\r?\n/).filter((l) => l.trim() && !/^##/.test(l.trim()) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l));
        if (!rbBody || rbRows.length < 1) {
          failures.push(
            `READ-BACK: appearance-class work with no Pass-0 re-read recorded. ` +
            `Add ## Read-back to ${artifactRel} — what the file-level review found before the first render ` +
            `(unstyled states, wrap decisions, native controls, placeholders, orphans) or an honest ` +
            `'"nothing found" + what was checked' line — or EXEMPT-READBACK: * — <reason> in ${evidenceRel}.`
          );
        }
      }

      // --- item-closure ------------------------------------------------------
      tick("item-closure");
      // Per-item closure (09-design-review → per-item closure): the
      // PreToolUse hook on todo_write enforces timing (closure before the
      // next item); this check enforces completeness — every item that
      // completed during a UI session must have a CLOSURE: line whose stem
      // matches the item's text in the artifact's ## Closures section, or
      // an EXEMPT-CLOSURE line in gate-evidence.
      const doneItems = Array.isArray(state.completed_during_session)
        ? state.completed_during_session
        : [];
      if (doneItems.length && !exempt("CLOSURE", "*")) {
        const cBody = sectionBody(text, "closures");
        // Symmetric normalization (sedate-fine parity with the hook):
        // punct→join on BOTH item and corpus sides — stripping only the
        // item's punctuation derived stems ("prework") a verbatim-quoted
        // CLOSURE line could never contain; real artifacts carry BOTH
        // verbatim and adapted spellings, and join-normalization matches both.
        const normAll = (t) => String(t || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
        const stem4 = (s) => normAll(s).split(" ").filter(Boolean).slice(0, 4).join(" ");
        const stemInLine = (line, stemWords) => {
          const toks = normAll(line.replace(/^[^\n]*?CLOSURE\s*:/i, " ")).split(" ").filter(Boolean);
          let i = 0;
          for (const w of stemWords.split(" ")) {
            i = toks.indexOf(w, i);
            if (i < 0) {
              // Parity with the hook (secdoc B10 + truncated stems): a
              // state-recorded item may carry a 60-char-truncated stem
              // whose last word is a fragment ("…md — ex"), which no
              // verbatim line can token-match. The joined blob covers
              // fragments and split/fused spellings both ways.
              const blob = toks.join("");
              const sblob = stemWords.split(" ").join("");
              return blob.includes(sblob);
            }
            i++;
          }
          return true;
        };
        // Marker/reason separators: ` — `, ` -- `, ` :: `, or ` - ` —
        // a bare hyphen needs surrounding whitespace so hyphenated
        // words can't split mid-word (parity with the hook's EXEMPT_SEP).
        const EXEMPT_SEP = /\s*(?:—|--|::| - )\s*/;
        // DD-F2: stem-presence alone let `CLOSURE: fix the bug — done`
        // satisfy. The written closure names ≥2 scrutiny axes or cites
        // the element/region questioned — same floor as the hook.
        const AXIS_RE = /\b(correctness|functional|functionality|security|performance|quality|usability|ux|visual|accessib|modular|authz|idor)\b/gi;
        const CITE_RE = /(?:[\w.-]+\.(?:mjs|js|ts|py|css|html|j2|md):\d+|verify:\s*\S+|capture|screenshot|\.png\b|selector|\bDOM\b|route\s+\/\S+)/i;
        // gs-v2 workflow bind (parity with the hook): an item naming a
        // session-touched UI file closes only on rendered evidence OF
        // THAT FILE — a png whose name carries the stem, or a coverage
        // json whose surfaces list it. Generic axis words can't close a
        // page-build item; a batched item owes evidence per named file.
        const uiStems = new Set(
          (Array.isArray(state.ui_touched) ? state.ui_touched : [])
            .map((p) => String(p).replace(/\\/g, "/").split("/").pop().replace(/\.[^.]+$/, "").toLowerCase())
            .filter((x) => x.length > 2)
        );
        const citeCovers = (line, st) => {
          const cites = line.match(/[\w.\\/-]+\.(?:png|json)\b/gi) || [];
          return cites.some((c) => {
            if (/\.png$/i.test(c)) return c.toLowerCase().includes(st);
            try {
              const rel = c.replace(/^\.?\/+/, "");
              const p = existsSync(join(ROOT, rel)) ? join(ROOT, rel) : join(ROOT, "." + rel);
              const j = JSON.parse(readFileSync(p, "utf-8"));
              const surfs = j.surfaces || j.pages || [];
              if (Array.isArray(surfs) && surfs.length)
                return surfs.some((sf) => String(sf.name || sf.path || sf.page || "").toLowerCase().includes(st));
              return JSON.stringify(j).toLowerCase().includes(st);
            } catch { return false; }
          });
        };
        const missingClosures = doneItems.filter((item) => {
          const s = stem4(item);
          if (!s) return false;
          const matchLines = cBody.split(/\r?\n/)
            .filter((l) => /CLOSURE\s*:/i.test(l) && stemInLine(l, s));
          let closed = matchLines.some((line) =>
              new Set((line.match(AXIS_RE) || []).map((a) => a.toLowerCase().replace(/ity$/, "y"))).size >= 2 ||
              CITE_RE.test(line));
          if (closed) {
            const words = normAll(item).split(" ");
            const bound = [...uiStems].filter((st) => words.includes(st));
            if (bound.length)
              closed = matchLines.some((line) => bound.every((st) => citeCovers(line, st)));
          }
          // An exemption is an auditable assertion — it needs the
          // `— <reason>` tail like every other EXEMPT- marker (a bare
          // `EXEMPT-CLOSURE: x` mention matched before this).
          const ex = evidence.split(/\r?\n/).some((l) => {
            const em = l.match(/EXEMPT-CLOSURE\s*:\s*([\s\S]*)$/i);
            if (!em) return false;
            const parts = em[1].split(EXEMPT_SEP);
            if (parts.length < 2 || !/\S.{3,}/.test(parts.slice(1).join(" "))) return false;
            const target = parts[0].trim();
            if (target === "*") return true;
            return stemInLine("CLOSURE: " + target, s);
          });
          return !(closed || ex);
        });
        if (missingClosures.length) {
          failures.push(
            `ITEM-CLOSURE: ${missingClosures.length} item(s) completed during this UI session have no adequate CLOSURE: line in ${artifactRel} ## Closures — ` +
            `first: "${missingClosures[0]}". Scrutiny that isn't written before the transition didn't happen: ` +
            `CLOSURE: <item stem> — <what was questioned> naming ≥2 axes (correctness/functional/security/performance/quality/usability) ` +
            `or a file:line/capture/selector cite (09-design-review.mdc → per-item closure).`
          );
        }
        // gs-v2 bind hole (parity with the hook): a batched item naming
        // no file escapes the per-file bind — so every page file CREATED
        // this session must appear in the closures corpus. A page that
        // exists owes written scrutiny regardless of item wording.
        const firstEditTs = Date.parse(state.ui_first_edit_at || state.design_spec_at || 0) || 0;
        if (firstEditTs) {
          const createdPages = (Array.isArray(state.ui_touched) ? state.ui_touched : []).filter((p) => {
            const sp = String(p);
            if (!/\.(html|j2)$/i.test(sp)) return false;
            try { return statSync(join(ROOT, sp)).birthtimeMs > firstEditTs - 120_000; } catch { return false; }
          });
          const corpusNorm = normAll(cBody);
          const unclosedPages = createdPages.filter((p) => {
            const st = normAll(String(p).replace(/\\/g, "/").split("/").pop().replace(/\.[^.]+$/, ""));
            const exemptedPage = evidence.split(/\r?\n/).some((l) => {
              const m = l.match(/EXEMPT-CLOSURE\s*:\s*([\s\S]*)$/i);
              if (!m) return false;
              const parts = m[1].split(EXEMPT_SEP);
              if (parts.length < 2 || !/\S.{3,}/.test(parts.slice(1).join(" "))) return false;
              const t = parts[0].trim();
              return t === "*" || normAll(t).includes(st);
            });
            return !exemptedPage && !new RegExp(`\\b${st.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(corpusNorm);
          });
          if (unclosedPages.length) {
            failures.push(
              `ITEM-CLOSURE: ${unclosedPages.length} page file(s) created this session have no closure mention in ${artifactRel} ## Closures — ` +
              `${unclosedPages.slice(0, 3).join(", ")}${unclosedPages.length > 3 ? ` (+${unclosedPages.length - 3} more)` : ""}. ` +
              `A created page owes written scrutiny (a CLOSURE line naming it, with per-file rendered evidence) ` +
              `or EXEMPT-CLOSURE: <stem> — <reason> in ${evidenceRel}.`
            );
          }
        }
      }

      // --- coverage-external -------------------------------------------------
      tick("coverage-external");
      // The coverage table's raw material must come from outside the
      // author — a hand-written enumeration can silently skip the element
      // that needed questioning (the untouched-element blind spot). The
      // artifact cites `coverage-source: <path>` pointing at a probe dump
      // from .devin/scripts/ui-coverage-probe.mjs (the rendered DOM's own
      // element list). The check: the file exists, parses, and the
      // coverage table's enumerated elements aren't absurdly thin vs the
      // DOM's own interactive count (<30% is the skip signature).
      if (!exempt("COVERAGE", "*")) {
        const covSrc = (text.match(/\bcoverage-source\s*:\s*(\S+)/i) || [])[1] || "";
        if (!covSrc) {
          failures.push(
            `COVERAGE-EXTERNAL: ${artifactRel} has no 'coverage-source: <path>' line — ` +
            `coverage enumeration must derive from the rendered DOM, not memory. ` +
            `Run .devin/scripts/ui-coverage-probe.mjs against the touched surfaces and cite the JSON it writes, ` +
            `or EXEMPT-COVERAGE: * — <reason> in ${evidenceRel} (09-design-review.mdc → external coverage).`
          );
        } else {
          // Absolute cites resolve directly (R12-F19 — join(ROOT,"C:/…")
          // produced a nonexistent path and falsely rejected them).
          const covSrcClean = covSrc.replace(/^\.\//, "");
          const covPath = existsSync(covSrcClean) ? covSrcClean : join(ROOT, covSrcClean);
          const cov = existsSync(covPath) && underRoot(covPath) ? readJson(covPath) : null;
          if (!cov || !Array.isArray(cov.surfaces)) {
            failures.push(
              `COVERAGE-EXTERNAL: coverage-source '${covSrc}' doesn't exist or isn't a probe dump (surfaces[] missing) — ` +
              `run .devin/scripts/ui-coverage-probe.mjs and cite the JSON it writes.`
            );
          } else {
            // Element types aren't guaranteed — [null] crashes the gate
            // (exit 1 = allow), [{interactives:{}}] silently zeroes density.
            // Same-file surfaces re-scan ONE rendered DOM (router docs,
            // #fragment pages): summing interactives across offsets counts
            // the same pool N× (secdoc: 43 surfaces → 1339 counted, ~31
            // real — the SHAPE-AUDIT dedup class). Per-file max is the
            // honest denominator; SPA routes under-count leniently.
            const domByFile = {};
            for (const s of cov.surfaces) {
              if (!s || !Number.isFinite(s.interactives)) continue;
              const k = String(s.url || s.name || "").split("#")[0];
              domByFile[k] = Math.max(domByFile[k] || 0, s.interactives);
            }
            const domCount = Object.values(domByFile).reduce((a, b) => a + b, 0);
            // Coverage tables: the elements column's tokens, located by
            // HEADER — the old last-cell assumption counted personas as
            // elements on `| surface | elements | persona |` orders
            // (R15-F31). Falls back to last cell when no column names it.
            let enumTokens = 0;
            for (let i = 0; i < artLines.length - 1; i++) {
              if (!/^\s*\|\s*surface\b/i.test(artLines[i]) || !SEP_RE.test(artLines[i + 1])) continue;
              const hdrCells = artLines[i].split("|").map((c) => c.trim().toLowerCase()).filter(Boolean);
              // Prefer the column that literally names elements over a
              // vague first-match — `| surface | items | elements |` read
              // `items` prose as the element list (R16-F12). All surface
              // tables count, not just the first (the old `break` hid
              // tables after the first), and a ragged row contributes
              // nothing rather than silently reading its last cell.
              const elIdx = (() => {
                const strict = hdrCells.findIndex((c) => /^(?:elements?|controls?|interactives?|element\s+list)$/.test(c));
                return strict >= 0 ? strict : hdrCells.findIndex((c) => /elements?|reviewed|items?|controls?/.test(c));
              })();
              for (let j = i + 2; j < artLines.length && /^\s*\|/.test(artLines[j]); j++) {
                const cells = artLines[j].split("|").map((c) => c.trim()).filter(Boolean);
                const ci = elIdx >= 0 ? elIdx : cells.length - 1;
                if (ci >= cells.length) continue;
                const elems = cells[ci] || "";
                enumTokens += elems.split(/[,·\s]+/).filter((w) => w.length >= 3).length;
              }
            }
            if (domCount >= 10 && enumTokens < domCount * 0.3) {
              failures.push(
                `COVERAGE-EXTERNAL: probe found ${domCount} interactive elements but the coverage table enumerates ~${enumTokens} tokens — ` +
                `under 30% density means elements were skipped silently. Enumerate what the DOM actually holds ` +
                `(09-design-review.mdc → external coverage).`
              );
            }
            // INVENTORY-PARITY: the DOM's class list vs the spec's
            // inventory — the row↔element diff. The script existed but
            // was never invoked by any hook; the gate runs it here, where
            // both inputs (probe dump + spec) are already located.
            const specForParity = join(ROOT, artifactFor(`.unlazy/design-spec/${sid}.md`));
            if (existsSync(specForParity) && !exempt("PARITY", "*")) {
              try {
                const parity = execFileSync(
                  process.execPath,
                  [join(ROOT, ".devin", "scripts", "check-inventory-parity.mjs"), covPath, specForParity],
                  { cwd: ROOT, timeout: 8000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
                );
                const m = String(parity).match(/INVENTORY-PARITY:\s*(\d+)\s*\/\s*(\d+)\s*rendered classes have no spec row/i);
                if (m && parseInt(m[1], 10) > 0) {
                  const listed = String(parity).split(/\r?\n/).filter((l) => /^\s+\./.test(l)).slice(0, 5).join(", ");
                  failures.push(
                    `INVENTORY-PARITY: ${m[1]}/${m[2]} rendered DOM classes have no spec inventory row — ` +
                    `elements shipped that were never decided (e.g. ${listed.trim() || "see probe dump"}). ` +
                    `Add the inventory row or defend the element in .unlazy/design-spec/${sid}.md, ` +
                    `or EXEMPT-PARITY: * — <reason> in ${evidenceRel} (13-design-spec → Inventory).`
                  );
                }
              } catch { /* the parity tool failing open must not block — the coverage-source arm above still binds */ }
            }
          }
        }
      }

      // --- calibration -------------------------------------------------------
      tick("calibration");
      // Every miss the USER catches is a gate failure: some check should
      // have caught it and didn't. rejection-tracker (UserPromptSubmit)
      // records defect reports; in a UI session each needs a CALIBRATION:
      // row naming the miss, the check that should have fired, and the
      // rule change made — user catches become rule inputs permanently.
      const rejections = Array.isArray(state.rejections) ? state.rejections : [];
      if (rejections.length && !exempt("CALIBRATION", "*")) {
        const calBody = sectionBody(text, "calibration");
        const calRows = (calBody.match(/^\s*(?:[-*|]\s*)?CALIBRATION\s*:/gim) || []).length;
        if (calRows < rejections.length) {
          failures.push(
            `CALIBRATION: the user reported ${rejections.length} defect(s)/miss(es) this session but ${artifactRel} ## Calibration carries ${calRows} row(s) — ` +
            `each user-caught miss is a gate failure: CALIBRATION: <the miss> → <the check that should have caught it> → <the rule change made>. ` +
            `or EXEMPT-CALIBRATION: * — <reason> in ${evidenceRel}.`
          );
        }
      }
    }

    // --- undefined-token ---------------------------------------------------
    tick("undefined-token");
    // `var(--app-x, <fallback>)` on a token defined nowhere resolves to the
    // fallback — the invisible-pressed-chip defect class (a weekday chip
    // painted `var(--app-accent, currentColor)`/`var(--app-on-accent, #fff)`
    // where neither var existed anywhere in the codebase — pressed rendered
    // blank). Without a fallback the declaration is silently inert. A token
    // counts as defined when any file under app declares `--app-x:`,
    // or any script sets it via setProperty/style[] — templates, served
    // pages, and Python that emits CSS all count, so a name defined nowhere
    // is a dead token by construction. Fail-open: a declaration in a
    // comment or a bundled copy counts as defined; the check only fires on
    // names with no definition anywhere it can see. Reported as one failure
    // — a repo-wide dead-token class is one finding, not N obligations.
    const touchedCss = touched.filter((p) => /\.css$/i.test(p) && !exempt("TOKEN", p));
    if (touchedCss.length) {
      const defined = new Set();
      const DEF_RE = /(--app-[\w-]+)\s*:/g;
      const SETP_RE = /(?:setProperty\(\s*["'`]|style\[\s*["'`])(--app-[\w-]+)/g;
      // M2: the definition set was rebuilt by re-reading every source file
      // under app on every firing (~4-8s of pure file I/O). Now a
      // persisted mtime index — a file whose mtime is unchanged replays its
      // cached token list; only touched files are re-read.
      const TOK_IDX = join(STATE_DIR, "_token-index.json");
      let tokIdx = {};
      try {
        const raw = JSON.parse(readFileSync(TOK_IDX, "utf-8"));
        if (raw && typeof raw === "object" && !Array.isArray(raw)) tokIdx = raw;
      } catch { tokIdx = {}; }
      const newIdx = {};
      const grabToks = (src) => {
        const toks = new Set();
        let m;
        while ((m = DEF_RE.exec(src))) toks.add(m[1]);
        while ((m = SETP_RE.exec(src))) toks.add(m[1]);
        return toks;
      };
      const stack = [join(ROOT, "app")];
      while (stack.length) {
        const d = stack.pop();
        let ents;
        try { ents = readdirSync(d, { withFileTypes: true }); } catch { continue; }
        for (const e of ents) {
          const p = join(d, e.name);
          if (e.isDirectory()) {
            if (!e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "__pycache__") stack.push(p);
            continue;
          }
          if (!/\.(css|js|mjs|cjs|html|j2|py)$/i.test(e.name)) continue;
          let mt;
          try { mt = statSync(p).mtimeMs; } catch { continue; }
          const hit = tokIdx[p];
          if (hit && hit[0] === mt) {
            for (const t of hit[1]) defined.add(t);
            newIdx[p] = hit;
            continue;
          }
          let src;
          try { src = readFileSync(p, "utf-8"); } catch { continue; }
          const toks = [...grabToks(src)];
          for (const t of toks) defined.add(t);
          newIdx[p] = [mt, toks];
        }
      }
      try {
        mkdirSync(STATE_DIR, { recursive: true });
        writeFileSync(TOK_IDX, JSON.stringify(newIdx));
      } catch { /* cache persistence best-effort */ }
      const USE_RE = /var\(\s*(--app-[\w-]+)/g;
      const deadByFile = new Map();
      for (const rel of touchedCss) {
        let src = null;
        try { src = readFileSync(join(ROOT, rel), "utf-8"); } catch { try { src = readFileSync(rel, "utf-8"); } catch { src = null; } }
        if (src === null) continue;
        let m;
        while ((m = USE_RE.exec(src))) {
          if (!defined.has(m[1])) {
            if (!deadByFile.has(rel)) deadByFile.set(rel, new Set());
            deadByFile.get(rel).add(m[1]);
          }
        }
      }
      if (deadByFile.size) {
        const detail = [...deadByFile.entries()]
          .map(([f, names]) => `${f} → ${[...names].join(", ")}`)
          .join(" | ");
        failures.push(
          `UNDEFINED-TOKEN: var(--app-…) token(s) used in ${deadByFile.size} touched file(s) are defined nowhere under app: ` +
          `${detail} — a var() on a dead token resolves to its fallback or nothing (the invisible-pressed-state ` +
          `class, 13-design-spec.mdc banned basins). Define the token, use a real one, or add ` +
          `EXEMPT-TOKEN: <file or *> — <reason> to ${evidenceRel}.`
        );
      }
    }

    // --- verdict-scope -----------------------------------------------------
    tick("verdict-scope");
    // Verdict vocabulary in the agent's own report (09-design-review →
    // Report scoping): "at the bar", "matches the board", "polished" are
    // the user's words to issue — the report's honest shape is evidence +
    // the unverified remainder. Scans the reported assistant output only;
    // negated lines are exempt ("not yet at the bar" is remainder-talk).
    // The gate verifies banned-phrase absence — the honesty of the
    // evidence stays audit-level, same doctrine as the rest.
    if (assistantTexts.length) {
      const VERDICT_RE = /\b(at\s+the\s+(same\s+)?(quality\s+)?bar|board[-\s]?level\s+(quality|polish|finish)|same\s+(level\s+of\s+)?quality\s+as\s+the\s+(board|exemplar)|match(?:es|ed|ing)\s+the\s+(board'?s?|exemplar'?s?)\s+(quality|level|bar)|meets?\s+(the|its)\s+(quality\s+)?bar|it\s+(looks|reads|feels)\s+(polished|designed|deliberate|finished)|this\s+(is|looks|reads)\s+(polished|designed|deliberate))\b/i;
      const verdictLines = assistantTexts
        .flatMap((t) => t.split(/\r?\n/))
        .filter((l) => VERDICT_RE.test(l) && !NEG_RE.test(l));
      if (verdictLines.length) {
        failures.push(
          `VERDICT-SCOPE: the report issues a quality verdict on its own work — ` +
          `"${verdictLines[0].trim().slice(0, 110)}"${verdictLines.length > 1 ? ` (+${verdictLines.length - 1} more)` : ""}. ` +
          `Verdict vocabulary ("at the bar", "matches the board", "polished", "designed") is the user's to supply — ` +
          `the report carries the evidence and the unverified remainder instead (09-design-review.mdc → Report scoping).`
        );
      }
    }
  }

  // --- verdict-vs-shipped (D5) ---------------------------------------------
  tick("verdict-vs-shipped (D5)");
  // A completed generative project whose own recorded verdicts all sit
  // below the floor cannot report done without a filed disposition — the
  // 7/10-eyes-meets-8/10-spec failure: every artifact existed, the
  // verdicts were honest, and the product still shipped below bar.
  // Generative = a design-spec exists for this session; scores come from
  // the review artifact plus every eyes file the session produced or
  // cited. All-below-floor blocks; one at/above-floor score passes (a
  // stray high mention can only disarm — fail-safe direction, the check
  // is a floor not a taste oracle).
  {
    const VERDICT_FLOOR = 8; // sub-bar threshold (plan default <8)
    const drPath = join(ARTIFACT_DIR, `${sid}.md`);
    const specPath = join(ROOT, artifactFor(`.unlazy/design-spec/${sid}.md`));
    if (existsSync(drPath) && existsSync(specPath) && !exempt("VERDICT", "*")) {
      const drText = readText(drPath) || "";
      const eyesDir = join(ROOT, ".unlazy", "eyes");
      let eyesText = "";
      try {
        for (const f of readdirSync(eyesDir)) {
          if (f === `${sid}.md` || f.startsWith(`${sid}-`) || drText.includes(f)) {
            eyesText += "\n" + (readText(join(eyesDir, f)) || "");
          }
        }
      } catch { /* no eyes dir — the review artifact alone supplies scores */ }
      // Score grammar: N/10 only counts when it isn't a link in a longer
      // slash chain — `7/10/16` and `15/16/10` are finding/rule id lists,
      // not verdicts (first live FP: luminous-munchkin eyes files).
      // `N/10 <count-noun>` is a fraction of a total ("9/10 pages
      // reviewed"), not a verdict — nouns after the slash disqualify.
      const scores = [...((drText + eyesText).matchAll(/(?<![\d/])\b(\d{1,2}(?:\.\d+)?)\s*\/\s*10\b(?!\s*\/)(?!\s+(?:pages?|items?|checks?|files?|rows?|surfaces?|sections?|steps?|units?|classes?|findings?|tests?|cases?|tabs?|rules?|of\s+the\b|of\b)\b)/g))]
        .map((m) => parseFloat(m[1]))
        .filter((n) => n > 0 && n <= 10);
      // The unnumbered-verdict hole (gamersocial): a generative project
      // whose review carries verdict-shaped rows (verdict/AT-BAR/BELOW-BAR
      // language) but ZERO N/10 scores anywhere — shipped with a verdict
      // no floor can ever test. A generative review owes at least one
      // numeric verdict; worded verdicts without numbers grade nothing.
      if (!scores.length && /##\s*verdict|\bverdict\s*\||\b(?:AT|BELOW|ABOVE)[-\s]?BAR\b|\|.*\bverdict\b/i.test(drText) && !exempt("VERDICT", "*")) {
        failures.push(
          `VERDICT-VS-SHIPPED: the review carries verdict rows but no N/10 score anywhere in the artifact or its eyes passes — ` +
          `a generative project can ship with a verdict no floor can test (gamersocial: verdict language, zero numbers). ` +
          `Record a numeric verdict per surface, or file EXEMPT-VERDICT: * — <why no numeric verdict applies> in ${evidenceRel}.`
        );
      }
      if (scores.length && scores.every((n) => n < VERDICT_FLOOR)) {
        failures.push(
          `VERDICT-VS-SHIPPED: every recorded verdict for this generative project sits below ${VERDICT_FLOOR}/10 ` +
          `(${[...new Set(scores)].sort((a, b) => a - b).join(", ")}/10 across the review artifact + eyes passes) with no disposition filed for the gap — ` +
          `a sub-bar verdict beside a shipped report is the honesty hole. Lift the work above the floor, or file ` +
          `EXEMPT-VERDICT: * — <why this sub-bar is accepted> in ${evidenceRel} (09-design-review → verdict honesty, D5).`
        );
      }
    }
  }

  // --- migration ----------------------------------------------------------
  tick("migration");
  if ((state.ddl_armed || []).length && !(state.migrations_touched || []).length) {
    const unexempted = (state.ddl_armed).filter((p) => !exempt("MIGRATION", p));
    if (unexempted.length) {
      failures.push(
        `MIGRATION: schema DDL was introduced in ${unexempted.join(", ")} with no migration file under migrations/versions/g*. ` +
        `AGENTS.md requires an Alembic migration in the same slice — write it and run upgrade head, or add EXEMPT-MIGRATION: <file> — <reason> to ${evidenceRel}.`
      );
    }
  }

  // --- sitemap ------------------------------------------------------------
  tick("sitemap");
  if ((state.routes_armed || []).length && !state.sitemap_touched) {
    const unexempted = (state.routes_armed).filter((p) => !exempt("SITEMAP", p));
    if (unexempted.length) {
      failures.push(
        `SITEMAP: route registration added/edited in ${unexempted.join(", ")} but docs/sitemap.md was not updated. ` +
        `04-rewrite-docs.mdc requires the route's entry to be added/edited in the same slice — update it, or add EXEMPT-SITEMAP: <file> — <reason> to ${evidenceRel}.`
      );
    }
  }

  // --- open-ledger ---------------------------------------------------------
  tick("open-ledger");
  // Deferral labels in a session-touched ledger doc are open work wearing a
  // label — "P3 — listed, not built this pass", "Deferred-by-data", "later
  // pass". An item exits the ledger three ways only: done, BLOCKED: with a
  // named blocker, or ACCEPTED: with the user's in-session agreement.
  // Bucket words are the second half of the same failure (14-stop-integrity):
  // "residue", "leftovers", "follow-ups", "misc items" — a pile-name is not a
  // disposition. Each names unfinished work without naming WHICH work, so
  // each needs a real marker like any deferral. Work-noun-scoped variants
  // keep honest technical prose ("cleanup pass") legal — except
  // `residual`, banned bare anywhere in a ledger doc: a "### Honest
  // residual" heading was a leftover drawer wearing an instrument-limit
  // costume. The one surviving compound is the security term `residual
  // risk` (post-mitigation assessment); the lookahead keeps it legal
  // while every other use needs a disposition marker on the line.
  // DEFERRAL_RE / DEFERRAL_MARK_RE / SELFDEFER_RE / SCOPE_WORD / GAP_RE
  // moved to deferral-patterns.mjs (I2) — the scan's vocabulary lives in
  // one corpus-tested home now; the open-ledger filter below imports it.
  // (Self-deferral markers QUEUED:/SKIPPED: are candidates via
  // SELFDEFER_RE; only disposedOf() can close a line.)
  // Impossibility-verdicts close a QUESTION, not a task — the deferral
  // scanners are task-shaped, so "unmitigated" / "can't be fixed" slipped
  // every check while doing the same job (autopsy U8-1). The disposition
  // set widens to match the contract: a verdict is legal only with a
  // falsification record (found:/cleared:/tried: — what was attempted
  // against the fix) or a routed decision (PROPOSED:/ROUTED:/the normal
  // BLOCKED:/ACCEPTED: pair).
  const VERDICT_RE = /\b(unmitigat\w*|unfixable|intractable|impossibl\w*|cannot be \w+|can'?t be \w+|no way to \w+|beyond (?:fix|repair|mitigation))\b/i;
  const FALSIFY_RE = /\b(?:found|cleared|tried|searched|re-deriv\w*|attempted|falsif\w*|disprov\w*|PROPOSED:|ROUTED:)/i;
  // Deliverable-shaped ledger docs (plan/proposal/analysis/review/
  // findings/audit in the basename) must carry the author→reviewer pass
  // record — a non-empty ## Gap review section (00-operating §2a). The
  // section body runs to the next h1/h2 heading so ### subsections inside
  // it count as content; a bare heading or empty section fails.
  // Coverage-adjective costumes banned across every examined-artifact
  // class (audit-ledger + analysis-project docs) — AQ-F3: the ban lived
  // only inside AUDIT-LEDGER, so an analysis doc could say "out of
  // scope" or "representative sample" and pass every check. One list,
  // two consumers.
  const BANNED_ADJ = /\b(representative sample|spot[-\s]?check|a sample of|residual|known issues?|nice[-\s]to[-\s]have|for later|future work|out of scope|deferred|residue|remainder|leftovers?|follow[-\s]?ups?|icebox|parking\s+lot|punted|tabled|shelved|spillover|carry[-\s]?overs?|odds?\s+(?:and|n'?)\s+ends?|mop[-\s]?up|grab[-\s]?bag|catch[-\s]?all|stretch\s+(?:goals?|items?)|misc(?:ellaneous)?|edge\s+cases?)\b/i;
  const GAP_DOC_RE = /(^|[-_])(plans?|proposals?|analysis|reviews?|findings|audits?)([-_.])/i;
  const GAP_SECTION_RE = /^#{1,6}\s*gap\s*review\b[^\n]*\n([\s\S]*?)(?=\n^#{1,2}\s|$(?![\s\S]))/im;
  const drivenOpen = [];
  const drivenDocs = [];
  let driveDeclared = false;
  // Use-vs-mention: a doc discussing the vocabulary — "`QUEUED:` is not
  // a state" — is not deferring. Inline-code spans are stripped before
  // the scans so mentions inside backticks don't fire; a real deferral
  // label is never written inside code spans, so the strip costs nothing.
  // Use-vs-mention strip — with one carve-out: a code span holding a
  // DISPOSITION-SHAPED label ("`QUEUED:` fix it later") keeps its inner
  // text. Command samples (`git commit`) never look like labels, so this
  // only re-exposes spans someone wrote to smuggle a deferral past the
  // strip.
  const stripSpans = (l) =>
    l
      // Double-quoted spans are quotation — a mention of someone else's
      // words (a constraint-ledger row quoting the user's ask verbatim),
      // never a deferral BY the doc. Same label-carveout as backticks: a
      // disposition-shaped label inside quotes still counts.
      .replace(/"([^"\n]*)"/g, (_, inner) =>
        /(?:QUEUED|ACCEPTED|BLOCKED|DEFERRED|LATER|WON['’]?T\s+FIX|NOT\s+THIS\s+PASS|CARRIED|FILED|OPEN|TODO|FIXME|SKIPPED)\s*:/i.test(inner)
          ? ` ${inner} ` : " ")
      .replace(/`([^`\n]*)`/g, (_, inner) =>
        // The label can sit anywhere inside the span — a one-word prefix
        // (`x: QUEUED: parked`) used to hide it from every deferral scan
        // (R14-F16). Cost: code samples containing label words re-expose;
        // they disposition like any labeled line.
        /(?:QUEUED|ACCEPTED|BLOCKED|DEFERRED|LATER|WON['’]?T\s+FIX|NOT\s+THIS\s+PASS|CARRIED|FILED|OPEN|TODO|FIXME|SKIPPED)\s*:/i.test(inner)
          ? ` ${inner} ` : " ");
      // --- plan-closure (DD-F1) ------------------------------------------------
      tick("plan-closure (DD-F1)");
      // `- [ ]` → `- [x]` flips inside armed ledger docs are completed
      // work items that never entered todo_write — the per-item closure
      // gate never armed for them. Each flipped stem owes the same
      // CLOSURE (≥2 axes or a cite) somewhere in the armed plan-doc
      // corpus, or EXEMPT-CLOSURE.
      const planDone = Array.isArray(state.plan_items_done) ? state.plan_items_done : [];
      if (planDone.length && !exempt("PLANCLOSURE", "*")) {
        const planCorpus = (state.plan_docs || [])
          .map((p) => { const fp = existsSync(p) ? p : join(ROOT, p); return existsSync(fp) ? readText(fp) : ""; })
          .join("\n");
        const AXIS2 = /\b(correctness|functional|functionality|security|performance|quality|usability|ux|visual|accessib|modular|authz|idor)\b/gi;
        const CITE2 = /(?:[\w.-]+\.(?:mjs|js|ts|py|css|html|j2|md):\d+|verify:\s*\S+|capture|screenshot|\.png\b|selector|\bDOM\b|route\s+\/\S+)/i;
        const missingPlan = planDone.filter((item) => {
          const stemParts = String(item).split(" ").join("[^\\n]{0,30}");
          const m = planCorpus.match(new RegExp(`^[^\\n]*CLOSURE\\s*:[^\\n]{0,140}${stemParts}[^\\n]*$`, "im"));
          const line = m ? m[0] : "";
          const distinct = new Set((line.match(AXIS2) || []).map((a) => a.toLowerCase().replace(/ity$/, "y")));
          const ok = line && (distinct.size >= 2 || CITE2.test(line));
          const ex = new RegExp(`EXEMPT-CLOSURE\\s*:\\s*(?:\\*|${String(item).split(" ").join("\\s+.*")})\\s*(?:—|--|::| - )\\s*\\S.{3,}`, "i").test(evidence);
          return !(ok || ex);
        });
        if (missingPlan.length) {
          failures.push(
            `PLAN-CLOSURE: ${missingPlan.length} plan-doc checklist item(s) flipped to checked with no closure — ` +
            `first: "${missingPlan[0]}". A \`- [x]\` flip is a completed item: write ` +
            `CLOSURE: <item stem> — <what was questioned> naming ≥2 axes or a file:line/capture cite in the armed doc ` +
            `(or EXEMPT-CLOSURE: <stem or *> — <reason> in ${evidenceRel}) — the move-on gate binds every completion shape, not only \`todo\`-shaped ones (DD-F1).`
          );
        }
      }


  // --- prior-pass gap (M-F3) ---------------------------------------------------
  tick("prior-pass gap (M-F3)");
  // A recorded quality-rejection ("not comprehensive", "too shallow",
  // "15% effort") is an instrument-failure event — the re-ask arrives
  // WITH the remediation obligation: the next armed doc carries a
  // `## Prior-pass gap` block naming what the previous pass missed, or
  // gate-evidence carries a PRIOR-PASS: line when the work isn't
  // doc-shaped. A rejection with no gap naming is a re-ask treated as
  // a fresh prompt — the exact reported pattern.
  const qualRejections = Array.isArray(state.quality_rejections) ? state.quality_rejections : [];
  if (qualRejections.length && !exempt("PRIORPASS", "*")) {
    const docCorpus = (state.plan_docs || [])
      .map((p) => { const fp = existsSync(p) ? p : join(ROOT, p); return existsSync(fp) ? readText(fp) : ""; })
      .join("\n");
    const gapInDoc = /#{1,6}\s*prior[-\s]?pass\s+gap\b/i.test(docCorpus);
    const gapLine = /PRIOR-PASS\s*:\s*\S.{30,}/i.test(evidence);
    if (!gapInDoc && !gapLine) {
      failures.push(
        `PRIOR-PASS: ${qualRejections.length} quality-rejection(s) recorded this session (e.g. "${String(qualRejections[0].excerpt || "").slice(0, 60)}") ` +
        `with no ## Prior-pass gap block in any armed doc and no PRIOR-PASS: line in ${evidenceRel}. ` +
        `A re-ask is an instrument-failure event: name what the previous pass missed and the mechanism that let it ship — ` +
        `inside the next armed doc as ## Prior-pass gap, or as PRIOR-PASS: <what was missed + mechanism> (15-analysis-depth → M-F3).`
      );
    }
  }

  // --- grammar-capture (UX-F3) -------------------------------------------------
  tick("grammar-capture (UX-F3)");
  // A recorded user design critique + subsequent design work owes a
  // GRAMMAR: or CALIBRATION: row — design-grammar's own contract is that
  // feedback lands in the file the same session, and an unrecorded
  // critique is relearned next session.
  const designRejections = Array.isArray(state.design_rejections) ? state.design_rejections : [];
  if (designRejections.length && (state.ui_touched || []).length && !exempt("GRAMMAR", "*")) {
    const ok = /(?:GRAMMAR|CALIBRATION)\s*:\s*\S.{20,}/i.test(evidence);
    if (!ok) {
      failures.push(
        `GRAMMAR-CAPTURE: ${designRejections.length} user design critique(s) recorded and UI work followed with no ` +
        `GRAMMAR:/CALIBRATION: row in ${evidenceRel} — the design-grammar contract is feedback lands the same session ` +
        `(GRAMMAR: <what the grammar file gained> or CALIBRATION: <why no grammar addition applied>).`
      );
    }
  }

  // --- plan-schema (PP-F1 + PE-F2 + PQ-F1 + PQ-F3) ------------------------------
  tick("plan-schema (PP-F1 + PE-F2 + PQ-F1 + PQ-F3)");
  // General implementation plans had no schema — a design spec carries
  // Directions/Quality contract, but a plan doc could be a bullet list
  // with no goal, no success shape, no file derivation, no alternatives.
  // Arm on armed ledger docs whose basename is *plan* (deliverable
  // classes — analysis/review/audit/findings — already carry their own
  // schemas and are excluded).
  const PLAN_BN_RE = /(^|[-_.])plans?([-_.]|$)/i;
  // The exclusion is the OTHER deliverable classes — analysis/review/
  // findings/audit/proposal carry their own schemas. GAP_DOC_RE itself
  // contains `plans?` and would exempt every plan doc (found by matrix).
  const PLAN_EXCL_RE = /(^|[-_.])(proposals?|analysis|reviews?|findings?|audits?)([-_.]|$)/i;
  for (const docPath of (state.plan_docs || [])) {
    const bn = String(docPath).split(/[\\/]/).pop() || "";
    if (!PLAN_BN_RE.test(bn) || PLAN_EXCL_RE.test(bn)) continue;
    if (exempt("PLANSCHEMA", docPath)) continue;
    const fp = existsSync(docPath) ? docPath : join(ROOT, docPath);
    if (!existsSync(fp)) continue;
    const ptext = readText(fp) || "";
    const pnf = fenceStrip(ptext);
    const pmiss = [];
    if (!/(?:^|\n)\s*(?:#{1,6}\s*goal\b|goal\s*:|objective\s*:|intent\s*:)/im.test(pnf)) {
      pmiss.push("a goal line (## Goal / goal: / objective: — what done means before decomposition)");
    }
    if (!/(?:#{1,6}\s*success|success\s+criteria|done\s+when|exit\s+when|verified\s+by)/i.test(pnf) ||
        !/test|build|verify|probe|check|command|render|curl|pytest|vitest|jest/i.test(pnf)) {
      pmiss.push("a success shape (## Success criteria / done when: — with a measurable criterion: test/build/probe/command)");
    }
    if (!/derived-by\s*:|files-derive|verify:\s*\S+|ls\s|grep\s|rg\s|find\s|Get-ChildItem/i.test(pnf)) {
      pmiss.push("a touched-file derivation (derived-by: <command> / verify: <command> — the file list comes from enumeration, not memory)");
    }
    if (!/(?:#{1,6}\s*alternatives?\b|alternatives?\s+(?:weighed|considered)|declined\s*:|rejected\s*:)/i.test(pnf)) {
      pmiss.push("an alternatives section (## Alternatives / declined: — the approaches weighed, not the one assumed)");
    } else {
      // Tightened (proposal): a section heading is not a weighing —
      // ≥2 alternative lines, or `sole — <why>` when the route genuinely
      // is singular. One assumed approach inside an Alternatives heading
      // is the costume, not the contract.
      const altSec = pnf.match(/#{1,6}\s*(?:\d+[.)]\s*)?alternatives?\b[^\n]*\n([\s\S]*?)(?=\n^#{1,3}\s|$(?![\s\S]))/im);
      const altBody = altSec ? altSec[1] : "";
      const altLines = altBody.split(/\r?\n/).filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l) || /^\s*(?:declined|rejected|alt(?:ernative)?)\s*:/i.test(l));
      const soleOk = /\bsole\s*[-—:]|\bno\s+alternatives?\s*[-—:]|only\s+(?:one|a)\s+(?:viable\s+)?(?:approach|route|option)/i.test(pnf);
      if (altSec && altLines.length < 2 && !soleOk) {
        pmiss.push("≥2 weighed alternatives (or `sole — <why>` when the route genuinely is singular)");
      }
    }
    // Plan wrongness (proposal): the plan's top-2 ways IT is wrong — not
    // the change's risks, the plan's. A ## Risks / ## Failure modes /
    // ## Wrongness section, or ≥2 risk:/wrong:/could-fail lines.
    const hasWrongSec = /#{1,6}\s*(?:\d+[.)]\s*)?(?:risks?|wrongness|failure\s+modes?|how\s+(?:this|the)\s+plan\s+(?:fails?|is\s+wrong))\b/i.test(pnf);
    const wrongLines = pnf.split(/\r?\n/).filter((l) => /^\s*(?:[-*•]|\d+[.)])?\s*(?:risk|wrong|could\s+fail|failure\s+mode|might\s+(?:be\s+)?wrong|plan\s+risk)\b/i.test(l)).length;
    if (!hasWrongSec && wrongLines < 2) {
      pmiss.push("a plan-wrongness record (## Risks / ## Failure modes or ≥2 risk:/wrong: lines — the top ways THE PLAN is wrong, not the change)");
    }
    // Phase B (pipeline-improvement): extended plan fields arm at ≥3
    // derived files OR ≥2 unit rows — below the floor the plan owes the
    // core fields only (B1's pinned floor: a universal arm would be
    // DECLARED-inflation on three-line hotfix plans; `sole — <why>`
    // stays legal at every size because splitting costs more than it
    // earns — E3 watches the rate).
    const solePlanB = /\bsole\s*(?:—|--|::| - )\s*\S/i.test(pnf);
    const unitTblHdr = pnf.match(/\|\s*unit\s*\|[^\n]*\bacceptance\b[^\n]*\b(?:evidence|verify)\b[^\n]*\|/i);
    let unitDataRows = 0;
    if (unitTblHdr) {
      for (const l of pnf.slice(unitTblHdr.index + unitTblHdr[0].length).replace(/^\r?\n/, "").split(/\r?\n/)) {
        if (!/^\s*\|/.test(l)) break;
        if (!/^\s*\|[\s:\-|]+\|\s*$/.test(l)) unitDataRows++;
      }
    }
    const planFileToks = new Set((pnf.match(/[\w.\\/-]+\.(?:mjs|js|ts|py|css|html|j2|md|mdc|json|ya?ml|txt|png)\b/gi) || []).map((s) => s.toLowerCase()));
    if (planFileToks.size >= 3 || unitDataRows >= 2) {
      // B1: the unit-table itself (≥2 data rows or `sole — <why>`).
      if (!unitTblHdr && !solePlanB) {
        pmiss.push("a unit-table (`| unit | acceptance | evidence |`, ≥2 rows — or `sole — <why>`)");
      } else if (unitTblHdr && unitDataRows < 2 && !solePlanB) {
        pmiss.push("the unit-table needs ≥2 unit rows (or `sole — <why>`)");
      }
      // B1: the §2c sections plans carried as honor-text — present +
      // non-empty, or `n/a — <why>` (the analysis-universe doctrine
      // applied to plan sections).
      for (const sec of ["Task-comprehension record", "Invariants", "Blast radius", "Ordering"]) {
        const body = h2SectionBody(pnf, sec);
        const na = new RegExp(`\\bn/?a\\s*(?:—|--|::| - )\\s*\\S`, "i").test(body);
        if (body.length < 10 && !na) {
          pmiss.push(`\`## ${sec}\` — present + non-empty, or \`n/a — <why>\` (the §2c sections made bound)`);
        }
      }
      // B2: ## Considerations — the enumerated dimension set, each row
      // `checked: <evidence>` or `AXIS-NA: <why>`. A bare `checked` cell
      // is the matrix-row costume, not a consideration.
      const consBody = h2SectionBody(pnf, "Considerations");
      if (!consBody) {
        pmiss.push("a `## Considerations` matrix — security/performance/modularity/authz/UX/accessibility/states/edge-content, each `checked:` or `AXIS-NA:`");
      } else {
        const DIMS = [
          ["security", /secur/i], ["performance", /perform/i], ["modularity", /modular/i],
          ["authz", /authz|authoriz|permission|idor/i], ["UX", /\bux\b|usab/i],
          ["accessibility", /accessib|a11y/i], ["states", /\bstates?\b|empty[-\s]?state|loading|error[-\s]?state/i],
          ["edge-content", /edge[-\s]?content|overflow|long[-\s]?text|edge/i],
        ];
        const dimMiss = DIMS.filter(([, re]) => !consBody.split(/\r?\n/).some((l) => re.test(l) && (/(?:checked|verify)\s*:\s*[^|\n]{3,}/i.test(l) || /AXIS-NA\s*:\s*\S/i.test(l))));
        if (dimMiss.length) pmiss.push(`consideration row(s) for ${dimMiss.map(([n]) => n).join(", ")} — each ` + "`checked: <evidence>` or `AXIS-NA: <why>`");
      }
      // B3: ## Quality bar — the judgment shape of "good" for this
      // change, distinct from measurable success — plus the wrongness
      // split: `plan-wrong:` (the plan's own failure) vs `change-fails:`
      // (the change's). A `risk:` bullet counts as neither.
      if (!/^##\s*Quality\s*bar\b/im.test(pnf) || h2SectionBody(pnf, "Quality bar").length < 20) {
        pmiss.push("a `## Quality bar` section — what good means for this change (judgment shape, distinct from measurable success)");
      }
      if (!/^\s*(?:[-*•|]\s*)?(?:plan-wrong|change-fails)\s*:/im.test(pnf)) {
        pmiss.push("the wrongness split — a `plan-wrong:` (how the plan itself is wrong) or `change-fails:` (what happens when the change fails) line; a `risk:` bullet counts as neither");
      }
      // B4: ## Build construction record + ## Sub-plans ledger — staged
      // construction leaves a record; inline construction names why.
      if (!/^##\s*Build\b/im.test(pnf) && !/^\s*inline\s*(?:—|--|::| - )\s*\S/im.test(pnf)) {
        pmiss.push("a `## Build` construction record (structure → units → wiring → review) — or `inline — <why>`");
      }
      if (!/^##\s*Sub[-\s]?plans\b/im.test(pnf)) {
        pmiss.push("a `## Sub-plans` ledger — each spawned unit `inline`/`spawned` (or `none — <why>`)");
      } else {
        const subBody = h2SectionBody(pnf, "Sub-plans") || h2SectionBody(pnf, "Sub plans");
        if (!/\b(?:inline|spawned)\b/i.test(subBody) && !/\b(?:inline|none)\s*(?:—|--|::| - )\s*\S/i.test(subBody)) {
          pmiss.push("`## Sub-plans` rows — `inline`/`spawned` per unit (or `none — <why>`)");
        }
      }
      // B5: ## Carried — the citation chain backward: plan→analysis
      // with the section name, not just the doc basename (a doc-name-
      // only cite says where, not what).
      const carriedOk = pnf.split(/\r?\n/).some((l) => {
        if (!/carried\s*:/i.test(l)) return false;
        const m = l.match(/[\w./\\-]+\.(?:md|mdc)\b/i);
        if (!m) return false;
        return l.slice(l.indexOf(m[0]) + m[0].length).replace(/[^A-Za-z]/g, "").length >= 4;
      });
      if (!carriedOk) {
        pmiss.push("a `carried:` line citing the analysis/spec this plan carries — doc name + a section name (doc-name-only cites fail)");
      }
    }
    if (pmiss.length) {
      failures.push(
        `PLAN-SCHEMA: ${bn} is a plan doc missing: ${pmiss.join("; ")} — ` +
        `a plan is a contract, not a note (goal + success shape + file derivation + alternatives). ` +
        `Or EXEMPT-PLANSCHEMA: ${bn} — <reason> in ${evidenceRel} (PP-F1).`
      );
    }
  }

  // --- plan-delta (PP-F2) -------------------------------------------------------
  tick("plan-delta (PP-F2)");
  // A plan doc re-written after implementation began changed under the
  // plan — the delta is the honest record of what the plan learned from
  // contact with the code. The tracker stamps plan_delta_needed; the
  // doc owes a ## Delta / ## Plan delta section naming what changed.
  const deltaDocs = Array.isArray(state.plan_delta_needed) ? state.plan_delta_needed : [];
  for (const rel of deltaDocs) {
    if (exempt("PLANDELTA", rel)) continue;
    const fp = existsSync(rel) ? rel : join(ROOT, rel);
    const dt = existsSync(fp) ? readText(fp) : "";
    if (!/(?:#{1,6}\s*(?:plan\s+)?delta\b|delta\s*:|##\s*changes?\s+from\s+plan)/im.test(fenceStrip(dt || ""))) {
      failures.push(
        `PLAN-DELTA: ${rel} was re-written after implementation began with no ## Delta section — ` +
        `the plan changed under the plan; record what it learned from contact with the code ` +
        `(## Delta / ## Plan delta / delta: lines) or EXEMPT-PLANDELTA: ${rel} — <reason> (PP-F2).`
      );
    }
  }

  // --- review-block (RV-F1) -----------------------------------------------------
  tick("review-block (RV-F1)");
  // Non-rendered fix-scope work had no review artifact requirement —
  // rendered UI gets design-review, analysis gets the project schema,
  // but a backend/logic fix could ship with no self-review record at
  // all. The floor: a ## Review block in gate-evidence (≥2 bullets
  // naming what was re-read and the check run) or a REVIEW: line —
  // exempted when an examined artifact class already armed (a doc that
  // carries its own review machinery).
  const implFiles = (state.impl_touched || []).map((p) => String(p).replace(/\\/g, "/")).filter((p) => !/^(git-write|patch|extract|delete):/.test(p));
  const artifactArmedAny =
    (state.audit_armed || []).length > 0 ||
    (state.plan_docs || []).some((p) => GAP_DOC_RE.test(String(p).split(/[\\/]/).pop() || "")) ||
    (state.ui_touched || []).length > 0;
  // C3: the armed-artifact exemption narrowed to what each class can
  // actually prove. Design-review is the only class carrying FILE-level
  // coverage — its ## Coverage rows exempt the impl files they name.
  // Audit/plan classes carry derivation commands and unit ledgers, not
  // per-file coverage — under them an impl file earns exemption via a
  // `review-credit: <file> — <why>` line in gate-evidence (auditable,
  // counted by escape telemetry). Pre-epoch sessions keep the old
  // blanket exemption — the state they were born under can't be
  // retro-armed (loop_grandfathered pattern).
  // C3 epoch gate: `epoch` alone can't discriminate — the tracker stamps
  // epoch:2 on legacy files too. `loop_grandfathered` is the real
  // pre-machinery flag (baseline honored); only a non-grandfathered
  // epoch session owes the narrowed coverage join.
  const epochNew = !!(state && state.epoch) && !state.loop_grandfathered;
  let coveredByArtifact = new Set();
  if (epochNew && (state.ui_touched || []).length) {
    const drPath = join(ROOT, ".unlazy", "design-review", `${sid}.md`);
    const drText = existsSync(drPath) ? (readText(drPath) || "") : "";
    const covB = sectionBody(drText, "coverage") || "";
    coveredByArtifact = new Set((covB.match(/[\w.-]+\.(?:mjs|js|ts|py|css|html|j2)\b/gi) || []).map((s) => s.toLowerCase()));
  }
  if (epochNew) {
    for (const l of (evidence || "").split(/\r?\n/)) {
      const m = l.match(/review-credit\s*:\s*([^\s—|]+\.(?:mjs|js|ts|py|css|html|j2))\s*(?:—|--|::| - )\s*\S/i);
      if (m) coveredByArtifact.add(m[1].split("/").pop().toLowerCase());
    }
  }
  const reviewArtifactArmed = !epochNew
    ? artifactArmedAny
    : artifactArmedAny && implFiles.every((p) => coveredByArtifact.has(p.split("/").pop().toLowerCase()));
  const unpaidImpl = epochNew ? implFiles.filter((p) => !coveredByArtifact.has(p.split("/").pop().toLowerCase())) : implFiles;
  if ((state.files_edited || 0) > 0 && !reviewArtifactArmed && !exempt("REVIEW", "*")) {
    const revHead = evidence.match(/^##\s*review[^\n]*\n?/im);
    const revBody = revHead ? evidence.slice(revHead.index + revHead[0].length) : "";
    const revNext = revBody.search(/\n#{1,2}\s/);
    const rev = revNext >= 0 ? revBody.slice(0, revNext) : revBody;
    const revBullets = rev.split(/\r?\n/).filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l));
    const revLine = /REVIEW\s*:\s*\S.{30,}/i.test(evidence);
    // AD-F1: the review record must reach the touched files — a review
    // that names none of them is scrutiny in the abstract. When the
    // session logged impl writes, ≥1 review line must name a touched
    // file's basename or path-suffix. Under C3's narrowing it must name
    // an UNCOVERED one — a file the design-review Coverage rows and
    // review-credit lines already paid for is not the debt.
    let namesTouched = !unpaidImpl.length;
    if (!namesTouched) {
      const revText = rev + "\n" + (evidence.match(/REVIEW\s*:[^\n]*/gi) || []).join("\n");
      namesTouched = unpaidImpl.some((p) => {
        const base = p.split("/").pop();
        return base.length >= 4 && revText.includes(base);
      });
    }
    // C1/C2: above the trivial tier (>1 unpaid impl file — "one file, no
    // branch/state" is 08's trivial class) a review record that exists
    // also carries depth fields: re-derived + severity-class +
    // from-scratch verdict + the significant-improvement walk — or
    // `review-thin:` declares the thinner record honestly.
    const aboveTrivial = unpaidImpl.length > 1;
    const thinDeclared = /^\s*review-thin\s*:\s*\S.{10,}/im.test(rev) || /^\s*review-thin\s*:\s*\S.{10,}/im.test(evidence || "");
    const revAll = rev + "\n" + (evidence.match(/REVIEW\s*:[^\n]*/gi) || []).join("\n");
    const revMissing = [];
    if (aboveTrivial && !thinDeclared && (revBullets.length >= 2 || revLine)) {
      const naOr = (name) => new RegExp(`${name}\\s*:\\s*n/a\\s*(?:—|--|::| - )\\s*\\S`, "i").test(revAll);
      if (!/re-derived\s*:\s*\S/i.test(revAll) && !naOr("re-derived")) revMissing.push("a `re-derived:` line (the review re-derives the change — names ≥1 element/decision, not a paraphrase of the plan's goal)");
      const sevTbl = /\|\s*severity\s*\||\|\s*class\s*\|/i.test(revAll);
      const sevLines = /\b(?:defect|absence|quality|hygiene|approach)\s*:\s*\S/i.test(revAll);
      if (!sevTbl && !sevLines && !naOr("severity-class")) revMissing.push("a severity-class column or `defect:`/`absence:`/`quality:`/`hygiene:`/`approach:` marks on findings — or `severity-class: n/a — <why>`");
      if (!/from-scratch\s*:\s*\S/i.test(revAll) && !naOr("from-scratch")) revMissing.push("a `from-scratch:` verdict (seeing this change cold, would you sign it)");
      const AXES = [/correctness[-\s]?blast/i, /perf[-\s]?headroom/i, /capability[-\s]?vs[-\s]?referent/i, /simplification/i, /consistency[-\s]?drift/i];
      const walked = AXES.filter((a) => (evidence || "").split(/\r?\n/).some((l) => a.test(l) && (/(?:found|defended)\s*:\s*\S/i.test(l) && (!/defended\s*:/i.test(l) || l.replace(/.*defended\s*:/i, "").trim().length >= 20))));
      const walkLabeled = /significant[-\s]?improvement[-\s]?walk/i.test(evidence || "");
      if ((walked.length < 3 || !walkLabeled) && !/significant[-\s]?improvement[-\s]?walk\s*:?\s*n\/a\s*(?:—|--|::| - )\s*\S/i.test(evidence || "")) {
        revMissing.push("a `## Significant-improvement walk` — ≥3 of correctness-blast/perf-headroom/capability-vs-referent/simplification/consistency-drift, each `found:` or `defended: <reason ≥20 chars>`");
      }
    }
    if ((revBullets.length < 2 && !revLine) || !namesTouched || revMissing.length) {
      failures.push(
        `REVIEW-BLOCK: ${state.files_edited} implementation file(s) edited with ${!namesTouched ? "a ## Review block that names none of the touched files" : "no ## Review block"} in ${evidenceRel} — ` +
        `non-rendered work earns a self-review record: ≥2 bullets naming what was re-read and the check run, reaching ≥1 touched file ` +
        (revMissing.length ? `— above trivial tier the record also owes: ${revMissing.join("; ")} ` : "") +
        `(or REVIEW: <what re-read + check>, or EXEMPT-REVIEW: * — <reason>) (RV-F1/AD-F1).`
      );
    }
  }

  // --- cite-freshness (AD-F4) ---------------------------------------------------
  tick("cite-freshness (AD-F4)");
  // Internal `path:line` cites inside armed docs drift — the line the
  // cite named moves or the file renames, and the cite keeps reading
  // true. Mechanical floor: every internal file:line cite in an armed
  // doc must resolve to a file that exists with ≥ that many lines.
  // Bounded: first 30 cites per doc; .unlazy/, URLs, and vendored paths
  // don't count.
  const citeProblems = [];
  for (const docPath of [...(state.plan_docs || []), ...(state.audit_armed || [])]) {
    const fp = existsSync(docPath) ? docPath : join(ROOT, docPath);
    if (!existsSync(fp)) continue;
    const dtext = fenceStrip(readText(fp) || "");
    // E1: the second alternative is basename-form (`name.mdc:N`) — the
    // docs' most common cite form was invisible because the pattern
    // demanded a separator. Basename parse is pinned to the extensions
    // whose homes are known; other extensions keep requiring a path.
    // Backticked cites may span spaces — a directory like `petnet v3/` is a
    // legitimate cite. Collect them first: the bare pattern below truncates
    // the same cite to its post-space tail (`v3/...`) and would report that
    // tail stale, so bare matches inside a backticked span are dropped.
    const btSpans = [];
    const cites = [];
    for (const bt of dtext.matchAll(/`((?:[\w .-]+[\/\\])+[\w .-]+\.(?:mjs|js|ts|tsx|jsx|py|css|html|j2|md|mdc|json|ya?ml|vue|svelte|go|rs)):(\d{1,6})\b(?!\d)/g)) {
      if (!bt[1].includes(" ")) continue;
      btSpans.push([bt.index, bt.index + bt[0].length]);
      cites.push(bt);
    }
    cites.push(...dtext.matchAll(/(?:^|[\s`(])((?:[\w.-]+[\/\\])+[\w.-]+\.(?:mjs|js|ts|tsx|jsx|py|css|html|j2|md|mdc|json|ya?ml|vue|svelte|go|rs)|[\w.-]+\.(?:mdc|md|mjs|py)):(\d{1,6})\b/g)
      .filter((m) => !btSpans.some(([s, e]) => m.index >= s && m.index < e)));
    // Resolution order: repo-root → the citing doc's own directory →
    // .unlazy/ (docs cite sibling artifacts shorthand) → suffix search
    // under app (prose cites basename-scoped paths like
    // `members/style.css` — a location that resolves is checkable).
    // resolve → array of matching paths ([] = no location). Basename
    // cites resolve inside their pinned homes — a bare name has no
    // location evidence of its own, so the class decides:
    // .mdc → rules/, .md → .unlazy/ + docs/ + root,
    // .mjs/.py → .devin/scripts/ + scripts/ + .unlazy/ + root (build
    // and render scripts live in .unlazy/). Doc-class basenames also
    // walk their home trees — artifacts live in .unlazy/<kind>/ and
    // docs/<dir>/ subdirs a flat lookup can't reach. A cite is
    // drifted only when NO match makes it valid.
    // M2: the walks were per-cite — each unresolved cite re-walked the
    // trees (22s on a cite-heavy session). Now one index per gate run,
    // built lazily on the first miss and memoized per unique cite: every
    // repeated lookup is a Map read, every distinct miss pays one scan.
    if (!globalThis.__citeTreeIndex) {
      const names = new Map(); // lowercased basename → file entries
      const files = [];        // every {abs, rel, base} for suffix scans
      for (const [rootDir, relBase] of [
        [join(ROOT, "app"), "/app"],
        [join(ROOT, ".unlazy"), "/.unlazy"],
        [join(ROOT, "docs"), "/docs"],
      ]) {
        if (!existsSync(rootDir)) continue;
        const stack = [[rootDir, relBase]];
        let seen = 0;
        while (stack.length && seen < 60000) {
          const [d, drel] = stack.pop();
          let ents; try { ents = readdirSync(d, { withFileTypes: true }); } catch { continue; }
          for (const e of ents) {
            if (++seen > 60000) break;
            const p = join(d, e.name);
            const prel = `${drel}/${e.name}`;
            if (e.isDirectory()) {
              if (!/^(node_modules|\.git|dist|build|__pycache__)$/i.test(e.name)) stack.push([p, prel]);
            } else {
              const ent = { abs: p, rel: prel, base: relBase };
              const ln = e.name.toLowerCase();
              if (!names.has(ln)) names.set(ln, []);
              names.get(ln).push(ent);
              files.push(ent);
            }
          }
        }
      }
      globalThis.__citeTreeIndex = { names, files };
    }
    const treeIndex = globalThis.__citeTreeIndex;
    if (!globalThis.__citeResolveMemo) globalThis.__citeResolveMemo = new Map();
    const resolveMemo = globalThis.__citeResolveMemo;
    const ROOT_N = String(ROOT).replace(/\\/g, "/").replace(/\/+$/, "");
    const walkBasename = (rootDirs, name) => {
      const ln = String(name).toLowerCase();
      const ents = treeIndex.names.get(ln) || [];
      const hits = [];
      for (const rootDir of rootDirs) {
        const want = String(rootDir).replace(/\\/g, "/").replace(ROOT_N, "");
        for (const e of ents) if (e.rel.startsWith(want + "/")) hits.push(e.abs);
      }
      return hits;
    };
    const resolve = (rel) => {
      if (resolveMemo.has(rel)) return resolveMemo.get(rel);
      const done = (hits) => { resolveMemo.set(rel, hits); return hits; };
      if (!/[\/\\]/.test(rel)) {
        const homes = /\.mdc$/i.test(rel) ? ["rules"]
          : /\.md$/i.test(rel) ? [".unlazy", "docs", ""]
          : [".devin/scripts", "scripts", ".unlazy", ""];
        const hits = homes.map((h) => join(ROOT, h, rel)).filter((c) => existsSync(c));
        if (!/\.mdc$/i.test(rel)) hits.push(...walkBasename([join(ROOT, ".unlazy"), join(ROOT, "docs")], rel));
        return done(hits);
      }
      const cands = [join(ROOT, rel), join(fp, "..", rel), join(ROOT, ".unlazy", rel), join(ROOT, "app", rel)];
      const direct = cands.filter((c) => existsSync(c));
      if (direct.length) return done(direct);
      // Basename-shorthand cites (`members/style.css`, `domain/groups/dto.py`)
      // resolve by suffix — a scan of the shared tree index; every match
      // collected (a mirrored tree like app/ vs platform/ resolves to
      // both — the cite is stale only if none makes it valid).
      const suf = "/" + rel.replace(/^\.?\//, "");
      const hits = treeIndex.files
        .filter((f) => (f.base === "/app" || f.base === "/.unlazy") && f.rel.endsWith(suf))
        .map((f) => f.abs);
      return done(hits);
    };
    for (const cm of cites.slice(0, 30)) {
      const rel = cm[1].replace(/\\/g, "/");
      if (/^https?:|^\.unlazy\//i.test(rel)) continue;
      const cfps = resolve(rel);
      if (!cfps.length) {
        citeProblems.push(`${String(docPath).split(/[\\/]/).pop()}: cite ${rel}:${cm[2]} names a file that doesn't exist`);
      } else {
        const n = +cm[2];
        const valid = cfps.some((cfp) => {
          try { return n <= readText(cfp).split(/\r?\n/).length + 5; } catch { return false; }
        });
        if (!valid) citeProblems.push(`${String(docPath).split(/[\\/]/).pop()}: cite ${rel}:${cm[2]} is past EOF in every location the name resolves to — the cite drifted`);
      }
      if (citeProblems.length >= 5) break;
    }
    if (citeProblems.length >= 5) break;
  }
  if (citeProblems.length && !exempt("CITEFRESH", "*")) {
    failures.push(
      `CITE-FRESHNESS: ${citeProblems.length} stale internal cite(s) — ${citeProblems.slice(0, 3).join("; ")}. ` +
      `A cite names a checkable location; a drifted cite is evidence that cites nothing (re-cite, or EXEMPT-CITEFRESH: * — <reason>) (AD-F4).`
    );
  }

  // E2: UPSTREAM: re-arm — a major/critical findings row in a
  // review/iteration/analysis artifact may route the finding to the
  // artifact that produced the defect with `UPSTREAM: <doc> [#section]`.
  // The named doc gains a delta obligation: a `## Delta`/`## Prior-pass`
  // (or `## Prior-pass gap`) row naming the finding id. Scope is
  // delta-only — GAP-REVIEW/EYES/OPEN-LEDGER do not re-fire; and a doc
  // that already names the id does not re-arm (same-id dedup kills
  // ping-pong). Emission is legal ONLY inside a findings-shaped table
  // (a `severity` column) — a bare `UPSTREAM:` in prose routes nothing.
  try {
    const upDocs = new Set();
    for (const p of [join(ARTIFACT_DIR, `${sid}.md`), join(ROOT, ".unlazy", "iteration", `${sid}.md`),
      ...(state.audit_armed || []).map((p) => (existsSync(p) ? p : join(ROOT, p))),
      ...(state.marker_docs || []).map((p) => (existsSync(p) ? p : join(ROOT, p)))]) {
      if (existsSync(p)) upDocs.add(p);
    }
    const upMisuse = [];
    const upNeeds = [];
    for (const dp of upDocs) {
      const raw = fenceStrip(readText(dp) || "");
      // A table is findings-shaped iff its header row carries `severity`;
      // UPSTREAM: on any other line (or in any other table) is prose
      // routing — legal only as a backticked mention.
      const lines = raw.split(/\r?\n/);
      // Track the table the line sits in: the first non-separator `|`
      // row after any non-table line is a header — `inSev` is true only
      // for tables whose header carries `severity`. A later table's
      // rows must NOT inherit a previous severity table's scope.
      let inSev = false;
      let expectHdr = true;
      let sevIdx = -1;
      const sevHdr = /^\s*\|[^\n]*\bseverity\b[^\n]*\|/i;
      const isRow = (l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l);
      for (const l of lines) {
        const mentioned = l.replace(/`[^`\n]*`/g, "");
        const hasUp = /UPSTREAM\s*:/i.test(mentioned);
        if (!/^\s*\|/.test(l)) {
          // Non-table line — a bare `UPSTREAM:` in prose routes nothing.
          inSev = false; expectHdr = true; sevIdx = -1;
          if (hasUp) upMisuse.push(`${basename(dp)}: "${l.trim().slice(0, 80)}"`);
          continue;
        }
        if (!isRow(l)) continue; // `|---` separator — header already decided
        if (expectHdr) {
          inSev = sevHdr.test(l); expectHdr = false;
          if (inSev) {
            const hc = l.split("|").slice(1, -1).map((c) => c.trim().toLowerCase());
            sevIdx = hc.findIndex((c) => /severity/.test(c));
          }
          continue;
        }
        if (!hasUp) continue;
        if (!inSev) { upMisuse.push(`${basename(dp)}: "${l.trim().slice(0, 80)}"`); continue; }
        const cells = l.split("|").slice(1, -1).map((c) => c.trim());
        const fid = cells.find((c) => /^[A-Z]{1,6}[-\d]+[\w.-]*$/.test(c)) || cells[0] || "?";
        // Column-indexed severity — a detail cell that happens to start
        // with a severity word ("major rework needed") must not decide
        // the arm; the header names which column carries it.
        const sev = (sevIdx >= 0 ? cells[sevIdx] : cells.find((c) => /^(crit|high|major|moderate|minor|nit|low)/i.test(c))) || "";
        if (!/^(crit|high|major)/i.test(sev)) continue; // delta obligation arms on major+critical only
        const upM = mentioned.match(/UPSTREAM\s*:\s*([\w./\\-]+\.md)\b/i) || mentioned.match(/UPSTREAM\s*:\s*([\w.-]+\.(?:md|mdc))/i);
        if (!upM) { upMisuse.push(`${basename(dp)}: "${l.trim().slice(0, 80)}" — UPSTREAM: names no .md doc`); continue; }
        const tgt = upM[1].replace(/\\/g, "/");
        // Basename targets get the doc homes flat, then a bounded walk —
        // upstream docs live in subdirs (.unlazy/analysis/, app/AI
        // Docs/Active Work/) a flat lookup can't reach.
        const tp = (() => {
          if (existsSync(tgt)) return tgt;
          if (existsSync(join(ROOT, tgt))) return join(ROOT, tgt);
          const bn = basename(tgt);
          if (/[\/\\]/.test(tgt)) return null;
          for (const h of [".unlazy", "docs", ""]) { const c = join(ROOT, h, bn); if (existsSync(c)) return c; }
          for (const rootDir of [join(ROOT, ".unlazy"), join(ROOT, "docs")]) {
            if (!existsSync(rootDir)) continue;
            const stack = [rootDir]; let seen = 0;
            while (stack.length && seen < 20000) {
              const d = stack.pop();
              let ents; try { ents = readdirSync(d, { withFileTypes: true }); } catch { continue; }
              for (const e of ents) {
                if (++seen > 20000) break;
                const p = join(d, e.name);
                if (e.isDirectory()) { if (!/^(node_modules|\.git|dist|build|__pycache__)$/i.test(e.name)) stack.push(p); }
                else if (e.name.toLowerCase() === bn.toLowerCase()) return p;
              }
            }
          }
          return null;
        })();
        if (!tp) { upNeeds.push(`${basename(dp)} row ${fid}: UPSTREAM: ${tgt} names a doc that doesn't exist`); continue; }
        const uText = fenceStrip(readText(tp) || "");
        const deltaB = (sectionBody(uText, "delta") || "") + (sectionBody(uText, "prior-pass") || "") + (sectionBody(uText, "prior-pass gap") || "");
        if (!new RegExp(`\\b${fid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(deltaB)) {
          upNeeds.push(`${basename(tp)}: re-armed by UPSTREAM: from ${basename(dp)} row ${fid} — needs a ## Delta / ## Prior-pass row naming ${fid} (delta-obligation only; the doc does not re-run its full gates)`);
        }
      }
    }
    if (upMisuse.length && !exempt("UPSTREAM", "*")) {
      failures.push(`UPSTREAM-EMIT: ${upMisuse.length} bare UPSTREAM: line(s) outside findings-shaped (severity-column) tables — ${upMisuse.slice(0, 2).join("; ")}. A routing marker in prose routes nothing; put it on a major/critical findings row or backtick it as a mention (or EXEMPT-UPSTREAM: * — <reason>).`);
    }
    if (upNeeds.length && !exempt("UPSTREAM", "*")) {
      failures.push(`UPSTREAM-REARM: ${upNeeds.length} unmet upstream delta obligation(s) — ${upNeeds.slice(0, 3).join("; ")} (or EXEMPT-UPSTREAM: * — <reason>).`);
    }
  } catch { /* UPSTREAM scan fails open */ }

  for (const docPath of (state.plan_docs || [])) {
    // .unlazy/eyes/ artifacts are stranger-pass records — instruments,
    // not deliverables: a pass can't review itself, and its findings get
    // dispositioned in the consuming round's table, not in its own file.
    if (/\.unlazy[\/\\]eyes[\/\\]/i.test(docPath)) continue;
    const absDoc = existsSync(docPath) ? docPath : join(ROOT, docPath);
    // A doc that armed obligations and was then deleted is an unmet
    // obligation, not a clearance — missing used to silently skip.
    if (!existsSync(absDoc)) {
      if (!exempt("LEDGER", docPath) && !exempt("MISSING", docPath)) {
        failures.push(
          `MISSING-DOC: ${docPath} armed ledger/doc obligations this session but no longer exists — deletion is not a disposition. ` +
          `Restore the doc or add \`EXEMPT-MISSING: ${docPath} — <reason>\` to ${evidenceRel}.`
        );
      }
      continue;
    }
    // The ledger scans read the RAW text — fenceStrip used to hide
    // ``` blocks, so `QUEUED:`/`DONE:` parked inside a "schema example"
    // escaped every deferral scan (R15-F12). Inline `` ` `` mentions are
    // still handled per-line by stripSpans below.
    const docText = readText(absDoc) || "";
    // …but section-EXISTENCE and drive-steering read the fence-stripped
    // text: a fenced schema example (`## Gap review`, `Driver: x`,
    // `Drive: continuous`) is a mention, not a section — it must not
    // satisfy presence checks or steer isMine (R16-F14). The deferral
    // LABEL scans stay on raw text: a fenced label is parked work, not
    // vocabulary.
    const docTextNF = fenceStrip(docText);
    if (!exempt("LEDGER", docPath)) {
      const openLines = docText
        .split(/\r?\n/)
        .map(stripSpans)
        .filter((l) => (DEFERRAL_RE.test(l) || DEFERRAL_MARK_RE.test(l) || GAP_RE.test(l) || SELFDEFER_RE.test(l)) && !disposedOf(l, acceptedOk));
      // VERDICT-CLOSER (autopsy U8-1): an impossibility-verdict line
      // needs the falsification record or the routed decision — a bare
      // "unmitigated" is a self-closure whatever costume it wears.
      const verdictLines = docText
        .split(/\r?\n/)
        .map(stripSpans)
        .filter((l) => VERDICT_RE.test(l) && !disposedOf(l, acceptedOk) && !FALSIFY_RE.test(l));
      if (verdictLines.length) {
        failures.push(
          `VERDICT-CLOSER: ${docPath} has ${verdictLines.length} impossibility-verdict line(s) with no falsification/disposition marker — ` +
          `"${verdictLines[0].trim().slice(0, 120)}"${verdictLines.length > 1 ? ` (+${verdictLines.length - 1} more)` : ""}. ` +
          `A verdict on doability ("unmitigated", "impossible", "can't be") is legal only with a falsification record ` +
          `(\`found:\`/\`cleared:\`/\`tried:\` — what was attempted against the fix) or a routed decision ` +
          `(\`PROPOSED:\`/\`ROUTED:\`/\`BLOCKED:\`/\`ACCEPTED:\`) (autopsy U8-1, 14-stop-integrity).`
        );
      }
      // A BLOCKED: line is legal to write (it names the wall) but it is
      // still open work — collected here and held against a declared
      // STOP: class in gate-evidence before the turn may end.
      docText.split(/\r?\n/).forEach((l) => {
        if (/^\s*[-*|>]*\s*BLOCKED\s*:/i.test(l)) blockedOpen.push(l.trim().slice(0, 80));
      });
      if (openLines.length) {
        failures.push(
          `OPEN-LEDGER: ${docPath} has ${openLines.length} deferral/undisposed-coverage line(s) with no BLOCKED/ACCEPTED marker — ` +
          `"${openLines[0].trim().slice(0, 120)}"${openLines.length > 1 ? ` (+${openLines.length - 1} more)` : ""}. ` +
          `Deferral labels and named-unexamined units are open work — finish them now. The only legal markers: ` +
          `\`BLOCKED: <external wall — credential/service/person, never effort or later>\` or, where the user re-scoped, ` +
          `\`ACCEPTED: <item> — user <verb> <date>\` (a user verb is required). QUEUED:/SKIPPED: are not states. ` +
          `Last resort: \`EXEMPT-LEDGER: <file> — <reason>\` in ${evidenceRel} (00-operating §2e, 03-periodic-audits 4b).`
        );
      }
    }
    // Basename-shape was evadable: a deliverable named `session-notes.md`
    // slipped the arm. A doc living under .unlazy/ IS a produced artifact
    // (excluded dirs — design-review/spec/evidence/state/audit-ledger —
    // never reach this list), so it is deliverable-armed regardless of
    // what the author named it. Active Work ledgers keep basename shape.
    const isDeliverableDoc = GAP_DOC_RE.test(docPath) || docPath.replace(/\\/g, "/").includes(".unlazy/");
    if (isDeliverableDoc && !exempt("GAPREVIEW", docPath)) {
      const m = docTextNF.match(GAP_SECTION_RE);
      const gapBody = m ? m[1].replace(/\s+/g, " ").trim() : "";
      if (!m || gapBody.length < 40) {
        failures.push(
          `GAP-REVIEW: ${docPath} presents as a deliverable (plan/proposal/analysis/review/findings/audit by name) but has no non-empty ## Gap review section — ` +
          `the author→reviewer pass either didn't run or wasn't recorded. Run the orthogonal enumerations ` +
          `(audiences × asks, lifecycle states, user journeys, concept demands, ask re-read), record each walk's ` +
          `finds in a ## Gap review section, or add EXEMPT-GAPREVIEW: ${docPath} — <reason> to ${evidenceRel} (00-operating §2a).`
        );
      }
    }
    // Self-produced deliverables also carry the independent-eyes record —
    // the instrument that grades the artifact must differ from the one
    // that produced it (15-analysis-depth machinery item 7). A
    // `## Independent eyes` section recording the pass (who ran it, what
    // it saw, findings, what was incorporated) or an explicit
    // `DECLARED: <why none>` line inside it satisfies the check.
    if (isDeliverableDoc && !exempt("EYES", docPath)) {
      const eyeM = docTextNF.match(/^#{1,6}\s*independent\s+eyes\b[^\n]*\n([\s\S]*?)(?=\n^#{1,2}\s|$(?![\s\S]))/im);
      const eyeBody = eyeM ? eyeM[1].replace(/\s+/g, " ").trim() : "";
      // Presence isn't the pass: "PENDING" or a one-liner satisfies the
      // shape while running nothing. The section needs real content
      // (≥40 chars) OR an explicit DECLARED with a substantive why.
      const eyesOk = eyeBody.length >= 40 || /DECLARED\s*:\s*.{15,}/i.test(eyeBody);
      if (!eyeM || !eyesOk) {
        failures.push(
          `INDEPENDENT-EYES: ${docPath} presents as a deliverable but has no non-empty ## Independent eyes section — ` +
          `the self-produced artifact was self-graded. Run a fresh-eyes pass (an agent seeing only the artifact ` +
          `plus its question — never the spec, intent, or diff), record who ran it + findings + what was ` +
          `incorporated in a ## Independent eyes section, or add a DECLARED: <why none> line inside it, or ` +
          `EXEMPT-EYES: ${docPath} — <reason> to ${evidenceRel} (15-analysis-depth item 7).`
        );
      }
    }

    // --- PLAN-DRIVE: Drive: continuous makes QUEUED non-terminal ----------
    tick("PLAN-DRIVE: Drive: continuous makes QUEUED non-terminal");
    // 00-operating §2e: a drive-mode plan means slices are execution units,
    // not pause points. QUEUED rows must reach DONE / BLOCKED / ACCEPTED
    // before the turn ends. `Driver:` scopes the obligation to one session.
    if (/^\s*drive\s*:\s*continuous\b/im.test(docTextNF) && !exempt("DRIVE", docPath)) {
      const driverMatch = docTextNF.match(/^\s*[-*]?\s*driver\s*:\s*(\S+)/im);
      // `Driver: <other>` claims another session owes it — corroborate: a
      // driver with no REAL gate-state record never ran. Existence alone
      // isn't ownership — a planted `{}`/keys-only file is the same
      // bootstrap artifact the missing-state path detects, so the record
      // must carry at least one tracker-written field.
      const otherDriverExists = driverMatch && driverMatch[1] !== sid && foreignDriverState(driverMatch[1]);
      const owesDrive = !driverMatch || driverMatch[1] === sid || !otherDriverExists;
      if (owesDrive) {
        const queuedLines = docText
          .split(/\r?\n/)
          .map(stripSpans)
          .filter((l) => /\bQUEUED\b/i.test(l) && !/\b(BLOCKED|ACCEPTED|DONE|LANDED)\b/i.test(l));
        if (queuedLines.length) {
          failures.push(
            `PLAN-DRIVE: ${docPath} is Drive: continuous with ${queuedLines.length} QUEUED row(s) still open — ` +
            `"${queuedLines[0].trim().slice(0, 120)}"${queuedLines.length > 1 ? ` (+${queuedLines.length - 1} more)` : ""}. ` +
            `Drive mode means the turn cannot end while QUEUED work remains: execute it, or mark each ` +
            `\`BLOCKED: <exact blocker or the decision only the user can make>\`, or get user agreement and mark ` +
            `\`ACCEPTED:\`, or flip the plan to \`Drive: checkpointed\` / remove the flag, or add ` +
            `\`EXEMPT-DRIVE: ${docPath} — <reason>\` to ${evidenceRel} (00-operating §2e drive contract).`
          );
        }
      }
    }

    // Driver-scoped open rows (14-stop-integrity): a ledger doc this
    // session drives (Driver: <sid>) in checkpointed/undeclared mode may
    // hold an honest backlog — but ending the turn on it owes the
    // declared STOP: class, collected for STOP-DECLARED below. A driven
    // doc also feeds DRIVE-DECLARED — its drive mode must be written,
    // not defaulted.
    const drvMode = docTextNF.match(/^\s*[-*]?\s*driver\s*:\s*(\S+)/im);
    const drvOtherExists = drvMode && drvMode[1] !== sid && foreignDriverState(drvMode[1]);
    const isMine = drvMode && (drvMode[1] === sid || !drvOtherExists);
    if (isMine) {
      drivenDocs.push(docPath);
      if (/^\s*drive\s*:\s*(continuous|checkpointed)\b/im.test(docText)) driveDeclared = true;

      // DONE/LANDED rows are claims that work landed — they owe an
      // inspectable citation, not a summary (14-stop-integrity: no citation
      // → treat as fabricated). A done-row must name where it landed: at
      // least one anchored repo path that exists (a fabricated marker can
      // still lie semantically, but it can no longer cite nothing).
      if (!exempt("DONECITE", docPath)) {
        const doneRows = docText
          .split(/\r?\n/)
          // `DONE fixes` (space+word) is a done-claim too — the
          // delimiter-only lookahead let it escape the cite requirement
          // (R14-F23). `DONEfixes` doesn't match (needs \s before a word).
          .filter((l) => /(^|\|)\s*(DONE|LANDED)(?=\s*[|(:—\-]|\s+\S)/.test(l));
        const uncited = doneRows.filter((l) => !citedPaths(l).some((p) => anchoredPathExists(p)));
        if (uncited.length) {
          failures.push(
            `DONE-CITE: ${docPath} marks ${uncited.length} row(s) DONE/LANDED with no inspectable citation — ` +
            `"${uncited[0].trim().slice(0, 110)}"${uncited.length > 1 ? ` (+${uncited.length - 1} more)` : ""}. ` +
            `A done-claim names where it landed: cite a repo path that exists (app/…, legacy/…, .devin/…, .unlazy/…, or absolute), ` +
            `or add \`EXEMPT-DONECITE: ${docPath} — <reason>\` to ${evidenceRel} (14-stop-integrity).`
          );
        }
      }
    }
    if (!isMine && !exempt("DONECITE", docPath) && transcriptRaw) {
      // Undriven ledger docs: historical DONE rows are other sessions'
      // records — but a done-claim THIS session wrote is attributable via
      // the transcript (the write's own content carries the row), so
      // omitting `Driver:` can't launder an uncited claim (R15 own-walk:
      // driver-scoping made DONE-CITE opt-in). No transcript → the row
      // can't be attributed → same degradation as the other
      // transcript-dependent checks.
      const doneLineRe = /(^|\|)\s*(DONE|LANDED)(?=\s*[|(:—\-]|\s+\S)/;
      const docNorm = docPath.replace(/\\/g, "/");
      // Compare rows whitespace/pipe-normalized on BOTH sides — a later
      // cosmetic re-wrap or pipe-respace of the same row used to break
      // attribution and launder the session's own done-claim into a
      // "pre-existing" row (R16-F20).
      const normRow = (s) => String(s).replace(/\s*\|\s*/g, "|").replace(/\s+/g, " ").trim();
      const writtenLines = new Set();
      for (const e of transcriptEditContents(transcriptRaw)) {
        const fp = e.filePath.replace(/\\/g, "/");
        if (fp !== docNorm && !fp.endsWith("/" + docNorm) && !docNorm.endsWith("/" + fp)) continue;
        for (const l of e.newContent.split(/\r?\n/)) writtenLines.add(normRow(l));
      }
      // Exec/pty writes carry the row inside the command text (heredoc,
      // echo) — a doc row that appears verbatim inside a command that
      // wrote to this doc is this session's claim the same way.
      const cmdCorpus = normRow(transcriptCommands(transcriptRaw));
      const attributed = docText
        .split(/\r?\n/)
        .filter((l) => doneLineRe.test(l) &&
          (writtenLines.has(normRow(l)) || (normRow(l).length >= 8 && cmdCorpus.includes(normRow(l)))))
        .filter((l) => !citedPaths(l).some((p) => anchoredPathExists(p)));
      if (attributed.length) {
        failures.push(
          `DONE-CITE: ${docPath} marks ${attributed.length} row(s) DONE/LANDED this session wrote with no inspectable citation — ` +
          `"${attributed[0].trim().slice(0, 110)}"${attributed.length > 1 ? ` (+${attributed.length - 1} more)` : ""}. ` +
          `A done-claim names where it landed: cite a repo path that exists, ` +
          `or add \`EXEMPT-DONECITE: ${docPath} — <reason>\` to ${evidenceRel} (14-stop-integrity).`
        );
      }
    }
    if (!/^\s*drive\s*:\s*continuous\b/im.test(docTextNF)) {
      if (isMine) {
        const openRows = docText.split(/\r?\n/).map(stripSpans).filter(
          (l) => /^\s*[-*]\s*\[\s\]/.test(l) ||
                 (/\bQUEUED\b/i.test(l) && !/\b(BLOCKED|ACCEPTED|DONE|LANDED)\b/i.test(l))
        );
        if (openRows.length) drivenOpen.push(`${docPath} (${openRows.length} open row(s))`);
      }
    }

    // Findings terminal-state — extended to analysis/planning docs. The
    // design-review artifact already enforces this; findings tables in
    // plan/analysis docs had no scan at all, so a finding could stay
    // open forever inside an armed doc. Guard: only tables whose header
    // carries `finding` or `severity` count — `disposition` alone does
    // NOT classify (spec/plan tables legitimately carry disposition
    // columns for deferred decisions that are already BLOCKED/ACCEPTED
    // vocabulary). Terminal: FIXED | VERIFIED | FILED: | CARRIED: |
    // BLOCKED: | ACCEPTED: | NOT-A-DEFECT: — 15-analysis-depth item 15.
    if (isDeliverableDoc && !exempt("FINDINGS", docPath)) {
      const LFINDINGS_HDR_RE = /\b(finding|severity|disposition)\b/i;
      // Same label-vs-prose rule as the design-review scan: a data row
      // whose prose mentions "severity" is not a findings-table header.
      // `disposition` is NOT a label — spec/plan tables legitimately
      // carry disposition columns (the comment above says so; the regex
      // drifted and re-added it anyway — R14-F15, code-vs-comment drift).
      const LFINDINGS_LABEL_RE = /^(?:findings?|severity|sev)$/i;
      const isLFindingsHeader = (l) =>
        /^\s*\|/.test(l) && LFINDINGS_HDR_RE.test(l) &&
        l.split("|").some((c) => LFINDINGS_LABEL_RE.test(c.trim()));
      const LSEP_RE = /^\s*\|[\s:\-|]+\|\s*$/;
      const lastCellL = (l) => {
        const cs = l.split("|").map((c) => c.trim()).filter(Boolean);
        return cs[cs.length - 1] || "";
      };
      const lterminal = (l) =>
        /^(fixed|verified|filed\s*:|carried\s*:|blocked\s*:|not-a-defect\s*:)/i.test(lastCellL(l)) ||
        (/^accepted\s*:/i.test(lastCellL(l)) && USER_VERB_RE.test(l) && acceptedOk(l));
      const docLines = docText.split(/\r?\n/);
      const lOpen = [];
      for (let i = 0; i < docLines.length - 1; i++) {
        if (!isLFindingsHeader(docLines[i])) continue;
        // Header+separator is the textbook shape, but a `| finding |` row
        // followed immediately by data rows is still a findings table —
        // dropping the `|---|` must not escape the scan.
        if (LSEP_RE.test(docLines[i + 1])) i++;
        else if (!/^\s*\|/.test(docLines[i + 1])) continue;
        for (let j = i + 1; j < docLines.length && /^\s*\|/.test(docLines[j]); j++) {
          if (!lterminal(docLines[j])) lOpen.push(docLines[j]);
          else if (/^blocked\s*:/i.test(lastCellL(docLines[j]))) blockedOpen.push(docLines[j].trim().slice(0, 80));
        }
      }
      // Same header-independent backstop: an open-status last cell is
      // an open finding under any column names. Bare token OR token with
      // a `— note` tail (`OPEN — later` is still open). Lifecycle prose
      // (`open → confirmed` — arrow, not dash) and pointer labels
      // (`Open call 10` — space, not dash) stay unflagged.
      for (const l of docLines) {
        if (!/^\s*\|/.test(l) || lOpen.includes(l)) continue;
        if (BARE_OPEN_CELL_RE.test(lastCellL(l))) lOpen.push(l);
      }
      if (lOpen.length) {
        failures.push(
          `OPEN-FINDINGS: ${lOpen.length} findings row(s) in ${docPath} have no terminal status ` +
          `(first: "${lOpen[0].trim().slice(0, 120)}"). ` +
          `End each row | FIXED | VERIFIED | FILED: <tracker> | CARRIED: <resolved this pass> | BLOCKED: <wall> | ACCEPTED: <user verb> | NOT-A-DEFECT: <why> — ` +
          `an open finding in an armed doc is open work (15-analysis-depth item 15), or \`EXEMPT-FINDINGS: ${docPath} — <reason>\` in ${evidenceRel}.`
        );
      }
    }
  }

  // --- dark-corpus, arm-by-write, and filing resolution (boundary-study
  //     B3/B4/B6/B16) ---------------------------------------------------------
  // Three escapes lived outside plan_docs' corpus: deferral vocabulary
  // parked in the dirs the armed-scan excludes (gate-evidence, design-*,
  // eyes, iteration, audit-ledger — the "dark" dirs, excluded so the
  // machinery's own markers don't self-flag); .md writes that never
  // ledger-armed; and FILED:/CARRIED: cites that passed a shape check
  // while naming no real destination. One pass over the union corpus
  // closes all three with marker-aware discharge: machinery-marker
  // lines clear, everything else deferral-shaped flags.
  try {
    const DARK_DIR_RE = /\.unlazy\/(design-review|design-spec|gate-evidence|gate-state|audit-ledger|iteration|eyes)\//i;
    const writeDocs = (Array.isArray(state.instrument_output_writes) ? state.instrument_output_writes : [])
      .map((w) => String((w && w.p) || "").replace(/\\/g, "/"))
      .filter((p) => /\.md$/i.test(p));
    // F1: the write feed used to cover only coverage|eyes, so 5 of the 7
    // dark dirs were invisible. Session-named docs (`<sid>.md`,
    // `<sid>-*.md`) in the dark dirs are this session's corpus by the
    // repo's own naming convention — scan them directly; other sessions'
    // basenames never carry this sid (no cross-session contamination).
    const darkDocs = [...new Set([
      ...writeDocs.filter((p) => DARK_DIR_RE.test(p)),
      String(evidenceRel).replace(/\\/g, "/"),
      ...(() => {
        const out = [];
        for (const d of ["design-review", "design-spec", "gate-evidence", "audit-ledger", "iteration", "eyes"]) {
          let files = [];
          try { files = readdirSync(join(ROOT, ".unlazy", d)); } catch { continue; }
          for (const f of files) {
            if (/\.md$/i.test(f) && f.toLowerCase().includes(GATE_SID.toLowerCase())) out.push(`.unlazy/${d}/${f}`);
          }
        }
        return out;
      })(),
    ])];
    const armedExtra = writeDocs.filter(
      (p) => /\.unlazy\/.*\.md$/i.test(p) && !DARK_DIR_RE.test(p) && !(state.plan_docs || []).includes(p)
    );
    // Consumed-marker sets derived from this file's own source so the
    // list can't drift from the checks that consult them (B14): an
    // EXEMPT-X:/DECLARED: line naming something nothing consumes is a
    // marker-shaped dead letter — the DECLARED: CAPTURE-PARITY defect.
    let selfSrc = "";
    try { selfSrc = readText(fileURLToPath(import.meta.url)) || ""; } catch { /* best-effort */ }
    const consumedExempts = new Set([...selfSrc.matchAll(/exempt\(\s*"([A-Z0-9-]+)"/g)].map((m) => m[1].toUpperCase()));
    const consumedDeclared = new Set([...selfSrc.matchAll(/DECLARED:\s*([A-Z][A-Z0-9-]*)/g)].map((m) => m[1].toUpperCase()));
    // F8: emitted check-ids — `failures.push("NAME: …")` / `.push(\`NAME:` —
    // a DECLARED: NAME marker legitimately discharges a check the gate
    // actually emits; a name found only in comments/vocabulary is dead.
    const emittedIds = new Set([...selfSrc.matchAll(/\.push\(\s*[`"']([A-Z][A-Z0-9-]{2,})\s*:/g)].map((m) => m[1]));
    const resolveFile = (t) => {
      for (const c of [t, join(ROOT, t)]) { try { if (existsSync(c) && underRoot(c)) return c; } catch { /* next */ } }
      return null;
    };
    // A filing must land somewhere real: the cite resolves to a file on
    // disk AND ≥2 content words of the finding stem appear in it (the
    // entry exists, not just the file). `external:<tracker>` is the
    // declared non-file form; self-target filings are vacuous. Bound to
    // canonical FILED: (uppercase marker) — CARRIED: destinations are
    // legitimately non-file (rounds/batches), and lowercase `filed:`
    // is prose. Targets starting `<`/`/`/`(` are template mentions.
    // Disposition POSITIONS only (mention-vs-use): `FILED:` leads a
    // line (after bullet markers) or a table cell — a `FILED:` inside
    // prose describes the contract, it doesn't exercise it. This doc's
    // own machinery walkthroughs carry `FILED:` in example cells.
    const filingDispos = (l) => {
      const out = [];
      // F3: case-insensitive — `| x | filed: nowhere.md |` terminates the
      // row via the case-insensitive lterminal arm, so a lowercase cite
      // escaped resolution entirely while still discharging the finding.
      // Strip the bullet/number prefix — filingOk re-anchors on FILED: and
      // a pushed `- FILED:` line could never match it (the whole class of
      // bulleted filings false-flagged).
      const bMatch = l.match(/^\s*(?:[-*>]|\d+\.)?\s*(FILED\s*:.*)$/i);
      if (bMatch) out.push(bMatch[1]);
      if (l.includes("|")) l.split("|").forEach((c) => {
        // F25: a cell not STARTING with FILED: still files when the marker
        // leads a file-shaped target mid-cell (`| n/a — FILED: x.md |` was
        // invisible to the start-anchored test).
        if (/^\s*FILED\s*:/i.test(c)) out.push(c);
        else { const fm = c.match(/FILED\s*:\s*[^\s|<`]+\.[a-z]{1,5}\b/i); if (fm) out.push(c.slice(fm.index)); }
      });
      return out;
    };
    const filingOk = (dispo, docPath) => {
      // Backticked targets are the normal cite form — `` ` `` is stripped
      // at tgt so it can't lead the exclusion class (a legit
      // `FILED: `path`` parsed as unparseable and false-flagged).
      const m = dispo.match(/^\s*FILED\s*:\s*([^—–|<(/\n*][^—–|\n]*?)\s*(?:—|–|--|\||$)/i);
      // F3(b): bare `FILED:` / `FILED: <angle-template>` isn't a mention —
      // in a disposition cell it's a vacuous filing and fails. Only a
      // target starting `<` (schema placeholder) stays a mention.
      if (!m) return /^\s*FILED\s*:\s*</i.test(dispo);
      const tgt = m[1].trim().replace(/[`"']/g, "");
      if (!tgt) return false;
      if (/^external\s*:/i.test(tgt)) return tgt.length > 9;
      if (basename(tgt.replace(/\\/g, "/")) === basename(docPath)) return false;
      const stem = [...contentWords(dispo.replace(m[0], " "))].filter((w) => w.length > 4);
      const f = resolveFile(tgt);
      if (f) {
        if (!stem.length) return true;
        const body = (readText(f) || "").toLowerCase();
        return stem.filter((w) => body.includes(w)).length >= 2;
      }
      // Same-doc section fallback: `FILED: DEEP PLAN …` naming a `## `
      // heading inside the containing doc. The destination must exist —
      // containment is trivial (the entry lives in the same doc). Distinct
      // from the banned self-target (filing to the doc as a whole, which
      // names no destination at all).
      const twords = [...contentWords(tgt)].filter((w) => w.length > 3);
      if (twords.length >= 2) {
        const doc = readText(docPath) || "";
        const heads = doc.match(/^#{1,4}[ \t]+.*$/gim) || [];
        if (heads.some((h) => twords.filter((w) => h.toLowerCase().includes(w)).length >= 2)) return true;
      }
      return false;
    };
    const darkHits = [];
    const deadMarks = [];
    const filingBad = [];
    const extraOpen = [];
    const extraMissing = [];
    const scanAll = [...new Set([...(state.plan_docs || []), ...armedExtra, ...darkDocs])];
    for (const p of scanAll) {
      const abs = existsSync(p) ? p : join(ROOT, p);
      if (!existsSync(abs)) {
        if (armedExtra.includes(p)) extraMissing.push(p);
        continue;
      }
      const dt = readText(abs) || "";
      for (const rawL of dt.split(/\r?\n/)) {
        // Backticks fully stripped for THIS pass: stripSpans' label-
        // carveout keeps `FILED:` inside code spans (correct for the
        // deferral scan — schema examples can't smuggle dispositions),
        // but a backticked FILED: is a mention of the FORM, never an
        // exercised filing. Unquoted examples still bind.
        const l = rawL.replace(/`[^`\n]*`/g, " ").replace(/"[^"\n]*"/g, " ");
        for (const d of filingDispos(l)) {
          if (filingOk(d, p)) continue;
          // The blanket strip also erases a backticked *target* —
          // `FILED: `path`` parses to nothing and false-fails. Retry on
          // the raw line with only FILED:-mentioning spans erased (the
          // mention-of-the-form protection stays; backticked paths live).
          const rawKeep = rawL.replace(/`[^`\n]*`/g, (s) => (/FILED\s*:/i.test(s) ? " " : s));
          if (!filingDispos(rawKeep).some((a) => filingOk(a, p))) {
            filingBad.push(`${basename(p)}: "${l.trim().slice(0, 80)}"`);
          }
        }
      }
      if (darkDocs.includes(p)) {
        for (const rawL of dt.split(/\r?\n/)) {
          const l = stripSpans(rawL);
          if (!(DEFERRAL_RE.test(l) || DEFERRAL_MARK_RE.test(l) || GAP_RE.test(l) || SELFDEFER_RE.test(l))) continue;
          if (disposedOf(l, acceptedOk) || MARKER_HEAD_RE.test(l)) continue;
          darkHits.push({ p, t: `${basename(p)}: "${l.trim().slice(0, 80)}"` });
          if (darkHits.length >= 8) break;
        }
        for (const l of dt.split(/\r?\n/)) {
          // F8: case-insensitive detection (lowercase `exempt-x:` was
          // invisible), names compared uppercase; `selfSrc.includes` was a
          // token collision — a name in a comment or failure string is not
          // a consumer. DECLARED names resolve against emitted check-ids.
          // DECLARED: <THING> — <why> is the semantic escape form (no
          // captures, self-eyes) — only an UPPERCASE id claims a check
          // name and gets checked against emitted/consumed ids.
          const dm = l.match(/^\s*DECLARED\s*:\s*([A-Z][A-Z0-9-]{2,})(?=\s|—|–|:|$)/);
          if (dm) {
            const dn = dm[1].toUpperCase();
            if (!consumedDeclared.has(dn) && !emittedIds.has(dn)) deadMarks.push(`${basename(p)}: DECLARED: ${dm[1]} — no check emits or consumes this name`);
          }
          const em = l.match(/^\s*EXEMPT-([A-Za-z0-9-]{2,})\s*:/i);
          if (em && !consumedExempts.has(em[1].toUpperCase())) deadMarks.push(`${basename(p)}: EXEMPT-${em[1]} — no exempt("${em[1].toUpperCase()}") consumer exists`);
        }
      } else if (armedExtra.includes(p)) {
        for (const rawL of dt.split(/\r?\n/)) {
          const l = stripSpans(rawL);
          if ((DEFERRAL_RE.test(l) || DEFERRAL_MARK_RE.test(l) || GAP_RE.test(l) || SELFDEFER_RE.test(l)) && !disposedOf(l, acceptedOk)) {
            extraOpen.push(`${basename(p)}: "${l.trim().slice(0, 80)}"`);
            if (extraOpen.length >= 8) break;
          }
        }
      }
    }
    if (extraMissing.length && !exempt("MISSING", "*")) {
      failures.push(`MISSING-DOC (arm-by-write): ${extraMissing.slice(0, 3).join(", ")} — written this session then deleted; deletion is not a disposition (B17).`);
    }
    if (extraOpen.length && !exempt("LEDGER", "*")) {
      failures.push(`ARM-BY-WRITE: ${extraOpen.length} deferral line(s) in .md docs written this session that never ledger-armed — ${extraOpen.slice(0, 2).join("; ")} (B16: the path-whitelist was the bound; writes are the arm).`);
    }
    if (filingBad.length && !exempt("FILING", "*")) {
      failures.push(`FILING-RESOLUTION: ${filingBad.length} FILED: cite(s) resolve nowhere or self-target — ${filingBad.slice(0, 2).join("; ")}. A filing names a real destination containing the entry, or external:<tracker> (B4-quiet).`);
    }
    const darkRemaining = darkHits.filter((h) => !exempt("DARKSCAN", h.p));
    if (darkRemaining.length && !exempt("DARKSCAN", "*")) {
      failures.push(`DARK-CORPUS: ${darkRemaining.length} deferral-shaped line(s) in machinery docs (gate-evidence/design/eyes/audit dirs) that aren't consumed markers — ${darkRemaining.slice(0, 2).map((h) => h.t).join("; ")}. Markers clear only when a check consumes them (B6), or \`EXEMPT-DARKSCAN: <doc> — <why its vocabulary is mention>\`.`);
    }
    if (deadMarks.length && !exempt("DEADMARK", "*")) {
      failures.push(`DEAD-MARKER: ${deadMarks.length} DECLARED:/EXEMPT- line(s) name checks nothing consumes — ${deadMarks.slice(0, 2).join("; ")} (a marker that discharges nothing is prose wearing a costume; or \`EXEMPT-DEADMARK: * — <reason>\`).`);
    }
    // F15: UNDECLARED-LEDGER gets teeth — a ledger doc THIS session wrote
    // in a lane dir, carrying open rows with no Lane:/Ledger: choice, was
    // prompt-nag only; the stop now refuses too. Bounded to session writes
    // (writeDocs) so pre-existing workspace ledgers don't mass-flag.
    const LANE_PATH_RE = /^(?:\.unlazy[\/\\](?:analysis|audit-ledger)[\/\\]|\.unlazy[\/\\][^\/\\]+$|docs[\/\\]|docs[\/\\](?:active-work|plans)[\/\\])/i;
    const undeclared = [];
    for (const p of writeDocs) {
      if (!/\.md$/i.test(p) || !LANE_PATH_RE.test(String(p).replace(/\\/g, "/")) && !LANE_PATH_RE.test(p)) continue;
      const dt = readText(p) || "";
      if (laneOpenRows(dt).length && !NOT_LANE_REASONED_RE.test(dt) && !/^\s*(?:Lane|Drive|Driver)\s*:/im.test(dt)) {
        undeclared.push(basename(p));
        if (undeclared.length >= 6) break;
      }
    }
    if (undeclared.length && !exempt("UNDECLAREDLEDGER", "*")) {
      failures.push(`UNDECLARED-LEDGER: ${undeclared.length} session-written ledger doc(s) carry open rows with no lane declaration — ${undeclared.slice(0, 3).join(", ")}. Each gets \`Lane: standing — <instruction>\` or \`Ledger: closed — <why>\` (or \`EXEMPT-UNDECLAREDLEDGER: * — <reason>\`).`);
    }
  } catch { /* corpus scan fails open — a parse hiccup never blocks */ }

  // --- calibration (non-UI) --------------------------------------------------
  tick("calibration (non-UI)");
  // The user-catch rule (00-operating §2a) names "analysis docs, plans,
  // code review misses, all of them" — but the design-review arm only
  // fires when a UI artifact exists. A non-UI session with recorded user
  // rejections now owes CALIBRATION: rows in an armed plan/ledger doc.
  {
    const rejectionsAll = Array.isArray(state.rejections) ? state.rejections : [];
    if (!touched.length && rejectionsAll.length && !exempt("CALIBRATION", "*")) {
      const calFound = (state.plan_docs || []).some((docPath) => {
        const p = existsSync(docPath) ? docPath : join(ROOT, docPath);
        return existsSync(p) && /CALIBRATION\s*:/i.test(fenceStrip(readText(p) || ""));
      });
      if (!calFound) {
        failures.push(
          `CALIBRATION: the user reported ${rejectionsAll.length} defect(s)/miss(es) this session and no armed doc carries a CALIBRATION: row — ` +
          `each user-caught miss is a gate failure, UI or not: \`CALIBRATION: <the miss> → <the check that should have caught it> → <the rule change made>\` ` +
          `in an armed doc, or \`EXEMPT-CALIBRATION: * — <reason>\` in ${evidenceRel} (00-operating §2a).`
        );
      }
    }
  }

  // --- audit-ledger --------------------------------------------------------
  tick("audit-ledger");
  // Analysis passes must enumerate their universe mechanically and close
  // every unit with evidence or a disposition. The gate re-runs the
  // whitelisted `verify:` commands so an understated denominator is a
  // computed mismatch, not a judgment call.
  const auditSignals = (state.audit_armed || []).length || state.audit_ledger_written;
  if (auditSignals) {
    const ledgerPath = join(AUDIT_DIR, `${sid}.md`);
    const ledgerRel = `.unlazy/audit-ledger/${sid}.md`;
    if (!existsSync(ledgerPath)) {
      if (!exempt("AUDIT", "*")) {
        failures.push(
          `AUDIT-LEDGER: analysis output was written this session (${(state.audit_armed || []).join(", ") || "ledger dir"}) but no enumeration+coverage ledger exists at ${ledgerRel}. ` +
          `Required shape (03-periodic-audits → audit-ledger): <!-- audit-ledger v1 --> + ## Enumeration ` +
          `(| universe | count | derived-by | rows — derived-by is \`verify: <read-only count command>\`, \`doc: <file>\`, or \`DECLARED: <reason>\`) ` +
          `+ ## Coverage (one row per enumerated unit: | unit | universe | evidence | state |) + ## Denial + a \`COVERED: X/Y\` line. ` +
          `Or EXEMPT-AUDIT: * — <reason> in ${evidenceRel}.`
        );
      }
    } else {
      const text = fenceStrip(readText(ledgerPath) || "");
      const missing = [];
      if (!hasMarker(text, "audit-ledger v1")) missing.push("the `<!-- audit-ledger v1 -->` marker");
      // E3 durable record: an armed ledger carries its own escape
      // telemetry — how many DECLARED:/EXEMPT-*/review-credit: lines the
      // session leaned on vs how many checks armed. Any `escape`/
      // `telemetry` line credits; the counts live in gate-state.
      if (!/\bescap\w+\b|telemetry/i.test(text)) {
        missing.push("an escape-telemetry row (E3 — the ledger records its own escape surface: DECLARED:/EXEMPT-*/review-credit: counts vs checks-armed; `escape telemetry: <n>/<m> checks` or the counts in any row)");
      }

      const section = (name) => {
        const chunks = text.split(/^## /m);
        const hits = chunks.filter((c) => new RegExp(`^${name}\\b`, "i").test(c));
        // Same-named sections MERGE — an early compliant `## Coverage`
        // must not shadow a later duplicate holding open units.
        return hits.map((h) => h.replace(/^[^\n]*\r?\n?/, "")).join("\n");
      };
      const tableRows = (sec) =>
        sec.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l));
      const cells = (row) => row.replace(/^\s*\||\|\s*$/g, "").split("|").map((c) => c.trim());

      // Enumeration: | universe | count | derived-by |
      const enumSec = section("Enumeration");
      const enumRows = tableRows(enumSec).filter((r) => !/^\s*\|\s*universe\s*\|/i.test(r));
      const universes = new Map();
      const enumProblems = [];
      for (const row of enumRows) {
        const [label, countCell, ...rest] = cells(row);
        const derived = rest.join("|"); // a verify: command may contain pipes — rejoin the tail cells
        const n = parseInt(countCell, 10);
        if (!label || !Number.isFinite(n) || n < 0) { enumProblems.push(`unparseable enumeration row "${row.slice(0, 100)}"`); continue; }
        universes.set(label, { n, derived });
        const verify = derived.match(/verify:\s*(.+)$/i);
        const doc = derived.match(/doc:\s*(.+)$/i);
        const declared = derived.match(/DECLARED:\s*(.{10,})/i);
        if (verify) {
          const cmd = verify[1].replace(/^`|`$/g, "").trim();
          // Shared whitelist + executor (top of file) — POSIX-only:
          // a whitelisted command bash cannot run (Get-ChildItem lived
          // here) is a guaranteed failure wearing a verify: label.
          if (!verifyWhitelisted(cmd)) {
            enumProblems.push(`"${label}" verify command is not in the read-only whitelist — re-run it yourself and paste the output with \`doc: <capture-file>\`, or justify with \`DECLARED: <reason>\``);
          } else {
            const r = runVerify(cmd);
            if (!r.ran) {
              enumProblems.push(`"${label}" verify command failed to run (${r.err}) — fix it or convert to DECLARED:`);
            } else {
              const actual = parseInt(String(r.out).trim().split(/\r?\n/).pop(), 10);
              if (actual !== n) {
                enumProblems.push(`"${label}" declared ${n} but \`${cmd}\` returns ${actual} — the universe is ${actual > n ? "under" : "over"}-enumerated`);
              }
            }
          }
        } else if (doc) {
          const docPath = doc[1].replace(/^`|`$/g, "").trim();
          // Absolute in-repo cites resolve directly — join(ROOT, "C:/…")
          // produced a nonexistent path and falsely rejected them (R12-F19).
          const docAbs = existsSync(docPath) ? docPath : join(ROOT, docPath);
          if (!existsSync(docAbs) || !underRoot(docAbs)) {
            enumProblems.push(`"${label}" cites doc \`${docPath}\` which does not exist inside the repo`);
          }
        } else if (!declared) {
          enumProblems.push(`"${label}" derived-by must be \`verify: <read-only cmd>\`, \`doc: <file>\`, or \`DECLARED: <reason>\` — got "${derived.slice(0, 60)}"`);
        }
      }
      if (!enumRows.length) missing.push("a non-empty ## Enumeration table");

      // Coverage: | unit | universe | evidence | state |
      const covSec = section("Coverage");
      const covRows = tableRows(covSec).filter((r) => !/^\s*\|\s*#?\s*\|?\s*unit\s*\|/i.test(r));
      const DONE_RE = /^(DONE|VERIFIED|MEASURED)$/i;
      const DISP_RE = /^(BLOCKED|ACCEPTED)\s*:\s*\S+/i;
      const OPEN_STATE_RE = /^OPEN\b/i;
      const BAD_STATE = [];
      const NO_EVIDENCE = [];
      const UNDECLARED = [];
      const SAMPLE_FLOOR = [];
      const openUnits = [];
      let covered = 0;
      for (const row of covRows) {
        const cov = cells(row);
        const [unit, uni] = cov;
        const state = cov.length > 3 ? cov[cov.length - 1] : "";
        const evidence = cov.slice(2, -1).join("|"); // evidence text may itself contain pipes
        if (!uni || !universes.has(uni)) UNDECLARED.push(`"${(unit || row).slice(0, 60)}"`);
        // A BLOCKED unit is open work, never covered. An ACCEPTED unit was
        // re-scoped by the user — corroborated through the recorded
        // pause/assent signal, same as every ACCEPTED consumer.
        if (/^ACCEPTED\s*:/i.test(state) && USER_VERB_RE.test(row) && acceptedOk(row)) covered += 1;
        else if (/^BLOCKED\s*:/i.test(state)) blockedOpen.push(`audit-ledger unit "${(unit || row).slice(0, 60)}"`);
        else if (OPEN_STATE_RE.test(state)) openUnits.push(`"${(unit || row).slice(0, 60)}"`);
        if (DONE_RE.test(state)) {
          covered += 1;
          if (!evidence || /^(?:[-—–\s]*|n\/?a|none|see above)$/i.test(evidence)) NO_EVIDENCE.push(`"${(unit || row).slice(0, 60)}"`);
          if (/^MEASURED$/i.test(state)) {
            const ns = [...evidence.matchAll(/\bn=(\d+)/g)].map((m) => parseInt(m[1], 10));
            if (!ns.some((v) => v >= 5) && !/single-obs/i.test(evidence)) {
              SAMPLE_FLOOR.push(`"${(unit || row).slice(0, 60)}" — MEASURED needs n>=5 in evidence or the \`single-obs\` label`);
            }
          }
        } else if (
          !DISP_RE.test(state) && !OPEN_STATE_RE.test(state) ||
          (/^ACCEPTED\s*:/i.test(state) && !(USER_VERB_RE.test(row) && acceptedOk(row)))
        ) {
          BAD_STATE.push(`"${(unit || row).slice(0, 60)}" state "${state.slice(0, 40)}"`);
        }
      }
      // Evidence re-verification (AQ: honesty, not shape): a covered row
      // that cites a .unlazy/ JSON artifact and makes numeric measurement
      // claims gets those claims re-checked against the file — "VERIFIED"
      // with fabricated metrics is the shape-compliance hole. Scoped to
      // resolved JSON cites + significant numbers (decimals ≥1 place or
      // counts with unit suffixes); bare small integers are too noisy.
      const EVID_CLAIM = [];
      const JSON_CITE = /(\.unlazy[\/\\][\w./\\-]*\.json)\b/i;
      const CLAIM_NUM = /\d+\.\d+|\d[\d,]*(?:\.\d+)?\s*(?:ms\b|px\b|units?\b|interactives?\b|sections?\b|flags?\b|violations?\b|%)/gi;
      const jsonCache = new Map(); // abs path → file text (each artifact read once)
      const numHit = (jText, n) => new RegExp(`(?:^|[^\\d.])${n.replace(/\./g, "\\.")}(?:[^\\d]|$)`).test(jText);
      for (const row of covRows) {
        const cov = cells(row);
        const st = cov.length > 3 ? cov[cov.length - 1] : "";
        if (!DONE_RE.test(st)) continue;
        const ev = cov.slice(2, -1).join("|");
        const jms = [...ev.matchAll(new RegExp(JSON_CITE.source, "gi"))];
        if (!jms.length) continue;
        // Verify against the union of every cited JSON — claims may be
        // split across artifacts.
        let jText = "", anyParseErr = null;
        for (const jm of jms) {
          const jAbs = existsSync(jm[1]) ? jm[1] : join(ROOT, jm[1].replace(/\\/g, "/"));
          if (!existsSync(jAbs) || !underRoot(jAbs)) continue; // bad path is cite-freshness's claim
          let t = jsonCache.get(jAbs);
          if (t === undefined) {
            try { t = readFileSync(jAbs, "utf-8"); JSON.parse(t); }
            catch { t = null; anyParseErr = jm[1]; }
            jsonCache.set(jAbs, t);
          }
          if (t) jText += "\n" + t;
        }
        if (anyParseErr) { EVID_CLAIM.push(`"${(cov[0] || row).slice(0, 60)}" cites unparseable JSON ${anyParseErr}`); continue; }
        if (!jText.trim()) continue;
        const missed = [];
        for (const m of ev.matchAll(CLAIM_NUM)) {
          if (missed.length >= 4) break;
          let raw = m[0].replace(/\s*(ms|px|units?|interactives?|sections?|flags?|violations?|%)\s*$/i, "").replace(/,/g, "");
          if (/^\d$/.test(raw)) continue; // single digits match anything
          const pct = /%\s*$/.test(m[0]);
          const cands = pct && parseFloat(raw) <= 100
            ? [raw, String(+(parseFloat(raw) / 100).toFixed(4)), String(+(parseFloat(raw) / 100).toFixed(2))]
            : [raw];
          if (!cands.some((c) => numHit(jText, c))) missed.push(m[0].trim());
        }
        if (missed.length) EVID_CLAIM.push(`"${(cov[0] || row).slice(0, 60)}" claims ${missed.join(", ")} — not found in ${jms.map((m) => m[1]).join(" + ")}`);
      }
      if (EVID_CLAIM.length) enumProblems.push(`evidence re-verification failed: ${EVID_CLAIM.slice(0, 4).join("; ")} — a covered row's measurement must exist in the artifact it cites (fix the claim or re-measure)`);

      const declaredTotal = [...universes.values()].reduce((a, u) => a + u.n, 0);
      if (covRows.length !== declaredTotal) {
        enumProblems.push(`coverage reconciliation failed: ${covRows.length} coverage row(s) vs ${declaredTotal} enumerated unit(s) — every unit needs exactly one row`);
      }
      if (UNDECLARED.length) enumProblems.push(`coverage rows name undeclared universes: ${UNDECLARED.slice(0, 4).join(", ")}`);
      if (BAD_STATE.length) enumProblems.push(`non-terminal states: ${BAD_STATE.slice(0, 4).join("; ")} — states are DONE | VERIFIED | MEASURED | OPEN (unfinished — blocks the ledger) | BLOCKED: <external wall> | ACCEPTED: <user re-scoped; user verb required>`);
      if (openUnits.length) enumProblems.push(`audit incomplete: ${openUnits.length} unit(s) OPEN — finish them (DONE/VERIFIED/MEASURED); a closing ledger has no pending state. First: ${openUnits[0]}`);
      if (NO_EVIDENCE.length) enumProblems.push(`covered rows without evidence: ${NO_EVIDENCE.slice(0, 4).join(", ")}`);
      if (SAMPLE_FLOOR.length) enumProblems.push(`methodology floor: ${SAMPLE_FLOOR.slice(0, 3).join("; ")}`);

      // Denial section: the written red-team pass must exist.
      const denialSec = section("Denial");
      const denialLines = denialSec.split(/\r?\n/).filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l));
      if (denialLines.length < 1) missing.push("a ## Denial section with at least one red-team bullet");
      // Denial content (autopsy U8-2): a bullet that carries no attempt
      // record is a verdict in the highest-trust container — the section
      // existed for "unmitigated" to hide inside. Each bullet names what
      // was TRIED against the claim (attempt/searched/re-derived/tried:)
      // or carries an explicit marker.
      const ATTEMPT_RE = /\b(?:attempt\w*|tried|search\w*|re-deriv\w*|falsif\w*|disprov\w*|re-?read|verif\w*|test\w*|examin\w*|walked|recomput\w*|prob\w*|check\w*|found|cleared)\b|DECLARED:|ACCEPTED:|BLOCKED:|ROUTED:|PROPOSED:/i;
      const noAttempt = denialLines.filter((l) => !ATTEMPT_RE.test(l));
      if (noAttempt.length) missing.push(`Denial bullet(s) without an attempt record (${noAttempt.length} — e.g. "${noAttempt[0].trim().slice(0, 70)}") — a red-team bullet says what was TRIED against the claim (attempted/searched/re-derived/tried:), not a bare verdict`);

      // Fraction line: COVERED: X/Y must match computed arithmetic.
      const frac = text.match(/COVERED:\s*(\d+)\s*\/\s*(\d+)/i);
      if (!frac) missing.push("a `COVERED: X/Y` line");
      else if (parseInt(frac[1], 10) !== covered || parseInt(frac[2], 10) !== declaredTotal) {
        enumProblems.push(`COVERED: ${frac[1]}/${frac[2]} doesn't match computed ${covered}/${declaredTotal} — the fraction is arithmetic, not narrative`);
      }

      // Banned coverage-adjective phrases outside dispositioned lines
      // (BANNED_ADJ is module-scope — the analysis-project check below
      // scans its docs under the same list, AQ-F3).
      const badA = text.split(/\r?\n/).filter(
        (l) => BANNED_ADJ.test(l) && !disposedOf(l, acceptedOk)
      );
      if (badA.length) {
        enumProblems.push(`banned coverage-adjective phrase: "${badA[0].trim().slice(0, 100)}" — enumerate the whole universe or disposition the row`);
      }

      if (missing.length || enumProblems.length) {
        failures.push(
          `AUDIT-LEDGER: ${ledgerRel} fails reconciliation — ` +
          (missing.length ? `missing ${missing.join(", ")}; ` : "") +
          (enumProblems.length ? enumProblems.map((p, i) => `(${i + 1}) ${p}`).join(" ") : "")
        );
      }
    }
  }

  // --- tests-run -----------------------------------------------------------
  tick("tests-run");
  if ((state.tests_touched || []).length && !state.test_ran) {
    const unexempted = (state.tests_touched).filter((p) => !exempt("TESTS", p));
    if (unexempted.length) {
      failures.push(
        `TESTS-RUN: test files edited (${unexempted.join(", ")}) with no successful pytest/vitest run this session. ` +
        `AGENTS.md: a changed test file gets run — run it, or add EXEMPT-TESTS: <file> — <reason> to ${evidenceRel}.`
      );
    }
  }

  // --- repro ---------------------------------------------------------------
  tick("repro");
  // Never twice blind (12-verification.mdc): once the user reports a shipped
  // fix didn't resolve the symptom, the next source change for it must name
  // its reproduction evidence. One REPRO: line per rejection round — an
  // auditable assertion. Lines that claim observation must carry the DONE
  // standard in writing: `expected:` (what correct looks like + its
  // reference — an absence predicate can pass vacuously, an expectation
  // can't) and `surfaces:` (which surfaces the evidence covers — claim
  // scope ⊆ verified scope). CANNOT-REPRO: lines claim nothing observed,
  // so they carry neither. EXEMPT-REPRO: * covers a rejection that
  // concerned a different symptom or a user-requested blind retry.
  const reproRounds = state.repro_rounds_armed || 0;
  const reproExempt = exempt("REPRO", "*");
  const reproLines = evidence.split(/\r?\n/).filter((l) => /^\s*REPRO:/i.test(l));
  const observedLines = reproLines.filter((l) => !/CANNOT-REPRO\s*:/i.test(l));
  // Debt comes due when observation exists: every armed round has a line
  // and at least one line claims observed evidence. An all-CANNOT-REPRO
  // state means the turn ended waiting on the user — demanding kept/
  // removed dispositions then would only invite fabricated ones.
  const debtDue =
    reproExempt ||
    (reproRounds > 0 && reproLines.length >= reproRounds && observedLines.length > 0);
  if (reproRounds > 0 && !reproExempt) {
    const problems = [];
    if (reproLines.length < reproRounds) {
      problems.push(`${reproLines.length}/${reproRounds} REPRO: lines present`);
    }
    const missingFields = observedLines.filter((l) => !/\bexpected\s*:/i.test(l) || !/\bsurfaces?\s*:/i.test(l));
    if (missingFields.length) {
      problems.push(
        `${missingFields.length} REPRO: line(s) missing \`expected:\` and/or \`surfaces:\` — ` +
        `"${missingFields[0].trim().slice(0, 110)}"`
      );
    }
    if (problems.length) {
      failures.push(
        `REPRO: the user reported a fix didn't resolve the symptom and ${(state.repro_armed || []).join(", ") || "a source file"} was edited afterward — never twice blind (12-verification.mdc). ` +
        problems.join("; ") +
        `. Required per rejection round in ${evidenceRel}: \`REPRO: <file or *> — <evidence ref> — expected: <correct state + reference> — surfaces: <comma list>\`, ` +
        `or \`REPRO: * — CANNOT-REPRO: <what you asked the user for>\`, or \`EXEMPT-REPRO: * — <reason>\` if the rejection concerned a different symptom or the user asked for another attempt anyway.`
      );
    }
  }

  // --- blind-debt ------------------------------------------------------------
  tick("blind-debt");
  // Files edited while a rejection was unresolved were written without
  // observed state — guesses by definition (12-verification.mdc →
  // mechanism discipline). Once the REPRO obligation is met with observed
  // evidence (or exempted), each such file needs an individual kept/removed
  // disposition; "shipped as part of the bundle" is not a status. Checked
  // only when debt is due — while REPRO is open or all-CANNOT-REPRO, the
  // open round is the blocker and nothing can be honestly dispositioned.
  const blindDebt = (state.blind_debt || []).filter((p) => !exempt("BLIND", p));
  if (blindDebt.length && debtDue) {
    const undisposed = blindDebt.filter(
      (p) => !evidence
        .split(/\r?\n/)
        .some((l) => /^\s*BLIND-DEBT:/i.test(l) && l.includes(p) && /\bkept\s*:|\bremoved\b/i.test(l))
    );
    if (undisposed.length) {
      failures.push(
        `BLIND-DEBT: ${undisposed.length} file(s) were edited while the symptom was unverified and have no disposition: ${undisposed.join(", ")}. ` +
        `Each mechanism shipped blind needs an individual status now that observation exists — add \`BLIND-DEBT: <file> — kept: <observed reason>\` or \`BLIND-DEBT: <file> — removed\` ` +
        `to ${evidenceRel} (12-verification.mdc → mechanism discipline), or \`EXEMPT-BLIND: <file or *> — <reason>\`.`
      );
    }
  }

  // --- drive-declared ------------------------------------------------------
  tick("drive-declared");
  const todosOpen = state.todos_open || 0;
  const filesEdited = state.files_edited || 0;
  const openWork = todosOpen > 0 || drivenOpen.length > 0;
  // 14-stop-integrity: every task runs under a *declared* drive — the mode
  // is written where it's auditable, never defaulted silently. The arm is
  // "the session did work" (any edit outside .unlazy/, open todos, or a
  // Driver: <sid> doc) — skipping the todo list is not a dodge. Satisfy:
  // `Drive: continuous` on the doc (PLAN-DRIVE then binds — no turn-end
  // while rows are open) or `Drive: checkpointed` (only when the USER split
  // the units), or a `DRIVE: <mode>` evidence line for doc-less work.
  const driveLineOk = evidence
    .split(/\r?\n/)
    .some((l) => /^\s*DRIVE\s*:\s*(continuous|checkpointed)\b/i.test(l));
  if ((todosOpen > 0 || drivenDocs.length > 0 || filesEdited > 0) && !driveDeclared && !driveLineOk && !exempt("DRIVE", "*")) {
    const arms = [];
    if (todosOpen > 0) arms.push(`${todosOpen} open todo item(s)`);
    if (drivenDocs.length) arms.push(`driven doc(s): ${drivenDocs.join(", ")}`);
    if (filesEdited > 0) arms.push(`${filesEdited} file(s) edited this session`);
    failures.push(
      `DRIVE-DECLARED: ${arms.join(" + ")} but no drive mode is declared (14-stop-integrity). ` +
      `Every task runs under a written drive: flag the session doc \`Driver: ${sid}\` + \`Drive: continuous\` ` +
      `(\`Drive: checkpointed\` only when the user split the units), or add \`DRIVE: <continuous|checkpointed> — <what's driven>\` ` +
      `to ${evidenceRel} for doc-less work, or \`EXEMPT-DRIVE: * — <reason>\`.`
    );
  }
  // Checkpointed is a claim about the USER ("they split the units") — the
  // prompt-scan record backs it or it fails like any fabricated exemption.
  const driveCkLine = evidence.split(/\r?\n/).some((l) => /^\s*DRIVE\s*:\s*checkpointed\b/i.test(l));
  let driveCkDoc = false;
  for (const docPath of drivenDocs) {
    const absDoc = existsSync(docPath) ? docPath : join(ROOT, docPath);
    if (existsSync(absDoc) && /^\s*drive\s*:\s*checkpointed\b/im.test(fenceStrip(readText(absDoc) || ""))) driveCkDoc = true;
  }
  if ((driveCkLine || driveCkDoc) && openWork && !pauseSignals.length && !exempt("DRIVE", "*")) {
    failures.push(
      `DRIVE-DECLARED: \`checkpointed\` claims the user split the units, but no user prompt this session carried a pause/chunk signal ` +
      `(recorded signals: ${pauseSignals.length}). If the user really chunked the work the record would show it — ` +
      `declare \`continuous\`, or ask the user, or \`EXEMPT-DRIVE: * — <reason>\` in ${evidenceRel} (14-stop-integrity).`
    );
  }

  // --- stop-declared -------------------------------------------------------
  tick("stop-declared");
  // 14-stop-integrity: an open backlog is legal; an undeclared stop is not.
  // Ending the turn while open work exists (pending todos recorded by the
  // tracker, or a session-driven doc's open rows) requires one STOP: line
  // in gate-evidence naming the class — USER-GATE (a decision only the
  // user can make, question asked), BLOCKED (external blocker + evidence),
  // ACCEPTED (the user agreed to the pause). There is deliberately no
  // capacity class: the runtime owns halting — compaction continues the
  // work — so "ran out of context/time/runway" cannot satisfy this check.
  // ACCEPTED is verified, not asserted: the prompt-scan must have recorded
  // a user pause/assent signal this session or the line is a fabricated
  // claim about the user — caught, not honored.
  const evidenceLines = evidence.split(/\r?\n/);
  const stopLines = evidenceLines.filter((l) => /^\s*STOP\s*:/i.test(l));
  // Item-scope: a pause signal or question about *anything* must not
  // satisfy a stop about *this item*. Content words (≥4 chars, minus
  // boilerplate) from the STOP line must share a word with the signal —
  // otherwise "the user paused earlier" verifies "the user paused THIS".
  // STOPWORDS / contentWords / acceptedOk live at ~:448 — the corroboration
  // is shared with every ACCEPTED consumer, not re-declared per site.
  const stopDecisionOk = stopLines.some((l) => /^\s*STOP\s*:\s*(USER-GATE|BLOCKED)\s*[-—:]\s*\S+/i.test(l));
  const stopAcceptedClaimed = stopLines.some((l) => /^\s*STOP\s*:\s*ACCEPTED\b/i.test(l));
  const stopAcceptedOk =
    pauseSignals.length > 0 &&
    stopLines.some((l) => /^\s*STOP\s*:\s*ACCEPTED\s*[-—:]\s*\S+/i.test(l) && acceptedOk(l));
  // Substance checks on the assertion-level classes (14-stop-integrity):
  // USER-GATE must carry the question itself (≥4 words — "waiting" is a
  // label, not a question), and a BLOCKED line that cites a path must
  // cite one that exists — fabricated evidence is a caught lie, not an
  // assertion the gate shrugs at. Non-path evidence (error text) stays
  // assertion-level by design.
  const stopUserGateThin = stopLines.some(
    (l) => /^\s*STOP\s*:\s*USER-GATE\b/i.test(l) && !/^\s*STOP\s*:\s*USER-GATE\s*[-—:]\s*(?:\S+\s+){3,}\S+/i.test(l)
  );
  const blockedPathBad = stopLines
    .filter((l) => /^\s*STOP\s*:\s*BLOCKED\b/i.test(l))
    .flatMap((l) => citedPaths(l))
    .filter((p) => !anchoredPathExists(p));
  if ((todosOpen > 0 || drivenOpen.length) && !exempt("STOP", "*")) {
    if (stopAcceptedClaimed && !stopAcceptedOk) {
      failures.push(
        `STOP-DECLARED: \`STOP: ACCEPTED\` claims the user agreed to pause, but no user prompt this session carried a ` +
        `pause/assent signal (rejection-tracker recorded ${pauseSignals.length}). The class is verified, not asserted — ` +
        `if the user really paused, the record shows it; otherwise use \`STOP: USER-GATE — <question asked>\`, ` +
        `\`STOP: BLOCKED — <blocker + evidence>\`, or \`EXEMPT-STOP: * — <reason>\` in ${evidenceRel} (14-stop-integrity).`
      );
    } else if (!stopDecisionOk && !stopAcceptedOk) {
      const parts = [];
      if (todosOpen > 0) {
        const items = (state.todos_open_items || []).filter(Boolean);
        parts.push(`${todosOpen} open todo item(s)${items.length ? ` — e.g. "${items[0]}"` : ""}`);
      }
      if (drivenOpen.length) parts.push(`open rows in driven doc(s): ${drivenOpen.join(", ")}`);
      failures.push(
        `STOP-DECLARED: this turn ends with ${parts.join(" + ")} and no declared stop reason (14-stop-integrity). ` +
        `An open backlog is legal — an unexplained stop is not. Add one line to ${evidenceRel}: ` +
        `\`STOP: USER-GATE — <the decision only the user can make, and the question asked>\`, ` +
        `\`STOP: BLOCKED — <the external blocker + its observable evidence>\`, or ` +
        `\`STOP: ACCEPTED — <what the user agreed to pause>\` (verified against the recorded pause signal). ` +
        `Capacity is not a stop class: the runtime owns halting and compaction continues the work, ` +
        `so "ran out of context/time/runway" is never a valid reason — if no class fits, keep working or ask. ` +
        `Or \`EXEMPT-STOP: * — <reason>\` (e.g. a question-only turn riding a stale backlog list).`
      );
    }
    if (stopUserGateThin) {
      failures.push(
        `STOP-DECLARED: a \`STOP: USER-GATE\` line must carry the question itself (≥4 words) — ` +
        `"${stopLines.find((l) => /USER-GATE/i.test(l))?.trim().slice(0, 100)}". A label is not a question (14-stop-integrity).`
      );
    }
    if (blockedPathBad.length) {
      failures.push(
        `STOP-DECLARED: \`STOP: BLOCKED\` cites a path that does not exist: ${blockedPathBad.join(", ")} — ` +
        `blocker evidence must be observable; a dead path is a fabricated claim (14-stop-integrity).`
      );
    }
    // Assistant-output checks — fire when the runtime supplied assistant
    // text (last_assistant_message, or a parsed transcript). USER-GATE then
    // requires a question to actually exist in that output — "asked the
    // user" becomes a checked claim, not an assertion. BLOCKED commands are
    // verified only with a full transcript (commands live in tool calls,
    // not the final message).
    if (assistantTexts.length && stopLines.some((l) => /^\s*STOP\s*:\s*USER-GATE\b/i.test(l))) {
      // Item-scope: any "?" anywhere satisfied this — now the question
      // must share a content word with the STOP line's own question.
      const stopQ = stopLines.find((l) => /^\s*STOP\s*:\s*USER-GATE\b/i.test(l)) || "";
      const qWords = contentWords(stopQ);
      const questionAsked = assistantTexts.slice(-6).some((t) =>
        /\?/.test(t) && qWords.size > 0 && [...contentWords(t)].some((w) => qWords.has(w))
      );
      if (!questionAsked) {
        failures.push(
          `STOP-DECLARED: \`STOP: USER-GATE\` claims a question was put to the user, but no assistant output carries a ` +
          `question about it — a question mark about anything is not a question about this item (14-stop-integrity).`
        );
      }
    }
    if (transcriptRaw) {
      const citedCmds = stopLines
        .filter((l) => /^\s*STOP\s*:\s*BLOCKED\b/i.test(l))
        // ≥2 chars catches `ls`/`rm x` — the 4-char floor let short real
        // commands skip the ran check entirely. Path-shaped tokens are
        // file cites (`config.json`, `user.auth`), not commands —
        // demanding them in the exec corpus false-flagged (R15-F13).
        .flatMap((l) => (l.match(/`([^`\n]{2,160})`/g) || []).map((s) => s.slice(1, -1)))
        // A path cite is a SINGLE WORD that names a file — `config.json`,
        // `user.auth`, `.unlazy/x.md`. A command cite (`rm -rf /tmp/x`)
        // carries spaces and is checked verbatim even though it holds a
        // path inside it.
        .filter((c) => /\s/.test(c) ||
          !(/[\\/]|\.[\w.]{1,8}$/.test(c) ||
            // Extensionless well-known filenames are path cites, not
            // commands — `Makefile`/`Dockerfile`/`schema` named in a
            // STOP: BLOCKED read as un-ran commands and false-flagged
            // (R16-F19). Anything that resolves as a repo file is a
            // path cite too.
            /^(Makefile|Dockerfile|Containerfile|Gemfile|Rakefile|Procfile|Jenkinsfile|README|LICENSE|CHANGELOG|CNAME|Vagrantfile|Brewfile|Justfile|schema|CODEOWNERS)$/i.test(c) ||
            (c.length <= 120 && !/^-/.test(c) && existsSync(join(ROOT, c)) && underRoot(join(ROOT, c)))));
      // The corroboration reads command-bearing lines only — the
      // evidence write itself embeds every cited command in its
      // `content`, so the old whole-transcript includes() always passed
      // (R14-F2: the check was circular on the real caller path).
      const ranCorpus = transcriptCommands(transcriptRaw);
      const neverRan = citedCmds.filter((c) => !ranCorpus.includes(c));
      if (neverRan.length) {
        failures.push(
          `STOP-DECLARED: \`STOP: BLOCKED\` cites command(s) absent from this session's transcript: ` +
          `${neverRan.join(", ")} — cite the command as it actually ran, not as remembered (14-stop-integrity).`
        );
      }
    }
  }

  // --- pushback (the human simulator) --------------------------------------
  tick("pushback");
  // Every ledger check above watches TRACKED open work — todos, doc rows.
  // The unsolved deferral class lived one layer up: the agent's own final
  // message saying "still open (named, not dropped)", "source-verified
  // only", "needs a live authed desk", "want me to…?" — items that never
  // reached a ledger, so no open-row check could see them. The user had
  // to type "continue" every time; this check types it for them: the last
  // assistant turn is scanned for deferral grammar, and each hit must be
  // discharged or the stop blocks.
  //
  // Sentence-level, on the LAST assistant text only — earlier turns
  // described work in flight; the last turn is the claim being made at
  // stop time. Dequoted (backticks + double-quotes = someone else's
  // words), fix-comparison sentences skipped ("was unverified, now
  // verified" is a report of progress, not a deferral).
  //
  // Two hit classes:
  //   PUSHBACK         — deferral grammar naming undone work. Discharges:
  //                      ACCEPTED-DEFERRAL/LANE/IMPOSSIBLE in evidence
  //                      (each corroborated), or a matching STOP:/matrix
  //                      BLOCKED row for wall-shaped deferrals.
  //   CAPABILITY-LIE   — an impossibility claim ("can't verify — needs an
  //                      authed session") contradicted by a capability the
  //                      repo provably holds (the session minter exists;
  //                      playwright is installed). Undischargeable by
  //                      assertion — the only exits are doing the work or
  //                      an IMPOSSIBLE: line whose `tried:` enumeration
  //                      cites real paths/commands (proving the known
  //                      path was actually attempted).
  //
  // Capability registry (shared by the last-message and doc-level scans):
  // claim vocabulary → paths whose existence refutes the claim class.
  // The fixed entries cover known tools; the dynamic probe below scans
  // .unlazy/.scratch for capability-shaped scripts a hardcoded list
  // would miss — the whole point is finding tools the agent forgot.
  const CAPABILITIES = [
    { re: /\b(?:auth|authed|authenticated|login|session|staff|credential|permission|entitle)/i,
      paths: [".unlazy/mint-staff-session.py"],
      label: "the staff-session minter" },
    { re: /\b(?:render|screenshot|capture|visual|browser|paint|viewport|png|camera|click|interact)/i,
      paths: ["app/node_modules/puppeteer-core", "app/node_modules/playwright", "node_modules/playwright"],
      label: "a headless browser" },
    { re: /\b(?:live|running|server|localhost|endpoint|api|http)/i,
      paths: ["app/.env"],
      label: "the local app (running-the-server.mdc allows starting it)" },
    { re: /\b(?:database|db|postgres|query|sql|table)/i,
      paths: ["app/.env"],
      label: "the dev database (DATABASE_URL in .env)" },
  ];
  // Dynamic capability discovery — auth/session-shaped scripts under
  // .unlazy and .scratch are minted exactly for this failure mode
  // ("can't log in"); a hardcoded registry rots as new ones appear.
  try {
    const authLike = [];
    for (const dir of [".unlazy", ".scratch"]) {
      const abs = join(ROOT, dir);
      if (!existsSync(abs)) continue;
      for (const f of readdirSync(abs)) {
        if (/\.(py|mjs|js|sh)$/i.test(f) && /session|auth|login|staff|mint|cookie|credential/i.test(f)) {
          authLike.push(`${dir}/${f}`);
        }
      }
    }
    if (authLike.length) {
      CAPABILITIES[0].paths = [...new Set([...CAPABILITIES[0].paths, ...authLike])];
      CAPABILITIES[0].label = "a session/auth helper";
    }
  } catch { /* discovery is best-effort; fixed entries still bind */ }
  // Shared corroboration helpers — the last-message scan, the doc-level
  // scan, and the completion-matrix disposition check all hold the same
  // standard: "the user said" needs real user-turn text; "tried" needs a
  // command the transcript shows actually ran.
  const userTurnText = (() => {
    // Shared JSONL extractor output first (tool_result already filtered).
    let blob = userTexts.join("\n");
    // ATIF transcripts are ONE JSON object ({steps:[{source:"user",
    // message}]}), not JSONL — the line parser yields nothing. Quoting
    // a user turn must still corroborate, so parse the whole doc too.
    if (!blob.trim() && transcriptRaw) {
      try {
        const doc = JSON.parse(transcriptRaw);
        const steps = Array.isArray(doc?.steps) ? doc.steps : [];
        blob = steps
          .filter((s) => s && s.source === "user" && typeof s.message === "string")
          .map((s) => s.message)
          .join("\n");
      } catch { /* neither JSONL nor ATIF — corroboration stays empty, discharges fail closed */ }
    }
    return blob;
  })();
  const quoteInUserTurn = (line) => {
    const qm = line.match(/"([^"]{8,400})"|“([^”]{8,400})”/);
    const q = qm && (qm[1] || qm[2]);
    return q ? userTurnText.includes(q) : false;
  };
  // An IMPOSSIBLE: discharge — evidence-file lines by default, plus any
  // extra lines (a doc's own IMPOSSIBLE: line lives in the doc, not the
  // evidence file). tried: means a backticked command naming the
  // capability that the transcript shows actually ran — when a
  // transcript exists. No transcript: naming is all that is checkable.
  const impossibleDischarged = (capPath, extraLines = []) => {
    const ran = transcriptRaw ? transcriptCommands(transcriptRaw) : null;
    const base = capPath.split(/[\\/]/).pop();
    return [...evidenceLines, ...extraLines].some((l) => {
      const im = l.match(/IMPOSSIBLE\s*:\s*(.+?)\s*—\s*tried\s*:\s*(\S.{10,})/i);
      if (!im) return false;
      const cmds = (im[2].match(/`([^`]{2,200})`/g) || []).map((c) => c.slice(1, -1));
      const names = cmds.filter((c) => c.includes(capPath) || c.includes(base));
      return names.length > 0 && (ran === null || names.some((c) => ran.includes(c)));
    });
  };
  if (assistantTexts.length && !exempt("PUSHBACK", "*")) {
    const dequoteSay = (t) => String(t || "")
      .replace(/`[^`\n]*`/g, " ")
      .replace(/"[^"\n]*"/g, " ")
      .replace(/“[^”\n]*”/g, " ")
      // Slash-chains of 3+ segments are enumeration context, not claims
      // — "defer/punt/shelve/hand-off" is a vocabulary list where each
      // word is a mention. Two-segment chains stay live ("punted/
      // shelved the tab work" is a claim wearing a separator). This is
      // the final-message twin of the doc scan's META_SKIP — the first
      // live FP was this check flagging its own vocabulary list.
      .replace(/\b[\w-]+(?:\/[\w-]+){2,}\b/g, " ");
    const lastSay = dequoteSay(assistantTexts[assistantTexts.length - 1]);
    // Scope patch (boundary-study): last-message-only was the bound — a
    // deferral said two turns back escaped by aging out. Parking-class
    // rules (work declared NOT-to-be-done) scan the last 3 assistant
    // texts; in-flight classes ("not yet verified", capacity, impossibility)
    // stay last-only — mid-work narration of those is honest state, not
    // a deferral.
    const PARKING_KINDS = new Set(["next-session", "tracked-away", "parked", "residual", "horizon", "carried-forward", "soft-todo", "defer-word", "lane-claim", "lane-delegate", "lane-scope", "lane-handoff", "open-offer", "named-not-dropped"]);
    // Clause-level, not just sentence-level: "done — though X remains
    // unverified" parks the deferral inside an em-dash/comma clause and
    // escapes a sentence-only split (first live evasion shape). Each
    // clause carries its parent sentence so a hit reports the whole
    // line once, not fragment-by-fragment.
    const toSentences = (say) => say.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
      .flatMap((sent) =>
        sent.split(/—|–|;\s+|,\s+(?:though|but|except|aside from|other than|save for)\s+/)
          .map((c) => ({ clause: c.trim(), sent }))
          .filter((x) => x.clause.length > 8)
      );
    const sentences = [
      ...toSentences(lastSay).map((x) => ({ ...x, parkingOnly: false })),
      ...assistantTexts.slice(-3, -1).flatMap((t) => toSentences(dequoteSay(t)).map((x) => ({ ...x, parkingOnly: true }))),
    ];
    // A sentence reporting a fix ("was unverified, now verified") or
    // asserting completeness ("no remaining items") is not a deferral.
    const FIXED_NEAR = /\b(?:now|finally|and)\b[^.!?\n]{0,40}\b(?:fixed|done|verified|closed|resolved|shipped|landed|pass(?:es|ing)?|green|clean|complete)\b|\b(?:fixed|done|verified|closed|resolved|shipped|landed|pass(?:es|ing)?)\b[^.!?\n]{0,40}\bnow\b/i;
    const NONE_LEFT = /\bno\b[^.!?\n]{0,25}\b(?:remaining|open|pending|outstanding|left|gaps?|residuals?)\b|\bnothing\b[^.!?\n]{0,20}\b(?:remaining|open|pending|left|outstanding)\b/i;
    const PAST_FRAME = /\b(?:was|were|had been|previously|earlier|used to be|before)\b[^.!?\n]{0,25}\b(?:unverified|open|pending|broken|dead)\b/i;
    const DEFER_RULES = [
      [/\bstill\b[^.!?\n]{0,20}\b(?:open|pending|unverified|undone|outstanding|remaining|unresolved|to\s+do|unchecked|untested|unproven)\b/i, "still-open"],
      [/\b(?:named|noted|flagged|listed|recorded)\b[^.!?\n]{0,30}\bnot\s+dropped\b|\bnot\s+dropped\b/i, "named-not-dropped"],
      [/\bremains?\b[^.!?\n]{0,25}\b(?:to|open|pending|unverified|untested|unconfirmed|undone|outstanding|unresolved|for\s+later|unexercised|unproven)\b/i, "remains-open"],
      [/\b(?:left|leaves?)\b[^.!?\n]{0,20}\b(?:to|open|pending|unverified|undone|outstanding|unresolved)\b/i, "left-open"],
      [/\bsource[-\s]verified\b|\bverified\s+at\s+(?:the\s+)?source\b|\bverified\s+in\s+source\b/i, "source-only-verification"],
      [/\bunverified\b|\buntested\b|\bnot\s+(?:yet\s+)?(?:verified|tested|exercised|rendered|captured|probed|confirmed)\b|\bnever\s+(?:verified|tested|exercised|rendered|captured|saw|ran)\b/i, "unverified-state"],
      [/\b(?:next|later|future|another|follow[\s-]?up|subsequent|a\s+later)\s+(?:session|pass|iteration|turn|round|slice|agent|review|look)\b/i, "next-session"],
      [/\b(?:plum|another\s+agent|the\s+other\s+agent|a\s+different\s+agent)(?:'?s|\s+is\s+responsible)?\s+(?:lane|scope|call|surface|work|job|task|area|domain)\b|\b(?:their|its)\s+lane\b|\b(?:out|outside)\s+of\s+(?:my|this)\s+(?:lane|scope)\b|\bnot\s+my\s+(?:lane|call|job|scope)\b/i, "lane-claim"],
      [/\b(?:their|plum'?s?|the\s+other\s+agent'?s?)\s+to\s+(?:verify|prove|ship|finish|decide)\b|\btheirs\s+to\b/i, "lane-delegate"],
      [/\bif\s+you\s+want\b|\bwant\s+me\s+to\b|\bwould\s+you\s+like\b|\bshall\s+i\b|\blet\s+me\s+know\s+if\b/i, "permission-seek"],
      [/\bthe\s+offer\s+stands\b|\boffer\s+stands\b/i, "open-offer"],
      [/\bfor\s+later\b|\bfor\s+now\b|\bdown\s+the\s+line\b|\bfurther\s+down\s+the\b/i, "horizon"],
      [/\bcan'?t\b|\bcannot\b|\bcouldn'?t\b|\bcould\s+not\b|\bunable\s+to\b|\bno\s+way\s+to\b|\bnot\s+able\s+to\b|\bimpossible\b/i, "impossibility"],
      [/\bneeds?\s+(?:a|an|the)?\s*(?:live|running|authed|authenticated|staff[-\s]?session|real\s+server|local\s+server|seeded|production)\b|\brequires?\s+(?:a|an|the)?\s*(?:live|running|authed|authenticated|staff[-\s]?session)\b|\bwithout\s+(?:a|an|the)?\s*(?:live|running|authed|authenticated|staff[-\s]?session|server)\b/i, "needs-live"],
      [/\bworth\s+(?:a|an)?\s*(?:follow[\s-]?up|revisit|another\s+look|second\s+pass)\b|\bshould\s+get\s+(?:a|an)?\s*(?:follow[\s-]?up|second\s+pass|fresh[-\s]eyes)\b/i, "soft-todo"],
      [/\btracked\b[^.!?\n]{0,25}\b(?:elsewhere|for\s+later|as\s+follow[\s-]?up)\b|\bparked\b|\bon\s+the\s+backlog\b/i, "tracked-away"],
      [/\bdeferr(?:ed|ing)\b[^.!?\n]{0,30}\b(?:to|until|for|into|next|later|another|pending)\b|\bdeferr(?:ed|ing)\s+(?:it|them|that|the\s+\w+)\b/i, "defer-word"],
      [/\bpunt(?:ed|ing)?\b|\bshelv(?:ed|ing)\b|\bicebox\b|\bback[-\s]?burner\b/i, "parked"],
      [/\bhand(?:ed|ing)?\s+off\b|\bhandover\b/i, "lane-handoff"],
      [/\b(?:out|outside)\s+of\s+(?:this|the|my)?\s*scope\b|\bnot\s+in\s+(?:this\s+)?scope\b|\bbeyond\s+(?:the|this|my)\s+scope\b/i, "lane-scope"],
      [/\bran\s+out\s+of\s+(?:time|context|runway|budget|room|steam)\b|\bno\s+(?:time|room)\s+(?:to|for|left)\b|\bcontext\s+(?:is\s+)?(?:running\s+)?low\b/i, "capacity-claim"],
      [/\bdidn'?t\s+get\s+(?:to|around\s+to)\b|\bnever\s+got\s+(?:to|around\s+to)\b/i, "unfinished"],
      [/\bresiduals?\b|\bremainder\b|\bleft[-\s]?over\b[^.!?\n]{0,25}(?:item|work|task|bit|piece|part)s?\b|\bremaining\b[^.!?\n]{0,20}\b(?:item|work|task|bit|piece)s?\b/i, "residual"],
      [/\bpartial(?:ly)?\b[^.!?\n]{0,25}\b(?:verified|tested|done|covered|complete|reviewed)\b|\b\d+\s*(?:\/|\s+of\s+)\s*\d+\s+(?:pages|items|checks|files|rows|surfaces|sections|steps|units|classes|findings|tests|cases|tabs|rules|docs)\s+(?:were|was|are|is|been|got|fully|now|all)?\s*(?:verified|tested|reviewed|checked|covered|done|read|examined|audited)\b/i, "partial-admission"],
      [/\bcarr(?:y|ied|ies)\b[^.!?\n]{0,25}\b(?:over|forward|into|to\s+the\s+next)\b/i, "carried-forward"],
    ];
    const IMPOSSIBLE_MODAL = /\bcan'?t\b|\bcannot\b|\bcouldn'?t\b|\bcould\s+not\b|\bunable\s+to\b|\bno\s+way\s+to\b|\bnot\s+able\s+to\b|\bimpossible\b|\bno\s+(?:live|running|authed|working|way)\b|\bneeds?\s+(?:a|an|the)?\s*(?:live|running|authed|staff)/i;
    // Discharge grammar (in gate-evidence):
    //   ACCEPTED-DEFERRAL: <item> — user said "<verbatim user-turn text>"
    //   LANE: user said "<verbatim user-turn text>"        (lane claims)
    //   IMPOSSIBLE: <wall> — tried: <path-or-`cmd`>, …     (capability)
    const discharged = (sent, kind) => {
      const words = new Set([...contentWords(sent)].filter((w) => w.length > 3));
      return evidenceLines.some((l) => {
        if (String(kind).startsWith("lane")) {
          return /^\s*LANE\s*:\s*user\s+said\b/i.test(l) && quoteInUserTurn(l);
        }
        const am = l.match(/^\s*ACCEPTED-DEFERRAL\s*:\s*(.+?)\s*—\s*user\s+said\b/i);
        if (am) {
          const item = new Set([...contentWords(am[1])].filter((w) => w.length > 3));
          const overlap = [...words].filter((w) => item.has(w));
          return overlap.length > 0 && quoteInUserTurn(l);
        }
        const im = l.match(/^\s*IMPOSSIBLE\s*:\s*(.+?)\s*—\s*tried\s*:\s*(\S.{10,})/i);
        if (im) {
          const item = new Set([...contentWords(im[1])].filter((w) => w.length > 3));
          if (![...words].some((w) => item.has(w))) return false;
          const tries = im[2].split(/[,;]/).map((t) => t.trim()).filter(Boolean);
          if (tries.length < 1) return false;
          const ran = transcriptRaw ? transcriptCommands(transcriptRaw) : "";
          return tries.some((t) => {
            const cmd = (t.match(/`([^`]{2,160})`/) || [])[1];
            if (cmd) return ran.includes(cmd);
            // F9: an unbackticked try that is command-shaped corroborates
            // against the transcript corpus the same way — quoting was the
            // only channel checked, so `tried: grep -rn foo .` discharged
            // on a path lookup instead of evidence it ran.
            if (/^(?:node|npm|npx|deno|python3?|pip|grep|rg|find|git|curl|wget|bash|sh|zsh|sed|awk|cat|ls|cd|diff|wc|head|tail|make|cargo|go|pytest|tsc|eslint)\b/.test(t.trim())) {
              return ran.includes(t.trim()) || ran.includes(t.trim().slice(0, 60));
            }
            return anchoredPathExists(t);
          });
        }
        // A wall-shaped deferral discharged by the existing STOP: BLOCKED
        // /matrix BLOCKED machinery — content-word scoped the same way.
        if (/\bblock/i.test(sent) && /BLOCKED\s*:/i.test(l)) {
          const item = new Set([...contentWords(l)].filter((w) => w.length > 3));
          return [...words].some((w) => item.has(w));
        }
        return false;
      });
    };
    const pushbackHits = [];
    const capabilityLies = [];
    const reportedSents = new Set();
    for (const { clause: s, sent, parkingOnly } of sentences) {
      if (FIXED_NEAR.test(s) || NONE_LEFT.test(s) || PAST_FRAME.test(s)) continue;
      let fired = null, firedAt = -1, firedLen = 0;
      for (const [re, name] of DEFER_RULES) {
        if (parkingOnly && !PARKING_KINDS.has(name)) continue;
        const mm = re.exec(s);
        if (mm) { fired = name; firedAt = mm.index; firedLen = mm[0].length; break; }
      }
      if (!fired) continue;
      // Meta-mention guard — the machinery's own lexicon is not a claim.
      // Two shapes, both ADJACENCY-tight (a machinery word merely nearby
      // is an evasion channel: "can't verify — the rule requires X"):
      // (a) the match IS a discharge-grammar marker word followed by a
      //     colon — `IMPOSSIBLE:` names the discharge line, not a claim
      //     (BLOCKED:/ACCEPTED: deliberately absent — a message claiming
      //     one is making a ledger claim, and the ledger is what counts);
      // (b) the word immediately before/after the match is a machinery
      //     noun — "the parked rule", "the gate can't" (tool-meta, same
      //     doctrine as the doc scan's subject check).
      {
        const matchText = s.slice(firedAt, firedAt + firedLen);
        const after = s.slice(firedAt + firedLen);
        if (/^(?:IMPOSSIBLE|STOP|LANE|DECLARED|RESOLVED-BYPASS|ACCEPTED-DEFERRAL|EXEMPT(?:-[A-Z]+)?)$/i.test(matchText) && /^:\s/.test(after)) continue;
        const prevW = (s.slice(0, firedAt).match(/([A-Za-z'-]+)\W*$/) || [])[1] || "";
        const prev2W = (s.slice(0, firedAt).match(/([A-Za-z'-]+)\W+[A-Za-z'-]+\W*$/) || [])[1] || "";
        const nextW = (after.match(/^\W*([A-Za-z'-]+)/) || [])[1] || "";
        const next2W = (after.match(/^\W*[A-Za-z'-]+\W+([A-Za-z'-]+)/) || [])[1] || "";
        const MACH = /^(?:rule|rules|marker|discharge|grammar|vocabulary|regex|patterns?|scan|kind|class|hook|gate|checks?|machinery|detector|lexicon|costumes?|clauses?|tokens?)$/i;
        if ([prevW, prev2W, nextW, next2W].some((w) => MACH.test(w))) continue;
      }
      // Capacity claims are undischargeable by design — the rules say
      // "capacity is not a stop class": the runtime owns halting and
      // compaction continues the work, so "ran out of context" is the
      // one deferral no evidence line can excuse.
      if (fired === "capacity-claim") { if (!reportedSents.has(sent)) { reportedSents.add(sent); pushbackHits.push({ s: sent, fired }); } continue; }
      // Impossibility claims get the capability cross-check — if a
      // defeating path exists, the only discharge is an IMPOSSIBLE: line
      // whose tried-set includes that capability (proving the known path
      // was actually attempted, not just asserted impossible).
      if (IMPOSSIBLE_MODAL.test(s)) {
        const cap = CAPABILITIES.find((c) => c.re.test(s));
        const capPath = cap && cap.paths.find((p) => existsSync(join(ROOT, p)));
        if (cap && capPath) {
          // Discharge requires the tried-set to name the capability AND
          // corroborate the attempt — the shared impossibleDischarged()
          // helper: a backticked command containing the path (or its
          // basename) that the transcript shows actually ran.
          if (!impossibleDischarged(capPath) && !reportedSents.has(sent)) { reportedSents.add(sent); capabilityLies.push({ s: sent, cap, capPath }); }
          continue;
        }
      }
      if (!discharged(s, fired) && !reportedSents.has(sent)) { reportedSents.add(sent); pushbackHits.push({ s: sent, fired }); }
    }
    for (const { s, cap } of capabilityLies.slice(0, 3)) {
      failures.push(
        `CAPABILITY-LIE: the report claims impossibility — "${s.slice(0, 130)}" — but ${cap.label} exists in this repo ` +
        `(${cap.paths.find((p) => existsSync(join(ROOT, p)))}). "Can't" without trying the known path is a deferral wearing a wall. ` +
        `Run it, or record \`IMPOSSIBLE: <wall> — tried: <real paths/commands>\` in ${evidenceRel} and the tried-set must include the known capability.`
      );
    }
    for (const { s, fired } of pushbackHits.slice(0, 4)) {
      failures.push(
        `PUSHBACK (${fired}): the final message ends with work still standing — "${s.slice(0, 130)}". ` +
        `The user would say: continue — do it now. Either complete the named work, or discharge it honestly in ${evidenceRel}: ` +
        `\`ACCEPTED-DEFERRAL: <item> — user said "<verbatim user words>"\`, \`LANE: user said "<verbatim user words>"\` for another agent's scope, ` +
        `or \`IMPOSSIBLE: <wall> — tried: <paths/commands actually attempted>\`. Asking permission ("want me to…") is also deferral — ` +
        `in-scope work is done, not offered.`
      );
    }
  }

  // Doc-level capability-lie — the same cross-check applied where the
  // claim actually gets buried: driven ledger docs plus the session
  // spec/review artifacts. A "can't verify, needs X" written into an
  // analysis never reaches the last-message scan; it reaches this one.
  // Same discharge shape: IMPOSSIBLE: <wall> — tried: <corroborated>.
  if (!exempt("PUSHBACK", "*")) {
    const docLieFiles = [];
    const drFile = join(ARTIFACT_DIR, `${sid}.md`);
    const specFile = join(ROOT, artifactFor(`.unlazy/design-spec/${sid}.md`));
    // Session-attributed docs, not just Driver:-declared ones — an
    // analysis doc this session wrote can bury the same claim without
    // ever carrying a Driver: line (plan_docs excludes machinery dirs).
    // plan_docs stores absolute paths (tracker writes them resolved);
    // drivenDocs are repo-relative — resolve() covers both, join() would
    // produce ROOT\C:\abs and silently existsSync-fail every session doc.
    const sessionDocs = (state.plan_docs || []).map((d) => resolve(ROOT, d));
    const seenDocs = new Set();
    for (const f of [drFile, specFile, ...drivenDocs.map((d) => resolve(ROOT, d)), ...sessionDocs]) {
      const key = String(f).replace(/\\/g, "/").toLowerCase();
      if (seenDocs.has(key)) continue;
      seenDocs.add(key);
      if (existsSync(f) && !exempt("PUSHBACK", f)) docLieFiles.push(f);
    }
    // A doc lie must name the capability AS the missing thing — a bare
    // "cannot" on a line that happens to mention "session"/"render" is
    // meta-discussion or a defect finding, not a wall-claim. Two shapes:
    // (1) requirement/absence phrasing ("needs a live authed server",
    //     "without a staff session", "none up", "server isn't running"),
    // (2) impersonal modal + work-verb ("can't verify", "unable to
    //     render") — but only when no product noun precedes the modal
    //     ("the page can't render" is a defect report, not a wall).
    // Capability-state qualifiers only in the middle slot — "a referent
    // capture" is an artifact-adjective, "a live authed server" is the
    // capability named as missing. Infra nouns fire bare; artifact nouns
    // (desk/capture/screenshot) fire only qualified, since "needs a
    // capture" is a TODO while "needs a live capture" claims a wall.
    const QUAL = "(?:live|running|authed|authenticated|working|local|headless|staff[-\\s]?|dev(?:elopment)?|test|staging|prod(?:uction)?|real|actual|proper|separate|new|fresh|own|dedicated|postgres|mysql|http|https|api|sql)";
    const NEED = "(?:needs?|requires?|without|lacks?|missing|don'?t\\s+have|do\\s+not\\s+have|haven'?t(?:\\s+got)?|hasn'?t(?:\\s+got)?|hadn'?t(?:\\s+got)?|had\\s+no)";
    const ART = "(?:a\\s+|an\\s+|the\\s+|any\\s+)";
    const INFRA = "(?:servers?|browsers?|sessions?|logins?|credentials?|databases?|db|endpoints?|cookies?|entitlements?|permissions?|auth(?:entication)?|headless)";
    const ART_NOUN = "(?:desks?|captures?|screenshots?|render(?:ing|s)?)";
    const WALL_REQ = new RegExp(
      `\\b${NEED}\\s+${ART}?(?:${QUAL}\\s+){0,3}${INFRA}\\b` +
      `|\\b${NEED}\\s+${ART}?(?:${QUAL}\\s+){1,3}${ART_NOUN}\\b` +
      `|\\bno\\s+(?:live|running|authed|working)\\s+[\\w-]{0,24}?\\s*(?:server|session|browser|database|login|endpoint|desk)\\b` +
      `|\\bnone\\s+(?:up|running|available|live|minted|started)\\b` +
      `|\\b(?:server|app|browser|endpoint|database|db)\\s+(?:isn't|is\\s+not|wasn't|was\\s+not|not)\\s+(?:running|up|available|live|reachable)\\b`,
      "i"
    );
    const WORK_VERB = "(?:verify|verified|check|checked|render|rendered|run|test|tested|capture|captured|see|seen|reach|reached|open|opened|load|loaded|measure|measured|probe|probed|drive|driven|exercise|exercised|confirm|confirmed|start|started|build|built|compile|compiled|launch|launched|log(?:ged)?\\s*in|authenticate|authenticated|quer(?:y|ied)|migrate|migrated|deploy|deployed|ship|shipped|land|landed|screenshot(?:ted)?|access|accessed|edit|edited|fix|fixed)";
    const MODAL_VERB = new RegExp(
      `\\b(?:can'?t|cannot|couldn'?t|could\\s+not|unable\\s+to|no\\s+way\\s+to|won'?t\\s+be\\s+able\\s+to)\\s+(?:be\\s+)?${WORK_VERB}\\b`,
      "gi"
    );
    // Clause-initial, discourse-marker, or agent subjects only — a noun
    // before the modal makes it a statement about a thing, not the work.
    // "it" is a special case: "it can't verify" is a tool failing (meta);
    // only "it can't be verified" (passive) is a wall on the work.
    const DISCOURSE = /^(?:and|but|or|so|yet|that|which|to|the|a|an|still|just|also|really|simply|however|though|because|since|while|if|when|then|now|here|not|no|their|this)$/i;
    const hasWallClaim = (line) => {
      if (WALL_REQ.test(line)) return true;
      MODAL_VERB.lastIndex = 0;
      let m;
      while ((m = MODAL_VERB.exec(line))) {
        const prev = (line.slice(0, m.index).match(/([A-Za-z'-]+)\s*[^\w\s]*\s*$/) || [])[1] || "";
        if (!prev || DISCOURSE.test(prev) || /^(?:i|we|one)$/i.test(prev)) return true;
        if (/^it$/i.test(prev) && /\bbe\s/i.test(m[0])) return true;
      }
      return false;
    };
    // Lines discussing the check itself name walls as examples — they
    // are the rule's own metalanguage, not claims about this work.
    const META_SKIP = /\b(?:CAPABILITY-LIE|PUSHBACK|STOP-DECLARED|deferral|wall-claim|discharge|the\s+gate\b|the\s+check\b|the\s+hook\b|this\s+check\b|gate-evidence|the\s+scan\b|the\s+rule\b)/i;
    for (const f of docLieFiles) {
      const rawDoc = readText(f) || "";
      const text = rawDoc
        .replace(/`[^`\n]*`/g, " ")
        .replace(/"[^"\n]*"/g, " ");
      const lines = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 15);
      for (const s of lines) {
        if (META_SKIP.test(s)) continue;
        if (/IMPOSSIBLE\s*:|tried\s*:|did\s+not\s+(?:run|try)|never\s+(?:ran|tried)|falsif/i.test(s)) continue;
        if (!hasWallClaim(s)) continue;
        const cap = CAPABILITIES.find((c) => c.re.test(s));
        const capPath = cap && cap.paths.find((p) => existsSync(join(ROOT, p)));
        if (!capPath) continue;
        // Discharge by the evidence file OR the doc's own IMPOSSIBLE:
        // line (the claim and its honest wall can live in one file) —
        // rawDoc lines carry the backticked commands the stripped scan
        // text deleted.
        if (impossibleDischarged(capPath, rawDoc.split(/\r?\n/))) continue;
        failures.push(
          `CAPABILITY-LIE (doc): ${f.replace(/\\/g, "/")} claims impossibility — "${s.slice(0, 110)}" — but ${cap.label} exists (${capPath}). ` +
          `A wall written into an artifact is still a wall-claim: run the known path, or record \`IMPOSSIBLE: <wall> — tried: <paths/commands actually run>\`.`
        );
        break; // one finding per doc is enough to act on
      }
    }
  }

  // COMPLETION-MATRIX (00-operating §2e — the completion matrix is an
  // ARTIFACT, not a mood): a turn that produced work cannot end on a
  // summary. Before the end summary lands, every ask maps to evidence in
  // a `## Completion matrix` table inside the session's gate-evidence
  // file. Deferred items, residuals, and remaining tasks get implemented
  // NOW — there is no deferral exit: a row ends DONE/VERIFIED (with
  // evidence in the row), BLOCKED: <external wall>, or ACCEPTED:
  // <user verb>. Every open todo item needs a row — and its row cannot
  // say DONE, because open is open.
  // F16: cmData is hoisted — OPEN-TODOS/TODOS-VANISHED below arm on open
  // tracker items regardless of files_edited (a zero-edit turn exited
  // clean with open work before).
  let cmData = [];
  const cmArmed = (state.files_edited || 0) > 0 || (state.todos_open_items || []).filter(Boolean).length > 0 || (state.todos_vanished || []).length > 0;
  if (cmArmed && !exempt("COMPLETION", "*")) {
    const cmHead = evidence.match(/^##\s*completion\s*matrix[^\n]*\n?/im);
    const cmBody = cmHead ? evidence.slice(cmHead.index + cmHead[0].length) : "";
    const cmNext = cmBody.search(/\n#{1,2}\s/);
    const cm = cmNext >= 0 ? cmBody.slice(0, cmNext) : cmBody;
    const cmLines = cm.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s\-|:]+\|\s*$/.test(l));
    cmData = cmLines.map((l) => l.split("|").map((c) => c.trim()).filter(Boolean));
    // F10: ≥2 header-vocabulary hits — a data row mentioning "item" once
    // must not be shifted out as if it were the header.
    if (cmData.length && (cmLines[0].match(/\b(?:ask|item|evidence|status)\b/gi) || []).length >= 2) cmData.shift();
    if (!cmData.length && (state.files_edited || 0) > 0) {
      failures.push(
        `COMPLETION-MATRIX: this turn produced ${state.files_edited} file edit(s) with no ## Completion matrix in ${evidenceRel} — ` +
        `before the end summary, every ask maps to evidence: \`| <item/ask> | <evidence> | DONE | BLOCKED: <external wall> | ACCEPTED: <user verb> |\`. ` +
        `Deferred items, residuals, and remaining tasks get implemented NOW — there is no deferral exit (00-operating §2e, 14-stop-integrity). ` +
        `Or \`EXEMPT-COMPLETION: * — <reason>\` for a turn that genuinely produced no work items.`
      );
    } else {
      const badRows = [];
      for (const cells of cmData) {
        const status = cells[cells.length - 1] || "";
        const isDone = /^(DONE|VERIFIED)\b/i.test(status);
        if (!isDone && !/^(BLOCKED|ACCEPTED)\s*:/i.test(status)) {
          badRows.push(`"${cells[0]}" — status "${status.slice(0, 40)}" is not DONE|BLOCKED:|ACCEPTED:`);
        } else if (isDone && (String(cells[1] || "").length < 10 || !/`[^`\n]{4,}`|\.(?:mjs|js|ts|py|css|html|j2|md|json|ya?ml)\b|:\d+|verify:|capture|screenshot|\.png\b|ran\s+\S+|command|route\s+\/\S+/i.test(cells[1] || ""))) {
          // DD-F4: a DONE row's evidence cell must carry an anchor —
          // "fixed it" / "updated" / "done per plan" pass ≥10 chars while
          // citing nothing checkable.
          badRows.push(`"${cells[0]}" — DONE without an anchored evidence cell (file:line, command, capture, or verify: cite)`);
        }
      }
      for (const item of (state.todos_open_items || []).filter(Boolean)) {
        const iWords = contentWords(item);
        const row = cmData.find((cells) => {
          const rWords = contentWords(cells[0] || "");
          return iWords.size && [...iWords].filter((w) => rWords.has(w)).length / iWords.size >= 0.5;
        });
        if (!row) {
          badRows.push(`open item "${item.slice(0, 60)}" has no completion-matrix row`);
        } else if (/^(DONE|VERIFIED)\b/i.test(row[row.length - 1] || "")) {
          badRows.push(`open item "${item.slice(0, 60)}" marked DONE while still open — implement it or carry BLOCKED:/ACCEPTED:`);
        }
      }
      if (badRows.length) {
        failures.push(
          `COMPLETION-MATRIX: ${badRows.length} row problem(s) — ${badRows.slice(0, 2).join("; ")}${badRows.length > 2 ? ` (+${badRows.length - 2} more)` : ""}. ` +
          `Deferred items, residuals, and remaining tasks get implemented NOW — the only exits are DONE+evidence, BLOCKED: <external wall>, or ACCEPTED: <user verb> (00-operating §2e, 14-stop-integrity).`
        );
      }
      // Disposition corroboration — the matrix lives in gate-evidence,
      // outside every ledger scan, so a BLOCKED/ACCEPTED row was the
      // least-checked claim in the system: shape passed, substance went
      // unverified. Now the dispositions hold the same standards their
      // siblings do: a BLOCKED wall gets the capability cross-check and
      // the STOP: BLOCKED path/command checks; ACCEPTED needs the same
      // user-agreement evidence as STOP: ACCEPTED (a recorded pause
      // signal sharing a content word, or a verbatim user quote).
      const corrProblems = [];
      for (const cells of cmData) {
        const status = cells[cells.length - 1] || "";
        const item = (cells[0] || "row").slice(0, 50);
        const bm = status.match(/^BLOCKED\s*:\s*(.+)$/i);
        const am = status.match(/^ACCEPTED\s*:\s*(.+)$/i);
        if (bm) {
          const wall = bm[1];
          const cap = CAPABILITIES.find((c) => c.re.test(wall));
          const capPath = cap && cap.paths.find((p) => existsSync(join(ROOT, p)));
          if (capPath && !impossibleDischarged(capPath)) {
            corrProblems.push(`BLOCKED row "${item}" walls on ${cap.label} which exists (${capPath}) — run it, or carry a corroborated \`IMPOSSIBLE: — tried:\` line`);
          }
          const deadPaths = citedPaths(wall).filter((p) => !anchoredPathExists(p));
          if (deadPaths.length) {
            corrProblems.push(`BLOCKED row "${item}" cites path(s) that don't exist: ${deadPaths.slice(0, 2).join(", ")}`);
          }
          if (transcriptRaw) {
            const ranCorpus = transcriptCommands(transcriptRaw);
            const neverRan = (wall.match(/`([^`\n]{2,160})`/g) || [])
              .map((x) => x.slice(1, -1))
              .filter((c) => /\s/.test(c) || !(/[\\/]|\.[\w.]{1,8}$/.test(c)))
              .filter((c) => !ranCorpus.includes(c));
            if (neverRan.length) {
              corrProblems.push(`BLOCKED row "${item}" cites command(s) absent from the transcript: ${neverRan.slice(0, 2).join(", ")}`);
            }
          }
        }
        if (am && !acceptedOk(`${cells[0] || ""} ${am[1]}`) && !quoteInUserTurn(am[1])) {
          corrProblems.push(`ACCEPTED row "${item}" claims user agreement with no corroboration — needs a recorded pause/assent signal sharing a content word, or a verbatim user quote`);
        }
        // DONE evidence anchors get existence-checked too — the anchor
        // test verifies SHAPE (a file extension or :NN pattern); a cite
        // pointing at nothing fabricated the anchor, not the work.
        if (/^(DONE|VERIFIED)\b/i.test(status)) {
          const dead = citedPaths(cells[1] || "").filter((p) => !anchoredPathExists(p));
          if (dead.length) {
            corrProblems.push(`DONE row "${item}" cites path(s) that don't exist: ${dead.slice(0, 2).join(", ")}`);
          }
          // B20: `ran \`<cmd>\`` claims were shape-anchored only — the
          // command never had to exist in the transcript. Same corpus
          // test the BLOCKED walls already pass.
          if (transcriptRaw) {
            const ranCorpus = transcriptCommands(transcriptRaw);
            const neverRan = (String(cells[1] || "").match(/`([^`\n]{2,160})`/g) || [])
              .map((x) => x.slice(1, -1))
              .filter((c) => /\s/.test(c) || !(/[\\/]|\.[\w.]{1,8}$/.test(c)))
              .filter((c) => !ranCorpus.includes(c));
            if (neverRan.length) {
              corrProblems.push(`DONE row "${item}" claims ran command(s) absent from the transcript: ${neverRan.slice(0, 2).join(", ")}`);
            }
          }
        }
      }
      if (corrProblems.length) {
        failures.push(
          `COMPLETION-MATRIX corroboration: ${corrProblems.length} disposition(s) asserted, not proven — ${corrProblems.slice(0, 2).join("; ")}${corrProblems.length > 2 ? ` (+${corrProblems.length - 2} more)` : ""} (14-stop-integrity: the class is verified, not asserted).`
        );
      }
    }
  }

  // OPEN-TODOS hard gate (user directive, verbatim): "the script
  // should've blocked the conversation from ending if it saw
  // remaining work in the tracker with an explicit message back
  // saying that deferring work is not allowed and it must be
  // completed now." F16: armed on open tracker items regardless of
  // files_edited — a zero-edit turn used to exit clean with open work.
  const openUndone = (state.todos_open_items || []).filter(Boolean).filter((item) => {
    const iWords = contentWords(item);
    const row = cmData.find((cells) => {
      const rWords = contentWords(cells[0] || "");
      return iWords.size && [...iWords].filter((w) => rWords.has(w)).length / iWords.size >= 0.5;
    });
    return !row || /^(DONE|VERIFIED)\b/i.test(row[row.length - 1] || "");
  });
  if (openUndone.length) {
    failures.push(
      `OPEN-TODOS: ${openUndone.length} tracker item(s) still open with no legal exit — ` +
      openUndone.slice(0, 3).map((i) => `"${i.slice(0, 50)}"`).join("; ") +
      `. Deferring work is not allowed: this work must be completed now, walled by a real external blocker ` +
      `(BLOCKED: <wall> + declared STOP), or re-scoped by the user's own words (ACCEPTED: + verbatim). ` +
      `There is no later, no residual, no parked state (00-operating §2e).`
    );
  }
  // Vanished-item join (B3): the tracker records stems that left the
  // list without completing — each owes a matrix row for its real
  // terminal state, or an explicit pardon. F17: per-stem
  // `EXEMPT-TODOS: <stem words> — <reason>` pardons one item.
  const exemptTodoStem = (stem) => evidence.split(/\r?\n/).some((l) => {
    const m = l.match(/EXEMPT-TODOS\s*:\s*(.+?)\s*(?:—|--|::| - )\s*(\S.{3,})/i);
    if (!m || m[1].trim() === "*") return false;
    const tw = contentWords(m[1]); const sw = contentWords(stem);
    return tw.size && [...tw].filter((w) => sw.has(w)).length / tw.size >= 0.6;
  });
  const gone = (Array.isArray(state.todos_vanished) ? state.todos_vanished : []).filter(Boolean).filter((stem) => {
    const iWords = contentWords(stem);
    const row = cmData.find((cells) => {
      const rWords = contentWords(cells[0] || "");
      return iWords.size && [...iWords].filter((w) => rWords.has(w)).length / iWords.size >= 0.4;
    });
    return !row;
  }).filter((stem) => !exemptTodoStem(stem));
  if (gone.length && !exempt("TODOS", "*")) {
    failures.push(
      `TODOS-VANISHED: ${gone.length} item(s) left the todo list without completing — ` +
      gone.slice(0, 3).map((g) => `"${g.slice(0, 50)}"`).join("; ") +
      `. Deleting or rewording an open item is not a disposition; each owes a completion-matrix row ` +
      `(or EXEMPT-TODOS: <stem words or *> — <reason>).`
    );
  }

  // (OPEN-BLOCKED consumer moved below the iteration-loop check — loop
  // findings can push BLOCKED rows too, and the consumer must run after
  // every producer, not before the last one.)

  // ANALYSIS-EVIDENCE (15-analysis-depth → the evidence pass): a
  // root-cause/postmortem ask is armed by the prompt hook; the answer must
  // carry its evidence enumeration — an `## Evidence` block, `Evidence:`
  // lines, or an explicit `DECLARED: no artifact evidence` — otherwise the
  // causal narrative was composed without gathering. Satisfying clears
  // the arm; a new analysis ask re-arms it.
  if (state.analysis_asked) {
    // The enumeration belongs to the answer that clears THIS arm — an
    // `Evidence:` line from an earlier turn can't satisfy a newly-armed
    // ask, so only the last assistant message counts.
    const answerText = assistantTexts.slice(-1).join("\n");
    // A bare `## Evidence` heading clears nothing — the enumeration needs
    // content (≥3 non-empty lines under it) or the explicit DECLARED form.
    const evHead = answerText.match(/##\s*evidence\b[^\n]*\n([\s\S]{0,1200})/i);
    const evLines = evHead ? evHead[1].split(/\r?\n/).filter((l) => l.trim() && !/^#{1,6}\s/.test(l)).length : 0;
    let hasEvidence = (evHead && evLines >= 3) ||
      /(?:^|\n)\s*[-*]?\s*evidence\s*:\s*\S/i.test(answerText) ||
      /DECLARED:\s*no artifact evidence\s*(?:—|--|::| - )\s*.{10,}/i.test(answerText);
    // M-F2: the LAST message clearing the arm says nothing about the
    // FIRST answer after the ask — the reported failure shape is a thin
    // first answer followed by a user re-ask. Scan the earlier assistant
    // texts: a substantive post-arm answer (≥200 chars carrying analysis
    // vocabulary) with no evidence enumeration is a first-answer-thin
    // event — recorded, and it blocks the stop unless the last message
    // accounts for it (the gap-naming obligation M-F3 already imposes is
    // the disposition channel).
    let firstThin = 0;
    if (assistantTexts.length > 1 && !exempt("FIRSTANSWER", "*")) {
      const evShape = /##\s*evidence\b|(?:^|\n)\s*[-*]?\s*evidence\s*:\s*\S|DECLARED:\s*chat[-\s]?scale|file:\d+|:\d+\b/i;
      const ansShape = /\b(examin|analy[sz]|review|audit|inspect|walked|covered|checked|probed|looked|found|read)\w*\b/i;
      for (const t of assistantTexts.slice(0, -1)) {
        if (t.length >= 200 && ansShape.test(t) && !evShape.test(t)) firstThin++;
      }
    }
    // Runtimes that send neither last_assistant_message nor a transcript
    // leave assistantTexts empty — hasEvidence could never be true and
    // the arm deadlocked until the loop guard released (R15-F26). The
    // declaration can't live in an answer the gate can't see, so it
    // moves to the auditable surface: the iteration artifact.
    if (!hasEvidence && !assistantTexts.length) {
      const itext = readText(join(ROOT, ".unlazy", "iteration", `${sid}.md`)) || "";
      hasEvidence = /DECLARED:\s*no artifact evidence\s*(?:—|--|::| - )\s*.{10,}/i.test(itext) ||
        /DECLARED:\s*analysis\s*[—-]{1,2}\s*.{12,}/i.test(itext);
    }
    // The chat floor (15-analysis-depth items 23–24): an armed answer
    // carries the machinery spine — machinery-plan block, examined-vs-
    // found accounting, hypothesis log, committed synthesis — each
    // present or `DECLARED: <piece> — <why>`, plus `## Evidence`.
    // `DECLARED: chat-scale — <why>` releases the whole floor and is the
    // routing declaration for narrow asks. All presence-checkable — the
    // floor makes a shallow pass leave fingerprints, it can't force
    // taste. Floor/routing only bind when the answer is visible (the
    // assistantTexts-empty runtimes keep the itext-evidence floor above).
    // AP-F1: the why after `DECLARED: chat-scale —` must carry scale
    // vocabulary or reach back to the ask's own words — "— because" with
    // ten arbitrary chars behind it was a routing claim that bound
    // nothing. Scale words name the ask's size; shared content-words tie
    // the declaration to THIS ask rather than a boilerplate stamp.
    const csM = answerText.match(/DECLARED:\s*chat[-\s]?scale\s*(?:—|--|::| - )\s*(.{10,200})/i);
    let chatScaleDecl = false;
    if (csM) {
      const why = csM[1];
      const scaleOk = /\b(?:narrow|small|single|one|lookup|quick|trivial|local|scoped|limited|only|just|this\s+(?:file|function|line|question|ask|bug|route|page|token|word)|scale|size|surface|specific|one[-\s]?lin)/i.test(why);
      let sharedOk = false;
      try {
        const askWords = contentWords(String(state.analysis_asked && state.analysis_asked.excerpt || ""));
        const whyWords = contentWords(why);
        sharedOk = [...whyWords].filter((w) => askWords.has(w)).length >= 2;
      } catch { sharedOk = false; }
      chatScaleDecl = scaleOk || sharedOk;
    }
    const pieceDecl = (kw) => new RegExp(`DECLARED:[^\\n]*\\b${kw}\\b[^\\n]*—\\s*.{10,}`, "i").test(answerText);
    const floorMissing = [];
    let unrouted = false;
    if (assistantTexts.length && !chatScaleDecl) {
      if (!hasEvidence && !pieceDecl("evidence")) {
        floorMissing.push("an `## Evidence` enumeration — satisfy via: `## Evidence` heading followed by ≥3 non-empty lines | an `Evidence: <…>` line | `DECLARED: no artifact evidence — <why>` | `DECLARED: <…> evidence <…> — <why>`");
      }
      const hasPlan = /^#{1,6}\s*[^\n|]*\bplan\b/im.test(answerText) || pieceDecl("plan");
      if (!hasPlan) floorMissing.push("the machinery-plan block (universe + axes + evidence each row will produce, declared before the findings) — satisfy via: any `##`-heading containing the word `plan` (e.g. `## Machinery plan` — must be a heading, not a plain-text label) | `DECLARED: <…> plan <…> — <why>`");
      const hasCov = /^#{1,6}\s*(coverage|universe|examined|scope)\b/im.test(answerText) ||
        /\b\d+\s+(?:units?|files?|surfaces?|rows?|elements?|pages?|items?|calls?|paths?)\s+(?:examined|walked|covered|read|opened)/i.test(answerText) ||
        pieceDecl("coverage") || pieceDecl("examined");
      if (!hasCov) floorMissing.push("examined-vs-found accounting (counts deriving from an enumeration — 'N units examined, M produced findings') — satisfy via: `## Coverage|Universe|Examined|Scope` heading | inline `N units|files|surfaces|rows examined|covered|read|opened` | `DECLARED: <…> coverage|examined <…> — <why>`");
      const hasHyp = /^\s*[-*]?\s*(?:found|cleared|unverifiable)\s*:/im.test(answerText) ||
        /^#{1,6}\s*hypothes/im.test(answerText) || pieceDecl("hypothesis");
      if (!hasHyp) floorMissing.push("hypothesis-log lines (found:/cleared:/unverifiable: — the examined-and-cleared half) — satisfy via: line(s) starting `found:`/`cleared:`/`unverifiable:` | `## Hypothes…` heading | `DECLARED: <…> hypothesis <…> — <why>`");
      const hasSynth = /^#{1,6}\s*(synthesis|verdict|conclusion|assessment)\b/im.test(answerText) ||
        /\b(ranked?\s+by|most\s+significant|highest[-\s]?(?:impact|leverage)|alternative\s+(?:explanation|hypothesis)|weighed?\s+(?:the\s+)?alternative|would\s+change\s+(?:my|this|the)\b)/i.test(answerText) ||
        pieceDecl("synthesis");
      if (!hasSynth) floorMissing.push("committed synthesis (ranked findings + the mechanism apart from the symptom list + ≥1 alternative weighed + the falsifier) — satisfy via: heading starting `## Synthesis|Verdict|Conclusion|Assessment` (the heading must begin with that word — `## Committed synthesis` does not match) | inline `ranked by | most significant | alternative explanation | weighed the alternative | would change this` | `DECLARED: <…> synthesis <…> — <why>`");
      // Routing — a subject-shaped ask's scale is declared, not assumed:
      // the analysis-project doc exists, or the DECLARED: chat-scale
      // line says why the ask is narrow.
      const ex = String(state.analysis_asked.excerpt || "");
      if (/\b(audit|review|assess|evaluat|examin|critique|analy[sz]e|walk\s*through)\b/i.test(ex)) {
        let docFound = false;
        const cand = [...(state.audit_armed || []), ...(state.plan_docs || [])];
        for (const p of cand) {
          try {
            const ct = fenceStrip(readText(existsSync(p) ? p : join(ROOT, p)) || "");
            if (hasMarker(ct, "analysis-project v1") || hasMarker(ct, "analysis-project v2")) { docFound = true; break; }
          } catch { }
        }
        // The dir scan is session-scoped: a marker doc only satisfies
        // routing when THIS session wrote one (analysis_doc_written) —
        // a stale doc from another session can't answer this ask.
        if (!docFound && state.analysis_doc_written) {
          try {
            const adir = join(ROOT, ".unlazy", "analysis");
            if (existsSync(adir)) {
              for (const f of readdirSync(adir)) {
                if (!/\.md$/i.test(f)) continue;
                const at = readText(join(adir, f)) || "";
                if (hasMarker(at, "analysis-project v1") || hasMarker(at, "analysis-project v2")) { docFound = true; break; }
              }
            }
          } catch { }
        }
        unrouted = !docFound;
      }
    }
    const clears = exempt("ANALYSIS", "*") || (assistantTexts.length
      ? (chatScaleDecl || (!floorMissing.length && !unrouted))
      : hasEvidence);
    // M-F2 consumption: a first-answer-thin event blocks the stop even
    // when the last answer clears — thinness that took a re-ask is the
    // reported failure; naming it is the disposition.
    if (firstThin && clears) {
      failures.push(
        `FIRST-ANSWER: ${firstThin} earlier assistant answer(s) carried analysis vocabulary with no evidence enumeration — ` +
        `the first answer after the ask was thin and a later message can't silently absorb it. Name the first-pass gap ` +
        `(PRIOR-PASS: line or ## Prior-pass gap — the M-F3 channel) or EXEMPT-FIRSTANSWER: * — <reason>.`
      );
    }
    if (clears) {
      try {
        delete state.analysis_asked;
        mkdirSync(STATE_DIR, { recursive: true });
        writeFileSync(join(STATE_DIR, `${sid}.json`), JSON.stringify(state, null, 2));
      } catch { /* clearing is best-effort */ }
    } else {
      failures.push(
        `ANALYSIS-EVIDENCE: a root-cause/analysis ask is armed ("${String(state.analysis_asked.excerpt || "").slice(0, 80)}…") — ` +
        (floorMissing.length ? `the chat floor is missing ${floorMissing.join("; ")}. ` : "") +
        (unrouted ? `the ask is subject-shaped with no \`<!-- analysis-project -->\` doc and no \`DECLARED: chat-scale — <why>\` line — routing is declared, not assumed. ` : "") +
        (!floorMissing.length && !unrouted ? `the latest message carries no evidence enumeration — run the evidence pass first, then answer with an \`## Evidence\` enumeration and claims cited or tagged INFERENCE: (or \`DECLARED: no artifact evidence — <why>\`). ` : "") +
        `(15-analysis-depth items 23–24 — every armed answer carries the machinery spine; narrow asks declare their scale.)`
      );
    }
  }

  // ASK-SURFACE (15-analysis-depth item 25): a quantifier/breadth-armed
  // analysis ask must show the universe came from the subject, not from
  // the analyst's memory — the pleasant-button cut was a self-declared
  // 13-unit universe counted 13/13 by its own author. An armed analysis
  // doc satisfies with a derivation signal in its universe section
  // (a verify:/doc: cite, a count command, enumeration vocabulary) or
  // the rule's own declared fallback ("authored — no probe exists …").
  if (state.analysis_asked && !exempt("ASKSURFACE", "*")) {
    const ex = String(state.analysis_asked.excerpt || "");
    if (/\b(every|all|each|across|entire|exhaustive|comprehensive|meticulous|extreme|full)\b/i.test(ex)) {
      let docWithDeriv = null, markerDocs = 0;
      const cands = [...(state.audit_armed || []), ...(state.plan_docs || [])];
      for (const p of cands) {
        try {
          const ct = fenceStrip(readText(existsSync(p) ? p : join(ROOT, p)) || "");
          if (!hasMarker(ct, "analysis-project v1") && !hasMarker(ct, "analysis-project v2")) continue;
          markerDocs += 1;
          const uni = (sectionBody(ct, "universe") || "") + (sectionBody(ct, "units") || "");
          if (/\b(verify:|doc:|grep|glob|Get-ChildItem|\bwc\b|\bls\b|\brg\b)\b|enumerat\w+|census|derived?\s+from|mechanical/i.test(uni) ||
              /authored\s*[—-]|DECLARED:\s*authored/i.test(uni)) { docWithDeriv = p; break; }
        } catch { }
      }
      if (markerDocs && !docWithDeriv) {
        failures.push(
          `ASK-SURFACE: the armed ask is quantifier/breadth-shaped ("${ex.slice(0, 80)}…") but no analysis doc's universe section shows a mechanical derivation — ` +
          `produce the count by interrogating the subject (grep/glob/count command cited in the doc's universe section) ` +
          `or carry the authored-declaration the rule allows ("authored — <why no probe exists>"). ` +
          `A declared count that never met the subject is self-grading (15-analysis-depth item 25). ` +
          `Or EXEMPT-ASKSURFACE: * — <reason> in ${evidenceRel}.`
        );
      }
    }
  }

  // Tier-2 depth checks (fix plan U7/U9/U10/U11): armed on analysis asks.
  // Each measures a shape (element coverage, eyes artifact presence,
  // authority-quote presence, render vocabulary) — never a verdict.
  const analysisDocs = [];
  if (state.analysis_asked) {
    for (const p of [...(state.audit_armed || []), ...(state.plan_docs || [])]) {
      try {
        const ct = fenceStrip(readText(existsSync(p) ? p : join(ROOT, p)) || "");
        if (hasMarker(ct, "analysis-project v1") || hasMarker(ct, "analysis-project v2")) analysisDocs.push({ p, ct });
      } catch { }
    }
  }
  if (state.analysis_asked && analysisDocs.length) {
    const ex = String(state.analysis_asked.excerpt || "");

    // U7 GRANULARITY (item 26): ≥60% of elements enumerated in a doc's
    // universe/units section must appear inside some unit's text —
    // heading OR body (verbatim-in-title isn't required).
    if (!exempt("GRANULARITY", "*")) {
      for (const { p, ct } of analysisDocs) {
        const uni = sectionBody(ct, "universe") || sectionBody(ct, "units") || "";
        const elems = uni.split(/\r?\n/)
          .filter((l) => !/^[\s|:\-]+$/.test(l))
          .map((l) => { const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.{3,80})/) || l.match(/\|\s*([^|]{2,80}?)\s*\|/); return m ? m[1].trim() : null; })
          .filter((el) => el && !/^(element|universe|count|derived-by|unit|evidence|state|id|finding|class|sev|severity|mechanism|disposition|axis|walked|checked)$/i.test(el));
        if (elems.length < 3) continue;
        const unitText = (ct.match(/^###[^\n]*\n(?:[^#]|\n(?!#))*/gm) || []).join("\n");
        const unmapped = elems.filter((el) => {
          const words = el.replace(/[^\w\s-]/g, " ").split(/\s+/).filter((w) => w.length > 3);
          return !words.length || !words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(unitText));
        });
        if (unmapped.length && unmapped.length / elems.length > 0.4) {
          failures.push(
            `GRANULARITY: ${p.split(/[\\/]/).pop()} enumerates ${elems.length} universe elements but ${unmapped.length} appear in no unit's text (>40% unmapped — item 26 binds units to elements × aspects): ` +
            `first unmapped: ${unmapped.slice(0, 5).join("; ")}. Map them or DECLARED: per element. Or EXEMPT-GRANULARITY: * — <reason> in ${evidenceRel}.`
          );
          break;
        }
      }
    }

    // U9 EYES-VERDICT (item 7): parity/comparison verdict asks make the
    // independent-eyes pass non-optional — a real eyes artifact, or a
    // DECLARED carrying a quoted user line or a real wall (tried:).
    if (!exempt("EYESVERDICT", "*") &&
        /\b(parity|compar|better|worse|missing|best|worst|verdict|judge|review|audit)\b/i.test(ex)) {
      let eyesFound = false;
      try {
        const eyesDir = join(ROOT, ".unlazy", "eyes");
        if (existsSync(eyesDir)) {
          for (const f of readdirSync(eyesDir)) {
            if (!f.startsWith(sid)) continue;
            const t = readText(join(eyesDir, f)) || "";
            if (/<!--\s*eyes\s+v\d/i.test(t) || /##\s*findings|VERDICT/i.test(t)) { eyesFound = true; break; }
          }
        }
      } catch { }
      const declaredEyes = /DECLARED\s*:[^\n]*(?:user\s+said\s+"|tried\s*:|BLOCKED)/i.test(evidence || "");
      if (!eyesFound && !declaredEyes) {
        failures.push(
          `EYES-VERDICT: the armed ask is verdict/comparison-shaped ("${ex.slice(0, 80)}…") — the independent-eyes pass is mandatory here: ` +
          `deposit an eyes artifact at .unlazy/eyes/${sid}-*.md (<!-- eyes v2 -->) with the stranger's findings, ` +
          `or DECLARED: <why> carrying a quoted user line or tried: <the real wall> — the "user order + harness policy" cite is the named failure. ` +
          `Or EXEMPT-EYESVERDICT: * — <reason> in ${evidenceRel}.`
        );
      }
    }

    // U10 DECLARED-TRUTH: DECLARED/EXEMPT reasons citing authority must
    // quote the source — verbatim user words or a file:line rule cite.
    // `env:` prefix is the legal shape for harness-constraint reasons.
    if (!exempt("DECLAREDTRUTH", "*")) {
      const badDecl = (evidence || "").split(/\r?\n/).filter((l) =>
        /DECLARED\s*:|EXEMPT-\w+\s*:/i.test(l) &&
        /\b(user|policy|per\s+\S+\s+rule|harness|order|authorized|allowed)\b/i.test(l) &&
        !/user\s+said\s+"|:\d+\b|verify:|env\s*:/i.test(l)
      );
      if (badDecl.length) {
        failures.push(
          `DECLARED-TRUTH: ${badDecl.length} DECLARED/EXEMPT line(s) cite authority without quoting it — ` +
          `first: "${badDecl[0].trim().slice(0, 80)}". Authority claims carry the source: user said "<verbatim>", file:line of the rule, or env: <the real constraint>. ` +
          `Or EXEMPT-DECLAREDTRUTH: * — <reason> in ${evidenceRel}.`
        );
      }
    }

    // U11 RENDER-FLOOR (item 27/render-arm): analysis asks on UI subjects
    // owe DOM/capture vocabulary in doc or evidence — a rendered row per
    // surface class or the DECLARED: no-render wall.
    if (!exempt("RENDERFLOOR", "*") &&
        (/\b(ui|design|visual|render|looks|screen|page|tab|surface|front[-\s]?end)\b/i.test(ex) || (state.ui_touched || []).length)) {
      const hasRender = /\b(png|shot|screenshot|capture|probe|DOM\b|render|viewport|paint)/i.test(
        analysisDocs.map((d) => d.ct).join("\n") + "\n" + (evidence || "")
      );
      const declaredNoRender = /DECLARED\s*:\s*no[-\s]?(?:render|rendered surface)\s*—/i.test(evidence || "");
      if (!hasRender && !declaredNoRender) {
        failures.push(
          `RENDER-FLOOR: the armed ask is UI-subject-shaped ("${ex.slice(0, 80)}…") but no doc/evidence carries a DOM-derived probe or capture — ` +
          `the complained session had a live server and went API-only; render one surface per class or DECLARED: no-render — <wall>. ` +
          `Or EXEMPT-RENDERFLOOR: * — <reason> in ${evidenceRel}.`
        );
      }
    }
  }

  // U12 META-COST telemetry: artifact bytes vs deliverable bytes per
  // session — measurement first, threshold later (plan U12). Emitted as
  // a note, never a block.
  try {
    let artBytes = 0;
    const artDirs = [join(ROOT, ".unlazy", "analysis"), join(ROOT, ".unlazy", "gate-evidence"), join(ROOT, ".unlazy", "audit-ledger"), join(ROOT, ".unlazy", "iteration"), join(ROOT, ".unlazy", "design-review"), join(ROOT, ".unlazy", "eyes")];
    for (const d of artDirs) {
      try { for (const f of readdirSync(d)) { if (f.startsWith(sid) || f === "agent-rule-adherence-analysis.md") artBytes += statSync(join(d, f)).size; } } catch { }
    }
    let delivBytes = 0;
    for (const p of (state.impl_touched || [])) {
      try { const fp = existsSync(p) ? p : join(ROOT, p); const s = statSync(fp); if (s.isFile()) delivBytes += s.size; } catch { }
    }
    if (artBytes && delivBytes) {
      const ratio = +(artBytes / delivBytes).toFixed(1);
      TELEMETRY_CTX.meta_cost = { artifact_bytes: artBytes, deliverable_bytes: delivBytes, ratio };
      console.error(`stop-gate note: META-COST: artifact-bytes ${(artBytes / 1024).toFixed(0)}KB vs deliverable-bytes ${(delivBytes / 1024).toFixed(0)}KB — ratio ${ratio} (telemetry only; threshold is the user's call, plan U12)`);
    }
  } catch { }

  // ANALYSIS-PROJECT (15-analysis-depth → the analysis project): a doc
  // marked <!-- analysis-project v1|v2 --> claims a worked examination —
  // the schema reconciles its own coverage like the audit ledger does.
  // Universe rows each need a ### unit section; unit sections need an
  // Examined/Found record + an evidence token (a bare heading is not an
  // examination); UNITS: x/y is recomputed, not trusted.
  // E6a: the scan set is armed-docs ∪ marker-carriers — a doc that
  // carries the analysis-project marker under a basename outside the
  // armed REs (tracker records it in marker_docs) still owes the schema;
  // the marker IS the arming signal, not the filename.
  const projectDocs = [];
  for (const p of new Set([...(state.audit_armed || []), ...(state.plan_docs || []), ...(state.marker_docs || [])])) {
    // Tracker records ABSOLUTE paths — join(ROOT, "C:/…") produces a
    // nonexistent path on Windows and the marker check silently never
    // fires (dead check). Sibling sites use this same existsSync pattern.
    const fp = existsSync(p) ? p : join(ROOT, p);
    try {
      const t = fenceStrip(readText(fp) || "");
      if (hasMarker(t, "analysis-project v1") || hasMarker(t, "analysis-project v2")) {
        projectDocs.push({ p, t, v2: hasMarker(t, "analysis-project v2") });
      }
    } catch { /* unreadable — not a project doc for this check */ }
  }
  for (const { p, t, v2 } of projectDocs) {
    const pnf = fenceStrip(t);
    const pmissing = [];
    for (const sec of ["Universe", "Analysis plan", "Units", "Hypothesis log", "Constraint check", "Synthesis"]) {
      if (!new RegExp(`^##\\s*${sec.replace(/ /g, "\\s+")}\\b`, "im").test(pnf)) pmissing.push(`a ## ${sec} section`);
    }
    // h2SectionBody is the canonical slicer here — a lazy-regex
    // lookahead's `\s*$` matched the first line-end and always returned
    // an empty body (the check was dead, so the bug never fired), and
    // sectionBody's `#{1,6}` boundary eats the ### U1…U15 content inside
    // ## Units. R12-F4 repair exposed both. Slice by next-h2 index.
    const uniBody = h2SectionBody(pnf, "Universe");
    const unitBody = h2SectionBody(pnf, "Units");
    // Header rows end right after the label — a first cell that is
    // `unit`/`derived` verbatim is the header; `| unit tests |` is DATA
    // (R13-F14: the word-boundary scan undercounted real universe rows).
    const uniRows = uniBody ? uniBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/^\s*\|\s*(?:units?|id|derived|universe|#)\s*\|/i.test(l)).length : 0;
    const unitSecs = unitBody ? [...unitBody.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1].trim()) : [];
    if (uniBody && uniRows === 0) pmissing.push("`## Universe` data rows — a mechanical enumeration is the project's spine");
    if (uniRows > 0 && unitSecs.length < uniRows) {
      pmissing.push(`## Units has ${unitSecs.length} ### sections for ${uniRows} universe rows — every enumerated unit gets its own examination block`);
    }
    // A7: bare `render`/`stdout` no longer satisfy — token + value required.
    const EVID = /`[^`\n]{4,}`|\.(?:mdc?|png|mjs|css|js|py|html|j2|json|ya?ml|txt|log)\b|\bprobes?\b|\bshots?\b|\bcomputed\b|\bverify:|:\d+|\b(?:render|stdout)\s*[:=]\s*\S/i;
    let thinUnits = 0;
    if (unitBody) {
      const parts = unitBody.split(/^###\s+/m).slice(1);
      for (const part of parts) {
        const body = part.replace(/\s+/g, " ").trim();
        if (body.length < 60 || !EVID.test(part)) thinUnits++;
      }
    }
    if (thinUnits) pmissing.push(`${thinUnits} ## Units ### section(s) are thinner than an examination (need ≥60 chars + an evidence token — a heading is not a walk)`);
    // AQ-F3: banned coverage-adjective costumes apply to analysis docs
    // too — "representative sample"/"out of scope"/"for later" lines
    // need a disposition marker, same contract as the audit ledger.
    const badAdj = pnf.split(/\r?\n/).filter(
      // Mention-vs-use: the word inside backticks or quotes is being
      // named (a finding ABOUT the ban, a cited mechanism) — strip those
      // spans before testing, same doctrine as the deferral scan.
      (l) => {
        const s = l.replace(/`[^`]*`/g, "").replace(/"[^"]*"/g, "");
        return BANNED_ADJ.test(s) && !disposedOf(l, acceptedOk) && !/^\s*\|.*(?:banned|vocabulary|costume)/i.test(l);
      }
    );
    if (badAdj.length) {
      pmissing.push(`banned coverage-adjective phrase: "${badAdj[0].trim().slice(0, 80)}" — enumerate the universe or disposition the line (same contract as AUDIT-LEDGER)`);
    }
    if (v2) {
      // v2 adds the commitment layer the v1 schema could pass without:
      // the contract the subject is graded under, and a synthesis that
      // ranks + names the mechanism + weighs an alternative.
      if (!/subject[-\s]?job\s*:/i.test(pnf)) {
        pmissing.push("a `subject-job:` line (v2 — the contract the subject is graded under, 15-analysis-depth item 14)");
      }
      // Phase A (pipeline-improvement): `subject-class:` declares what the
      // doc is — project|process subjects carry the deep schema (question-
      // table, model, prior art, conduct record); `unit` is the narrow
      // escape, auditable against its own universe size.
      const classM = pnf.match(/^\s*subject-class\s*:\s*([A-Za-z]+)\b/im);
      let projLevel = false, isProcess = false;
      if (!classM) {
        pmissing.push("a `subject-class:` line (v2 — project|process|unit; project/process arm the project-level fields)");
      } else {
        const cls = classM[1].toLowerCase();
        projLevel = cls === "project" || cls === "process";
        isProcess = cls === "process";
        if (cls === "unit" && uniRows >= 5) {
          pmissing.push(`subject-class: unit with ${uniRows} universe rows — ≥5 rows is project/process scope`);
        }
      }
      if (isProcess) {
        // A4: machinery subjects get the process axes — the analysis must
        // walk the mechanism's own contract, not just its files.
        const AXIS = ["contract", "consumers", "arm-signal", "satisfy-signal", "escape-shape", "reach-condition", "meta-wrongness"];
        const missAxes = AXIS.filter((a) => {
          const tok = a.replace(/-/g, "[-\\s]?");
          return !new RegExp(`\\b${tok}\\s*[:|]`, "i").test(pnf) && !new RegExp(`AXIS-NA\\s*:\\s*${tok}`, "i").test(pnf);
        });
        if (missAxes.length) pmissing.push(`process-subject axis rows: ${missAxes.join(", ")} — each gets a row or \`AXIS-NA: <axis> — <why>\``);
      }
      if (projLevel) {
        const planBody = h2SectionBody(pnf, "Analysis plan");
        const solePlan = /sole\s*(?:—|--|::| - )\s*\S/i.test(planBody);
        const vacuousQ = /^(is|are|does|do|did|can|could|should|would)\s+(it|this|that|they|them)\b/i;
        // Unit-id grammar shared by A1 reverse-parity + A3 plan parity:
        // ### headings lead with the id (U1, Q2, 3); cells cover by token
        // (U1), range (U1–U9), or the word `all`.
        const unitIds = unitSecs.map((h) => { const m = h.match(/^([A-Za-z]{0,3}\d+)/); return m ? m[1].toUpperCase() : null; }).filter(Boolean);
        const collectCovered = (text, into) => {
          if (/\ball\b/i.test(text)) unitIds.forEach((u) => into.add(u));
          for (const rm of text.matchAll(/([A-Za-z]{0,3})(\d+)\s*[–—-]\s*([A-Za-z]{0,3})(\d+)/g)) {
            const pre = (rm[1] || rm[3]).toUpperCase();
            for (let n = +rm[2]; n <= +rm[4]; n++) into.add(pre + n);
          }
          for (const tm of text.matchAll(/\b([A-Za-z]{1,3}\d+)\b/g)) into.add(tm[1].toUpperCase());
        };
        // A1: the question-table — the question-space the units answer to.
        const qRows = planBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l));
        const qHdrIdx = qRows.findIndex((l) => /\|\s*question\s*\|[^|\n]*\bunit\b/i.test(l) && /settles[-\s]?by/i.test(l));
        if (qHdrIdx < 0) {
          pmissing.push("a question-table in `## Analysis plan` (`| question | unit | settles-by | settled-by |`)");
        } else {
          const qData = qRows.slice(qHdrIdx + 1);
          let vacuous = 0;
          const qCovered = new Set();
          for (const row of qData) {
            const cells = row.split("|").slice(1, -1).map((c) => c.trim());
            const q = cells[0] || "";
            if (q.length < 15 || !q.includes("?") || vacuousQ.test(q)) vacuous++;
            collectCovered(cells[1] || "", qCovered);
          }
          if (vacuous) pmissing.push(`${vacuous} question-table row(s) vacuous — a question names an element/mechanism/decision (≥15 chars, a '?', not 'is it good?')`);
          const unsettled = unitIds.filter((u) => !qCovered.has(u));
          if (unsettled.length && !/none\s*(?:—|--|::| - )\s*\S/i.test(planBody) && !solePlan) {
            pmissing.push(`units ${unsettled.slice(0, 4).join(", ")} not settled by any question-row — every ### unit is answered by ≥1 question (or the plan carries 'none — <why>')`);
          }
        }
        // A3: plan→units parity — each ### unit traced to an ## Analysis
        // plan row; `sole — <why>` exempts a genuinely single-walk plan.
        if (!solePlan) {
          const planCovered = new Set();
          collectCovered(planBody, planCovered);
          const unmapped = unitIds.filter((u) => !planCovered.has(u));
          if (unmapped.length) pmissing.push(`units ${unmapped.slice(0, 4).join(", ")} not mapped to an ## Analysis plan row — token or U1–U9 range, or 'sole — <why>'`);
        }
        // A9: plan verification — an independent pass confirms the plan
        // covers the universe BEFORE the walk. The stranger deposits
        // `.unlazy/eyes/<sid>-plan.md` (a plan-coverage verdict) cited in
        // the doc's ## Plan verification section, or a DECLARED names why
        // the pass was n/a (single-unit, chat-scale). Self-attestation
        // isn't the check — the artifact is.
        const pvBody = h2SectionBody(pnf, "Plan verification");
        if (!pvBody) {
          pmissing.push("a `## Plan verification` section — the independent pass confirming the plan covers the universe before the walk (cite `.unlazy/eyes/<sid>-plan.md` or `DECLARED: plan-verify — <why>`)");
        } else if (!/DECLARED\s*:\s*plan-verify\s*(?:—|--|::| - )\s*\S{10,}/i.test(pvBody)) {
          const pvCite = pvBody.match(/\.unlazy\/eyes\/[\w.-]*plan[\w.-]*\.md/i);
          if (!pvCite) {
            pmissing.push("`## Plan verification` carries no eyes-plan artifact cite and no `DECLARED: plan-verify — <why>` — self-attestation isn't verification");
          } else if (!existsSync(join(ROOT, pvCite[0].replace(/\//g, sep)))) {
            pmissing.push("`## Plan verification` cites an eyes-plan artifact that doesn't exist on disk — a cite to nothing is a claim, not a deposit");
          }
        }
        // A2: ## Model (the understanding — rows carry derived:/inferred:)
        // and ## Dependencies (what each finding rests on).
        if (!/^##\s*Model\b/im.test(pnf)) {
          pmissing.push("a `## Model` section (the understanding, not the coverage — each row `derived:` or `inferred:`)");
        } else {
          // Header convention: the first `|` row of the section is the
          // table header — data rows follow it; bullets all count.
          const mAll = h2SectionBody(pnf, "Model").split(/\r?\n/).filter((l) => /^\s*(?:\||[-*•])\s*\S/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l));
          const mTbl = mAll.filter((l) => /^\s*\|/.test(l));
          const mRows = mAll.filter((l) => !/^\s*\|/.test(l)).concat(mTbl.slice(1));
          const unmarked = mRows.filter((l) => !/\b(?:derived|inferred)\s*:/i.test(l));
          if (!mRows.length && !/none\s*(?:—|--|::| - )\s*\S{15,}/i.test(pnf)) pmissing.push("`## Model` rows — each `derived:`/`inferred:`, or 'none — <why>'");
          else if (unmarked.length) pmissing.push(`${unmarked.length} ## Model row(s) without a derived:/inferred: marker`);
        }
        if (!/^##\s*Dependencies\b/im.test(pnf)) {
          pmissing.push("a `## Dependencies` section (what each finding rests on, or 'none — <why>')");
        }
        // A1: failure modes + prior art + an ordering note.
        const fmBody = h2SectionBody(pnf, "Failure modes");
        if (!fmBody || (fmBody.split(/\r?\n/).filter((l) => /^\s*(?:[-*•]|\||\d)/.test(l) && l.trim().length > 10).length < 2 && !/none\s*(?:—|--|::| - )\s*\S{15,}/i.test(fmBody))) {
          pmissing.push("`## Failure modes` needs ≥2 failure-mode lines (or 'none — <why>')");
        }
        const paBody = h2SectionBody(pnf, "Prior art");
        const paAll = paBody.split(/\r?\n/).filter((l) => /^\s*(?:\||[-*•])\s*\S/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l));
        const paData = paAll.filter((l) => !/^\s*\|/.test(l)).concat(paAll.filter((l) => /^\s*\|/.test(l)).slice(1));
        if (!paData.length && !/none\s*(?:—|--|::| - )\s*\S{15,}/i.test(paBody)) {
          pmissing.push("`## Prior art` needs ≥1 reconciliation row (or 'none — <why>')");
        }
        if (!/\b(?:order(?:ing|ed)?|risk(?:iest)?|first)\b/i.test(planBody)) {
          pmissing.push("an ordering note in `## Analysis plan` (which units run first and why)");
        }
        // A5: per-unit depth floor — an examination record, a result,
        // and a real sub-question per unit.
        if (unitBody) {
          let depthThin = 0;
          for (const part of unitBody.split(/^###\s+/m).slice(1)) {
            const examined = /\b(?:examin\w*|walk\w*|(?:re-)?read\w*|probe\w*|search\w*|trac\w*|test\w*|verif\w*|execut\w*)\b/i.test(part);
            const found = /\b(?:found|cleared\w*|disprov\w+|confirm\w+|refut\w+)\b/i.test(part);
            const subQ = /sub-question\s*:\s*\S[^\n]{9,}/i.test(part) || part.split(/\r?\n/).some((l) => {
              const s = l.trim();
              return s.includes("?") && s.replace(/[`*_>\-–|\s#]/g, "").length >= 15 && !vacuousQ.test(s);
            });
            if (!(examined && found && subQ)) depthThin++;
          }
          if (depthThin) pmissing.push(`${depthThin} ## Units ### section(s) lack the depth floor — examined-record + found/cleared result + a substantive sub-question (naming an element or decision)`);
        }
        // A8: the conduct record — each enumerated step ran or AXIS-NA'd.
        const STEPS = ["universe", "question-space", "unit-selection", "unit-walk", "widening", "drill", "rank", "synthesis", "falsification", "eyes"];
        const missSteps = STEPS.filter((s) => !new RegExp(`method\\s*:\\s*${s.replace(/-/g, "[-\\s]?")}\\s*(?:—|–|-|:)\\s*(?:ran\\b|AXIS-NA\\s*:)`, "i").test(pnf));
        if (missSteps.length) {
          pmissing.push(`method: rows missing for conduct steps ${missSteps.join(", ")} — \`method: <step> — ran\` or \`method: <step> — AXIS-NA: <why>\``);
        }
        // Corroboration: `ran` on mechanically-visible steps needs the
        // trail the transcript already carries (the runtime's copy).
        if (transcriptRaw) {
          const cc = transcriptCommands(transcriptRaw);
          const cmdText = Array.isArray(cc) ? cc.join("\n") : String(cc || "");
          // Tool names live in the raw call JSON; shell words scan commands
          // only — `\bfind\b` inside assistant prose is not a search trail.
          const searchTrail = /find_file_by_name|Get-ChildItem/i.test(transcriptRaw) ||
            /"grep"|\brg\b|\bgrep\b|\bfind\b|\bls\b/i.test(cmdText);
          const testTrail = /\bpytest\b|\bvitest\b|\bjest\b|node\s+\S*test/i.test(cmdText);
          const launches = [...transcriptSubagentLaunches(transcriptRaw)].length;
          const claimed = (step) => new RegExp(`method\\s*:\\s*${step}\\s*(?:—|–|-|:)\\s*ran\\b`, "i").test(pnf);
          const unCorr = [];
          if (claimed("universe") && !searchTrail) unCorr.push("universe-enumeration (no search/glob trail)");
          if (claimed("falsification") && !searchTrail && !testTrail) unCorr.push("falsification (no search/test trail)");
          if (claimed("eyes") && !launches) unCorr.push("eyes-sequencing (no subagent launch recorded)");
          if (unCorr.length) pmissing.push(`method rows claim 'ran' without transcript corroboration: ${unCorr.join("; ")}`);
        }
        // Timing: method rows appearing only in the final write are the
        // attestation signature (tracker records per-write counts).
        // Recorded keys are absolute for non-app/ paths and relative for
        // app/ touches (tracker repoRel) — try both rather than assume.
        const mhist = state.analysis_method_hist || {};
        const mh = mhist[p] || mhist[relPath(p)] || [];
        if (mh.length >= 2 && mh.slice(0, -1).every((e) => !e.c) && mh[mh.length - 1].c > 0) {
          pmissing.push("method: rows all appeared in the final write — attestation signature (rows accrue during the walk)");
        }
        // Mandated plan inside the analysis (the analysis+plan mandate,
        // user's depth ask): the plan lives in the analysis file, is
        // extensive (per-item rows × approach/risk/verify cells), and each
        // part is reviewed before completion across the five lenses —
        // missing / issues / improve / nice-to-add / user-want. `## Drill`
        // enumerates nested units discovered mid-work — the modal's
        // second page gets the same depth, not a footnote.
        const implPlanBody = h2SectionBody(pnf, "Implementation plan");
        const planItems = [];
        if (!implPlanBody) {
          pmissing.push("an `## Implementation plan` section — the extensive plan lives inside the analysis file (per-item rows with approach + risk + verify cells)");
        } else {
          const pRows = implPlanBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l));
          const pData = pRows.slice(1);
          let thinPlan = 0;
          for (const row of pData) {
            const cells = row.split("|").slice(1, -1).map((c) => c.trim());
            if (cells.length < 4 || cells.filter((c) => c.length >= 8).length < 4) { thinPlan++; continue; }
            if (cells[0]) planItems.push(cells[0]);
          }
          if (!pData.length || (pData.length < 3 && !/DECLARED\s*:\s*single[-\s]?item/i.test(implPlanBody))) {
            pmissing.push(`\`## Implementation plan\` has ${pData.length} data row(s) — an extensive plan enumerates ≥3 items (or \`DECLARED: single-item — <why>\`)`);
          }
          // A11: the plan-protocol handoff — an implementation plan that
          // produces work declares which cycle floor it enters. The
          // `scope: <class>` line keys it to the same floors the
          // iteration record enforces (fix 1 / surface 5 / page 6 /
          // subsystem 10 / product 12) and the BATCH-PLAN quartet arms
          // at the first impl writes — analysis → plan → cycles is one
          // protocol, not three documents.
          if (pData.length && !/scope\s*[::—–-]\s*(fix|surface|page|subsystem|product)\b/i.test(implPlanBody)) {
            pmissing.push("a `scope: <class>` line in `## Implementation plan` — the plan declares which cycle floor the work enters (fix|surface|page|subsystem|product)");
          }
          if (thinPlan) pmissing.push(`${thinPlan} ## Implementation plan row(s) under-filled — each item needs approach + risk + verify cells (≥8 chars each)`);
        }
        const prBody = h2SectionBody(pnf, "Plan review");
        if (!prBody) {
          pmissing.push("a `## Plan review` section — each plan part analyzed for missing / issues / improve / nice-to-add / user-want before completion");
        } else {
          const prRows = prBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l));
          const prData = prRows.slice(1);
          const reviewed = prData.map((r) => (r.split("|")[1] || "").trim().toLowerCase());
          const unreviewed = planItems.filter((it) => it && !reviewed.some((r) => r && (r.includes(it.toLowerCase()) || it.toLowerCase().includes(r))));
          if (planItems.length && unreviewed.length) {
            pmissing.push(`## Plan review covers ${planItems.length - unreviewed.length}/${planItems.length} plan items — unreviewed: ${unreviewed.slice(0, 4).join(", ")}`);
          }
          let thinReview = 0;
          for (const row of prData) {
            const cells = row.split("|").slice(1, -1).map((c) => c.trim());
            const lens = cells.slice(1);
            const okLens = lens.length >= 5 && lens.every((c) => c && (c.length >= 6 || /none\s*(?:—|--|::|-)\s*\S{12,}/i.test(c)));
            if (!okLens) thinReview++;
          }
          if (thinReview) pmissing.push(`${thinReview} ## Plan review row(s) with empty/vacuous lens cells — each of the five lenses carries content or 'none — <why ≥12 chars>'`);
        }
        const drBody = h2SectionBody(pnf, "Drill");
        if (!drBody) {
          pmissing.push("a `## Drill` section — nested units discovered during the work each get an examination or a disposition (the modal's second page gets the same depth)");
        } else {
          const dRows = drBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l));
          const dData = dRows.slice(1);
          if (!dData.length && !/none\s*(?:—|--|::|-)\s*\S{15,}/i.test(drBody)) {
            pmissing.push("`## Drill` needs ≥1 row or 'none — <why ≥15 chars>' — nested surfaces enumerated or the absence earned");
          } else {
            const unitSet = new Set(unitIds);
            const badDrill = dData.filter((row) => {
              const cells = row.split("|").slice(1, -1).map((c) => c.trim());
              const dispo = cells[cells.length - 1] || "";
              const um = dispo.match(/\bU\d+\b/i);
              if (um && !unitSet.has(um[0].toUpperCase())) return true;
              return !/\b(?:analy|examin|unit|declared\s*:|open|filed|blocked|carried|n\/a|part\s+of)/i.test(dispo);
            });
            if (badDrill.length) pmissing.push(`${badDrill.length} ## Drill row(s) with unresolved disposition — 'analyzed — U<N>' needs the unit to exist, else DECLARED:/OPEN`);
          }
        }
        // A10: second-pass floor — one pass per element is coverage; the
        // second pass is verification. Findings >0 or a universe >8 rows
        // owes a `## Second pass` (or `## Re-verification`) section: each
        // finding re-examined with NEW evidence (re-verified/confirmed/
        // cleared — not re-cited), or a DECLARED row. DECLARED:
        // second-pass — <why> exempts genuinely single-pass subjects.
        {
          const foundLines = (pnf.match(/^\s*found\s*:/gim) || []).length;
          const findingsSec = h2SectionBody(pnf, "Findings") || "";
          const findingRows = foundLines + Math.max(0, findingsSec.split(/\r?\n/).filter((l) => /^\s*\|/.test(l)).length - 1);
          const spBody = h2SectionBody(pnf, "Second pass") || h2SectionBody(pnf, "Re-verification") || "";
          const spDecl = /DECLARED\s*:\s*second[-\s]?pass\s*(?:—|--|::| - )\s*\S{10,}/i.test(pnf);
          if ((uniRows > 8 || findingRows > 0) && !spDecl) {
            if (!spBody) {
              pmissing.push(`a \`## Second pass\` (or \`## Re-verification\`) section — ${findingRows > 0 ? `${findingRows} finding(s)` : `${uniRows} universe rows`} owe a re-verification pass (each re-examined with new evidence — re-verified/confirmed/cleared — or a DECLARED row; \`DECLARED: second-pass — <why>\` exempts a genuinely single-pass subject)`);
            } else if (!/\b(re-?verif|re-?examin|confirm\w*|cleared|re-?check|re-?walk|DECLARED)\b/i.test(spBody)) {
              pmissing.push("`## Second pass` exists but carries no re-examination vocabulary — re-verify with NEW evidence, don't re-cite the first pass");
            }
          }
        }
      }
      const syn = h2SectionBody(pnf, "Synthesis");
      // A7: a present-but-empty synthesis is not a synthesis.
      if (v2 && /^##\s*Synthesis\b/im.test(pnf) && syn.trim().length < 30) {
        pmissing.push("an empty `## Synthesis` — the committed verdict section exists but carries nothing");
      }
      if (syn && !/\b(rank|most\s+significant|highest|priorit|alternative|weighed|mechanism|falsif|would\s+change)\b/i.test(syn)) {
        pmissing.push("committed synthesis inside ## Synthesis (v2 — findings ranked, mechanism named apart from symptoms, ≥1 alternative weighed)");
      }
      // AQ-F5: the Denial section is the audit-ledger's red-team contract
      // — an analysis doc that never attempted to disprove its own
      // coverage is a report, not an examination. One bullet minimum, or
      // an explicit DECLARED: denial — <why> line.
      const denialBody = h2SectionBody(pnf, "Denial");
      const denialBullets = denialBody.split(/\r?\n/).filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l));
      if (!denialBullets.length && !/DECLARED:\s*denial\s*(?:—|--|::| - )\s*.{10,}/i.test(pnf)) {
        pmissing.push("a `## Denial` section with ≥1 red-team bullet (the self-disproof half — or `DECLARED: denial — <why>`)");
      }
      // Denial content (autopsy U8-2): same contract as the audit-ledger
      // — every bullet shows what was tried against the claim or carries
      // an explicit marker; a bare verdict in ## Denial is the costume.
      const dAtt = /\b(?:attempt\w*|tried|search\w*|re-deriv\w*|falsif\w*|disprov\w*|re-?read|verif\w*|test\w*|examin\w*|walked|recomput\w*|prob\w*|check\w*|found|cleared)\b|DECLARED:|ACCEPTED:|BLOCKED:|ROUTED:|PROPOSED:/i;
      const dNoAttempt = denialBullets.filter((l) => !dAtt.test(l));
      if (dNoAttempt.length) {
        pmissing.push(`Denial bullet(s) without an attempt record (${dNoAttempt.length} — e.g. "${dNoAttempt[0].trim().slice(0, 70)}") — the bullet names what was TRIED against the claim, not a bare verdict`);
      }
    } else {
      console.error(`[stop-gate] note: ${p} is analysis-project v1 — new analysis docs use <!-- analysis-project v2 --> (subject-job line + committed synthesis inside ## Synthesis). v1 still parses.`);
    }
    const unitsM = pnf.match(/^\s*UNITS\s*:\s*(\d+)\s*\/\s*(\d+)\s*$/im);
    if (!unitsM) {
      pmissing.push("a `UNITS: x/y` line — the project's own coverage reconcile (computed, not narrated)");
    } else if (+unitsM[1] !== +unitsM[2] || +unitsM[2] !== (unitSecs.length || uniRows)) {
      pmissing.push(`UNITS: ${unitsM[1]}/${unitsM[2]} doesn't reconcile (### sections: ${unitSecs.length}, universe rows: ${uniRows})`);
    }
    if (pmissing.length) {
      failures.push(
        `ANALYSIS-PROJECT: ${p} carries the analysis-project marker but is missing/malformed: ${pmissing.join("; ")} ` +
        `(15-analysis-depth → the analysis project). The marker claims a worked examination — the schema verifies the coverage.`
      );
    }
  }

  // --- iteration-loop ----------------------------------------------------
  tick("iteration-loop");
  // Post-implementation analysis rounds (16-iteration-loop.mdc): every
  // implementation write arms the loop. The artifact carries the scope +
  // budget declaration at plan time, then one ## Round N per walk —
  // analysis plan → L-axis traversal → findings → applied — ending in a
  // legal terminator with no OPEN findings. The traversal axis count is
  // the mechanical-walking check: a walk that doesn't enumerate the axes
  // is suspicion-driven, which is the failure this loop exists to kill.
  // Gate-state is agent-writable — so the loop arm corroborates against the
  // runtime transcript when present: edit/write tool calls visible there
  // arm the loop even if the state file was edited or deleted (B3). The
  // state file records; the transcript is the runtime's copy — a hand-edited
  // state can't un-write the transcript.
  const transcriptImpl = new Set();
  if (transcriptRaw) {
    // transcriptImpl must classify exactly like the arm —
    // IMPL_RE_G && !IMPL_EXCL_G mirrors armClassifiedPath (R14-F18's
    // first fix added an ARM_SKIP_G covering design-review/design-spec/
    // gate-evidence — but the tracker DOES record those into
    // impl_touched, so the skip blinded the hidden-write check to the
    // forgery it exists to catch; R15 own-walk).
    for (const fp of transcriptWritePaths(transcriptRaw)) {
      if ((IMPL_RE_G.test(fp) && !IMPL_EXCL_G.test(fp)) || WRITE_MARKER_RE.test(fp)) transcriptImpl.add(fp);
    }
  }
  const stateImpl = state.impl_touched || [];
  const implTouched = [...new Set([...stateImpl, ...transcriptImpl])];
  const stateSaysImpl = stateImpl.length > 0;
  const transcriptSaysImpl = transcriptImpl.size > 0;
  // Rendered subjects carry the stricter v2 quality bar — the shipped-
  // product critique only makes sense against something a user sees.
  const uiSubject = implTouched.some((p) =>
    /\.(html|j2|css|scss|less|vue|svelte|jsx|tsx)$/i.test(p) ||
    /(^|[\\/])ui(_staff)?[\\/]/i.test(p));
  if (implTouched.length && !exempt("LOOP", "*")) {
    if (transcriptSaysImpl && !stateSaysImpl) {
      failures.push(
        `GATE-STATE: the transcript shows ${transcriptImpl.size} implementation write(s) ` +
        `(${[...transcriptImpl].slice(0, 2).join(", ")}${transcriptImpl.size > 2 ? "…" : ""}) but the gate-state ` +
        `records none — the state file was edited, deleted, or never written. The transcript corroborates what ` +
        `state can't un-say; the loop proceeds on the transcript record. Re-run the session's work honestly.`
      );
    } else if (transcriptSaysImpl && stateSaysImpl) {
      // Trimmed-but-nonempty state: impl_touched:["one.js"] forged to hide
      // four transcript-visible writes passed the binary check (R12-F21).
      // Normalize to the repo-anchored suffix — transcript tokens are
      // relative/absolute mixes while state is relPath'd.
      const normP = (p) => {
        const s = String(p).replace(/\\/g, "/");
        for (const a of ["app/", "legacy/", ".devin/", ".unlazy/"]) { const i = s.indexOf(a); if (i >= 0) return s.slice(i); }
        return s;
      };
      const stateNorm = stateImpl.map(normP);
      const hidden = [...transcriptImpl].filter((p) => {
        const n = normP(p);
        return !stateNorm.some((sn) => sn === n || sn.endsWith("/" + n) || n.endsWith("/" + sn));
      });
      if (hidden.length >= 1) {
        failures.push(
          `GATE-STATE: ${hidden.length} transcript-visible implementation write(s) are absent from ` +
          `state.impl_touched (${hidden.slice(0, 2).join(", ")}${hidden.length > 2 ? "…" : ""}) — the state file ` +
          `was trimmed to hide work while staying plausible. The transcript corroborates what state can't un-say.`
        );
      }
    }
    const iterPath = join(ROOT, ".unlazy", "iteration", `${sid}.md`);
    const iterRel = artifactFor(`.unlazy/iteration/${sid}.md`);
    if (!existsSync(iterPath)) {
      failures.push(
        `ITERATION-LOOP: implementation written (${implTouched.slice(0, 3).join(", ")}${implTouched.length > 3 ? ` +${implTouched.length - 3} more` : ""}) ` +
        `with no loop record at ${iterRel}. Write it: <!-- iteration-loop v2 --> + Scope: fix|surface|page|subsystem|product + ` +
        `Scope basis: + Budget: N + ## Round N sections (analysis plan → L1–L14 traversal → findings → applied) + ` +
        `ENDED: clean-walk|budget-met|fix-scope|redirected. Scope 'fix' still owes the declaration ` +
        `(16-iteration-loop.mdc). Or EXEMPT-LOOP: * — <reason> in ${evidenceRel}.`
      );
    } else {
      const itext = (readText(iterPath) || "").replace(/^﻿/, "");
      const itext_nf = fenceStrip(itext);
      const missing = [];
      // Schema version: v2 adds the depth machinery — findings class
      // column, L13 delta / L14 embarrassment axes, counted universals,
      // quality-axis eyes hand-off, eyes-v2 two-phase protocol,
      // DEFENDED-aware clean-walk, external exit-review evidence. v1
      // artifacts still parse (upgrade path is a note, not a block).
      const iterV2 = hasMarker(itext_nf, "iteration-loop v2");
      if (!iterV2 && !hasMarker(itext_nf, "iteration-loop v1")) missing.push("the schema marker (`<!-- iteration-loop v2 -->` for new work; v1 still parses)");
      if (!iterV2 && hasMarker(itext_nf, "iteration-loop v1")) {
        console.error(
          `stop-gate note: ${iterRel} uses the v1 loop schema — v2 adds the depth machinery (findings class column, ` +
          `L13 delta / L14 embarrassment axes, counted universals, quality-axis eyes hand-off, eyes-v2 two-phase ` +
          `protocol, DEFENDED-aware clean-walk, external exit-review evidence). Upgrade: switch the marker to ` +
          `<!-- iteration-loop v2 --> and add the v2 pieces (16-iteration-loop.mdc).`
        );
      }
      const scopeM = itext_nf.match(/^\s*Scope:\s*(fix|surface|page|subsystem|product)\s*(?:[-–—←(][^\n]*)?$/im);
      if (!scopeM) missing.push("`Scope: fix|surface|page|subsystem|product`");
      // Spec ## Surfaces names — the per-surface floor cite pool for
      // product-scope rounds (L6/L9/L14 name what they swept).
      const specSurfNames = (() => {
        try {
          const sp = join(ROOT, artifactFor(`.unlazy/design-spec/${sid}.md`));
          if (!existsSync(sp)) return [];
          const sb = sectionBody(fenceStrip(readText(sp) || ""), "surfaces") || "";
          const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
          return sb.split(/\r?\n/)
            .filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/\|\s*surface\b/i.test(l))
            .map((l) => (l.split("|")[1] || "").trim().replace(/\.(html?|j2)$/i, ""))
            .filter((s) => s.length >= 3 && !/^surface$/i.test(s));
        } catch { return []; }
      })();
      if (!/^\s*Scope basis:\s*\S/im.test(itext_nf)) missing.push("`Scope basis:` (why this class)");
      const budgetM = itext_nf.match(/^\s*Budget:\s*(\d+)\s*(?:[-–—←(][^\n]*)?$/im);
      if (!budgetM) missing.push("`Budget: <N>`");
      // D1/D3 — recursion depth. `## Depth` carries `depth: N` (parent+1)
      // and a per-level ledger when N>1 (level | surface/component |
      // spec-doc | loop-artifact | state). Deeper than level 1 also owes
      // `## Return` — the traversal-back pass: integration seams /
      // coherence / parent-level completeness / second expansion
      // question. `none — <why ≥30 chars>` is auditable; ≥2 of the 4
      // rows must carry real content (all-none is a summary, not a
      // return pass).
      {
        const depBody = sectionBody(itext_nf, "depth") || "";
        const dm = depBody.match(/\bdepth\s*:\s*(\d+)/i);
        const depthN = dm ? parseInt(dm[1], 10) : 1;
        if (depBody && (!dm || depthN < 1)) missing.push("a `depth: N` line inside ## Depth (the recursion level this loop sits at — parent+1)");
        if (depthN > 1) {
          const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
          const depRows = depBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/\|\s*level\s*\|/i.test(l));
          if (depRows.length < depthN) missing.push(`## Depth shows ${depthN} but only ${depRows.length} ledger row(s) — a level-${depthN} loop ledgers every level traversed (level | surface/component | spec-doc | loop-artifact | state)`);
          const retB = sectionBody(itext_nf, "return") || "";
          if (!retB) {
            missing.push("a `## Return` section (the traversal-back pass — depth >1 means a parent level exists to re-check: integration seams / coherence / parent-level completeness / second expansion question)");
          } else {
            const retNames = ["integration seams", "coherence", "parent-level completeness", "second expansion question"];
            let retContent = 0;
            for (const rn of retNames) {
              const rnM = retB.match(new RegExp(`${rn.replace(/\s/g, "[-\\s]")}\\s*:\\s*([^\\n]*)`, "i"));
              if (!rnM) { missing.push(`## Return missing the '${rn}' row`); continue; }
              const cell = (rnM[1] || "").trim();
              if (/^none\s*(?:—|--|::| - )\s*/i.test(cell)) {
                if (cell.replace(/^none\s*(?:—|--|::| - )\s*/i, "").length < 30) missing.push(`## Return '${rn}' is bare none — the why needs ≥30 chars`);
              } else if (cell.length >= 10) retContent++;
            }
            if (retContent < 2) missing.push(`## Return carries content in ${retContent}/4 rows — ≥2 of the 4 named rows must carry real content (all-none is a summary, not a traversal-back pass)`);
          }
        }
      }
      // ENDED matching uses the LAST occurrence — an earlier stale ENDED
      // can't shadow the real terminator.
      const endedAll = [...itext_nf.matchAll(/^\s*ENDED\s*:\s*([^\n]*)/gim)];
      const endedM = endedAll.length ? { 1: (endedAll[endedAll.length - 1][1] || "").trim(), index: endedAll[endedAll.length - 1].index } : null;
      const endedKind = endedM ? endedM[1].toLowerCase() : null;
      const endedLegal = endedKind && /^(clean-walk|budget-met|fix-scope|redirected)\b/.test(endedKind) ? endedKind.match(/^(clean-walk|budget-met|fix-scope|redirected)\b/)[1] : null;
      if (endedM && !endedLegal) {
        missing.push(`\`ENDED: ${endedKind.slice(0, 40)}\` isn't a legal terminator — use clean-walk|budget-met|fix-scope|redirected — <target>`);
      } else if (!endedM) {
        missing.push("an `ENDED: clean-walk|budget-met|fix-scope|redirected` terminator");
      }
      // `redirected` must name where — an untargeted redirect is a word,
      // not a destination (fidelity to the user's words is attestation).
      if (endedLegal === "redirected") {
        const line = itext_nf.slice(endedM.index, itext_nf.indexOf("\n", endedM.index) < 0 ? undefined : itext_nf.indexOf("\n", endedM.index));
        if (!/[—-]{1,2}\s*\S/.test(line)) {
          missing.push("`ENDED: redirected` requires ` — <what the user pointed at>` — a terminator that names no target is not a redirect");
        } else if (transcriptRaw) {
          // Best-effort verification: the redirect asserts a user act — the
          // target text should appear in a user message when we have one.
          // Slice BEFORE escaping (an escape pair straddling the slice
          // boundary produced a trailing lone backslash → SyntaxError →
          // fail-open) and wrap regardless — a crafted line must never
          // take the whole gate down.
          const target = (line.replace(/^.*?redirected\s*/i, "").replace(/^[—-]{1,2}\s*/, "").replace(/`/g, "").trim().slice(0, 60));
          try {
            // A redirect is the USER'S act — the target must appear in user
            // text, not anywhere in the transcript (the writer's own words
            // would corroborate a self-invented destination).
            const userBlob = userTexts.join("\n");
            // Overlap, not a 30-char prefix — `redirected — <user's
            // first 30 chars><invented tail>` passed before. Most of the
            // target's content words must come from the user's mouth.
            const tWords = contentWords(target);
            const uWords = contentWords(userBlob);
            const overlap = [...tWords].filter((w) => uWords.has(w)).length;
            // A terse target fully covered by the user's own words is a
            // real redirect — the size floor flagged `redirected — the
            // sidebar` even when the user said exactly that (R14-F25).
            if (tWords.size === 0 || overlap / tWords.size < 0.6) {
              missing.push(`\`ENDED: redirected — ${target.slice(0, 40)}\` names a target no user message contains — a redirect is the user's act, verifiable against the transcript`);
            }
          } catch {
            missing.push("`ENDED: redirected` target couldn't be transcript-verified — name the target plainly so the redirect is auditable");
          }
        }
      }
      const roundsM = itext_nf.match(/^\s*Rounds:\s*(\d+)\s*\/\s*(\d+)\s*(?:[-–—←(][^\n]*)?$/im);
      if (!roundsM) missing.push("a `Rounds: M/N` line");
      // A terminator written before later implementation is stale: impl
      // writes postdating the artifact were never traversed — the loop
      // can't end on work it never walked. `ended_seen` (the tracker's
      // content-signature stamp) is the primary clock — a whitespace touch
      // can't fake freshness; mtime is the pre-tracker fallback.
      if (endedLegal && state.last_impl_at) {
        try {
          const endedSeen = state.ended_seen ? Date.parse(state.ended_seen) : NaN;
          const mtime = statSync(iterPath).mtimeMs;
          const lastImpl = Date.parse(state.last_impl_at);
          // NaN comparisons are false — an unparseable timestamp would
          // silently disarm the check, so corrupted fields flag instead.
          if (state.ended_seen && Number.isNaN(endedSeen)) {
            missing.push(`state.ended_seen (${String(state.ended_seen).slice(0, 30)}) isn't a parseable timestamp — a corrupted staleness stamp can't vouch for the terminator`);
          } else if (Number.isNaN(lastImpl)) {
            missing.push("state.last_impl_at isn't a parseable timestamp — the staleness clock can't run on a corrupted field");
          } else if ((endedSeen && endedSeen < lastImpl) || (!state.ended_seen && mtime < lastImpl)) {
            missing.push(`ENDED: ${endedLegal} declared but implementation writes postdate it (last impl ${state.last_impl_at}${state.ended_seen ? `, ENDED content last seen ${state.ended_seen}` : ""}) — the newest changes were never traversed; run another round`);
          }
        } catch { /* mtime check best-effort */ }
      }

      const scope = scopeM ? scopeM[1].toLowerCase() : null;
      const budget = budgetM ? +budgetM[1] : null;
      const terminator = endedLegal;
      // Scope floors (user scale): small 1-2, medium ~5, large ~10,
      // projects >=12. The floor binds the WALK, not just the declared
      // Budget number — see ROUNDS-FLOOR below.
      const FLOOR = { fix: 1, surface: 5, page: 6, subsystem: 10, product: 12 };
      const roundHeads = [...itext_nf.matchAll(/^##\s*Round\s+(\d+)(?!\.\d)\b/gim)].map((m) => +m[1]);
      const roundsRun = roundHeads.length;
      if (roundHeads.length && !roundHeads.every((v, i) => v === i + 1)) {
        missing.push(`## Round numbers aren't contiguous 1..N (${roundHeads.join(", ")}) — a skipped round is a skipped walk`);
      }
      // RE-FRESH (16-iteration-loop → rule refresh): every round past the
      // first re-reads the rules in force before traversing and stamps the
      // list — the re-read is the point; the stamp is the audit.
      for (let rn = 2; rn <= roundsRun; rn++) {
        const rm = itext_nf.match(new RegExp(`^##\\s*Round\\s+${rn}\\b[^\\n]*$`, "im"));
        if (!rm) continue;
        const rRest = itext_nf.slice(rm.index + rm[0].length);
        const rNext = rRest.search(/^##\s/m);
        const rBody = (rNext < 0 ? rRest : rRest.slice(0, rNext));
        if (!/^\s*RE-FRESH\s*:\s*\S.{4,}/im.test(rBody)) {
          missing.push(`## Round ${rn} carries no \`RE-FRESH:\` line — every round past the first re-reads the rules in force before traversing (16-iteration-loop → rule refresh)`);
        }
      }
      // Round bodies hold ### subsections, so they must slice at ## only —
      // sectionBody stops at any heading level and would return the pre-
      // subsection intro. h2Body keeps ### content inside its round.
      const h2Body = (name) => {
        const m = itext_nf.match(new RegExp(`^##\\s*${String(name).replace(/\s+/g, "\\s+")}\\b[^\\n]*$`, "im"));
        if (!m) return "";
        const rest = itext_nf.slice(m.index + m[0].length);
        const next = rest.search(/^##\s/m);
        return (next < 0 ? rest : rest.slice(0, next)).trim();
      };

      if (scope != null && budget != null && budget < FLOOR[scope]) {
        missing.push(`Budget: ${budget} under the ${scope} floor (${FLOOR[scope]}) — the class sets the floor, not effort`);
      }
      // fix-scope is auditable by file count: 15+ implementation files is
      // not a fix, it is an undeclared bigger class (the gaming check the
      // basis line alone cannot provide).
      // Write markers (`git-write:*`, `delete:*`, …) name ops, not files —
      // a `git checkout`-heavy fix isn't a build (R13-F14).
      const implFileCount = implTouched.filter((p) => !WRITE_MARKER_RE.test(p)).length;
      if (scope === "fix" && implFileCount > 15) {
        missing.push(`Scope: fix but ${implFileCount} implementation files were touched — a fix is a named repair, not a build; reclassify`);
      }
      // IQ-F1: the fix terminator is self-declared — a `Scope: fix` +
      // `ENDED: fix-scope` pair that never touched an implementation
      // file is a repair with no repair. Zero impl writes is legal only
      // when the round's finding was "nothing to change" — which needs
      // the round's own words saying so.
      if (scope === "fix" && terminator === "fix-scope" && implFileCount === 0 &&
          !/no\s+(?:code\s+)?change|nothing\s+to\s+(?:fix|change|edit)|already\s+(?:correct|fixed|right)|no\s+edit\s+needed/i.test(itext_nf)) {
        missing.push("`Scope: fix` + `ENDED: fix-scope` but zero implementation files touched and no round line says there was nothing to change — a self-declared repair with no repair");
      }
      // Fix-depth basis (proposal): a fix terminator needs its basis —
      // `Scope basis:` naming what the repair covered (≥60 chars) or the
      // repair itself on ≥2 files. A 1-file fix with no basis line is a
      // label, not a declared repair.
      if (scope === "fix" && terminator === "fix-scope" && implFileCount >= 1 && implFileCount <= 1 &&
          !/scope\s+basis\s*:\s*\S.{55,}/i.test(itext_nf)) {
        missing.push("`Scope: fix` + `ENDED: fix-scope` on a single implementation file with no `Scope basis:` (≥60 chars naming what the repair covered) — the fix needs its basis, not just its terminator");
      }
      // ROUNDS-FLOOR: the floor binds the walk itself. Ending below the
      // scope floor means the walk never ran its class's traversal — a
      // clean-walk after 1 round on a product scope is a misdeclared
      // scope or a skipped obligation, not a clean result. Exits:
      // `ENDED: redirected` (the user's act — verifiable against the
      // transcript) and a `Scope: fix` that genuinely changed nothing
      // (implFileCount 0 + the no-change vocabulary the earlier check
      // already demands). Everything else walks the floor.
      if (scope != null && FLOOR[scope] > 0 && roundsRun < FLOOR[scope] &&
          terminator && terminator !== "redirected" &&
          !(scope === "fix" && implFileCount === 0)) {
        missing.push(`ROUNDS-FLOOR: ${roundsRun} round(s) walked under \`Scope: ${scope}\` (floor ${FLOOR[scope]}) — the scope class sets the minimum traversal, not the budget you declared. Either run the remaining rounds, downgrade the scope with a defensible \`Scope basis:\`, or end on a real user redirect`);
      }
      // Convergence bound: past 2× the scope FLOOR, the loop must end —
      // file the rest to a tracker or USER-GATE. The cap keys to the class
      // floor, not the declared budget — an inflated Budget can't buy
      // residence. Evidenced nits can always be found.
      if (scope != null && FLOOR[scope] > 0 && roundsRun > FLOOR[scope] * 2 && terminator !== "redirected") {
        missing.push(`${roundsRun} rounds exceeds the 2× cap for scope ${scope} (floor ${FLOOR[scope]} → cap ${FLOOR[scope] * 2}) — file the remaining findings to a tracker and end, or STOP: USER-GATE`);
      }
      if (roundsM && (+roundsM[1] !== roundsRun || (budget != null && +roundsM[2] !== budget))) {
        missing.push(`Rounds: ${roundsM[1]}/${roundsM[2]} disagrees with the artifact (${roundsRun} ## Round sections, Budget: ${budget})`);
      }
      // 0-round legality: fix-scope declaration or a user redirect only.
      if (roundsRun === 0 && terminator !== "fix-scope" && terminator !== "redirected") {
        missing.push("at least one `## Round N` section — a loop with no traversal never walked");
      }
      if (terminator === "fix-scope" && scope !== "fix") {
        missing.push("`ENDED: fix-scope` requires `Scope: fix` — a bigger class can't exit on the fix terminator");
      }
      if (terminator === "budget-met" && (budget == null || budget <= 0 || roundsRun < budget)) {
        missing.push(`ENDED: budget-met but only ${roundsRun}/${budget == null ? "?" : budget} rounds ran${budget != null && budget <= 0 ? " — Budget: 0 can't meet itself; use fix-scope or clean-walk" : ""}`);
      }
      // IQ-F2: round-one eyes — the first walk sets the frame every
      // later round inherits, so it earns a stranger look (or an
      // explicit DECLARED naming why it can't). An eyes artifact cite,
      // an eyes/stranger line inside the artifact, or a DECLARED:
      // r1-eyes — <why> all satisfy; a silent round 1 doesn't.
      if (roundsRun >= 1 && scope !== "fix") {
        const r1Ok = /\.unlazy\/eyes\/[\w.-]+\.md/i.test(itext_nf) ||
          /\b(?:stranger|fresh[-\s]?eyes|independent\s+eyes)\b/i.test(itext_nf) ||
          /DECLARED:\s*r1[-\s]?eyes\s*(?:—|--|::| - )\s*.{10,}/i.test(itext_nf);
        if (!r1Ok) {
          missing.push("a round-one eyes cite (.unlazy/eyes/<file>, a stranger/fresh-eyes line, or `DECLARED: r1-eyes — <why>`) — the first walk sets the frame later rounds inherit");
        }
      }
      // Interleave data (used by the eyes scoping AND the interleave
      // check below): rounds present at the tracker's first observation
      // are the legacy baseline — their timing predates the machinery;
      // rounds first-seen later must show impl between consecutive
      // first-seen times.
      const roundSeen = state.round_seen || {};
      // Forgery sanity (F10-partial): a first-seen stamp later than the
      // file's own last write is impossible — the tracker stamps AFTER
      // observing content. Forged round_seen/ended/exit stamps trip this
      // without needing the transcript at all.
      try {
        const artMtime = statSync(iterPath).mtimeMs;
        for (const [rn, ts] of Object.entries(roundSeen)) {
          if (Date.parse(ts) > artMtime + 5000) {
            missing.push(`round_seen[${rn}] (${String(ts).slice(0, 24)}) postdates the artifact's own mtime — a stamped observation can't precede the write it observed (GATE-STATE tamper)`);
          }
        }
        for (const [fname, ts] of [["ended_seen", state.ended_seen], ["exit_review_seen", state.exit_review_seen]]) {
          if (ts && Date.parse(ts) > artMtime + 5000) {
            missing.push(`state.${fname} (${String(ts).slice(0, 24)}) postdates the artifact's own mtime — the stamp claims an observation before any write existed (GATE-STATE tamper)`);
          }
        }
      } catch { /* mtime stat best-effort */ }
      // Grandfathered sessions (state file predates the temporal machinery)
      // may hold genuinely pre-machinery rounds — baseline honors them.
      // Epoch sessions get NO baseline. The baseline claim is checked
      // against the observation signature too, not just the flag: the
      // tracker stamps every first-observed round with ONE identical
      // timestamp, so a baseline whose rounds carry differing first-seen
      // times — or that isn't a subset of round_seen — is a hand-fake, not
      // a migration.
      const claimedBaseline = state.loop_grandfathered ? (state.baseline_rounds || []) : [];
      const baselineTimes = new Set(claimedBaseline.map((n) => roundSeen[n]).filter(Boolean));
      const earliestSeen = Object.values(roundSeen).sort()[0];
      const baselineIntact =
        claimedBaseline.length > 0 &&
        claimedBaseline.every((n) => roundSeen[n]) &&
        baselineTimes.size === 1 &&
        baselineTimes.has(earliestSeen);
      const baseline = new Set(baselineIntact ? claimedBaseline : []);
      if (claimedBaseline.length && !baselineIntact) {
        missing.push("`baseline_rounds`/`loop_grandfathered` disagree with `round_seen` (baseline rounds need the shared first-observation timestamp) — state was hand-edited or corrupted; the baseline is refused");
      }
      const implLog = state.impl_log || [];

      // Per-round anatomy.
      const seenEvidence = new Map(); // (axis, evidence cell) → first round — cross-round novelty (H3)
      const allFindIds = new Set();   // finding ids seen in ### Findings sections only — applied cites must live here
      const cleanRounds = new Set();  // rounds whose findings carried no fix-requiring rows — clean-walk needs two
      const roundNonNA = new Map();   // round → non-AXIS-NA axis row count — clean-walk needs the final walk walked
      const HARD_REF = /\bverify:|\bcomputed\b|\bprobe\b|\bshots?\b|\brender(?:ed|s)?\b|\bscreenshot\b|\bstdout\b|\bstderr\b|\bexit\s+\d|\bconsole\b/i;
      // `|` inside a backticked cell span is content, not a separator —
      // protect it before splitting so cells don't corrupt. Shared by
      // traversal, findings, applied, and exit-review verdict rows.
      const cellsOf = (l) => l.replace(/`[^`]*`/g, (m) => m.replace(/\|/g, "¦")).split("|").map((x) => x.trim().replace(/¦/g, "|")).filter(Boolean);
      for (const n of roundHeads) {
        const rbody = h2Body(`Round\\s+${n}`);
        for (const sub of ["Analysis plan", "Traversal", "Findings", "Applied"]) {
          const sbody = sectionBody(rbody, sub);
          if (!sbody) missing.push(`Round ${n}: content inside ### ${sub} (a bare heading is not the section)`);
        }
        // PLAN-DEPTH: the Analysis plan is the round's search strategy,
        // not a heading restatement — presence alone passed "walk the
        // axes" as a plan. Three floors: (a) it names the universe it is
        // hunting (mechanical source or declared judgment — `universe`,
        // `enumerate`, a glob/route/DOM source, or DECLARED), (b) it says
        // what it expects to find — hypothesis vocabulary — and (c) it
        // names what evidence each axis row will produce. Rounds >=2 also
        // owe the hunt's progression: a new/deepened hypothesis or
        // universe, not a copy of round 1's plan.
        const apbody = sectionBody(rbody, "Analysis plan");
        if (apbody) {
          const apMissing = [];
          if (!/\buniverse|enumerat|glob\b|route|DOM\b|inventory|mechanical|DECLARED|coverage|surface[s]?\s*:|element[s]?\s*:/i.test(apbody)) apMissing.push("the universe it hunts (a mechanical source — glob/route/DOM/probe — or DECLARED judgment)");
          if (!/\bhypothes|expect|suspect|predict|candidate|looking\s+for|hunt/i.test(apbody)) apMissing.push("the hypothesis space (what this round expects to find — >=1 candidate failure mode, not just where it looks)");
          if (!/\bevidence|probe|verify:|shot|screenshot|capture|stdout|computed|file:line|reads?\b/i.test(apbody)) apMissing.push("the evidence each axis row will produce");
          if (apMissing.length) missing.push(`Round ${n} ### Analysis plan is breadth, not a plan — missing: ${apMissing.join("; ")}`);
          if (n >= 2 && !/\bnew|deepen|remaining|open|next|carry|unwalked|fresh|extend|drill|residual|continu/i.test(apbody)) {
            missing.push(`Round ${n} ### Analysis plan doesn't show what changed — later rounds hunt something new (new hypothesis, deepened universe, remaining open items), not a repeat of round 1's plan`);
          }
        }
        const trav = sectionBody(rbody, "Traversal");
        if (trav) {
          const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
          const dataRows = trav.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/^\s*\|\s*axis\s*\|/i.test(l));
          const evCell = (l) => { const c = cellsOf(l); return c[c.length - 1] || ""; };
          const naCell = (l) => /^AXIS-NA\s*:/i.test(evCell(l));
          // Axes count from DATA ROWS only — `L1…L12` in prose is a claim,
          // not a walk; a whole-traversal `DECLARED:` is not a legal axis.
          const ids = new Set();
          // The axis id lives in the FIRST cell — a row that merely mentions
          // 'L4' in its evidence text doesn't walk L4.
          // cellsOf filters Boolean — a `|`/`||` row yields [] → [0] is
          // undefined → .match throws → gate dies → fail-open.
          for (const l of dataRows) { const m = (cellsOf(l)[0] || "").match(/^L(\d{1,2})\b/i); if (m) ids.add(+m[1]); }
          // v2 adds L13 (delta — binds rounds ≥2: what changed since the
          // last walk, did last round's applied land) and L14
          // (embarrassment — binds every round: the things you'd least
          // want noticed, checked).
          // Scope calibration (16-iteration-loop): fix-scope meta batches
          // (rule text, gate machinery, harness config — the instrument
          // editing itself) file compact records — only the axes that
          // genuinely applied. Every row-quality check below (evidence
          // cells, sweep counts, hard-ref floor, zero-walk) still binds
          // the rows that ARE present — compact scopes the enumeration,
          // not the teeth.
          const reqAxes = scope === "fix" ? [] : iterV2
            ? (n >= 2 ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14] : [1,2,3,4,5,6,7,8,9,10,11,12,14])
            : [1,2,3,4,5,6,7,8,9,10,11,12];
          const axesMissing = reqAxes.filter((i) => !ids.has(i));
          if (axesMissing.length) {
            missing.push(`Round ${n}: traversal misses axis(es) ${axesMissing.map((i) => "L" + i).join(", ")} — every axis gets a table row walked or AXIS-NA:'d; ids in prose are a claim, not a walk`);
          }
          // ids in prose satisfy nothing — a traversal with no data rows
          // is a heading.
          if (!dataRows.length) {
            missing.push(`Round ${n}: traversal has no data rows — axes in prose are a claim, not a walk`);
          }
          // An all-AXIS-NA table is the zero-walk signature — 'nothing
          // applicable' on every axis means nothing was examined.
          if (dataRows.length && dataRows.every(naCell)) {
            missing.push(`Round ${n}: every traversal row is AXIS-NA — a walk that examined nothing is not a walk`);
          }
          roundNonNA.set(n, dataRows.filter((l) => !naCell(l)).length);
          // Evidence-bearing rows: the EVIDENCE CELL carries a reference
          // token or a substantive AXIS-NA: reason (≥8 chars after the
          // colon). A token parked in the examined column doesn't count.
          const EVIDENCEISH = /`[^`\n]{4,}`|\.(?:mdc?|png|mjs|css|js|py|html|j2|json|ya?ml|txt|log)\b|\bprobes?\b|\bshots?\b|\bcomputed\b|\bverify:|\bfile:\d|\bAXIS-NA\s*:\s*\S.{7,}/i;
          const thin = dataRows.filter((l) => !EVIDENCEISH.test(evCell(l)));
          if (thin.length) {
            missing.push(`Round ${n}: ${thin.length} traversal row(s) carry no evidence ref or substantive AXIS-NA in the evidence cell — prose-only walking is what this gate exists to refuse`);
          }
          // RE-CHECK exempts novelty only — the cell still needs evidence,
          // and a round that's mostly re-checks isn't a walk. Cap: ≤4.
          const reChecks = dataRows.filter((l) => /^RE-CHECK\s*:/i.test(evCell(l)));
          if (reChecks.length > 4) {
            missing.push(`Round ${n}: ${reChecks.length} RE-CHECK: rows — a re-verification pass covers a few cells, not the table; a new walk needs new evidence`);
          }
          // Hard-ref floor (H4): every round needs ≥1 non-NA row carrying
          // executable evidence in its evidence cell — probe/shot/computed/
          // verify:<cmd>/render/stdout — document cites are not execution,
          // 'render' inside an AXIS-NA reason is vocabulary, and a bare
          // `verify: gut feel` is attestation, not a re-runnable command —
          // verify: only counts when it names a command the block below
          // would actually re-execute.
          const VERIFY_CMD = /verify:\s*(`[^`]+`|[^|—\n]*\b(ls|grep|rg|find|wc|cat|head|tail|sort|uniq|git)\b)/i;
          const EXEC_REF = /\bcomputed\b|\bprobes?\b|\bshots?\b|\brender(?:ed|s)?\b|\bscreenshot\b|\bstdout\b|\bstderr\b|\bexit\s+\d|\bconsole\b/i;
          const isHard = (l) => { const c = evCell(l); return EXEC_REF.test(c) || VERIFY_CMD.test(c); };
          if (dataRows.length && !dataRows.some((l) => !naCell(l) && isHard(l))) {
            missing.push(`Round ${n}: no traversal row carries executable evidence (probe|shot|computed|verify:<cmd>|render|stdout|exit N) — a doc-reading walk is not an examination`);
          }
          // `verify:` is a re-runnable label, not an adjective — a cell that
          // uses it must name a read-only command the gate can re-execute
          // (same whitelist as the audit ledger), or carry a real result
          // class (probe/shot/stdout) instead.
          // Shared whitelist + executor (top of file). Cap re-executions
          // per-round too — N rows × timeout must not eat the Stop hook's
          // own budget (a hanging command costs its whole timeout).
          let verifyRuns = 0;
          for (const l of dataRows) {
            // Backticked `verify: <cmd>` takes the whole command; bare
            // `verify: <text>` ends at the cell edge or a dash — a bare
            // use is vocabulary (attestation), a backticked use is a
            // re-runnable claim.
            const bt = evCell(l).match(/verify:\s*`([^`]+)`/i);
            const vm = bt || evCell(l).match(/verify:\s*([^|—\n]+)/i);
            if (!vm) continue;
            const cmd = vm[1].trim();
            if (!/[/\\]|\b(ls|grep|rg|find|wc|cat|head|tail|sort|uniq|git)\b/i.test(cmd)) continue; // vocabulary use, not a command — attestation, disclosed
            if (!verifyWhitelisted(cmd)) {
              missing.push(`Round ${n}: \`verify: ${cmd.slice(0, 50)}\` isn't in the read-only whitelist — re-run it and cite the result class (probe/shot/stdout), or name the file it produced`);
              continue;
            }
            if (++verifyRuns > 8) {
              missing.push(`Round ${n}: \`verify: ${cmd.slice(0, 40)}\` exceeds the re-execution budget (8/round) — cite the result it produced (stdout/probe) instead`);
              continue;
            }
            const r = runVerify(cmd);
            if (!r.ran) {
              missing.push(`Round ${n}: \`verify: ${cmd.slice(0, 50)}\` fails to run (${r.err}) — a verify: claim must verify`);
            }
          }
          // Novelty (H3): an identical (axis, evidence cell) re-appearing in
          // a later round is re-citation, not re-examination — unless the
          // cell opens `RE-CHECK:` (declared intentional re-verification).
          for (const l of dataRows) {
            const axisM = (cellsOf(l)[0] || "").match(/^L(\d{1,2})\b/i);
            const ev = evCell(l);
            if (!axisM || !ev) continue;
            if (/^RE-CHECK\s*:/i.test(ev)) continue;
            const key = `${axisM[1]}|${ev.slice(0, 200)}`;
            if (seenEvidence.has(key)) {
              missing.push(`Round ${n}: L${axisM[1]} re-cites Round ${seenEvidence.get(key)}'s evidence verbatim — a new walk needs new evidence (or open the cell RE-CHECK: to declare a re-run)`);
            } else seenEvidence.set(key, n);
          }
          if (iterV2) {
            // Counted universals (v2): an examined cell claiming a sweep —
            // every/all/each/entire — must carry its count, an explicit
            // enumeration token, or a verify: command. 'All journeys
            // resolve' is vague-true: correct at the precision it chose,
            // useless at the precision the defect lives at (pinto-
            // acoustic R1 → R2 eyes found every URL rendered one entity).
            const UNIVERSAL = /\b(every|all|each|entire|whole|full|complete)\b/i;
            const COUNTED = /\d|verify:|`/;
            const vague = dataRows.filter((l) => {
              if (naCell(l)) return false;
              const ex = cellsOf(l)[1] || "";
              return UNIVERSAL.test(ex) && !COUNTED.test(ex);
            });
            if (vague.length) {
              missing.push(`Round ${n}: ${vague.length} examined cell(s) claim a sweep (every/all/each) with no count, enumeration, or verify: — 'examined everything' uncounted is the vague-true escape; name N or enumerate`);
            }
            // Quality-axis hand-off (v2, rounds ≥2): the author's L2/L4/L9
            // rows cite the eyes artifact as evidence — the stranger's
            // verdicts walk the quality axes, not the author's own read
            // ('judged as a stranger sees it' is an axis the author can't
            // run on itself). Baseline rounds keep the v1 allowance.
            if (n >= 2 && !baseline.has(n)) {
              const selfJudged = dataRows.filter((l) => {
                if (naCell(l)) return false;
                const a = (cellsOf(l)[0] || "").match(/^L(2|4|9)\b/i);
                return a && !/eyes[\\/]/i.test(evCell(l));
              });
              if (selfJudged.length) {
                missing.push(`Round ${n}: ${selfJudged.length} quality-axis row(s) (L2/L4/L9) don't cite the eyes artifact — rounds ≥2 walk the quality axes on the stranger's verdicts, not the author's own read (16-iteration-loop → eyes protocol)`);
              }
            }
            // L13 altitude (v2, rounds ≥2): the delta axis reports score
            // movement, not 'applied landed' — a stranger's N/10 now vs
            // last round's, or before/after capture pairs. Without the
            // number a round can claim progress while the product sits
            // at the same plateau.
            if (n >= 2 && !baseline.has(n)) {
              const l13 = dataRows.find((l) => /^L13\b/i.test(cellsOf(l)[0] || "") && !naCell(l));
              if (l13) {
                const cell = cellsOf(l13).join(" ");
                if (!/\b\d{1,2}\s*\/\s*10\b|\d\s*→\s*\d|before\/after|eyes\b/i.test(cell)) {
                  missing.push(`Round ${n}: L13 (delta) carries no score movement or eyes/capture cite — 'applied landed' isn't a delta; the axis reports N/10 → M/10 (or names why the plateau held)`);
                }
              }
            }
            // Per-surface floors (v2, product scope): L6 absence, L9
            // register, L14 embarrassment must name the surfaces they
            // covered — a sweep that never says which surfaces it swept
            // is the coverage it claims to be. Spec ## Surfaces supplies
            // the names; ≥2 distinct cites (or DECLARED) per row.
            if (scope === "product" && specSurfNames.length) {
              const surfCell = (l) => { const cs = cellsOf(l); return cs.slice(1, -1).join(" "); };
              const namedIn = (l) => specSurfNames.filter((s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(surfCell(l))).length;
              const floors = dataRows.filter((l) => {
                const a = (cellsOf(l)[0] || "").match(/^L(6|9|14)\b/i);
                if (!a || naCell(l)) return false;
                return namedIn(l) < Math.min(2, specSurfNames.length) && !/DECLARED\s*:|every surface|all surfaces/i.test(surfCell(l));
              });
              if (floors.length) {
                missing.push(`Round ${n}: ${floors.length} per-surface axis row(s) (L6/L9/L14) name <${Math.min(2, specSurfNames.length)} spec surfaces — product scope walks the sweep per named surface (or DECLARED: <why a surface isn't applicable>)`);
              }
            }
          }
        }
        const find = sectionBody(rbody, "Findings");
        const appliedBody = sectionBody(rbody, "Applied") || "";
        if (find) {
          // Findings is a TABLE or an explicit 'none' — pure prose satisfies
          // the non-empty check while computing fixRows=0 → a fabricated
          // clean round with zero dispositions.
          const findLines = find.split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l));
          const proseNoneOk = findLines.length > 0 && findLines.every((l) => /\b(none|no findings|nothing found)\b/i.test(l));
          if (!findLines.some((l) => l.includes("|")) && !proseNoneOk) {
            missing.push(`Round ${n}: ### Findings is prose-only — findings are a table (id | finding | sev | disposition) or an explicit 'none' line (a 'none' beside bulleted defects is not a none-body)`);
          }
          // ...and a compliant table can't launder defect prose beside it:
          // every non-table line must itself be none-vocabulary, or the
          // bullets under it are findings no row dispositioned.
          const strayProse = findLines.filter((l) => !l.includes("|") && !/\b(none|no findings|nothing found|clean walk)\b/i.test(l));
          if (strayProse.length && findLines.some((l) => l.includes("|"))) {
            missing.push(`Round ${n}: ${strayProse.length} prose line(s) beside the ### Findings table aren't dispositioned — findings live in the table, or the body is a pure 'none' ("${strayProse[0].trim().slice(0, 60)}")`);
          }
          // v2 findings schema: a `class` column (defect|absence|quality|
          // hygiene) makes the critique's CLASS visible — a UI round
          // whose rows are all defect/hygiene shows the shallow signature
          // in the artifact itself. Locate the header's class cell; its
          // absence or an out-of-vocabulary row value flags.
          let classIdx = -1, noClassCol = false, mechIdx = -1;
          if (iterV2) {
            const headL = find.split(/\r?\n/).find((l) => l.includes("|") && cellsOf(l).some((c) => /^(id|finding|#|severity|sev|item)$/i.test(c)));
            if (headL) {
              const hcs = cellsOf(headL);
              classIdx = hcs.findIndex((c) => /^class$/i.test(c));
              mechIdx = hcs.findIndex((c) => /^mechanism$/i.test(c));
              if (classIdx < 0) noClassCol = true;
            } else if (find.split(/\r?\n/).some((l) => l.includes("|"))) {
              noClassCol = true; // a pipe table with no recognizable header still owes the column
            }
          }
          // mechanism column (v2): a finding whose cause is strategy-level
          // can't be closed by an instance patch — the column forces the
          // cause's altitude into the row. Required when any critical/
          // high/major-severity or quality/absence-class row exists.
          const sevOf = (cells) => cells.find((c) => c.length < 12 && /^(critical|high|major|minor|nit|trivial|p[0-3])\b/i.test(c)) || "";
          const classOf = (cells) => classIdx >= 0 ? (cells[classIdx] || "") : (cells.find((c) => /^(defect|absence|quality|hygiene|aesthetic-floor)\b/i.test(c)) || "");
          const mechNeeded = (cells) => /^(critical|high|major)\b/i.test(sevOf(cells)) || /^(quality|absence)\b/i.test(classOf(cells));
          let openRow = false, filedNoWhy = false, badDispo = 0, badAccepted = false, badNAD = 0, fixRows = 0, badClass = 0, nadNoCite = 0, badMajorNAD = 0;
          let noMechCol = false, badMech = 0, badVerify = 0, openCritQual = 0, appliedDefect = 0;
          for (const line of find.split(/\r?\n/)) {
            if (!line.includes("|")) continue; // prose commentary isn't a findings row
            const cells = cellsOf(line);
            if (!cells.length) continue;
            if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // table separator
            if (/^(id|finding|#|item|axis|unit)$/i.test(cells[0])) continue; // table header, not a finding row
            const last = cells[cells.length - 1];
            // `none` is an honest empty walk ONLY as a bare declaration —
            // every cell after the first must be empty/`—` or itself
            // none-vocabulary. Any defect content (severity, a wontfix
            // tail, defect prose) falls through to disposition eval and
            // flags — a `none | sidebar clips | high | wontfix` row is a
            // findings row, not an empty walk.
            const NONEISH = /^(none|no findings|nothing found|clean walk)\b/i;
            if (NONEISH.test(cells[0]) &&
                cells.slice(1).every((c) => /^[\s—–\-]*$/.test(c) || NONEISH.test(c))) {
              continue;
            }
            const idM = cells[0].match(/\b([A-Z]{1,3}\d+-F\d+|F\d+)\b/i);
            // Normalized uppercase — the collector accepts `f1` but the
            // applied extractor matched case-sensitively, so a lowercase
            // id was collected yet could never satisfy linkage (R15-F27).
            if (idM) allFindIds.add(idM[1].toUpperCase());
            // The legal terminal set — 'done', 'resolved', 'CLEARED', and
            // other near-miss vocabulary are undocumented dispositions.
            // `CARRIED` requires the colon everywhere — the artifact-side
            // and ledger scans already demanded `CARRIED: <where>`, so a
            // bare `CARRIED to tracker` was terminal here and OPEN there
            // (R15-F10). The where is the point: name it.
            const TERMINAL = /^(FIXED|VERIFIED|FILED\s*:|CARRIED\s*:|BLOCKED\s*:|ACCEPTED\s*:|NOT-A-DEFECT(?:\s*[—–-]+\s*DEFENDED)?\s*:|OPEN\b)/i;
            if (/^OPEN\b/i.test(last)) { openRow = true; fixRows++; }
            else if (!TERMINAL.test(last)) badDispo++;
            else if (/^(FIXED|VERIFIED|FILED\s*:|CARRIED\s*:|BLOCKED\s*:|ACCEPTED\s*:)/i.test(last)) fixRows++;
            // FILED must name the tracker AND why it's out-of-scope —
            // file-everything-apply-nothing is the escape hatch this kills.
            // The why needs substance too (≥12 chars, not bare filler).
            if (/^FILED/i.test(last) && !/^FILED\s*:\s*\S.*[—-]{1,2}\s*(?!queued\b|later\b|n\/a\b|tbd\b).{12,}/i.test(last)) filedNoWhy = true;
            // NOT-A-DEFECT asserts 'examined, not a defect' — the assertion
            // needs its reason (≥10 chars after the colon) or it's a free
            // clean-round token for real defects.
            if (/^NOT-A-DEFECT/i.test(last) && !/^NOT-A-DEFECT\s*:\s*(?!n\/a\b|tbd\b|ditto\b).{10,}/i.test(last) && !/\bDEFENDED\s*:/i.test(last)) badNAD++;
            // v2: the row's class cell must be one of the four classes —
            // an empty/missing/shifted cell fails the vocabulary test
            // (cellsOf drops empties, so a missing class lands the finding
            // text on the class index — flagged, not silent).
            if (iterV2 && classIdx >= 0 && !/^(defect|absence|quality|hygiene|aesthetic-floor)\b/i.test(cells[classIdx] || "")) badClass++;
            // mechanism + fix-effect verify + inversion tracking (v2):
            // a crit/qual row needs its mechanism cell; a CARRIED one
            // needs post-fix evidence on the row or on its ### Applied
            // cite — 'applied' self-asserted is the r1 failure.
            if (iterV2 && mechNeeded(cells)) {
              if (mechIdx < 0) noMechCol = true;
              else if (!cells[mechIdx] || cells[mechIdx].length < 10) badMech++;
              if (/^CARRIED\s*:/i.test(last)) {
                const VERIFY_TOK = /\bverify\s*:|re[-\s]?verif|\.png\b|\bshots?\b|\beyes\b|\bprobe\b|post[-\s]?fix|before\/after/i;
                const idM2 = cells[0].match(/\b([A-Z]{1,3}\d+-F\d+|F\d+)\b/i);
                const apLine = idM2 ? appliedBody.split(/\r?\n/).find((l) => l.toUpperCase().includes(idM2[1].toUpperCase())) : null;
                if (!VERIFY_TOK.test(last) && !(apLine && VERIFY_TOK.test(apLine))) badVerify++;
              }
            }
            if (iterV2 && /^OPEN\b/i.test(last) && mechNeeded(cells)) openCritQual++;
            if (iterV2 && /^(FIXED|VERIFIED|CARRIED\s*:)/i.test(last) && /^defect\b/i.test(classOf(cells))) appliedDefect++;
            // v2 DEFENDED semantics: NOT-A-DEFECT is an adjudication, and
            // adjudication isn't clean — only the DEFENDED: form (defense
            // + what confirmed it) stays clean-compatible. A bare
            // NOT-A-DEFECT counts as fix-requiring for clean-walk. And
            // the defense needs an independent cite (eyes/verify:/shot/
            // file:line) or it's still the author's say-so; major/critical
            // rows need both or the wave-away path to convergence is back.
            if (iterV2 && /^NOT-A-DEFECT/i.test(last)) {
              const defended = /\bDEFENDED\s*:/i.test(last);
              const cited = /\beyes\b|\bverify\s*:|\.png\b|\bshots?\b|\bfile:\d|\bline\s*\d/i.test(last);
              if (!defended) fixRows++;
              else if (!cited) nadNoCite++;
              const sevCell = cells.find((c) => c.length < 12 && /^(critical|major|minor|nit|trivial|p[0-3])\b/i.test(c));
              if (sevCell && /^(critical|major)\b/i.test(sevCell) && !(defended && cited)) badMajorNAD++;
            }
            // ACCEPTED asserts the user's agreement — verified like
            // STOP-DECLARED: needs '— user <verb>' AND a recorded user
            // pause/assent signal sharing a content word with the claim.
            if (/^ACCEPTED\s*:/i.test(last)) {
              if (!/[—-]{1,2}\s*user\s+\w+/i.test(last)) {
                badAccepted = true;
              } else {
                if (!acceptedOk(last)) badAccepted = true;
              }
            }
            // Location kept apart from claim text — otherwise the
            // synthesized prefix's words (`iteration/` in iterRel, the
            // sid name, "Round") leak into the STOP-overlap test and a
            // STOP line about an unrelated item clears this row on a
            // coincidental path word (R14 own-walk: "mockup iteration"
            // cleared an R13 BLOCKED row on exactly that word).
            if (/^BLOCKED\s*:/i.test(last)) blockedOpen.push({ loc: `${iterRel} Round ${n}`, text: last.slice(0, 160) });
          }
          // A clean walk found nothing to change — every finding row ends
          // examined-not-defective (NOT-A-DEFECT/none). FIXED/VERIFIED/
          // FILED/BLOCKED/OPEN rows mean the walk produced work.
          if (fixRows === 0) cleanRounds.add(n);
          if (openRow) missing.push(`Round ${n}: a findings row ends OPEN — open findings hold the stop (fix it, file it, or disposition it)`);
          if (filedNoWhy) missing.push(`Round ${n}: a FILED row lacks '— <why out-of-scope>' (≥12 chars, real substance) — findings in this iteration's scope are worked, not filed`);
          if (badDispo) missing.push(`Round ${n}: ${badDispo} findings row(s) end without a legal terminal (FIXED|VERIFIED|FILED:|CARRIED:|BLOCKED:|ACCEPTED:|NOT-A-DEFECT:|OPEN) — near-miss vocabulary like 'done' or 'CLEARED' is not a disposition`);
          if (badAccepted) missing.push(`Round ${n}: an ACCEPTED: finding lacks verifiable user agreement — '— user <verb>' plus a recorded user pause/assent signal sharing a content word (same doctrine as STOP-DECLARED)`);
          if (badNAD) missing.push(`Round ${n}: ${badNAD} NOT-A-DEFECT row(s) carry no reason (≥10 chars after the colon) — 'examined, not a defect' needs its why, like AXIS-NA needs its`);
          if (noClassCol) missing.push(`Round ${n}: the findings table has no \`class\` column — v2 rows carry defect|absence|quality|hygiene|aesthetic-floor so the critique's class is visible in the artifact (a quality-free UI round shows itself)`);
          if (badClass) missing.push(`Round ${n}: ${badClass} findings row(s) carry no class vocabulary (defect|absence|quality|hygiene|aesthetic-floor) in the class cell — every finding names its class`);
          if (nadNoCite) missing.push(`Round ${n}: ${nadNoCite} NOT-A-DEFECT row(s) are DEFENDED: but cite nothing independent (eyes/verify:/shot/file:line) — a defense without a cite is still the author's say-so`);
          if (badMajorNAD) missing.push(`Round ${n}: ${badMajorNAD} major/critical row(s) end NOT-A-DEFECT without a DEFENDED: defense + independent cite — majors can't be waved away by the reviewed party`);
          if (noMechCol) missing.push(`Round ${n}: crit/quality findings exist but the table has no \`mechanism\` column — v2 rows carry the strategy-level cause (id | severity | class | mechanism | finding | evidence | disposition) so an instance patch can't close a strategy finding`);
          if (badMech) missing.push(`Round ${n}: ${badMech} crit/quality row(s) carry an empty/thin mechanism cell (<10 chars) — name the strategy-level cause ('payload media is illustration', not 'post card')`);
          if (badVerify) missing.push(`Round ${n}: ${badVerify} CARRIED crit/quality row(s) cite no post-fix verification (verify:/shot/eyes/probe on the row or its ### Applied line) — 'applied' self-asserted is how a claimed fix ships broken`);
          if (openCritQual && appliedDefect) missing.push(`Round ${n}: priority inversion — ${appliedDefect} defect fix(es) landed while ${openCritQual} critical/quality finding(s) sat OPEN; the biggest levers come first, or the round polishes around the ceiling`);
        }
        // Applied linkage (H7): applied rows cite the finding ids they
        // close — ids that exist in ### Findings sections (allFindIds is
        // built only there — an F9 cited from traversal prose is not a
        // finding, and axis ids like L3 never were). none — … declares the
        // honest empty form.
        const appl = sectionBody(rbody, "Applied");
        if (appl) {
          const applLines = appl.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/^\|?\s*[-*#]?\s*(?:id|finding)\b/i.test(l));
          const badAppl = applLines.filter((l) => {
            if (/none\s*(?:—|--|-)\s*(?:final|nothing)\b/i.test(l)) return false;
            const ids = [...l.matchAll(/\b([A-Z]{1,3}\d+-F\d+|F\d+)\b/gi)].map((m) => m[1].toUpperCase());
            return !ids.length || ids.some((id) => !allFindIds.has(id));
          });
          if (badAppl.length) {
            missing.push(`Round ${n}: ${badAppl.length} ### Applied line(s) cite no finding id that exists in a ### Findings table — applied work names what it closed ('F2 → file:line', or 'none — nothing applied')`);
          }
        }
        // Eyes pass (H2): rounds ≥2 need an independent-eyes ARTIFACT —
        // .unlazy/eyes/<sid>-r<N>.md — cited from ### Eyes. There is NO
        // `not-self-produced` escape: the loop armed because this session
        // wrote implementation, so the subject is provably self-produced —
        // the waiver was a self-serve lie the gate accepted. Baseline
        // rounds (first-seen before the machinery observed them) may
        // instead declare `predates eyes-artifact requirement`. The file
        // must name an agent (Agent: line always; fresh sessions must
        // match a tracker-observed critique launch).
        if (n >= 2) {
          const eyes = sectionBody(rbody, "Eyes");
          const eyesLegacy = baseline.has(n) && /DECLARED\s*:\s*predates\s+eyes-artifact\s+requirement\s*[—-]{1,2}\s*.{10,}/i.test(eyes || "");
          if (!eyesLegacy) {
            const eyesPath = join(ROOT, ".unlazy", "eyes", `${sid}-r${n}.md`);
            const eyesRel = artifactFor(`.unlazy/eyes/${sid}-r${n}.md`);
            if (!existsSync(eyesPath)) {
              missing.push(`Round ${n}: no eyes artifact at ${eyesRel} — rounds ≥2 run a stranger pass (agent sees artifact + question only); deposit its findings there with <!-- eyes v2 --> for v2 loops (v1 still parses under a v1 artifact). The loop armed on your own implementation, so not-self-produced isn't an answer`);
            } else {
              const et = fenceStrip(readText(eyesPath) || "");
              // The verdict VALUE is required — a bare `VERDICT:` header
              // (or a findings table with no verdict at all) leaves the
              // consumption check below with nothing to evaluate, which
              // is exactly the "verdictless pass consumes nothing" hole.
              // v2 marker supersedes v1 — a v2 file carries everything v1
              // asked plus the two-phase schema checked further below.
              const eyesV2 = hasMarker(et, "eyes v2");
              const eyesOk = (hasMarker(et, "eyes v1") || hasMarker(et, "eyes v2")) && /Agent\s*:/i.test(et) && /VERDICT\s*:\s*\S/i.test(et);
              if (!eyesOk) {
                missing.push(`Round ${n}: ${eyesRel} exists but lacks the eyes marker (<!-- eyes v2 --> under v2) + an Agent: line + a VERDICT:/findings-table record — an eyes file records the stranger's findings, not a claim that one ran`);
              } else {
                const agentM = et.match(/Agent\s*:\s*([^\n]+)/i);
                // Length floors on both sides — `critique_agents:[""]`
                // corroborated everything (includes("") is true, R12-F13).
                // Entries are launch titles AND recorded agent ids — the
                // tracker now pushes the returned id too, so an
                // `Agent: ca1740fc` line matches a recorded launch (R12-F8).
                // The provenance pool is the LAUNCH record: critique_agents
                // (classified subset) OR subagent_launches (every launch,
                // title + returned id). A stranger brief carrying the word
                // "fix" incidentally (`audit the fix hunks`) hits the
                // code-intent exclusion and lands in subagent_launches
                // only — the launch was still observed, and corroborating
                // it is the check's whole point (R16 own-walk: this exact
                // brief misclassified). critique_agents keeps its role in
                // the critique-launched boolean check elsewhere.
                const agents = [...(state.critique_agents || []), ...(state.subagent_launches || [])]
                  .map((a) => String(a).trim()).filter((a) => a.length >= 4);
                const named = agentM ? agentM[1].replace(/`/g, "").trim() : "";
                // Equality or full containment only — `includes` on
                // 30-char slices let `Agent: pass` corroborate any
                // launch containing that word (R13-F12).
                const launchSeen = agentM && named.length >= 4 && agents.some((a) => {
                  const na = a.toLowerCase(), nn = named.toLowerCase();
                  return nn === na || nn.includes(na);
                });
                if (!agentM || named.length < 4) {
                  missing.push(`Round ${n}: ${eyesRel} lacks an \`Agent: <who ran it>\` line — an eyes file names the stranger that produced it`);
                } else if (!state.loop_grandfathered && (agents.length || (state.subagent_launches || []).length) && !launchSeen) {
                  // Launch corroboration binds whenever the channel
                  // demonstrably delivers: critique_agents OR any recorded
                  // subagent launch (subagent_launches, R14-F13) prove
                  // run_subagent PostToolUse fires here — then a named
                  // agent absent from critique_agents is fabrication (or
                  // a misclassified launch), not degradation. Both empty =
                  // the channel can't deliver — Agent:-line attestation.
                  missing.push(`Round ${n}: ${eyesRel} names no agent the tracker observed launching (state.critique_agents: ${agents.length ? agents.map((a) => a.slice(0, 30)).join(", ") : "none"}; launches seen: ${(state.subagent_launches || []).length}) — a stranger pass must come from a launched stranger`);
                } else if (!agents.length && !(state.subagent_launches || []).length &&
                           !/DECLARED\s*:\s*self[-\s]?eyes\s*[—–-]{1,2}\s*\S.{8,}/i.test(evidence || "") &&
                           !exempt("SELFEYES", "*")) {
                  // I1: zero recorded launches used to degrade silently to
                  // Agent:-line attestation — a self-authored stranger was
                  // free. The degrade now needs the declared reason.
                  missing.push(`Round ${n}: ${eyesRel} has no recorded subagent launch behind it — the channel can't corroborate a stranger, so self-authored eyes must be declared: \`DECLARED: self-eyes — <why no stranger ran>\` in ${evidenceRel}`);
                }
              }
              // The artifact is cited from ### Eyes — a file on disk that
              // no round section mentions isn't incorporated, it's parked.
              if (!eyes || !new RegExp(`eyes[/\\\\][^\\s\`]*-r${n}\\.md`, "i").test(eyes)) {
                missing.push(`Round ${n}: ### Eyes ${eyes ? "doesn't cite " + eyesRel : "is missing"} — the round must name the pass it incorporated`);
              }
              // Consumption: a NEEDS-WORK stranger pass can't yield a 'none'
              // findings body — its findings are adopted into the table or
              // explicitly rebutted there. 'none' beside a non-clean verdict
              // is an ignored pass, not an incorporated one.
              const eyesVerdict = (et.match(/VERDICT\s*:\s*([^\n]+)/i) || [])[1] || "";
              // Negation-aware clean test — `VERDICT: not a pass` /
              // `can't ship` / `nowhere near clean` carry a clean word
              // inside a negation; NEG_RE is the same guard the
              // assistant-side VERDICT_RE already applies.
              // Inflected clean words count — `passed`/`approved`/
              // `shipped`/`all-clear` are clean verdicts the bare stems
              // missed (R15-F11). NEG_RE still negates the lot.
              // `no`/`none` bound to a none-noun affirms the clean word —
              // "CLEAN — no findings" is a clean verdict, not a negated
              // one. Mask none-phrases BEFORE NEG_RE so the affirming
              // `no` can't negate `clean` (R16 own-walk: the most
              // natural clean-verdict phrasing false-flagged).
              const verdictSansNone = eyesVerdict.replace(/\bno\b\s+(?:actionable\s+|fixable\s+|new\s+|open\s+)*(?:findings|issues|defects|items?|observations|work|action)\b/gi, "");
              const eyesClean = /\b(clean|pass(?:ed|es|ing)?|approve[ds]?|ship(?:ped|ping|s)?|all[\s-]*clear|good|lgtm|green)\b/i.test(eyesVerdict) && !NEG_RE.test(verdictSansNone);
              // An EMPTY findings table (header + separator, zero data
              // rows) is 'none' the same as prose 'none' — the old test
              // only counted no-pipe forms, so a NEEDS-WORK verdict with
              // a hollow table skipped consumption entirely (R16-F11).
              const findLines = find ? find.split(/\r?\n/) : [];
              const findSepIdx = findLines.findIndex((l) => /^\s*\|[\s:\-|]+\|\s*$/.test(l));
              // Table data lives AFTER the separator row (header cells
              // can carry non-vocabulary column names). A row whose
              // first cell is exactly `none` is the canonical clean-row —
              // under a NEEDS-WORK verdict it counts as 'none', but a
              // `none — F9 defect` first cell is a real finding row.
              const findDataRows = findSepIdx >= 0
                ? findLines.slice(findSepIdx + 1).filter((l) => {
                    if (!l.includes("|") || /^\s*\|[\s:\-|]+\|\s*$/.test(l) ||
                        l.replace(/[|\s]/g, "").length === 0) return false;
                    const first = l.split("|").map((c) => c.trim()).filter(Boolean)[0] || "";
                    return first.toLowerCase() !== "none";
                  })
                : [];
              const findIsNone = find && findDataRows.length === 0 &&
                (find.split(/\r?\n/).some((l) => l.includes("|")) ||
                  find.split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l)).every((l) => /\b(none|no findings|nothing found|clean walk)\b/i.test(l)));
              if (eyesVerdict && !eyesClean && findIsNone) {
                missing.push(`Round ${n}: ${eyesRel} reports "${eyesVerdict.trim().slice(0, 50)}" but ### Findings is 'none' — a stranger pass that found work must be consumed (findings adopted or rebutted in the table), not ignored`);
              }
              // v2 eyes schema (the two-phase comprehensive protocol):
              // a v2 loop can't be satisfied by a v1 pass — the stranger
              // runs the shipped-product critique: deposited brief,
              // capture spec, coverage enumeration, verdict-per-surface,
              // evidence per finding. 'Found N' means nothing without
              // the space it was found in — and 'no findings' means
              // nothing without verdicts.
              if (iterV2 && eyesOk && !eyesV2) {
                missing.push(`Round ${n}: ${eyesRel} is an eyes-v1 pass — a v2 loop runs the two-phase comprehensive protocol (capture spec → shipped-product critique → coverage + verdicts + evidence). Re-run the stranger under the v2 brief and deposit <!-- eyes v2 -->`);
              }
              if (eyesOk && eyesV2) {
                // Deposited brief — the question + protocol verbatim, so
                // anchoring is auditable. Protocol-vocab floor: ≥3 of 4
                // classes (shipped-product framing, enumerate-every,
                // verdict-per-surface, evidence-required) or the brief
                // was a bare 'critique this' with extra words.
                const briefM = et.match(/Brief\s*:([\s\S]*?)(?=^#{1,6}\s|^VERDICT\s*:|$(?![\s\S]))/im);
                if (!briefM || briefM[1].trim().length < 20) {
                  missing.push(`Round ${n}: ${eyesRel} lacks a deposited \`Brief:\` — the question + protocol the stranger was given, verbatim (anchoring is auditable only when it's recorded)`);
                } else {
                  const vocabHit = [
                    /shipped product|real users|embarrass|live product/i,
                    /\bevery\b|\beach\b|enumerate|all surfaces/i,
                    /verdict|weakest|strongest objection|biggest lever/i,
                    /file:|evidence|screenshot|\bshots?\b|cite|\bDOM\b/i,
                  ].filter((re) => re.test(briefM[1])).length;
                  if (vocabHit < 3) {
                    missing.push(`Round ${n}: ${eyesRel}'s deposited brief hits ${vocabHit}/4 protocol vocab classes (shipped-product framing, enumerate-every, verdict-per-surface, evidence-required) — the comprehensive critique is anchored in the brief, not implied`);
                  }
                }
                // Phase A — what the stranger demanded to see, or the
                // declared single-phase reason (honest only for fully-
                // readable text subjects).
                const capSec = sectionBody(et, "Capture spec");
                if (!/DECLARED\s*:\s*single-phase\s*[—-]{1,2}\s*.{20,}/is.test(et) && capSec.trim().length < 20) {
                  missing.push(`Round ${n}: ${eyesRel} has no ## Capture spec — phase A names what the stranger needed to see (or DECLARED: single-phase — <why>)`);
                }
                // Coverage — the enumerated space the findings came from.
                const covSec = sectionBody(et, "Coverage");
                const covRows = covSec.split(/\r?\n/).filter((l) => l.includes("|") && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/^\s*\|?\s*(surface|unit|area|element)\s*\|/i.test(l));
                if (!covRows.length) {
                  missing.push(`Round ${n}: ${eyesRel} has no ## Coverage rows — 'found N' means nothing without the enumerated space it was found in`);
                }
                // Verdict-per-surface — the floor 'no findings' stands on.
                const vSec = sectionBody(et, "Verdicts");
                const vData = vSec.split(/\r?\n/).filter((l) => l.includes("|") && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/^\s*\|?\s*(surface|unit|element|area)\s*\|/i.test(l));
                if (!vData.length) {
                  missing.push(`Round ${n}: ${eyesRel} has no ## Verdicts rows — verdict-per-surface is the floor; a findings-only pass can skip 'is it good', a verdict can't`);
                } else if (!vData.some((l) => /\b(strong|adequate|weak|unverified|mixed|poor|fail|broken)\b/i.test(l))) {
                  missing.push(`Round ${n}: ${eyesRel}'s ## Verdicts rows carry no verdict vocabulary (strong|adequate|weak|unverified|mixed|poor) — a row without a verdict judges nothing`);
                }
                // ## Scores — per-surface 1–10 + named distance-to-bar.
                // 'Adequate' covers a 5 and an 8 with one word; the number
                // is what makes the plateau visible.
                if (iterV2) {
                  const scSec = sectionBody(et, "Scores");
                  if (!scSec.trim()) {
                    missing.push(`Round ${n}: ${eyesRel} has no ## Scores (per-surface 1–10 + named distance-to-bar — the grade the round moves)`);
                  } else if (!/\b\d{1,2}\s*\/\s*10\b/.test(scSec)) {
                    missing.push(`Round ${n}: ${eyesRel}'s ## Scores has no N/10 row — a score is a number, not an adjective`);
                  }
                  // Biggest-lever reconcile — the verdicts' lever cells
                  // are load-bearing: every named lever must show up in
                  // this round's dispositions (applied w/ evidence or a
                  // defended reason). 'none — <why>' cells owe nothing.
                  const leverTexts = vData
                    .map((l) => { const cs = cellsOf(l); return (cs[cs.length - 1] || "").trim(); })
                    .filter((c) => c.length >= 12 && !/^(none|—|n\/a|at-bar)/i.test(c));
                  const roundPool = (find + "\n" + appliedBody + "\n" + rbody).toLowerCase();
                  const unRecon = leverTexts.filter((lev) => {
                    const words = lev.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
                    if (!words.length) return false;
                    const hits = words.filter((w) => roundPool.includes(w)).length;
                    return hits / words.length < 0.5;
                  });
                  if (unRecon.length) {
                    missing.push(`Round ${n}: ${unRecon.length} biggest-lever cell(s) from ${eyesRel} never appear in this round's dispositions ("${unRecon[0].slice(0, 60)}") — the stranger's top lever must be applied-with-evidence or defended, not drowned by micro-fixes`);
                  }
                }
                // Evidence per finding — every row names what it was
                // judged on. A clean verdict owes no findings table.
                const fSec = sectionBody(et, "Findings");
                if (fSec) {
                  const fRows = fSec.split(/\r?\n/).filter((l) => {
                    if (!l.includes("|") || /^\s*\|[\s:\-|]+\|\s*$/.test(l)) return false;
                    // Header by first cell, not line text — `#` is a
                    // non-word char so `#\b` can't exclude a `| # |`
                    // column and the header row read as a no-evidence
                    // finding (matrix 54).
                    return !/^(#|id|severity|sev|finding|item)$/i.test(cellsOf(l)[0] || "");
                  });
                  const EYES_EV = /`|\.(?:html|css|js|mjs|py|j2|png|md|json|txt)\b|\bfile:\d|:line\b|\bline\s*\d|\bverify:|\bstdout\b|\bshots?\b|\bprobe\b|\bDOM\b/i;
                  const noEvF = fRows.filter((l) => !EYES_EV.test(l)).length;
                  if (noEvF) {
                    missing.push(`Round ${n}: ${eyesRel} has ${noEvF} findings row(s) with no evidence cite (file:line, shot name, DOM/probe detail) — every stranger finding names what it was judged on`);
                  }
                } else if (eyesVerdict && !eyesClean) {
                  missing.push(`Round ${n}: ${eyesRel} reports a non-clean verdict but has no ## Findings table — the verdict and the enumeration live together`);
                }
              }
            }
          }
        }
      }

      // Ambition round (v2, product scope, ≥2 rounds): at least one
      // round opens from the scores/levers — its analysis plan asks
      // what raises the CEILING, not only what's broken. A loop whose
      // every plan is defect-shaped iterates inside the plateau.
      if (iterV2 && scope === "product" && roundsRun >= 2) {
        const plans = [...itext.matchAll(/#{2,4}\s*(?:analysis(?:\s*plan)?|plan)\b[^\n]*\n([\s\S]{0,900})/gi)].map((m) => m[1]);
        const hasAmbition = plans.some((p) => /biggest lever|score|ceiling|ambition|9\/10|top[- ]decile|distance to bar|raises the bar|what the 9\/10/i.test(p));
        if (!hasAmbition) {
          missing.push(`product scope + ${roundsRun} rounds but no analysis plan opens from scores/levers/ceiling — the ambition round: one round must ask what raises the CEILING (the 9/10 moves), not only what's broken`);
        } else {
          // Non-producer ceiling grading (16-iteration-loop): the round
          // that grades the ceiling can't grade it with its own prose —
          // the producer and its critic are the same distribution (D2/D7).
          // The ambition round must deposit external grading evidence:
          // an eyes artifact, a rendered-shot cite, a probe dump, or a
          // named stranger pass inside the round body.
          const AMBITION_RE = /biggest lever|score|ceiling|ambition|9\/10|top[- ]decile|distance to bar|raises the bar|what the 9\/10/i;
          const EXT_GRADE_RE = /\.unlazy\/eyes\/|\beyes[-\s]?(?:pass|artifact|file)\b|\bstranger\b|\bcold[-\s]?read\b|\b(?:shots?|screenshots?)\s*[:/`]|\.png\b|\bprobe\b|non[- ]?producer|independent\s+(?:grade|verdict|eyes)/i;
          const ambN = roundHeads.find((n) => AMBITION_RE.test(h2Body(`Round ${n}`)));
          if (ambN != null && !EXT_GRADE_RE.test(h2Body(`Round ${ambN}`))) {
            missing.push(`Round ${ambN} is the ambition/ceiling round but carries no non-producer grading evidence (eyes artifact, shot cite, probe dump, or named stranger pass) — a ceiling self-graded in producer prose is the same distribution grading its own output; deposit the external grade in the round`);
          }
        }
      }
      // Launch-vs-deposit (v2): an eyes/critique pass launched but never
      // deposited is coverage that was claimed in flight and lost — the
      // tracker saw the launch, so the loop must show the artifact.
      if (iterV2) {
        const launches = (state.subagent_launches || []).filter((a) => /eyes|cold[- ]?read|stranger|critique|fresh[- ]?eyes/i.test(String(a)));
        let deposits = 0;
        try {
          deposits = readdirSync(join(ROOT, ".unlazy", "eyes")).filter((f) => f.startsWith(`${sid}-`) && f.endsWith(".md")).length;
        } catch { /* none */ }
        if (launches.length > deposits) {
          missing.push(`${launches.length} launched eyes/critique pass(es) but only ${deposits} deposited .unlazy/eyes/${sid}-*.md artifact(s) — a launch that never deposits is coverage claimed, not coverage; deposit the pass or disposition it in this artifact`);
        }
      }

      // Convergence means two clean walks, not one lucky one — and 'clean'
      // is checked, not asserted: the final two rounds' findings must
      // contain no fix-requiring rows (FIXED/VERIFIED/FILED/BLOCKED/OPEN —
      // a walk that produced work isn't clean), and the final walk must
      // actually walk (≥3 non-AXIS-NA axis rows — 'converged' on a walk
      // that examined nothing is the NA'd-away exit this refuses). Runs
      // after the round loop — cleanRounds/roundNonNA are populated there.
      if (terminator === "clean-walk" && scope) {
        // fix scope may have Budget: 0 — one clean walk still owes a real
        // walk; larger scopes owe min(2, budget).
        const cwFloor = Math.min(2, budget ?? 1) || 1;
        if (roundsRun < cwFloor) {
          missing.push(`ENDED: clean-walk after ${roundsRun} round(s) — convergence is ≥${cwFloor} clean walks for scope ${scope}, not one`);
        } else {
          const lastN = roundHeads[roundHeads.length - 1];
          const prevN = roundHeads[roundHeads.length - 2];
          if (!cleanRounds.has(lastN)) {
            missing.push(`ENDED: clean-walk but Round ${lastN}'s findings contain fix-requiring rows — the last walk must find nothing to change (a productive round isn't a clean one)`);
          }
          if (cwFloor === 2 && prevN != null && !cleanRounds.has(prevN)) {
            missing.push(`ENDED: clean-walk but Round ${prevN}'s findings contain fix-requiring rows — convergence is two consecutive clean walks, not one`);
          }
          if ((roundNonNA.get(lastN) ?? 0) < 3) {
            missing.push(`ENDED: clean-walk but Round ${lastN} walked <3 non-AXIS-NA axes — convergence requires the final walk to have walked, not NA'd itself away`);
          }
          if (cwFloor === 2 && prevN != null && (roundNonNA.get(prevN) ?? 0) < 3) {
            missing.push(`ENDED: clean-walk but Round ${prevN} walked <3 non-AXIS-NA axes — both converging walks must have walked, not NA'd themselves away`);
          }
        }
      }

      // Interleave (H9): rounds first-seen after the baseline observation
      // need an impl write BETWEEN consecutive round first-seen times —
      // rounds are walked between changes, not burst-authored at the end.
      // A post-baseline round the tracker never stamped is outside the
      // temporal record — written by an unmatched tool or hand-authored.
      // Exempting it silently would make invisibility a strategy.
      const unstamped = roundHeads.filter((n) => !baseline.has(n) && !roundSeen[n]);
      for (const n of unstamped) {
        missing.push(`Round ${n}: the tracker never observed this round's arrival (no round_seen stamp, not in the first-observation baseline) — rounds must land through instrumented writes, not appear unobserved`);
      }
      const postBaseline = roundHeads.filter((n) => !baseline.has(n) && roundSeen[n]);
      for (const n of postBaseline) {
        // The impl gap is owed after EVERY post-baseline round — exempting
        // clean predecessors lets an all-clean burst pass with zero impl
        // writes, which is exactly the fabrication shape this check
        // refuses. Honest sessions do other impl work between walks
        // regardless of whether a round applied fixes.
        if (n >= 2 && roundSeen[n - 1]) {
          const gap = implLog.some((t) => t > roundSeen[n - 1] && t < roundSeen[n]);
          if (!gap) {
            missing.push(`Round ${n}: no implementation write between Round ${n - 1} and Round ${n} first-seen (${roundSeen[n - 1]} → ${roundSeen[n]}) — rounds are walked between changes; a burst-authored artifact is the backfill signature this check exists to refuse`);
          }
        }
      }
      // Bulk-up detection (F6b): a skeleton round keeps its early stamp
      // legitimately — but if its traversal row-count was still changing
      // AFTER the next round first-seen, the 'walked' round incorporated a
      // walk that hadn't finished landing. Slow-motion backfill.
      const rowsAt = state.round_rows_at || {};
      for (const n of roundHeads) {
        if (rowsAt[n] && roundSeen[n + 1] && Date.parse(rowsAt[n]) > Date.parse(roundSeen[n + 1])) {
          missing.push(`Round ${n}'s traversal was still growing at ${rowsAt[n]}, after Round ${n + 1} first-seen (${roundSeen[n + 1]}) — a skeleton stamped early then bulked at wrap-up is backfill in slow motion`);
        }
      }

      // The final round's Applied is the loop's exit statement — a
      // terminated loop that still lists pending changes isn't terminated.
      // EVERY non-separator line must be the none-final declaration — a
      // real 'F3 → file' line sitting next to it means changes untraversed.
      if ((terminator === "clean-walk" || terminator === "budget-met") && roundHeads.length) {
        const lastApplied = sectionBody(h2Body(`Round\\s+${roundHeads[roundHeads.length - 1]}`), "Applied");
        if (lastApplied) {
          const aLines = lastApplied.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^\s*\|[\s:\-|]+\|\s*$/.test(l));
          // `- none — final` (bullet form) is the same declaration — the
          // per-round check is unanchored so the bullet parsed there but
          // failed this `^`-anchored twin (R15-F28).
          if (!aLines.length || !aLines.every((l) => /^[-*•+]?\s*none\s*(?:—|--|-)\s*final\b/i.test(l))) {
            missing.push(`Round ${roundHeads[roundHeads.length - 1]}: ### Applied isn't 'none — final' on a terminated loop — changes listed there were never traversed`);
          }
        }
      }

      // The terminator sits after the verdict — an ENDED: line before the
      // final round or before ## Exit review ends nothing it didn't see.
      if (endedM) {
        const lastRoundIdx2 = roundHeads.length ? itext_nf.search(new RegExp(`^##\\s*Round\\s+${roundHeads[roundHeads.length - 1]}\\b`, "im")) : -1;
        const exitIdx2 = itext_nf.search(/^##\s*Exit\s+review\b/im);
        if (lastRoundIdx2 >= 0 && endedM.index < lastRoundIdx2) {
          missing.push("`ENDED:` appears before the final `## Round` — a terminator can't close rounds that follow it");
        } else if (exitIdx2 >= 0 && endedM.index < exitIdx2) {
          missing.push("`ENDED:` appears before `## Exit review` — the terminator follows the verdict, not precedes it");
        }
      }

      // ## Exit review (H1 — the quality gate before ANY terminator): a
      // meticulous verdict pass on the finished result, distinct from
      // traversal. No DECLARED: path — the escape would recreate the gap
      // it exists to close. `weak` fails unless the user ACCEPTED: it;
      // `unverified` always fails — unverifiable means the loop isn't
      // done. The tracker observes when the section first appears: a
      // verdict authored before the last impl write reviews a mid-state.
      if (terminator) {
        const exitIdx = itext_nf.search(/^##\s*Exit\s+review\b/im);
        const lastRoundIdx = roundHeads.length ? itext_nf.search(new RegExp(`^##\\s*Round\\s+${roundHeads[roundHeads.length - 1]}\\b`, "im")) : -1;
        if (exitIdx < 0) {
          missing.push("`## Exit review` — no terminator is legal without the quality verdict pass on the finished result (16-iteration-loop → exit review)");
        } else if (lastRoundIdx >= 0 && exitIdx < lastRoundIdx) {
          missing.push("`## Exit review` must follow the final `## Round` — the verdict reviews the finished result, not a mid-state");
        } else {
          const exitBodyAll = itext_nf.slice(exitIdx);
          const nextH = exitBodyAll.slice(1).search(/^##\s/m);
          const exitBody = nextH < 0 ? exitBodyAll : exitBodyAll.slice(0, nextH + 1);
          const EVIDENCEISH2 = /`[^`\n]{4,}`|\.(?:mdc?|png|mjs|css|js|py|html|j2|json|ya?ml|txt|log)\b|\bprobes?\b|\bshots?\b|\bcomputed\b|\bverify:|\bfile:\d|\brender|\bstdout\b/i;
          // `>`/`1.`/`•` line starts carry DECLARED the same way bullets
          // do — the ban covered `[-*]` and `|` only (R14-F19). And a
          // mid-sentence `x DECLARED: y` escaped the line-start anchor
          // entirely (R15-F29) — DECLARED is a discharge keyword, never
          // a mention word inside this section.
          if (/\bDECLARED\s*:\s*\S/i.test(exitBody)) {
            missing.push("`## Exit review` carries DECLARED: — verdict rows are always required; the bypass would recreate the gap this section exists to close");
          }
          // Bullet forms count — `- Weakest area:` was flagged missing
          // under the `^\s*` anchor (R15-F29).
          if (!/^\s*[-*•]?\s*Weakest\s+area\s*:\s*\S/im.test(exitBody)) {
            missing.push("`## Exit review` needs a `Weakest area:` line — even a strong result names its weakest part");
          }
          if (!/^\s*[-*•]?\s*Re-verified\s*:\s*\S/im.test(exitBody)) {
            missing.push("`## Exit review` needs a `Re-verified:` line — what was re-examined on the finished result after the last change");
          }
          const sepRe2 = /^\s*\|[\s:\-|]+\|\s*$/;
          // Header rows (first cell unit/verdict/element/area/#) are the
          // documented column names — counting them as verdict rows makes
          // the required header fail its own gate on 'weak'/'unverified'.
          const vRows = exitBody.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe2.test(l) && !/^\s*\|\s*(unit|element|area|verdict|#)\s*\|/i.test(l));
          const floor = scope === "fix" ? 1 : 2;
          if (vRows.length < floor) {
            missing.push(`## Exit review has ${vRows.length} verdict row(s), needs ≥${floor} — | unit | strong|adequate|weak|unverified | evidence | per major unit of the result`);
          }
          let unver = false, weakNoAcc = false, noEv = 0, noVerdict = 0;
          for (const l of vRows) {
            const cells = cellsOf(l);
            // Verdict words count in the VERDICT CELL only — the
            // documented column is position 2 (| unit | verdict | ev |).
            // A unit named 'strong button' or evidence text saying 'weak'
            // can't supply or fake the verdict.
            const vCell = cells.length >= 3 ? cells[1] : (cells.find((c) => /^(strong|adequate|weak|unverified)\b/i.test(c)) || "");
            const evC = cells[cells.length - 1] || "";
            if (!/^(strong|adequate|weak|unverified)\b/i.test(vCell)) { noVerdict++; continue; }
            if (/\bunverified\b/i.test(vCell)) unver = true;
            if (/\bweak\b/i.test(vCell)) {
              // `weak` survives only on verifiable user acceptance — the
              // STOP-DECLARED doctrine: '— user <verb>' plus a recorded
              // user pause/assent signal sharing a content word.
              const ok = /ACCEPTED\s*:[^|]*\buser\s+\w+/i.test(l) && acceptedOk(l);
              if (!ok) weakNoAcc = true;
            }
            if (!EVIDENCEISH2.test(evC)) noEv++;
          }
          if (noVerdict) missing.push(`## Exit review: ${noVerdict} row(s) carry no verdict cell (strong|adequate|weak|unverified) — a row without a verdict judges nothing`);
          if (unver) missing.push("## Exit review carries an `unverified` verdict — unverifiable means the loop isn't done; run the verification then re-verdict");
          if (weakNoAcc) missing.push("## Exit review carries a `weak` verdict without `ACCEPTED: — user <verb>` — a weak unit blocks termination; fix it or get the user's word");
          if (noEv) missing.push(`## Exit review: ${noEv} verdict row(s) carry no evidence token in the evidence cell — a verdict cites what it was judged on`);
          // v2 + rendered subjects: at least one verdict row's evidence
          // is external — the eyes artifact, a shot, a probe — not only
          // the author's own judgment. An all-self-verdicted review is
          // the author grading its own paper.
          if (iterV2 && uiSubject && vRows.length &&
              !vRows.some((l) => /\beyes\b|\.png\b|\bshots?\b|\bprobe\b|\bstranger\b/i.test(cellsOf(l)[cellsOf(l).length - 1] || ""))) {
            missing.push("## Exit review: no verdict row cites external evidence (eyes artifact, shot, probe) — a rendered subject's verdict pass needs at least one judgment that isn't the author's own");
          }
          // D3/M4 — rendered-eyes precondition: on a rendered subject the
          // loop can't converge without a stranger-on-pixels artifact that
          // EXISTS ON DISK and is cited in this record. The external-
          // evidence row above accepts the WORD 'eyes'; D3's gap was
          // convergence on defect-closure with no rendered-pixel pass at
          // all (gamersocial). Accepted cites: an .unlazy/eyes/*.md path
          // that resolves, basename carrying rendered vocabulary
          // (render|stranger|first-render) or the round-pass shape
          // (<sid>-rN.md — eyes-v2 grades pixels, not prose).
          if (iterV2 && uiSubject) {
            const eyeCites = [...itext_nf.matchAll(/\.unlazy[/\\]eyes[/\\]([\w.-]+\.md)/gi)].map((m) => m[1]);
            const renderedEye = eyeCites.some((f) => {
              if (!/(?:render|stranger|first-render)|-r\d+\.md$/i.test(f)) return false;
              return existsSync(join(ROOT, ".unlazy", "eyes", f));
            });
            if (!renderedEye) {
              missing.push("a rendered-eyes artifact cite that resolves on disk (`.unlazy/eyes/<…render|stranger|first-render|<sid>-rN….md>`) — a rendered subject can't converge on defect-closure alone: a stranger must have graded the pixels, not just the spec text");
            }
          }
          // Temporal anchor: the verdict must be authored after the last
          // implementation write — the tracker observes the section's
          // first appearance, so a backdated review can't fake it.
          const exitSeenT = state.exit_review_seen ? Date.parse(state.exit_review_seen) : NaN;
          const lastImplExit = state.last_impl_at ? Date.parse(state.last_impl_at) : NaN;
          if (state.exit_review_seen && Number.isNaN(exitSeenT)) {
            missing.push(`state.exit_review_seen (${String(state.exit_review_seen).slice(0, 30)}) isn't a parseable timestamp — a corrupted observation stamp can't vouch for the verdict's freshness`);
          } else if (state.exit_review_seen && !Number.isNaN(lastImplExit) && exitSeenT < lastImplExit) {
            missing.push(`## Exit review was first observed at ${state.exit_review_seen}, before the last impl write (${state.last_impl_at}) — the verdict must review the finished result; rewrite it post-impl`);
          } else if (!state.exit_review_seen && !Number.isNaN(lastImplExit) && state.last_impl_at) {
            // No observation stamp → the mtime fallback ENDED gets: an
            // artifact last written before the last impl write carries a
            // review that predates the work it judges.
            try {
              if (statSync(iterPath).mtimeMs < lastImplExit) {
                missing.push(`## Exit review was never tracker-observed and the artifact predates the last impl write (${state.last_impl_at}) — the verdict must review the finished result; rewrite it post-impl`);
              }
            } catch { /* mtime best-effort */ }
          }
        }
      }

      // The instrument changed under the loop — impl touching the gate,
      // tracker, hook config, gate checks/probes/skills, or rules mid-loop
      // must be DECLARED with what moved so the walk record notes the
      // ruleset moved beneath it.
      // `check-[\w-]+` was unscoped — a product file like
      // `app/ui/lib/check-status.js` forced a false instrument declaration
      // (R15-F30). Check scripts live at .devin/scripts/check-* only.
      if (implTouched.some((p) => /stop-gate|session-tracker|rejection-tracker|\.devin[\\/]scripts[\\/]check-[\w-]+|ui-coverage-probe|write-targets|hooks\.v1|(?:\.cursor\/)?rules\/|\.devin\/skills/i.test(p)) &&
          !/DECLARED\s*:\s*instrument\s*[—-]{1,2}\s*.{12,}/i.test(itext_nf)) {
        missing.push("the loop's own instrument changed mid-run (gate/tracker/checks/hooks/rules in impl_touched) — declare it: `DECLARED: instrument — <what moved>` (with the what) so the walk records the ruleset it was judged under");
      }

      if (missing.length) {
        failures.push(
          `ITERATION-LOOP: ${iterRel} is missing/malformed: ${missing.join("; ")} ` +
          `(16-iteration-loop.mdc). Or EXEMPT-LOOP: * — <reason> in ${evidenceRel}.`
        );
      }
    }
  }

  // No-residuals law: a BLOCKED: item is open work announced as a stop,
  // not a finished one. Any BLOCKED: row in a session artifact — including
  // a loop findings row — holds the gate until the work is done or the
  // stop is declared with evidence. This consumer runs after EVERY
  // producer (an earlier placement ran before the loop's pushes — dead code).
  if (blockedOpen.length) {
    const stopHitLines = (evidence.match(/^\s*STOP:\s*(?:BLOCKED|USER-GATE)\b.*$/gim) || []);
    // A STOP line must name WHAT is blocked — content-word overlap with
    // the blocked item, same doctrine as ACCEPTED's signal check. An
    // item-blind `STOP: BLOCKED — see above` clears nothing.
    const uncleared = blockedOpen.filter((item) => {
      // {loc,text} items (iteration findings) score words on the claim
      // only — the pointer's path words must not satisfy the overlap.
      const iw = contentWords(typeof item === "object" && item ? item.text : item);
      if (!iw.size) return true;
      return !stopHitLines.some((sl) => [...contentWords(sl)].some((w) => iw.has(w)));
    });
    if (uncleared.length) {
      const show = (it) => typeof it === "object" && it ? `${it.loc}: ${String(it.text).slice(0, 80)}` : it;
      failures.push(
        `OPEN-BLOCKED: ${uncleared.length} item(s) carry BLOCKED: with no scoped STOP line — finish the work, or declare ` +
        `\`STOP: BLOCKED — <the wall + evidence>\` / \`STOP: USER-GATE — <the question>\` in ${evidenceRel} naming the item ` +
        `(14-stop-integrity). First: "${show(uncleared[0])}"`
      );
    }
  }

  // --- cycle-plan (16-iteration-loop → batch protocol) ---------------------------
  tick("cycle-plan");
  // Backstop for check-cycle-plan.mjs: a lane-armed session that reached
  // implementation writes without satisfying the plan halves got past the
  // pre-edit gate somehow — flag it at stop. Arms only on injected lanes
  // (state.resume_lanes); an EXEMPT-CYCLEPLAN releases it like every check.
  {
    const laneList = Array.isArray(state.resume_lanes) ? state.resume_lanes : [];
    if (laneList.length && implTouched.length && !state.cycle_plan_satisfied && !exempt("CYCLEPLAN", "*")) {
      // Mirror check-cycle-plan.mjs's strengthened predicates: a
      // comprehensive todo list (≥3 items spanning ≥2 stage classes),
      // a content-bearing BATCH-PLAN row, and a BATCH-VERIFY row.
      const snap = Array.isArray(state.todos_snapshot) ? state.todos_snapshot : [];
      const classes = new Set();
      for (const t of snap) {
        const txt = String((t && (t.content || t.c || t.task || t.text)) || t || "");
        if (/\b(analy|examin|investigat|plan|travers|feasib|survey|read)\w*/i.test(txt)) classes.add("analyze");
        if (/\b(implement|fix|build|ship|land|wire|write|edit|patch|add|port)\w*/i.test(txt)) classes.add("implement");
        if (/\b(verif|check|test|probe|review|record|ledger|evidence|gate|capture|render|live|leak|lint|audit)\w*/i.test(txt)) classes.add("verify");
      }
      const hasTodos = snap.length >= 3 && classes.size >= 2;
      let hasPlan = false, hasVerify = false, hasAnalysis = false;
      const planLines = [], analysisText = [];
      for (const l of laneList) {
        if (!l || !l.doc) continue;
        try {
          const t = readText(l.doc) || "";
          // Driver-scoped ownership: a lane claiming `Driver: <other-sid>`
          // is not this session's work — skip it for parity like the
          // PreToolUse check and the arm-time scan do.
          const drv = docDriver(t.slice(0, 4000));
          if (drv && drv !== sid) continue;
          for (const line of t.split("\n")) {
            if (/\bBATCH-PLAN\s*:/i.test(line) &&
                (/\b(?:U\d+-F\d+|F\d{2,}|B\d{1,2}|R\d{1,2}-F\d+)\b/.test(line) || /BATCH-PLAN\s*:\s*\S+(?:\s+\S+){3,}/i.test(line))) {
              hasPlan = true;
              planLines.push(line);
            }
            if (/\bBATCH-VERIFY\s*:/i.test(line) &&
                /\b(?:node\s|--check|build|probe|leak|lint|test|verify|shot|capture|gate|render|live)\b/i.test(line)) hasVerify = true;
            if (/\bBATCH-ANALYSIS\s*:/i.test(line) && /BATCH-ANALYSIS\s*:\s*\S+(?:\s+\S+){3,}/i.test(line) &&
                /\w[\w./-]*\.(?:js|mjs|cjs|ts|tsx|py|css|html|j2|json|md|mdc):\d+|`[^`]{2,}`|\b(?:route|endpoint|field|column|serializer|schema|payload|param|key|function|helper|component|view|table|migration|adapter|selector|prop|store|api)\b/i.test(line)) {
              hasAnalysis = true;
              analysisText.push(line);
            }
          }
        } catch { /* unreadable doc — counted as missing */ }
      }
      // Parity (quartet): ids in the CURRENT batch's plan rows (beyond
      // the count at last satisfaction) must be covered by analysis rows
      // and by the todo list — earlier batches' ids were covered by
      // their own todos; slicing on batch_plans_seen keeps the backstop
      // from flagging stale history.
      const newPlanIds = [...new Set(
        planLines.slice(state.batch_plans_seen || 0).join("\n")
          .match(/\b(?:U\d+-F\d+|F\d{2,}|R\d{1,2}-F\d+)\b/g) || []
      )];
      const analysisJoined = analysisText.join("\n");
      const todoJoined = snap.map((t) => String((t && (t.content || t.c || t.task || t.text)) || t || "")).join("\n");
      const idsNoAnalysis = newPlanIds.filter((id) => !analysisJoined.includes(id));
      const idsNoTodos = newPlanIds.filter((id) => !todoJoined.includes(id));
      if (!hasTodos || !hasPlan || !hasVerify || !hasAnalysis || idsNoAnalysis.length || idsNoTodos.length) {
        const missing = [
          !hasTodos ? "a comprehensive todo list (≥3 items spanning ≥2 of analyze/plan, implement, verify stages)" : null,
          !hasPlan ? "a BATCH-PLAN: row naming the batch's items" : null,
          !hasVerify ? "a BATCH-VERIFY: row naming the batch's checks" : null,
          !hasAnalysis ? "a BATCH-ANALYSIS: row per planned finding" : null,
          idsNoAnalysis.length ? `analysis covering plan ids: ${idsNoAnalysis.join(", ")}` : null,
          idsNoTodos.length ? `todo items covering plan ids: ${idsNoTodos.join(", ")}` : null,
        ].filter(Boolean).join("; ");
        failures.push(
          `CYCLE-PLAN: a standing lane armed this session (${laneList.map((l) => `${String(l.doc || "").split(/[\\/]/).pop()} — ${l.open} open`).join(", ")}) ` +
          `and implementation writes landed without ${missing} ` +
          `— a resumed lane opens with plan-before-edit, not edit-then-plan (16-iteration-loop → batch protocol; check-cycle-plan.mjs). ` +
          `Post the full plan set, or EXEMPT-CYCLEPLAN: * — <reason> in ${evidenceRel}.`
        );
      }
    }
  }

  // --- lane-progress (14-stop-integrity → auto-resume) ----------------------------
  tick("lane-progress");
  // The ignore-and-stop hole: a session injected with RESUME-LANE that
  // neither touched the lane's domain (any impl write, or any ledger/.unlazy
  // doc write) nor declared its exit (STOP:/ACCEPTED:/DRIVE:/LANE-DECLINE:)
  // idled on standing work. Engagement is the floor — progress on the lane
  // itself is verified by the open-work gates and CYCLE-PLAN.
  {
    const laneList = Array.isArray(state.resume_lanes) ? state.resume_lanes : [];
    if (laneList.length && !exempt("LANEPROGRESS", "*")) {
      const docWrites = [...(state.plan_docs || []), ...(state.marker_docs || [])]
        .some((f) => /\.unlazy[\\/]|docs|\.md$/i.test(String(f)));
      const discharged = /^\s*(?:LANE-DECLINE|STOP|ACCEPTED|ACCEPTED-DEFERRAL|DRIVE|IMPOSSIBLE|LANE)\s*:/im.test(evidence || "");
      if (!implTouched.length && !docWrites && !discharged) {
        failures.push(
          `LANE-PROGRESS: RESUME-LANE armed this session (${laneList.map((l) => `${String(l.doc || "").split(/[\\/]/).pop()} — ${l.open} open`).join(", ")}) ` +
          `but the session neither worked (no implementation or ledger writes) nor declared an exit — an open lane is the standing ` +
          `assignment (14-stop-integrity → auto-resume). Work it, or declare STOP:/ACCEPTED:/IMPOSSIBLE: with the item named in ` +
          `${evidenceRel} — or EXEMPT-LANEPROGRESS: * — <reason>.`
        );
      }
    }
  }

  // --- analysis-mandate (15-analysis-depth → the mandate) ------------------------
  tick("analysis-mandate");
  // The user's depth ask: substantive implementation owes an extensive
  // analysis doc carrying the plan inside it — armed on impl signals, not
  // on the user asking. Narrow work declares DECLARED: fix-scale — <why>
  // in gate-evidence (audited, escape-telemetry counted); EXEMPT is the
  // legal out. The doc itself owes the full analysis-project schema
  // (checked above) including Implementation plan / Plan review / Drill.
  {
    const implCount = (state.impl_touched || []).length;
    // ui_touched is a persisted PATH ARRAY (session-tracker default []),
    // never a bool — !![] is true, so length is the read (eyes pass, crit).
    const uiCount = (state.ui_touched || []).length;
    const laneArmed = Array.isArray(state.resume_lanes) && state.resume_lanes.length > 0;
    const substantive = implCount >= 2 || uiCount >= 1 || (laneArmed && implCount >= 1);
    const fixScale = /DECLARED\s*:\s*fix[-\s]?scale\b[^\n]*(?:—|--|::|-)\s*\S{8,}/i.test(evidence || "");
    if (substantive && !fixScale && !exempt("ANALYSISMANDATE", "*")) {
      // Satisfy requires the DEEP doc: v2 marker + subject-class
      // project|process — a v1 or unit-class doc skips every floor this
      // mandate exists to enforce (eyes pass, satisfy-bypass major).
      const deepDoc = (t) =>
        hasMarker(t, "analysis-project v2") &&
        /subject-class\s*:\s*(?:project|process)\b/i.test(t);
      let docFound = false;
      let foundPath = "";
      const cand = [...(state.marker_docs || []), ...(state.plan_docs || []), ...(state.audit_armed || [])];
      for (const p of cand) {
        try {
          const t = readText(existsSync(p) ? p : join(ROOT, p)) || "";
          if (deepDoc(t)) { docFound = true; foundPath = p; break; }
        } catch { /* unreadable — try next */ }
      }
      if (!docFound && state.analysis_doc_written) {
        // Dir-scan catches docs written outside the tracker (shell writes);
        // session-written corroboration: mtime at/after the first tracked
        // impl write when one exists (a stale doc from a prior session
        // can't satisfy this session's mandate).
        const implBase = (state.impl_log || [])[0] || 0;
        try {
          const adir = join(ROOT, ".unlazy", "analysis");
          if (existsSync(adir)) {
            for (const f of readdirSync(adir)) {
              if (!/\.md$/i.test(f)) continue;
              const fp = join(adir, f);
              try {
                if (implBase && statSync(fp).mtimeMs < implBase) continue;
                if (deepDoc(readText(fp) || "")) { docFound = true; foundPath = fp; break; }
              } catch { /* unreadable — try next */ }
            }
          }
        } catch { /* dir unreadable — treated as missing */ }
      }
      // Subject affinity (the doc-spam question): the newest deep doc in
      // .unlazy/analysis/ is the presumptive active subject. A session
      // satisfying via a DIFFERENT deep doc without touching the active
      // one owes `DECLARED: new-subject — <why>` — minting parallel docs
      // for the same subject is the flagged thing; a real subject change
      // is a declared, auditable fork. Task identity isn't computable,
      // so recency is the mechanical proxy and the declaration is the
      // honest override.
      if (docFound) {
        const newSubj = /DECLARED\s*:\s*new[-\s]?subject\b[^\n]*(?:—|--|::|-)\s*\S{8,}/i.test(evidence || "");
        try {
          const adir = join(ROOT, ".unlazy", "analysis");
          if (existsSync(adir) && !newSubj) {
            let latest = null;
            for (const f of readdirSync(adir)) {
              if (!/\.md$/i.test(f) || /^_/.test(f)) continue;
              const fp = join(adir, f);
              try {
                if (!deepDoc(readText(fp) || "")) continue;
                const m = statSync(fp).mtimeMs;
                if (!latest || m > latest.m) latest = { fp, m };
              } catch { /* unreadable — skip */ }
            }
            const norm = (s) => { try { return resolve(ROOT, s).toLowerCase().replace(/\\/g, "/"); } catch { return String(s || "").toLowerCase(); } };
            const touchedLatest = (cand || []).some((p) => norm(p) === norm(latest && latest.fp));
            if (latest && norm(latest.fp) !== norm(foundPath) && !touchedLatest) {
              failures.push(
                `ANALYSIS-MANDATE (subject affinity): a newer analysis doc exists at \`${relPath(latest.fp)}\` but this session satisfied via \`${relPath(foundPath)}\` — ` +
                `extend the active subject doc unless the work genuinely changed subject; when it did, ` +
                `\`DECLARED: new-subject — <why>\` in ${evidenceRel} makes the fork auditable (parallel docs for one subject = ledger spam).`
              );
            }
          }
        } catch { /* affinity scan failed open */ }

        // Mechanical nested-surface discovery (the modal's second page):
        // scan session-touched UI sources for nested-surface triggers —
        // modal/dialog/drawer/sheet/sub-page open calls. Every file with
        // hits must be enumerable inside the doc's `## Drill` — either a
        // row carrying its basename or a `drill-scan:` line, or an earned
        // `DECLARED:` naming where those surfaces are owned (a different
        // analysis/ledger). Discovery is now mechanical; only the
        // disposition is attested.
        if (uiCount) {
          const NESTED_RE = /(?:open|show|toggle|launch|mount)[A-Z][A-Za-z]*(?:Modal|Dialog|Drawer|Sheet|Popover|Overlay|Panel|Page)|(?:openModal|showDialog|openDrawer|openSheet|setModal|subPage|second[-\s]?page|pageStack)/i;
          const hits = [];
          for (const uf of (state.ui_touched || [])) {
            try {
              const fp = existsSync(uf) ? uf : join(ROOT, uf);
              if (!/\.(?:js|j2|html?)$/i.test(fp) || !existsSync(fp)) continue;
              if ((statSync(fp).size || 0) > 400000) continue;
              const body = readText(fp) || "";
              if (NESTED_RE.test(body)) hits.push(relPath(fp));
            } catch { /* unreadable — skip */ }
          }
          if (hits.length) {
            let drillAck = false;
            try {
              const docT = readText(existsSync(foundPath) ? foundPath : join(ROOT, foundPath)) || "";
              const dr = h2SectionBody(docT.replace(/<!--|-->/g, ""), "Drill");
              drillAck = !!dr && hits.every((h) => {
                const base = basename(h).toLowerCase();
                return dr.toLowerCase().includes(base);
              }) || /drill-scan\s*:|DECLARED\s*:/i.test(dr);
            } catch { /* doc unreadable — no ack */ }
            if (!drillAck) {
              failures.push(
                `ANALYSIS-MANDATE (drill-scan): ${hits.length} session-touched UI file(s) carry nested-surface triggers ` +
                `(modal/dialog/drawer/sheet/sub-page open calls) — ${hits.slice(0, 8).join(", ")}${hits.length > 8 ? ` +${hits.length - 8} more` : ""}. ` +
                `The doc's \`## Drill\` must enumerate each hit file (a row per surface or a \`drill-scan:\` line naming them), ` +
                `or \`DECLARED:\` where those surfaces are owned — a page's modal, and the modal's second page, are units of the work, not footnotes.`
              );
            }
          }
        }
      }
      if (!docFound) {
        failures.push(
          `ANALYSIS-MANDATE: substantive implementation landed (${implCount} impl file(s)${uiCount ? ", UI touched" : ""}${laneArmed ? ", lane armed" : ""}) ` +
          `with no \`<!-- analysis-project -->\` doc written this session — an extensive per-section analysis + ` +
          `the plan inside it is mandatory on real work, not ask-gated (15-analysis-depth → the mandate). ` +
          `Write \`.unlazy/analysis/<name>.md\` (the canonical home — a deep doc under any recorded path satisfies; ` +
          `the dir is convention, not cage) with the marker + Universe/units + ## Implementation plan + ## Plan review + ## Drill, ` +
          `or declare \`DECLARED: fix-scale — <why>\` in ${evidenceRel} for genuinely narrow work — or EXEMPT-ANALYSISMANDATE: * — <reason>.`
        );
      }
    }
  }

  // --- instrument-drift ----------------------------------------------------
  tick("instrument-drift");
  // I3: path-name watches see edits, not effects — git checkout/stash,
  // patch, tar extraction, and delegated writes produce marker strings in
  // impl_touched (`git-write:*`, `patch:*`, `delegated:*`) while the
  // instrument tree changes under them (the probe-tamper evasion class).
  // The session-start manifest diffs the tree itself; any delta owes
  // DECLARED: instrument — <what moved> in gate-evidence or the lane doc.
  {
    const base = state.instrument_manifest;
    if (base && base.files && typeof base.files === "object") {
      const cur = buildInstrumentManifest(ROOT);
      const d = diffInstrumentManifests(base, cur);
      const moved = [...d.changed, ...d.missing, ...d.added];
      let laneText = "";
      try { laneText = readText(join(ROOT, ".unlazy", "iteration", `${sid}.md`)) || ""; } catch { /* no lane doc */ }
      const declared = /DECLARED\s*:\s*instrument\s*[—–-]{1,2}\s*\S.{8,}/i.test((evidence || "") + "\n" + laneText);
      if (moved.length && !declared && !exempt("INSTRUMENT", "*")) {
        failures.push(
          `INSTRUMENT-DRIFT: the instrument tree changed since session start — ${moved.slice(0, 8).join(", ")}${moved.length > 8 ? ` +${moved.length - 8} more` : ""}. ` +
          `git/patch/extract/delegated writes evade the path watch; effects are hashed now. Declare what moved: ` +
          `\`DECLARED: instrument — <what moved>\` in ${evidenceRel} or the lane doc. Or EXEMPT-INSTRUMENT: * — <reason>.`
        );
      }
      // Advance the shared baseline only on a settled tree — clean, or the
      // delta declared — so an undeclared drift diffs again next session.
      if (!moved.length || declared) writeSharedManifest(ROOT, cur);
    }
  }

  // --- instrument-eyes -----------------------------------------------------------
  tick("instrument-eyes");
  // The enforcement tree grades every session's work, but nothing graded
  // edits TO the tree — gate scripts, hooks, rules, skills carry the
  // highest blast radius in the repo (a broken check corrupts every
  // future session's signal) with the least scrutiny (no review check
  // armed on the class). Session-found failure (a prior session): a whole
  // new gate + tracker edits + three rule edits shipped on self-written
  // tests alone. Instrument edits owe an independent-eyes record — a
  // MACHINERY-EYES: line naming scope + reviewer + verdict, backed by a
  // recorded subagent launch or a deposited eyes artifact — or a
  // DECLARED: self-review / EXEMPT-INSTRUMENTEYES escape. A self-grade
  // with no degrade-marker does not pass.
  {
    const inst = [...(state.impl_touched || []), ...(state.ui_touched || [])]
      .map((p) => String(p).replace(/\\/g, "/"))
      .filter((p) => /\.devin\/(?:scripts|skills)\/|\.devin\/hooks|(?:\.cursor\/)?rules\//i.test(p));
    if (inst.length && !exempt("INSTRUMENTEYES", "*")) {
      let instLane = "";
      try { instLane = readText(join(ROOT, ".unlazy", "iteration", `${sid}.md`)) || ""; } catch { /* no lane doc */ }
      // Armed lane docs are legitimate homes for the record too — a
      // MACHINERY-EYES:/DECLARED: line inside a resume_lanes doc counts
      // (same channel INSTRUMENT-DRIFT already reads).
      for (const lane of (state.resume_lanes || [])) {
        const lp = typeof lane === "string" ? lane : (lane && lane.doc);
        if (!lp) continue;
        const abs = existsSync(lp) ? lp : join(ROOT, lp);
        try { instLane += "\n" + (readText(abs) || ""); } catch { /* unreadable lane */ }
      }
      const evAll = (evidence || "") + "\n" + instLane;
      // Mention ≠ use: a backticked `DECLARED: self-review — <why>` inside
      // prose describing the escape (as this comment itself contains) must
      // not satisfy it — strip inline-code spans before matching, the same
      // convention OPEN-LEDGER/constraint-expiry apply.
      const evLines = evAll.split(/\r?\n/).map(stripSpans);
      const declared = evLines.some((l) =>
        /DECLARED\s*:\s*(?:self-review|instrument-eyes)\s*[—–-]{1,2}\s*\S.{14,}/i.test(l));
      if (!declared) {
        // The reviewer-class test runs on the post-marker remainder —
        // testing the full line is tautological (the literal
        // "MACHINERY-EYES:" contains "eyes").
        const meRest = evLines
          .map((l) => {
            const m = l.match(/MACHINERY-EYES\s*:\s*([\s\S]*)$/i);
            return m ? m[1] : null;
          })
          .find((r) => r && /\S.{39,}/.test(r));
        const provenance =
          (state.critique_agents || []).length > 0 ||
          (state.subagent_launches || []).length > 0 ||
          (() => {
            try {
              // Subject-scoped: an unrelated eyes pass (a first-render
              // artifact for a design surface) doesn't count — the
              // deposited file must name the machinery/instrument pass.
              return readdirSync(join(ROOT, ".unlazy", "eyes")).some(
                (f) => f.startsWith(sid) && /machinery|instrument/i.test(f)
              );
            } catch { return false; }
          })();
        const independent = meRest && /subagent|sub-agent|agent|eyes|fresh|peer/i.test(meRest) && provenance;
        if (!independent) {
          const files = [...new Set(inst.map((p) => p.split("/").slice(-2).join("/")))];
          failures.push(
            `INSTRUMENT-EYES: ${files.length} instrument-class file(s) edited this session (${files.slice(0, 5).join(", ")}${files.length > 5 ? ` +${files.length - 5} more` : ""}) carry no independent-eyes record — ` +
            `the highest-blast-radius edits get the least scrutiny. Deposit the pass: \`MACHINERY-EYES: <scope> — <reviewer>: <what it examined + verdict>\` ` +
            `in ${evidenceRel} (a subagent/eyes reviewer needs a recorded launch or a .unlazy/eyes/ artifact this session; self-review only counts as ` +
            `\`DECLARED: self-review — <why no independent pass>\`). Or EXEMPT-INSTRUMENTEYES: * — <reason>.`
          );
        }
      }
    }
  }

  // --- constraint-expiry (autopsy U8-5) ------------------------------------------
  tick("constraint-expiry (autopsy U8-5)");
  // The constraint table changed mid-session: a no-edit constraint was
  // recorded, then an implement-shaped ask lifted it. A verdict written
  // under the old table does not expire on its own — every session doc
  // carrying impossibility-verdict vocabulary re-opens until
  // `RE-DISPOSITIONED:` in gate-evidence declares the re-check.
  if ((state.constraint_marks || []).length && state.constraint_lifted &&
      !/RE-DISPOSITIONED\s*:/i.test(evidence) && !exempt("CONSTRAINTEXPIRY", "*")) {
    const stale = [];
    for (const docPath of (state.plan_docs || [])) {
      if (/\.unlazy[\/\\]eyes[\/\\]/i.test(docPath)) continue;
      const absDoc = existsSync(docPath) ? docPath : join(ROOT, docPath);
      if (!existsSync(absDoc)) continue;
      const hits = (readText(absDoc) || "").split(/\r?\n/).map(stripSpans)
        .filter((l) => VERDICT_RE.test(l) && !disposedOf(l, acceptedOk)).length;
      if (hits) stale.push(`${docPath} (${hits} verdict line(s))`);
    }
    if (stale.length) {
      failures.push(
        `CONSTRAINT-EXPIRY: a no-edit constraint was recorded, then lifted (${String(state.constraint_lifted.excerpt || "").slice(0, 60)}…) — ` +
        `${stale.length} doc(s) still carry verdict lines written under the old table: ${stale.slice(0, 3).join("; ")}. ` +
        `A verdict is legal only under the constraint it was written under — re-examine each and either update the line or declare ` +
        `\`RE-DISPOSITIONED: <doc> — <what was re-checked>\` in ${evidenceRel} (autopsy U8-5). Or EXEMPT-CONSTRAINTEXPIRY: * — <reason>.`
      );
    }
  }

  // --- state-corroboration (O-F11 / autopsy U8-4) ---------------------------------
  tick("state-corroboration (O-F11 / autopsy U8-4)");
  // Gate-state is agent-writable JSON — the gate re-derives what it can
  // instead of trusting the record. Claims that disagree with disk are
  // forged-state or lost-artifact signals either way; the gate flags,
  // it does not adjudicate which.
  {
    const corro = [];
    const relOf = (p) => (existsSync(p) ? p : join(ROOT, p));
    const normForExempt = (p) => String(p).replace(/\\/g, "/").replace(/^.*?\.unlazy\//, ".unlazy/").replace(/^.*?((?:app|src|lib|pkg)\/)/, "$1");
    for (const p of (state.plan_docs || []).slice(0, 30)) {
      // A missing doc with a MISSING/LEDGER disposition is already
      // reconciled debt — corroboration flags only the UNDISPOSED gap.
      if (exempt("MISSING", p) || exempt("MISSING", normForExempt(p)) ||
          exempt("LEDGER", p) || exempt("LEDGER", normForExempt(p))) continue;
      if (!existsSync(relOf(p))) corro.push(`plan_docs entry missing from disk: ${p}`);
    }
    if (state.audit_ledger_written && !existsSync(join(ROOT, ".unlazy", "audit-ledger", `${sid}.md`))) {
      corro.push("audit_ledger_written but no ledger file on disk");
    }
    // Obligation-bearing artifact claims — a touched scratch file that
    // gets deleted is healthy work, not divergence; what corroboration
    // binds is a STATE CLAIM that an artifact exists.
    if (state.design_spec_at && !existsSync(join(ROOT, ".unlazy", "design-spec", `${sid}.md`))) {
      corro.push("design_spec_at stamped but no design-spec file on disk");
    }
    if ((state.ui_touched || []).length && !existsSync(join(ROOT, ".unlazy", "design-review", `${sid}.md`))) {
      corro.push("ui_touched armed but no design-review file on disk");
    }
    if (state.analysis_doc_written && !(state.audit_armed || []).some((p) => existsSync(relOf(p)))) {
      corro.push("analysis_doc_written but no armed analysis doc exists on disk");
    }
    if (corro.length && !exempt("CORROBORATION", "*")) {
      failures.push(
        `STATE-CORROBORATION: gate-state disagrees with disk — ${corro.join("; ")}. ` +
        `State files are agent-writable; divergence is forged state or lost artifacts — reconcile the record, or ` +
        `\`EXEMPT-CORROBORATION: * — <reason>\` in ${evidenceRel} (O-F11, autopsy U8-4).`
      );
    }
  }

  // --- gatecheck (06-subagent-gatecheck) ------------------------------------------
  tick("gatecheck (06-subagent-gatecheck)");
  // A launched subagent's "success" is a summary, not evidence — the
  // coordinator re-reads the critical source. The GATECHECK: line in
  // gate-evidence records what was re-verified.
  if ((state.subagent_launches || []).length && !exempt("GATECHECK", "*") &&
      !/\bGATECHECK\s*:\s*\S/i.test(evidence)) {
    failures.push(
      `GATECHECK: ${(state.subagent_launches || []).length} subagent launch(es) this session with no ` +
      `\`GATECHECK: <what source was re-read after each "success">\` line in ${evidenceRel} — ` +
      `a subagent report is a summary, not evidence (06-subagent-gatecheck). Or EXEMPT-GATECHECK: * — <reason>.`
    );
  }

  // --- bypass-disposition (O-F2) ------------------------------------------------
  tick("bypass-disposition (O-F2)");
  // A recorded stop-bypass released unresolved failures once — it is a
  // debt, not an exit. Before this stop closes, each bypass on record
  // needs a disposition line in gate-evidence: RESOLVED-BYPASS: <what
  // now satisfies the released failures> or ACCEPTED-BYPASS: <the user's
  // in-session verb accepting them>. A bypass with no disposition is
  // work that left the session wearing a loop-guard costume.
  if ((state.stop_bypasses || []).length && !exempt("BYPASS", "*")) {
    const n = state.stop_bypasses.length;
    const ok = new RegExp(`(?:RESOLVED-BYPASS|ACCEPTED-BYPASS)\\s*:\\s*\\S.{20,}`, "i").test(evidence);
    if (!ok) {
      failures.push(
        `BYPASS-DISPOSITION: ${n} stop-bypass(es) released unresolved failure(s) this session ` +
        `(e.g. "${(state.stop_bypasses[0].failures || [])[0] || "?"}") with no disposition in ${evidenceRel} — ` +
        `a bypass is recorded debt, not resolution: RESOLVED-BYPASS: <what now satisfies them> or ACCEPTED-BYPASS: <user verb>.`
      );
    }
  }

  // --- closure-staleness join (EF-F3) ------------------------------------------
  tick("closure-staleness join (EF-F3)");
  // The tracker nags once when an implementation write lands after a
  // CLOSURE: stamp — a fired-but-unsatisfied nag was invisible at stop.
  // The join: if the staleness nag fired and no STALE-CLOSURE: line
  // re-dispositions the stale closure, the closure it covered is open.
  if (state.cl_nag_done && !exempt("STALECLOSURE", "*")) {
    const ok = /STALE-CLOSURE\s*:\s*\S.{20,}/i.test(evidence);
    if (!ok) {
      failures.push(
        `STALE-CLOSURE: a CLOSURE: stamp was followed by a later implementation write (the tracker nagged mid-session) ` +
        `with no re-disposition in ${evidenceRel} — re-verify the closed item and add STALE-CLOSURE: <what the later write ` +
        `changed + re-verification>, or EXEMPT-STALECLOSURE: * — <reason> (DD-F3).`
      );
    }
  }

  // --- design-arithmetic verdict ------------------------------------------------
  tick("design-arithmetic verdict");
  // The probe→state→gate join (Phase 4): check-design-arithmetic.mjs
  // writes .unlazy/gate-state/<sid>-design-arithmetic.json on rendered-
  // file edits; un-dispositioned flags block sessions carrying a v3
  // spec. The probe computes; the gate only reads (O(1) at stop-time).
  try {
    const arithPath = join(STATE_DIR, `${sid}-design-arithmetic.json`);
    if (existsSync(arithPath)) {
      const arith = JSON.parse(readText(arithPath) || "{}");
      const flags = Array.isArray(arith.flags) ? arith.flags : [];
      if (arith.spec_v3 && flags.length && !exempt("DESIGN-ARITHMETIC", "*")) {
        failures.push(
          `DESIGN-ARITHMETIC: ${flags.length} un-dispositioned arithmetic flag(s) — ${flags.join(" | ")}. ` +
          `The math can't be argued with: re-tone the tokens, densify the surface, widen the shell — ` +
          `or disposition per-flag in ${evidenceRel} (DECLARED: tonal/density/shell — <why>) or EXEMPT-DESIGN-ARITHMETIC: * — <reason>.`
        );
      }
    }
  } catch { /* verdict parse failing open — the probe rewrites it next edit */ }

  // --- ambition-floor (A1–A8, ambition-floor-analysis F1–F8) ----------------------
  tick("ambition-floor");
  // The unpriced joints: every other check measures compliance inside a
  // declared scope — these price the scope itself on breadth-marked
  // improve-asks. Each arms only when its triggering document shape
  // exists; a session with no universe table / no breadth marker / no
  // spec promises never meets it.
  try {
    const BREADTH = /\b(?:each|every|all|per[-\s]|across|throughout)\b[^|\n]{0,45}\b(?:tab|page|surface|panel|screen|view|desk|section)s?\b/i;
    const afDoc = (p) => { const fp = existsSync(p) ? p : join(ROOT, p); try { return existsSync(fp) ? fenceStrip(readText(fp) || "") : ""; } catch { return ""; } };
    const specRel = `.unlazy/design-spec/${sid}.md`, revRel = `.unlazy/design-review/${sid}.md`;
    const specT = afDoc(specRel), revT = afDoc(revRel);
    const anaDocs = [...new Set([...(state.plan_docs || []), ...(state.marker_docs || []), ...(state.audit_armed || [])])]
      .filter((p) => /analysis/i.test(String(p))).map((p) => ({ p: String(p), t: afDoc(p) })).filter((d) => d.t);
    const HDR1 = /^\s*\|\s*(?:unit|surface|tab|page|#|element|question|constraint|check|id|no\.?|direction|option|verdict|item|finding)\b/i;
    const tblRows = (t) => t.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !HDR1.test(l));
    const uniCount = Math.max(specT ? tblRows(specT).length : 0, ...anaDocs.map((d) => tblRows(d.t).length), 0);
    const breadthMarked = BREADTH.test(specT) || anaDocs.some((d) => BREADTH.test(d.t));
    const armed = (breadthMarked || uniCount >= 5) && (specT || revT || anaDocs.length);
    const amb = [];
    if (armed && !exempt("AMBITION", "*")) {
      const allDocs = [{ p: specRel, t: specT }, { p: revRel, t: revT }, ...anaDocs].filter((d) => d.t);
      const corpus = allDocs.map((d) => d.t).join("\n");
      // A1 VERDICT-FLOOR: a per-surface verdict cell that is one bare
      // adjective is an unexamined disposition (F1).
      const ADJ = /^(?:fine|ok(?:ay)?|good|adequate|complete|done|solid|mature|working|strong|clean|acceptable|sufficient|fine as-is|powerful)\.?$/i;
      const badV = new Set();
      for (const { p, t } of allDocs) {
        for (const l of tblRows(t)) {
          const cells = l.split("|").slice(1, -1).map((c) => c.trim());
          if (cells.length >= 2 && ADJ.test(cells[cells.length - 1] || "")) badV.add(p.split(/[\\/]/).pop());
        }
      }
      if (badV.size) amb.push(`VERDICT-FLOOR: per-surface verdict cell(s) are bare adjectives in ${[...badV].join(", ")} — verdicts are 'improve — <change>' / 'keep — <why ≥40 chars>' / 'blocked — <wall>' (ambition-floor F1)`);
      // A2 KEEP-ALIBI: deliberate/already/mature without a bar-claim (F2).
      // Deciding docs only — an analysis doc QUOTING a spec's set-aside is
      // evidence, not an assertion (mention-vs-use, same doctrine as the
      // deferral scan's span-strip).
      // Decision-shaped keeps only — `keep —`, `keeps:`, `dropped —`,
      // `SET-ASIDE:` — a retention-verb "keeps them bullets" is prose,
      // not a disposition (read-back false positive, first live run).
      const KEEPLINE = /\b(?:keeps?|kept|drop(?:ped)?|declin\w+|set[-\s]?aside)\b\s*(?:—|--|::|:)/i;
      const ALIBI = /\b(?:deliberate|by design|already|mature|working)\b/i;
      const BARCLAIM = /\b(?:because|holds|at[-\s]?bar|earns|against the ask|bar property)\b/i;
      const stripQ = (l) => l.replace(/"[^"\n]*"/g, " ").replace(/`[^`\n]*`/g, " ");
      const alibi = [specT, revT].join("\n").split(/\r?\n/).filter((l) => { const s = stripQ(l); return KEEPLINE.test(s) && ALIBI.test(s) && !BARCLAIM.test(s); }).length;
      if (alibi) amb.push(`KEEP-ALIBI: ${alibi} keep/drop reason(s) lean on deliberate/already/mature with no bar-claim — 'keep — <why>' must assert a property ("holds because <X>"); prior intent is not a user bar (ambition-floor F2)`);
      // A3 PROMISE-PARITY: every ## Inventory unit id needs a shipped/
      // dropped/blocked disposition in the review+analysis corpus (F3).
      if (specT && revT) {
        const invB = h2SectionBody(specT, "Inventory") || sectionBody(specT, "inventory");
        const promised = [...new Set([...(invB || "").matchAll(/\b([A-Z]{1,3}\d+)\b/g)].map((m) => m[1]))];
        const DISPO = /\b(?:shipped|implemented|dropped|declined|blocked|kept|set[-\s]?aside|rejected|delivered|landed)\b/i;
        const missing = promised.filter((id) => {
          const shipCorpus = revT + "\n" + anaDocs.map((d) => d.t).join("\n");
          const i = shipCorpus.indexOf(id);
          return i < 0 || !DISPO.test(shipCorpus.slice(i, i + 160));
        });
        if (missing.length) amb.push(`PROMISE-PARITY: ${missing.length} ## Inventory unit(s) (${missing.slice(0, 4).join(", ")}) carry no shipped/dropped/blocked disposition — an un-dispositioned promise is invisible, not closed (ambition-floor F3)`);
      }
      // A4 UNIVERSE-VERDICTS: the review must reach the spec's declared
      // surface universe, not only repainted ones (F4). Stems come from
      // the spec's own universe table — analysis-doc unit tables are
      // examination units, not surfaces.
      if (revT && specT && tblRows(specT).length >= 5) {
        const stems = [...new Set(tblRows(specT)
          .map((l) => ((l.split("|")[1] || "").match(/[A-Za-z][\w-]{3,}/) || [""])[0].toLowerCase())
          .filter((s) => s.length > 3))];
        const missed = stems.filter((s) => !revT.toLowerCase().includes(s));
        if (missed.length >= Math.min(5, Math.ceil(stems.length / 2)) && missed.length) {
          amb.push(`UNIVERSE-VERDICTS: review names ${stems.length - missed.length}/${stems.length} enumerated surface stems — missed: ${missed.slice(0, 4).join(", ")} — every enumerated unit needs a verdict or 'defended — <property>' (ambition-floor F4)`);
        }
      }
      // A5 SWING-DECLARED: the auditable scope ceiling (F8).
      if (specT && breadthMarked && !/^\s*swing\s*:/im.test(specT) && !/DECLARED\s*:\s*swing\s*(?:—|--|::| - )/i.test(specT + evidence)) {
        amb.push("SWING-DECLARED: breadth-marked ask, no `swing: polish|consolidate|restructure|rebuild` declaration in the spec — the swing class is the auditable scope ceiling (ambition-floor F8)");
      }
      // A6 DIRECTION-DIVERGENCE: ≥1 direction must vary coverage, not
      // only risk/hue — or DECLARED: directions (F5).
      if (specT && breadthMarked) {
        const dirB = sectionBody(specT, "directions");
        const dirRows = tblRows(dirB || "");
        if (dirRows.length >= 2 && !/\b(?:coverage|per[-\s]?(?:tab|unit)|each|every|wave|anatomy|skeleton|restructure|chassis|breadth)\b/i.test(dirB) && !/DECLARED\s*:\s*directions\s*(?:—|--|::| - )/i.test(specT + evidence)) {
          amb.push(`DIRECTION-DIVERGENCE: ${dirRows.length} directions, none varies universe coverage (per-unit wave / anatomy / chassis) — same-payoff-class alternatives are strawmen by construction (ambition-floor F5)`);
        }
      }
      // A7 CAPTURE-PARITY: PNG evidence without probe offsets (F6).
      try {
        const capDir = join(ROOT, ".unlazy", "captures"), covDir = join(ROOT, ".unlazy", "coverage");
        const pngs = existsSync(capDir) ? readdirSync(capDir).filter((f) => f.endsWith(".png")) : [];
        if (pngs.length && (state.ui_touched || []).length) {
          const newestPng = Math.max(...pngs.map((f) => statSync(join(capDir, f)).mtimeMs));
          const covs = existsSync(covDir) ? readdirSync(covDir).filter((f) => f.endsWith(".json") && f.includes(sid)) : [];
          const newestCov = covs.length ? Math.max(...covs.map((f) => statSync(join(covDir, f)).mtimeMs)) : 0;
          if (newestPng > newestCov) amb.push(`CAPTURE-PARITY: ${pngs.length} PNG capture(s), no coverage offsets newer — rendered and measured evidence are different classes; run ui-coverage-probe (ambition-floor F6)`);
        }
      } catch { /* capture dirs best-effort */ }
      // A8 UNIVERSE-CLOSURE: a closure line naming a surface-set owes
      // ≥2 surface cites — the umbrella keep one layer down (F7).
      const SETITEM = /\b(?:each|every|all)\s+(?:tab|page|surface|panel)s?\b/i;
      const cloBad = revT.split(/\r?\n/).filter((l) => /\bCLOSURE\s*:/i.test(l) && SETITEM.test(l) && (l.match(/\.unlazy|\.html?|\.css|\.js\b|\b(?:off|sel|shot|png|row|tab)[\w-]*\b|:\d{2,}/g) || []).length < 3);
      if (cloBad.length) amb.push(`UNIVERSE-CLOSURE: ${cloBad.length} closure line(s) name a surface-set but cite <2 surfaces — a surface-set item closes per-surface, not on two toolbars (ambition-floor F7)`);
    }
    if (amb.length) {
      failures.push(`AMBITION-FLOOR: ${amb.join(" · ")} (ambition-floor-analysis F1–F8 — price the declared scope, or \`EXEMPT-AMBITION: * — <reason>\` / per-check \`DECLARED: <name> — <why>\` in ${evidenceRel})`);
    }
  } catch { /* ambition-floor fails open — a doc-parse hiccup never blocks */ }

  // --- shipped-debt (gs-v2) -----------------------------------------------------
  tick("shipped-debt");
  // Surface debt outlives the session that produced it: the registry
  // holds the latest arithmetic verdict per measured surface, and a
  // session touching a flagged surface inherits the flag until a clean
  // re-measurement clears it. A bypass ends a session, not the debt.
  try {
    const regPath = join(STATE_DIR, "shipped-registry.json");
    if (existsSync(regPath) && !exempt("SHIPPEDDEBT", "*")) {
      const reg = JSON.parse(readText(regPath) || "{}");
      const touchedPaths = (Array.isArray(state.ui_touched) ? state.ui_touched : [])
        .map((p) => String(p).replace(/\\/g, "/").replace(/^[A-Za-z]:/, "").replace(/^\/+/, ""));
      const debt = [];
      for (const [key, e] of Object.entries((reg && reg.surfaces) || {})) {
        if (!e || !Array.isArray(e.flags) || !e.flags.length) continue;
        const url = String(e.path || "")
          .replace(/^file:\/+/i, "")
          .replace(/\\/g, "/")
          .replace(/^[A-Za-z]:/, "")
          .replace(/^\/+/, "");
        const name = key.split("@")[0];
        const hit = touchedPaths.some((t) =>
          (url && (t.endsWith("/" + url) || t === url || url.endsWith("/" + t))) ||
          t.split("/").pop().replace(/\.[^.]+$/, "") === name);
        if (hit) debt.push(`${key}: ${e.flags[0].slice(0, 90)} (flagged by ${e.sid || "?"} ${String(e.ts || "").slice(0, 10)})`);
      }
      const dispo = (k) => new RegExp(`DECLARED\\s*:\\s*shipped[-\\s]?debt\\s+${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:—|--|::| - )\\s*.{4,}`, "i").test(evidence);
      const open = debt.filter((d) => !dispo(d.split(":")[0]));
      if (open.length) {
        failures.push(
          `SHIPPED-DEBT: ${open.length} surface(s) touched this session carry un-cleared arithmetic flags from a prior session — ` +
          `${open.slice(0, 3).join(" | ")}${open.length > 3 ? ` (+${open.length - 3} more)` : ""}. ` +
          `Debt follows the surface, not the session: re-measure it (a clean probe run clears the entry) ` +
          `or DECLARED: shipped-debt <surface@viewport> — <why it stands> in ${evidenceRel}.`
        );
      }
    }
  } catch { /* registry read is best-effort */ }

  // --- capture-scrutiny (gs3 dogfood) -------------------------------------------
  tick("capture-scrutiny");
  // A viewed capture that produces no written verdict is a look that
  // graded nothing — gs3 viewed the index shot, fixed one cosmetic bug,
  // and the left-aligned 4K feed + broken rail sailed through un-named.
  // Every session-produced capture the transcript shows a read of owes a
  // written disposition: a review/eyes artifact names its stem (finding
  // or clean verdict), or DECLARED: clean-shot <stem> — <why>.
  try {
    if (transcriptRaw && !exempt("CAPSCRUTINY", "*")) {
      const sessionStart = Date.parse(state.ui_first_edit_at || state.design_spec_at || 0) || 0;
      let revTxt = "";
      try { revTxt = readText(join(ROOT, artifactFor(`.unlazy/design-review/${sid}.md`))) || ""; } catch { /* none yet */ }
      const corpus = [revTxt, evidence || ""].join("\n").toLowerCase() + "\n" + (() => {
        try {
          const d = join(ROOT, ".unlazy", "eyes");
          return readdirSync(d)
            .filter((f) => /\.md$/i.test(f))
            .filter((f) => {
              try { return !sessionStart || statSync(join(d, f)).mtimeMs > sessionStart - 120_000; } catch { return false; }
            })
            .map((f) => readText(join(d, f)) || "")
            .join("\n");
        } catch { return ""; }
      })().toLowerCase();
      const seen = new Set();
      for (const m of transcriptRaw.matchAll(/file_path["']?\s*[:=]\s*["']([^"']+\.(?:png|jpe?g|webp|gif))["']/gi)) {
        const p = String(m[1]).replace(/\\/g, "/");
        if (!/\.unlazy|shots|captures/i.test(p)) continue;
        const st = p.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase();
        if (st.length > 2) seen.add(st);
      }
      // only captures produced this session count — referents/anchors
      // are REFERENT-VIEWED's domain
      const produced = [...seen].filter((st) => {
        let hit = false;
        const walk = (dd) => {
          if (hit) return;
          let ents = [];
          try { ents = readdirSync(dd, { withFileTypes: true }); } catch { return; }
          for (const en of ents) {
            const fp2 = join(dd, en.name);
            if (en.isDirectory()) { walk(fp2); if (hit) return; continue; }
            if (en.name.toLowerCase().startsWith(st) && /\.(png|jpe?g|webp|gif)$/i.test(en.name) &&
                (!sessionStart || statSync(fp2).mtimeMs > sessionStart - 120_000)) { hit = true; return; }
          }
        };
        try { walk(join(ROOT, ".unlazy")); } catch { /* best-effort */ }
        return hit;
      });
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const owed = produced.filter((st) =>
        !corpus.includes(st) &&
        !new RegExp(`DECLARED\\s*:\\s*(?:clean[-\\s]?shot|no[-\\s]?visible[-\\s]?defects?)\\s+${esc(st)}\\s*(?:—|--|::| - )\\s*.{4,}`, "i").test(evidence || ""));
      if (owed.length) {
        failures.push(
          `CAPTURE-SCRUTINY: ${owed.length} session capture(s) were viewed but produced no written verdict — ` +
          `${owed.slice(0, 4).join(", ")}${owed.length > 4 ? "…" : ""}. A look that names nothing graded nothing: ` +
          `each viewed capture owes a finding or a clean-verdict line naming its stem in the design-review/eyes artifact, ` +
          `or DECLARED: clean-shot <stem> — <why> in ${evidenceRel} (gs3: the 4K feed alignment + rail gaps shipped un-named).`
        );
      }
    }
  } catch { /* capture-scrutiny best-effort */ }

  // --- prose-scan (O2) ----------------------------------------------------------
  tick("prose-scan");
  // Quality-bypass vocabulary in the assistant's own tail-window — the
  // phrases that close work without a disposition ('honest remainder',
  // 'within bar', 'context is tight', 'out of scope for this pass').
  // Post-hoc by design: no hook sees prose mid-turn, so this catches the
  // move before the report closes — honestly labeled as such (O2 named
  // limit). Scoped to sessions that armed the design layer; a line
  // carrying a real disposition label is legal.
  const armedDesignLayer =
    existsSync(join(ROOT, ".unlazy", "design-spec", `${sid}.md`)) ||
    existsSync(join(ROOT, ".unlazy", "design-review", `${sid}.md`)) ||
    existsSync(join(ROOT, ".unlazy", "iteration", `${sid}.md`)) ||
    (state.impl_touched || []).some((p) => /app\/(ui|ui_admin)\/|\.(html|j2)$/i.test(String(p)));
  if (armedDesignLayer && assistantTexts.length && !exempt("PROSESCAN", "*")) {
    const PROSE_BAN = /\b(?:honest\s+remainder|within\s+bar|context\s+is\s+tight|budget\s+is\s+tight|out\s+of\s+scope\s+for\s+this\s+pass)\b/i;
    const DISPO = /\b(OPEN|FIXED|VERIFIED|FILED|BLOCKED|ACCEPTED|DECLARED|EXEMPT|CLOSURE|QUEUED|SKIPPED)\s*:/i;
    const tail = assistantTexts.slice(-8);
    const badLines = [];
    // Use-vs-mention: quoting the vocabulary while discussing the scan
    // (or the rules) is mention, not use — strip backtick and double-quoted
    // spans before testing, mirroring the doc-side treatment at ~:2807.
    const mentionless = (l) => String(l).replace(/`[^`]*`|"[^"]*"/g, " ");
    for (const t of tail) for (const l of String(t).split(/\r?\n/)) {
      const bare = mentionless(l);
      if (PROSE_BAN.test(bare) && !DISPO.test(bare)) badLines.push(l.trim().slice(0, 120));
    }
    if (badLines.length) {
      failures.push(
        `PROSE-SCAN: assistant tail-window prose uses quality-bypass language with no disposition — "${badLines[0]}". ` +
        `A closing line can't carry the claim AND the skip: disposition it (OPEN:/BLOCKED:/ACCEPTED:…) or don't say it (O2).`
      );
    }
  }

  // Telemetry snapshot — populated once failures are final so every exit
  // path (block / pass-bypass / clean pass) records the same shape.
  TELEMETRY_CTX.armed = Array.isArray(state.checks_armed) ? state.checks_armed : [];
  TELEMETRY_CTX.failed = failures.map((f) => (String(f).match(/^([A-Z][A-Z0-9-]{2,})\s*:/) || [])[1] || String(f).slice(0, 30));
  TELEMETRY_CTX.bypasses = (state.stop_bypasses || []).length;
  TELEMETRY_CTX.escapes = Object.values((state.escapes && typeof state.escapes === "object" && !Array.isArray(state.escapes)) ? state.escapes : {}).reduce((a, b) => a + (+b || 0), 0);

  // F21: wildcard pardons print BEFORE the block decision — the note used
  // to live past `if (failures.length)`, so a blocked run (the path where
  // `*` abuse matters most) never showed its wildcard list.
  if (wildEscapes.length) {
    console.error(`stop-gate note: wildcard pardons consumed — ${[...new Set(wildEscapes)].map((c) => `EXEMPT-${c}: *`).join(", ")} (each reason ≥40 chars on file in ${evidenceRel}; a wildcard pardons every target, audit it).`);
  }

  if (failures.length) {
    // Hard-continuation: still-open tracker work is exempt from the
    // stop_hook_active release. The loop guard exists for artifact-class
    // failures; "tasks remain in the tracker" is the user's hard
    // directive — the session cycles until every open item exits as
    // DONE / BLOCKED-wall / ACCEPTED-user-verb. Releasing it here would
    // let the exact debt the guard was built to record escape unrecorded.
    const hardOpen = failures.filter((f) => /^(OPEN-TODOS|TODOS-VANISHED)\s*:/.test(f));
    // DEPTH-BYPASS (15-analysis-depth items 25-29 → plan U8): the checks
    // grading the property the user actually graded — design depth,
    // analysis depth, granularity — may not ride the loop-guard release.
    // The pleasant-button exit shipped exactly these failed (DESIGN-REVIEW,
    // ELEMENT-SCRUTINY, INVENTORY-PARITY, DESIGN-ARITHMETIC). A true
    // external wall still exits as BLOCKED: on the obligation itself —
    // only the wholesale release closes.
    const depthOpen = failures.filter((f) => /^(DESIGN-REVIEW|ELEMENT-SCRUTINY|INVENTORY-PARITY|DESIGN-ARITHMETIC|RENDER-FLOOR|ASK-SURFACE|GRANULARITY|EYES-VERDICT|ANALYSIS-EVIDENCE|ANALYSIS-PROJECT)\s*:/.test(f));
    if (input.stop_hook_active && !hardOpen.length && !depthOpen.length) {
      // gs-v2 escalation: one self-issued bypass is the designed wedge
      // release; a SECOND release of a still-failing session needs a
      // human word — otherwise the escape is an infinite exit for work
      // the gate keeps rejecting (sedate-fine shipped at bypass #2).
      // ACCEPTED-BYPASS must quote the user's actual words, corroborated
      // against the transcript's user turns — an agent-written "user
      // said ok" without the turn is a fabricated acceptance.
      const priorN = (state.stop_bypasses || []).length;
      if (priorN >= 1 && !exempt("BYPASS-ESCALATION", "*")) {
        const acc = (evidence || "").match(/ACCEPTED-BYPASS\s*:\s*[\s\S]{0,200}?user\s*(?:said|verb)?\s*[:—-]\s*["“]([^"”]{3,160})["”]/i);
        let accOk = false;
        if (acc) {
          const frag = acc[1].trim().slice(0, 40);
          accOk = userTexts.slice(-40).some((u) => String(u).includes(frag))
            || (Array.isArray(state.user_pause_signals) && state.user_pause_signals.some((s) => String(s.excerpt || "").includes(frag)));
          if (!accOk && !transcriptRaw) {
            // No user-turn corpus exists on this runtime (TRANSCRIPT-ABSENT):
            // the quote can be neither proven nor disproven — degrade to
            // asserted, the same floor every other corroboration check uses,
            // or acceptance is structurally impossible on that client.
            console.error("stop-gate note: ACCEPTED-BYPASS recorded but not transcript-proven (TRANSCRIPT-ABSENT) — asserted.");
            accOk = true;
          }
        }
        if (!accOk) {
          block(
            `BYPASS-ESCALATION: this session already released ${priorN} failed-check set(s) — a second escape is not self-issued. ` +
            `Either satisfy the ${failures.length} open obligation(s), or get the user's in-session acceptance and record it as ` +
            `ACCEPTED-BYPASS: — user said "<their words>" in ${evidenceRel} (the quote is transcript-corroborated — it must be their actual turn). ` +
            `First open item: ${failures[0].slice(0, 140)}`
          );
        }
      }
      // The loop guard releases this attempt — record what it released.
      try {
        state.stop_bypasses = state.stop_bypasses || [];
        state.stop_bypasses.push({
          ts: new Date().toISOString(),
          failures: failures.map((f) => f.slice(0, 160)),
        });
        TELEMETRY_CTX.bypasses = state.stop_bypasses.length; // include the bypass just recorded
        mkdirSync(STATE_DIR, { recursive: true });
        writeFileSync(join(STATE_DIR, `${sid}.json`), JSON.stringify(state, null, 2));
      } catch { /* the record is best-effort; the guard itself stands */ }
      dumpTiming("pass-bypass");
      process.exit(0);
    }
    const priorBypasses = (state.stop_bypasses || []).length;
    block(
      `Rule-enforcement gate — ${failures.length} unmet obligation(s):\n` +
      (priorBypasses
        ? `(also on record: ${priorBypasses} prior stop-bypass(es) this session released unresolved failure(s) — e.g. "${(state.stop_bypasses[0].failures || [])[0] || "?"}" — a bypass is a recorded artifact, not a resolution)\n`
        : "") +
      failures.map((f, i) => `${i + 1}. ${f}`).join("\n") +
      `\nHow to satisfy a CHECK-NAME obligation: its contract (arming trigger + satisfier + escapes) is the Gate map row in rules/10-rule-enforcement.mdc; ` +
      `when a failure's accepted shape is unclear, \`grep -n "CHECK-NAME" .devin/scripts/stop-gate.mjs\` shows the exact pattern next to the string. ` +
      `Exits live in ${evidenceRel}: \`EXEMPT-<CHECK>: * — <reason>\` or the check's own \`DECLARED:\`/\`STOP:\`/\`BLOCKED:\`/\`ACCEPTED:\` forms — each corroborated, not asserted.`
    );
  }
  // A bypass is written to the session state file, but nothing reads it —
  // now it is surfaced. Clean exit still notes it: the record is visible
  // to the operator even when the gate finds nothing new to hold.
  if ((state.stop_bypasses || []).length) {
    const resolved = /(?:RESOLVED-BYPASS|ACCEPTED-BYPASS)\s*:\s*\S.{20,}/i.test(evidence || "");
    console.error(
      `stop-gate note: ${state.stop_bypasses.length} prior stop-bypass(es) this session released unresolved failure(s) ` +
      `— e.g. "${(state.stop_bypasses[0].failures || [])[0] || "?"}" — ` +
      (resolved ? "recorded in gate-state; a disposition is on file." : "recorded in gate-state, not resolved.")
    );
  }
  // E6b: plan-signature advisory — a doc carrying `## Goal` + `## Success`
  // under a basename without "plan" is a plan in costume; the tracker
  // records it and the gate surfaces the note (advisory, not a block —
  // the record is what makes it auditable).
  for (const p of (state.plan_sig_docs || [])) {
    console.error(`stop-gate note: ${p} carries plan signature (## Goal + ## Success) under a non-plan basename — if it is a plan it owes PLAN-SCHEMA fields; if it is not, the headings mislabel it.`);
  }
  // E3: escape-rate telemetry — the escape layer (DECLARED:/EXEMPT-*/
  // review-credit:) is legal; what was invisible is a session leaning on
  // it. Denominator = checks_armed (distinct checks that armed this
  // session, derived by the tracker). Trigger is RATE not count: skew
  // advisory fires at rate >0.5 OR absolute ≥3, whichever first — a
  // 3-of-3 session is not a 3-of-40 session.
  const escMap = (state.escapes && typeof state.escapes === "object" && !Array.isArray(state.escapes)) ? state.escapes : {};
  const escTotal = Object.values(escMap).reduce((a, b) => a + (+b || 0), 0);
  const armedN = Array.isArray(state.checks_armed) ? state.checks_armed.length : (+state.checks_armed || 0);
  if (escTotal && (escTotal >= 3 || (armedN > 0 && escTotal / armedN > 0.5))) {
    const perFile = Object.entries(escMap).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([f, n]) => `${basename(f)}:${n}`).join(", ");
    console.error(`stop-gate note: escape-rate telemetry — ${escTotal} escape line(s) (DECLARED:/EXEMPT-*/review-credit:) across ${armedN || "?"} armed check(s)${perFile ? ` — heaviest: ${perFile}` : ""}. Escapes are legal machinery; a session leaning on them is worth a second look.`);
  }
  // EF-F1/O-F4: work-telemetry — effort was asserted in prose because
  // nothing measured it. The counters the tracker now keeps get printed
  // on every stop so the session's work shape is a record, not a claim.
  const tBits = [
    `edits:${state.files_edited || 0}`,
    `execs:${state.exec_count || 0}`,
    `escapes:${escTotal}/${armedN || "?"}`,
    `hook:${state.hook_self_ms || 0}ms`,
    `subs:${(state.subagent_launches || []).length}`,
    `rejections:${(state.rejections || []).length}`,
    `quality-rejects:${(state.quality_rejections || []).length}`,
    `plan-items:${(state.plan_items_done || []).length}`,
  ].join(" ");
  console.error(`stop-gate telemetry: ${tBits}`);
  console.error(`[stop-gate] note: ${NO_DEFERRAL_CONTRACT}`);
  dumpTiming("pass");
  process.exit(0);
}

main();
