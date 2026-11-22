'use strict';
/* ---------- Backup ---------- */
function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'wardrobe', saved: now(), ...doc }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Wardrobe backup ${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
$('#backupIn').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!LISTS.some(l => Array.isArray(d[l]))) throw 0; doc = mergeDocs(doc, d); save(); render(); toast('Backup merged in'); }
  catch (err) { toast('That file isn’t a Wardrobe backup'); }
});
