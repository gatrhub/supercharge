/**
 * PreToolUse hook (write): prove-each-page sequencing for generative UI.
 *
 * The failure it kills (gs-v2 autopsy + gs3 live dogfood): a session
 * creates every page in one burst — 14 pages in ~21 minutes — before any
 * surface has rendered evidence; the frame multiplies before it is
 * judged, and later rounds can only patch the first shape. The dogfood
 * run exposed three escape hatches in the first version:
 *
 *   1. Same-turn pair slippage — pages were read from tracker state,
 *      which updates PostToolUse; two pages written in one turn both
 *      saw "no prior pages" and passed (index+explore shipped as a pair).
 *      Fix: enumerate session-created page files on DISK by birthtime —
 *      the file exists the instant it is written, no tracker lag.
 *   2. Evidence at the wrong width — a 1440 shot satisfied the arm,
 *      so 2560/3840 defects (centered-column voids, rail gaps) shipped
 *      unseen while the spec's audience row demanded ≥2560. Fix: the
 *      evidence must include a capture at >= the spec's declared
 *      audience width (floor 1920 when undeclared).
 *   3. Gate-once-then-spray — after the hero was evidenced, later pages
 *      wrote freely. Fix: the GATE is the most-recently-created page —
 *      every new page must be seen (rendered evidence at audience width)
 *      before the next page file can be created. One surface at a time,
 *      judged before multiplied — the designer's actual order.
 *
 * Edits to existing files, non-page targets (partials, fixtures,
 * .unlazy scratch, components, assets), and the very first page file
 * are untouched. Fail-open on any internal error.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const STATE_DIR = join(ROOT, ".unlazy", "gate-state");
const NONPAGE_RE = /(?:^|\/|\\)(?:\.unlazy|node_modules|partials?|templates?|components?|includes?|assets?|__|_)/i;
const NONPAGE_NAME = /(?:fixture|test|spec|partial|template|component|include|layout|email|dom-|scratch)/i;
const WIDTH_RE = /(\d{3,4})/g;

try {
  const input = JSON.parse(readFileSync(0, "utf-8"));
  const sid = input.session_id || "unknown";
  const fp = String(input.tool_input?.file_path || input.tool_input?.path || "");
  if (!/\.html?$/i.test(fp)) process.exit(0);
  if (NONPAGE_RE.test(fp) || NONPAGE_NAME.test(basename(fp))) process.exit(0);
  if (existsSync(fp)) process.exit(0); // edit of an existing file, not a creation

  let state = {};
  try {
    const s = JSON.parse(readFileSync(join(STATE_DIR, `${sid}.json`), "utf-8"));
    if (s && typeof s === "object" && !Array.isArray(s)) state = s;
  } catch { process.exit(0); }

  const sessionStart = Date.parse(state.ui_first_edit_at || state.design_spec_at || 0) || 0;
  const inWindow = (abs) => {
    try { return !sessionStart || statSync(abs).birthtimeMs > sessionStart - 120_000; }
    catch { return false; }
  };
  const isPage = (p) => /\.html?$/i.test(p) && !NONPAGE_RE.test(p) && !NONPAGE_NAME.test(basename(p));

  // Session-created pages: tracker set UNION the current write's
  // directory scanned by birthtime (catches same-turn pairs the tracker
  // has not recorded yet — the gs3 index+explore slippage).
  const pages = new Map(); // abs path -> birthtimeMs
  for (const p of Array.isArray(state.ui_touched) ? state.ui_touched : []) {
    const abs = String(p).replace(/\\/g, "/");
    if (!isPage(abs) || !existsSync(abs) || !inWindow(abs)) continue;
    try { pages.set(abs, statSync(abs).birthtimeMs); } catch { /* skip */ }
  }
  try {
    const dir = dirname(fp);
    for (const f of readdirSync(dir)) {
      const abs = join(dir, f).replace(/\\/g, "/");
      if (!isPage(abs) || !inWindow(abs)) continue;
      try { pages.set(abs, statSync(abs).birthtimeMs); } catch { /* skip */ }
    }
  } catch { /* dir unreadable — tracker set only */ }
  if (!pages.size) process.exit(0); // this is the first page — it IS the hero

  // The page that must be seen next = the most recently created one.
  const gated = [...pages.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const stem = basename(gated).replace(/\.[^.]+$/, "").toLowerCase();
  if (stem.length < 3) process.exit(0);

  // Audience width floor: the spec's declared audience row wins, else
  // 1920 (desktop-class). A 1440 shot cannot certify a 4K audience's
  // surface — the gs3 dogfood's void-column defects were invisible at
  // the width the evidence was taken.
  let floor = 1920;
  try {
    const specDir = join(ROOT, ".unlazy", "design-spec");
    for (const f of readdirSync(specDir)) {
      if (!/\.md$/i.test(f)) continue;
      const t = readFileSync(join(specDir, f), "utf-8");
      if (!(f === `${sid}.md` || new RegExp(`(?:OWNS|session)\\s*:\\s*${sid}\\b`, "i").test(t.slice(0, 2048)))) continue;
      const audRow = (t.match(/^\s*\|{0,2}\s*audience\s*\|.*$/im) || [""])[0] ||
                     (t.match(/^\s*audience\s*:.*$/im) || [""])[0];
      const w = (audRow.match(/(\d{3,5})\s*px/i) || audRow.match(/(?:≥|>=?)\s*(\d{3,5})/) || [])[1];
      if (w) floor = Math.max(floor, parseInt(w, 10));
      // "4K"/"UHD" in the audience row is a 3840 contract — gs3's own row
      // says "1440p/4K"; honoring the spec's words means 3840 evidence.
      if (/\b4k\b|\buhd\b/i.test(audRow)) floor = Math.max(floor, 3840);
      break;
    }
  } catch { /* spec scan best-effort */ }

  // Rendered evidence for the gated page at >= floor: a session-window
  // png whose filename carries the stem AND a 3-4 digit width >= floor,
  // or a coverage dump listing the stem at a viewport >= floor.
  const hits = [];
  const widthOf = (fname) => {
    let best = 0;
    for (const m of fname.matchAll(WIDTH_RE)) {
      const n = parseInt(m[1], 10);
      if (n >= 320 && n <= 7680 && n > best) best = n;
    }
    return best;
  };
  try {
    const unlazy = join(ROOT, ".unlazy");
    const scanDir = (d1p) => {
      for (const f of readdirSync(d1p)) {
        const fp2 = join(d1p, f);
        try {
          if (statSync(fp2).isDirectory()) { scanDir(fp2); continue; }
          if (sessionStart && statSync(fp2).mtimeMs < sessionStart - 120_000) continue;
        } catch { continue; }
        if (/\.png$/i.test(f) && f.toLowerCase().includes(stem) && widthOf(f) >= floor) hits.push(fp2);
        if (!/\.json$/i.test(f) || !/coverage/i.test(d1p + f)) continue;
        try {
          const j = JSON.parse(readFileSync(fp2, "utf-8"));
          const surfs = j.surfaces || j.pages || [];
          const ok = Array.isArray(surfs)
            ? surfs.some((s) =>
                String(s.name || s.path || s.page || "").toLowerCase().includes(stem) &&
                (parseInt(s.viewport, 10) || 0) >= floor)
            : false;
          if (ok) hits.push(fp2);
        } catch { /* unparsed */ }
        if (hits.length) return;
      }
    };
    for (const d1 of readdirSync(unlazy, { withFileTypes: true })) {
      if (!d1.isDirectory()) continue;
      scanDir(join(unlazy, d1.name));
      if (hits.length) break;
    }
  } catch { /* scan failure → fail-open below */ }

  // Element-ledger arm (gs3 B5): a rendered shot proves the page draws;
  // it says nothing about the elements inside it. The squads-div failure
  // — broken avatars shipped while the agent moved on — is invisible to
  // a page-level gate. Before the next page exists, the gated page owes
  // a per-element verdict ledger (.unlazy/elements/<stem>.md): each
  // major element named with a verdict row (fine / defect / in-progress
  // — in-progress rows are listed debt, not invisible skips). When a
  // coverage dump exists for the page, row names must substantially
  // appear in it — fabricated element lists are caught, not trusted.
  let ledgerOk = false;
  let ledgerWhy = "no .unlazy/elements/" + stem + ".md exists";
  try {
    const elDir = join(ROOT, ".unlazy", "elements");
    const elPath = join(elDir, `${stem}.md`);
    if (existsSync(elPath) && (!sessionStart || statSync(elPath).mtimeMs > sessionStart - 120_000)) {
      const elText = readFileSync(elPath, "utf-8");
      const rows = elText.split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+\|\s*$/.test(l) && !/\belement\b[\s\S]*\bverdict\b/i.test(l));
      const verdicted = rows.filter((l) => /\b(fine|ok|pass|defect|broken|in[-\s]?progress|debt|fixed|cleared|axis-na|under[-\s]?executed|unfinished|absent)\b/i.test(l));
      let covRows = 0, matched = 0, covNoPaint = false;
      try {
        for (const d1 of readdirSync(join(ROOT, ".unlazy", "coverage"))) {
          if (!/\.json$/i.test(d1)) continue;
          const j = JSON.parse(readFileSync(join(ROOT, ".unlazy", "coverage", d1), "utf-8"));
          const surfs = j.surfaces || j.pages || [];
          const hit = Array.isArray(surfs) && surfs.some((s) => String(s.name || s.path || s.page || "").toLowerCase().includes(stem));
          if (!hit) continue;
          const surf = surfs.find((s) => String(s.name || s.path || s.page || "").toLowerCase().includes(stem));
          const covTxt = JSON.stringify(j).toLowerCase();
          covRows = (surf?.offsets || [])[0]?.interactives?.length || 0;
          matched = verdicted.filter((l) => covTxt.includes((l.split("|")[1] || "").trim().toLowerCase().slice(0, 24))).length;
          // gs3 B9: a coverage dump that never ran the paint audit
          // cannot certify the elements on this page — the squads
          // avatars shipped "broken" through exactly such a dump.
          covNoPaint = !(surf?.offsets || []).some((o) => o && typeof o === "object" && "paint" in o);
          break;
        }
      } catch { /* no coverage dir — authored rows stand alone */ }
      const need = covRows ? Math.min(Math.max(covRows, 4), 12) : 4;
      ledgerOk = verdicted.length >= need && (!covRows || matched >= Math.ceil(verdicted.length * 0.5));
      ledgerWhy = ledgerOk ? "" : `${verdicted.length} verdict rows (need ≥${need}${covRows ? `, coverage-derived; only ${matched} names appear in the coverage dump` : ""})`;
      if (ledgerOk && covNoPaint) {
        ledgerOk = false;
        ledgerWhy = "coverage for this page carries no paint audit — a probe that doesn't verify elements painted can't certify them (re-run a probe emitting offsets[].paint: ui-coverage-probe has the audit; a custom probe must implement it)";
      }
      // Plan-completeness arm (gs3 B7): a long flat ledger is a page
      // graded without decomposition — ≥6 rows must group under ≥2
      // ### sections ("planned in sections" made mechanical, not prose).
      const sectionHeads = (elText.match(/^#{3,4}\s+\S/gm) || []).length;
      if (ledgerOk && verdicted.length >= 6 && sectionHeads < 2) {
        ledgerOk = false;
        ledgerWhy = `${verdicted.length} verdict rows but ${sectionHeads} ### section group(s) — a flat list is a page graded without decomposition; group the ledger under ≥2 ### sections matching the page's regions (each section is built and verdicted, not the page as one lump)`;
      }
      // Spec→ledger closure (gs3 B7): when the owning spec declares a
      // ### <surface> derivation block, its `→` element names are the
      // page's declared affordances — each must appear as a ledger row
      // (even verdicted in-progress/debt — declared affordances can't
      // silently never-ship, they carry visible rows).
      if (ledgerOk) {
        try {
          const specDir = join(ROOT, ".unlazy", "design-spec");
          for (const f of readdirSync(specDir)) {
            if (!/\.md$/i.test(f)) continue;
            const t = readFileSync(join(specDir, f), "utf-8");
            if (!(f === `${sid}.md` || new RegExp(`(?:OWNS|session)\\s*:\\s*${sid}\\b`, "i").test(t.slice(0, 2048)))) continue;
            const heads = [...t.matchAll(/^#{3,4}\s+(.+)$/gim)].map((m) => ({ name: m[1].toLowerCase(), at: m.index }));
            const head = heads.find((h) => h.name.includes(stem.slice(0, 24)) || stem.includes(h.name.slice(0, 20)));
            if (!head) break;
            const next = heads.find((h) => h.at > head.at);
            const h2 = t.indexOf("\n## ", head.at);
            const block = t.slice(head.at, next ? next.at : (h2 > head.at ? h2 : t.length));
            const ledgerNorm = elText.toLowerCase();
            const tokens = [...block.matchAll(/→\s*([^\n|]+)/g)]
              .flatMap((m) => m[1].split(/[,·+/]| and /i))
              .map((s) => s.trim().replace(/[`'"\[\]()]/g, ""))
              .filter((s) => s.length >= 4);
            const wordHit = (tok) => {
              const words = tok.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
              if (!words.length) return ledgerNorm.includes(tok.toLowerCase());
              const hits2 = words.filter((w) => ledgerNorm.includes(w)).length;
              return hits2 >= Math.ceil(words.length * 0.7);
            };
            const missingT = tokens.filter((tk) => !wordHit(tk) && !new RegExp(`omitted|absent[^\\n]*${tk.toLowerCase().slice(0, 12)}`, "i").test(elText));
            if (missingT.length) {
              ledgerOk = false;
              ledgerWhy = `spec → ledger closure: declared affordance(s) ${missingT.slice(0, 4).map((x) => `"${x.slice(0, 40)}"`).join(", ")} have no ledger row — elements the spec's ### ${stem} block promised are owed a verdict row (fine/defect/in-progress; a declared affordance that never ships is debt you carry, not a line you drop)`;
            }
            break;
          }
        } catch { /* spec closure best-effort */ }
      }
      // Paint-flag closure (gs3 B9): a coverage dump naming unpainted
      // elements for this page makes the defect a DOM fact — each
      // flagged element is owed a ledger row naming it (debt/fixed is
      // a verdict; silence is the squads-avatar failure again).
      if (ledgerOk) {
        try {
          for (const d1 of readdirSync(join(ROOT, ".unlazy", "coverage"))) {
            if (!/\.json$/i.test(d1)) continue;
            const j = JSON.parse(readFileSync(join(ROOT, ".unlazy", "coverage", d1), "utf-8"));
            const surfs = j.surfaces || j.pages || [];
            const mine = surfs.filter((s) => String(s.name || s.path || s.page || "").toLowerCase().includes(stem));
            const broken = [...new Set(mine.flatMap((s) => (s.offsets || []).flatMap((o) => (o.paint && o.paint.broken) || [])))];
            if (!broken.length) continue;
            const ledgerNorm2 = elText.toLowerCase();
            const unflagged = broken.filter((b) => {
              const words = b.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/unpainted|painted|payload|with|this|that/.test(w));
              return !words.some((w) => ledgerNorm2.includes(w));
            });
            if (unflagged.length) {
              ledgerOk = false;
              ledgerWhy = `paint audit flagged ${broken.length} unpainted element(s) and ${unflagged.length} have no ledger row (${unflagged.slice(0, 3).map((x) => `"${x.slice(0, 46)}"`).join(", ")}) — a zero-paint element is a DOM-verified defect; it gets a named row (defect/fixed/in-progress), not silence`;
            }
            break;
          }
        } catch { /* paint closure best-effort */ }
      }
    }
  } catch { /* ledger read best-effort */ }

  if (hits.length && ledgerOk) process.exit(0);

  process.stdout.write(JSON.stringify({
    decision: "block",
    reason:
      `HERO-FIRST: "${gated}" is not proven — ` +
      (!hits.length
        ? `no rendered evidence at >=${floor}px (capture "${stem}" at audience width: .unlazy/<proj>/shots/${stem}-${floor}.png or a coverage dump listing "${stem}" at viewport >=${floor}; a narrower shot cannot certify the audience's monitor). `
        : `rendered evidence exists but ${ledgerWhy} — every element on the page gets a verdict before the page advances (.unlazy/elements/${stem}.md: one row per element, | element | verdict |, fine/defect/in-progress; in-progress rows are debt you carry visibly, not skips). `) +
      `"${basename(fp)}" would multiply an unfinished surface — the broken-avatar failure: an element left half-made while the agent moved on. ` +
      `Fix what the shot shows and write the per-element verdicts, then create the next page.`,
  }));
  process.exit(2);
} catch {
  process.exit(0);
}
