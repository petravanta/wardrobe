'use strict';
/* ---------- Adding photos: button, drop, one path ---------- */
async function takePhotos(files, target) {
  const all = [...files], imgs = all.filter(isImage), skipped = all.length - imgs.length;
  if (!imgs.length) return toast('Only photos can be added (JPEG, PNG, WebP, HEIC).');
  // A new main photo gets a cut-out made in the background, unless the item has one already (some imports do)
  const clean = [];
  if (target) { // into the item being edited
    let cleanPhoto = false;
    for (const f of imgs) {
      // An item made from an outfit photo has only its crop: the first real photo becomes its main photo
      const p = { id: await Photos.add(f), role: (target.photos || []).some(x => x.role === 'main') ? 'label' : 'main' };
      target.photos = [...(target.photos || []), p];
      if (p.role === 'main') cleanPhoto = true;
      if (p.role === 'main' && !target.photos.some(x => x.role === 'cutout')) clean.push([target.id, p.id]);
    }
    const cur = readItemForm(target); itemForm({ ...cur, photos: target.photos, ...(cleanPhoto && cur.followUp ? { followUp: undefined } : {}) });
    if (cleanPhoto && cur.followUp) toast('Clean photo added. Save to take it off the “needs a clean photo” list.');
  } else { // one new item per photo; open the first to fill in
    const made = [];
    for (const f of imgs) { const it = newItem(); it.photos = [{ id: await Photos.add(f), role: 'main' }]; it.name = ''; made.push(it); clean.push([it.id, it.photos[0].id]); }
    if (made.length > 1) { made.forEach(it => put('items', it)); render(); }
    itemForm(made[0]);
  }
  if (autoCutout()) clean.forEach(([item, photo]) => cleanBackground(item, photo));
  if (skipped) toast(`Skipped ${skipped} file${skipped > 1 ? 's' : ''} that ${skipped > 1 ? 'aren’t photos' : 'isn’t a photo'}`);
}
let dragDepth = 0;
const isFileDrag = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
function dropLabel(n) { if (!editing && !$('#layer').innerHTML && tab === 'worn' && Recognise.supported) return 'Drop to log what you wore from this photo'; return editing ? `Drop to add ${n > 1 ? n + ' photos' : 'the photo'} to ${editing.name || 'this item'}` : `Drop to add ${n > 1 ? n + ' items' : 'an item'} to your closet`; }
addEventListener('dragenter', e => {
  if (!isFileDrag(e)) return; e.preventDefault();
  if (dragDepth++ === 0) { const d = document.createElement('div'); d.className = 'drop'; d.id = 'dropOverlay'; d.innerHTML = `<p>${esc(dropLabel(e.dataTransfer.items ? e.dataTransfer.items.length : 1))}</p>`; document.body.appendChild(d); }
});
addEventListener('dragleave', e => { if (isFileDrag(e) && --dragDepth <= 0) { dragDepth = 0; const d = $('#dropOverlay'); d && d.remove(); } });
addEventListener('dragover', e => { if (isFileDrag(e)) e.preventDefault(); });
addEventListener('drop', e => {
  if (!isFileDrag(e)) return; e.preventDefault(); dragDepth = 0; const d = $('#dropOverlay'); d && d.remove();
  if ($('#layer').innerHTML && !editing) return toast('Close this panel to add photos');
  if (!editing && tab === 'worn' && Recognise.supported) { const f = [...e.dataTransfer.files].find(isImage); return f ? woreFromPhoto(f) : toast('Only photos can be used (JPEG, PNG, WebP, HEIC).'); }
  takePhotos(e.dataTransfer.files, editing);
});
$('#photoIn').addEventListener('change', e => { takePhotos(e.target.files, editing); e.target.value = ''; });
// From the user's Google Photos, chosen in Google's picker. Into the item being edited, or one new item per photo.
let picking = false;
async function pickPhotos(target) {
  if (picking) return toast('Google Photos is already open. Choose your photos there.');
  if (!GPhotos.live()) { // this tap opens Google's sign-in, so the picker needs the next one
    try { await GPhotos.renew(); toast('Reconnected to Google Photos. Tap again to choose photos.'); }
    catch (err) { toast(err && err.code === 'offline' ? 'You’re offline' : 'Couldn’t reconnect to Google Photos'); }
    return;
  }
  const win = open('about:blank', '_blank');
  if (!win) return toast('Your browser blocked the Google Photos window. Allow pop-ups for this site and try again.', 6000);
  picking = true; toast('Choose photos in Google Photos, then tap Done', 60000);
  try {
    const { files, failed, videos } = await GPhotos.pick(win, (n, all) => toast(`Getting photos from Google Photos: ${n} of ${all}…`, 60000));
    const skip = [failed && `${failed} Google Photos didn’t let this browser download`, videos && `${videos} video${videos > 1 ? 's' : ''}`].filter(Boolean).join(' and ');
    if (!files.length) return toast(failed ? 'Google Photos didn’t let this browser download the photos, so none were added.' : videos ? 'Only photos can be added, not videos.' : 'No photos chosen', 7000);
    if (target && !(editing && editing.id === target.id)) return toast('The item was closed, so the photos weren’t added. Open it and try again.', 6000);
    await takePhotos(files, target ? editing : null);
    toast(`Added ${files.length} photo${files.length > 1 ? 's' : ''} from Google Photos${skip ? `; skipped ${skip}` : ''}`, 6000);
  } catch (err) {
    const c = err && err.code;
    toast(c === 'cancelled' ? 'No photos chosen' : c === 'timeout' ? 'Google Photos took too long. Try again.' : c === 'offline' ? 'You’re offline'
      : c === 'scopes' ? 'Google Photos didn’t allow choosing photos. In Settings, tap Use another account and leave every permission ticked.'
      : c === 'expired' ? 'The Google Photos sign-in ran out. Tap again to reconnect.' : `Couldn’t get photos from Google Photos${err && err.msg ? ` (${err.msg})` : ''}`, 7000);
  } finally { picking = false; }
}
$('#woreIn').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) woreFromPhoto(f); });
