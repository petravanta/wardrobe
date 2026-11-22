'use strict';
let editing = null; // the item being edited in the drawer, if any (drops add photos to it)
let outfitReturn = null; // { outfit, item } while an item opened from an outfit's figure is being edited
function editFromFigure(span) {
  const view = $('#layer [data-view-outfit]'), it = itemById(span.dataset.layItem); if (!view || !it) return;
  const oid = view.dataset.viewOutfit; itemForm(structuredClone(it)); outfitReturn = { outfit: oid, item: it.id };
}
{ // mouse: double-click; touch: a tap; keyboard: Enter or Space. Never while arranging.
  let touch = false;
  document.addEventListener('pointerdown', e => { touch = e.pointerType === 'touch' || e.pointerType === 'pen'; }, true);
  const target = e => { const sp = e.target.closest && e.target.closest('#layer .fig-lg [data-lay-item]'); return sp && !sp.closest('.arranging') ? sp : null; };
  document.addEventListener('dblclick', e => { const sp = target(e); if (sp) { e.preventDefault(); editFromFigure(sp); } });
  document.addEventListener('click', e => { const sp = target(e); if (sp && touch) editFromFigure(sp); });
  document.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const sp = target(e); if (sp && e.target === sp) { e.preventDefault(); editFromFigure(sp); } });
}

const checks = (name, set, list, sel = []) => `<fieldset><legend>${name}</legend><div class="checks">${list.map(x => `<label><input type="checkbox" name="${set}" value="${esc(x.id)}"${sel.includes(x.id) ? ' checked' : ''}> ${x.hex ? `<i class="swatch" style="background:${x.hex}"></i>` : ''}${esc(x.name)}</label>`).join('')}</div></fieldset>`;
// Fem, Masc, Androgynous come built in; anything else people type becomes their own tag and is offered again
function genderField(it) {
  const ids = [...new Set([...K.genderTags.map(g => g.id), ...doc.items.flatMap(i => i.gender || []), ...(it.gender || [])])];
  return `<fieldset><legend>Gender (the cut, not the wearer)</legend><div class="checks">${ids.map(g => `<label><input type="checkbox" name="gender" value="${esc(g)}"${(it.gender || []).includes(g) ? ' checked' : ''}> ${esc(gname(g))}</label>`).join('')}</div>
    <input type="text" name="genderNew" placeholder="Add your own, separated by commas"></fieldset>`;
}
function wordsField(it) {
  return `<fieldset><legend>Wardrobe words</legend>${doc.words.length ? `<div class="checks">${sortedWords().map(w => `<label><input type="checkbox" name="words" value="${esc(w.id)}"${(it.words || []).includes(w.id) ? ' checked' : ''}> ${wordChip(w)}</label>`).join('')}</div>` : ''}
    <input type="text" name="wordsNew" placeholder="${doc.words.length ? 'Add new words' : 'Your own words, like goth or cozy'}, separated by commas"></fieldset>`;
}
// Ticks or unticks items for one word, across the closet
function wordItemsForm(w) {
  const items = sortItems(doc.items.filter(visible));
  openDrawer(`<h2>Tag items: ${wordChip(w)}</h2>
  <form class="form" id="wordForm">
    <fieldset><legend>Items with this word</legend>${items.length ? `<ul class="grid">${items.map(it => card(it, (it.words || []).includes(w.id))).join('')}</ul>` : '<p class="muted">Add items to your closet first.</p>'}</fieldset>
    <div class="row"><button type="submit" class="btn primary">Save</button></div>
  </form>`);
  $('#wordForm').addEventListener('click', e => { const c = e.target.closest('[data-item]'); if (c) { e.stopPropagation(); c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); } }, true);
  $('#wordForm').addEventListener('submit', e => {
    e.preventDefault();
    setWordOn(w.id, items, new Set($$('#wordForm [data-item][aria-pressed="true"]').map(b => b.dataset.item)));
    closeDrawer(); render(); toast('Saved');
  });
}
function thumbsHtml(it) {
  const photos = it.photos || [], hasCut = id => photos.some(p => p.role === 'cutout' && p.from === id);
  return photos.map(p => `<figure><img alt="" class="zoomable${p.role === 'cutout' ? ' cut' : ''}" data-photo="${esc(p.id)}"><button type="button" class="rm" data-rmphoto="${esc(p.id)}" aria-label="Remove photo">×</button><figcaption>${Cutout.pending.has(p.id) ? 'cleaning…' : p.role === 'crop' ? 'from an outfit' : esc(p.role)}</figcaption>${Cutout.supported && p.role !== 'cutout' && p.role !== 'crop' && !Cutout.pending.has(p.id) ? `<button type="button" class="btn sm clean" data-cutout="${esc(p.id)}">${hasCut(p.id) ? 'Clean again' : 'Clean background'}</button>` : ''}</figure>`).join('');
}
// Redraws the photo strip of the open form only, so whatever is typed in the form stays
function refreshThumbs(itemId) {
  const t = $('#thumbs'); if (!t || !editing || editing.id !== itemId) return;
  t.innerHTML = thumbsHtml(editing); fillThumbs(t);
}
function itemForm(it) {
  editing = it;
  const types = K.types.filter(t => doc.settings.showSpicy || !t.spicy || t.id === it.type);
  const groups = types.filter(t => !t.parent);
  const typeOpts = groups.map(g => `<optgroup label="${esc(g.name)}"><option value="${g.id}"${it.type === g.id ? ' selected' : ''}>${esc(g.name)} (other)</option>${types.filter(t => t.parent === g.id).map(t => `<option value="${t.id}"${it.type === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join('');
  const sizes = (it.sizes && it.sizes.length ? it.sizes : [{ system: typeSizeSystems(it.type)[0], value: '' }]);
  const isNew = !doc.items.some(x => x.id === it.id);
  openDrawer(`<h2>${isNew ? 'Add item' : esc(it.name || 'Item')}</h2>
  <div class="thumbs" id="thumbs">${thumbsHtml(it)}</div>
  <div class="row"><button type="button" class="btn sm" data-act="photo">Add photo</button>${GPhotos.known() ? '<button type="button" class="btn sm" data-gphotos="pick">From Google Photos</button>' : ''}<span class="small muted fine-only">or drop one here</span></div>
  <form class="form" id="itemForm">
    ${it.followUp ? `<div class="banner small">Made from an outfit photo. Add a clean photo of it and this goes away.<label class="row"><input type="checkbox" name="followUp" checked> Needs a clean photo</label></div>` : ''}
    <label class="field">Name<input type="text" name="name" value="${esc(it.name || '')}" placeholder="Black midi skirt"></label>
    <label class="field">Type<select name="type">${typeOpts}</select></label>
    ${checks('Colours (main first)', 'colours', K.colours, it.colours)}
    <fieldset class="sizes"><legend>Size</legend>${sizes.map(s => `<div class="row"><select name="sizeSystem">${K.sizeSystems.map(x => `<option value="${x.id}"${s.system === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select><input type="text" name="sizeValue" value="${esc(s.value)}" placeholder="M, 38, 75B…" list="dlSize-${esc(s.system || '')}" autocomplete="off"></div>`).join('')}</fieldset>
    ${usedDatalists()}
    <div class="two"><label class="field">Brand<input type="text" name="brand" value="${esc(it.brand || '')}" list="dlBrand" autocomplete="off"></label>
    <label class="field">Price<input type="number" name="price" min="0" step="0.01" value="${it.price == null ? '' : esc(it.price)}"></label></div>
    ${boughtField(it)}
    <label class="row"><input type="checkbox" name="spicy"${it.spicy ? ' checked' : ''}> Spicy <span class="small muted">(hidden unless "Show spicy items" is on)</span></label>
    ${genderField(it)}
    ${wordsField(it)}
    <div class="row"><button type="submit" class="btn primary">Save</button>${isNew ? '' : `<button type="button" class="btn" data-wear-item="${esc(it.id)}">Wore it today</button><span class="grow" style="flex:1"></span><button type="button" class="btn danger" data-del-item="${esc(it.id)}">Delete</button>`}</div>
  </form>`);
  // Suggest the spicy flag when a spicy-leaning type or material is picked
  $('#itemForm').addEventListener('change', e => {
    const fd = new FormData($('#itemForm')), sp = $('#itemForm [name=spicy]');
    if (e.target.name === 'sizeSystem') { const v = e.target.parentElement.querySelector('[name=sizeValue]'); if (v) v.setAttribute('list', `dlSize-${e.target.value}`); }
    if (e.target.name === 'type') {
      const t = K.byId.types.get(fd.get('type')) || {};
      if (t.spicy && !sp.checked) { sp.checked = true; toast('Marked as spicy. Untick it if you’d rather not.'); }
    }
  });
}
// Suggestions in the item form: brands and sizes already on your (visible) items, most used first; for sizes, then the
// system's usual values. Any new value can still be typed.
function usedValues(get) {
  const n = new Map();
  for (const it of doc.items.filter(visible)) for (const v of get(it)) { const t = String(v == null ? '' : v).trim(); if (!t) continue; const k = t.toLowerCase(), e = n.get(k) || n.set(k, { v: t, c: 0 }).get(k); e.c++; }
  return [...n.values()].sort((a, b) => b.c - a.c || a.v.localeCompare(b.v, undefined, { numeric: true, sensitivity: 'base' })).map(e => e.v);
}
function usedDatalists() {
  const opts = vs => vs.map(v => `<option value="${esc(v)}"></option>`).join('');
  return `<datalist id="dlBrand">${opts(usedValues(it => [it.brand]))}</datalist>` + K.sizeSystems.map(sys => {
    const mine = usedValues(it => (it.sizes || []).filter(z => z.system === sys.id).map(z => z.value)), low = new Set(mine.map(v => v.toLowerCase()));
    return `<datalist id="dlSize-${esc(sys.id)}">${opts([...mine, ...(sys.values || []).filter(v => !low.has(v.toLowerCase()))])}</datalist>`;
  }).join('');
}
// Purchase date: a date picker, saved as YYYY-MM-DD. An older month-only value (2025-03) is kept until a day is picked.
function boughtField(it) {
  const v = String(it.purchased || ''), full = /^\d{4}-\d{2}-\d{2}$/.test(v);
  return `<label class="field">Bought<input type="date" name="purchased" value="${full ? esc(v) : ''}" max="${today()}"></label>
    ${v && !full ? `<label class="row small muted"><input type="checkbox" name="purchasedKeep" value="${esc(v)}" checked> Keep “${esc(v)}” (pick a day above to replace it)</label>` : ''}`;
}
function readItemForm(it) {
  const fd = new FormData($('#itemForm')), vals = fd.getAll('sizeValue'), sys = fd.getAll('sizeSystem');
  return {
    ...it, name: fd.get('name').trim(), type: fd.get('type'), colours: fd.getAll('colours'),
    sizes: vals.map((v, i) => ({ system: sys[i], value: v.trim() })).filter(s => s.value),
    brand: fd.get('brand').trim() || undefined, price: fd.get('price') === '' ? undefined : +fd.get('price'),
    purchased: fd.get('purchased') || (fd.has('purchasedKeep') ? fd.get('purchasedKeep') : '') || undefined, spicy: fd.has('spicy') || undefined, followUp: fd.has('followUp') || undefined,
    gender: [...new Set([...fd.getAll('gender'), ...fd.get('genderNew').split(',').map(s => s.trim().toLowerCase())].filter(Boolean))],
    // Words that only exist on another device stay on the item; new names become words
    words: [...new Set([...(it.words || []).filter(id => !wordById(id) && !doc.deleted.includes(id)), ...fd.getAll('words'), ...(fd.get('wordsNew') || '').split(',').map(s => (addWord(s) || {}).id)].filter(Boolean))]
  };
}
const newItem = () => ({ id: uid(), added: now(), type: (K.types.find(t => t.parent) || K.types[0]).id, photos: [] });
// A saved outfit opens as its view: the name (edit it in place), the figure, every time it was worn, then its items
function outfitForm(o) {
  const items = doc.items.filter(visible), sel = new Set(o.items || []), saved = doc.outfits.some(x => x.id === o.id);
  const ws = saved ? outfitWears(o.id) : [], keep = $('#layer .drawer') && $('#layer [data-view-outfit]') ? $('#layer .drawer').scrollTop : 0;
  openDrawer(`${saved ? `<div data-view-outfit="${esc(o.id)}"><label class="sr-only" for="oName">Outfit name</label><input type="text" id="oName" class="title-edit" value="${esc(o.name || '')}" placeholder="Name this outfit" autocomplete="off" enterkeyhint="done"></div>
  ${wordsOf(o).length ? `<div class="owords center">${wordsOf(o).map(w => `<span class="wtag">${wordChip(w)}</span>`).join('')}</div>` : ''}
  ${outfitFigure(o, 'lg')}
  <div class="row fig-tools" id="figTools">${figToolsHtml(false)}</div>
  <p class="small muted fig-hint" style="margin:-8px 0 0">${matchMedia('(pointer:coarse)').matches ? 'Tap' : 'Double-click'} a piece to edit it.</p>
  <section class="stack wear-hist" data-label="${esc(o.name || 'Outfit')}"><h3>Worn ${ws.length ? `${ws.length}×` : ''}</h3>${ws.length ? `<ul>${ws.map(w => { const ph = wearPhoto(o, w), day = esc((w.at || '').slice(0, 10));
      return `<li class="entry"><span class="when">${ph ? `<img alt="Worn ${day}" class="zoomable" data-photo="${esc(ph)}">` : `<label class="btn sm add-ph">Add a photo<input type="file" accept="image/*" hidden data-wear-photo="${esc(w.id)}"></label>`}<span class="mono">${day}</span></span><span class="meta"><button type="button" class="btn ghost sm" data-unwear="${esc(w.id)}" aria-label="Remove the wear on ${day}">×</button></span></li>`; }).join('')}</ul>` : '<p class="muted small" style="margin:0">Not worn yet.</p>'}</section>
  <h3 style="margin:0">Items and occasions</h3>` : '<h2>New outfit</h2>'}
  <form class="form" id="outfitForm">
    ${saved ? '' : `<label class="field">Name<input type="text" name="name" value="${esc(o.name || '')}" placeholder="Club night"></label>`}
    ${checks('Occasions', 'occasions', K.occasions, o.occasions)}
    ${wordsField(o)}
    <fieldset><legend>Items</legend>${items.length ? `<ul class="grid">${items.map(it => card(it, sel.has(it.id))).join('')}</ul>` : '<p class="muted">Add items to your closet first.</p>'}</fieldset>
    <div class="row"><button type="submit" class="btn primary">Save</button>${doc.outfits.some(x => x.id === o.id) ? `<button type="button" class="btn" data-wear-outfit="${esc(o.id)}">Wore it today</button><span style="flex:1"></span><button type="button" class="btn danger" data-del-outfit="${esc(o.id)}">Delete</button>` : ''}</div>
  </form>`);
  if (saved) { $('#layer .drawer').scrollTop = keep; $('#layer .x').focus(); } // no keyboard popping up for the name on a phone
  const nm = $('#oName');
  if (nm) {
    nm.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nm.blur(); } });
    nm.addEventListener('blur', () => { const cur = doc.outfits.find(x => x.id === o.id), v = nm.value.trim(); if (!cur || v === (cur.name || '')) return; put('outfits', { ...cur, name: v }); render(); toast('Name saved'); });
  }
  $('#outfitForm').addEventListener('click', e => { const c = e.target.closest('[data-item]'); if (c) { e.stopPropagation(); c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); } }, true);
  $('#outfitForm').addEventListener('submit', e => {
    e.preventDefault(); const fd = new FormData(e.target), cur = doc.outfits.find(x => x.id === o.id) || o;
    const words = [...new Set([...(cur.words || []).filter(id => !wordById(id) && !doc.deleted.includes(id)), ...fd.getAll('words'), ...(fd.get('wordsNew') || '').split(',').map(x => (addWord(x) || {}).id)].filter(Boolean))];
    put('outfits', { ...cur, name: (fd.get('name') ?? (nm ? nm.value : cur.name) ?? '').trim(), occasions: fd.getAll('occasions'), words, items: $$('#outfitForm [data-item][aria-pressed="true"]').map(b => b.dataset.item) });
    closeDrawer(); render(); toast('Outfit saved');
  });
}
