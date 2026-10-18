// Web prototipini tek bir HTML dosyasına derler: prototype/dist/baharat-sort.html
// Aynı shared motoru (kurallar, çözücü, gömülü 1000 seviye, ekonomi, reklam kuralları) kullanır.
// Ayrıca iOS uygulaması için app/src/game/game.gen.ts yazar (aynı oyun, WebView'da).
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
const mime = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  woff2: 'font/woff2',
};
const inline = (text) =>
  text.replace(/__ASSET:([\w./-]+)__/g, (_, name) => {
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

// iOS uygulaması aynı oyunu çevrimdışı bir WebView'da çalıştırır: tam bir HTML belgesi, metin
// seçme/büyütme/uzun basma menüsü kapalı. app/src/game/game.gen.ts (gitignore'da) olarak yazılır.
// Uygulamada internet olmayabilir: Google Fonts bağlantıları yerine yazı tipleri gömülür (OFL).
const appFonts = inline(readFileSync(here('assets/fonts/fonts.css'), 'utf8'));
const appPage = page.replace(/<link\b[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '');
if (/fonts\.googleapis/.test(appPage)) throw new Error('Google Fonts bağlantısı ayıklanamadı');
const appDoc =
  '<!doctype html><html lang="tr"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">' +
  '<style>html,body{margin:0;height:100%;overflow:hidden;background:#1d120b;-webkit-user-select:none;user-select:none;' +
  '-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}</style>' +
  `<style>${appFonts}</style></head><body>` +
  appPage +
  '</body></html>';
const appOut = fileURLToPath(new URL('../app/src/game/game.gen.ts', import.meta.url));
mkdirSync(fileURLToPath(new URL('../app/src/game/', import.meta.url)), { recursive: true });
writeFileSync(
  appOut,
  '// prototype/build.mjs üretir; elle düzenleme. Oyunun tamamı (çevrimdışı, varlıklar gömülü).\n' +
    `export const GAME_HTML: string = ${JSON.stringify(appDoc)};\n`,
);
