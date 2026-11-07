/**
 * write-targets.mjs — shared exec-command write-target extraction.
 *
 * One home for the "a shell command wrote a file" catalog: redirects, tee,
 * cp/mv/copy-family, deletes, in-place editors, download flags, PS writers,
 * worktree-modifying git ops, patch/extract markers, recursive dir copies,
 * and inline-language writes. Two consumers feed exec commands here —
 * session-tracker.mjs (arm scan) and stop-gate.mjs (transcript
 * reconstruction + impl corroboration). R12-F7: the gate-side copy had
 * diverged to about a third of the catalog, so transcript-visible writes
 * escaped both consumers; a shared module can't drift.
 *
 * Returns { targets, markers }: targets are path tokens with quotes
 * stripped here (R13-F4 — one consumer didn't strip, and quoted targets
 * died against its `\.ext$` filters), markers are `git-write:*` /
 * `patch:*` / `extract:*` / `delete:*` / `dir-op:*` strings naming writes
 * no path token can describe (stdin diffs, archive contents, whole-
 * worktree ops, recursive deletes whose operands are already gone).
 * Trackers push markers into impl_touched verbatim so the gate can
 * corroborate string-for-string.
 */
import { join } from "node:path";
import { statSync, readdirSync, existsSync } from "node:fs";

// Impl-bearing extensions — ONE alternation shared by every token scan
// (R12-F16: sibling scans each carried a different suffix set).
const IMPL_EXTS =
  "js|mjs|cjs|jsx|ts|tsx|css|html|j2|py|pyi|sql|sh|ps1|bat|ya?ml|toml|ini|cfg|conf|json|mdc|rs|go|rb|php|java|cs|c|cc|cpp|h|hpp|vue|svelte";
const IMPL_EXT_TOKEN_G = new RegExp(`[\\w\\-./\\\\:]+\\.(?:${IMPL_EXTS})\\b`, "gi");
const QUOTED_EXT_RE = new RegExp(`["']([^"']+\\.(?:${IMPL_EXTS}))["']`, "gi");
const QUOTED_OR_BARE = `"[^"]+"|'[^']+'|[^\\s;&|>"'\`]+`;
// Flag-shaped operand tokens: dash-flags plus KNOWN slash-flags only —
// `\/[A-Za-z]{1,7}` ate real POSIX abs paths (`/tmp`, `/var`, `/nope`)
// because anything ≤7 letters after `/` counted (R13-F5 residual).
const FLAG_TOKEN_RE = /^(?:-{1,2}[\w-]+|\/(?:e|E|s|S|q|Q|f|F|a|A|MIR|PURGE|COPYALL|DCOPY|MOV|MOVE|XO|XF))$/;

/**
 * Extract write targets from a shell command string.
 * @param {string} cmd the exec command text
 * @param {string} ROOT repo root for resolving relative operands
 */
export function execWriteTargets(cmd, ROOT) {
  const targets = new Set();
  const markers = new Set();
  cmd = String(cmd || "");
  // Strip quotes at extraction — a target is a path, not a token
  // (R13-F4: callers that didn't strip lost `> "out file.js"` to the
  // `\.ext$` filters downstream).
  const add = (t) => {
    const c = String(t || "").replace(/^["']+|["']+$/g, "");
    // URL-scheme tokens aren't paths — `file:/x/doc.html` (a coverage
    // surface URL inside a node -e string) or `https://a/b.html` joined
    // onto ROOT armed impossible phantom entries (R17 dogfood). A drive
    // letter is exactly one char before the colon; a scheme is ≥2.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]+:/.test(c)) return;
    // Extension-only basenames (`//.html`, `/.js`) are regex/glob
    // fragments scraped from command text, not files — a real basename
    // carries a stem before the dot (`.eslintrc.js` keeps its stem).
    const base = c.split(/[\\/]/).pop() || "";
    if (/^\.[a-z0-9]+$/i.test(base)) return;
    if (c && !/^-/.test(c)) targets.add(c);
  };

  // Quote-masked command for the SCANS that treat `>` as syntax — a `>`
  // inside quoted prose (`echo "progress > file.js"`) is content, not a
  // redirect, and armed a fake target on every line (R15-F18 — the
  // cmdNoQ masking added for `patch` covered one primitive only). The
  // extraction still reads the ORIGINAL so a legit `> "out file.js"`
  // keeps its quoted target: the mask removes only quote-interior text.
  const cmdNoQ = cmd.replace(/"[^"\n]*"|'[^'\n]*'/g, (s) => " ".repeat(s.length));
  // Redirects / tee — quoted targets count (`> "out file.js"`). tee takes
  // MULTIPLE files (`tee f1.js f2.js`, R13-F8).
  for (const m of cmdNoQ.matchAll(/>>?\s*/g)) {
    const rest = cmd.slice(m.index + m[0].length);
    const tm = rest.match(new RegExp(`^(${QUOTED_OR_BARE})`));
    if (tm) add(tm[1]);
  }
  for (const m of cmdNoQ.matchAll(/\btee\s+[^|;&>]*/g)) {
    // Same-length mask → the match's offsets in cmdNoQ are its offsets
    // in cmd. The operand span = verb-end → match-end in the ORIGINAL,
    // so `tee "a b.js"` keeps a quoted operand while `echo "x tee y"`
    // can't fabricate one. Operands parse as QUOTED_OR_BARE tokens —
    // a naive \s+ split would shatter quoted names.
    const verbLen = (m[0].match(/^\S+/) || [""])[0].length;
    const seg = cmd.slice(m.index + verbLen, m.index + m[0].length);
    for (const tm of seg.matchAll(new RegExp(QUOTED_OR_BARE, "g"))) {
      if (!FLAG_TOKEN_RE.test(tm[0])) add(tm[0]);
    }
  }

  // cp/mv/copy-family, deletes, renames. Copies arm every operand — the
  // destination inherits the source's extension; deletes/rename write
  // every operand too (`rm a.js b.js`, R12-F10). Dash- and slash-flags
  // (`-rf`, `/MIR`) are never targets.
  for (const m of cmd.matchAll(/\b(?:cp|copy|xcopy|robocopy|mv|move|del|rm|erase|ren|rename|rmdir|rd|Copy-Item|Move-Item|Remove-Item|Rename-Item|New-Item|Clear-Content|Clear-Item)\s+([^|;&>]+)/gi)) {
    // `-WhatIf` is the PS dry-run contract — nothing writes (same
    // doctrine as `patch --dry-run` below).
    if (/\s-WhatIf\b/i.test(m[0])) continue;
    const toks = m[1].trim().split(/\s+/).filter((t) => !FLAG_TOKEN_RE.test(t));
    for (const t of toks) add(t);
    // `cp src dir/` — the destination token carries no extension, so the
    // copy's target class never arms. When the last operand is a
    // directory, synthesize dir/basename(src) for every source operand.
    const copyish = /\b(?:cp|copy|xcopy|robocopy|mv|move|ren|rename|Copy-Item|Move-Item|Rename-Item)\b/i.test(m[0]);
    if (copyish && toks.length >= 2) {
      const dst = toks[toks.length - 1].replace(/^["']|["']$/g, "");
      const dstAbs = /^([a-zA-Z]:[\\/]|\/|~[\\/])/.test(dst) ? dst : join(ROOT, dst);
      let dstIsDir = /[\\/]$/.test(dst);
      if (!dstIsDir) { try { dstIsDir = statSync(dstAbs).isDirectory(); } catch { /* not a dir */ } }
      if (dstIsDir) {
        for (const srcTok of toks.slice(0, -1)) {
          const base = String(srcTok).replace(/^["']|["']$/g, "").split(/[\\/]/).pop();
          if (base) targets.add(dst.replace(/[\\/]+$/, "") + "/" + base);
        }
      }
      // A directory SOURCE operand writes its whole contents to the
      // destination — `mv dir dst` and `cp dir dst` carry no recursive
      // flag for the scan below to key on (R13-F7). statSync the operand;
      // a dir's impl-ext children arm by name. Post-MOVE the source is
      // gone — `mv impldir dst` readdir-fails on src and the impl files
      // land invisible (R15-F4): the moved dir now lives at dst (rename)
      // or dst/basename(src) (move-into), so list THERE on src failure.
      const isMoveish = /\b(?:mv|move|ren|rename|Move-Item|Rename-Item)\b/i.test(m[0]);
      for (const srcTok of toks.slice(0, -1)) {
        const sp = String(srcTok).replace(/^["']|["']$/g, "");
        if (!sp || /^-/.test(sp)) continue;
        const spAbs = /^([a-zA-Z]:[\\/]|\/|~[\\/])/.test(sp) ? sp : join(ROOT, sp);
        let listedDir = null;
        try { if (statSync(spAbs).isDirectory()) listedDir = sp.replace(/[\\/]+$/, ""); } catch { /* moved away / not a dir */ }
        // The dir moved: `mv impldir dst` → dst/impldir (dst existed) or
        // dst itself (rename). The dst-listing only applies to ext-less
        // sources — `mv file.js dir/` would otherwise arm every impl file
        // already living in dir/ as a write it never made (R15-F4 bound).
        const base = sp.split(/[\\/]/).pop();
        if (!listedDir && isMoveish && base && !/\.[^\\/]+$/.test(base)) {
          // dst/base existing as a FILE proves src was a file moved into
          // an existing dir — the dstAbs rename-fallback must not fire
          // (it would arm dst's whole pre-existing contents).
          const dstBase = join(dstAbs, base);
          if (existsSync(dstBase)) {
            try { if (statSync(dstBase).isDirectory()) listedDir = dstBase; } catch { /* gone */ }
          } else {
            try { if (statSync(dstAbs).isDirectory()) listedDir = dstAbs; } catch { /* gone */ }
          }
        }
        if (listedDir) {
          try {
            for (const f of readdirSync(listedDir)) {
              if (new RegExp(`\\.(${IMPL_EXTS})$`, "i").test(f)) targets.add(listedDir.replace(/[\\/]+$/, "") + "/" + f);
            }
          } catch { /* unreadable — markers below cover the rest */ }
        }
      }
    }
  }

  // In-place editors — strict flag-first form, then the lazy `-i` span.
  // The span captures EVERY ext-bearing token inside it (R12-F20:
  // `sed -i 's/a/b/' f1.js f2.js` used to arm f2 only) — and the operand
  // tokens themselves: the first non-flag token after the flag span is
  // the script/expression, the REST are files rewritten in place, ext or
  // not (R15 own-walk: `sed -i s/a/b/ notes.txt` armed nothing — the
  // ext-token scan only sees impl extensions).
  // Bundled-flag in-place forms arm the same way — `-ri`/`-Ei`/`-pie`/
  // `--in-place` all contain `i` inside one dash-token. The flag span
  // requires a dash-token CONTAINING i — read-only flags (`-n`, `-e`)
  // never arm (R16-F6 bundled forms escaped; R16-F8: the old `i?` made
  // any single-flag `sed -n` read-only line arm the operand file).
  for (const m of cmd.matchAll(/\b(?:sed|perl|awk|jq|yq)\s+(?:-\S+\s+)*--?[A-Za-z-]*i[A-Za-z-]*\b([^;&|]*)/gm)) {
    for (const tm of m[0].matchAll(IMPL_EXT_TOKEN_G)) add(tm[0]);
    for (const tm of m[0].matchAll(QUOTED_EXT_RE)) add(tm[1]);
    let scriptSeen = false;
    for (const t of String(m[1] || "").trim().split(/\s+/).filter(Boolean)) {
      if (FLAG_TOKEN_RE.test(t)) continue;
      if (!scriptSeen) { scriptSeen = true; continue; }
      add(t);
    }
  }

  // dd of=, download flags (short AND long — `--output-document=`,
  // R13-F7), installs/sync, PS writers incl. -Path forms.
  for (const m of cmd.matchAll(/\bdd\s+[^|;&]*?\bof=("[^"]+"|'[^']+'|[^\s;&|]+)/gi)) add(m[1]);
  // `-o`/`-OutFile`/`--output` operand-style flags; wget `-O` is
  // operand-style too (curl `-O` is NOT — it is remote-name, handled
  // below). Case-sensitive: `-OL` parses as `-O -L`, never `-o L`, so
  // merged flags can't be captured as operands and a real `curl -o f`
  // single-char filename still arms (R15-F19 residual + R16 fix).
  for (const m of cmd.matchAll(/\b(?:curl|fetch)\b[^|;&]*?(?:\s-o\s*|\s--output\s*[=\s])\s*("[^"]+"|'[^']+'|[^\s;&|]+)/g)) add(m[1]);
  // iwr's -OutFile is case-insensitive PS-style — `-outfile`/`-OUTFILE`
  // are the same flag. iwr NEVER writes a remote-named file (the response
  // goes to stdout/the pipeline), so it can't share the remoteish pool —
  // no -OutFile = no file (R16-F7: over-arm on reads, under-arm on
  // lowercase -outfile).
  for (const m of cmd.matchAll(/\b(?:Invoke-WebRequest|iwr)\b[^|;&]*?(?:\s-OutFile\s*[=\s])\s*("[^"]+"|'[^']+'|[^\s;&|]+)/gi)) add(m[1]);
  for (const m of cmd.matchAll(/\bwget\b[^|;&]*?(?:\s-o\s*|\s-O\s*|\s--output(?:-document)?\s*[=\s])\s*("[^"]+"|'[^']+'|[^\s;&|]+)/g)) add(m[1]);
  // Remote-name writes: `wget <url>`, `fetch <url>`, `curl -O/-OL/-J`,
  // `certutil -urlcache`/`bitsadmin` — target is <basename(url)> into
  // cwd; `-P dir` prefixes output (R14-F7). The -O/-J test is
  // CASE-SENSITIVE — `-o` is operand-style and never writes a
  // remote-named file (R15-F19 residual). iwr/Invoke-WebRequest is
  // absent here by design — it prints the response, never writes
  // remote-named (R16-F7).
  for (const m of cmd.matchAll(/\b(?:wget|fetch|certutil|bitsadmin|curl)\b([^|;&>]+)/gi)) {
    const pfx = (m[1].match(/(?:^|\s)-P\s*("[^"]+"|'[^']+'|\S+)/) || [])[1] || "";
    // wget `-O`/`--output-document` and fetch `-o`/`--output` are output
    // operands — the remote-named file never lands; wget `-o` is a LOG
    // file, so the download still writes remote-named alongside it.
    const remoteish = (/\bwget\b/i.test(m[0]) && !/(?:\s-O\b|\s--output(?:-document)?\b)/.test(m[0])) ||
      (/\bfetch\b/i.test(m[0]) && !/(?:\s-o\b|\s--output\b)/.test(m[0])) ||
      /\b(?:certutil|bitsadmin)\b/i.test(m[0]) ||
      (/\bcurl\b/i.test(m[0]) && /(?:-[A-Za-z]*O|-[A-Za-z]*J|--remote-name)/.test(m[0]));
    if (!remoteish) continue;
    for (const t of m[1].split(/\s+/)) {
      const clean = t.replace(/^["']|["']$/g, "");
      if (/^https?:\/\//i.test(clean)) {
        const base = clean.split(/[?#]/)[0].split("/").pop();
        if (base) add((pfx ? pfx.replace(/^["']|["']$/g, "").replace(/[\\/]+$/, "") + "/" : "") + base);
      }
    }
  }
  for (const m of cmd.matchAll(/\b(?:install|rsync|scp)\s+([^|;&>]+)/gi)) {
    for (const t of m[1].trim().split(/\s+/).filter((t) => !FLAG_TOKEN_RE.test(t))) add(t);
  }
  for (const m of cmd.matchAll(/\b(?:Set-Content|Out-File|Add-Content)\b\s+(?:-\w+\s+\S+\s+)*("[^"]+"|'[^']+'|\S+)/gi)) add(m[1]);
  for (const m of cmd.matchAll(/\b(?:Set-Content|Out-File|Add-Content)\b[^|;&]*?\s-(?:Path|FilePath|LiteralPath|Value)\s+("[^"]+"|'[^']+'|\S+)/gi)) add(m[1]);
  // Windows-native write channels with no Unix analogue (R15-F20):
  // `fsutil file createnew <f> <n>` writes a zeroed file; `mklink <link>
  // <target>` writes the link; `certutil -urlcache -f <url> <f>` writes f.
  for (const m of cmd.matchAll(/\bfsutil\s+file\s+createnew\s+("[^"]+"|'[^']+'|\S+)/gi)) add(m[1]);
  for (const m of cmd.matchAll(/\bmklink\s+(?:\/\w+\s+)?("[^"]+"|'[^']+'|\S+)/gi)) add(m[1]);
  for (const m of cmd.matchAll(/\bcertutil\s+[^|;&]*?-f\s+("[^"]+"|'[^']+'|\S+)\s+("[^"]+"|'[^']+'|\S+)/gi)) add(m[2]);
  // PowerShell alias verbs — `sc`/`ac`/`oc` (Set/Add/Out-Content) and the
  // `?i` Item aliases write files but are 2-letter tokens that false-
  // positive everywhere outside a PS context (`grep ci file`). Only arm
  // them when the command is unambiguously pwsh/powershell (R15-F20).
  if (/\b(?:pwsh|powershell)(?:\.exe)?\b/i.test(cmd)) {
    // Flags that take a non-path value — the token after one is data
    // (`-Value 'text'`), not a path operand; switches (-Recurse, -Force)
    // take nothing so the next bare token IS an operand (R16-F5: the old
    // flag-pair group needed a value after every flag, so `ri -Recurse
    // dir` captured `-Recurse` and armed nothing).
    const PS_VALUE_FLAGS = /^-(?:Value|Values|Credential|Encoding|Filter|Include|Exclude|Message|Delimiter|Separator|ErrorAction|WarningAction|InformationAction|ErrorVariable|WarningVariable|OutVariable|OutBuffer|As|Type|ItemType|Attributes|Confirm)\b/i;
    for (const m of cmd.matchAll(/\b(sc|ac|oc|ri|mi|ci|ni|si|ii)\b([^|;&]*)/g)) {
      if (/\s-WhatIf\b/i.test(m[0])) continue;
      const span = m[2].replace(/^\s*\w+\s+/, "");
      for (const nm of span.matchAll(/(?:^|\s)-(?:LiteralPath|Path|Destination|Target|Name|NewName|FilePath)\s+("[^"]+"|'[^']+'|[^\s;&|]+)/gi)) add(nm[1]);
      // `sc f.js content` — for content verbs only the FIRST positional
      // is the path; the rest is literal content (R16-F5: `sc f.js x`
      // armed `x` as a write). Item verbs' positionals are all paths.
      const contentVerb = /^(?:sc|ac|oc)$/i.test(m[1]);
      let positionalSeen = false;
      const toks = span.split(/\s+/).filter(Boolean);
      for (let i = 0; i < toks.length; i++) {
        if (/^-/.test(toks[i])) { if (PS_VALUE_FLAGS.test(toks[i])) i++; continue; }
        if (contentVerb && positionalSeen) continue;
        positionalSeen = true;
        add(toks[i]);
      }
    }
  }

  // Worktree-modifying git ops: impl-extension tokens after the verb are
  // targets; a tokenless op (`merge`, `reset --hard`, `checkout .`) still
  // writes the worktree — mark it so consumers can't lose the arm.
  // `stash`/`clean`/`format-patch` mutate or write files too (R13-F7).
  // `worktree` needs a mutating subcommand — `worktree list` is read-only
  // (R14 own-walk: bare `worktree` would over-arm on the read shape).
  for (const m of cmd.matchAll(/\bgit\s+(?:(?:checkout|restore|apply|reset|stash|merge|pull|rebase|cherry-pick|am|format-patch|clean|switch|revert|submodule)\b|worktree\s+(?:add|remove|move|repair|prune)\b)/gi)) {
    const after = cmd.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 300);
    const before = targets.size;
    for (const tm of after.matchAll(IMPL_EXT_TOKEN_G)) add(tm[0]);
    if (targets.size === before) markers.add(`git-write:${m[0].replace(/\s+/g, "-")}`);
  }

  // `patch` at command position only — `git format-patch` and
  // `cat patch-notes.txt` are not the diff tool (R12-F18). A stdin-fed
  // patch writes whatever the diff names — mark the source. cmdNoQ
  // (same-length quote mask, hoisted at the top for the redirect/tee
  // scans) positions-preserved: `echo "applying the patch file"` put
  // `patch:stdin` on a non-write (R14-F8); extraction still reads the
  // ORIGINAL so a quoted filename survives.
  const PATCH_CMD_RE = new RegExp(String.raw`(?:^|[;&|]\s*|\s)patch\s+(?=[-\x3c]|[\w./\\])`);
  if (PATCH_CMD_RE.test(cmdNoQ) && !/--dry-run\b/i.test(cmd)) {
    const diff = (cmd.match(/[\x3c]\s*([^\s|;&]+)/) || [])[1];
    markers.add(`patch:${diff || "stdin"}`);
  }

  // `tar -xf`/`unzip`/`Expand-Archive` write whatever the archive holds —
  // mark the artifact the writes came through.
  for (const m of cmd.matchAll(/\b(?:unzip|Expand-Archive|tar\s+\S*x\w*)\b\s*[^|;&]*/gi)) {
    const arch = m[0].split(/\s+/).slice(1).find((t) => !/^-/.test(t));
    markers.add(`extract:${(arch || "archive").replace(/^["']|["']$/g, "")}`);
  }

  // Recursive dir copies/mirrors/deletes carry no extension on the
  // operand — read the dir and arm its impl-extension contents (R12-F10:
  // rm/del recursive and robocopy /MIR were invisible). `-a`/`--archive`
  // imply recursion for the copy verbs; `rmdir`/`rd` delete too (R13-F7).
  // Deletes CANNOT be listed: PostToolUse runs after `rm -rf dir` — the
  // operand is already gone and readdirSync throws. A failed read on a
  // destructive verb therefore arms a `delete:` marker rather than
  // silently dropping the whole op (R13-F5: the listing-only design
  // armed nothing for the exact case it was built for).
  for (const m of cmd.matchAll(/\b(cp|copy|xcopy|robocopy|rsync|mv|move|rm|del|erase|rmdir|rd|Copy-Item|Move-Item|Remove-Item|Rename-Item|New-Item|Clear-Content|Clear-Item)\s+([^|;&>]+)/gi)) {
    if (/\s-WhatIf\b/i.test(m[0])) continue;
    const deletish = /^(?:rm|del|erase|rmdir|rd|Remove-Item|Clear-Content|Clear-Item)$/i.test(m[1]);
    const span = m[2];
    // Recursive op? Flag ANYWHERE in the operand span — `-rf`/`-a`/
    // `--archive`, robocopy /MIR|/E|/S, del /s. Flag-FIRST is the normal
    // order (`rm -rf dir`); the old `\s-flag` scan required flag-LAST
    // and never matched the common shape at all (R13-F5 — even deader
    // than reported: the delete-marker never fired AND the flag test
    // was positionally inverted).
    if (!/(?:^|\s)-\w*[rRsSfFaA]\w*|(?:^|\s)--(?:archive|recursive)\b|(?:^|\s)\/(?:e|E|s|S|MIR|PURGE|COPYALL|DCOPY|MOV|MOVE)\b/.test(span)) continue;
    for (const t of span.split(/\s+/)) {
      // Flag-shaped tokens only — `/s`/`/MIR` are flags; `/abs/path` and
      // `dir/` are operands (slash-flags must be KNOWN names — `\/\w{1,7}`
      // dropped every short POSIX-absolute operand before readdir/marker
      // could see it).
      if (FLAG_TOKEN_RE.test(t) || /^["']?$/.test(t)) continue;
      const clean = t.replace(/^["']|["']$/g, "");
      let listed = false;
      try {
        const dp = /^([a-zA-Z]:[\\/]|\/|~[\\/])/.test(clean) ? clean : join(ROOT, clean);
        for (const f of readdirSync(dp)) {
          if (new RegExp(`\\.(${IMPL_EXTS})$`, "i").test(f)) {
            targets.add(clean.replace(/[\\/]+$/, "") + "/" + f);
          }
        }
        listed = true;
      } catch { /* gone already / not a dir / unreadable */ }
      if (!listed && clean) markers.add(`${deletish ? "delete" : "dir-op"}:${clean}`);
    }
  }

  // Inline-language writes: a write-ish primitive arms every
  // impl-extension token in the command (`python -c "open('x.rs','w')"`,
  // `node -e "writeFileSync('y.js',…)"`).
  // The mode must be a complete quoted token — without the closing
  // quote the filename's own chars satisfy the mode class (`open('x.py',
  // 'r')` armed via `'x`, R14-F17 residual). `[wa+x+]` covers `r+`/`rb+`
  // real write modes; pure `r`/`rb`/`rt` correctly stay unarmed.
  if (/writeFileSync|appendFileSync|write_text|write_bytes|WriteAll(Text|Bytes|Lines)?|open\s*\([^)]*['"][rwabx+]*[wa+x+][rwabx+]*['"]|Set-Content|Out-File|Add-Content/.test(cmd)) {
    for (const m of cmd.matchAll(IMPL_EXT_TOKEN_G)) add(m[0]);
  }
  // open()/fopen() path extraction — the impl-ext token scan above only
  // arms code files, so `open('data.txt','w')` wrote a file invisibly
  // (R15-F8 residual: the claimed filename-as-mode FP is not real —
  // `'x.py'` can't satisfy the mode class — but the real escape is that
  // non-impl-ext write targets never armed). Extract the path arg when
  // the mode writes; `r+`/`rb+`/`a+` all count as writes. Two- and
  // three-arg Python forms, plus Perl/PHP `open(F,">f")` shapes.
  for (const m of cmd.matchAll(/\b(?:open|fopen)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([rwabx+]{1,4})['"]/g)) {
    if (/[wa+x+]/.test(m[2])) add(m[1]);
  }
  // Perl two-arg `open(F,">f")` / `open(F,">>f")` writes f; `<` or bare
  // are reads. The second arg is a quoted `>`-prefixed path.
  for (const m of cmd.matchAll(/\bopen\s*\(\s*\w+\s*,\s*['"]>{1,2}([^'"]+)['"]/g)) add(m[1]);

  return { targets: [...targets], markers: [...markers] };
}