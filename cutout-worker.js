/* Clean background, on this device. See README, "Clean background".
   Runs the segmentation model off the page's main thread so the app stays responsive while it works.
   In:  { id, blob }                  the photo (JPEG or PNG, at most 1600 px, as Photos.add stored it)
   Out: { id, progress: {key, current, total} } while it works, then { id, blob } (transparent PNG, trimmed) or { id, error } */
import { removeBackground } from './vendor/background-removal.js';

// The model files come from IMG.LY's CDN, versioned to match the bundle; the service worker keeps them (sw.js).
// To self-host, copy the @imgly/background-removal-data dist folder next to the app and point this at it.
const PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
const MODEL = 'isnet_fp16'; // the library's default: one download (tens of MB, once) serves both WebGPU and WebAssembly

let device = null, current = 0;
// The library keeps the progress callback of its first call, so it reports through whichever job is current
const progress = (key, done, total) => self.postMessage({ id: current, progress: { key, current: done, total } });
const config = d => ({ publicPath: PUBLIC_PATH, model: MODEL, device: d, output: { format: 'image/png' }, progress });

async function pickDevice() {
  try { return navigator.gpu && await navigator.gpu.requestAdapter() ? 'gpu' : 'cpu'; } catch (e) { return 'cpu'; }
}

// Crops away the empty margin around the garment, leaving a little air, so cut-outs line up in the grid
async function trim(png) {
  const bmp = await createImageBitmap(png), w = bmp.width, h = bmp.height;
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d'); g.drawImage(bmp, 0, 0); bmp.close();
  const a = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 16) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error('No garment found in this photo');
  const pad = Math.round(Math.max(w, h) * 0.02);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const o = new OffscreenCanvas(x1 - x0 + 1, y1 - y0 + 1);
  o.getContext('2d').drawImage(c, -x0, -y0);
  return o.convertToBlob({ type: 'image/png' });
}

self.onmessage = async e => {
  const { id, blob } = e.data; current = id;
  try {
    device = device || await pickDevice();
    let out;
    try { out = await removeBackground(blob, config(device)); }
    catch (err) { if (device !== 'gpu') throw err; device = 'cpu'; out = await removeBackground(blob, config(device)); } // a GPU that can't run it
    self.postMessage({ id, blob: await trim(out), device });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
