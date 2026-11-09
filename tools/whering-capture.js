// Records the data Whering's own page loads (brand, colour, category, price… whatever it holds for each item),
// so Wardrobe can import it with the photos. Paste into the console on any Whering page, then, IN the app and WITHOUT
// reloading, open the list of all your clothes, run  await wheringScroll()  to load every item, open an item or two
// for their details, then run:  wheringSave()
// It only watches your own browser while you use Whering, never records passwords or sign-in tokens (request headers
// are not kept, and account/sign-in/profile calls are skipped), and sends nothing anywhere: it downloads a file.
(() => {
  if (window.__wheringCapture) return console.log('Already recording: browse Whering, then run wheringSave()');
  const SKIP = /auth|login|token|session|password|profile|\/me(\b|\/|\?)|account|payment|billing|analytics|track|sentry|segment|amplitude|mixpanel/i;
  const got = new Map();
  const keep = async (url, res) => {
    try {
      if (SKIP.test(url) || !/json/i.test(res.headers.get('content-type') || '')) return;
      const body = await res.clone().json();
      got.set(url, { url, at: new Date().toISOString(), body });
    } catch (e) { /* not JSON, or already read */ }
  };
  const f = window.fetch;
  window.fetch = async function (...a) { const r = await f.apply(this, a); keep(typeof a[0] === 'string' ? a[0] : a[0].url, r); return r; };
  const open = XMLHttpRequest.prototype.open;
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
    console.log('Scrolled to the end of the list');
  };
  window.wheringSave = () => {
    const out = { format: 'whering-capture', formatVersion: 1, savedAt: new Date().toISOString(), page: location.href, responses: [...got.values()] };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'whering-capture.json'; a.click();
    console.log(`Saved ${out.responses.length} response(s) to whering-capture.json`);
  };
  console.log('Recording Whering data. Browse (do not reload), then run wheringSave()');
})();
