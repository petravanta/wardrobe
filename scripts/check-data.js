#!/usr/bin/env node
// Checks what the JSON Schemas can't: unique ids, and references between datasets that point at real entries.
// The schemas themselves are checked by ajv-cli in .github/workflows/check-data.yml. Run: node scripts/check-data.js
'use strict';
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const SETS = ['types', 'colours', 'materials', 'seasons', 'occasions', 'care', 'size-systems', 'gender-tags', 'colour-seasons', 'colour-quiz'];
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

// Aliases: each may point at only one entry in a dataset (otherwise an import can't tell where an item goes)
for (const set of ['types', 'colours', 'materials', 'occasions']) {
  const owner = new Map(data[set].map(r => [r.id, r.id]));
  data[set].forEach(r => (r.aliases || []).forEach(w => {
    if (owner.has(w) && owner.get(w) !== r.id) errors.push(`${set}.json: "${r.id}" lists alias "${w}", which already belongs to "${owner.get(w)}"`);
    owner.set(w, r.id);
  }));
}

// Colour quiz: option ids unique within a question; the photo code relies on the undertone and contrast option ids
data['colour-quiz'].forEach(q => {
  const ids = q.options.map(o => o.id);
  if (new Set(ids).size !== ids.length) errors.push(`colour-quiz.json: "${q.id}" has an option id used twice`);
  const need = { undertone: ['pink', 'neutral', 'golden'], contrast: ['high', 'medium', 'low'] }[q.photo] || [];
  need.filter(id => !ids.includes(id)).forEach(id => errors.push(`colour-quiz.json: "${q.id}" is used for photo ${q.photo} but has no option "${id}"`));
  if (['skin', 'hair', 'eyes'].includes(q.photo)) q.options.filter(o => !o.hex).forEach(o => errors.push(`colour-quiz.json: "${q.id}" option "${o.id}" needs a hex so a photo sample can be matched to it`));
});
const photoUses = data['colour-quiz'].map(q => q.photo).filter(Boolean);
if (new Set(photoUses).size !== photoUses.length) errors.push('colour-quiz.json: each photo kind may be used by only one question');

if (errors.length) { console.error(errors.map(e => '✗ ' + e).join('\n')); process.exit(1); }
console.log(`✓ ${SETS.length} datasets, ${Object.values(data).reduce((n, r) => n + r.length, 0)} entries`);
