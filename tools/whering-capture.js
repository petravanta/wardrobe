// Records the data Whering's own page loads (brand, colour, category, price… whatever it holds for each item),
// so Wardrobe can import it with the photos. Paste into the console on any Whering page, then, IN the app and WITHOUT
// reloading, open the list of all your clothes, run  await wheringScroll()  to load every item, open an item or two
// for their details, then run:  wheringSave()
// To read every item's details, run  await wheringWalk({limit:1})  on the items list first, then  await wheringWalk()
// It only watches your own browser while you use Whering, never records passwords or sign-in tokens (request headers
// are not kept, and account/sign-in/profile calls are skipped), and sends nothing anywhere: it downloads a file.
(() => {
  // Visible progress on the page itself, because some sites switch the console's output off
  const say = (msg, bad) => {
    try { console.log('[Whering tools] ' + msg); } catch (e) { }
    let b = document.getElementById('wardrobe-say');
    if (!b) { b = document.createElement('div'); b.id = 'wardrobe-say'; b.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:12px;transform:translateX(-50%);max-width:90vw;padding:10px 16px;border-radius:10px;font:600 14px system-ui,sans-serif;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.3);pointer-events:none'; document.body.appendChild(b); }
    b.style.background = bad ? '#b3261e' : '#2e4a5e'; b.textContent = msg;
  };
  // Running it again starts clean: put back the page's own fetch and XHR first
  if (window.__wheringOrig) { window.fetch = window.__wheringOrig.fetch; XMLHttpRequest.prototype.open = window.__wheringOrig.open; }
  try {
  const SKIP = /auth|login|token|session|password|profile|\/me(\b|\/|\?)|account|payment|billing|analytics|track|sentry|segment|amplitude|mixpanel/i;
  const got = new Map();
  const keep = async (url, res) => {
    try {
      if (SKIP.test(url) || !/json/i.test(res.headers.get('content-type') || '')) return;
      const body = await res.clone().json();
      got.set(url, { url, at: new Date().toISOString(), body });
    } catch (e) { /* not JSON, or already read */ }
  };
  const f = window.__wheringOrig ? window.__wheringOrig.fetch : window.fetch;
  window.fetch = async function (...a) { const r = await f.apply(this, a); keep(typeof a[0] === 'string' ? a[0] : a[0].url, r); return r; };
  const open = window.__wheringOrig ? window.__wheringOrig.open : XMLHttpRequest.prototype.open;
  window.__wheringOrig = { fetch: f, open };
  XMLHttpRequest.prototype.open = function (m, url, ...rest) {
    this.addEventListener('load', () => {
      try { if (!SKIP.test(url) && /json/i.test(this.getResponseHeader('content-type') || '')) got.set(url, { url, at: new Date().toISOString(), body: JSON.parse(this.responseText) }); } catch (e) { }
    });
    return open.call(this, m, url, ...rest);
  };
  window.__wheringCapture = got;
  // Scrolls the current list to the bottom so everything in it loads (and gets recorded)
  window.wheringScroll = async () => {
    const el = [document.scrollingElement, ...document.querySelectorAll('main,div')].filter(Boolean).reduce((b, e) => (e.scrollHeight - e.clientHeight > b.scrollHeight - b.clientHeight ? e : b), document.scrollingElement);
    for (let last = -1, still = 0; still < 3;) { el.scrollTop = el.scrollHeight; await new Promise(r => setTimeout(r, 900)); const n = document.images.length; still = n === last ? still + 1 : 0; last = n; }
    say('Scrolled to the end of the list');
  };
  // Opens each item in turn like you would (one every ~10 seconds, a little random so it looks like a person browsing),
  // and records what its detail page shows plus the data it loads. Run on the list of items, WITHOUT reloading.
  //   await wheringWalk({ limit: 1 })   // try one item first
  //   await wheringWalk()               // then all of them (about 20 s per item)
  window.wheringWalk = async (o = {}) => { try {
    const every = o.every || 10000, pause = () => new Promise(r => setTimeout(r, every + Math.random() * 2000 - 1000));
    const hrefs = [...new Set([...document.querySelectorAll('a[href*="/pieces/"]')].map(a => a.getAttribute('href')))].slice(0, o.limit || Infinity);
    if (!hrefs.length) return say('No item links found on this page. Open the items list first (the page where each item is a tile).', true);
    say(`Walking ${hrefs.length} item(s), about ${Math.round(hrefs.length * every * 2 / 60000)} minute(s). Don't reload or close the tab.`);
    const listUrl = location.href; let n = 0;
    for (const h of hrefs) {
      let a = document.querySelector(`a[href="${h}"]`);
      if (!a) { await window.wheringScroll(); a = document.querySelector(`a[href="${h}"]`); }
      if (!a) { say('Could not find ' + h, true); continue; }
      a.click(); await pause();
      const main = document.querySelector('main') || document.body;
      got.set('detail:' + h, { url: h, at: new Date().toISOString(), page: location.href, title: document.title, text: main.innerText.slice(0, 4000),
        fields: [...main.querySelectorAll('dt,label,[class*=label i],[class*=title i]')].map(e => e.innerText.trim()).filter(Boolean).slice(0, 60) });
      say(`Read ${++n} of ${hrefs.length}…`);
      if (location.href !== listUrl) history.back();
      await pause();
    }
    say('Walk finished: now run wheringSave()');
  } catch (e) { say('Walk failed: ' + (e && e.message || e), true); } };
  window.wheringSave = () => {
    const out = { format: 'whering-capture', formatVersion: 1, savedAt: new Date().toISOString(), page: location.href, responses: [...got.values()] };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'whering-capture.json'; a.click();
    say(`Saved ${out.responses.length} item/response(s) to whering-capture.json in your Downloads.`);
  };
  say('Recording. Open your items list, then run wheringScroll() / wheringWalk(), then wheringSave().');
  } catch (e) { say('Capture failed to start: ' + (e && e.message || e), true); }
})();
