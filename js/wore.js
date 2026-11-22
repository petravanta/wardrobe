'use strict';
/* ---------- What I wore, from a photo (on this device) ---------- */
// See README, "What I wore, from a photo". recognise-worker.js finds the garments in an outfit photo (a clothes-parsing
// model) and turns each one into a vector (CLIP); the closet's photos get vectors too, and the closest items are offered.
// Nothing is logged until the confirm screen is saved. Photos never leave the device for this: only the models download.
const EMBED_ID = 'clip-b32-q8'; // the model and precision recognise-worker.js uses; vectors with another id are made again
const MATCH = { clear: 0.82, margin: 0.04, shown: 5, seen: 6 }; // first guesses, to tune on real photos
// What the clothes model finds -> the body regions of data/types.json it can be, the type a new item starts as, and its label
const KINDS = {
  hat: { regions: ['hat'], type: 'hat', name: 'Hat' },
  sunglasses: { regions: ['accessory'], type: 'accessories', name: 'Sunglasses' },
  scarf: { regions: ['scarf'], type: 'scarf', name: 'Scarf' },
  top: { regions: ['top'], type: 'tops', name: 'Top' },
  dress: { regions: ['dress'], type: 'dress', name: 'Dress or one-piece' },
  belt: { regions: ['belt'], type: 'belt', name: 'Belt' },
  skirt: { regions: ['skirt', 'bottom'], type: 'skirt', name: 'Skirt' },
  pants: { regions: ['bottom'], type: 'trousers', name: 'Trousers or shorts' },
  bag: { regions: ['bag'], type: 'bag', name: 'Bag' },
  shoes: { regions: ['shoes'], type: 'shoes', name: 'Shoes' }
};
const regionOf = typeId => { const t = K.byId.types.get(typeId) || {}; return t.region || (K.byId.types.get(t.parent) || {}).region || 'other'; };
// Vectors are kept on the photo record ({m: EMBED_ID, d: base64}), 8 bits a number, so they sync with the data and every
// device can match against photos it can't read itself (another site's Google Photos images can be shown but not read)
function packVec(v) {
  let m = 0; for (const x of v) m = Math.max(m, Math.abs(x)); m = m || 1;
  const q = new Int8Array(v.length); for (let i = 0; i < v.length; i++) q[i] = Math.round(v[i] / m * 127);
  let s = ''; new Uint8Array(q.buffer).forEach(b => { s += String.fromCharCode(b); }); return { m: EMBED_ID, d: btoa(s) };
}
const vecCache = new Map();
function unpackVec(p) {
  if (!p || p.m !== EMBED_ID || !p.d) return null;
  if (vecCache.has(p.d)) return vecCache.get(p.d);
  const b = atob(p.d), v = new Float32Array(b.length); let n = 0;
  for (let i = 0; i < b.length; i++) { const x = (b.charCodeAt(i) << 24) >> 24; v[i] = x; n += x * x; }
  n = Math.sqrt(n) || 1; for (let i = 0; i < v.length; i++) v[i] /= n;
  vecCache.set(p.d, v); return v;
}
const cosine = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
// An item's vectors: its cut-out and main photo, plus the crops it was confirmed from before (item.seen), so it gets
// easier to recognise each time it's logged
const itemVecs = it => [...(it.photos || []).map(p => p.vec), ...(it.seen || [])].map(unpackVec).filter(Boolean);
const toIndex = it => (it.photos || []).filter(p => p.role === 'cutout' || p.role === 'main' || p.role === 'crop');

const Recognise = (() => {
  let worker = null, seq = 0, chain = Promise.resolve(), onProgress = () => {};
  const waiting = new Map(), files = new Map();
  function w() {
    if (worker) return worker;
    worker = new Worker('recognise-worker.js', { type: 'module' });
    worker.onmessage = e => {
      const m = e.data, job = waiting.get(m.id); if (!job) return;
      if (m.progress) { files.set(m.progress.file, m.progress); return onProgress([...files.values()]); }
      waiting.delete(m.id);
      if (m.error) { job.reject(new Error(m.error)); reset(); } else job.resolve(m);
    };
    worker.onerror = e => { e.preventDefault(); waiting.forEach(j => j.reject(new Error(e.message || 'The recognition models couldn’t load'))); waiting.clear(); reset(); };
    return worker;
  }
  function reset() { if (worker) worker.terminate(); worker = null; }
  const run = (op, blob) => new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject }); w().postMessage({ id, op, blob }); });
  const queue = (op, blob) => { const p = chain.then(() => run(op, blob)); chain = p.catch(() => {}); return p; };
  return {
    supported: typeof Worker === 'function' && typeof OffscreenCanvas === 'function',
    progress(fn) { onProgress = fn || (() => {}); },
    segment: blob => queue('segment', blob).then(m => m.segments),
    embed: blob => queue('embed', blob).then(m => m.vec)
  };
})();
// "Downloading the recognition models (first time only): 40 of 130 MB", or '' once they're all here
function downloadNote(list) {
  const t = list.reduce((s, f) => s + (f.total || 0), 0), l = list.reduce((s, f) => s + (f.loaded || 0), 0);
  return t && l < t ? `Downloading the recognition models (first time only): ${mb(l)} of ${mb(t)} MB` : '';
}
// Makes vectors for closet photos that don't have one yet and whose bytes are in this browser. Returns how many items
// can't be matched here (no vector, and their photos are only in another browser or in Google Photos).
async function indexCloset(status = () => {}) {
  const todo = [];
  for (const it of doc.items) for (const p of toIndex(it)) if (!unpackVec(p.vec)) todo.push([it.id, p.id]);
  let done = 0, since = 0;
  for (const [itemId, photoId] of todo) {
    const blob = await Photos.full(photoId); if (!blob) continue;
    const vec = await Recognise.embed(blob);
    const it = itemById(itemId); if (!it) continue;
    it.photos = it.photos.map(p => p.id === photoId ? { ...p, vec: packVec(vec) } : p); it.u = now();
    done++; if (++since >= 10) { since = 0; save(); }
    status(`Getting your closet ready for matching: ${done} photo${done > 1 ? 's' : ''}…`);
  }
  if (done) save();
  return doc.items.filter(it => !itemVecs(it).length && (it.photos || []).length).length;
}
// The closest closet items for one garment vector, among items of the regions this kind can be (all items if none)
function rankFor(kind, vec) {
  if (!vec) return [];
  const regions = (KINDS[kind] || {}).regions || [];
  const pool = doc.items.filter(visible).map(it => ({ it, vs: itemVecs(it) })).filter(x => x.vs.length);
  const same = pool.filter(x => regions.includes(regionOf(x.it.type)));
  return (same.length ? same : pool).map(x => ({ id: x.it.id, score: Math.max(...x.vs.map(v => cosine(v, vec))) }))
    .sort((a, b) => b.score - a.score);
}
// Up to two colours from data/colours.json that cover most of a garment crop, for a new item's first guess
async function guessColours(blob) {
  const bmp = await createImageBitmap(blob), s = 48 / Math.max(bmp.width, bmp.height), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
  const px = g.getImageData(0, 0, c.width, c.height).data, rgb = K.colours.filter(x => /^#[0-9a-f]{6}$/i.test(x.hex)).map(x => [x.id, parseInt(x.hex.slice(1, 3), 16), parseInt(x.hex.slice(3, 5), 16), parseInt(x.hex.slice(5, 7), 16)]);
  const n = new Map(); let all = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue; all++;
    let best = null, bd = 1e9; for (const [id, r, gg, b] of rgb) { const d = (px[i] - r) ** 2 + (px[i + 1] - gg) ** 2 + (px[i + 2] - b) ** 2; if (d < bd) { bd = d; best = id; } }
    n.set(best, (n.get(best) || 0) + 1);
  }
  return [...n].sort((a, b) => b[1] - a[1]).filter(([, k], i) => i === 0 || k / all > 0.25).slice(0, 2).map(([id]) => id);
}

let wore = null; // the "what I wore" confirm screen while it's open: { photo, pieces: [{kind, blob, url, vec, ranked}], saved }
const pct = s => `${Math.round(Math.max(0, s) * 100)}%`;
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));
// The day a photo was taken: the camera's own date in a JPEG (EXIF DateTimeOriginal, else DateTime), otherwise the file's
// modified date, which for a photo straight off a phone is usually the same day. '' when there's nothing usable.
async function photoDate(file) {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) === 0xFFD8) for (let o = 2; o + 4 <= v.byteLength;) {
      const m = v.getUint16(o), len = v.getUint16(o + 2);
      if ((m & 0xFF00) !== 0xFF00 || m === 0xFFDA) break;
      if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) { // "Exif"
        const t = o + 10, le = v.getUint16(t) === 0x4949, u16 = x => v.getUint16(t + x, le), u32 = x => v.getUint32(t + x, le);
        const read = (ifd, want) => { const n = u16(ifd); for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === want) return u32(e + 8); } return null; };
        const text = off => { let r = ''; for (let i = 0; i < 19; i++) r += String.fromCharCode(v.getUint8(t + off + i)); return r; };
        const ifd0 = u32(4), exif = read(ifd0, 0x8769), at = (exif != null && read(exif, 0x9003)) || read(ifd0, 0x0132);
        const d = at != null && text(at).match(/^(\d{4}):(\d{2}):(\d{2})/);
        if (d && d[1] !== '0000') return `${d[1]}-${d[2]}-${d[3]}`;
        break;
      }
      o += 2 + len;
    }
  } catch (e) { /* not a readable JPEG: fall back to the file date */ }
  return file.lastModified ? localDay(file.lastModified) : '';
}
async function woreFromPhoto(file) {
  if (!isImage(file)) return toast('Only photos can be used (JPEG, PNG, WebP, HEIC).');
  closeDrawer();
  const [photo, shot] = await Promise.all([Photos.add(file), photoDate(file)]);
  // Assume it was worn the day the photo was taken (not a future date from a wrong camera clock); today can be picked instead
  const taken = isDay(shot) && shot <= today() ? shot : '', day = taken || today();
  // The stored photo is what the recogniser sees, so its size is what the pieces' boxes are measured against
  const full = await Photos.full(photo), bmp = await createImageBitmap(full);
  wore = { photo, url: URL.createObjectURL(full), W: bmp.width, H: bmp.height, pieces: [], step: -1, saved: false, styles: new Set() };
  if (bmp.close) bmp.close();
  const items = doc.items.filter(visible);
  // A large panel rather than the side drawer: the outfit stays in view (left, or pinned on top on a phone) while each
  // piece is answered in turn, then a Review step logs it
  $('#layer').innerHTML = `<div class="scrim" data-close></div><div class="drawer wore-panel" role="dialog" aria-modal="true" aria-labelledby="wTitle">
  <div class="wore-stage"><div class="wore-frame" id="wFrame"><img src="${wore.url}" alt="Your outfit photo"><i class="wore-hl" id="wHl" hidden></i></div>
    <button type="button" class="zoom-btn wore-zoom" data-zoom="${esc(photo)}" data-zoom-label="Your outfit photo" aria-label="Look closer at your outfit photo">${ZOOM_ICON}</button>
    <button type="button" class="btn sm wore-cropbtn" data-wcrop="start">✂ Mark a missed piece</button>
    <div class="wore-cropbar" id="wCropBar" hidden><span class="small">Drag around the piece it missed. Arrow keys move the box, Shift+arrows resize it.</span><span class="grow"></span><button type="button" class="btn sm" data-wcrop="cancel">Cancel</button><button type="button" class="btn sm primary" data-wcrop="use">Add this piece</button></div></div>
  <div class="wore-side" id="wSide">
    <h2 id="wTitle">What I wore</h2>
    <div class="wore-dots" id="wDots" aria-label="Steps"></div>
    <div class="wore-style" id="wStyle" role="group" aria-label="Style" hidden></div>
    <p class="small muted" id="wStatus" role="status">Finding the clothes in your photo…</p>
    <div id="wRows"></div>
    <section class="stack" id="wReview" hidden>
      <div class="form">
        <label class="field">Date worn<input type="text" name="at" id="wAt" value="${day}" inputmode="numeric"></label>
        ${taken && taken !== today() ? `<p class="small muted" style="margin:0">The day the photo was taken. <button type="button" class="btn sm" data-wore-date="${today()}">Use today instead</button></p>` : ''}
        <label class="field">Outfit name<input type="text" id="wName" placeholder="Worn ${day}"></label>
      </div>
      <ul class="wore-sum" id="wSum"></ul>
      <p class="small" style="margin:0">Something in the photo that isn’t in your closet yet? <button type="button" class="btn sm" data-wcrop="start">✂ Mark it on the photo</button></p>
      <details class="more" id="wMissed"><summary>Add something it missed</summary>
        ${items.length ? K.types.filter(t => !t.parent).map(g => [g, items.filter(it => typeGroup(it.type) === g.id)]).filter(([, l]) => l.length).map(([g, l]) => `<h4 class="shelf-h">${esc(g.name)}</h4><ul class="grid">${l.map(it => card(it, false)).join('')}</ul>`).join('') : '<p class="muted">Your closet is empty.</p>'}</details>
      <p class="small muted" style="margin:0">Nothing is logged until you press Log it. ${doc.settings.showSpicy ? '' : 'Spicy items are hidden, so they aren’t suggested.'}</p>
    </section>
    <div class="row wore-nav" id="wNav" hidden></div>
  </div><button type="button" class="x" data-close aria-label="Close">×</button></div>`;
  fillThumbs($('#layer'));
  const mine = wore, status = t => { if (wore === mine && $('#wStatus')) $('#wStatus').textContent = t; };
  Recognise.progress(list => { const d = downloadNote(list); if (d) status(d); });
  try {
    const segs = await Recognise.segment(full);
    if (wore !== mine) return;
    status(segs.length ? `Found ${segs.length} piece${segs.length > 1 ? 's' : ''}. Comparing with your closet…` : 'No clothes found.');
    const missing = await indexCloset(status);
    for (const s of segs) {
      const vec = await Recognise.embed(s.blob); if (wore !== mine) return;
      const pc = { kind: s.label, blob: s.blob, url: URL.createObjectURL(s.blob), vec, ranked: rankFor(s.label, vec), box: s.box };
      pc.answer = clearMatch(pc); mine.pieces.push(pc);
    }
    if (wore !== mine) return;
    status([segs.length ? 'Answer each piece: pick the right item, add it as a new one, or leave it out.' : 'No clothes found in this photo. Pick what you wore under “Add something it missed”.',
      missing ? `${missing} item${missing > 1 ? 's' : ''} can’t be matched in this browser yet: open the app where ${missing > 1 ? 'their photos were' : 'its photo was'} added, once, to get ${missing > 1 ? 'them' : 'it'} ready.` : ''].filter(Boolean).join(' '));
    if (!segs.length) $('#wMissed').open = true;
    woreBoxes(); woreStep(0);
  } catch (err) {
    if (wore !== mine) return;
    const msg = String(err.message || err);
    status(`Couldn’t recognise the clothes: ${/fetch|network|Failed to load/i.test(msg) ? 'the models didn’t download. Are you online?' : msg}. You can still pick what you wore below.`);
    $('#wMissed').open = true; woreStep(0);
  } finally { Recognise.progress(null); }
}
// A piece's category is the closet's own top-level type group (Tops, Bottoms, Shoes…) of the type it would start as
const kindGroup = kind => typeGroup((KINDS[kind] || {}).type) || 'accessories';
const itemLabel = it => it.name || kname('types', it.type);
// A small button that opens an item's photos close up (it sits outside the card's own button, and a label ignores clicks on it)
const ZOOM_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>';
const zoomBtn = it => { const p = coverPhoto(it); return p ? `<button type="button" class="zoom-btn" data-zoom="${esc(p.id)}" data-zoom-item="${esc(it.id)}" aria-label="Look closer at ${esc(itemLabel(it))}">${ZOOM_ICON}</button>` : ''; };
const photoTag = it => { const p = coverPhoto(it); return p ? `<img alt="" data-photo="${esc(p.id)}"${p.role === 'cutout' ? ' class="cut"' : ''}>` : '<i class="ph"></i>'; };
// One picture tile per item, a radio of the piece's group, so picking from the grid is the same as ticking a row
const tile = (i, it, score) => `<li><label class="tile"><input type="radio" name="piece${i}" value="${esc(it.id)}">${photoTag(it)}${zoomBtn(it)}<span class="nm">${esc(itemLabel(it))}</span>${score == null ? '' : `<span class="pc">${pct(score)}</span>`}</label></li>`;
// The grid behind "More …": every item this kind of piece can be (closest first), then, on request, the rest by category
function moreGrid(i) {
  const pc = wore.pieces[i], scored = new Map(pc.ranked.map(r => [r.id, r.score])), regions = (KINDS[pc.kind] || {}).regions || [];
  const same = doc.items.filter(it => offered(pc, it) && regions.includes(regionOf(it.type)))
    .sort((a, b) => (scored.has(b.id) ? scored.get(b.id) : -2) - (scored.has(a.id) ? scored.get(a.id) : -2) || itemLabel(a).localeCompare(itemLabel(b)));
  const rest = doc.items.filter(it => offered(pc, it) && !regions.includes(regionOf(it.type)));
  const shelves = K.types.filter(t => !t.parent).map(g => [g, rest.filter(it => typeGroup(it.type) === g.id)]).filter(([, l]) => l.length);
  return `${same.length ? `<ul class="tiles">${same.map(it => tile(i, it, scored.get(it.id))).join('')}</ul>` : `<p class="small muted">${styleOn() && !pc.allStyles ? 'Nothing of this kind in this style.' : 'Nothing of this kind in your closet yet.'}</p>`}
    ${shelves.length ? `<details class="more"><summary>Other categories</summary>${shelves.map(([g, l]) => `<h4 class="shelf-h">${esc(g.name)}</h4><ul class="tiles">${l.map(it => tile(i, it)).join('')}</ul>`).join('')}</details>` : ''}`;
}
// Style: the wardrobe words picked for this logging (not saved). With any picked, only items with one of them are offered
// (OR, like the closet's word filter); a piece can be shown everything again with "Show all"
const styleOn = () => !!(wore && wore.styles.size);
const inStyle = it => !styleOn() || (it.words || []).some(w => wore.styles.has(w));
const offered = (pc, it) => !!it && visible(it) && (!pc || pc.allStyles || inStyle(it));
function renderStyleBar() {
  const bar = $('#wStyle'); if (!bar || !wore) return;
  const items = doc.items.filter(visible), used = sortedWords().filter(w => items.some(it => (it.words || []).includes(w.id)));
  bar.hidden = !used.length || wore.step < 0; if (bar.hidden) return;
  const n = items.filter(inStyle).length;
  bar.innerHTML = `<span class="lbl">Style</span>${used.map(w => `<button type="button" class="chip" data-wstyle="${esc(w.id)}" aria-pressed="${wore.styles.has(w.id)}">${wordChip(w)}</button>`).join('')}${styleOn() ? `<button type="button" class="chip" data-wstyle="">Clear</button><span class="n" aria-live="polite">${n} item${n === 1 ? '' : 's'} match</span>` : ''}`;
}
// "Add something it missed": items outside the style are hidden (unless already picked), and empty shelves with them
function filterMissed() {
  const m = $('#wMissed'); if (!m || !wore) return;
  $$('li', m).forEach(li => { const b = $('[data-item]', li); if (b) li.hidden = !(inStyle(itemById(b.dataset.item)) || b.getAttribute('aria-pressed') === 'true'); });
  $$('.shelf-h', m).forEach(h => { const ul = h.nextElementSibling; h.hidden = !!ul && $$('li', ul).every(li => li.hidden); if (ul) ul.hidden = h.hidden; });
}
// The item a piece clearly is (well ahead of the next one), which starts out picked; null when it isn't clear
const clearMatch = pc => { const [a, b] = pc.ranked; return a && a.score >= MATCH.clear && (!b || a.score - b.score >= MATCH.margin) ? a.id : null; };
const pieceCat = pc => kname('types', kindGroup(pc.kind));
// A piece's box on the photo, in percent of the photo, so it lines up at any size
const boxPos = ([x, y, w, h]) => ({ left: `${x / wore.W * 100}%`, top: `${y / wore.H * 100}%`, width: `${w / wore.W * 100}%`, height: `${h / wore.H * 100}%` });
// Mark a missed piece: draw a box on the photo (or move one with the keys); its crop is recognised and ranked like a
// found piece, then answered the same way (a match, a new placeholder item with followUp, or left out)
const WoreCrop = (() => {
  let box = null, drag = null; // box in photo pixels [x, y, w, h]
  const frame = () => $('#wFrame'), el = () => $('#wCropBox');
  const clampBox = ([x, y, w, h]) => { w = Math.max(8, Math.min(wore.W, w)); h = Math.max(8, Math.min(wore.H, h)); return [Math.max(0, Math.min(wore.W - w, x)), Math.max(0, Math.min(wore.H - h, y)), w, h]; };
  const draw = () => { const b = el(); if (b && box) Object.assign(b.style, boxPos(box)); };
  function start() {
    const f = frame(); if (!f || !wore) return;
    box = clampBox([wore.W * 0.3, wore.H * 0.35, wore.W * 0.4, wore.H * 0.3]);
    f.classList.add('cropping'); $('#wHl').hidden = true;
    if (!el()) f.insertAdjacentHTML('beforeend', '<i class="wore-crop" id="wCropBox" tabindex="0" role="img" aria-label="The box around the missed piece. Arrow keys move it, Shift and arrow keys resize it."></i>');
    draw(); $('#wCropBar').hidden = false; $('.wore-cropbtn').hidden = true; el().focus({ preventScroll: true });
  }
  function stop() {
    const f = frame(); box = null; drag = null; if (!f) return;
    f.classList.remove('cropping'); if (el()) el().remove();
    $('#wCropBar').hidden = true; $('.wore-cropbtn').hidden = false;
    if (wore && wore.pieces[wore.step]) woreStep(wore.step);
  }
  // A kind to start from, by where the box sits on the body; it can be changed on the piece's step
  const guessKind = ([, y, , h]) => { const c = (y + h / 2) / wore.H; return c < 0.14 ? 'hat' : c < 0.46 ? 'top' : c < 0.8 ? 'pants' : 'shoes'; };
  async function use() {
    if (!box || !wore) return;
    const mine = wore, b = box.map(Math.round), kind = guessKind(b); stop();
    const img = new Image(); img.src = mine.url; await img.decode();
    const c = document.createElement('canvas'); c.width = b[2]; c.height = b[3];
    c.getContext('2d').drawImage(img, b[0], b[1], b[2], b[3], 0, 0, b[2], b[3]);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    if (wore !== mine || !blob) return;
    toast('Comparing it with your closet…', 1500);
    let vec = null; try { vec = await Recognise.embed(blob); } catch (err) { toast('Couldn’t compare it with your closet here. You can still pick a match or add it as new.', 4000); }
    if (wore !== mine) return;
    const pc = { kind, blob, url: URL.createObjectURL(blob), vec, ranked: rankFor(kind, vec), box: b, manual: true };
    pc.answer = null; mine.pieces.push(pc);
    woreBoxes(); woreStep(mine.pieces.length - 1);
  }
  const at = e => { const r = frame().getBoundingClientRect(); return [(e.clientX - r.left) / r.width * wore.W, (e.clientY - r.top) / r.height * wore.H]; };
  document.addEventListener('pointerdown', e => {
    const f = frame(); if (!box || !f || !f.contains(e.target)) return;
    e.preventDefault(); const [x, y] = at(e);
    const inside = e.target === el();
    drag = inside ? { move: true, x, y, b0: [...box] } : { move: false, x, y };
    if (!inside) { box = clampBox([x, y, 8, 8]); draw(); }
    try { f.setPointerCapture(e.pointerId); } catch (err) { /* released */ }
  });
  document.addEventListener('pointermove', e => {
    if (!drag || !box || !frame()) return;
    const [x, y] = at(e);
    if (drag.move) box = clampBox([drag.b0[0] + x - drag.x, drag.b0[1] + y - drag.y, drag.b0[2], drag.b0[3]]);
    else { const x0 = Math.max(0, Math.min(drag.x, x)), y0 = Math.max(0, Math.min(drag.y, y)); box = clampBox([x0, y0, Math.abs(x - drag.x), Math.abs(y - drag.y)]); }
    draw();
  });
  const end = () => { if (drag) { drag = null; if (el()) el().focus({ preventScroll: true }); } };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  function key(e) {
    if (!box || !wore || !frame()) { box = null; drag = null; return false; }
    if (e.key === 'Escape') { e.preventDefault(); stop(); return true; }
    if (e.key === 'Enter' && e.target === el()) { e.preventDefault(); use(); return true; }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || e.target !== el()) return false;
    e.preventDefault(); const sx = wore.W * 0.02, sy = wore.H * 0.02;
    box = e.shiftKey ? clampBox([box[0], box[1], box[2] + d[0] * sx, box[3] + d[1] * sy]) : clampBox([box[0] + d[0] * sx, box[1] + d[1] * sy, box[2], box[3]]);
    draw(); return true;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-wcrop]'); if (!b || !wore) return;
    const v = b.dataset.wcrop; if (v === 'start') start(); else if (v === 'cancel') stop(); else if (v === 'use') use();
  });
  return { key, stop, get on() { return !!box; } };
})();
// Faint outlines of the other pieces on the photo; tapping one goes to its step
function woreBoxes() {
  const f = $('#wFrame'); if (!f || !wore) return;
  $$('.wore-box', f).forEach(b => b.remove());
  wore.pieces.forEach((pc, i) => {
    if (!pc.box) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'wore-box'; b.dataset.wstep = i;
    b.setAttribute('aria-label', `Go to piece ${i + 1}, ${pieceCat(pc)}`); b.classList.toggle('on', i !== wore.step);
    Object.assign(b.style, boxPos(pc.box)); f.append(b);
  });
}
function renderDots() {
  const w = wore, d = $('#wDots'); if (!w || !d) return;
  const n = w.pieces.length;
  d.innerHTML = w.pieces.map((pc, i) => `<button type="button" class="wdot${pc.answer != null ? ' done' : ''}" data-wstep="${i}"${i === w.step ? ' aria-current="step"' : ''} aria-label="Piece ${i + 1}, ${esc(pieceCat(pc))}${pc.answer != null ? ', answered' : ''}"><b>${pc.answer != null ? '✓' : i + 1}</b> ${esc(pieceCat(pc))}</button>`).join('')
    + (n ? `<button type="button" class="wdot" data-wstep="${n}"${w.step === n ? ' aria-current="step"' : ''}>Review</button>` : '');
}
// Show step n: a piece (0 … pieces-1) or the Review (= pieces.length)
function woreStep(n) {
  const w = wore; if (!w || !$('#wRows')) return;
  const last = w.pieces.length; n = Math.max(0, Math.min(last, n)); w.step = n;
  const pc = w.pieces[n], hl = $('#wHl');
  if (pc && pc.box) { hl.hidden = false; Object.assign(hl.style, boxPos(pc.box)); } else hl.hidden = true;
  $$('#wFrame .wore-box').forEach(b => b.classList.toggle('on', +b.dataset.wstep !== n));
  $('#wReview').hidden = !!pc;
  renderPieces(); renderDots(); renderStyleBar(); filterMissed();
  if (!pc) renderSummary();
  const nav = $('#wNav'); nav.hidden = false;
  nav.innerHTML = `<button type="button" class="btn" data-wnav="-1"${n === 0 ? ' disabled' : ''}>Back</button><span class="grow"></span><button type="button" class="btn" data-close>Cancel</button>${pc ? `<button type="button" class="btn primary" data-wnav="1">${n === last - 1 ? 'Review' : 'Next'}</button>` : '<button type="button" class="btn primary" data-act="wore-save">Log it</button>'}`;
  $('#wSide').scrollTop = 0;
}
// Back and Next; Next needs the piece answered first
function woreGo(delta) {
  const w = wore; if (!w || w.step < 0) return;
  const pc = w.pieces[w.step];
  if (delta > 0 && pc && pc.answer == null) return toast(`${(KINDS[pc.kind] || {}).name || 'This piece'}: pick a match, add it as new, or leave it out`);
  if (w.step + delta >= 0 && w.step + delta <= w.pieces.length) woreStep(w.step + delta);
}
// Review: each piece's answer, tap to go back to it
function renderSummary() {
  const s = $('#wSum'); if (!s || !wore) return;
  s.innerHTML = wore.pieces.map((pc, i) => {
    const a = pc.answer, it = a && a !== 'new' && a !== 'skip' ? itemById(a) : null;
    const pic = it ? photoTag(it) : a === 'new' ? `<img alt="" src="${pc.url}" class="cut">` : '<i class="ph"></i>';
    const what = it ? esc(itemLabel(it)) : a === 'new' ? 'New item' : a === 'skip' ? '<span class="muted">Left out</span>' : '<span class="warn">Not answered yet</span>';
    return `<li><button type="button" class="opt wore-sumrow" data-wstep="${i}">${pic}<span class="nm"><span class="small muted">${esc(pieceCat(pc))}</span><br>${what}${pc.manual ? ' <span class="small muted">· marked by you</span>' : ''}</span><span class="pc">Change</span></button></li>`;
  }).join('') + (styleOn() ? `<li class="small muted" style="padding:6px 0">Saved on the outfit as: ${[...wore.styles].map(wordById).filter(Boolean).map(wordChip).join(' ')}</li>` : '');
  fillThumbs(s);
}
// The current piece's step: its category and kind, its crop, the closest items, the picture grid, new or leave out
function renderPieces() {
  const rows = $('#wRows'); if (!rows || !wore) return;
  const i = wore.step, pc = wore.pieces[i];
  if (!pc) { rows.innerHTML = ''; return; }
  // Ranked within the style (if one is picked); the answer stays listed even when it's outside it
  const inside = pc.ranked.filter(r => offered(pc, itemById(r.id))), top = inside.slice(0, MATCH.shown), [a] = inside, g = kindGroup(pc.kind);
  const clear = clearMatch({ ranked: inside }) != null, picked = pc.answer && !['new', 'skip'].includes(pc.answer) && !top.some(r => r.id === pc.answer) ? pc.ranked.find(r => r.id === pc.answer) || { id: pc.answer, score: null } : null;
  const many = doc.items.filter(it => offered(pc, it) && ((KINDS[pc.kind] || {}).regions || []).includes(regionOf(it.type))).length;
  const none = styleOn() && !pc.allStyles && !inside.length;
  const on = v => pc.answer === v ? ' checked' : '';
  const opt = r => { const it = itemById(r.id); if (!it) return ''; return `<label class="opt"><input type="radio" name="piece${i}" value="${esc(r.id)}"${on(r.id)}>${photoTag(it)}<span class="nm">${esc(itemLabel(it))}${it.followUp ? ' <span class="follow-tag">· placeholder</span>' : ''}${styleOn() && !offered(pc, it) ? ' <span class="out-style">· outside this style</span>' : ''}</span><span class="pc">${r.score == null ? '' : pct(r.score)}</span>${zoomBtn(it)}</label>`; };
  rows.innerHTML = `<fieldset class="piece" data-piece="${i}"><legend>Piece ${i + 1} of ${wore.pieces.length} · <span class="cat">${esc(kname('types', g))}</span></legend>
      <div class="row small" style="margin:0 0 6px;gap:6px"><label class="sr-only" for="kind${i}">What this piece is</label><select id="kind${i}" data-kind="${i}">${Object.entries(KINDS).map(([id, k]) => `<option value="${id}"${id === pc.kind ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
        <span class="${clear ? '' : 'muted'}">${clear ? `Looks like <b>${esc(itemLabel(itemById(a.id)))}</b>.` : none ? `Nothing in this style for this piece. <button type="button" class="btn sm" data-wall="${i}">Show all</button>` : top.length ? 'No single clear match. The closest:' : 'Nothing to compare it with yet.'}${styleOn() && pc.allStyles ? ` <button type="button" class="btn sm" data-wall="${i}">Only this style</button>` : ''}</span></div>
      <div class="piece-body"><img alt="This piece, cut from your photo" src="${pc.url}" class="crop zoomable">
      <div class="opts">${picked ? opt(picked) : ''}${top.map(opt).join('')}
        ${doc.items.some(it => offered(pc, it)) ? `<details class="more" data-more="${i}"${pc.moreOpen ? ' open' : ''}><summary>More ${esc(kname('types', g).toLowerCase())}${many ? ` (${many})` : ''}, with pictures</summary><div class="grid-slot">${pc.moreOpen ? moreGrid(i) : ''}</div></details>` : ''}
        <label class="opt"><input type="radio" name="piece${i}" value="new"${on('new')}><span class="nm">Add as a new item <span class="small muted">· from this photo, marked to add a clean photo later</span></span></label>
        <label class="opt"><input type="radio" name="piece${i}" value="skip"${on('skip')}><span class="nm muted">Leave it out</span></label>
      </div></div></fieldset>`;
  checkAnswer(i);
  fillThumbs(rows);
}
// Tick the piece's answer wherever it appears (a ranked row or a tile in the grid)
function checkAnswer(i) { const v = wore.pieces[i].answer; if (v == null) return; const r = $$(`#layer input[name="piece${i}"]`).find(x => x.value === v); if (r) r.checked = true; }
// A piece whose kind changes is ranked again and starts over
function setPieceKind(i, kind) {
  const pc = wore.pieces[i]; pc.kind = kind; pc.ranked = rankFor(kind, pc.vec); pc.answer = clearMatch(pc); pc.moreOpen = false;
  renderPieces(); renderDots(); woreBoxes();
}
// The answer lives on the piece, so it survives moving between steps
document.addEventListener('change', e => {
  const m = wore && /^piece(\d+)$/.exec(e.target.name || ''); if (!m) return;
  wore.pieces[+m[1]].answer = e.target.value; checkAnswer(+m[1]); renderDots();
});
document.addEventListener('click', e => {
  if (!wore || Zoom.isOpen) return;
  const st = e.target.closest('[data-wstyle]');
  if (st) { const id = st.dataset.wstyle; if (!id) wore.styles.clear(); else if (!wore.styles.delete(id)) wore.styles.add(id); renderStyleBar(); renderPieces(); filterMissed(); return; }
  const all = e.target.closest('[data-wall]'); if (all) { const pc = wore.pieces[+all.dataset.wall]; pc.allStyles = !pc.allStyles; return renderPieces(); }
  const s = e.target.closest('[data-wstep]'); if (s) return woreStep(+s.dataset.wstep);
  const n = e.target.closest('[data-wnav]'); if (n) return woreGo(+n.dataset.wnav);
});
// The picture grid is drawn the first time it's opened, so a big closet doesn't load hundreds of thumbnails up front
document.addEventListener('toggle', e => {
  const d = e.target; if (!d.matches) return;
  if (d.open && d.closest('.grid-slot')) return fillThumbs(d); // "Other categories" inside the grid
  if (!d.matches('[data-more]') || !wore) return;
  const i = +d.dataset.more; if (wore.pieces[i]) wore.pieces[i].moreOpen = d.open;
  const slot = $('.grid-slot', d); if (!d.open || slot.innerHTML) return;
  slot.innerHTML = moreGrid(i); fillThumbs(slot); checkAnswer(i);
}, true);
async function saveWore() {
  const w = wore; if (!w || w.saved) return;
  const at = ($('#wAt').value || '').trim();
  if (!isDay(at)) return toast('Write the date as YYYY-MM-DD');
  const chosen = new Set(), make = [], learn = [];
  for (const [i, pc] of w.pieces.entries()) {
    const id = pc.answer;
    if (id == null) { woreStep(i); return toast(`${(KINDS[pc.kind] || {}).name || 'A piece'}: pick a match, add it as new, or leave it out`); }
    if (id === 'skip') continue;
    if (id === 'new') { make.push(pc); continue; }
    chosen.add(id); if (pc.vec) learn.push([id, pc.vec]);
  }
  $$('#wMissed [data-item][aria-pressed="true"]').forEach(b => chosen.add(b.dataset.item));
  if (!chosen.size && !make.length) return toast('Pick at least one item');
  w.saved = true;
  // New items from the photo: the crop is their photo until a clean one is added (followUp), with a type and colours to start
  for (const pc of make) {
    const k = KINDS[pc.kind] || {}, type = K.byId.types.has(k.type) ? k.type : newItem().type;
    const photo = { id: await Photos.add(new File([pc.blob], 'crop.png', { type: 'image/png' })), role: 'crop', ...(pc.vec ? { vec: packVec(pc.vec) } : {}) };
    const it = { id: uid(), added: now(), name: `${k.name || kname('types', type)}, worn ${at}`, type, colours: await guessColours(pc.blob).catch(() => []), photos: [photo], followUp: true };
    put('items', it); chosen.add(it.id);
  }
  // Each confirmed match remembers what it looked like worn, so it's easier to recognise next time
  for (const [id, vec] of learn) { const it = itemById(id); if (it) put('items', { ...it, seen: [packVec(vec), ...(it.seen || [])].slice(0, MATCH.seen) }); }
  const ids = [...chosen], same = doc.outfits.find(o => (o.items || []).length === ids.length && ids.every(id => o.items.includes(id)));
  const worn = { id: w.photo, role: 'worn' }, styles = [...w.styles].filter(wordById);
  let outfit;
  if (same) { outfit = same.id; put('outfits', { ...same, photos: [...(same.photos || []), worn], ...(styles.length ? { words: [...new Set([...(same.words || []), ...styles])] } : {}) }); }
  else { outfit = uid(); put('outfits', { id: outfit, name: ($('#wName').value || '').trim() || `Worn ${at}`, items: ids, photos: [worn], source: 'photo', ...(styles.length ? { words: styles } : {}) }); }
  put('wears', { id: uid(), at, outfit, source: 'photo', photo: w.photo });
  closeDrawer(); tab = 'worn'; lsSet(TAB_KEY, tab); render();
  toast(`Logged ${ids.length} item${ids.length > 1 ? 's' : ''} for ${at}${make.length ? `. ${make.length} new item${make.length > 1 ? 's' : ''} need${make.length > 1 ? '' : 's'} a clean photo (Closet › Needs a clean photo)` : ''}`, 5000);
}
