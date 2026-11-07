/**
 * PreToolUse hook (todo_write): refuse a task transition that leaves the
 * just-finished item without a written closure in the session's
 * design-review artifact.
 *
 * The failure it kills: item N is marked completed and item N+1 begins
 * with the scrutiny still unwritten — "moving on" is where due diligence
 * dies, and every other gate fires only at session stop, after the
 * shallow work already happened. This is the mid-session hard gate:
 * before the next item starts, the finished item's questions/verdict must
 * already exist on paper.
 *
 * Enforces (UI sessions — state.ui_edit_count > 0 — plus any session
 * with armed ledger/plan docs):
 *   - UI session: every item that just flipped to "completed" in this
 *     write must have a `CLOSURE: <item stem>` line in
 *     .unlazy/design-review/<sid>.md whose stem shares the item's first
 *     4 words, or an `EXEMPT-CLOSURE: <stem or *> — <reason>` line in
 *     .unlazy/gate-evidence/<sid>.md.
 *   - Non-UI session with armed docs: the same CLOSURE: line must exist
 *     in one of the session's armed plan/ledger docs — per-item closure
 *     is a completion discipline, not a UI discipline (00-operating §2e).
 *   - an item may be marked completed alongside a NEW in_progress item;
 *     completing the final item is also checked (the stop-gate's
 *     ITEM-CLOSURE check catches the end-state too).
 *
 * Does NOT block:
 *   - sessions with no UI edits AND no armed ledger docs (nothing owed)
 *   - writes that complete nothing new (pure reorders, additions)
 *   - items the snapshot never saw open (completed before this session /
 *     first-seen already-completed — bookkeeping, not transitions)
 *
 * Fail-open on any internal error.
 */
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const ARTIFACT_DIR = join(ROOT, ".unlazy", "design-review");
const EVIDENCE_DIR = join(ROOT, ".unlazy", "gate-evidence");
const STATE_DIR = join(ROOT, ".unlazy", "gate-state");

// Symmetric normalization (sedate-fine six-block): stem() stripped
// punctuation on the ITEM side only — "pre-work" derived "prework",
// which a verbatim-quoted CLOSURE line ("Write pre-work…") could never
// contain; the session reverse-engineered the bug and wrote "prework".
// Both forms exist in real artifacts now, so BOTH sides normalize
// punct→join (the original stem behavior applied symmetrically) —
// verbatim and adapted spellings match equally.
const normAll = (t) =>
  String(t || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
const stem = (s, n = 4) => normAll(s).split(" ").filter(Boolean).slice(0, n).join(" ");
// Ordered subsequence of stem words among a line's tokens — gap-tolerant
// like the old regex pair, but immune to punctuation asymmetry.
const stemInLine = (line, stemWords) => {
  const toks = normAll(line.replace(/^[^\n]*?CLOSURE\s*:/i, " ")).split(" ").filter(Boolean);
  let i = 0;
  for (const w of stemWords.split(" ")) {
    i = toks.indexOf(w, i);
    if (i < 0) {
      // secdoc B10 — tokenization asymmetry: the item "Spec-critique"
      // stems to "speccritique", but a naturally-written closure says
      // "spec critique" and can never match the token. The joined
      // blob covers split/fused spellings both ways.
      const blob = toks.join("");
      const sblob = stemWords.split(" ").join("");
      return blob.includes(sblob);
    }
    i++;
  }
  return true;
};
// Marker/reason separators: ` — `, ` -- `, ` :: `, or ` - `. A bare
// single hyphen requires surrounding whitespace so hyphenated words
// ("evidence-gathering") can't split mid-word — the quiet-rejection
// loop a ` - ` separator caused for quaint-hearing.
const EXEMPT_SEP = /\s*(?:—|--|::| - )\s*/;

let raw = "";
process.stdin.setEncoding("utf-8");
for await (const chunk of process.stdin) raw += chunk;

try {
  const input = JSON.parse(raw || "{}");
  if (!input || typeof input !== "object" || Array.isArray(input)) process.exit(0);
  const sid = input.session_id || "unknown";
  const todos = Array.isArray(input.tool_input && input.tool_input.todos)
    ? input.tool_input.todos
    : [];
  if (!todos.length) process.exit(0);

  const statePath = join(STATE_DIR, `${sid}.json`);
  let state = {};
  if (existsSync(statePath)) {
    try {
      const s = JSON.parse(readFileSync(statePath, "utf-8"));
      // Agent-writable file — a forged scalar/array must not crash the
      // hook (same guard the tracker's readState carries).
      state = s && typeof s === "object" && !Array.isArray(s) ? s : {};
    } catch { state = {}; } // truncated/garbage JSON → empty, not exit 1
  }
  const uiSession = state.ui_edit_count > 0;
  const planDocs = Array.isArray(state.plan_docs) ? state.plan_docs : [];
  if (!uiSession && !planDocs.length) process.exit(0); // nothing armed — no closure doc owed

  // Which items just completed? Compare against the snapshot the tracker
  // stored from the PREVIOUS todo_write (PreToolUse runs first, so the
  // stored snapshot is still the old list).
  const prev = Array.isArray(state.todos_snapshot) ? state.todos_snapshot : [];
  const prevDone = new Set(
    prev.filter((t) => t && t.s === "completed").map((t) => String(t.c || "").slice(0, 60))
  );
  // Reword/consolidate dodge (a prior session B1): an open item
  // rewritten or merged into a new completed item has a different
  // 60-char prefix, so a prevOpen-identity match never fires and the
  // closure is never owed. Any item newly asserting `completed` binds —
  // open→done, reworded→done, or born-completed — except one that was
  // already completed in the prior snapshot, or the session's first
  // list (no baseline exists to bind against).
  const justCompleted = todos.filter((t) => {
    if (!t || t.status !== "completed") return false;
    const c = String(t.content || "").slice(0, 60);
    if (prevDone.has(c)) return false;
    if (!prev.length) return false;
    return true;
  });
  if (!justCompleted.length) process.exit(0);

  const artifactPath = join(ARTIFACT_DIR, `${sid}.md`);
  // UI sessions close items in the design-review artifact; non-UI
  // sessions close them in any armed plan/ledger doc — the corpus is
  // whichever home the session's closure discipline lives in.
  const art = uiSession && existsSync(artifactPath)
    ? readFileSync(artifactPath, "utf-8")
    : planDocs
        .map((p) => {
          const fp = existsSync(p) ? p : join(ROOT, p);
          return existsSync(fp) ? readFileSync(fp, "utf-8") : "";
        })
        .join("\n");
  const evidencePath = join(EVIDENCE_DIR, `${sid}.md`);
  const evidence = existsSync(evidencePath) ? readFileSync(evidencePath, "utf-8") : "";

  // Sibling parity (R15-F9, R16-F15): the stop-gate only accepts
  // CLOSURE inside the artifact's `## Closures` section, and its
  // `sectionBody` ends at ANY `#{1,6}` heading — a CLOSURE parked under
  // `### batch` inside ## Closures passed this check then flagged at
  // stop. Same boundary here. A UI session with NO artifact gets an
  // empty corpus — the plan-doc fallback let a closure that could never
  // satisfy the gate pass mid-session (the gate reads the artifact
  // only).
  const closedCorpus = !uiSession
    ? art
    : existsSync(artifactPath)
      ? (art.match(/^#{1,6}\s*closures\b[^\n]*\n([\s\S]*?)(?=\n^#{1,6}\s|$(?![\s\S]))/im) || [])[1] || ""
      : "";

  // DD-F2: the CLOSURE line's own content — stem-presence alone let
  // `CLOSURE: fix the bug — done` satisfy. The written closure must name
  // ≥2 scrutiny axes (correctness/functional/security/performance/
  // quality/usability) or cite the element/region questioned
  // (file:line, capture, DOM selector, route) — same floor the
  // stop-gate's ITEM-CLOSURE applies.
  const AXIS_RE = /\b(correctness|functional|functionality|security|performance|quality|usability|ux|visual|accessib|modular|authz|idor)\b/gi;
  const CITE_RE = /(?:[\w.-]+\.(?:mjs|js|ts|py|css|html|j2|md):\d+|verify:\s*\S+|capture|screenshot|\.png\b|selector|\bDOM\b|route\s+\/\S+)/i;
  const closureLines = (s) =>
    closedCorpus.split(/\r?\n/).filter((l) => /CLOSURE\s*:/i.test(l) && stemInLine(l, s));

  // gs-v2 workflow bind: an item naming a session-touched UI file must
  // close on rendered evidence OF THAT FILE — not generic axis words.
  // Page-level quality needs a page-level unit to bind to; a batched
  // item naming several files needs evidence for each.
  const uiStems = new Set(
    (Array.isArray(state.ui_touched) ? state.ui_touched : [])
      .map((p) => String(p).replace(/\\/g, "/").split("/").pop().replace(/\.[^.]+$/, "").toLowerCase())
      .filter((s) => s.length > 2)
  );
  const citeCovers = (line, st) => {
    const cites = line.match(/[\w.\\/-]+\.(?:png|json)\b/gi) || [];
    return cites.some((c) => {
      if (/\.png$/i.test(c)) return c.toLowerCase().includes(st);
      try {
        // the cite regex can lose a leading dot (".unlazy/…" → "unlazy/…") — try both
        const rel = c.replace(/^\.?\/+/, "");
        const p = existsSync(join(ROOT, rel)) ? join(ROOT, rel) : join(ROOT, "." + rel);
        const j = JSON.parse(readFileSync(p, "utf-8"));
        const surfs = j.surfaces || j.pages || [];
        if (Array.isArray(surfs) && surfs.length)
          return surfs.some((s) => String(s.name || s.path || s.page || "").toLowerCase().includes(st));
        return JSON.stringify(j).toLowerCase().includes(st);
      } catch { return false; }
    });
  };

  const missing = justCompleted.filter((t) => {
    const s = stem(t.content);
    if (!s) return false;
    // DD-F2 preserved: a matched line must name ≥2 axes or a cite —
    // checked against EVERY stem-matching line, not just the first.
    let closed = closureLines(s).some((line) =>
      new Set((line.match(AXIS_RE) || []).map((a) => a.toLowerCase().replace(/ity$/, "y"))).size >= 2 ||
      CITE_RE.test(line));
    // Per-file rendered evidence when the item names touched UI files.
    if (closed) {
      const words = normAll(t.content).split(" ");
      const bound = [...uiStems].filter((st) => words.includes(st));
      if (bound.length)
        closed = closureLines(s).some((line) => bound.every((st) => citeCovers(line, st)));
    }
    // Reason-required, same contract as the stop-gate's exempt() — a
    // bare `EXEMPT-CLOSURE: *` used to satisfy this hook and then flag
    // at the gate (R14-F21): the two sides must demand the same shape.
    // Stem matching is symmetric (punct stripped BOTH sides → ordered
    // word subsequence) so verbatim `pre-work` and the adapted `prework`
    // spelling both satisfy — sedate-fine's unblockable loop.
    const exempted = evidence.split(/\r?\n/).some((l) => {
      const m = l.match(/EXEMPT-CLOSURE\s*:\s*([\s\S]*)$/i);
      if (!m) return false;
      const parts = m[1].split(EXEMPT_SEP);
      if (parts.length < 2 || !/\S.{3,}/.test(parts.slice(1).join(" "))) return false;
      const target = parts[0].trim();
      if (target === "*") return true;
      return stemInLine("CLOSURE: " + target, s);
    });
    return !(closed || exempted);
  });

  // gs-v2 bind hole: "build all pages" names no file, so the per-file
  // bind never armed. Close the hole session-side: every page file
  // CREATED this session (birthtime inside the session window) must
  // appear in the closures corpus — a page that exists owes written
  // scrutiny, whether or not an item happened to name it.
  const firstEdit = Date.parse(state.ui_first_edit_at || state.design_spec_at || 0) || 0;
  const createdPages = uiSession && firstEdit
    ? (Array.isArray(state.ui_touched) ? state.ui_touched : []).filter((p) => {
        const s = String(p);
        if (!/\.(html|j2)$/i.test(s)) return false;
        try { return statSync(join(ROOT, s)).birthtimeMs > firstEdit - 120_000; } catch { return false; }
      })
    : [];
  const pageExempt = (st) =>
    evidence.split(/\r?\n/).some((l) => {
      const m = l.match(/EXEMPT-CLOSURE\s*:\s*([\s\S]*)$/i);
      if (!m) return false;
      const parts = m[1].split(EXEMPT_SEP);
      if (parts.length < 2 || !/\S.{3,}/.test(parts.slice(1).join(" "))) return false;
      const target = parts[0].trim();
      return target === "*" || normAll(target).includes(st);
    });
  const corpusNorm = normAll(closedCorpus);
  const unclosedPages = createdPages.filter((p) => {
    const st = normAll(String(p).replace(/\\/g, "/").split("/").pop().replace(/\.[^.]+$/, ""));
    if (pageExempt(st)) return false;
    return !new RegExp(`\\b${st.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(corpusNorm);
  });
  if (unclosedPages.length) {
    process.stdout.write(JSON.stringify({
      decision: "block",
      reason: `ITEM-CLOSURE: ${unclosedPages.length} page file(s) created this session have no closure mention anywhere in ## Closures — ` +
        `${unclosedPages.slice(0, 3).join(", ")}${unclosedPages.length > 3 ? ` (+${unclosedPages.length - 3} more)` : ""}. ` +
        `A page that exists owes written scrutiny: add a CLOSURE line naming each created page (per-file evidence — a capture/ coverage cite carrying its name) ` +
        `in .unlazy/design-review/${sid}.md, or EXEMPT-CLOSURE: <stem> — <reason> in .unlazy/gate-evidence/${sid}.md. ` +
        `Building pages without per-page written review is the spray-and-tweak pattern this gate exists to kill.`,
    }));
    process.exit(2);
  }

  if (missing.length) {
    const first = missing[0];
    const home = uiSession
      ? `.unlazy/design-review/${sid}.md (## Closures section)`
      : `one of this session's armed plan/ledger docs (${planDocs[0] || "a ledger doc"})`;
    const reason =
      `ITEM-CLOSURE: "${String(first.content || "").slice(0, 70)}" was marked completed with no adequate closure — the move-on gate. ` +
      `Computed stem (write these normalized words in order, any punctuation): "${stem(first.content)}". ` +
      `Paste-ready: "CLOSURE: ${stem(first.content)} — <what was questioned + ≥2 axes or a cite>". ` +
      `Before the next item begins, close it in one of: ` +
      `(a) CLOSURE: <item stem> — <what was questioned> in ${home}, naming ≥2 axes ` +
      `(correctness/functional/security/performance/quality/usability) or a file:line/capture/selector cite for the region questioned; ` +
      `(b) EXEMPT-CLOSURE: <stem or *> — <reason> in .unlazy/gate-evidence/${sid}.md ` +
      `(marker/reason separators accepted: —, --, ::, or -) ` +
      `(00-operating §2e — per-item closure is a completion discipline, not a UI discipline). ` +
      `Scrutiny that isn't written before the transition didn't happen.`;
    process.stdout.write(JSON.stringify({ decision: "block", reason }));
    process.exit(2);
  }
  process.exit(0);
} catch {
  process.exit(0);
}
