/**
 * ui-coverage-probe.mjs — DOM-derived coverage for the design-review gate.
 *
 * The coverage table's raw material must come from outside the author:
 * a hand-written enumeration can silently skip the element that needed
 * questioning (the untouched-element blind spot). This probe dumps what
 * the rendered DOM actually contains — every interactive element, every
 * landmark/section, plus the state counts no screenshot enumerates
 * (hidden/disabled/aria-pressed/details/inputs) — per surface × viewport
 * × scroll offset. Read-only: it never clicks (a probe must not mutate).
 *
 * Usage:
 *   node .devin/scripts/ui-coverage-probe.mjs <config.json>
 *
 * Config:
 *   {
 *     "sid":     "<session id>",
 *     "base":    "http://127.0.0.1:8010",
 *     "cookie":  "__Host-app_session=...; app_csrf=...",
 *     "ua":      "the appVerify/1.0",
 *     "browser": "C:/Program Files/BraveSoftware/.../brave.exe",  // optional
 *     "pages": [
 *       { "name": "events board · cards", "url": "/app/g/<slug>/c/<id>",
 *         "viewports": [1400, 390], "scrollSteps": 2 }
 *     ]
 *   }
 *
 * Output: .unlazy/coverage/<sid>.json — cited as `coverage-source:` in the
 * design-review artifact. The gate compares interactives count against
 * the coverage table's enumerated elements.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.DEVIN_PROJECT_DIR || resolve(realpathSync(dirname(fileURLToPath(import.meta.url))), "..", "..");
const cfgPath = process.argv[2];
if (!cfgPath) { console.error("usage: ui-coverage-probe.mjs <config.json>"); process.exit(2); }
const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
const OUT_DIR = join(ROOT, ".unlazy", "coverage");
mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, `${cfg.sid || "unknown"}.json`);

const require = createRequire(join(ROOT, "app/package.json"));
const puppeteer = require("puppeteer-core");
const BRAVE = cfg.browser || "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DUMP = `(() => {
  const interactives = [];
  const seen = new Set();
  const S = "button, a[href], input, select, textarea, summary, [data-action], [role=button], [role=tab], [role=switch], [role=link], [contenteditable=true]";
  for (const el of document.querySelectorAll(S)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const key = (el.tagName + "|" + (el.getAttribute("data-action") || "") + "|" + (el.textContent || "").slice(0, 40)).replace(/\\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    const deadSig = (() => {
      if (el.tagName === "A") { const h = el.getAttribute("href") || ""; return h === "" || h === "#" || h.startsWith("javascript:"); }
      if (el.hasAttribute("onclick") || typeof el.onclick === "function") return false;
      if (el.getAttribute("data-action")) return false;
      if (el.getAttribute("aria-haspopup") || el.getAttribute("aria-controls")) return false;
      if (el.closest("form") && (el.type === "submit" || el.tagName === "BUTTON")) return false;
      if (el.tagName === "INPUT" && el.type === "hidden") return false;
      if (el.tagName === "SUMMARY") return false; // details' native toggle needs no handler — secdoc run flagged every fold
      return true;
    })();
    // Geometry: nearest horizontal clipper — flag an interactive whose box
    // exceeds the clipper's padding box when it can NOT be scrolled into
    // view (overflow hidden/clip, or no scroll range). Scrollable overflow
    // is recorded but classed 'scrollable' — legitimate, not a defect.
    const clip = (() => {
      if (["fixed", "sticky"].includes(getComputedStyle(el).position)) return null;
      let a = el.parentElement;
      while (a) {
        const o = getComputedStyle(a);
        if (["hidden", "auto", "scroll", "clip"].includes(o.overflowX)) {
          const cr = a.getBoundingClientRect();
          const inL = cr.left + parseFloat(o.borderLeftWidth);
          const inR = cr.right - parseFloat(o.borderRightWidth);
          const over = r.right > inR + 1 ? r.right - inR : r.left < inL - 1 ? inL - r.left : 0;
          if (!over) return null;
          return {
            clipper: a.tagName.toLowerCase() + "." + (typeof a.className === "string" ? a.className.split(/\\s+/)[0] : ""),
            over: Math.round(over),
            axis: r.right > inR + 1 ? "right" : "left",
            scrollable: !["hidden", "clip"].includes(o.overflowX) && a.scrollWidth > a.clientWidth + 1,
          };
        }
        a = a.parentElement;
      }
      return null;
    })();
    // Occlusion: what a click at the element's center would actually hit.
    // Elements whose center sits outside the viewport are scrolled, not
    // occluded — skipped here; scroll offsets cover them elsewhere.
    const occludedBy = (() => {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return null;
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return null;
      return hit.tagName.toLowerCase() + "." + (typeof hit.className === "string" ? (hit.className.split(/\\s+/)[0] || "") : "");
    })();
    interactives.push({
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      clip,
      occludedBy,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 48),
      role: el.getAttribute("role") || "",
      action: el.getAttribute("data-action") || "",
      aria: el.getAttribute("aria-label") || "",
      disabled: !!el.disabled || el.getAttribute("aria-disabled") === "true",
      pressed: el.getAttribute("aria-pressed"),
      deadCandidate: deadSig,
      cls: (el.className && typeof el.className === "string" ? el.className : "").split(/\\s+/).slice(0, 3).join(" ")
    });
  }
  const sections = [];
  for (const el of document.querySelectorAll("main, section, article, aside, nav, form, details, table, ul[class], ol[class], [class*=card], [class*=list], [class*=grid], [class*=rail], [class*=hero], h1, h2, h3")) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 8) continue;
    sections.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && typeof el.className === "string" ? el.className : "").split(/\\s+/).slice(0, 3).join(" "),
      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40)
    });
    if (sections.length >= 60) break;
  }
  // Interactive containers: every element holding interactive descendants —
  // the parentage map the spec's ## Embedded surfaces / recursion rows get
  // diffed against. A container with interactives and no spec treatment is
  // an undesigned interior made visible.
  const containers = [];
  for (const el of document.querySelectorAll("dialog, [role=dialog], [class*=modal], [class*=sheet], [class*=drawer], [class*=popover], [class*=dropdown], [class*=menu], form, fieldset, table, [class*=list], [class*=grid], [class*=toolbar], [class*=tabs]")) {
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 8) continue;
    const kids = el.querySelectorAll(S).length;
    if (!kids) continue;
    containers.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && typeof el.className === "string" ? el.className : "").split(/\\s+/).slice(0, 3).join(" "),
      interactives: kids
    });
  }
  // Primary content units in the first viewport — the density-floor
  // counter (Phase 4 arithmetic). A primary unit is a distinct content
  // object a user could name: card, row, article, list item, media tile —
  // in the MAIN region only (rail/header/footer chrome doesn't count).
  // v3's failure was ~2 units of real content in a 1440 first-fold.
  const primaryUnits = (() => {
    const main = document.querySelector("main, [role=main], #main, .main, [class*=content]:not([class*=sidebar])") || document.body;
    const seen = new Set();
    let n = 0;
    for (const el of main.querySelectorAll("article, [class*=card], [class*=tile], [class*=post], [class*=row]:not([class*=header]), li, [class*=item], [class*=entry], tr, .msg, [class*=message], [class*=stat], [class*=conv], [class*=slot], [class*=node], [class*=detail], details")) {
      if (el.tagName === "LI" && el.closest("nav, [class*=menu], [role=navigation]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 24) continue;
      if (r.top > innerHeight) continue;
      const key = el.tagName + "|" + Math.round(r.top / 20) + "|" + Math.round(r.left / 40) + "|" + (el.id || (el.className + "").split(/\\s+/)[0] || "");
      if (seen.has(key)) continue;
      // Nested-card double count: skip when an ancestor already counted.
      let anc = el.parentElement, dup = false;
      while (anc && anc !== main) {
        if (anc.matches && anc.matches("article, [class*=card], [class*=tile], [class*=post]") && anc.getBoundingClientRect().top <= r.top + 4) { dup = true; break; }
        anc = anc.parentElement;
      }
      if (dup) continue;
      seen.add(key); n++;
    }
    return n;
  })();
  // Shell-fill ratio — void-island arithmetic: the fraction of viewport
  // width that holds any rendered content. A centered 1500px column on a
  // 3840 monitor covers ~39% — the void the 1440 matrix never saw. The
  // widest single element can't answer this (a full-bleed header masks
  // the empty margins) — union the horizontal intervals of real content.
  const shellFill = (() => {
    const ivs = [];
    for (const el of document.querySelectorAll("main *, [role=main] *, article, [class*=card], [class*=tile], [class*=post], [class*=list] *, section, aside, nav")) {
      const r = el.getBoundingClientRect();
      if (r.width < 30 || r.height < 10) continue;
      if (r.left >= innerWidth || r.right <= 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      // leaf-ish content only — parents duplicate the same interval
      if (el.children.length > 6) continue;
      ivs.push([Math.max(0, r.left), Math.min(innerWidth, r.right)]);
      if (ivs.length > 4000) break;
    }
    if (!ivs.length) return 0;
    ivs.sort((a, b) => a[0] - b[0]);
    let covered = 0, curL = ivs[0][0], curR = ivs[0][1];
    for (const [l, r] of ivs) {
      if (l > curR) { covered += curR - curL; curL = l; curR = r; }
      else curR = Math.max(curR, r);
    }
    covered += curR - curL;
    return innerWidth ? Math.round((covered / innerWidth) * 100) / 100 : 0;
  })();
  // Accent census (secdoc B10): "accent diffused over ~1,400 code
  // pills" was the session's own baseline diagnosis — then it shipped
  // the same spread unmeasured, because the budget was prose. Painted
  // accent spread is a DOM number: count elements whose computed
  // color/background/border resolves within distance of the accent
  // token. Measured-vs-declared is the arithmetic check, not eyes.
  const accent = (() => {
    const root = getComputedStyle(document.documentElement);
    let raw = "", varName = "";
    for (const v of ["--sig", "--accent", "--app-accent", "--primary", "--brand"]) {
      const val = (root.getPropertyValue(v) || "").trim();
      if (val && !/^(transparent|none|inherit|currentcolor|initial)$/i.test(val)) { raw = val; varName = v; break; }
    }
    if (!raw) return null;
    const probe = document.createElement("i");
    probe.style.color = raw;
    (document.body || document.documentElement).appendChild(probe);
    const ref = getComputedStyle(probe).color;
    probe.remove();
    const rm = ref.match(/(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
    if (!rm) return null;
    const refRgb = [+rm[1], +rm[2], +rm[3]];
    const near = (str) => {
      const mm = String(str || "").match(/(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
      if (!mm) return false;
      return Math.abs(+mm[1] - refRgb[0]) + Math.abs(+mm[2] - refRgb[1]) + Math.abs(+mm[3] - refRgb[2]) <= 60;
    };
    let painted = 0;
    const sample = [], seen = new Set();
    const all = document.querySelectorAll("body *");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      const via = near(cs.color) ? "color" : near(cs.backgroundColor) ? "bg" :
        (near(cs.borderTopColor) || near(cs.borderBottomColor) || near(cs.borderLeftColor) || near(cs.borderRightColor)) ? "border" : "";
      if (!via) continue;
      painted++;
      if (sample.length < 12) {
        const key = el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.split(/\\s+/)[0] : "");
        if (!seen.has(key)) { seen.add(key); sample.push(via + ":" + key); }
      }
    }
    return { var: varName, value: ref, painted, sample };
  })();
  // Content-shape census (secdoc B11): element classes are what the DOM
  // HAS; information shapes are what the doc SAYS. A restyle that styles
  // li but never asks what the data is ships 300+ bullets that wanted
  // to be a register. Count recurring information shapes so the spec owes
  // each one an anatomy decision (keep — why / become — what).
  const shapes = (() => {
    let defList = 0, checklist = 0, recordHeads = 0, plainLi = 0;
    const defSample = [];
    for (const li of document.querySelectorAll("li")) {
      const cls = typeof li.className === "string" ? li.className : "";
      if (/(^|\\s)(done|check|task|todo)(\\s|$)/i.test(cls)) { checklist++; continue; }
      const f = li.firstElementChild;
      if (f && (f.tagName === "STRONG" || f.tagName === "B")) {
        defList++;
        if (defSample.length < 8) {
          const p = li.parentElement;
          const pc = p && typeof p.className === "string" ? p.className.split(/\\s+/)[0] : "";
          defSample.push((p ? p.tagName.toLowerCase() : "?") + (pc ? "." + pc : ""));
        }
      } else plainLi++;
    }
    for (const h of document.querySelectorAll("h2,h3,h4,h5")) {
      if (/^(issue|gap|item|step|phase|part|stage|case)\\s+\\d/i.test((h.textContent || "").trim())) recordHeads++;
    }
    return {
      defList, checklist, recordHeads, plainLi,
      tableRows: document.querySelectorAll("tbody tr").length,
      folds: document.querySelectorAll("details").length,
      defSample,
    };
  })();
  return {
    title: document.title,
    url: location.pathname,
    interactives,
    sections,
    containers,
    primaryUnits,
    shellFill,
    accent,
    shapes,
    stateCounts: {
      interactives: interactives.length,
      sections: sections.length,
      primaryUnits,
      shellFill,
      deadCandidates: interactives.filter((i) => i.deadCandidate).length,
      clippedCandidates: interactives.filter((i) => i.clip && !i.clip.scrollable).length,
      scrollClipped: interactives.filter((i) => i.clip && i.clip.scrollable).length,
      occludedCandidates: interactives.filter((i) => i.occludedBy).length,
      disabled: document.querySelectorAll("[disabled], [aria-disabled=true]").length,
      pressed: document.querySelectorAll("[aria-pressed=true]").length,
      hidden: document.querySelectorAll("[hidden]").length,
      details: document.querySelectorAll("details").length,
      detailsOpen: document.querySelectorAll("details[open]").length,
      inputs: document.querySelectorAll("input, select, textarea").length,
      images: document.querySelectorAll("img").length,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight
    },
    // Paint audit (gs3 B9): "the squads avatars were broken" is a DOM
    // fact, not a judgment — an element that draws zero painted content
    // is broken whether or not any reviewer looked at it. Checks every
    // media-bearing element class: img with naturalWidth=0, canvases
    // that painted only transparent pixels, and named visual elements
    // (avatar/emblem/thumb/art/badge/icon classes, role=img) with a
    // real box but no painted payload — no image, no svg, no canvas,
    // no text, no painted background. Eyes can skip a region; this
    // cannot.
    paint: (() => {
      const fails = [];
      let checked = 0;
      const painted = (el) => {
        if (el.tagName === "IMG") return el.complete && el.naturalWidth > 0;
        if (el.tagName === "CANVAS") {
          try {
            const ctx = el.getContext("2d");
            if (!ctx) return true;
            const w = Math.min(el.width || 0, 96), h = Math.min(el.height || 0, 96);
            if (!w || !h) return false;
            const d = ctx.getImageData(0, 0, w, h).data;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return true;
            return false;
          } catch { return true; /* unreadable (webgl/tainted) — not a blank verdict */ }
        }
        if (el.querySelector("svg, canvas")) {
          for (const c of el.querySelectorAll("canvas")) {
            const cr = c.getBoundingClientRect();
            if (cr.width >= 2) return true; // painted handled per-canvas above; container counts on presence
          }
          if (el.querySelector("svg")) return true;
        }
        for (const im of el.querySelectorAll("img")) if (im.complete && im.naturalWidth) return true;
        if ((el.textContent || "").replace(/\\s+/g, "")) return true;
        const cs = getComputedStyle(el);
        if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
        if (cs.backgroundColor && !/rgba\\([^)]*,\\s*0(?:\\.\\d+)?\\s*\\)/.test(cs.backgroundColor) && cs.backgroundColor !== "transparent") return true;
        if (["Top", "Right", "Bottom", "Left"].some((d2) => parseFloat(cs["border" + d2 + "Width"]) > 0 && !/rgba\\([^)]*,\\s*0(?:\\.\\d+)?\\s*\\)/.test(cs["border" + d2 + "Color"]))) return true;
        return false;
      };
      for (const img of document.querySelectorAll("img")) {
        const r = img.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        checked++;
        if (!img.complete || !img.naturalWidth) fails.push('img "' + (img.alt || (img.src || "").split("/").pop() || "?").slice(0, 40) + '" painted nothing (naturalWidth=0)');
      }
      for (const el of document.querySelectorAll("canvas, [class*=avatar], [class*=emblem], [class*=thumb], [class*=art], [class*=badge], [class*=icon], [class*=pic], [class*=logo], [role=img], [data-avatar]")) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        checked++;
        if (!painted(el)) {
          const id = (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : el.tagName.toLowerCase());
          fails.push('unpainted ' + id + ' (' + Math.round(r.width) + 'x' + Math.round(r.height) + ' box, no image/canvas/svg/text/paint payload)');
        }
      }
      return { checked, broken: fails };
    })()
  };
})()`;

const browser = await puppeteer.launch({
  executablePath: BRAVE,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const result = { sid: cfg.sid, generatedAt: new Date().toISOString(), surfaces: [], errors: [] };
// Environment coverage: cfg.requiredViewports declares the widths the user
// actually views at (e.g. 3840 for a 4K environment). A matrix that never
// rendered the user's real resolution verified the surface where nobody
// looks — missing entries go on the result for the review's environment
// lens and the gate's COVERAGE-MATRIX check.
const probedVps = new Set();
for (const pg of cfg.pages || []) for (const v of pg.viewports || [1400]) probedVps.add(v);
// Matrix widths derive from the spec's audience row (v3) when the config
// doesn't supply them — the audience declares the environment, not the
// 1440/768/390 convention. Audience "consumer desktop" → ≥2560 floor;
// an explicit `NNNNpx` in the row wins.
let requiredVps = cfg.requiredViewports || [];
if (!requiredVps.length && cfg.sid) {
  try {
    const specPath = join(ROOT, ".unlazy", "design-spec", `${cfg.sid}.md`);
    const specText = existsSync(specPath) ? readFileSync(specPath, "utf-8") : "";
    const audRow = (specText.match(/^\s*\|\s*audience\s*\|.*$/im) || [""])[0];
    if (audRow) {
      const declared = (audRow.match(/(\d{3,5})\s*px/i) || audRow.match(/[≥>]\s*(\d{3,5})/) || [])[1];
      if (declared) requiredVps = [parseInt(declared, 10)];
      else if (/desktop|monitor|living[-\s]?room|tv\b|4k|uhd|consumer/i.test(audRow)) requiredVps = [2560];
    }
  } catch { /* spec-read is best-effort — the fixed list below still applies */ }
}
// A required width is satisfied by a probed width within ±10% (±60px
// floor) — or, for desktop-class widths (≥1200), by ANY probed width
// ≥ the requirement: a 3840 capture answers a 2560 floor. Small widths
// are not ≥-satisfiable (a 1440 probe never shows a 390 layout).
const probedArr = [...probedVps];
const vpSatisfied = (req) => probedArr.some((p) => Math.abs(p - req) <= Math.max(60, req * 0.1) || (req >= 1200 && p >= req));
const missingVps = requiredVps.filter((v) => !vpSatisfied(v));
result.matrixCheck = { required: requiredVps, probed: [...probedVps].sort((a, b) => a - b), missing: missingVps };
if (missingVps.length) console.log(`MATRIX-MISSING: required viewport(s) ${missingVps.join(", ")} are not in the probe matrix — the user's environment is unverified.`);
try {
  for (const page of cfg.pages || []) {
    for (const vp of page.viewports || [1400]) {
      const p = await browser.newPage();
      try {
        await p.setViewport({ width: vp, height: 1000 });
        if (cfg.ua) await p.setUserAgent(cfg.ua);
        if (cfg.cookie) {
          const cookies = cfg.cookie.split(";").map((pair) => {
            const i = pair.indexOf("=");
            const name = pair.slice(0, i).trim();
            const c = {
              name,
              value: pair.slice(i + 1).trim(),
              path: "/",
              url: cfg.base,
            };
            // __Host- prefixed cookies: secure-only, no domain, path=/
            if (!name.startsWith("__Host-")) c.domain = new URL(cfg.base).hostname;
            else c.secure = true;
            return c;
          });
          await p.setCookie(...cookies).catch(() =>
            p.setCookie(
              ...cookies.map((c) => ({ ...c, secure: false, url: cfg.base }))
            )
          );
        }
        await p.goto(cfg.base + page.url, { waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
        await sleep(page.settleMs || 1500);
        const offsets = [];
        const steps = page.scrollSteps ?? 0;
        for (let s = 0; s <= steps; s++) {
          if (s > 0) {
            await p.evaluate(`scrollTo(0, ${s} * innerHeight)`);
            await sleep(600);
          }
          const dump = await p.evaluate(DUMP);
          offsets.push({ offset: s, ...dump });
        }
        result.surfaces.push({
          name: page.name,
          url: page.url,
          viewport: vp,
          offsets,
          interactives: offsets[0] ? offsets[0].interactives.length : 0,
          sections: offsets[0] ? offsets[0].sections.length : 0,
          deadCandidates: offsets[0] ? offsets[0].stateCounts.deadCandidates : 0,
        });
        const paintBroken = offsets.reduce((n, o) => n + ((o.paint && o.paint.broken) || []).length, 0);
        console.log(`probe ${page.name} @${vp}: ${result.surfaces[result.surfaces.length - 1].interactives} interactives (${result.surfaces[result.surfaces.length - 1].deadCandidates} dead candidates), ${result.surfaces[result.surfaces.length - 1].sections} sections, ${offsets.length} offset(s)${paintBroken ? `, PAINT-BROKEN ×${paintBroken} — ${offsets.find((o) => o.paint && o.paint.broken.length).paint.broken[0].slice(0, 80)}` : ""}`);
      } catch (e) {
        result.errors.push(`${page.name} @${vp}: ${String(e).slice(0, 200)}`);
      }
      await p.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`wrote ${outPath}`);
if (result.errors.length) console.log("errors:", result.errors.join(" | "));
