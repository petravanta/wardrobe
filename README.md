# Wardrobe

A catalogue of the clothes you own, the outfits you put together and what you wore, as an open
alternative to closed wardrobe apps. Everything you save stays in your browser and, if you choose, in one
open JSON file in your own Google Drive.

Part of [petravanta's apps](https://petravanta.github.io/general/); it follows the shared
[STANDARDS.md](https://github.com/petravanta/general/blob/main/STANDARDS.md). The design is in the
Wardrobe app spec.

Live at **https://petravanta.github.io/wardrobe/** once published (see *Publishing to GitHub* below).
Until then it runs locally at http://localhost:8765/wardrobe/ from the `site/` folder.

## What works today

- **Closet**: add items with photos, type (two levels, such as Tops › Corset), colours, size, brand,
  price, purchase date, spicy flag and gender (Masc, Fem, Androgynous, plus any tags you define).
  The materials, seasons, occasions, care and notes fields are left out of the form for now; their data
  files (and any values already on an item) are kept.
- **Filters**: type, colour family, size and gender tags, AND across filters and OR within one; saved in
  your settings and synced.
- **Sort and group**: sort the closet by date added, last worn, most worn, name, colour or type (with
  *Reverse*), and group it into shelves by category, type, colour family, gender tag or size. An item with
  several colours or tags sits on each matching shelf. Saved in your settings and synced.
- **Spicy items**: hidden everywhere unless *Show spicy items* is on in Settings. Spicy-leaning types and
  materials (latex, PVC, harness…) suggest the flag when you add an item.
- **Outfits**: combine items, name them and tag occasions.
- **Wear log**: log an outfit or items for a day; basic stats (never worn, least worn, cost per wear).
- **Photos**: by button or by dropping them anywhere on the page; resized in the browser and kept in this
  browser's IndexedDB.
- **Clean background** on this device: a new item's main photo gets a transparent cut-out next to the
  original, and any photo can be cleaned from the item form (see *Clean background* below).
- **Google Drive sync** of `Wardrobe data.json`, **Export backup** and **Import backup** (merge).
- Light and dark themes, the hub's *All apps* menu, and install as an app (shortcuts *Add item* and *Log
  what I wore*).

## Clean background

Cut-outs are made in the browser, on your device. The photo is never uploaded anywhere.

- **When**: adding a photo to an item that has no cut-out yet (by button or drop, one item or many) starts a
  cut-out of its main photo in the background, while you fill in the form. Every photo in the item form also has a
  *Clean background* (or *Clean again*) button. *Settings → Clean background* turns the automatic part off. Imported
  items that already come with a cut-out are left alone.
- **What's stored**: the original stays as it was. The cut-out is a second photo on the item,
  `{ "id": "…", "role": "cutout", "from": "<id of the photo it was made from>" }`, a transparent PNG trimmed to the
  garment with a little margin, kept in IndexedDB like every other photo. The closet shows the cut-out when there is
  one. Removing a photo removes its cut-out too. When the Google Photos adapter lands, a cut-out uploads like any
  other photo (it gets its own `mediaItemId`); nothing about it is specific to this browser.
- **How**: [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) 1.7.0 (an ISNet
  segmentation model on ONNX Runtime Web) runs in `cutout-worker.js`, a Web Worker, so the page stays responsive. It
  uses WebGPU when the browser has it and falls back to WebAssembly. Jobs run one at a time.
- **Loading**: nothing is loaded until the first cut-out. The library is self-hosted in `vendor/background-removal.js`
  (about 860 KB). The model and the ONNX Runtime WebAssembly come from IMG.LY's CDN (`staticimgly.com`), under a path
  versioned to the library, as a one-off download of tens of MB; only these files are downloaded, never your photos.
  `sw.js` keeps them cache-first (unlike other CDNs, which the shared worker leaves to the network), so after the
  first cut-out it also works offline and in the installed app. To self-host the model as well, copy the
  `dist/` folder of `@imgly/background-removal-data` 1.7.0 into the app and point `PUBLIC_PATH` in
  `cutout-worker.js` at it.
- **Speed**: GitHub Pages can't turn on cross-origin isolation, so WebAssembly runs single-threaded (ONNX Runtime
  says so in the console; it's harmless). WebGPU is much faster where available.
- **Licence**: `@imgly/background-removal` is AGPL-3.0. Wardrobe is published as open source, which that licence asks for.
- **Updating the library**: in an empty folder,
  `npm i @imgly/background-removal@<version> onnxruntime-web@<its peer version> esbuild`, then bundle
  `export { removeBackground, preload } from '@imgly/background-removal'` with
  `npx esbuild entry.mjs --bundle --format=esm --minify --target=es2020 --legal-comments=eof --outfile=background-removal.js`,
  keep the header comment, and change the version in `PUBLIC_PATH` (`cutout-worker.js`) and `CUTOUT_CACHE` (`sw.js`).

## Next steps

From the spec, roughly in order:

1. **Google Photos album adapter**: upload item photos to an app-created *Wardrobe* album, keep the
   `mediaItemId` on each photo, and the local copy as a thumbnail cache. Needs its own sign-in with the
   Photos scopes (append-only, app-created read, Picker), kept apart from the shared Drive token.
2. **Picker import** of existing photos (a copy is re-uploaded to the album).
3. **What I wore, from a photo** on device (clothes segmentation + CLIP matching, embeddings in
   IndexedDB), with a review screen before anything is logged.
4. **Share export** for outfits (`format: "wardrobe-outfit"`), richer stats, wear calendar.

The open question from the spec about duplicate copies on Picker import still needs Petra's answer.

## User data

One document, the same shape as the other apps (see STANDARDS.md, *User data*):

```json
{
  "version": 1,
  "settings": { "updatedAt": "…", "showSpicy": false, "filters": {}, "sort": "added", "sortReverse": false, "groupBy": "" },
  "items":   [ { "id": "…", "u": "…", "name": "Black midi skirt", "type": "skirt", "colours": ["black"],
                 "sizes": [ { "system": "letter", "value": "M" } ], "spicy": true,
                 "photos": [ { "id": "…", "role": "main", "mediaItemId": "(later)" },
                             { "id": "…", "role": "cutout", "from": "…" } ] } ],
  "outfits": [ { "id": "…", "u": "…", "name": "Club night", "items": ["…"], "occasions": ["club-night"] } ],
  "wears":   [ { "id": "…", "u": "…", "at": "2026-11-09", "outfit": "…", "source": "manual" } ],
  "deleted": [ "…" ]
}
```

Photo bytes are not in this file: they stay in the browser (and later in the Google Photos album).

## Extending the app

What the app knows is data, in `data/`. Each file has a JSON Schema in `data/schema/`, and the
*Check data* workflow validates every pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) to add an entry.

| Dataset | File | Schema | What it controls |
| --- | --- | --- | --- |
| Item types | `data/types.json` | `data/schema/types.schema.json` | Two-level type list (group › type), the body region photo matching looks for, which size systems are offered, and spicy-leaning types |
| Colours | `data/colours.json` | `data/schema/colours.schema.json` | Colour choices, their swatch and colour family (for filtering by family) |
| Materials | `data/materials.json` | `data/schema/materials.schema.json` | Materials, and which ones suggest the spicy flag |
| Seasons | `data/seasons.json` | `data/schema/seasons.schema.json` | Seasons an item suits |
| Occasions | `data/occasions.json` | `data/schema/occasions.schema.json` | Occasions for items and outfits |
| Care | `data/care.json` | `data/schema/care.schema.json` | Care instructions, with an optional `why` |
| Size systems | `data/size-systems.json` | `data/schema/size-systems.schema.json` | Size systems and, where closed, their values |
| Gender tags | `data/gender-tags.json` | `data/schema/gender-tags.schema.json` | Built-in tags (Masc, Fem, Androgynous); people add their own in the item form, and they are offered again |

Check the data locally with `node scripts/check-data.js`.

## Google Drive sign-in

Uses the shared OAuth client for petravanta's apps. For local use, `http://localhost:8765` must be an
Authorized JavaScript origin on that client (see the README one folder up from `site/`).

## Publishing to GitHub

This folder is its own git repository (like every app in the suite), committed locally and not pushed
anywhere yet. When the `petravanta` GitHub account is back:

1. Create an empty public repository named `wardrobe` under `petravanta` (no README, no licence, so the
   first push doesn't conflict).
2. From this folder:

   ```sh
   git remote add origin https://github.com/petravanta/wardrobe.git
   git push -u origin main
   ```

3. In the repo, **Settings → Pages**: deploy from branch `main`, folder `/ (root)`.
4. From the `general` repo: add `wardrobe` to `repos` in `github/apply-ruleset.sh` and run
   `./github/apply-ruleset.sh wardrobe` (Protect main ruleset, auto-merge settings).
5. The hub card and `shared/apps.json` entry already exist in the local `site/general` copy; carry them
   into the `general` repo too, and add a **Source** link to the card.

Paths to the hub's shared files are relative (`../general/shared/...`), which works both on
`petravanta.github.io` and locally.
