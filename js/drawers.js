'use strict';
/* ---------- Drawers ---------- */
function openDrawer(html, cls = '') {
  $('#layer').innerHTML = `<div class="scrim" data-close></div><div class="drawer${cls ? ' ' + cls : ''}" role="dialog" aria-modal="true"><button type="button" class="x" data-close aria-label="Close">×</button>${html}</div>`;
  fillThumbs($('#layer'));
  const f = $('#layer input,#layer select,#layer textarea'); if (f) f.focus();
}
function closeDrawer() {
  if (typeof Arrange !== 'undefined' && Arrange.on) Arrange.stop();
  const back = outfitReturn && editing && editing.id === outfitReturn.item ? outfitReturn : null; outfitReturn = null;
  $('#layer').innerHTML = ''; editing = null;
  // An item opened from an outfit's figure goes back to that outfit when it's saved or closed
  // (with what its form held, when it was opened from the form's item picker)
  if (back) { const o = back.draft || doc.outfits.find(x => x.id === back.outfit); if (o) { render(); outfitForm(structuredClone(o)); } }
  if (wore) { wore.pieces.forEach(pc => URL.revokeObjectURL(pc.url)); URL.revokeObjectURL(wore.url); if (!wore.saved) Photos.drop(wore.photo); wore = null; } // a cancelled What I wore keeps nothing
}
