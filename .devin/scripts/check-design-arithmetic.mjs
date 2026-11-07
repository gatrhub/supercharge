/**
 * check-design-arithmetic.mjs — PostToolUse design-arithmetic probe.
 *
 * The checks that are math, not judgment (Phase 4 of the design-quality
 * fix program — D4/D13 washed-out, void-island, density-thin):
 *
 *   tonal budget   — the v3 spec's ## Tonal budget declares a luminance
 *                    inequality across the chrome stack (level | token |
 *                    declared L | pair floor ΔL). This resolves each
 *                    declared token in the session's touched CSS, computes
 *                    relative luminance, and compares the MEASURED ΔL
 *                    between adjacent levels against the declared floor.
 *                    Washed-out is arithmetic; a ~3% band flags.
 *   density floor  — the domain checklist's mandatory primary-units row
 *                    ("≥6 content units at 1440") vs the coverage probe's
 *                    rendered primaryUnits count in the first viewport.
 *   shell-fill     — rendered shell width ÷ viewport width at the
 *                    audience-derived matrix width; <0.60 flags the
 *                    void-island shape.
 *   matrix width   — coverage must include a width ≥ the spec audience
 *                    row's declared viewport (desktop-class → 2560).
 *
 * Density/shell-fill/matrix read the newest .unlazy/coverage/<sid>.json —
 * this hook never launches a browser (10s PostToolUse budget); it verifies
 * what the manual probe already rendered. Tonal is static file-parse.
 *
 * Output: .unlazy/gate-state/<sid>-design-arithmetic.json — the stop-gate
 * reads the verdict; un-dispositioned flags block for rendered-work
 * sessions carrying a v3 spec.
 *
 * Escapes (in the spec doc, mirrored here): `DECLARED: tonal — <pair>
 * exempt <why>` skips one pair; `DECLARED: density — <why>` and
 * `DECLARED: shell — <why>` skip the rendered checks.
 *
 * Fail-open on any internal error — PostToolUse cannot block; the gate
 * decides what the verdict file means.
 */

import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const STATE_DIR = join(ROOT, ".unlazy", "gate-state");

let input = {};
try {
  let raw = "";
  process.stdin.setEncoding("utf-8");
  for await (const chunk of process.stdin) raw += chunk;
  input = JSON.parse(raw || "{}");
} catch { /* fail-open */ }

const sid = input.session_id || "unknown";
const toolInput = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
const filePath = String(toolInput.file_path || toolInput.path || "");

// Early exit — only css/html/j2/spec edits can change the arithmetic.
if (!/\.(css|html|j2)$/i.test(filePath) && !/design-spec|petnet\.css|base\.css/i.test(filePath)) process.exit(0);

const specPath = join(ROOT, ".unlazy", "design-spec", `${sid}.md`);
const specText = existsSync(specPath) ? readFileSync(specPath, "utf-8") : "";
const hasSpec = /design-spec v3/i.test(specText);
const statePath = join(STATE_DIR, `${sid}.json`);
let state = {};
try { state = JSON.parse(readFileSync(statePath, "utf-8")); } catch { /* none */ }

const sectionBody = (text, name) => {
  const m = text.match(new RegExp(`^#{2,6}\\s*${String(name).replace(/\s+/g, "\\s+")}\\b[^\\n]*$`, "im"));
  if (!m) return "";
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^#{1,6}\s/m);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
};

// ─── relative luminance (WCAG) ───
const chan = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lumOf = (hex) => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return 0.2126 * chan(parseInt(h.slice(0, 2), 16)) + 0.7152 * chan(parseInt(h.slice(2, 4), 16)) + 0.0722 * chan(parseInt(h.slice(4, 6), 16));
};

// ─── token resolution: every css the session touched + the edited file,
// plus sibling css of touched rendered files (mockup assets live beside
// their html). Bounded — same-dir listing only, no recursive walk. ───
const cssCandidates = new Set();
if (/\.css$/i.test(filePath)) cssCandidates.add(filePath);
// tracker schema varies by era: these keys may be arrays OR int counts
const implList = Array.isArray(state.impl_touched) ? state.impl_touched : [];
const editList = Array.isArray(state.files_edited) ? state.files_edited : [];
for (const p of [...implList, ...editList]) {
  const s = String(p);
  if (/\.css$/i.test(s)) cssCandidates.add(s);
  else if (/\.(html|j2)$/i.test(s)) {
    try {
      // secdoc B10 — the tracker records ABSOLUTE paths; join(ROOT, abs)
      // produced a path that never resolves and the sibling-css scan
      // silently never ran. Resolve first, join only relatives.
      const sAbs = isAbsolute(s) ? s : join(ROOT, s);
      const d = join(dirname(sAbs), "assets");
      for (const f of readdirSync(existsSync(d) ? d : dirname(sAbs))) {
        if (/\.css$/i.test(f)) cssCandidates.add(join(dirname(s), existsSync(d) ? "assets" : "", f));
      }
    } catch { /* best-effort */ }
  }
}
const tokenVals = {};
for (const rel of [...cssCandidates].slice(0, 30)) {
  const abs = isAbsolute(rel) ? rel : join(ROOT, rel);
  if (!existsSync(abs)) continue;
  let css = "";
  try { css = readFileSync(abs, "utf-8"); } catch { continue; }
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{3,8})\b/gi)) {
    if (!(m[1] in tokenVals)) tokenVals[m[1]] = { hex: m[2], file: rel };
  }
}

const verdict = {
  sid,
  checked_at: new Date().toISOString(),
  spec_v3: hasSpec,
  tonal: { declared: 0, measured: [], flags: [], exempt: [] },
  density: { declared_floor: null, surfaces: [], flags: [] },
  shell_fill: { surfaces: [], flags: [] },
  matrix: { required: [], probed: [], flags: [] },
  flags: [],
};
const flag = (kind, msg) => { verdict.flags.push(`${kind}: ${msg}`); };

try {
  // ─── tonal budget ───
  const tonalB = sectionBody(specText, "tonal budget");
  if (hasSpec && tonalB) {
    const sepRe = /^\s*\|[\s:\-|]+\|\s*$/;
    const rows = tonalB.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !sepRe.test(l) && !/\|\s*level\s*\|/i.test(l) && !/\|\s*<bg/i.test(l));
    const levels = rows.map((l) => {
      const c = l.split("|").map((x) => x.trim()).filter(Boolean);
      const tokM = (c[1] || "").match(/--[\w-]+/);
      return { level: c[0] || "", token: tokM ? tokM[0] : "", declaredL: parseFloat(c[2]) || null, floor: parseFloat(c[3]) || null };
    }).filter((r) => r.level && r.token);
    verdict.tonal.declared = levels.length;
    const tonalExempt = new Set();
    for (const m of specText.matchAll(/DECLARED\s*:\s*tonal\s*(?:—|--|::| - )\s*([^\s]+)\s+exempt/gi)) tonalExempt.add(m[1].toLowerCase());
    for (let i = 1; i < levels.length; i++) {
      const a = levels[i - 1], b = levels[i];
      const pair = `${a.level}→${b.level}`;
      const la = tokenVals[a.token] ? lumOf(tokenVals[a.token].hex) : null;
      const lb = tokenVals[b.token] ? lumOf(tokenVals[b.token].hex) : null;
      if (la == null || lb == null) {
        verdict.tonal.measured.push({ pair, status: "unresolved-token", tokens: [a.token, b.token] });
        continue;
      }
      const dl = Math.abs(la - lb);
      verdict.tonal.measured.push({ pair, measured_dL: +dl.toFixed(4), floor: b.floor, a: tokenVals[a.token].hex, b: tokenVals[b.token].hex });
      if (b.floor != null && dl < b.floor) {
        if (tonalExempt.has(pair.toLowerCase())) verdict.tonal.exempt.push(pair);
        else flag("TONAL", `${pair} measured ΔL ${dl.toFixed(3)} under declared floor ${b.floor} (${tokenVals[a.token].hex}→${tokenVals[b.token].hex} in ${tokenVals[a.token].file}) — the washed-out band is arithmetic`);
      }
    }
    // Stack-band check — pair ΔL can be decent while every surface still
    // lives in one extreme band: petnet's stack measured 0.80–0.98 (all
    // pale, no dark anchor) and gs's 0.005–0.022 (a 1.6% band). The
    // basin is position, not just separation. Hairline/ink/accent levels
    // are excluded — strokes aren't the stack.
    const stackLv = levels.filter((l) => !/line|border|hairline|accent|ink|text|mute|soft/i.test(l.level))
      .map((l) => ({ level: l.level, L: tokenVals[l.token] ? lumOf(tokenVals[l.token].hex) : null }))
      .filter((l) => l.L != null);
    if (stackLv.length >= 2) {
      const Ls = stackLv.map((l) => l.L);
      const span = Math.max(...Ls) - Math.min(...Ls);
      const minL = Math.min(...Ls), maxL = Math.max(...Ls);
      verdict.tonal.stack = { levels: stackLv, span: +span.toFixed(4), min: +minL.toFixed(4), max: +maxL.toFixed(4) };
      if (minL >= 0.7 && span < 0.2) flag("TONAL-BAND", `chrome stack sits entirely in the pale band (L ${minL.toFixed(2)}–${maxL.toFixed(2)}, span ${span.toFixed(2)}) — pale-on-pale with no dark anchor reads washed-out regardless of pair ΔL`);
      else if (maxL <= 0.05 && span < 0.05) flag("TONAL-BAND", `chrome stack sits entirely in the black band (L ${minL.toFixed(3)}–${maxL.toFixed(3)}, span ${span.toFixed(3)}) — dark-on-dark with no luminance separation is the gs void, not depth`);
    }
  }

  // ─── rendered-side checks need the coverage dump ───
  const covPath = join(ROOT, ".unlazy", "coverage", `${sid}.json`);
  let cov = null;
  try { cov = JSON.parse(readFileSync(covPath, "utf-8")); } catch { /* none */ }
  if (cov && Array.isArray(cov.surfaces)) {
    // audience-derived required width
    const audRow = (sectionBody(specText, "constraint ledger").match(/^\s*\|\s*audience\s*\|.*$/im) || [""])[0];
    const declaredW = audRow ? ((audRow.match(/(\d{3,5})\s*px/i) || audRow.match(/[≥>]\s*(\d{3,5})/) || [])[1] || null) : null;
    const needW = declaredW ? parseInt(declaredW, 10) : (audRow && /desktop|monitor|living[-\s]?room|tv\b|4k|uhd|consumer/i.test(audRow) ? 2560 : 0);
    if (needW) {
      verdict.matrix.required.push(needW);
      verdict.matrix.probed = cov.surfaces.map((s) => s.viewport).sort((a, b) => a - b);
      if (!verdict.matrix.probed.some((w) => w >= needW)) flag("MATRIX", `coverage probed ${[...new Set(verdict.matrix.probed)].join("/")} but the audience row declares ${declaredW || "a desktop-class audience"} (≥${needW} needed) — ${cov.matrixCheck && cov.matrixCheck.missing.length ? `probe reported missing: ${cov.matrixCheck.missing.join(",")}` : "rerun the probe at the audience width"}`);
    }
    // density floor — the checklist's mandatory primary-units row:
    // "…≥N (content )?units at <width>" or "N units/viewport".
    const dcB = sectionBody(specText, "domain checklist") + "\n" + sectionBody(specText, "checklist");
    const densM = dcB.match(/primary[-\s]?units[^|]*?(\d+)\s*\+?\s*(?:content\s*)?units?\s*(?:at|@|per)\s*(\d{3,5})?/i)
      || dcB.match(/[≥>]\s*(\d+)\s*(?:content\s*)?units?\s*(?:at|@|per)\s*(\d{3,5})?/i);
    const densFloor = densM ? parseInt(densM[1], 10) : null;
    const densWidth = densM && densM[2] ? parseInt(densM[2], 10) : null;
    verdict.density.declared_floor = densM ? { units: densFloor, width: densWidth || "desktop" } : null;
    // Optional page-class scope: a floor row that names pages
    // ("on index-class surfaces: index.html, explore.html …") applies
    // only to those surfaces — the spec's qualifier is part of the rule.
    const densRow = (dcB.split("\n").find(l => /primary[-\s]?units/i.test(l)) || dcB.split("\n").find(l => /[≥>]\s*\d+\s*(?:content\s*)?units?/i.test(l)) || "");
    const scopePages = (densRow.match(/[\w-]+\.html/gi) || []).map(s => s.toLowerCase());
    const inScope = (s) => !scopePages.length || scopePages.some(pg => String(s.name || "").toLowerCase().includes(pg) || String(s.url || "").toLowerCase().includes(pg));
    if (scopePages.length) verdict.density.scope_pages = scopePages;
    const densExempt = /DECLARED\s*:\s*density\s*(?:—|--|::| - )\s*.{4,}/i.test(specText);
    const shellExempt = /DECLARED\s*:\s*shell\s*(?:—|--|::| - )\s*.{4,}/i.test(specText);
    const shapeAgg = {};
    for (const s of cov.surfaces) {
      const off0 = (s.offsets || [])[0] || {};
      const pu = off0.primaryUnits ?? off0.stateCounts?.primaryUnits;
      const sf = off0.shellFill ?? off0.stateCounts?.shellFill;
      verdict.density.surfaces.push({ name: s.name, viewport: s.viewport, url: s.url, primaryUnits: pu });
      verdict.shell_fill.surfaces.push({ name: s.name, viewport: s.viewport, url: s.url, shellFill: sf });
      // Absolute rendered path (offsets[0].url is file:///C:/.../page.html)
      // — the registry's SHIPPED-DEBT matcher binds on this so a generic
      // surface url like /index.html can't export debt to every index.html.
      const absU = String((s.offsets || [])[0]?.url || "");
      verdict.shell_fill.surfaces[verdict.shell_fill.surfaces.length - 1].abs = absU;
      verdict.density.surfaces[verdict.density.surfaces.length - 1].abs = absU;
      if (densFloor != null && !densExempt && typeof pu === "number" && (!densWidth || s.viewport >= densWidth) && s.viewport >= 1200 && pu < densFloor && inScope(s)) {
        flag("DENSITY", `${s.name} @${s.viewport} rendered ${pu} primary units under declared floor ${densFloor} — the sparse-fold class the checklist row exists to catch`);
      }
      if (!shellExempt && typeof sf === "number" && s.viewport >= 1920 && sf < 0.6) {
        flag("SHELL-FILL", `${s.name} @${s.viewport} shell-fill ${Math.round(sf * 100)}% under 60% — void-island arithmetic at wide width`);
      }
      // BROKEN-PAINT (gs3 B9): the probe's paint audit names elements
      // that drew zero painted content — a DOM fact, not a judgment.
      // The broken-squads-avatars defect shipped through every
      // "someone must notice" layer; this flag is the one that cannot
      // not-notice.
      const paintBroken = (s.offsets || []).flatMap((o) => (o.paint && o.paint.broken) || []);
      if (paintBroken.length) {
        flag("BROKEN-PAINT", `${s.name} @${s.viewport}: ${paintBroken.length} unpainted element(s) — ${paintBroken[0].slice(0, 120)}${paintBroken.length > 1 ? " (+more)" : ""}`);
      }
      // ACCENT-SPREAD (secdoc B10): the session diagnosed "accent
      // diffused over ~1,400 code pills" at baseline, then shipped the
      // same spread — the spec-vs-shipped contradiction no one measured.
      // Painted-accent element count is a DOM number; it needs a
      // declared `accent-budget: <N>` in the spec's tonal budget.
      const acc = (s.offsets || []).map((o) => o.accent).find((a) => a && typeof a.painted === "number");
      if (acc) {
        verdict.accent = verdict.accent || { surfaces: [] };
        verdict.accent.surfaces.push({ name: s.name, viewport: s.viewport, painted: acc.painted, var: acc.var, value: acc.value });
        const budM = specText.match(/accent-budget\s*:\s*(\d+)/i);
        const budget = budM ? parseInt(budM[1], 10) : null;
        const accExempt = /DECLARED\s*:\s*accent\b[^\n]*(?:—|--|::| - )\s*\S{4,}/i.test(specText);
        if (!accExempt && budget != null && acc.painted > budget) {
          flag("ACCENT-SPREAD", `${s.name} @${s.viewport} painted ${acc.var || "accent"} on ${acc.painted} element(s) over declared accent-budget ${budget} — diffusion arithmetic: spread is measured, not judged`);
        } else if (!accExempt && budget == null && acc.painted > 300) {
          flag("ACCENT-SPREAD", `${s.name} @${s.viewport} painted ${acc.var || "accent"} on ${acc.painted} element(s) with no accent-budget: in the spec — accent on >300 elements is the diffuse-everywhere failure, not emphasis; declare accent-budget: <N> or DECLARED: accent — <why>`);
        }
      }
      // SHAPE-AUDIT (secdoc B11): the doc carried ~300 definition-shaped
      // items (li > strong "Term — explanation") that a restyle styled as
      // bullets — the spec's inventory enumerated DOM vocabulary, not
      // information shapes. Every recurring shape the census measures
      // needs a row in ## Content shapes naming its anatomy decision:
      // 'pattern | count | become — <shape>' or 'keep — <why>'.
      const shp = (s.offsets || []).map((o) => o.shapes).find((x) => x && typeof x.defList === "number");
      if (shp) {
        verdict.shapes = verdict.shapes || { surfaces: [] };
        verdict.shapes.surfaces.push({ name: s.name, viewport: s.viewport, defList: shp.defList, recordHeads: shp.recordHeads, checklist: shp.checklist, plainLi: shp.plainLi, tableRows: shp.tableRows });
        for (const [key, floor] of [["defList", 8], ["recordHeads", 3], ["checklist", 8]]) {
          if ((shp[key] || 0) >= floor) {
            shapeAgg[key] = shapeAgg[key] || { max: 0, surfaces: [] };
            shapeAgg[key].max = Math.max(shapeAgg[key].max, shp[key]);
            shapeAgg[key].surfaces.push(`${s.name}@${s.viewport}`);
          }
        }
      }
    }
    // Flags emit once per pattern class, not per surface — a single-DOM
    // doc-site re-measures the same items on every page.
    const shapeMeta = {
      defList: [/def|term|bullet|strong|name|label|list|glossar/i, "definition-shaped items (li > strong 'Term — explanation' — tabular data wearing bullets)"],
      recordHeads: [/record|issue|gap|entry|block|case|head/i, "record blocks (Issue N / Gap N heads — a case-file anatomy, not stacked cards)"],
      checklist: [/check|todo|task|done|status/i, "checklist items (done/check-class li — status data)"],
    };
    const shEsc = /DECLARED\s*:\s*content[\s-]*shapes\b[^\n]*(?:—|--|::| - )\s*\S{4,}/i.test(specText);
    const shapeKeys = Object.keys(shapeAgg);
    if (shapeKeys.length && !shEsc) {
      const shB = sectionBody(specText, "content[\\s-]*shapes");
      const names = (k) => { const l = shapeAgg[k].surfaces; return l.slice(0, 2).join(", ") + (l.length > 2 ? ` (+${l.length - 2} more)` : ""); };
      if (!shB) {
        flag("SHAPE-AUDIT", `${shapeKeys.map((k) => `${shapeAgg[k].max} ${k} (${names(k)})`).join("; ")} but the spec has no ## Content shapes section — a restyle that re-skins element classes without asking what the information wants to BE misses the document's payload; enumerate each recurring shape (pattern | count | anatomy decision) or DECLARED: content-shapes — <why>`);
      } else {
        const rows = shB.split("\n").filter((l) => /\|/.test(l));
        for (const k of shapeKeys) {
          const [kw, label] = shapeMeta[k];
          const hit = rows.find((r) => kw.test(r) && /become|keep|reword|merge|split|fold|stays|remains|→|->/i.test(r));
          if (!hit) flag("SHAPE-AUDIT", `${shapeAgg[k].max} ${label} (${names(k)}) but ## Content shapes has no decided row for that pattern — name it and decide: 'pattern | count | become — <shape>' or 'keep — <why>'`);
        }
      }
    }
  }
} catch (e) {
  verdict.error = String(e).slice(0, 200); // recorded, never thrown — fail-open
}

try {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(join(STATE_DIR, `${sid}-design-arithmetic.json`), JSON.stringify(verdict, null, 2));
  if (verdict.flags.length) console.log(`[design-arithmetic] ${verdict.flags.length} flag(s): ${verdict.flags.join(" | ")}`);
  // Shipped-registry (gs-v2 autopsy): surface debt must outlive the
  // session that produced it — a bypass ends the session but not the
  // flag. Each measured surface's latest flags replace the prior
  // entry (a clean re-measurement is the honest clear, not a session
  // boundary).
  try {
    const regPath = join(STATE_DIR, "shipped-registry.json");
    let reg = { surfaces: {} };
    try { reg = JSON.parse(readFileSync(regPath, "utf-8")) || reg; } catch { /* new */ }
    reg.surfaces = reg.surfaces && typeof reg.surfaces === "object" ? reg.surfaces : {};
    const measured = new Map();
    for (const s of [...(verdict.shell_fill?.surfaces || []), ...(verdict.density?.surfaces || []), ...(verdict.tonal?.measured || [])]) {
      const name = s && (s.name || s.surface || s.pair);
      if (!name) continue;
      const key = `${String(name).replace(/^\/+/, "")}@${s.viewport || "any"}`;
      measured.set(key, s);
    }
    const now = new Date().toISOString();
    for (const key of measured.keys()) {
      const [sName, sVp] = key.split("@");
      // flags are written as "<CHECK>: <name> @<viewport> …" — bind on
      // the full pair; a same-named surface at another viewport must
      // not inherit a flag it wasn't measured at.
      const surfFlags = verdict.flags.filter((f) =>
        f.toLowerCase().includes(`${sName.toLowerCase()} @${sVp}`) ||
        (sVp === "any" && f.toLowerCase().includes(sName.toLowerCase())));
      // Path for the gate matcher: prefer the absolute rendered path
      // (offsets url, decoded) — a short /index.html url would export the
      // debt to every index.html in the repo.
      const mSurf = measured.get(key) || {};
      let debtPath = String(mSurf.abs || mSurf.url || "");
      try { debtPath = decodeURIComponent(debtPath); } catch {}
      reg.surfaces[key] = { flags: surfFlags, ts: now, sid, path: debtPath };
    }
    writeFileSync(regPath, JSON.stringify(reg, null, 1));
  } catch { /* registry best-effort */ }
} catch { /* fail-open */ }
process.exit(0);
