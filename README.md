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

- **Closet**: add items with photos, type (two levels, such as Tops › Corset or Jewellery › Earrings), colours, size, brand,
  price, purchase date (a date picker, saved as `YYYY-MM-DD`; an older month-only value such as `2025-03` is kept until a
  day is picked), spicy flag and gender (Masc, Fem, Androgynous). Brand and size suggest the
  values already on your items (most used first; for sizes, then the size system's usual values), and any new value can
  still be typed. The sizes you've used in the chosen system also show as chips under the size box: a tap fills it in.
  *One size* (a size system with one value, `single` in `data/size-systems.json`) hides the size box. Accessories include *Wig* (placed on the head in an outfit's figure).
  The materials, seasons, occasions, care and notes fields are left out of the form for now; their data
  files (and any values already on an item) are kept.
- **Tags**: your own tags for your clothes (goth, cozy, capsule…), each with a colour and an optional emoji
  that shows on chips, cards and shelves. Add, rename, recolour, emoji and delete them in Settings; tag items in the item form, or many at once with *Tag items*.
  In the item and outfit forms, the tag box finds the tags you already have as you type (most used first, also shown
  as chips to tap) and makes a new one with Enter. Outfits take tags too, as many as fit (sporty and goth). Deleting a
  tag takes it off every item and outfit. Search finds items by their tags too. Tags replace the earlier *wardrobe words*
  (same records, ids, colours and emoji, still stored as `words`) and the gender tags people typed themselves, which
  became tags of the same name the first time the app opened (`migrateGenderTags()`).
- **Filters**: type, colour family, size, gender and tags, AND across filters and OR within one; saved in
  your settings and synced. Colour families are swatches filled with their colour (label in black or white, whichever
  contrasts more; a picked one gets a ring and a check). *Size* opens a picker of the sizes your items actually have,
  grouped by size system with a count each (`filters.sizes: ["letter:M", "eu:38"]`; an older typed `filters.size` is
  turned into these). *All types* opens a picker by category: *All jewellery* (a whole category, every type in it) or
  single types such as *Ring*, with a count each; categories and types mix, OR among them (`filters.types:
  ["jewellery", "sneakers"]`; an older one-category `filters.group` is turned into this). Built-in gender tags show their emoji (`emoji` in `data/gender-tags.json`: ♂️ Masc, ♀️ Fem,
  ⚧️ Androgynous).
- **Review**: *✎ Review* in the closet's filters opens checks for what items still lack: photo, price, brand, gender, size,
  colour, purchase date, each with a count. Pick one or more and the closet shows items missing any of them, each card
  saying what's missing; tap one to fill it in. Saved as `filters.missing` (`["price", "purchased"]`).
- **Next and back**: an item opened from the closet has *‹ Back* and *Next ›* (and the ← → keys while no text box, list or menu has focus),
  in the closet's current order, so they walk through the current filter or Review. Changes are saved first, as *Save*
  would. The list stays as it was when the item was opened, so an item that was just fixed can still be gone back to.
- **Picture size**: *Pictures S M L* in the closet's sort bar sets the size of the closet's cards (`settings.thumbSize`,
  synced).
- **Sort and group**: sort the closet by date added, last worn, most worn, name, colour, type or price (high to low or
  low to high; items without a price go last either way) (with *Reverse*), and group it into shelves by category, type, colour family, gender, tag or size. An item with
  several colours or tags sits on each matching shelf. Saved in your settings and synced.
- **Spicy items**: hidden everywhere unless *Show spicy items* is on in Settings. Spicy-leaning types and
  materials (latex, PVC, harness…) suggest the flag when you add an item.
- **Outfits**: combine items, name them and tag occasions. Each outfit shows as a *figure*: its items' photos (cut-outs
  first) laid out roughly where they're worn, by each type's `region` in `data/types.json` (hat on top, tops and outer
  layers, a dress across top and middle, bottoms, shoes at the foot; earrings by the head, a necklace at the neck, rings
  and bracelets at the wrist; bags, belts and other accessories in a side column). The
  Outfits tab is a grid of cards (two across on a phone), each with the figure, name, wears and tags; the photo from
  the latest wearing sits in the corner and opens a close-up of the outfit's worn photos. Double-click a piece in the
  large figure (tap it on a phone, or Enter from the keyboard) to open that item's form, change its photo or details,
  and come back to the outfit when you save or close it. An outfit opens in a large panel (full screen on a phone):
  the figure on one side, the details and the item picker on the other. The picker has a search box, a type menu and
  tag chips; the items already in the outfit stay at the top whatever the filters, and each card has ✎ to open that
  item's form and come back to the outfit, with what was picked so far kept. A new outfit's figure fills in as items
  are picked. Opening an outfit shows the figure large, the name (edit it right
  there; it saves when you leave the field or press Enter), every time it was worn, newest first, with that day's photo
  (tap for a close-up, or *Add a photo* to a wear without one), and its items and occasions. *Arrange* lets you lay the
  figure out yourself: drag a piece, resize it from its corner (or pinch), *Bring forward* / *Send back*, or use the
  keyboard (arrows, + and −, [ and ]). The layout is saved on the outfit (`layout`) when you let go and the list's small
  figure uses it too; *Reset layout* goes back to the automatic one. Items added later are placed automatically.
- **Wear log**: log an outfit or items for a day; basic stats (never worn, least worn, cost per wear). The log groups
  wears by day and shows each one's pictures: that day's photo first, then the items worn (up to six, then *+n*). Tap
  a picture for a close-up, or the name to open the outfit or item.
- **Cost and wear** (Worn tab): a chart with a dot per priced item, times worn across and price up (hover or focus a
  dot for its numbers, tap it to open the item). It shows what the closet shows, so the closet's filters apply, and
  its *Group* (the closet's group setting) adds a table per group: items, cost, times worn and cost per wear; tap a
  group to pick out its dots. *Least worn* and *Cost per wear* list items with their pictures, and *See full
  breakdown* opens every item's price, times worn, last worn and cost per wear, sortable by any column. Wear counts
  include a count brought in by an import (`wearStats()`); an item not worn yet costs its whole price per wear.
- **Item stats**: an item's form shows how many times it was worn, when last, and its cost per wear so far.
- **Close-up**: the magnifier on a card, tile or row (and the photos in an item, outfit or *What I wore*) opens the
  photos full size; tap to zoom, drag to look around. Opened from a closet card, *‹ Item* and *Item ›* (or ↑ ↓)
  step to the closet's other items that have photos; ← → go through the item's photos and on past the first or last
  to the item before or after. *Close* at the top right, Esc, a tap beside the photo or the
  phone's Back gesture closes it.
- **What I wore, from a photo**, on this device: the app finds the clothes in a photo of your outfit, suggests the
  matching closet items, and logs the outfit once you confirm. A piece it can't place can become a new item from the
  photo, marked to get a clean photo later (see *What I wore, from a photo* below).
- **Photos**: by button or by dropping them anywhere on the page; resized in the browser and kept in this
  browser's IndexedDB, and (optional) in a *Wardrobe* album in your own Google Photos, so they show on every device
  (see *Google Photos* below).
- **Clean background** on this device: a new item's main photo gets a transparent cut-out next to the
  original, and any photo can be cleaned from the item form (see *Clean background* below).
- **Turn a photo**: ⟳ on a photo in the item form turns it a quarter turn clockwise, together with its cut-out. The
  turned photo is a new photo (a new id), so it uploads to Google Photos as one; the old one leaves the album.
- **Google Drive sync** of `Wardrobe data.json`, kept in *petravanta/Wardrobe/* in My Drive (a copy saved earlier in
  the root of My Drive is moved there once, on the next connect, keeping its id so other devices carry on syncing), **Export backup** and **Import backup** (merge).
- **Colour season**: find your colour season (12-season system) with a short questionnaire, optionally helped by
  tapping skin, hair and eyes on a photo, or pick it yourself; then see its palette and which closet items are in it
  (see *Colour season* below). *Find my season again* and *Pick your season yourself* sit above the matching items.
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

## What I wore, from a photo

*Worn → From a photo* (or drop a photo of your outfit on the *Worn* tab) logs what you wore from one photo. Everything
runs in the browser, on your device: the photo is never sent anywhere to be recognised.

- **Finding the clothes**: a clothes-parsing model ([`Xenova/segformer_b2_clothes`](https://huggingface.co/Xenova/segformer_b2_clothes),
  SegFormer) marks every pixel as hat, top, skirt, trousers, dress, belt, shoes, bag, scarf, sunglasses or skin and
  background. Each kind that covers enough of the photo becomes one piece, cut out with a transparent background.
  Left and right shoes are one piece. Layers it sees as one (a jacket over a top) come out as one piece; anything it
  misses can be added by hand on the confirm screen.
- **Matching**: an image-embedding model ([`Xenova/clip-vit-base-patch32`](https://huggingface.co/Xenova/clip-vit-base-patch32), CLIP)
  turns each piece, and each closet photo (cut-out, main photo, or crop), into a vector. A piece is compared only with
  items whose type's `region` (in `data/types.json`) fits what it is, and items are ranked by their closest vector.
  Spicy items are only suggested while *Show spicy items* is on.
- **Confirm, always, one piece at a time**: the confirm screen is a large panel (full screen on a phone) with the outfit
  photo always in view, left on a wide screen and pinned on top on a phone. *✂ Mark a missed piece* (on the photo, and
  on Review) lets you draw a box around something the model missed (drag; or move the box with the arrow keys and
  resize it with Shift and the arrows) and *Add this piece*: the crop becomes one more step, ranked against the closet
  like any piece (its kind is guessed from where it sits; change it if needed), so it can be matched or added as a new
  placeholder item. Each piece is a step (*Piece 2 of 4 ·
  Bottoms*): its box is highlighted on the photo and the rest dimmed, and the other pieces' outlines can be tapped to
  go to them. A step shows the piece's category and kind (changing the kind ranks it again), its crop, the closest
  items with their score, *More …, with pictures* (a grid of every item of that kind, then the other categories),
  *Add as a new item* and *Leave it out*. When the best match is clearly ahead (`MATCH.clear` and `MATCH.margin` in
  `js/wore.js`, first guesses to tune on real photos) it is picked already. *Next* needs an answer; *Back*, the step
  chips and the arrow keys move freely, and answers are kept. The last step, *Review*, has the date (the day the photo
  was taken, or today), the outfit name, each piece's answer (tap to change it) and *Add something it missed*, grouped
  by category. When nothing is found it opens straight on Review. Nothing is saved until *Log it*; cancelling drops the
  photo.
- **Style**: a row of your tags at the top of every step narrows what's offered (the ranked rows, the picture
  grid and *Add something it missed*) to items with any of the picked words, and says how many match. An answer already
  picked stays, marked *outside this style*; a piece with nothing in the style offers *Show all*. The pick lasts for
  this logging only; the picked words are saved on the outfit as its `words`.
- **What's saved**: an outfit with the outfit photo (`photos: [{ id, role: "worn" }]`, `source: "photo"`; an existing outfit
  with exactly the same items is reused and gets the photo), and a wear for the chosen date (`source: "photo"`).
  Each confirmed item keeps the piece's vector in `item.seen` (the latest 6), so it gets easier to recognise.
- **New items from the photo**: the piece becomes the item's only photo (`role: "crop"`), with a type from what the
  model saw, up to two colours read from the crop, and `followUp: true`. The closet marks it *needs a clean photo* and
  has a filter chip for these. Adding a photo to it makes that the main photo (and cleans its background), and saving
  clears the flag; the crop is kept as an extra photo.
- **Vectors sync**: each photo's vector is stored on its record as `vec: { m: "clip-b32-q8", d: "<base64>" }`, 512 numbers
  at 8 bits each (under 1 KB). They travel with the data, so a device that can't read a photo's bytes (on another
  address, album images can be shown but not read) can still match against it. Vectors are made the first time
  recognition runs, in the browser that has the photo; *Settings → What I wore → Get the closet ready now* does it
  ahead of time. A merge never drops a vector (`keepMedia()`). Changing the model or its precision means a new
  `EMBED_ID`, and vectors with the old id are made again.
- **How**: [transformers.js](https://github.com/huggingface/transformers.js) 3.8.1 (ONNX Runtime Web inside) runs both
  models in `recognise-worker.js`, a Web Worker, one job at a time. The clothes model uses WebGPU when there is one and
  WebAssembly (8-bit) otherwise; CLIP always runs as 8-bit on WebAssembly, so every device makes the same vectors.
- **Loading**: nothing loads until the first use. The library is self-hosted in `vendor/transformers.min.js` (about
  870 KB, copied unchanged from the npm package's `dist/`). The models come from the Hugging Face hub (about 115 MB with
  WebAssembly, more with WebGPU) and transformers.js keeps them in the browser's Cache Storage; the ONNX Runtime
  WebAssembly (about 21 MB) comes from jsDelivr and `sw.js` keeps it cache-first. After the first run it works offline.
- **Not the clean-background model**: ISNet (in `cutout-worker.js`) separates one subject from its background, so it
  can't tell a top from a skirt; recognition needs a clothes-parsing model. The two use separate workers and separate
  copies of ONNX Runtime, which can't clash. Recognition does use the cut-outs: they're the cleanest closet photos to
  compare with.
- **Updating the library**: `npm i @huggingface/transformers@<version>`, copy `dist/transformers.min.js` to
  `vendor/`, and change the version in `RECOGNISE_CACHE` / `RECOGNISE_PATH` (`sw.js`).

## Google Photos

*Settings → Google Photos → Connect* keeps item photos in a *Wardrobe* album that the app creates in your own Google
Photos. The browser keeps its copy in IndexedDB as a cache.

- **Upload**: every saved photo without a `mediaItemId` whose bytes are in this browser uploads (originals and
  cut-outs, at the 1600 px size the app stores), and gets the album copy's `mediaItemId`, which syncs through Drive.
  New photos upload a couple of seconds after they're saved. Photos are only in the browser where they were added, so
  that browser does their first upload. Each upload gets a description such as *Wardrobe app · item photo · Black
  midi skirt* (kinds: item photo, label photo, clean background, outfit photo), so app photos can be told apart in
  Google Photos. Photos uploaded before that, or whose item or outfit was renamed since, get the new text through
  `mediaItems.patch` (Google allows it for media items the app created, with `photoslibrary.edit.appcreateddata`), up
  to 40 per sync; `photo.mediaDesc` is the text a photo has. Google's API notes ask that descriptions hold only text
  people wrote, and these are made by the app.
- **Crops stay on the device**: a crop cut from an outfit photo in *What I wore* keeps where it came from (`from`, the
  outfit photo; `box` and `of`, where in that photo), so it isn't uploaded: it is cut again from the outfit photo when
  a browser doesn't have it, or, where the outfit photo is only shown from Google Photos, that part of it is shown
  (`object-view-box`, Chrome and Edge). Crops made before this upload as before.
- **Showing them elsewhere**: a browser that doesn't have a photo's bytes (another device, or the app on another
  address such as localhost and GitHub Pages) asks the album for it by `mediaItemId` and shows Google's image address,
  which lasts an hour and is then asked for again. Google sends no CORS headers for album images, so they can be shown
  but not copied into that browser's IndexedDB: there they need a connection and a Photos sign-in, and *Clean
  background* only works where the photo was added.
- **Removing** a photo in the app takes it out of the album. Google doesn't let apps delete photos, so it stays in
  your library until you delete it there.
- **From Google Photos** (in the closet bar and next to *Add photo* on an item, once connected) adds photos you
  already have. Apps can no longer browse a Google Photos library, so this uses Google's **Picker**: the app opens a
  Google Photos window, you choose photos there and tap *Done*, and the app gets only those. It downloads each one
  (up to 2048 px, as JPEG) straight into this browser and treats it like a photo from *Add photo*: in the closet each
  becomes a new item, in an item it is added to that item, and it then uploads to the *Wardrobe* album like any other.
  Nothing passes through a server of ours. Videos are skipped. The picker session is deleted right after.
- **Spicy** photos go to the same album, and Google Photos also shows album photos in the main library. *Show spicy
  items* only hides them in this app.
- **Sign-in**: its own token under `localStorage` key `wardrobe.photos`, never the shared Drive token (adding Photos
  scopes there would change what every app asks for). *Connect* asks which Google account to use, which can be a different one
  from Drive; it is kept in `settings.photosAccount` (and on each uploaded photo as `mediaAccount`), and renewals stay on it. Switching to another account (*Use
  another account*) starts a new album there and this browser uploads its photos again; nothing is deleted from the
  old one. It lasts an hour and renews on a tap, like Drive; when both
  need renewing, Drive takes the first tap and Photos the next. The album's id is `settings.photosAlbum`.
- **Scopes**: `photoslibrary.appendonly`, `photoslibrary.readonly.appcreateddata`,
  `photoslibrary.edit.appcreateddata` (to take photos out of the album and set their descriptions) and `photospicker.mediaitems.readonly` (for
  *From Google Photos*), plus `userinfo.email` to show which account is connected. The Library API only sees photos this app uploaded.

**One-off setup** in Google Cloud Console, in the project of the shared OAuth client: enable the **Photos Library API**
and the **Google Photos Picker API** (*APIs & Services → Library*), and add the four scopes above under *Google Auth
Platform → Data Access*. While the app is in *Testing*, your account must be a test user (*Audience*).

## Make-up

The *Make-up* tab keeps the make-up you own: lipsticks, lip liners, eyeshadow palettes, blush and so on.

- **Products**: a type from `data/cosmetic-types.json` (two levels: Lips › Lip liner) or one of your own (*New type…*,
  saved as `ownType` and offered again for the next product), brand, name, shades, price, purchase and opening dates,
  notes and tags (the same tags as the closet). Brand suggests the brands you already have.
- **Shades**: one for a lipstick, one per pan for a palette. Each has a colour, an optional name and a finish from
  `data/finishes.json`. Set a colour by hand with the colour picker, or read it from a photo.
- **Reading colours from a photo, on this device**: *Pick shades* on a photo opens it large. Tap the middle of a pan or a
  paper swatch (tap size S, M or L), or drag a box over it; the app takes the median colour under the tap (the middle of
  a dragged box, so a pan's rim doesn't count) and adds it as a shade, with a numbered dot where it was read. Tap a
  shade's dot in the list first to read it again. For a swatch on white paper, *White paper* and a tap on bare paper
  scales each colour channel so the paper comes out a clean near-white, which corrects the light's colour and a dim
  exposure; shades already read from that photo are corrected too. No model and no network: just the pixels.
- **Photos**: the first photo of a product is its product photo, later ones swatch photos (tap the caption to switch).
  They are stored and synced like item photos (this browser, then the Google Photos album if connected; never Drive).
  Dropped photos on the *Make-up* tab make one product with all of them, since a palette and its paper swatch belong
  together; with a product open they're added to it. A new palette or a single first photo opens *Pick shades* straight away.
- **Views**: *Products* shows shelves by type; *Shades* shows every shade as a tile, lightest first within each type,
  so similar colours sit side by side; *Looks* shows your saved looks (below). Filter by category (Lips, Eyes, Face, Nails, your own types), finish and tag, and search
  brand, name, shade names, notes and tags.
- **Zoom**: in *Pick shades* and *Swatch sheet*, zoom the photo with − and +, Ctrl + scroll (or a trackpad pinch),
  or two fingers on a phone; one finger then moves around the zoomed photo, and a tap still reads a colour.
- **Swatch sheet**: one photo of swatches from several products (lipsticks from different brands swatched on one
  sheet of paper). Each swatch you tap is its own row: give it a shade name, finish, brand, product name and type, or
  add it to a product you already have. *Save products* makes one product per row, each with its own photo: a crop of
  the sheet around its swatch (with the white paper reading, so it can be read again). The sheet itself isn't stored.
- **Multicolour shades** (glitter, duochrome): turn on *✦ Multicolour* before tapping, or ✦ on a shade, or give it
  the glitter or duochrome finish, and the app reads the few colours that cover most of the spot instead of one
  average (k-means in Lab; colours closer than ΔE 12 merge, any under 7% of the spot drop out). The shade keeps them as
  `parts` (largest first, with each one's share) and shows them as stripes; its `hex` is the main one. A bigger
  dragged box catches more of the glitter.
- **Face palettes**: one *Face palette (contour, bronzer, highlight, blush)* holds all of them. Each shade in the form
  says which parts of the face it suits, from its colour and the ranges in `data/face-zones.json`, and a look's
  *Suggest* takes the best-suited pan for contour, bronzer and highlight (`ownFirst` zones) from whatever palette
  you have, in the season's palette or not.
- **Season gaps**: the *Shades* view opens with the colours your season suggests for each part of the face that none
  of your shades for that part comes near (within ΔE 20), up to eight a part, as a shopping guide.
- **Looks**: a look is a face palette, one colour each for lips, cheeks, contour, bronzer, highlight, eyelid,
  crease, liner and nails (`data/face-zones.json`), shown on a face chart. It opens in a large panel like an outfit:
  tap a part of the face, or its row, to choose from your own shades that fit it (✓ marks those in your colour
  season's palette, the same rule as the closet on the *Colour* tab) or from the season's colours to look for.
  *Suggest* fills the empty parts (your shades in the palette first, a season colour only where you have none) and
  *Mix it up* picks again for every part. Each zone in `data/face-zones.json` says which make-up types fit it and
  which part of the palette to suggest (colours or neutrals, with lightness, chroma and hue ranges), and `ownFirst` makes Suggest take your best-suited shade even outside the palette. Looks keep a
  season, a name, notes and tags.

## Next steps

From the spec, roughly in order:

1. **Picker import** of existing photos (a copy is re-uploaded to the album).
2. **Tune What I wore** on real photos: the match thresholds, and whether a fashion-trained embedding model does
   better than CLIP.
3. **Share export** for outfits (`format: "wardrobe-outfit"`), richer stats, wear calendar.

The open question from the spec about duplicate copies on Picker import still needs Petra's answer.

## Colour season

The *Colour* tab suggests one of the 12 colour seasons (Light, Warm and Bright Spring; Light, Cool and Soft Summer;
Soft, Warm and Deep Autumn; Deep, Cool and Bright Winter), shows its palette, neutrals, metals and the colours that are
harder to wear, and lists the closet items whose main colour is in the palette.

- **Questionnaire**: questions from `data/colour-quiz.json` (skin depth and undertone, veins, jewellery, white or
  cream, hair, eyes, contrast). Each answer scores warmth, depth and clarity; the suggestion is the season in
  `data/colour-seasons.json` nearest the average, with the next two closest. Any question can be skipped.
- **Photo help, on this device**: tap skin, hair, an eye and optionally something white on a photo. The app reads the
  colours under the taps (the white corrects for the colour of the light) and suggests answers, marked as from the
  photo, which you can change. The photo is only drawn on a canvas in the open panel: it is never saved, uploaded,
  kept in IndexedDB or added to the closet, and it is gone when the panel closes.
- **Override**: pick any season yourself. Only the chosen season id is saved, as `settings.colourSeason`, so it syncs;
  answers and samples are never saved.
- **In your palette**: an item counts when its main colour is within ΔE 20 of a palette or neutral swatch and nearer
  to one than to a colour to avoid. Prints and items with no colour aren't counted.
- The app says plainly that this is a guide, not a verdict.

## User data

One document, the same shape as the other apps (see STANDARDS.md, *User data*):

```json
{
  "version": 1,
  "settings": { "updatedAt": "…", "showSpicy": false, "filters": {}, "sort": "added", "sortReverse": false, "groupBy": "" },
  "items":   [ { "id": "…", "u": "…", "name": "Black midi skirt", "type": "skirt", "colours": ["black"],
                 "sizes": [ { "system": "letter", "value": "M" } ], "spicy": true, "words": ["…"],
                 "photos": [ { "id": "…", "role": "main", "mediaItemId": "…", "vec": { "m": "clip-b32-q8", "d": "…" } },
                             { "id": "…", "role": "cutout", "from": "…" } ],
                 "seen": [ { "m": "clip-b32-q8", "d": "…" } ], "followUp": true } ],
  "outfits": [ { "id": "…", "u": "…", "name": "Club night", "items": ["…"], "occasions": ["club-night"], "words": ["…"],
                 "photos": [ { "id": "…", "role": "worn" } ], "source": "photo",
                 "layout": { "<item id>": { "x": 12.5, "y": 10, "w": 48, "z": 2 } } } ],
  "wears":   [ { "id": "…", "u": "…", "at": "2026-11-09", "outfit": "…", "source": "photo", "photo": "…" } ],
  "words":   [ { "id": "…", "u": "…", "name": "Goth", "colour": "#7c3aed", "emoji": "🦇" } ],
  "cosmetics": [ { "id": "…", "u": "…", "added": "…", "type": "eyeshadow-palette", "brand": "…", "name": "Warm palette",
                 "shades": [ { "id": "…", "name": "Berry", "hex": "#b03a48", "finish": "matte", "raw": "#a8364a",
                               "at": { "photo": "…", "x": 0.08, "y": 0.11, "w": 0.06, "h": 0.06 } } ],
                 "photos": [ { "id": "…", "role": "product" }, { "id": "…", "role": "swatch", "white": [250, 225, 190] } ],
                 "price": 32, "purchased": "2026-10-01", "opened": "2026-10-02", "notes": "…", "words": ["…"] } ],
  "looks":   [ { "id": "…", "u": "…", "name": "Spring day", "season": "light-spring", "notes": "…", "words": ["…"],
                 "zones": { "lips": { "cos": "…", "shade": "…", "hex": "#e87473" }, "cheeks": { "hex": "#f6b89a", "name": "Peach", "find": true } } } ],
  "deleted": [ "…" ]
}
```

Photo bytes are not in this file: they stay in the browser and, if connected, in the Google Photos album (outfit
photos too). `vec` and `seen` are matching vectors for *What I wore*; `followUp` marks an item made from an outfit photo
that still needs a clean photo. A wear's `photo` is the id of the outfit photo taken that day; the photo itself is
listed in the outfit's `photos` (`role: "worn"`), so it syncs to Google Photos like any other. Wears logged before
`photo` existed are matched to the outfit's one unclaimed worn photo when that's unambiguous. An outfit's `layout` is optional: per item,
the top-left corner (`x`, `y`) and width (`w`) as percentages of the figure, and the stacking order (`z`); items without
an entry are placed by region, and entries for items no longer in the outfit are dropped on the next save.
A make-up product's type is `type` (an id from `data/cosmetic-types.json`) or `ownType` (the name of a type of your
own). A shade read from a photo keeps `at` (the photo and the box it was read from, as fractions of the photo) and
`raw` (its colour before white correction); a photo's `white` is the paper colour read from it.
A look's zone holds a shade of your make-up (`cos`, `shade`, and its `hex`, so the look still shows if the product
goes) or a season colour to look for (`find: true`).

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
| Size systems | `data/size-systems.json` | `data/schema/size-systems.schema.json` | Size systems and, where closed, their values; `single` marks a one-value system (One size) |
| Gender tags | `data/gender-tags.json` | `data/schema/gender-tags.schema.json` | The gender choices (Masc, Fem, Androgynous); anything else is a tag |
| Colour seasons | `data/colour-seasons.json` | `data/schema/colour-seasons.schema.json` | The 12 seasons on the *Colour* tab: where each sits on warmth, depth and clarity, its palette, neutrals, metals and colours to avoid, with a `why` |
| Colour questions | `data/colour-quiz.json` | `data/schema/colour-quiz.schema.json` | The *Colour* tab's questions and answers, how each answer scores, and which ones a photo sample can suggest |
| Make-up types | `data/cosmetic-types.json` | `data/schema/cosmetic-types.schema.json` | Two-level list of make-up types on the *Make-up* tab (Lips › Lip liner); `multi` marks palettes, which open the shade picker on their first photo |
| Face zones | `data/face-zones.json` | `data/schema/face-zones.schema.json` | The parts of a make-up look, the make-up types that fit each, and which season colours to suggest for it |
| Finishes | `data/finishes.json` | `data/schema/finishes.schema.json` | Finishes a make-up shade can have (matte, satin, shimmer…) |

Check the data locally with `node scripts/check-data.js`.

## Files

There is no build step: GitHub Pages serves the files as they are.

| File | What it holds |
| --- | --- |
| `index.html` | The page's markup; loads the styles and scripts below |
| `css/theme.css`, `css/app.css` | The shared look of petravanta's apps (a copy), then Wardrobe's own styles |
| `js/core.js` … `js/start.js` | The app, one file per area (closet, outfits, worn, colour, zoom, arrange, photos, Drive, Google Photos…), loaded in the order `index.html` lists them |
| `js/shared/` | Unchanged copies of the hub's Google sign-in and Drive store |
| `cutout-worker.js`, `recognise-worker.js` | Background workers for *Clean background* and *What I wore* |
| `sw.js` | The service worker: what is kept for offline use |

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
