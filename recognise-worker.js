/* What I wore, on this device. See README, "What I wore, from a photo".
   Runs two models off the page's main thread:
   - a clothes-parsing model that finds the garments on a person in a photo (one mask per kind: top, skirt, shoes…)
   - an image-embedding model (CLIP) that turns a garment picture into a vector, so the page can compare it with the closet
   In:  { id, op: 'segment', blob }  an outfit photo (as Photos.add stored it)
        { id, op: 'embed', blob }    one garment picture (a cut-out, a photo or a crop from 'segment')
   Out: { id, progress: {file, loaded, total} } while models download, then
        { id, segments: [{ label, area, box: [x, y, w, h], blob }] }   blob: transparent PNG of just that garment
        { id, vec: Float32Array }                                       unit length
        or { id, error } */
import { env, pipeline, AutoProcessor, CLIPVisionModelWithProjection, RawImage } from './vendor/transformers.min.js';

// Models come from the Hugging Face hub; transformers.js keeps them in the browser's Cache Storage after the first run,
// and sw.js keeps the ONNX Runtime WebAssembly. Photos are never sent anywhere.
env.allowLocalModels = false;
const SEG_MODEL = 'Xenova/segformer_b2_clothes';
// The embedding model and its precision are fixed (the page names them EMBED_ID and stores that next to each vector),
// so vectors made on different devices can be compared. Changing either means changing EMBED_ID: every vector is made again.
const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';

// The labels the clothes model knows that are things you'd keep in a closet; left and right shoes become one pair
const KEEP = { 'Hat': 'hat', 'Sunglasses': 'sunglasses', 'Upper-clothes': 'top', 'Skirt': 'skirt', 'Pants': 'pants',
  'Dress': 'dress', 'Belt': 'belt', 'Left-shoe': 'shoes', 'Right-shoe': 'shoes', 'Bag': 'bag', 'Scarf': 'scarf' };
const MIN_AREA = 0.004; // of the photo; smaller patches are usually noise (a strap, a bit of a bag behind a leg)

let current = 0;
const progress = p => { if (p.status === 'progress') self.postMessage({ id: current, progress: { file: p.file, loaded: p.loaded, total: p.total } }); };

async function gpu() { try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) { return false; } }

let segP = null, clipP = null;
// WebGPU where there is one (full precision), otherwise WebAssembly with the 8-bit model, which is smaller and faster there
function segmenter() {
  return segP || (segP = (async () => {
    if (await gpu()) { try { return await pipeline('image-segmentation', SEG_MODEL, { device: 'webgpu', dtype: 'fp32', progress_callback: progress }); } catch (e) { /* a GPU that can't run it */ } }
    return pipeline('image-segmentation', SEG_MODEL, { device: 'wasm', dtype: 'q8', progress_callback: progress });
  })().catch(e => { segP = null; throw e; }));
}
// Always WebAssembly and 8-bit, so every device makes the same vectors for the same picture
function embedder() {
  return clipP || (clipP = (async () => {
    const [processor, model] = await Promise.all([
      AutoProcessor.from_pretrained(CLIP_MODEL, { progress_callback: progress }),
      CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { device: 'wasm', dtype: 'q8', progress_callback: progress })
    ]);
    return { processor, model };
  })().catch(e => { clipP = null; throw e; }));
}

const canvas = (w, h) => { const c = new OffscreenCanvas(w, h); return [c, c.getContext('2d', { willReadFrequently: true })]; };

async function segment(blob) {
  const bmp = await createImageBitmap(blob), W = bmp.width, H = bmp.height;
  const [src, g] = canvas(W, H); g.drawImage(bmp, 0, 0); bmp.close();
  const px = g.getImageData(0, 0, W, H);
  const seg = await segmenter();
  const parts = await seg(new RawImage(px.data, W, H, 4).rgb());
  // One mask per kept kind (shoes merged), at the photo's own size
  const masks = new Map();
  for (const p of parts) {
    const kind = KEEP[p.label]; if (!kind) continue;
    const m = p.mask, md = m.data, scaleX = m.width / W, scaleY = m.height / H;
    let a = masks.get(kind); if (!a) masks.set(kind, a = new Uint8Array(W * H));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (md[((y * scaleY) | 0) * m.width + ((x * scaleX) | 0)] > 127) a[y * W + x] = 1;
    }
  }
  const out = [];
  for (const [kind, a] of masks) {
    let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[y * W + x]) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (n / (W * H) < MIN_AREA) continue;
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, [c, cg] = canvas(w, h), img = cg.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((y + y0) * W + (x + x0)), d = (y * w + x) * 4;
      if (!a[s]) continue;
      img.data[d] = px.data[s * 4]; img.data[d + 1] = px.data[s * 4 + 1]; img.data[d + 2] = px.data[s * 4 + 2]; img.data[d + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    out.push({ label: kind, area: n / (W * H), box: [x0, y0, w, h], blob: await c.convertToBlob({ type: 'image/png' }) });
  }
  // Top to bottom, the way you'd read an outfit
  return out.sort((p, q) => p.box[1] - q.box[1]);
}

// Garment pictures differ in shape (a tall dress, wide shoes) and background (a cut-out is transparent, a photo isn't):
// put each one in the middle of a white square first, so CLIP's centre crop keeps all of it and backgrounds match
async function embed(blob) {
  const bmp = await createImageBitmap(blob), S = 256, s = S / Math.max(bmp.width, bmp.height);
  const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const [, g] = canvas(S, S); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.drawImage(bmp, (S - w) / 2, (S - h) / 2, w, h); bmp.close();
  const { processor, model } = await embedder();
  const inputs = await processor(new RawImage(g.getImageData(0, 0, S, S).data, S, S, 4).rgb());
  const { image_embeds } = await model(inputs);
  const v = Float32Array.from(image_embeds.data); let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

// One job at a time, in order: the page queues them (Recognise in index.html)
self.onmessage = async e => {
  const { id, op, blob } = e.data; current = id;
  try {
    if (op === 'segment') {
      const segments = await segment(blob);
      self.postMessage({ id, segments });
    } else if (op === 'embed') {
      const vec = await embed(blob);
      self.postMessage({ id, vec }, [vec.buffer]);
    } else throw new Error('Unknown job ' + op);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
