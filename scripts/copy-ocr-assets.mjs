// Copies Tesseract.js worker, WASM core (LSTM builds) and English data into public/ocr
// so odometer OCR is self-hosted (no CDN, CSP-friendly, cacheable for offline use).
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
mkdirSync(out, { recursive: true });
const nm = join(root, 'node_modules');
const copy = (from, to = from.split('/').pop()) => {
  const src = join(nm, from);
  if (!existsSync(src)) throw new Error(`missing ${src} — run npm install`);
  cpSync(src, join(out, to));
};
copy('tesseract.js/dist/worker.min.js');
for (const f of readdirSync(join(nm, 'tesseract.js-core'))) {
  if (/^tesseract-core(-simd|-relaxedsimd)?-lstm\.wasm\.js$/.test(f)) copy(`tesseract.js-core/${f}`);
}
copy('@tesseract.js-data/eng/4.0.0/eng.traineddata.gz');
console.log('[ocr] assets copied to public/ocr');
