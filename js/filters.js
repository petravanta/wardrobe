'use strict';
/* ---------- Filters ---------- */
// AND across dimensions, OR within one. State lives in settings.filters and syncs.
const F = () => doc.settings.filters || {};
// Closet review: what an item still lacks, from the checks in MISSING (filters.missing holds the picked ones)
const MISSING = { photo: 'Photo', price: 'Price', gender: 'Gender', size: 'Size', colour: 'Colour', purchased: 'Purchase date' };
const LACKS = {
  photo: it => !(it.photos || []).length, price: it => !hasPrice(it), gender: it => !(it.gender || []).length,
  size: it => !(it.sizes || []).some(z => String(z.value || '').trim()), colour: it => !(it.colours || []).length, purchased: it => !it.purchased
};
const lacks = it => Object.keys(MISSING).filter(k => LACKS[k](it));
let reviewOpen = false;
function reviewBar(f) {
  if (!reviewOpen && !(f.missing || []).length) return '';
  const pool = doc.items.filter(it => matches(it, { ...f, missing: [] })), sel = f.missing || [];
  return `<div class="bar review-bar" role="group" aria-label="Review: show items missing">
    <span class="small muted">Missing:</span>
    <div class="chips">${Object.entries(MISSING).map(([k, v]) => { const n = pool.filter(LACKS[k]).length; return `<button type="button" class="chip" data-miss="${k}" aria-pressed="${sel.includes(k)}">${esc(v)}<span class="n">${n}</span></button>`; }).join('')}</div>
    <span class="small muted">${sel.length ? `Items missing any of these. Tap one to fill it in.` : 'Pick one or more.'}</span>
    <span class="grow"></span><button type="button" class="btn ghost sm" data-act="review-done">Done reviewing</button>
  </div>`;
}
function matches(it, f = F()) {
  if (!visible(it)) return false;
  if (f.group && typeGroup(it.type) !== f.group && it.type !== f.group) return false;
  if (f.families && f.families.length && !(it.colours || []).some(c => f.families.includes((K.byId.colours.get(c) || {}).family))) return false;
  // Androgynous items belong under Masc and Fem too, so either filter finds them
  if (f.gender && f.gender.length) {
    const want = new Set(f.gender); if (want.has('masc') || want.has('fem')) want.add('androgynous');
    if (!(it.gender || []).some(g => want.has(g))) return false;
  }
  const fw = (f.words || []).filter(wordById);
  if (fw.length && !(it.words || []).some(w => fw.includes(w))) return false;
  if (typeof f.size === 'string' && f.size && !(it.sizes || []).some(s => String(s.value).toLowerCase() === f.size.toLowerCase())) return false; // until migrated
  if (f.sizes && f.sizes.length) { const want = new Set(f.sizes.map(k => k.toLowerCase())); if (!(it.sizes || []).some(z => want.has(sizeKey(z).toLowerCase()))) return false; }
  if (f.spicyOnly && !it.spicy) return false;
  if (f.followUp && !it.followUp) return false;
  if (f.missing && f.missing.length && !lacks(it).some(k => f.missing.includes(k))) return false;
  if (f.q) { const q = f.q.toLowerCase(); if (![it.name, it.brand, it.notes, kname('types', it.type), ...wordsOf(it).map(w => w.name)].some(s => s && s.toLowerCase().includes(q))) return false; }
  return true;
}
// Size filter: picked sizes as "system:value" (OR among them, case-insensitive), from the sizes on visible items
const sizeKey = z => `${z.system || ''}:${String(z.value == null ? '' : z.value).trim()}`;
function sizeChoices() {
  const by = new Map();
  for (const it of doc.items.filter(visible)) for (const z of it.sizes || []) {
    if (!String(z.value || '').trim()) continue;
    const k = sizeKey(z), lk = k.toLowerCase(), m = by.get(z.system || '') || by.set(z.system || '', new Map()).get(z.system || '');
    const e = m.get(lk) || m.set(lk, { key: k, value: String(z.value).trim(), ids: new Set() }).get(lk); e.ids.add(it.id);
  }
  const order = [...K.sizeSystems.map(x => x.id), ...[...by.keys()].filter(k => !K.byId.sizeSystems.has(k))];
  return order.filter(id => by.has(id)).map(id => {
    const sys = K.byId.sizeSystems.get(id) || {}, vals = [...by.get(id).values()];
    const pos = v => (sys.values || []).findIndex(x => x.toLowerCase() === v.toLowerCase());
    vals.sort((a, b) => sys.values ? (pos(a.value) < 0 ? 999 : pos(a.value)) - (pos(b.value) < 0 ? 999 : pos(b.value)) || a.value.localeCompare(b.value)
      : a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' }));
    return { id, name: sys.name || id || 'Other', vals };
  });
}
// An older device saved the size filter as one typed value (filters.size): turn it into the matching picks, or drop it
function migrateSizeFilter() {
  const f = F(); if (typeof f.size !== 'string') return;
  const want = f.size.trim().toLowerCase(), have = new Set((f.sizes || []).map(k => k.toLowerCase()));
  const add = want ? sizeChoices().flatMap(g => g.vals).filter(v => v.value.toLowerCase() === want && !have.has(v.key.toLowerCase())).map(v => v.key) : [];
  const { size, ...rest } = f; setSetting('filters', { ...rest, sizes: [...(f.sizes || []), ...add] });
}
let sizePopOpen = false;
function sizePicker(f) {
  const groups = sizeChoices(), sel = (f.sizes || []).map(k => k.toLowerCase());
  if (!groups.length && !sel.length) return '';
  const picked = groups.flatMap(g => g.vals).filter(v => sel.includes(v.key.toLowerCase())).map(v => v.value);
  const label = !sel.length ? 'Size' : picked.length && picked.length <= 3 ? `Size: ${picked.join(', ')}` : `Size: ${sel.length}`;
  return `<div class="szpick"><button type="button" class="chip" id="fSizeBtn" aria-haspopup="dialog" aria-expanded="${sizePopOpen}" aria-controls="fSizePop" aria-pressed="${!!sel.length}">${esc(label)} ▾</button>
    <div class="szpop" id="fSizePop" role="dialog" aria-label="Sizes"${sizePopOpen ? '' : ' hidden'}>${groups.map(g => `<h4 class="shelf-h">${esc(g.name)}</h4><div class="chips">${g.vals.map(v => `<button type="button" class="chip" data-fsize="${esc(v.key)}" aria-pressed="${sel.includes(v.key.toLowerCase())}">${esc(v.value)}<span class="n">${v.ids.size}</span></button>`).join('')}</div>`).join('') || '<p class="small muted">None of your items has a size yet.</p>'}
    ${sel.length ? '<div class="row" style="margin-top:10px"><button type="button" class="btn ghost sm" data-fsize="">Clear sizes</button></div>' : ''}</div></div>`;
}
function setSizePop(open) {
  sizePopOpen = open; const pop = $('#fSizePop'), btn = $('#fSizeBtn'); if (!pop) return;
  pop.hidden = !open; btn.setAttribute('aria-expanded', String(open));
  if (open) { const c = $('[data-fsize]', pop); if (c) c.focus(); } else btn.focus();
}
document.addEventListener('click', e => {
  if (!$('#fSizeBtn')) return;
  if (e.target.closest('#fSizeBtn')) return setSizePop(!sizePopOpen);
  const c = e.target.closest('[data-fsize]');
  if (c) {
    const k = c.dataset.fsize, cur = (F().sizes || []), on = cur.some(x => x.toLowerCase() === k.toLowerCase());
    setFilter('sizes', !k ? [] : on ? cur.filter(x => x.toLowerCase() !== k.toLowerCase()) : [...cur, k]);
    const again = k && $(`#fSizePop [data-fsize="${CSS.escape(k)}"]`); if (again) again.focus(); else if ($('#fSizePop [data-fsize]')) $('#fSizePop [data-fsize]').focus();
    return;
  }
  if (sizePopOpen && !e.target.closest('#fSizePop')) setSizePop(false);
});
function setFilter(k, v) { setSetting('filters', { ...F(), [k]: v }); render(); }
