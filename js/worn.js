'use strict';
const WLOG_THUMBS = 6;
function wearEntry(w) {
  const o = w.outfit && doc.outfits.find(x => x.id === w.outfit), single = !w.outfit && itemById(w.item);
  const items = (o ? (o.items || []).map(itemById) : [single]).filter(it => it && visible(it));
  const ph = o ? wearPhoto(o, w) : w.photo, day = esc((w.at || '').slice(0, 10)), name = o ? (o.name || 'Outfit') : single ? itemLabel(single) : (w.outfit ? 'Outfit' : 'Item');
  const open = o ? `data-outfit="${esc(o.id)}"` : single ? `data-item="${esc(single.id)}"` : 'disabled';
  const thumb = it => { const p = coverPhoto(it); return p ? `<button type="button" class="wthumb" data-zoom="${esc(p.id)}" data-zoom-item="${esc(it.id)}" title="${esc(itemLabel(it))}" aria-label="Look closer at ${esc(itemLabel(it))}"><img alt="" data-photo="${esc(p.id)}"></button>` : `<i class="wthumb" title="${esc(itemLabel(it))}"></i>`; };
  return `<div class="wentry"><div class="wtop"><button type="button" class="wname" ${open}>${esc(name)}</button><button type="button" class="btn ghost sm" data-unwear="${esc(w.id)}" aria-label="Remove ${esc(name)} on ${day}">×</button></div>
    ${ph || items.length ? `<div class="wthumbs">${ph ? `<img alt="Worn ${day}" class="zoomable worn-ph" data-photo="${esc(ph)}">` : ''}${items.slice(0, WLOG_THUMBS).map(thumb).join('')}${items.length > WLOG_THUMBS ? `<span class="more-n">+${items.length - WLOG_THUMBS}</span>` : ''}</div>` : ''}</div>`;
}
// The log, newest first, with wears of the same day together under that date
function wearLog(wears) {
  const days = [];
  for (const w of wears) { const d = (w.at || '').slice(0, 10), last = days[days.length - 1]; if (last && last.d === d) last.ws.push(w); else days.push({ d, ws: [w] }); }
  return days.map(({ d, ws }) => `<div class="wlog-day"><h4>${esc(d)}</h4>${ws.map(wearEntry).join('')}</div>`).join('');
}
function renderWorn() {
  const wears = [...doc.wears].filter(w => {
    if (w.item) { const it = itemById(w.item); return !it || visible(it); }
    const o = w.outfit && doc.outfits.find(x => x.id === w.outfit), its = o ? (o.items || []).map(itemById).filter(Boolean) : [];
    return !its.length || its.some(visible);
  }).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const items = doc.items.filter(visible);
  const counts = new Map(items.map(it => [it.id, wearsOf(it.id).length]));
  const cpw = items.filter(it => it.price > 0 && counts.get(it.id)).map(it => ({ it, v: it.price / counts.get(it.id) })).sort((a, b) => b.v - a.v);
  const least = [...items].sort((a, b) => counts.get(a.id) - counts.get(b.id)).slice(0, 6);
  $('#main').innerHTML = `
  <div class="bar"><button type="button" class="btn primary" data-act="log-wear">Log what I wore</button>${Recognise.supported ? '<button type="button" class="btn" data-act="wore-photo">From a photo</button><span class="small muted fine-only">or drop a photo of your outfit here</span>' : ''}</div>
  <div class="stats" style="margin-bottom:16px">
    <div class="stat panel"><b>${items.length}</b><span>Items</span></div>
    <div class="stat panel"><b>${doc.outfits.length}</b><span>Outfits</span></div>
    <div class="stat panel"><b>${wears.length}</b><span>Times worn</span></div>
    <div class="stat panel"><b>${items.filter(it => !counts.get(it.id)).length}</b><span>Never worn</span></div>
  </div>
  <div class="two">
    <section class="panel stack"><h3>Wear log</h3>${wears.length ? wearLog(wears.slice(0, 60)) : '<p class="muted">Nothing logged yet.</p>'}</section>
    <section class="panel stack"><h3>Least worn</h3>${least.map(it => `<div class="entry"><span>${esc(it.name || kname('types', it.type))}</span><span class="meta">${counts.get(it.id)}×</span></div>`).join('') || '<p class="muted">Add items to see this.</p>'}
      <h3>Cost per wear</h3>${cpw.slice(0, 6).map(({ it, v }) => `<div class="entry"><span>${esc(it.name || kname('types', it.type))}</span><span class="meta mono">${v.toFixed(2)}</span></div>`).join('') || '<p class="muted">Add a price to an item and log a wear to see this.</p>'}</section>
  </div>`;
}
