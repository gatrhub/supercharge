/**
 * Deferral patterns — the vocabulary scan's regexes and disposition
 * logic, one home (machinery issue I2).
 *
 * These lived inline in stop-gate.mjs where they were untestable: the
 * false-positive class (deferral vocabulary describing completed work
 * flagging identically to open work) could only be observed live.
 * Extracted so .unlazy/tests/deferral-corpus.mjs pins both directions —
 * false-positive lines must clear, true open-work lines must flag.
 *
 * The I2 fix itself is the completion-context arm inside disposedOf():
 * a flagged line that carries completion vocabulary and no open token
 * describes the pre-fix state, not standing work — it is disposed.
 */

// `ok` is the session's ACCEPTED corroborator (acceptedOk) — a row whose
// only evidence is the words "user agreed" inside it is assertion-level;
// the caller passes the pause-signal check when one exists.
export const USER_VERB_RE = /\buser\b[^\n]{0,80}\b(agreed|approved|said|asked|chose|confirmed|assigned|told|decided|deferred|wants)\b/i;

// I2: a flagged line carrying completion vocabulary describes the
// state BEFORE the flagged thing existed — "the arm was unconditional
// — fixed", "can't be skipped silently anymore" (a shipped control's
// property). Action-verbs, `no longer`, and negated-capability+anymore
// ("can't be X anymore") are the markers; bare `now`/`later` are not —
// "the rest is now deferred" must still flag.
export const COMPLETION_CTX_RE = /\b(?:fix(?:ed|es)?|shipp?ed|clos(?:ed|es)|delet(?:ed|es)|land(?:ed|s)\b|implement(?:ed|s)|resolv(?:ed|es)?|complet(?:ed|es)?|verif(?:ied|ies)|correct(?:ed|s)?|clear(?:ed|es|ing)?|pass(?:ed|es)|rewrit(?:e|ten)|revert(?:ed|s)?|remov(?:ed|es)|gone|killed|in\s+place|live\b|no\s+longer)\b|(?:can'?t|cannot|won'?t|couldn'?t|no\s+longer)\b[^\n]{0,80}\banymore\b/i;

// I2: the open veto — an explicit open token OR a forward-time marker
// on the same line beats completion vocabulary ("fixed X; Y open" and
// "will be fixed in a later pass" both still flag — the open part and
// the future are the admissions). Covers status cells' open shapes,
// prose openers, and the deferral vocabulary's own forward horizon.
export const OPEN_CTX_RE = /\b(?:unresolved|outstanding|undone|pending|unexamined|untouched|yet\s+to|await(?:s|ing)|waiting\s+(?:on|for)|still\s+(?:open|un\w+|to\s+be|missing|needs?|required?)|(?:remains?|left|stays?|sits?|stands?|ends?)\s+open\b|(?:findings?|issues?|items?|tasks?|work|units?|sections?|questions?|subjects?|surfaces?)\s+open\b|open\s+(?:work|items?|issues?|findings?|questions?|tasks?|problems?|gaps?|units?|surfaces?|subjects?)\b|(?:in|for|during)\s+a?\s*(?:later|future|next|subsequent)\s+\w+|later\s+(?:pass|round|sprint|iteration|session)|for\s+later|next\s+(?:pass|round|sprint|iteration|session|version|release)|future\s+(?:pass|work|iteration|feature|version|release|round|sprint)|to\s+be\s+(?:done|fixed|implemented|addressed|decided|revisited|built|completed|determined))\b/i;

// Lane-doc ownership: `Driver: <session-id>` claims a lane doc for one
// session; `Lane:`/`Drive:` alone are shared standing work that resurfaces
// for whoever picks it up. Cross-session pooling is the defect this kills:
// a doc carrying `Driver: a prior session` must not arm another session's
// cycle-plan gate or feed its plan-parity pool.
export const DOC_DRIVER_RE = /^\s*Driver\s*:\s*([A-Za-z][\w-]*)/im;
export const docDriver = (text) => {
  const m = String(text || "").match(DOC_DRIVER_RE);
  return m ? m[1].trim() : null;
};

export const disposedOf = (l, ok) =>
  // BLOCKED names a real wall (≥12 chars, not filler) — `BLOCKED: x` /
  // `BLOCKED: later` is an open row wearing a terminal costume.
  /\bBLOCKED\s*:\s*(?!x\b|n\/a\b|na\b|later\b|tbd\b|todo\b|wip\b|blocked\b|fix\b|soon\b)\S.{10,}/i.test(l) ||
  (/\bACCEPTED\s*:/i.test(l) && USER_VERB_RE.test(l) && (!ok || ok(l))) ||
  // A STATUS CELL is already a disposition — `| VERIFIED — wired: …` in a
  // findings table, `| RESOLVED`/`| LANDED` in a work log. The deferral/
  // coverage scans name use, not mention: a negation inside a closed row's
  // defect description ("never checked" — the defect being recorded) isn't
  // an open admission. Cell-anchored only — bare `FIXED` inside "leftovers
  // to be FIXED" must not dispose a real deferral (R16 own-walk: the widened
  // GAP_RE caught both shapes, which proved the distinction was missing).
  /\|\s*(VERIFIED|FIXED|DONE|RESOLVED|CLOSED|SHIPPED|MERGED|LANDED|COMPLETE|FILED|CARRIED)\s*(?:[—:|\d-]|$)/i.test(l) ||
  // I2 completion-context arm: completion vocabulary with no open token
  // means the flagged vocabulary describes the pre-fix state. Bound: a
  // deferral token co-written with completion vocab on one line reads as
  // pre-fix description — the corpus (deferral-corpus.mjs) pins the
  // shapes, and DECLARED-style dispositions remain the certain close.
  (COMPLETION_CTX_RE.test(l) && !OPEN_CTX_RE.test(l));

// Case-sensitive marker branch — prose 'todo' (the work-item noun)
// was a false-positive costume (ambition-floor U9); the convention is
// uppercase TODO/FIXME, and a lowercase 'todo:' label still flags.
export const DEFERRAL_MARK_RE = /\bTODO\b|\bFIXME\b|\btodo\s*:/;

// residual" heading was a leftover drawer wearing an instrument-limit
// costume. The one surviving compound is the security term `residual
// risk` (post-mitigation assessment); the lookahead keeps it legal
// while every other use needs a disposition marker on the line.
export const DEFERRAL_RE = /\b(not\s+built|not\s+this\s+pass|listed,?\s*not\s+built|for\s+a\s+later\s+pass|(?:in|for|during)\s+a\s+(?:later|future|subsequent)\s+(?:pass|round|iteration|sweep)|later\s+pass|next\s+pass|future\s+(?:pass|work|iteration|enhancement|feature|improvement|version|release|round|sprint)|deferred-by[\w-]*|status:\s*\*?\*?\s*deferred|deferr(?:ed|al)s?|de[-\s]?scoped|won'?t\s+(?:fix|do|build|implement|ship|land)|out\s+of\s+scope|nice[-\s]to[-\s]have|leftovers?|remains?\s+open|to\s+be\s+built|residue|remainder|residuals?\b(?![-\s]+risks?)|icebox|parking\s+lot|(?:was|were|is|are|being|gets?)\s+parked\b|park(?:ed|s|ing)\s+(?:this|it|them|that|these|the\s+(?:work|items?|issues?|tasks?|findings?|rest|remainder)|for\s+(?:now|later)|until)\b|punt(?:ed|s|ing)?|tabl(?:ed|ing)\b|table\s+(?:this|that)\b|shelv(?:ed|ing)\b|shelve\s+(?:this|it|them|that)\b|back[-\s]?burner|some[-\s]?day(?:[-\s]?maybe)?|rain[-\s]?check|wish[-\s]?lists?\s+(?:items?|work|findings|issues|rows|cases|bugs|tasks?|bucket|drawer|for)\b|post[-\s](?:launch|mvp|release|ship)|for\s+later\b|at\s+some\s+(?:point|stage)\b|not\s+(?:a\s+|an\s+|the\s+)?priorit[a-z]*|revisit\s+(?:this|it|them|that|these)\b|(?:another|separate|dedicated|follow[-\s]?on)\s+(?:pass|round|iteration|sweep)\b|spillover|carry[-\s]?overs?|(?:as|into|for|under|in)\s+follow[-\s]?ups?|follow[-\s]?ups?\s*[:;,]\s*\w+|follow[-\s]?ups?\s+(?:list|items?|tasks?|queue|pile)|odds?\s+(?:and|n'?)\s+ends?|mop[-\s]?up|tail[-\s]?end|grab[-\s]?bag|catch[-\s]?all|known\s+issues?|stretch\s+(?:goals?|items?|targets?)|(?:misc(?:ellaneous)?|clean[-\s]?up|polish|edge\s+cases?)\s+(?:items?|work|findings|issues|rows|cases|bugs|defects|tasks?|left|remain)|the\s+(?:rest|remainder)\s+(?:is|are|of)\s+(?:queued|parked|deferred|for\s+later)|circle\s*back|down\s+the\s+(?:road|line)|next\s+(?:sprint|iteration|version|release|round)|later\s+on|remaining\s+(?:items?|tasks?|work|rows?|cells?|surfaces?)|to\s+be\s+(?:done|decided|determined|addressed|implemented|completed|fixed|revisited)|\btbd\b|(?:to|into|in|on|for|onto)\s+(?:the\s+|a\s+|an\s+)?backlogs?\b|\bbacklog(?:ged|ging)\b)\b/i;

// Undisposed coverage rows are the document-as-epilogue failure: a
// "boundary" section or "not read/covered this pass" cell that names an
// unexamined unit and closes anyway. A coverage-verb must pair with a
// scope word on the same line to fire — bare findings like "does not
// read the flag" don't match. [\w-]* between the negation and the verb
// lets qualifier prefixes through ("not line-audited", "not
// fully-verified") while the \b before the verb keeps "not thread-safe"
// out. There is no self-scheduled deferral — the only legal
// dispositions are the module-scope BLOCKED:/ACCEPTED: pair above;
// QUEUED:/SKIPPED: count as deferral vocabulary, not closure.
export const SELFDEFER_RE = /\b(?:QUEUED|SKIPPED)\s*:/i;

// `pass` as a coverage scope can't be digit-prefixed — `18 pass`/`49/49`
// is a test-count result, never a coverage admission ("unread
// markChannelRead … 18 pass" false-flagged under the widened verb set —
// R16 own-walk). `(?<!\d\s)` keeps `this pass`/`same pass`/`first pass`.
export const SCOPE_WORD = "(this|in this|during|(?<!\\d\\s)pass|audit|review|sweep|analysis|session|window|fully|whole|entire|line-by-line|per[- ]unit)";

export const GAP_RE = new RegExp(
  // `[\w-]*` alone couldn't span whitespace — "not fully read" escaped;
  // contracted negatives (`didn't verify`, "haven't covered") had no
  // stem at all (R16-F4). Up to 3 whitespace-terminated adverb tokens
  // between the negation and the verb — the adverb must carry its own
  // trailing space or the verb can never match after it.
  // O-F12: the negation alternation must end on a word boundary — a
  // bare `not`/`un` matched INSIDE words ("no**t**hing covers" → not+
  // adverb "hing"+verb, "**un**checked" → un+verb "checked"), flagging
  // ordinary prose as coverage admission. `\b` after the group keeps
  // "not read"/"un-read" (hyphen boundary) and kills the in-word hits;
  // real un-verbs still bind via the dedicated branch below.
  "\\b(?:not|never|un|didn'?t|doesn'?t|don'?t|haven'?t|hasn'?t|hadn'?t|won'?t|wasn'?t|weren'?t|isn'?t)\\b\\s*(?:[\\w-]+\\s+){0,3}(?:read|verif(?:y|ied)|cover(?:ed|s|ing)?|audit(?:ed|ing)?|swe(?:ep|pt)|examine(?:d|s)?|review(?:ed|ing|s)?|prob(?:e|ed|es|ing)|test(?:ed|s|ing)?|touch(?:ed|es|ing)?|map(?:ped|s|ping)?|analy[sz](?:e|ed|es|ing)|check(?:ed|s|ing)?|inspect(?:ed|s|ing)?)\\b[^\\n]*?\\b" + SCOPE_WORD + "\\b" +
  // The un-verb branch needs the same scope word — a bare `unverified`
  // is vocabulary ("the claim remains unverified", the `## Unverified`
  // section heading), not an admission that a named unit went unseen
  // (R15-F14).
  "|\\bun(?:examined|covered|swept|verified|audited|reviewed|probed|tested|touched|mapped|analy[sz]ed)\\b[^\\n]*?\\b" + SCOPE_WORD + "\\b" +
  "|\\bskipp?ed\\s+(?:this|in this|for this|during|from (?:the|this)|per[- ]unit|every|all\\b)" +
  "|\\b(?:partial|limited)\\s+coverage\\b" +
  "|\\b(?:outside|beyond)\\s+(?:the\\s+)?scope\\b" +
  "|\\bcoverage\\s+boundary\\b" +
  "|^\\s*#{1,6}\\s*(?:boundary|limits?)\\b",
  "i"
);

// The scan's composite, shared so the corpus runner exercises the exact
// predicate the gate uses: any deferral/coverage vocabulary AND not
// disposed. `strip` is the caller's mention-stripping pass (code spans,
// quotes) — the corpus applies the same one.
export const deferralHit = (l, ok) =>
  (DEFERRAL_RE.test(l) || DEFERRAL_MARK_RE.test(l) || GAP_RE.test(l) || SELFDEFER_RE.test(l)) && !disposedOf(l, ok);

// --- Lane-scan patterns (boundary-study B1/B15/B19) — shared by
// rejection-tracker.mjs and the stop-gate's lane consults so the
// resurface predicate cannot drift between the two sites.
//
// Parked statuses are NOT terminal: FILED/CARRIED/DECLARED rows are
// deferred work wearing a label — they resurface as open (B1: TERM_RE
// counted them terminal, so a lane of parked rows injected nothing).
// Genuinely terminal dispositions (FIXED/VERIFIED/NOT-A-DEFECT and the
// corroborated pair BLOCKED/ACCEPTED — their walls/verbs get their own
// stop-gate corroboration) still end the row.
export const LANE_TERM_RE = /\b(FIXED|VERIFIED|NOT-A-DEFECT|BLOCKED|ACCEPTED|RE-DISPOSITIONED)\b/i;
export const LANE_PARKED_RE = /\b(FILED|CARRIED|DECLARED)\s*:/i;
// OPEN counts on any line (docs use it as status vocabulary);
// PENDING/UNDONE/INCOMPLETE widen the vocabulary but only on row-shaped
// lines (a `|` cell or `- [ ]` checkbox) — prose "pending review" is not
// a status (B19: OPEN-only vocabulary was the bound).
const LANE_ROWISH = /\||\[[ xX]\]/;
export const laneOpenRows = (text) =>
  text.split("\n").filter((l) => {
    const openish = /\bOPEN\b/i.test(l) || (/\b(PENDING|UNDONE|INCOMPLETE)\b/i.test(l) && LANE_ROWISH.test(l));
    return (openish && !LANE_TERM_RE.test(l)) || LANE_PARKED_RE.test(l);
  }).length;

// A lane pardon needs a reason (B15): `Lane: none`/`Ledger: closed` on a
// doc carrying open rows is a self-granted invisibility cloak — the
// bare forms no longer pardon. Reasoned forms (`— <why ≥20 chars>`) stay
// legal: a reference doc with example OPEN rows declares non-lane status
// and says why. Zero-open-row docs never reach this check anyway.
export const NOT_LANE_REASONED_RE = /^\s*(?:Lane|Ledger)\s*:\s*(?:none|closed|not-a-lane)\b[^\n]*?(?:—|--|::| - )\s*\S[^\n]{19,}/im;

// --- Marker-aware scan grammar (boundary-study B6/B14) — the dark-dir
// scan's discharge set: machinery marker heads that a check actually
// consumes. A deferral-vocabulary line in a machinery doc clears only
// when it IS one of these markers (or disposedOf/a status cell, handled
// by the caller). Anything else is prose wearing a marker costume.
// Static heads here; `EXEMPT-[A-Z0-9-]+` covers the per-check family —
// dead-marker detection (DECLARED: with no consumer) is the caller's
// job since the consumed set is derived from gate source.
export const MARKER_HEAD_RE = /^\s*(?:[-*]\s*|\d+\.\s*)?(?:EXEMPT-[A-Z0-9-]+|DECLARED|STOP|ACCEPTED-DEFERRAL|ACCEPTED-BYPASS|RE-DISPOSITIONED|PUSHBACK|LANE|Lane|Ledger|Drive|Driver|IMPOSSIBLE|CLOSURE|EXEMPT-CLOSURE|BLIND-DEBT|BLOCKED|FILED|CARRIED|ACCEPTED|NOT-A-DEFECT|UPSTREAM|PRIOR-PASS|RE-FRESH|BATCH-[A-Z]+|STALE-CLOSURE|OPEN|DONE|FIXED|VERIFIED|RESOLVED-BYPASS|ENDED|MISSING-DOC|RESUME-LANE|UNDECLARED-LEDGER|NO-DEFERRAL|REVIEW-CREDIT|TRANSCRIPT-ABSENT|VERDICT|verify)\s*[:(]/;
