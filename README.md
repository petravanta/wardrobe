# Wardrobe

A catalogue of the clothes you own, the outfits you put together and what you wore, as an open
alternative to closed wardrobe apps. Everything you save stays in your browser and, if you choose, in one
open JSON file in your own Google Drive.

Part of [petravanta's apps](https://petravanta.github.io/general/); it follows the shared
[STANDARDS.md](https://github.com/petravanta/general/blob/main/STANDARDS.md). The design is in the
Wardrobe app spec (open Whering alternative).

Live at **https://petravanta.github.io/wardrobe/** once published (see *Publishing to GitHub* below).
Until then it runs locally at http://localhost:8765/wardrobe/ from the `site/` folder.

## What works today

- **Closet**: add items with photos, type (two levels, such as Tops › Corset), colours, size, brand,
  price, purchase date, spicy flag and gender (Masc, Fem, Androgynous, plus any tags you define).
  The materials, seasons, occasions, care and notes fields are left out of the form for now; their data
  files (and any values already on an item) are kept.
- **Filters**: type, colour family, size and gender tags, AND across filters and OR within one; saved in
  your settings and synced.
- **Spicy items**: hidden everywhere unless *Show spicy items* is on in Settings. Spicy-leaning types and
  materials (latex, PVC, harness…) suggest the flag when you add an item.
- **Outfits**: combine items, name them and tag occasions.
- **Wear log**: log an outfit or items for a day; basic stats (never worn, least worn, cost per wear).
- **Photos**: by button or by dropping them anywhere on the page; resized in the browser and kept in this
  browser's IndexedDB.
- **Google Drive sync** of `Wardrobe data.json`, **Export backup** and **Import backup** (merge).
- Light and dark themes, the hub's *All apps* menu, and install as an app (shortcuts *Add item* and *Log
  what I wore*).

## Importing from Whering

Whering has no export, but its web page loads each item's full details (brand, type, colours, size, price,
fabric, occasions, tags and photo links) 12 items at a time as you scroll. `tools/whering-capture.js` records
that in your own signed-in browser and downloads it as a file:

1. Sign in to Whering and open your items list (the page where every item is a tile). Don't reload from here on.
2. Open the browser console (F12), paste the contents of `tools/whering-capture.js` and press Enter. A banner
   appears at the top of the page. (Chrome may ask you to type `allow pasting` first.)
3. Run `await wheringScroll()`. It scrolls to the end about every 10 seconds, so Whering loads each page at a
   gentle pace (about two minutes for 100 items). Then run `wheringSave()`, which downloads `whering-capture.json`.
4. In Wardrobe, **Settings → Import from Whering**, and pick that file.

Each Whering item becomes a Wardrobe item: the type comes from Whering's own type (strappy heels, maxi dress,
blazer…), colours, fabrics and occasions are matched to Wardrobe's lists, sizes become Wardrobe sizes, the
size chart's gender becomes Masc or Fem, and the cut-out photo is saved in this browser. Everything Whering
knows that has no Wardrobe field yet (tags, styles, raw colours, sizes, the original photo's link) stays on the
item under `whering`. The mapping lives in the `whering` names in `data/types.json`, `colours.json`,
`materials.json` and `occasions.json`, so adding a Whering name to an entry is how to teach the import a new one.
Items already imported are skipped. An item whose Whering type has no match is filed by its category and flagged
`needsReview`.

`tools/whering-scan.js` is a photos-only fallback (it can't read the details). `wheringWalk()` in the capture
script, which opens items one by one, is also there but isn't needed.

## Next steps

From the spec, roughly in order:

1. **Google Photos album adapter**: upload item photos to an app-created *Wardrobe* album, keep the
   `mediaItemId` on each photo, and the local copy as a thumbnail cache. Needs its own sign-in with the
   Photos scopes (append-only, app-created read, Picker), kept apart from the shared Drive token.
2. **Picker import** of existing photos (a copy is re-uploaded to the album).
3. **Clean background** on device (`@imgly/background-removal`, self-hosted model, WebGPU first). The
   cut-out is a second photo with `role: "cutout"`.
4. **What I wore, from a photo** on device (clothes segmentation + CLIP matching, embeddings in
   IndexedDB), with a review screen before anything is logged.
5. **Share export** for outfits (`format: "wardrobe-outfit"`), richer stats, wear calendar.

The open question from the spec about duplicate copies on Picker import still needs Petra's answer.

## User data

One document, the same shape as the other apps (see STANDARDS.md, *User data*):

```json
{
  "version": 1,
  "settings": { "updatedAt": "…", "showSpicy": false, "filters": {} },
  "items":   [ { "id": "…", "u": "…", "name": "Black midi skirt", "type": "skirt", "colours": ["black"],
                 "sizes": [ { "system": "letter", "value": "M" } ], "spicy": true,
                 "photos": [ { "id": "…", "role": "main", "mediaItemId": "(later)" } ] } ],
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
