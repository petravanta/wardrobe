'use strict';
function refreshOutfitView() { const v = $('#layer [data-view-outfit]'), o = v && doc.outfits.find(x => x.id === v.dataset.viewOutfit); if (o) outfitForm(structuredClone(o)); }
// A photo for one wearing: stored like any photo, kept with the outfit's worn photos (so it uploads to Google Photos
// the same way), and linked from the wear
async function addWearPhoto(wearId, file) {
  if (!file || !isImage(file)) return toast('Only photos can be used (JPEG, PNG, WebP, HEIC).');
  const w = doc.wears.find(x => x.id === wearId), o = w && doc.outfits.find(x => x.id === w.outfit); if (!o) return;
  const id = await Photos.add(file);
  put('outfits', { ...o, photos: [...(o.photos || []), { id, role: 'worn' }] }); put('wears', { ...w, photo: id });
  render(); refreshOutfitView(); toast('Photo added');
}
function wearForm() {
  const items = doc.items.filter(visible);
  openDrawer(`<h2>Log what I wore</h2>
  <form class="form" id="wearForm">
    <label class="field">Date<input type="text" name="at" value="${today()}"></label>
    ${doc.outfits.length ? `<label class="field">Outfit<select name="outfit"><option value="">Separate items…</option>${doc.outfits.map(o => `<option value="${esc(o.id)}">${esc(o.name || 'Outfit')}</option>`).join('')}</select></label>` : ''}
    <fieldset><legend>Items</legend>${items.length ? `<ul class="grid">${items.map(it => card(it, false)).join('')}</ul>` : '<p class="muted">Add items to your closet first.</p>'}</fieldset>
    ${Recognise.supported ? '<p class="small muted">Or <button type="button" class="btn sm" data-act="wore-photo">log it from a photo</button> of your outfit, and the app suggests the items.</p>' : ''}
    <div class="row"><button type="submit" class="btn primary">Log it</button></div>
  </form>`);
  $('#wearForm').addEventListener('click', e => { const c = e.target.closest('[data-item]'); if (c) { e.stopPropagation(); c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); } }, true);
  $('#wearForm').addEventListener('submit', e => {
    e.preventDefault(); const fd = new FormData(e.target), at = (fd.get('at') || today()).trim(), outfit = fd.get('outfit');
    if (outfit) logWear({ outfit }, at);
    else { const ids = $$('#wearForm [data-item][aria-pressed="true"]').map(b => b.dataset.item); if (!ids.length) return toast('Pick an outfit or at least one item'); ids.forEach(item => logWear({ item }, at)); }
    closeDrawer(); render();
  });
}
function logWear(what, at = today()) { put('wears', { id: uid(), at, source: 'manual', ...what }); toast('Logged'); }
