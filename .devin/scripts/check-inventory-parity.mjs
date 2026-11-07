#!/usr/bin/env node
/**
 * Inventory parity — DOM elements that never got a spec row.
 *
 * Usage: node .devin/scripts/check-inventory-parity.mjs <coverage.json> <spec.md>
 *
 * The DOM's own element list (ui-coverage-probe output) is an external
 * enumerator the author can't silently omit from. Elements whose class
 * stems appear nowhere in the spec's inventory text are rendered but
 * un-decided — the silent-classification signature.
 */
import { readFileSync } from "node:fs";

const [covPath, specPath] = process.argv.slice(2);
if (!covPath || !specPath) {
  console.log("usage: check-inventory-parity.mjs <coverage.json> <spec.md>");
  process.exit(1);
}
const cov = JSON.parse(readFileSync(covPath, "utf8"));
const spec = readFileSync(specPath, "utf8").toLowerCase();

const classes = new Set();
// probe shape: { surfaces: [{ offsets: [{ interactives:[{cls}], sections:[{cls}] }] }] }
// older shapes: { pages: [...] } — walk whatever holds element arrays
const containers = [];
for (const s of cov.surfaces || cov.pages || [cov]) {
  if (Array.isArray(s.offsets)) containers.push(...s.offsets);
  else containers.push(s);
}
for (const c of containers)
  for (const list of [c.interactives || [], c.sections || []])
    for (const e of list.flat())
      for (const cls of String(e.cls || "").split(/\s+/))
        if (cls && cls.length > 2 && !/^(is-|has-|on$|active|open|selected)/.test(cls))
          classes.add(cls);

const missing = [];
for (const cls of classes) {
  // stem = class minus common prefixes, split on separators
  const stems = cls.replace(/^(gh|ev|wl|ui)-/, "").split(/[-_]/).filter(s => s.length > 2);
  if (!stems.length) continue;
  if (!stems.some(s => spec.includes(s))) missing.push(cls);
}

if (missing.length) {
  console.log(`INVENTORY-PARITY: ${missing.length}/${classes.size} rendered classes have no spec row (silent classification — add the inventory row or defend the element)`);
  for (const c of missing.slice(0, 15)) console.log(`  .${c}`);
} else {
  console.log(`INVENTORY-PARITY: all ${classes.size} rendered classes trace to the spec`);
}
