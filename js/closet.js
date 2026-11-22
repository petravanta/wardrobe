'use strict';
/* ---------- Views ---------- */
let tab = lsGet(TAB_KEY) || 'closet';
const wearsOf = id => doc.wears.filter(w => w.item === id || (w.outfit && ((doc.outfits.find(o => o.id === w.outfit) || {}).items || []).includes(id)));
function render() {
  $$('#tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  (({ closet: renderCloset, outfits: renderOutfits, worn: renderWorn, colour: renderColour, settings: renderSettings })[tab] || renderCloset)();
  fillThumbs($('#main'));
}
function card(it, pressed) {
  const p = coverPhoto(it), sub = [kname('types', it.type), it.brand].filter(Boolean).join(' · ');
  return `<li><button type="button" class="card" data-item="${esc(it.id)}"${pressed == null ? '' : ` aria-pressed="${pressed}"`}>
    <span class="ph">${p ? `<img alt="" data-photo="${esc(p.id)}"${p.role === 'cutout' ? ' class="cut"' : ''}>` : 'No photo'}</span>
    <span class="cap"><b>${esc(it.name || kname('types', it.type))}${wordsOf(it).some(w => w.emoji) ? ` <span class="wemoji" title="${esc(wordsOf(it).map(w => w.name).join(', '))}">${esc(wordsOf(it).map(w => w.emoji).filter(Boolean).join(''))}</span>` : ''}</b><span>${(it.colours || []).slice(0, 3).map(c => `<i class="swatch" style="background:${esc((K.byId.colours.get(c) || {}).hex || '#888')}"></i>`).join(' ')} ${esc(sub)}${it.spicy ? ' <span class="spicy-tag">· spicy</span>' : ''}${it.followUp ? ' <span class="follow-tag">· needs a clean photo</span>' : ''}</span>${(F().missing || []).length && lacks(it).length ? `<span class="miss-tag">No ${esc(lacks(it).map(k => MISSING[k].toLowerCase()).join(', '))}</span>` : ''}</span>
  </button>${zoomBtn(it)}</li>`;
}
function renderCloset() {
  migrateSizeFilter();
  const f = F(), items = sortItems(doc.items.filter(it => matches(it))), st = doc.settings;
  const groups = K.types.filter(t => !t.parent && (doc.settings.showSpicy || !t.spicy));
  const fams = [...new Set(K.colours.map(c => c.family))];
  const gtags = K.genderTags.map(g => g.id);
  $('#main').innerHTML = `
  <div class="bar">
    <button type="button" class="btn primary" data-act="add">Add item</button>
    ${GPhotos.known() ? '<button type="button" class="btn" data-gphotos="pick">From Google Photos</button>' : ''}
    <span class="small muted fine-only">or drop photos anywhere</span>
    <span class="grow"></span>
    <label class="sr-only" for="q">Search</label><input type="text" id="q" placeholder="Search" value="${esc(f.q || '')}" style="max-width:180px">
  </div>
  <div class="bar" role="group" aria-label="Filters">
    <label class="sr-only" for="fGroup">Item type</label>
    <select id="fGroup"><option value="">All types</option>${groups.map(g => `<option value="${g.id}"${f.group === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
    ${sizePicker(f)}
    <div class="chips">${fams.map(x => { const w = famSwatch(x); return `<button type="button" class="chip fam${w.light ? ' fam-light' : ''}${w.dark ? ' fam-dark' : ''}" data-fam="${x}" aria-pressed="${(f.families || []).includes(x)}" style="--fill:${w.fill};--on:${w.on}">${esc(x)}</button>`; }).join('')}</div>
    <div class="chips">${gtags.map(x => `<button type="button" class="chip" data-gender="${esc(x)}" aria-pressed="${(f.gender || []).includes(x)}">${esc(gname(x))}</button>`).join('')}</div>
    ${doc.words.length ? `<div class="chips">${sortedWords().map(w => `<button type="button" class="chip" data-fword="${esc(w.id)}" aria-pressed="${(f.words || []).includes(w.id)}">${wordChip(w)}</button>`).join('')}</div>` : ''}
    ${doc.settings.showSpicy ? `<button type="button" class="chip" data-spicy aria-pressed="${!!f.spicyOnly}">Spicy only</button>` : ''}
    ${f.followUp || doc.items.some(it => it.followUp && visible(it)) ? `<button type="button" class="chip" data-follow aria-pressed="${!!f.followUp}">Needs a clean photo</button>` : ''}
    <button type="button" class="chip" data-act="review" aria-pressed="${reviewOpen || !!(f.missing || []).length}" title="Find items with details still missing">✎ Review</button>
    ${Object.values(f).some(v => v && (!Array.isArray(v) || v.length)) ? '<button type="button" class="btn ghost sm" data-act="clear">Clear filters</button>' : ''}
  </div>
  ${reviewBar(f)}
  <div class="bar" role="group" aria-label="Sort and group">
    <label class="small muted" for="sSort">Sort</label>
    <select id="sSort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}"${(st.sort || 'added') === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
    <button type="button" class="chip" data-act="reverse" aria-pressed="${!!st.sortReverse}" title="Reverse the order">⇅ Reverse</button>
    <label class="small muted" for="sGroup">Group</label>
    <select id="sGroup">${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}"${(st.groupBy || '') === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
  </div>
  ${items.length ? groupItems(items).map(s => s.label
      ? `<section class="shelf"><h3>${esc(s.label)} <span class="count">${s.items.length}</span></h3><ul class="grid">${s.items.map(it => card(it)).join('')}</ul></section>`
      : `<ul class="grid">${s.items.map(it => card(it)).join('')}</ul>`).join('')
    : `<div class="empty">${doc.items.length ? 'Nothing matches these filters.' : 'Your closet is empty. Add your first item, or drop a few photos here.'}</div>`}`;
}
