'use strict';
/* ---------- Looks ---------- */
// A look is a face palette: one colour per zone of data/face-zones.json (lips, cheeks, eyelid…), saved in doc.looks
// {id, u, name, season, zones: {<zone id>: {cos, shade, hex} | {hex, name, find: true}}, notes, words}. A zone holds a
// shade of your make-up (its hex is kept too, so the look still shows if the product goes), or a colour from the
// season's palette to look for. Suggestions rank your shades by how close they are to the season's palette (the same
// rule as the closet on the Colour tab: within CS_MATCH of a palette colour and nearer it than any colour to avoid).
let lookEd = null; // { look, zone } while the look editor is open
const lookById = id => doc.looks.find(l => l.id === id);
const lchOf = hex => { const [L, a, b] = labOf(hex); return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 }; };
const inHue = (h, [a, b]) => a <= b ? h >= a && h <= b : h >= a || h <= b;
const zoneTypeOk = (z, c) => !c.ownType && (z.types.includes(c.type) || z.types.includes((K.byId.cosmeticTypes.get(c.type) || {}).parent));
// How far a colour is from what a zone asks for (0: it fits its lightness, chroma and hue ranges)
const zoneMiss = (z, hex) => { const { L, C, h } = lchOf(hex); return (z.lightness ? Math.max(0, z.lightness[0] - L, L - z.lightness[1]) : 0) + (z.minChroma ? Math.max(0, z.minChroma - C) : 0) + (z.maxChroma ? Math.max(0, C - z.maxChroma) : 0) + (z.hue && C > 12 && !inHue(h, z.hue) ? 30 : 0); };
// The parts of a face a shade suits (its product's type fits the part, and its colour the part's ranges): a combined
// face palette's pans sort themselves into contour, bronzer, highlight and blush this way
const shadeUses = (c, s) => c && okHex(s.hex) ? K.faceZones.filter(z => zoneTypeOk(z, c) && zoneMiss(z, s.hex) <= 6).map(z => z.name) : [];
// The season's colours for a zone, best first; when the zone's ranges leave none, the nearest of the rest
function zoneTargets(z, s, strict) {
  if (!s) return [];
  const src = z.from === 'neutrals' ? s.neutrals : z.from === 'colours' ? s.colours : [...s.colours, ...s.neutrals];
  const ranked = src.map(c => ({ c, m: zoneMiss(z, c.hex) })).sort((a, b) => a.m - b.m);
  const ok = ranked.filter(x => !x.m);
  return (ok.length || strict ? ok : ranked.slice(0, 4)).map(x => x.c);
}
// Your shades that fit a zone, those in the season's palette first, then by how close they are to it
function zoneShades(z, s) {
  const good = s ? [...s.colours, ...s.neutrals].map(c => labOf(c.hex)) : [], bad = s ? s.avoid.map(c => labOf(c.hex)) : [];
  return doc.cosmetics.filter(c => zoneTypeOk(z, c)).flatMap(c => (c.shades || []).filter(x => okHex(x.hex)).map(x => {
    const l = labOf(x.hex), g = good.length ? Math.min(...good.map(t => dE(l, t))) : 0, b = Math.min(Infinity, ...bad.map(t => dE(l, t)));
    return { c, x, d: g, fits: !!s && g <= CS_MATCH && g < b, suits: zoneMiss(z, x.hex) <= 6 };
  })).sort((a, b) => (b.fits - a.fits) || a.d - b.d);
}
const zoneHex = v => v && okHex(v.hex) ? v.hex : null;
function zoneText(v) {
  if (!v) return 'Not chosen';
  if (v.find) return `${v.name || v.hex} · season colour to look for`;
  const c = cosById(v.cos), x = c && (c.shades || []).find(s => s.id === v.shade);
  return c ? [x && x.name, c.brand, c.name || cosTypeName(c)].filter(Boolean).join(' · ') || cosTypeName(c) : 'No longer in your make-up';
}
// A face chart drawn in the look's colours; empty zones are dashed outlines. data-zone lets the big one pick a zone.
function lookFace(l, big) {
  const z = id => zoneHex((l.zones || {})[id]), f = (id, extra = '') => { const h = z(id); return h ? `fill="${esc(h)}" ${extra}` : 'fill="none" stroke="var(--faint)" stroke-dasharray="3 3"'; };
  const st = (id, w) => { const h = z(id); return h ? `stroke="${esc(h)}" stroke-width="${w}"` : `stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="3 3"`; };
  const g = (id, inner) => `<g data-zone="${id}"${big ? ` class="fz${lookEd && lookEd.zone === id ? ' on' : ''}" role="button" tabindex="0" aria-label="${esc(kname('faceZones', id))}"` : ''}>${inner}</g>`;
  const eye = (cx, s) => `${g('crease', `<path d="M${cx - 27} 124 Q${cx} ${97} ${cx + 27} 124" fill="none" ${st('crease', 7)} stroke-linecap="round" opacity=".85"/>`)}
    ${g('lid', `<path d="M${cx - 25} 131 Q${cx} 106 ${cx + 25} 131 Q${cx} 122 ${cx - 25} 131Z" ${f('lid')}/>`)}
    <ellipse cx="${cx}" cy="133" rx="19" ry="7" fill="#fff" stroke="var(--line)"/><circle cx="${cx + s}" cy="133" r="5" fill="var(--muted)"/>
    ${g('liner', `<path d="M${cx - 25} 131 Q${cx} 122 ${cx + 25} 131 L${cx + 31} 126" fill="none" ${st('liner', 3)} stroke-linecap="round"/>`)}`;
  return `<svg class="face${big ? ' face-lg' : ''}" viewBox="0 0 240 300" aria-hidden="${big ? 'false' : 'true'}" role="img" aria-label="Face chart">
    <ellipse cx="120" cy="150" rx="86" ry="112" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
    ${g('contour', `<path d="M42 172 Q62 186 90 196" fill="none" ${st('contour', 9)} stroke-linecap="round" opacity=".55"/><path d="M198 172 Q178 186 150 196" fill="none" ${st('contour', 9)} stroke-linecap="round" opacity=".55"/>`)}
    ${g('bronze', `<ellipse cx="44" cy="165" rx="9" ry="30" ${f('bronze', 'opacity=".5"')}/><ellipse cx="196" cy="165" rx="9" ry="30" ${f('bronze', 'opacity=".5"')}/>`)}
    ${eye(85, 1)}${eye(155, -1)}
    ${g('highlight', `<ellipse cx="78" cy="160" rx="15" ry="5" ${f('highlight', 'opacity=".85"')}/><ellipse cx="162" cy="160" rx="15" ry="5" ${f('highlight', 'opacity=".85"')}/>`)}
    ${g('cheeks', `<circle cx="80" cy="186" r="20" ${f('cheeks', 'opacity=".55"')}/><circle cx="160" cy="186" r="20" ${f('cheeks', 'opacity=".55"')}/>`)}
    ${g('lips', `<path d="M94 223 Q107 211 120 217 Q133 211 146 223 Q120 231 94 223Z" ${f('lips')}/><path d="M94 223 Q120 248 146 223 Q120 231 94 223Z" ${f('lips')}/>`)}
    ${g('nails', [88, 104, 120, 136, 152].map(x => `<rect x="${x - 6}" y="276" width="12" height="18" rx="6" ${f('nails')}/>`).join(''))}
  </svg>`;
}
function renderLooks() {
  const s = K.byId.colourSeasons.get(doc.settings.colourSeason);
  return `<div class="bar"><button type="button" class="btn primary" data-look-act="new">New look</button>
    <span class="small muted">${s ? `Suggestions follow your season, <b>${esc(s.name)}</b>.` : 'Pick your colour season on the Colour tab to get suggestions.'}</span>
    ${s ? '' : '<button type="button" class="btn sm" data-tab="colour">Find my season</button>'}</div>
  ${doc.looks.length ? `<ul class="grid look-grid">${[...doc.looks].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(l => {
      const find = Object.values(l.zones || {}).filter(v => v && v.find).length, ls = K.byId.colourSeasons.get(l.season);
      return `<li><button type="button" class="card" data-look="${esc(l.id)}"><span class="ph look-ph">${lookFace(l)}</span><span class="cap"><b>${esc(l.name || 'Look')}</b><span>${esc([ls && ls.name, find ? `${find} to look for` : ''].filter(Boolean).join(' · '))}</span></span></button></li>`;
    }).join('')}</ul>`
    : '<div class="empty">No looks yet. A look is a face palette, a colour each for lips, cheeks, eyes and nails, picked from your make-up or suggested from your colour season. Tap <i>New look</i>, then <i>Suggest</i>.</div>'}`;
}

/* The look editor: the face chart on one side, the zones on the other (like an outfit) */
function lookRead() {
  const l = lookEd.look, nm = $('#lkName'), notes = $('#lkNotes'), form = $('#lookForm');
  return { ...l, name: nm ? nm.value.trim() : l.name, notes: notes ? notes.value.trim() || undefined : l.notes, words: form ? formWords(new FormData(form), l) : l.words };
}
function lookForm(l, zone) {
  if (!lookEd || lookEd.look.id !== l.id) lookEd = { look: l, zone: zone || null }; else { lookEd.look = l; if (zone !== undefined) lookEd.zone = zone; }
  const keep = $('#layer .op-side') ? $('#layer .op-side').scrollTop : 0, same = !!$(`#layer [data-look-ed="${CSS.escape(l.id)}"]`);
  const s = K.byId.colourSeasons.get(l.season), saved = !!lookById(l.id), zid = lookEd.zone;
  const zoneRow = z => {
    const v = (l.zones || {})[z.id], h = zoneHex(v), open = zid === z.id;
    return `<div class="lz${open ? ' open' : ''}"><button type="button" class="lz-head" data-look-zone="${z.id}" aria-expanded="${open}"><i class="lz-sw" style="${h ? `background:${esc(h)}` : ''}"></i><b>${esc(z.name)}</b><span class="small muted">${esc(zoneText(v))}</span></button>${open ? zonePicker(z, s, v) : ''}</div>`;
  };
  openDrawer(`<div class="op-fig" data-look-ed="${esc(l.id)}">${lookFace(l, true)}<p class="small muted fig-hint">Tap a part of the face to choose its colour.</p></div>
  <div class="op-side">
    <label class="sr-only" for="lkName">Look name</label><input type="text" id="lkName" class="title-edit" value="${esc(l.name || '')}" placeholder="Name this look" autocomplete="off" enterkeyhint="done">
    <div class="row"><label class="small muted" for="lkSeason">Season</label><select id="lkSeason"><option value="">None</option>${Object.entries(CS_FAMILY).map(([f, name]) => `<optgroup label="${name}">${K.colourSeasons.filter(x => x.family === f).map(x => `<option value="${esc(x.id)}"${l.season === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select>
      <span class="grow"></span><button type="button" class="btn sm" data-look-act="suggest" title="Fill the empty parts">Suggest</button><button type="button" class="btn sm" data-look-act="mix" title="Pick again for every part">Mix it up</button></div>
    ${s ? '' : '<p class="small muted" style="margin:0">With a season, suggestions come from its palette and your shades in it are marked ✓.</p>'}
    <div class="stack lz-list">${K.faceZones.map(zoneRow).join('')}</div>
    <form class="form" id="lookForm">
      <label class="field">Notes<textarea id="lkNotes" rows="2" placeholder="When to wear it, what it goes with…">${esc(l.notes || '')}</textarea></label>
      ${wordsField(l)}
      <div class="row op-actions"><button type="submit" class="btn primary">Save</button>${saved ? `<span style="flex:1"></span><button type="button" class="btn danger" data-look-del="${esc(l.id)}">Delete</button>` : ''}</div>
    </form>
  </div>`, 'outfit-panel');
  if (same && $('#layer .op-side')) $('#layer .op-side').scrollTop = keep;
  $('#layer .x').focus();
}
function zonePicker(z, s, v) {
  const mine = zoneShades(z, s), targets = zoneTargets(z, s);
  const cur = x => v && !v.find && v.shade === x.id;
  return `<div class="lz-pick stack">
    ${mine.length ? `<div><p class="small muted lz-sub">From your make-up</p><ul class="lz-shades">${mine.map(({ c, x, fits }) => `<li><button type="button" class="shade-chip${cur(x) ? ' on' : ''}" data-look-shade="${esc(c.id)}|${esc(x.id)}" aria-pressed="${cur(x)}" title="${esc([x.name, c.brand, c.name].filter(Boolean).join(' · '))}"><i style="background:${esc(shadeBg(x))};color:${inkOn(x.hex)}">${fits ? '✓' : ''}</i><span>${esc(x.name || c.name || cosTypeName(c))}</span><span class="muted">${esc(c.brand || '')}</span></button></li>`).join('')}</ul>${s && !mine.some(m => m.fits) ? '<p class="small muted" style="margin:4px 0 0">None of these is in your season’s palette; a season colour below is something to look for.</p>' : ''}</div>`
      : `<p class="small muted" style="margin:0">No ${esc(z.name.toLowerCase())} make-up with a colour yet.</p>`}
    ${targets.length ? `<div><p class="small muted lz-sub">${esc(s.name)} colours to look for</p><div class="chips">${targets.map(c => `<button type="button" class="chip" data-look-find="${esc(c.hex)}|${esc(c.name)}" aria-pressed="${!!(v && v.find && v.hex === c.hex)}"><i class="swatch" style="background:${esc(c.hex)}"></i>${esc(c.name)}</button>`).join('')}</div></div>` : ''}
    ${v ? '<div><button type="button" class="btn ghost sm" data-look-clear>Clear this part</button></div>' : ''}
  </div>`;
}
// Suggest fills the empty parts; Mix it up picks again for every part, at random among the closest few. Your own shades
// in the palette come first; a season colour to look for only where you have none. No shade is used twice.
function lookSuggest(l, all) {
  const s = K.byId.colourSeasons.get(l.season), zones = { ...(all ? {} : l.zones || {}) }, used = new Set(Object.values(zones).map(v => v && v.shade).filter(Boolean));
  const pick = a => all ? a[Math.floor(Math.random() * Math.min(3, a.length))] : a[0];
  for (const z of K.faceZones) {
    if (zones[z.id]) continue;
    // only shades that suit the part (a blue eyeshadow is no highlighter), even when they are in the palette
    // Parts marked ownFirst (contour, bronzer, highlight) take the pan of yours that suits them best, in the palette or not
    const mine = zoneShades(z, s).filter(m => !used.has(m.x.id) && m.suits), fit = mine.filter(m => m.fits);
    if (z.ownFirst) mine.sort((a, b) => zoneMiss(z, a.x.hex) - zoneMiss(z, b.x.hex) || (b.fits - a.fits) || a.d - b.d);
    if (fit.length || ((!s || z.ownFirst) && mine.length)) { const m = pick(z.ownFirst ? mine : fit.length ? fit : mine); zones[z.id] = { cos: m.c.id, shade: m.x.id, hex: m.x.hex }; used.add(m.x.id); continue; }
    const t = zoneTargets(z, s); if (t.length) { const c = pick(t); zones[z.id] = { hex: c.hex, name: c.name, find: true }; }
  }
  return { ...l, zones };
}
const setZone = (id, v) => { const l = lookRead(); const zones = { ...(l.zones || {}) }; if (v) zones[id] = v; else delete zones[id]; lookForm({ ...l, zones }); };
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-zone]'); if (!t) return;
  const d = t.dataset;
  if (d.look && !t.closest('#layer')) { lookEd = null; return lookForm(structuredClone(lookById(d.look))); }
  if (d.lookAct === 'new') { lookEd = null; return lookForm({ id: uid(), name: '', season: doc.settings.colourSeason || '', zones: {} }, 'lips'); }
  if (!lookEd || !t.closest('#layer')) return;
  if (d.zone || d.lookZone) { const id = d.zone || d.lookZone; return lookForm(lookRead(), lookEd.zone === id && d.lookZone ? null : id); }
  if (d.lookAct === 'suggest' || d.lookAct === 'mix') {
    const l = lookSuggest(lookRead(), d.lookAct === 'mix'); lookForm(l);
    if (!l.season) toast('Without a season, these are just your own shades. Pick a season for palette suggestions.', 5000);
    return;
  }
  if (d.lookShade) { const [cid, sid] = d.lookShade.split('|'), c = cosById(cid), x = c && (c.shades || []).find(s => s.id === sid); return x && setZone(lookEd.zone, { cos: cid, shade: sid, hex: x.hex }); }
  if (d.lookFind) { const i = d.lookFind.indexOf('|'); return setZone(lookEd.zone, { hex: d.lookFind.slice(0, i), name: d.lookFind.slice(i + 1), find: true }); }
  if (d.lookClear !== undefined) return setZone(lookEd.zone, null);
  if (d.lookDel) { if (!confirm('Delete this look? Your make-up stays.')) return; remove('looks', d.lookDel); lookEd = null; closeDrawer(); render(); return toast('Look deleted'); }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.zone && lookEd) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } if (e.key === 'Enter' && e.target.id === 'lkName') { e.preventDefault(); e.target.blur(); } });
document.addEventListener('change', e => { if (e.target.id === 'lkSeason' && lookEd) lookForm({ ...lookRead(), season: e.target.value }); });
document.addEventListener('submit', e => {
  if (e.target.id !== 'lookForm' || !lookEd) return;
  e.preventDefault(); const l = lookRead(); if (!l.name) l.name = 'Look';
  put('looks', l); lookEd = null; closeDrawer(); render(); toast('Look saved');
});
// The Shades view's gaps: for each part of the face, the season's colours for it that none of your shades for that part
// comes near (within CS_MATCH), so you know what to look for when you shop
function seasonGaps() {
  const s = K.byId.colourSeasons.get(doc.settings.colourSeason);
  if (!s) return `<section class="panel row gaps"><span class="small muted">Pick your colour season to see which of its colours your make-up doesn’t cover yet.</span><button type="button" class="btn sm" data-tab="colour">Find my season</button></section>`;
  const rows = K.faceZones.map(z => {
    const mine = doc.cosmetics.filter(c => zoneTypeOk(z, c)).flatMap(c => (c.shades || []).filter(x => okHex(x.hex)).map(x => labOf(x.hex)));
    const miss = zoneTargets(z, s, true).filter(t => { const l = labOf(t.hex); return !mine.some(m => dE(m, l) <= CS_MATCH); });
    return { z, miss: miss.slice(0, 8), have: mine.length };
  }).filter(r => r.miss.length);
  const n = rows.reduce((a, r) => a + r.miss.length, 0);
  return `<details class="panel gaps"${cosF().gapsShut ? '' : ' open'} data-gaps><summary><b>${esc(s.name)} colours you don’t have yet</b> <span class="count">${n}</span></summary>
    ${rows.length ? `<p class="small muted">Suggested from your season’s palette for each part of the face, and not close to any shade you own for it. A guide for shopping, not a rule.</p>
    <div class="stack">${rows.map(r => `<div class="gap-row"><span class="small"><b>${esc(r.z.name)}</b>${r.have ? '' : ' <span class="muted">(none yet)</span>'}</span><div class="chips">${r.miss.map(c => `<span class="chip gap-chip"><i class="swatch" style="background:${esc(c.hex)}"></i>${esc(c.name)}</span>`).join('')}</div></div>`).join('')}</div>`
    : '<p class="small muted">Your make-up covers every colour your season suggests. Nice.</p>'}</details>`;
}
document.addEventListener('toggle', e => { if (e.target.dataset && e.target.dataset.gaps !== undefined) { const shut = !e.target.open; if (!!cosF().gapsShut !== shut) setSetting('cos', { ...cosF(), gapsShut: shut || undefined }); } }, true);
