/**
 * build-eyes-brief.mjs — machinery-assembled independent-eyes briefs.
 *
 * Boundary-study B7: an eyes pass is only as independent as its brief,
 * and the brief was authored by the reviewed party — the agent chose
 * what the stranger saw, which is the audit's own conflict of interest.
 * This script builds the brief from the artifact and the session's own
 * records, never from the author's summary: the stranger gets the
 * artifact path, the session-touched file list from gate state, and the
 * canonical two-phase protocol verbatim. The coordinator pipes stdout
 * into the subagent task unedited and deposits the brief under
 * .unlazy/eyes/ for audit.
 *
 * Usage: node build-eyes-brief.mjs <subject-path> [--sid <session>] [--round N]
 */

import { existsSync, readFileSync, realpathSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const args = process.argv.slice(2);
// F5: parse positionals vs flags — `args[indexOf("--sid")+1]` read
// args[0] (the subject) when --sid was absent, and a flag-first
// invocation left "--sid" as the subject path.
let subject = null, sid = null, round = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--sid") { sid = args[++i] || null; continue; }
  if (args[i] === "--round") { round = args[++i] || null; continue; }
  if (!subject && !args[i].startsWith("--")) { subject = args[i]; continue; }
  console.error(`build-eyes-brief: unexpected arg "${args[i]}"`);
  process.exit(2);
}
sid = sid || process.env.SESSION_ID || "unknown";

if (!subject || !existsSync(subject)) {
  console.error(`usage: node build-eyes-brief.mjs <subject-path> [--sid <session>] [--round N] — subject must exist on disk`);
  process.exit(2);
}

// The session's own record of what it touched — the diff the stranger
// must see is the state's, not the author's description of it.
let touched = [];
try {
  const state = JSON.parse(readFileSync(join(ROOT, ".unlazy", "gate-state", `${sid}.json`), "utf8"));
  touched = [
    ...(Array.isArray(state.impl_touched) ? state.impl_touched : []),
    ...(Array.isArray(state.ui_touched) ? state.ui_touched : []),
    ...(Array.isArray(state.instrument_output_writes) ? state.instrument_output_writes.map((w) => w && w.p) : []),
  ].filter(Boolean);
} catch { /* state may not exist — the artifact alone still briefs */ }
touched = [...new Set(touched)].slice(0, 40);

const rel = subject.replace(/\\/g, "/");
const stat = statSync(subject);
const bytes = stat.size;

const brief = `You are an independent reviewer evaluating a shipped work product — not a work-in-progress awaiting validation. A real gate consumer relies on this artifact; your job is to find everything that would embarrass it in front of a hostile reviewer or a deciding user.

SUBJECT (read it in full first — this path is your entire referent; you were NOT given the author's intent, spec, or diff on purpose):
${rel} (${bytes} bytes)

${touched.length ? `SESSION-TOUCHED FILES (from gate state, not the author's summary — these changed under the same session and define the subject's blast radius):\n${touched.map((p) => `- ${String(p).replace(/\\/g, "/")}`).join("\n")}\n\n` : ""}PROTOCOL — two phases, comprehensive by requirement:

Phase A — the capture spec. First say exactly what you need to see: which sections, which lines, which sibling files, which states. For a document subject the spec is which code paths/files/transcripts to run or read — name them and the coordinator provides. Critique nothing you cannot see.

Phase B — the full critique. With the material in hand, walk the artifact as a finished product:
- VERIFY load-bearing claims against source — every file:line cite you can check, check. A cite that misstates the code is a critical finding.
- ENUMERATE the claim surface — assertions, mechanism explanations, coverage claims, verdicts — one verdict row per major claim region: strong / adequate / weak, naming weakest area and strongest objection.
- FINDINGS with severity (critical/high/medium/low) and evidence — file:line, quoted text, the counter-example. A pass with zero findings carries a DECLARED: all-clean — <why the artifact earns it>.
- SCORE the artifact 1–10 and name what the 9/10 version has that this doesn't. Judge against what a skeptical reviewer of this artifact class demands, not "fine for what it is".
- Try to FALSIFY the strongest claims — your job is refutation, not approval. Find the case the artifact didn't consider.

Report shape: capture spec first, then coverage table, per-region verdicts, scores, findings table, VERDICT line. Deposit your critique as an artifact if asked.`;

console.log(brief);

// Deposit for audit — the brief a stranger actually saw is on record.
try {
  const dir = join(ROOT, ".unlazy", "eyes");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${sid}-brief-${basename(subject).replace(/\W+/g, "-")}${round ? `-r${round}` : ""}.txt`);
  writeFileSync(out, brief);
  console.error(`[build-eyes-brief] deposited ${out.replace(/\\/g, "/")}`);
} catch { /* deposit is best-effort */ }
