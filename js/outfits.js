'use strict';
/* ---------- Outfit figure ---------- */
// An outfit laid out roughly as worn, by each item's region (data/types.json): where each band sits, in percent of a
// 3:4 box [left, top, width, height]. Regions not listed here (bag, belt, accessory, other…) go in the side column.
const FIG_BANDS = { hat: [34, 1, 30, 11], top: [6, 12, 70, 36], scarf: [28, 11, 34, 22], dress: [14, 12, 56, 62], bottom: [14, 45, 56, 38], shoes: [14, 82, 56, 17] };
const FIG_REGION = { hat: 'hat', top: 'top', scarf: 'scarf', dress: 'dress', bottom: 'bottom', skirt: 'bottom', shoes: 'shoes' };
const FIG_SIDE = [78, 6, 20, 88];
// In the top band, outer layers go behind (left)
const figLayer = it => (typeGroup(it.type) === 'outerwear' ? 0 : 1);
function outfitFigure(o, size = 'lg') {
  const items = (o.items || []).map(itemById).filter(it => it && visible(it));
  const bands = new Map(), side = [];
  for (const it of items) { const b = FIG_REGION[regionOf(it.type)]; if (b) (bands.get(b) || bands.set(b, []).get(b)).push(it); else side.push(it); }
  // A piece placed by hand (outfit.layout, from Arrange) keeps its place and stacking; the rest go by region
  const L = o.layout || {}, num = (v, d) => (Number.isFinite(+v) ? +v : d);
  const edit = size === 'lg' ? it => ` tabindex="0" role="button" aria-label="Edit ${esc(itemLabel(it))}" title="Double-click to edit ${esc(itemLabel(it))}"` : () => '';
  const piece = (it, [l, t, w, h], z) => { const p = coverPhoto(it), st = L[it.id];
    const style = st ? `left:${num(st.x, l)}%;top:${num(st.y, t)}%;width:${num(st.w, w)}%;z-index:${num(st.z, z)}` : `left:${l}%;top:${t}%;width:${w}%;height:${h}%;z-index:${z}`;
    return `<span${st ? ' class="lay"' : ''} data-lay-item="${esc(it.id)}"${edit(it)} style="${style}">${p ? `<img alt="" data-photo="${esc(p.id)}">` : `<i class="fig-ph">${esc(itemLabel(it))}</i>`}</span>`; };
  let z = 1; const out = [];
  // Drawn top to bottom, so lower bands overlap the hem of the one above a little, like a flat lay; a scarf lies over the neckline
  for (const band of ['dress', 'top', 'bottom', 'shoes', 'scarf', 'hat']) {
    const list = (bands.get(band) || []).sort((a, b) => figLayer(a) - figLayer(b)); if (!list.length) continue;
    const [L, T, W, H] = FIG_BANDS[band], n = list.length, w = W / (1 + (n - 1) * 0.6);
    list.forEach((it, i) => out.push(piece(it, [L + i * w * 0.6, T, w, H], z++)));
  }
  if (side.length) { const [L, T, W, H] = FIG_SIDE, h = Math.min(H / side.length, 24); side.forEach((it, i) => out.push(piece(it, [L, T + i * (h + 1), W, h], z++))); }
  const names = items.map(itemLabel).join(', ');
  return `<div class="fig fig-${size}" role="img" aria-label="${esc(names ? `The outfit as worn: ${names}` : 'No items yet')}">${out.join('') || (size === 'lg' ? '<span class="fig-empty">No items yet</span>' : '')}</div>`;
}
const outfitWears = id => doc.wears.filter(w => w.outfit === id).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
// The photo of one wearing: its own (wear.photo), or, for wears logged before that existed, the outfit's one worn photo
// no wear claims, when exactly one of its wears came from a photo without saying which
function wearPhoto(o, w) {
  if (w.photo) return w.photo;
  if (w.source !== 'photo') return null;
  const free = (o.photos || []).filter(p => p.role === 'worn' && !doc.wears.some(x => x.photo === p.id));
  const unlinked = doc.wears.filter(x => x.outfit === o.id && x.source === 'photo' && !x.photo);
  return free.length === 1 && unlinked.length === 1 ? free[0].id : null;
}
function renderOutfits() {
  const outfits = doc.outfits.filter(o => (o.items || []).every(id => { const it = itemById(id); return !it || visible(it); }));
  $('#main').innerHTML = `
  <div class="bar"><button type="button" class="btn primary" data-act="new-outfit">New outfit</button></div>
  ${outfits.length ? `<ul class="ogrid">${outfits.map(o => { const ws = outfitWears(o.id), n = (o.items || []).map(itemById).filter(it => it && visible(it)).length, name = o.name || 'Outfit';
      // The photo from the latest wearing that has one, else the last worn photo added
      const lw = ws.find(w => wearPhoto(o, w)), last = (lw && wearPhoto(o, lw)) || ((o.photos || []).filter(p => p.role === 'worn').slice(-1)[0] || {}).id;
      return `<li class="ocard-wrap"><button type="button" class="card ocard" data-outfit="${esc(o.id)}">${outfitFigure(o, 'md')}
      <span class="txt"><b>${esc(name)}</b><span class="muted small">${esc([`${n} item${n === 1 ? '' : 's'}`, ...(o.occasions || []).map(x => kname('occasions', x))].join(' · '))}</span><span class="muted small">${ws.length ? `Worn ${ws.length}×, last ${esc((ws[0].at || '').slice(0, 10))}` : 'Not worn yet'}</span>${wordsOf(o).length ? `<span class="owords">${wordsOf(o).map(w => `<span class="wtag">${wordChip(w)}</span>`).join('')}</span>` : ''}</span>
    </button>${last ? `<button type="button" class="worn-mini" data-zoom="${esc(last)}" data-zoom-outfit="${esc(o.id)}" data-zoom-label="${esc(name)}, as worn" aria-label="Look closer at ${esc(name)} as worn" title="Look closer"><img alt="" data-photo="${esc(last)}"></button>` : ''}</li>`; }).join('')}</ul>` : '<div class="empty">No outfits yet. Put a few items together and save them as an outfit.</div>'}`;
}
// One wear in the log: its name (opens the outfit or the item), × to remove it, and pictures of what was worn: that
// day's photo first, then the items (tap one for a close-up), at most WLOG_THUMBS of them
