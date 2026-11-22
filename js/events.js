'use strict';
/* ---------- Events ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-close]'); if (!t) return;
  const d = t.dataset;
  if (d.close !== undefined) return closeDrawer();
  if (d.tab) { tab = d.tab; lsSet(TAB_KEY, tab); return render(); }
  if (d.act === 'add') return itemForm(newItem());
  if (d.act === 'photo') return $('#photoIn').click();
  if (d.act === 'clear') { setSetting('filters', {}); sizePopOpen = false; reviewOpen = false; return render(); }
  if (d.act === 'reverse') { setSetting('sortReverse', !doc.settings.sortReverse); return render(); }
  if (d.act === 'new-outfit') return outfitForm({ id: uid(), items: [] });
  if (d.act === 'log-wear') return wearForm();
  if (d.act === 'wore-photo') return $('#woreIn').click();
  if (d.act === 'wore-save') return saveWore();
  if (d.woreDate) { $('#wAt').value = d.woreDate; return; }
  if (d.act === 'index') {
    t.disabled = true; Recognise.progress(list => { const n = downloadNote(list); if (n) toast(n, 60000); });
    try { const left = await indexCloset(m => toast(m, 60000)); toast(left ? `Done. ${left} item${left > 1 ? 's' : ''} can only be prepared where ${left > 1 ? 'their photos were' : 'its photo was'} added.` : 'Your closet is ready for matching'); }
    catch (err) { toast(`Couldn’t prepare the closet: ${err.message || err}`, 6000); }
    finally { Recognise.progress(null); render(); }
    return;
  }
  if (d.act === 'export') return exportBackup();
  if (d.act === 'import') return $('#backupIn').click();
  if (d.act === 'import-closet') return $('#closetIn').click();
  if (d.act === 'add-word') { const i = $('#newWord'), n = i.value.trim(); if (!n) return i.focus(); if (wordByName(n)) return toast(`You already have “${n}”`); addWord(n); render(); return $('#newWord').focus(); }
  if (d.fword) { const s = new Set(F().words || []); s.has(d.fword) ? s.delete(d.fword) : s.add(d.fword); return setFilter('words', [...s]); }
  if (d.wordItems) { const w = wordById(d.wordItems); return w && wordItemsForm(w); }
  if (d.delWord) { const w = wordById(d.delWord), n = doc.items.filter(it => visible(it) && (it.words || []).includes(d.delWord)).length; if (w && confirm(`Delete “${w.name}”?${n ? ` It comes off ${n} item${n === 1 ? '' : 's'}; the items stay.` : ''}`)) { deleteWord(w.id); render(); } return; }
  if (d.fam) { const s = new Set(F().families || []); s.has(d.fam) ? s.delete(d.fam) : s.add(d.fam); return setFilter('families', [...s]); }
  if (d.gender) { const s = new Set(F().gender || []); s.has(d.gender) ? s.delete(d.gender) : s.add(d.gender); return setFilter('gender', [...s]); }
  if (d.spicy !== undefined) return setFilter('spicyOnly', !F().spicyOnly);
  if (d.follow !== undefined) return setFilter('followUp', !F().followUp);
  if (d.miss) { const cur = F().missing || []; reviewOpen = true; return setFilter('missing', cur.includes(d.miss) ? cur.filter(k => k !== d.miss) : [...cur, d.miss]); }
  if (d.act === 'review') { const on = reviewOpen || (F().missing || []).length; reviewOpen = !on; if (on) return setFilter('missing', []); return render(); }
  if (d.act === 'review-done') { reviewOpen = false; return setFilter('missing', []); }
  if (d.item && t.closest('#wMissed')) return t.setAttribute('aria-pressed', String(t.getAttribute('aria-pressed') !== 'true'));
  if (d.item && !t.closest('#layer')) return itemForm(structuredClone(itemById(d.item)));
  if (d.outfit) return outfitForm(structuredClone(doc.outfits.find(o => o.id === d.outfit)));
  if (d.rmphoto && editing) { // a photo's cut-out goes with it
    const gone = editing.photos.filter(p => p.id === d.rmphoto || p.from === d.rmphoto);
    editing.photos = editing.photos.filter(p => !gone.includes(p)); gone.forEach(p => Photos.drop(p.id)); GPhotos.unlink(gone);
    return itemForm({ ...readItemForm(editing), photos: editing.photos });
  }
  if (d.cutout && editing) return cleanBackground(editing.id, d.cutout);
  if (d.wearItem) { logWear({ item: d.wearItem }); return closeDrawer(), render(); }
  if (d.wearOutfit) { logWear({ outfit: d.wearOutfit }); return closeDrawer(), render(); }
  if (d.unwear) { remove('wears', d.unwear); render(); return refreshOutfitView(); }
  if (d.delItem && confirm('Delete this item? Outfits and the wear log keep their other items.')) { const it = itemById(d.delItem); remove('items', d.delItem); (it.photos || []).forEach(p => Photos.drop(p.id)); GPhotos.unlink(it.photos || []); closeDrawer(); return render(); }
  if (d.delOutfit && confirm('Delete this outfit? Its items stay in your closet.')) { const o = doc.outfits.find(x => x.id === d.delOutfit) || {}; remove('outfits', d.delOutfit); (o.photos || []).forEach(p => Photos.drop(p.id)); GPhotos.unlink(o.photos || []); closeDrawer(); return render(); }
  if (d.gphotos === 'pick') return pickPhotos(editing);
  if (d.gphotos === 'off') { GPhotos.signOut(); render(); return toast('Disconnected from Google Photos. The album and its photos stay in your Google Photos.'); }
  if (d.gphotos === 'on') {
    try { await GPhotos.connect(); render(); toast('Connected to Google Photos'); }
    catch (err) { if (err && err.code === 'cancelled') return render(); toast(err && err.code === 'offline' ? 'You’re offline' : err && err.code === 'scopes' ? 'Google Photos needs all the permissions it asked for. Try again and leave them ticked.' : 'Couldn’t connect to Google Photos'); render(); }
    return;
  }
  if (d.drive === 'off') { store.signOut(); render(); return toast('Disconnected. Your wardrobe stays in this browser.'); }
  if (d.drive === 'on') {
    try { doc = mergeDocs(doc, await store.load(true)); save(); render(); toast('Connected to Google Drive'); }
    catch (err) { toast(err && err.code === 'offline' ? 'You’re offline' : 'Couldn’t connect to Google Drive'); render(); }
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'itemForm') return;
  e.preventDefault(); const it = readItemForm(editing);
  if (!it.name) it.name = kname('types', it.type);
  put('items', it); closeDrawer(); render(); toast('Saved');
});
document.addEventListener('change', e => {
  if (e.target.dataset.wearPhoto !== undefined) return addWearPhoto(e.target.dataset.wearPhoto, e.target.files[0]);
  if (e.target.id === 'showSpicy') { setSetting('showSpicy', e.target.checked); render(); }
  if (e.target.id === 'autoCutout') setSetting('autoCutout', e.target.checked);
  if (e.target.dataset.kind !== undefined && wore) setPieceKind(+e.target.dataset.kind, e.target.value);
  if (e.target.id === 'fGroup') setFilter('group', e.target.value);
  if (e.target.id === 'sSort') { setSetting('sort', e.target.value); render(); }
  if (e.target.id === 'sGroup') { setSetting('groupBy', e.target.value); render(); }
  const wd = e.target.dataset || {};
  if (wd.wordEmoji) { const w = wordById(wd.wordEmoji), v = cleanEmoji(e.target.value); if (w && v !== (w.emoji || '')) { const { emoji, ...rest } = w; put('words', v ? { ...rest, emoji: v } : rest); render(); } }
  if (wd.wordColour) { const w = wordById(wd.wordColour); if (w) { put('words', { ...w, colour: e.target.value }); render(); } }
  if (wd.wordName) {
    const w = wordById(wd.wordName), n = e.target.value.trim().replace(/\s+/g, ' '), other = n && wordByName(n);
    if (!w) return;
    if (!n || (other && other.id !== w.id)) { e.target.value = w.name; return toast(n ? `You already have “${n}”` : 'A word needs a name'); }
    if (n !== w.name) { put('words', { ...w, name: n }); render(); }
  }
});
let qTimer;
document.addEventListener('input', e => { if (e.target.id === 'q') { clearTimeout(qTimer); qTimer = setTimeout(() => { setFilter('q', e.target.value); const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); } });
document.addEventListener('keydown', e => {
  if (Zoom.key(e)) return;
  if (typeof WoreCrop !== 'undefined' && WoreCrop.key(e)) return;
  if (Arrange.key(e)) return;
  if (e.key === 'Escape' && sizePopOpen && $('#fSizePop')) { e.preventDefault(); return setSizePop(false); }
  // What I wore: the arrow keys step between pieces, except while typing or choosing in a field
  if (wore && wore.step >= 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(e.target.closest && e.target.closest('input,select,textarea'))) { e.preventDefault(); return woreGo(e.key === 'ArrowRight' ? 1 : -1); }
  if (e.key === 'Escape' && $('#layer').innerHTML) closeDrawer();
  if (e.key === 'Enter' && e.target.id === 'newWord') { e.preventDefault(); $('[data-act="add-word"]').click(); }
  if (e.key === 'Enter' && e.target.dataset && (e.target.dataset.wordName || e.target.dataset.wordEmoji)) e.target.blur();
});
