// Web prototipini tek bir HTML dosyasına derler: prototype/dist/baharat-sort.html
// Aynı shared motoru (kurallar, çözücü, gömülü 300 seviye, ekonomi, reklam kuralları) kullanır.
import { build } from 'esbuild';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// Baharat fotoğraf dokuları (assets/spice_<anahtar>.jpg) için anahtar → asset haritası üret.
const spiceFiles = readdirSync(here('assets')).filter((f) => /^spice_[a-z]+\.jpg$/.test(f));
writeFileSync(
  here('src/textures.gen.ts'),
  '// build.mjs üretir; elle düzenleme.\nexport const SPICE_PHOTOS: Record<string, string> = {\n' +
    spiceFiles.map((f) => `  ${f.slice(6, -4)}: '__ASSET:${f}__',\n`).join('') +
    '};\n',
);
const result = await build({
  entryPoints: [here('src/main.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// prototype/assets içindeki görseller `__ASSET:dosya.jpg__` olarak anılır, data URI olarak gömülür.
const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const inline = (text) =>
  text.replace(/__ASSET:([\w.-]+)__/g, (_, name) => {
    const file = here(`assets/${name}`);
    if (!existsSync(file)) throw new Error(`Eksik asset: ${name}`);
    const ext = name.split('.').pop().toLowerCase();
    return `data:${mime[ext]};base64,${readFileSync(file).toString('base64')}`;
  });
const page = inline(
  readFileSync(here('src/page.html'), 'utf8').replace('/*__SCRIPT__*/', () => js),
);
mkdirSync(here('dist'), { recursive: true });
writeFileSync(here('dist/baharat-sort.html'), page);
console.log(`prototype/dist/baharat-sort.html (${Math.round(page.length / 1024)} KB)`);
