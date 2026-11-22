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
// A photo this browser doesn't have yet (added on another device) comes down from the Google Photos album
async function fillThumbs(root = document) {
  const missing = [];
  for (const img of $$('img[data-photo]', root)) if (!img.getAttribute('src')) {
    const id = img.dataset.photo, u = await Photos.thumb(id) || GPhotos.direct(id), m = mediaIdOf(id);
    if (u) img.src = u; else if (m && GPhotos.live()) missing.push([id, m]); else img.remove();
  }
  if (missing.length && await GPhotos.fetchMissing(missing)) fillThumbs(root);
}
// A photo's album copy, in the Google account Photos is connected to now (mediaAccount says which account it went to)
const inAlbum = p => !!(p && p.mediaItemId && p.mediaAccount && p.mediaAccount === doc.settings.photosAccount);
const mediaIdOf = id => { for (const it of [...doc.items, ...doc.outfits, ...(editing ? [editing] : [])]) for (const p of it.photos || []) if (p.id === id && inAlbum(p)) return p.mediaItemId; return null; };
