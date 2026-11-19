# Notes for coding agents

Follow the shared standards in [petravanta/general STANDARDS.md](https://github.com/petravanta/general/blob/main/STANDARDS.md)
(locally `../general/STANDARDS.md`). Only Wardrobe specifics are here.

- **One static page**, `index.html`, no build step. The shared theme, `google-token.js` and `drive-store.js` are
  inlined between their marker comments; when the canonical copies in `general/shared/` change, update them here.
- **Accent**: slate, `#475569` light / `#a5b4c8` dark.
- **Built-in knowledge** is in `data/*.json` with schemas in `data/schema/`. Run `node scripts/check-data.js` after
  changing data. Item records refer to entries by id; ids are never renamed or reused.
- **User data**: `localStorage` key `wardrobe.data`; Drive file `Wardrobe data.json` (app id `wardrobe`, key prefix
  `wardrobe.drive`). Lists: `items`, `outfits`, `wears`, `words`; settings include `showSpicy`, `filters`, `sort`, `sortReverse`,
  `groupBy`, `autoCutout` (unset means on), `photosAlbum` and `photosAccount`. Merge rules are
  `mergeDocs()`.
- **Photos**: bytes live in IndexedDB database `wardrobe` (`photos` full size, `thumbs` 400 px), keyed by the photo
  id stored on the item. Every way of adding a photo goes through `Photos.add()` / `takePhotos()`.
- **Clean background**: `Cutout` / `cleanBackground()` in `index.html`, the model in `cutout-worker.js`, the library
  bundled in `vendor/background-removal.js` (generated, don't edit; rebuild steps in the README). A cut-out is a
  photo with `role: 'cutout'` and `from`; the original is never replaced. `sw.js` caches `staticimgly.com` cache-first,
  on purpose. Photos never leave the device for this.
- **Spicy**: anything with `spicy: true` must stay out of every view, stat, search and share export while
  `settings.showSpicy` is off. Use `visible(item)`.
- **Google Photos**: `GPhotos` in `index.html` (README, *Google Photos*). Its own token with the Photos scopes under
  `localStorage` key `wardrobe.photos`. Never add Photos scopes to the shared `google-token.js`: that would change
  consent for every app. A photo's `mediaItemId` is never dropped by a merge (`keepMedia()`), so nothing uploads twice.
- **Wardrobe words**: records in `doc.words` (`id`, `name`, `colour`, optional `emoji`); items hold word ids in `item.words`. Rename and
  colour live on the word only. `deleteWord()` strips the id from every item. Ids with no word are skipped (`wordsOf()`).
- The design and roadmap are in the README (*Next steps*).
