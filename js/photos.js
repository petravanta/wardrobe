'use strict';
/* ---------- Photos (this browser's copy) ---------- */
// Each item photo is {id, role:'main'|'cutout'|'label'|'crop', from?, mediaItemId?, vec?}; a cut-out's `from` is the photo it was made from,
// a crop is cut from an outfit photo (What I wore), and vec is its matching vector. Outfits keep their outfit photos ({id, role:'worn'}) the same way. The bytes live in IndexedDB here;
// once uploaded, mediaItemId points at the copy in the Wardrobe album in Google Photos and this is a cache of it.
const Photos = (() => {
  let dbp;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('wardrobe', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('photos'); r.result.createObjectStore('thumbs'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  const urls = new Map();
  async function resize(file, max, type = 'image/jpeg', q = .86) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
    return new Promise(r => c.toBlob(r, type, q));
  }
  return {
    // Every way in (button, drop, later the Picker and camera) goes through here: same resizing, same storage
    async add(file) { const id = uid(); await this.put(id, file); return id; },
    // Also how a photo downloaded from the Google Photos album comes back into this browser's cache
    async put(id, file) {
      const png = file.type === 'image/png';
      const [full, thumb] = await Promise.all([resize(file, 1600, png ? 'image/png' : 'image/jpeg'), resize(file, 400, png ? 'image/png' : 'image/jpeg', .8)]);
      await tx('photos', 'readwrite', s => s.put(full, id)); await tx('thumbs', 'readwrite', s => s.put(thumb, id));
      urls.delete(id);
    },
    async full(id) { return tx('photos', 'readonly', s => s.get(id)).catch(() => null); },
    async thumb(id) {
      if (urls.has(id)) return urls.get(id);
      const b = await tx('thumbs', 'readonly', s => s.get(id)).catch(() => null);
      const u = b ? URL.createObjectURL(b) : ''; urls.set(id, u); return u;
    },
    async drop(id) { await tx('photos', 'readwrite', s => s.delete(id)); await tx('thumbs', 'readwrite', s => s.delete(id)); urls.delete(id); }
  };
})();
const isImage = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name);
const coverPhoto = it => { const p = it.photos || []; return p.find(x => x.role === 'cutout') || p.find(x => x.role === 'main') || p[0]; };
// A crop cut from an outfit photo (What I wore) that records where it came from can be made again from that photo, so
// it stays on the device and never goes to Google Photos. Older crops without from/box upload like any photo.
const regenerable = p => !!(p && p.role === 'crop' && p.from && Array.isArray(p.box) && p.box.length === 4 && Array.isArray(p.of));
const photoRec = id => { for (const it of [...doc.items, ...doc.outfits, ...(editing ? [editing] : [])]) for (const p of it.photos || []) if (p.id === id) return p; return null; };
async function regenCrop(p) {
  const src = await Photos.full(p.from); if (!src) return false;
  const bmp = await createImageBitmap(src), [x, y, w, h] = p.box, sx = bmp.width / p.of[0], sy = bmp.height / p.of[1];
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * sx)); c.height = Math.max(1, Math.round(h * sy));
  c.getContext('2d').drawImage(bmp, x * sx, y * sy, w * sx, h * sy, 0, 0, c.width, c.height); bmp.close && bmp.close();
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); if (!blob) return false;
  await Photos.put(p.id, new File([blob], 'crop.png', { type: 'image/png' })); return true;
}
// Where the crop's outfit photo is only shown from Google Photos (another device: its bytes can't be copied), the
// browser shows just the crop's part of it
const cropView = (img, p) => { const [x, y, w, h] = p.box, [W, H] = p.of, pc = v => `${(v * 100).toFixed(2)}%`; img.style.objectViewBox = `inset(${pc(y / H)} ${pc(1 - (x + w) / W)} ${pc(1 - (y + h) / H)} ${pc(x / W)})`; };
// A photo this browser doesn't have yet (added on another device) comes down from the Google Photos album
async function fillThumbs(root = document) {
  const missing = [];
  for (const img of $$('img[data-photo]', root)) if (!img.getAttribute('src')) {
    const id = img.dataset.photo; let u = await Photos.thumb(id) || GPhotos.direct(id);
    const p = !u && photoRec(id);
    if (regenerable(p)) {
      if (await regenCrop(p).catch(() => false)) { u = await Photos.thumb(id); }
      else { const d = GPhotos.direct(p.from), m = mediaIdOf(p.from); if (d) { cropView(img, p); u = d; } else if (m && GPhotos.live()) { missing.push([p.from, m]); continue; } }
    }
    const m = mediaIdOf(id);
    if (u) img.src = u; else if (m && GPhotos.live()) missing.push([id, m]); else img.remove();
  }
  if (missing.length && await GPhotos.fetchMissing(missing)) fillThumbs(root);
}
// A photo's album copy, in the Google account Photos is connected to now (mediaAccount says which account it went to)
const inAlbum = p => !!(p && p.mediaItemId && p.mediaAccount && p.mediaAccount === doc.settings.photosAccount);
const mediaIdOf = id => { for (const it of [...doc.items, ...doc.outfits, ...(editing ? [editing] : [])]) for (const p of it.photos || []) if (p.id === id && inAlbum(p)) return p.mediaItemId; return null; };
