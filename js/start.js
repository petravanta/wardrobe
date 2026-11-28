'use strict';
function remoteIn(data) { doc = mergeDocs(doc, data); lsSet(KEY, doc); if (!$('#layer').innerHTML) render(); }
function showSaveState() {
  const el = $('#saveState'), p = store.known && store.problem;
  const t = store.known ? store.status() || 'Saved in this browser' : 'Saved in this browser';
  el.textContent = t; el.dataset.state = p ? p.kind : !store.known || store.needsTap ? 'local' : /saving/i.test(t) ? 'saving' : 'ok';
}
addEventListener('storage', e => { if (e.key === KEY && !$('#layer').innerHTML) { doc = upgrade(lsGet(KEY)); render(); } });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && store.known && store.live() && await store.refresh()) remoteIn(store.data);
});

/* ---------- Start ---------- */
(async () => {
  try { await loadKnowledge(); }
  catch (e) { $('#main').innerHTML = `<div class="empty">Couldn’t load the app’s built-in lists (${esc(e.message)}). Check your connection and reload.</div>`; return; }
  { const was = JSON.stringify(doc); doc = upgrade(doc); if (JSON.stringify(doc) !== was) lsSet(KEY, doc); } // moves that need the built-in lists (migrateGenderTags)
  if (store.known && store.data) doc = mergeDocs(doc, store.data);
  render(); showSaveState();
  // Home-screen shortcuts: ?do=add-item, ?do=log-wear
  const act = new URLSearchParams(location.search).get('do');
  if (act) { history.replaceState(null, '', location.pathname); if (act === 'add-item') itemForm(newItem()); if (act === 'log-wear') wearForm(); }
  if (store.known && store.live()) {
    try { doc = mergeDocs(doc, await store.load(false)); lsSet(KEY, doc); store.save(doc); remoteIn(doc); } catch (e) { showSaveState(); }
  }
  GPhotos.sync();
})();
