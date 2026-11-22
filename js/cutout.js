'use strict';
/* ---------- Clean background (on this device) ---------- */
// The cut-out is a second photo {role:'cutout', from: <the photo it came from>}; the original is always kept. The model
// runs in cutout-worker.js (WebGPU where there is one, otherwise WebAssembly). Photos never leave the device: only the
// model's files are downloaded, the first time, and sw.js keeps them. Imported items may come with their own cut-outs.
const Cutout = (() => {
  let worker = null, seq = 0, chain = Promise.resolve();
  const waiting = new Map();
  function w() {
    if (worker) return worker;
    worker = new Worker('cutout-worker.js', { type: 'module' });
    worker.onmessage = e => {
      const m = e.data, job = waiting.get(m.id); if (!job) return;
      if (m.progress) return job.progress(m.progress);
      waiting.delete(m.id);
      if (m.error) { job.reject(new Error(m.error)); reset(); } else job.resolve(m.blob);
    };
    worker.onerror = e => { e.preventDefault(); waiting.forEach(j => j.reject(new Error(e.message || 'The model couldn’t load'))); waiting.clear(); reset(); };
    return worker;
  }
  // A failed load stays failed inside the library, so the next try starts a fresh worker
  function reset() { if (worker) worker.terminate(); worker = null; }
  const run = (blob, progress) => new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject, progress }); w().postMessage({ id, blob }); });
  return {
    supported: typeof Worker === 'function' && typeof OffscreenCanvas === 'function',
    pending: new Set(), // photo ids being cleaned now
    // One at a time: the model is big, and a drop of many photos shouldn't run them all at once
    make(blob, progress = () => {}) { const p = chain.then(() => run(blob, progress)); chain = p.catch(() => {}); return p; }
  };
})();
const autoCutout = () => Cutout.supported && doc.settings.autoCutout !== false;
const mb = n => (n / 1048576).toFixed(0);
async function cleanBackground(itemId, photoId) {
  if (!Cutout.supported || Cutout.pending.has(photoId)) return;
  const src = await Photos.full(photoId); if (!src) return;
  Cutout.pending.add(photoId); refreshThumbs(itemId);
  try {
    const out = await Cutout.make(src, p => {
      if (p.key.startsWith('fetch:/models/') && p.total && p.current < p.total) toast(`Getting the clean-background model (first time only): ${mb(p.current)} of ${mb(p.total)} MB`, 60000);
      else if (p.key === 'compute:inference') toast('Cleaning the background…', 60000);
    });
    const id = await Photos.add(new File([out], 'cutout.png', { type: 'image/png' }));
    toast(attachCutout(itemId, { id, role: 'cutout', from: photoId }) ? 'Background cleaned' : 'Background cleaned, but the item was closed without saving');
  } catch (err) {
    const msg = String(err.message || err);
    toast(`Couldn’t clean the background: ${/fetch|network/i.test(msg) ? 'the model didn’t download. Are you online?' : msg}`, 6000);
  } finally { Cutout.pending.delete(photoId); refreshThumbs(itemId); }
}
// Adds the cut-out to the open form and the saved item, wherever the item is now; a newer cut-out of the same photo replaces the old
function attachCutout(itemId, photo) {
  const old = new Map(), swap = photos => { (photos || []).forEach(p => { if (p.role === 'cutout' && p.from === photo.from) old.set(p.id, { ...old.get(p.id), ...p }); }); return [...(photos || []).filter(p => !(p.role === 'cutout' && p.from === photo.from)), photo]; };
  let used = false;
  if (editing && editing.id === itemId) { editing.photos = swap(editing.photos); used = true; }
  const saved = itemById(itemId);
  if (saved) { put('items', { ...saved, photos: swap(saved.photos) }); used = true; render(); }
  if (!used) Photos.drop(photo.id);
  GPhotos.unlink([...old.values()]);
  old.forEach((p, id) => Photos.drop(id));
  return used;
}
