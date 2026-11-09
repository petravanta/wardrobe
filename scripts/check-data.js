#!/usr/bin/env node
// Checks what the JSON Schemas can't: unique ids, and references between datasets that point at real entries.
// The schemas themselves are checked by ajv-cli in .github/workflows/check-data.yml. Run: node scripts/check-data.js
'use strict';
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const SETS = ['types', 'colours', 'materials', 'seasons', 'occasions', 'care', 'size-systems', 'gender-tags'];
const errors = [];
const load = set => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, `${set}.json`), 'utf8')); }
  catch (e) { errors.push(`${set}.json: ${e.message}`); return []; }
};
const data = Object.fromEntries(SETS.map(s => [s, load(s)]));

for (const [set, rows] of Object.entries(data)) {
  const seen = new Set();
  rows.forEach((r, i) => {
    if (seen.has(r.id)) errors.push(`${set}.json[${i}]: id "${r.id}" is used twice`);
    seen.add(r.id);
  });
}

const types = new Map(data.types.map(t => [t.id, t]));
data.types.forEach(t => {
  if (!t.parent) return;
  const p = types.get(t.parent);
  if (!p) errors.push(`types.json: "${t.id}" has parent "${t.parent}", which isn't a type`);
  else if (p.parent) errors.push(`types.json: "${t.id}" has parent "${t.parent}", which is itself inside a group (only two levels)`);
  if (data.types.indexOf(p) > data.types.indexOf(t)) errors.push(`types.json: "${t.id}" comes before its group "${t.parent}"`);
});
// Every type needs a region and size systems, its own or its group's
data.types.forEach(t => {
  const g = t.parent ? types.get(t.parent) || {} : {};
  if (!t.region && !g.region) errors.push(`types.json: "${t.id}" has no region, and neither has its group`);
  if (!t.sizeSystems && !g.sizeSystems) errors.push(`types.json: "${t.id}" has no sizeSystems, and neither has its group`);
});

if (errors.length) { console.error(errors.map(e => '✗ ' + e).join('\n')); process.exit(1); }
console.log(`✓ ${SETS.length} datasets, ${Object.values(data).reduce((n, r) => n + r.length, 0)} entries`);
