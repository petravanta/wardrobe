// Records the data Whering's own page loads (brand, colour, category, price… whatever it holds for each item),
// so Wardrobe can import it with the photos. Paste into the console on any Whering page, then click around IN the
// app (open the Bags category, open the item) WITHOUT reloading the page, then run:  wheringSave()
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
  window.wheringSave = () => {
    const out = { format: 'whering-capture', formatVersion: 1, savedAt: new Date().toISOString(), page: location.href, responses: [...got.values()] };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'whering-capture.json'; a.click();
    console.log(`Saved ${out.responses.length} response(s) to whering-capture.json`);
  };
  console.log('Recording Whering data. Browse (do not reload), then run wheringSave()');
})();
