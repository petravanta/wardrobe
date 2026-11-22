'use strict';
/* ---------- Colour season ---------- */
// The Colour tab: a guided questionnaire (data/colour-quiz.json), optional photo sampling, and the palette of the chosen
// season (data/colour-seasons.json). Only the season id is saved, as settings.colourSeason; answers live in CS while the
// page is open. A face photo is only drawn on the sampler's canvas to read a few colours: it is never saved, uploaded,
// put in IndexedDB or added to the closet, and it is gone when the sampler closes.
const CS = { answers: {}, from: {}, target: 'skin', samples: {} };
const CS_MATCH = 20; // how close (CIE76 ΔE) an item's main colour must be to a palette swatch to count as in the palette
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function rgbLab([r, g, b]) {
  const f = c => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)], t = v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
  const x = t((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = t(R * 0.2126 + G * 0.7152 + B * 0.0722), z = t((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const labOf = hex => rgbLab(hexRgb(hex));
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rgbHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const CS_FAMILY = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
// The average of every answered question on each axis, and the seasons nearest to it
function csScores() {
  const acc = { warmth: [0, 0], depth: [0, 0], clarity: [0, 0] };
  let n = 0;
  K.colourQuiz.forEach(q => { const o = q.options.find(x => x.id === CS.answers[q.id]); if (!o) return; n++; for (const a in acc) if (typeof o[a] === 'number') { acc[a][0] += o[a]; acc[a][1]++; } });
  const out = { n }; for (const a in acc) out[a] = acc[a][1] ? acc[a][0] / acc[a][1] : 0;
  return out;
}
const csRank = sc => K.colourSeasons.map(s => ({ s, d: Math.hypot(s.traits.warmth - sc.warmth, s.traits.depth - sc.depth, s.traits.clarity - sc.clarity) })).sort((a, b) => a.d - b.d);
const csLean = sc => [sc.warmth > 0.25 ? 'warm' : sc.warmth < -0.25 ? 'cool' : 'neutral', sc.depth > 0.3 ? 'deep' : sc.depth < -0.3 ? 'light' : 'medium depth', sc.clarity > 0.3 ? 'bright' : sc.clarity < -0.3 ? 'soft' : 'medium clarity'];
// Closet items by their main colour: near a palette swatch (and nearer it than anything to avoid), or not
function csCloset(s) {
  const good = [...s.colours, ...s.neutrals].map(c => labOf(c.hex)), bad = s.avoid.map(c => labOf(c.hex)), out = { in: [], out: [], other: [] };
  doc.items.filter(visible).forEach(it => {
    const c = K.byId.colours.get((it.colours || [])[0]);
    if (!c || c.family === 'pattern') return out.other.push(it);
    const l = labOf(c.hex), g = Math.min(...good.map(x => dE(l, x))), b = Math.min(Infinity, ...bad.map(x => dE(l, x)));
    out[g <= CS_MATCH && g < b ? 'in' : 'out'].push(it);
  });
  return out;
}
const csSwatches = list => `<ul class="cs-pal">${list.map(c => `<li><i style="background:${esc(c.hex)}"></i><span>${esc(c.name)}</span></li>`).join('')}</ul>`;
const csStrip = s => `<span class="cs-strip" aria-hidden="true">${s.colours.slice(0, 8).map(c => `<i style="background:${esc(c.hex)}"></i>`).join('')}</span>`;
const CS_GUIDE = 'This is a guide, not a verdict. Light, cameras, make-up and hair dye all change how colours read, and the season systems themselves are a rule of thumb. Hold a few colours from the top suggestions under your face in daylight and keep the one you look best in.';
function csResult() {
  const sc = csScores();
  if (sc.n < 3) return `<p class="small muted">Answer at least three questions to see a suggestion.${sc.n ? ` ${sc.n} answered so far.` : ''}</p>`;
  const top = csRank(sc).slice(0, 3), cur = doc.settings.colourSeason;
  return `<h3>Suggestion</h3><p>Your answers lean <b>${csLean(sc).join(', ')}</b>.</p>
    <div class="stack cs-picks">${top.map((x, i) => `<div class="row cs-pick"><b>${esc(x.s.name)}</b><span class="small muted">${i === 0 ? 'Closest' : x.d - top[0].d < 0.25 ? 'Also close' : 'Next closest'}</span>${csStrip(x.s)}<span class="grow"></span>
      ${cur === x.s.id ? '<span class="small muted">Your season</span>' : `<button type="button" class="btn sm${i === 0 ? ' primary' : ''}" data-cs-use="${esc(x.s.id)}">Use this</button>`}</div>`).join('')}</div>
    <p class="small muted">${CS_GUIDE}</p>`;
}
function csQuiz() {
  return `<p class="small muted">Answer what you can, ideally in daylight without make-up, and skip anything you aren't sure of. Your answers aren't saved; only the season you choose is.</p>
    <div class="row"><button type="button" class="btn" data-cs-act="photo">Use a photo to help</button><span class="small muted">It stays on this device and is forgotten when you close it.<span class="fine-only"> You can also drop one here.</span></span></div>
    ${K.colourQuiz.map(q => `<fieldset><legend>${esc(q.question)}</legend>${q.help ? `<p class="small muted">${esc(q.help)}</p>` : ''}
      <div class="chips">${q.options.map(o => `<label class="cs-opt"><input type="radio" name="cs-${esc(q.id)}" value="${esc(o.id)}" data-cs-q="${esc(q.id)}"${CS.answers[q.id] === o.id ? ' checked' : ''}>${o.hex ? `<i class="swatch" style="background:${esc(o.hex)}"></i>` : ''}${esc(o.label)}</label>`).join('')}</div>
      ${CS.from[q.id] ? '<p class="small muted cs-from">Suggested from your photo. Change it if it looks wrong.</p>' : ''}</fieldset>`).join('')}
    <div class="row"><button type="button" class="btn ghost sm" data-cs-act="reset">Clear answers</button></div>
    <div id="csResult" class="stack" aria-live="polite">${csResult()}</div>`;
}
function renderColour() {
  const cur = K.byId.colourSeasons.get(doc.settings.colourSeason);
  const picker = `<section class="panel stack"><h3>Pick your season yourself</h3>
    <p class="small muted">Already know it, or prefer another one? Choose it here; it replaces any suggestion.</p>
    <label class="sr-only" for="csPick">Colour season</label><select id="csPick"><option value="">Not chosen</option>${Object.entries(CS_FAMILY).map(([f, name]) => `<optgroup label="${name}">${K.colourSeasons.filter(s => s.family === f).map(s => `<option value="${esc(s.id)}"${cur && cur.id === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`).join('')}</select></section>`;
  let body;
  if (cur) {
    const m = csCloset(cur);
    body = `<section class="panel stack"><div class="row"><h2>${esc(cur.name)}</h2><span class="small muted">${CS_FAMILY[cur.family]} in the four-season system</span></div>
      <p>${esc(cur.summary)}</p>
      <h3>Your colours</h3>${csSwatches(cur.colours)}
      <h3>Neutrals</h3>${csSwatches(cur.neutrals)}
      <h3>Metals</h3><p>${esc(cur.metals.join(', '))}</p>
      ${cur.avoid.length ? `<h3>Harder to wear</h3>${csSwatches(cur.avoid)}${cur.why ? `<p class="small muted">${esc(cur.why)}</p>` : ''}` : ''}
      <p class="small muted">A guide, not a rule: wear what you love. Colours near your face matter most; trousers, shoes and bags are far more forgiving.</p></section>
    <section class="panel stack"><h3>From your closet</h3>
      ${doc.items.some(visible) ? `<p class="small muted">Matched by each item's main colour.${m.other.length ? ` ${m.other.length} with a print or no colour ${m.other.length === 1 ? 'isn’t' : 'aren’t'} counted.` : ''}</p>
      <h3>In your palette <span class="count">${m.in.length}</span></h3>${m.in.length ? `<ul class="grid">${m.in.map(it => card(it)).join('')}</ul>` : '<p class="muted small">Nothing yet.</p>'}
      ${m.out.length ? `<details class="more"><summary>Outside it (${m.out.length})</summary><ul class="grid" style="margin-top:12px">${m.out.map(it => card(it)).join('')}</ul><p class="small muted" style="margin-top:8px">Worth keeping if you love them: wear them away from your face, or with one of your colours near it.</p></details>` : ''}`
      : '<p class="muted small">Add items with a colour to see which ones are in your palette.</p>'}</section>
    <details class="panel more"${Object.keys(CS.answers).length ? ' open' : ''}><summary>Find my season again</summary><div class="stack" style="margin-top:12px">${csQuiz()}</div></details>`;
  } else {
    body = `<section class="panel stack"><h2>Find your colour season</h2>
      <p>Colour seasons sort people by their natural colouring (warm or cool, light or deep, bright or soft) into 12 groups, each with a palette that tends to flatter. Answer a few questions, optionally with help from a photo, then see your palette and which of your clothes are already in it.</p>
      <p class="small muted">${CS_GUIDE}</p></section>
    <section class="panel stack"><h3>Questions</h3>${csQuiz()}</section>`;
  }
  $('#main').innerHTML = `<div class="stack">${body}${picker}</div>`;
}
function csUse(id) { setSetting('colourSeason', id); render(); scrollTo({ top: 0 }); toast(id ? `${kname('colourSeasons', id)} is your season` : 'Season cleared'); }
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.csQ) { CS.answers[t.dataset.csQ] = t.value; delete CS.from[t.dataset.csQ]; const n = $('.cs-from', t.closest('fieldset')); if (n) n.remove(); const r = $('#csResult'); if (r) r.innerHTML = csResult(); }
  else if (t.id === 'csPick') csUse(t.value);
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-cs-act],[data-cs-use],[data-cs-target]'); if (!t) return;
  const d = t.dataset;
  if (d.csUse) return csUse(d.csUse);
  if (d.csTarget) { CS.target = d.csTarget; $$('[data-cs-target]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.csTarget === CS.target))); return; }
  if (d.csAct === 'photo') return $('#csIn').click();
  if (d.csAct === 'reset') { CS.answers = {}; CS.from = {}; return render(); }
  if (d.csAct === 'photo-use') return csApplySamples();
});

/* Photo sampling: tap skin, hair and eyes on a photo; the colours suggest answers, which people can still change */
const CS_TARGETS = { skin: 'Skin (cheek)', hair: 'Hair', eyes: 'Eye (iris)', white: 'Something white (optional)' };
function csPhoto(file) {
  if (!isImage(file)) return toast('Only photos can be used (JPEG, PNG, WebP).');
  const url = URL.createObjectURL(file), img = new Image();
  img.onerror = () => { URL.revokeObjectURL(url); toast('This browser can’t read that photo. Try a JPEG or PNG.'); };
  img.onload = () => {
    CS.samples = {}; CS.target = 'skin';
    openDrawer(`<h2>Sample your colouring</h2>
      <p class="small muted">This photo stays on this device. It isn’t saved, uploaded or added to your closet, and it’s forgotten when you close this panel.</p>
      <p class="small">Pick what to sample, then tap that spot on the photo. Daylight from a window, no filter and no make-up give the best reading. Tapping something white lets the app correct for the colour of the light.</p>
      <div class="chips" role="group" aria-label="What to sample">${Object.entries(CS_TARGETS).map(([k, v]) => `<button type="button" class="chip" data-cs-target="${k}" aria-pressed="${k === CS.target}">${v}</button>`).join('')}</div>
      <div class="cs-photo"><canvas id="csCanvas" aria-label="Your photo: tap to sample a colour"></canvas><div id="csDots"></div></div>
      <ul class="cs-pal" id="csSamples"></ul>
      <div class="row" style="margin-top:12px"><button type="button" class="btn primary" data-cs-act="photo-use" id="csUseBtn" disabled>Suggest answers</button><button type="button" class="btn" data-close>Cancel</button></div>`);
    const cv = $('#csCanvas'), k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url); img.src = '';
    cv.addEventListener('click', csSample);
  };
  img.src = url;
}
// The median of a small square around the tap, so a highlight or a stray pixel doesn't decide the colour
function csSample(e) {
  const cv = e.currentTarget, rc = cv.getBoundingClientRect(), x = Math.round((e.clientX - rc.left) * cv.width / rc.width), y = Math.round((e.clientY - rc.top) * cv.height / rc.height);
  const r = Math.max(2, Math.round(Math.max(cv.width, cv.height) / (CS.target === 'eyes' ? 300 : 120)));
  const px = cv.getContext('2d', { willReadFrequently: true }).getImageData(Math.max(0, x - r), Math.max(0, y - r), 2 * r + 1, 2 * r + 1).data, ch = [[], [], []];
  for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) ch[c].push(px[i + c]);
  const med = ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
  CS.samples[CS.target] = { rgb: med, x: x / cv.width, y: y / cv.height };
  $('#csDots').innerHTML = Object.entries(CS.samples).map(([k, s]) => `<i style="left:${s.x * 100}%;top:${s.y * 100}%;background:${rgbHex(s.rgb)}" title="${esc(CS_TARGETS[k])}"></i>`).join('');
  $('#csSamples').innerHTML = Object.keys(CS_TARGETS).filter(k => CS.samples[k]).map(k => `<li><i style="background:${rgbHex(CS.samples[k].rgb)}"></i><span>${esc(CS_TARGETS[k])}</span></li>`).join('');
  $('#csUseBtn').disabled = !CS.samples.skin;
  const next = Object.keys(CS_TARGETS).find(k => !CS.samples[k]);
  if (next) $(`[data-cs-target="${next}"]`).click();
}
function csApplySamples() {
  const s = CS.samples; if (!s.skin) return;
  // A white sample removes the light's colour cast: scale each channel so the white comes out neutral
  const w = s.white && s.white.rgb, avg = w ? (w[0] + w[1] + w[2]) / 3 : 0;
  const fix = rgb => w ? rgb.map((v, i) => v * Math.min(1.8, Math.max(0.55, avg / Math.max(1, w[i])))) : rgb;
  const lab = {}; ['skin', 'hair', 'eyes'].forEach(k => { if (s[k]) lab[k] = rgbLab(fix(s[k].rgb)); });
  const set = (kind, opt) => { const q = K.colourQuiz.find(x => x.photo === kind); if (q && opt) { CS.answers[q.id] = opt; CS.from[q.id] = true; } };
  const nearest = (kind, l, lightOnly) => { const q = K.colourQuiz.find(x => x.photo === kind); if (!q) return null; return q.options.filter(o => o.hex).map(o => { const ol = labOf(o.hex); return { o, d: lightOnly ? Math.abs(ol[0] - l[0]) : dE(ol, l) }; }).sort((a, b) => a.d - b.d)[0].o.id; };
  set('skin', nearest('skin', lab.skin, true));
  const hue = Math.atan2(lab.skin[2], lab.skin[1]) * 180 / Math.PI; // skin's hue angle: lower is pinker, higher is more golden
  set('undertone', hue > 68 ? 'golden' : hue < 55 ? 'pink' : 'neutral');
  if (lab.hair) set('hair', nearest('hair', lab.hair));
  if (lab.eyes) set('eyes', nearest('eyes', lab.eyes));
  if (lab.hair) { const diff = Math.max(Math.abs(lab.skin[0] - lab.hair[0]), lab.eyes ? Math.abs(lab.skin[0] - lab.eyes[0]) : 0); set('contrast', diff >= 45 ? 'high' : diff < 25 ? 'low' : 'medium'); }
  const cv = $('#csCanvas'); if (cv) cv.width = cv.height = 0; CS.samples = {};
  closeDrawer(); render(); toast('Answers suggested from your photo. Check them, then see the suggestion.', 5000);
  const r = $('#csResult'); if (r) r.scrollIntoView({ block: 'center' });
}
$('#csIn').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) csPhoto(f); });
// On the Colour tab a dropped photo goes to the sampler, never into the closet
addEventListener('dragenter', e => { if (tab === 'colour' && isFileDrag(e) && !$('#layer').innerHTML) setTimeout(() => { const p = $('#dropOverlay p'); if (p) p.textContent = 'Drop a photo of your face to sample its colours. It stays on this device.'; }); });
addEventListener('drop', e => {
  if (tab !== 'colour' || !isFileDrag(e) || $('#layer').innerHTML) return;
  e.preventDefault(); e.stopImmediatePropagation(); dragDepth = 0; const d = $('#dropOverlay'); if (d) d.remove();
  const f = [...e.dataTransfer.files].find(isImage); if (f) csPhoto(f); else toast('Only photos can be used (JPEG, PNG, WebP).');
}, true);
