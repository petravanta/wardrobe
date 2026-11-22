'use strict';
/* ---------- Wardrobe words ---------- */
// Your own words for your clothes (goth, cozy, capsule…): records in doc.words {id, name, colour}, so a rename or a
// new colour is one record and syncs by u. Items keep word ids in item.words. Deleting a word takes it off every item;
// an id whose word was deleted on another device is skipped, and dropped when that item is next saved.
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
  [...doc.items, ...doc.outfits].forEach(it => { if ((it.words || []).includes(id)) { it.words = it.words.filter(x => x !== id); it.u = t; } });
  const f = F(); if ((f.words || []).includes(id)) doc.settings = { ...doc.settings, filters: { ...f, words: f.words.filter(x => x !== id) }, updatedAt: t };
  remove('words', id);
}
// Tags or untags many items at once; only the items shown in the picker change, so hidden spicy items keep their words
function setWordOn(id, shown, on) {
  const t = now();
  shown.forEach(it => { const has = (it.words || []).includes(id); if (has === on.has(it.id)) return; it.words = has ? it.words.filter(x => x !== id) : [...(it.words || []), id]; it.u = t; });
  save();
}
