// Lets the app install and open offline: see https://github.com/petravanta/general/blob/main/STANDARDS.md#installing-on-a-phone
self.APP_SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon.svg',
  'data/types.json', 'data/colours.json', 'data/materials.json', 'data/seasons.json',
  'data/occasions.json', 'data/care.json', 'data/size-systems.json', 'data/gender-tags.json',
  'data/colour-seasons.json', 'data/colour-quiz.json', 'data/cosmetic-types.json', 'data/finishes.json', 'data/face-zones.json',
  'css/theme.css', 'css/app.css', 'js/core.js', 'js/data.js', 'js/tags.js', 'js/photos.js',
  'js/cutout.js', 'js/wore.js', 'js/filters.js', 'js/sort.js', 'js/colour.js', 'js/cosmetics.js', 'js/looks.js', 'js/closet.js',
  'js/outfits.js', 'js/worn.js', 'js/stats.js', 'js/settings.js', 'js/drawers.js', 'js/zoom.js', 'js/forms.js',
  'js/arrange.js', 'js/wears.js', 'js/add-photos.js', 'js/backup.js', 'js/import.js', 'js/events.js',
  'js/toast.js', 'js/shared/google-token.js', 'js/shared/drive-store.js', 'js/drive.js', 'js/gphotos.js', 'js/start.js'];
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

// What I wore (README): transformers.js keeps the recognition models in its own Cache Storage; this keeps the ONNX Runtime
// WebAssembly it loads from jsDelivr, under a versioned path that never changes, so recognition also works offline.
var RECOGNISE_CACHE = 'wardrobe-recognise-3.8.1', RECOGNISE_PATH = '/npm/@huggingface/transformers@3.8.1/';
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('wardrobe-recognise-') === 0 && k !== RECOGNISE_CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname !== 'cdn.jsdelivr.net' || url.pathname.indexOf(RECOGNISE_PATH) !== 0) return;
  e.respondWith(caches.open(RECOGNISE_CACHE).then(function (c) {
    return c.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
    });
  }));
});
