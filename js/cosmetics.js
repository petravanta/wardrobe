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
    .map(([k, cs]) => ({ label: k.startsWith('own:') ? k.slice(4) : kname('cosmeticTypes', k), items: cs.sort((a, b) => (b.added || '').localeCompare(a.added || '')) }));
}
const shadeStrip = (c, n = 8) => (c.shades || []).filter(s => okHex(s.hex)).slice(0, n).map(s => `<i class="swatch" style="background:${esc(s.hex)}"></i>`).join(' ');
function cosCard(c) {
  const p = cosCover(c), sh = (c.shades || []).filter(s => okHex(s.hex));
  const ph = p ? `<img alt="" data-photo="${esc(p.id)}">` : sh.length ? `<span class="cos-blocks">${sh.slice(0, 12).map(s => `<i style="background:${esc(s.hex)}"></i>`).join('')}</span>` : 'No photo';
  const sub = [c.brand, sh.length > 1 ? `${sh.length} shades` : (sh[0] && sh[0].name) || ''].filter(Boolean).join(' · ');
  return `<li><button type="button" class="card" data-cos="${esc(c.id)}"><span class="ph">${ph}</span>
    <span class="cap"><b>${esc(c.name || cosTypeName(c))}</b><span>${shadeStrip(c)} ${esc(sub)}</span></span></button></li>`;
}
// Every shade as a tile, lightest first within each type, so similar lipsticks sit side by side
function shadeTiles(list) {
  return cosShelves(list).map(s => {
    const tiles = s.items.flatMap(c => (c.shades || []).filter(x => okHex(x.hex)).map(x => ({ c, x, l: labOf(x.hex) }))).sort((a, b) => b.l[0] - a.l[0]);
    if (!tiles.length) return '';
    return `<section class="shelf"><h3>${esc(s.label)} <span class="count">${tiles.length}</span></h3><ul class="shade-grid">${tiles.map(({ c, x }) => `<li><button type="button" class="shade-tile" data-cos="${esc(c.id)}" title="${esc(x.hex)}">
      <i style="background:${esc(x.hex)};color:${inkOn(x.hex)}">${x.finish ? esc(kname('finishes', x.finish)) : ''}</i>
      <b>${esc(x.name || 'Unnamed shade')}</b><span>${esc([c.brand, c.name].filter(Boolean).join(' · ') || cosTypeName(c))}</span></button></li>`).join('')}</ul></section>`;
  }).join('');
}
function renderCosmetics() {
  const f = cosF(), list = doc.cosmetics.filter(cosMatches), view = f.view === 'shades' ? 'shades' : 'products';
  const groups = [...K.cosmeticTypes.filter(t => !t.parent).map(t => [t.id, t.name]), ...(ownTypes().length ? [['own', 'Your own types']] : [])];
  const fins = K.finishes.filter(x => doc.cosmetics.some(c => (c.shades || []).some(s => s.finish === x.id)));
  const tags = sortedWords().filter(w => doc.cosmetics.some(c => (c.words || []).includes(w.id)));
  const on = (k, v) => (f[k] || []).includes(v);
  const filtered = (f.groups || []).length || (f.finishes || []).length || (f.words || []).length || f.q;
  $('#main').innerHTML = `
  <div class="bar">
    <button type="button" class="btn primary" data-cos-act="add">Add make-up</button>
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
    <div class="chips seg" role="group" aria-label="Show"><button type="button" class="chip" data-cos-view="products" aria-pressed="${view === 'products'}">Products</button><button type="button" class="chip" data-cos-view="shades" aria-pressed="${view === 'shades'}">Shades</button></div>
  </div>
  ${!list.length ? `<div class="empty">${doc.cosmetics.length ? 'Nothing matches these filters.' : 'No make-up yet. Add a lipstick or a palette, or drop a photo of it (and of a paper swatch) here, then tap each shade on the photo to save its colour.'}</div>`
    : view === 'shades' ? shadeTiles(list) || '<div class="empty">No shades with a colour yet. Open a product and tap its shades on a photo.</div>'
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
    <button type="button" class="btn ghost sm" data-shade-rm="${esc(s.id)}" aria-label="Remove shade ${i + 1}">×</button></div>`;
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
    if (s.hex && hex.toLowerCase() !== s.hex.toLowerCase()) { delete out.raw; } // set by hand: no longer a photo reading
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
  const c = cosEditing; cosEditing = null; cosSamp = null;
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

/* The sampler: the photo on a canvas; tap a pan or swatch (or drag a box over it) to read its colour */
const SAMP_SIZES = { s: 160, m: 80, l: 36 }; // tap square: the photo's long side over this
async function cosSampler(pid) {
  const c = cosEditing = cosRead(cosEditing), p = (c.photos || []).find(x => x.id === pid); if (!p) return;
  const blob = await Photos.full(pid);
  if (!blob) return toast('This photo isn’t on this device yet (it was added on another one), so its colours can’t be read here.', 6000);
  let bmp; try { bmp = await createImageBitmap(blob); } catch (e) { return toast('This browser can’t read that photo. Try a JPEG or PNG.'); }
  cosSamp = { pid, mode: 'shade', size: cosSamp && cosSamp.size || 'm', sel: null };
  openDrawer(`<div class="samp-fig"><div class="cs-photo samp-photo"><canvas id="sampCanvas" aria-label="The photo: tap a shade to read its colour, or drag a box over it"></canvas><div id="sampDots"></div><div id="sampBox" hidden></div></div></div>
  <div class="samp-side stack">
    <h2>Pick shades</h2>
    <p class="small">Tap the middle of each pan or swatch, or drag a box over it. Each one becomes a shade; name it below. Tap a shade in the list first to read it again.</p>
    <div class="chips" role="group" aria-label="What a tap does"><button type="button" class="chip" data-samp-mode="shade" aria-pressed="true">Shade</button><button type="button" class="chip" data-samp-mode="white" aria-pressed="false">White paper</button></div>
    <p class="small muted" id="sampWhite">${p.white ? `White paper set <i class="swatch" style="background:${rgbHex(p.white)}"></i>: colours from this photo are corrected for the light.` : 'For a swatch on paper, tap the bare paper once with <i>White paper</i>: the app then corrects for the colour of the light.'}</p>
    <div class="row"><span class="small muted" id="sampSzL">Tap size</span><div class="chips seg" role="group" aria-labelledby="sampSzL">${Object.keys(SAMP_SIZES).map(k => `<button type="button" class="chip" data-samp-size="${k}" aria-pressed="${cosSamp.size === k}">${k.toUpperCase()}</button>`).join('')}</div></div>
    <div class="stack" id="sampList"></div>
    <div class="row"><button type="button" class="btn primary" data-samp-done>Done</button></div>
  </div>`, 'samp-panel');
  const cv = $('#sampCanvas'), k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close && bmp.close();
  cosSamp.cv = cv; sampDraw();
  let start = null;
  const at = e => { const r = cv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  cv.addEventListener('pointerdown', e => { start = at(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!start) return; const [x, y] = at(e), b = $('#sampBox'), r = cv.getBoundingClientRect();
    if (Math.hypot((x - start[0]) * r.width, (y - start[1]) * r.height) < 8) { b.hidden = true; return; }
    Object.assign(b.style, { left: `${Math.min(x, start[0]) * 100}%`, top: `${Math.min(y, start[1]) * 100}%`, width: `${Math.abs(x - start[0]) * 100}%`, height: `${Math.abs(y - start[1]) * 100}%` }); b.hidden = false;
  });
  cv.addEventListener('pointerup', e => {
    if (!start) return; const [x, y] = at(e), s = start, r = cv.getBoundingClientRect(); start = null; $('#sampBox').hidden = true;
    let box; const dragged = Math.hypot((x - s[0]) * r.width, (y - s[1]) * r.height) >= 8;
    if (dragged) box = [Math.min(x, s[0]), Math.min(y, s[1]), Math.abs(x - s[0]), Math.abs(y - s[1])];
    else { const h = Math.max(cv.width, cv.height) / SAMP_SIZES[cosSamp.size] / 2; box = [x - h / cv.width, y - h / cv.height, 2 * h / cv.width, 2 * h / cv.height]; }
    sampTake(box, dragged);
  });
  cv.addEventListener('pointercancel', () => { start = null; $('#sampBox').hidden = true; });
}
// The median of each channel over the box (only its middle, for a dragged box, so a pan's rim or the gap beside it doesn't count)
function sampRead(box, dragged) {
  const cv = cosSamp.cv, W = cv.width, H = cv.height;
  let [x, y, w, h] = box; if (dragged) { x += w * .15; y += h * .15; w *= .7; h *= .7; }
  const x0 = Math.max(0, Math.round(x * W)), y0 = Math.max(0, Math.round(y * H)), x1 = Math.min(W, Math.max(x0 + 1, Math.round((x + w) * W))), y1 = Math.min(H, Math.max(y0 + 1, Math.round((y + h) * H)));
  const px = cv.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, x1 - x0, y1 - y0).data, ch = [[], [], []], step = Math.max(1, Math.floor(px.length / 4 / 40000));
  for (let i = 0; i < px.length; i += 4 * step) for (let c = 0; c < 3; c++) ch[c].push(px[i + c]);
  return ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
}
// A white paper reading scales each channel so the paper comes out a clean near-white: it fixes the light's colour and a dim exposure
const whiteFix = (rgb, w) => w ? rgb.map((v, i) => v * Math.min(2.2, Math.max(0.5, 242 / Math.max(1, w[i])))) : rgb;
function sampTake(box, dragged) {
  const c = cosEditing, p = c.photos.find(x => x.id === cosSamp.pid);
  const rgb = sampRead(box, dragged);
  if (cosSamp.mode === 'white') {
    p.white = rgb;
    c.shades = c.shades.map(s => s.at && s.at.photo === p.id && s.raw ? { ...s, hex: rgbHex(whiteFix(hexRgb(s.raw), rgb)) } : s);
    cosSamp.mode = 'shade'; toast('White paper set: colours from this photo are corrected');
    return sampPanel();
  }
  const at = { photo: p.id, x: +box[0].toFixed(4), y: +box[1].toFixed(4), w: +box[2].toFixed(4), h: +box[3].toFixed(4) }, raw = rgbHex(rgb), hex = rgbHex(whiteFix(rgb, p.white));
  const i = cosSamp.sel ? c.shades.findIndex(s => s.id === cosSamp.sel) : -1;
  if (i >= 0) { c.shades[i] = { ...c.shades[i], hex, raw, at }; cosSamp.sel = null; }
  else {
    const prev = [...c.shades].reverse().find(s => s.at && s.at.photo === p.id);
    c.shades = [...c.shades, { id: uid(), hex, raw, at, ...(prev && prev.finish ? { finish: prev.finish } : {}) }];
  }
  sampPanel(i < 0);
}
function sampDraw() {
  const c = cosEditing, pid = cosSamp.pid;
  $('#sampDots').innerHTML = c.shades.map((s, i) => s.at && s.at.photo === pid ? `<i class="${s.id === cosSamp.sel ? 'sel' : ''}" style="left:${(s.at.x + s.at.w / 2) * 100}%;top:${(s.at.y + s.at.h / 2) * 100}%;background:${esc(s.hex)};color:${inkOn(s.hex)}">${i + 1}</i>` : '').join('');
  $('#sampList').innerHTML = c.shades.length ? c.shades.map((s, i) => `<div class="shade-row${s.id === cosSamp.sel ? ' sel' : ''}" data-samp-shade="${esc(s.id)}"><span class="shade-n mono">${i + 1}</span>
    <button type="button" class="shade-dot" data-samp-sel="${esc(s.id)}" style="background:${esc(s.hex)}" aria-pressed="${s.id === cosSamp.sel}" aria-label="Read shade ${i + 1} again with the next tap" title="${s.at && s.at.photo === pid ? 'Read again' : 'From another photo or set by hand: tap, then tap the photo to read it here'}"></button>
    <input type="text" data-samp-name="${esc(s.id)}" value="${esc(s.name || '')}" placeholder="Shade name" aria-label="Name of shade ${i + 1}" autocomplete="off" enterkeyhint="done">
    <select data-samp-finish="${esc(s.id)}" aria-label="Finish of shade ${i + 1}"><option value="">Finish</option>${K.finishes.map(x => `<option value="${x.id}"${s.finish === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <button type="button" class="btn ghost sm" data-samp-rm="${esc(s.id)}" aria-label="Remove shade ${i + 1}">×</button></div>`).join('') : '<p class="small muted" style="margin:0">No shades yet.</p>';
}
function sampPanel(focusNew) {
  const p = cosEditing.photos.find(x => x.id === cosSamp.pid);
  $$('[data-samp-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sampMode === cosSamp.mode)));
  $('#sampWhite').innerHTML = cosSamp.mode === 'white' ? '<b>Now tap the bare white paper.</b>' : p.white ? `White paper set <i class="swatch" style="background:${rgbHex(p.white)}"></i>: colours from this photo are corrected for the light.` : 'For a swatch on paper, tap the bare paper once with <i>White paper</i>: the app then corrects for the colour of the light.';
  sampDraw();
  if (focusNew) { const ins = $$('#sampList [data-samp-name]'), last = ins[ins.length - 1]; if (last && matchMedia('(pointer:fine)').matches) last.focus({ preventScroll: true }); if (last) last.closest('.shade-row').scrollIntoView({ block: 'nearest' }); }
}
function sampBack() { const c = cosEditing; if (cosSamp && cosSamp.cv) cosSamp.cv.width = cosSamp.cv.height = 0; cosSamp = null; cosForm(c); }

/* Events */
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-close]'); if (!t) return;
  const d = t.dataset;
  // In the sampler, × goes back to the product, not out of it
  if (cosSamp && d.close !== undefined) { e.stopImmediatePropagation(); return sampBack(); }
  if (d.cos && !t.closest('#layer')) return cosForm(structuredClone(cosById(d.cos)));
  if (d.cosAct === 'add') return cosForm(newCos());
  if (d.cosAct === 'photo') return $('#cosIn').click();
  if (d.cosAct === 'shade') { const c = cosRead(cosEditing); c.shades = [...c.shades, { id: uid(), hex: '#c06070' }]; cosForm(c); const ins = $$('#cosShades [name=shName]'); if (ins.length) ins[ins.length - 1].focus(); return; }
  if (d.cosAct === 'clear') { setSetting('cos', { view: cosF().view }); return render(); }
  if (d.cosView) return setCosF('view', d.cosView);
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
  if (d.sampRm) { cosEditing.shades = cosEditing.shades.filter(s => s.id !== d.sampRm); if (cosSamp.sel === d.sampRm) cosSamp.sel = null; return sampDraw(); }
  if (d.sampDone !== undefined) return sampBack();
}, true);
document.addEventListener('input', e => {
  const d = e.target.dataset || {};
  if (e.target.id === 'cosQ') { clearTimeout(cosQT); cosQT = setTimeout(() => { setCosF('q', e.target.value); const q = $('#cosQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); }
  if (d.sampName && cosEditing) { const s = cosEditing.shades.find(x => x.id === d.sampName); if (s) s.name = e.target.value.trim() || undefined; }
});
let cosQT;
document.addEventListener('change', e => { const d = e.target.dataset || {}; if (d.sampFinish && cosEditing) { const s = cosEditing.shades.find(x => x.id === d.sampFinish); if (s) s.finish = e.target.value || undefined; } });
document.addEventListener('submit', e => { if (e.target.id === 'cosForm') { e.preventDefault(); cosSave(); } });
// Esc in the sampler goes back to the product; Enter in a shade name moves on
addEventListener('keydown', e => {
  if (!cosSamp) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); sampBack(); }
  else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.sampName) { e.preventDefault(); e.target.blur(); }
}, true);
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
