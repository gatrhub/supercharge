#!/usr/bin/env node
/**
 * cursor-hook-adapter.mjs — translate Cursor (CLI/Desktop) hook payloads
 * into the shape the .devin/scripts checks expect, run one script, and
 * translate its verdict back into Cursor's output contract.
 *
 * Usage:  node cursor-hook-adapter.mjs <script-name.mjs> [--event <name>] [--timeout-ms N]
 *
 * In:   Cursor's stdin JSON — hook_event_name, session_id/conversation_id,
 *       tool_name, tool_input, tool_output, prompt, transcript_path,
 *       status, loop_count, workspace_roots, ...
 * Out:  Cursor's stdout JSON, per event —
 *         preToolUse + permission hooks : {"permission":"allow"|"deny", agent_message, user_message}
 *         beforeSubmitPrompt            : {"continue": true|false, user_message}
 *         stop / subagentStop           : {"followup_message": <reason>} — the block reason
 *                                         re-enters as the next prompt (status must be "completed")
 *         sessionStart                  : {"additional_context": <briefing pointer>} — no script run
 *         observational events          : {}
 *
 * Safety contract: every failure path emits the event's allow-shape and
 * exits 0 — a broken adapter must never block work. The ONLY thing that
 * produces deny/followup/continue:false is a target script's own verdict
 * (stdout {"decision":"block",...} or a bare exit 2).
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const scriptName = args.find(a => !a.startsWith("--"));
const flagVal = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const TIMEOUT_MS = Math.max(1000, parseInt(flagVal("timeout-ms", "25000"), 10) || 25000);

const PERMISSION_EVENTS = new Set(["preToolUse", "beforeShellExecution", "beforeMCPExecution", "beforeReadFile", "subagentStart", "beforeTabFileRead"]);
const PROMPT_EVENTS = new Set(["beforeSubmitPrompt"]);
const STOP_EVENTS = new Set(["stop", "subagentStop"]);

const TOOL_ALIASES = {
  shell: "exec", bash: "exec", terminal: "exec", runcommand: "exec",
  strreplace: "edit", multiedit: "edit", editfile: "edit", searchreplace: "edit", reapply: "edit",
  delete: "write", deletefile: "write", createfile: "write", notebookedit: "write",
  task: "run_subagent", agent: "run_subagent", subagent: "run_subagent",
  todowrite: "todo_write", updatetodo: "todo_write", update_plan: "todo_write",
};
const mapToolName = (n) => {
  const raw = String(n || "");
  if (/^mcp:/i.test(raw)) return "mcp";
  const lower = raw.toLowerCase().replace(/[^a-z_]/g, "");
  return TOOL_ALIASES[lower] || lower;
};

const SESSIONSTART_CONTEXT =
  "This repo runs the Supercharge rule system: rules/ (or .cursor/rules/) holds the rule files, " +
  ".devin/skills/ holds the skills. Before any work, read .devin/skills/briefing/SKILL.md and " +
  "follow its procedure — it reads the rules, loads the skills your task needs, and teaches the " +
  "gate's exit forms (DECLARED/BLOCKED/ACCEPTED/IMPOSSIBLE/EXEMPT). A stop-gate recounts your " +
  "session record when you try to end it.";

const allowShape = (event) =>
  PERMISSION_EVENTS.has(event) ? { permission: "allow" }
  : PROMPT_EVENTS.has(event) ? { continue: true }
  : {};

const blockShape = (event, reason) => {
  const firstLine = String(reason || "blocked").split("\n").find(l => l.trim()) || "blocked";
  if (PERMISSION_EVENTS.has(event)) {
    return { permission: "deny", user_message: firstLine.slice(0, 300), agent_message: reason };
  }
  if (PROMPT_EVENTS.has(event)) return { continue: false, user_message: reason };
  if (STOP_EVENTS.has(event)) return { followup_message: reason };
  return {}; // observational events cannot block — verdict drops to stderr only
};

const emit = (obj) => { process.stdout.write(JSON.stringify(obj) + "\n"); process.exit(0); };

let input = null;
try { input = JSON.parse(readFileSync(0, "utf-8")); } catch { input = null; }
const event = flagVal("event", input && input.hook_event_name) || "";

if (event === "sessionStart") emit({ additional_context: SESSIONSTART_CONTEXT });
if (!input || typeof input !== "object" || Array.isArray(input)) emit(allowShape(event));
if (!scriptName) emit(allowShape(event));
// A stop that isn't a completed turn (aborted/error) must not re-prompt.
if (STOP_EVENTS.has(event) && input.status && input.status !== "completed") emit({});

const normalized = {
  session_id: input.session_id || input.conversation_id || "unknown",
  tool_name: mapToolName(input.tool_name),
  tool_input: input.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input) ? input.tool_input : {},
  tool_response: input.tool_output ?? input.tool_response,
  prompt: input.prompt ?? input.user_prompt ?? input.message ?? "",
  transcript_path: typeof input.transcript_path === "string" ? input.transcript_path : undefined,
  last_assistant_message: input.last_assistant_message,
  stop_hook_active: (input.loop_count ?? 0) > 0 ? true : input.stop_hook_active,
  hook_event_name: event,
  hook_source: "cursor",
};

const scriptPath = fileURLToPath(new URL(`./${scriptName}`, import.meta.url));
const cwd = Array.isArray(input.workspace_roots) && input.workspace_roots[0] ? input.workspace_roots[0] : process.cwd();

let child;
try {
  child = spawnSync("node", [scriptPath], {
    input: JSON.stringify(normalized), cwd, timeout: TIMEOUT_MS,
    encoding: "utf-8", windowsHide: true,
  });
} catch { emit(allowShape(event)); }
if (child.error) emit(allowShape(event));           // timeout / spawn failure → fail open
if (child.stderr) try { process.stderr.write(child.stderr); } catch {}

// Find the script's verdict — last JSON object in stdout wins.
let verdict = null;
for (const line of String(child.stdout || "").split("\n").reverse()) {
  const t = line.trim();
  if (!t.startsWith("{")) continue;
  try { const p = JSON.parse(t); if (p && typeof p === "object") { verdict = p; break; } } catch {}
}
if (verdict && verdict.decision === "block") emit(blockShape(event, verdict.reason || `blocked by ${scriptName}`));
if (child.status === 2) {                          // bare exit-2 with no JSON reason
  const why = (child.stderr || "").split("\n").find(l => l.trim()) || `blocked by ${scriptName}`;
  emit(blockShape(event, why));
}
emit(allowShape(event));
