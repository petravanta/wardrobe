// Lets the app install and open offline: see https://github.com/petravanta/general/blob/main/STANDARDS.md#installing-on-a-phone
self.APP_SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon.svg',
  'data/types.json', 'data/colours.json', 'data/materials.json', 'data/seasons.json',
  'data/occasions.json', 'data/care.json', 'data/size-systems.json', 'data/gender-tags.json'];
importScripts('../general/shared/app-sw.js');

// Clean background (README): the model and its WebAssembly files sit under a versioned path and never change, so they
// are kept cache-first after the first cut-out, which then works offline. Only the current version's cache is kept.
var CUTOUT_CACHE = 'wardrobe-cutout-1.7.0';
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('wardrobe-cutout-') === 0 && k !== CUTOUT_CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).hostname !== 'staticimgly.com') return;
  e.respondWith(caches.open(CUTOUT_CACHE).then(function (c) {
    return c.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
    });
  }));
});
