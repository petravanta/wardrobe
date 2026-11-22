'use strict';
/* ---------- Cost and wear ---------- */
// Wears per item come from wearStats() (logged wears plus a count an import brought in). Cost per wear is the price
// divided by the times worn; an item not worn yet costs its whole price per wear so far.
function itemStats() {
  const st = wearStats(), out = new Map();
  for (const it of doc.items) {
    const s = st.get(it.id) || { n: 0, last: '' }, price = hasPrice(it) ? +it.price : null;
    out.set(it.id, { n: s.n, last: (s.last || '').slice(0, 10), price, cpw: price == null ? null : price / Math.max(1, s.n) });
  }
  return out;
}
const money = v => v == null ? '–' : (+v).toFixed(2);
const statThumb = it => { const p = coverPhoto(it); return `<span class="sthumb">${p ? `<img alt="" data-photo="${esc(p.id)}"${p.role === 'cutout' ? ' class="cut"' : ''}>` : ''}</span>`; };
// One line in the short lists on the Worn tab: picture, name, value; opens the item
const statRow = (it, value) => `<button type="button" class="srow" data-item="${esc(it.id)}">${statThumb(it)}<span class="nm">${esc(itemLabel(it))}</span><span class="meta mono">${value}</span></button>`;

// The chart: each priced item a dot, times worn across, price up. It shows what the closet shows: the closet's filters
// apply, and its Group setting splits the table under the chart; picking a group there brings its dots forward.
let costGroup = null;
function costChart() {
  const st = itemStats(), shown = sortItems(doc.items.filter(it => matches(it))), priced = shown.filter(it => st.get(it.id).price != null);
  const g = GROUPS[doc.settings.groupBy] ? doc.settings.groupBy : '', groups = groupItems(shown);
  if (costGroup != null && !groups.some(s => s.key === costGroup)) costGroup = null;
  const inGroup = costGroup == null ? null : new Set((groups.find(s => s.key === costGroup) || { items: [] }).items.map(it => it.id));
  const f = F(), active = Object.values(f).some(v => v && (!Array.isArray(v) || v.length));
  // Drawn at the width it gets on screen (one SVG unit is one pixel), so the text stays its normal size on any screen
  const W = Math.round(Math.min(1100, Math.max(280, ($('#main').clientWidth || 640) - 36))), H = W < 520 ? 240 : 320, L = 52, R = 14, T = 14, B = 40;
  const maxN = Math.max(1, ...priced.map(it => st.get(it.id).n)), maxP = Math.max(1, ...priced.map(it => st.get(it.id).price));
  const nice = m => { const e = 10 ** Math.floor(Math.log10(m)), r = m / e; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * e; };
  const yMax = nice(maxP), xMax = Math.max(4, Math.ceil(maxN * 1.1));
  const x = n => L + n / xMax * (W - L - R), y = p => T + (1 - p / yMax) * (H - T - B);
  const yt = [0, .25, .5, .75, 1].map(k => k * yMax), xStep = Math.max(1, Math.ceil(xMax / 6)), xt = []; for (let n = 0; n <= xMax; n += xStep) xt.push(n);
  const dot = it => { const s = st.get(it.id), on = !inGroup || inGroup.has(it.id);
    return `<circle class="cdot${on ? '' : ' dim'}" cx="${x(s.n).toFixed(1)}" cy="${y(s.price).toFixed(1)}" r="6" data-cdot="${esc(it.id)}" tabindex="${on ? 0 : -1}" role="img" aria-label="${esc(`${itemLabel(it)}: ${money(s.price)}, worn ${s.n} time${s.n === 1 ? '' : 's'}`)}"></circle>`; };
  const rows = groups.map(s => { const ps = s.items.filter(it => st.get(it.id).price != null), cost = ps.reduce((a, it) => a + st.get(it.id).price, 0), n = ps.reduce((a, it) => a + st.get(it.id).n, 0), all = s.items.reduce((a, it) => a + st.get(it.id).n, 0);
    return { s, cost, n, all, cpw: ps.length ? cost / Math.max(1, n) : null }; });
  const maxC = Math.max(0, ...rows.map(r => r.cpw || 0));
  return `<section class="panel stack cost-chart">
    <div class="row"><h3 style="margin:0">Cost and wear</h3><span class="grow"></span>
      <label class="small muted" for="cGroup">Group</label><select id="cGroup">${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}"${g === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
    <p class="small muted" style="margin:0">Each dot is an item: how many times you wore it, and what it cost. ${active ? `Showing ${shown.length} item${shown.length === 1 ? '' : 's'} that match the closet’s filters. <button type="button" class="linkbtn" data-tab-go="closet">Change filters</button> · <button type="button" class="linkbtn" data-act="clear">Show all</button>` : 'It follows the closet’s filters, so filter the closet to look at part of it.'}${shown.length > priced.length ? ` ${shown.length - priced.length} without a price ${shown.length - priced.length === 1 ? 'isn’t' : 'aren’t'} on the chart.` : ''}</p>
    ${priced.length ? `<div class="cplot"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Item cost against times worn">
      ${yt.map(v => `<line class="cgrid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"></line><text class="ctick" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v % 1 ? v.toFixed(1) : v}</text>`).join('')}
      ${xt.map(n => `<text class="ctick" x="${x(n)}" y="${H - B + 18}" text-anchor="middle">${n}</text>`).join('')}
      <line class="caxis" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"></line>
      <text class="clabel" x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">Times worn</text>
      <text class="clabel" x="12" y="${(T + H - B) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(T + H - B) / 2})">Price</text>
      ${priced.filter(it => inGroup && !inGroup.has(it.id)).map(dot).join('')}${priced.filter(it => !inGroup || inGroup.has(it.id)).map(dot).join('')}
    </svg><div class="ctip" id="cTip" hidden></div></div>` : '<p class="muted">Add prices to your items to see them here.</p>'}
    ${g || rows.length > 1 ? `<div class="btable-wrap"><table class="ctable"><thead><tr><th scope="col">${esc(GROUPS[g] || 'Group')}</th><th scope="col" class="num">Items</th><th scope="col" class="num">Cost</th><th scope="col" class="num">Worn</th><th scope="col" class="num">Per wear</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${costGroup === r.s.key ? 'on' : ''}"><th scope="row"><button type="button" class="linkbtn" data-cgroup="${esc(r.s.key)}" aria-pressed="${costGroup === r.s.key}">${esc(r.s.label)}</button></th><td class="num">${r.s.items.length}</td><td class="num mono">${money(r.cost)}</td><td class="num mono">${r.all}</td>
        <td class="num mono"><span class="cbar" style="--w:${maxC && r.cpw != null ? (r.cpw / maxC).toFixed(3) : 0}"></span>${money(r.cpw)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted" style="margin:0">Per wear: the group’s cost over the times its priced items were worn. Tap a group to pick out its dots.</p>` : ''}
  </section>`;
}
let chartW = 0, chartTimer;
addEventListener('resize', () => { clearTimeout(chartTimer); chartTimer = setTimeout(() => { const w = $('#main').clientWidth; if (tab === 'worn' && !wornView && $('.cost-chart') && Math.abs(w - chartW) > 40 && !$('#layer').innerHTML) { chartW = w; render(); } }, 200); });
function costTip(dotEl) {
  const tip = $('#cTip'); if (!tip) return;
  if (!dotEl) { tip.hidden = true; return; }
  const it = itemById(dotEl.dataset.cdot), s = itemStats().get(it.id), box = dotEl.closest('.cplot').getBoundingClientRect(), r = dotEl.getBoundingClientRect();
  tip.innerHTML = `<b>${esc(itemLabel(it))}</b><span>${money(s.price)} · worn ${s.n}× · ${s.n ? `${money(s.cpw)} per wear` : 'not worn yet'}</span>`;
  tip.hidden = false;
  const left = Math.min(Math.max(0, r.left - box.left + r.width / 2 - tip.offsetWidth / 2), box.width - tip.offsetWidth);
  tip.style.left = `${left}px`; tip.style.top = `${Math.max(0, r.top - box.top - tip.offsetHeight - 8)}px`;
}
document.addEventListener('pointerover', e => { const d = e.target.closest && e.target.closest('[data-cdot]'); if (d || (e.target.closest && e.target.closest('.cplot'))) costTip(d); });
document.addEventListener('pointerleave', e => { if (e.target.classList && e.target.classList.contains('cplot')) costTip(null); }, true);
document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.cdot) costTip(e.target); });
document.addEventListener('focusout', e => { if (e.target.dataset && e.target.dataset.cdot) costTip(null); });
document.addEventListener('click', e => {
  const d = e.target.closest('[data-cdot]'); if (d) return itemForm(structuredClone(itemById(d.dataset.cdot)));
  const gr = e.target.closest('[data-cgroup]'); if (gr) { costGroup = costGroup === gr.dataset.cgroup ? null : gr.dataset.cgroup; return render(); }
  const go = e.target.closest('[data-tab-go]'); if (go) { tab = go.dataset.tabGo; lsSet(TAB_KEY, tab); scrollTo({ top: 0 }); return render(); }
  const bd = e.target.closest('[data-breakdown]'); if (bd) { wornView = bd.dataset.breakdown || ''; if (bd.dataset.bsort) breakdownSort = bd.dataset.bsort; scrollTo({ top: 0 }); return render(); }
  const bs = e.target.closest('[data-bsort-by]'); if (bs) { const k = bs.dataset.bsortBy; breakdownSort = breakdownSort === k ? '-' + k : k; return render(); }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.cdot) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
document.addEventListener('change', e => { if (e.target.id === 'cGroup') { costGroup = null; setSetting('groupBy', e.target.value); render(); } });

// The full breakdown: every item with its price, times worn, last worn and cost per wear, sortable by any column
let wornView = '', breakdownSort = 'cpw';
const BCOLS = { name: 'Item', price: 'Price', n: 'Worn', last: 'Last worn', cpw: 'Per wear' };
function renderBreakdown() {
  const st = itemStats(), key = breakdownSort.replace(/^-/, ''), rev = breakdownSort.startsWith('-');
  const val = it => key === 'name' ? itemLabel(it).toLowerCase() : st.get(it.id)[key];
  const items = doc.items.filter(visible).sort((a, b) => {
    const va = val(a), vb = val(b), na = va == null || va === '', nb = vb == null || vb === '';
    if (na !== nb) return na - nb; // no value always last
    const c = typeof va === 'string' ? va.localeCompare(vb) : vb - va; // numbers high first; names A to Z
    return rev ? -c : c;
  });
  const total = items.reduce((a, it) => a + (st.get(it.id).price || 0), 0), wears = items.reduce((a, it) => a + st.get(it.id).n, 0);
  $('#main').innerHTML = `<div class="bar"><button type="button" class="btn" data-breakdown="">‹ Back to Worn</button><h2 style="margin:0;font-size:18px">Every item: cost and wear</h2></div>
  <section class="panel"><p class="small muted" style="margin:0 0 8px">${items.length} items · ${money(total)} in all · worn ${wears} times. Tap a heading to sort by it, again to reverse. Items with no value for that column go last.</p>
  <div class="btable-wrap"><table class="btable"><thead><tr>${Object.entries(BCOLS).map(([k, v]) => `<th scope="col" class="${k === 'name' ? '' : 'num'}" aria-sort="${key === k ? (rev ? 'ascending' : 'descending') : 'none'}"><button type="button" class="linkbtn" data-bsort-by="${k}">${v}${key === k ? (rev ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead>
  <tbody>${items.map(it => { const s = st.get(it.id); return `<tr><th scope="row"><button type="button" class="srow" data-item="${esc(it.id)}">${statThumb(it)}<span class="nm">${esc(itemLabel(it))}</span></button></th><td class="num mono">${money(s.price)}</td><td class="num mono">${s.n}</td><td class="num mono">${esc(s.last || '–')}</td><td class="num mono">${s.n ? money(s.cpw) : s.price == null ? '–' : `<span title="Not worn yet">${money(s.cpw)}*</span>`}</td></tr>`; }).join('')}</tbody></table></div>
  <p class="small muted">* Not worn yet: the whole price so far.</p></section>`;
}
