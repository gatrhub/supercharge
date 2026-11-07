/**
 * Instrument-manifest — session-start hash baseline over the gate's own
 * instrument tree (machinery issue I3).
 *
 * The DECLARED: instrument watch keys on path-NAMES in impl_touched, but
 * git checkout/stash/patch/tar/delegated rewrites produce marker strings
 * (`git-write:*`, `patch:*`, `delegated:*`) — the instrument tree changes
 * while no instrument path is ever recorded. A manifest diffs EFFECTS:
 * hash the instrument files at session start, re-hash at stop, and any
 * delta owes `DECLARED: instrument — <what moved>` regardless of which
 * write mechanism moved it.
 *
 * The shared baseline (.unlazy/gate-state/instrument-manifest.json)
 * carries across sessions: it is rewritten only when the stop-gate's
 * diff is clean or covered by a declaration, so a between-sessions edit
 * still diffs against the last honest tree at the next session's stop.
 *
 * `_`-prefixed basenames are scratch/fixture by convention (I4) and are
 * never part of the manifest.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The instrument surface: gate/tracker/hook scripts, check-* scripts,
// probes, write-targets, rules, skill files, and the hook wiring itself.
const INSTRUMENT_DIRS = [
  [".devin/scripts", /\.(?:mjs|js|cjs|json)$/i, false],
  ["rules", /\.mdc$/i, false],
  [".devin/skills", /\.(?:md|mjs|js|json)$/i, true],
];
const INSTRUMENT_FILES = [".devin/hooks.v1.json"];

const scratch = (name) => /^_/.test(name);

const hashFile = (fp) => {
  try {
    return createHash("sha256").update(readFileSync(fp)).digest("hex").slice(0, 16);
  } catch {
    return null;
  }
};

export function buildInstrumentManifest(ROOT) {
  const files = {};
  for (const [dir, re, deep] of INSTRUMENT_DIRS) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    const walk = (d, relDir) => {
      let ents;
      try {
        ents = readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of ents) {
        if (scratch(e.name)) continue;
        const rel = relDir ? `${relDir}/${e.name}` : `${dir}/${e.name}`;
        const fp = join(d, e.name);
        if (e.isDirectory()) {
          if (deep) walk(fp, rel);
          continue;
        }
        if (!re.test(e.name)) continue;
        const h = hashFile(fp);
        if (h) files[rel] = h;
      }
    };
    walk(abs, "");
  }
  for (const f of INSTRUMENT_FILES) {
    const h = hashFile(join(ROOT, f));
    if (h) files[f] = h;
  }
  return { v: 1, builtAt: new Date().toISOString(), files };
}

const sharedPath = (ROOT) => join(ROOT, ".unlazy", "gate-state", "instrument-manifest.json");

export function loadSharedManifest(ROOT) {
  try {
    const m = JSON.parse(readFileSync(sharedPath(ROOT), "utf-8"));
    return m && m.files && typeof m.files === "object" ? m : null;
  } catch {
    return null;
  }
}

export function writeSharedManifest(ROOT, manifest) {
  try {
    writeFileSync(sharedPath(ROOT), JSON.stringify(manifest, null, 1));
    return true;
  } catch {
    return false;
  }
}

// Session baseline: the last manifest the stop gate accepted (the shared
// file) — between-session edits diff against it. No shared file yet →
// the current tree becomes the baseline (first run establishes it).
export function captureInstrumentBaseline(ROOT) {
  return loadSharedManifest(ROOT) || buildInstrumentManifest(ROOT);
}

export function diffInstrumentManifests(base, cur) {
  const changed = [], missing = [], added = [];
  const bf = (base && base.files) || {};
  const cf = (cur && cur.files) || {};
  for (const p of Object.keys(bf)) {
    if (scratch(p.split("/").pop() || "")) continue;
    if (!(p in cf)) missing.push(p);
    else if (cf[p] !== bf[p]) changed.push(p);
  }
  for (const p of Object.keys(cf)) {
    if (scratch(p.split("/").pop() || "")) continue;
    if (!(p in bf)) added.push(p);
  }
  return { changed, missing, added };
}
