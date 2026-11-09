# Notes for coding agents

Follow the shared standards in [petravanta/general STANDARDS.md](https://github.com/petravanta/general/blob/main/STANDARDS.md)
(locally `../general/STANDARDS.md`). Only Wardrobe specifics are here.

- **One static page**, `index.html`, no build step. The shared theme, `google-token.js` and `drive-store.js` are
  inlined between their marker comments; when the canonical copies in `general/shared/` change, update them here.
- **Accent**: slate, `#475569` light / `#a5b4c8` dark.
- **Built-in knowledge** is in `data/*.json` with schemas in `data/schema/`. Run `node scripts/check-data.js` after
  changing data. Item records refer to entries by id; ids are never renamed or reused.
- **User data**: `localStorage` key `wardrobe.data`; Drive file `Wardrobe data.json` (app id `wardrobe`, key prefix
  `wardrobe.drive`). Lists: `items`, `outfits`, `wears`; settings include `showSpicy` and `filters`. Merge rules are
  `mergeDocs()`.
- **Photos**: bytes live in IndexedDB database `wardrobe` (`photos` full size, `thumbs` 400 px), keyed by the photo
  id stored on the item. Every way of adding a photo goes through `Photos.add()` / `takePhotos()`.
- **Spicy**: anything with `spicy: true` must stay out of every view, stat, search and share export while
  `settings.showSpicy` is off. Use `visible(item)`.
- **Google Photos**: needs its own token with the Photos scopes, under its own key. Never add Photos scopes to the
  shared `google-token.js`: that would change consent for every app.
- The design and roadmap are in the README (*Next steps*).
- The repo is local only while the GitHub account is suspended; don't add a remote or push unless asked.
