'use strict';
/* ---------- Google Photos album ---------- */
// Item photos go to an app-created "Wardrobe" album in the user's own Google Photos, and each photo keeps the album
// copy's mediaItemId, which syncs with the rest of the data. Another browser (another device, or the app on its other
// address) downloads what it doesn't have and caches it in IndexedDB. The Library API only sees what this app uploaded.
// Its own token under its own key (wardrobe.photos): the Photos scopes never go into the shared petravanta.google token,
// which would change what every app asks for. Like Drive, a token lasts an hour and renews on a tap.
const GPhotos = (() => {
  const API = 'https://photoslibrary.googleapis.com/v1', KEYP = 'wardrobe.photos';
  const G = s => 'https://www.googleapis.com/auth/' + s;
  const NEED = [G('photoslibrary.appendonly'), G('photoslibrary.readonly.appcreateddata')];
  const SCOPES = [...NEED, G('photoslibrary.edit.appcreateddata'), G('photospicker.mediaitems.readonly'), G('userinfo.email')].join(' ');
  const st = () => lsGet(KEYP) || {};
  const set = v => lsSet(KEYP, { ...st(), ...v });
  const S = { busy: false, err: null, ask: 0, timer: null, done: 0, todo: 0 };
  // photo id -> {url, exp}: Google's own address for an album photo this browser doesn't have. Google sends no CORS
  // headers for album images, so another site can show them in <img> but can't copy them into its own storage; the
  // address lasts an hour (Google's baseUrl), after which it is asked for again.
  const direct = new Map();
  const fetching = new Set();
  const known = () => !!st().known && !!GOOGLE_CLIENT_ID;
  const live = () => { const s = st(); return known() && !!s.token && s.exp > Date.now(); };
  const note = () => { if (tab === 'settings' && !$('#layer').innerHTML) render(); };
  if (known()) GoogleToken.gis().catch(() => {});

  // Opens Google's window, so call this from a tap. The Photos account can differ from the Drive one: connecting asks
  // which account to use, and later renewals hint the account chosen then. Resolves the account's email.
  async function signIn(choose) {
    await GoogleToken.gis();
    const r = await new Promise((res, rej) => google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPES, login_hint: choose ? undefined : st().email || undefined, include_granted_scopes: false, error_callback: rej,
      callback: r => r.error ? rej(r) : google.accounts.oauth2.hasGrantedAllScopes(r, ...NEED) ? res(r) : rej({ code: 'scopes' })
    }).requestAccessToken({ prompt: choose ? 'select_account consent' : '' }));
    const t = { token: r.access_token, exp: Date.now() + (Number(r.expires_in || 3600) - 60) * 1000 };
    let email = '';
    try { email = (await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + t.token } })).json()).email || ''; } catch (e) { }
    if (!choose && st().email && email && email !== st().email) throw { code: 'account' }; // a renewal must stay on the chosen account
    set({ ...t, known: true, email: email || st().email || '' });
    return email;
  }
  // Photos already uploaded belong to the account they went to (photo.mediaAccount). A different account starts a new
  // album, and this browser uploads its photos again there; nothing is removed from the old one.
  function useAccount(email) {
    if (!email || doc.settings.photosAccount === email) return;
    set({ remove: [] });
    doc.settings = { ...doc.settings, photosAccount: email, photosAlbum: '', updatedAt: now() }; save();
  }
  async function call(path, opt = {}) {
    if (!live()) throw { code: 'expired' };
    let r; try { r = await fetch((path.startsWith('https:') ? '' : API) + path, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + st().token } }); } catch (e) { throw { code: 'offline' }; }
    if (r.status === 401) { set({ token: null, exp: 0 }); throw { code: 'expired' }; }
    if (!r.ok) { let msg = ''; try { msg = (await r.json()).error.message; } catch (e) { } throw { code: 'http', status: r.status, msg }; }
    return r;
  }
  const json = (path, body) => call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  // The album's id is in the synced settings, so every device uses the same album
  async function album() {
    if (doc.settings.photosAlbum) return doc.settings.photosAlbum;
    const a = await json('/albums', { album: { title: 'Wardrobe' } });
    setSetting('photosAlbum', a.id); return a.id;
  }
  function setMediaId(itemId, photoId, mediaItemId, mediaDesc) {
    const mark = ps => (ps || []).map(p => p.id === photoId ? { ...p, mediaItemId, mediaAccount: doc.settings.photosAccount, ...(mediaDesc ? { mediaDesc } : {}) } : p);
    const it = itemById(itemId); if (it) put('items', { ...it, photos: mark(it.photos) });
    const o = doc.outfits.find(x => x.id === itemId); if (o) put('outfits', { ...o, photos: mark(o.photos) }); // an outfit photo (What I wore)
    if (editing && editing.id === itemId) editing.photos = mark(editing.photos);
  }
  // Saved photos (of items, and outfit photos) not in this account's album yet
  const waiting = () => [...doc.items, ...doc.outfits].flatMap(it => (it.photos || []).filter(p => !inAlbum(p) && !regenerable(p)).map(p => [it.id, p]));
  // Each upload gets a description naming the app, the kind of photo and the item or outfit, so it can be told apart
  // in Google Photos. Photos uploaded before that get it later with mediaItems.patch, which Google allows for media
  // items the app created (photoslibrary.edit.appcreateddata, already in SCOPES). photo.mediaDesc is the text it has.
  const KIND_TEXT = { main: 'item photo', label: 'label photo', cutout: 'clean background', crop: 'crop from an outfit photo', worn: 'outfit photo' };
  const describe = (ownerId, p) => {
    const it = itemById(ownerId), o = !it && doc.outfits.find(x => x.id === ownerId);
    const name = it ? itemLabel(it) : o ? (o.name || 'Outfit') : '';
    return ['Wardrobe app', KIND_TEXT[p.role] || 'photo', name].filter(Boolean).join(' · ').slice(0, 900);
  };
  function setDesc(ownerId, photoId, mediaDesc) {
    const mark = ps => (ps || []).map(p => p.id === photoId ? { ...p, mediaDesc } : p);
    const it = itemById(ownerId); if (it) put('items', { ...it, photos: mark(it.photos) });
    const o = doc.outfits.find(x => x.id === ownerId); if (o) put('outfits', { ...o, photos: mark(o.photos) });
    if (editing && editing.id === ownerId) editing.photos = mark(editing.photos);
  }
  async function sync() {
    clearTimeout(S.timer);
    if (!live() || S.busy) return;
    S.busy = true; S.err = null; note();
    try {
      // Removed in the app: out of the album (Google doesn't let apps delete a photo from the library)
      const gone = st().remove || [];
      if (gone.length && doc.settings.photosAlbum) {
        for (let i = 0; i < gone.length; i += 50) await json(`/albums/${doc.settings.photosAlbum}:batchRemoveMediaItems`, { mediaItemIds: gone.slice(i, i + 50) }).catch(e => { if (e.code !== 'http') throw e; });
      }
      set({ remove: [] });
      // Only photos whose bytes are in this browser; the rest were added on another device that uploads them
      const todo = []; for (const [itemId, p] of waiting()) { const blob = await Photos.full(p.id); if (blob) todo.push([itemId, p, blob]); }
      S.todo = todo.length; S.done = 0;
      if (todo.length) {
        const albumId = await album();
        for (let i = 0; i < todo.length; i += 20) { // upload the bytes one by one, then add them to the album 20 at a time
          const chunk = todo.slice(i, i + 20), items = [];
          for (const [owner, p, blob] of chunk) {
            const token = await (await call('/uploads', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Goog-Upload-Content-Type': blob.type || 'image/jpeg', 'X-Goog-Upload-Protocol': 'raw' }, body: blob })).text();
            items.push({ description: describe(owner, p), simpleMediaItem: { uploadToken: token, fileName: `wardrobe-${p.id}.${blob.type === 'image/png' ? 'png' : 'jpg'}` } });
          }
          const r = await json('/mediaItems:batchCreate', { albumId, newMediaItems: items });
          (r.newMediaItemResults || []).forEach((m, k) => { if (m.mediaItem) { setMediaId(chunk[k][0], chunk[k][1].id, m.mediaItem.id, items[k].description); S.done++; } });
          note();
        }
      }
      // Descriptions for photos uploaded before there were any, or whose item was renamed since; a few at a time
      const skip = new Set(st().descSkip || []), stale = [...doc.items, ...doc.outfits].flatMap(it => (it.photos || []).filter(p => inAlbum(p) && !skip.has(p.mediaItemId)).map(p => [it.id, p, describe(it.id, p)])).filter(([, p, d]) => p.mediaDesc !== d);
      for (const [owner, p, d] of stale.slice(0, 40)) {
        try { await call(`/mediaItems/${encodeURIComponent(p.mediaItemId)}?updateMask=description`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.mediaItemId, description: d }) }); setDesc(owner, p.id, d); }
        catch (e) { if (e.code !== 'http') throw e; set({ descSkip: [...(st().descSkip || []), p.mediaItemId] }); } // not this app's, or gone: don't ask again
      }
    } catch (e) {
      S.err = e.code === 'expired' ? null : e.code === 'offline' ? 'offline' : (e.msg || 'error');
      // The album was deleted in Google Photos: make a new one next time
      if (e.code === 'http' && e.status === 400 && /album/i.test(e.msg || '')) setSetting('photosAlbum', '');
    } finally { S.busy = false; S.todo = 0; note(); }
  }
  // Photos added elsewhere: shown from the album. pairs: [[photoId, mediaItemId]]
  async function fetchMissing(pairs) {
    pairs = pairs.filter(([id]) => !fetching.has(id)); pairs.forEach(([id]) => fetching.add(id));
    let got = 0;
    for (let i = 0; i < pairs.length; i += 50) {
      const chunk = pairs.slice(i, i + 50);
      let j; try { j = await (await call('/mediaItems:batchGet?' + chunk.map(([, m]) => 'mediaItemIds=' + encodeURIComponent(m)).join('&'))).json(); }
      catch (e) { pairs.slice(i).forEach(([id]) => fetching.delete(id)); break; } // try again on a later render
      for (const [k, r] of (j.mediaItemResults || []).entries()) {
        const m = r.mediaItem; if (!m) continue;
        direct.set(chunk[k][0], { url: m.baseUrl + '=w800-h800', exp: Date.now() + 50 * 60000 }); got++;
      }
    }
    return got;
  }
  // Photos the user already has: Google's Picker. The app can't browse the library; the user chooses photos in a
  // Google Photos window and the app gets only those, for this session. win: a window opened on the tap (browsers block
  // one opened later), sent to the picker once the session exists. Resolves { files, failed }; the bytes come straight
  // to this browser and then go through the same path as any added photo.
  const PICK = 'https://photospicker.googleapis.com/v1';
  const secs = (s, d) => (parseFloat(s) || d);
  async function pick(win, progress) {
    let s;
    try { s = await json(PICK + '/sessions', {}); }
    catch (e) { win.close(); throw e.code === 'http' && e.status === 403 ? { code: 'scopes' } : e; }
    win.location.href = s.pickerUri + '/autoclose';
    try {
      const every = secs(s.pollingConfig && s.pollingConfig.pollInterval, 5) * 1000;
      const until = Date.now() + secs(s.pollingConfig && s.pollingConfig.timeoutIn, 1800) * 1000;
      let closed = 0;
      for (;;) {
        // Check again as soon as the user is back in the app, not only on the timer (background tabs are slowed)
        await new Promise(res => { const t = setTimeout(done, every); function done() { clearTimeout(t); removeEventListener('focus', done); res(); } addEventListener('focus', done); });
        s = await (await call(`${PICK}/sessions/${s.id}`)).json();
        if (s.mediaItemsSet) break;
        if (win.closed && ++closed > 2) throw { code: 'cancelled' }; // closed without choosing
        if (Date.now() > until) throw { code: 'timeout' };
      }
      const picked = []; let page = '';
      do {
        const j = await (await call(`${PICK}/mediaItems?sessionId=${encodeURIComponent(s.id)}&pageSize=100${page ? '&pageToken=' + encodeURIComponent(page) : ''}`)).json();
        picked.push(...(j.mediaItems || [])); page = j.nextPageToken;
      } while (page);
      const photos = picked.filter(m => m.type !== 'VIDEO' && m.mediaFile), files = []; let failed = 0;
      for (const m of photos) {
        progress && progress(files.length + failed + 1, photos.length);
        const b = await bytes(m.mediaFile.baseUrl + '=w2048-h2048');
        if (!b) { failed++; continue; }
        const name = (m.mediaFile.filename || 'photo').replace(/\.[^.]+$/, '') + (b.type === 'image/png' ? '.png' : '.jpg');
        files.push(new File([b], name, { type: b.type, lastModified: Date.parse(m.createTime) || Date.now() }));
      }
      return { files, failed, videos: picked.length - photos.length };
    } finally {
      if (!win.closed) win.close();
      call(`${PICK}/sessions/${s.id}`, { method: 'DELETE' }).catch(() => {});
    }
  }
  // Google asks for the token on the request. If this browser can't send it to Google's image server (CORS), try
  // without it before giving up.
  async function bytes(url) {
    for (const opt of [{ headers: { Authorization: 'Bearer ' + st().token } }, {}]) {
      try { const r = await fetch(url, opt); if (r.ok) { const b = await r.blob(); if (/^image\//.test(b.type)) return b; } console.warn('Google Photos image', r.status, opt.headers ? 'with token' : 'without token'); }
      catch (e) { console.warn('Google Photos image blocked', opt.headers ? 'with token' : 'without token', e); }
    }
    return null;
  }
  // Tokens last an hour. Renew on a tap when close to running out, unless Drive needs this tap (one Google window per tap).
  document.addEventListener('click', e => {
    if (!known() || e.target.closest('[data-gphotos],[data-drive]')) return;
    if ((st().exp || 0) - Date.now() > 10 * 60000 || Date.now() - S.ask < 60000) return;
    const d = GoogleToken.get(lsGet('wardrobe.drive.email'));
    if (store.known && !(d && d.exp - Date.now() > 10 * 60000)) return;
    S.ask = Date.now(); signIn().then(() => { sync(); if (!$('#layer').innerHTML) render(); }).catch(() => note());
  }, true);
  addEventListener('online', () => sync());
  return {
    known, live, sync, fetchMissing, pick, renew: () => signIn(), describe,
    direct(id) {
      const d = direct.get(id); if (!d) return '';
      if (d.exp > Date.now()) return d.url;
      direct.delete(id); fetching.delete(id); return '';
    },
    soon() { if (!live()) return; clearTimeout(S.timer); S.timer = setTimeout(sync, 2000); },
    async connect() {
      const email = await signIn(true), was = doc.settings.photosAccount;
      if (was && email && email !== was && !confirm(`Your photos are in the Wardrobe album of ${was}. Switch to ${email}? A new Wardrobe album is made there, and this browser uploads its photos again. Nothing is deleted from ${was}.`)) { lsSet(KEYP, null); throw { code: 'cancelled' }; }
      useAccount(email); await sync();
    },
    get email() { return st().email || ''; },
    // Photos removed in the app leave the album on the next sync
    unlink(photos) {
      const ids = photos.filter(inAlbum).map(p => p.mediaItemId); if (!ids.length || !known()) return;
      set({ remove: [...new Set([...(st().remove || []), ...ids])] }); this.soon();
    },
    signOut() { lsSet(KEYP, null); direct.clear(); },
    status() {
      const left = waiting().length;
      if (S.busy) return S.todo ? `Uploading photos: ${S.done} of ${S.todo}…` : 'Checking the album…';
      if (S.err === 'offline') return 'Offline · photos upload when you’re back online';
      if (S.err) return `Couldn’t reach Google Photos (${S.err}) · will retry`;
      if (!live()) return left ? `${left} photo${left > 1 ? 's' : ''} waiting · tap anywhere to reconnect` : 'Tap anywhere to reconnect';
      return left ? `${left} photo${left > 1 ? 's' : ''} not in the album yet (added on another device, or still uploading)` : 'All photos are in the album.';
    }
  };
})();
