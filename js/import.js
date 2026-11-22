'use strict';
/* ---------- Import closet file ---------- */
// Reads a closet capture file (item details: brand, type, colours, size, price, fabric, tags…) or a photos-only
// scan file of the person's own closet. Items get Wardrobe's own types, colours, materials and occasions, found through the
// aliases in data/*.json; what has no match stays untouched in item.source, so nothing is lost.
const whFind = (set, name) => { const n = String(name || '').toLowerCase(); return K[set].find(x => x.id === n || (x.aliases || []).includes(n) || x.name.toLowerCase() === n); };
const whSlot = { tops: 'tops', bottoms: 'bottoms', full: 'dresses', outerwear: 'outerwear', footwear: 'shoes', bags: 'bag', accessories: 'accessories' };
const prettyTax = t => String(t || '').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
function whSize(sz, footwear) {
  const v = String(sz.size || '').trim(); if (!v) return null;
  const m = v.match(/^(UK|US|EU)\s*(.+)$/i);
  if (m) { const c = m[1].toLowerCase(); return { system: footwear ? 'shoe-' + c : c, value: m[2].trim() }; }
  return { system: /^(x{0,2}s|m|l|x{1,3}l|3xl)$/i.test(v) ? 'letter' : (footwear ? 'shoe-' + (sz.size_country || 'uk') : 'letter'), value: v };
}
function whItem(p) {
  const slot = ((p.size || [])[0] || {}).category, known = whFind('types', p.tax);
  const type = known ? known.id : (whSlot[slot] || 'accessories'), footwear = typeGroup(type) === 'shoes';
  const it = newItem(); it.type = type; it.photos = [];
  const brand = (p.brand || '').trim(), tname = known ? kname('types', type) : prettyTax(p.tax || type);
  it.name = brand ? `${brand} ${tname.toLowerCase()}` : tname;
  const uniq = a => [...new Set(a.filter(Boolean))];
  it.colours = uniq((p.colours || []).map(c => (whFind('colours', c.id) || whFind('colours', c.name) || {}).id));
  it.sizes = (p.size || []).map(z => whSize(z, footwear)).filter(Boolean);
  const g = ((p.size || [])[0] || {}).gender; it.gender = g === 'men' ? ['masc'] : g === 'women' ? ['fem'] : [];
  if (brand) it.brand = brand;
  if (p.price > 0) it.price = p.price;
  it.materials = uniq((p.fabric || []).map(f => (whFind('materials', f) || {}).id));
  const occ = [...(p.occasions || []), ...(p.season || [])];
  it.seasons = uniq(occ.map(o => (K.byId.seasons.get(o) || {}).id));
  it.occasions = uniq(occ.filter(o => !K.byId.seasons.has(o)).map(o => (whFind('occasions', o) || {}).id));
  if (p.comments) it.notes = p.comments;
  if (!known) it.needsReview = true;
  it.source = { id: p.id, tax: p.tax, imageUrl: p.image_url || undefined, cutoutUrl: p.nobg_image_url || undefined, attributes: p.attributes, styles: p.styles,
    fabric: p.fabric, occasions: p.occasions, colours: (p.colours || []).map(c => c.id), size: p.size, careDetails: p.care_details, favorite: p.is_favorite || undefined,
    wornCount: p.worn_count || undefined, createdAt: p.created_at ? new Date(p.created_at).toISOString() : undefined };
  return it;
}
// The cut-out is fetched straight from the source's image host; the original photo's link is kept, since its host won't allow a copy from here
async function whPhoto(it) {
  const u = it.source.cutoutUrl; if (!u) return;
  try { const r = await fetch(u); if (!r.ok) throw 0; const b = await r.blob(); it.photos = [{ id: await Photos.add(new File([b], 'cutout.png', { type: b.type || 'image/png' })), role: 'cutout' }]; } catch (e) { /* link only */ }
}
async function importCloset(file) {
  let d; try { d = JSON.parse(await file.text()); } catch (e) { d = null; }
  if (d && d.format === 'closet-scan' && Array.isArray(d.items)) return importClosetScan(d);
  if (!d || d.format !== 'closet-capture' || !Array.isArray(d.responses)) return toast('That isn’t a closet capture or scan file');
  const pieces = new Map();
  d.responses.forEach(r => { const b = r.body; if (!b) return; (b.pieces || []).forEach(p => p.id && pieces.set(p.id, { ...pieces.get(p.id), ...p })); if (b.id && b.tax !== undefined) pieces.set(b.id, { ...pieces.get(b.id), ...b }); });
  if (!pieces.size) return toast('No items in that file. Scroll your items list to the end before saving.');
  const have = new Set(doc.items.map(i => i.source && i.source.id).filter(Boolean));
  const todo = [...pieces.values()].filter(p => !have.has(p.id)), skipped = pieces.size - todo.length;
  let added = 0, photoless = 0, review = 0;
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4).map(whItem);
    await Promise.all(batch.map(whPhoto));
    batch.forEach(it => { if (!it.photos.length) photoless++; if (it.needsReview) review++; put('items', it); added++; });
    toast(`Importing… ${added} of ${todo.length}`, 60000);
  }
  tab = 'closet'; lsSet(TAB_KEY, tab); render();
  toast(`Imported ${added} item${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already here` : ''}${photoless ? `, ${photoless} without a saved photo` : ''}${review ? `, ${review} with a type to check` : ''}`, 7000);
}
// A scan only has photos and links (no details); kept for pages where the details can't be read
async function importClosetScan(scan) {
  const have = new Set(doc.items.map(i => i.source && i.source.imageUrl).filter(Boolean));
  let added = 0, skipped = 0;
  for (const s of scan.items) {
    if (!s.imageUrl || have.has(s.imageUrl)) { skipped++; continue; }
    const it = newItem(); it.type = whSlot[String(scan.category || '').toLowerCase()] || 'accessories'; it.needsReview = true; it.photos = [];
    it.name = kname('types', it.type); it.source = { imageUrl: s.imageUrl, href: s.href || undefined, scannedAt: scan.scannedAt };
    try { const blob = s.imageData ? await (await fetch(s.imageData)).blob() : null; if (blob) it.photos = [{ id: await Photos.add(new File([blob], 'photo.png', { type: blob.type })), role: 'cutout' }]; } catch (e) { }
    put('items', it); have.add(s.imageUrl); added++;
  }
  tab = 'closet'; lsSet(TAB_KEY, tab); render();
  toast(`Imported ${added} photo${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already here` : ''}`, 5000);
}
$('#closetIn').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importCloset(f); });
