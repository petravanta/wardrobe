'use strict';
/* ---------- Close-up ---------- */
// Any item photo opens full size over everything else: tap or click to zoom in at that spot (again to zoom out), drag or
// scroll to look around, arrows for the item's other photos (and on to the next item, from the closet), and Esc, × or a tap beside the photo to close
const Zoom = (() => {
  let el = null, set = [], at = 0, label = '', back = null, own = '', drag = null, seq = 0, layer = null, items = null;
  const q = s => el.querySelector(s);
  async function show() {
    const view = q('.zoom-view'), img = q('img'), p = set[at], n = ++seq;
    view.classList.remove('big'); img.style.width = ''; img.classList.toggle('cut', !!p.cut);
    if (own) { URL.revokeObjectURL(own); own = ''; }
    let u = p.src || '';
    let rec = null;
    if (!u) { let b = await Photos.full(p.id); if (!b && regenerable(rec = photoRec(p.id)) && await regenCrop(rec).catch(() => false)) b = await Photos.full(p.id);
      if (b) u = own = URL.createObjectURL(b); else u = await Photos.thumb(p.id) || GPhotos.direct(p.id) || ''; }
    img.style.objectViewBox = '';
    if (!u && regenerable(rec) && GPhotos.direct(rec.from)) { u = GPhotos.direct(rec.from); cropView(img, rec); }
    if (n !== seq || !el) { if (u && u === own && !el) URL.revokeObjectURL(u); return; }
    img.src = u; img.alt = label || 'Photo';
    q('.zoom-cap').textContent = [label, set.length > 1 ? `${at + 1} / ${set.length}` : ''].filter(Boolean).join(' · ');
    q('[data-zstep="-1"]').hidden = q('[data-zstep="1"]').hidden = set.length < 2;
    const ia = items ? items.ids.indexOf(items.id) : -1;
    q('[data-zitem="-1"]').hidden = q('[data-zitem="1"]').hidden = !items || items.ids.length < 2;
    if (items) { const has = i => items.ids.slice(Math.max(0, i)).some(id => { const r = items.load(id); return r && r.photos.length; }), before = items.ids.slice(0, Math.max(0, ia)).some(id => { const r = items.load(id); return r && r.photos.length; });
      q('[data-zitem="-1"]').disabled = !before; q('[data-zitem="1"]').disabled = !has(ia + 1); q('.zoom-cap').textContent += ` · item ${ia + 1} of ${items.ids.length}`; }
  }
  // Next and back through the closet's items (items: {ids, id, load: id => {photos, name}}), starting on each one's cover
  function itemStep(delta, last = false) {
    if (!items) return; // items without photos are passed over
    for (let i = items.ids.indexOf(items.id) + delta; i >= 0 && i < items.ids.length; i += delta) {
      const r = items.load(items.ids[i]); if (!r || !r.photos.length) continue;
      items.id = items.ids[i]; set = r.photos; at = last ? set.length - 1 : Math.max(0, r.start); label = r.name; return show();
    }
    toast(delta > 0 ? 'No more items with photos after this one' : 'No items with photos before this one');
  }
  function toggle(e) {
    const view = q('.zoom-view'), img = q('img');
    if (view.classList.contains('big')) { view.classList.remove('big'); img.style.width = ''; return; }
    const r = img.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const w = Math.max(img.naturalWidth || 0, r.width * 2.5);
    view.classList.add('big'); img.style.width = w + 'px';
    const h = img.getBoundingClientRect().height;
    view.scrollLeft = fx * w - view.clientWidth / 2; view.scrollTop = fy * h - view.clientHeight / 2;
  }
  const move = e => { if (!drag || !el) return; const v = q('.zoom-view'), dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; v.scrollLeft = drag.l - dx; v.scrollTop = drag.t - dy; };
  const up = () => setTimeout(() => { drag = null; });
  // byHistory: closed by the browser's Back, so its history entry is already gone; otherwise take back the one open() added
  function close(byHistory = false) {
    if (!el) return; if (own) URL.revokeObjectURL(own); own = ''; el.remove(); el = null; seq++;
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    const l = layer; layer = null; if (l && !byHistory) l.close();
    if (back && back.isConnected) back.focus(); back = null;
  }
  function open(photos, start = 0, name = '', from = null, nav = null) {
    if (!photos.length || el) return;
    set = photos; at = Math.min(Math.max(0, start), photos.length - 1); label = name; back = from; items = nav;
    el = document.createElement('div'); el.className = 'zoom'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Photo close-up');
    el.innerHTML = `<button type="button" class="zoom-x" data-zclose><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>Close</button><div class="zoom-view"><img alt="" draggable="false"></div><div class="zoom-bar"><span class="zoom-cap"></span><span class="zoom-hint"><span class="fine">Tap outside or press Esc to close</span><span class="touch">Tap outside to close</span></span><button type="button" data-zstep="-1" aria-label="Previous photo">‹</button><button type="button" data-zstep="1" aria-label="Next photo">›</button><button type="button" class="zitem" data-zitem="-1" aria-label="Previous item" hidden>‹ Item</button><button type="button" class="zitem" data-zitem="1" aria-label="Next item" hidden>Item ›</button></div>`;
    document.body.append(el);
    // The phone's Back gesture closes the close-up instead of leaving the app
    layer = typeof BackStack !== 'undefined' ? BackStack.push(why => { if (why !== 'close') { layer = null; close(true); } }) : null;
    const view = q('.zoom-view'), img = q('img');
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (e.target.closest('[data-zclose]')) return close();
      const s = e.target.closest('[data-zstep]'); if (s) { at = (at + +s.dataset.zstep + set.length) % set.length; return show(); }
      const zi = e.target.closest('[data-zitem]'); if (zi) return itemStep(+zi.dataset.zitem);
      if (e.target === img) { if (drag && drag.moved) return; return toggle(e); }
      if (e.target === view) close();
    });
    // A mouse drags the zoomed photo around; touch scrolls it natively
    img.addEventListener('pointerdown', e => { drag = e.pointerType === 'mouse' && view.classList.contains('big') ? { x: e.clientX, y: e.clientY, l: view.scrollLeft, t: view.scrollTop, moved: false } : null; });
    addEventListener('pointermove', move); addEventListener('pointerup', up);
    show(); q('[data-zclose]').focus();
  }
  // Keys while it's open: Esc closes it (not the drawer behind), ← → step through photos and then items, ↑ ↓ through
  // items, Tab stays inside
  function key(e) {
    if (!el) return false;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Through the item's photos; from the closet, past its first or last photo on to the item before or after
      const d = e.key === 'ArrowRight' ? 1 : -1;
      if (items && (at + d < 0 || at + d >= set.length)) { e.preventDefault(); itemStep(d, d < 0); }
      else if (set.length > 1) { at = (at + d + set.length) % set.length; show(); }
    }
    else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown') && items) { e.preventDefault(); itemStep(e.key === 'ArrowDown' || e.key === 'PageDown' ? 1 : -1); }
    else if (e.key === 'Tab') { const b = [...el.querySelectorAll('button:not([hidden])')], i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus(); }
    return true;
  }
  return { open, close, key, get isOpen() { return !!el; } };
})();
// The magnifier on a card, tile or row opens that item's photos; a photo marked zoomable opens itself (and its neighbours)
document.addEventListener('click', e => {
  if (Zoom.isOpen) return;
  const b = e.target.closest('[data-zoom]'), im = !b && e.target.closest('img.zoomable');
  if (!b && !im) return;
  e.preventDefault(); e.stopPropagation();
  if (b) {
    const it = itemById(b.dataset.zoomItem), wo = b.dataset.zoomOutfit && doc.outfits.find(x => x.id === b.dataset.zoomOutfit), wp = wo ? (wo.photos || []).filter(p => p.role === 'worn') : [];
    const ps = it && (it.photos || []).length ? it.photos : wp.some(p => p.id === b.dataset.zoom) ? wp : [{ id: b.dataset.zoom }];
    // From a closet card, the close-up also steps through the closet's items
    const nav = it && b.closest('#main') && tab === 'closet' ? { ids: closetOrder(), id: it.id, load: id => { const x = itemById(id), xs = (x && x.photos) || [], c = x && coverPhoto(x); return x && { photos: xs.map(p => ({ id: p.id, cut: p.role === 'cutout' })), start: c ? xs.indexOf(c) : 0, name: itemLabel(x) }; } } : null;
    return Zoom.open(ps.map(p => ({ id: p.id, cut: p.role === 'cutout' })), ps.findIndex(p => p.id === b.dataset.zoom), it ? itemLabel(it) : (b.dataset.zoomLabel || ''), b, nav);
  }
  const scope = im.closest('.thumbs, .wear-hist'), imgs = scope ? $$('img.zoomable', scope) : [im];
  const name = editing ? itemLabel(editing) : (scope && scope.dataset.label) || im.alt;
  Zoom.open(imgs.map(x => x.dataset.photo ? { id: x.dataset.photo, cut: x.classList.contains('cut') } : { src: x.src }), imgs.indexOf(im), name, im);
}, true);
