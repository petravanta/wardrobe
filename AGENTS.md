# Notes for coding agents

Follow the shared standards in [petravanta/general STANDARDS.md](https://github.com/petravanta/general/blob/main/STANDARDS.md)
(locally `../general/STANDARDS.md`). Only Wardrobe specifics are here.

- **Static files, no build step**: `index.html` holds the markup and loads `css/theme.css` (the shared look, a copy of
  `general/shared/theme.css` between its marker comments), `css/app.css`, then the `js/*.js` files with plain `<script>`
  tags in the order listed there. They are classic scripts sharing one global scope, so a file may use functions from
  any other at run time, but code that runs while a file loads can only use files above it. `js/start.js` comes last.
  `js/shared/google-token.js` and `js/shared/drive-store.js` are unchanged copies of `shared/` in the
  [petravanta/general](https://github.com/petravanta/general) repo; when those change, copy them again (from GitHub: a
  local `site/general` folder may be older). A new file needs its `<script>` tag and an entry in `sw.js` (`APP_SHELL`).
- **Accent**: slate, `#475569` light / `#a5b4c8` dark.
- **Built-in knowledge** is in `data/*.json` with schemas in `data/schema/`. Run `node scripts/check-data.js` after
  changing data. Item records refer to entries by id; ids are never renamed or reused.
- **User data**: `localStorage` key `wardrobe.data`; Drive file `petravanta/Wardrobe/Wardrobe data.json` (app id `wardrobe`, key prefix
  `wardrobe.drive`). Lists: `items`, `outfits`, `wears`, `words`; settings include `showSpicy`, `filters`, `sort`, `sortReverse`,
  `groupBy`, `thumbSize` (`s`, `m`, `l`), `autoCutout` (unset means on), `photosAlbum` and `photosAccount`. Merge rules are
  `mergeDocs()`.
- **Photos**: bytes live in IndexedDB database `wardrobe` (`photos` full size, `thumbs` 400 px), keyed by the photo
  id stored on the item. Every way of adding a photo goes through `Photos.add()` / `takePhotos()`.
- **Clean background**: `Cutout` / `cleanBackground()` in `js/cutout.js`, the model in `cutout-worker.js`, the library
  bundled in `vendor/background-removal.js` (generated, don't edit; rebuild steps in the README). A cut-out is a
  photo with `role: 'cutout'` and `from`; the original is never replaced. `sw.js` caches `staticimgly.com` cache-first,
  on purpose. Photos never leave the device for this.
- **What I wore**: `Recognise` / `woreFromPhoto()` / `saveWore()` in `js/wore.js`, the models in `recognise-worker.js`
  (transformers.js bundled unchanged in `vendor/transformers.min.js`). The confirm screen always comes before anything
  is saved. Photo vectors are `photo.vec` and `item.seen`, tagged with `EMBED_ID`; bump it whenever the embedding model
  or its precision changes. A piece's kind maps to `region`s in `data/types.json` through `KINDS`. Items made from a
  crop carry `followUp: true` until a clean photo is added. Outfits can have photos (`role: 'worn'`), which `GPhotos`
  uploads like item photos.
- **Wear photos**: a wear's own photo is `wear.photo`, but the photo record always lives in its outfit's `photos`
  (`role: 'worn'`) so `GPhotos` and merges see it; never store a photo only on the wear. `wearPhoto()` pairs older wears.
- **Outfit figure**: `outfitFigure()` places items by `regionOf()` (never by type id); a new region needs a place in
  `FIG_REGION`/`FIG_BANDS` or it falls into the side column. A hand layout (`outfit.layout`, from `Arrange`) wins over the
  region placement; saving it keeps entries of hidden spicy items untouched.
- **Closet review**: `filters.missing` holds checks from `MISSING`/`LACKS` (`photo`, `price`, `brand`, `gender`,
  `size`, `colour`, `purchased`); an item shows when it lacks any. A new check needs an entry in both.
- **Next and back**: `closetOrder()` is what the closet shows, in order; `itemForm(it, nav)` keeps the list in `itemNav`
  while stepping. The close-up gets the same list when opened from a closet card.
- **Turning photos**: `rotatePhoto()` never edits bytes in place: it adds turned copies (new ids, no `mediaItemId` or `vec`),
  swaps them into the form and the saved item, then drops and unlinks the old ones.
- **Cost and wear**: `js/stats.js` (`itemStats()`, `costChart()`, `renderBreakdown()`). The chart uses `matches()` and
  `groupItems()`, so it follows the closet's filters and group setting; it is drawn at its on-screen width.
- **Purchase date**: `item.purchased` is `YYYY-MM-DD` from a date input; older month-only values are kept, never rewritten.
- **Missed pieces**: `WoreCrop` adds a hand-drawn piece (`manual: true`) to `wore.pieces`; its `vec` may be null when the
  model can't run, so `rankFor()` and `saveWore()` must cope with that.
- **Figure editing**: in the large outfit figure, double-click / tap / Enter on a piece opens `itemForm()` with
  `outfitReturn` set, and `closeDrawer()` reopens the outfit. Never while `Arrange` is on. The ✎ on an item in the outfit
  panel's picker does the same with `outfitReturn.draft` (the unsaved form), which `closeDrawer()` reopens instead.
- **Outfit panel**: `outfitForm()` opens `openDrawer(html, 'outfit-panel')`; the picker's selection lives in its `sel`
  set, not in the DOM. Saving keeps items hidden by the spicy setting in the outfit.
- **Type filter**: `filters.types` holds category ids (a group in `data/types.json`: every type in it matches) and type
  ids, OR among them; `migrateTypeFilter()` turns an older one-category `filters.group` into it. `typePicker()` builds it.
- **Size filter**: `filters.sizes` holds `"system:value"` keys (compared case-insensitively); `migrateSizeFilter()`
  turns an older `filters.size` string into them.
- **Spicy**: anything with `spicy: true` must stay out of every view, stat, search and share export while
  `settings.showSpicy` is off. Use `visible(item)`.
- **Google Photos**: `GPhotos` in `js/gphotos.js` (README, *Google Photos*). Its own token with the Photos scopes under
  `localStorage` key `wardrobe.photos`. Never add Photos scopes to the shared `google-token.js`: that would change
  consent for every app. A photo's `mediaItemId` is never dropped by a merge (`keepMedia()`), so nothing uploads twice.
  `GPhotos.pick()` (Picker API) returns `File`s that go through `takePhotos()`, the same path as *Add photo*; it needs
  a window opened on the tap (`pickPhotos()`), and buttons that open Google windows carry `data-gphotos` so the
  token-renewal tap listener leaves them alone. Uploads carry `describe()` as their description; `photo.mediaDesc`
  records it, and older or renamed ones are patched. `regenerable()` crops (What I wore, with `from`/`box`/`of`) never
  upload: `regenCrop()` cuts them again, or `cropView()` shows that part of the outfit photo.
- **Tags** (called wardrobe words before, so the code still says `word`): records in `doc.words` (`id`, `name`, `colour`,
  optional `emoji`); items and outfits hold tag ids in `.words`. Rename and colour live on the tag only. `deleteWord()`
  strips the id from every item and outfit. Ids with no tag are skipped (`wordsOf()`). The forms use the picker in
  `js/tags.js` (`wordsField()` / `formWords()`). `item.gender` only holds ids from `data/gender-tags.json`;
  `migrateGenderTags()` (in `upgrade()`, once the built-in lists are loaded) turns any other value into a tag with an id
  made from its name, so every device makes the same one.
- **Sizes**: a size system with `single: true` (One size) has one value, filled in by the form with the box hidden.
- **Colour season**: `renderColour()` and the `cs…` functions in `js/colour.js`, data in `data/colour-seasons.json` and
  `data/colour-quiz.json`. Only `settings.colourSeason` (a season id) is saved. A photo used for sampling lives only on
  the sampler's canvas: never pass it to `Photos.add()`, IndexedDB, Drive or Google Photos, and never save answers or
  samples. On the Colour tab a drop goes to the sampler (capture-phase listener), never into the closet.
- The design and roadmap are in the README (*Next steps*).
