// Web prototipini tek bir HTML dosyasına derler: prototype/dist/baharat-sort.html
// Aynı shared motoru (kurallar, çözücü, gömülü 300 seviye, ekonomi, reklam kuralları) kullanır.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
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
const page = readFileSync(here('src/page.html'), 'utf8').replace('/*__SCRIPT__*/', () => js);
mkdirSync(here('dist'), { recursive: true });
writeFileSync(here('dist/baharat-sort.html'), page);
console.log(`prototype/dist/baharat-sort.html (${Math.round(page.length / 1024)} KB)`);
