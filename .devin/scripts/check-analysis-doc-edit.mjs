/**
 * PreToolUse hook: block edits that mark analysis-doc findings as "Fixed"
 * instead of removing them.
 *
 * The rule: when a finding in a file under `docs/active-work/` is
 * fixed, the finding section must be REMOVED entirely. Marking it as
 * "Status: Fixed" or "**Status:** Fixed —" is forbidden — it leaves stale
 * content in the doc and the finding is not actually gone.
 *
 * This hook fires before `edit` and `write` tool calls. It checks:
 *   1. The file path is under `docs/active-work/` and is a `.md` file.
 *   2. The new content being written contains a "Fixed" status marker.
 *
 * If both conditions are met, the hook blocks the edit (exit code 2) with
 * a reason telling the agent to remove the finding section instead.
 *
 * Blocked patterns (case-insensitive):
 *   - `**Status:** Fixed`
 *   - `**Status: Fixed**`
 *   - `Status: Fixed`
 *   - `**Status:** Fixed —` (em dash variant)
 *
 * Does NOT block:
 *   - Edits that remove text containing "Fixed" (the new_string won't
 *     contain the marker — it's the replacement, not the removed text).
 *   - Edits to files outside `docs/active-work/`.
 *   - Edits where "Fixed" appears in a non-status context (e.g. "the
 *     fixed-width font" — only blocks when "Fixed" follows a "Status:"
 *     marker).
 */

import { readFileSync } from "node:fs";

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf-8"));
  } catch {
    // Can't parse stdin — allow the action (fail open, don't block work).
    process.exit(0);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) process.exit(0);

  const toolName = input.tool_name || "";
  const toolInput = input.tool_input || {};

  // Only check edit and write tools.
  if (toolName !== "edit" && toolName !== "write") {
    process.exit(0);
  }

  // String-coerce — a non-string file_path in malformed hook input would
  // throw on `.replace` below and silently skip the check (R14 own-walk).
  const filePath = String(toolInput.file_path || "");
  const newContent = toolName === "edit" ? (toolInput.new_string || "") : (toolInput.content || "");

  // Only check files under "docs/active-work/" that are .md files.
  const normalizedPath = filePath.replace(/\\/g, "/");
  if (!normalizedPath.includes("docs/active-work/")) {
    process.exit(0);
  }
  if (!normalizedPath.endsWith(".md")) {
    process.exit(0);
  }

  // Check for "Fixed" status markers in the new content.
  // Case-insensitive. Matches patterns like:
  //   **Status:** Fixed
  //   **Status: Fixed**
  //   Status: Fixed
  //   **Status:** Fixed —
  // All markdown spellings of "marked fixed" — `Status: **Fixed**` is
  // the commonest and used to sail through (R14-F5). `Status : Fixed`,
  // `Status—Fixed`, `Status: _Fixed_` match too.
  const fixedStatusPattern = /Status\s*[:—–\-→>]+\s*[*_'"(✓✔~`\[\]]*\s*Fixed[*_'")✓✔~`\]\[]*\b/i;

  if (fixedStatusPattern.test(newContent)) {
    const reason =
      "BLOCKED: You are marking a finding as 'Status: Fixed' in an analysis doc. " +
      "The rule is to REMOVE the finding section entirely, not mark it as fixed. " +
      "Delete the finding's section (heading + body) from the doc instead of adding " +
      "a status line. If the finding's priority table entry also exists, remove that " +
      "row too.";

    // Exit code 2 = block. The reason is printed to stdout for the agent to see.
    const output = JSON.stringify({ decision: "block", reason });
    process.stdout.write(output);
    process.exit(2);
  }

  // No blocking pattern found — allow the edit.
  process.exit(0);
}

main();
