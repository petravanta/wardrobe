// Reads the items on a Whering page (open one category, or All items for the whole closet; it scrolls to load them all) and downloads
// them as "whering-scan.json" for Wardrobe's Settings → Import from Whering. Paste into the browser console.
// It only reads the page you're on, from your own signed-in browser. It sends nothing anywhere.
(async () => {
  // Scroll to the bottom until nothing new loads, so the whole page (open "All items" for the full closet) is read
  const scroller = [document.scrollingElement, ...document.querySelectorAll('main,div')].filter(Boolean).reduce((b, e) => (e.scrollHeight - e.clientHeight > b.scrollHeight - b.clientHeight ? e : b), document.scrollingElement);
  for (let last = -1, still = 0; still < 3;) {
    scroller.scrollTop = scroller.scrollHeight; await new Promise(r => setTimeout(r, 900));
    const n = document.images.length; still = n === last ? still + 1 : 0; last = n;
  }
  scroller.scrollTop = 0;
  const MIN = 90; // ignore icons and avatars smaller than this (px)
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const heading = clean((document.querySelector('h1') || {}).textContent) || clean(document.title);
  const seen = new Set(), items = [];
  for (const img of document.querySelectorAll('img')) {
    const r = img.getBoundingClientRect(), url = img.currentSrc || img.src;
    if (!url || seen.has(url) || r.width < MIN || r.height < MIN || /avatar|logo|icon|sprite/i.test(url)) continue;
    seen.add(url);
    const a = img.closest('a'), card = img.closest('li,article,[role=listitem],a,div');
    items.push({
      name: clean(img.alt || img.title || img.getAttribute('aria-label')),
      text: clean(card && card.innerText).slice(0, 200),
      href: a ? a.href : '',
      imageUrl: url
    });
  }
  // Keep a copy of each photo so it still exists if the link expires (skipped quietly if the site blocks it)
  for (const it of items) {
    try {
      const b = await (await fetch(it.imageUrl)).blob();
      it.imageData = await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
    } catch (e) { it.imageData = null; }
  }
  const out = { format: 'whering-scan', formatVersion: 1, scannedAt: new Date().toISOString(), page: location.href, category: heading, items };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = 'whering-scan.json'; a.click();
  console.log(`Whering scan: ${items.length} item(s) from "${heading}", ${items.filter(i => i.imageData).length} with a saved photo.`);
})();
