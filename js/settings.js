'use strict';
function renderSettings() {
  const conn = store.known;
  const used = id => doc.items.filter(it => visible(it) && (it.words || []).includes(id)).length;
  $('#main').innerHTML = `<div class="stack">
  <section class="panel stack"><h3>Wardrobe words</h3>
    <p class="small muted">Your own words for your clothes, like goth, cozy or capsule. Tag items with them in the item form or with <i>Tag items</i> here, then filter or group the closet by them.</p>
    ${sortedWords().map(w => `<div class="row word-row">
      <label class="sr-only" for="wc-${esc(w.id)}">Colour of ${esc(w.name)}</label><input type="color" id="wc-${esc(w.id)}" data-word-colour="${esc(w.id)}" value="${esc(w.colour || '#888888')}">
      <label class="sr-only" for="we-${esc(w.id)}">Emoji for ${esc(w.name)}</label><input type="text" class="emoji" id="we-${esc(w.id)}" data-word-emoji="${esc(w.id)}" value="${esc(w.emoji || '')}" list="wordEmoji" placeholder="＋" autocomplete="off">
      <label class="sr-only" for="wn-${esc(w.id)}">Name</label><input type="text" id="wn-${esc(w.id)}" data-word-name="${esc(w.id)}" value="${esc(w.name)}">
      <span class="small muted">${used(w.id)} item${used(w.id) === 1 ? '' : 's'}</span><span class="grow"></span>
      <button type="button" class="btn sm" data-word-items="${esc(w.id)}">Tag items</button><button type="button" class="btn ghost sm" data-del-word="${esc(w.id)}" aria-label="Delete ${esc(w.name)}">×</button>
    </div>`).join('')}
    <datalist id="wordEmoji">${WORD_EMOJI.map(x => `<option value="${x}">`).join('')}</datalist>
    <p class="small muted">Give a word an emoji in the small box: pick a suggestion, or use your keyboard’s emoji picker (Windows + . or Ctrl + Cmd + Space). Clear it to go back to the colour dot.</p>
    <div class="row"><label class="sr-only" for="newWord">New word</label><input type="text" id="newWord" placeholder="New word"><button type="button" class="btn" data-act="add-word">Add</button></div>
  </section>
  <section class="panel stack"><h3>Google Drive</h3>
    <p>${conn ? `Syncing to <b>${esc(store.file)}</b> in your Google Drive. ${esc(store.status())}` : 'Your wardrobe is saved in this browser. Connect Google Drive to keep it in an open JSON file in your own Drive and use it on other devices.'}</p>
    <div class="row">${store.configured ? (conn ? '<button type="button" class="btn" data-drive="off">Disconnect</button>' : '<button type="button" class="btn primary" data-drive="on">Connect Google Drive</button>') : '<span class="muted">Drive sync is turned off in this copy.</span>'}</div>
  </section>
  <section class="panel stack"><h3>Google Photos</h3>
    <p>${GPhotos.known() ? `Item photos are saved to the <b>Wardrobe</b> album in the Google Photos of <b>${esc(GPhotos.email || 'your account')}</b>, so they show on your other devices too. To add photos you already have, tap <b>From Google Photos</b> in the closet or on an item: you choose them in Google Photos, and the app gets only those. ${esc(GPhotos.status())}` : 'Item photos are saved in this browser. Connect Google Photos to keep them in a <b>Wardrobe</b> album in your own Google Photos, so they show on your other devices too. You choose the account when you connect; it can be a different one from Google Drive.'}</p>
    <div class="row">${GPhotos.known() ? '<button type="button" class="btn" data-gphotos="on">Use another account</button><button type="button" class="btn" data-gphotos="off">Disconnect</button>' : '<button type="button" class="btn primary" data-gphotos="on">Connect Google Photos</button>'}</div>
    <p class="small muted">Photos of spicy items go to the same album, and Google Photos also shows them in your main photo library: <i>Show spicy items</i> only hides them in this app. Removing a photo here takes it out of the album; Google doesn’t let apps delete photos, so it stays in your library until you delete it there.</p>
  </section>
  <section class="panel stack"><h3>Privacy</h3>
    <label class="row"><input type="checkbox" id="showSpicy"${doc.settings.showSpicy ? ' checked' : ''}> Show spicy items</label>
    <p class="small muted">When this is off, spicy items are hidden everywhere: the closet, outfits, stats and search.</p>
  </section>
  <section class="panel stack"><h3>Clean background</h3>
    ${Cutout.supported ? `<label class="row"><input type="checkbox" id="autoCutout"${autoCutout() ? ' checked' : ''}> Clean the background of new photos automatically</label>
    <p class="small muted">Makes a cut-out of each item’s main photo, right here on your device: the photo is never sent anywhere for this. The first time, the browser downloads the model (tens of MB) and keeps it, so later cut-outs work offline. The original photo is always kept, and any photo has a <i>Clean background</i> button in the item form.</p>`
    : '<p class="small muted">This browser can’t run the clean-background model (it needs Web Workers and OffscreenCanvas).</p>'}
  </section>
  <section class="panel stack"><h3>What I wore, from a photo</h3>
    ${Recognise.supported ? (() => { const all = doc.items.filter(it => (it.photos || []).length), ready = all.filter(it => itemVecs(it).length).length; return `<p class="small muted">On the <i>Worn</i> tab, <i>From a photo</i> finds the clothes in a photo of your outfit and suggests the matching closet items, right here on your device: the photo is never sent anywhere for this. You confirm before anything is logged. The first time, the browser downloads two models (about 140 MB, more on a computer with WebGPU) and keeps them, so later it works offline.</p>
    <p class="small">${ready} of ${all.length} items with photos are ready for matching.</p>
    ${ready < all.length ? '<div class="row"><button type="button" class="btn" data-act="index">Get the closet ready now</button></div><p class="small muted">Only photos stored in this browser can be prepared here. The rest get ready the next time you open the app where they were added.</p>' : ''}`; })()
    : '<p class="small muted">This browser can’t run the recognition models (they need Web Workers and OffscreenCanvas).</p>'}
  </section>
  <section class="panel stack"><h3>Backup</h3>
    <p class="small muted">The backup is the same open JSON as the Drive file. Importing merges it in; nothing is overwritten.</p>
    <div class="row"><button type="button" class="btn" data-act="export">Export backup</button><button type="button" class="btn" data-act="import">Import backup</button></div>
  </section>
  <section class="panel stack"><h3>Import closet file</h3>
    <p class="small muted">Pick a closet capture file. Brand, type, colours, size, price, fabric and tags come across, with the cut-out photo and the original photo links. Items already imported are skipped.</p>
    <div class="row"><button type="button" class="btn" data-act="import-closet">Import closet file</button></div>
  </section></div>`;
}
