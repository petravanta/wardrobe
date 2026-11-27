'use strict';
/* ---------- Built-in knowledge ---------- */
const K = {}; // K.types = [...], K.byId.types = Map
async function loadKnowledge() {
  K.byId = {};
  await Promise.all(DATASETS.map(async set => {
    const r = await fetch(`data/${set}.json`);
    if (!r.ok) throw new Error(`data/${set}.json: ${r.status}`);
    const key = set.replace(/-(\w)/g, (_, c) => c.toUpperCase());
    K[key] = await r.json(); K.byId[key] = new Map(K[key].map(x => [x.id, x]));
  }));
}
const kname = (set, id) => (K.byId[set].get(id) || { name: id }).name;
const typeGroup = id => { const t = K.byId.types.get(id); return t ? (t.parent || t.id) : null; };
const typeSizeSystems = id => { const t = K.byId.types.get(id) || {}; return t.sizeSystems || (K.byId.types.get(t.parent) || {}).sizeSystems || ['letter']; };

/* ---------- User data ---------- */
function blankDoc() { return { version: 1, settings: { updatedAt: '1970-01-01T00:00:00Z', showSpicy: false, filters: {}, sort: 'added', sortReverse: false, groupBy: '' }, items: [], outfits: [], wears: [], words: [], cosmetics: [], looks: [], deleted: [] }; }
// Older or partial documents become the current shape; never write an older format
function upgrade(d) {
  const b = blankDoc();
  if (!d || typeof d !== 'object') return b;
  const out = { ...b, ...d, version: 1, settings: { ...b.settings, ...(d.settings || {}) } };
  LISTS.forEach(l => { out[l] = Array.isArray(d[l]) ? d[l].filter(r => r && r.id) : []; });
  // Imported items once kept their source details under an older field name; move them to item.source
  out.items = out.items.map(r => { if (!r.whering || r.source) return r; const { whering, ...rest } = r; return { ...rest, source: whering }; });
  out.words = out.words.filter(w => typeof w.name === 'string' && w.name.trim());
  if (K.genderTags) migrateGenderTags(out); // needs data/gender-tags.json, so start.js upgrades again once it's loaded
  out.deleted = Array.isArray(d.deleted) ? d.deleted : [];
  return out;
}
// STANDARDS.md "Merging two copies": by id, newer u wins; deleted ids drop out; newer settings win
function mergeDocs(a, b) {
  a = upgrade(a); b = upgrade(b);
  const deleted = [...new Set([...a.deleted, ...b.deleted])], gone = new Set(deleted);
  const out = { version: 1, settings: (b.settings.updatedAt || '') > (a.settings.updatedAt || '') ? b.settings : a.settings, deleted };
  LISTS.forEach(l => {
    const m = new Map();
    [...a[l], ...b[l]].forEach(r => { const o = m.get(r.id); if (!o || (r.u || '') > (o.u || '')) m.set(r.id, o ? keepMedia(r, o) : r); else m.set(r.id, keepMedia(o, r)); });
    out[l] = [...m.values()].filter(r => !gone.has(r.id));
  });
  return out;
}
// A photo's link to its Google Photos copy is never lost to an older edit made before the upload finished, so it isn't uploaded twice
// The same goes for a photo's matching vector (What I wore), which is slow to make again
function keepMedia(win, lose) {
  const ids = new Map((lose.photos || []).filter(p => p.mediaItemId || p.vec).map(p => [p.id, p]));
  return ids.size ? { ...win, photos: (win.photos || []).map(p => {
    const o = ids.get(p.id); if (!o) return p;
    if (!p.mediaItemId && o.mediaItemId) p = { ...p, mediaItemId: o.mediaItemId, mediaAccount: o.mediaAccount };
    if (!p.vec && o.vec) p = { ...p, vec: o.vec };
    return p;
  }) } : win;
}
let doc = upgrade(lsGet(KEY));
function save() { lsSet(KEY, doc); if (store.known) store.save(doc); showSaveState(); GPhotos.soon(); }
function put(list, rec) { rec.u = now(); const i = doc[list].findIndex(r => r.id === rec.id); i < 0 ? doc[list].push(rec) : doc[list][i] = rec; save(); }
function remove(list, id) { doc[list] = doc[list].filter(r => r.id !== id); doc.deleted.push(id); save(); }
function setSetting(k, v) { doc.settings = { ...doc.settings, [k]: v, updatedAt: now() }; save(); }
const visible = it => doc.settings.showSpicy || !it.spicy;
const itemById = id => doc.items.find(i => i.id === id);
