'use strict';
/* ---------- Sort and group ---------- */
// The closet's order and shelves. Saved as settings.sort, settings.sortReverse and settings.groupBy, so they sync.
// Each sort has a natural direction (newest, most worn, A to Z); Reverse flips it.
const SORTS = { added: 'Date added', worn: 'Last worn', wears: 'Most worn', name: 'Name', colour: 'Colour', type: 'Type', price: 'Price: high to low', priceLow: 'Price: low to high' };
const GROUPS = { '': 'No groups', category: 'Category', type: 'Type', colour: 'Colour', gender: 'Gender', words: 'Tag', size: 'Size' };
const idx = (list, id) => { const i = list.findIndex(x => x.id === id); return i < 0 ? 1e6 : i; };
// An imported item keeps the date it was first added in its source; items made before 'added' existed keep closet order
const addedAt = it => (it.source && it.source.createdAt) || it.added || '';
function wearStats() {
  const m = new Map(doc.items.map(it => [it.id, { n: (it.source && it.source.wornCount) || 0, last: '' }]));
  const bump = (id, at) => { const s = m.get(id); if (s) { s.n++; if ((at || '') > s.last) s.last = at || ''; } };
  const outfits = new Map(doc.outfits.map(o => [o.id, o.items || []]));
  doc.wears.forEach(w => { if (w.item) bump(w.item, w.at); if (w.outfit) (outfits.get(w.outfit) || []).forEach(id => bump(id, w.at)); });
  return m;
}
const hasPrice = it => it.price != null && it.price !== '' && Number.isFinite(+it.price);
function sortItems(items) {
  const by = SORTS[doc.settings.sort] ? doc.settings.sort : 'added', ws = by === 'worn' || by === 'wears' ? wearStats() : null;
  const name = it => (it.name || kname('types', it.type)).toLowerCase(), pos = new Map(doc.items.map((it, i) => [it.id, i]));
  const key = {
    added: (a, b) => addedAt(b).localeCompare(addedAt(a)) || pos.get(b.id) - pos.get(a.id),
    worn: (a, b) => ws.get(b.id).last.localeCompare(ws.get(a.id).last),
    wears: (a, b) => ws.get(b.id).n - ws.get(a.id).n,
    name: () => 0,
    colour: (a, b) => idx(K.colours, (a.colours || [])[0]) - idx(K.colours, (b.colours || [])[0]),
    type: (a, b) => idx(K.types, a.type) - idx(K.types, b.type),
    price: (a, b) => (+b.price || 0) - (+a.price || 0),
    priceLow: (a, b) => (+a.price || 0) - (+b.price || 0)
  }[by];
  const out = [...items].sort((a, b) => key(a, b) || name(a).localeCompare(name(b)));
  if (doc.settings.sortReverse) out.reverse();
  // Sorting by price: items with no price go last, whichever way round
  return by === 'price' || by === 'priceLow' ? [...out.filter(hasPrice), ...out.filter(it => !hasPrice(it))] : out;
}
// Returns [{key, label, items}] in a sensible order; items with several colours or gender tags sit on each matching shelf
// A gender tag's label: a built-in tag with its emoji (data/gender-tags.json), or a tag someone typed, as typed
const gname = id => { const g = K.byId.genderTags.get(id); return g ? [g.emoji, g.name].filter(Boolean).join(' ') : id; };
// A colour family as a swatch: the fill (the family's own colour, else its first; metallic and pattern get a gradient)
// and the label colour, dark or white, whichever contrasts more with every colour in the fill (WCAG, at least 4.5:1)
const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const FAM_GRADIENT = { metallic: ['#c0c4c8', '#f4f4f4', '#c9a227'], pattern: ['#f08fb2', '#f4c430', '#8fd19e', '#a9cce3', '#c3a6e0'] };
function famSwatch(fam) {
  const own = K.colours.filter(c => c.family === fam), one = own.find(c => c.id === fam) || own[0];
  const stops = FAM_GRADIENT[fam] || (one ? [one.hex] : ['#888888']);
  const fill = stops.length > 1 ? `linear-gradient(90deg,${stops.join(',')})` : stops[0];
  const ls = stops.map(lum), ink = Math.min(...ls.map(l => ratio(l, 0))), white = Math.min(...ls.map(l => ratio(l, 1)));
  return { fill, on: ink >= white ? '#000000' : '#ffffff', light: Math.min(...ls) > 0.75, dark: Math.max(...ls) < 0.03 };
}
function groupItems(items) {
  const g = GROUPS[doc.settings.groupBy] ? doc.settings.groupBy : '';
  if (!g) return [{ key: '', label: '', items }];
  const fams = [...new Set(K.colours.map(c => c.family))], letters = (K.byId.sizeSystems.get('letter') || {}).values || [];
  const keysOf = {
    category: it => [typeGroup(it.type) || ''],
    type: it => [it.type || ''],
    colour: it => [...new Set((it.colours || []).map(c => (K.byId.colours.get(c) || {}).family).filter(Boolean))],
    gender: it => it.gender || [],
    words: it => wordsOf(it).map(w => w.id),
    size: it => [...new Set((it.sizes || []).map(z => String(z.value).toUpperCase()))]
  }[g];
  const label = {
    category: k => kname('types', k), type: k => kname('types', k), colour: k => k[0].toUpperCase() + k.slice(1),
    gender: gname, words: k => { const w = wordById(k); return w ? [w.emoji, w.name].filter(Boolean).join(' ') : k; }, size: k => k
  }[g];
  const rank = {
    category: k => idx(K.types, k), type: k => idx(K.types, k), colour: k => fams.indexOf(k), gender: k => idx(K.genderTags, k), words: () => 0,
    size: k => { const l = letters.indexOf(k); return l >= 0 ? l : isNaN(parseFloat(k)) ? 2e6 : 1e3 + parseFloat(k); }
  }[g];
  const shelves = new Map();
  items.forEach(it => { const ks = keysOf(it).filter(Boolean); (ks.length ? ks : ['']).forEach(k => { if (!shelves.has(k)) shelves.set(k, []); shelves.get(k).push(it); }); });
  const none = { colour: 'No colour', gender: 'No gender tag', words: 'No tag', size: 'No size' }[g] || 'Other';
  return [...shelves].map(([key, items]) => ({ key, label: key ? label(key) : none, items }))
    .sort((a, b) => (!a.key) - (!b.key) || rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
}
