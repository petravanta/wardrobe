# Wardrobe

A catalogue of the clothes you own, the outfits you put together and what you wore, as an open
alternative to closed wardrobe apps. Everything you save stays in your browser and, if you choose, in one
open JSON file in your own Google Drive.

Part of [petravanta's apps](https://petravanta.github.io/general/); it follows the shared
[STANDARDS.md](https://github.com/petravanta/general/blob/main/STANDARDS.md). The design is in the
Wardrobe app spec.

Live at **https://petravanta.github.io/wardrobe/**, or locally at http://localhost:8765/wardrobe/ from the
`site/` folder.

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
  browser's IndexedDB, and (optional) in a *Wardrobe* album in your own Google Photos, so they show on every device
  (see *Google Photos* below).
- **Clean background** on this device: a new item's main photo gets a transparent cut-out next to the
  original, and any photo can be cleaned from the item form (see *Clean background* below).
- **Google Drive sync** of `Wardrobe data.json`, **Export backup** and **Import backup** (merge).
- Light and dark themes, the hub's *All apps* menu, and install as an app (shortcuts *Add item* and *Log
  what I wore*).

## Clean background

Cut-outs are made in the browser, on your device. The photo is never sent anywhere to be cut out.

- **When**: adding a photo to an item that has no cut-out yet (by button or drop, one item or many) starts a
  cut-out of its main photo in the background, while you fill in the form. Every photo in the item form also has a
  *Clean background* (or *Clean again*) button. *Settings → Clean background* turns the automatic part off. Imported
  items that already come with a cut-out are left alone.
- **What's stored**: the original stays as it was. The cut-out is a second photo on the item,
  `{ "id": "…", "role": "cutout", "from": "<id of the photo it was made from>" }`, a transparent PNG trimmed to the
  garment with a little margin, kept in IndexedDB like every other photo. The closet shows the cut-out when there is
  one. Removing a photo removes its cut-out too. With Google Photos connected, a cut-out uploads like any other photo
  (it gets its own `mediaItemId`); nothing about it is specific to this browser.
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
- **Licence**: `@imgly/background-removal` is AGPL-3.0, so Wardrobe as a whole is shared under AGPL terms while its own code stays MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **Updating the library**: in an empty folder,
  `npm i @imgly/background-removal@<version> onnxruntime-web@<its peer version> esbuild`, then bundle
  `export { removeBackground, preload } from '@imgly/background-removal'` with
  `npx esbuild entry.mjs --bundle --format=esm --minify --target=es2020 --legal-comments=eof --outfile=background-removal.js`,
  keep the header comment, and change the version in `PUBLIC_PATH` (`cutout-worker.js`) and `CUTOUT_CACHE` (`sw.js`).

## Google Photos

*Settings → Google Photos → Connect* keeps item photos in a *Wardrobe* album that the app creates in your own Google
Photos. The browser keeps its copy in IndexedDB as a cache.

- **Upload**: every saved photo without a `mediaItemId` whose bytes are in this browser uploads (originals and
  cut-outs, at the 1600 px size the app stores), and gets the album copy's `mediaItemId`, which syncs through Drive.
  New photos upload a couple of seconds after they're saved. Photos are only in the browser where they were added, so
  that browser does their first upload.
- **Download**: a browser that shows a photo it doesn't have (another device, or the app on another address such as
  localhost and GitHub Pages) fetches it from the album by `mediaItemId` and caches it.
- **Removing** a photo in the app takes it out of the album. Google doesn't let apps delete photos, so it stays in
  your library until you delete it there.
- **Spicy** photos go to the same album, and Google Photos also shows album photos in the main library. *Show spicy
  items* only hides them in this app.
- **Sign-in**: its own token under `localStorage` key `wardrobe.photos`, never the shared Drive token (adding Photos
  scopes there would change what every app asks for). It lasts an hour and renews on a tap, like Drive; when both
  need renewing, Drive takes the first tap and Photos the next. The album's id is `settings.photosAlbum`.
- **Scopes**: `photoslibrary.appendonly`, `photoslibrary.readonly.appcreateddata`,
  `photoslibrary.edit.appcreateddata` (to take photos out of the album) and `photospicker.mediaitems.readonly` (for the
  Picker import, next). The Library API only sees photos this app uploaded.

**One-off setup** in Google Cloud Console, in the project of the shared OAuth client: enable the **Photos Library API**
and the **Google Photos Picker API** (*APIs & Services → Library*), and add the four scopes above under *Google Auth
Platform → Data Access*. While the app is in *Testing*, your account must be a test user (*Audience*).

## Next steps

From the spec, roughly in order:

1. **Picker import** of existing photos (a copy is re-uploaded to the album).
2. **What I wore, from a photo** on device (clothes segmentation + CLIP matching, embeddings in
   IndexedDB), with a review screen before anything is logged.
3. **Share export** for outfits (`format: "wardrobe-outfit"`), richer stats, wear calendar.

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

Photo bytes are not in this file: they stay in the browser and, if connected, in the Google Photos album.

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

## Publishing

The repository is [petravanta/wardrobe](https://github.com/petravanta/wardrobe). GitHub Pages deploys it from
branch `main`, folder `/ (root)`, at https://petravanta.github.io/wardrobe/. It is listed on the hub and in the
*All apps* menu, and `general/github/apply-ruleset.sh` covers it.

Paths to the hub's shared files are relative (`../general/shared/...`), which works both on
`petravanta.github.io` and locally from the `site/` folder at http://localhost:8765/wardrobe/.

Google sign-in needs both origins (`https://petravanta.github.io` and `http://localhost:8765`) in the shared OAuth
client's *Authorized JavaScript origins*.

## License

MIT, see [LICENSE](LICENSE). The bundled background-removal library is AGPL-3.0; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
