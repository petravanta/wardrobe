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
  const eye = (cx, s) => `${g('crease', `<path d="M${cx - 22} 128 Q${cx} 106 ${cx + 22} 128" fill="none" ${st('crease', 6)} stroke-linecap="round" opacity=".8"/>`)}
    ${g('lid', `<path d="M${cx - 20} 133 Q${cx} 113 ${cx + 20} 133 Q${cx} 125 ${cx - 20} 133Z" ${f('lid')}/>`)}
    <ellipse cx="${cx}" cy="134" rx="15" ry="5.5" fill="#fff" stroke="var(--line)"/><circle cx="${cx + s}" cy="134" r="4" fill="var(--muted)"/>
    ${g('liner', `<path d="M${cx - 20} 133 Q${cx} 125 ${cx + 20} 133 L${cx + 25} 129" fill="none" ${st('liner', 2.5)} stroke-linecap="round"/>`)}`;
  // Soft edges (blur) on powders once they have a colour; an empty part is a dashed outline
  const pw = (id, op) => z(id) ? `fill="${esc(z(id))}" opacity="${op}" filter="url(#fzSoft)"` : f(id);
  const ps = (id, w, op) => z(id) ? `fill="none" stroke="${esc(z(id))}" stroke-width="${w}" stroke-linecap="round" opacity="${op}" filter="url(#fzSoft)"` : st(id, 1.5) + ' fill="none"';
  return `<svg class="face${big ? ' face-lg' : ''}" viewBox="0 0 240 300" aria-hidden="${big ? 'false' : 'true'}" role="img" aria-label="Face chart">
    <defs><filter id="fzSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <path d="M24 214 C14 120 40 22 120 20 C200 22 226 120 216 214 C200 160 196 110 188 92 C160 70 92 64 56 92 C44 110 40 160 24 214Z" fill="var(--muted)" opacity=".28"/>
    <path d="M98 236 L96 272 L144 272 L142 236Z" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
    <path d="M120 34 C168 34 196 70 197 122 C198 162 188 196 168 222 C153 242 137 254 120 254 C103 254 87 242 72 222 C52 196 42 162 43 122 C44 70 72 34 120 34Z" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
    <path d="M62 72 C84 50 140 46 168 64 C150 60 120 64 100 82 C88 76 74 74 62 72Z" fill="var(--muted)" opacity=".28"/>
    ${g('contour', `<path d="M50 168 Q66 182 92 190" ${ps('contour', 10, .45)}/><path d="M190 168 Q174 182 148 190" ${ps('contour', 10, .45)}/>`)}
    ${g('bronze', `<ellipse cx="60" cy="112" rx="9" ry="22" transform="rotate(12 60 112)" ${pw('bronze', .5)}/><ellipse cx="180" cy="112" rx="9" ry="22" transform="rotate(-12 180 112)" ${pw('bronze', .5)}/>`)}
    <path d="M66 108 Q84 98 106 105 M134 105 Q156 98 174 108" fill="none" stroke="var(--muted)" stroke-width="3" stroke-linecap="round" opacity=".55"/>
    ${eye(86, 1)}${eye(154, -1)}
    <path d="M118 148 Q115 176 110 186 Q120 192 130 186" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>
    ${g('cheeks', `<ellipse cx="80" cy="176" rx="20" ry="13" transform="rotate(-12 80 176)" ${pw('cheeks', .55)}/><ellipse cx="160" cy="176" rx="20" ry="13" transform="rotate(12 160 176)" ${pw('cheeks', .55)}/>`)}
    ${g('highlight', `<ellipse cx="74" cy="158" rx="13" ry="4" transform="rotate(-12 74 158)" ${pw('highlight', .9)}/><ellipse cx="166" cy="158" rx="13" ry="4" transform="rotate(12 166 158)" ${pw('highlight', .9)}/><ellipse cx="120" cy="164" rx="2.5" ry="9" ${pw('highlight', .7)}/>`)}
    ${g('lips', `<path d="M100 212 Q110 204 120 208 Q130 204 140 212 Q120 217 100 212Z" ${f('lips')}/><path d="M100 212 Q120 230 140 212 Q120 217 100 212Z" ${f('lips')}/>`)}
    ${g('nails', [88, 104, 120, 136, 152].map(x => `<rect x="${x - 6}" y="278" width="12" height="18" rx="6" ${f('nails')}/>`).join(''))}
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
  const mine = zoneShades(z, s), all = s ? zoneTargets(z, s) : [], left = s ? zoneMissing(z, s) : [];
  const targets = all.filter(t => left.some(m => m.hex === t.hex) || (v && v.find && v.hex === t.hex)); // the chosen one stays even if you have it now
  const cur = x => v && !v.find && v.shade === x.id;
  return `<div class="lz-pick stack">
    ${mine.length ? `<div><p class="small muted lz-sub">From your make-up</p><ul class="lz-shades">${mine.map(({ c, x, fits }) => `<li><button type="button" class="shade-chip${cur(x) ? ' on' : ''}" data-look-shade="${esc(c.id)}|${esc(x.id)}" aria-pressed="${cur(x)}" title="${esc([x.name, c.brand, c.name].filter(Boolean).join(' · '))}"><i style="background:${esc(shadeBg(x))};color:${inkOn(x.hex)}">${fits ? '✓' : ''}</i><span>${esc(x.name || c.name || cosTypeName(c))}</span><span class="muted">${esc(c.brand || '')}</span></button></li>`).join('')}</ul>${s && !mine.some(m => m.fits) ? '<p class="small muted" style="margin:4px 0 0">None of these is in your season’s palette; a season colour below is something to look for.</p>' : ''}</div>`
      : `<p class="small muted" style="margin:0">No ${esc(z.name.toLowerCase())} make-up with a colour yet.</p>`}
    ${s && all.length && !targets.length ? `<p class="small muted" style="margin:0">Your ✓ shades already cover every ${esc(s.name)} colour for this.</p>` : ''}
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
// Season gaps for the Shades view: for each part of the face, the season's colours (strict list) that no shade you own
// for that part comes near. { s: null } without a season.
// The colours of your make-up for a zone that count as having a season colour: only those in the season's palette (the
// ✓ rule: within CS_MATCH of a palette colour and nearer it than any colour to avoid), and every colour of a multicolour shade
function zoneHave(z, s) {
  const good = [...s.colours, ...s.neutrals].map(c => labOf(c.hex)), bad = s.avoid.map(c => labOf(c.hex));
  return doc.cosmetics.filter(c => zoneTypeOk(z, c)).flatMap(c => (c.shades || []).filter(x => okHex(x.hex))
    .flatMap(x => [x.hex, ...(x.multi ? (x.parts || []).map(p => p.hex).filter(okHex) : [])])).map(labOf)
    .filter(l => { const g = Math.min(...good.map(t => dE(l, t))), b = Math.min(Infinity, ...bad.map(t => dE(l, t))); return g <= CS_MATCH && g < b; });
}
// The season's colours for a zone that none of those comes near
const zoneMissing = (z, s, strict) => { const have = zoneHave(z, s); return zoneTargets(z, s, strict).filter(t => { const l = labOf(t.hex); return !have.some(m => dE(m, l) <= CS_MATCH); }); };
function gapRows() {
  const s = K.byId.colourSeasons.get(doc.settings.colourSeason);
  if (!s) return { s: null, rows: [] };
  return { s, rows: K.faceZones.map(z => {
    return { z, miss: zoneMissing(z, s, true).slice(0, 8) };
  }).filter(r => r.miss.length) };
}
const gapRow = (r, s) => `<div class="gap-row" title="${esc(s.name)} colours for ${esc(r.z.name.toLowerCase())} that none of your shades comes near: a guide for shopping, not a rule"><span class="small muted">${esc(s.name)} ideas for <b>${esc(r.z.name.toLowerCase())}</b></span><div class="chips">${r.miss.map(c => `<span class="chip gap-chip"><i class="swatch" style="background:${esc(c.hex)}"></i>${esc(c.name)}</span>`).join('')}</div></div>`;
const gapHint = () => '<section class="panel row gaps"><span class="small muted">Pick your colour season to see, under each kind of make-up, which of its colours you don’t have yet.</span><button type="button" class="btn sm" data-tab="colour">Find my season</button></section>';
