'use strict';
/* ---------- Arrange an outfit's figure ---------- */
// In the outfit view: drag pieces to move them, the corner handle (or a pinch) to resize, Bring forward / Send back (or
// [ and ]) to restack, arrows and + / - from the keyboard. The layout is saved on the outfit when a gesture ends, as
// percentages of the figure (outfit.layout = { itemId: { x, y, w, z } }), so the list thumbnail matches.
const Arrange = (() => {
  let fig = null, oid = null, lay = null, sel = null, act = null, pinch = null, timer = 0;
  const pts = new Map();
  const live = () => !!(fig && fig.isConnected);
  const el = id => fig.querySelector(`[data-lay-item="${CSS.escape(id)}"]`);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = v => Math.round(v * 10) / 10;
  function place(id) {
    const e = lay[id], p = el(id); if (!e || !p) return;
    p.classList.add('lay'); Object.assign(p.style, { left: `${e.x}%`, top: `${e.y}%`, width: `${e.w}%`, height: '', zIndex: e.z });
  }
  function select(id) {
    sel = id; $$('[data-lay-item]', fig).forEach(p => p.classList.toggle('sel', p.dataset.layItem === id));
    const p = el(id); if (p && !$('.fig-handle', p)) p.insertAdjacentHTML('beforeend', '<i class="fig-handle" data-handle aria-hidden="true"></i>');
  }
  function save() {
    clearTimeout(timer); if (!live()) return;
    const cur = doc.outfits.find(x => x.id === oid); if (!cur) return;
    const items = cur.items || [], shown = new Set(Object.keys(lay));
    // Keep what's saved for items not on show (hidden spicy ones); drop items no longer in the outfit
    const keep = Object.fromEntries(Object.entries(cur.layout || {}).filter(([id]) => items.includes(id) && !shown.has(id)));
    const mine = Object.fromEntries(Object.entries(lay).filter(([id]) => items.includes(id)).map(([id, e]) => [id, { x: r1(e.x), y: r1(e.y), w: r1(e.w), z: e.z }]));
    const next = { ...keep, ...mine }; if (JSON.stringify(next) === JSON.stringify(cur.layout || {})) return; // nothing moved
    put('outfits', { ...cur, layout: next }); render();
  }
  const saveSoon = () => { clearTimeout(timer); timer = setTimeout(save, 400); };
  function start(figEl, outfitId) {
    fig = figEl; oid = outfitId; lay = {}; const o = doc.outfits.find(x => x.id === oid) || {}, fr = fig.getBoundingClientRect();
    $$('[data-lay-item]', fig).forEach((p, i) => {
      const id = p.dataset.layItem, st = (o.layout || {})[id];
      if (st) { lay[id] = { x: +st.x || 0, y: +st.y || 0, w: +st.w || 20, z: +st.z || i + 1 }; return; }
      // From the automatic layout: the picture's own rectangle inside its box, so nothing jumps when arranging starts
      let r = p.getBoundingClientRect(); const img = $('img', p);
      if (img && img.naturalWidth) { const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s; r = { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w }; }
      else { const w = Math.min(r.width, r.height * 3 / 4); r = { left: r.left + (r.width - w) / 2, top: r.top, width: w }; }
      lay[id] = { x: (r.left - fr.left) / fr.width * 100, y: (r.top - fr.top) / fr.height * 100, w: r.width / fr.width * 100, z: +p.style.zIndex || i + 1 };
    });
    Object.keys(lay).forEach(place); fig.classList.add('arranging');
    $$('[data-lay-item]', fig).forEach(p => { p.tabIndex = 0; p.setAttribute('role', 'button'); p.setAttribute('aria-label', `${itemLabel(itemById(p.dataset.layItem) || {})}: drag to move; arrow keys move, + and − resize, [ and ] restack`); });
    const first = Object.keys(lay).sort((a, b) => lay[b].z - lay[a].z)[0]; if (first) select(first);
  }
  function stop() {
    clearTimeout(timer); if (live()) { save(); fig.classList.remove('arranging'); $$('.fig-handle', fig).forEach(h => h.remove()); $$('[data-lay-item]', fig).forEach(p => { p.classList.remove('sel'); p.setAttribute('aria-label', `Edit ${itemLabel(itemById(p.dataset.layItem) || {})}`); }); }
    fig = null; sel = null; act = null; pinch = null; pts.clear();
  }
  function restack(delta) {
    if (!live() || !sel) return;
    const ids = Object.keys(lay).sort((a, b) => lay[a].z - lay[b].z), i = ids.indexOf(sel), j = clamp(i + delta, 0, ids.length - 1);
    ids.splice(i, 1); ids.splice(j, 0, sel); ids.forEach((id, k) => { lay[id].z = k + 1; place(id); }); save();
  }
  function reset() {
    const cur = doc.outfits.find(x => x.id === oid); stop(); if (!cur) return;
    // Hidden spicy items keep their saved place; everything on show goes back to the automatic layout
    const keep = Object.fromEntries(Object.entries(cur.layout || {}).filter(([id]) => { const it = itemById(id); return it && !visible(it) && (cur.items || []).includes(id); }));
    const { layout, ...rest } = cur; put('outfits', Object.keys(keep).length ? { ...rest, layout: keep } : rest); render(); refreshOutfitView();
  }
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  document.addEventListener('pointerdown', e => {
    if (!live() || !fig.contains(e.target)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && sel) { pinch = { d: dist(), w: lay[sel].w }; act = null; return; }
    const p = e.target.closest('[data-lay-item]'); if (!p) return;
    e.preventDefault(); select(p.dataset.layItem); p.focus({ preventScroll: true });
    try { fig.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
    const fr = fig.getBoundingClientRect();
    act = { id: sel, size: !!e.target.closest('[data-handle]'), x0: e.clientX, y0: e.clientY, e0: { ...lay[sel] }, fw: fr.width, fh: fr.height, moved: false };
  });
  document.addEventListener('pointermove', e => {
    if (!live() || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) { lay[sel].w = clamp(pinch.w * dist() / pinch.d, 6, 100); place(sel); pinch.moved = true; return; }
    if (!act) return;
    const dx = (e.clientX - act.x0) / act.fw * 100, dy = (e.clientY - act.y0) / act.fh * 100, l = lay[act.id];
    if (Math.abs(dx) + Math.abs(dy) > 0.3) act.moved = true;
    if (act.size) l.w = clamp(act.e0.w + dx, 6, 100);
    else { l.x = clamp(act.e0.x + dx, -l.w / 2, 100 - l.w / 2); l.y = clamp(act.e0.y + dy, -10, 95); }
    place(act.id);
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (!live()) return;
    if ((act && act.moved) || (pinch && pinch.moved)) save();
    act = null; if (pts.size < 2) pinch = null;
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  // Keys on a focused piece
  function key(e) {
    if (!live() || !e.target.closest || !e.target.closest('[data-lay-item]') || !fig.contains(e.target)) return false;
    const id = e.target.dataset.layItem, l = lay[id], step = e.shiftKey ? 5 : 1; select(id);
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { l.x = clamp(l.x + moves[e.key][0], -l.w / 2, 100 - l.w / 2); l.y = clamp(l.y + moves[e.key][1], -10, 95); }
    else if (e.key === '+' || e.key === '=') l.w = clamp(l.w + 3, 6, 100);
    else if (e.key === '-' || e.key === '_') l.w = clamp(l.w - 3, 6, 100);
    else if (e.key === '[') { e.preventDefault(); restack(-1); return true; }
    else if (e.key === ']') { e.preventDefault(); restack(1); return true; }
    else return false;
    e.preventDefault(); place(id); saveSoon(); return true;
  }
  return { start, stop, restack, reset, key, get on() { return live(); } };
})();
const figToolsHtml = arranging => arranging
  ? `<button type="button" class="btn sm" data-arr="1">Bring forward</button><button type="button" class="btn sm" data-arr="-1">Send back</button><button type="button" class="btn sm" data-arr="reset">Reset layout</button><span class="grow"></span><button type="button" class="btn sm primary" data-arr="done">Done</button>
     <p class="small muted" style="margin:0;flex-basis:100%">Drag a piece to move it, its corner to resize (or pinch). Keys: arrows move, + and − resize, [ and ] restack.</p>`
  : `<button type="button" class="btn sm" data-arr="start">Arrange</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-arr]'); if (!b) return;
  const v = b.dataset.arr, tools = $('#figTools'), fig = $('#layer .fig-lg'), view = $('#layer [data-view-outfit]');
  if (v === 'start' && fig && view) { Arrange.start(fig, view.dataset.viewOutfit); tools.innerHTML = figToolsHtml(true); }
  else if (v === 'done') { Arrange.stop(); tools.innerHTML = figToolsHtml(false); }
  else if (v === 'reset') Arrange.reset();
  else Arrange.restack(+v);
});
// Draw the open outfit view again after something in it changed (a wear removed, a photo added)
