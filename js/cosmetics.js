'use strict';
/* ---------- Cosmetics ---------- */
// Make-up you own: records in doc.cosmetics {id, u, added, type | ownType, brand, name, shades, price, purchased, opened,
// notes, words, photos}. A product holds one shade (a lipstick) or many (a palette): each shade is {id, name, hex, finish?,
// raw?, at?}. A shade sampled from a photo keeps where (at: {photo, x, y, w, h}, fractions of the photo) and its colour
// before white correction (raw), so its dot shows on the photo and a later white tap can correct it again. Photos are
// {id, role: 'product' | 'swatch', white?}: stored and uploaded to Google Photos like item photos, never put in Drive.
// Types come from data/cosmetic-types.json; a type of your own is ownType (its name), reused from the products you have.
let cosEditing = null, cosSamp = null;
const COS_OWN = '__own';
const cosById = id => doc.cosmetics.find(c => c.id === id);
const cosTypeName = c => c.ownType || kname('cosmeticTypes', c.type);
const cosGroup = c => { if (c.ownType) return 'own'; const t = K.byId.cosmeticTypes.get(c.type); return t ? (t.parent || t.id) : 'own'; };
const cosLabel = c => [c.brand, c.name || cosTypeName(c), (c.shades || []).length === 1 && c.shades[0].name ? c.shades[0].name : ''].filter(Boolean).join(' · ');
const cosCover = c => { const p = c.photos || []; return p.find(x => x.role === 'product') || p[0]; };
const ownTypes = () => [...new Set(doc.cosmetics.map(c => c.ownType).filter(Boolean))].sort((a, b) => a.localeCompare(b));
// Text that reads on a swatch: dark on light colours, light on dark ones
const inkOn = hex => labOf(hex)[0] > 62 ? '#1b1f24' : '#ffffff';
const okHex = h => /^#[0-9a-f]{6}$/i.test(h || '');
// A multicolour shade (glitter, duochrome) shows its dominant colours as stripes, widest for the most common one
function shadeBg(s) {
  const ps = s.multi && (s.parts || []).filter(p => okHex(p.hex));
  if (!ps || ps.length < 2) return s.hex;
  let at = 0; const all = ps.reduce((a, p) => a + (p.share || 0), 0) || 1;
  return `linear-gradient(135deg,${ps.map(p => { const a = at; at += (p.share || 0) / all * 100; return `${p.hex} ${a.toFixed(1)}% ${at.toFixed(1)}%`; }).join(',')})`;
}
const MULTI_FINISHES = ['glitter', 'duochrome'];
const cosF = () => doc.settings.cos || {};
function setCosF(k, v) { setSetting('cos', { ...cosF(), [k]: v }); render(); }

function cosMatches(c) {
  const f = cosF();
  if ((f.groups || []).length && !f.groups.includes(cosGroup(c))) return false;
  if ((f.finishes || []).length && !(c.shades || []).some(s => f.finishes.includes(s.finish))) return false;
  if ((f.words || []).length && !(c.words || []).some(w => f.words.includes(w))) return false;
  const q = (f.q || '').trim().toLowerCase();
  return !q || [c.brand, c.name, cosTypeName(c), c.notes, ...(c.shades || []).map(s => s.name), ...wordsOf(c).map(w => w.name)].some(s => s && s.toLowerCase().includes(q));
}
// Shelves by type, in the order of data/cosmetic-types.json, your own types last
function cosShelves(list) {
  const order = K.cosmeticTypes.map(t => t.id), m = new Map();
  list.forEach(c => { const k = c.ownType ? 'own:' + c.ownType : c.type; (m.get(k) || m.set(k, []).get(k)).push(c); });
  return [...m.entries()].sort(([a], [b]) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 1e4 : ia) - (ib < 0 ? 1e4 : ib) || a.localeCompare(b); })
    .map(([k, cs]) => ({ key: k, label: k.startsWith('own:') ? k.slice(4) : kname('cosmeticTypes', k), items: cs.sort((a, b) => (b.added || '').localeCompare(a.added || '')) }));
}
const shadeStrip = (c, n = 8) => (c.shades || []).filter(s => okHex(s.hex)).slice(0, n).map(s => `<i class="swatch" style="background:${esc(shadeBg(s))}"></i>`).join(' ');
function cosCard(c) {
  const p = cosCover(c), sh = (c.shades || []).filter(s => okHex(s.hex));
  const ph = p ? `<img alt="" data-photo="${esc(p.id)}">` : sh.length ? `<span class="cos-blocks">${sh.slice(0, 12).map(s => `<i style="background:${esc(shadeBg(s))}"></i>`).join('')}</span>` : 'No photo';
  const sub = [c.brand, sh.length > 1 ? `${sh.length} shades` : (sh[0] && sh[0].name) || ''].filter(Boolean).join(' · ');
  return `<li><button type="button" class="card" data-cos="${esc(c.id)}"><span class="ph">${ph}</span>
    <span class="cap"><b>${esc(c.name || cosTypeName(c))}</b><span>${shadeStrip(c)} ${esc(sub)}</span></span></button></li>`;
}
// Every shade as a tile, lightest first within each type, so similar lipsticks sit side by side
function shadeTiles(list) {
  const gaps = cosF().gapsOff ? null : gapRows(), left = new Set(gaps && gaps.rows || []);
  const fits = (r, t) => r.z.types.includes(t) || r.z.types.includes((K.byId.cosmeticTypes.get(t) || {}).parent);
  const shelves = cosShelves(list).map(s => {
    const tiles = s.items.flatMap(c => (c.shades || []).filter(x => okHex(x.hex)).map(x => ({ c, x, l: labOf(x.hex) }))).sort((a, b) => b.l[0] - a.l[0]);
    if (!tiles.length) return '';
    const mine = [...left].filter(r => fits(r, s.key)); mine.forEach(r => left.delete(r));
    return `<section class="shelf"><h3>${esc(s.label)} <span class="count">${tiles.length}</span></h3>${mine.map(r => gapRow(r, gaps.s)).join('')}<ul class="shade-grid">${tiles.map(({ c, x }) => `<li><button type="button" class="shade-tile" data-cos="${esc(c.id)}" title="${esc([x.name, c.brand, c.name, x.hex].filter(Boolean).join(" · "))}">
      <i style="background:${esc(shadeBg(x))};color:${inkOn(x.hex)}">${x.finish ? esc(kname('finishes', x.finish)) : ''}${x.multi ? ' ✦' : ''}</i>
      <b>${esc(x.name || 'Unnamed shade')}</b><span>${esc([c.brand, c.name].filter(Boolean).join(' · ') || cosTypeName(c))}</span></button></li>`).join('')}</ul></section>`;
  }).join('');
  // Parts of the face with no shelf here get their own, unless the type filter leaves them out
  const groups = cosF().groups || [], groupOf = t => (K.byId.cosmeticTypes.get(t) || {}).parent || t;
  const rest = [...left].filter(r => !groups.length || r.z.types.some(t => groups.includes(groupOf(t))))
    .map(r => `<section class="shelf"><h3>${esc(r.z.name)} <span class="count">none yet</span></h3>${gapRow(r, gaps.s)}</section>`).join('');
  return (gaps && !gaps.s ? gapHint() : '') + shelves + rest;
}
function renderCosmetics() {
  const f = cosF(), list = doc.cosmetics.filter(cosMatches), view = ['shades', 'looks'].includes(f.view) ? f.view : 'products';
  const groups = [...K.cosmeticTypes.filter(t => !t.parent).map(t => [t.id, t.name]), ...(ownTypes().length ? [['own', 'Your own types']] : [])];
  const fins = K.finishes.filter(x => doc.cosmetics.some(c => (c.shades || []).some(s => s.finish === x.id)));
  const tags = sortedWords().filter(w => doc.cosmetics.some(c => (c.words || []).includes(w.id)));
  const on = (k, v) => (f[k] || []).includes(v);
  const filtered = (f.groups || []).length || (f.finishes || []).length || (f.words || []).length || f.q;
  const views = `<div class="chips seg" role="group" aria-label="Show">${[['products', 'Products'], ['shades', 'Shades'], ['looks', 'Looks']].map(([k, n]) => `<button type="button" class="chip" data-cos-view="${k}" aria-pressed="${view === k}">${n}</button>`).join('')}</div>`;
  const shelves = view === 'shades' ? shadeTiles(list) : '';
  if (view === 'looks') { $('#main').innerHTML = `<div class="bar"><span class="grow"></span>${views}</div>${renderLooks()}`; return; }
  $('#main').innerHTML = `
  <div class="bar">
    <button type="button" class="btn primary" data-cos-act="add">Add make-up</button>
    <button type="button" class="btn" data-cos-act="sheet" title="One photo of swatches from several products, such as lipsticks swatched on paper">Swatch sheet</button>
    ${GPhotos.known() ? '<button type="button" class="btn" data-gphotos="pick" data-cos-pick>From Google Photos</button>' : ''}
    <span class="small muted fine-only">or drop photos anywhere</span>
    <span class="grow"></span>
    <label class="sr-only" for="cosQ">Search make-up</label><input type="text" id="cosQ" placeholder="Search" value="${esc(f.q || '')}" style="max-width:180px">
  </div>
  <div class="bar" role="group" aria-label="Filters">
    <div class="chips">${groups.map(([id, n]) => `<button type="button" class="chip" data-cos-group="${esc(id)}" aria-pressed="${on('groups', id)}">${esc(n)}</button>`).join('')}</div>
    ${fins.length ? `<div class="chips">${fins.map(x => `<button type="button" class="chip" data-cos-finish="${esc(x.id)}" aria-pressed="${on('finishes', x.id)}">${esc(x.name)}</button>`).join('')}</div>` : ''}
    ${tags.length ? `<div class="chips">${tags.map(w => `<button type="button" class="chip" data-cos-word="${esc(w.id)}" aria-pressed="${on('words', w.id)}">${wordChip(w)}</button>`).join('')}</div>` : ''}
    ${filtered ? '<button type="button" class="btn ghost sm" data-cos-act="clear">Clear filters</button>' : ''}
    <span class="grow"></span>
    ${view === 'shades' ? `<button type="button" class="chip" data-cos-gaps aria-pressed="${!f.gapsOff}" title="Colours from your season you don’t own yet, under the make-up they’d be">Season suggestions</button>` : ''}
    ${views}
  </div>
  ${shelves && !doc.cosmetics.length ? shelves : ''}
  ${shelves && doc.cosmetics.length ? shelves : !list.length ? `<div class="empty">${doc.cosmetics.length ? 'Nothing matches these filters.' : 'No make-up yet. Add a lipstick or a palette, or drop a photo of it (and of a paper swatch) here, then tap each shade on the photo to save its colour. Swatched several products on one sheet of paper? Use <i>Swatch sheet</i>: each swatch becomes its own product.'}</div>`
    : view === 'shades' ? '<div class="empty">No shades with a colour yet. Open a product and tap its shades on a photo.</div>'
    : cosShelves(list).map(s => `<section class="shelf"><h3>${esc(s.label)} <span class="count">${s.items.length}</span></h3><ul class="${thumbClass()}">${s.items.map(cosCard).join('')}</ul></section>`).join('')}`;
}
const newCos = () => ({ id: uid(), added: now(), type: 'lipstick', shades: [], photos: [] });

/* The product form */
const finishSel = (name, v, label) => `<select name="${name}" aria-label="${label}"><option value="">Finish</option>${K.finishes.map(x => `<option value="${x.id}"${v === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
function shadeRow(s, i) {
  return `<div class="shade-row" data-shade="${esc(s.id)}"><span class="shade-n mono">${i + 1}</span>
    <input type="color" name="shHex" value="${okHex(s.hex) ? esc(s.hex) : '#c06070'}" aria-label="Colour of shade ${i + 1}" title="${s.at ? 'Sampled from a photo; change it by hand here' : 'Pick the colour'}">
    <input type="text" name="shName" value="${esc(s.name || '')}" placeholder="Shade name" aria-label="Name of shade ${i + 1}" autocomplete="off">
    ${finishSel('shFinish', s.finish, `Finish of shade ${i + 1}`)}
    ${s.multi && (s.parts || []).length > 1 ? `<i class="multi-strip" style="background:${esc(shadeBg(s))}" title="Multicolour: ${esc(s.parts.map(p => p.hex).join(', '))}"></i>` : ''}
    <button type="button" class="btn ghost sm" data-shade-rm="${esc(s.id)}" aria-label="Remove shade ${i + 1}">×</button>
    ${shadeUses(cosEditing, s).length ? `<span class="shade-uses small muted">Suits ${esc(shadeUses(cosEditing, s).join(', ').toLowerCase())}</span>` : ''}</div>`;
}
function cosThumbs(c) {
  return (c.photos || []).map(p => `<figure><img alt="" class="zoomable" data-photo="${esc(p.id)}"><button type="button" class="rm" data-cos-rmphoto="${esc(p.id)}" aria-label="Remove photo">×</button>
    <figcaption><button type="button" class="linkbtn" data-cos-role="${esc(p.id)}" title="Tap to switch between product and swatch photo">${p.role === 'swatch' ? 'swatch' : 'product'}</button></figcaption>
    <button type="button" class="btn sm clean" data-cos-sample="${esc(p.id)}">Pick shades</button></figure>`).join('');
}
function cosForm(c) {
  cosEditing = c; editing = null;
  const isNew = !cosById(c.id), own = [...new Set([...ownTypes(), ...(c.ownType ? [c.ownType] : [])])], groups = K.cosmeticTypes.filter(t => !t.parent);
  const brands = [...new Set(doc.cosmetics.map(x => x.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const typeOpts = groups.map(g => `<optgroup label="${esc(g.name)}">${K.cosmeticTypes.filter(t => t.parent === g.id).map(t => `<option value="${t.id}"${!c.ownType && c.type === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="${g.id}"${!c.ownType && c.type === g.id ? ' selected' : ''}>${esc(g.name)} (other)</option></optgroup>`).join('')
    + `<optgroup label="Your own">${own.map(n => `<option value="own:${esc(n)}"${c.ownType === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}<option value="${COS_OWN}">New type…</option></optgroup>`;
  openDrawer(`<h2>${isNew ? 'Add make-up' : esc(c.name || cosTypeName(c))}</h2>
  <div class="thumbs" id="cosThumbs">${cosThumbs(c)}</div>
  <div class="row"><button type="button" class="btn sm" data-cos-act="photo">Add photo</button>${GPhotos.known() ? '<button type="button" class="btn sm" data-gphotos="pick" data-cos-pick>From Google Photos</button>' : ''}<span class="small muted fine-only">or drop one here</span></div>
  ${(c.photos || []).length ? '<p class="small muted">Tap <i>Pick shades</i> on a photo of the product or of a paper swatch, then tap each shade to save its colour.</p>' : '<p class="small muted">Add a photo of the product, the open palette or a swatch on white paper to pick its colours. Everything stays on this device (and in your Google Photos album, if connected).</p>'}
  <form class="form" id="cosForm">
    <label class="field">Type<select name="type">${typeOpts}</select></label>
    <label class="field" id="cosOwnF" hidden>Your type<input type="text" name="ownType" value="${esc(c.ownType || '')}" placeholder="Lip oil, glitter gel…" autocomplete="off"></label>
    <div class="two"><label class="field">Brand<input type="text" name="brand" value="${esc(c.brand || '')}" list="dlCosBrand" autocomplete="off"></label>
    <label class="field">Name<input type="text" name="name" value="${esc(c.name || '')}" placeholder="Matte lipstick, Nude palette…" autocomplete="off"></label></div>
    <datalist id="dlCosBrand">${brands.map(b => `<option value="${esc(b)}"></option>`).join('')}</datalist>
    <fieldset><legend>Shades <span class="count">${(c.shades || []).length || ''}</span></legend>
      <div class="stack" id="cosShades">${(c.shades || []).map(shadeRow).join('') || '<p class="small muted" style="margin:0">No shades yet: pick them on a photo, or add one by hand.</p>'}</div>
      <div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-cos-act="shade">Add a shade by hand</button></div></fieldset>
    <div class="two"><label class="field">Price<input type="number" name="price" min="0" step="0.01" value="${c.price == null ? '' : esc(c.price)}"></label>
    <label class="field">Bought<input type="date" name="purchased" value="${esc(c.purchased || '')}" max="${today()}"></label></div>
    <label class="field">Opened <span class="small muted">(most make-up keeps 6 to 24 months once open)</span><input type="date" name="opened" value="${esc(c.opened || '')}" max="${today()}"></label>
    <label class="field">Notes<textarea name="notes" rows="3" placeholder="How it wears, what it goes with…">${esc(c.notes || '')}</textarea></label>
    ${wordsField(c)}
    <div class="row"><button type="submit" class="btn primary">Save</button>${isNew ? '' : `<span class="grow" style="flex:1"></span><button type="button" class="btn danger" data-cos-del="${esc(c.id)}">Delete</button>`}</div>
  </form>`);
  $('#cosForm [name=type]').addEventListener('change', e => {
    const f = $('#cosOwnF'), own = e.target.value === COS_OWN; f.hidden = !own;
    if (own) $('input', f).focus(); else if (!e.target.value.startsWith('own:')) $('input', f).value = '';
  });
}
// What the form holds now, on top of the record (photos and where shades were sampled stay)
function cosRead(c) {
  const form = $('#cosForm'); if (!form) return c;
  const fd = new FormData(form), tv = fd.get('type') || '', ownIn = (fd.get('ownType') || '').trim().replace(/\s+/g, ' ');
  const ownType = tv === COS_OWN ? ownIn : tv.startsWith('own:') ? tv.slice(4) : '';
  const rows = $$('#cosShades [data-shade]');
  const shades = rows.map(r => {
    const s = (c.shades || []).find(x => x.id === r.dataset.shade) || { id: r.dataset.shade };
    const hex = $('[name=shHex]', r).value, name = $('[name=shName]', r).value.trim(), finish = $('[name=shFinish]', r).value || undefined;
    const out = { ...s, hex, name: name || undefined, finish };
    if (s.hex && hex.toLowerCase() !== s.hex.toLowerCase()) { delete out.raw; if (out.parts && out.parts.length) out.parts = [{ ...out.parts[0], hex, raw: undefined }, ...out.parts.slice(1)]; } // set by hand: no longer a photo reading
    return out;
  });
  const n = v => { v = (v || '').trim(); return v || undefined; };
  return {
    ...c, type: ownType ? undefined : tv === COS_OWN ? 'lips' : tv, ownType: ownType || undefined,
    brand: n(fd.get('brand')), name: n(fd.get('name')), shades,
    price: fd.get('price') === '' ? undefined : +fd.get('price'), purchased: n(fd.get('purchased')), opened: n(fd.get('opened')),
    notes: n(fd.get('notes')), words: formWords(fd, c)
  };
}
const cosRefresh = () => { cosForm(cosRead(cosEditing)); };
// Photos in: the Add photo button, a drop, or Google Photos. Into the open product, or a new one with all of them
// (a palette and its paper swatch are one product). The first photo is the product photo, later ones swatches.
async function cosTake(files) {
  const imgs = [...files].filter(isImage), skipped = [...files].length - imgs.length;
  if (!imgs.length) return toast('Only photos can be added (JPEG, PNG, WebP, HEIC).');
  const c = cosEditing ? cosRead(cosEditing) : newCos();
  for (const f of imgs) c.photos = [...(c.photos || []), { id: await Photos.add(f), role: (c.photos || []).length ? 'swatch' : 'product' }];
  cosForm(c);
  if (skipped) toast(`Skipped ${skipped} file${skipped > 1 ? 's' : ''} that ${skipped > 1 ? 'aren’t photos' : 'isn’t a photo'}`);
  // A palette, or a first photo: go straight to picking shades on it
  const t = K.byId.cosmeticTypes.get(c.type);
  if (!(c.shades || []).length && imgs.length === (c.photos || []).length && (t && t.multi || imgs.length === 1)) cosSampler(c.photos[0].id);
}
function cosClosed() { // from closeDrawer(): a new product that was never saved takes its photos with it
  const c = cosEditing; cosEditing = null; if (cosSamp && cosSamp.bmp && cosSamp.bmp.close) cosSamp.bmp.close(); cosSamp = null;
  if (c && !cosById(c.id)) (c.photos || []).forEach(p => Photos.drop(p.id));
}
function cosSave() {
  const c = cosRead(cosEditing);
  if (!c.ownType && $('#cosForm [name=type]').value === COS_OWN) return toast('Give your type a name, or pick one from the list'), $('#cosForm [name=ownType]').focus();
  put('cosmetics', c); cosEditing = c; closeDrawer(); render(); toast('Saved');
}
function cosDelete(id) {
  const c = cosById(id); if (!c || !confirm('Delete this product and its photos?')) return;
  remove('cosmetics', id); (c.photos || []).forEach(p => Photos.drop(p.id)); GPhotos.unlink(c.photos || []); closeDrawer(); render(); toast('Deleted');
}
// A removed photo leaves this browser and the album at once (as in the item form), and the saved product stops pointing at it
function cosRmPhoto(pid) {
  const c = cosRead(cosEditing), gone = (c.photos || []).filter(p => p.id === pid);
  c.photos = c.photos.filter(p => p.id !== pid); c.shades = c.shades.map(s => s.at && s.at.photo === pid ? (({ at, raw, ...r }) => r)(s) : s);
  gone.forEach(p => Photos.drop(p.id)); GPhotos.unlink(gone);
  const saved = cosById(c.id); if (saved) put('cosmetics', { ...saved, photos: (saved.photos || []).filter(p => p.id !== pid), shades: (saved.shades || []).map(s => s.at && s.at.photo === pid ? (({ at, raw, ...r }) => r)(s) : s) });
  cosForm(c);
}

/* The sampler: the photo on a canvas; tap a pan or swatch (or drag a box over it) to read its colour. It works on one
   product's photo (its shades are cosEditing.shades) or on a swatch sheet: one photo of swatches from several products
   (cosSamp.sheet; each row in cosSamp.rows becomes a product, or a shade added to one you have, on Done). */
const SAMP_SIZES = { s: 160, m: 80, l: 36 }; // tap square: the photo's long side over this
const SAMP_ZOOM = [1, 6];
const sampList = () => cosSamp.sheet ? cosSamp.rows : cosEditing.shades;
const sampSet = v => { if (cosSamp.sheet) cosSamp.rows = v; else cosEditing.shades = v; };
const sampPhoto = () => cosSamp.sheet ? cosSamp.photo : cosEditing.photos.find(x => x.id === cosSamp.pid);
async function cosSampler(pid) {
  const c = cosEditing = cosRead(cosEditing), p = (c.photos || []).find(x => x.id === pid); if (!p) return;
  const blob = await Photos.full(pid);
  if (!blob) return toast('This photo isn’t on this device yet (it was added on another one), so its colours can’t be read here.', 6000);
  let bmp; try { bmp = await createImageBitmap(blob); } catch (e) { return toast('This browser can’t read that photo. Try a JPEG or PNG.'); }
  cosSamp = { pid, mode: 'shade', size: cosSamp && cosSamp.size || 'm', sel: null, zoom: 1 };
  sampOpen(bmp); bmp.close && bmp.close();
}
// A swatch sheet: the photo stays in memory (for the crops each product gets) and is never stored itself
async function sheetSampler(file) {
  if (!isImage(file)) return toast('Only photos can be used (JPEG, PNG, WebP, HEIC).');
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { return toast('This browser can’t read that photo. Try a JPEG or PNG.'); }
  if (cosEditing || $('#layer').innerHTML) closeDrawer();
  cosSamp = { sheet: true, pid: 'sheet', photo: { id: 'sheet' }, rows: [], bmp, mode: 'shade', size: 'm', sel: null, zoom: 1 };
  sampOpen(bmp);
}
function sampOpen(bmp) {
  const sheet = cosSamp.sheet, p = sampPhoto();
  const brands = [...new Set(doc.cosmetics.map(x => x.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  openDrawer(`<div class="samp-fig"><div class="cs-photo samp-photo"><canvas id="sampCanvas" aria-label="The photo: tap a shade to read its colour, or drag a box over it"></canvas><div id="sampDots"></div><div id="sampBox" hidden></div></div></div>
  <div class="samp-side stack">
    <h2>${sheet ? 'Swatch sheet' : 'Pick shades'}</h2>
    <p class="small">${sheet ? 'Tap each swatch, or drag a box over it. Each one becomes its own product: give it a brand, a name and a type below, or add it to a product you have.' : 'Tap the middle of each pan or swatch, or drag a box over it. Each one becomes a shade; name it below.'} Tap a shade’s dot in the list first to read it again.</p>
    <div class="row samp-zoom" role="group" aria-label="Zoom"><button type="button" class="btn sm" data-samp-zoom="out" aria-label="Zoom out">−</button><span class="small mono" id="sampZoomL">100%</span><button type="button" class="btn sm" data-samp-zoom="in" aria-label="Zoom in">+</button><button type="button" class="btn ghost sm" data-samp-zoom="fit">Fit</button><span class="small muted">${matchMedia('(pointer:coarse)').matches ? 'or pinch; drag to move around' : 'or Ctrl + scroll'}</span></div>
    <div class="chips" role="group" aria-label="What a tap does"><button type="button" class="chip" data-samp-mode="shade" aria-pressed="true">Shade</button><button type="button" class="chip" data-samp-mode="white" aria-pressed="false">White paper</button><button type="button" class="chip" data-samp-multi-all aria-pressed="${!!cosSamp.multi}" title="Glitter, duochrome: each tap reads the main colours, not one average">✦ Multicolour</button></div>
    <p class="small muted" id="sampWhite"></p>
    <div class="row"><span class="small muted" id="sampSzL">Tap size</span><div class="chips seg" role="group" aria-labelledby="sampSzL">${Object.keys(SAMP_SIZES).map(k => `<button type="button" class="chip" data-samp-size="${k}" aria-pressed="${cosSamp.size === k}">${k.toUpperCase()}</button>`).join('')}</div></div>
    <datalist id="dlSheetBrand">${brands.map(b => `<option value="${esc(b)}"></option>`).join('')}</datalist>
    <div class="stack" id="sampList"></div>
    <div class="row"><button type="button" class="btn primary" data-samp-done>${sheet ? 'Save products' : 'Done'}</button>${sheet ? '<button type="button" class="btn" data-close>Cancel</button>' : ''}</div>
  </div>`, 'samp-panel');
  const cv = $('#sampCanvas'), k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)), fig = $('#layer .samp-fig');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0, cv.width, cv.height);
  cosSamp.cv = cv; sampPanel();
  const at = e => { const r = cv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  const tap = (e, from) => {
    const [x, y] = at(e), r = cv.getBoundingClientRect(), dragged = from && Math.hypot((x - from[0]) * r.width, (y - from[1]) * r.height) >= 8;
    let box;
    if (dragged) box = [Math.min(x, from[0]), Math.min(y, from[1]), Math.abs(x - from[0]), Math.abs(y - from[1])];
    else { const h = Math.max(cv.width, cv.height) / SAMP_SIZES[cosSamp.size] / 2; box = [x - h / cv.width, y - h / cv.height, 2 * h / cv.width, 2 * h / cv.height]; }
    sampTake(box, dragged);
  };
  // Mouse: click to read, drag a box. Touch: tap to read, one finger moves around the zoomed photo, two fingers zoom.
  const pts = new Map(); let start = null, pan = null, pinch = null;
  const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  cv.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId);
    if (pts.size === 2) { start = null; pan = null; $('#sampBox').hidden = true; pinch = { d: two().d, z: cosSamp.zoom }; return; }
    if (pts.size > 2 || pinch) return;
    if (e.pointerType === 'mouse') start = at(e);
    else { const dr = $('#layer .drawer'); pan = { x: e.clientX, y: e.clientY, sl: fig.scrollLeft, st: fig.scrollTop, dt: dr.scrollTop, moved: false }; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) { if (pts.size >= 2) { const t = two(); sampZoom(pinch.z * t.d / pinch.d, t.x, t.y); } return; }
    if (pan) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (Math.hypot(dx, dy) > 8) pan.moved = true; if (!pan.moved) return;
      fig.scrollLeft = pan.sl - dx; fig.scrollTop = pan.st - dy;
      if (cosSamp.zoom <= 1) $('#layer .drawer').scrollTop = pan.dt - dy; // not zoomed: the panel scrolls, as anywhere else
      return;
    }
    if (!start) return; const [x, y] = at(e), b = $('#sampBox'), r = cv.getBoundingClientRect();
    if (Math.hypot((x - start[0]) * r.width, (y - start[1]) * r.height) < 8) { b.hidden = true; return; }
    Object.assign(b.style, { left: `${Math.min(x, start[0]) * 100}%`, top: `${Math.min(y, start[1]) * 100}%`, width: `${Math.abs(x - start[0]) * 100}%`, height: `${Math.abs(y - start[1]) * 100}%` }); b.hidden = false;
  });
  const end = e => {
    pts.delete(e.pointerId); $('#sampBox').hidden = true;
    if (pinch) { if (!pts.size) pinch = null; return; }
    if (pan) { const p0 = pan; pan = null; if (!p0.moved && e.type === 'pointerup') tap(e, null); return; }
    if (start) { const s = start; start = null; if (e.type === 'pointerup') tap(e, s); }
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  // Ctrl + scroll, and a trackpad pinch (which browsers send as Ctrl + scroll), zoom around the pointer
  fig.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); sampZoom(cosSamp.zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); }, { passive: false });
}
// Zoom the photo, keeping the spot under (cx, cy) where it is (the middle of the view when not given)
function sampZoom(z, cx, cy) {
  if (!cosSamp || !cosSamp.cv) return;
  const fig = $('#layer .samp-fig'), ph = $('#layer .samp-photo'); if (!fig || !ph) return;
  z = Math.min(SAMP_ZOOM[1], Math.max(SAMP_ZOOM[0], z));
  const fr = fig.getBoundingClientRect(); if (cx == null) { cx = fr.left + fig.clientWidth / 2; cy = fr.top + Math.min(fig.clientHeight, innerHeight - fr.top) / 2; }
  const r0 = ph.getBoundingClientRect(), px = (cx - r0.left) / r0.width, py = (cy - r0.top) / r0.height;
  if (!cosSamp.baseW || cosSamp.zoom === 1) cosSamp.baseW = r0.width / cosSamp.zoom;
  cosSamp.zoom = z;
  ph.style.width = z === 1 ? '' : `${cosSamp.baseW * z}px`; ph.style.maxWidth = z === 1 ? '' : 'none';
  fig.classList.toggle('zoomed', z > 1);
  const r1 = ph.getBoundingClientRect();
  fig.scrollLeft += r1.left + px * r1.width - cx; fig.scrollTop += r1.top + py * r1.height - cy;
  const l = $('#sampZoomL'); if (l) l.textContent = `${Math.round(z * 100)}%`;
}
// The median of each channel over the box (only its middle, for a dragged box, so a pan's rim or the gap beside it doesn't count)
function sampPixels(box, dragged, max = 40000) {
  const cv = cosSamp.cv, W = cv.width, H = cv.height;
  let [x, y, w, h] = box; if (dragged) { x += w * .15; y += h * .15; w *= .7; h *= .7; }
  const x0 = Math.max(0, Math.round(x * W)), y0 = Math.max(0, Math.round(y * H)), x1 = Math.min(W, Math.max(x0 + 1, Math.round((x + w) * W))), y1 = Math.min(H, Math.max(y0 + 1, Math.round((y + h) * H)));
  const px = cv.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, x1 - x0, y1 - y0).data, out = [], step = Math.max(1, Math.floor(px.length / 4 / max));
  for (let i = 0; i < px.length; i += 4 * step) out.push([px[i], px[i + 1], px[i + 2]]);
  return out;
}
function sampRead(box, dragged) {
  const pts = sampPixels(box, dragged);
  return [0, 1, 2].map(c => pts.map(p => p[c]).sort((a, b) => a - b)[pts.length >> 1]);
}
// Glitter and duochrome: the few colours that cover most of the box (k-means in Lab, so "different" means different to
// the eye). Clusters closer than ΔE 12 merge and any under 7% of the pixels drop out; the biggest comes first.
function sampColours(box, dragged) {
  const pts = sampPixels(box, dragged, 3000), lab = pts.map(rgbLab), k = Math.min(4, pts.length);
  if (!k) return [];
  const cen = [lab[0]]; // seeds spread out: each next one is the pixel farthest from the seeds so far
  while (cen.length < k) { let bi = 0, bd = -1; lab.forEach((l, i) => { const d = Math.min(...cen.map(c => dE(l, c))); if (d > bd) { bd = d; bi = i; } }); if (bd < 6) break; cen.push(lab[bi]); }
  let as = new Array(lab.length).fill(0);
  for (let it = 0; it < 10; it++) {
    as = lab.map(l => { let bi = 0, bd = Infinity; cen.forEach((c, i) => { const d = dE(l, c); if (d < bd) { bd = d; bi = i; } }); return bi; });
    cen.forEach((_, j) => { const m = lab.filter((_, i) => as[i] === j); if (m.length) cen[j] = [0, 1, 2].map(c => m.reduce((a, l) => a + l[c], 0) / m.length); });
  }
  let groups = cen.map((_, j) => { const idx = as.map((a, i) => a === j ? i : -1).filter(i => i >= 0); return { idx, l: cen[j] }; }).filter(g => g.idx.length);
  for (let merged = true; merged;) { // merge near-identical clusters
    merged = false;
    for (let a = 0; a < groups.length && !merged; a++) for (let b = a + 1; b < groups.length; b++) if (dE(groups[a].l, groups[b].l) < 12) { groups[a].idx.push(...groups[b].idx); groups.splice(b, 1); merged = true; break; }
  }
  return groups.map(g => ({ rgb: [0, 1, 2].map(c => g.idx.map(i => pts[i][c]).sort((a, b) => a - b)[g.idx.length >> 1]), share: g.idx.length / pts.length }))
    .filter(g => g.share >= 0.07).sort((a, b) => b.share - a.share);
}
// A shade's reading from its box: one median colour, or for a multicolour shade its dominant colours too
function sampShade(s, box, dragged, white) {
  const at = { photo: cosSamp.pid, x: +box[0].toFixed(4), y: +box[1].toFixed(4), w: +box[2].toFixed(4), h: +box[3].toFixed(4), ...(dragged ? { drag: true } : {}) };
  if (!s.multi) { const rgb = sampRead(box, dragged); const { parts, ...r } = s; return { ...r, at, raw: rgbHex(rgb), hex: rgbHex(whiteFix(rgb, white)) }; }
  const cs = sampColours(box, dragged), parts = cs.map(c => ({ raw: rgbHex(c.rgb), hex: rgbHex(whiteFix(c.rgb, white)), share: +c.share.toFixed(3) }));
  return { ...s, at, raw: parts[0].raw, hex: parts[0].hex, parts };
}
const sampBoxOf = s => [s.at.x, s.at.y, s.at.w, s.at.h];
// A white paper reading scales each channel so the paper comes out a clean near-white: it fixes the light's colour and a dim exposure
const whiteFix = (rgb, w) => w ? rgb.map((v, i) => v * Math.min(2.2, Math.max(0.5, 242 / Math.max(1, w[i])))) : rgb;
function sampTake(box, dragged) {
  const p = sampPhoto(), list = sampList();
  if (cosSamp.mode === 'white') {
    const rgb = sampRead(box, dragged); p.white = rgb;
    const fix = h => rgbHex(whiteFix(hexRgb(h), rgb));
    sampSet(list.map(s => s.at && s.at.photo === p.id && s.raw ? { ...s, hex: fix(s.raw), ...(s.parts ? { parts: s.parts.map(q => q.raw ? { ...q, hex: fix(q.raw) } : q) } : {}) } : s));
    cosSamp.mode = 'shade'; toast('White paper set: colours from this photo are corrected');
    return sampPanel();
  }
  const i = cosSamp.sel ? list.findIndex(s => s.id === cosSamp.sel) : -1;
  if (i >= 0) { list[i] = sampShade(list[i], box, dragged, p.white); cosSamp.sel = null; }
  else {
    const prev = [...list].reverse().find(s => s.at && s.at.photo === p.id);
    // On a sheet, the next swatch is probably the same kind of product (and finish) as the last one; the brand usually isn't.
    // Multicolour taps (the chip) read several colours, and so does a shade whose finish is glitter or duochrome.
    const fin = prev && prev.finish, multi = cosSamp.multi || MULTI_FINISHES.includes(fin);
    sampSet([...list, sampShade({ id: uid(), ...(fin ? { finish: fin } : {}), ...(multi ? { multi: true } : {}), ...(cosSamp.sheet ? { type: prev ? prev.type : 'lipstick', into: '' } : {}) }, box, dragged, p.white)]);
  }
  sampPanel(i < 0);
}
const finishOpts = v => `<option value="">Finish</option>${K.finishes.map(x => `<option value="${x.id}"${v === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}`;
const cosTypeOpts = v => K.cosmeticTypes.filter(t => !t.parent).map(g => `<optgroup label="${esc(g.name)}">${K.cosmeticTypes.filter(t => t.parent === g.id).map(t => `<option value="${t.id}"${v === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="${g.id}"${v === g.id ? ' selected' : ''}>${esc(g.name)} (other)</option></optgroup>`).join('')
  + (ownTypes().length ? `<optgroup label="Your own">${ownTypes().map(n => `<option value="own:${esc(n)}"${v === 'own:' + n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>` : '');
// A sheet row's product: a new one (brand, name, type) or one you have, to add the shade to
function sheetProd(s, i) {
  const have = [...doc.cosmetics].sort((a, b) => cosLabel(a).localeCompare(cosLabel(b)));
  return `<div class="sheet-prod"><label class="sr-only" for="sInto${i}">Product for swatch ${i + 1}</label><select id="sInto${i}" data-sheet-into="${esc(s.id)}"><option value="">New product</option>${have.length ? `<optgroup label="Add to one you have">${have.map(c => `<option value="${esc(c.id)}"${s.into === c.id ? ' selected' : ''}>${esc(cosLabel(c))}</option>`).join('')}</optgroup>` : ''}</select>
    ${s.into ? '' : `<input type="text" data-sheet-brand="${esc(s.id)}" value="${esc(s.brand || '')}" placeholder="Brand" aria-label="Brand of swatch ${i + 1}" list="dlSheetBrand" autocomplete="off">
    <input type="text" data-sheet-pname="${esc(s.id)}" value="${esc(s.pname || '')}" placeholder="Product name" aria-label="Product name of swatch ${i + 1}" autocomplete="off">
    <select data-sheet-type="${esc(s.id)}" aria-label="Type of swatch ${i + 1}">${cosTypeOpts(s.type)}</select>`}</div>`;
}
function sampDraw() {
  const pid = cosSamp.pid, list = sampList(), sheet = cosSamp.sheet;
  $('#sampDots').innerHTML = list.map((s, i) => s.at && s.at.photo === pid ? `<i class="${s.id === cosSamp.sel ? 'sel' : ''}" style="left:${(s.at.x + s.at.w / 2) * 100}%;top:${(s.at.y + s.at.h / 2) * 100}%;background:${esc(shadeBg(s))};color:${inkOn(s.hex)}">${i + 1}</i>` : '').join('');
  $('#sampList').innerHTML = list.length ? list.map((s, i) => `<div class="${sheet ? 'sheet-row stack' : ''}" data-samp-shade="${esc(s.id)}"><div class="shade-row${s.id === cosSamp.sel ? ' sel' : ''}"><span class="shade-n mono">${i + 1}</span>
    <button type="button" class="shade-dot" data-samp-sel="${esc(s.id)}" style="background:${esc(shadeBg(s))}" aria-pressed="${s.id === cosSamp.sel}" aria-label="Read ${sheet ? 'swatch' : 'shade'} ${i + 1} again with the next tap" title="${s.at && s.at.photo === pid ? 'Read again' : 'From another photo or set by hand: tap, then tap the photo to read it here'}"></button>
    <input type="text" data-samp-name="${esc(s.id)}" value="${esc(s.name || '')}" placeholder="Shade name" aria-label="Name of shade ${i + 1}" autocomplete="off" enterkeyhint="done">
    <select data-samp-finish="${esc(s.id)}" aria-label="Finish of shade ${i + 1}">${finishOpts(s.finish)}</select>
    <button type="button" class="btn ghost sm multi-btn" data-samp-multi="${esc(s.id)}" aria-pressed="${!!s.multi}" aria-label="Multicolour: read several colours for shade ${i + 1}" title="Multicolour (glitter, duochrome): read the main colours, not one average">✦</button>
    <button type="button" class="btn ghost sm" data-samp-rm="${esc(s.id)}" aria-label="Remove shade ${i + 1}">×</button></div>${sheet ? sheetProd(s, i) : ''}</div>`).join('') : `<p class="small muted" style="margin:0">No ${sheet ? 'swatches' : 'shades'} yet.</p>`;
}
function sampPanel(focusNew) {
  const p = sampPhoto();
  $$('[data-samp-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sampMode === cosSamp.mode)));
  $('#sampWhite').innerHTML = cosSamp.mode === 'white' ? '<b>Now tap the bare white paper.</b>' : p.white ? `White paper set <i class="swatch" style="background:${rgbHex(p.white)}"></i>: colours from this photo are corrected for the light.` : 'For a swatch on paper, tap the bare paper once with <i>White paper</i>: the app then corrects for the colour of the light.';
  sampDraw();
  if (focusNew) { const ins = $$('#sampList [data-samp-name]'), last = ins[ins.length - 1]; if (last && matchMedia('(pointer:fine)').matches) last.focus({ preventScroll: true }); if (last) last.closest('[data-samp-shade]').scrollIntoView({ block: 'nearest' }); }
}
// Switches a shade between one colour and several; one read on this photo is read again from where it was tapped
function sampToggleMulti(id, on) {
  const list = sampList(), i = list.findIndex(x => x.id === id); if (i < 0) return;
  const s = list[i], multi = on == null ? !s.multi : on, p = sampPhoto();
  let n = { ...s, multi: multi || undefined };
  if (!multi) delete n.parts;
  if (s.at && s.at.photo === cosSamp.pid) n = sampShade(n, sampBoxOf(s), !!s.at.drag, p.white);
  list[i] = n; sampDraw();
  if (multi && n.parts) toast(n.parts.length > 1 ? `Found ${n.parts.length} main colours` : 'Only one main colour there. Drag a bigger box over the glitter to catch more.', 4000);
}
function sampBack() {
  if (cosSamp && cosSamp.cv) cosSamp.cv.width = cosSamp.cv.height = 0;
  if (cosSamp && cosSamp.sheet) { if (cosSamp.bmp && cosSamp.bmp.close) cosSamp.bmp.close(); cosSamp = null; return closeDrawer(); }
  const c = cosEditing; cosSamp = null; cosForm(c);
}
// Each swatch on a sheet gets its own photo: a crop around it from the full-size sheet (three times its size, so the
// paper around it shows), on which its dot sits where it was read
async function sheetCrop(bmp, s) {
  const W = bmp.width, H = bmp.height, cx = (s.at.x + s.at.w / 2) * W, cy = (s.at.y + s.at.h / 2) * H;
  const bs = Math.max(s.at.w * W, s.at.h * H), side = Math.min(Math.max(W, H), Math.max(bs * 3, 0.12 * Math.max(W, H)));
  const x0 = Math.max(0, Math.min(W - Math.min(side, W), cx - side / 2)), y0 = Math.max(0, Math.min(H - Math.min(side, H), cy - side / 2)), w = Math.min(side, W), h = Math.min(side, H);
  const k = Math.min(1, 900 / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, x0, y0, w, h, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .9)), id = await Photos.add(new File([blob], 'swatch.jpg', { type: 'image/jpeg' }));
  const at = { photo: id, x: +((s.at.x * W - x0) / w).toFixed(4), y: +((s.at.y * H - y0) / h).toFixed(4), w: +(s.at.w * W / w).toFixed(4), h: +(s.at.h * H / h).toFixed(4) };
  return { id, at };
}
async function sheetSave() {
  const S = cosSamp, rows = S.rows; if (!rows.length) return toast('Tap a swatch on the photo first');
  const btn = $('[data-samp-done]'); if (btn) btn.disabled = true;
  let made = 0, added = 0;
  for (const s of rows) {
    const { id, at } = await sheetCrop(S.bmp, s), photo = { id, role: 'swatch', ...(S.photo.white ? { white: S.photo.white } : {}) };
    const shade = { id: uid(), hex: s.hex, ...(s.raw ? { raw: s.raw } : {}), at, ...(s.name ? { name: s.name } : {}), ...(s.finish ? { finish: s.finish } : {}) };
    const have = s.into && cosById(s.into);
    if (have) { put('cosmetics', { ...have, shades: [...(have.shades || []), shade], photos: [...(have.photos || []), photo] }); added++; }
    else {
      const own = (s.type || '').startsWith('own:') ? s.type.slice(4) : '';
      put('cosmetics', { id: uid(), added: now(), ...(own ? { ownType: own } : { type: s.type || 'lipstick' }), ...(s.brand ? { brand: s.brand } : {}), ...(s.pname ? { name: s.pname } : {}), shades: [shade], photos: [photo] });
      made++;
    }
  }
  sampBack(); render();
  toast([made && `${made} new product${made > 1 ? 's' : ''}`, added && `${added} shade${added > 1 ? 's' : ''} added to products you have`].filter(Boolean).join(', ') + ' saved', 5000);
}

/* Events */
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-close]'); if (!t) return;
  const d = t.dataset;
  // In the sampler, × goes back to the product, not out of it
  if (cosSamp && d.close !== undefined) { e.stopImmediatePropagation(); return sampBack(); }
  if (d.cos && !t.closest('#layer')) return cosForm(structuredClone(cosById(d.cos)));
  if (d.cosAct === 'add') return cosForm(newCos());
  if (d.cosAct === 'photo') return $('#cosIn').click();
  if (d.cosAct === 'sheet') return $('#sheetIn').click();
  if (d.cosAct === 'shade') { const c = cosRead(cosEditing); c.shades = [...c.shades, { id: uid(), hex: '#c06070' }]; cosForm(c); const ins = $$('#cosShades [name=shName]'); if (ins.length) ins[ins.length - 1].focus(); return; }
  if (d.cosAct === 'clear') { setSetting('cos', { view: cosF().view, gapsOff: cosF().gapsOff }); return render(); }
  if (d.cosView) return setCosF('view', d.cosView);
  if (t.matches('[data-cos-gaps]')) return setCosF('gapsOff', !cosF().gapsOff || undefined);
  if (d.cosGroup || d.cosFinish || d.cosWord) {
    const [k, v] = d.cosGroup ? ['groups', d.cosGroup] : d.cosFinish ? ['finishes', d.cosFinish] : ['words', d.cosWord], s = new Set(cosF()[k] || []);
    s.has(v) ? s.delete(v) : s.add(v); return setCosF(k, [...s]);
  }
  if (d.shadeRm && cosEditing) { const c = cosRead(cosEditing); c.shades = c.shades.filter(s => s.id !== d.shadeRm); return cosForm(c); }
  if (d.cosRmphoto && cosEditing) return cosRmPhoto(d.cosRmphoto);
  if (d.cosRole && cosEditing) { const c = cosRead(cosEditing); c.photos = c.photos.map(p => p.id === d.cosRole ? { ...p, role: p.role === 'swatch' ? 'product' : 'swatch' } : p); return cosForm(c); }
  if (d.cosSample && cosEditing) return cosSampler(d.cosSample);
  if (d.cosDel) return cosDelete(d.cosDel);
  if (!cosSamp) return;
  if (d.sampMode) { cosSamp.mode = d.sampMode; return sampPanel(); }
  if (d.sampSize) { cosSamp.size = d.sampSize; $$('[data-samp-size]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sampSize === cosSamp.size))); return; }
  if (d.sampSel) { cosSamp.sel = cosSamp.sel === d.sampSel ? null : d.sampSel; cosSamp.mode = 'shade'; return sampPanel(); }
  if (d.sampRm) { sampSet(sampList().filter(s => s.id !== d.sampRm)); if (cosSamp.sel === d.sampRm) cosSamp.sel = null; return sampDraw(); }
  if (d.sampMultiAll !== undefined) { cosSamp.multi = !cosSamp.multi; t.setAttribute('aria-pressed', String(cosSamp.multi)); return toast(cosSamp.multi ? 'Each tap now reads the main colours (for glitter and duochrome)' : 'Each tap reads one colour again'); }
  if (d.sampMulti) return sampToggleMulti(d.sampMulti, null);
  if (d.sampZoom) return sampZoom(d.sampZoom === 'fit' ? 1 : cosSamp.zoom * (d.sampZoom === 'in' ? 1.5 : 1 / 1.5));
  if (d.sampDone !== undefined) return cosSamp.sheet ? sheetSave() : sampBack();
}, true);
document.addEventListener('input', e => {
  const d = e.target.dataset || {};
  if (e.target.id === 'cosQ') { clearTimeout(cosQT); cosQT = setTimeout(() => { setCosF('q', e.target.value); const q = $('#cosQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); }
  const row = id => cosSamp && sampList().find(x => x.id === id), v = e.target.value.trim() || undefined;
  if (d.sampName) { const s = row(d.sampName); if (s) s.name = v; }
  if (d.sheetBrand) { const s = row(d.sheetBrand); if (s) s.brand = v; }
  if (d.sheetPname) { const s = row(d.sheetPname); if (s) s.pname = v; }
});
let cosQT;
document.addEventListener('change', e => {
  const d = e.target.dataset || {}, s = cosSamp && sampList().find(x => x.id === (d.sampFinish || d.sheetType || d.sheetInto)); if (!s) return;
  if (d.sampFinish) { s.finish = e.target.value || undefined; if (MULTI_FINISHES.includes(s.finish) && !s.multi) sampToggleMulti(s.id, true); }
  if (d.sheetType) s.type = e.target.value;
  if (d.sheetInto) { s.into = e.target.value; sampDraw(); }
});
document.addEventListener('submit', e => { if (e.target.id === 'cosForm') { e.preventDefault(); cosSave(); } });
// Esc in the sampler goes back to the product; Enter in a shade name moves on
addEventListener('keydown', e => {
  if (!cosSamp) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); sampBack(); }
  else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.sampName) { e.preventDefault(); e.target.blur(); }
}, true);
$('#sheetIn').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) sheetSampler(f); });
$('#cosIn').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) cosTake(f); });
// On the Cosmetics tab, or with a product open, dropped photos go to make-up, never into the closet
const cosDropHere = () => cosEditing || (tab === 'cosmetics' && !$('#layer').innerHTML);
addEventListener('dragenter', e => { if (isFileDrag(e) && cosDropHere()) setTimeout(() => { const p = $('#dropOverlay p'); if (p) p.textContent = cosSamp ? 'Go back to the product to add photos' : cosEditing ? 'Drop to add the photos to this product' : 'Drop to add make-up with these photos'; }); });
addEventListener('drop', e => {
  if (!isFileDrag(e) || !cosDropHere()) return;
  e.preventDefault(); e.stopImmediatePropagation(); dragDepth = 0; const d = $('#dropOverlay'); if (d) d.remove();
  if (cosSamp) return toast('Go back to the product to add photos');
  cosTake(e.dataTransfer.files);
}, true);
// From Google Photos: into the open product, or a new one
const cosPick = () => pickPhotos(null, files => { if (cosSamp) return toast('Go back to the product to add photos'); return cosTake(files); });
