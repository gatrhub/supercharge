/**
 * PostToolUse hook: render lint for written/edited .html/.css files.
 *
 * Catches write-time defect classes that have readable signatures —
 * the bugs the read-back pass (09-design-review Pass 0) exists to find.
 * Runs after edit/write on .html/.j2/.css (non-generated) and prints
 * findings into context; cannot block (PostToolUse), so every flag is
 * dispositioned by the author, not silenced.
 *
 * Classes:
 *   ICON-PLACEHOLDER — emoji/pictograph unicode in markup where the
 *     house has icon primitives (ui/design/icons.js)
 *   HIDDEN-COLLISION — `hidden` attribute on an element whose class
 *     sets `display` in the same file without a [hidden] guard —
 *     the display rule defeats the attribute silently
 *   UNDEFINED-TOKEN — var(--app-*) referencing a token declared
 *     nowhere in the file or the repo token sources
 *   NATIVE-CONTROL — raw <select>/<input type=checkbox|radio|range>
 *     in markup (banned basin: corpus prior where house primitives
 *     exist)
 */
import { readFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
let raw = "";
process.stdin.setEncoding("utf-8");
for await (const chunk of process.stdin) raw += chunk;
let input = {};
try { input = JSON.parse(raw); } catch { process.exit(0); }
if (!input || typeof input !== "object" || Array.isArray(input)) process.exit(0);

const filePath = String(input.tool_input?.file_path || "");
const content = String(
  input.tool_input?.content ?? input.tool_input?.new_string ?? ""
);
if (!/\.(html|j2|css|js|ts)$/i.test(filePath)) process.exit(0);
if (/\.min\.(css|js)$|generated/i.test(filePath)) process.exit(0);

const findings = [];
const lines = content.split("\n");
const lineOf = (idx) => content.slice(0, idx).split("\n").length;

// ORDINAL-CHROME — decorative numbering on navigation chrome (secdoc
// B10; USER-PROHIBITED). `01 Home · 02 Explore` on nav links confers a
// "systematic document" register that reads machine-stamped — two
// unrelated builds shipped it in one week (.gs-nav__idx + the doc's
// <span class="n">01</span>). Numbers that ARE the content's identity —
// legal § refs, wizard "step N", pagination — defend with ordinal-ok:
// <why>. Identity on nav comes from label + icon, never an index.
{
  const okOrd = (s) => /ordinal-ok\s*:/i.test(s);
  const win = (i, n = 400) => content.slice(i, i + n);
  const ctx = (i) => content.slice(Math.max(0, i - 200), i + 400); // ordinal-ok may sit before the element
  // Markup/JS-template form: a nav-context element whose children carry
  // a dedicated ordinal element or a padded index in the label.
  for (const m of content.matchAll(/class\s*=\s*["'][^"']*\b(?:nav|toc|menu|crumb|sidebar)[\w-]*[^"']*["']/gi)) {
    const w = win(m.index);
    if (okOrd(ctx(m.index))) continue;
    const ord = w.match(/>\s*0?\d{1,2}\s*</) || w.match(/class\s*=\s*["'][^"']*\b(?:n|num|idx|ord|seq|counter)\b[^"']*["'][^>]*>\s*0?\d{1,2}\s*</);
    if (ord)
      findings.push(`ORDINAL-CHROME :${lineOf(m.index + (ord.index || 0))} ordinal index inside nav-context chrome — "01 Home" numbering is a machine-stamped tell, not a house move; identity comes from label+icon — or <!-- ordinal-ok: <why> --> for numbered-content uses`);
  }
  // Class-name form: a class literally built to carry the ordinal
  // (.gs-nav__idx, .nav-num, .toc-ord) wherever it appears — markup,
  // templates, or JS.
  for (const m of content.matchAll(/class\s*=\s*["'][^"']*\b(?:nav|toc|menu|crumb|sidebar)[\w-]*(?:__|[-_])(?:idx|num|ord|seq|counter)\b[^"']*["']/gi)) {
    if (!okOrd(ctx(m.index)))
      findings.push(`ORDINAL-CHROME :${lineOf(m.index)} ${m[0].slice(0, 60)} — a nav-context class built for ordinals is the numbered-nav tell (gs-nav__idx form)`);
  }
  // CSS form: nav-context selectors styling ordinal classes — .css only
  // (the class-name form already covers markup/JS and would double-flag).
  if (/\.css$/i.test(filePath)) {
    for (const m of content.matchAll(/[.#\w-]*(?:nav|toc|menu|crumb|sidebar)[\w-]*(?:__|[-_])(?:idx|num|ord|seq|counter)\b|[.#\w-]*(?:nav|toc|menu|crumb|sidebar)[\w-]*\s*[>+~\s][^,{]*\.(?:n|num|idx|ord|seq|counter)\b/gi)) {
      if (!okOrd(ctx(m.index)))
        findings.push(`ORDINAL-CHROME :${lineOf(m.index)} ${m[0].trim().slice(0, 60)} — a nav-context selector styling an ordinal class is the numbered-nav tell in CSS form`);
    }
  }
}

// ICON-PLACEHOLDER — emoji/pictographs in markup files
if (/\.(html|j2)$/i.test(filePath)) {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  lines.forEach((l, i) => {
    if (!/<!--/.test(l) && emoji.test(l))
      findings.push(`ICON-PLACEHOLDER :${i + 1} emoji/unicode glyph in markup — house icons live in ui/design/icons.js`);
  });
}

// HIDDEN-COLLISION — classes on [hidden] elements with unguarded display rules
{
  const hiddenClasses = new Set();
  // Single-quoted and unquoted attribute values count too —
  // `class='x' hidden` escaped the double-quoted-only scan (R14-F22).
  // `(?<![\w-])hidden` — the bare `hidden` BOOLEAN attribute only;
  // `aria-hidden`/`data-hidden` put `-h` at a word boundary and matched
  // `\bhidden\b`, flagging their classes as hidden-using (R16 own-walk).
  for (const m of content.matchAll(/class\s*=\s*["']([^"']+)["'][^>]*(?<![\w-])hidden(?![\w-])|(?<![\w-])hidden(?![\w-])[^>]*class\s*=\s*["']([^"']+)["']|class\s*=\s*([^\s>"']+)[^>]*(?<![\w-])hidden(?![\w-])|(?<![\w-])hidden(?![\w-])[^>]*class\s*=\s*([^\s>"']+)/g))
    for (const c of (m[1] || m[2] || m[3] || m[4]).split(/\s+/)) hiddenClasses.add(c);
  for (const cls of hiddenClasses) {
    const re = new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?!\\[hidden\\])[^}]*display\\s*:`, "s");
    if (re.test(content) && !new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\[hidden\\]`).test(content))
      findings.push(`HIDDEN-COLLISION .${cls} — display rule on a [hidden]-using class without a [hidden] guard`);
  }
}

// UNDEFINED-TOKEN — var(--app-*) refs not declared in file or token sources
{
  const used = new Set([...content.matchAll(/var\((--app-[a-z0-9-]+)/gi)].map(m => m[1]));
  if (used.size) {
    let declared = new Set([...content.matchAll(/(--app-[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
    try {
      for (const tf of ["app/ui/tokens.css", "app/ui/chrome/web/shell-bundle.css", "app/ui/chrome/mobile/shell-bundle.css", "app/ui/design/display-prefs.css"])
        for (const m of readFileSync(join(ROOT, tf), "utf8").matchAll(/(--app-[a-z0-9-]+)\s*:/gi))
          declared.add(m[1]);
      // The file being edited may declare the token OUTSIDE this edit's
      // fragment — `content`/`new_string` is only the changed span, so a
      // file-local `:root` definition cried wolf on every later edit
      // (R15-F25). PostToolUse → the file on disk is already written.
      const whole = readFileSync(
        filePath.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(filePath) ? filePath : join(ROOT, filePath), "utf8");
      for (const m of whole.matchAll(/(--app-[a-z0-9-]+)\s*:/gi)) declared.add(m[1]);
    } catch {}
    for (const t of used)
      if (!declared.has(t)) findings.push(`UNDEFINED-TOKEN ${t} — referenced but declared nowhere (a fallback is not a definition)`);
  }
}

// EDGE-ACCENT — the left-edge color bar (banned, design-grammar §lazy):
// the corpus-prior "accent stripe" that reads as machine-made. Three
// authored forms: (a) colored or ≥2px border-left/inline-start on
// cards/items/nav, (b) a ::before/::after pseudo pinned to the left
// edge as a ≤8px bar, (c) a thin flex/absolute element stretched along
// the left edge (e.g. a "kind" strip). Neutral 1px separators
// (--line/--border/divider family) and quote/callout conventions are
// legitimate; `/* edge-ok: <reason> */` on the line or in the rule
// block dispositions a real use (timeline rails, thread indents).
{
  const accentVar = /--[a-z0-9-]*(sig|accent|volt|amber|violet|brand|primary|secondary|highlight|glow|info|warn|danger|error|success|blue|cyan|teal|green|red|purple|pink|orange|yellow|gold|magenta|lime|indigo|iris)[a-z0-9-]*/i;
  const neutralVar = /--[a-z0-9-]*(line|border|divider|sep|hairline|surface|muted|subtle|gray|grey|neutral|quiet)[a-z0-9-]*/i;
  const okMark = (s) => /edge-ok\s*:/i.test(s);
  const rules = [...content.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1], body: m[2], at: m.index }));
  // (a) border-left / border-inline-start as accent
  for (const m of content.matchAll(/border-(?:left|inline-start)(?:-(color))?\s*:\s*([^;}]+)/gi)) {
    if (okMark(content.slice(Math.max(0, m.index - 200), m.index + m[0].length + 200))) continue;
    const decl = m[2];
    if (/\b(none|0|inherit|initial|unset)\b/i.test(decl)) continue;
    const w = (decl.match(/(\d+(?:\.\d+)?)px/) || [])[1];
    const colored = accentVar.test(decl) || (/-color/.test(m[0]) && !neutralVar.test(decl));
    const wide = w && parseFloat(w) >= 2;
    const rule = rules.find((r) => r.at < m.index && m.index < r.at + r.sel.length + r.body.length + 4);
    const quoteSel = rule && /quote|callout|admon|thread-indent|tree-?line|indent-rail/i.test(rule.sel);
    if (colored || (wide && !quoteSel && !neutralVar.test(decl)))
      findings.push(`EDGE-ACCENT :${lineOf(m.index)} ${m[0].slice(0, 60)} — left-edge accent bar is the banned AI-tell pattern (design-grammar §lazy signals); signal state by content (weight/fill/icon), not an edge stripe — or /* edge-ok: <why> */`);
  }
  // (b)/(c) element-form edge bars: a rule block painting a ≤8px
  // column at the left edge — ::before/::after pinned bars, flex
  // stretch strips, absolute top-bottom rails.
  for (const r of rules) {
    const b = r.body;
    if (okMark(r.sel + b)) continue;
    const wPx = parseFloat((b.match(/\bwidth\s*:\s*(\d+(?:\.\d+)?)px/) || [])[1] || "99");
    const hasBg = /\bbackground(-color)?\s*:[^;}]*\S/i.test(b) && !/\bbackground(-color)?\s*:\s*(none|transparent)\b/i.test(b);
    const leftPin = /\bleft\s*:\s*(-?\d+(?:\.\d+)?)px/i.test(b) && Math.abs(parseFloat(b.match(/\bleft\s*:\s*(-?\d+(?:\.\d+)?)px/i)[1])) <= 24;
    const pseudo = /::?(before|after)\b/i.test(r.sel) && /\bcontent\s*:/i.test(b);
    const absStretch = /\bposition\s*:\s*absolute/i.test(b) && /\btop\s*:/i.test(b) && /\bbottom\s*:/i.test(b);
    const flexStretch = /\balign-self\s*:\s*stretch\b/i.test(b) || /\bposition\s*:\s*absolute[^;}]*\bheight\s*:\s*100%/i.test(b);
    const isBar = wPx <= 8 && hasBg && leftPin && (pseudo || absStretch) && !/quote|callout|admon|indent|timeline|rail|progress|scroll/i.test(r.sel);
    // A ≤8px stretch-shaped element is a strip whatever paints it —
    // the gs3 kind-strip escaped by splitting shape (base class) from
    // paint (modifier classes). Dividers/separators are the named
    // legit family and stay exempt.
    const isStrip = wPx <= 8 && flexStretch && !leftPin && !/quote|callout|admon|indent|timeline|rail|progress|scroll|divider|sep|hairline|rule\b/i.test(r.sel);
    if (isBar || isStrip)
      findings.push(`EDGE-ACCENT :${lineOf(r.at)} ${r.sel.trim().split("\n").pop().slice(0, 60)} — a ≤8px element painted along the left edge is the edge-accent pattern in element form (the nav-item/feed-strip tell); kill the strip, signal by content — or /* edge-ok: <why> */`);
  }
  // (d) inset box-shadow left stripe: `inset Npx 0 0 <color>` N≥2
  for (const m of content.matchAll(/box-shadow\s*:[^;}]*\binset\s+(\d+(?:\.\d+)?)px\s+0/gi)) {
    if (parseFloat(m[1]) >= 2 && !okMark(content.slice(Math.max(0, m.index - 200), m.index + 200)))
      findings.push(`EDGE-ACCENT :${lineOf(m.index)} inset ${m[1]}px box-shadow — a shadow-drawn left stripe is the same pattern in shadow form`);
  }
}

// NATIVE-CONTROL — raw form controls without a class (banned basin)
if (/\.(html|j2)$/i.test(filePath)) {
  for (const m of content.matchAll(/<(select|input\s+[^>]*type\s*=\s*["']?(checkbox|radio|range)\b[^"'\s>]*)[^>]*>/gi))
    // A class attribute with a real value is the escape — `class=` or
    // `class=""` is still a native control wearing nothing (R14-F22).
    if (!/class\s*=\s*["'][^"']+["']|class\s*=\s*[^\s>"']+/i.test(m[0]))
      findings.push(`NATIVE-CONTROL :${lineOf(m.index)} raw <${/select/i.test(m[1]) ? "select" : "input " + m[2]}> — house primitives required`);
}

if (findings.length) {
  console.log(`RENDER-LINT ${filePath}: ${findings.length} flag(s) — each needs a fix or a defended disposition`);
  for (const f of findings.slice(0, 12)) console.log(`  ${f}`);
}
process.exit(0);
