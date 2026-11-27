'use strict';
/* ---------- Tags ---------- */
// Your own tags for your clothes (goth, cozy, capsule…): records in doc.words {id, name, colour, emoji?}, so a rename or a
// new colour is one record and syncs by u. (Called "wardrobe words" before; the list keeps its name, `words`, so older
// copies still merge.) Items and outfits keep tag ids in .words. Deleting a tag takes it off every item; an id whose tag
// was deleted on another device is skipped, and dropped when that item is next saved.
const WORD_COLOURS = ['#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#2563eb', '#475569', '#1f2937'];
const wordById = id => doc.words.find(w => w.id === id);
const wordByName = n => doc.words.find(w => w.name.toLowerCase() === n.toLowerCase());
const sortedWords = () => [...doc.words].sort((a, b) => a.name.localeCompare(b.name));
const wordsOf = it => (it.words || []).map(wordById).filter(Boolean);
// A word shows its emoji when it has one, otherwise its colour dot
const wordMark = w => w.emoji ? `<i class="wemoji" aria-hidden="true">${esc(w.emoji)}</i>` : `<i class="swatch" style="background:${esc(w.colour || '#888')}"></i>`;
const wordChip = w => `${wordMark(w)}${esc(w.name)}`;
const WORD_EMOJI = ['🖤', '🦇', '🕸️', '💀', '🌹', '⛓️', '🌙', '✨', '🔥', '💜', '🏳️‍⚧️', '🧸', '☕', '🍂', '❄️', '☀️', '🌸', '💼', '🎉', '👠', '🧥', '🌿', '💎', '🚀'];
// Keeps one short emoji (or a few characters) so a pasted sentence can't end up on every chip
const cleanEmoji = v => { const t = String(v || '').trim().split(/\s+/)[0]; if (!t) return ''; const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter().segment(t)].map(x => x.segment) : [...t]; return seg.slice(0, 2).join(''); };
// Returns the word with this name, making it if it's new
function addWord(name) {
  name = String(name || '').trim().replace(/\s+/g, ' '); if (!name) return null;
  const have = wordByName(name); if (have) return have;
  const w = { id: uid(), name, colour: WORD_COLOURS[doc.words.length % WORD_COLOURS.length] }; put('words', w); return w;
}
function deleteWord(id) {
  const t = now();
  [...doc.items, ...doc.outfits, ...doc.cosmetics].forEach(it => { if ((it.words || []).includes(id)) { it.words = it.words.filter(x => x !== id); it.u = t; } });
  const f = F(); if ((f.words || []).includes(id)) doc.settings = { ...doc.settings, filters: { ...f, words: f.words.filter(x => x !== id) }, updatedAt: t };
  remove('words', id);
}
// Tags or untags many items at once; only the items shown in the picker change, so hidden spicy items keep their words
function setWordOn(id, shown, on) {
  const t = now();
  shown.forEach(it => { const has = (it.words || []).includes(id); if (has === on.has(it.id)) return; it.words = has ? it.words.filter(x => x !== id) : [...(it.words || []), id]; it.u = t; });
  save();
}

// Gender tags people typed themselves (anything not in data/gender-tags.json) are now ordinary tags. Runs in upgrade(),
// so a copy from another device or an old backup is moved too. A tag with the same name is reused; otherwise the new
// tag's id, colour and time come from its name, so two devices moving the same tag make the same record.
const TAGS_MOVED_AT = '2026-11-22T00:00:00.000Z';
const tagHash = s => [...s].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);
function migrateGenderTags(d) {
  const builtin = new Set(K.genderTags.map(g => g.id)), gone = new Set(d.deleted || []);
  const custom = g => g && !builtin.has(g);
  if (!d.items.some(it => (it.gender || []).some(custom)) && !((d.settings.filters || {}).gender || []).some(custom)) return;
  const tagFor = name => {
    name = String(name); const low = name.toLowerCase();
    const w = d.words.find(x => x.name.toLowerCase() === low); if (w) return w.id;
    const id = 'tag-' + (low.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x') + '-' + tagHash(low).toString(36);
    if (gone.has(id)) return id; // deleted on some device: the id stays on the item and is skipped, like any deleted tag
    if (!d.words.some(x => x.id === id)) d.words = [...d.words, { id, u: TAGS_MOVED_AT, name, colour: WORD_COLOURS[tagHash(low) % WORD_COLOURS.length] }];
    return id;
  };
  d.items = d.items.map(it => {
    const extra = (it.gender || []).filter(custom); if (!extra.length) return it;
    return { ...it, gender: it.gender.filter(g => !custom(g)), words: [...new Set([...(it.words || []), ...extra.map(tagFor)])] };
  });
  const f = d.settings.filters || {}, fx = (f.gender || []).filter(custom);
  if (fx.length) d.settings = { ...d.settings, filters: { ...f, gender: f.gender.filter(g => !custom(g)), words: [...new Set([...(f.words || []), ...fx.map(tagFor)])] } };
}

// The tag picker in the item and outfit forms: chosen tags as chips (hidden inputs name="words", or name="wordsNew" for
// a new name), then a box that finds known tags as you type (most used first), or makes a new one with Enter.
const tagUse = () => { const n = new Map(); [...doc.items.filter(visible), ...doc.outfits, ...doc.cosmetics].forEach(x => (x.words || []).forEach(id => n.set(id, (n.get(id) || 0) + 1))); return n; };
function wordsField(it) {
  const chosen = wordsOf(it).map(w => ({ id: w.id, name: w.name }));
  return `<fieldset class="tagpick" data-tagpick><legend>Tags</legend>
    <div class="chips" data-tag-chosen>${tagChosenHtml(chosen)}</div>
    <label class="sr-only" for="tagQ">Find or add a tag</label>
    <input type="text" id="tagQ" data-tag-q placeholder="${doc.words.length ? 'Find a tag, or type a new one' : 'Your own tags, like goth or cozy'}" autocomplete="off" enterkeyhint="done">
    <div class="chips tag-sugg" data-tag-sugg>${tagSuggHtml(chosen, '')}</div></fieldset>`;
}
const tagChosenHtml = list => list.length ? list.map(c => {
  const w = c.id && wordById(c.id);
  return `<button type="button" class="chip" aria-pressed="true" data-tag-off="${esc(c.id || c.name)}" aria-label="Remove ${esc(c.name)}">${w ? wordChip(w) : `<i class="swatch" style="background:#888"></i>${esc(c.name)}`}<span aria-hidden="true"> ×</span></button>${c.id ? `<input type="hidden" name="words" value="${esc(c.id)}">` : `<input type="hidden" name="wordsNew" value="${esc(c.name)}">`}`;
}).join('') : '<span class="small muted">No tags yet</span>';
function tagSuggHtml(chosen, q) {
  q = q.trim().replace(/\s+/g, ' '); const ql = q.toLowerCase(), have = new Set(chosen.filter(c => c.id).map(c => c.id)), use = tagUse();
  const list = doc.words.filter(w => !have.has(w.id) && (!ql || w.name.toLowerCase().includes(ql)))
    .sort((a, b) => (ql ? (b.name.toLowerCase().startsWith(ql) - a.name.toLowerCase().startsWith(ql)) : 0) || (use.get(b.id) || 0) - (use.get(a.id) || 0) || a.name.localeCompare(b.name));
  const exact = ql && (doc.words.some(w => w.name.toLowerCase() === ql) || chosen.some(c => c.name.toLowerCase() === ql));
  return list.map(w => `<button type="button" class="chip" data-tag-on="${esc(w.id)}">${wordChip(w)}</button>`).join('') +
    (q && !exact ? `<button type="button" class="chip" data-tag-new="${esc(q)}">+ New tag “${esc(q)}”</button>` : '');
}
const tagPickState = fs => $$('[data-tag-off]', fs).map(b => { const w = wordById(b.dataset.tagOff); return w ? { id: w.id, name: w.name } : { name: b.dataset.tagOff }; });
function tagPickSet(fs, chosen, keepQ) {
  const q = $('[data-tag-q]', fs); if (!keepQ) q.value = '';
  $('[data-tag-chosen]', fs).innerHTML = tagChosenHtml(chosen); $('[data-tag-sugg]', fs).innerHTML = tagSuggHtml(chosen, q.value);
}
function tagPickAdd(fs, name) {
  name = String(name || '').trim().replace(/\s+/g, ' '); if (!name) return;
  const chosen = tagPickState(fs), w = wordByName(name);
  if (!chosen.some(c => c.name.toLowerCase() === name.toLowerCase())) chosen.push(w ? { id: w.id, name: w.name } : { name });
  tagPickSet(fs, chosen); $('[data-tag-q]', fs).focus();
}
document.addEventListener('click', e => {
  const fs = e.target.closest('[data-tagpick]'); if (!fs) return;
  const on = e.target.closest('[data-tag-on]'), off = e.target.closest('[data-tag-off]'), nw = e.target.closest('[data-tag-new]');
  if (on) { const w = wordById(on.dataset.tagOn); if (w) tagPickAdd(fs, w.name); }
  if (nw) tagPickAdd(fs, nw.dataset.tagNew);
  if (off) { const k = off.dataset.tagOff.toLowerCase(); tagPickSet(fs, tagPickState(fs).filter(c => (c.id || c.name).toLowerCase() !== k), true); }
});
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.tagQ !== undefined) { const fs = e.target.closest('[data-tagpick]'); $('[data-tag-sugg]', fs).innerHTML = tagSuggHtml(tagPickState(fs), e.target.value); } });
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.dataset || e.target.dataset.tagQ === undefined) return;
  e.preventDefault(); const v = e.target.value.trim(); if (v) tagPickAdd(e.target.closest('[data-tagpick]'), v); // a known name is reused, whatever its case
});
// The tag ids a submitted form ends up with: tags that only exist on another device stay, new names become tags
const formWords = (fd, cur) => [...new Set([...(cur.words || []).filter(id => !wordById(id) && !doc.deleted.includes(id)), ...fd.getAll('words'), ...fd.getAll('wordsNew').map(n => (addWord(n) || {}).id)].filter(Boolean))];
